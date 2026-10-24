import assert from 'node:assert/strict';
import test from 'node:test';
import { getAddress, sha256 } from 'viem';

import { RESTAP_NETWORK_ACCOUNT_RELEASE, buildReleasedAccountRuntime, deriveReleasedAccount } from '../src/restap-network/account-integrity.js';
import { createRestapNetworkBaseProvider } from '../src/restap-network/base-provider.js';

const TOKEN_ID = '617';
const OTHER_TOKEN_ID = '618';
const A = getAddress('0x2222222222222222222222222222222222222222');
const B = getAddress('0x3333333333333333333333333333333333333333');
const ZERO = getAddress('0x0000000000000000000000000000000000000000');
const ZERO_HASH = '0x' + '00'.repeat(32);
const HASH_99 = '0x' + '99'.repeat(32);
const HASH_100 = '0x' + 'aa'.repeat(32);
const HASH_101 = '0x' + 'bb'.repeat(32);
const TX_HASH = '0x' + 'cc'.repeat(32);
const IMPLEMENTATION_CODE = '0x6001600055';
const REGISTRY_CODE = '0x6002600055';
const RELEASE = Object.freeze({
  ...RESTAP_NETWORK_ACCOUNT_RELEASE,
  implementationRuntimeBytes: (IMPLEMENTATION_CODE.length - 2) / 2,
  implementationRuntimeSha256: sha256(IMPLEMENTATION_CODE),
  moduleRegistryRuntimeBytes: (REGISTRY_CODE.length - 2) / 2,
  moduleRegistryRuntimeSha256: sha256(REGISTRY_CODE),
});
const ACCOUNT = deriveReleasedAccount({ tokenId: TOKEN_ID, release: RELEASE });
const ACCOUNT_CODE = buildReleasedAccountRuntime({ tokenId: TOKEN_ID, release: RELEASE });

function block(number, hash) { return { number: BigInt(number), hash }; }

function clientFixture({
  chainId = 8453,
  safeNumber = 100,
  latestNumber = 100,
  owners = { 99: A, 100: A, 101: A },
  logs = [],
  drift = false,
  failFunction = null,
  transientFunction = null,
  honorLogFilter = true,
  maxLogSpan = null,
} = {}) {
  const calls = [];
  let guardedReads = 0;
  let transientFailed = false;
  const hashes = { 99: HASH_99, 100: HASH_100, 101: HASH_101 };
  const ownerAt = (number) => owners[Number(number)] ?? owners[safeNumber] ?? A;
  const publicClient = {
    async getChainId() { calls.push({ kind: 'chain' }); return chainId; },
    async getBlock(request) {
      calls.push({ kind: 'block', request });
      if (request.blockTag === 'finalized') return block(safeNumber, hashes[safeNumber] ?? '0x' + safeNumber.toString(16).padStart(64, '0'));
      if (request.blockTag === 'latest') return block(latestNumber, hashes[latestNumber] ?? '0x' + latestNumber.toString(16).padStart(64, '0'));
      const number = Number(request.blockNumber);
      guardedReads += 1;
      const hash = drift && number === safeNumber && guardedReads > 1 ? HASH_101 : (hashes[number] ?? '0x' + number.toString(16).padStart(64, '0'));
      return block(number, hash);
    },
    async readContract(request) {
      calls.push({ kind: 'read', request });
      if (request.functionName === failFunction) throw new Error('partial read');
      if (request.functionName === transientFunction && !transientFailed) {
        transientFailed = true;
        const error = new Error('Request exceeds defined limit.');
        error.details = 'rate limit exceeded';
        throw error;
      }
      const number = Number(request.blockNumber);
      switch (request.functionName) {
        case 'ownerOf': return ownerAt(number);
        case 'erc8004AgentIdByLooper': return 87069n;
        case 'bindingOf': return [0, RELEASE.collection, BigInt(TOKEN_ID)];
        case 'isController': return getAddress(request.args[1]) === ownerAt(number);
        case 'account': return ACCOUNT;
        case 'owner': return ownerAt(number);
        case 'token': return [8453n, RELEASE.collection, BigInt(TOKEN_ID)];
        case 'moduleRegistry': return RELEASE.moduleRegistry;
        case 'policyModule': return ZERO;
        case 'policyModuleOwner': return ZERO;
        case 'policyEpoch': return 0n;
        case 'globallyPaused': return true;
        case 'approvedModuleCodehash': return ZERO_HASH;
        default: throw new Error('unexpected contract read: ' + request.functionName);
      }
    },
    async getBytecode(request) {
      calls.push({ kind: 'code', request });
      if (getAddress(request.address) === RELEASE.implementation) return IMPLEMENTATION_CODE;
      if (getAddress(request.address) === RELEASE.moduleRegistry) return REGISTRY_CODE;
      if (getAddress(request.address) === ACCOUNT) return ACCOUNT_CODE;
      return '0x';
    },
    async getLogs(request) {
      calls.push({ kind: 'logs', request });
      const from = Number(request.fromBlock);
      const to = Number(request.toBlock);
      if (maxLogSpan !== null && to - from + 1 > maxLogSpan) throw new Error('provider range limit exceeded');
      const ranged = logs.filter((log) => Number(log.blockNumber) >= from && Number(log.blockNumber) <= to);
      return structuredClone(honorLogFilter && request.args?.tokenId !== undefined
        ? ranged.filter((log) => BigInt(log.args?.tokenId ?? -1) === BigInt(request.args.tokenId))
        : ranged);
    },
  };
  return { publicClient, calls };
}

function provider(options = {}) {
  const fixture = clientFixture(options);
  return { ...fixture, provider: createRestapNetworkBaseProvider({ publicClient: fixture.publicClient, tokenIds: [TOKEN_ID, OTHER_TOKEN_ID], release: RELEASE }) };
}

test('production collection mode resolves an explicit owner-selected Looper without a collection allowlist', async () => {
  const fixture = clientFixture();
  const openProvider = createRestapNetworkBaseProvider({ publicClient: fixture.publicClient, allowAnyCollectionToken: true, release: RELEASE });
  const observation = await openProvider.readAccountIntegrity({ tokenId: TOKEN_ID });
  assert.equal(observation.accountToken.tokenId, TOKEN_ID);
});

test('retries a bounded transient RPC rate limit without weakening the integrity proof', async () => {
  const f = provider({ transientFunction: 'isController' });
  const observation = await f.provider.readAccountIntegrity({ tokenId: TOKEN_ID });
  assert.equal(observation.owner, A);
  assert.equal(observation.controller, A);
  assert.equal(f.calls.filter((call) => call.kind === 'read' && call.request.functionName === 'isController').length, 3);
});

test('reads a complete safe-block account-integrity observation and proves the ERC-721 owner controller', async () => {
  const f = provider();
  const observation = await f.provider.readAccountIntegrity({ tokenId: TOKEN_ID });
  assert.deepEqual(observation.safeBlock, { number: 100, hash: HASH_100 });
  assert.equal(observation.account, ACCOUNT);
  assert.equal(observation.accountCode, ACCOUNT_CODE);
  assert.equal(observation.owner, A);
  assert.equal(observation.erc8004AgentId, '87069');
  assert.equal(observation.accountOwner, A);
  assert.equal(observation.controller, A);
  assert.deepEqual(observation.latest, { owner: A, controller: A });
  assert.deepEqual(observation.accountToken, { chainId: 8453, collection: RELEASE.collection, tokenId: TOKEN_ID });
  assert.equal(observation.moduleRegistry, RELEASE.moduleRegistry);
  assert.equal(observation.registryPaused, true);
  assert.equal(observation.policyModule, ZERO);
  assert.equal(observation.policyModuleCode, '0x');
  assert.equal(observation.policyModuleCodehash, ZERO_HASH);
  assert.equal(Object.isFrozen(observation), true);
  assert.equal(f.calls.filter((call) => call.kind === 'read' && call.request.functionName === 'isController').length, 2);
  assert.ok(f.calls.filter((call) => call.kind === 'read').every((call) => typeof call.request.blockNumber === 'bigint'));
});

test('reads bounded finalized Transfer evidence and treats controller as the pinned ERC-721 owner', async () => {
  const transfer = {
    address: RELEASE.collection,
    blockNumber: 100n,
    blockHash: HASH_100,
    transactionHash: TX_HASH,
    transactionIndex: 2,
    logIndex: 3,
    removed: false,
    args: { from: A, to: B, tokenId: 617n },
  };
  const f = provider({ owners: { 99: A, 100: B, 101: B }, logs: [transfer] });
  const evidence = await f.provider.readCustody({
    chainId: 8453,
    collection: RELEASE.collection,
    tokenId: TOKEN_ID,
    fromBlock: 100,
    toBlock: 100,
    previousSafeBlock: { number: 99, hash: HASH_99 },
  });
  assert.deepEqual({ owner: evidence.safeOwner, controller: evidence.safeController }, { owner: B, controller: B });
  assert.deepEqual({ owner: evidence.latestOwner, controller: evidence.latestController }, { owner: B, controller: B });
  assert.deepEqual(evidence.events, [{
    kind: 'transfer', source: RELEASE.collection, tokenId: TOKEN_ID,
    blockNumber: 100, blockHash: HASH_100, transactionHash: TX_HASH,
    transactionIndex: 2, logIndex: 3, from: A, to: B,
  }]);
  assert.equal(evidence.priorSafeHash, HASH_99);
  assert.deepEqual(await f.provider.listAffectedTokens({ chainId: 8453, collection: RELEASE.collection, fromBlock: 100, toBlock: 100 }), [TOKEN_ID]);
});

test('incremental custody reads chunk provider log ranges below hosted RPC limits', async () => {
  const f = provider({ safeNumber: 3_000, latestNumber: 3_000, maxLogSpan: 10 });
  const evidence = await f.provider.readCustody({
    chainId: 8453, collection: RELEASE.collection, tokenId: TOKEN_ID,
    fromBlock: 1, toBlock: 2_000, previousSafeBlock: null,
  });
  assert.deepEqual(evidence.range, { fromBlock: 1, toBlock: 2_000 });
  assert.equal(evidence.safeBlock.number, 2_000);
  const ranges = f.calls.filter((call) => call.kind === 'logs').map((call) => [Number(call.request.fromBlock), Number(call.request.toBlock)]);
  assert.equal(ranges.length, 200);
  assert.deepEqual(ranges[0], [1, 10]);
  assert.deepEqual(ranges.at(-1), [1_991, 2_000]);
  assert.equal(ranges.every(([from, to]) => to - from + 1 <= 10), true);
});

test('incremental custody reads return an exact no-op when the finalized head has not advanced', async () => {
  const f = provider();
  const value = await f.provider.readCustody({
    chainId: 8453, collection: RESTAP_NETWORK_ACCOUNT_RELEASE.collection, tokenId: TOKEN_ID,
    fromBlock: 101, toBlock: null, previousSafeBlock: { number: 100, hash: HASH_100 },
  });
  assert.deepEqual(value.range, { fromBlock: 101, toBlock: 100 });
  assert.deepEqual(value.events, []);
  assert.equal(value.priorSafeHash, HASH_100);
});

test('full rebuild snapshots current authority without an unbounded historical log scan', async () => {
  const f = provider();
  const evidence = await f.provider.readCustody({ chainId: 8453, collection: RELEASE.collection, tokenId: TOKEN_ID, fromBlock: 0, toBlock: null, previousSafeBlock: null });
  assert.deepEqual(evidence.range, { fromBlock: 0, toBlock: 100 });
  assert.deepEqual(evidence.events, []);
  assert.equal(f.calls.some((call) => call.kind === 'logs'), false);
});

test('fails closed on wrong chain, unallowlisted tokens, oversized ranges, partial reads, and canonical hash drift', async () => {
  await assert.rejects(provider({ chainId: 1 }).provider.readAccountIntegrity({ tokenId: TOKEN_ID }), /chain/i);
  await assert.rejects(provider().provider.readCustody({ chainId: 8453, collection: RELEASE.collection, tokenId: '999', fromBlock: 1, toBlock: 2, previousSafeBlock: null }), /allowlist/i);
  await assert.rejects(provider().provider.listAffectedTokens({ chainId: 8453, collection: RELEASE.collection, fromBlock: 1, toBlock: 2001 }), /range/i);
  await assert.rejects(provider({ failFunction: 'token' }).provider.readAccountIntegrity({ tokenId: TOKEN_ID }), /partial read/i);
  await assert.rejects(provider({ drift: true }).provider.readAccountIntegrity({ tokenId: TOKEN_ID }), /canonical|hash|drift/i);
});

test('rejects removed, wrong-token, malformed, and wrong-address Transfer logs', async () => {
  const base = { address: RELEASE.collection, blockNumber: 100n, blockHash: HASH_100, transactionHash: TX_HASH, transactionIndex: 0, logIndex: 0, removed: false, args: { from: A, to: B, tokenId: 617n } };
  for (const log of [
    { ...base, removed: true },
    { ...base, args: { ...base.args, tokenId: 618n } },
    { ...base, address: RELEASE.controllerSource },
    { ...base, blockHash: null },
  ]) {
    const f = provider({ owners: { 100: B }, logs: [log], honorLogFilter: false });
    await assert.rejects(f.provider.readCustody({ chainId: 8453, collection: RELEASE.collection, tokenId: TOKEN_ID, fromBlock: 100, toBlock: 100, previousSafeBlock: null }), /transfer|log|evidence/i);
  }
});
