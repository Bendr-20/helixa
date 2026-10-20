import assert from 'node:assert/strict';
import test from 'node:test';

import { createMemoryStore, createMultipassApi } from '../src/index.js';
import { createLoopersPublicClients, loadOwnedLooperAgents } from '../src/loopers-owned-agents.js';

const WALLET = '0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea';
const OTHER_WALLET = '0x0000000000000000000000000000000000000001';
const AUTH_COOKIE = { cookie: 'multipass_console=test-session' };

function createOwnershipClient({ incomplete = false, owns617 = false, failedTokenId = null, failedTokenIdOnce = null } = {}) {
  let droppedTransientToken = false;
  return {
    async readContract({ functionName, args = [] }) {
      if (functionName === 'balanceOf') return 1n;
      if (functionName === 'totalMinted') return 617n;
      if (functionName === 'erc8004AgentIdByLooper') return args[0] === 617n ? 87069n : 0n;
      if (functionName === 'isController') return args[0] === 87069n && args[1].toLowerCase() === WALLET.toLowerCase();
      if (functionName === 'ownerOf') return args[0] === 617n && owns617 ? WALLET : OTHER_WALLET;
      throw new Error(`unexpected read ${functionName}`);
    },
    async multicall({ contracts }) {
      return contracts.map((contract, index) => {
        const tokenId = contract.args[0];
        const dropsTransientToken = tokenId === failedTokenIdOnce && !droppedTransientToken;
        if (dropsTransientToken) droppedTransientToken = true;
        if ((incomplete && index === 0) || tokenId === failedTokenId || dropsTransientToken) {
          return { status: 'failure', error: new Error('dropped') };
        }
        if (contract.functionName === 'ownerOf') {
          return { status: 'success', result: tokenId === 617n && owns617 ? WALLET : OTHER_WALLET };
        }
        if (contract.functionName === 'erc8004AgentIdByLooper') {
          return { status: 'success', result: tokenId === 617n ? 87069n : 0n };
        }
        if (contract.functionName === 'isController') {
          return { status: 'success', result: tokenId === 87069n && contract.args[1].toLowerCase() === WALLET.toLowerCase() };
        }
        throw new Error(`unexpected multicall ${contract.functionName}`);
      });
    },
  };
}

test('owned Looper clients include a third live Base fallback', () => {
  assert.deepEqual(
    createLoopersPublicClients().map((client) => client.transport.url),
    ['https://base-rpc.publicnode.com', 'https://base-mainnet.public.blastapi.io', 'https://mainnet.base.org'],
  );
});

test('owned Looper scan does not wait for a stalled provider after a complete provider succeeds', { timeout: 500 }, async () => {
  const fast = createOwnershipClient({ owns617: true });
  const stalled = {
    readContract: fast.readContract,
    multicall: async () => new Promise(() => {}),
  };
  const agents = await loadOwnedLooperAgents({
    address: WALLET,
    publicClients: [fast, stalled],
    fetchImpl: async () => new Response(JSON.stringify({ name: 'Looper #617', attributes: [] })),
  });
  assert.equal(agents.length, 1);
  assert.equal(agents[0].tokenId, '617');
});

test('owned Looper fallback scans the full collection in bounded large chunks', async () => {
  let ownershipBatches = 0;
  const publicClient = {
    async readContract({ functionName }) {
      if (functionName === 'balanceOf') return 1n;
      if (functionName === 'totalMinted') return 7_777n;
      throw new Error('unexpected direct read');
    },
    async multicall({ contracts }) {
      const isOwnershipScan = contracts.every(({ functionName }) => functionName === 'ownerOf');
      if (isOwnershipScan) ownershipBatches += 1;
      return contracts.map(({ functionName, args }) => {
        if (functionName === 'ownerOf') return { status: 'success', result: args[0] === 1n ? WALLET : OTHER_WALLET };
        if (functionName === 'erc8004AgentIdByLooper') return { status: 'success', result: 90_001n };
        if (functionName === 'isController') return { status: 'success', result: true };
        throw new Error(`unexpected multicall ${functionName}`);
      });
    },
  };

  const agents = await loadOwnedLooperAgents({
    address: WALLET,
    publicClient,
    indexerBaseUrl: null,
    fetchImpl: async () => new Response(JSON.stringify({ name: 'Looper #1', attributes: [] })),
  });

  assert.deepEqual(agents.map(({ tokenId }) => tokenId), ['1']);
  assert.ok(ownershipBatches <= 16, `expected no more than 16 ownership batches, received ${ownershipBatches}`);
});

test('owned Looper scan falls back after an RPC drops a chunk and resolves the canonical identity', async () => {
  const agents = await loadOwnedLooperAgents({
    address: WALLET,
    publicClients: [
      createOwnershipClient({ incomplete: true }),
      createOwnershipClient({ owns617: true }),
    ],
    fetchImpl: async () => new Response(JSON.stringify({ name: 'Looper #617', attributes: [] })),
  });

  assert.equal(agents.length, 1);
  assert.equal(agents[0].tokenId, '617');
  assert.equal(agents[0].erc8004AgentId, '87069');
  assert.equal(agents[0].controllerVerified, true);
});

test('owned Looper scan tolerates permanent ownerOf gaps when the balance is fully reconciled', async () => {
  const agents = await loadOwnedLooperAgents({
    address: WALLET,
    publicClients: [createOwnershipClient({ owns617: true, failedTokenId: 616n })],
    fetchImpl: async () => new Response(JSON.stringify({ name: 'Looper #617', attributes: [] })),
  });

  assert.equal(agents.length, 1);
  assert.equal(agents[0].tokenId, '617');
});

test('owned Looper scan retries a dropped owner slot with a direct chain read', async () => {
  const agents = await loadOwnedLooperAgents({
    address: WALLET,
    publicClients: [createOwnershipClient({ owns617: true, failedTokenIdOnce: 617n })],
    fetchImpl: async () => new Response(JSON.stringify({ name: 'Looper #617', attributes: [] })),
  });

  assert.equal(agents.length, 1);
  assert.equal(agents[0].tokenId, '617');
});

test('owned Looper authorization retries unresolved multicall slots with direct reads', async () => {
  let droppedAuthorizationOwner = false;
  const publicClient = {
    async readContract({ functionName }) {
      if (functionName === 'balanceOf') return 1n;
      if (functionName === 'totalMinted') return 7_777n;
      if (functionName === 'ownerOf') return WALLET;
      if (functionName === 'erc8004AgentIdByLooper') return 90_617n;
      if (functionName === 'isController') return true;
      throw new Error(`unexpected read ${functionName}`);
    },
    async multicall({ contracts }) {
      return contracts.map(({ functionName }) => {
        if (functionName === 'ownerOf' && !droppedAuthorizationOwner) {
          droppedAuthorizationOwner = true;
          return { status: 'failure', error: new Error('transient RPC slot failure') };
        }
        if (functionName === 'ownerOf') return { status: 'success', result: WALLET };
        if (functionName === 'erc8004AgentIdByLooper') return { status: 'success', result: 90_617n };
        if (functionName === 'isController') return { status: 'success', result: true };
        throw new Error(`unexpected multicall ${functionName}`);
      });
    },
  };

  const agents = await loadOwnedLooperAgents({
    address: WALLET,
    publicClient,
    fetchImpl: async (url) => String(url).includes('/instances?')
      ? new Response(JSON.stringify({ items: [{ id: '617' }], next_page_params: null }))
      : new Response(JSON.stringify({ name: 'Looper #617', attributes: [] })),
  });

  assert.equal(agents.length, 1);
  assert.equal(agents[0].controllerVerified, true);
});

test('owned Looper loader abandons a stalled indexer and uses the bounded chain fallback', { timeout: 1_000 }, async () => {
  const agents = await loadOwnedLooperAgents({
    address: WALLET,
    publicClients: [createOwnershipClient({ owns617: true })],
    indexerTimeoutMs: 5,
    fetchImpl: async (url) => String(url).includes('/instances?')
      ? new Promise(() => {})
      : new Response(JSON.stringify({ name: 'Looper #617', attributes: [] })),
  });

  assert.equal(agents.length, 1);
  assert.equal(agents[0].tokenId, '617');
});

test('owned Looper loader uses the public holder index before the bounded ownerOf fallback', async () => {
  let multicallCalls = 0;
  const publicClient = {
    async readContract({ functionName, args = [] }) {
      if (functionName === 'balanceOf') return 1n;
      if (functionName === 'totalMinted') return 7_440n;
      if (functionName === 'ownerOf') return args[0] === 617n ? WALLET : OTHER_WALLET;
      if (functionName === 'erc8004AgentIdByLooper') return args[0] === 617n ? 87069n : 0n;
      if (functionName === 'isController') return args[0] === 87069n;
      throw new Error(`unexpected read ${functionName}`);
    },
    async multicall({ contracts }) {
      multicallCalls += 1;
      return contracts.map(({ functionName, args }) => {
        if (functionName === 'ownerOf') {
          assert.equal(args[0], 617n, 'full supply scan should not run');
          return { status: 'success', result: WALLET };
        }
        if (functionName === 'erc8004AgentIdByLooper') return { status: 'success', result: 87069n };
        if (functionName === 'isController') return { status: 'success', result: true };
        throw new Error(`unexpected multicall ${functionName}`);
      });
    },
  };

  const agents = await loadOwnedLooperAgents({
    address: WALLET,
    publicClient,
    fetchImpl: async (url) => String(url).includes('/instances?')
      ? new Response(JSON.stringify({ items: [{ id: '617' }], next_page_params: null }))
      : new Response(JSON.stringify({ name: 'Looper #617', attributes: [] })),
  });

  assert.equal(multicallCalls, 2);
  assert.equal(agents.length, 1);
  assert.equal(agents[0].tokenId, '617');
});

test('owned Looper loader follows every Blockscout holder page before declaring the roster complete', async () => {
  const tokenIds = Array.from({ length: 12 }, (_, index) => BigInt(index + 1));
  const indexUrls = [];
  let multicallCalls = 0;
  const publicClient = {
    async readContract({ functionName }) {
      if (functionName === 'balanceOf') return 12n;
      if (functionName === 'totalMinted') return 7_777n;
      throw new Error('ownerOf fallback must not run');
    },
    async multicall({ contracts }) {
      multicallCalls += 1;
      return contracts.map(({ functionName, args }) => {
        if (functionName === 'ownerOf') return { status: 'success', result: WALLET };
        if (functionName === 'erc8004AgentIdByLooper') return { status: 'success', result: 90_000n + args[0] };
        if (functionName === 'isController') return { status: 'success', result: true };
        throw new Error(`unexpected multicall ${functionName}`);
      });
    },
  };

  const agents = await loadOwnedLooperAgents({
    address: WALLET,
    publicClient,
    fetchImpl: async (url) => {
      const parsed = new URL(String(url));
      if (!parsed.pathname.endsWith('/instances')) {
        return new Response(JSON.stringify({ name: `Looper #${parsed.pathname.match(/(\d+)\.json$/)?.[1]}`, attributes: [] }));
      }
      indexUrls.push(parsed);
      assert.equal(parsed.searchParams.get('holder_address_hash'), WALLET);
      if (!parsed.searchParams.has('cursor')) {
        return new Response(JSON.stringify({
          items: tokenIds.slice(0, 10).map((tokenId) => ({ id: tokenId.toString() })),
          next_page_params: { cursor: 'page-2' },
        }));
      }
      assert.equal(parsed.searchParams.get('cursor'), 'page-2');
      return new Response(JSON.stringify({
        items: tokenIds.slice(10).map((tokenId) => ({ id: tokenId.toString() })),
        next_page_params: null,
      }));
    },
  });

  assert.equal(indexUrls.length, 2);
  assert.equal(multicallCalls, 2, 'only batched authorization multicalls should run');
  assert.deepEqual(agents.map((agent) => agent.tokenId), tokenIds.map(String));
});

test('owned Looper loader batches authorization for wallets with many agents', async () => {
  const tokenIds = Array.from({ length: 45 }, (_, index) => BigInt(index + 1));
  let multicallCalls = 0;
  const publicClient = {
    async readContract({ functionName }) {
      if (functionName === 'balanceOf') return BigInt(tokenIds.length);
      if (functionName === 'totalMinted') return 7_777n;
      throw new Error('public RPC rate limit exceeded');
    },
    async multicall({ contracts }) {
      multicallCalls += 1;
      return contracts.map(({ functionName, args }) => {
        if (functionName === 'ownerOf') return { status: 'success', result: WALLET };
        if (functionName === 'erc8004AgentIdByLooper') {
          return { status: 'success', result: 90_000n + args[0] };
        }
        if (functionName === 'isController') return { status: 'success', result: true };
        throw new Error(`unexpected multicall ${functionName}`);
      });
    },
  };

  const agents = await loadOwnedLooperAgents({
    address: WALLET,
    publicClient,
    fetchImpl: async (url) => String(url).includes('/instances?')
      ? new Response(JSON.stringify({
          items: tokenIds.map((tokenId) => ({ id: tokenId.toString() })),
          next_page_params: null,
        }))
      : new Response(JSON.stringify({ name: `Looper #${String(url).match(/(\d+)\.json$/)?.[1]}`, attributes: [] })),
  });

  assert.equal(agents.length, 45);
  assert.equal(multicallCalls, 2);
  assert.equal(agents[44].erc8004AgentId, '90045');
});

test('owned Looper loader hydrates high-cardinality metadata concurrently within a bound', async () => {
  const tokenIds = Array.from({ length: 24 }, (_, index) => BigInt(index + 1));
  let activeMetadata = 0;
  let maxActiveMetadata = 0;
  const publicClient = {
    async readContract({ functionName }) {
      if (functionName === 'balanceOf') return BigInt(tokenIds.length);
      if (functionName === 'totalMinted') return 7_777n;
      throw new Error(`unexpected read ${functionName}`);
    },
    async multicall({ contracts }) {
      return contracts.map(({ functionName, args }) => {
        if (functionName === 'ownerOf') return { status: 'success', result: WALLET };
        if (functionName === 'erc8004AgentIdByLooper') return { status: 'success', result: 90_000n + args[0] };
        if (functionName === 'isController') return { status: 'success', result: true };
        throw new Error(`unexpected multicall ${functionName}`);
      });
    },
  };

  const agents = await loadOwnedLooperAgents({
    address: WALLET,
    publicClient,
    fetchImpl: async (url) => {
      if (String(url).includes('/instances?')) {
        return new Response(JSON.stringify({ items: tokenIds.map((tokenId) => ({ id: tokenId.toString() })), next_page_params: null }));
      }
      activeMetadata += 1;
      maxActiveMetadata = Math.max(maxActiveMetadata, activeMetadata);
      await new Promise((resolve) => setTimeout(resolve, 2));
      activeMetadata -= 1;
      return new Response(JSON.stringify({ name: `Looper #${String(url).match(/(\d+)\.json$/)?.[1]}`, attributes: [] }));
    },
  });

  assert.equal(agents.length, tokenIds.length);
  assert.ok(maxActiveMetadata > 1);
  assert.ok(maxActiveMetadata <= 8);
});

test('owned Looper scan refuses silent empty success when balance and scan disagree', async () => {
  await assert.rejects(
    loadOwnedLooperAgents({
      address: WALLET,
      publicClients: [createOwnershipClient({ incomplete: true })],
      fetchImpl: async () => new Response('{}'),
    }),
    /ownership scan incomplete/i,
  );
});

test('GET /api/loopers/owned returns wallet-owned Looper agent cards', async () => {
  const api = createMultipassApi({
    store: createMemoryStore(),
    consoleAuthStore: { validateSession: () => ({ wallet: WALLET.toLowerCase() }) },
    loopersOwnedAgentLoader: async ({ address }) => {
      assert.equal(address, WALLET.toLowerCase());
      return [
        {
          tokenId: '617',
          name: 'Looper #617',
          canonicalName: 'Looper #617',
          owner: WALLET.toLowerCase(),
          image: 'https://helixa.xyz/loopers/images/617.png',
          role: 'Trader / Broker',
          verified: true,
          traits: {
            Class: 'Trader / Broker',
            'Secondary Class': 'Seer / Signal Hunter',
            Specialization: 'market making',
            Risk: 'Hazardous',
            Autonomy: 'Extreme',
          },
        },
      ];
    },
  });

  const response = await api.handleRequest(new Request('https://helixa.test/api/loopers/owned', { headers: AUTH_COOKIE }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.schema_version, '0.1.0');
  assert.equal(body.collection, 'loopers');
  assert.equal(body.owner, WALLET.toLowerCase());
  assert.equal(body.agents.length, 1);
  assert.equal(body.agents[0].tokenId, '617');
  assert.equal(body.agents[0].name, 'Looper #617');
  assert.equal(body.agents[0].role, 'Trader / Broker');
  assert.equal(body.agents[0].traits.Specialization, 'market making');
});

test('GET /api/loopers/owned returns every agent when the wallet owns more than ten', async () => {
  const expected = Array.from({ length: 24 }, (_, index) => ({
    tokenId: String(index + 1),
    name: `Looper #${index + 1}`,
    owner: WALLET.toLowerCase(),
    verified: true,
  }));
  const api = createMultipassApi({
    store: createMemoryStore(),
    consoleAuthStore: { validateSession: () => ({ wallet: WALLET.toLowerCase() }) },
    loopersOwnedAgentLoader: async () => expected,
  });

  const response = await api.handleRequest(new Request('https://helixa.test/api/loopers/owned', { headers: AUTH_COOKIE }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.agents.length, 24);
  assert.deepEqual(body.agents.map((agent) => agent.tokenId), expected.map((agent) => agent.tokenId));
});

test('GET /api/loopers/owned rejects caller-supplied addresses without an authenticated session', async () => {
  let credCalls = 0;
  const api = createMultipassApi({
    store: createMemoryStore(),
    loopersOwnedAgentLoader: async () => {
      throw new Error('loader should not be called');
    },
    looperCredClient: { async getCred() { credCalls += 1; } },
  });

  const response = await api.handleRequest(new Request(`https://helixa.test/api/loopers/owned?address=${WALLET}`));
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'unauthorized');
  assert.equal(credCalls, 0);
});

test('GET /api/loopers/owned enriches only the authorized resolved roster with canonical CRED', async () => {
  const events = [];
  const api = createMultipassApi({
    store: createMemoryStore(),
    consoleAuthStore: { validateSession: () => ({ wallet: WALLET.toLowerCase() }) },
    loopersOwnedAgentLoader: async ({ address }) => {
      events.push(`authorized:${address}`);
      return [{
        tokenId: '614',
        erc8004AgentId: '87043',
        chainId: 8453,
        owner: address,
        credScore: 65,
        credLabel: 'Cred 65',
      }];
    },
    looperCredClient: {
      async getCred(subject) {
        events.push(`cred:${subject.agentId}:${subject.looperTokenId}`);
        return {
          score: 40,
          tier: 'MARGINAL',
          coverage: { score: 45, label: 'PARTIAL', present: ['binding', 'metadata'], missing: ['continuity', 'erc6551Activity', 'erc8004Reputation', 'verifiedReceipts'] },
          freshness: { status: 'fresh', stale: false, cached: false, ageSeconds: 0, maxAgeSeconds: 300, staleIfErrorSeconds: 86400 },
          methodologyVersion: 'looper-cred-v1',
          computedAt: '2026-09-26T22:00:00.000Z',
          updatedAt: '2026-09-26T22:00:00.000Z',
          status: 'available',
        };
      },
    },
  });

  const response = await api.handleRequest(new Request('https://helixa.test/api/loopers/owned', { headers: AUTH_COOKIE }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(events, [`authorized:${WALLET.toLowerCase()}`, 'cred:87043:614']);
  assert.equal(body.agents[0].cred.score, 40);
  assert.equal(body.agents[0].cred.coverage.score, 45);
  assert.equal(body.agents[0].credScore, 40);
  assert.equal(body.agents[0].credLabel, 'CRED 40 · MARGINAL');
});


test('bounded custody client reads exact finalized Transfer logs and controller evidence', async () => {
  const { readLooperTransferEvents, readLooperControllerEvidence } = await import('../src/loopers-owned-agents.js');
  const calls = [];
  const publicClient = {
    async getLogs(request) {
      calls.push({ kind: 'logs', request });
      return [{ address: request.address, blockNumber: 100n, blockHash: '0x' + 'aa'.repeat(32), transactionHash: '0x' + 'bb'.repeat(32), transactionIndex: 2, logIndex: 3, removed: false, args: { from: OTHER_WALLET, to: WALLET, tokenId: 617n } }];
    },
    async readContract(request) {
      calls.push({ kind: 'read', request });
      if (request.functionName === 'erc8004AgentIdByLooper') return 87069n;
      if (request.functionName === 'isController') return true;
      throw new Error('unexpected read');
    },
  };
  const transfers = await readLooperTransferEvents({ publicClient, tokenId: '617', fromBlock: 90, toBlock: 100 });
  assert.deepEqual(transfers, [{ blockNumber: 100, blockHash: '0x' + 'aa'.repeat(32), transactionHash: '0x' + 'bb'.repeat(32), transactionIndex: 2, logIndex: 3, from: OTHER_WALLET, to: WALLET, tokenId: '617' }]);
  const controller = await readLooperControllerEvidence({ publicClient, tokenId: '617', controller: WALLET, blockNumber: 100 });
  assert.deepEqual(controller, { tokenId: '617', erc8004AgentId: '87069', controller: WALLET, verified: true, blockNumber: 100 });
  assert.equal(calls[0].request.fromBlock, 90n);
  assert.equal(calls[0].request.toBlock, 100n);
  assert.equal(calls[1].request.blockNumber, 100n);
  assert.equal(calls[2].request.blockNumber, 100n);
});

test('bounded custody client rejects removed, malformed, wrong-token, excessive and unverified evidence', async () => {
  const { readLooperTransferEvents, readLooperControllerEvidence } = await import('../src/loopers-owned-agents.js');
  const baseLog = { address: '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a', blockNumber: 100n, blockHash: '0x' + 'aa'.repeat(32), transactionHash: '0x' + 'bb'.repeat(32), transactionIndex: 0, logIndex: 0, removed: false, args: { from: OTHER_WALLET, to: WALLET, tokenId: 617n } };
  for (const log of [{ ...baseLog, removed: true }, { ...baseLog, args: { ...baseLog.args, tokenId: 618n } }, { ...baseLog, blockHash: null }]) {
    await assert.rejects(readLooperTransferEvents({ publicClient: { getLogs: async () => [log] }, tokenId: '617', fromBlock: 1, toBlock: 100 }), /transfer evidence/i);
  }
  await assert.rejects(readLooperTransferEvents({ publicClient: { getLogs: async () => Array.from({ length: 1001 }, () => baseLog) }, tokenId: '617', fromBlock: 1, toBlock: 100, cap: 1000 }), /cap/i);
  let oversizedCalls = 0;
  await assert.rejects(readLooperTransferEvents({ publicClient: { getLogs: async () => { oversizedCalls += 1; return []; } }, tokenId: '617', fromBlock: 1, toBlock: 2_001 }), /block span|range/i);
  assert.equal(oversizedCalls, 0);
  await assert.rejects(readLooperControllerEvidence({ publicClient: { readContract: async ({ functionName }) => functionName === 'erc8004AgentIdByLooper' ? 87069n : false }, tokenId: '617', controller: WALLET, blockNumber: 100 }), /not verified/i);
});


test('POST /api/loopers/swarm-launch/preview recomputes an authenticated preparation-only manifest', async () => {
  const canonicalCred = (score, tier = 'QUALIFIED') => ({ status: 'available', score, tier, coverage: { score: 80, label: 'STRONG' }, freshness: { stale: false }, methodologyVersion: 'looper-cred-v1', computedAt: '2026-10-19T00:00:00.000Z' });
  const agents = [['1', 'Bendr', '18531', 74], ['57', 'Cheryl', '57', 66], ['74', 'Axiom', '74', 79]].map(([tokenId, name, erc8004AgentId, score]) => ({ tokenId, name, erc8004AgentId, chainId: 8453, contract: '0x1649CD37f4748807b4882FC48765bA0B2aFfa94a', owner: WALLET.toLowerCase(), controllerVerified: true, cred: canonicalCred(score, score >= 76 ? 'PRIME' : 'QUALIFIED') }));
  const api = createMultipassApi({ store: createMemoryStore(), consoleAuthStore: { validateSession: ({ csrfToken, requireCsrf }) => { assert.equal(requireCsrf, true); assert.equal(csrfToken, 'preview-csrf'); return { wallet: WALLET.toLowerCase() }; } }, loopersOwnedAgentLoader: async ({ address }) => { assert.equal(address, WALLET.toLowerCase()); return agents; } });
  const body = { members: [{ tokenId: '1', role: 'Lead', contributionBps: 4000 }, { tokenId: '57', role: 'Builder', contributionBps: 3500 }, { tokenId: '74', role: 'Operator', contributionBps: 2500 }], app: { name: 'Signal Swarm', pitch: 'Ship analytics.', template: 'web_app', revenueModel: 'subscription', shipTarget: '30_days' }, token: { name: 'Signal Swarm', ticker: 'SIGSWARM', supply: '1000000000', curve: 'bonding_curve_to_dex' } };
  const response = await api.handleRequest(new Request('https://helixa.test/api/loopers/swarm-launch/preview', { method: 'POST', headers: { ...AUTH_COOKIE, 'x-csrf-token': 'preview-csrf', 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const json = await response.json();
  assert.equal(response.status, 200);
  assert.equal(json.status, 'PREPARATION_ONLY');
  assert.match(json.manifest_sha256, /^0x[0-9a-f]{64}$/u);
  assert.equal(json.manifest.members[0].name, 'Bendr');
  assert.equal(json.manifest.execution.deploymentAuthorized, false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});


test('swarm launch consent routes require Console auth and dispatch exact proposal operations', async () => {
  const calls = [];
  const proposal = { proposalId: 'proposal-1', status: 'COLLECTING_CONSENT', deploymentAuthorized: false, manifestSha256: '0x' + 'a'.repeat(64), manifest: { execution: { deploymentAuthorized: false } }, participants: [], createdAt: 1, expiresAt: 2 };
  const service = {
    async createProposal(value) { calls.push(['create', value]); return proposal; },
    async readProposal(value) { calls.push(['read', value]); return proposal; },
    async readChallenge(value) { calls.push(['challenge', value]); return { proposalId: 'proposal-1', message: 'sign me', manifestSha256: proposal.manifestSha256, expiresAt: 2 }; },
    async recordConsent(value) { calls.push(['consent', value]); return { ...proposal, status: 'SIGNATURES_COLLECTED' }; },
    async createReadinessPacket(value) { calls.push(['readiness', value]); return { packet: { execution: { mode: 'SIMULATION_ONLY', deploymentAuthorized: false } }, packetSha256: '0x' + 'b'.repeat(64) }; },
  };
  const api = createMultipassApi({
    store: createMemoryStore(), swarmLaunchConsentService: service,
    consoleAuthStore: { validateSession: ({ csrfToken, requireCsrf }) => { if (requireCsrf) assert.equal(csrfToken, 'consent-csrf'); return { wallet: WALLET.toLowerCase() }; } },
  });
  const headers = { ...AUTH_COOKIE, 'x-csrf-token': 'consent-csrf', 'content-type': 'application/json' };
  const created = await api.handleRequest(new Request('https://helixa.test/api/loopers/swarm-launch/consents', { method: 'POST', headers, body: JSON.stringify({ members: [] }) }));
  const read = await api.handleRequest(new Request('https://helixa.test/api/loopers/swarm-launch/consents/proposal-1', { headers: AUTH_COOKIE }));
  const challenge = await api.handleRequest(new Request('https://helixa.test/api/loopers/swarm-launch/consents/proposal-1/challenge', { method: 'POST', headers, body: '{}' }));
  const consent = await api.handleRequest(new Request('https://helixa.test/api/loopers/swarm-launch/consents/proposal-1/sign', { method: 'POST', headers, body: JSON.stringify({ signature: '0x' + 'aa'.repeat(65) }) }));
  const readiness = await api.handleRequest(new Request('https://helixa.test/api/loopers/swarm-launch/consents/proposal-1/readiness', { method: 'POST', headers, body: '{}' }));
  assert.deepEqual([created.status, read.status, challenge.status, consent.status, readiness.status], [201, 200, 200, 200, 200]);
  assert.deepEqual(calls.map(([name]) => name), ['create', 'read', 'challenge', 'consent', 'readiness']);
  assert.equal(calls[0][1].actorAddress, WALLET.toLowerCase());
  assert.deepEqual(calls[0][1].input, { members: [] });
  assert.equal(calls[3][1].signature, '0x' + 'aa'.repeat(65));
  assert.equal((await consent.json()).proposal.deploymentAuthorized, false);
  const readinessJson = await readiness.json();
  assert.equal(readinessJson.readiness.packet.execution.deploymentAuthorized, false);
  assert.match(readinessJson.readiness.packetSha256, /^0x[0-9a-f]{64}$/u);
});
