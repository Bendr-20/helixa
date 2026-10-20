import assert from 'node:assert/strict';
import test from 'node:test';

import { BrowserProvider, ContractFactory, Wallet } from 'ethers';
import ganache from 'ganache';

import { compileSwarmLaunchContracts } from '../scripts/compile-swarm-launch.js';
import {
  attachSwarmLaunchExecutionSignatures,
  buildSwarmLaunchExecutionReadiness,
} from '../scripts/swarm-launch-execution-manifest.js';

const READINESS_HASH = '0x' + 'ab'.repeat(32);
const FACTORY = '0x1000000000000000000000000000000000000001';
const TOKEN = '0x2000000000000000000000000000000000000002';
const PAYEES = [
  '0x3000000000000000000000000000000000000003',
  '0x4000000000000000000000000000000000000004',
  '0x5000000000000000000000000000000000000005',
];

function fixture(signers) {
  return {
    readinessHash: READINESS_HASH,
    token: TOKEN,
    start: 1_900_000_000,
    cliff: 15_552_000,
    duration: 46_656_000,
    authorizationDeadline: 1_899_913_600,
    deploymentSalt: '0x' + 'cd'.repeat(32),
    contributions: [
      { agentKey: '0x' + '01'.repeat(32), beneficiary: PAYEES[0], bps: 4000 },
      { agentKey: '0x' + '02'.repeat(32), beneficiary: PAYEES[1], bps: 3500 },
      { agentKey: '0x' + '03'.repeat(32), beneficiary: PAYEES[2], bps: 2500 },
    ],
    vestingAmounts: ['1800000000000000000000', '1575000000000000000000', '1125000000000000000000'],
    revenueShares: [
      { payee: PAYEES[0], bps: 8000 },
      { payee: PAYEES[1], bps: 1000 },
      { payee: PAYEES[2], bps: 1000 },
    ],
    revenueAssets: ['0x0000000000000000000000000000000000000000', TOKEN],
    requiredSigners: signers,
  };
}

test('builds a deterministic no-broadcast manifest bound to exact CREATE2 targets', async () => {
  const wallets = [new Wallet('0x' + '11'.repeat(32)), new Wallet('0x' + '22'.repeat(32))]
    .sort((left, right) => left.address.toLowerCase().localeCompare(right.address.toLowerCase()));
  const artifacts = await compileSwarmLaunchContracts();
  const input = { chainId: 8453, factoryAddress: FACTORY, readinessPacketSha256: READINESS_HASH, plan: fixture(wallets.map((wallet) => wallet.address)), artifacts };
  const first = buildSwarmLaunchExecutionReadiness(input);
  const second = buildSwarmLaunchExecutionReadiness(input);

  assert.equal(first.manifestSha256, second.manifestSha256);
  assert.equal(first.manifest.schema, 'multipass.swarm-launch-execution-readiness.v1');
  assert.equal(first.manifest.execution.mode, 'SIGNATURE_COLLECTION_ONLY');
  assert.equal(first.manifest.execution.deploymentAuthorized, false);
  assert.equal(first.manifest.execution.broadcastPrepared, false);
  assert.equal(first.manifest.authorization.status, 'AWAITING_SIGNATURES');
  assert.match(first.manifest.deployment.deploymentId, /^0x[0-9a-f]{64}$/u);
  assert.equal(new Set([first.manifest.deployment.registry, first.manifest.deployment.splitter, ...first.manifest.deployment.streams]).size, 5);
  assert.deepEqual(first.manifest.deployment.streams.length, 3);
  assert.deepEqual(first.typedData.message, { deploymentId: first.manifest.deployment.deploymentId, authorizationDeadline: 1_899_913_600 });
});

test('matches the deployed factory deployment ID, authorization digest, and CREATE2 predictions', async () => {
  const artifacts = await compileSwarmLaunchContracts();
  const provider = new BrowserProvider(ganache.provider({ chain: { chainId: 8453 }, logging: { quiet: true } }));
  const signer = await provider.getSigner();
  const factory = await new ContractFactory(artifacts.contracts.SwarmLaunchFactory.abi, artifacts.contracts.SwarmLaunchFactory.bytecode, signer).deploy();
  await factory.waitForDeployment();
  const wallets = [new Wallet('0x' + '11'.repeat(32)), new Wallet('0x' + '22'.repeat(32))]
    .sort((left, right) => left.address.toLowerCase().localeCompare(right.address.toLowerCase()));
  const plan = fixture(wallets.map((wallet) => wallet.address));
  plan.token = await factory.getAddress();
  const prepared = buildSwarmLaunchExecutionReadiness({ chainId: 8453, factoryAddress: await factory.getAddress(), readinessPacketSha256: READINESS_HASH, plan, artifacts });

  assert.equal((await factory.computeDeploymentId(plan)).toLowerCase(), prepared.manifest.deployment.deploymentId);
  assert.equal((await factory.authorizationDigest(prepared.manifest.deployment.deploymentId, plan.authorizationDeadline)).toLowerCase(), prepared.manifest.authorization.digest);
  const predicted = await factory.predict(plan);
  assert.equal(predicted[0].toLowerCase(), prepared.manifest.deployment.registry);
  assert.equal(predicted[1].toLowerCase(), prepared.manifest.deployment.splitter);
  assert.deepEqual(predicted[2].map((entry) => entry.toLowerCase()), prepared.manifest.deployment.streams);
});

test('marks deployment authorized only after every exact EIP-712 signature verifies', async () => {
  const wallets = [new Wallet('0x' + '11'.repeat(32)), new Wallet('0x' + '22'.repeat(32))]
    .sort((left, right) => left.address.toLowerCase().localeCompare(right.address.toLowerCase()));
  const artifacts = await compileSwarmLaunchContracts();
  const prepared = buildSwarmLaunchExecutionReadiness({ chainId: 8453, factoryAddress: FACTORY, readinessPacketSha256: READINESS_HASH, plan: fixture(wallets.map((wallet) => wallet.address)), artifacts });
  const signatures = [];
  for (const wallet of wallets) signatures.push({ signer: wallet.address, signature: await wallet.signTypedData(prepared.typedData.domain, prepared.typedData.types, prepared.typedData.message) });
  const signed = await attachSwarmLaunchExecutionSignatures(prepared, signatures);

  assert.equal(signed.manifest.authorization.status, 'SIGNATURES_VERIFIED');
  assert.equal(signed.manifest.execution.mode, 'AUTHORIZED_NO_BROADCAST');
  assert.equal(signed.manifest.execution.deploymentAuthorized, true);
  assert.equal(signed.manifest.execution.broadcastPrepared, false);
  assert.equal(signed.manifest.authorization.signatures.length, 2);
  assert.notEqual(signed.manifestSha256, prepared.manifestSha256);

  await assert.rejects(
    attachSwarmLaunchExecutionSignatures(prepared, [signatures[0], { ...signatures[1], signature: signatures[0].signature }]),
    /signature/i,
  );
});
