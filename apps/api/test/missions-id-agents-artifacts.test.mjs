import assert from 'node:assert/strict';
import { link, mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createMissionArtifactReader } from '../src/missions/id-agents-artifacts.js';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mission-artifacts-'));
  await mkdir(path.join(root, 'reports'));
  await writeFile(path.join(root, 'reports', 'result.md'), 'verified result');
  return root;
}

test('reads and hashes bounded regular files without executing content', async () => {
  const root = await fixture();
  const reader = createMissionArtifactReader({ root, maxFiles: 5, maxTotalBytes: 1000, maxFileBytes: 100 });
  const listed = reader.list();
  assert.deepEqual(listed.files.map((file) => file.path), ['reports/result.md']);
  assert.match(listed.files[0].sha256, /^[0-9a-f]{64}$/u);
  const result = reader.read('reports/result.md');
  assert.equal(result.content.toString('utf8'), 'verified result');
  assert.equal(result.sha256, listed.files[0].sha256);
});

test('rejects traversal, absolute paths, backslashes, symlink files, and symlink directories', async () => {
  const root = await fixture();
  const outside = await mkdtemp(path.join(os.tmpdir(), 'mission-outside-'));
  await writeFile(path.join(outside, 'secret'), 'secret');
  await symlink(path.join(outside, 'secret'), path.join(root, 'linked-secret'));
  await symlink(outside, path.join(root, 'linked-dir'));
  const reader = createMissionArtifactReader({ root });
  for (const value of ['../secret', '/etc/passwd', 'reports' + String.fromCharCode(92) + 'result.md', 'reports/../result.md']) {
    assert.throws(() => reader.read(value), /path|traversal/i);
  }
  assert.throws(() => reader.read('linked-secret'), (error) => ['artifact_symlink_denied', 'artifact_open_failed'].includes(error.code));
  assert.throws(() => reader.read('linked-dir/secret'), /symlink/i);
  assert.throws(() => reader.list(), /symlink/i);
});

test('rejects hard links and non-regular output types', async () => {
  const root = await fixture();
  await link(path.join(root, 'reports', 'result.md'), path.join(root, 'reports', 'copy.md'));
  const reader = createMissionArtifactReader({ root });
  assert.throws(() => reader.read('reports/result.md'), (error) => error.code === 'artifact_hardlink_denied');
  assert.throws(() => reader.list(), (error) => error.code === 'artifact_hardlink_denied');
});

test('enforces per-file, total-byte, and file-count caps', async () => {
  const root = await fixture();
  await writeFile(path.join(root, 'a.txt'), '12345');
  await writeFile(path.join(root, 'b.txt'), '67890');
  assert.throws(() => createMissionArtifactReader({ root, maxFileBytes: 4, maxTotalBytes: 20 }).list(), (error) => error.code === 'artifact_too_large');
  assert.throws(() => createMissionArtifactReader({ root, maxFileBytes: 20, maxTotalBytes: 20 }).list(), (error) => error.code === 'artifact_total_too_large');
  assert.throws(() => createMissionArtifactReader({ root, maxFiles: 2, maxFileBytes: 100, maxTotalBytes: 100 }).list(), (error) => error.code === 'artifact_count_exceeded');
});
