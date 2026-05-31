import 'dotenv/config';
import { openProjectRequest } from '../server/openproject/client.js';
import { saveTagsCustomFieldId } from '../server/openproject/tagsCustomField.js';
import type {
  HalCollection,
  OpenProjectProject,
  OpenProjectStatus,
} from '../server/openproject/types.js';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Statuses created in OpenProject during setup.
// Names must match exactly (case-insensitive) what mapStatusToOpenProjectId looks up.
// Colors use Mantine palette tone 5.
const REQUIRED_STATUSES: Array<{
  name: string;
  color: string;
  isClosed: boolean;
  isDefault?: boolean;
}> = [
  { name: 'Backlog', color: '#adb5bd', isClosed: false, isDefault: true }, // gray-5
  { name: 'Scoping', color: '#339af0', isClosed: false }, // blue-5
  { name: 'In Progress', color: '#cc5de8', isClosed: false }, // grape-5
  { name: 'In Testing', color: '#22b8cf', isClosed: false }, // cyan-5
  { name: 'Shipped', color: '#51cf66', isClosed: true }, // green-5
  { name: 'Closed', color: '#adb5bd', isClosed: true }, // gray-5
  { name: 'On Hold', color: '#fcc419', isClosed: false }, // yellow-5
];

// Default projects that ship with a fresh OpenProject install.
// These are identified by well-known identifiers and names.
const DEMO_PROJECT_IDENTIFIERS = new Set(['demo-project', 'scrum-project', 'demo-scrum-project']);
const DEMO_PROJECT_NAMES = [/^demo\s+project$/i, /^scrum\s+project$/i, /^demo[-\s]scrum/i];

type OpenProjectUser = { id: number; name: string; login: string; email?: string };

function step(msg: string) {
  console.log(`\n→ ${msg}`);
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function warn(msg: string) {
  console.warn(`  ⚠ ${msg}`);
}

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

// Rails script to generate a token — Token::API is the correct class in OpenProject 17
const RAILS_TOKEN_SCRIPT =
  'user = User.where(admin: true, type: "User").first; ' +
  'raise "No admin user found" unless user; ' +
  'token = Token::API.create!(user: user); ' +
  'puts "TOKEN:" + token.plain_value';

function generateTokenViaDocker(containerName = 'openproject-web-1'): string | null {
  step(`Generating API token via docker exec ${containerName}`);
  try {
    const out = execSync(
      `docker exec ${containerName} bundle exec rails runner '${RAILS_TOKEN_SCRIPT}'`,
      { timeout: 60_000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const match = out.match(/TOKEN:(opapi-\S+)/);
    if (!match?.[1]) {
      warn(`Unexpected rails runner output: ${out.slice(0, 200)}`);
      return null;
    }
    return match[1];
  } catch (error: any) {
    const msg = (error?.stderr || error?.message || String(error)).slice(0, 300);
    warn(`docker exec failed: ${msg}`);
    return null;
  }
}

function writeTokenToEnv(token: string): void {
  const envPath = new URL('../.env', import.meta.url).pathname;
  if (!existsSync(envPath)) {
    writeFileSync(envPath, `OPENPROJECT_API_TOKEN="${token}"\n`);
    ok(`Created .env with OPENPROJECT_API_TOKEN`);
    return;
  }
  const contents = readFileSync(envPath, 'utf8');
  const updated = contents.match(/^OPENPROJECT_API_TOKEN=/m)
    ? contents.replace(/^OPENPROJECT_API_TOKEN=.*/m, `OPENPROJECT_API_TOKEN="${token}"`)
    : `${contents.trimEnd()}\nOPENPROJECT_API_TOKEN="${token}"\n`;
  writeFileSync(envPath, updated);
  ok(`Updated OPENPROJECT_API_TOKEN in .env`);
}

async function verifyToken(): Promise<OpenProjectUser> {
  step('Verifying OpenProject API token');

  const baseUrl = process.env.OPENPROJECT_BASE_URL || 'http://localhost:8080';
  let token = process.env.OPENPROJECT_API_TOKEN;

  // Try to test the current token first
  if (token) {
    try {
      const user = await openProjectRequest<OpenProjectUser>('/api/v3/users/me');
      ok(`Authenticated as "${user.name}" (id:${user.id}, login:${user.login})`);
      return user;
    } catch (error: any) {
      if (error?.statusCode !== 401) {
        fail(`Could not reach OpenProject at ${baseUrl}: ${error?.message || error}`);
      }
      warn(`Existing token rejected (401) — will generate a new one`);
    }
  } else {
    warn('OPENPROJECT_API_TOKEN not set — will generate one via Docker');
  }

  // Token missing or invalid — try to auto-generate via docker exec
  const generated = generateTokenViaDocker();
  if (generated) {
    token = generated;
    process.env.OPENPROJECT_API_TOKEN = token;
    writeTokenToEnv(token);
    ok(`Token generated: ${token.slice(0, 14)}...`);
  } else {
    fail(
      `Could not auto-generate token.\n\n` +
        `Generate it manually:\n` +
        `  1. Open ${baseUrl} → click your avatar → My account\n` +
        `  2. Access tokens → API → + API token\n` +
        `  3. Set OPENPROJECT_API_TOKEN=opapi-... in .env\n\n` +
        `Or via Docker:\n` +
        `  docker exec openproject-web-1 bundle exec rails runner \\\n` +
        `    'u=User.where(admin:true,type:"User").first; t=Token::API.create!(user:u); puts t.plain_value'`
    );
  }

  // Verify the new token
  let user: OpenProjectUser;
  try {
    user = await openProjectRequest<OpenProjectUser>('/api/v3/users/me');
  } catch (error: any) {
    fail(`Generated token still rejected: ${error?.message || error}`);
  }

  ok(`Authenticated as "${user.name}" (id:${user.id}, login:${user.login})`);

  if (user.id !== 1) {
    const isAdmin = await openProjectRequest<{ admin?: boolean }>(`/api/v3/users/${user.id}`)
      .then((u: any) => Boolean(u.admin))
      .catch(() => false);
    if (!isAdmin) {
      warn(
        `User "${user.name}" may not be an admin — status creation requires admin privileges.\n` +
          `  If status setup fails, re-run with an admin API token.`
      );
    }
  }

  return user;
}

const PLACEHOLDER_IDENTIFIER = 'setup-status-placeholder';

async function ensureActiveProjectForStatusAccess(): Promise<void> {
  // GET /api/v3/statuses requires view_work_packages in at least one active project.
  // If all projects are archived or there are none, the endpoint returns 403.
  const page = await openProjectRequest<HalCollection<OpenProjectProject>>('/api/v3/projects', {
    query: { pageSize: 500 },
  });
  const all = page._embedded?.elements || [];
  const active = all.filter((p) => p.active !== false);
  if (active.length > 0) return;

  // No active projects — try to activate archived root projects
  const roots = all.filter((p) => {
    const parent = (p._links as any)?.parent;
    return p.active === false && !parent?.href;
  });

  for (const root of roots) {
    await openProjectRequest<OpenProjectProject>(`/api/v3/projects/${root.id}`, {
      method: 'PATCH',
      body: { active: true },
    }).catch(() => {});
    ok(`Activated archived project "${root.name}" to unlock /api/v3/statuses`);
    return;
  }

  // No projects at all — create a temporary placeholder so the status endpoint is accessible.
  // The placeholder is cleaned up at the end of setup.
  ok(`No projects exist — creating a temporary placeholder for status access`);
  try {
    await openProjectRequest<OpenProjectProject>('/api/v3/projects', {
      method: 'POST',
      body: {
        name: '__Status Setup Placeholder',
        identifier: PLACEHOLDER_IDENTIFIER,
      },
    });
    ok(`Placeholder project created (identifier: ${PLACEHOLDER_IDENTIFIER})`);
  } catch (e: any) {
    // Already exists from a previous interrupted run — that's fine, it's still active
    if (
      String(e?.message || '')
        .toLowerCase()
        .includes('taken')
    ) {
      ok(`Placeholder project already exists — reusing`);
    } else {
      warn(`Could not create placeholder: ${e?.message}. Status setup may fail with 403.`);
    }
  }
}

async function deletePlaceholderProject(containerName = 'openproject-web-1'): Promise<void> {
  // Check if placeholder exists first
  const page = await openProjectRequest<HalCollection<OpenProjectProject>>('/api/v3/projects', {
    query: { pageSize: 500 },
  }).catch(() => null);
  const all = page?._embedded?.elements || [];
  const placeholder = all.find(
    (p) =>
      (p as any).identifier === PLACEHOLDER_IDENTIFIER || p.name === '__Status Setup Placeholder'
  );
  if (!placeholder) return;

  // Delete via Rails — API project deletion is async and may just archive it
  try {
    const script = `p=Project.find_by(identifier:${JSON.stringify(PLACEHOLDER_IDENTIFIER)}); p&.destroy; puts "PLACEHOLDER_DELETED"`;
    execSync(`docker exec ${containerName} bundle exec rails runner '${script}'`, {
      timeout: 30_000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    ok(`Placeholder project deleted`);
  } catch (e: any) {
    warn(`Could not delete placeholder: ${(e?.message || '').slice(0, 200)}`);
  }
}

function createStatusesViaDocker(
  missing: Array<{ name: string; color: string; isClosed: boolean; isDefault?: boolean }>,
  containerName = 'openproject-web-1'
): void {
  // Build a single Rails script that upserts all missing statuses
  const entries = missing
    .map(
      (s) =>
        `{name:${JSON.stringify(s.name)},hexcode:${JSON.stringify(s.color)},` +
        `is_closed:${s.isClosed},is_default:${s.isDefault ?? false}}`
    )
    .join(',');

  // Color is a separate model with a hexcode field — find closest match or create new
  const script =
    `[${entries}].each do |attrs|` +
    ' color=Color.find_by(hexcode:attrs[:hexcode])||Color.create!(name:attrs[:hexcode],hexcode:attrs[:hexcode]);' +
    ' s=Status.find_or_initialize_by(name:attrs[:name]);' +
    ' s.color=color;s.is_closed=attrs[:is_closed];s.is_default=attrs[:is_default];' +
    ' s.save!;' +
    ' puts "STATUS:"+s.id.to_s+":"+s.name' +
    ' end';

  try {
    const out = execSync(`docker exec ${containerName} bundle exec rails runner '${script}'`, {
      timeout: 60_000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    for (const line of out.split('\n')) {
      const m = line.match(/^STATUS:(\d+):(.+)$/);
      if (m) ok(`Created/updated status "${m[2]}" (id:${m[1]})`);
    }
  } catch (error: any) {
    const msg = (error?.stderr || error?.stdout || error?.message || String(error)).slice(0, 400);
    warn(`Could not create statuses via Rails: ${msg}`);
  }
}

function reorderStatusesViaDocker(containerName = 'openproject-web-1'): void {
  const entries = REQUIRED_STATUSES.map((s, i) => `[${JSON.stringify(s.name)},${i + 1}]`).join(',');
  const script =
    `[${entries}].each do |name,pos|` +
    ' s=Status.find_by(name:name);next unless s;' +
    ' s.update_column(:position,pos);' +
    ' puts "POSITIONED:"+name+":"+pos.to_s' +
    ' end';
  try {
    const out = execSync(`docker exec ${containerName} bundle exec rails runner '${script}'`, {
      timeout: 30_000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    for (const line of out.split('\n')) {
      const m = line.match(/^POSITIONED:(.+):(\d+)$/);
      if (m) ok(`Status "${m[1]}" → position ${m[2]}`);
    }
  } catch (error: any) {
    warn(
      `Could not set status positions: ${(error?.stderr || error?.message || '').slice(0, 200)}`
    );
  }
}

async function setupStatuses(): Promise<void> {
  step('Configuring required statuses');

  await ensureActiveProjectForStatusAccess();

  const page = await openProjectRequest<HalCollection<OpenProjectStatus>>('/api/v3/statuses', {
    query: { pageSize: 500 },
  });
  const existing = page._embedded?.elements || [];
  const byName = new Map(existing.map((s) => [s.name.toLowerCase(), s]));

  // Create any missing required statuses
  const missing = REQUIRED_STATUSES.filter((s) => {
    const found = byName.get(s.name.toLowerCase());
    if (found) {
      ok(`Status "${s.name}" already exists (id:${found.id})`);
      return false;
    }
    return true;
  });

  if (missing.length > 0) {
    createStatusesViaDocker(missing);
  }

  // Remove any extra statuses that are not in the required list
  await cleanupExtraStatuses(existing);

  // Enforce the canonical position order
  step('Enforcing status position order');
  reorderStatusesViaDocker();
}

function cleanupExtraStatusesViaDocker(
  extra: OpenProjectStatus[],
  fallbackName: string,
  containerName = 'openproject-web-1'
): void {
  // For each extra status: reassign its work packages to fallbackName, then destroy it
  const entries = extra.map((s) => `[${s.id},${JSON.stringify(s.name)}]`).join(',');

  const script =
    `fallback=Status.find_by!(name:${JSON.stringify(fallbackName)});` +
    `[${entries}].each do |id,name|` +
    ' s=Status.find_by(id:id);next unless s;' +
    ' moved=WorkPackage.where(status:s).update_all(status_id:fallback.id);' +
    ' s.destroy;' +
    ' puts "REMOVED:"+name+":moved_wp="+moved.to_s' +
    ' end';

  try {
    const out = execSync(`docker exec ${containerName} bundle exec rails runner '${script}'`, {
      timeout: 60_000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    for (const line of out.split('\n')) {
      const m = line.match(/^REMOVED:(.+):moved_wp=(\d+)$/);
      if (m) ok(`Removed extra status "${m[1]}" (reassigned ${m[2]} work package(s))`);
    }
  } catch (error: any) {
    const msg = (error?.stderr || error?.stdout || error?.message || String(error)).slice(0, 400);
    warn(`Could not remove extra statuses via Rails: ${msg}`);
  }
}

// Also fixes wrong-case names (e.g. "In progress" → "In Progress") via Rails
function fixStatusNamesViaDocker(
  toFix: Array<{ id: number; correctName: string }>,
  containerName = 'openproject-web-1'
): void {
  const entries = toFix.map((s) => `[${s.id},${JSON.stringify(s.correctName)}]`).join(',');
  const script =
    `[${entries}].each do |id,name|` +
    ' s=Status.find_by(id:id);next unless s;' +
    ' s.name=name;s.save!;' +
    ' puts "RENAMED:"+id.to_s+":"+name' +
    ' end';
  try {
    const out = execSync(`docker exec ${containerName} bundle exec rails runner '${script}'`, {
      timeout: 30_000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    for (const line of out.split('\n')) {
      const m = line.match(/^RENAMED:(\d+):(.+)$/);
      if (m) ok(`Renamed status id:${m[1]} → "${m[2]}"`);
    }
  } catch (error: any) {
    warn(`Could not rename statuses: ${(error?.stderr || error?.message || '').slice(0, 200)}`);
  }
}

async function cleanupExtraStatuses(existing: OpenProjectStatus[]): Promise<void> {
  step('Removing extra statuses');

  const requiredNames = new Set(REQUIRED_STATUSES.map((s) => s.name.toLowerCase()));

  // Detect wrong-case names (match by lowercase but differ in actual case)
  const toFix = existing
    .filter((s) => {
      const req = REQUIRED_STATUSES.find((r) => r.name.toLowerCase() === s.name.toLowerCase());
      return req && req.name !== s.name;
    })
    .map((s) => ({
      id: s.id,
      correctName: REQUIRED_STATUSES.find((r) => r.name.toLowerCase() === s.name.toLowerCase())!
        .name,
    }));

  if (toFix.length > 0) {
    fixStatusNamesViaDocker(toFix);
  }

  // Find truly extra statuses (no match in required list, case-insensitive)
  const extra = existing.filter((s) => !requiredNames.has(s.name.toLowerCase()));

  if (extra.length === 0) {
    ok('No extra statuses found');
    return;
  }

  warn(`Found ${extra.length} extra status(es): ${extra.map((s) => `"${s.name}"`).join(', ')}`);

  // Fallback status for reassigning work packages: use "Backlog" (default)
  const fallback =
    REQUIRED_STATUSES.find((s) => s.isDefault)?.name || REQUIRED_STATUSES[0]?.name || 'Backlog';

  cleanupExtraStatusesViaDocker(extra, fallback);
}

async function cleanupDemoProjects(): Promise<void> {
  step('Checking for demo/scrum projects to remove');

  const page = await openProjectRequest<HalCollection<OpenProjectProject>>('/api/v3/projects', {
    query: { pageSize: 500 },
  });
  const all = page._embedded?.elements || [];

  const demoProjects = all.filter((p) => {
    const id = (p as any).identifier as string | undefined;
    if (id && DEMO_PROJECT_IDENTIFIERS.has(id)) return true;
    return DEMO_PROJECT_NAMES.some((re) => re.test(p.name));
  });

  if (demoProjects.length === 0) {
    ok('No demo/scrum projects found');
    return;
  }

  // Safety: don't delete if they're the ONLY active projects
  // (statuses endpoint needs at least one active project)
  const realProjects = all.filter((p) => !demoProjects.includes(p));
  const activeRealProjects = realProjects.filter((p) => p.active !== false);

  if (activeRealProjects.length === 0) {
    warn(
      `Found ${demoProjects.length} demo project(s) but no other active projects.\n` +
        `  Skipping cleanup to keep statuses endpoint accessible.\n` +
        `  Run the seed script first, then run setup again to clean up demo projects.`
    );
    return;
  }

  // Sort: deepest children first so parents can be deleted afterwards
  const sorted = [...demoProjects].sort((a, b) => {
    const aHasParent = Boolean((a._links as any)?.parent?.href);
    const bHasParent = Boolean((b._links as any)?.parent?.href);
    if (aHasParent && !bHasParent) return -1;
    if (!aHasParent && bHasParent) return 1;
    return 0;
  });

  for (const project of sorted) {
    try {
      await openProjectRequest<void>(`/api/v3/projects/${project.id}`, { method: 'DELETE' });
      ok(`Deleted demo project "${project.name}" (id:${project.id})`);
    } catch (error: any) {
      warn(`Could not delete "${project.name}": ${error?.message || error}`);
    }
  }
}

// ── Tags Custom Field ────────────────────────────────────────────────────────

const TAGS_CF_NAME = 'Tags';

/**
 * Ensures the "Tags" WorkPackageCustomField exists in OpenProject.
 * - field_format: list (multi-value)
 * - is_for_all: true (available on every work package type / project)
 * Saves the CF ID to our DB via saveTagsCustomFieldId().
 */
function ensureTagsCustomFieldViaDocker(containerName = 'openproject-web-1'): number | null {
  // field_format is readonly after creation in Rails 8 — only set it on new records.
  const script = `
cf = WorkPackageCustomField.find_by(name: ${JSON.stringify(TAGS_CF_NAME)})
if cf.nil?
  cf = WorkPackageCustomField.new(field_format: "list")
end
cf.name = ${JSON.stringify(TAGS_CF_NAME)}
cf.is_required = false
cf.is_for_all = true
cf.multi_value = true
cf.save!
puts "TAGS_CF_ID:" + cf.id.to_s
`;

  try {
    const out = execSync(`docker exec -i ${containerName} bundle exec rails runner -`, {
      input: script,
      timeout: 60_000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const match = out.match(/TAGS_CF_ID:(\d+)/);
    if (!match) {
      warn(`Tags CF created but could not parse ID from output: ${out.slice(0, 200)}`);
      return null;
    }
    return Number(match[1]);
  } catch (error: any) {
    const msg = (error?.stderr || error?.stdout || error?.message || String(error)).slice(0, 400);
    warn(`Could not ensure Tags custom field: ${msg}`);
    return null;
  }
}

/**
 * Enables the Tags CF on all existing work package types.
 * OpenProject links CFs to types; is_for_all=true handles projects,
 * but types still need the CF explicitly associated.
 */
function enableTagsCfOnAllTypesViaDocker(cfId: number, containerName = 'openproject-web-1'): void {
  const script = `
cf = WorkPackageCustomField.find(${cfId})
Type.all.each do |t|
  unless t.custom_fields.include?(cf)
    t.custom_fields << cf
    puts "TYPE_ENABLED:" + t.name
  end
end
`;
  try {
    const out = execSync(`docker exec -i ${containerName} bundle exec rails runner -`, {
      input: script,
      timeout: 60_000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    for (const line of out.split('\n')) {
      const m = line.match(/^TYPE_ENABLED:(.+)$/);
      if (m) ok(`Tags CF enabled on type "${m[1]}"`);
    }
  } catch (error: any) {
    warn(
      `Could not enable Tags CF on types: ${(error?.stderr || error?.message || '').slice(0, 200)}`
    );
  }
}

async function setupTagsCustomField(): Promise<void> {
  step(`Setting up "${TAGS_CF_NAME}" custom field`);
  const cfId = ensureTagsCustomFieldViaDocker();
  if (!cfId) return;
  ok(`Tags custom field ID: ${cfId}`);
  enableTagsCfOnAllTypesViaDocker(cfId);
  await saveTagsCustomFieldId(cfId);
  ok(`Tags CF ID saved to DB`);
}

// ── Priorities ───────────────────────────────────────────────────────────────

function ensureNoPriorityViaDocker(containerName = 'openproject-web-1'): void {
  // "No" priority sits below Low — used for ClickUp tasks with no priority set.
  // IssuePriority position: lower number = higher priority (Immediate=1, High=2, ..., Low=4).
  const script = `
low = IssuePriority.find_by(name: 'Low')
existing = IssuePriority.find_by(name: 'No')
if existing
  target_pos = low ? low.position + 1 : existing.position
  if existing.position != target_pos
    existing.update_column(:position, target_pos)
    puts "PRIORITY_REPOSITIONED:" + existing.id.to_s + ":pos=" + target_pos.to_s
  else
    puts "PRIORITY_EXISTS:" + existing.id.to_s
  end
else
  pos = low ? low.position + 1 : (IssuePriority.maximum(:position).to_i + 1)
  p = IssuePriority.create!(name: 'No', position: pos)
  puts "PRIORITY_CREATED:" + p.id.to_s + ":pos=" + pos.to_s
end
`;
  try {
    const out = execSync(`docker exec -i ${containerName} bundle exec rails runner -`, {
      input: script,
      timeout: 30_000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    for (const line of out.split('\n')) {
      if (line.startsWith('PRIORITY_CREATED:'))
        ok(`Created "No" priority (${line.slice('PRIORITY_CREATED:'.length)})`);
      if (line.startsWith('PRIORITY_EXISTS:'))
        ok(`"No" priority already exists (id:${line.split(':')[1]})`);
      if (line.startsWith('PRIORITY_REPOSITIONED:'))
        ok(`Repositioned "No" priority (${line.slice('PRIORITY_REPOSITIONED:'.length)})`);
    }
  } catch (error: any) {
    warn(
      `Could not ensure "No" priority: ${(error?.stderr || error?.message || String(error)).slice(0, 300)}`
    );
  }
}

async function setupPriorities(): Promise<void> {
  step('Configuring "No" priority (below Low)');
  ensureNoPriorityViaDocker();
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('OpenProject Setup');
  console.log('=================');
  console.log(`Base URL: ${process.env.OPENPROJECT_BASE_URL || 'http://localhost:8080'}`);

  await verifyToken();
  await setupStatuses(); // also calls cleanupExtraStatuses + reorderStatuses internally
  await setupPriorities();
  await setupTagsCustomField();
  await cleanupDemoProjects();
  await deletePlaceholderProject();

  console.log('\n✓ Setup complete\n');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
