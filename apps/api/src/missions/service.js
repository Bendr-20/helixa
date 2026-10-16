import { assertMissionTransition } from './domain.js';

const ADDRESS = /^0x[a-fA-F0-9]{40}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const HASH = /^[a-fA-F0-9]{64}$/u;
const PUBLIC_TOP_LEVEL = Object.freeze([
  'missionId', 'state', 'revision', 'publicSummary', 'applicationClosesAt', 'launchDeadline',
  'createdAt', 'updatedAt', 'ownerIdentity', 'publicDocument', 'funding', 'lifecycle',
  'milestones', 'requiredRoles', 'bounty', 'trustContext',
]);
const PUBLIC_PRIVATE_KEY = /(?:^|_)(?:applications?|private(?:scope|document|spec)?|contact(?:data|email|route)?|conversation(?:id)?|manager(?:location|url|host|port|token|instanceid)?|evidence(?:underreview)?|operationid|applicationid|memberid|receiptid|taskid|artifactid|disputeid|runtimebindingid|internalid|credential|secret|signature|api[_-]?key|private[_-]?key)(?:$|_)/iu;
const PRIVATE_SECRET_KEY = /(?:credential|secret|signature|api[_-]?key|private[_-]?key|walletprivatekey|managertoken|sessiontoken|authorization)/iu;
const MAX_PROJECTION_NODES = 10_000;

export class MissionServiceError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'MissionServiceError';
    this.code = code;
    this.status = status;
  }
}

export function createMissionService({ repository, custody, chain, runtime, xmtp } = {}) {
  requireMethod(repository, 'readMission', 'repository');
  const dependencies = { repository, custody: custody ?? {}, chain: chain ?? {}, runtime: runtime ?? {}, xmtp: xmtp ?? {} };

  return Object.freeze({
    async listPublicMissions(query = {}) {
      const normalized = normalizeListQuery(query);
      requireMethod(repository, 'listMissions', 'repository');
      const value = await repository.listMissions(normalized);
      const missions = Array.isArray(value) ? value : value?.missions;
      if (!Array.isArray(missions) || missions.length > normalized.limit) throw unavailable('Mission repository returned an invalid page.');
      const projected = [];
      for (const mission of missions) projected.push(projectPublicMission(await hydrateMission(repository, mission)));
      return Object.freeze({ missions: Object.freeze(projected), nextCursor: normalizeOptionalCursor(Array.isArray(value) ? null : value?.nextCursor) });
    },

    async getPublicMission({ missionId } = {}) {
      return projectPublicMission(await loadMission(repository, missionId));
    },

    async createMission(command = {}) {
      const metadata = normalizeMutation(command, { create: true });
      if (metadata.expectedRevision !== 0) throw conflict('New missions require expected revision zero.');
      const input = command.input;
      assertPlainObject(input, 'mission input');
      requireExactKeys(input, ['commitmentHash', 'missionId', 'privateDocument', 'privateSpecHash', 'publicDocument', 'publicSummary', 'refundAddress', 'termsHash'], 'mission input');
      requireMethod(repository, 'createDraft', 'repository');
      return repository.createDraft({
        missionId: identifier(input.missionId, 'missionId'),
        ownerAddress: metadata.actorAddress,
        refundAddress: address(input.refundAddress, 'refundAddress'),
        publicSummary: boundedString(input.publicSummary, 'publicSummary', 1, 4096),
        publicDocument: cloneJson(input.publicDocument, { label: 'publicDocument' }),
        privateDocument: cloneJson(input.privateDocument, { label: 'privateDocument' }),
        privateSpecHash: hash(input.privateSpecHash, 'privateSpecHash'),
        termsHash: hash(input.termsHash, 'termsHash'),
        commitmentHash: hash(input.commitmentHash, 'commitmentHash'),
        idempotencyKey: metadata.idempotencyKey,
        body: cloneJson(input, { label: 'mission input' }),
      });
    },

    updateMission(command) {
      return updateLifecycle(dependencies, command, {
        action: 'update_draft', operationKind: 'update_draft', eventType: 'mission_updated',
        states: ['draft'], patch: (input) => cloneJson(input.patch, { label: 'mission patch' }),
      });
    },

    publishMission(command) {
      return updateLifecycle(dependencies, command, {
        action: 'publish_mission', operationKind: 'publish_mission', eventType: 'mission_published',
        states: ['draft'], to: 'recruiting',
        patch: (input) => ({ state: 'recruiting', applicationClosesAt: nonNegativeInteger(input.applicationClosesAt, 'applicationClosesAt') }),
      });
    },

    cancelMission(command) {
      return updateLifecycle(dependencies, command, {
        action: 'cancel_mission', operationKind: 'cancel_mission', eventType: 'mission_cancelled',
        states: ['draft', 'recruiting'], to: 'cancelled', patch: () => ({ state: 'cancelled' }),
      });
    },

    async applyToMission(command) {
      return executeCommand(dependencies, command, { action: 'apply_to_mission', custodyBoundary: 'application', eventType: 'application_submitted' });
    },

    async withdrawApplication(command) {
      const applicationId = identifier(command?.applicationId, 'applicationId');
      const actorAddress = normalizeActor(command?.actorAddress);
      requireMethod(repository, 'readApplication', 'repository');
      const application = await repository.readApplication({ missionId: identifier(command?.missionId, 'missionId'), applicationId });
      if (!application) throw new MissionServiceError('application_not_found', 'Mission application not found.', 404);
      const applicantAddress = normalizeAddress(application.applicantAddress ?? application.ownerAddress ?? application.controllerAddress);
      if (applicantAddress !== actorAddress) throw forbidden('Current wallet is not authorized to withdraw this application.');
      return executeCommand(dependencies, command, { action: 'withdraw_application', eventType: 'application_withdrawn' });
    },

    async selectTeam(command) {
      return executeCommand(dependencies, command, { action: 'select_team', roles: ['owner'], custodyBoundary: 'team_selection', eventType: 'team_selected' });
    },

    async readLaunchTerms(command = {}) {
      const mission = await requireParty(repository, command);
      requireMethod(repository, 'readLaunchTerms', 'repository');
      return projectPrivateMission(await repository.readLaunchTerms({ missionId: mission.missionId, actorAddress: normalizeActor(command.actorAddress) }));
    },

    async signLaunchTerms(command) {
      return executeCommand(dependencies, command, { action: 'sign_launch_terms', roles: ['owner', 'lead', 'participant'], chainMethod: 'prepareLaunchSignature', eventType: 'launch_terms_signed' });
    },

    async fundMission(command) {
      return executeCommand(dependencies, command, { action: 'fund_mission', roles: ['owner'], custodyBoundary: 'funding', chainMethod: 'prepareFunding', eventType: 'funding_prepared' });
    },

    async reconcileMission(command) {
      return executeCommand(dependencies, command, { action: 'reconcile_mission', roles: ['permissionless'], chainMethod: 'reconcile', eventType: 'chain_reconciliation_requested' });
    },

    async readWorkspace(command = {}) {
      const mission = await requireParty(repository, command);
      const actorAddress = normalizeActor(command.actorAddress);
      const method = typeof runtime.readWorkspace === 'function' ? runtime.readWorkspace.bind(runtime) : repository.readWorkspace?.bind(repository);
      if (!method) throw unavailable('Mission workspace is unavailable.');
      const workspace = await method({ missionId: mission.missionId, actorAddress });
      return projectPrivateMission({ missionId: mission.missionId, ...workspace });
    },

    async createTask(command) {
      return executeCommand(dependencies, command, { action: 'create_task', roles: ['lead'], custodyBoundary: 'task_assignment', runtimeMethod: 'createTask', eventType: 'task_created' });
    },

    async submitArtifact(command) {
      return executeCommand(dependencies, command, { action: 'submit_artifact', roles: ['lead', 'participant'], custodyBoundary: 'artifact_acceptance', runtimeMethod: 'submitArtifact', eventType: 'artifact_submitted' });
    },

    async approveMilestone(command) {
      identifier(command?.milestoneId, 'milestoneId');
      return executeCommand(dependencies, command, { action: 'approve_milestone', roles: ['owner', 'lead'], custodyBoundaryForNonOwner: 'artifact_acceptance', chainMethod: 'prepareApproval', eventType: 'milestone_approved' });
    },

    async releaseMilestone(command) {
      identifier(command?.milestoneId, 'milestoneId');
      return executeCommand(dependencies, command, { action: 'release_milestone', roles: ['permissionless'], chainMethod: 'prepareRelease', eventType: 'milestone_release_requested' });
    },

    async openDispute(command) {
      identifier(command?.milestoneId, 'milestoneId');
      return executeCommand(dependencies, command, { action: 'open_dispute', roles: ['owner', 'lead'], chainMethod: 'prepareDispute', eventType: 'dispute_opened' });
    },

    async readDispute(command = {}) {
      const mission = await requireParty(repository, command);
      requireMethod(repository, 'readDispute', 'repository');
      return projectPrivateMission(await repository.readDispute({
        missionId: mission.missionId,
        milestoneId: identifier(command.milestoneId, 'milestoneId'),
        disputeId: identifier(command.disputeId, 'disputeId'),
        actorAddress: normalizeActor(command.actorAddress),
      }));
    },
  });
}

async function updateLifecycle(deps, command = {}, definition) {
  const metadata = normalizeMutation(command);
  const mission = await loadMission(deps.repository, command.missionId);
  requireRole(mission, metadata.actorAddress, ['owner']);
  if (mission.revision !== metadata.expectedRevision) throw conflict('Mission revision conflict.');
  if (!definition.states.includes(mission.state)) throw conflict('Mission action is invalid in the current state.');
  const input = command.input;
  assertPlainObject(input, 'mission input');
  requireExactKeys(input, definition.action === 'update_draft'
    ? ['commitmentHash', 'patch', 'privateDocument', 'publicDocument']
    : definition.action === 'publish_mission'
      ? ['applicationClosesAt', 'commitmentHash', 'privateDocument', 'publicDocument']
      : ['commitmentHash', 'privateDocument', 'publicDocument'], 'mission input');
  if (definition.to) assertMissionTransition({ from: mission.state, to: definition.to });
  const patch = definition.patch(input);
  requireMethod(deps.repository, 'updateMission', 'repository');
  const result = await deps.repository.updateMission({
    missionId: mission.missionId,
    expectedRevision: metadata.expectedRevision,
    idempotencyKey: metadata.idempotencyKey,
    operationKind: definition.operationKind,
    body: cloneJson(input, { label: 'mission input' }),
    patch,
    publicDocument: cloneJson(input.publicDocument, { label: 'publicDocument' }),
    privateDocument: cloneJson(input.privateDocument, { label: 'privateDocument' }),
    eventType: definition.eventType,
    commitmentHash: hash(input.commitmentHash, 'commitmentHash'),
  });
  await notify(deps.xmtp, mission.missionId, definition.eventType, result);
  return result;
}

async function executeCommand(deps, command = {}, definition) {
  const metadata = normalizeMutation(command);
  const mission = await loadMission(deps.repository, command.missionId);
  if (mission.revision !== metadata.expectedRevision) throw conflict('Mission revision conflict.');
  if (definition.roles) requireRole(mission, metadata.actorAddress, definition.roles);
  if (definition.custodyBoundary || (definition.custodyBoundaryForNonOwner && metadata.actorAddress !== normalizeAddress(mission.ownerAddress))) {
    const boundary = definition.custodyBoundary ?? definition.custodyBoundaryForNonOwner;
    requireMethod(deps.custody, 'verifyCurrent', 'custody');
    const evidence = await deps.custody.verifyCurrent({ boundary, mission, actorAddress: metadata.actorAddress, input: cloneJson(command.input, { label: 'mission input' }) });
    if (normalizeAddress(evidence?.ownerAddress ?? metadata.actorAddress) !== metadata.actorAddress || evidence?.eligible === false) {
      throw forbidden('Current wallet does not control an eligible Looper identity.');
    }
  }
  let dependencyResult;
  if (definition.chainMethod) {
    requireMethod(deps.chain, definition.chainMethod, 'chain');
    dependencyResult = await deps.chain[definition.chainMethod]({ mission, actorAddress: metadata.actorAddress, input: cloneJson(command.input, { label: 'mission input' }) });
  }
  if (definition.runtimeMethod) {
    requireMethod(deps.runtime, definition.runtimeMethod, 'runtime');
    dependencyResult = await deps.runtime[definition.runtimeMethod]({ mission, actorAddress: metadata.actorAddress, input: cloneJson(command.input, { label: 'mission input' }) });
  }
  requireMethod(deps.repository, 'executeCommand', 'repository');
  const result = await deps.repository.executeCommand({
    action: definition.action,
    missionId: mission.missionId,
    expectedRevision: metadata.expectedRevision,
    idempotencyKey: metadata.idempotencyKey,
    actorAddress: metadata.actorAddress,
    ...(command.applicationId ? { applicationId: identifier(command.applicationId, 'applicationId') } : {}),
    ...(command.milestoneId ? { milestoneId: identifier(command.milestoneId, 'milestoneId') } : {}),
    input: cloneJson(command.input, { label: 'mission input' }),
    dependencyResult: dependencyResult === undefined ? null : cloneJson(dependencyResult, { label: 'dependency result' }),
  });
  await notify(deps.xmtp, mission.missionId, definition.eventType, result);
  return result;
}

async function notify(xmtp, missionId, eventType, result) {
  if (typeof xmtp?.publishEvent === 'function') await xmtp.publishEvent({ missionId, eventType, result });
}

async function loadMission(repository, value) {
  const missionId = identifier(value, 'missionId');
  const mission = await repository.readMission(missionId);
  if (!mission) throw new MissionServiceError('mission_not_found', 'Mission not found.', 404);
  return hydrateMission(repository, mission);
}

async function hydrateMission(repository, mission) {
  if (mission?.publicDocument !== undefined || typeof repository.readRevision !== 'function') return mission;
  const revision = await repository.readRevision(mission.missionId, mission.revision);
  return revision ? { ...mission, publicDocument: revision.publicDocument, privateDocument: revision.privateDocument } : mission;
}

async function requireParty(repository, command) {
  const mission = await loadMission(repository, command.missionId);
  requireRole(mission, normalizeActor(command.actorAddress), ['owner', 'lead', 'participant']);
  return mission;
}

function requireRole(mission, actorAddress, allowed) {
  if (allowed.includes('permissionless')) return 'permissionless';
  const actor = normalizeActor(actorAddress);
  const roles = [];
  if (normalizeAddress(mission.ownerAddress) === actor) roles.push('owner');
  if (normalizeAddress(mission.leadApprovalAddress) === actor) roles.push('lead');
  const participants = Array.isArray(mission.participantAddresses) ? mission.participantAddresses : [];
  if (participants.some((value) => normalizeAddress(value) === actor)) roles.push('participant');
  const role = allowed.find((candidate) => roles.includes(candidate));
  if (!role) throw forbidden('Current wallet is not authorized for this mission action.');
  return role;
}

function normalizeMutation(command, { create = false } = {}) {
  assertPlainObject(command, 'mission command');
  const actorAddress = normalizeActor(command.actorAddress);
  const expectedRevision = nonNegativeInteger(command.expectedRevision, 'expectedRevision');
  const idempotencyKey = String(command.idempotencyKey ?? '');
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) throw new MissionServiceError('invalid_idempotency_key', 'Idempotency key is invalid.');
  if (!create) identifier(command.missionId, 'missionId');
  return { actorAddress, expectedRevision, idempotencyKey };
}

function normalizeListQuery(query) {
  assertPlainObject(query, 'mission query');
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new MissionServiceError('invalid_request', 'Mission list limit must be between 1 and 100.');
  const state = query.state === undefined || query.state === null ? null : boundedString(query.state, 'state', 1, 64);
  return Object.freeze({ state, limit, cursor: normalizeOptionalCursor(query.cursor) });
}

function normalizeOptionalCursor(value) {
  if (value === undefined || value === null || value === '') return null;
  return boundedString(value, 'cursor', 1, 256);
}

export function projectPublicMission(value) {
  assertPlainObject(value, 'mission');
  if (typeof value.publicSummary === 'string' && value.publicSummary.length > 4096) throw new TypeError('Mission public summary is too large.');
  const output = {};
  for (const key of PUBLIC_TOP_LEVEL) {
    if (!Object.hasOwn(value, key) || value[key] === undefined) continue;
    output[key] = sanitizeProjection(value[key], { publicMode: true, redactSecrets: true, path: key, seen: new WeakSet(), budget: { count: 0 } });
  }
  return deepFreeze(output);
}

export function projectPrivateMission(value) {
  return deepFreeze(sanitizeProjection(value, { publicMode: false, redactSecrets: true, path: 'mission', seen: new WeakSet(), budget: { count: 0 } }));
}

function sanitizeProjection(value, context) {
  context.budget.count += 1;
  if (context.budget.count > MAX_PROJECTION_NODES) throw new TypeError('Mission projection is too large.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Mission projection must contain plain JSON values.');
    return value;
  }
  if (typeof value !== 'object') throw new TypeError('Mission projection must contain plain JSON values.');
  if (context.seen.has(value)) throw new TypeError('Mission projection contains a cyclic value.');
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError('Mission projection must contain plain JSON values.');
  context.seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((entry, index) => sanitizeProjection(entry, { ...context, path: context.path + '[' + index + ']' }));
    const output = {};
    for (const [key, entry] of Object.entries(value)) {
      const normalizedKey = key.replace(/[^a-z0-9_]/giu, '').toLowerCase();
      if ((context.publicMode && PUBLIC_PRIVATE_KEY.test(normalizedKey)) || (context.redactSecrets && PRIVATE_SECRET_KEY.test(normalizedKey))) continue;
      output[key] = sanitizeProjection(entry, { ...context, path: context.path + '.' + key });
    }
    return output;
  } finally {
    context.seen.delete(value);
  }
}

function cloneJson(value, { label }) {
  try { return sanitizeProjection(value, { publicMode: false, redactSecrets: false, path: label, seen: new WeakSet(), budget: { count: 0 } }); }
  catch (error) { throw new TypeError(label + ' must contain plain JSON: ' + error.message); }
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) throw new MissionServiceError('invalid_request', label + ' fields are invalid.');
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(label + ' must be a plain object.');
}
function requireMethod(value, method, label) { if (typeof value?.[method] !== 'function') throw unavailable(label + ' port is unavailable: ' + method + '.'); }
function identifier(value, label) { if (typeof value !== 'string' || !ID.test(value)) throw new MissionServiceError('invalid_request', label + ' is invalid.'); return value; }
function address(value, label) { if (typeof value !== 'string' || !ADDRESS.test(value)) throw new MissionServiceError('invalid_request', label + ' is invalid.'); return value.toLowerCase(); }
function normalizeAddress(value) { return typeof value === 'string' && ADDRESS.test(value) ? value.toLowerCase() : null; }
function normalizeActor(value) { return address(value, 'actorAddress'); }
function hash(value, label) { if (typeof value !== 'string' || !HASH.test(value)) throw new MissionServiceError('invalid_request', label + ' is invalid.'); return value.toLowerCase(); }
function nonNegativeInteger(value, label) { if (!Number.isSafeInteger(value) || value < 0) throw new MissionServiceError('invalid_request', label + ' must be a non-negative integer.'); return value; }
function boundedString(value, label, min, max) { if (typeof value !== 'string' || value.length < min || value.length > max) throw new MissionServiceError('invalid_request', label + ' is invalid.'); return value; }
function forbidden(message) { return new MissionServiceError('mission_forbidden', message, 403); }
function conflict(message) { return new MissionServiceError('mission_conflict', message, 409); }
function unavailable(message) { return new MissionServiceError('mission_unavailable', message, 503); }
function deepFreeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; }
