import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { currentUserId, requirePermission, workspaceMembership } from '../services/permissions.js';
import { logPrActivity, upsertPullRequest, upsertRepository, verifyGitHubSignature } from '../services/github.js';
import { logTaskActivity } from '../services/activity.js';

export const integrationsRouter = Router();

function githubHeaders(req: Request) {
  return {
    event: (req as { header(name: string): string | undefined }).header('x-github-event') || '',
    delivery: (req as { header(name: string): string | undefined }).header('x-github-delivery') || ''
  };
}

async function requireGithubSettingsAccess(req: Request, workspaceId: string) {
  await requirePermission(req, workspaceId, 'manageWorkspace');
}

function isGitHubIntegrationEnabled() {
  return process.env.GITHUB_INTEGRATION_ENABLED === 'true' || Boolean(process.env.GITHUB_TOKEN || process.env.GITHUB_WEBHOOK_SECRET);
}

function sendGitHubDisabled(res: { status: (code: number) => { json: (body: unknown) => void } }) {
  res.status(503).json({ error: 'GitHub integration is disabled' });
}

async function requireTaskGithubAccess(req: Request, taskId: string) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: { folder: { include: { space: true } } } });
  const membership = await workspaceMembership(req, task.workspaceId || task.folder.space.workspaceId);
  if (!membership) {
    const error = new Error('Missing workspace membership');
    Object.assign(error, { statusCode: 403 });
    throw error;
  }
  if (['OWNER', 'ADMIN', 'LEAD'].includes(membership.role)) return task;
  const userId = currentUserId(req);
  if (membership.role === 'MEMBER' && (task.assigneeId === userId || task.createdById === userId)) return task;
  const error = new Error('Missing GitHub task permission');
  Object.assign(error, { statusCode: 403 });
  throw error;
}

integrationsRouter.post('/github/webhook', async (req, res) => {
  if (!isGitHubIntegrationEnabled()) {
    sendGitHubDisabled(res);
    return;
  }
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const { event, delivery } = githubHeaders(req);
  console.log(`GitHub webhook ${event || 'unknown'} delivery=${delivery || 'unknown'}`);

  if (!verifyGitHubSignature(rawBody, req.header('x-hub-signature-256'))) {
    res.status(401).json({ error: 'Invalid GitHub signature' });
    return;
  }

  const payload = req.body as Record<string, any>;
  const repoPayload = payload.repository;
  if (!repoPayload?.owner?.login || !repoPayload?.name) {
    res.json({ ok: true, skipped: 'missing repository' });
    return;
  }

  const workspace = await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!workspace) {
    res.json({ ok: true, skipped: 'missing workspace' });
    return;
  }

  const repository = await upsertRepository({
    workspaceId: workspace.id,
    owner: repoPayload.owner.login,
    repo: repoPayload.name,
    defaultBranch: repoPayload.default_branch || 'main'
  });

  if (event === 'pull_request') {
    const prPayload = payload.pull_request;
    const requested = Array.isArray(prPayload.requested_reviewers) && prPayload.requested_reviewers.length > 0;
    const reviewStatus =
      payload.action === 'review_requested' || requested ? 'REVIEW_REQUESTED' :
      prPayload.draft ? 'NONE' :
      prPayload.merged ? 'MERGED' :
      prPayload.state === 'closed' ? 'CLOSED' :
      'IN_REVIEW';

    const { pr } = await upsertPullRequest(repository, {
      githubPrId: String(prPayload.id),
      number: prPayload.number,
      title: prPayload.title,
      url: prPayload.html_url,
      state: prPayload.state === 'closed' ? 'CLOSED' : 'OPEN',
      draft: Boolean(prPayload.draft),
      isMerged: Boolean(prPayload.merged),
      baseBranch: prPayload.base?.ref || '',
      headBranch: prPayload.head?.ref || '',
      headSha: prPayload.head?.sha || '',
      authorLogin: prPayload.user?.login,
      reviewStatus
    });

    const activityByAction: Record<string, 'GITHUB_PR_OPENED' | 'GITHUB_PR_READY_FOR_REVIEW' | 'GITHUB_PR_REVIEW_REQUESTED' | 'GITHUB_PR_MERGED' | 'GITHUB_PR_CLOSED'> = {
      opened: 'GITHUB_PR_OPENED',
      reopened: 'GITHUB_PR_OPENED',
      ready_for_review: 'GITHUB_PR_READY_FOR_REVIEW',
      review_requested: 'GITHUB_PR_REVIEW_REQUESTED',
      closed: prPayload.merged ? 'GITHUB_PR_MERGED' : 'GITHUB_PR_CLOSED'
    };
    const activity = activityByAction[payload.action];
    if (activity) await logPrActivity({ ...pr, reviewStatus }, activity);
    res.json({ ok: true, pullRequestId: pr.id, taskId: pr.taskId });
    return;
  }

  if (event === 'pull_request_review' && payload.action === 'submitted') {
    const prPayload = payload.pull_request;
    const reviewState = String(payload.review?.state || '').toLowerCase();
    const reviewStatus =
      reviewState === 'approved' ? 'APPROVED' :
      reviewState === 'changes_requested' ? 'CHANGES_REQUESTED' :
      reviewState === 'commented' ? 'COMMENTED' :
      'IN_REVIEW';
    const pr = await prisma.gitHubPullRequest.update({
      where: { repositoryId_number: { repositoryId: repository.id, number: prPayload.number } },
      data: { reviewStatus, syncedAt: new Date() }
    }).catch(() => null);
    if (pr) {
      const eventType =
        reviewStatus === 'APPROVED' ? 'GITHUB_PR_APPROVED' :
        reviewStatus === 'CHANGES_REQUESTED' ? 'GITHUB_PR_CHANGES_REQUESTED' :
        'GITHUB_PR_REVIEW_COMMENTED';
      await logPrActivity(pr, eventType);
    }
    res.json({ ok: true, pullRequestId: pr?.id || null });
    return;
  }

  res.json({ ok: true, ignored: event || 'unknown' });
});

integrationsRouter.get('/github/repositories', async (req, res) => {
  const workspaceId = z.string().parse(req.query.workspaceId);
  await requirePermission(req, workspaceId, 'manageTasks');
  if (!isGitHubIntegrationEnabled()) {
    res.json([]);
    return;
  }
  const repositories = await prisma.gitHubRepository.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } });
  res.json(repositories);
});

integrationsRouter.post('/github/repositories', async (req, res) => {
  if (!isGitHubIntegrationEnabled()) {
    sendGitHubDisabled(res);
    return;
  }
  const body = z.object({
    workspaceId: z.string(),
    owner: z.string().min(1),
    repo: z.string().min(1),
    defaultBranch: z.string().optional()
  }).parse(req.body);
  await requireGithubSettingsAccess(req, body.workspaceId);
  const repository = await upsertRepository(body);
  res.status(201).json(repository);
});

integrationsRouter.post('/github/repositories/:id/sync-pull-requests', async (req, res) => {
  if (!isGitHubIntegrationEnabled()) {
    sendGitHubDisabled(res);
    return;
  }
  const repository = await prisma.gitHubRepository.findUniqueOrThrow({ where: { id: req.params.id } });
  await requireGithubSettingsAccess(req, repository.workspaceId);
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    res.status(400).json({ error: 'GITHUB_TOKEN is not configured' });
    return;
  }

  const response = await fetch(`https://api.github.com/repos/${repository.owner}/${repository.repo}/pulls?state=open&per_page=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'compact-tracker'
    }
  });
  if (!response.ok) {
    res.status(response.status).json({ error: 'GitHub API request failed', detail: await response.text() });
    return;
  }

  const pullRequests = await response.json() as any[];
  const summary = { created: 0, updated: 0, linked: 0, skipped: 0, errors: 0 };
  for (const item of pullRequests) {
    try {
      const existing = await prisma.gitHubPullRequest.findUnique({ where: { repositoryId_githubPrId: { repositoryId: repository.id, githubPrId: String(item.id) } } });
      const reviewsResponse = await fetch(`https://api.github.com/repos/${repository.owner}/${repository.repo}/pulls/${item.number}/reviews`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'compact-tracker' }
      });
      const reviews = reviewsResponse.ok ? await reviewsResponse.json() as any[] : [];
      const latestReview = reviews.at(-1);
      const reviewStatus =
        latestReview?.state === 'APPROVED' ? 'APPROVED' :
        latestReview?.state === 'CHANGES_REQUESTED' ? 'CHANGES_REQUESTED' :
        latestReview?.state === 'COMMENTED' ? 'COMMENTED' :
        Array.isArray(item.requested_reviewers) && item.requested_reviewers.length ? 'REVIEW_REQUESTED' :
        item.draft ? 'NONE' :
        'IN_REVIEW';
      const { linkedTaskId } = await upsertPullRequest(repository, {
        githubPrId: String(item.id),
        number: item.number,
        title: item.title,
        url: item.html_url,
        state: 'OPEN',
        draft: Boolean(item.draft),
        isMerged: false,
        baseBranch: item.base?.ref || '',
        headBranch: item.head?.ref || '',
        headSha: item.head?.sha || '',
        authorLogin: item.user?.login,
        reviewStatus
      });
      if (existing) summary.updated += 1;
      else summary.created += 1;
      if (linkedTaskId) summary.linked += 1;
    } catch {
      summary.errors += 1;
    }
  }
  res.json(summary);
});

integrationsRouter.post('/github/tasks/:taskId/link-pr', async (req, res) => {
  if (!isGitHubIntegrationEnabled()) {
    sendGitHubDisabled(res);
    return;
  }
  const task = await requireTaskGithubAccess(req, req.params.taskId);
  const body = z.object({
    repositoryId: z.string(),
    number: z.coerce.number().int().positive().optional(),
    url: z.string().url().optional()
  }).parse(req.body);
  const repository = await prisma.gitHubRepository.findUniqueOrThrow({ where: { id: body.repositoryId } });
  const number = body.number || Number(body.url?.match(/\/pull\/(\d+)/)?.[1]);
  if (!number) {
    res.status(400).json({ error: 'PR number or GitHub PR URL is required' });
    return;
  }
  const pr = await prisma.gitHubPullRequest.findUnique({ where: { repositoryId_number: { repositoryId: repository.id, number } } });
  if (!pr) {
    res.status(404).json({ error: 'PR is not synced yet' });
    return;
  }
  const updated = await prisma.gitHubPullRequest.update({ where: { id: pr.id }, data: { taskId: task.id } });
  await prisma.taskGitHubLink.create({ data: { taskId: task.id, repositoryId: repository.id, pullRequestId: pr.id, linkType: 'PULL_REQUEST' } }).catch(() => null);
  await logTaskActivity({ workspaceId: task.workspaceId || task.folder.space.workspaceId, taskId: task.id, actorId: currentUserId(req), type: 'TASK_LINKED_TO_GITHUB_PR', message: `Linked PR #${number}` });
  res.json(updated);
});

integrationsRouter.delete('/github/tasks/:taskId/pull-requests/:pullRequestId', async (req, res) => {
  if (!isGitHubIntegrationEnabled()) {
    sendGitHubDisabled(res);
    return;
  }
  const task = await requireTaskGithubAccess(req, req.params.taskId);
  await prisma.gitHubPullRequest.update({ where: { id: req.params.pullRequestId }, data: { taskId: null } });
  await prisma.taskGitHubLink.deleteMany({ where: { taskId: task.id, pullRequestId: req.params.pullRequestId } });
  res.status(204).send();
});

integrationsRouter.post('/github/tasks/:taskId/refresh', async (req, res) => {
  if (!isGitHubIntegrationEnabled()) {
    sendGitHubDisabled(res);
    return;
  }
  const task = await requireTaskGithubAccess(req, req.params.taskId);
  const pullRequest = await prisma.gitHubPullRequest.findFirst({ where: { taskId: task.id }, include: { repository: true }, orderBy: { updatedAt: 'desc' } });
  if (!pullRequest) {
    res.json({ ok: true, skipped: 'no pull request' });
    return;
  }
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    res.status(400).json({ error: 'GITHUB_TOKEN is not configured' });
    return;
  }
  const response = await fetch(`https://api.github.com/repos/${pullRequest.repository.owner}/${pullRequest.repository.repo}/pulls/${pullRequest.number}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'compact-tracker' }
  });
  if (!response.ok) {
    res.status(response.status).json({ error: 'GitHub API request failed', detail: await response.text() });
    return;
  }
  const item = await response.json() as any;
  const updated = await prisma.gitHubPullRequest.update({
    where: { id: pullRequest.id },
    data: {
      title: item.title,
      url: item.html_url,
      state: item.state === 'closed' ? 'CLOSED' : 'OPEN',
      draft: Boolean(item.draft),
      isMerged: Boolean(item.merged),
      baseBranch: item.base?.ref || '',
      headBranch: item.head?.ref || '',
      headSha: item.head?.sha || '',
      authorLogin: item.user?.login,
      syncedAt: new Date()
    }
  });
  res.json(updated);
});
