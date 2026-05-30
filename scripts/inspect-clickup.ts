/**
 * Read-only ClickUp + OpenProject inspector.
 *
 * Shows exactly what the seed script fetches and how statuses map.
 *
 * Usage:
 *   npx tsx scripts/inspect-clickup.ts          # reads .env automatically
 *
 * Or override inline:
 *   CLICKUP_TOKEN=<token> OPENPROJECT_URL=<url> OPENPROJECT_API_KEY=<key> \
 *     npx tsx scripts/inspect-clickup.ts
 *
 * Optional env flags:
 *   INSPECT_TASKS=1         — also dump tasks for every list (default: off)
 *   INSPECT_LIST_ID=<id>    — dump tasks only for a specific ClickUp list ID
 *   INSPECT_SPACE_ID=<id>   — only inspect one space
 */

import 'dotenv/config';
import { openProjectRequest } from '../server/openproject/client.js';
import type {
  HalCollection,
  OpenProjectStatus,
  OpenProjectWorkPackage,
} from '../server/openproject/types.js';
import { clickUpRequest } from './migration/clickup/client.js';
import type {
  ClickUpFolder,
  ClickUpList,
  ClickUpSpace,
  ClickUpStatus,
  ClickUpTask,
} from './migration/clickup/types.js';

const INSPECT_TASKS = process.env.INSPECT_TASKS === '1';
const INSPECT_LIST_ID = process.env.INSPECT_LIST_ID;
const INSPECT_SPACE_ID = process.env.INSPECT_SPACE_ID;
// INSPECT_OP=1  — show all OP projects + task counts
// INSPECT_OP_PROJECT_ID=<id>  — also dump work packages for that project
const INSPECT_OP = process.env.INSPECT_OP === '1' || Boolean(process.env.INSPECT_OP_PROJECT_ID);
const BASE_URL = 'https://api.clickup.com/api/v2';

// ─── helpers ────────────────────────────────────────────────────────────────

function requestUrl(path: string, query: Record<string, string | number | boolean> = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  return url.toString();
}

function section(title: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function statusLine(s: ClickUpStatus) {
  return `  [${(s.type || '?').padEnd(7)}]  ${s.status.padEnd(30)} id=${s.id ?? '–'}  order=${s.orderindex ?? '–'}`;
}

// ─── OP statuses ────────────────────────────────────────────────────────────

async function inspectOpenProjectStatuses() {
  section('OpenProject statuses  (GET /api/v3/statuses)');
  try {
    const page = await openProjectRequest<HalCollection<OpenProjectStatus>>('/api/v3/statuses', {
      query: { pageSize: 500 },
    });
    const statuses = page._embedded?.elements || [];
    if (!statuses.length) {
      console.log('  (no statuses returned)');
      return statuses;
    }
    console.log(`  Total: ${statuses.length}\n`);
    for (const s of statuses) {
      const closed = s.isClosed ? ' [closed]' : '';
      console.log(
        `  id=${String(s.id).padEnd(4)}  pos=${String(s.position ?? '?').padEnd(3)}  ${s.name}${closed}`
      );
    }
    return statuses;
  } catch (e) {
    console.log(`  ERROR: ${(e as Error).message}`);
    return [] as OpenProjectStatus[];
  }
}

// ─── OP project + work packages inspector ────────────────────────────────────

type OpProject = {
  id: number;
  name: string;
  identifier?: string;
  active?: boolean;
  _links: Record<string, unknown>;
};

async function inspectOpenProject(targetProjectId?: string) {
  section('OpenProject projects');

  const page = await openProjectRequest<HalCollection<OpProject>>('/api/v3/projects', {
    query: { pageSize: 200 },
  }).catch((e: Error) => {
    console.log(`  ERROR fetching projects: ${e.message}`);
    return null;
  });

  if (!page) return;

  const projects = page._embedded?.elements || [];
  console.log(`  Total: ${projects.length}\n`);

  for (const p of projects) {
    const active = p.active === false ? ' [inactive]' : '';
    const id = String(p.id).padEnd(5);
    console.log(`  id=${id}  ${p.name}  identifier=${(p as any).identifier ?? '?'}${active}`);
  }

  // Per-project work package count
  section('OpenProject work packages per project');
  for (const p of projects) {
    try {
      const wpPage = await openProjectRequest<HalCollection<OpenProjectWorkPackage>>(
        `/api/v3/projects/${p.id}/work_packages`,
        { query: { pageSize: 1 } }
      );
      const total = wpPage.total ?? 0;
      const marker = total === 0 ? '  ← EMPTY' : '';
      console.log(
        `  project ${String(p.id).padEnd(5)}  "${p.name.padEnd(30)}"  tasks=${total}${marker}`
      );
    } catch (e) {
      console.log(`  project ${p.id}  "${p.name}"  ERROR: ${(e as Error).message}`);
    }
  }

  // Full task dump for a specific project
  if (targetProjectId) {
    section(`OpenProject work packages in project ${targetProjectId}`);
    try {
      const wpPage = await openProjectRequest<HalCollection<OpenProjectWorkPackage>>(
        `/api/v3/projects/${targetProjectId}/work_packages`,
        {
          query: {
            pageSize: 100,
            filters: JSON.stringify([{ status: { operator: '*', values: [] } }]),
          },
        }
      );
      const items = wpPage._embedded?.elements || [];
      console.log(`  Total: ${wpPage.total ?? '?'}  showing: ${items.length}\n`);

      const byStatus = new Map<string, number>();
      for (const wp of items) {
        const st = wp._links.status?.title ?? '?';
        byStatus.set(st, (byStatus.get(st) ?? 0) + 1);
      }
      console.log('  Status distribution:');
      for (const [st, count] of [...byStatus.entries()].sort()) {
        console.log(`    ${String(count).padStart(3)}×  ${st}`);
      }

      console.log('\n  All work packages:');
      for (const wp of items) {
        const st = wp._links.status?.title ?? '?';
        const stHref = (wp._links.status as any)?.href ?? '';
        const stId = stHref.split('/').at(-1) ?? '?';
        console.log(`    #${String(wp.id).padEnd(5)}  status="${st}"(id=${stId})  "${wp.subject}"`);
      }
    } catch (e) {
      console.log(`  ERROR: ${(e as Error).message}`);
    }
  }
}

// ─── ClickUp tasks ──────────────────────────────────────────────────────────

async function inspectClickUpTasks(list: ClickUpList) {
  const url = requestUrl(`/list/${list.id}/task`, {
    archived: false,
    include_markdown_description: true,
    subtasks: true,
    page: 0,
    order_by: 'created',
    reverse: false,
  });
  console.log(`\n  ► GET ${url}`);

  try {
    const payload = await clickUpRequest<{ tasks: ClickUpTask[] }>(`/list/${list.id}/task`, {
      query: {
        archived: false,
        include_markdown_description: true,
        subtasks: true,
        page: 0,
        order_by: 'created',
        reverse: false,
      },
    });
    const tasks = payload.tasks || [];
    console.log(`    returned ${tasks.length} task(s)  (page 0, max 100)\n`);

    const byStatus = new Map<string, number>();
    for (const t of tasks) {
      const key = `${t.status?.type ?? '?'} / ${t.status?.status ?? '?'}`;
      byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
    }

    console.log('    Status distribution:');
    for (const [key, count] of [...byStatus.entries()].sort()) {
      console.log(`      ${count.toString().padStart(3)}×  ${key}`);
    }

    if (tasks.length <= 20) {
      console.log('\n    All tasks:');
    } else {
      console.log('\n    First 20 tasks:');
    }
    for (const t of tasks.slice(0, 20)) {
      const st = t.status;
      console.log(
        `      id=${t.id}  status.type="${st?.type ?? '?'}"  status.status="${st?.status ?? '?'}"  name="${t.name}"`
      );
    }
  } catch (e) {
    console.log(`    ERROR: ${(e as Error).message}`);
  }
}

// ─── ClickUp hierarchy ──────────────────────────────────────────────────────

async function inspectClickUpSpace(space: ClickUpSpace, opStatuses: OpenProjectStatus[]) {
  section(`Space: "${space.name}"  (id=${space.id})`);

  // Space-level statuses
  const spaceStatuses = space.statuses ?? [];
  if (spaceStatuses.length) {
    console.log(`  Space statuses (${spaceStatuses.length}):`);
    for (const s of spaceStatuses) console.log(statusLine(s));
  }

  // Folders
  const foldersUrl = requestUrl(`/space/${space.id}/folder`, { archived: false });
  console.log(`\n  ► GET ${foldersUrl}`);

  const folders = await clickUpRequest<{ folders: ClickUpFolder[] }>(`/space/${space.id}/folder`, {
    query: { archived: false },
  })
    .then((p) => p.folders ?? [])
    .catch((e: Error) => {
      console.log(`    ERROR: ${e.message}`);
      return [] as ClickUpFolder[];
    });

  console.log(`    returned ${folders.length} folder(s)`);

  for (const folder of folders) {
    console.log(`\n  Folder: "${folder.name}"  (id=${folder.id})`);
    const folderStatuses = folder.statuses ?? [];
    if (folderStatuses.length) {
      console.log(`    Folder statuses (${folderStatuses.length}):`);
      for (const s of folderStatuses) console.log(`  ${statusLine(s)}`);
    }

    const listsUrl = requestUrl(`/folder/${folder.id}/list`, { archived: false });
    console.log(`\n    ► GET ${listsUrl}`);
    const shallowLists = await clickUpRequest<{ lists: ClickUpList[] }>(
      `/folder/${folder.id}/list`,
      {
        query: { archived: false },
      }
    )
      .then((p) => p.lists ?? [])
      .catch((e: Error) => {
        console.log(`      ERROR: ${e.message}`);
        return [] as ClickUpList[];
      });
    console.log(`      returned ${shallowLists.length} list(s)`);

    for (const shallow of shallowLists) {
      // Fetch full list details — collection endpoint omits statuses
      const listUrl = requestUrl(`/list/${shallow.id}`);
      console.log(`\n    ► GET ${listUrl}  (full list details)`);
      const list = await clickUpRequest<ClickUpList>(`/list/${shallow.id}`).catch((e: Error) => {
        console.log(`      ERROR fetching list details: ${e.message}`);
        return shallow;
      });

      console.log(`\n    List: "${list.name}"  (id=${list.id})`);
      const listStatuses = list.statuses ?? [];
      const effectiveStatuses = listStatuses.length
        ? listStatuses
        : folder.statuses?.length
          ? folder.statuses
          : spaceStatuses;
      const source = listStatuses.length ? 'list' : folder.statuses?.length ? 'folder' : 'space';

      console.log(`    Effective statuses (from ${source}, ${effectiveStatuses.length}):`);
      for (const s of effectiveStatuses) {
        const opId = mapStatusToOpId(s, opStatuses);
        const opName = opStatuses.find((o) => String(o.id) === opId)?.name ?? '?';
        console.log(`${statusLine(s)}  →  OP id=${opId} "${opName}"`);
      }

      if (INSPECT_TASKS || INSPECT_LIST_ID === list.id) {
        await inspectClickUpTasks(list);
      }
    }
  }

  // Folderless lists
  const flUrl = requestUrl(`/space/${space.id}/list`, { archived: false });
  console.log(`\n  ► GET ${flUrl}  (folderless lists)`);
  const shallowFolderless = await clickUpRequest<{ lists: ClickUpList[] }>(
    `/space/${space.id}/list`,
    {
      query: { archived: false },
    }
  )
    .then((p) => p.lists ?? [])
    .catch((e: Error) => {
      console.log(`    ERROR: ${e.message}`);
      return [] as ClickUpList[];
    });
  console.log(`    returned ${shallowFolderless.length} folderless list(s)`);

  for (const shallow of shallowFolderless) {
    const listUrl = requestUrl(`/list/${shallow.id}`);
    console.log(`\n  ► GET ${listUrl}  (full list details)`);
    const list = await clickUpRequest<ClickUpList>(`/list/${shallow.id}`).catch((e: Error) => {
      console.log(`    ERROR fetching list details: ${e.message}`);
      return shallow;
    });

    console.log(`\n  Folderless list: "${list.name}"  (id=${list.id})`);
    const listStatuses = list.statuses ?? [];
    const effectiveStatuses = listStatuses.length ? listStatuses : spaceStatuses;
    const source = listStatuses.length ? 'list' : 'space';

    console.log(`    Effective statuses (from ${source}, ${effectiveStatuses.length}):`);
    for (const s of effectiveStatuses) {
      const opId = mapStatusToOpId(s, opStatuses);
      const opName = opStatuses.find((o) => String(o.id) === opId)?.name ?? '?';
      console.log(`${statusLine(s)}  →  OP id=${opId} "${opName}"`);
    }

    if (INSPECT_TASKS || INSPECT_LIST_ID === list.id) {
      await inspectClickUpTasks(list);
    }
  }
}

// ─── Status mapping (mirrors mapStatusToOpenProjectId from seed script) ─────

function mapStatusToOpId(status: ClickUpStatus, opStatuses: OpenProjectStatus[]): string {
  const name = status.status.toLowerCase();
  const find = (n: string) => opStatuses.find((item) => item.name.toLowerCase() === n)?.id;

  const exact = opStatuses.find((item) => item.name.toLowerCase() === name);
  if (exact) return String(exact.id);

  if (name.includes('hold') || name.includes('block') || name.includes('wait'))
    return String(find('on hold') ?? find('backlog') ?? opStatuses[0]?.id);

  if (status.type === 'open') return String(find('backlog') ?? opStatuses[0]?.id);
  if (status.type === 'done') return String(find('shipped') ?? opStatuses[0]?.id);
  if (status.type === 'closed') return String(find('closed') ?? opStatuses[0]?.id);

  if (
    name.includes('review') ||
    name.includes('test') ||
    name.includes(' qa') ||
    name === 'qa' ||
    name.includes('verif')
  )
    return String(find('in testing') ?? find('in progress') ?? opStatuses[0]?.id);
  if (name.includes('develop') || name.includes('progress') || name.includes(' dev'))
    return String(find('in progress') ?? opStatuses[0]?.id);
  if (
    name.includes('scop') ||
    name.includes('design') ||
    name.includes('plan') ||
    name.includes('spec') ||
    name.includes('research') ||
    name.includes('ready')
  )
    return String(find('scoping') ?? find('backlog') ?? opStatuses[0]?.id);
  if (name.includes('ship') || name.includes('releas') || name.includes('deploy'))
    return String(find('shipped') ?? opStatuses[0]?.id);

  return String(find('in progress') ?? find('backlog') ?? opStatuses[0]?.id);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('ClickUp + OpenProject Inspector');
  console.log('================================');
  console.log(`BASE_URL:         ${BASE_URL}`);
  console.log(`OPENPROJECT_URL:  ${process.env.OPENPROJECT_BASE_URL ?? '(not set)'}`);
  console.log(`INSPECT_TASKS:    ${INSPECT_TASKS}`);
  console.log(`INSPECT_OP:       ${INSPECT_OP}`);
  if (INSPECT_LIST_ID) console.log(`INSPECT_LIST_ID:  ${INSPECT_LIST_ID}`);
  if (INSPECT_SPACE_ID) console.log(`INSPECT_SPACE_ID: ${INSPECT_SPACE_ID}`);
  if (process.env.INSPECT_OP_PROJECT_ID)
    console.log(`INSPECT_OP_PROJECT_ID: ${process.env.INSPECT_OP_PROJECT_ID}`);

  const opStatuses = await inspectOpenProjectStatuses();

  // Teams
  section('ClickUp teams  (GET https://api.clickup.com/api/v2/team)');
  console.log(`  ► GET ${requestUrl('/team')}`);
  const { teams } = await clickUpRequest<{ teams: Array<{ id: string; name: string }> }>('/team');
  console.log(`  returned ${teams.length} team(s)`);
  for (const t of teams) console.log(`    id=${t.id}  name="${t.name}"`);

  const team = teams[0];
  if (!team) {
    console.log('\n  No teams found — check CLICKUP_TOKEN');
    return;
  }

  // Spaces
  section(`ClickUp spaces  (GET /team/${team.id}/space)`);
  const spacesUrl = requestUrl(`/team/${team.id}/space`, { archived: false });
  console.log(`  ► GET ${spacesUrl}`);
  const { spaces } = await clickUpRequest<{ spaces: ClickUpSpace[] }>(`/team/${team.id}/space`, {
    query: { archived: false },
  });
  console.log(`  returned ${spaces.length} space(s):`);
  for (const s of spaces) console.log(`    id=${s.id}  name="${s.name}"`);

  const filteredSpaces = INSPECT_SPACE_ID
    ? spaces.filter((s) => s.id === INSPECT_SPACE_ID)
    : spaces;

  if (INSPECT_SPACE_ID && !filteredSpaces.length) {
    console.log(`\n  WARN: INSPECT_SPACE_ID=${INSPECT_SPACE_ID} not found in spaces above`);
  }

  for (const space of filteredSpaces) {
    await inspectClickUpSpace(space, opStatuses);
  }

  if (INSPECT_OP) {
    await inspectOpenProject(process.env.INSPECT_OP_PROJECT_ID);
  }

  section('Done');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
