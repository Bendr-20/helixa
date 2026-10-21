import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { BrowserProvider, ContractFactory, Wallet } from 'ethers';
import ganache from 'ganache';

import { canonicalSwarmLaunchJson } from '../../types/src/swarm-launch.js';
import { compileSwarmLaunchContracts } from '../scripts/compile-swarm-launch.js';
import { attachSwarmLaunchExecutionSignatures, buildSwarmLaunchExecutionReadiness } from '../scripts/swarm-launch-execution-manifest.js';

const FACTORY = '0x1000000000000000000000000000000000000001';
const artifactsPromise = compileSwarmLaunchContracts();
const baseFixture = JSON.parse(await readFile(new URL('../fixtures/swarm-launch/base-mainnet-preparation-input.json', import.meta.url)));
const hash = (value) => '0x' + createHash('sha256').update(canonicalSwarmLaunchJson(value)).digest('hex');

function wallets() {
  return [new Wallet('0x' + '11'.repeat(32)), new Wallet('0x' + '22'.repeat(32)), new Wallet('0x' + '33'.repeat(32))]
    .sort((left, right) => left.address.toLowerCase().localeCompare(right.address.toLowerCase()));
}
function fixture(signers) {
  const value = structuredClone(baseFixture);
  value.readinessManifest.agentVesting.allocations.forEach((entry, index) => { entry.consentAuthority = signers[index].toLowerCase(); });
  value.consentManifest.members.forEach((entry, index) => { entry.consentAuthority = signers[index].toLowerCase(); });
  value.readinessManifest.sourceConsent.manifestSha256 = hash(value.consentManifest);
  value.readinessPacketSha256 = hash(value.readinessManifest);
  value.conversion.parentReadinessSha256 = value.readinessPacketSha256;
  return value;
}
function input(signers, artifacts, factoryAddress = FACTORY) { return { ...fixture(signers), factoryAddress, artifacts }; }

test('builds deterministic canonical Base preparation from readiness v1 lineage', async () => {
  const signers = wallets(); const artifacts = await artifactsPromise;
  const first = buildSwarmLaunchExecutionReadiness(input(signers.map((wallet) => wallet.address), artifacts));
  const second = buildSwarmLaunchExecutionReadiness(input(signers.map((wallet) => wallet.address), artifacts));
  assert.equal(first.manifestSha256, second.manifestSha256);
  assert.equal(first.manifest.sourceReadiness.schema, 'multipass.swarm-launch-readiness.v1');
  assert.equal(first.manifest.conversion.schema, 'multipass.swarm-launch-execution-conversion.v1');
  assert.equal(first.manifest.execution.mode, 'PREPARATION_ONLY');
  assert.equal(first.manifest.execution.deploymentAuthorized, false);
  assert.equal(first.manifest.execution.broadcastPrepared, false);
  assert.equal(first.manifest.execution.transactionCount, 0);
  assert.equal(first.manifest.authorization.status, 'NOT_ATTACHED');
  assert.deepEqual(first.manifest.authorization.signatures, []);
  assert.deepEqual(first.manifest.safety, { keysIncluded: false, signaturesIncluded: false, transactionDataIncluded: false, calldataIncluded: false, secretsIncluded: false, externalAdapterDataIncluded: false, rpcSendMethodsAllowed: false });
  assert.equal(first.manifest.plan.authorizationDeadline, baseFixture.readinessManifest.sourceConsent.expiresAt);
  assert.equal(first.manifest.plan.start, baseFixture.readinessManifest.sourceConsent.expiresAt + 604800);
  assert.equal(first.manifest.plan.cliff, 6 * 2592000);
  assert.equal(first.manifest.plan.duration, 18 * 2592000);
  assert.equal(first.manifest.deployment.totalSupply, '100000000000000000000000000');
  assert.equal(JSON.stringify(first).match(/privateKey|secretKey|0xdeadbeef/iu), null);
});

test('fails closed on unknown fields, lineage drift, timing drift, and non-direct mechanisms', async () => {
  const base = input(wallets().map((wallet) => wallet.address), await artifactsPromise);
  assert.throws(() => buildSwarmLaunchExecutionReadiness({ ...base, conversion: { ...base.conversion, unknown: true } }), /unknown/i);
  assert.throws(() => buildSwarmLaunchExecutionReadiness({ ...base, conversion: { ...base.conversion, timing: { ...base.conversion.timing, start: base.conversion.timing.start + 1 } } }), /timing/i);
  assert.throws(() => buildSwarmLaunchExecutionReadiness({ ...base, conversion: { ...base.conversion, parentReadinessSha256: '0x' + 'ab'.repeat(32) } }), /parent|lineage/i);
  for (const field of ['credRewards', 'swarmTreasury', 'publicDistribution']) {
    assert.throws(() => buildSwarmLaunchExecutionReadiness({ ...base, conversion: { ...base.conversion, recipients: { ...base.conversion.recipients, [field]: { ...base.conversion.recipients[field], mechanism: 'OTHER' } } } }), /DIRECT_FIXED_RECIPIENT|mechanism/i);
  }
  const driftedConsent = structuredClone(base.consentManifest); driftedConsent.members[0].contributionBps += 1;
  const readinessManifest = structuredClone(base.readinessManifest); readinessManifest.sourceConsent.manifestSha256 = hash(driftedConsent);
  const readinessPacketSha256 = hash(readinessManifest);
  assert.throws(() => buildSwarmLaunchExecutionReadiness({ ...base, consentManifest: driftedConsent, readinessManifest, readinessPacketSha256, conversion: { ...base.conversion, parentReadinessSha256: readinessPacketSha256 } }), /lineage/i);
});

test('normalizes Console millisecond consent expiry into reviewed onchain seconds', async () => {
  const base = input(wallets().map((wallet) => wallet.address), await artifactsPromise);
  base.readinessManifest.sourceConsent.expiresAt = 1_899_913_600_000;
  base.readinessPacketSha256 = hash(base.readinessManifest);
  base.conversion.parentReadinessSha256 = base.readinessPacketSha256;
  base.conversion.timing.authorizationDeadline = 1_899_913_600;
  base.conversion.timing.start = 1_900_518_400;
  const prepared = buildSwarmLaunchExecutionReadiness(base);
  assert.equal(prepared.manifest.plan.authorizationDeadline, 1_899_913_600);
  assert.equal(prepared.manifest.plan.start, 1_900_518_400);
});

test('matches onchain deployment ID, digest, and CREATE2 predictions', async () => {
  const artifacts = await artifactsPromise;
  const provider = new BrowserProvider(ganache.provider({ chain: { chainId: 8453 }, logging: { quiet: true } }));
  const signer = await provider.getSigner();
  const factory = await new ContractFactory(artifacts.contracts.SwarmLaunchFactory.abi, artifacts.contracts.SwarmLaunchFactory.bytecode, signer).deploy();
  await factory.waitForDeployment();
  const prepared = buildSwarmLaunchExecutionReadiness(input(wallets().map((wallet) => wallet.address), artifacts, await factory.getAddress()));
  assert.equal((await factory.computeDeploymentId(prepared.manifest.plan)).toLowerCase(), prepared.manifest.deployment.deploymentId);
  assert.equal((await factory.authorizationDigest(prepared.manifest.deployment.deploymentId, prepared.manifest.plan.authorizationDeadline)).toLowerCase(), prepared.manifest.authorization.digest);
  const predicted = await factory.predict(prepared.manifest.plan);
  assert.deepEqual([predicted.token.toLowerCase(), predicted.registry.toLowerCase(), predicted.splitter.toLowerCase(), predicted.streams.map((entry) => entry.toLowerCase())], [prepared.manifest.deployment.token, prepared.manifest.deployment.registry, prepared.manifest.deployment.splitter, prepared.manifest.deployment.streams]);
});

test('pure EOA attachment verifies recovery and never prepares broadcast', async () => {
  const signers = wallets(); const prepared = buildSwarmLaunchExecutionReadiness(input(signers.map((wallet) => wallet.address), await artifactsPromise));
  const before = JSON.stringify(prepared); const signatures = [];
  for (const wallet of signers) signatures.push({ signer: wallet.address, signature: await wallet.signTypedData(prepared.typedData.domain, prepared.typedData.types, prepared.typedData.message) });
  const signed = await attachSwarmLaunchExecutionSignatures(prepared, signatures);
  assert.equal(JSON.stringify(prepared), before);
  assert.equal(signed.manifest.authorization.status, 'SIGNATURES_VERIFIED_EOA_OFFLINE');
  assert.equal(signed.manifest.execution.mode, 'AUTHORIZED_NO_BROADCAST');
  assert.equal(signed.manifest.execution.deploymentAuthorized, true);
  assert.equal(signed.manifest.execution.broadcastPrepared, false);
  await assert.rejects(attachSwarmLaunchExecutionSignatures(prepared, [signatures[0], signatures[1], { ...signatures[2], signature: signatures[0].signature }]), /signature/i);
});

test('rejects a malleated high-s EOA signature', async () => {
  const signers = wallets(); const prepared = buildSwarmLaunchExecutionReadiness(input(signers.map((wallet) => wallet.address), await artifactsPromise));
  const signatures = [];
  for (const wallet of signers) signatures.push({ signer: wallet.address, signature: await wallet.signTypedData(prepared.typedData.domain, prepared.typedData.types, prepared.typedData.message) });
  const original = signatures[0].signature;
  const s = BigInt('0x' + original.slice(66, 130));
  const highS = (0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n - s).toString(16).padStart(64, '0');
  const v = original.slice(130, 132).toLowerCase() === '1b' ? '1c' : '1b';
  signatures[0] = { ...signatures[0], signature: original.slice(0, 66) + highS + v };
  await assert.rejects(attachSwarmLaunchExecutionSignatures(prepared, signatures), /non-canonical|signature/i);
});

test('rejects callbacks and keeps ERC-1271 attachments explicitly unverified', async () => {
  const prepared = buildSwarmLaunchExecutionReadiness(input(wallets().map((wallet) => wallet.address), await artifactsPromise));
  const forged = prepared.manifest.authorization.requiredSigners.map((signer) => ({ signer, signature: '0x1234' }));
  await assert.rejects(attachSwarmLaunchExecutionSignatures(prepared, forged, { verifySignature: async () => true }), /callback|unsupported/i);
  const attached = await attachSwarmLaunchExecutionSignatures(prepared, forged.map((entry) => ({ ...entry, kind: 'ERC1271' })));
  assert.equal(attached.manifest.authorization.status, 'SIGNATURES_ATTACHED_UNVERIFIED');
  assert.equal(attached.manifest.execution.mode, 'SIGNATURES_ATTACHED_NO_BROADCAST');
  assert.equal(attached.manifest.execution.deploymentAuthorized, false);
});
