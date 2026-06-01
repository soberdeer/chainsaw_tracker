/**
 * Import ClickUp docs (from DOC folders) into OpenProject as Documentation work packages.
 * This is a targeted script — does NOT wipe existing data.
 *
 * Usage: npx tsx scripts/import-clickup-docs.ts
 */
import 'dotenv/config';
import { openProjectRequest } from '../server/openproject/client.js';
import { loadSeededHierarchy } from '../server/openproject/hierarchyStore.js';

const CLICKUP_TOKEN = process.env.CLICKUP_TOKEN;
const CLICKUP_TEAM_ID = '90182613431'; // Chainsaw workspace

if (!CLICKUP_TOKEN) {
  console.error('CLICKUP_TOKEN not set');
  process.exit(1);
}

// ── ClickUp helpers ────────────────────────────────────────────────────────────

async function cuFetch<T>(path: string, query?: Record<string, string>): Promise<T> {
  const url = new URL(`https://api.clickup.com/api/v3${path}`);
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: CLICKUP_TOKEN!, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`ClickUp ${path}: ${res.status} ${await res.text()}`);
  return res.json() as T;
}

interface ClickUpDocPage {
  id: string;
  name?: string;
  content?: string; // markdown content from v3 API with content_format=text/md
  pages?: ClickUpDocPage[]; // nested sub-pages (v2 API)
}

interface ClickUpDoc {
  id: string;
  title?: string;
  name?: string;
  parent?: { type: number; id: string };
}

async function getDocsByFolder(folderId: string): Promise<ClickUpDoc[]> {
  try {
    // parent_type 5 = FOLDER in ClickUp v3 API
    const data = await cuFetch<{ docs?: ClickUpDoc[] }>(`/workspaces/${CLICKUP_TEAM_ID}/docs`, {
      parent_type: '5',
      parent_id: folderId,
    });
    return data.docs || [];
  } catch (e) {
    console.warn(`  ⚠ Could not fetch docs for folder ${folderId}: ${(e as Error).message}`);
    return [];
  }
}

async function getDocPages(docId: string): Promise<ClickUpDocPage[]> {
  try {
    // v3 API with content_format=text/md returns proper markdown in `content` field
    const url = `https://api.clickup.com/api/v3/workspaces/${CLICKUP_TEAM_ID}/docs/${docId}/pages?content_format=text%2Fmd`;
    const res = await fetch(url, {
      headers: { Authorization: CLICKUP_TOKEN!, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as ClickUpDocPage[] | { pages?: ClickUpDocPage[] };
    // v3 returns array directly
    return Array.isArray(data) ? data : data.pages || [];
  } catch {
    return [];
  }
}

/** Recursively flatten pages tree into flat list (depth-first) */
function flattenPages(pages: ClickUpDocPage[]): ClickUpDocPage[] {
  const result: ClickUpDocPage[] = [];
  for (const page of pages) {
    result.push(page);
    if (page.pages?.length) result.push(...flattenPages(page.pages));
  }
  return result;
}

function buildMarkdown(_title: string, pages: ClickUpDocPage[]): string {
  const flat = flattenPages(pages);
  const lines: string[] = [];
  for (const page of flat) {
    // Page name is the content heading (h1 for first/only page, h2 for subsequent)
    if (page.name) {
      const level = lines.length === 0 ? '#' : '##';
      lines.push(`${level} ${page.name}`, '');
    }
    const body = (page.content || '').trim();
    if (body) {
      lines.push(body, '');
    }
  }
  return lines.join('\n').trim();
}

// ── OpenProject helpers ────────────────────────────────────────────────────────

type OPProject = {
  id: number;
  name: string;
  identifier?: string;
  _links: Record<string, { href?: string } | Array<{ href?: string }>>;
};

function linkTail(href?: string | null) {
  return href?.split('/').filter(Boolean).at(-1);
}

function parentHref(project: OPProject): string | undefined {
  const p = project._links.parent;
  return Array.isArray(p) ? p[0]?.href : p?.href;
}

/** Given a ClickUp space ID, resolve the OP root project ID by following parent of a sibling list */
async function resolveOpRootProjectId(clickupSpaceId: string): Promise<string | null> {
  const seeded = await loadSeededHierarchy();
  if (!seeded) return null;
  const space = seeded.spaces.find(
    (s) => s.id === clickupSpaceId || s.clickupSpaceId === clickupSpaceId
  );
  if (!space) return null;
  for (const folder of space.folders) {
    for (const list of folder.taskLists) {
      if (!list.openProjectProjectId) continue;
      try {
        const proj = await openProjectRequest<OPProject>(
          `/api/v3/projects/${list.openProjectProjectId}`
        );
        const pHref = parentHref(proj);
        const parentId = linkTail(pHref);
        if (parentId) return parentId;
      } catch {
        /* skip */
      }
    }
  }
  return null;
}

/** Find existing "Docs" child project under opRootId, or create it */
async function ensureDocsProject(opRootId: string): Promise<string> {
  const all = await openProjectRequest<{ _embedded?: { elements?: OPProject[] } }>(
    '/api/v3/projects',
    { query: { pageSize: 500 } }
  );
  const projects = all._embedded?.elements || [];
  const existing = projects.find(
    (p) =>
      linkTail(
        Array.isArray(p._links.parent) ? p._links.parent[0]?.href : p._links.parent?.href
      ) === String(opRootId) && p.name.toLowerCase() === 'docs'
  );
  if (existing) return String(existing.id);

  // Create docs project
  const parent = await openProjectRequest<OPProject>(`/api/v3/projects/${opRootId}`);
  const baseId = (parent.identifier || `p${opRootId}`)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^[^a-z]+/, 'p')
    .slice(0, 93);

  const created = await openProjectRequest<{ id: number }>('/api/v3/projects', {
    method: 'POST',
    body: {
      name: 'Docs',
      identifier: `${baseId}-docs`,
      _links: { parent: { href: `/api/v3/projects/${opRootId}` } },
    },
  });
  console.log(`  ✅ Created Docs project ID=${created.id} under root=${opRootId}`);
  return String(created.id);
}

/** Get Documentation type ID in OP */
async function getDocTypeId(): Promise<string | null> {
  try {
    const page = await openProjectRequest<{
      _embedded?: { elements?: { id: number; name: string }[] };
    }>('/api/v3/types', { query: { pageSize: 200 } });
    const found = (page._embedded?.elements || []).find(
      (t) => t.name.toLowerCase() === 'documentation'
    );
    return found ? String(found.id) : null;
  } catch {
    return null;
  }
}

/** Find existing WP by title in the docs project (returns id + lockVersion, or null) */
async function findExistingDoc(
  docsProjectId: string,
  title: string
): Promise<{ id: number; lockVersion: number } | null> {
  try {
    const page = await openProjectRequest<{
      _embedded?: { elements?: { id: number; subject: string; lockVersion: number }[] };
    }>(`/api/v3/projects/${docsProjectId}/work_packages`, { query: { pageSize: 200 } });
    return (page._embedded?.elements || []).find((wp) => wp.subject === title) ?? null;
  } catch {
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

interface SpaceMapping {
  spaceName: string;
  clickupSpaceId: string;
  clickupDocFolderId: string;
}

async function main() {
  console.log('📚 Importing ClickUp docs into OpenProject...\n');

  // Build mapping from seeded hierarchy
  const seeded = await loadSeededHierarchy();
  if (!seeded) {
    console.error('No seeded hierarchy found — run reset:full first');
    process.exit(1);
  }

  const spaceMappings: SpaceMapping[] = [];
  for (const space of seeded.spaces) {
    const docFolder = space.folders.find((f) => ['doc', 'docs'].includes(f.name.toLowerCase()));
    if (!docFolder) continue;
    const folderId = (docFolder as { clickupFolderId?: string }).clickupFolderId || docFolder.id;
    spaceMappings.push({
      spaceName: space.name,
      clickupSpaceId: space.clickupSpaceId,
      clickupDocFolderId: folderId,
    });
  }

  console.log(`Found ${spaceMappings.length} spaces with DOC folders:\n`);
  for (const m of spaceMappings) {
    console.log(`  • ${m.spaceName} (folder ${m.clickupDocFolderId})`);
  }
  console.log('');

  const docTypeId = await getDocTypeId();
  console.log(`Documentation type ID: ${docTypeId || '(none — using default)'}\n`);

  let totalImported = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const mapping of spaceMappings) {
    console.log(`── ${mapping.spaceName} ────────────────────────────`);

    // Get ClickUp docs for this folder
    const docs = await getDocsByFolder(mapping.clickupDocFolderId);
    console.log(`  ClickUp docs found: ${docs.length}`);
    if (docs.length === 0) {
      console.log('  (skip)\n');
      continue;
    }

    // Resolve OP root project
    const opRootId = await resolveOpRootProjectId(mapping.clickupSpaceId);
    if (!opRootId) {
      console.warn(`  ⚠ Could not resolve OP root project for space ${mapping.clickupSpaceId}`);
      errors.push(`${mapping.spaceName}: could not resolve OP root project`);
      console.log('');
      continue;
    }
    console.log(`  OP root project: ${opRootId}`);

    // Find or create Docs sub-project
    const docsProjectId = await ensureDocsProject(opRootId);
    console.log(`  OP docs project: ${docsProjectId}`);

    // Import each doc
    for (const doc of docs) {
      const title = doc.title || doc.name || 'Untitled';
      console.log(`  → "${title}"...`);

      const pages = await getDocPages(doc.id);
      const markdown = buildMarkdown(title, pages);
      console.log(`    pages: ${pages.length}, markdown: ${markdown.length} chars`);

      const existing = await findExistingDoc(docsProjectId, title);

      try {
        if (existing) {
          // Update existing WP content
          await openProjectRequest(`/api/v3/work_packages/${existing.id}`, {
            method: 'PATCH',
            body: {
              lockVersion: existing.lockVersion,
              description: { format: 'markdown', raw: markdown },
            },
          });
          console.log(`    ✅ updated (WP #${existing.id})`);
        } else {
          await openProjectRequest('/api/v3/work_packages', {
            method: 'POST',
            body: {
              subject: title,
              description: { format: 'markdown', raw: markdown },
              _links: {
                project: { href: `/api/v3/projects/${docsProjectId}` },
                ...(docTypeId ? { type: { href: `/api/v3/types/${docTypeId}` } } : {}),
              },
            },
          });
          console.log(`    ✅ created`);
        }
        totalImported++;
      } catch (error) {
        console.error(`    ❌ failed: ${(error as Error).message}`);
        errors.push(`${mapping.spaceName}/"${title}": ${(error as Error).message}`);
        totalSkipped++;
      }
    }
    console.log('');
  }

  console.log('══════════════════════════════════════════════');
  console.log(`✅ Imported: ${totalImported}`);
  console.log(`⏭ Skipped:  ${totalSkipped}`);
  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length}):`);
    errors.forEach((e) => console.log(`  • ${e}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
