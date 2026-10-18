import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createMissionDatabase } from '../src/missions/database.js';
import { createMissionRepository } from '../src/missions/repository.js';

const OWNER = '0x0000000000000000000000000000000000000001';
const REFUND = '0x0000000000000000000000000000000000000002';

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mission-repository-'));
  const store = createMissionDatabase({ filename: path.join(directory, 'missions.sqlite') });
  t.after(() => store.close());
  let id = 0;
  let now = 1_000;
  const repository = createMissionRepository({
    store,
    createId: () => 'operation-' + (++id),
    now: () => ++now,
  });
  return { repository, store };
}

function draftInput() {
  return {
    missionId: 'mission-1',
    ownerAddress: OWNER,
    refundAddress: REFUND,
    publicSummary: 'Build a bounded Looper mission proof.',
    publicDocument: { title: 'Mission One', bounty: { amount_raw: '1000000' } },
    privateDocument: { scope: 'Exact acceptance criteria.' },
    privateSpecHash: 'a'.repeat(64),
    termsHash: 'b'.repeat(64),
    commitmentHash: 'c'.repeat(64),
    idempotencyKey: 'create-1',
    body: { action: 'create', title: 'Mission One' },
  };
}

test('create stores revision zero and the first ordered append-only event atomically', async (t) => {
  const { repository } = await fixture(t);
  const created = repository.createDraft(draftInput());
  assert.deepEqual(created, { missionId: 'mission-1', revision: 0, state: 'draft', eventSequence: 0 });
  assert.equal(repository.readMission('mission-1').revision, 0);
  assert.deepEqual(repository.readRevision('mission-1', 0).publicDocument, { bounty: { amount_raw: '1000000' }, title: 'Mission One' });
  assert.deepEqual(repository.listEvents('mission-1').map((event) => [event.sequence, event.eventType, event.source]), [
    [0, 'mission_created', 'helixa_ledger'],
  ]);
});

test('mission listing supports bounded state filters and stable cursor pagination', async (t) => {
  const { repository } = await fixture(t);
  repository.createDraft(draftInput());
  repository.createDraft({ ...draftInput(), missionId: 'mission-2', idempotencyKey: 'create-2' });
  repository.createDraft({ ...draftInput(), missionId: 'mission-3', idempotencyKey: 'create-3' });
  repository.updateMission({
    missionId: 'mission-2', expectedRevision: 0, idempotencyKey: 'publish-2', operationKind: 'publish_mission',
    body: { state: 'recruiting' }, patch: { state: 'recruiting' },
    publicDocument: { title: 'Mission Two' }, privateDocument: { scope: 'safe' },
    eventType: 'mission_published', commitmentHash: 'd'.repeat(64),
  });
  assert.deepEqual(repository.listMissions({ limit: 2 }).missions.map((mission) => mission.missionId), ['mission-1', 'mission-2']);
  assert.equal(repository.listMissions({ limit: 2 }).nextCursor, 'mission-2');
  assert.deepEqual(repository.listMissions({ limit: 2, cursor: 'mission-2' }).missions.map((mission) => mission.missionId), ['mission-3']);
  assert.deepEqual(repository.listMissions({ state: 'recruiting' }).missions.map((mission) => mission.missionId), ['mission-2']);
  assert.throws(() => repository.listMissions({ state: 'DROP TABLE missions' }), /state filter/i);
});

test('draft creation replays the same canonical request and rejects changed request data', async (t) => {
  const { repository, store } = await fixture(t);
  const input = draftInput();
  const first = repository.createDraft(input);
  const replay = repository.createDraft({ ...input, body: { title: 'Mission One', action: 'create' } });
  assert.deepEqual(replay, first);
  assert.equal(store.readOne('SELECT count(*) AS count FROM missions').count, 1);
  assert.equal(store.readOne('SELECT count(*) AS count FROM mission_operations').count, 1);
  assert.throws(() => repository.createDraft({ ...input, publicSummary: 'Changed after key reuse.' }), /idempotency.*different body/i);
});

test('expected-revision update writes one immutable revision and ordered event', async (t) => {
  const { repository } = await fixture(t);
  repository.createDraft(draftInput());
  const result = repository.updateMission({
    missionId: 'mission-1',
    expectedRevision: 0,
    idempotencyKey: 'publish-1',
    operationKind: 'publish_mission',
    body: { state: 'recruiting', application_closes_at: 2_000 },
    patch: { state: 'recruiting', applicationClosesAt: 2_000 },
    publicDocument: { title: 'Mission One', status: 'recruiting', bounty: { amount_raw: '1000000' } },
    privateDocument: { scope: 'Exact acceptance criteria.' },
    eventType: 'mission_published',
    commitmentHash: 'd'.repeat(64),
  });
  assert.deepEqual(result, { missionId: 'mission-1', revision: 1, state: 'recruiting', eventSequence: 1 });
  assert.equal(repository.readRevision('mission-1', 0).publicDocument.status, undefined);
  assert.equal(repository.readRevision('mission-1', 1).publicDocument.status, 'recruiting');
  assert.deepEqual(repository.listEvents('mission-1').map((event) => event.sequence), [0, 1]);
});

test('same idempotency key and canonical body replays the stored result without duplicate writes', async (t) => {
  const { repository, store } = await fixture(t);
  repository.createDraft(draftInput());
  const command = {
    missionId: 'mission-1', expectedRevision: 0, idempotencyKey: 'publish-1', operationKind: 'publish_mission',
    body: { z: true, state: 'recruiting' }, patch: { state: 'recruiting' },
    publicDocument: { title: 'Mission One', status: 'recruiting' }, privateDocument: { scope: 'safe' },
    eventType: 'mission_published', commitmentHash: 'd'.repeat(64),
  };
  const first = repository.updateMission(command);
  const replay = repository.updateMission({ ...command, body: { state: 'recruiting', z: true } });
  assert.deepEqual(replay, first);
  assert.equal(store.readOne('SELECT count(*) AS count FROM mission_operations').count, 2);
  assert.equal(store.readOne('SELECT count(*) AS count FROM mission_revisions').count, 2);
  assert.equal(store.readOne('SELECT count(*) AS count FROM mission_events').count, 2);
  const operation = store.readOne("SELECT idempotency_key_hash, body_digest, response_json FROM mission_operations WHERE operation_kind = 'publish_mission'");
  assert.match(operation.idempotency_key_hash, /^[a-f0-9]{64}$/u);
  assert.match(operation.body_digest, /^[a-f0-9]{64}$/u);
  assert.ok(!JSON.stringify(operation).includes('publish-1'));
});

test('changed-body key reuse and stale revisions fail without partial writes', async (t) => {
  const { repository, store } = await fixture(t);
  repository.createDraft(draftInput());
  const base = {
    missionId: 'mission-1', expectedRevision: 0, idempotencyKey: 'publish-1', operationKind: 'publish_mission',
    body: { state: 'recruiting' }, patch: { state: 'recruiting' },
    publicDocument: { title: 'Mission One', status: 'recruiting' }, privateDocument: { scope: 'safe' },
    eventType: 'mission_published', commitmentHash: 'd'.repeat(64),
  };
  repository.updateMission(base);
  assert.throws(() => repository.updateMission({ ...base, body: { state: 'cancelled' } }), /idempotency.*different body/i);
  assert.throws(() => repository.updateMission({ ...base, idempotencyKey: 'second-key', body: { state: 'review' } }), /revision conflict/i);
  assert.equal(store.readOne('SELECT count(*) AS count FROM mission_operations').count, 2);
  assert.equal(store.readOne('SELECT count(*) AS count FROM mission_revisions').count, 2);
  assert.equal(store.readOne('SELECT count(*) AS count FROM mission_events').count, 2);
});

test('historical revisions and mission events are database-enforced append-only', async (t) => {
  const { repository, store } = await fixture(t);
  repository.createDraft(draftInput());
  assert.throws(() => store.transaction('rewrite_revision', (tx) => {
    tx.run("UPDATE mission_revisions SET public_document_json = '{}' WHERE mission_id = 'mission-1' AND revision = 0");
  }), /append-only/i);
  assert.throws(() => store.transaction('delete_event', (tx) => {
    tx.run("DELETE FROM mission_events WHERE mission_id = 'mission-1' AND sequence = 0");
  }), /append-only/i);
});

test('repository rejects forbidden plaintext before writing a revision', async (t) => {
  const { repository, store } = await fixture(t);
  assert.throws(() => repository.createDraft({
    ...draftInput(),
    privateDocument: { scope: 'safe', nested: { xmtp_message_body: 'do not persist' } },
  }), /forbidden mission ledger field/i);
  assert.equal(store.readOne('SELECT count(*) AS count FROM missions').count, 0);
  assert.equal(store.readOne('SELECT count(*) AS count FROM mission_revisions').count, 0);
});
