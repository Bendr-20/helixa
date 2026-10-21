import assert from 'node:assert/strict';
import test from 'node:test';

import { compileSwarmLaunchContracts } from '../scripts/compile-swarm-launch.js';

test('swarm launch execution contracts compile deterministically with locked ABIs', async () => {
  const first = await compileSwarmLaunchContracts();
  const second = await compileSwarmLaunchContracts();

  assert.equal(first.compilerVersion, '0.8.24');
  assert.equal(first.sourceHash, second.sourceHash);
  assert.deepEqual(Object.keys(first.contracts).sort(), [
    'FixedSupplySwarmToken',
    'NonTransferableVestingStream',
    'PullRevenueSplitter',
    'SwarmContributionRegistry',
    'SwarmLaunchFactory',
  ]);

  for (const artifact of Object.values(first.contracts)) {
    assert.match(artifact.bytecode, /^0x[0-9a-f]+$/u);
    assert.match(artifact.deployedBytecode, /^0x[0-9a-f]+$/u);
  }

  const tokenFunctions = functionNames(first.contracts.FixedSupplySwarmToken.abi);
  assert.equal(tokenFunctions.has('mint'), false);
  assert.equal(tokenFunctions.has('owner'), false);
  assert.equal(tokenFunctions.has('pause'), false);
  assert.equal(tokenFunctions.has('blacklist'), false);
  assert.equal(tokenFunctions.has('upgradeTo'), false);
  assert.equal(tokenFunctions.has('transfer'), true);
  assert.equal(tokenFunctions.has('approve'), true);
  assert.equal(tokenFunctions.has('transferFrom'), true);

  const registryFunctions = functionNames(first.contracts.SwarmContributionRegistry.abi);
  assert.equal(registryFunctions.has('setContribution'), false);
  assert.equal(registryFunctions.has('owner'), false);

  const vestingFunctions = functionNames(first.contracts.NonTransferableVestingStream.abi);
  assert.equal(vestingFunctions.has('transferBeneficiary'), false);
  assert.equal(vestingFunctions.has('revoke'), false);
  assert.equal(vestingFunctions.has('owner'), false);

  const splitterFunctions = functionNames(first.contracts.PullRevenueSplitter.abi);
  assert.equal(splitterFunctions.has('distribute'), false);
  assert.equal(splitterFunctions.has('setShares'), false);
  assert.equal(splitterFunctions.has('owner'), false);
  assert.equal(splitterFunctions.has('release'), true);

  const factoryFunctions = functionNames(first.contracts.SwarmLaunchFactory.abi);
  assert.equal(factoryFunctions.has('deploy'), true);
  assert.equal(factoryFunctions.has('predict'), true);
  assert.equal(factoryFunctions.has('setImplementation'), false);
  assert.equal(factoryFunctions.has('setSigner'), false);
  assert.equal(factoryFunctions.has('owner'), false);
});

function functionNames(abi) {
  return new Set(abi.filter((entry) => entry.type === 'function').map((entry) => entry.name));
}
