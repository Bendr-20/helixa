import assert from 'node:assert/strict';
import test from 'node:test';

import { ethers } from 'ethers';
import ganache from 'ganache';

import { compileMissionContracts } from '../scripts/compile-mission-escrow.js';

const VERSION = ethers.id('mission-escrow-v1');
const CREATE_HASH = ethers.keccak256(ethers.toUtf8Bytes('creation-code-v1'));
const RUNTIME_HASH = ethers.keccak256(ethers.toUtf8Bytes('runtime-code-v1'));
const FACTORY_COMPATIBILITY = 1;
const DELAY = 100;

let compiled;

async function fixture() {
  compiled ??= await compileMissionContracts();
  const ganacheProvider = ganache.provider({
    chain: { chainId: 1337, hardfork: 'shanghai' },
    logging: { quiet: true },
    wallet: { totalAccounts: 8, defaultBalance: 1000 },
  });
  const provider = new ethers.BrowserProvider(ganacheProvider);
  const signers = await Promise.all([...Array(8).keys()].map((index) => provider.getSigner(index)));
  const registry = await new ethers.ContractFactory(
    compiled.contracts.VersionRegistry.abi,
    compiled.contracts.VersionRegistry.bytecode,
    signers[0],
  ).deploy(signers[0].address, signers[1].address, DELAY);
  await registry.waitForDeployment();
  return { ganacheProvider, provider, signers, registry };
}

async function latestTime(provider) {
  return Number((await provider.getBlock('latest')).timestamp);
}

async function increaseTime(provider, seconds) {
  await provider.send('evm_increaseTime', [seconds]);
  await provider.send('evm_mine', []);
}

async function expectCustomError(contract, promise, expectedName) {
  try {
    const tx = await promise;
    await tx.wait();
    assert.fail('expected ' + expectedName);
  } catch (error) {
    if (error?.code === 'ERR_ASSERTION') throw error;
    const data = error?.data?.data
      ?? error?.data
      ?? error?.info?.error?.data?.result
      ?? error?.info?.error?.data;
    assert.equal(typeof data, 'string', 'missing revert data for ' + expectedName);
    assert.equal(contract.interface.parseError(data)?.name, expectedName);
  }
}

async function propose({ registry, provider, signers, versionId = VERSION, tokenCount = 2, activateOffset = DELAY + 10, retireOffset = 1_000 } = {}) {
  const now = await latestTime(provider);
  const tokens = [signers[4].address, signers[5].address];
  await (await registry.proposeVersion(
    versionId,
    CREATE_HASH,
    RUNTIME_HASH,
    tokens,
    tokenCount,
    now + activateOffset,
    retireOffset === 0 ? 0 : now + retireOffset,
    FACTORY_COMPATIBILITY,
    { gasLimit: 1_000_000 },
  )).wait();
  return { now, tokens };
}

test('compiler exposes exact reviewed bounds, statuses, immutable roles, and no fund-moving surface', async () => {
  compiled ??= await compileMissionContracts();
  assert.equal(compiled.compilerVersion, '0.8.24');
  assert.deepEqual(compiled.bounds, {
    maxAssets: 2,
    maxRecipients: 8,
    maxMilestones: 12,
    maxPayoutsPerAssetPerMilestone: 8,
  });
  assert.deepEqual(compiled.statuses, ['Pending', 'Active', 'Paused', 'Retired']);

  const abi = compiled.contracts.VersionRegistry.abi;
  const functions = abi.filter((entry) => entry.type === 'function').map((entry) => entry.name).sort();
  assert.deepEqual(functions, [
    'MAX_ASSETS',
    'MAX_MILESTONES',
    'MAX_PAYOUTS_PER_ASSET_PER_MILESTONE',
    'MAX_RECIPIENTS',
    'activateVersion',
    'emergencyCouncil',
    'getVersion',
    'governance',
    'isTokenSupported',
    'minimumDelay',
    'pauseVersion',
    'proposeVersion',
    'requireActiveVersion',
    'retireVersion',
    'scheduleRetirement',
  ].sort());
  for (const forbidden of ['transfer', 'transferFrom', 'approve', 'withdraw', 'sweep', 'execute', 'upgradeTo', 'delegatecall']) {
    assert.ok(!functions.some((name) => name.toLowerCase().includes(forbidden.toLowerCase())), forbidden);
  }
  const constructor = abi.find((entry) => entry.type === 'constructor');
  assert.deepEqual(constructor.inputs.map((entry) => entry.type), ['address', 'address', 'uint64']);
  assert.equal(constructor.stateMutability, 'nonpayable');
  assert.equal(abi.some((entry) => entry.type === 'receive' || entry.type === 'fallback'), false);
});

test('constructor binds distinct governance and emergency roles with a nonzero delay', async () => {
  compiled ??= await compileMissionContracts();
  const ganacheProvider = ganache.provider({ logging: { quiet: true }, wallet: { totalAccounts: 3 } });
  const provider = new ethers.BrowserProvider(ganacheProvider);
  const [governance, emergency] = await Promise.all([provider.getSigner(0), provider.getSigner(1)]);
  const factory = new ethers.ContractFactory(compiled.contracts.VersionRegistry.abi, compiled.contracts.VersionRegistry.bytecode, governance);
  await assert.rejects(factory.deploy(ethers.ZeroAddress, emergency.address, DELAY));
  await assert.rejects(factory.deploy(governance.address, ethers.ZeroAddress, DELAY));
  await assert.rejects(factory.deploy(governance.address, governance.address, DELAY));
  await assert.rejects(factory.deploy(governance.address, emergency.address, 0));
});

test('governance proposes a complete immutable version and exact supported token set', async () => {
  const { registry, provider, signers } = await fixture();
  const { now, tokens } = await propose({ registry, provider, signers });
  const version = await registry.getVersion(VERSION);
  assert.equal(version.creationCodeHash, CREATE_HASH);
  assert.equal(version.runtimeCodeHash, RUNTIME_HASH);
  assert.equal(version.supportedTokens[0], tokens[0]);
  assert.equal(version.supportedTokens[1], tokens[1]);
  assert.equal(version.tokenCount, 2n);
  assert.equal(version.activateAfter, BigInt(now + DELAY + 10));
  assert.equal(version.retireAfter, BigInt(now + 1_000));
  assert.equal(version.factoryCompatibility, BigInt(FACTORY_COMPATIBILITY));
  assert.equal(version.status, 0n);
  assert.equal(await registry.isTokenSupported(VERSION, tokens[0]), true);
  assert.equal(await registry.isTokenSupported(VERSION, signers[6].address), false);
  assert.equal(await registry.MAX_ASSETS(), 2n);
  assert.equal(await registry.MAX_RECIPIENTS(), 8n);
  assert.equal(await registry.MAX_MILESTONES(), 12n);
  assert.equal(await registry.MAX_PAYOUTS_PER_ASSET_PER_MILESTONE(), 8n);

  await expectCustomError(registry, registry.connect(signers[2]).proposeVersion(
    ethers.id('unauthorized'), CREATE_HASH, RUNTIME_HASH, tokens, 2, now + DELAY, now + 1_000, 1,
  ), 'Unauthorized');
  await expectCustomError(registry, registry.proposeVersion(VERSION, CREATE_HASH, RUNTIME_HASH, tokens, 2, now + DELAY, now + 1_000, 1), 'VersionAlreadyExists');
});

test('proposal validation rejects short timelocks, bad hashes, token sets, and retirement windows', async () => {
  const { registry, provider, signers } = await fixture();
  const now = await latestTime(provider);
  const tokens = [signers[4].address, signers[5].address];
  await expectCustomError(registry, registry.proposeVersion(ethers.ZeroHash, CREATE_HASH, RUNTIME_HASH, tokens, 2, now + DELAY, 0, 1), 'InvalidVersion');
  await expectCustomError(registry, registry.proposeVersion(ethers.id('zero-code'), ethers.ZeroHash, RUNTIME_HASH, tokens, 2, now + DELAY, 0, 1), 'InvalidVersion');
  await expectCustomError(registry, registry.proposeVersion(ethers.id('short-delay'), CREATE_HASH, RUNTIME_HASH, tokens, 2, now + DELAY - 1, 0, 1), 'TimelockNotSatisfied');
  await expectCustomError(registry, registry.proposeVersion(ethers.id('zero-token'), CREATE_HASH, RUNTIME_HASH, [ethers.ZeroAddress, tokens[1]], 2, now + DELAY, 0, 1), 'InvalidTokenSet');
  await expectCustomError(registry, registry.proposeVersion(ethers.id('duplicate-token'), CREATE_HASH, RUNTIME_HASH, [tokens[0], tokens[0]], 2, now + DELAY, 0, 1), 'InvalidTokenSet');
  await expectCustomError(registry, registry.proposeVersion(ethers.id('bad-count'), CREATE_HASH, RUNTIME_HASH, tokens, 0, now + DELAY, 0, 1), 'InvalidTokenSet');
  await expectCustomError(registry, registry.proposeVersion(ethers.id('bad-retire'), CREATE_HASH, RUNTIME_HASH, tokens, 2, now + DELAY, now + DELAY, 1), 'InvalidRetirement');
  await expectCustomError(registry, registry.proposeVersion(ethers.id('bad-compatibility'), CREATE_HASH, RUNTIME_HASH, tokens, 2, now + DELAY, 0, 0), 'InvalidVersion');
});

test('activation is governance-only and cannot bypass the proposed timelock', async () => {
  const { registry, provider, signers } = await fixture();
  const { tokens } = await propose({ registry, provider, signers });
  await expectCustomError(registry, registry.activateVersion(VERSION), 'TimelockNotSatisfied');
  await increaseTime(provider, DELAY + 11);
  await expectCustomError(registry, registry.connect(signers[2]).activateVersion(VERSION), 'Unauthorized');
  await (await registry.activateVersion(VERSION, { gasLimit: 1_000_000 })).wait();
  assert.equal((await registry.getVersion(VERSION)).status, 1n);
  const active = await registry.requireActiveVersion(VERSION, tokens[0]);
  assert.equal(active.creationCodeHash, CREATE_HASH);
  assert.equal(active.runtimeCodeHash, RUNTIME_HASH);
  assert.equal(active.factoryCompatibility, BigInt(FACTORY_COMPATIBILITY));
  await expectCustomError(registry, registry.requireActiveVersion(VERSION, signers[6].address), 'UnsupportedToken');
});

test('emergency council can only pause new creation; governance alone can resume', async () => {
  const { registry, provider, signers } = await fixture();
  const { tokens } = await propose({ registry, provider, signers, retireOffset: 0 });
  await increaseTime(provider, DELAY + 11);
  await (await registry.activateVersion(VERSION, { gasLimit: 1_000_000 })).wait();
  await expectCustomError(registry, registry.connect(signers[2]).pauseVersion(VERSION), 'Unauthorized');
  await (await registry.connect(signers[1]).pauseVersion(VERSION, { gasLimit: 1_000_000 })).wait();
  assert.equal((await registry.getVersion(VERSION)).status, 2n);
  await expectCustomError(registry, registry.requireActiveVersion(VERSION, tokens[0]), 'VersionNotActive');
  await expectCustomError(registry, registry.connect(signers[1]).activateVersion(VERSION), 'Unauthorized');
  await (await registry.activateVersion(VERSION, { gasLimit: 1_000_000 })).wait();
  assert.equal((await registry.getVersion(VERSION)).status, 1n);
});

test('retirement is separately scheduled, timelocked, terminal, and governance-only', async () => {
  const { registry, provider, signers } = await fixture();
  const { tokens } = await propose({ registry, provider, signers, retireOffset: 0 });
  await increaseTime(provider, DELAY + 11);
  await (await registry.activateVersion(VERSION, { gasLimit: 1_000_000 })).wait();
  const now = await latestTime(provider);
  await expectCustomError(registry, registry.scheduleRetirement(VERSION, now + DELAY - 1), 'TimelockNotSatisfied');
  await expectCustomError(registry, registry.connect(signers[2]).scheduleRetirement(VERSION, now + DELAY), 'Unauthorized');
  const retireAt = Number((await registry.getVersion(VERSION)).activateAfter) + 1_000;
  await (await registry.scheduleRetirement(VERSION, retireAt, { gasLimit: 1_000_000 })).wait();
  await expectCustomError(registry, registry.retireVersion(VERSION), 'TimelockNotSatisfied');
  await increaseTime(provider, 1_200);
  await expectCustomError(registry, registry.connect(signers[1]).retireVersion(VERSION), 'Unauthorized');
  await (await registry.retireVersion(VERSION, { gasLimit: 1_000_000 })).wait();
  assert.equal((await registry.getVersion(VERSION)).status, 3n);
  await expectCustomError(registry, registry.requireActiveVersion(VERSION, tokens[0]), 'VersionNotActive');
  await expectCustomError(registry, registry.activateVersion(VERSION), 'InvalidStatus');
  await expectCustomError(registry, registry.pauseVersion(VERSION), 'InvalidStatus');
});
