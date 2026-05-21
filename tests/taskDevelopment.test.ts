import { computeTaskDevelopmentStatus } from '../server/services/taskDevelopment.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const baseTask = {
  id: 'task',
  folderId: 'folder',
  title: 'Task',
  status: 'backlog',
  priority: 'NORMAL',
  position: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

test('computeTaskDevelopmentStatus reports code review and review results', () => {
  assert.equal(
    computeTaskDevelopmentStatus({
      ...baseTask,
      githubPullRequests: [
        { state: 'OPEN', draft: false, reviewStatus: 'REVIEW_REQUESTED', isMerged: false },
      ],
    } as never),
    'CODE_REVIEW'
  );
  assert.equal(
    computeTaskDevelopmentStatus({
      ...baseTask,
      githubPullRequests: [
        { state: 'OPEN', draft: false, reviewStatus: 'APPROVED', isMerged: false },
      ],
    } as never),
    'APPROVED'
  );
  assert.equal(
    computeTaskDevelopmentStatus({
      ...baseTask,
      githubPullRequests: [
        { state: 'OPEN', draft: false, reviewStatus: 'CHANGES_REQUESTED', isMerged: false },
      ],
    } as never),
    'CHANGES_REQUESTED'
  );
  assert.equal(
    computeTaskDevelopmentStatus({
      ...baseTask,
      githubPullRequests: [
        { state: 'CLOSED', draft: false, reviewStatus: 'MERGED', isMerged: true },
      ],
    } as never),
    'MERGED'
  );
});
