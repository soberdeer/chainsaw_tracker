import { createApp } from '../server/index.js';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';

async function withServer(run: (baseUrl: string) => Promise<void> | void) {
  const app = createApp();
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const created = app.listen(0, () => resolve(created));
  });

  const address = server.address() as AddressInfo | null;
  if (!address) {
    server.close();
    throw new Error('Could not resolve test server address');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('core API routers are mounted and return auth errors instead of 404', async () => {
  await withServer(async (baseUrl) => {
    const checks = [
      ['/api/auth/me', 401],
      ['/api/users/me', 401],
      ['/api/users/me/my-work', 401],
      ['/api/saved-views', 401],
      ['/api/notifications', 401],
      ['/api/import-reports', 401],
    ] as const;

    for (const [pathname, expectedStatus] of checks) {
      const response = await fetch(`${baseUrl}${pathname}`);
      assert.equal(response.status, expectedStatus, `${pathname} should be mounted`);
    }
  });
});
