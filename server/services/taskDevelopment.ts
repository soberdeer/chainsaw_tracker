import type { GitHubPullRequest, Task } from '@prisma/client';

export type TaskDevelopmentStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BRANCH_CREATED'
  | 'PR_OPEN'
  | 'CODE_REVIEW'
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'MERGED'
  | 'CLOSED';

type TaskWithGithub = Task & {
  githubBranches?: unknown[];
  githubPullRequests?: GitHubPullRequest[];
};

export function computeTaskDevelopmentStatus(task: TaskWithGithub): TaskDevelopmentStatus {
  const prs = task.githubPullRequests || [];
  const branches = task.githubBranches || [];
  const pr = prs.find((item) => item.isMerged) || prs.find((item) => item.state === 'OPEN') || prs[0];

  if (pr?.isMerged || pr?.reviewStatus === 'MERGED') return 'MERGED';
  if (pr?.state === 'CLOSED' || pr?.reviewStatus === 'CLOSED') return 'CLOSED';
  if (pr?.reviewStatus === 'CHANGES_REQUESTED') return 'CHANGES_REQUESTED';
  if (pr?.reviewStatus === 'APPROVED') return 'APPROVED';
  if (pr?.state === 'OPEN' && pr.draft) return 'PR_OPEN';
  if (pr?.state === 'OPEN' && ['IN_REVIEW', 'REVIEW_REQUESTED', 'COMMENTED'].includes(pr.reviewStatus)) return 'CODE_REVIEW';
  if (pr?.state === 'OPEN') return 'PR_OPEN';
  if (branches.length > 0) return 'BRANCH_CREATED';

  return ['in development', 'in progress', 'review', 'in review'].includes(task.status.toLowerCase()) ? 'IN_PROGRESS' : 'NOT_STARTED';
}

export function githubStatusMatches(task: TaskWithGithub, filter?: string) {
  if (!filter) return true;
  const prs = task.githubPullRequests || [];
  const branches = task.githubBranches || [];
  const dev = computeTaskDevelopmentStatus(task);

  if (filter === 'NO_PR') return prs.length === 0;
  if (filter === 'HAS_BRANCH') return branches.length > 0 && prs.length === 0;
  if (filter === 'PR_OPEN') return prs.some((pr) => pr.state === 'OPEN');
  if (filter === 'IN_REVIEW') return dev === 'CODE_REVIEW';
  if (filter === 'REVIEW_REQUESTED') return prs.some((pr) => pr.reviewStatus === 'REVIEW_REQUESTED');
  if (filter === 'APPROVED') return dev === 'APPROVED';
  if (filter === 'CHANGES_REQUESTED') return dev === 'CHANGES_REQUESTED';
  if (filter === 'MERGED') return dev === 'MERGED';
  if (filter === 'CLOSED') return dev === 'CLOSED';
  return true;
}
