import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { Interface } from 'ethers';

import { compileSwarmLaunchContracts } from '../scripts/compile-swarm-launch.js';
import { buildSwarmLaunchExecutionReadiness } from '../scripts/swarm-launch-execution-manifest.js';
import { verifySwarmLaunchPacket } from '../scripts/verify-swarm-launch-packet.js';

const fixture = JSON.parse(await readFile(new URL('../fixtures/swarm-launch/base-mainnet-preparation-input.json', import.meta.url)));
const artifacts = await compileSwarmLaunchContracts();
const packet = buildSwarmLaunchExecutionReadiness({ ...fixture, artifacts });

test('verifies canonical hashes, deterministic predictions, and EIP-170/EIP-3860 sizes offline', async () => {
  const report = await verifySwarmLaunchPacket(packet, { artifacts });
  assert.equal(report.status, 'VERIFIED_OFFLINE');
  assert.equal(report.chainId, 8453);
  assert.equal(report.packetHashVerified, true);
  assert.equal(report.deploymentIdVerified, true);
  assert.equal(report.create2Verified, true);
  assert.equal(report.bytecodeVerified, true);
  assert.equal(report.sizes.every((entry) => entry.runtimeBytes <= 24_576 && entry.initcodeBytes <= 49_152), true);
  assert.deepEqual(report.rpc, { status: 'NOT_REQUESTED', methods: [] });
});

test('uses only read-only RPC methods and matches onchain view simulation', async () => {
  const methods = [];
  const iface = new Interface(artifacts.contracts.SwarmLaunchFactory.abi);
  const fetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body);
    methods.push(request.method);
    let result;
    if (request.method === 'eth_chainId') result = '0x2105';
    else if (request.method === 'eth_getCode') result = '0x6000';
    else if (request.method === 'eth_call') {
      const selector = request.params[0].data.slice(0, 10);
      if (selector === iface.getFunction('computeDeploymentId').selector) {
        result = iface.encodeFunctionResult('computeDeploymentId', [packet.manifest.deployment.deploymentId]);
      } else if (selector === iface.getFunction('predict').selector) {
        result = iface.encodeFunctionResult('predict', [
          packet.manifest.deployment.token,
          packet.manifest.deployment.registry,
          packet.manifest.deployment.splitter,
          packet.manifest.deployment.streams,
        ]);
      } else throw new Error('unexpected eth_call selector');
    } else throw new Error('unsafe method ' + request.method);
    return { ok: true, json: async () => ({ jsonrpc: '2.0', id: request.id, result }) };
  };

  const report = await verifySwarmLaunchPacket(packet, { artifacts, rpcUrl: 'https://readonly.invalid', fetchImpl });
  assert.equal(report.status, 'VERIFIED_READ_ONLY');
  assert.deepEqual(methods, ['eth_chainId', 'eth_getCode', 'eth_call', 'eth_call']);
  assert.equal(methods.some((method) => /send|sign|submit/iu.test(method)), false);
  assert.equal(report.rpc.onchainParity, true);
});

test('reports RPC unavailability precisely and rejects packet tampering', async () => {
  const unavailable = await verifySwarmLaunchPacket(packet, {
    artifacts,
    rpcUrl: 'https://unavailable.invalid',
    fetchImpl: async () => { throw new Error('network unreachable'); },
  });
  assert.equal(unavailable.status, 'RPC_UNAVAILABLE');
  assert.match(unavailable.rpc.error, /network unreachable/iu);
  await assert.rejects(
    verifySwarmLaunchPacket({ ...packet, manifestSha256: '0x' + '00'.repeat(32) }, { artifacts }),
    /hash/iu,
  );
});
