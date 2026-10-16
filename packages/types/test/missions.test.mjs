import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertMissionBound,
  canTransitionLaunch,
  canTransitionMilestone,
  canTransitionMission,
  launchStates,
  milestoneStates,
  missionLimits,
  missionSourceLabels,
  missionStates,
  taskStates,
  vaultStates,
} from '../src/missions.js';

const exact = Object.freeze({
  missions: ['draft', 'recruiting', 'team_selected', 'funding', 'funded', 'launching', 'active', 'review', 'settled', 'cancelled', 'refunded'],
  launches: ['not_started', 'reserved', 'provisioning', 'runtime_ready', 'room_ready', 'tasks_ready', 'committed', 'failed_retryable', 'expired_refundable'],
  vaults: ['awaiting_funding', 'funded', 'active', 'settled', 'refunded'],
  milestones: ['pending', 'submitted', 'releasable', 'released', 'disputed', 'resolved', 'timeout_settled', 'refunded'],
  tasks: ['todo', 'doing', 'blocked', 'review', 'done', 'cancelled'],
  sources: ['onchain', 'helixa_ledger', 'id_agents', 'xmtp'],
});

test('mission domain enums are exact, unique, and immutable', () => {
  assert.deepEqual(missionStates, exact.missions);
  assert.deepEqual(launchStates, exact.launches);
  assert.deepEqual(vaultStates, exact.vaults);
  assert.deepEqual(milestoneStates, exact.milestones);
  assert.deepEqual(taskStates, exact.tasks);
  assert.deepEqual(missionSourceLabels, exact.sources);

  for (const values of [missionStates, launchStates, vaultStates, milestoneStates, taskStates, missionSourceLabels]) {
    assert.equal(new Set(values).size, values.length);
    assert.ok(Object.isFrozen(values));
    assert.throws(() => values.push('invented'), TypeError);
  }
});

test('mission transitions preserve launch and dispute as separate state machines', () => {
  const allowed = [
    ['draft', 'recruiting'],
    ['draft', 'cancelled'],
    ['recruiting', 'team_selected'],
    ['recruiting', 'cancelled'],
    ['team_selected', 'funding'],
    ['team_selected', 'cancelled'],
    ['funding', 'funded'],
    ['funding', 'refunded'],
    ['funded', 'launching'],
    ['funded', 'refunded'],
    ['launching', 'active'],
    ['launching', 'refunded'],
    ['active', 'review'],
    ['active', 'settled'],
    ['review', 'active'],
    ['review', 'settled'],
  ];
  for (const [from, to] of allowed) assert.equal(canTransitionMission(from, to), true, from + ' -> ' + to);

  assert.equal(canTransitionMission('funded', 'active'), false);
  assert.throws(() => canTransitionMission('active', 'disputed'), /unknown mission state/i);
  assert.equal(canTransitionMission('settled', 'review'), false);
  assert.throws(() => canTransitionMission('unknown', 'draft'), /unknown mission state/i);
});

test('launch retries reconcile without inventing a second launch path', () => {
  assert.equal(canTransitionLaunch('not_started', 'reserved'), true);
  assert.equal(canTransitionLaunch('reserved', 'provisioning'), true);
  assert.equal(canTransitionLaunch('provisioning', 'runtime_ready'), true);
  assert.equal(canTransitionLaunch('runtime_ready', 'room_ready'), true);
  assert.equal(canTransitionLaunch('room_ready', 'tasks_ready'), true);
  assert.equal(canTransitionLaunch('tasks_ready', 'committed'), true);
  assert.equal(canTransitionLaunch('provisioning', 'failed_retryable'), true);
  assert.equal(canTransitionLaunch('failed_retryable', 'provisioning'), true);
  assert.equal(canTransitionLaunch('failed_retryable', 'expired_refundable'), true);
  assert.equal(canTransitionLaunch('committed', 'provisioning'), false);
});

test('milestone terminal states never move backward', () => {
  assert.equal(canTransitionMilestone('pending', 'submitted'), true);
  assert.equal(canTransitionMilestone('pending', 'disputed'), true);
  assert.equal(canTransitionMilestone('pending', 'timeout_settled'), true);
  assert.equal(canTransitionMilestone('submitted', 'releasable'), true);
  assert.equal(canTransitionMilestone('submitted', 'disputed'), true);
  assert.equal(canTransitionMilestone('releasable', 'released'), true);
  assert.equal(canTransitionMilestone('disputed', 'resolved'), true);
  assert.equal(canTransitionMilestone('disputed', 'timeout_settled'), true);
  for (const terminal of ['released', 'resolved', 'timeout_settled', 'refunded']) {
    for (const state of milestoneStates) assert.equal(canTransitionMilestone(terminal, state), false, terminal + ' -> ' + state);
  }
});

test('reviewed v1 bounds are exact and validated fail-closed', () => {
  assert.deepEqual(missionLimits, Object.freeze({
    assets: 2,
    recipients: 8,
    milestones: 12,
    payoutsPerAssetPerMilestone: 8,
  }));
  assert.equal(assertMissionBound('assets', 2), 2);
  assert.equal(assertMissionBound('recipients', 8), 8);
  assert.throws(() => assertMissionBound('milestones', 13), /milestones/i);
  assert.throws(() => assertMissionBound('assets', 0), /assets/i);
  assert.throws(() => assertMissionBound('unknown', 1), /unknown mission bound/i);
  assert.throws(() => assertMissionBound('recipients', 1.5), /integer/i);
});
