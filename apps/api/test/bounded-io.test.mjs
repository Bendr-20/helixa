import assert from 'node:assert/strict';
import { mkdtemp, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { readBoundedFileBytes, readBoundedResponseBytes } from '../src/bounded-io.js';

test('readBoundedResponseBytes returns exact bytes and enforces declared and streamed limits', async () => {
  const bytes = await readBoundedResponseBytes(new Response(new Uint8Array([0, 255, 1])), { maxBytes: 3 });
  assert.deepEqual([...bytes], [0, 255, 1]);
  await assert.rejects(
    readBoundedResponseBytes(new Response('x', { headers: { 'content-length': '4' } }), { maxBytes: 3 }),
    /byte limit|content length/i,
  );
  await assert.rejects(readBoundedResponseBytes(new Response('abcd'), { maxBytes: 3 }), /byte limit/i);
});

test('readBoundedResponseBytes rejects aborted reads', async () => {
  const controller = new AbortController();
  controller.abort(new Error('stop now'));
  await assert.rejects(readBoundedResponseBytes(new Response('ok'), { maxBytes: 10, signal: controller.signal }), /stop now/i);
});

test('readBoundedFileBytes never retains more than limit plus sentinel', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bounded-io-'));
  const path = join(directory, 'roster.json');
  await writeFile(path, Buffer.alloc(9, 1));
  await assert.rejects(readBoundedFileBytes(path, { maxBytes: 8 }), /byte limit/i);
  await writeFile(path, Buffer.from([1, 2, 3]));
  assert.deepEqual([...await readBoundedFileBytes(path, { maxBytes: 3 })], [1, 2, 3]);
});

test('readBoundedFileBytes reads the already-open inode across atomic rename', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bounded-rename-'));
  const path = join(directory, 'roster.json');
  const replacement = join(directory, 'replacement.json');
  await writeFile(path, 'old');
  await writeFile(replacement, 'new');
  let opened;
  const bytes = await readBoundedFileBytes(path, {
    maxBytes: 8,
    onOpen: async () => {
      opened = true;
      await rename(replacement, path);
    },
  });
  assert.equal(opened, true);
  assert.equal(new TextDecoder().decode(bytes), 'old');
});
