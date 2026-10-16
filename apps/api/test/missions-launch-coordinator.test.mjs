import assert from 'node:assert/strict';
import test from 'node:test';

import { createMissionLaunchCoordinator, MISSION_LAUNCH_OPERATION_STATES } from '../src/missions/launch-coordinator.js';

const H = (value) => value.repeat(64).slice(0, 64);
const INPUT = {
  missionId: 'mission-1', managerInstanceId: 'manager-1', teamId: 'team-1', workspaceId: 'workspace-1',
  roomName: 'Mission One', memberIdentifiers: [{ id: 'member-1' }, { id: 'member-2' }],
  policyCommitment: H('a'), termsHash: H('b'), launchDeadline: 100_000,
  taskSet: [
    { taskId: 'task-1', deterministicName: 'mission-1-task-1', title: 'Build', assigneeAgentId: 'agent-1' },
    { taskId: 'task-2', deterministicName: 'mission-1-task-2', title: 'Review', assigneeAgentId: 'agent-2' },
  ],
};

function fixture() {
  let record = null;
  let team = null;
  let group = null;
  const taskRows = new Map();
  let commitment = null;
  let approval = { ownerApproved: true, leadApproved: true };
  const counts = { reserve: 0, provision: 0, group: 0, task: 0, commit: 0, activate: 0 };
  const ledger = {
    async readLaunch() { return record; },
    async reserveLaunch(input) { counts.reserve += 1; record = { ...input, state: 'reserved' }; },
    async markPhase(input) {
      assert.equal(record.state, input.expectedState);
      record = { ...record, ...input, state: input.nextState };
    },
    async markActivated({ activatedAt }) { assert.equal(record.state, 'committed'); record = { ...record, activatedAt }; },
  };
  const runtime = {
    async findTeam() { return team; },
    async provisionTeam() { counts.provision += 1; team = { id: 'runtime-1', active: false }; return team; },
    async verifyTeam() { return true; },
    async pauseTeam() { if (team) team.active = false; },
    async activateTeam() { counts.activate += 1; team.active = true; },
  };
  const xmtp = {
    async findGroup() { return group; },
    async ensureGroup() { counts.group += 1; group = { conversationId: 'conversation-1' }; return group; },
    async verifyGroup() { return true; },
  };
  const tasks = {
    async findTask({ taskId }) { return taskRows.get(taskId) ?? null; },
    async createTask(task) { counts.task += 1; const row = { id: 'runtime-' + task.taskId, ...task }; taskRows.set(task.taskId, row); return row; },
    async verifyTask() { return true; },
  };
  const chain = {
    async readLaunchCommitment() { return commitment; },
    async commitLaunch() { counts.commit += 1; commitment = { ref: 'chain-commitment-1' }; return commitment; },
    async readDualApproval() { return approval; },
  };
  return {
    ports: { ledger, runtime, xmtp, tasks, chain, now: () => 1000 }, counts,
    setApproval(value) { approval = value; }, setRecord(value) { record = value; }, get record() { return record; },
  };
}

function crashAt(boundary) {
  let crashed = false;
  return async (name) => { if (!crashed && name === boundary) { crashed = true; const error = new Error('crash at ' + name); error.processCrash = true; throw error; } };
}

test('exports the exact bounded launch operation states', () => {
  assert.deepEqual(MISSION_LAUNCH_OPERATION_STATES, ['not_started', 'reserved', 'provisioning', 'runtime_ready', 'room_ready', 'tasks_ready', 'committed', 'failed_retryable', 'expired_refundable']);
});

test('every phase-boundary crash recovers with one manager, team, workspace, room, task set, commitment, and activation', async () => {
  for (const boundary of ['reservation', 'runtime_provisioned', 'runtime_verified', 'room_created', 'membership_verified', 'tasks_created', 'commitment_written', 'dual_activation']) {
    const f = fixture();
    const first = createMissionLaunchCoordinator({ ...f.ports, onBoundary: crashAt(boundary) });
    await assert.rejects(() => first.advance(INPUT), new RegExp(boundary));
    const resumed = createMissionLaunchCoordinator(f.ports);
    const result = await resumed.advance(INPUT);
    assert.deepEqual(result, { state: 'committed', activated: true }, boundary);
    assert.deepEqual(f.counts, { reserve: 1, provision: 1, group: 1, task: 2, commit: 1, activate: 1 }, boundary);
    assert.ok(f.record.activatedAt, boundary);
  }
});

test('agents stay paused until both onchain launch approvals exist', async () => {
  const f = fixture();
  f.setApproval({ ownerApproved: true, leadApproved: false });
  const coordinator = createMissionLaunchCoordinator(f.ports);
  assert.deepEqual(await coordinator.advance(INPUT), { state: 'committed', activated: false });
  assert.equal(f.counts.activate, 0);
  f.setApproval({ ownerApproved: true, leadApproved: true });
  assert.deepEqual(await coordinator.advance(INPUT), { state: 'committed', activated: true });
  assert.equal(f.counts.activate, 1);
});

test('deadline expiry becomes refundable before launch commitment', async () => {
  const f = fixture();
  const coordinator = createMissionLaunchCoordinator({ ...f.ports, now: () => INPUT.launchDeadline });
  assert.deepEqual(await coordinator.advance(INPUT), { state: 'expired_refundable', activated: false });
  assert.equal(f.counts.provision, 0);
});

test('retryable dependency failure records its resume state and continues read-before-write', async () => {
  const f = fixture();
  let failed = false;
  const original = f.ports.runtime.provisionTeam;
  f.ports.runtime.provisionTeam = async (...args) => { if (!failed) { failed = true; throw Object.assign(new Error('temporary runtime failure'), { code: 'runtime_unavailable' }); } return original(...args); };
  const coordinator = createMissionLaunchCoordinator(f.ports);
  assert.deepEqual(await coordinator.advance(INPUT), { state: 'failed_retryable', resumeState: 'provisioning', activated: false });
  assert.equal(f.record.state, 'failed_retryable');
  assert.deepEqual(await coordinator.advance(INPUT), { state: 'committed', activated: true });
  assert.equal(f.counts.provision, 1);
});
