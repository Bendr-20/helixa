import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { Interface, keccak256 } from 'ethers';

import {
  MISSION_BASE_SEPOLIA_RPC_ORIGINS,
  SWARM_COMMAND_BASE_SEPOLIA_DEPLOYMENT,
  validateMissionBaseSepoliaDeployment,
  verifyMissionBaseSepoliaDeployment,
} from '../scripts/verify-mission-base-sepolia-deployment.js';

const HASH = '0x' + 'ab'.repeat(32);
const SAFE_ABI = [
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function nonce() view returns (uint256)',
  'function VERSION() view returns (string)',
];
const TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function issuer() view returns (address)',
  'function totalSupply() view returns (uint256)',
];
const REGISTRY_ABI = [
  'function governance() view returns (address)',
  'function emergencyCouncil() view returns (address)',
  'function minimumDelay() view returns (uint64)',
];
const FACTORY_ABI = [
  'function registry() view returns (address)',
  'function FACTORY_COMPATIBILITY() view returns (uint32)',
];
const interfaces = {
  safe: new Interface(SAFE_ABI), token: new Interface(TOKEN_ABI),
  registry: new Interface(REGISTRY_ABI), factory: new Interface(FACTORY_ABI),
};

function response(url, body) {
  const text = JSON.stringify(body);
  return {
    ok: true, status: 200, url, redirected: false,
    headers: { get(name) { return name.toLowerCase() === 'content-type' ? 'application/json' : name.toLowerCase() === 'content-length' ? String(Buffer.byteLength(text)) : null; } },
    text: async () => text,
  };
}

function testFixture() {
  const deployment = structuredClone(SWARM_COMMAND_BASE_SEPOLIA_DEPLOYMENT);
  const targets = [deployment.authority, ...deployment.tokens, deployment.registry, deployment.factory];
  const runtimes = new Map(targets.map((target, index) => [target.address.toLowerCase(), '0x' + (index + 1).toString(16).padStart(2, '0')]));
  for (const target of targets) target.runtimeCodeHash = keccak256(runtimes.get(target.address.toLowerCase()));
  return { deployment, runtimes };
}

function makeFetch({ mutate, fixture = testFixture() } = {}) {
  const calls = [];
  const { deployment, runtimes } = fixture;
  return {
    calls,
    fetchImpl: async (url, init) => {
      const request = JSON.parse(init.body);
      calls.push({ url, request });
      const d = deployment;
      let result;
      if (request.method === 'eth_chainId') result = '0x14a34';
      else if (request.method === 'eth_blockNumber') result = '0x2e06e26';
      else if (request.method === 'eth_getBlockByNumber') result = { number: '0x2e06e26', hash: HASH };
      else if (request.method === 'eth_getStorageAt') result = '0x' + '00'.repeat(12) + d.authority.singleton.slice(2).toLowerCase();
      else if (request.method === 'eth_getCode') {
        const address = request.params[0].toLowerCase();
        result = runtimes.get(address);
      } else if (request.method === 'eth_call') {
        const call = request.params[0];
        const address = call.to.toLowerCase();
        const selector = call.data.slice(0, 10);
        if (address === d.authority.address.toLowerCase()) {
          const fn = interfaces.safe.getFunction(selector);
          const values = fn.name === 'getOwners' ? [d.authority.owners] : fn.name === 'getThreshold' ? [2n] : fn.name === 'nonce' ? [0n] : ['1.4.1'];
          result = interfaces.safe.encodeFunctionResult(fn, values);
        } else if (d.tokens.some((item) => item.address.toLowerCase() === address)) {
          const token = d.tokens.find((item) => item.address.toLowerCase() === address);
          const fn = interfaces.token.getFunction(selector);
          const value = fn.name === 'name' ? token.name : fn.name === 'symbol' ? token.symbol : fn.name === 'decimals' ? BigInt(token.decimals) : fn.name === 'issuer' ? token.issuer : 0n;
          result = interfaces.token.encodeFunctionResult(fn, [value]);
        } else if (address === d.registry.address.toLowerCase()) {
          const fn = interfaces.registry.getFunction(selector);
          const value = fn.name === 'governance' ? d.registry.governance : fn.name === 'emergencyCouncil' ? d.registry.emergencyCouncil : BigInt(d.registry.minimumDelaySeconds);
          result = interfaces.registry.encodeFunctionResult(fn, [value]);
        } else if (address === d.factory.address.toLowerCase()) {
          const fn = interfaces.factory.getFunction(selector);
          const value = fn.name === 'registry' ? d.registry.address : BigInt(d.factory.compatibility);
          result = interfaces.factory.encodeFunctionResult(fn, [value]);
        } else throw new Error('unexpected eth_call target');
      } else throw new Error('unexpected RPC method ' + request.method);
      result = mutate?.({ url, request, result }) ?? result;
      return response(url, { jsonrpc: '2.0', id: request.id, result });
    },
  };
}

test('pins the exact confirmed Swarm Command Base Sepolia deployment', async () => {
  assert.deepEqual(MISSION_BASE_SEPOLIA_RPC_ORIGINS, ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com']);
  const d = validateMissionBaseSepoliaDeployment(SWARM_COMMAND_BASE_SEPOLIA_DEPLOYMENT);
  assert.equal(d.packet.sha256, 'afeb2ff90b899b45aeba9bc94468e312b02ae09e1a498851d76348c1da823d18');
  assert.equal(d.status, 'infrastructure_deployed_governance_pending');
  assert.equal(d.missionCreationEnabled, false);
  assert.equal(d.governanceActionsBroadcast, false);
  assert.deepEqual(d.transactions.map((entry) => entry.nonce), [38, 39, 40, 41, 42]);
  assert.equal(new Set(d.transactions.map((entry) => entry.hash)).size, 5);
  const raw = JSON.parse(await readFile(new URL('../deployments/swarm-command-base-sepolia.json', import.meta.url), 'utf8'));
  assert.deepEqual(raw, d);
});

test('dual-RPC verification binds runtime and governance-pending state', async () => {
  const fixture = testFixture();
  const mock = makeFetch({ fixture });
  const status = await verifyMissionBaseSepoliaDeployment({ fetchImpl: mock.fetchImpl, now: () => 1_000_000, deployment: fixture.deployment });
  assert.equal(status.status, 'verified_governance_pending');
  assert.equal(status.missionCreationEnabled, false);
  assert.equal(status.safe.nonce, '0');
  assert.deepEqual(status.tokens.map((token) => token.totalSupply), ['0', '0']);
  assert.equal(status.rpcConsensus, true);
  assert.ok(mock.calls.every(({ url }) => MISSION_BASE_SEPOLIA_RPC_ORIGINS.includes(new URL(url).origin)));
  assert.ok(mock.calls.every(({ request }) => !/^eth_(send|sign)|personal_|wallet_/u.test(request.method)));
});

test('verification fails closed on provider, runtime, authority, and supply drift', async () => {
  const fixture = testFixture();
  const providerDrift = makeFetch({ fixture, mutate: ({ url, request, result }) => url.startsWith(MISSION_BASE_SEPOLIA_RPC_ORIGINS[1]) && request.method === 'eth_blockNumber' ? '0x2e06e20' : result });
  await assert.rejects(() => verifyMissionBaseSepoliaDeployment({ fetchImpl: providerDrift.fetchImpl, deployment: fixture.deployment }), /head|disagree/i);

  const runtimeDrift = makeFetch({ fixture, mutate: ({ request, result }) => request.method === 'eth_getCode' && request.params[0].toLowerCase() === fixture.deployment.factory.address.toLowerCase() ? '0x00' : result });
  await assert.rejects(() => verifyMissionBaseSepoliaDeployment({ fetchImpl: runtimeDrift.fetchImpl, deployment: fixture.deployment }), /runtime|factory/i);

  const nonceDrift = makeFetch({ fixture, mutate: ({ request, result }) => request.method === 'eth_call' && request.params[0].to.toLowerCase() === fixture.deployment.authority.address.toLowerCase() && interfaces.safe.getFunction(request.params[0].data.slice(0, 10)).name === 'nonce' ? interfaces.safe.encodeFunctionResult('nonce', [1n]) : result });
  await assert.rejects(() => verifyMissionBaseSepoliaDeployment({ fetchImpl: nonceDrift.fetchImpl, deployment: fixture.deployment }), /nonce|governance/i);

  const supplyDrift = makeFetch({ fixture, mutate: ({ request, result }) => request.method === 'eth_call' && fixture.deployment.tokens.some((token) => token.address.toLowerCase() === request.params[0].to.toLowerCase()) && interfaces.token.getFunction(request.params[0].data.slice(0, 10)).name === 'totalSupply' ? interfaces.token.encodeFunctionResult('totalSupply', [1n]) : result });
  await assert.rejects(() => verifyMissionBaseSepoliaDeployment({ fetchImpl: supplyDrift.fetchImpl, deployment: fixture.deployment }), /supply|mint/i);
});

test('verification rejects duplicate JSON, unbounded bodies, redirects, and wrong content types', async () => {
  const duplicateFetch = async (url, init) => {
    const { id } = JSON.parse(init.body);
    const text = '{"jsonrpc":"2.0","id":' + id + ',"result":"0x14a34","result":"0x14a34"}';
    return { ok: true, status: 200, url, redirected: false, headers: { get: (name) => name === 'content-type' ? 'application/json' : String(Buffer.byteLength(text)) }, text: async () => text };
  };
  await assert.rejects(() => verifyMissionBaseSepoliaDeployment({ fetchImpl: duplicateFetch }), /duplicate/i);

  const unboundedFetch = async (url) => ({ ok: true, status: 200, url, redirected: false, headers: { get: (name) => name === 'content-type' ? 'application/json' : null }, text: async () => '{}' });
  await assert.rejects(() => verifyMissionBaseSepoliaDeployment({ fetchImpl: unboundedFetch }), /bounded/i);

  const redirectFetch = async (url) => response(url, { jsonrpc: '2.0', id: 1, result: '0x14a34', redirected: true });
  await assert.rejects(() => verifyMissionBaseSepoliaDeployment({ fetchImpl: async (url, init) => ({ ...(await redirectFetch(url, init)), redirected: true }) }), /redirect/i);

  const htmlFetch = async (url) => ({ ok: true, status: 200, url, redirected: false, headers: { get: (name) => name === 'content-type' ? 'text/html' : '2' }, text: async () => '{}' });
  await assert.rejects(() => verifyMissionBaseSepoliaDeployment({ fetchImpl: htmlFetch }), /content type/i);
});

test('verifier exposes no signing, sending, minting, funding, or governance mutation surface', async () => {
  const source = await readFile(new URL('../scripts/verify-mission-base-sepolia-deployment.js', import.meta.url), 'utf8');
  for (const forbidden of ['eth_sendRawTransaction', 'eth_sendTransaction', 'personal_sign', 'wallet_', '.mint(', 'proposeVersion', 'activateVersion', 'execTransaction']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});


test('serializes reads per approved RPC origin to avoid public endpoint rate-limit bursts', async () => {
  const fixture = testFixture();
  const mock = makeFetch({ fixture });
  const active = new Map();
  const maximum = new Map();
  const fetchImpl = async (url, init) => {
    const origin = new URL(url).origin;
    const count = (active.get(origin) ?? 0) + 1;
    active.set(origin, count);
    maximum.set(origin, Math.max(maximum.get(origin) ?? 0, count));
    await new Promise((resolve) => setTimeout(resolve, 1));
    try { return await mock.fetchImpl(url, init); }
    finally { active.set(origin, active.get(origin) - 1); }
  };
  await verifyMissionBaseSepoliaDeployment({ fetchImpl, deployment: fixture.deployment });
  assert.deepEqual([...maximum.values()], [1, 1]);
});
