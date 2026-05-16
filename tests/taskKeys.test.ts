import { extractTaskKey } from '../server/services/taskKeys.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('extractTaskKey finds supported task keys in titles, branches, PRs and commits', () => {
  assert.equal(extractTaskKey('CL-PROTO-001_Task name'), 'CL-PROTO-001');
  assert.equal(extractTaskKey('feature/CL-PROTO-001_combat-turn-system'), 'CL-PROTO-001');
  assert.equal(extractTaskKey('develop/CL-VRS-002-dialogue'), 'CL-VRS-002');
  assert.equal(extractTaskKey('bugfix/CL-RC-013_runner-camera-jitter'), 'CL-RC-013');
  assert.equal(extractTaskKey('CL-R-001 something'), 'CL-R-001');
});

test('extractTaskKey supports subtask suffixes', () => {
  assert.equal(extractTaskKey('CL-PROTO-001.01 child task'), 'CL-PROTO-001.01');
  assert.equal(extractTaskKey('commit: CL-VRS-001.02 fixed runtime'), 'CL-VRS-001.02');
});

test('extractTaskKey returns null for unsupported keys', () => {
  assert.equal(extractTaskKey('ABC-001 not this tracker'), null);
  assert.equal(extractTaskKey('CL-XYZ-001 unsupported area'), null);
});
