import assert from 'node:assert/strict';
import test from 'node:test';

import { BrowserProvider, Contract, ContractFactory, Wallet } from 'ethers';
import ganache from 'ganache';
import solc from 'solc';

import { compileSwarmLaunchContracts } from '../scripts/compile-swarm-launch.js';

const READINESS_HASH = '0x' + 'ab'.repeat(32);
const RECIPIENTS = [
  '0x1000000000000000000000000000000000000001',
  '0x2000000000000000000000000000000000000002',
  '0x3000000000000000000000000000000000000003',
  '0x4000000000000000000000000000000000000004',
  '0x5000000000000000000000000000000000000005',
  '0x6000000000000000000000000000000000000006',
];

function fixture(signers, timestamp) {
  return {
    readinessHash: READINESS_HASH,
    start: timestamp + 86_400,
    cliff: 15_552_000,
    duration: 46_656_000,
    authorizationDeadline: timestamp + 3_600,
    deploymentSalt: '0x' + 'cd'.repeat(32),
    token: { name: 'Swarm Signal', symbol: 'SIG', decimals: 18, totalSupply: '10003' },
    allocations: {
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
    },
    contributions: [
      { agentKey: '0x' + '01'.repeat(32), beneficiary: RECIPIENTS[0], bps: 3333 },
      { agentKey: '0x' + '02'.repeat(32), beneficiary: RECIPIENTS[1], bps: 3333 },
      { agentKey: '0x' + '03'.repeat(32), beneficiary: RECIPIENTS[2], bps: 3334 },
    ],
    vestingAmounts: ['1500', '1500', '1501'],
    revenueShares: [
      { payee: RECIPIENTS[0], bps: 5000 },
      { payee: RECIPIENTS[1], bps: 3000 },
      { payee: RECIPIENTS[2], bps: 2000 },
    ],
    revenueAssets: ['0x0000000000000000000000000000000000000000'],
    requiredSigners: signers,
  };
}

async function harness() {
  const artifacts = await compileSwarmLaunchContracts();
  const provider = new BrowserProvider(ganache.provider({ chain: { chainId: 8453 }, logging: { quiet: true } }));
  const deployer = await provider.getSigner();
  const factory = await new ContractFactory(
    artifacts.contracts.SwarmLaunchFactory.abi,
    artifacts.contracts.SwarmLaunchFactory.bytecode,
    deployer,
  ).deploy();
  await factory.waitForDeployment();
  const wallets = [1, 2, 3].map((value) => new Wallet('0x' + value.toString(16).padStart(2, '0').repeat(32)))
    .sort((left, right) => left.address.toLowerCase().localeCompare(right.address.toLowerCase()));
  const block = await provider.getBlock('latest');
  const plan = fixture(wallets.map((wallet) => wallet.address), Number(block.timestamp));
  const deploymentId = await factory.computeDeploymentId(plan);
  const digest = await factory.authorizationDigest(deploymentId, plan.authorizationDeadline);
  const signatures = [];
  for (const wallet of wallets) signatures.push(wallet.signingKey.sign(digest).serialized);
  return { artifacts, provider, factory, plan, deploymentId, signatures };
}

test('creates the predicted fixed-supply token and atomically allocates every unit', async () => {
  const { artifacts, provider, factory, plan, deploymentId, signatures } = await harness();
  const predicted = await factory.predict(plan);
  assert.match(predicted.token, /^0x[0-9a-fA-F]{40}$/u);

  await (await factory.deploy(plan, signatures)).wait();
  assert.equal((await factory.tokenOf(deploymentId)).toLowerCase(), predicted.token.toLowerCase());
  const token = new Contract(predicted.token, artifacts.contracts.FixedSupplySwarmToken.abi, provider);
  assert.equal(await token.name(), plan.token.name);
  assert.equal(await token.symbol(), plan.token.symbol);
  assert.equal(await token.decimals(), 18n);
  assert.equal(await token.totalSupply(), 10_003n);
  assert.equal(await token.readinessHash(), READINESS_HASH);
  assert.equal(await token.deploymentId(), deploymentId);

  assert.deepEqual(
    await Promise.all(predicted.streams.map((stream) => token.balanceOf(stream))),
    [1500n, 1500n, 1501n],
  );
  assert.equal(await token.balanceOf(plan.allocations.credRewardsRecipient), 1500n);
  assert.equal(await token.balanceOf(plan.allocations.swarmTreasuryRecipient), 1500n);
  assert.equal(await token.balanceOf(plan.allocations.publicDistributionRecipient), 2502n);
  assert.equal(await token.balanceOf(await factory.getAddress()), 0n);
  assert.equal(
    (await Promise.all([
      ...predicted.streams.map((stream) => token.balanceOf(stream)),
      token.balanceOf(plan.allocations.credRewardsRecipient),
      token.balanceOf(plan.allocations.swarmTreasuryRecipient),
      token.balanceOf(plan.allocations.publicDistributionRecipient),
    ])).reduce((sum, amount) => sum + amount, 0n),
    10_003n,
  );

  await assert.rejects(factory.deploy(plan, signatures), /revert|AlreadyDeployed/i);
});

test('binds every token and allocation field into deployment ID and rejects unsafe plans', async () => {
  const { factory, plan } = await harness();
  const baseline = await factory.computeDeploymentId(plan);
  const mutations = [
    { ...plan, token: { ...plan.token, name: 'Other' } },
    { ...plan, token: { ...plan.token, symbol: 'OTH' } },
    { ...plan, token: { ...plan.token, totalSupply: '10004' } },
    { ...plan, allocations: { ...plan.allocations, credRewardsRecipient: RECIPIENTS[0] } },
    { ...plan, allocations: { ...plan.allocations, publicDistributionAmount: '2501' } },
    { ...plan, vestingAmounts: ['1499', '1500', '1502'] },
  ];
  for (const mutation of mutations) assert.notEqual(await factory.computeDeploymentId(mutation), baseline);

  const duplicatedRecipient = {
    ...plan,
    allocations: { ...plan.allocations, swarmTreasuryRecipient: plan.allocations.credRewardsRecipient },
  };
  await assert.rejects(factory.predict(duplicatedRecipient), /revert|InvalidPlan/i);
  await assert.rejects(factory.predict({ ...plan, requiredSigners: [] }), /revert|InvalidPlan/i);
  await assert.rejects(factory.predict({ ...plan, requiredSigners: [plan.requiredSigners[0], plan.requiredSigners[0]] }), /revert|InvalidPlan/i);
  await assert.rejects(factory.predict({ ...plan, allocations: { ...plan.allocations, publicDistributionAmount: '2501' } }), /revert|InvalidPlan/i);
});

test('rejects a high-s malleated EOA authorization onchain', async () => {
  const { factory, plan, signatures } = await harness();
  const original = signatures[0];
  const signatureS = BigInt('0x' + original.slice(66, 130));
  const highS = (0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n - signatureS).toString(16).padStart(64, '0');
  const v = original.slice(130, 132).toLowerCase() === '1b' ? '1c' : '1b';
  signatures[0] = original.slice(0, 66) + highS + v;
  await assert.rejects(factory.deploy(plan, signatures), /revert|InvalidAuthorization/i);
});

test('malicious ERC-1271 callbacks cannot reenter factory deployment', async () => {
  const artifacts = await compileSwarmLaunchContracts();
  const provider = new BrowserProvider(ganache.provider({ chain: { chainId: 8453 }, logging: { quiet: true } }));
  const deployer = await provider.getSigner();
  const factory = await new ContractFactory(artifacts.contracts.SwarmLaunchFactory.abi, artifacts.contracts.SwarmLaunchFactory.bytecode, deployer).deploy();
  await factory.waitForDeployment();
  const helper = compileReentrant1271();
  const wallets = [];
  for (let index = 0; index < 3; index += 1) { const wallet = await new ContractFactory(helper.abi, helper.bytecode, deployer).deploy(); await wallet.waitForDeployment(); wallets.push(wallet); }
  wallets.sort((left, right) => left.target.toLowerCase().localeCompare(right.target.toLowerCase()));
  const block = await provider.getBlock('latest');
  const plan = fixture(wallets.map((wallet) => wallet.target), Number(block.timestamp));
  const reentry = factory.interface.encodeFunctionData('deploy', [plan, []]);
  for (const wallet of wallets) await (await wallet.configure(factory.target, reentry)).wait();
  const deploymentId = await factory.computeDeploymentId(plan);
  await (await factory.deploy(plan, ['0x01', '0x01', '0x01'])).wait();
  assert.notEqual(await factory.tokenOf(deploymentId), '0x0000000000000000000000000000000000000000');
});

test('refuses factory creation outside Base chain ID 8453', async () => {
  const artifacts = await compileSwarmLaunchContracts();
  const provider = new BrowserProvider(ganache.provider({ chain: { chainId: 1 }, logging: { quiet: true } }));
  const signer = await provider.getSigner();
  const factory = new ContractFactory(artifacts.contracts.SwarmLaunchFactory.abi, artifacts.contracts.SwarmLaunchFactory.bytecode, signer);
  await assert.rejects(factory.deploy(), /revert|WrongChain/i);
});

function compileReentrant1271() {
  const source = 'pragma solidity 0.8.24; contract Reentrant1271 { address target; bytes payload; function configure(address t, bytes calldata p) external { target=t; payload=p; } function isValidSignature(bytes32, bytes calldata) external returns(bytes4) { (bool ok,)=target.call(payload); return ok ? bytes4(0) : bytes4(0x1626ba7e); } }';
  const input = { language: 'Solidity', sources: { 'Reentrant1271.sol': { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors?.filter((entry) => entry.severity === 'error') ?? [];
  if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join('\n'));
  const contract = output.contracts['Reentrant1271.sol'].Reentrant1271;
  return { abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object };
}
