import assert from 'node:assert/strict';
import test from 'node:test';
import { getAddress, keccak256, sha256 } from 'viem';

import {
  RESTAP_NETWORK_ACCOUNT_RELEASE,
  buildReleasedAccountRuntime,
  createAccountIntegrityReader,
  deriveReleasedAccount,
} from '../src/restap-network/account-integrity.js';

const OWNER = getAddress('0x2222222222222222222222222222222222222222');
const CONTROLLER = getAddress('0x3333333333333333333333333333333333333333');
const ZERO = getAddress('0x0000000000000000000000000000000000000000');
const ZERO_HASH = '0x' + '00'.repeat(32);
const IMPLEMENTATION_CODE = '0x6001600055';
const REGISTRY_CODE = '0x6002600055';
const RELEASE = Object.freeze({
  ...RESTAP_NETWORK_ACCOUNT_RELEASE,
  implementationRuntimeBytes: (IMPLEMENTATION_CODE.length - 2) / 2,
  implementationRuntimeSha256: sha256(IMPLEMENTATION_CODE),
  moduleRegistryRuntimeBytes: (REGISTRY_CODE.length - 2) / 2,
  moduleRegistryRuntimeSha256: sha256(REGISTRY_CODE),
});

function observation(overrides = {}) {
  const tokenId = String(overrides.tokenId ?? '617');
  const account = deriveReleasedAccount({ tokenId, release: RELEASE });
  const accountCode = buildReleasedAccountRuntime({ tokenId, release: RELEASE });
  return {
    safeBlock: { number: 100, hash: '0x' + 'aa'.repeat(32) },
    account,
    registryAccount: account,
    collectionAccount: account,
    collectionRegistry: RELEASE.registry,
    collectionImplementation: RELEASE.implementation,
    collectionSalt: RELEASE.salt,
    accountCode,
    implementationCode: IMPLEMENTATION_CODE,
    accountToken: { chainId: RELEASE.chainId, collection: RELEASE.collection, tokenId },
    owner: OWNER,
    erc8004AgentId: '87069',
    accountOwner: OWNER,
    controller: CONTROLLER,
    moduleRegistry: RELEASE.moduleRegistry,
    moduleRegistryCode: REGISTRY_CODE,
    registryPaused: true,
    policyModule: ZERO,
    policyModuleOwner: ZERO,
    policyEpoch: '0',
    policyModuleCode: '0x',
    policyModuleCodehash: ZERO_HASH,
    approvedModuleCodehash: ZERO_HASH,
    latest: { owner: OWNER, controller: CONTROLLER },
    ...overrides,
  };
}

function provider(value = observation()) {
  return { async readAccountIntegrity() { return structuredClone(value); } };
}

function reader(values = [observation(), observation()], options = {}) {
  return createAccountIntegrityReader({
    providers: values.map((value) => value?.readAccountIntegrity ? value : provider(value)),
    release: RELEASE,
    timeoutMs: 20,
    ...options,
  });
}

test('pins the reviewed Base account release descriptor and deterministically derives the proxy', () => {
  assert.deepEqual(RESTAP_NETWORK_ACCOUNT_RELEASE, {
    chainId: 8453,
    collection: getAddress('0x1649CD37f4748807b4882FC48765bA0B2aFfa94a'),
    registry: getAddress('0x000000006551c19487814612e58FE06813775758'),
    implementation: getAddress('0xf192f350427c8F58bC28e78b1e6Af164279F486e'),
    salt: '0xff28549509272e76f1d1c6ef7d6976d848c5ff6cb5068b2183c8d52f4cbe2bee',
    implementationRuntimeBytes: 6096,
    implementationRuntimeSha256: '0x85adc244e07b43ac687b1ac9f4f245089678fa787adb4fdcb95d4402b0d8a43c',
    moduleRegistry: getAddress('0x4e4df0DEa80e389802f819D95AAEe4CB004D3E1a'),
    moduleRegistryRuntimeBytes: 1234,
    moduleRegistryRuntimeSha256: '0xc94fcea5df503e97852633cbe76e0ee76260595f3f25c2fdbbf99ef6aec253bb',
    controllerSource: getAddress('0x270d25D2c59A8bcA1B0f40ad95fF7806c0025c27'),
    controllerModel: 'erc721_owner',
    policy: {
      registryPaused: true,
      module: ZERO,
      moduleOwner: ZERO,
      epoch: '0',
      moduleRuntimeBytes: 0,
      moduleRuntimeSha256: null,
      moduleCodehash: ZERO_HASH,
      approvedModuleCodehash: ZERO_HASH,
    },
  });
  assert.equal(deriveReleasedAccount({ tokenId: '617', release: RELEASE }), deriveReleasedAccount({ tokenId: 617n, release: RELEASE }));
  const runtime = buildReleasedAccountRuntime({ tokenId: '617', release: RELEASE });
  assert.equal((runtime.length - 2) / 2, 173);
  assert.equal(runtime.slice(22, 62), RELEASE.implementation.slice(2).toLowerCase());
});

test('returns one deeply frozen exact proof only when both approved providers agree', async () => {
  const result = await reader().read({ tokenId: '617' });
  assert.equal(result.eligible, true);
  assert.equal(result.status, 'ready');
  assert.equal(result.proof.account, deriveReleasedAccount({ tokenId: '617', release: RELEASE }));
  assert.equal(result.proof.erc8004AgentId, '87069');
  assert.equal(result.proof.accountRuntimeSha256, sha256(result.proof.accountCode));
  assert.equal(result.proof.implementationRuntimeSha256, RELEASE.implementationRuntimeSha256);
  assert.equal(result.proof.moduleRegistryRuntimeSha256, RELEASE.moduleRegistryRuntimeSha256);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.proof.accountToken), true);
  assert.throws(() => { result.proof.accountToken.tokenId = '1'; }, TypeError);
});

test('calls each provider with only the canonical token ID', async () => {
  const requests = [];
  const exactProvider = { async readAccountIntegrity(request) { requests.push(request); return observation(); } };
  const result = await reader([exactProvider, exactProvider]).read({ tokenId: '617' });
  assert.equal(result.status, 'ready');
  assert.deepEqual(requests, [{ tokenId: '617' }, { tokenId: '617' }]);
});

test('pins disagreeing provider finalized heads to one exact shared anchor', async () => {
  const requests = [];
  const anchored = (number) => ({
    async readFinalizedHead() { return { number, hash: '0x' + number.toString(16).padStart(64, '0') }; },
    async readAccountIntegrity(request) { requests.push(request); return observation({ safeBlock: { number: request.safeBlockNumber, hash: '0x' + 'aa'.repeat(32) } }); },
  });
  const result = await reader([anchored(100), anchored(180)], { maxSafeBlockSkew: 2 }).read({ tokenId: '617' });
  assert.equal(result.status, 'ready');
  assert.equal(result.proof.safeBlock.number, 100);
  assert.deepEqual(requests, [{ tokenId: '617', safeBlockNumber: 100 }, { tokenId: '617', safeBlockNumber: 100 }]);
});

test('holder opt-in may verify owner authority without deploying the deterministic V1 account', async () => {
  const undeployed = observation({ accountCode: '0x' });
  const result = await reader([undeployed, undeployed], { allowUndeployedAccount: true }).read({ tokenId: '617' });
  assert.equal(result.eligible, true);
  assert.equal(result.status, 'ready');
  assert.equal(result.proof.accountDeployed, false);
  assert.equal(result.proof.owner, OWNER);
  assert.equal(result.proof.controller, CONTROLLER);
});

test('holder opt-in accepts bounded finalized-head skew when authority evidence agrees', async () => {
  const newer = observation({ safeBlock: { number: 101, hash: '0x' + 'bb'.repeat(32) } });
  const result = await reader([observation(), newer], { maxSafeBlockSkew: 1 }).read({ tokenId: '617' });
  const tooNew = observation({ safeBlock: { number: 102, hash: '0x' + 'cc'.repeat(32) } });
  assert.equal((await reader([observation(), tooNew], { maxSafeBlockSkew: 1 }).read({ tokenId: '617' })).status, 'safe_block_disagreement');
  assert.equal(result.status, 'ready');
  assert.equal(result.proof.safeBlock.number, 100);
  assert.equal(result.proof.safeBlock.hash, '0x' + 'aa'.repeat(32));
});

test('rejects browser-supplied evidence and requires two approved providers', async () => {
  await assert.rejects(reader().read({ tokenId: '617', browserEvidence: observation() }), /exact server-side request/i);
  assert.throws(() => createAccountIntegrityReader({ providers: [provider()], release: RELEASE }), /at least two approved providers/i);
});

test('fails closed with fixed classes for exact integrity failures', async (t) => {
  const cases = [
    ['account_missing', { accountCode: '0x' }],
    ['proxy_mismatch', { accountCode: '0x6000' }],
    ['implementation_mismatch', { implementationCode: '0x6000' }],
    ['binding_mismatch', { accountToken: { chainId: 1, collection: RELEASE.collection, tokenId: '617' } }],
    ['ownership_mismatch', { accountOwner: CONTROLLER }],
    ['registry_mismatch', { moduleRegistryCode: '0x6000' }],
    ['policy_mismatch', { registryPaused: false }],
    ['policy_mismatch', { policyModule: CONTROLLER, policyModuleOwner: OWNER, policyModuleCode: '0x6003', policyModuleCodehash: keccak256('0x6003'), approvedModuleCodehash: ZERO_HASH }],
  ];
  for (const [status, patch] of cases) {
    await t.test(status + ':' + Object.keys(patch)[0], async () => {
      const bad = observation(patch);
      const result = await reader([bad, bad]).read({ tokenId: '617' });
      assert.deepEqual({ eligible: result.eligible, status: result.status, proof: result.proof }, { eligible: false, status, proof: null });
    });
  }
});

test('rejects an arbitrary self-consistent approved module because policy constraints are release-pinned', async () => {
  const code = '0x6003600055';
  const codehash = keccak256(code);
  const active = observation({ policyModule: CONTROLLER, policyModuleOwner: OWNER, policyEpoch: '4', policyModuleCode: code, policyModuleCodehash: codehash, approvedModuleCodehash: codehash });
  const result = await reader([active, active]).read({ tokenId: '617' });
  assert.equal(result.eligible, false);
  assert.equal(result.status, 'policy_mismatch');
  assert.equal(result.proof, null);
});

test('never accepts one provider on timeout, degradation, safe disagreement, exact-value disagreement, or latest mismatch', async () => {
  const hanging = { readAccountIntegrity: async () => new Promise(() => {}) };
  assert.equal((await reader([provider(), hanging]).read({ tokenId: '617' })).status, 'provider_timeout');
  const failed = { readAccountIntegrity: async () => { throw new Error('offline'); } };
  assert.equal((await reader([provider(), failed]).read({ tokenId: '617' })).status, 'provider_unavailable');
  assert.equal((await reader([observation(), observation({ safeBlock: { number: 101, hash: '0x' + 'bb'.repeat(32) } })]).read({ tokenId: '617' })).status, 'safe_block_disagreement');
  assert.equal((await reader([observation(), observation({ controller: OWNER, latest: { owner: OWNER, controller: OWNER } })]).read({ tokenId: '617' })).status, 'provider_disagreement');
  const latestMismatch = observation({ latest: { owner: CONTROLLER, controller: CONTROLLER } });
  assert.equal((await reader([latestMismatch, latestMismatch]).read({ tokenId: '617' })).status, 'latest_authority_mismatch');
});
