const STATES = Object.freeze(['not_started', 'reserved', 'provisioning', 'runtime_ready', 'room_ready', 'tasks_ready', 'committed', 'failed_retryable', 'expired_refundable']);
const STATE_SET = new Set(STATES);

export function createMissionLaunchCoordinator({ ledger, runtime, xmtp, tasks, chain, now = Date.now, onBoundary = async () => {} } = {}) {
  requireMethods(ledger, ['readLaunch', 'reserveLaunch', 'markPhase', 'markActivated'], 'launch ledger');
  requireMethods(runtime, ['findTeam', 'provisionTeam', 'verifyTeam', 'pauseTeam', 'activateTeam'], 'runtime');
  requireMethods(xmtp, ['findGroup', 'ensureGroup', 'verifyGroup'], 'XMTP');
  requireMethods(tasks, ['findTask', 'createTask', 'verifyTask'], 'task');
  requireMethods(chain, ['readLaunchCommitment', 'commitLaunch', 'readDualApproval'], 'chain');
  if (typeof now !== 'function' || typeof onBoundary !== 'function') throw new TypeError('Launch coordinator dependencies are invalid.');

  async function advance(input = {}) {
    const request = normalizeInput(input);
    for (let steps = 0; steps < 12; steps += 1) {
      let record = await ledger.readLaunch(request.missionId);
      const state = record?.state ?? 'not_started';
      if (!STATE_SET.has(state)) throw new Error('Unknown launch state: ' + state);
      if (state !== 'committed' && timestamp() >= request.launchDeadline) {
        if (state === 'not_started') await ledger.reserveLaunch({ ...request, state: 'expired_refundable' });
        else await ledger.markPhase({ missionId: request.missionId, expectedState: state, nextState: 'expired_refundable', resumeState: null });
        return Object.freeze({ state: 'expired_refundable', activated: false });
      }
      if (state === 'expired_refundable') return Object.freeze({ state, activated: false });
      if (state === 'failed_retryable') {
        const resumeState = record.resumeState;
        if (!STATE_SET.has(resumeState) || resumeState === 'failed_retryable' || resumeState === 'expired_refundable') throw new Error('Retryable launch record has no valid resume state.');
        await ledger.markPhase({ missionId: request.missionId, expectedState: state, nextState: resumeState, resumeState: null });
        continue;
      }
      try {
        if (state === 'not_started') {
          await ledger.reserveLaunch({ ...request, state: 'reserved' });
          await boundary('reservation');
          continue;
        }
        if (state === 'reserved') {
          await ledger.markPhase({ missionId: request.missionId, expectedState: 'reserved', nextState: 'provisioning', resumeState: null });
          continue;
        }
        if (state === 'provisioning') {
          let team = await runtime.findTeam({ missionId: request.missionId, managerInstanceId: request.managerInstanceId, teamId: request.teamId, workspaceId: request.workspaceId });
          if (!team) team = await runtime.provisionTeam(request);
          await boundary('runtime_provisioned');
          await runtime.verifyTeam({ ...request, team });
          await runtime.pauseTeam({ ...request, team, reason: 'awaiting_dual_launch_approval' });
          await boundary('runtime_verified');
          await ledger.markPhase({ missionId: request.missionId, expectedState: 'provisioning', nextState: 'runtime_ready', resumeState: null, runtimeRef: team.id });
          continue;
        }
        if (state === 'runtime_ready') {
          let group = await xmtp.findGroup({ missionId: request.missionId, conversationId: record?.conversationId ?? null });
          if (!group) group = await xmtp.ensureGroup(request);
          await boundary('room_created');
          await xmtp.verifyGroup({ ...request, group });
          await boundary('membership_verified');
          await ledger.markPhase({ missionId: request.missionId, expectedState: 'runtime_ready', nextState: 'room_ready', resumeState: null, conversationId: group.conversationId });
          continue;
        }
        if (state === 'room_ready') {
          const taskRefs = [];
          for (const task of request.taskSet) {
            let existing = await tasks.findTask({ missionId: request.missionId, taskId: task.taskId, deterministicName: task.deterministicName });
            if (!existing) existing = await tasks.createTask({ missionId: request.missionId, ...task });
            await tasks.verifyTask({ missionId: request.missionId, expected: task, task: existing });
            taskRefs.push(existing.id);
          }
          await boundary('tasks_created');
          await ledger.markPhase({ missionId: request.missionId, expectedState: 'room_ready', nextState: 'tasks_ready', resumeState: null, taskRefs });
          continue;
        }
        if (state === 'tasks_ready') {
          let commitment = await chain.readLaunchCommitment({ missionId: request.missionId, termsHash: request.termsHash });
          if (!commitment) commitment = await chain.commitLaunch({ missionId: request.missionId, termsHash: request.termsHash, managerInstanceId: request.managerInstanceId, teamId: request.teamId });
          await boundary('commitment_written');
          await ledger.markPhase({ missionId: request.missionId, expectedState: 'tasks_ready', nextState: 'committed', resumeState: null, commitmentRef: commitment.ref });
          continue;
        }
        if (state === 'committed') {
          const approval = await chain.readDualApproval({ missionId: request.missionId, termsHash: request.termsHash });
          if (!approval?.ownerApproved || !approval?.leadApproved) return Object.freeze({ state, activated: false });
          if (!record?.activatedAt) {
            const team = await runtime.findTeam({ missionId: request.missionId, managerInstanceId: request.managerInstanceId, teamId: request.teamId, workspaceId: request.workspaceId });
            if (!team) throw new Error('Committed mission runtime is missing.');
            if (!team.active) await runtime.activateTeam({ ...request, team });
            await boundary('dual_activation');
            await ledger.markActivated({ missionId: request.missionId, expectedState: 'committed', activatedAt: timestamp() });
          }
          return Object.freeze({ state, activated: true });
        }
      } catch (error) {
        if (error?.processCrash) throw error;
        await ledger.markPhase({ missionId: request.missionId, expectedState: state, nextState: 'failed_retryable', resumeState: state, errorCode: safeErrorCode(error) });
        return Object.freeze({ state: 'failed_retryable', resumeState: state, activated: false });
      }
    }
    throw new Error('Launch coordinator exceeded its bounded phase count.');
  }

  async function boundary(name) { await onBoundary(name); }
  function timestamp() { const value = now(); if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Launch clock returned an invalid timestamp.'); return value; }
  return Object.freeze({ advance });
}

export { STATES as MISSION_LAUNCH_OPERATION_STATES };

function normalizeInput(value) {
  exact(value, ['launchDeadline', 'managerInstanceId', 'memberIdentifiers', 'missionId', 'policyCommitment', 'roomName', 'taskSet', 'teamId', 'termsHash', 'workspaceId'], 'launch input');
  if (!Array.isArray(value.memberIdentifiers) || value.memberIdentifiers.length < 2 || value.memberIdentifiers.length > 9) throw new TypeError('launch memberIdentifiers is invalid.');
  if (!Array.isArray(value.taskSet) || value.taskSet.length === 0 || value.taskSet.length > 100) throw new TypeError('launch taskSet is invalid.');
  const taskSet = value.taskSet.map((task) => {
    exact(task, ['assigneeAgentId', 'deterministicName', 'taskId', 'title'], 'launch task');
    return Object.freeze({ taskId: identifier(task.taskId, 'taskId'), deterministicName: identifier(task.deterministicName, 'deterministicName'), title: bounded(task.title, 'title', 1, 200), assigneeAgentId: identifier(task.assigneeAgentId, 'assigneeAgentId') });
  });
  if (new Set(taskSet.map((task) => task.taskId)).size !== taskSet.length || new Set(taskSet.map((task) => task.deterministicName)).size !== taskSet.length) throw new TypeError('launch tasks must be unique.');
  return Object.freeze({
    missionId: identifier(value.missionId, 'missionId'), managerInstanceId: identifier(value.managerInstanceId, 'managerInstanceId'),
    teamId: identifier(value.teamId, 'teamId'), workspaceId: identifier(value.workspaceId, 'workspaceId'),
    roomName: bounded(value.roomName, 'roomName', 1, 100), memberIdentifiers: Object.freeze(structuredClone(value.memberIdentifiers)),
    policyCommitment: hash(value.policyCommitment, 'policyCommitment'), termsHash: hash(value.termsHash, 'termsHash'),
    taskSet: Object.freeze(taskSet), launchDeadline: integer(value.launchDeadline, 'launchDeadline', 1, Number.MAX_SAFE_INTEGER),
  });
}
function safeErrorCode(error) { const value = String(error?.code ?? error?.name ?? 'launch_error'); return /^[A-Za-z0-9_.:-]{1,128}$/u.test(value) ? value : 'launch_error'; }
function requireMethods(value, methods, label) { if (!value || methods.some((name) => typeof value[name] !== 'function')) throw new TypeError(label + ' port is invalid.'); }
function exact(value, keys, label) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(label + ' must be a plain object.'); const actual = Object.keys(value).sort(); const expected = [...keys].sort(); if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new TypeError(label + ' fields are invalid.'); }
function identifier(value, label) { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function bounded(value, label, min, max) { if (typeof value !== 'string' || value.length < min || value.length > max) throw new TypeError(label + ' is invalid.'); return value; }
function hash(value, label) { if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function integer(value, label, min, max) { if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(label + ' is invalid.'); return value; }
