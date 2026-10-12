'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPrivateKey } = require('node:crypto');
const { buildRegistryBundle } = require('../../cred-evidence/registry');
const { verifySubmissionBatch } = require('../../cred-evidence/submission');
const { compileEvidenceBatch } = require('../../cred-evidence/compiler');
const { buildRosterHash } = require('../../cred-looper/collector');
const { buildLooperCorpus, buildLooperRegistry, buildLooperSubmissions } = require('../../cred-looper/builder');

const COLLECTION = '0x1111111111111111111111111111111111111111';
const ACCOUNT_A = '0x2222222222222222222222222222222222222222';
const OWNER_A = '0x3333333333333333333333333333333333333333';
const ACCOUNT_B = '0x6666666666666666666666666666666666666666';
const OWNER_B = '0x7777777777777777777777777777777777777777';
const BLOCK_HASH = '0x' + 'ab'.repeat(32);
const CODE_HASH = 'sha256:' + 'cd'.repeat(32);
const key = createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.alloc(32, 9)]), format: 'der', type: 'pkcs8' });
function roster() { return { rosterType: 'looper-base-roster-v1', chainId: '8453', collection: COLLECTION, loopers: [
  { tokenId: '7', account: ACCOUNT_A, owner: OWNER_A },
  { tokenId: '8', account: ACCOUNT_B, owner: OWNER_B },
] }; }
function snapshot() { return {
  snapshotType: 'looper-base-proof-snapshot-v1', chainId: '8453', blockNumber: '99', blockHash: BLOCK_HASH, observedAt: '2026-10-12T20:00:00.000Z',
  providers: [{ providerId: 'base_a' }, { providerId: 'base_b' }],
  assets: { liquidCredContract: '0x4444444444444444444444444444444444444444', stakingVaultContract: '0x5555555555555555555555555555555555555555', stakingTokenContract: '0x4444444444444444444444444444444444444444' },
  rosterHash: buildRosterHash(roster()),
  accountProofs: [
    { tokenId: '7', account: ACCOUNT_A, owner: OWNER_A, tokenBinding: { chainId: '8453', collection: COLLECTION, tokenId: '7' }, codeHash: CODE_HASH },
    { tokenId: '8', account: ACCOUNT_B, owner: OWNER_B, tokenBinding: { chainId: '8453', collection: COLLECTION, tokenId: '8' }, codeHash: CODE_HASH },
  ],
  balances: [
    { tokenId: '7', address: ACCOUNT_A, ethWei: '0', liquidCred: '5', stakedCred: '0' },
    { tokenId: '8', address: ACCOUNT_B, ethWei: '0', liquidCred: '0', stakedCred: '0' },
  ],
}; }

test('builds an exact registry with one Helixa control group across all three evidence categories', () => {
  const registry = buildLooperRegistry(roster(), snapshot(), key);
  const bundle = buildRegistryBundle(registry);
  assert.equal(bundle.registry.subjects.length, 2);
  assert.equal(bundle.registry.providers.length, 1);
  assert.equal(bundle.registry.providers[0].controlGroupId, 'helixa_looper_base');
  assert.deepEqual(bundle.registry.providers[0].categories, ['financial', 'identity', 'onchain']);
  assert.deepEqual(bundle.registry.schemas.map(value => value.category), ['financial', 'identity', 'onchain']);
  assert.equal(bundle.registry.schemas.every(value => value.adapterId === 'looper-base-proof'), true);
  assert.equal(bundle.canonicalBytes.includes('PRIVATE KEY'), false);
});

test('emits identity and onchain evidence for every Looper but financial evidence only for nonzero direct balances', () => {
  const registry = buildLooperRegistry(roster(), snapshot(), key);
  const bundle = buildRegistryBundle(registry);
  const submissions = buildLooperSubmissions(bundle, roster(), snapshot(), key);
  assert.equal(submissions.length, 5);
  assert.deepEqual(submissions.map(value => value.submissionId), [...submissions.map(value => value.submissionId)].sort());
  const financial = submissions.filter(value => value.schemaId === 'looper_financial');
  assert.equal(financial.length, 1);
  assert.equal(financial[0].nativePayload.liquidCred, '5');
  assert.equal(submissions.some(value => value.nativePayload.direction === 'negative'), false);
  const verified = verifySubmissionBatch(bundle, submissions);
  assert.equal(verified.every(value => value.lifecycleState === 'VERIFIED'), true);
});

test('shares one subject/block correlation key across identity, onchain, and financial records', () => {
  const corpus = buildLooperCorpus(roster(), snapshot(), key);
  const records = corpus.compiled.snapshots.flatMap(value => value.records).filter(value => value.subjectId === 'looper_7');
  assert.deepEqual(records.map(value => value.category).sort(), ['financial', 'identity', 'onchain']);
  assert.equal(new Set(records.map(value => value.providerControlGroup)).size, 1);
  assert.equal(new Set(records.map(value => value.correlationKey)).size, 1);
  assert.equal(records[0].providerControlGroup, 'helixa_looper_base');
  assert.equal(corpus.report.subjectCount, 2);
  assert.equal(corpus.report.submissionCount, 5);
  assert.equal(corpus.report.unratedSubjectCount, 2);
  assert.equal(corpus.report.reasonCodeCounts.UNRATED_INSUFFICIENT_EVIDENCE, 2);
  assert.equal(corpus.report.reasonCodeCounts.PROVISIONAL_DIVERSITY_GATE, 2);
});

test('allows one owner wallet to control multiple distinct Looper accounts without identity conflict', () => {
  const sharedRoster = roster(); sharedRoster.loopers[1].owner = OWNER_A;
  const sharedSnapshot = snapshot(); sharedSnapshot.rosterHash = buildRosterHash(sharedRoster); sharedSnapshot.accountProofs[1].owner = OWNER_A;
  const corpus = buildLooperCorpus(sharedRoster, sharedSnapshot, key);
  assert.equal(corpus.report.subjectCount, 2);
  assert.equal(corpus.compiled.snapshots.every(value => value.identity.resolution === 'resolved'), true);
});

test('is byte deterministic and compiles through the existing evidence compiler', () => {
  const first = buildLooperCorpus(roster(), snapshot(), key);
  const second = buildLooperCorpus(structuredClone(roster()), structuredClone(snapshot()), key);
  assert.equal(first.canonicalBytes, second.canonicalBytes);
  assert.equal(first.corpusHash, second.corpusHash);
  assert.deepEqual(first.compiled, compileEvidenceBatch(first.registryBundle, first.submissions));
});

test('fails closed when the snapshot is incomplete, stale against the roster, or has a fabricated zero-balance negative', () => {
  const missing = snapshot(); missing.accountProofs.pop();
  assert.throws(() => buildLooperCorpus(roster(), missing, key), /complete account proof/);
  const mismatch = snapshot(); mismatch.accountProofs[0].owner = OWNER_B;
  assert.throws(() => buildLooperCorpus(roster(), mismatch, key), /roster/);
  const zero = snapshot(); zero.balances[0] = { tokenId: '7', address: ACCOUNT_A, ethWei: '0', liquidCred: '0', stakedCred: '0' };
  const corpus = buildLooperCorpus(roster(), zero, key);
  assert.equal(corpus.submissions.filter(value => value.schemaId === 'looper_financial').length, 0);
});


test('compiles the full 688-subject corpus with at most 2,064 submissions', { timeout: 30000 }, () => {
  const largeRoster = { rosterType: 'looper-base-roster-v1', chainId: '8453', collection: COLLECTION, loopers: [] };
  for (let index = 1; index <= 688; index += 1) largeRoster.loopers.push({ tokenId: String(index), account: '0x' + index.toString(16).padStart(40, '0'), owner: '0x' + (index + 1000).toString(16).padStart(40, '0') });
  const largeSnapshot = { snapshotType: 'looper-base-proof-snapshot-v1', chainId: '8453', blockNumber: '99', blockHash: BLOCK_HASH, observedAt: '2026-10-12T20:00:00.000Z', providers: [{ providerId: 'base_a' }, { providerId: 'base_b' }], assets: { liquidCredContract: '0x4444444444444444444444444444444444444444', stakingVaultContract: '0x5555555555555555555555555555555555555555', stakingTokenContract: '0x4444444444444444444444444444444444444444' }, rosterHash: buildRosterHash(largeRoster), accountProofs: [], balances: [] };
  for (const looper of largeRoster.loopers) {
    largeSnapshot.accountProofs.push({ tokenId: looper.tokenId, account: looper.account, owner: looper.owner, tokenBinding: { chainId: '8453', collection: COLLECTION, tokenId: looper.tokenId }, codeHash: CODE_HASH });
    largeSnapshot.balances.push({ tokenId: looper.tokenId, address: looper.account, ethWei: '1', liquidCred: '0', stakedCred: '0' });
  }
  const corpus = buildLooperCorpus(largeRoster, largeSnapshot, key);
  assert.equal(corpus.report.subjectCount, 688);
  assert.equal(corpus.report.submissionCount, 2064);
  assert.equal(corpus.report.unratedSubjectCount, 688);
});
