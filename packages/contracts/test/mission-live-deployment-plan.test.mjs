import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { validateLiveDeploymentPlan } from '../scripts/prepare-mission-base-sepolia-plan.js';

const ARTIFACT = new URL('../../../review-artifacts/looper-missions/external-proof/base-sepolia-live-plan.json', import.meta.url);

test('historical live Base Sepolia plan remains byte-committed, unsigned, and non-broadcasting after deployment', async () => {
  const bytes = await readFile(ARTIFACT);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'afeb2ff90b899b45aeba9bc94468e312b02ae09e1a498851d76348c1da823d18');
  const artifact = JSON.parse(bytes.toString('utf8'));
  const historicalVerificationTime = Date.parse(artifact.liveReadiness.validUntil) - 1;
  assert.doesNotThrow(() => validateLiveDeploymentPlan(artifact, { now: historicalVerificationTime }));
  assert.throws(() => validateLiveDeploymentPlan(artifact), /expired/);
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
