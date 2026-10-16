import { chmodSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA_VERSION = 1;

export const MISSION_TABLES = Object.freeze([
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
]);

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS mission_meta (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    schema_version INTEGER NOT NULL CHECK (schema_version > 0),
    created_at INTEGER NOT NULL CHECK (created_at >= 0)
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS missions (
    mission_id TEXT PRIMARY KEY CHECK (length(mission_id) BETWEEN 1 AND 128),
    owner_address TEXT NOT NULL CHECK (length(owner_address) = 42),
    refund_address TEXT NOT NULL CHECK (length(refund_address) = 42),
    lead_approval_address TEXT CHECK (lead_approval_address IS NULL OR length(lead_approval_address) = 42),
    state TEXT NOT NULL CHECK (state IN ('draft','recruiting','team_selected','funding','funded','launching','active','review','settled','cancelled','refunded')),
    revision INTEGER NOT NULL CHECK (revision >= 0),
    public_summary TEXT NOT NULL CHECK (length(public_summary) BETWEEN 1 AND 4096),
    private_spec_hash TEXT NOT NULL CHECK (length(private_spec_hash) = 64),
    terms_hash TEXT NOT NULL CHECK (length(terms_hash) = 64),
    application_closes_at INTEGER,
    launch_deadline INTEGER,
    created_at INTEGER NOT NULL CHECK (created_at >= 0),
    updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
    CHECK (lead_approval_address IS NULL OR lead_approval_address <> owner_address)
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_revisions (
    mission_id TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision >= 0),
    public_document_json TEXT NOT NULL,
    private_document_json TEXT NOT NULL,
    document_hash TEXT NOT NULL CHECK (length(document_hash) = 64),
    created_at INTEGER NOT NULL CHECK (created_at >= 0),
    PRIMARY KEY (mission_id, revision),
    FOREIGN KEY (mission_id) REFERENCES missions (mission_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_applications (
    application_id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL,
    chain_id INTEGER NOT NULL CHECK (chain_id > 0),
    collection TEXT NOT NULL CHECK (length(collection) = 42),
    token_id TEXT NOT NULL CHECK (length(token_id) BETWEEN 1 AND 78),
    canonical_account TEXT NOT NULL CHECK (length(canonical_account) = 42),
    controller_address TEXT NOT NULL CHECK (length(controller_address) = 42),
    custody_epoch INTEGER NOT NULL CHECK (custody_epoch >= 0),
    proposed_role TEXT NOT NULL CHECK (length(proposed_role) BETWEEN 1 AND 128),
    settlement_address TEXT NOT NULL CHECK (length(settlement_address) = 42),
    application_hash TEXT NOT NULL CHECK (length(application_hash) = 64),
    proof_hash TEXT NOT NULL CHECK (length(proof_hash) = 64),
    status TEXT NOT NULL CHECK (status IN ('active','withdrawn','selected','rejected','expired')),
    expires_at INTEGER NOT NULL CHECK (expires_at > 0),
    created_at INTEGER NOT NULL CHECK (created_at >= 0),
    updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
    UNIQUE (mission_id, chain_id, collection, token_id, custody_epoch),
    FOREIGN KEY (mission_id) REFERENCES missions (mission_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_members (
    mission_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    application_id TEXT NOT NULL,
    chain_id INTEGER NOT NULL CHECK (chain_id > 0),
    collection TEXT NOT NULL CHECK (length(collection) = 42),
    token_id TEXT NOT NULL,
    canonical_account TEXT NOT NULL CHECK (length(canonical_account) = 42),
    controller_address TEXT NOT NULL CHECK (length(controller_address) = 42),
    custody_epoch INTEGER NOT NULL CHECK (custody_epoch >= 0),
    role_label TEXT NOT NULL CHECK (length(role_label) BETWEEN 1 AND 128),
    settlement_address TEXT NOT NULL CHECK (length(settlement_address) = 42),
    is_lead INTEGER NOT NULL CHECK (is_lead IN (0,1)),
    status TEXT NOT NULL CHECK (status IN ('selected','accepted','active','custody_changed','paused','terminal')),
    accepted_at INTEGER,
    created_at INTEGER NOT NULL CHECK (created_at >= 0),
    PRIMARY KEY (mission_id, member_id),
    UNIQUE (mission_id, application_id),
    FOREIGN KEY (mission_id) REFERENCES missions (mission_id) ON DELETE RESTRICT,
    FOREIGN KEY (application_id) REFERENCES mission_applications (application_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_milestones (
    mission_id TEXT NOT NULL,
    milestone_id TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence BETWEEN 0 AND 11),
    title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 256),
    acceptance_hash TEXT NOT NULL CHECK (length(acceptance_hash) = 64),
    payout_commitment TEXT NOT NULL CHECK (length(payout_commitment) = 64),
    artifact_commitment TEXT,
    state TEXT NOT NULL CHECK (state IN ('pending','submitted','releasable','released','disputed','resolved','timeout_settled','refunded')),
    delivery_deadline INTEGER NOT NULL CHECK (delivery_deadline > 0),
    review_deadline INTEGER NOT NULL CHECK (review_deadline >= delivery_deadline),
    dispute_deadline INTEGER NOT NULL CHECK (dispute_deadline >= review_deadline),
    owner_approved_at INTEGER,
    lead_approved_at INTEGER,
    settled_at INTEGER,
    PRIMARY KEY (mission_id, milestone_id),
    UNIQUE (mission_id, sequence),
    FOREIGN KEY (mission_id) REFERENCES missions (mission_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_allocations (
    mission_id TEXT NOT NULL,
    milestone_id TEXT NOT NULL,
    allocation_kind TEXT NOT NULL CHECK (allocation_kind IN ('payout','delivery_timeout','dispute_timeout')),
    asset_address TEXT NOT NULL CHECK (length(asset_address) = 42),
    recipient_address TEXT NOT NULL CHECK (length(recipient_address) = 42),
    amount_raw TEXT NOT NULL CHECK (length(amount_raw) BETWEEN 1 AND 78 AND amount_raw NOT GLOB '*[^0-9]*'),
    sequence INTEGER NOT NULL CHECK (sequence BETWEEN 0 AND 7),
    PRIMARY KEY (mission_id, milestone_id, allocation_kind, asset_address, sequence),
    FOREIGN KEY (mission_id, milestone_id) REFERENCES mission_milestones (mission_id, milestone_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_vaults (
    mission_id TEXT PRIMARY KEY,
    chain_id INTEGER NOT NULL CHECK (chain_id > 0),
    version_id TEXT NOT NULL,
    factory_address TEXT NOT NULL CHECK (length(factory_address) = 42),
    vault_address TEXT NOT NULL UNIQUE CHECK (length(vault_address) = 42),
    creation_code_hash TEXT NOT NULL CHECK (length(creation_code_hash) = 64),
    runtime_code_hash TEXT NOT NULL CHECK (length(runtime_code_hash) = 64),
    manifest_hash TEXT NOT NULL UNIQUE CHECK (length(manifest_hash) = 64),
    terms_hash TEXT NOT NULL CHECK (length(terms_hash) = 64),
    state TEXT NOT NULL CHECK (state IN ('awaiting_funding','funded','active','settled','refunded')),
    deployment_tx_hash TEXT CHECK (deployment_tx_hash IS NULL OR length(deployment_tx_hash) = 66),
    deployed_block_number INTEGER,
    confirmed_block_hash TEXT,
    updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
    FOREIGN KEY (mission_id) REFERENCES missions (mission_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_operations (
    operation_id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL,
    operation_kind TEXT NOT NULL,
    idempotency_key_hash TEXT NOT NULL CHECK (length(idempotency_key_hash) = 64),
    body_digest TEXT NOT NULL CHECK (length(body_digest) = 64),
    expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
    status TEXT NOT NULL CHECK (status IN ('reserved','running','succeeded','failed_retryable','failed_terminal')),
    response_json TEXT,
    error_class TEXT,
    created_at INTEGER NOT NULL CHECK (created_at >= 0),
    updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
    UNIQUE (mission_id, operation_kind, idempotency_key_hash),
    FOREIGN KEY (mission_id) REFERENCES missions (mission_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_runtime_bindings (
    mission_id TEXT PRIMARY KEY,
    release_hash TEXT NOT NULL CHECK (length(release_hash) = 64),
    manager_instance_id TEXT NOT NULL UNIQUE,
    team_name TEXT NOT NULL,
    workspace_commitment TEXT NOT NULL CHECK (length(workspace_commitment) = 64),
    roster_commitment TEXT NOT NULL CHECK (length(roster_commitment) = 64),
    health_status TEXT NOT NULL CHECK (health_status IN ('reserved','provisioning','ready','degraded','paused','terminated','failed')),
    health_checked_at INTEGER,
    created_at INTEGER NOT NULL CHECK (created_at >= 0),
    updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
    FOREIGN KEY (mission_id) REFERENCES missions (mission_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_tasks (
    mission_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    milestone_id TEXT NOT NULL,
    assigned_member_id TEXT,
    upstream_task_name TEXT NOT NULL,
    title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 256),
    instruction_hash TEXT NOT NULL CHECK (length(instruction_hash) = 64),
    dependency_hash TEXT NOT NULL CHECK (length(dependency_hash) = 64),
    state TEXT NOT NULL CHECK (state IN ('todo','doing','blocked','review','done','cancelled')),
    revision INTEGER NOT NULL CHECK (revision >= 0),
    created_at INTEGER NOT NULL CHECK (created_at >= 0),
    updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
    PRIMARY KEY (mission_id, task_id),
    UNIQUE (mission_id, upstream_task_name),
    FOREIGN KEY (mission_id, milestone_id) REFERENCES mission_milestones (mission_id, milestone_id) ON DELETE RESTRICT,
    FOREIGN KEY (mission_id, assigned_member_id) REFERENCES mission_members (mission_id, member_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_artifacts (
    mission_id TEXT NOT NULL,
    artifact_id TEXT NOT NULL,
    milestone_id TEXT NOT NULL,
    task_id TEXT,
    content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
    manifest_hash TEXT NOT NULL CHECK (length(manifest_hash) = 64),
    reference_uri TEXT NOT NULL CHECK (length(reference_uri) BETWEEN 1 AND 2048),
    content_type TEXT NOT NULL CHECK (length(content_type) BETWEEN 1 AND 256),
    byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 0 AND 104857600),
    submitted_by TEXT NOT NULL CHECK (length(submitted_by) = 42),
    created_at INTEGER NOT NULL CHECK (created_at >= 0),
    PRIMARY KEY (mission_id, artifact_id),
    UNIQUE (mission_id, content_hash),
    FOREIGN KEY (mission_id, milestone_id) REFERENCES mission_milestones (mission_id, milestone_id) ON DELETE RESTRICT,
    FOREIGN KEY (mission_id, task_id) REFERENCES mission_tasks (mission_id, task_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_xmtp_bindings (
    mission_id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL UNIQUE,
    topic_binding TEXT,
    mission_marker TEXT NOT NULL UNIQUE,
    expected_member_commitment TEXT NOT NULL CHECK (length(expected_member_commitment) = 64),
    observed_member_commitment TEXT NOT NULL CHECK (length(observed_member_commitment) = 64),
    permission_commitment TEXT NOT NULL CHECK (length(permission_commitment) = 64),
    creation_operation_id TEXT NOT NULL,
    bridge_version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('candidate','verified','ambiguous','closed','failed')),
    created_at INTEGER NOT NULL CHECK (created_at >= 0),
    updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
    FOREIGN KEY (mission_id) REFERENCES missions (mission_id) ON DELETE RESTRICT,
    FOREIGN KEY (creation_operation_id) REFERENCES mission_operations (operation_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_xmtp_locks (
    mission_id TEXT PRIMARY KEY,
    holder_id TEXT NOT NULL,
    generation INTEGER NOT NULL CHECK (generation >= 0),
    acquired_at INTEGER NOT NULL CHECK (acquired_at >= 0),
    renewed_at INTEGER NOT NULL CHECK (renewed_at >= acquired_at),
    expires_at INTEGER NOT NULL CHECK (expires_at > renewed_at),
    FOREIGN KEY (mission_id) REFERENCES missions (mission_id) ON DELETE CASCADE
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_xmtp_outbox (
    outbox_id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL,
    deduplication_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','sending','sent','failed_retryable','failed_terminal')),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    next_attempt_at INTEGER NOT NULL CHECK (next_attempt_at >= 0),
    xmtp_event_id TEXT,
    created_at INTEGER NOT NULL CHECK (created_at >= 0),
    updated_at INTEGER NOT NULL CHECK (updated_at >= created_at),
    UNIQUE (mission_id, deduplication_id),
    FOREIGN KEY (mission_id) REFERENCES missions (mission_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_xmtp_dedup (
    mission_id TEXT NOT NULL,
    deduplication_id TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
    recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
    PRIMARY KEY (mission_id, deduplication_id, direction),
    FOREIGN KEY (mission_id) REFERENCES missions (mission_id) ON DELETE CASCADE
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_disputes (
    mission_id TEXT NOT NULL,
    milestone_id TEXT NOT NULL,
    dispute_id TEXT NOT NULL,
    opened_by TEXT NOT NULL CHECK (length(opened_by) = 42),
    evidence_hash TEXT NOT NULL CHECK (length(evidence_hash) = 64),
    reason_class TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open','joint_settlement','arbitrated','timeout_settled')),
    decision_hash TEXT,
    settlement_tx_hash TEXT,
    opened_at INTEGER NOT NULL CHECK (opened_at >= 0),
    resolved_at INTEGER,
    PRIMARY KEY (mission_id, dispute_id),
    FOREIGN KEY (mission_id, milestone_id) REFERENCES mission_milestones (mission_id, milestone_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_chain_events (
    chain_id INTEGER NOT NULL CHECK (chain_id > 0),
    tx_hash TEXT NOT NULL CHECK (length(tx_hash) = 66),
    log_index INTEGER NOT NULL CHECK (log_index >= 0),
    mission_id TEXT NOT NULL,
    vault_address TEXT NOT NULL CHECK (length(vault_address) = 42),
    event_type TEXT NOT NULL,
    commitment_hash TEXT NOT NULL CHECK (length(commitment_hash) = 64),
    block_number INTEGER NOT NULL CHECK (block_number >= 0),
    block_hash TEXT NOT NULL CHECK (length(block_hash) = 66),
    confirmation_state TEXT NOT NULL CHECK (confirmation_state IN ('observed','confirmed','finalized','orphaned')),
    observed_at INTEGER NOT NULL CHECK (observed_at >= 0),
    PRIMARY KEY (chain_id, tx_hash, log_index),
    FOREIGN KEY (mission_id) REFERENCES missions (mission_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_outcome_receipts (
    mission_id TEXT NOT NULL,
    receipt_id TEXT NOT NULL,
    receipt_version TEXT NOT NULL,
    receipt_hash TEXT NOT NULL UNIQUE CHECK (length(receipt_hash) = 64),
    envelope_json TEXT NOT NULL,
    finalized_block_number INTEGER NOT NULL CHECK (finalized_block_number >= 0),
    finalized_block_hash TEXT NOT NULL CHECK (length(finalized_block_hash) = 66),
    issued_at INTEGER NOT NULL CHECK (issued_at >= 0),
    PRIMARY KEY (mission_id, receipt_id),
    FOREIGN KEY (mission_id) REFERENCES missions (mission_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_cred_publications (
    mission_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    receipt_id TEXT NOT NULL,
    evidence_hash TEXT NOT NULL CHECK (length(evidence_hash) = 64),
    status TEXT NOT NULL CHECK (status IN ('pending','published','failed_retryable','failed_terminal')),
    publication_ref TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    updated_at INTEGER NOT NULL CHECK (updated_at >= 0),
    PRIMARY KEY (mission_id, member_id, receipt_id),
    FOREIGN KEY (mission_id, member_id) REFERENCES mission_members (mission_id, member_id) ON DELETE RESTRICT,
    FOREIGN KEY (mission_id, receipt_id) REFERENCES mission_outcome_receipts (mission_id, receipt_id) ON DELETE RESTRICT
  ) STRICT`,
  `CREATE TABLE IF NOT EXISTS mission_events (
    mission_id TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence >= 0),
    event_type TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('onchain','helixa_ledger','id_agents','xmtp')),
    actor_commitment TEXT,
    commitment_hash TEXT NOT NULL CHECK (length(commitment_hash) = 64),
    operation_id TEXT,
    occurred_at INTEGER NOT NULL CHECK (occurred_at >= 0),
    PRIMARY KEY (mission_id, sequence),
    FOREIGN KEY (mission_id) REFERENCES missions (mission_id) ON DELETE RESTRICT,
    FOREIGN KEY (operation_id) REFERENCES mission_operations (operation_id) ON DELETE RESTRICT
  ) STRICT`,
];

const APPEND_ONLY_TRIGGERS = [
  `CREATE TRIGGER IF NOT EXISTS mission_revisions_no_update
    BEFORE UPDATE ON mission_revisions BEGIN
      SELECT RAISE(ABORT, 'mission revisions are append-only');
    END`,
  `CREATE TRIGGER IF NOT EXISTS mission_revisions_no_delete
    BEFORE DELETE ON mission_revisions BEGIN
      SELECT RAISE(ABORT, 'mission revisions are append-only');
    END`,
  `CREATE TRIGGER IF NOT EXISTS mission_events_no_update
    BEFORE UPDATE ON mission_events BEGIN
      SELECT RAISE(ABORT, 'mission events are append-only');
    END`,
  `CREATE TRIGGER IF NOT EXISTS mission_events_no_delete
    BEFORE DELETE ON mission_events BEGIN
      SELECT RAISE(ABORT, 'mission events are append-only');
    END`,
];

const EXPECTED_TRIGGERS = new Map(APPEND_ONLY_TRIGGERS.map((statement) => {
  const name = statement.match(/^CREATE TRIGGER IF NOT EXISTS ([a-z0-9_]+)/iu)?.[1];
  if (!name) throw new Error('Invalid mission trigger statement.');
  return [name, normalizeSql(statement).replace('create trigger if not exists', 'create trigger')];
}));

const EXPECTED_SCHEMA = new Map(SCHEMA.map((statement) => {
  const table = statement.match(/^CREATE TABLE IF NOT EXISTS (mission[a-z0-9_]*)/iu)?.[1];
  if (!table) throw new Error('Invalid mission schema statement.');
  return [table, normalizeSchemaSql(statement)];
}));

const READ_STATEMENT = /^\s*SELECT\b/iu;
const READ_PRAGMA = /^\s*PRAGMA\s+(?:(?:foreign_keys|busy_timeout|journal_mode|integrity_check)\s*;?|table_info\(mission[a-z0-9_]*\)\s*;?)\s*$/iu;
const WRITE_STATEMENT = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/iu;

export function createMissionDatabase({ filename, busyTimeoutMs = 2_000, faultInjector = null } = {}) {
  if (typeof filename !== 'string' || !filename) throw new TypeError('Mission database filename is required.');
  if (!Number.isSafeInteger(busyTimeoutMs) || busyTimeoutMs < 0 || busyTimeoutMs > 10_000) throw new TypeError('busyTimeoutMs must be a bounded integer.');
  if (faultInjector !== null && typeof faultInjector !== 'function') throw new TypeError('faultInjector must be a function.');

  const db = new DatabaseSync(filename);
  let closed = false;
  let inTransaction = false;
  try {
    if (filename !== ':memory:') chmodSync(filename, 0o600);
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA trusted_schema = OFF');
    db.exec('PRAGMA defensive = ON');
    db.exec('PRAGMA busy_timeout = ' + busyTimeoutMs);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const statement of SCHEMA) db.exec(statement);
      for (const statement of APPEND_ONLY_TRIGGERS) db.exec(statement);
      assertExactSchema(db);
      assertExactTriggers(db);
      const meta = db.prepare('SELECT schema_version FROM mission_meta WHERE singleton = 1').get();
      if (!meta) db.prepare('INSERT INTO mission_meta (singleton, schema_version, created_at) VALUES (1, ?, ?)').run(SCHEMA_VERSION, Date.now());
      else if (Number(meta.schema_version) !== SCHEMA_VERSION) throw new Error('Mission schema version drift: expected ' + SCHEMA_VERSION + '.');
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    db.close();
    throw error;
  }

  function assertOpen() {
    if (closed) throw new Error('Mission database is closed.');
  }

  function prepareRead(sql) {
    assertOpen();
    if (typeof sql !== 'string' || (!READ_STATEMENT.test(sql) && !READ_PRAGMA.test(sql))) throw new TypeError('Mission read API accepts read-only SQL.');
    return db.prepare(sql);
  }

  function call(statement, method, params = []) {
    if (!Array.isArray(params)) throw new TypeError('SQL parameters must be an array.');
    return statement[method](...params);
  }

  const store = {
    transaction(label, work) {
      assertOpen();
      if (typeof label !== 'string' || !/^[a-z0-9_-]{1,64}$/u.test(label)) throw new TypeError('Mission transaction label is invalid.');
      if (typeof work !== 'function') throw new TypeError('Mission transaction work must be a function.');
      if (inTransaction) throw new Error('Nested mission transaction is forbidden.');
      db.exec('BEGIN IMMEDIATE');
      inTransaction = true;
      let txActive = true;
      let writeStep = 0;
      const assertTransactionActive = () => {
        if (!txActive || !inTransaction) throw new Error('Mission transaction handle is inactive.');
      };
      const tx = Object.freeze({
        run(sql, params = []) {
          assertTransactionActive();
          if (typeof sql !== 'string' || !WRITE_STATEMENT.test(sql)) throw new TypeError('Mission transaction run accepts one write statement.');
          writeStep += 1;
          faultInjector?.({ phase: 'transaction_write', label, writeStep, statementClass: sql.trim().split(/\s+/u, 1)[0].toUpperCase() });
          return call(db.prepare(sql), 'run', params);
        },
        get(sql, params = []) { assertTransactionActive(); return call(prepareRead(sql), 'get', params); },
        all(sql, params = []) { assertTransactionActive(); return call(prepareRead(sql), 'all', params); },
      });
      try {
        const result = work(tx);
        if (result && typeof result.then === 'function') throw new TypeError('Mission transaction callback must be synchronous.');
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      } finally {
        txActive = false;
        inTransaction = false;
      }
    },

    readOne(sql, params = []) { return call(prepareRead(sql), 'get', params); },
    readAll(sql, params = []) { return call(prepareRead(sql), 'all', params); },

    inspect() {
      assertOpen();
      const integrity = db.prepare('PRAGMA integrity_check').all().map((row) => row.integrity_check).join(',');
      const counts = {};
      for (const table of MISSION_TABLES) counts[table] = Number(db.prepare('SELECT count(*) AS count FROM ' + table).get().count);
      let walBytes = 0;
      if (filename !== ':memory:') {
        try { walBytes = statSync(filename + '-wal').size; } catch (error) { if (error?.code !== 'ENOENT') throw error; }
      }
      return Object.freeze({ integrity, journalMode: db.prepare('PRAGMA journal_mode').get().journal_mode, schemaVersion: SCHEMA_VERSION, walBytes, counts: Object.freeze(counts) });
    },

    checkpoint() {
      assertOpen();
      const row = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
      return Object.freeze({ busy: Number(row.busy), log: Number(row.log), checkpointed: Number(row.checkpointed) });
    },

    close() {
      if (closed) return;
      if (inTransaction) throw new Error('Cannot close mission database during a transaction.');
      db.close();
      closed = true;
    },
  };

  return Object.freeze(store);
}

function normalizeSql(sql) {
  return sql.replace(/\s+/gu, ' ').trim().toLowerCase();
}

function normalizeSchemaSql(sql) {
  return normalizeSql(sql).replace(/^create table if not exists/iu, 'create table');
}

function assertExactSchema(db) {
  const rows = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name LIKE 'mission%' ORDER BY name").all();
  if (rows.length !== EXPECTED_SCHEMA.size) throw new Error('Mission schema drift: unexpected table set.');
  for (const row of rows) {
    const expected = EXPECTED_SCHEMA.get(row.name);
    if (!expected || normalizeSchemaSql(row.sql) !== expected) throw new Error('Mission schema drift: ' + row.name + '.');
  }
}

function assertExactTriggers(db) {
  const rows = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'mission_%' ORDER BY name").all();
  if (rows.length !== EXPECTED_TRIGGERS.size) throw new Error('Mission trigger drift: unexpected trigger set.');
  for (const row of rows) {
    const expected = EXPECTED_TRIGGERS.get(row.name);
    if (!expected || normalizeSql(row.sql) !== expected) throw new Error('Mission trigger drift: ' + row.name + '.');
  }
}
