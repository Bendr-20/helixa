import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MissionDomainError,
  assertJointDisputeSettlement,
  assertMissionTransition,
  assertStableMissionParties,
  authorizeMissionAction,
  custodyVerificationBoundaries,
  evaluateCustodyBoundary,
} from '../src/missions/domain.js';

const OWNER = '0x0000000000000000000000000000000000000001';
const LEAD = '0x0000000000000000000000000000000000000002';
const CONTRIBUTOR = '0x0000000000000000000000000000000000000003';
const ARBITRATOR = '0x0000000000000000000000000000000000000004';
const LOOPER_ACCOUNT = '0x0000000000000000000000000000000000000011';
const OTHER_ACCOUNT = '0x0000000000000000000000000000000000000012';

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof MissionDomainError && error.code === code);
}

function snapshot(overrides = {}) {
  return {
    chainId: 8453,
    collection: '0x0000000000000000000000000000000000000100',
    tokenId: '7',
    canonicalAccount: LOOPER_ACCOUNT,
    ownerAddress: OWNER,
    controllerAddress: OWNER,
    custodyEpoch: 4,
    settlementAddress: CONTRIBUTOR,
    ...overrides,
  };
}

function current(overrides = {}) {
  return {
    ...snapshot(),
    tokenExists: true,
    accountCodeValid: true,
    eligible: true,
    blocked: false,
    runtimeActive: true,
    ...overrides,
  };
}

test('mission lifecycle decisions are closed and keep dispute out of mission state', () => {
  assert.deepEqual(assertMissionTransition({ from: 'draft', to: 'recruiting' }), { from: 'draft', to: 'recruiting' });
  assert.deepEqual(assertMissionTransition({ from: 'launching', to: 'active' }), { from: 'launching', to: 'active' });
  assert.deepEqual(assertMissionTransition({ from: 'active', to: 'review' }), { from: 'active', to: 'review' });
  assert.deepEqual(assertMissionTransition({ from: 'review', to: 'settled' }), { from: 'review', to: 'settled' });
  expectCode(() => assertMissionTransition({ from: 'funded', to: 'active' }), 'MISSION_TRANSITION_FORBIDDEN');
  expectCode(() => assertMissionTransition({ from: 'active', to: 'disputed' }), 'MISSION_STATE_UNKNOWN');
  expectCode(() => assertMissionTransition({ from: 'settled', to: 'review' }), 'MISSION_TRANSITION_FORBIDDEN');
});

test('stable party validation requires distinct owner/lead and excludes every NFT-controlled account', () => {
  const result = assertStableMissionParties({
    ownerAddress: OWNER,
    leadApproval: { address: LEAD, authorityKind: 'eoa', followsNftOwnership: false },
    members: [
      {
        memberId: 'lead-looper', isLead: true, canonicalAccount: LOOPER_ACCOUNT,
        settlement: { address: LEAD, authorityKind: 'eoa', followsNftOwnership: false },
      },
      {
        memberId: 'worker-looper', isLead: false, canonicalAccount: OTHER_ACCOUNT,
        settlement: { address: CONTRIBUTOR, authorityKind: 'erc1271', followsNftOwnership: false },
      },
    ],
  });
  assert.equal(result.ownerAddress, OWNER);
  assert.equal(result.leadApprovalAddress, LEAD);
  assert.deepEqual(result.recipientAddresses, [LEAD, CONTRIBUTOR]);

  expectCode(() => assertStableMissionParties({
    ownerAddress: OWNER,
    leadApproval: { address: OWNER, authorityKind: 'eoa', followsNftOwnership: false },
    members: [{ memberId: 'lead', isLead: true, canonicalAccount: LOOPER_ACCOUNT, settlement: { address: CONTRIBUTOR, authorityKind: 'eoa', followsNftOwnership: false } }],
  }), 'OWNER_LEAD_NOT_DISTINCT');

  expectCode(() => assertStableMissionParties({
    ownerAddress: OWNER,
    leadApproval: { address: LOOPER_ACCOUNT, authorityKind: 'erc1271', followsNftOwnership: true },
    members: [{ memberId: 'lead', isLead: true, canonicalAccount: LOOPER_ACCOUNT, settlement: { address: CONTRIBUTOR, authorityKind: 'eoa', followsNftOwnership: false } }],
  }), 'NFT_CONTROLLED_AUTHORITY_FORBIDDEN');

  expectCode(() => assertStableMissionParties({
    ownerAddress: OWNER,
    leadApproval: { address: LEAD, authorityKind: 'eoa', followsNftOwnership: false },
    members: [{ memberId: 'lead', isLead: true, canonicalAccount: LOOPER_ACCOUNT, settlement: { address: LOOPER_ACCOUNT, authorityKind: 'erc1271', followsNftOwnership: true } }],
  }), 'NFT_CONTROLLED_AUTHORITY_FORBIDDEN');
});

test('role matrix uses only predeclared transfer-stable addresses', () => {
  const context = {
    ownerAddress: OWNER,
    leadApprovalAddress: LEAD,
    participantAddresses: [CONTRIBUTOR],
    arbitratorAddress: ARBITRATOR,
  };
  assert.equal(authorizeMissionAction({ ...context, action: 'publish_mission', actorAddress: OWNER }).role, 'owner');
  assert.equal(authorizeMissionAction({ ...context, action: 'assign_task', actorAddress: LEAD }).role, 'lead');
  assert.equal(authorizeMissionAction({ ...context, action: 'submit_artifact', actorAddress: CONTRIBUTOR }).role, 'participant');
  assert.equal(authorizeMissionAction({ ...context, action: 'approve_milestone', actorAddress: OWNER }).role, 'owner');
  assert.equal(authorizeMissionAction({ ...context, action: 'approve_milestone', actorAddress: LEAD }).role, 'lead');
  assert.equal(authorizeMissionAction({ ...context, action: 'resolve_dispute', actorAddress: ARBITRATOR }).role, 'arbitrator');
  assert.equal(authorizeMissionAction({ ...context, action: 'execute_timeout', actorAddress: OTHER_ACCOUNT }).role, 'permissionless');

  expectCode(() => authorizeMissionAction({ ...context, action: 'publish_mission', actorAddress: LEAD }), 'MISSION_ACTION_UNAUTHORIZED');
  expectCode(() => authorizeMissionAction({ ...context, action: 'approve_milestone', actorAddress: LOOPER_ACCOUNT }), 'MISSION_ACTION_UNAUTHORIZED');
  expectCode(() => authorizeMissionAction({ ...context, action: 'invent_action', actorAddress: OWNER }), 'MISSION_ACTION_UNKNOWN');
});

test('joint dispute settlement requires exactly owner and stable lead consent', () => {
  assert.deepEqual(assertJointDisputeSettlement({ signers: [LEAD, OWNER], ownerAddress: OWNER, leadApprovalAddress: LEAD }), {
    ownerAddress: OWNER,
    leadApprovalAddress: LEAD,
  });
  expectCode(() => assertJointDisputeSettlement({ signers: [OWNER], ownerAddress: OWNER, leadApprovalAddress: LEAD }), 'JOINT_SETTLEMENT_CONSENT_MISSING');
  expectCode(() => assertJointDisputeSettlement({ signers: [OWNER, LEAD, CONTRIBUTOR], ownerAddress: OWNER, leadApprovalAddress: LEAD }), 'JOINT_SETTLEMENT_SIGNER_UNKNOWN');
});

test('fresh custody is checked at every named boundary', () => {
  assert.deepEqual(custodyVerificationBoundaries, [
    'application', 'team_selection', 'funding', 'launch', 'task_assignment', 'artifact_acceptance', 'cred_publication',
  ]);
  for (const boundary of custodyVerificationBoundaries) {
    const decision = evaluateCustodyBoundary({ boundary, snapshot: snapshot(), current: current() });
    assert.equal(decision.fresh, true, boundary);
    assert.equal(decision.authorityTransferred, false, boundary);
  }
  expectCode(() => evaluateCustodyBoundary({ boundary: 'unknown', snapshot: snapshot(), current: current() }), 'CUSTODY_BOUNDARY_UNKNOWN');
  expectCode(() => evaluateCustodyBoundary({ boundary: 'launch', snapshot: snapshot(), current: current({ accountCodeValid: false }) }), 'LOOPER_ACCOUNT_INVALID');
  expectCode(() => evaluateCustodyBoundary({ boundary: 'launch', snapshot: snapshot(), current: current({ blocked: true }) }), 'LOOPER_INELIGIBLE');
  expectCode(() => evaluateCustodyBoundary({ boundary: 'task_assignment', snapshot: snapshot(), current: current({ runtimeActive: false }) }), 'LOOPER_RUNTIME_INACTIVE');

  const blockedEvidence = evaluateCustodyBoundary({
    boundary: 'cred_publication',
    snapshot: snapshot(),
    current: current({ eligible: false, blocked: true, runtimeActive: false }),
  });
  assert.deepEqual(blockedEvidence, {
    fresh: true, authorityTransferred: false, workAllowed: false, reviewAllowed: false, alertRequired: true,
    resolution: 'evidence_only', evidenceCustodyEpoch: 4, evidenceSigner: CONTRIBUTOR,
  });
});

test('custody transfer halts new work/review without transferring authority or contribution evidence', () => {
  const transferred = current({
    ownerAddress: '0x0000000000000000000000000000000000000099',
    controllerAddress: '0x0000000000000000000000000000000000000099',
    custodyEpoch: 5,
  });
  for (const boundary of ['application', 'team_selection', 'funding', 'launch', 'task_assignment', 'artifact_acceptance']) {
    expectCode(() => evaluateCustodyBoundary({ boundary, snapshot: snapshot(), current: transferred }), 'CUSTODY_CHANGED');
  }
  const evidence = evaluateCustodyBoundary({ boundary: 'cred_publication', snapshot: snapshot(), current: transferred });
  assert.deepEqual(evidence, {
    fresh: false,
    authorityTransferred: false,
    workAllowed: false,
    reviewAllowed: false,
    alertRequired: true,
    resolution: 'dispute_or_timeout',
    evidenceCustodyEpoch: 4,
    evidenceSigner: CONTRIBUTOR,
  });
});
