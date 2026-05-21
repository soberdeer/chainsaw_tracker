import {
  cleanupLocalOpenProjectState,
  isDestructiveResetAllowed,
  parseResetArgs,
  REQUIRED_CONFIRMATION,
  runResetOpenProject,
  sortProjectsForDeletion,
} from '../scripts/reset-openproject.js';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

type FetchInput = Parameters<typeof fetch>[0];

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

test('parseResetArgs defaults to dry-run and reads confirm flags', () => {
  assert.deepEqual(parseResetArgs([]), {
    dryRun: true,
    yes: false,
    confirm: undefined,
    allowProduction: false,
    clearImportReports: false,
  });

  assert.deepEqual(
    parseResetArgs(['--yes', '--confirm', REQUIRED_CONFIRMATION, '--allow-production']),
    {
      dryRun: false,
      yes: true,
      confirm: REQUIRED_CONFIRMATION,
      allowProduction: true,
      clearImportReports: false,
    }
  );
});

test('isDestructiveResetAllowed blocks unsafe invocations', () => {
  process.env.OPENPROJECT_BASE_URL = 'http://localhost:8080';
  process.env.OPENPROJECT_API_TOKEN = 'token';

  assert.equal(isDestructiveResetAllowed(parseResetArgs(['--dry-run'])).allowed, false);
  assert.equal(
    isDestructiveResetAllowed(parseResetArgs(['--yes']), process.env).reason,
    'missing exact --confirm string'
  );
  assert.equal(
    isDestructiveResetAllowed(parseResetArgs(['--yes', '--confirm', REQUIRED_CONFIRMATION]), {
      ...process.env,
      NODE_ENV: 'production',
    }).reason,
    'missing --allow-production in production'
  );
  assert.equal(
    isDestructiveResetAllowed(
      parseResetArgs(['--yes', '--confirm', REQUIRED_CONFIRMATION, '--allow-production']),
      { ...process.env, NODE_ENV: 'production' }
    ).allowed,
    true
  );
});

test('sortProjectsForDeletion deletes children before parents', () => {
  const sorted = sortProjectsForDeletion([
    { id: '1', name: 'Parent' },
    { id: '2', name: 'Child', parentId: '1' },
    { id: '3', name: 'Grandchild', parentId: '2' },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ['3', '2', '1']
  );
});

test('cleanupLocalOpenProjectState clears stale references but preserves unrelated stores', async () => {
  const calls: Record<string, unknown[]> = {
    notificationDeleteMany: [],
    savedViewUpdateMany: [],
    savedViewFindMany: [],
    migrationRunDeleteMany: [],
  };
  const tmpDir = await mkdtemp(join(tmpdir(), 'op-reset-test-'));
  const hierarchyPath = join(tmpDir, 'clickup-hierarchy.json');
  await writeFile(hierarchyPath, '{"ok":true}\n');

  const fakePrisma = {
    notification: {
      deleteMany: async (args: unknown) => {
        calls.notificationDeleteMany.push(args);
        return { count: 2 };
      },
    },
    savedView: {
      updateMany: async (args: unknown) => {
        calls.savedViewUpdateMany.push(args);
        return { count: calls.savedViewUpdateMany.length === 1 ? 3 : 2 };
      },
      findMany: async (args: unknown) => {
        calls.savedViewFindMany.push(args);
        return [{ id: 'a' }, { id: 'b' }];
      },
    },
    migrationRun: {
      deleteMany: async (args: unknown) => {
        calls.migrationRunDeleteMany.push(args);
        return { count: 1 };
      },
    },
  } as const;

  const result = await cleanupLocalOpenProjectState(fakePrisma as never, {
    deletedProjectIds: ['10'],
    deletedWorkPackageIds: ['20'],
    clearImportReports: true,
    hierarchyPath,
  });

  assert.equal(result.notificationsDeleted, 2);
  assert.equal(result.savedViewsProjectCleared, 3);
  assert.equal(result.savedViewsListCleared, 2);
  assert.equal(result.importReportsDeleted, 1);
  assert.equal(result.hierarchyFileDeleted, true);
  assert.equal(result.hierarchyFileMissing, false);
  assert.equal(calls.notificationDeleteMany.length, 1);
  assert.equal(calls.savedViewUpdateMany.length, 2);
  assert.equal(calls.savedViewFindMany.length, 1);
  assert.equal(calls.migrationRunDeleteMany.length, 1);
});

test('runResetOpenProject dry-run never sends DELETE', async () => {
  process.env.OPENPROJECT_BASE_URL = 'http://localhost:8080';
  process.env.OPENPROJECT_API_TOKEN = 'token';

  const requests: string[] = [];
  globalThis.fetch = (async (input: FetchInput, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push(`${init?.method || 'GET'} ${url.pathname}`);
    if (url.pathname === '/api/v3/work_packages') {
      return new Response(
        JSON.stringify({ _embedded: { elements: [{ id: 20, subject: 'Task A', _links: {} }] } }),
        { status: 200 }
      );
    }
    if (url.pathname === '/api/v3/projects') {
      return new Response(
        JSON.stringify({
          _embedded: { elements: [{ id: 10, name: 'Project A', identifier: 'a', _links: {} }] },
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ _embedded: { elements: [] } }), { status: 200 });
  }) as typeof fetch;

  const fakePrisma = {
    notification: { deleteMany: async () => ({ count: 0 }) },
    savedView: {
      updateMany: async () => ({ count: 0 }),
      findMany: async () => [],
    },
    migrationRun: { deleteMany: async () => ({ count: 0 }) },
  } as const;

  const summary = await runResetOpenProject(parseResetArgs(['--dry-run']), fakePrisma as never);

  assert.equal(summary.mode, 'dry-run');
  assert.equal(summary.workPackagesFound, 1);
  assert.equal(summary.projectsFound, 1);
  assert.equal(summary.workPackagesDeleted, 0);
  assert.equal(summary.projectsDeleted, 0);
  assert.equal(
    requests.some((item) => item.startsWith('DELETE ')),
    false
  );
});

test('runResetOpenProject continues after delete failures and reports them', async () => {
  process.env.OPENPROJECT_BASE_URL = 'http://localhost:8080';
  process.env.OPENPROJECT_API_TOKEN = 'token';

  globalThis.fetch = (async (input: FetchInput, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method || 'GET';

    if (method === 'GET' && url.pathname === '/api/v3/work_packages') {
      return new Response(
        JSON.stringify({
          _embedded: { elements: [{ id: 20, subject: 'Task A', _links: {} }] },
        }),
        { status: 200 }
      );
    }

    if (method === 'GET' && url.pathname === '/api/v3/projects') {
      return new Response(
        JSON.stringify({
          _embedded: {
            elements: [
              { id: 10, name: 'Parent', identifier: 'parent', _links: {} },
              {
                id: 11,
                name: 'Child',
                identifier: 'child',
                _links: { parent: { href: '/api/v3/projects/10' } },
              },
            ],
          },
        }),
        { status: 200 }
      );
    }

    if (method === 'DELETE' && url.pathname === '/api/v3/work_packages/20') {
      return new Response(JSON.stringify({ message: 'locked' }), { status: 409 });
    }

    if (method === 'DELETE' && url.pathname === '/api/v3/projects/11') {
      return new Response(null, { status: 204 });
    }

    if (method === 'DELETE' && url.pathname === '/api/v3/projects/10') {
      return new Response(JSON.stringify({ message: 'cannot delete parent' }), { status: 409 });
    }

    return new Response(JSON.stringify({ _embedded: { elements: [] } }), { status: 200 });
  }) as typeof fetch;

  const fakePrisma = {
    notification: { deleteMany: async () => ({ count: 0 }) },
    savedView: {
      updateMany: async () => ({ count: 0 }),
      findMany: async () => [],
    },
    migrationRun: { deleteMany: async () => ({ count: 0 }) },
  } as const;

  const summary = await runResetOpenProject(
    parseResetArgs(['--yes', '--confirm', REQUIRED_CONFIRMATION]),
    fakePrisma as never
  );

  assert.equal(summary.workPackagesDeleted, 0);
  assert.equal(summary.projectsDeleted, 1);
  assert.equal(summary.workPackageDeleteFailures.length, 1);
  assert.equal(summary.projectDeleteFailures.length, 1);
  assert.equal(summary.projectsPreview[0]?.id, '11');
});
