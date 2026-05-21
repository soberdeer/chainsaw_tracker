import { buildGitHubBranchUrl, buildGitHubLinkTarget } from '../server/services/github.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('buildGitHubLinkTarget keeps task and work package bindings mutually exclusive', () => {
  assert.deepEqual(buildGitHubLinkTarget({ taskId: 'task-1' }), {
    taskId: 'task-1',
    workPackageId: null,
  });
  assert.deepEqual(buildGitHubLinkTarget({ workPackageId: '42' }), {
    taskId: null,
    workPackageId: '42',
  });
  assert.deepEqual(buildGitHubLinkTarget({}), {
    taskId: null,
    workPackageId: null,
  });
});

test('buildGitHubBranchUrl preserves nested branch paths', () => {
  assert.equal(
    buildGitHubBranchUrl(
      {
        owner: 'demo',
        repo: 'game',
      },
      'feature/CL-PROTO-001/combat-pass'
    ),
    'https://github.com/demo/game/tree/feature/CL-PROTO-001/combat-pass'
  );
});
