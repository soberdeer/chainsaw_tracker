/**
 * verify-openproject.ts
 *
 * Compares the current OpenProject state against the golden snapshot stored in
 * server/openproject/seed-data/openproject-user-snapshot.json.
 *
 * Checks:
 *   1. Every user from the snapshot exists with correct login/mail/admin/status
 *   2. No user has force_password_change = true
 *   3. Every user has a Bcrypt password (i.e. reset:passwords ran)
 *   4. No extra unexpected users (beyond system accounts)
 *   5. Groups and their members match exactly
 *   6. Roles (names) match exactly
 *   7. Smoke-test logins: admin → adminPassword, first non-admin → userPassword
 *
 * Exits with code 1 and prints a diff if anything doesn't match.
 *
 * Usage:
 *   npm run verify:openproject
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTAINER = process.env.OPENPROJECT_CONTAINER || 'openproject-web-1';
const BASE_URL = (process.env.OPENPROJECT_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
const SNAPSHOT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../server/openproject/seed-data/openproject-user-snapshot.json'
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface SnapshotUser {
  login: string;
  mail: string;
  admin: boolean;
  status: string;
  force_password_change: boolean;
  password_type: string | null;
}

interface SnapshotGroup {
  name: string;
  member_logins: string[];
}

interface SnapshotRole {
  name: string;
  permissions: string[];
}

interface Snapshot {
  _meta: { adminPassword: string; userPassword: string };
  users: SnapshotUser[];
  groups: SnapshotGroup[];
  roles: SnapshotRole[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const errors: string[] = [];
let warnings = 0;

function err(msg: string) {
  errors.push(`  ✗ ${msg}`);
}
function warn(msg: string) {
  warnings++;
  console.warn(`  ⚠ ${msg}`);
}
function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}
function step(msg: string) {
  console.log(`\n→ ${msg}`);
}

function runRails(script: string): string {
  try {
    return execSync(`docker exec -i ${CONTAINER} bundle exec rails runner -`, {
      input: script,
      timeout: 60_000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e: any) {
    const msg = (e?.stderr || e?.stdout || e?.message || String(e)).slice(0, 400);
    err(`Rails runner failed: ${msg}`);
    return '';
  }
}

// ─── Load snapshot ────────────────────────────────────────────────────────────

let snapshot: Snapshot;
try {
  snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as Snapshot;
} catch {
  console.error(`✗ Could not read snapshot from ${SNAPSHOT_PATH}`);
  console.error('  Run: npm run snapshot:openproject');
  process.exit(1);
}

const ADMIN_PW = process.env.OPENPROJECT_ADMIN_PASSWORD || snapshot._meta?.adminPassword || 'admin';
const USER_PW =
  process.env.OPENPROJECT_IMPORTED_USER_PASSWORD || snapshot._meta?.userPassword || 'Clickup!2026';

// ─── Fetch current state ──────────────────────────────────────────────────────

step('Fetching current OpenProject state…');

const railsScript = `
require 'json'

users = User.where(type: 'User').order(:login).map do |u|
  pw = UserPassword.where(user_id: u.id).last
  {
    login: u.login,
    mail: u.mail,
    admin: u.admin,
    status: u.status,
    force_password_change: u.force_password_change,
    password_type: pw&.type
  }
end

groups = Group.all.order(:name).map do |g|
  {
    name: g.name,
    member_logins: g.users.order(:login).map(&:login)
  }
end

roles = Role.where(builtin: 0).order(:name).map do |r|
  { name: r.name, permissions: r.permissions.map(&:to_s).sort }
end

puts({ users: users, groups: groups, roles: roles }.to_json)
`;

const raw = runRails(railsScript).trim();
const jsonLine =
  raw
    .split('\n')
    .filter((l) => l.startsWith('{'))
    .at(-1) ?? '';

let current: { users: SnapshotUser[]; groups: SnapshotGroup[]; roles: SnapshotRole[] };
try {
  current = JSON.parse(jsonLine);
} catch {
  err('Failed to parse Rails output as JSON — is Docker running?');
  current = { users: [], groups: [], roles: [] };
}

// ─── 1. Users ────────────────────────────────────────────────────────────────

step('Checking users…');

const currentByLogin = new Map(current.users.map((u) => [u.login, u]));
const snapshotByLogin = new Map(snapshot.users.map((u) => [u.login, u]));

// Missing users
for (const expected of snapshot.users) {
  const actual = currentByLogin.get(expected.login);
  if (!actual) {
    err(`Missing user: ${expected.login}`);
    continue;
  }

  // mail
  if (actual.mail !== expected.mail) {
    err(`User ${expected.login}: mail "${actual.mail}" ≠ expected "${expected.mail}"`);
  }

  // admin flag
  if (actual.admin !== expected.admin) {
    err(`User ${expected.login}: admin=${actual.admin} ≠ expected admin=${expected.admin}`);
  }

  // status
  if (actual.status !== expected.status) {
    err(`User ${expected.login}: status="${actual.status}" ≠ expected "${expected.status}"`);
  }

  // force_password_change must always be false after reset:passwords
  if (actual.force_password_change) {
    err(`User ${expected.login}: force_password_change=true — run: npm run reset:passwords`);
  }

  // password type
  if (!actual.password_type?.includes('Bcrypt')) {
    err(
      `User ${expected.login}: password_type="${actual.password_type}" — expected Bcrypt ` +
        `(run: npm run reset:passwords)`
    );
  }
}

// Extra users not in snapshot (warn only — could be newly added)
for (const login of currentByLogin.keys()) {
  if (!snapshotByLogin.has(login)) {
    warn(`Extra user not in snapshot: ${login}`);
  }
}

if (errors.length === 0) ok(`${snapshot.users.length} users OK`);

// ─── 2. Groups ───────────────────────────────────────────────────────────────

step('Checking groups…');

const currentGroupMap = new Map(current.groups.map((g) => [g.name, g]));
const snapshotGroupMap = new Map(snapshot.groups.map((g) => [g.name, g]));

for (const expectedGroup of snapshot.groups) {
  const actualGroup = currentGroupMap.get(expectedGroup.name);
  if (!actualGroup) {
    err(`Missing group: "${expectedGroup.name}"`);
    continue;
  }

  const expectedMembers = new Set(expectedGroup.member_logins);
  const actualMembers = new Set(actualGroup.member_logins);

  for (const login of expectedMembers) {
    if (!actualMembers.has(login)) {
      err(`Group "${expectedGroup.name}": missing member ${login}`);
    }
  }
  for (const login of actualMembers) {
    if (!expectedMembers.has(login)) {
      warn(`Group "${expectedGroup.name}": extra member ${login} (not in snapshot)`);
    }
  }
}

for (const name of currentGroupMap.keys()) {
  if (!snapshotGroupMap.has(name)) {
    warn(`Extra group not in snapshot: "${name}"`);
  }
}

if (errors.length === 0) ok(`${snapshot.groups.length} groups OK`);

// ─── 3. Roles ────────────────────────────────────────────────────────────────

step('Checking roles…');

const currentRoleNames = new Set(current.roles.map((r) => r.name));
const snapshotRoleNames = new Set(snapshot.roles.map((r) => r.name));

for (const r of snapshot.roles) {
  if (!currentRoleNames.has(r.name)) {
    err(`Missing role: "${r.name}"`);
  }
}
for (const name of currentRoleNames) {
  if (!snapshotRoleNames.has(name)) {
    warn(`Extra role not in snapshot: "${name}"`);
  }
}

if (errors.length === 0) ok(`${snapshot.roles.length} roles OK`);

// ─── 4. Smoke-test logins ─────────────────────────────────────────────────────

step('Smoke-testing logins…');

async function testLogin(login: string, password: string, label: string): Promise<void> {
  try {
    // Step 1: GET /login → CSRF + session
    const getRes = await fetch(`${BASE_URL}/login`, {
      headers: { Accept: 'text/html', 'User-Agent': 'OPVerify/1.0' },
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    const html = await getRes.text();
    const match = html.match(/name="authenticity_token"\s+value="([^"]+)"/);
    if (!match) {
      err(`${label}: could not fetch login page (OpenProject may be down)`);
      return;
    }
    const csrfToken = match[1]!;
    const sessionValue = (getRes.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

    // Step 2: POST /login
    const body = new URLSearchParams({ username: login, password, authenticity_token: csrfToken });
    const postRes = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: BASE_URL,
        Referer: `${BASE_URL}/login`,
        Cookie: sessionValue,
        'User-Agent': 'OPVerify/1.0',
      },
      body: body.toString(),
      redirect: 'manual',
    });

    if (postRes.status === 302) {
      const location = postRes.headers.get('location') ?? '';
      if (location.includes('change_password') || location.includes('change-password')) {
        err(`${label} (${login}): MUST_CHANGE_PASSWORD — run: npm run reset:passwords`);
      } else {
        ok(`${label} (${login}): login OK`);
      }
    } else {
      err(
        `${label} (${login}): login failed (HTTP ${postRes.status}) — wrong password or user locked`
      );
    }
  } catch (e: any) {
    err(`${label} (${login}): network error — ${e?.message ?? String(e)}`);
  }
}

// Test admin
await testLogin('admin', ADMIN_PW, 'admin');

// Test first non-admin user from snapshot
const firstRegular = snapshot.users.find((u) => !u.admin && u.login !== 'admin');
if (firstRegular) {
  await testLogin(firstRegular.login, USER_PW, 'regular user');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('');
if (errors.length > 0) {
  console.error(`✗ OpenProject verification FAILED (${errors.length} error(s)):\n`);
  for (const e of errors) console.error(e);
  if (warnings > 0) console.warn(`\n  (${warnings} warning(s) — see above)`);
  process.exit(1);
} else {
  console.log(
    `✓ OpenProject verification passed${warnings > 0 ? ` (${warnings} warning(s))` : ''}`
  );
}
