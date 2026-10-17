import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ethers } from 'ethers';
import ganache from 'ganache';
import solc from 'solc';

import { compileMissionContracts } from '../scripts/compile-mission-escrow.js';

let missionArtifacts;
let tokenArtifacts;

async function compileTokens() {
  if (tokenArtifacts) return tokenArtifacts;
  const source = await readFile(new URL('./fixtures/MissionEscrowTokens.sol', import.meta.url), 'utf8');
  const input = { language: 'Solidity', sources: { 'MissionEscrowTokens.sol': { content: source } }, settings: {
    optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', metadata: { bytecodeHash: 'none', appendCBOR: false },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
  } };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = output.errors?.filter((entry) => entry.severity === 'error') ?? [];
  assert.deepEqual(errors, []);
  const artifact = (name) => { const value = output.contracts['MissionEscrowTokens.sol'][name]; return { abi: value.abi, bytecode: '0x' + value.evm.bytecode.object, deployedBytecode: '0x' + value.evm.deployedBytecode.object }; };
  tokenArtifacts = { token: artifact('MissionTestToken'), fee: artifact('MissionFeeToken'), callback: artifact('MissionCallbackToken') };
  return tokenArtifacts;
}

async function setup() {
  missionArtifacts ??= await compileMissionContracts();
  const tokenBuild = await compileTokens();
  const node = ganache.provider({ chain: { chainId: 8453, hardfork: 'shanghai' }, logging: { quiet: true }, wallet: { totalAccounts: 12, defaultBalance: 1000 } });
  const provider = new ethers.BrowserProvider(node);
  const wallets = Object.values(node.getInitialAccounts()).map((entry) => new ethers.Wallet(entry.secretKey, provider));
  const actors = wallets.map((wallet) => new ethers.NonceManager(wallet));
  const deployer = actors[0];
  const deploy = async (artifact, args = []) => { const contract = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer).deploy(...args); await contract.waitForDeployment(); return contract; };
  const deployToken = (name = 'Token', symbol = 'TOK') => deploy(tokenBuild.token, [name, symbol]);
  return { node, provider, wallets, actors, deployer, deploy, deployToken, tokenBuild, escrowArtifact: missionArtifacts.contracts.MissionEscrowV1 };
}

function allocations(tokens, recipient, amounts) {
  return tokens.map((token, index) => ({ token: token.target, recipient, amount: amounts[index] }));
}

async function deployEscrow(ctx, tokens, amounts, overrides = {}) {
  const latest = await ctx.provider.getBlock('latest');
  const owner = overrides.owner ?? ctx.wallets[1].address;
  const refund = overrides.refund ?? ctx.wallets[2].address;
  const lead = overrides.lead ?? ctx.wallets[3].address;
  const arbitrator = overrides.arbitrator ?? ctx.wallets[4].address;
  const fundingDeadline = overrides.fundingDeadline ?? Number(latest.timestamp) + 100;
  const launchDeadline = overrides.launchDeadline ?? fundingDeadline + 100;
  const members = [{ chainId: 8453, collection: ctx.wallets[8].address, tokenId: 42, canonicalAccount: ctx.wallets[9].address,
    controller: ctx.wallets[5].address, custodyEpoch: 1, settlementAddress: ctx.wallets[6].address, roleHash: ethers.id('lead'), isLead: true }];
  const payouts = allocations(tokens, ctx.wallets[6].address, amounts);
  const timeouts = allocations(tokens, refund, amounts);
  const milestones = [{ milestoneId: ethers.id('m1'), acceptanceHash: ethers.id('accept'), payoutCommitment: ethers.id('payout'),
    deliveryDeadline: launchDeadline + 100, reviewDeadline: launchDeadline + 200, disputeDeadline: launchDeadline + 300,
    payouts, deliveryTimeoutAllocations: timeouts, disputeTimeoutAllocations: timeouts }];
  const args = [ethers.id(overrides.mission ?? 'mission'), ethers.id('version'), owner, refund, lead, arbitrator,
    fundingDeadline, launchDeadline, members, milestones];
  const escrow = await ctx.deploy(ctx.escrowArtifact, args);
  return { escrow, owner, refund, lead, arbitrator, fundingDeadline, launchDeadline, members, milestones, args };
}

async function mintAndApprove(token, owner, escrow, amount) {
  await (await token.mint(await owner.getAddress(), amount)).wait();
  await (await token.connect(owner).approve(escrow.target, amount)).wait();
}

async function reverted(transactionPromise) {
  const transaction = await transactionPromise;
  await assert.rejects(transaction.wait());
}

test('compiler emits a deployable immutable vault with no admin or arbitrary-call surface', async () => {
  missionArtifacts ??= await compileMissionContracts();
  const artifact = missionArtifacts.contracts.MissionEscrowV1;
  assert.ok(artifact);
  assert.ok((artifact.deployedBytecode.length - 2) / 2 < 24_576);
  const names = artifact.abi.filter((entry) => entry.type === 'function').map((entry) => entry.name);
  for (const required of ['fund', 'approveLaunch', 'refundIncompleteFunding', 'refundUnlaunched', 'recoverExcess', 'requiredAmount', 'remainingLiability']) assert.ok(names.includes(required));
  for (const forbidden of ['upgradeTo', 'delegatecall', 'execute', 'withdraw', 'sweep', 'setRecipient', 'setAllocation']) assert.ok(!names.some((name) => name.toLowerCase().includes(forbidden.toLowerCase())));
});

test('derives exact one/two-asset requirements and accepts only owner funding by exact balance delta', async () => {
  const ctx = await setup();
  const tokenA = await ctx.deployToken('Token A', 'A');
  const tokenB = await ctx.deployToken('Token B', 'B');
  const one = await deployEscrow(ctx, [tokenA], [100n], { mission: 'one' });
  assert.equal(await one.escrow.assetCount(), 1n);
  assert.equal(await one.escrow.requiredAmount(tokenA.target), 100n);
  const two = await deployEscrow(ctx, [tokenA, tokenB], [100n, 250n], { mission: 'two' });
  assert.equal(await two.escrow.assetCount(), 2n);
  assert.equal(await two.escrow.requiredAmount(tokenB.target), 250n);

  await mintAndApprove(tokenA, ctx.actors[1], two.escrow, 100n);
  await reverted(two.escrow.connect(ctx.actors[7]).fund(tokenA.target, 1n, { gasLimit: 500_000 }));
  await (await two.escrow.connect(ctx.actors[1]).fund(tokenA.target, 40n, { gasLimit: 500_000 })).wait();
  assert.equal(await two.escrow.totalFunded(tokenA.target), 40n);
  assert.equal(await two.escrow.remainingLiability(tokenA.target), 40n);
  assert.equal(await tokenA.balanceOf(two.escrow.target), 40n);
});

test('funds a native-asset mission only with an exact owner-supplied value', async () => {
  const ctx = await setup();
  const native = { target: ethers.ZeroAddress };
  const terms = await deployEscrow(ctx, [native], [100n], { mission: 'native' });
  await reverted(terms.escrow.connect(ctx.actors[7]).fund(ethers.ZeroAddress, 100n, { value: 100n, gasLimit: 500_000 }));
  await reverted(terms.escrow.connect(ctx.actors[1]).fund(ethers.ZeroAddress, 100n, { value: 99n, gasLimit: 500_000 }));
  await (await terms.escrow.connect(ctx.actors[1]).fund(ethers.ZeroAddress, 100n, { value: 100n, gasLimit: 500_000 })).wait();
  assert.equal(await terms.escrow.totalFunded(ethers.ZeroAddress), 100n);
  assert.equal(await ctx.provider.getBalance(terms.escrow.target), 100n);
});

test('rejects overfunding and fee-on-transfer without recording liabilities', async () => {
  const ctx = await setup();
  const token = await ctx.deployToken();
  const exact = await deployEscrow(ctx, [token], [100n], { mission: 'exact' });
  await mintAndApprove(token, ctx.actors[1], exact.escrow, 200n);
  await (await exact.escrow.connect(ctx.actors[1]).fund(token.target, 40n, { gasLimit: 500_000 })).wait();
  await reverted(exact.escrow.connect(ctx.actors[1]).fund(token.target, 61n, { gasLimit: 500_000 }));
  assert.equal(await exact.escrow.totalFunded(token.target), 40n);

  const fee = await ctx.deploy(ctx.tokenBuild.fee);
  const feeEscrow = await deployEscrow(ctx, [fee], [100n], { mission: 'fee' });
  await mintAndApprove(fee, ctx.actors[1], feeEscrow.escrow, 100n);
  await reverted(feeEscrow.escrow.connect(ctx.actors[1]).fund(fee.target, 100n, { gasLimit: 500_000 }));
  assert.equal(await feeEscrow.escrow.totalFunded(fee.target), 0n);
  assert.equal(await fee.balanceOf(feeEscrow.escrow.target), 0n);
  assert.equal(await fee.balanceOf(ctx.wallets[1].address), 100n);
});

test('blocks malicious token callbacks and refunds partial funding after the deadline effects-first', async () => {
  const ctx = await setup();
  const token = await ctx.deploy(ctx.tokenBuild.callback);
  const terms = await deployEscrow(ctx, [token], [100n], { mission: 'callback' });
  await mintAndApprove(token, ctx.actors[1], terms.escrow, 100n);
  const attack = terms.escrow.interface.encodeFunctionData('recoverExcess', [token.target]);
  await (await token.setCallback(terms.escrow.target, attack)).wait();
  await (await terms.escrow.connect(ctx.actors[1]).fund(token.target, 40n, { gasLimit: 700_000 })).wait();
  assert.equal(await token.callbackAttempted(), true);
  assert.equal(await token.callbackSucceeded(), false);
  assert.equal(await terms.escrow.remainingLiability(token.target), 40n);

  await ctx.provider.send('evm_increaseTime', [101]); await ctx.provider.send('evm_mine', []);
  await (await terms.escrow.connect(ctx.actors[10]).refundIncompleteFunding({ gasLimit: 700_000 })).wait();
  assert.equal(await terms.escrow.state(), 2n);
  assert.equal(await terms.escrow.remainingLiability(token.target), 0n);
  assert.equal(await terms.escrow.totalRefunded(token.target), 40n);
  assert.equal(await token.balanceOf(terms.refund), 40n);
  assert.equal(await token.callbackSucceeded(), false);
});

test('recovers only unsolicited excess and always sends it to the immutable refund address', async () => {
  const ctx = await setup();
  const token = await ctx.deployToken();
  const terms = await deployEscrow(ctx, [token], [100n], { mission: 'excess' });
  await mintAndApprove(token, ctx.actors[1], terms.escrow, 100n);
  await (await terms.escrow.connect(ctx.actors[1]).fund(token.target, 100n, { gasLimit: 500_000 })).wait();
  await (await token.mint(ctx.wallets[7].address, 25n)).wait();
  await (await token.connect(ctx.actors[7]).transfer(terms.escrow.target, 25n)).wait();
  await (await terms.escrow.connect(ctx.actors[8]).recoverExcess(token.target, { gasLimit: 500_000 })).wait();
  assert.equal(await token.balanceOf(terms.refund), 25n);
  assert.equal(await token.balanceOf(terms.escrow.target), 100n);
  assert.equal(await terms.escrow.remainingLiability(token.target), 100n);
});

test('requires dual launch approval in either order and refunds fully funded but unlaunched vaults', async () => {
  const ctx = await setup();
  const token = await ctx.deployToken();
  const launched = await deployEscrow(ctx, [token], [100n], { mission: 'launched' });
  await reverted(launched.escrow.connect(ctx.actors[1]).approveLaunch({ gasLimit: 500_000 }));
  await mintAndApprove(token, ctx.actors[1], launched.escrow, 100n);
  await (await launched.escrow.connect(ctx.actors[1]).fund(token.target, 100n, { gasLimit: 500_000 })).wait();
  await reverted(launched.escrow.connect(ctx.actors[7]).approveLaunch({ gasLimit: 500_000 }));
  await (await launched.escrow.connect(ctx.actors[3]).approveLaunch({ gasLimit: 500_000 })).wait();
  assert.equal(await launched.escrow.state(), 0n);
  await (await launched.escrow.connect(ctx.actors[1]).approveLaunch({ gasLimit: 500_000 })).wait();
  assert.equal(await launched.escrow.state(), 1n);
  await reverted(launched.escrow.connect(ctx.actors[1]).refundUnlaunched({ gasLimit: 500_000 }));

  const unlaunched = await deployEscrow(ctx, [token], [75n], { mission: 'unlaunched' });
  await mintAndApprove(token, ctx.actors[1], unlaunched.escrow, 75n);
  await (await unlaunched.escrow.connect(ctx.actors[1]).fund(token.target, 75n, { gasLimit: 500_000 })).wait();
  await (await unlaunched.escrow.connect(ctx.actors[1]).approveLaunch({ gasLimit: 500_000 })).wait();
  await ctx.provider.send('evm_increaseTime', [201]); await ctx.provider.send('evm_mine', []);
  await (await unlaunched.escrow.connect(ctx.actors[11]).refundUnlaunched({ gasLimit: 700_000 })).wait();
  assert.equal(await unlaunched.escrow.state(), 2n);
  assert.equal(await token.balanceOf(unlaunched.refund), 75n);
  assert.equal(await unlaunched.escrow.remainingLiability(token.target), 0n);
});
