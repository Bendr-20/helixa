import assert from 'node:assert/strict';
import test from 'node:test';

import { createMissionService, MissionServiceError } from '../src/missions/service.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const LEAD = '0x2222222222222222222222222222222222222222';
const MEMBER = '0x3333333333333333333333333333333333333333';
const OTHER = '0x4444444444444444444444444444444444444444';
const ARBITRATOR = '0x5555555555555555555555555555555555555555';
const HASH = 'a'.repeat(64);

function mission(overrides = {}) {
  return {
    missionId: 'mission-1', ownerAddress: OWNER, leadApprovalAddress: LEAD,
    participantAddresses: [LEAD, MEMBER], arbitratorAddress: ARBITRATOR, state: 'recruiting', revision: 2,
    publicSummary: 'Build a useful thing.', applicationClosesAt: 10_000,
    launchDeadline: 20_000, createdAt: 1, updatedAt: 2,
    publicDocument: { title: 'Mission One', required_roles: ['builder'] },
    privateDocument: { scope: 'secret scope' }, applications: [{ applicationId: 'app-1' }],
    ...overrides,
  };
}

function fixture() {
  const calls = [];
  let current = mission();
  const repository = {
    listMissions(query) { calls.push(['listMissions', query]); return [current]; },
    readMission(id) { calls.push(['readMission', id]); return id === current.missionId ? current : null; },
    readRevision() { return { publicDocument: current.publicDocument, privateDocument: current.privateDocument }; },
    createDraft(input) { calls.push(['createDraft', input]); return { missionId: input.missionId, revision: 0, state: 'draft' }; },
    updateMission(input) { calls.push(['updateMission', input]); current = { ...current, ...input.patch, revision: input.expectedRevision + 1 }; return { missionId: input.missionId, revision: input.expectedRevision + 1, state: current.state }; },
    executeCommand(input) { calls.push(['executeCommand', input]); return { action: input.action, missionId: input.missionId, revision: input.expectedRevision + 1 }; },
    readApplication({ applicationId }) { calls.push(['readApplication', applicationId]); return applicationId === 'app-1' ? { applicationId, applicantAddress: OTHER } : null; },
    readLaunchTerms(input) { calls.push(['readLaunchTerms', input]); return { termsHash: HASH, privateScope: 'do not expose publicly' }; },
    readWorkspace(input) { calls.push(['readWorkspace', input]); return { missionId: input.missionId, managerLocation: 'http://127.0.0.1:9000', tasks: [] }; },
    readDispute(input) { calls.push(['readDispute', input]); return { disputeId: input.disputeId, evidence: 'party-only' }; },
  };
  const custody = { async verifyCurrent(input) { calls.push(['custody.verifyCurrent', input]); return { ownerAddress: input.actorAddress, eligible: true, runtimeActive: true }; } };
  const chain = new Proxy({}, { get: (_, name) => async (input) => { calls.push(['chain.' + String(name), input]); return { prepared: String(name) }; } });
  const runtime = new Proxy({}, { get: (_, name) => async (input) => { calls.push(['runtime.' + String(name), input]); return { runtime: String(name) }; } });
  const xmtp = { async publishEvent(input) { calls.push(['xmtp.publishEvent', input]); } };
  return { service: createMissionService({ repository, custody, chain, runtime, xmtp }), calls, setMission: (value) => { current = value; } };
}

const meta = { actorAddress: OWNER, expectedRevision: 2, idempotencyKey: 'idem-12345678' };

test('public list/detail are bounded projections and missing missions fail closed', async () => {
  const f = fixture();
  const page = await f.service.listPublicMissions({ state: 'recruiting', limit: 10, cursor: null });
  assert.equal(page.missions.length, 1);
  assert.equal(page.missions[0].publicSummary, 'Build a useful thing.');
  assert.equal(Object.hasOwn(page.missions[0], 'applications'), false);
  assert.equal(Object.hasOwn(page.missions[0], 'privateDocument'), false);
  assert.equal((await f.service.getPublicMission({ missionId: 'mission-1' })).missionId, 'mission-1');
  await assert.rejects(() => f.service.getPublicMission({ missionId: 'missing' }), (error) => error instanceof MissionServiceError && error.status === 404);
  await assert.rejects(() => f.service.listPublicMissions({ limit: 101 }), /limit/i);
});

test('create and lifecycle updates use the repository with owner-bound revisions and idempotency', async () => {
  const f = fixture();
  const created = await f.service.createMission({
    actorAddress: OWNER, expectedRevision: 0, idempotencyKey: 'create-12345678',
    input: { missionId: 'mission-new', refundAddress: OTHER, publicSummary: 'A bounded mission.', publicDocument: { title: 'New' }, privateDocument: { scope: 'private' }, privateSpecHash: HASH, termsHash: HASH, commitmentHash: HASH },
  });
  assert.equal(created.state, 'draft');
  const createCall = f.calls.find(([name]) => name === 'createDraft')[1];
  assert.equal(createCall.ownerAddress, OWNER);
  assert.equal(createCall.idempotencyKey, 'create-12345678');

  f.setMission(mission({ state: 'draft', revision: 2 }));
  await f.service.updateMission({ ...meta, missionId: 'mission-1', input: { patch: { publicSummary: 'Updated' }, publicDocument: { title: 'Mission One' }, privateDocument: { scope: 'private' }, commitmentHash: HASH } });
  f.setMission(mission({ state: 'draft', revision: 2 }));
  await f.service.publishMission({ ...meta, missionId: 'mission-1', input: { applicationClosesAt: 50_000, publicDocument: { title: 'Mission One' }, privateDocument: { scope: 'private' }, commitmentHash: HASH } });
  f.setMission(mission({ state: 'draft', revision: 2 }));
  await f.service.cancelMission({ ...meta, missionId: 'mission-1', input: { publicDocument: { title: 'Mission One' }, privateDocument: { scope: 'private' }, commitmentHash: HASH } });
  assert.deepEqual(f.calls.filter(([name]) => name === 'updateMission').map(([, call]) => call.operationKind), ['update_draft', 'publish_mission', 'cancel_mission']);
});

test('command methods enforce current-wallet roles and call custody, chain, runtime, and XMTP ports', async () => {
  const f = fixture();
  const commands = [
    ['applyToMission', { ...meta, actorAddress: OTHER, missionId: 'mission-1', input: { application: { proposedRole: 'builder' } } }],
    ['withdrawApplication', { ...meta, actorAddress: OTHER, missionId: 'mission-1', applicationId: 'app-1', input: {} }],
    ['selectTeam', { ...meta, missionId: 'mission-1', input: { selection: { leadApprovalAddress: LEAD, members: [] } } }],
    ['signLaunchTerms', { ...meta, actorAddress: LEAD, missionId: 'mission-1', input: { signature: '0xsigned' } }],
    ['publishLaunchManifest', { ...meta, missionId: 'mission-1', input: { manifest: { termsHash: HASH } } }],
    ['prepareVault', { ...meta, missionId: 'mission-1', input: { vault: { versionId: HASH } } }],
    ['retryLaunch', { ...meta, missionId: 'mission-1', input: { launch: { operationId: 'launch-1' } } }],
    ['refundLaunch', { ...meta, actorAddress: OTHER, missionId: 'mission-1', input: { refund: {} } }],
    ['fundMission', { ...meta, missionId: 'mission-1', input: { funding: { asset: OTHER, amountRaw: '1' } } }],
    ['reconcileMission', { ...meta, actorAddress: OTHER, missionId: 'mission-1', input: { transaction: { hash: '0xabc' } } }],
    ['createTask', { ...meta, actorAddress: LEAD, missionId: 'mission-1', input: { task: { title: 'Do it' } } }],
    ['assignTask', { ...meta, actorAddress: LEAD, missionId: 'mission-1', taskId: 'task-1', input: { assignment: { memberId: 'member-1' } } }],
    ['updateTask', { ...meta, actorAddress: MEMBER, missionId: 'mission-1', taskId: 'task-1', input: { patch: { status: 'doing' } } }],
    ['submitArtifact', { ...meta, actorAddress: MEMBER, missionId: 'mission-1', input: { artifact: { contentHash: HASH } } }],
    ['approveMilestone', { ...meta, missionId: 'mission-1', milestoneId: 'mile-1', input: { approval: { artifactHash: HASH } } }],
    ['releaseMilestone', { ...meta, actorAddress: OTHER, missionId: 'mission-1', milestoneId: 'mile-1', input: { release: {} } }],
    ['openDispute', { ...meta, actorAddress: LEAD, missionId: 'mission-1', milestoneId: 'mile-1', input: { dispute: { evidenceHash: HASH } } }],
    ['prepareArbitration', { ...meta, actorAddress: ARBITRATOR, missionId: 'mission-1', milestoneId: 'mile-1', disputeId: 'disp-1', input: { resolution: { evidenceHash: HASH } } }],
  ];
  for (const [name, input] of commands) assert.equal((await f.service[name](input)).missionId, 'mission-1');
  assert.ok(f.calls.some(([name]) => name === 'custody.verifyCurrent'));
  assert.ok(f.calls.some(([name]) => name.startsWith('chain.')));
  assert.equal(f.calls.find(([name]) => name === 'chain.prepareLaunchSignature')[1].input.signature, '0xsigned');
  assert.equal(f.calls.find(([name]) => name === 'runtime.assignTask')[1].taskId, 'task-1');
  assert.equal(f.calls.find(([name]) => name === 'chain.prepareApproval')[1].milestoneId, 'mile-1');
  const arbitration = f.calls.find(([name]) => name === 'chain.prepareArbitration')[1];
  assert.equal(arbitration.milestoneId, 'mile-1');
  assert.equal(arbitration.disputeId, 'disp-1');
  assert.ok(f.calls.some(([name]) => name.startsWith('runtime.')));
  assert.ok(f.calls.some(([name]) => name === 'xmtp.publishEvent'));

  await assert.rejects(() => f.service.withdrawApplication({ ...meta, actorAddress: OWNER, missionId: 'mission-1', applicationId: 'app-1', input: {} }), (error) => error.code === 'mission_forbidden');
  await assert.rejects(() => f.service.selectTeam({ ...meta, actorAddress: OTHER, missionId: 'mission-1', input: { selection: {} } }), (error) => error.code === 'mission_forbidden');
  await assert.rejects(() => f.service.createTask({ ...meta, actorAddress: MEMBER, missionId: 'mission-1', input: { task: {} } }), (error) => error.code === 'mission_forbidden');
});

test('authenticated reads allow only current mission parties', async () => {
  const f = fixture();
  assert.equal((await f.service.readLaunchTerms({ missionId: 'mission-1', actorAddress: LEAD })).termsHash, HASH);
  assert.equal((await f.service.readWorkspace({ missionId: 'mission-1', actorAddress: MEMBER })).missionId, 'mission-1');
  assert.equal((await f.service.readDispute({ missionId: 'mission-1', milestoneId: 'mile-1', disputeId: 'disp-1', actorAddress: OWNER })).disputeId, 'disp-1');
  assert.equal((await f.service.readDispute({ missionId: 'mission-1', milestoneId: 'mile-1', disputeId: 'disp-1', actorAddress: ARBITRATOR })).disputeId, 'disp-1');
  await assert.rejects(() => f.service.readWorkspace({ missionId: 'mission-1', actorAddress: OTHER }), (error) => error.code === 'mission_forbidden');
});
