import assert from 'node:assert/strict';
import test from 'node:test';

import { ethers } from 'ethers';

import { simulateMissionDeployment } from '../scripts/simulate-mission-deployment.js';

test('Base Sepolia simulation proves deterministic registry, factory, token, role, and version state without broadcasting', async () => {
  const first = await simulateMissionDeployment();
  const second = await simulateMissionDeployment();

  assert.deepEqual(second, first);
  assert.equal(first.schemaVersion, 1);
  assert.equal(first.status, 'passed');
  assert.equal(first.broadcast, false);
  assert.equal(first.network, 'base-sepolia');
  assert.equal(first.chainId, 84532);
  assert.equal(first.compilerVersion, '0.8.24');
  assert.match(first.sourceHash, /^[0-9a-f]{64}$/u);

  assert.equal(first.authority.kind, 'simulation-2-of-2');
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
  assert.ok(first.tokens.every(({ address, runtimeCodeHash }) => ethers.isAddress(address) && /^0x[0-9a-f]{64}$/u.test(runtimeCodeHash)));
  assert.notEqual(first.tokens[0].address, first.tokens[1].address);

  assert.equal(first.version.status, 'active');
  assert.deepEqual(first.version.supportedTokens, first.tokens.map(({ address }) => address));
  assert.equal(first.version.factoryCompatibility, 1);
  assert.equal(first.version.creationCodeHash, first.vault.creationCodeHash);
  assert.equal(first.version.runtimeCodeHash, first.vault.runtimeCodeHash);

  assert.ok(first.transactions.length >= 10);
  assert.ok(first.transactions.every((entry) => entry.broadcast === false && entry.value === '0'));
  assert.ok(first.transactions.some(({ operation }) => operation === 'registry.proposeVersion'));
  assert.ok(first.transactions.some(({ operation }) => operation === 'registry.activateVersion'));
  assert.ok(first.transactions.every((entry) => !Object.hasOwn(entry, 'signature') && !Object.hasOwn(entry, 'privateKey')));

  assert.deepEqual(first.externalRequirements, [
    'approved Base Sepolia RPC endpoints',
    'approved production Safe address and owner threshold',
    'approved emergency council address',
    'approved deployer address and fresh nonce',
    'approved Base Sepolia token addresses or mock-token deployment choice',
    'separate explicit broadcast approval',
  ]);
});
