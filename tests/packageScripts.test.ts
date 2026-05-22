import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as {
  scripts: Record<string, string>;
};

test('test script checks formatting instead of mutating files', () => {
  assert.equal(
    packageJson.scripts.test,
    'npm run format:check && npm run lint && npm run typecheck && npm run test:code'
  );
});

test('lint script keeps fix mode out of the default CI path', () => {
  assert.equal(packageJson.scripts.oxlint, 'oxlint .');
  assert.equal(packageJson.scripts['lint:fix'], 'oxlint . --fix');
});
