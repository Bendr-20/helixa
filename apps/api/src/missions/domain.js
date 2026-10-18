import { canTransitionMission, missionStates } from '../../../../packages/types/src/missions.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const AUTHORITY_KINDS = new Set(['eoa', 'erc1271']);
const WORK_BOUNDARIES = new Set(['application', 'team_selection', 'funding', 'launch', 'task_assignment']);

export const custodyVerificationBoundaries = Object.freeze([
  'application',
  'team_selection',
  'funding',
  'launch',
  'task_assignment',
  'artifact_acceptance',
  'cred_publication',
]);

const ACTION_ROLES = Object.freeze({
  update_draft: Object.freeze(['owner']),
  publish_mission: Object.freeze(['owner']),
  cancel_mission: Object.freeze(['owner']),
  select_team: Object.freeze(['owner']),
  prepare_funding: Object.freeze(['owner']),
  create_task: Object.freeze(['lead']),
  assign_task: Object.freeze(['lead']),
  pause_mission: Object.freeze(['owner', 'lead']),
  update_task: Object.freeze(['lead', 'participant']),
  submit_artifact: Object.freeze(['lead', 'participant']),
  approve_milestone: Object.freeze(['owner', 'lead']),
  open_dispute: Object.freeze(['owner', 'lead']),
  resolve_dispute: Object.freeze(['arbitrator']),
  execute_release: Object.freeze(['permissionless']),
  execute_timeout: Object.freeze(['permissionless']),
  execute_refund: Object.freeze(['permissionless']),
  reconcile_chain: Object.freeze(['permissionless']),
});

export class MissionDomainError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MissionDomainError';
    this.code = code;
  }
}

export function assertMissionTransition({ from, to } = {}) {
  if (!missionStates.includes(from) || !missionStates.includes(to)) {
    throw ruleError('MISSION_STATE_UNKNOWN', 'Mission lifecycle state is unknown.');
  }
  if (!canTransitionMission(from, to)) {
    throw ruleError('MISSION_TRANSITION_FORBIDDEN', 'Mission lifecycle transition is forbidden: ' + from + ' -> ' + to + '.');
  }
  return Object.freeze({ from, to });
}

export function assertStableMissionParties({ ownerAddress, leadApproval, members } = {}) {
  const owner = address(ownerAddress, 'ownerAddress');
  const lead = normalizeAuthority(leadApproval, 'leadApproval');
  if (owner === lead.address) throw ruleError('OWNER_LEAD_NOT_DISTINCT', 'Mission owner and lead approval address must differ.');
  if (!Array.isArray(members) || members.length < 1 || members.length > 8) {
    throw ruleError('PARTY_SET_INVALID', 'Mission members must contain between one and eight entries.');
  }

  const normalizedMembers = members.map((member, index) => normalizeMember(member, index));
  const accounts = new Set();
  const memberIds = new Set();
  let leadCount = 0;
  for (const member of normalizedMembers) {
    if (accounts.has(member.canonicalAccount) || memberIds.has(member.memberId)) {
      throw ruleError('PARTY_SET_INVALID', 'Mission member identities must be unique.');
    }
    accounts.add(member.canonicalAccount);
    memberIds.add(member.memberId);
    if (member.isLead) leadCount += 1;
  }
  if (leadCount !== 1) throw ruleError('PARTY_SET_INVALID', 'Mission must have exactly one lead Looper.');
  if (lead.followsNftOwnership || accounts.has(lead.address)) {
    throw ruleError('NFT_CONTROLLED_AUTHORITY_FORBIDDEN', 'Lead approval authority must not follow Looper NFT ownership.');
  }
  for (const member of normalizedMembers) {
    if (member.settlement.followsNftOwnership || accounts.has(member.settlement.address)) {
      throw ruleError('NFT_CONTROLLED_AUTHORITY_FORBIDDEN', 'Settlement authority must not be an NFT-controlled Looper account.');
    }
  }

  return Object.freeze({
    ownerAddress: owner,
    leadApprovalAddress: lead.address,
    recipientAddresses: Object.freeze([...new Set(normalizedMembers.map((member) => member.settlement.address))]),
    members: Object.freeze(normalizedMembers),
  });
}

export function authorizeMissionAction(input = {}) {
  const roles = ACTION_ROLES[input.action];
  if (!roles) throw ruleError('MISSION_ACTION_UNKNOWN', 'Mission action is unknown.');
  const actor = address(input.actorAddress, 'actorAddress');
  const owner = address(input.ownerAddress, 'ownerAddress');
  const lead = address(input.leadApprovalAddress, 'leadApprovalAddress');
  const arbitrator = address(input.arbitratorAddress, 'arbitratorAddress');
  const participants = normalizeAddressArray(input.participantAddresses, 'participantAddresses');

  if (roles.includes('permissionless')) return Object.freeze({ authorized: true, role: 'permissionless', actorAddress: actor });
  const actorRoles = [];
  if (actor === owner) actorRoles.push('owner');
  if (actor === lead) actorRoles.push('lead');
  if (participants.includes(actor)) actorRoles.push('participant');
  if (actor === arbitrator) actorRoles.push('arbitrator');
  const role = roles.find((candidate) => actorRoles.includes(candidate));
  if (!role) throw ruleError('MISSION_ACTION_UNAUTHORIZED', 'Stable actor is not authorized for mission action: ' + input.action + '.');
  return Object.freeze({ authorized: true, role, actorAddress: actor });
}

export function assertJointDisputeSettlement({ signers, ownerAddress, leadApprovalAddress } = {}) {
  const owner = address(ownerAddress, 'ownerAddress');
  const lead = address(leadApprovalAddress, 'leadApprovalAddress');
  if (owner === lead) throw ruleError('OWNER_LEAD_NOT_DISTINCT', 'Mission owner and lead approval address must differ.');
  const normalized = normalizeAddressArray(signers, 'signers');
  const allowed = new Set([owner, lead]);
  if (normalized.some((signer) => !allowed.has(signer))) {
    throw ruleError('JOINT_SETTLEMENT_SIGNER_UNKNOWN', 'Joint dispute settlement contains an unknown signer.');
  }
  const unique = new Set(normalized);
  if (!unique.has(owner) || !unique.has(lead)) {
    throw ruleError('JOINT_SETTLEMENT_CONSENT_MISSING', 'Joint dispute settlement requires owner and lead consent.');
  }
  return Object.freeze({ ownerAddress: owner, leadApprovalAddress: lead });
}

export function evaluateCustodyBoundary({ boundary, snapshot, current } = {}) {
  if (!custodyVerificationBoundaries.includes(boundary)) {
    throw ruleError('CUSTODY_BOUNDARY_UNKNOWN', 'Custody verification boundary is unknown.');
  }
  const bound = normalizeSnapshot(snapshot, 'snapshot');
  const fresh = normalizeCurrent(current);
  if (!fresh.tokenExists || !fresh.accountCodeValid) {
    throw ruleError('LOOPER_ACCOUNT_INVALID', 'Looper token or canonical account is unavailable or invalid.');
  }
  if (bound.chainId !== fresh.chainId || bound.collection !== fresh.collection || bound.tokenId !== fresh.tokenId || bound.canonicalAccount !== fresh.canonicalAccount) {
    throw ruleError('LOOPER_IDENTITY_MISMATCH', 'Looper canonical identity changed or resolved inconsistently.');
  }

  const custodyChanged = bound.custodyEpoch !== fresh.custodyEpoch
    || bound.ownerAddress !== fresh.ownerAddress
    || bound.controllerAddress !== fresh.controllerAddress;
  if (custodyChanged) {
    const decision = custodyChangeDecision(bound);
    if (boundary === 'cred_publication') return decision;
    throw ruleError('CUSTODY_CHANGED', 'Looper custody changed after mission consent; new work and review are forbidden.');
  }
  if (!fresh.eligible || fresh.blocked) {
    if (boundary === 'cred_publication') return evidenceOnlyDecision(bound);
    throw ruleError('LOOPER_INELIGIBLE', 'Looper is not currently eligible.');
  }
  if (WORK_BOUNDARIES.has(boundary) && !fresh.runtimeActive) {
    throw ruleError('LOOPER_RUNTIME_INACTIVE', 'Looper runtime is not active at the required boundary.');
  }

  return Object.freeze({
    fresh: true,
    authorityTransferred: false,
    workAllowed: true,
    reviewAllowed: true,
    alertRequired: false,
    resolution: null,
    evidenceCustodyEpoch: bound.custodyEpoch,
    evidenceSigner: bound.settlementAddress,
  });
}

function evidenceOnlyDecision(snapshot) {
  return Object.freeze({
    fresh: true,
    authorityTransferred: false,
    workAllowed: false,
    reviewAllowed: false,
    alertRequired: true,
    resolution: 'evidence_only',
    evidenceCustodyEpoch: snapshot.custodyEpoch,
    evidenceSigner: snapshot.settlementAddress,
  });
}

function custodyChangeDecision(snapshot) {
  return Object.freeze({
    fresh: false,
    authorityTransferred: false,
    workAllowed: false,
    reviewAllowed: false,
    alertRequired: true,
    resolution: 'dispute_or_timeout',
    evidenceCustodyEpoch: snapshot.custodyEpoch,
    evidenceSigner: snapshot.settlementAddress,
  });
}

function normalizeAuthority(value, label) {
  assertExactObject(value, ['address', 'authorityKind', 'followsNftOwnership'], label);
  const authorityKind = value.authorityKind;
  if (!AUTHORITY_KINDS.has(authorityKind)) throw ruleError('PARTY_SET_INVALID', label + ' authority kind is invalid.');
  if (typeof value.followsNftOwnership !== 'boolean') throw ruleError('PARTY_SET_INVALID', label + ' ownership behavior is invalid.');
  return Object.freeze({ address: address(value.address, label + '.address'), authorityKind, followsNftOwnership: value.followsNftOwnership });
}

function normalizeMember(value, index) {
  assertExactObject(value, ['canonicalAccount', 'isLead', 'memberId', 'settlement'], 'members[' + index + ']');
  if (typeof value.memberId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value.memberId)) {
    throw ruleError('PARTY_SET_INVALID', 'Mission member ID is invalid.');
  }
  if (typeof value.isLead !== 'boolean') throw ruleError('PARTY_SET_INVALID', 'Mission member lead flag is invalid.');
  return Object.freeze({
    memberId: value.memberId,
    isLead: value.isLead,
    canonicalAccount: address(value.canonicalAccount, 'canonicalAccount'),
    settlement: normalizeAuthority(value.settlement, 'settlement'),
  });
}

function normalizeSnapshot(value, label, includeStatus = false) {
  const keys = ['canonicalAccount', 'chainId', 'collection', 'controllerAddress', 'custodyEpoch', 'ownerAddress', 'settlementAddress', 'tokenId'];
  if (includeStatus) keys.push('accountCodeValid', 'blocked', 'eligible', 'runtimeActive', 'tokenExists');
  assertExactObject(value, keys, label);
  return Object.freeze({
    chainId: positiveInteger(value.chainId, label + '.chainId'),
    collection: address(value.collection, label + '.collection'),
    tokenId: tokenId(value.tokenId, label + '.tokenId'),
    canonicalAccount: address(value.canonicalAccount, label + '.canonicalAccount'),
    ownerAddress: address(value.ownerAddress, label + '.ownerAddress'),
    controllerAddress: address(value.controllerAddress, label + '.controllerAddress'),
    custodyEpoch: nonNegativeInteger(value.custodyEpoch, label + '.custodyEpoch'),
    settlementAddress: address(value.settlementAddress, label + '.settlementAddress'),
  });
}

function normalizeCurrent(value) {
  const normalized = normalizeSnapshot(value, 'current', true);
  for (const key of ['tokenExists', 'accountCodeValid', 'eligible', 'blocked', 'runtimeActive']) {
    if (typeof value[key] !== 'boolean') throw ruleError('CUSTODY_EVIDENCE_INVALID', 'Current custody evidence field is invalid: ' + key + '.');
  }
  return Object.freeze({
    ...normalized,
    tokenExists: value.tokenExists,
    accountCodeValid: value.accountCodeValid,
    eligible: value.eligible,
    blocked: value.blocked,
    runtimeActive: value.runtimeActive,
  });
}

function normalizeAddressArray(value, label) {
  if (!Array.isArray(value) || value.length > 16) throw ruleError('PARTY_SET_INVALID', label + ' must be a bounded array.');
  return Object.freeze(value.map((entry, index) => address(entry, label + '[' + index + ']')));
}

function assertExactObject(value, expectedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw ruleError('PARTY_SET_INVALID', label + ' must be a plain object.');
  }
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== 'string')) throw ruleError('PARTY_SET_INVALID', label + ' fields are invalid.');
  for (const key of actual) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw ruleError('PARTY_SET_INVALID', label + ' must contain enumerable data properties only.');
    }
  }
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expectedKeys].sort();
  if (sortedActual.length !== sortedExpected.length || sortedActual.some((key, index) => key !== sortedExpected[index])) {
    throw ruleError('PARTY_SET_INVALID', label + ' fields are invalid.');
  }
}

function address(value, label) {
  if (typeof value !== 'string' || !/^0x[a-fA-F0-9]{40}$/u.test(value) || value.toLowerCase() === ZERO_ADDRESS) {
    throw ruleError('ADDRESS_INVALID', label + ' is invalid.');
  }
  return value.toLowerCase();
}

function tokenId(value, label) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,77})$/u.test(value)) throw ruleError('CUSTODY_EVIDENCE_INVALID', label + ' is invalid.');
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw ruleError('CUSTODY_EVIDENCE_INVALID', label + ' is invalid.');
  return value;
}

function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw ruleError('CUSTODY_EVIDENCE_INVALID', label + ' is invalid.');
  return value;
}

function ruleError(code, message) {
  return new MissionDomainError(code, message);
}
