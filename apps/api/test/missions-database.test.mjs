import assert from 'node:assert/strict';
import { chmod, mkdtemp, stat } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { MISSION_TABLES, createMissionDatabase } from '../src/missions/database.js';

const expectedTables = [
  'mission_allocations',
  'mission_applications',
  'mission_artifacts',
  'mission_chain_events',
  'mission_cred_publications',
  'mission_disputes',
  'mission_events',
  'mission_members',
  'mission_meta',
  'mission_milestones',
  'mission_operations',
  'mission_outcome_receipts',
  'mission_revisions',
  'mission_runtime_bindings',
  'mission_tasks',
  'mission_vaults',
  'mission_xmtp_bindings',
  'mission_xmtp_dedup',
  'mission_xmtp_locks',
  'mission_xmtp_outbox',
  'missions',
];

async function fixture(t, options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'multipass-missions-'));
  const filename = path.join(directory, 'missions.sqlite');
  const store = createMissionDatabase({ filename, busyTimeoutMs: 250, ...options });
  t.after(() => store.close());
  return { directory, filename, store };
}

test('creates the exact additive STRICT schema with WAL, integrity, foreign keys, and mode 0600', async (t) => {
  const f = await fixture(t);
  assert.deepEqual(MISSION_TABLES, expectedTables);
  assert.ok(Object.isFrozen(MISSION_TABLES));
  assert.equal(f.store.readOne('PRAGMA foreign_keys').foreign_keys, 1);
  assert.equal(f.store.readOne('PRAGMA busy_timeout').timeout, 250);
  assert.equal(f.store.readOne('PRAGMA journal_mode').journal_mode, 'wal');
  assert.equal(f.store.readOne('PRAGMA integrity_check').integrity_check, 'ok');
  assert.equal((await stat(f.filename)).mode & 0o777, 0o600);

  const schema = f.store.readAll("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name LIKE 'mission%' ORDER BY name");
  assert.deepEqual(schema.map((row) => row.name), expectedTables);
  for (const row of schema) assert.match(row.sql.trim(), /\bSTRICT$/iu, row.name);
  assert.equal(f.store.readOne("SELECT schema_version FROM mission_meta WHERE singleton = 1").schema_version, 1);
  assert.equal(f.store.inspect().integrity, 'ok');
});

test('schema contains commitments and bounded metadata but no plaintext message, prompt, credential, signature, or artifact body columns', async (t) => {
  const f = await fixture(t);
  const allowedDigestBody = new Set(['body_digest', 'response_json']);
  for (const table of MISSION_TABLES) {
    const columns = f.store.readAll('PRAGMA table_info(' + table + ')').map((row) => row.name);
    for (const column of columns) {
      if (allowedDigestBody.has(column)) continue;
      assert.doesNotMatch(column, /(^|_)(message|prompt|credential|secret|private_key|signature|artifact_body|body_text)($|_)/iu, table + '.' + column);
    }
  }
  const artifactColumns = f.store.readAll('PRAGMA table_info(mission_artifacts)').map((row) => row.name);
  assert.ok(artifactColumns.includes('content_hash'));
  assert.ok(artifactColumns.includes('manifest_hash'));
  assert.ok(artifactColumns.includes('reference_uri'));
  assert.ok(!artifactColumns.includes('content'));
});

test('transaction rollback is atomic across mission state and append-only event writes', async (t) => {
  let injected = false;
  const f = await fixture(t, {
    faultInjector(event) {
      if (!injected && event.label === 'create_mission' && event.writeStep === 2) {
        injected = true;
        throw new Error('simulated crash');
      }
    },
  });
  assert.throws(() => f.store.transaction('create_mission', (tx) => {
    tx.run("INSERT INTO missions (mission_id, owner_address, refund_address, state, revision, public_summary, private_spec_hash, terms_hash, created_at, updated_at) VALUES (?, ?, ?, 'draft', 0, ?, ?, ?, 1, 1)", [
      'mission-1', '0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000002', 'Summary', 'a'.repeat(64), 'b'.repeat(64),
    ]);
    tx.run("INSERT INTO mission_events (mission_id, sequence, event_type, source, commitment_hash, occurred_at) VALUES (?, 0, 'mission_created', 'helixa_ledger', ?, 1)", ['mission-1', 'c'.repeat(64)]);
  }), /simulated crash/);
  assert.equal(f.store.readOne('SELECT count(*) AS count FROM missions').count, 0);
  assert.equal(f.store.readOne('SELECT count(*) AS count FROM mission_events').count, 0);
});

test('committed rows survive close and restart without duplicate schema work', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'multipass-missions-restart-'));
  const filename = path.join(directory, 'missions.sqlite');
  const first = createMissionDatabase({ filename });
  first.transaction('create_mission', (tx) => {
    tx.run("INSERT INTO missions (mission_id, owner_address, refund_address, state, revision, public_summary, private_spec_hash, terms_hash, created_at, updated_at) VALUES (?, ?, ?, 'draft', 0, ?, ?, ?, 1, 1)", [
      'mission-1', '0x0000000000000000000000000000000000000001', '0x0000000000000000000000000000000000000002', 'Summary', 'a'.repeat(64), 'b'.repeat(64),
    ]);
    tx.run("INSERT INTO mission_events (mission_id, sequence, event_type, source, commitment_hash, occurred_at) VALUES (?, 0, 'mission_created', 'helixa_ledger', ?, 1)", ['mission-1', 'c'.repeat(64)]);
  });
  first.close();
  const second = createMissionDatabase({ filename });
  t.after(() => second.close());
  assert.equal(second.readOne('SELECT count(*) AS count FROM missions').count, 1);
  assert.equal(second.readOne('SELECT count(*) AS count FROM mission_events').count, 1);
  assert.equal(second.inspect().integrity, 'ok');
});

test('fails closed on schema version drift and malformed preexisting mission tables', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'multipass-missions-drift-'));
  const filename = path.join(directory, 'missions.sqlite');
  const first = createMissionDatabase({ filename });
  first.close();
  const raw = new DatabaseSync(filename);
  raw.prepare('UPDATE mission_meta SET schema_version = 2 WHERE singleton = 1').run();
  raw.close();
  assert.throws(() => createMissionDatabase({ filename }), /schema version drift/i);

  const malformed = path.join(directory, 'malformed.sqlite');
  const bad = new DatabaseSync(malformed);
  bad.exec('CREATE TABLE missions (unexpected TEXT) STRICT');
  bad.close();
  await chmod(malformed, 0o600);
  assert.throws(() => createMissionDatabase({ filename: malformed }), /schema drift/i);
});

test('read and transaction surfaces reject arbitrary SQL and stale handles', async (t) => {
  const f = await fixture(t);
  assert.throws(() => f.store.readOne('DELETE FROM missions'), /read-only SQL/i);
  assert.throws(() => f.store.transaction('bad label!', () => {}), /label/i);
  let escaped;
  f.store.transaction('capture_handle', (tx) => { escaped = tx; });
  assert.throws(() => escaped.run('DELETE FROM missions'), /inactive/i);
});
