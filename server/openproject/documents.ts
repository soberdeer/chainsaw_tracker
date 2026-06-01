import type { DocumentItem } from '../../src/lib/types.js';
import { openProjectRequest } from './client.js';
import type {
  HalCollection,
  OpenProjectProject,
  OpenProjectType,
  OpenProjectWorkPackage,
} from './types.js';

// undefined = not yet fetched, null = type does not exist in OP
let _docTypeId: string | null | undefined = undefined;

export async function getDocumentationTypeId(): Promise<string | null> {
  if (_docTypeId !== undefined) return _docTypeId;
  try {
    const page = await openProjectRequest<HalCollection<OpenProjectType>>('/api/v3/types', {
      query: { pageSize: 200 },
    });
    const found = (page._embedded?.elements || []).find(
      (t) => t.name.toLowerCase() === 'documentation'
    );
    _docTypeId = found ? String(found.id) : null;
  } catch {
    _docTypeId = null;
  }
  return _docTypeId;
}

function linkTail(href?: string | null): string | undefined {
  return href?.split('/').filter(Boolean).at(-1);
}

function cleanMarkdown(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(
      /<!--\s*chainsaw-clickup-import-meta\s*-->[\s\S]*?<!--\s*\/chainsaw-clickup-import-meta\s*-->/gi,
      ''
    )
    .replace(/<!--\s*chainsaw[^>]*-->/gi, '')
    .trim();
}

function mapWpToDoc(wp: OpenProjectWorkPackage, spaceId: string, folderId: string): DocumentItem {
  return {
    id: String(wp.id),
    spaceId,
    folderId,
    title: wp.subject,
    kind: 'MARKDOWN',
    markdown: cleanMarkdown(wp.description?.raw),
  };
}

function projectParentHref(project: OpenProjectProject): string | null | undefined {
  const parent = project._links.parent;
  if (!parent) return undefined;
  return Array.isArray(parent) ? parent[0]?.href : parent.href;
}

async function getParentProjectId(projectId: string): Promise<string> {
  try {
    const project = await openProjectRequest<OpenProjectProject>(`/api/v3/projects/${projectId}`);
    return linkTail(projectParentHref(project)) || projectId;
  } catch {
    return projectId;
  }
}

export async function getOrCreateDocsProject(spaceId: string): Promise<string> {
  const page = await openProjectRequest<HalCollection<OpenProjectProject>>('/api/v3/projects', {
    query: { pageSize: 500 },
  });
  const all = page._embedded?.elements || [];
  const existing = all.find((p) => {
    const parentHref = Array.isArray(p._links.parent)
      ? p._links.parent[0]?.href
      : p._links.parent?.href;
    return linkTail(parentHref) === String(spaceId) && p.name.toLowerCase() === 'docs';
  });
  if (existing) return String(existing.id);

  let parentIdentifier = `p${spaceId}`;
  try {
    const parent = await openProjectRequest<OpenProjectProject>(`/api/v3/projects/${spaceId}`);
    parentIdentifier = parent.identifier || parentIdentifier;
  } catch {
    /* ignore */
  }

  const baseId = parentIdentifier
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^[^a-z]+/, 'p')
    .slice(0, 93);

  const created = await openProjectRequest<OpenProjectProject>('/api/v3/projects', {
    method: 'POST',
    body: {
      name: 'Docs',
      identifier: `${baseId}-docs`,
      _links: { parent: { href: `/api/v3/projects/${spaceId}` } },
    },
  });
  return String(created.id);
}

export async function getDocuments(folderId: string): Promise<DocumentItem[]> {
  const spaceId = await getParentProjectId(folderId);
  const page = await openProjectRequest<HalCollection<OpenProjectWorkPackage>>(
    `/api/v3/projects/${folderId}/work_packages`,
    {
      query: {
        pageSize: 200,
        sortBy: JSON.stringify([['updatedAt', 'desc']]),
      },
    }
  );
  return (page._embedded?.elements || []).map((wp) => mapWpToDoc(wp, spaceId, folderId));
}

export async function getDocumentById(docId: string): Promise<DocumentItem> {
  const wp = await openProjectRequest<OpenProjectWorkPackage>(`/api/v3/work_packages/${docId}`);
  const folderId = linkTail(wp._links.project?.href) || '';
  const spaceId = await getParentProjectId(folderId);
  return mapWpToDoc(wp, spaceId, folderId);
}

export async function createDocument(
  folderId: string,
  spaceId: string,
  title: string,
  markdown: string
): Promise<DocumentItem> {
  const typeId = await getDocumentationTypeId();
  const body: Record<string, unknown> = {
    subject: title,
    description: { format: 'markdown', raw: markdown },
    _links: {
      project: { href: `/api/v3/projects/${folderId}` },
      ...(typeId ? { type: { href: `/api/v3/types/${typeId}` } } : {}),
    },
  };
  const wp = await openProjectRequest<OpenProjectWorkPackage>('/api/v3/work_packages', {
    method: 'POST',
    body,
  });
  return mapWpToDoc(wp, spaceId, folderId);
}

export async function updateDocumentById(
  docId: string,
  input: { title?: string; markdown?: string }
): Promise<DocumentItem> {
  const current = await openProjectRequest<OpenProjectWorkPackage>(
    `/api/v3/work_packages/${docId}`
  );
  const folderId = linkTail(current._links.project?.href) || '';
  const spaceId = await getParentProjectId(folderId);
  const body: Record<string, unknown> = {
    lockVersion: current.lockVersion,
    ...(input.title !== undefined ? { subject: input.title } : {}),
    ...(input.markdown !== undefined
      ? { description: { format: 'markdown', raw: input.markdown } }
      : {}),
  };
  const updated = await openProjectRequest<OpenProjectWorkPackage>(
    `/api/v3/work_packages/${docId}`,
    { method: 'PATCH', body }
  );
  return mapWpToDoc(updated, spaceId, folderId);
}

export async function deleteDocumentById(docId: string): Promise<void> {
  await openProjectRequest<void>(`/api/v3/work_packages/${docId}`, { method: 'DELETE' });
}
