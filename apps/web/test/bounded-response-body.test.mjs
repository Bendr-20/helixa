import assert from 'node:assert/strict';
import test from 'node:test';

import { readBoundedResponseBody, readBoundedResponseBytes } from '../src/bounded-response-body.js';

test('returns exact bytes before text decoding', async () => {
  const input = new Uint8Array([0, 255, 1]);
  assert.deepEqual([...await readBoundedResponseBytes(new Response(input), { maxBytes: 3 })], [...input]);
});

test('text helper decodes the shared bounded byte path', async () => {
  assert.equal(await readBoundedResponseBody(new Response('hello'), { maxBytes: 5 }), 'hello');
  await assert.rejects(readBoundedResponseBytes(new Response('abcdef'), { maxBytes: 5 }), /byte limit/i);
  await assert.rejects(readBoundedResponseBody(new Response('abcdef'), { maxBytes: 5 }), /byte limit/i);
});

test('bounded byte reader fails on pre-aborted signals', async () => {
  const controller = new AbortController();
  controller.abort(new Error('cancelled'));
  await assert.rejects(readBoundedResponseBytes(new Response('ok'), { maxBytes: 2, signal: controller.signal }), /cancelled/i);
});
