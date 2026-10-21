import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { Interface, Wallet } from 'ethers';

import { canonicalSwarmLaunchJson } from '../../types/src/swarm-launch.js';
import { compileSwarmLaunchContracts } from '../scripts/compile-swarm-launch.js';
import { attachSwarmLaunchExecutionSignatures, buildSwarmLaunchExecutionReadiness } from '../scripts/swarm-launch-execution-manifest.js';
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

test('rejects closed-schema violations even when the attacker recomputes the outer hash', async () => {
  const mutatedManifest = { ...packet.manifest, transactionData: '0xdeadbeef' };
  const mutated = {
    ...packet,
    manifest: mutatedManifest,
    manifestSha256: '0x' + (await import('node:crypto')).createHash('sha256')
      .update((await import('../../types/src/swarm-launch.js')).canonicalSwarmLaunchJson(mutatedManifest)).digest('hex'),
  };
  await assert.rejects(verifySwarmLaunchPacket(mutated, { artifacts }), /unknown|schema|transaction|canonical/i);
});

test('rejects recomputed mutations across lineage, summaries, EIP-712, and safety states', async () => {
  const rehash = (value) => {
    const next = structuredClone(value);
    next.manifestSha256 = '0x' + createHash('sha256').update(canonicalSwarmLaunchJson(next.manifest)).digest('hex');
    return next;
  };
  const attacks = [];
  let next = structuredClone(packet); next.manifest.sourceReadiness.sha256 = '0x' + '12'.repeat(32); attacks.push(rehash(next));
  next = structuredClone(packet); next.manifest.deployment.categoryAmounts.agentVesting = '1'; attacks.push(rehash(next));
  next = structuredClone(packet); next.manifest.plan.start += 1; attacks.push(rehash(next));
  next = structuredClone(packet); next.manifest.factory = '0x2000000000000000000000000000000000000002'; attacks.push(rehash(next));
  next = structuredClone(packet); next.manifest.authorization.digest = '0x' + '34'.repeat(32); attacks.push(rehash(next));
  next = structuredClone(packet); next.manifest.execution.deploymentAuthorized = true; attacks.push(rehash(next));
  next = structuredClone(packet); next.manifest.execution.mode = 'AUTHORIZED_NO_BROADCAST'; attacks.push(rehash(next));
  next = structuredClone(packet); next.manifest.safety.keysIncluded = true; attacks.push(rehash(next));
  next = structuredClone(packet); next.typedData.domain.chainId = 1; attacks.push(next);
  next = structuredClone(packet); next.typedData.message.authorizationDeadline += 1; attacks.push(next);
  next = structuredClone(packet); next.typedData.types.SwarmLaunchExecution[0].type = 'uint256'; attacks.push(next);
  for (const attack of attacks) await assert.rejects(verifySwarmLaunchPacket(attack, { artifacts }), /hash|lineage|canonical|schema|state|readiness|conversion/i);
});

test('accepts only the exact EOA-authorized and ERC-1271-unverified state combinations', async () => {
  const erc1271 = await attachSwarmLaunchExecutionSignatures(packet, packet.manifest.authorization.requiredSigners.map((signer) => ({ signer, signature: '0x01', kind: 'ERC1271' })));
  assert.equal((await verifySwarmLaunchPacket(erc1271, { artifacts })).status, 'VERIFIED_OFFLINE');
  assert.equal(erc1271.manifest.execution.deploymentAuthorized, false);

  const wallets = [new Wallet('0x' + '11'.repeat(32)), new Wallet('0x' + '22'.repeat(32)), new Wallet('0x' + '33'.repeat(32))].sort((a, b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()));
  const dynamic = structuredClone(fixture);
  dynamic.readinessManifest.agentVesting.allocations.forEach((entry, index) => { entry.consentAuthority = wallets[index].address.toLowerCase(); });
  dynamic.consentManifest.members.forEach((entry, index) => { entry.consentAuthority = wallets[index].address.toLowerCase(); });
  dynamic.readinessManifest.sourceConsent.manifestSha256 = '0x' + createHash('sha256').update(canonicalSwarmLaunchJson(dynamic.consentManifest)).digest('hex');
  dynamic.readinessPacketSha256 = '0x' + createHash('sha256').update(canonicalSwarmLaunchJson(dynamic.readinessManifest)).digest('hex');
  dynamic.conversion.parentReadinessSha256 = dynamic.readinessPacketSha256;
  const prepared = buildSwarmLaunchExecutionReadiness({ ...dynamic, artifacts });
  const signatures = [];
  for (const wallet of wallets) signatures.push({ signer: wallet.address, signature: await wallet.signTypedData(prepared.typedData.domain, prepared.typedData.types, prepared.typedData.message) });
  const authorized = await attachSwarmLaunchExecutionSignatures(prepared, signatures);
  assert.equal((await verifySwarmLaunchPacket(authorized, { artifacts })).status, 'VERIFIED_OFFLINE');
  assert.equal(authorized.manifest.execution.deploymentAuthorized, true);
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
