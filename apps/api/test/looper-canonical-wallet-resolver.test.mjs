import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LooperCanonicalWalletError,
  buildReleasedLooperAccountRuntime,
  createCanonicalLooperWalletResolver,
  deriveReleasedLooperAccount,
} from '../src/looper-canonical-wallet-resolver.js';
import { createMemoryStore, createMultipassApi } from '../src/index.js';

const COLLECTION = '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a';
const OWNER = '0x41502Bdbb2eee8A7AA041d7158a253D66431E429';
const TOKEN_ID = '1247';
const RELEASED = '0xDe0D2c5AB01CDC7E3925Bf6fC30211549C3eeADb';
const CONTRACT_ADVERTISED = '0x92BD0870FC1dD47b164E23F63A0762F3aee14c2a';
const BLOCK_NUMBER = 52_960_310n;
const BLOCK_HASH = `0x${'ab'.repeat(32)}`;
const BLOCK_TIMESTAMP = BigInt(Math.floor(Date.now() / 1000));
let clientSequence = 0;

function createClient({
  code = buildReleasedLooperAccountRuntime(TOKEN_ID),
  owner = OWNER,
  accountOwner = OWNER,
  accountToken = [8453n, COLLECTION, 1247n],
  advertised = CONTRACT_ADVERTISED,
  chainId = 8453,
  blockNumber = BLOCK_NUMBER,
  blockHash = BLOCK_HASH,
  blockTimestamp = BLOCK_TIMESTAMP,
  providerUrl = `https://test-provider-${++clientSequence}.example/rpc`,
} = {}) {
  return {
    transport: { url: providerUrl },
    async getChainId() { return chainId; },
    async getBlock({ blockTag, blockNumber: requestedBlockNumber }) {
      if (blockTag) assert.equal(blockTag, 'finalized');
      if (requestedBlockNumber !== undefined) assert.equal(requestedBlockNumber, blockNumber);
      return { number: blockNumber, hash: blockHash, timestamp: blockTimestamp };
    },
    async getBytecode({ address }) {
      assert.equal(address, RELEASED);
      return code;
    },
    async readContract({ address, functionName, args }) {
      if (address === COLLECTION && functionName === 'ownerOf') {
        assert.deepEqual(args, [1247n]);
        return owner;
      }
      if (address === COLLECTION && functionName === 'tokenBoundAccount') {
        assert.deepEqual(args, [1247n]);
        return advertised;
      }
      if (address === RELEASED && functionName === 'token') return accountToken;
      if (address === RELEASED && functionName === 'owner') return accountOwner;
      throw new Error(`Unexpected read: ${address} ${functionName}`);
    },
  };
}

test('released resolver returns the deployed activated wallet and marks the contract-derived address unsafe', async () => {
  assert.equal(deriveReleasedLooperAccount(TOKEN_ID), RELEASED);
  const resolve = createCanonicalLooperWalletResolver({
    publicClients: [createClient(), createClient()],
    now: () => '2026-10-22T22:15:00.000Z',
  });

  const result = await resolve({ tokenId: TOKEN_ID });

  assert.deepEqual(result, {
    schema_version: '0.1.0',
    chain_id: 8453,
    block_number: BLOCK_NUMBER.toString(),
    block_hash: BLOCK_HASH,
    collection: COLLECTION,
    token_id: TOKEN_ID,
    status: 'activated',
    canonical_wallet: {
      address: RELEASED,
      deployed: true,
      binding_verified: true,
      owner: OWNER,
      source: 'multipass_released_account',
    },
    contract_reference: {
      address: CONTRACT_ADVERTISED,
      matches_canonical: false,
      safe_for_transfers: false,
    },
    transfer_policy: {
      recipient: RELEASED,
      require_exact_recipient: true,
      token_id_lookup_safe: false,
    },
    verified_at: '2026-10-22T22:15:00.000Z',
  });
});

test('resolver fails closed for undeployed, mismatched, or disagreeing wallet evidence', async (t) => {
  await t.test('undeployed released account', async () => {
    const resolve = createCanonicalLooperWalletResolver({ publicClients: [createClient({ code: '0x' }), createClient({ code: '0x' })] });
    await assert.rejects(resolve({ tokenId: TOKEN_ID }), (error) => error instanceof LooperCanonicalWalletError && error.code === 'wallet_not_activated');
  });

  await t.test('wrong released runtime', async () => {
    const resolve = createCanonicalLooperWalletResolver({ publicClients: [createClient({ code: '0x6000' }), createClient({ code: '0x6000' })] });
    await assert.rejects(resolve({ tokenId: TOKEN_ID }), (error) => error instanceof LooperCanonicalWalletError && error.code === 'runtime_mismatch');
  });

  await t.test('wrong account token binding', async () => {
    const wrong = [8453n, COLLECTION, 1248n];
    const resolve = createCanonicalLooperWalletResolver({ publicClients: [createClient({ accountToken: wrong }), createClient({ accountToken: wrong })] });
    await assert.rejects(resolve({ tokenId: TOKEN_ID }), (error) => error instanceof LooperCanonicalWalletError && error.code === 'binding_mismatch');
  });

  await t.test('owner mismatch', async () => {
    const wrongOwner = '0x709D8d528D2c0C8A408107E74b38a01Fa14e44aE';
    const resolve = createCanonicalLooperWalletResolver({ publicClients: [createClient({ accountOwner: wrongOwner }), createClient({ accountOwner: wrongOwner })] });
    await assert.rejects(resolve({ tokenId: TOKEN_ID }), (error) => error instanceof LooperCanonicalWalletError && error.code === 'ownership_mismatch');
  });

  await t.test('provider disagreement', async () => {
    const resolve = createCanonicalLooperWalletResolver({ publicClients: [createClient(), createClient({ advertised: RELEASED })] });
    await assert.rejects(resolve({ tokenId: TOKEN_ID }), (error) => error instanceof LooperCanonicalWalletError && error.code === 'provider_disagreement');
  });

  await t.test('provider unavailable', async () => {
    const unavailable = createClient();
    unavailable.getBytecode = async () => { throw new Error('offline'); };
    const resolve = createCanonicalLooperWalletResolver({ publicClients: [createClient(), unavailable] });
    await assert.rejects(resolve({ tokenId: TOKEN_ID }), (error) => error instanceof LooperCanonicalWalletError && error.code === 'provider_unavailable');
  });

  await t.test('wrong chain', async () => {
    const resolve = createCanonicalLooperWalletResolver({ publicClients: [createClient(), createClient({ chainId: 1 })] });
    await assert.rejects(resolve({ tokenId: TOKEN_ID }), (error) => error instanceof LooperCanonicalWalletError && error.code === 'provider_disagreement');
  });

  await t.test('finalized block disagreement', async () => {
    const resolve = createCanonicalLooperWalletResolver({
      publicClients: [createClient(), createClient({ blockHash: `0x${'cd'.repeat(32)}` })],
    });
    await assert.rejects(resolve({ tokenId: TOKEN_ID }), (error) => error instanceof LooperCanonicalWalletError && error.code === 'provider_disagreement');
  });

  await t.test('stalled provider times out', async () => {
    const stalled = createClient();
    stalled.getBlock = async () => new Promise(() => {});
    const resolve = createCanonicalLooperWalletResolver({ publicClients: [createClient(), stalled], timeoutMs: 5 });
    await assert.rejects(resolve({ tokenId: TOKEN_ID }), (error) => error instanceof LooperCanonicalWalletError && error.code === 'provider_unavailable');
  });

  await t.test('duplicate providers are rejected', () => {
    const first = createClient({ providerUrl: 'https://duplicate.example/rpc-a' });
    const second = createClient({ providerUrl: 'https://duplicate.example/rpc-b' });
    assert.throws(() => createCanonicalLooperWalletResolver({ publicClients: [first, second] }), /must be distinct/u);
  });

  await t.test('stale finalized head cannot force an old evidence anchor', async () => {
    const resolve = createCanonicalLooperWalletResolver({
      publicClients: [createClient(), createClient({ blockNumber: BLOCK_NUMBER - 257n })],
    });
    await assert.rejects(resolve({ tokenId: TOKEN_ID }), (error) => error instanceof LooperCanonicalWalletError && error.code === 'provider_disagreement');
  });

  await t.test('token IDs outside the collection range are rejected before provider reads', async () => {
    const resolve = createCanonicalLooperWalletResolver({ publicClients: [createClient(), createClient()] });
    await assert.rejects(resolve({ tokenId: '7778' }), /outside the collection range/u);
  });
});

test('resolver coalesces concurrent reads and reuses the verified short cache', async () => {
  let calls = 0;
  const counted = () => {
    const client = createClient();
    for (const name of ['getChainId', 'getBlock', 'getBytecode', 'readContract']) {
      const original = client[name].bind(client);
      client[name] = async (...args) => {
        calls += 1;
        return original(...args);
      };
    }
    return client;
  };
  const resolve = createCanonicalLooperWalletResolver({ publicClients: [counted(), counted()] });
  const concurrent = await Promise.all([
    resolve({ tokenId: TOKEN_ID }),
    resolve({ tokenId: TOKEN_ID }),
    resolve({ tokenId: TOKEN_ID }),
  ]);
  assert.equal(concurrent[0], concurrent[1]);
  assert.equal(concurrent[1], concurrent[2]);
  const afterFirstRead = calls;
  assert.ok(afterFirstRead > 0);
  assert.equal(await resolve({ tokenId: TOKEN_ID }), concurrent[0]);
  assert.equal(calls, afterFirstRead);
});

test('public API exposes only a read-only exact-recipient resolver', async () => {
  const api = createMultipassApi({
    store: createMemoryStore(),
    baseUrl: 'https://api.helixa.xyz',
    loopersOwnedAgentLoader: async () => [],
    loopersAuthorizer: async () => ({}),
    looperCanonicalWalletResolver: async ({ tokenId }) => ({
      schema_version: '0.1.0',
      chain_id: 8453,
      collection: COLLECTION,
      token_id: tokenId,
      status: 'activated',
      canonical_wallet: { address: RELEASED, deployed: true, binding_verified: true, owner: OWNER, source: 'multipass_released_account' },
      contract_reference: { address: CONTRACT_ADVERTISED, matches_canonical: false, safe_for_transfers: false },
      transfer_policy: { recipient: RELEASED, require_exact_recipient: true, token_id_lookup_safe: false },
      verified_at: '2026-10-22T22:15:00.000Z',
    }),
  });

  const response = await api.handleRequest(new Request('https://api.helixa.xyz/api/loopers/1247/wallet'));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /max-age=30/);
  const body = await response.json();
  assert.equal(body.canonical_wallet.address, RELEASED);
  assert.equal(body.transfer_policy.recipient, RELEASED);
  assert.equal(JSON.stringify(body).includes('privateKey'), false);
  assert.equal(JSON.stringify(body).includes('submit'), false);

  const openapi = await (await api.handleRequest(new Request('https://api.helixa.xyz/api/openapi.json'))).json();
  assert.ok(openapi.paths['/api/loopers/{token_id}/wallet']);
});

test('public API rejects out-of-range Looper IDs before resolver access', async () => {
  let calls = 0;
  const api = createMultipassApi({
    store: createMemoryStore(),
    baseUrl: 'https://api.helixa.xyz',
    loopersOwnedAgentLoader: async () => [],
    loopersAuthorizer: async () => ({}),
    looperCanonicalWalletResolver: async () => { calls += 1; return {}; },
  });
  const response = await api.handleRequest(new Request('https://api.helixa.xyz/api/loopers/7778/wallet'));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'invalid_token_id');
  assert.equal(calls, 0);
});

test('public API maps an unactivated Looper to a fail-closed 404 without an address', async () => {
  const api = createMultipassApi({
    store: createMemoryStore(),
    baseUrl: 'https://api.helixa.xyz',
    loopersOwnedAgentLoader: async () => [],
    loopersAuthorizer: async () => ({}),
    looperCanonicalWalletResolver: async () => {
      throw new LooperCanonicalWalletError('wallet_not_activated', 'Looper does not have a verified activated wallet.', 404);
    },
  });

  const response = await api.handleRequest(new Request('https://api.helixa.xyz/api/loopers/1247/wallet'));
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.error.code, 'wallet_not_activated');
  assert.equal(JSON.stringify(body).includes('0x'), false);
});
