import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { verifyGitHubSignature } from '../server/services/github.js';

test('verifyGitHubSignature accepts a valid sha256 signature', () => {
  const secret = 'test-secret';
  const body = Buffer.from(JSON.stringify({ action: 'opened' }));
  const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  assert.equal(verifyGitHubSignature(body, signature, secret), true);
});

test('verifyGitHubSignature rejects invalid signatures', () => {
  const body = Buffer.from('{}');
  const signature = `sha256=${'0'.repeat(64)}`;
  assert.equal(verifyGitHubSignature(body, signature, 'test-secret'), false);
});
