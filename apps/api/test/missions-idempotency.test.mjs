import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertMissionLedgerSafe,
  canonicalizeMissionJson,
  digestIdempotencyKey,
  digestMissionBody,
} from '../src/missions/idempotency.js';

test('canonical mission JSON normalizes object order and preserves array order', () => {
  const left = { z: 1, a: { y: true, x: ['first', 'second'] } };
  const right = { a: { x: ['first', 'second'], y: true }, z: 1 };
  assert.equal(canonicalizeMissionJson(left), canonicalizeMissionJson(right));
  assert.equal(digestMissionBody(left), digestMissionBody(right));
  assert.notEqual(digestMissionBody({ values: ['a', 'b'] }), digestMissionBody({ values: ['b', 'a'] }));
  assert.match(digestMissionBody(left), /^[a-f0-9]{64}$/u);
});

test('raw token amounts must be decimal strings and remain representation-exact', () => {
  assert.throws(() => digestMissionBody({ amount_raw: 10 }), /decimal string/i);
  assert.throws(() => digestMissionBody({ payoutAmount: 10 }), /decimal string/i);
  assert.throws(() => digestMissionBody({ total_amount: 1.5 }), /decimal string/i);
  assert.doesNotThrow(() => digestMissionBody({ amount_raw: '10', nested: { payoutAmount: '20' } }));
  assert.notEqual(digestMissionBody({ amount_raw: '10' }), digestMissionBody({ amount_raw: '010' }));
});

test('canonicalization rejects unsupported or ambiguous JavaScript values', () => {
  for (const value of [undefined, 1n, NaN, Infinity, Symbol('x'), () => {}]) {
    assert.throws(() => canonicalizeMissionJson(value), /json|finite|unsupported/i);
  }
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => canonicalizeMissionJson(cycle), /cycle/i);
  assert.throws(() => canonicalizeMissionJson(new Date()), /plain object/i);
  const sparse = []; sparse.length = 1;
  assert.throws(() => canonicalizeMissionJson(sparse), /sparse/i);
  assert.throws(() => canonicalizeMissionJson({ bad: '\ud800' }), /surrogate/i);
  const accessor = {};
  Object.defineProperty(accessor, 'value', { enumerable: true, get() { return 1; } });
  assert.throws(() => canonicalizeMissionJson(accessor), /data properties/i);
});

test('idempotency keys are bounded and persisted only as digests', () => {
  const digest = digestIdempotencyKey('wallet-operation-123');
  assert.match(digest, /^[a-f0-9]{64}$/u);
  assert.notEqual(digest, 'wallet-operation-123');
  assert.equal(digest, digestIdempotencyKey('wallet-operation-123'));
  assert.throws(() => digestIdempotencyKey(''), /idempotency key/i);
  assert.throws(() => digestIdempotencyKey('x'.repeat(257)), /idempotency key/i);
});

test('ledger-safe documents reject private execution and message material recursively', () => {
  for (const value of [
    { prompt: 'steal this' },
    { nested: { xmtp_message_body: 'plaintext' } },
    { providerCredential: 'token' },
    { wallet_signature: '0xdead' },
    { artifactContent: 'raw bytes' },
    { bridge_private_key: 'secret' },
  ]) assert.throws(() => assertMissionLedgerSafe(value), /forbidden mission ledger field/i);
  assert.doesNotThrow(() => assertMissionLedgerSafe({ private_scope: 'mission requirements', artifact_hash: 'a'.repeat(64) }));
});
