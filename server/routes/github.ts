import { Router } from 'express';
import { z } from 'zod';
import { requireCurrentUser } from '../services/auth.js';

export const githubRouter = Router();

githubRouter.use(async (req, _res, next) => {
  try {
    await requireCurrentUser(req);
    next();
  } catch (error) {
    next(error);
  }
});

interface GitHubRepository {
  id: string;
  workspaceId: string;
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  syncedAt: string | null;
  createdAt: string;
}

interface GitHubPullRequest {
  id: string;
  repositoryId: string;
  taskId: string;
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED';
  draft: boolean;
  isMerged: boolean;
  baseBranch: string;
  headBranch: string;
  headSha: string;
  authorLogin: string | null;
  reviewStatus: string;
  syncedAt: string | null;
  repository?: GitHubRepository;
}

const repositories: GitHubRepository[] = [];
const taskPullRequests = new Map<string, GitHubPullRequest[]>();
let seq = 1;

githubRouter.get('/repositories', (req, res) => {
  const { workspaceId } = req.query as { workspaceId?: string };
  const result = workspaceId
    ? repositories.filter((r) => r.workspaceId === workspaceId)
    : repositories;
  res.json(result);
});

githubRouter.post('/repositories', (req, res) => {
  const input = z
    .object({
      workspaceId: z.string(),
      owner: z.string().min(1),
      repo: z.string().min(1),
      defaultBranch: z.string().optional(),
    })
    .parse(req.body);
  const now = new Date().toISOString();
  const repository: GitHubRepository = {
    id: `gh-repo-${seq++}`,
    workspaceId: input.workspaceId,
    owner: input.owner,
    repo: input.repo,
    fullName: `${input.owner}/${input.repo}`,
    defaultBranch: input.defaultBranch ?? 'main',
    syncedAt: null,
    createdAt: now,
  };
  repositories.push(repository);
  res.status(201).json(repository);
});

githubRouter.post('/repositories/:id/sync-pull-requests', (req, res) => {
  const repository = repositories.find((r) => r.id === req.params.id);
  if (!repository) {
    res.status(404).json({ error: 'Repository not found' });
    return;
  }
  repository.syncedAt = new Date().toISOString();
  res.json({ created: 0, updated: 0, linked: 0, skipped: 0, errors: 0 });
});

githubRouter.post('/tasks/:taskId/link-pr', (req, res) => {
  const { taskId } = req.params;
  const input = z
    .object({
      repositoryId: z.string(),
      number: z.number().optional(),
      url: z.string().optional(),
    })
    .parse(req.body);
  const repository = repositories.find((r) => r.id === input.repositoryId);
  const now = new Date().toISOString();
  const pr: GitHubPullRequest = {
    id: `gh-pr-${seq++}`,
    repositoryId: input.repositoryId,
    taskId,
    number: input.number ?? 0,
    title: input.url ? `PR linked from ${input.url}` : 'Linked pull request',
    url: input.url ?? '',
    state: 'OPEN',
    draft: false,
    isMerged: false,
    baseBranch: repository?.defaultBranch ?? 'main',
    headBranch: '',
    headSha: '',
    authorLogin: null,
    reviewStatus: 'NONE',
    syncedAt: now,
    repository: repository,
  };
  const existing = taskPullRequests.get(taskId) ?? [];
  taskPullRequests.set(taskId, [...existing, pr]);
  res.status(201).json(pr);
});

githubRouter.delete('/tasks/:taskId/pull-requests/:pullRequestId', (req, res) => {
  const { taskId, pullRequestId } = req.params;
  const prs = taskPullRequests.get(taskId) ?? [];
  const idx = prs.findIndex((p) => p.id === pullRequestId);
  if (idx === -1) {
    res.status(404).json({ error: 'Pull request not found' });
    return;
  }
  prs.splice(idx, 1);
  taskPullRequests.set(taskId, prs);
  res.status(204).send();
});

githubRouter.post('/tasks/:taskId/refresh', (req, res) => {
  const { taskId } = req.params;
  const prs = taskPullRequests.get(taskId) ?? [];
  if (!prs.length) {
    res.json({ ok: true, skipped: 'no linked pull requests' });
    return;
  }
  const now = new Date().toISOString();
  prs.forEach((p) => {
    p.syncedAt = now;
  });
  res.json(prs[0]);
});
