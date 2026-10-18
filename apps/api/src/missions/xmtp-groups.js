import { digestMissionBody } from './idempotency.js';

export class MissionXmtpError extends Error {
  constructor(code, message) { super(message); this.name = 'MissionXmtpError'; this.code = code; }
}

export function createMissionXmtpGroups({ primitives, ledger, signMarker, verifyMarker, bridgeIdentifier, bridgeInboxId, now = Date.now } = {}) {
  const required = ['syncGroups', 'listGroups', 'getGroup', 'createGroup', 'describeGroup', 'updatePermissions', 'addAdmin'];
  if (!primitives || required.some((name) => typeof primitives[name] !== 'function')) throw new TypeError('XMTP group primitives are incomplete.');
  if (!ledger || !['acquireLock', 'releaseLock', 'readBinding', 'saveBinding'].every((name) => typeof ledger[name] === 'function')) throw new TypeError('Mission XMTP ledger port is invalid.');
  if (typeof signMarker !== 'function' || typeof verifyMarker !== 'function' || typeof now !== 'function') throw new TypeError('Mission XMTP marker dependencies are invalid.');
  const bridge = normalizeIdentifier(bridgeIdentifier);
  const adminInboxId = bounded(bridgeInboxId, 'bridgeInboxId', 1, 256);

  async function ensureGroup({ missionId, expectedIdentifiers, roomName, policyCommitment } = {}) {
    const mission = identifier(missionId, 'missionId');
    const identifiers = normalizeIdentifiers([...(expectedIdentifiers ?? []), bridge]);
    const memberCommitment = digestMissionBody(identifiers);
    const policyHash = hash(policyCommitment, 'policyCommitment');
    const lock = await ledger.acquireLock({ missionId: mission, purpose: 'xmtp_group' });
    if (!lock) throw new MissionXmtpError('room_locked', 'Mission room operation is already locked.');
    try {
      const existing = await ledger.readBinding({ missionId: mission });
      if (existing) return verifyBound(existing.conversationId, { missionId: mission, identifiers, memberCommitment, policyHash });
      const recovered = await recoverCandidates({ missionId: mission, identifiers, memberCommitment, policyHash });
      if (recovered) return recovered;
      const markerPayload = Object.freeze({
        version: 1, missionId: mission, memberCommitment, policyCommitment: policyHash,
        createdAt: validTimestamp(now()), markerNonce: digestMissionBody({ missionId: mission, memberCommitment, policyHash }),
      });
      const signature = await signMarker(markerPayload);
      const marker = Object.freeze({ ...markerPayload, signature: bounded(signature, 'marker signature', 8, 4096) });
      let created;
      try {
        created = await primitives.createGroup({
          identifiers,
          metadata: {
            name: bounded(roomName, 'roomName', 1, 100),
            description: 'Swarm Command mission ' + mission,
            appData: JSON.stringify({ helixaMissionMarker: marker }),
            permissions: 'admin_only',
          },
        });
      } catch (error) {
        const afterAmbiguity = await recoverCandidates({ missionId: mission, identifiers, memberCommitment, policyHash });
        if (afterAmbiguity) return afterAmbiguity;
        throw new MissionXmtpError('room_create_retryable', 'XMTP room creation is unresolved; retry reconciliation before creating another room.');
      }
      const conversationId = bounded(created?.id, 'conversationId', 1, 512);
      await primitives.updatePermissions(conversationId, closedPermissionUpdates());
      await primitives.addAdmin(conversationId, adminInboxId);
      return verifyAndBind(conversationId, { missionId: mission, identifiers, memberCommitment, policyHash });
    } finally { await ledger.releaseLock({ missionId: mission, token: lock }); }
  }

  async function recoverCandidates(expected) {
    await primitives.syncGroups();
    const groups = await primitives.listGroups();
    const candidates = [];
    for (const group of groups) {
      const description = await primitives.describeGroup(group.id);
      const marker = parseMarker(description.appData);
      if (!marker || marker.missionId !== expected.missionId) continue;
      if (!await verifyMarker(stripSignature(marker), marker.signature)) throw new MissionXmtpError('room_marker_invalid', 'Mission room marker signature is invalid.');
      candidates.push({ description, marker });
    }
    if (candidates.length > 1) throw new MissionXmtpError('room_ambiguous', 'Multiple XMTP rooms claim the same mission.');
    if (candidates.length === 0) return null;
    const candidate = candidates[0];
    if (candidate.marker.memberCommitment !== expected.memberCommitment || candidate.marker.policyCommitment !== expected.policyHash) {
      throw new MissionXmtpError('room_candidate_mismatch', 'Recovered mission room has unexpected membership or policy.');
    }
    await primitives.updatePermissions(candidate.description.conversationId, closedPermissionUpdates());
    await primitives.addAdmin(candidate.description.conversationId, adminInboxId);
    return verifyAndBind(candidate.description.conversationId, expected);
  }

  async function verifyBound(conversationId, expected) { return verifyAndBind(conversationId, expected, false); }

  async function verifyAndBind(conversationId, expected, save = true) {
    const description = await primitives.describeGroup(conversationId);
    const observed = normalizeObservedIdentifiers(description.members);
    if (JSON.stringify(observed) !== JSON.stringify(expected.identifiers)) throw new MissionXmtpError('room_membership_mismatch', 'XMTP room membership is not exact.');
    if (!closedPermissions(description.permissions)) throw new MissionXmtpError('room_permissions_open', 'XMTP room permissions are not closed.');
    if (!description.admins.includes(adminInboxId) && !description.superAdmins.includes(adminInboxId)) throw new MissionXmtpError('room_bridge_not_admin', 'Mission bridge is not an XMTP room admin.');
    const marker = parseMarker(description.appData);
    if (!marker || marker.missionId !== expected.missionId || marker.memberCommitment !== expected.memberCommitment || marker.policyCommitment !== expected.policyHash || !await verifyMarker(stripSignature(marker), marker.signature)) {
      throw new MissionXmtpError('room_marker_invalid', 'XMTP room marker is missing or invalid.');
    }
    const binding = Object.freeze({
      missionId: expected.missionId, conversationId: description.conversationId,
      memberCommitment: expected.memberCommitment, policyCommitment: expected.policyHash,
    });
    if (save) await ledger.saveBinding(binding);
    return binding;
  }

  return Object.freeze({ ensureGroup });
}

function closedPermissionUpdates() {
  return Object.freeze([
    Object.freeze({ permissionType: 'add_member', policy: 'admin' }),
    Object.freeze({ permissionType: 'remove_member', policy: 'admin' }),
    Object.freeze({ permissionType: 'update_metadata', policy: 'admin' }),
  ]);
}
function closedPermissions(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.policyType === 'admin_only') return true;
  const policies = value.policySet ?? value;
  const text = JSON.stringify(policies).toLowerCase();
  return !text.includes('allow') && (text.includes('admin') || text.includes('super'));
}
function normalizeObservedIdentifiers(members) {
  if (!Array.isArray(members)) throw new MissionXmtpError('room_membership_invalid', 'XMTP member list is invalid.');
  const values = [];
  for (const member of members) {
    const identifiers = member.accountIdentifiers ?? member.identifiers ?? [];
    for (const value of identifiers) values.push(normalizeIdentifier(value));
  }
  return normalizeIdentifiers(values);
}
function normalizeIdentifiers(values) {
  if (!Array.isArray(values) || values.length < 2 || values.length > 9) throw new TypeError('XMTP mission identifiers are invalid.');
  const normalized = values.map(normalizeIdentifier).sort((a, b) => a.identifierKind - b.identifierKind || a.identifier.localeCompare(b.identifier));
  const keys = normalized.map((value) => value.identifierKind + ':' + value.identifier);
  if (new Set(keys).size !== keys.length) throw new TypeError('XMTP mission identifiers contain duplicates.');
  return Object.freeze(normalized);
}
function normalizeIdentifier(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('XMTP identifier is invalid.');
  const identifierKind = Number(value.identifierKind);
  if (!Number.isSafeInteger(identifierKind) || identifierKind < 0 || identifierKind > 255) throw new TypeError('XMTP identifier kind is invalid.');
  const identifierValue = bounded(value.identifier, 'XMTP identifier', 1, 256).toLowerCase();
  return Object.freeze({ identifierKind, identifier: identifierValue });
}
function parseMarker(appData) { try { const value = JSON.parse(String(appData)); return value?.helixaMissionMarker ?? null; } catch { return null; } }
function stripSignature(marker) { const { signature, ...payload } = marker; return Object.freeze(payload); }
function hash(value, label) { if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function identifier(value, label) { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) throw new TypeError(label + ' is invalid.'); return value; }
function bounded(value, label, min, max) { if (typeof value !== 'string' || value.length < min || value.length > max) throw new TypeError(label + ' is invalid.'); return value; }
function validTimestamp(value) { if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('XMTP marker timestamp is invalid.'); return value; }
