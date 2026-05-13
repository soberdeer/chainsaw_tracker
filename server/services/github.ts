import crypto from 'node:crypto';
import type { ActivityEventType, GitHubPullRequest, GitHubRepository, GitHubReviewStatus } from '@prisma/client';
import { prisma } from '../db.js';
import { logTaskActivity } from './activity.js';
import { findTaskKey } from './taskKeys.js';

export function verifyGitHubSignature(rawBody: Buffer, signature: string | undefined, secret = process.env.GITHUB_WEBHOOK_SECRET) {
  if (!secret || !signature?.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return signatureBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

export async function findTaskForGitHubLink(repository: GitHubRepository, ...values: Array<string | null | undefined>) {
  const taskKey = findTaskKey(...values);
  if (!taskKey) return null;
  return prisma.task.findFirst({
    where: {
      workspaceId: repository.workspaceId,
      taskKey
    }
  });
}

export async function linkPullRequestToTask(pr: GitHubPullRequest, taskId: string, eventType: ActivityEventType = 'TASK_LINKED_TO_GITHUB_PR') {
  await prisma.gitHubPullRequest.update({ where: { id: pr.id }, data: { taskId } });
  await prisma.taskGitHubLink.upsert({
    where: {
      taskId_repositoryId_linkType_branchId_pullRequestId_commitSha: {
        taskId,
        repositoryId: pr.repositoryId,
        linkType: 'PULL_REQUEST',
        branchId: '',
        pullRequestId: pr.id,
        commitSha: ''
      }
    },
    create: {
      taskId,
      repositoryId: pr.repositoryId,
      pullRequestId: pr.id,
      linkType: 'PULL_REQUEST'
    },
    update: {}
  }).catch(async () => {
    const exists = await prisma.taskGitHubLink.findFirst({ where: { taskId, repositoryId: pr.repositoryId, pullRequestId: pr.id, linkType: 'PULL_REQUEST' } });
    if (!exists) {
      await prisma.taskGitHubLink.create({ data: { taskId, repositoryId: pr.repositoryId, pullRequestId: pr.id, linkType: 'PULL_REQUEST' } });
    }
  });
  await logTaskActivity({
    taskId,
    type: eventType,
    message: `Linked PR #${pr.number}`,
    metadata: { pullRequestId: pr.id, number: pr.number, url: pr.url }
  });
}

export async function upsertRepository(input: { workspaceId: string; owner: string; repo: string; defaultBranch?: string }) {
  return prisma.gitHubRepository.upsert({
    where: { workspaceId_provider_owner_repo: { workspaceId: input.workspaceId, provider: 'GITHUB', owner: input.owner, repo: input.repo } },
    create: { workspaceId: input.workspaceId, owner: input.owner, repo: input.repo, defaultBranch: input.defaultBranch || 'main' },
    update: { defaultBranch: input.defaultBranch || undefined }
  });
}

export async function upsertPullRequest(repository: GitHubRepository, payload: {
  githubPrId: string;
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED';
  draft: boolean;
  isMerged: boolean;
  baseBranch: string;
  headBranch: string;
  headSha: string;
  authorLogin?: string | null;
  reviewStatus?: GitHubReviewStatus;
}) {
  const task = await findTaskForGitHubLink(repository, payload.title, payload.headBranch);
  const pr = await prisma.gitHubPullRequest.upsert({
    where: { repositoryId_githubPrId: { repositoryId: repository.id, githubPrId: payload.githubPrId } },
    create: {
      repositoryId: repository.id,
      taskId: task?.id,
      githubPrId: payload.githubPrId,
      number: payload.number,
      title: payload.title,
      url: payload.url,
      state: payload.state,
      draft: payload.draft,
      isMerged: payload.isMerged,
      baseBranch: payload.baseBranch,
      headBranch: payload.headBranch,
      headSha: payload.headSha,
      authorLogin: payload.authorLogin,
      reviewStatus: payload.reviewStatus || 'NONE',
      syncedAt: new Date()
    },
    update: {
      taskId: task?.id,
      title: payload.title,
      url: payload.url,
      state: payload.state,
      draft: payload.draft,
      isMerged: payload.isMerged,
      baseBranch: payload.baseBranch,
      headBranch: payload.headBranch,
      headSha: payload.headSha,
      authorLogin: payload.authorLogin,
      reviewStatus: payload.reviewStatus,
      syncedAt: new Date()
    }
  });
  if (task) await linkPullRequestToTask(pr, task.id).catch(() => undefined);
  return { pr, linkedTaskId: task?.id || null };
}

export async function logPrActivity(pr: GitHubPullRequest, type: ActivityEventType) {
  if (!pr.taskId) return null;
  return logTaskActivity({
    taskId: pr.taskId,
    type,
    message: `GitHub PR #${pr.number}: ${type}`,
    metadata: { pullRequestId: pr.id, number: pr.number, url: pr.url }
  });
}
