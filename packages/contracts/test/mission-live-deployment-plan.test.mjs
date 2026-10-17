import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { prepareLiveDeploymentPlan, validateLiveDeploymentPlan } from '../scripts/prepare-mission-base-sepolia-plan.js';

const ARTIFACT = new URL('../../../review-artifacts/looper-missions/external-proof/base-sepolia-live-plan.json', import.meta.url);

test('live Base Sepolia plan is byte-committed, unsigned, dual-RPC pinned, and separately blocks broadcast', async () => {
  const artifact = JSON.parse(await readFile(ARTIFACT, 'utf8'));
  const regenerated = await prepareLiveDeploymentPlan({ anchorNumber: artifact.rpcConsensus.anchor.number });
  assert.equal(JSON.stringify(regenerated), JSON.stringify(artifact));
  assert.doesNotThrow(() => validateLiveDeploymentPlan(artifact));
  assert.equal(artifact.status, 'live_no_broadcast_simulation_passed');
  assert.equal(artifact.externalBroadcast, false);
  assert.equal(artifact.broadcastApprovalGranted, false);
  assert.equal(artifact.chainId, 84532);
  assert.equal(artifact.rpcConsensus.origins.length, 2);
  assert.equal(artifact.rpcConsensus.agreed, true);
  assert.equal(artifact.authority.kind, 'safe-2-of-2');
  assert.equal(artifact.authority.threshold, 2);
  assert.deepEqual(artifact.authority.owners, [
    '0x339559A2d1CD15059365FC7bD36b3047BbA480E0',
    '0x709D8d528D2c0C8A408107E74b38a01Fa14e44aE',
  ]);
  assert.equal(artifact.emergencyCouncil, '0xD31fCdb0432D3C9BF9d98643F69C7edd690E48E8');
  assert.equal(artifact.tokens.every(({ kind }) => kind === 'isolated-testnet-mock'), true);
  assert.deepEqual(artifact.deployerTransactions.map(({ nonce }) => nonce), [38, 39, 40, 41, 42]);
  assert.deepEqual(artifact.safeTransactions.map(({ nonce }) => nonce), [0, 1]);
  assert.equal(artifact.safeTransactions[0].operation, 'CALL');
  assert.equal(artifact.safeTransactions[1].operation, 'CALL');
  assert.equal(artifact.simulation.earlyActivationRejected, true);
  assert.equal(artifact.simulation.activationSucceededAfterDelay, true);
  assert.equal(artifact.liveReadiness.status, 'approval_required');
  const serialized = JSON.stringify(artifact);
  assert.doesNotMatch(serialized, /private.?key|mnemonic|signature/i);
});
