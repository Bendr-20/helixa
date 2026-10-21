import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { BrowserProvider, ContractFactory, Wallet } from 'ethers';
import ganache from 'ganache';

import { compileSwarmLaunchContracts } from '../scripts/compile-swarm-launch.js';
import { canonicalSwarmLaunchJson } from '../../types/src/swarm-launch.js';
import {
  attachSwarmLaunchExecutionSignatures,
  buildSwarmLaunchExecutionReadiness,
} from '../scripts/swarm-launch-execution-manifest.js';

const FACTORY = '0x1000000000000000000000000000000000000001';
const RECIPIENTS = [2, 3, 4, 5, 6, 7].map((value) => '0x' + value.toString(16).padStart(40, '0'));
const artifactsPromise = compileSwarmLaunchContracts();

function fixture(signers) {
  const token = { name: 'Swarm Signal', symbol: 'SIG', decimals: 18, totalSupply: '10003' };
  const allocations = {
    agentVestingBps: 4500,
    credRewardsBps: 1500,
    swarmTreasuryBps: 1500,
    publicDistributionBps: 2500,
    agentVestingAmount: '4501',
    credRewardsAmount: '1500',
    swarmTreasuryAmount: '1500',
    publicDistributionAmount: '2502',
    credRewardsRecipient: RECIPIENTS[3],
    swarmTreasuryRecipient: RECIPIENTS[4],
    publicDistributionRecipient: RECIPIENTS[5],
  };
  const contributions = [
    { agentKey: '0x' + '01'.repeat(32), beneficiary: RECIPIENTS[0], bps: 3333 },
    { agentKey: '0x' + '02'.repeat(32), beneficiary: RECIPIENTS[1], bps: 3333 },
    { agentKey: '0x' + '03'.repeat(32), beneficiary: RECIPIENTS[2], bps: 3334 },
  ];
  const readinessManifest = {
    schema: 'multipass.swarm-launch-execution-plan.v1',
    chainId: 8453,
    token,
    allocations,
    members: contributions.map((entry, index) => ({
      agentKey: entry.agentKey,
      beneficiary: entry.beneficiary,
      contributionBps: entry.bps,
      consentAuthority: signers[index],
    })),
    credRewards: { mechanism: 'DIRECT_FIXED_RECIPIENT', recipient: allocations.credRewardsRecipient },
    swarmTreasury: { mechanism: 'DIRECT_FIXED_RECIPIENT', recipient: allocations.swarmTreasuryRecipient },
    publicDistribution: { mechanism: 'DIRECT_FIXED_RECIPIENT', recipient: allocations.publicDistributionRecipient },
  };
  const readinessHash = '0x' + createHash('sha256').update(canonicalSwarmLaunchJson(readinessManifest)).digest('hex');
  const plan = {
    readinessHash,
    start: 1_900_000_000,
    cliff: 15_552_000,
    duration: 46_656_000,
    authorizationDeadline: 1_899_913_600,
    deploymentSalt: '0x' + 'cd'.repeat(32),
    token,
    allocations,
    contributions,
    vestingAmounts: ['1500', '1500', '1501'],
    revenueShares: [
      { payee: RECIPIENTS[0], bps: 5000 },
      { payee: RECIPIENTS[1], bps: 3000 },
      { payee: RECIPIENTS[2], bps: 2000 },
    ],
    revenueAssets: ['0x0000000000000000000000000000000000000000'],
    requiredSigners: signers,
  };
  return { plan, readinessManifest, readinessHash };
}

function input(signers, artifacts, factoryAddress = FACTORY) {
  const { plan, readinessManifest, readinessHash } = fixture(signers);
  return {
    chainId: 8453,
    factoryAddress,
    readinessPacketSha256: readinessHash,
    readinessManifest,
    plan,
    artifacts,
  };
}

function wallets() {
  return [new Wallet('0x' + '11'.repeat(32)), new Wallet('0x' + '22'.repeat(32)), new Wallet('0x' + '33'.repeat(32))]
    .sort((left, right) => left.address.toLowerCase().localeCompare(right.address.toLowerCase()));
}

test('builds a deterministic canonical Base packet that is preparation-only and secret-free', async () => {
  const signers = wallets();
  const artifacts = await artifactsPromise;
  const first = buildSwarmLaunchExecutionReadiness(input(signers.map((wallet) => wallet.address), artifacts));
  const second = buildSwarmLaunchExecutionReadiness(input(signers.map((wallet) => wallet.address), artifacts));

  assert.equal(first.manifestSha256, second.manifestSha256);
  assert.equal(first.manifest.schema, 'multipass.swarm-token-launch-packet.v1');
  assert.equal(first.manifest.chainId, 8453);
  assert.equal(first.manifest.execution.mode, 'PREPARATION_ONLY');
  assert.equal(first.manifest.execution.deploymentAuthorized, false);
  assert.equal(first.manifest.execution.broadcastPrepared, false);
  assert.equal(first.manifest.execution.transactionCount, 0);
  assert.equal(first.manifest.authorization.status, 'NOT_ATTACHED');
  assert.deepEqual(first.manifest.authorization.signatures, []);
  assert.equal(first.manifest.safety.keysIncluded, false);
  assert.equal(first.manifest.safety.externalAdapterDataIncluded, false);
  assert.equal(JSON.stringify(first).match(/privateKey|secretKey/iu), null);
  assert.equal(first.manifest.deployment.totalSupply, '10003');
  assert.deepEqual(first.manifest.deployment.categoryAmounts, {
    agentVesting: '4501', credRewards: '1500', swarmTreasury: '1500', publicDistribution: '2502',
  });
  assert.equal(first.manifest.deployment.streams.length, 3);
});

test('fails closed when readiness terms differ or any recipient mechanism is unselected', async () => {
  const signers = wallets().map((wallet) => wallet.address);
  const artifacts = await artifactsPromise;
  const base = input(signers, artifacts);
  assert.throws(
    () => buildSwarmLaunchExecutionReadiness({
      ...base,
      plan: { ...base.plan, allocations: { ...base.plan.allocations, agentVestingBps: 4499 } },
    }),
    /readiness|allocation/i,
  );
  for (const field of ['credRewards', 'swarmTreasury', 'publicDistribution']) {
    assert.throws(
      () => buildSwarmLaunchExecutionReadiness({
        ...base,
        readinessManifest: {
          ...base.readinessManifest,
          [field]: { ...base.readinessManifest[field], mechanism: 'UNSELECTED' },
        },
      }),
      /UNSELECTED|mechanism|readiness/i,
    );
  }
  assert.throws(
    () => buildSwarmLaunchExecutionReadiness({
      ...base,
      readinessManifest: {
        ...base.readinessManifest,
        credRewards: { ...base.readinessManifest.credRewards, mechanism: 'OTHER_SELECTED_MECHANISM' },
      },
    }),
    /hash|readiness/i,
  );
  assert.throws(() => buildSwarmLaunchExecutionReadiness({ ...base, chainId: 1 }), /8453|Base/i);
});

test('matches onchain deployment ID, digest, token, and CREATE2 predictions cross-language', async () => {
  const artifacts = await artifactsPromise;
  const provider = new BrowserProvider(ganache.provider({ chain: { chainId: 8453 }, logging: { quiet: true } }));
  const signer = await provider.getSigner();
  const factory = await new ContractFactory(
    artifacts.contracts.SwarmLaunchFactory.abi,
    artifacts.contracts.SwarmLaunchFactory.bytecode,
    signer,
  ).deploy();
  await factory.waitForDeployment();
  const signers = wallets().map((wallet) => wallet.address);
  const prepared = buildSwarmLaunchExecutionReadiness(input(signers, artifacts, await factory.getAddress()));

  assert.equal((await factory.computeDeploymentId(prepared.manifest.plan)).toLowerCase(), prepared.manifest.deployment.deploymentId);
  assert.equal(
    (await factory.authorizationDigest(prepared.manifest.deployment.deploymentId, prepared.manifest.plan.authorizationDeadline)).toLowerCase(),
    prepared.manifest.authorization.digest,
  );
  const predicted = await factory.predict(prepared.manifest.plan);
  assert.equal(predicted.token.toLowerCase(), prepared.manifest.deployment.token);
  assert.equal(predicted.registry.toLowerCase(), prepared.manifest.deployment.registry);
  assert.equal(predicted.splitter.toLowerCase(), prepared.manifest.deployment.splitter);
  assert.deepEqual(predicted.streams.map((entry) => entry.toLowerCase()), prepared.manifest.deployment.streams);
});

test('offline attachment remains pure, unanimous, and never prepares broadcast', async () => {
  const signers = wallets();
  const artifacts = await artifactsPromise;
  const prepared = buildSwarmLaunchExecutionReadiness(input(signers.map((wallet) => wallet.address), artifacts));
  const before = JSON.stringify(prepared);
  const signatures = [];
  for (const wallet of signers) {
    signatures.push({
      signer: wallet.address,
      signature: await wallet.signTypedData(prepared.typedData.domain, prepared.typedData.types, prepared.typedData.message),
    });
  }
  const signed = await attachSwarmLaunchExecutionSignatures(prepared, signatures);

  assert.equal(JSON.stringify(prepared), before);
  assert.equal(signed.manifest.authorization.status, 'SIGNATURES_VERIFIED_OFFLINE');
  assert.equal(signed.manifest.execution.mode, 'AUTHORIZED_NO_BROADCAST');
  assert.equal(signed.manifest.execution.deploymentAuthorized, true);
  assert.equal(signed.manifest.execution.broadcastPrepared, false);
  assert.equal(signed.manifest.execution.transactionCount, 0);
  await assert.rejects(
    attachSwarmLaunchExecutionSignatures(prepared, [signatures[0], signatures[1], { ...signatures[2], signature: signatures[0].signature }]),
    /signature/i,
  );
});
