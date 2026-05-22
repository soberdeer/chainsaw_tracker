import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const rootDir = new URL('..', import.meta.url);
const schemaPath = new URL('../prisma/schema.prisma', import.meta.url);
const original = readFileSync(schemaPath, 'utf8');
const tempDir = mkdtempSync(join(tmpdir(), 'prisma-format-check-'));
const tempSchema = join(tempDir, 'schema.prisma');

try {
  writeFileSync(tempSchema, original, 'utf8');
  execFileSync('npx', ['prisma', 'format', '--schema', tempSchema], {
    cwd: rootDir,
    stdio: 'ignore',
  });
  const formatted = readFileSync(tempSchema, 'utf8');
  if (formatted !== original) {
    console.error('prisma/schema.prisma is not formatted. Run `npm run format`.');
    process.exitCode = 1;
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
