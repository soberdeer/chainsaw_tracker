import { prisma } from '../server/db.js';
import {
  buildGitHubBranchUrl,
  buildGitHubLinkTarget,
  logPrActivity,
} from '../server/services/github.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const originalFetch = globalThis.fetch;
const originalToken = process.env.OPENPROJECT_API_TOKEN;
const originalUserFindMany = prisma.user.findMany;
const originalNotificationCreateMany = prisma.notification.createMany;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.OPENPROJECT_API_TOKEN;
  else process.env.OPENPROJECT_API_TOKEN = originalToken;
  (prisma.user as any).findMany = originalUserFindMany;
  (prisma.notification as any).createMany = originalNotificationCreateMany;
});

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

test('logPrActivity creates notifications for OpenProject-backed pull requests', async () => {
  process.env.OPENPROJECT_API_TOKEN = 'op_test_token';
  const notificationPayloads: Array<Record<string, unknown>> = [];

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        id: 42,
        subject: 'CL-PROTO-42 Combat pass',
        _links: {
          assignee: { href: '/api/v3/users/11' },
          responsible: { href: '/api/v3/users/12' },
        },
      }),
      { status: 200 }
    )) as typeof fetch;

  (prisma.user as any).findMany = async () => [{ id: 'local-1' }, { id: 'local-2' }];
  (prisma.notification as any).createMany = async (input: {
    data: Array<Record<string, unknown>>;
  }) => {
    notificationPayloads.push(...input.data);
    return { count: input.data.length };
  };

  await logPrActivity(
    {
      id: 'pr-1',
      number: 12,
      url: 'https://github.com/demo/game/pull/12',
      taskId: null,
      workPackageId: '42',
    } as any,
    'GITHUB_PR_OPENED'
  );

  assert.equal(notificationPayloads.length, 2);
  assert.equal(notificationPayloads[0]?.workPackageId, '42');
  assert.equal(notificationPayloads[0]?.type, 'GITHUB_PR_OPENED');
  assert.equal(notificationPayloads[1]?.type, 'GITHUB_PR_OPENED');
});
