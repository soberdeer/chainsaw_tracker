/**
 * reset-openproject-passwords.ts
 *
 * Resets OpenProject user passwords via `docker exec rails runner`.
 *
 * What it does:
 *   1. Resets the built-in admin (login: "admin") password to OPENPROJECT_ADMIN_PASSWORD
 *      (default: "admin") and clears force_password_change.
 *   2. Resets ALL non-system, non-admin users to OPENPROJECT_IMPORTED_USER_PASSWORD
 *      (default: "Clickup!2026") and clears force_password_change.
 *
 * Usage:
 *   npm run reset:passwords
 *
 * Env vars (all optional — fall back to defaults shown):
 *   OPENPROJECT_ADMIN_PASSWORD          default: "admin"
 *   OPENPROJECT_IMPORTED_USER_PASSWORD  default: "Clickup!2026"
 *   OPENPROJECT_CONTAINER               default: "openproject-web-1"
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';

const ADMIN_PASSWORD = process.env.OPENPROJECT_ADMIN_PASSWORD || 'admin';
const USER_PASSWORD = process.env.OPENPROJECT_IMPORTED_USER_PASSWORD || 'Clickup!2026';
const CONTAINER = process.env.OPENPROJECT_CONTAINER || 'openproject-web-1';

function step(msg: string) {
  console.log(`\n→ ${msg}`);
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function warn(msg: string) {
  console.warn(`  ⚠ ${msg}`);
}

/**
 * Run a Ruby script inside the OpenProject container via stdin.
 * Avoids shell quoting issues by piping the script rather than embedding it in args.
 */
function runRails(script: string, label: string): string {
  try {
    const out = execSync(`docker exec -i ${CONTAINER} bundle exec rails runner -`, {
      input: script,
      timeout: 60_000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return out;
  } catch (error: any) {
    const msg = (error?.stderr || error?.stdout || error?.message || String(error)).slice(0, 500);
    warn(`${label} failed: ${msg}`);
    return '';
  }
}

function resetAdminPassword(): void {
  step(`Resetting admin password → "${ADMIN_PASSWORD}"`);

  const adminPw = ADMIN_PASSWORD;
  const script = `
u = User.find_by(login: 'admin', type: 'User')
if u.nil?
  puts 'ADMIN_NOT_FOUND'
else
  u.password = ${JSON.stringify(adminPw)}
  u.password_confirmation = ${JSON.stringify(adminPw)}
  u.force_password_change = false
  u.activate if u.respond_to?(:activate) && !u.active?
  if u.save(validate: false)
    puts "ADMIN_OK:" + u.mail.to_s
  else
    puts "ADMIN_ERROR:" + u.errors.full_messages.join(", ")
  end
end
`;

  const out = runRails(script, 'Reset admin');
  if (out.includes('ADMIN_NOT_FOUND')) {
    warn('Admin user (login: "admin") not found in OpenProject');
  } else if (out.includes('ADMIN_OK:')) {
    const email = out.match(/ADMIN_OK:(.+)/)?.[1]?.trim() || '';
    ok(`Admin password reset (email: ${email || 'admin@example.net'})`);
  } else if (out.includes('ADMIN_ERROR:')) {
    warn(`Admin save error: ${out.match(/ADMIN_ERROR:(.+)/)?.[1]?.trim()}`);
  }
}

function resetImportedUsersPasswords(): void {
  step(`Resetting all non-admin user passwords → "${USER_PASSWORD}"`);

  const userPw = USER_PASSWORD;
  const script = `
changed = 0
errors = 0
User.where(type: 'User').find_each do |u|
  next if u.login == 'admin'
  u.password = ${JSON.stringify(userPw)}
  u.password_confirmation = ${JSON.stringify(userPw)}
  u.force_password_change = false
  if u.save(validate: false)
    changed += 1
    puts "USER_OK:" + u.login.to_s
  else
    errors += 1
    puts "USER_ERR:" + u.login.to_s + ":" + u.errors.full_messages.first.to_s
  end
end
puts "SUMMARY:changed=#{changed},errors=#{errors}"
`;

  const out = runRails(script, 'Reset imported users');
  for (const line of out.split('\n')) {
    const okMatch = line.match(/^USER_OK:(.+)$/);
    if (okMatch) {
      ok(okMatch[1].trim());
      continue;
    }
    const errMatch = line.match(/^USER_ERR:(.+):(.*)$/);
    if (errMatch) {
      warn(`${errMatch[1].trim()}: ${errMatch[2].trim()}`);
    }
  }
  const sumMatch = out.match(/SUMMARY:changed=(\d+),errors=(\d+)/);
  if (sumMatch) {
    console.log(`\n  → changed: ${sumMatch[1]}, errors: ${sumMatch[2]}`);
  }
}

async function main() {
  console.log('OpenProject Password Reset');
  console.log('==========================');
  console.log(`Container : ${CONTAINER}`);
  console.log(`Admin pw  : ${ADMIN_PASSWORD}`);
  console.log(`Users pw  : ${USER_PASSWORD}`);

  resetAdminPassword();
  resetImportedUsersPasswords();

  console.log('\n✓ Done\n');
  console.log('Credentials summary:');
  console.log(`  admin / admin@example.net  → ${ADMIN_PASSWORD}`);
  console.log(`  all other users            → ${USER_PASSWORD}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
