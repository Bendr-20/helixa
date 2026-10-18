import {
  assertMissionLedgerSafe,
  canonicalizeMissionJson,
  digestIdempotencyKey,
  digestMissionBody,
} from './idempotency.js';

const PATCH_KEYS = Object.freeze([
  'applicationClosesAt',
  'launchDeadline',
  'leadApprovalAddress',
  'privateSpecHash',
  'publicSummary',
  'state',
  'termsHash',
]);

export function createMissionRepository({ store, createId, now = Date.now } = {}) {
  if (!store || typeof store.transaction !== 'function' || typeof store.readOne !== 'function' || typeof store.readAll !== 'function') {
    throw new TypeError('Mission repository store is invalid.');
  }
  if (typeof createId !== 'function') throw new TypeError('Mission repository createId is required.');
  if (typeof now !== 'function') throw new TypeError('Mission repository clock is invalid.');

  function createDraft(input = {}) {
    assertExactKeys(input, [
      'body', 'commitmentHash', 'idempotencyKey', 'missionId', 'ownerAddress', 'privateDocument', 'privateSpecHash',
      'publicDocument', 'publicSummary', 'refundAddress', 'termsHash',
    ], 'mission draft');
    const missionId = identifier(input.missionId, 'missionId');
    const ownerAddress = address(input.ownerAddress, 'ownerAddress');
    const refundAddress = address(input.refundAddress, 'refundAddress');
    const publicSummary = boundedText(input.publicSummary, 'publicSummary', 1, 4096);
    const privateSpecHash = hash(input.privateSpecHash, 'privateSpecHash');
    const termsHash = hash(input.termsHash, 'termsHash');
    const commitmentHash = hash(input.commitmentHash, 'commitmentHash');
    const documents = prepareDocuments(input.publicDocument, input.privateDocument);
    const idempotencyKeyHash = digestIdempotencyKey(input.idempotencyKey);
    const bodyDigest = digestMissionBody({
      request: input.body,
      mission: { missionId, ownerAddress, refundAddress, publicSummary, privateSpecHash, termsHash, commitmentHash },
      publicDocument: input.publicDocument,
      privateDocument: input.privateDocument,
    });
    return store.transaction('create_mission', (tx) => {
      const existing = tx.get("SELECT body_digest, status, response_json FROM mission_operations WHERE mission_id = ? AND operation_kind = 'create_mission' AND idempotency_key_hash = ?", [missionId, idempotencyKeyHash]);
      if (existing) return replayOperation(existing, bodyDigest);
      if (tx.get('SELECT mission_id FROM missions WHERE mission_id = ?', [missionId])) throw new Error('Mission already exists: ' + missionId + '.');
      const timestamp = timestampNow();
      const operationId = identifier(createId(), 'operationId');
      const response = Object.freeze({ missionId, revision: 0, state: 'draft', eventSequence: 0 });
      const responseJson = canonicalizeMissionJson(response);
      tx.run("INSERT INTO missions (mission_id, owner_address, refund_address, state, revision, public_summary, private_spec_hash, terms_hash, created_at, updated_at) VALUES (?, ?, ?, 'draft', 0, ?, ?, ?, ?, ?)", [
        missionId, ownerAddress, refundAddress, publicSummary, privateSpecHash, termsHash, timestamp, timestamp,
      ]);
      tx.run("INSERT INTO mission_operations (operation_id, mission_id, operation_kind, idempotency_key_hash, body_digest, expected_revision, status, created_at, updated_at) VALUES (?, ?, 'create_mission', ?, ?, 0, 'reserved', ?, ?)", [
        operationId, missionId, idempotencyKeyHash, bodyDigest, timestamp, timestamp,
      ]);
      tx.run('INSERT INTO mission_revisions (mission_id, revision, public_document_json, private_document_json, document_hash, created_at) VALUES (?, 0, ?, ?, ?, ?)', [
        missionId, documents.publicJson, documents.privateJson, documents.documentHash, timestamp,
      ]);
      tx.run("INSERT INTO mission_events (mission_id, sequence, event_type, source, commitment_hash, operation_id, occurred_at) VALUES (?, 0, 'mission_created', 'helixa_ledger', ?, ?, ?)", [
        missionId, commitmentHash, operationId, timestamp,
      ]);
      tx.run("UPDATE mission_operations SET status = 'succeeded', response_json = ?, updated_at = ? WHERE operation_id = ? AND status = 'reserved'", [responseJson, timestamp, operationId]);
      return response;
    });
  }

  function updateMission(input = {}) {
    assertExactKeys(input, [
      'body', 'commitmentHash', 'eventType', 'expectedRevision', 'idempotencyKey', 'missionId',
      'operationKind', 'patch', 'privateDocument', 'publicDocument',
    ], 'mission update');
    const missionId = identifier(input.missionId, 'missionId');
    const expectedRevision = nonNegativeInteger(input.expectedRevision, 'expectedRevision');
    const operationKind = identifier(input.operationKind, 'operationKind');
    const idempotencyKeyHash = digestIdempotencyKey(input.idempotencyKey);
    const patch = normalizePatch(input.patch);
    const documents = prepareDocuments(input.publicDocument, input.privateDocument);
    const eventType = identifier(input.eventType, 'eventType');
    const commitmentHash = hash(input.commitmentHash, 'commitmentHash');
    const bodyDigest = digestMissionBody({
      request: input.body,
      patch,
      publicDocument: input.publicDocument,
      privateDocument: input.privateDocument,
      eventType,
      commitmentHash,
    });

    return store.transaction('update_mission', (tx) => {
      const existing = tx.get('SELECT operation_id, body_digest, expected_revision, status, response_json FROM mission_operations WHERE mission_id = ? AND operation_kind = ? AND idempotency_key_hash = ?', [
        missionId, operationKind, idempotencyKeyHash,
      ]);
      if (existing) {
        if (Number(existing.expected_revision) !== expectedRevision) throw new Error('Idempotency key was reused with a different body or revision.');
        return replayOperation(existing, bodyDigest);
      }

      const current = tx.get('SELECT * FROM missions WHERE mission_id = ?', [missionId]);
      if (!current) throw new Error('Mission not found: ' + missionId + '.');
      if (Number(current.revision) !== expectedRevision) {
        throw new Error('Mission revision conflict: expected ' + expectedRevision + ', found ' + current.revision + '.');
      }

      const timestamp = timestampNow();
      const operationId = identifier(createId(), 'operationId');
      const nextRevision = expectedRevision + 1;
      const eventRow = tx.get('SELECT COALESCE(MAX(sequence), -1) + 1 AS next_sequence FROM mission_events WHERE mission_id = ?', [missionId]);
      const eventSequence = Number(eventRow.next_sequence);
      const next = {
        state: own(patch, 'state') ? patch.state : current.state,
        publicSummary: own(patch, 'publicSummary') ? patch.publicSummary : current.public_summary,
        privateSpecHash: own(patch, 'privateSpecHash') ? patch.privateSpecHash : current.private_spec_hash,
        termsHash: own(patch, 'termsHash') ? patch.termsHash : current.terms_hash,
        leadApprovalAddress: own(patch, 'leadApprovalAddress') ? patch.leadApprovalAddress : current.lead_approval_address,
        applicationClosesAt: own(patch, 'applicationClosesAt') ? patch.applicationClosesAt : current.application_closes_at,
        launchDeadline: own(patch, 'launchDeadline') ? patch.launchDeadline : current.launch_deadline,
      };
      const response = Object.freeze({ missionId, revision: nextRevision, state: next.state, eventSequence });
      const responseJson = canonicalizeMissionJson(response);

      tx.run("INSERT INTO mission_operations (operation_id, mission_id, operation_kind, idempotency_key_hash, body_digest, expected_revision, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'reserved', ?, ?)", [
        operationId, missionId, operationKind, idempotencyKeyHash, bodyDigest, expectedRevision, timestamp, timestamp,
      ]);
      tx.run('UPDATE missions SET state = ?, revision = ?, public_summary = ?, private_spec_hash = ?, terms_hash = ?, lead_approval_address = ?, application_closes_at = ?, launch_deadline = ?, updated_at = ? WHERE mission_id = ? AND revision = ?', [
        next.state, nextRevision, next.publicSummary, next.privateSpecHash, next.termsHash, next.leadApprovalAddress,
        next.applicationClosesAt, next.launchDeadline, timestamp, missionId, expectedRevision,
      ]);
      tx.run('INSERT INTO mission_revisions (mission_id, revision, public_document_json, private_document_json, document_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
        missionId, nextRevision, documents.publicJson, documents.privateJson, documents.documentHash, timestamp,
      ]);
      tx.run("INSERT INTO mission_events (mission_id, sequence, event_type, source, commitment_hash, operation_id, occurred_at) VALUES (?, ?, ?, 'helixa_ledger', ?, ?, ?)", [
        missionId, eventSequence, eventType, commitmentHash, operationId, timestamp,
      ]);
      tx.run("UPDATE mission_operations SET status = 'succeeded', response_json = ?, updated_at = ? WHERE operation_id = ? AND status = 'reserved'", [
        responseJson, timestamp, operationId,
      ]);
      return response;
    });
  }

  function readMission(missionIdValue) {
    const missionId = identifier(missionIdValue, 'missionId');
    const row = store.readOne('SELECT * FROM missions WHERE mission_id = ?', [missionId]);
    return row ? projectMission(row) : null;
  }

  function listMissions({ state = null, limit = 20, cursor = null } = {}) {
    if (state !== null && (typeof state !== 'string' || !/^[a-z][a-z_]{0,63}$/u.test(state))) throw new TypeError('Mission state filter is invalid.');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new TypeError('Mission list limit is invalid.');
    if (cursor !== null) identifier(cursor, 'cursor');
    const conditions = [];
    const parameters = [];
    if (state !== null) { conditions.push('state = ?'); parameters.push(state); }
    if (cursor !== null) { conditions.push('mission_id > ?'); parameters.push(cursor); }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const rows = store.readAll('SELECT * FROM missions' + where + ' ORDER BY mission_id ASC LIMIT ?', [...parameters, limit + 1]);
    const page = rows.slice(0, limit).map(projectMission);
    return Object.freeze({
      missions: Object.freeze(page),
      nextCursor: rows.length > limit ? page.at(-1).missionId : null,
    });
  }

  function readRevision(missionIdValue, revisionValue) {
    const missionId = identifier(missionIdValue, 'missionId');
    const revision = nonNegativeInteger(revisionValue, 'revision');
    const row = store.readOne('SELECT * FROM mission_revisions WHERE mission_id = ? AND revision = ?', [missionId, revision]);
    return row ? Object.freeze({
      missionId: row.mission_id,
      revision: Number(row.revision),
      publicDocument: freezeJson(JSON.parse(row.public_document_json)),
      privateDocument: freezeJson(JSON.parse(row.private_document_json)),
      documentHash: row.document_hash,
      createdAt: Number(row.created_at),
    }) : null;
  }

  function listEvents(missionIdValue) {
    const missionId = identifier(missionIdValue, 'missionId');
    return Object.freeze(store.readAll('SELECT * FROM mission_events WHERE mission_id = ? ORDER BY sequence', [missionId]).map((row) => Object.freeze({
      missionId: row.mission_id,
      sequence: Number(row.sequence),
      eventType: row.event_type,
      source: row.source,
      actorCommitment: row.actor_commitment,
      commitmentHash: row.commitment_hash,
      operationId: row.operation_id,
      occurredAt: Number(row.occurred_at),
    })));
  }

  return Object.freeze({ createDraft, listEvents, listMissions, readMission, readRevision, updateMission });

  function timestampNow() {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError('Mission repository clock returned an invalid timestamp.');
    return value;
  }
}

function replayOperation(existing, bodyDigest) {
  if (existing.body_digest !== bodyDigest) throw new Error('Idempotency key was reused with a different body or revision.');
  if (existing.status !== 'succeeded' || typeof existing.response_json !== 'string') {
    throw new Error('Idempotent mission operation is not replayable yet.');
  }
  return freezeJson(JSON.parse(existing.response_json));
}

function prepareDocuments(publicDocument, privateDocument) {
  assertMissionLedgerSafe(publicDocument);
  assertMissionLedgerSafe(privateDocument);
  const publicJson = canonicalizeMissionJson(publicDocument);
  const privateJson = canonicalizeMissionJson(privateDocument);
  return Object.freeze({
    publicJson,
    privateJson,
    documentHash: digestMissionBody({ privateDocument, publicDocument }),
  });
}

function normalizePatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Mission patch must be an object.');
  assertExactKeys(value, Object.keys(value), 'mission patch');
  canonicalizeMissionJson(value);
  for (const key of Object.keys(value)) if (!PATCH_KEYS.includes(key)) throw new TypeError('Unknown mission patch field: ' + key + '.');
  const patch = {};
  if (own(value, 'state')) patch.state = boundedText(value.state, 'state', 1, 64);
  if (own(value, 'publicSummary')) patch.publicSummary = boundedText(value.publicSummary, 'publicSummary', 1, 4096);
  if (own(value, 'privateSpecHash')) patch.privateSpecHash = hash(value.privateSpecHash, 'privateSpecHash');
  if (own(value, 'termsHash')) patch.termsHash = hash(value.termsHash, 'termsHash');
  if (own(value, 'leadApprovalAddress')) patch.leadApprovalAddress = nullableAddress(value.leadApprovalAddress, 'leadApprovalAddress');
  if (own(value, 'applicationClosesAt')) patch.applicationClosesAt = nullableTimestamp(value.applicationClosesAt, 'applicationClosesAt');
  if (own(value, 'launchDeadline')) patch.launchDeadline = nullableTimestamp(value.launchDeadline, 'launchDeadline');
  return Object.freeze(patch);
}

function projectMission(row) {
  return Object.freeze({
    missionId: row.mission_id,
    ownerAddress: row.owner_address,
    refundAddress: row.refund_address,
    leadApprovalAddress: row.lead_approval_address,
    state: row.state,
    revision: Number(row.revision),
    publicSummary: row.public_summary,
    privateSpecHash: row.private_spec_hash,
    termsHash: row.terms_hash,
    applicationClosesAt: row.application_closes_at === null ? null : Number(row.application_closes_at),
    launchDeadline: row.launch_deadline === null ? null : Number(row.launch_deadline),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  });
}

function freezeJson(value) {
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) freezeJson(nested);
    Object.freeze(value);
  }
  return value;
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(label + ' must be a plain object.');
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') throw new TypeError(label + ' fields are invalid.');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError(label + ' fields must be enumerable data properties.');
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new TypeError(label + ' fields are invalid.');
  }
}

function identifier(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) throw new TypeError(label + ' is invalid.');
  return value;
}

function boundedText(value, label, min, max) {
  if (typeof value !== 'string' || value.length < min || value.length > max) throw new TypeError(label + ' is invalid.');
  return value;
}

function address(value, label) {
  if (typeof value !== 'string' || !/^0x[a-fA-F0-9]{40}$/u.test(value)) throw new TypeError(label + ' is invalid.');
  return value.toLowerCase();
}

function nullableAddress(value, label) {
  return value === null ? null : address(value, label);
}

function hash(value, label) {
  if (typeof value !== 'string' || !/^[a-fA-F0-9]{64}$/u.test(value)) throw new TypeError(label + ' is invalid.');
  return value.toLowerCase();
}

function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(label + ' must be a non-negative integer.');
  return value;
}

function nullableTimestamp(value, label) {
  return value === null ? null : nonNegativeInteger(value, label);
}

function own(value, key) {
  return Object.hasOwn(value, key);
}
