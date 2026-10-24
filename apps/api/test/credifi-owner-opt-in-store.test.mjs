import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { deriveReleasedLooperAccount } from '../src/looper-account.js';
import {
  CREDIFI_PILOT_AMOUNT_USD,
  CREDIFI_PILOT_COHORT_VERSION,
  PREPARED_CREDIFI_PILOT_TOKEN_IDS,
  createCredifiOwnerOptInStore,
} from '../src/credifi-owner-opt-in.js';

const OWNER = '0x2027af123cc4c3ced6ad389081e532af47b4dd89';
const NEW_OWNER = '0x1111111111111111111111111111111111111111';

function identity(tokenId = '11', owner = OWNER) {
  return {
    chainId: 8453,
    contract: '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a',
    tokenId,
    owner,
    erc8004AgentId: tokenId === '11' ? '86180' : '99999',
    controllerVerified: true,
    canonicalAccount: deriveReleasedLooperAccount(tokenId),
    finalizedBlock: { number: 100, hash: '0x' + 'aa'.repeat(32) },
  };
}

test('Credifi pilot eligibility is exactly the prepared 50-token artifact and every account is released-v1 canonical', async () => {
  const artifact = JSON.parse(await readFile(new URL('../../../review-artifacts/credifi/controlled-rollout-preparation-v1.json', import.meta.url), 'utf8'));
  const artifactIds = artifact.candidates.map((entry) => entry.tokenId);
  assert.equal(PREPARED_CREDIFI_PILOT_TOKEN_IDS.length, 50);
  assert.deepEqual([...PREPARED_CREDIFI_PILOT_TOKEN_IDS].sort((a, b) => Number(a) - Number(b)), [...artifactIds].sort((a, b) => Number(a) - Number(b)));
  for (const candidate of artifact.candidates) assert.equal(deriveReleasedLooperAccount(candidate.tokenId), candidate.account);
});

test('store rejects non-cohort tokens and unverified or mismatched authority', async () => {
  const store = createCredifiOwnerOptInStore();
  await assert.rejects(store.getStatus({ identity: identity('2431') }), (error) => error.code === 'credifi_pilot_not_eligible' && error.status === 403);
  await assert.rejects(store.optIn({ identity: { ...identity(), controllerVerified: false } }), /verified current owner authority/i);
  await assert.rejects(store.optIn({ identity: { ...identity(), contract: '0x1111111111111111111111111111111111111111' } }), /verified current owner authority/i);
  store.close();
});

test('opt-in persists the full consent binding and is idempotent for the same owner identity', async () => {
  let clock = 0;
  const times = ['2026-10-24T02:00:00.000Z', '2026-10-24T03:00:00.000Z'];
  const store = createCredifiOwnerOptInStore({ now: () => times[Math.min(clock++, times.length - 1)], custodyVerifier: { verifyCustodyEpoch: async () => ({ active: true, reason: null }) } });
  const first = await store.optIn({ identity: identity() });
  const second = await store.optIn({ identity: identity() });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.consentedAt, first.consentedAt);
  assert.deepEqual(first, {
    tokenId: '11',
    eligible: true,
    optedIn: true,
    created: true,
    canonicalAccount: deriveReleasedLooperAccount('11'),
    ownerWallet: OWNER,
    erc8004AgentId: '86180',
    cohortVersion: CREDIFI_PILOT_COHORT_VERSION,
    amountUsd: CREDIFI_PILOT_AMOUNT_USD,
    consentedAt: '2026-10-24T02:00:00.000Z',
    finalizedBlock: { number: 100, hash: '0x' + 'aa'.repeat(32) },
    custodyEpoch: 1,
  });
  store.close();
});

test('an A to B to A transfer permanently invalidates the old epoch and requires re-consent', async () => {
  let timestamp = 0;
  let checks = 0;
  const custodyVerifier = { async verifyCustodyEpoch() { checks += 1; return { active: false, reason: 'intervening_transfer' }; } };
  const store = createCredifiOwnerOptInStore({ now: () => new Date(Date.UTC(2026, 9, 24, 2 + timestamp++, 0, 0)).toISOString(), custodyVerifier });
  const first = await store.optIn({ identity: identity('11', OWNER) });
  const returned = { ...identity('11', OWNER), finalizedBlock: { number: 102, hash: '0x' + 'cc'.repeat(32) } };
  const invalidated = await store.getStatus({ identity: returned });
  assert.equal(invalidated.optedIn, false);
  assert.equal(invalidated.consentedAt, null);
  const stillInvalid = await store.getStatus({ identity: returned });
  assert.equal(stillInvalid.optedIn, false);
  assert.equal(checks, 1);
  const renewed = await store.optIn({ identity: returned });
  assert.equal(renewed.optedIn, true);
  assert.equal(renewed.custodyEpoch, first.custodyEpoch + 1);
  assert.notEqual(renewed.consentedAt, first.consentedAt);
  store.close();
});

test('a consent beyond the bounded scan gap expires and never silently remains active', async () => {
  const store = createCredifiOwnerOptInStore({
    custodyVerifier: { async verifyCustodyEpoch() { return { active: false, reason: 'scan_window_expired' }; } },
  });
  await store.optIn({ identity: identity() });
  const status = await store.getStatus({ identity: { ...identity(), finalizedBlock: { number: 121, hash: '0x' + 'ff'.repeat(32) } } });
  assert.equal(status.optedIn, false);
  assert.equal(status.consentedAt, null);
  store.close();
});

test('SQLite store persists in the runtime database and rejects schema drift', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'credifi-opt-in-'));
  const filename = path.join(directory, 'runtime.sqlite');
  try {
    const first = createCredifiOwnerOptInStore({ databasePath: filename, now: () => '2026-10-24T02:00:00.000Z' });
    await first.optIn({ identity: identity() });
    first.close();
    const reopened = createCredifiOwnerOptInStore({ databasePath: filename, custodyVerifier: { verifyCustodyEpoch: async () => ({ active: true, reason: null }) } });
    assert.equal((await reopened.getStatus({ identity: identity() })).consentedAt, '2026-10-24T02:00:00.000Z');
    assert.deepEqual(reopened.inspect(), { integrity: 'ok', schemaVersion: 2, consentCount: 1 });
    reopened.close();

    const drifted = path.join(directory, 'drifted.sqlite');
    const db = new DatabaseSync(drifted);
    db.exec('CREATE TABLE credifi_owner_opt_ins (token_id TEXT)');
    db.close();
    assert.throws(() => createCredifiOwnerOptInStore({ databasePath: drifted }), /schema drift/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
