import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { ethers } from 'ethers';
import ganache from 'ganache';

import { simulateMissionDeployment } from '../scripts/simulate-mission-deployment.js';

test('chain-84532 local simulation is deterministic, artifact-locked, and does not claim live Safe readiness', async () => {
  const first = await simulateMissionDeployment();
  const second = await simulateMissionDeployment();
  const committed = JSON.parse(await readFile(new URL('../../../review-artifacts/looper-missions/external-proof/base-sepolia-simulation.json', import.meta.url), 'utf8'));

  const serialized = JSON.stringify(first);
  assert.equal(JSON.stringify(second), serialized);
  assert.equal(JSON.stringify(committed), serialized);
  assert.equal(first.schemaVersion, 1);
  assert.equal(first.status, 'local_simulation_passed_live_inputs_blocked');
  assert.equal(first.executionEnvironment, 'in-memory-ganache');
  assert.equal(first.externalBroadcast, false);
  assert.equal(first.liveTransactionPlan, null);
  assert.equal(first.liveReadiness.status, 'blocked');
  assert.ok(first.liveReadiness.reasons.includes('production Safe not verified'));
  assert.equal(first.network, 'base-sepolia');
  assert.equal(first.chainId, 84532);
  assert.equal(first.compilerVersion, '0.8.24');
  assert.match(first.sourceHash, /^[0-9a-f]{64}$/u);

  assert.equal(first.authority.kind, 'local-fixture-2-of-2-not-safe');
  assert.equal(first.authority.threshold, 2);
  assert.equal(first.authority.owners.length, 2);
  assert.notEqual(first.authority.address, first.emergencyCouncil);
  assert.equal(first.registry.governance, first.authority.address);
  assert.equal(first.registry.emergencyCouncil, first.emergencyCouncil);
  assert.equal(first.registry.minimumDelaySeconds, 86_400);
  assert.equal(first.factory.registry, first.registry.address);
  assert.equal(first.factory.compatibility, 1);

  assert.equal(first.tokens.length, 2);
  assert.deepEqual(first.tokens.map(({ symbol }) => symbol), ['mUSDC', 'mCRED']);
  assert.ok(first.tokens.every(({ address, runtimeCodeHash, onchainVerified }) => ethers.isAddress(address) && /^0x[0-9a-f]{64}$/u.test(runtimeCodeHash) && onchainVerified === true));
  assert.notEqual(first.tokens[0].address, first.tokens[1].address);

  assert.equal(first.version.status, 'active');
  assert.deepEqual(first.version.supportedTokens, first.tokens.map(({ address }) => address));
  assert.equal(first.version.factoryCompatibility, 1);
  assert.equal(first.version.creationCodeHash, first.vault.creationCodeHash);
  assert.equal(first.version.runtimeCodeHash, first.vault.runtimeCodeHash);
  assert.equal(first.vault.deployedRuntimeCodeHash, first.vault.runtimeCodeHash);
  assert.equal(first.vault.runtimeVerified, true);
  assert.equal(first.timelock.earlyActivationRejected, true);

  assert.ok(first.simulationTransactions.length >= 13);
  assert.ok(first.simulationTransactions.every((entry) => entry.externalBroadcast === false && entry.chainId === 84532 && entry.scope === 'local-simulation-trace' && entry.value === '0'));
  assert.ok(first.simulationTransactions.some(({ operation }) => operation === 'registry.activateVersion.early-rejected'));
  assert.ok(first.simulationTransactions.some(({ operation }) => operation === 'registry.activateVersion'));
  assert.ok(first.simulationTransactions.every((entry) => !Object.hasOwn(entry, 'signature') && !Object.hasOwn(entry, 'privateKey')));

  assert.deepEqual(first.externalRequirements, [
    'approved Base Sepolia RPC endpoints',
    'approved production Safe address and owner threshold',
    'approved emergency council address',
    'approved deployer address and fresh nonce',
    'approved Base Sepolia token addresses or mock-token deployment choice',
    'separate explicit broadcast approval',
  ]);
});

test('mission compiler includes the exact mintable testnet token used by the live plan', async () => {
  const compiled = await import('../scripts/compile-mission-escrow.js').then(({ compileMissionContracts }) => compileMissionContracts());
  const token = compiled.contracts.MissionTestToken;
  assert.ok(token.bytecode.startsWith('0x60'));
  assert.ok(token.deployedBytecode.length > 2);
  assert.deepEqual(
    token.abi.filter(({ type }) => type === 'function').map(({ name }) => name).sort(),
    ['allowance', 'approve', 'balanceOf', 'decimals', 'issuer', 'mint', 'name', 'symbol', 'totalSupply', 'transfer', 'transferFrom'].sort(),
  );
});

test('isolated testnet token mints only by issuer and supports exact escrow transferFrom behavior', async () => {
  const compiled = await import('../scripts/compile-mission-escrow.js').then(({ compileMissionContracts }) => compileMissionContracts());
  const node = ganache.provider({ logging: { quiet: true }, wallet: { deterministic: true, totalAccounts: 4 } });
  const provider = new ethers.BrowserProvider(node);
  try {
    const [issuer, owner, spender, recipient] = await Promise.all([0, 1, 2, 3].map((index) => provider.getSigner(index)));
    const token = await new ethers.ContractFactory(compiled.contracts.MissionTestToken.abi, compiled.contracts.MissionTestToken.bytecode, issuer)
      .deploy('Swarm Test USDC', 'mUSDC', 6, issuer.address);
    await token.waitForDeployment();
    await assert.rejects(token.connect(owner).mint(owner.address, 100n));
    await (await token.mint(owner.address, 100n)).wait();
    await (await token.connect(owner).approve(spender.address, 40n)).wait();
    await (await token.connect(spender).transferFrom(owner.address, recipient.address, 40n)).wait();
    assert.equal(await token.balanceOf(owner.address), 60n);
    assert.equal(await token.balanceOf(recipient.address), 40n);
    assert.equal(await token.allowance(owner.address, spender.address), 0n);
  } finally {
    await node.disconnect();
  }
});
