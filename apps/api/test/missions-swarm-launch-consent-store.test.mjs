import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createSwarmLaunchConsentStore } from '../src/missions/swarm-launch-consent-store.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const PARTNER = '0x2222222222222222222222222222222222222222';
const HASH = '0x' + 'a'.repeat(64);

function record() {
  return {
    proposalId: 'proposal-1', initiatorWallet: OWNER, manifestSha256: HASH,
    manifest: { execution: { deploymentAuthorized: false } }, input: { members: [] },
    participants: [{ wallet: OWNER, tokenIds: ['1'] }, { wallet: PARTNER, tokenIds: ['2', '3'] }],
    createdAt: 1000, expiresAt: 2000,
  };
}

test('SQLite consent store persists immutable proposal data and signature hashes only', () => {
  const filename = join(mkdtempSync(join(tmpdir(), 'swarm-consent-')), 'consents.sqlite');
  let store = createSwarmLaunchConsentStore({ filename });
  store.create(record());
  store.consent({ proposalId: 'proposal-1', wallet: PARTNER, signatureHash: 'b'.repeat(64), consentedAt: 1200 });
  store.close();

  store = createSwarmLaunchConsentStore({ filename });
  const loaded = store.read('proposal-1');
  assert.equal(loaded.manifestSha256, HASH);
  assert.deepEqual(loaded.consents, [{ wallet: PARTNER, signatureHash: 'b'.repeat(64), consentedAt: 1200 }]);
  assert.equal(JSON.stringify(loaded).includes('0xsigned'), false);
  assert.throws(() => store.create(record()), /exists/i);
  store.close();
});

test('consent store is idempotent for the same wallet and rejects unknown participants', () => {
  const store = createSwarmLaunchConsentStore({ filename: ':memory:' });
  store.create(record());
  store.consent({ proposalId: 'proposal-1', wallet: OWNER, signatureHash: 'c'.repeat(64), consentedAt: 1200 });
  store.consent({ proposalId: 'proposal-1', wallet: OWNER, signatureHash: 'c'.repeat(64), consentedAt: 1200 });
  assert.equal(store.read('proposal-1').consents.length, 1);
  assert.throws(() => store.consent({ proposalId: 'proposal-1', wallet: '0x3333333333333333333333333333333333333333', signatureHash: 'd'.repeat(64), consentedAt: 1200 }), /participant/i);
  store.close();
});

test('consent insertion rejects signatures that finish at or after proposal expiry', () => {
  const store = createSwarmLaunchConsentStore({ filename: ':memory:' });
  store.create(record());
  assert.throws(() => store.consent({ proposalId: 'proposal-1', wallet: OWNER, signatureHash: 'e'.repeat(64), consentedAt: 2000 }), /expired/i);
  assert.equal(store.read('proposal-1').consents.length, 0);
  store.close();
});

test('an expired manifest can be renewed under a fresh proposal ID', () => {
  const store = createSwarmLaunchConsentStore({ filename: ':memory:' });
  store.create(record());
  store.create({ ...record(), proposalId: 'proposal-2', createdAt: 3000, expiresAt: 4000 });
  assert.equal(store.read('proposal-1'), null);
  assert.equal(store.read('proposal-2').manifestSha256, HASH);
  store.close();
});
