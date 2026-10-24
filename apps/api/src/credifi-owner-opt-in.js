import { chmodSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { deriveReleasedLooperAccount } from './looper-account.js';
import { LOOPERS_MAINNET_CHAIN_ID, LOOPERS_MAINNET_CONTRACT, createLoopersPublicClients } from './loopers-owned-agents.js';
import { createAccountIntegrityReader } from './restap-network/account-integrity.js';
import { createRestapNetworkBaseProvider } from './restap-network/base-provider.js';

export const CREDIFI_PILOT_COHORT_VERSION = 'credifi-controlled-rollout-50-v1';
export const CREDIFI_PILOT_AMOUNT_USD = '50.00';
export const PREPARED_CREDIFI_PILOT_TOKEN_IDS = Object.freeze([
  '11', '19', '20', '32', '46', '70', '100', '106', '143', '149',
  '194', '210', '273', '285', '312', '349', '402', '420', '480', '548',
  '550', '558', '612', '641', '645', '667', '827', '905', '4151', '941',
  '1008', '1090', '1104', '1169', '1171', '1442', '1615', '1687', '1713', '1787',
  '1827', '2015', '2017', '2150', '2250', '2285', '2620', '2653', '2916', '3328',
]);

const SCHEMA_VERSION = 2;
const COHORT = new Set(PREPARED_CREDIFI_PILOT_TOKEN_IDS);
const META_SCHEMA = `CREATE TABLE IF NOT EXISTS credifi_owner_opt_in_meta (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  created_at TEXT NOT NULL
) STRICT`;
const CONSENT_SCHEMA = `CREATE TABLE IF NOT EXISTS credifi_owner_opt_ins (
  token_id TEXT NOT NULL CHECK (length(token_id) BETWEEN 1 AND 78 AND token_id NOT GLOB '*[^0-9]*' AND token_id NOT LIKE '0%'),
  canonical_account TEXT NOT NULL CHECK (length(canonical_account) = 42 AND canonical_account = lower(canonical_account)),
  owner_wallet TEXT NOT NULL CHECK (length(owner_wallet) = 42 AND owner_wallet = lower(owner_wallet)),
  erc8004_agent_id TEXT NOT NULL CHECK (length(erc8004_agent_id) BETWEEN 1 AND 78 AND erc8004_agent_id NOT GLOB '*[^0-9]*'),
  cohort_version TEXT NOT NULL CHECK (length(cohort_version) BETWEEN 1 AND 128),
  amount_cents INTEGER NOT NULL CHECK (amount_cents = 5000),
  consented_at TEXT NOT NULL,
  anchor_block_number INTEGER NOT NULL CHECK (anchor_block_number >= 0),
  anchor_block_hash TEXT NOT NULL CHECK (length(anchor_block_hash) = 66 AND anchor_block_hash = lower(anchor_block_hash)),
  custody_epoch INTEGER NOT NULL CHECK (custody_epoch > 0),
  invalidated_at TEXT,
  invalidation_reason TEXT CHECK (invalidation_reason IS NULL OR invalidation_reason IN ('intervening_transfer', 'scan_window_expired')),
  PRIMARY KEY (token_id, owner_wallet, cohort_version),
  UNIQUE (token_id, canonical_account, owner_wallet, cohort_version)
) STRICT`;
const MIGRATIONS = Object.freeze([Object.freeze({ version: 2, statements: Object.freeze([META_SCHEMA, CONSENT_SCHEMA]) })]);
const EXPECTED_SCHEMA = new Map(MIGRATIONS.flatMap((migration) => migration.statements).map((statement) => {
  const name = statement.match(/^CREATE TABLE IF NOT EXISTS ([a-z0-9_]+)/iu)?.[1];
  if (!name) throw new Error('Invalid Credifi opt-in schema statement.');
  return [name, normalizeSchemaSql(statement)];
}));

export class CredifiOwnerOptInError extends Error {
  constructor(code, message, { status = 400 } = {}) {
    super(message);
    this.name = 'CredifiOwnerOptInError';
    this.code = code;
    this.status = status;
  }
}

const REVIEWED_CREDIFI_BASE_PROVIDERS = Object.freeze([
  Object.freeze({ id: 'drpc', url: 'https://base.drpc.org' }),
  Object.freeze({ id: 'blast', url: 'https://base-mainnet.public.blastapi.io' }),
]);
export const CREDIFI_OWNER_OPT_IN_MAX_TRANSFER_SCAN_BLOCKS = 20;

export function createCredifiOwnerOptInProviders({ publicClients } = {}) {
  const clients = publicClients ?? createLoopersPublicClients({
    rpcUrls: REVIEWED_CREDIFI_BASE_PROVIDERS.map(({ url }) => url), rpcRetryCount: 3, rpcRetryDelay: 1_500,
  });
  if (!Array.isArray(clients) || clients.length !== REVIEWED_CREDIFI_BASE_PROVIDERS.length) {
    throw new TypeError('Credifi owner opt-in requires both reviewed Base provider clients.');
  }
  return Object.freeze(clients.map((publicClient, index) => Object.freeze({
    approved: true, id: REVIEWED_CREDIFI_BASE_PROVIDERS[index].id,
    ...createRestapNetworkBaseProvider({
      publicClient, allowAnyCollectionToken: true, maxRange: CREDIFI_OWNER_OPT_IN_MAX_TRANSFER_SCAN_BLOCKS, rpcMinIntervalMs: 250,
    }),
  })));
}

export function createCredifiOwnerOptInVerifier({
  providers,
  accountIntegrityReader,
  maxTransferScanBlocks = CREDIFI_OWNER_OPT_IN_MAX_TRANSFER_SCAN_BLOCKS,
  timeoutMs = 5_000,
} = {}) {
  if (!Array.isArray(providers) || providers.length < 2 || providers[0]?.id !== 'drpc'
    || !providers.some((provider) => provider?.id === 'blast')
    || providers.some((provider) => provider?.approved !== true || typeof provider?.readCustody !== 'function')) {
    throw new TypeError('Credifi owner opt-in requires the reviewed primary and secondary Base providers.');
  }
  if (!Number.isSafeInteger(maxTransferScanBlocks) || maxTransferScanBlocks < 1
    || providers.some((provider) => !Number.isSafeInteger(provider.maxRange) || provider.maxRange < maxTransferScanBlocks)) {
    throw new TypeError('Credifi custody scan bound exceeds the proven provider bound.');
  }
  const integrityReader = accountIntegrityReader ?? createAccountIntegrityReader({
    providers, timeoutMs, allowUndeployedAccount: false, maxSafeBlockSkew: 0,
  });
  if (typeof integrityReader?.read !== 'function') throw new TypeError('Credifi account integrity reader is required.');

  return Object.freeze({
    async verify({ tokenId, wallet } = {}) {
      tokenId = normalizeVerifierTokenId(tokenId);
      wallet = normalizeWallet(wallet);
      let result;
      try { result = await integrityReader.read({ tokenId }); }
      catch { throw verificationFailure(); }
      if (result?.eligible !== true || result?.status !== 'ready') throw verificationFailure();
      const proof = result.proof;
      const expectedAccount = deriveReleasedLooperAccount(tokenId);
      const collection = LOOPERS_MAINNET_CONTRACT.toLowerCase();
      const valid = Number(proof?.chainId) === LOOPERS_MAINNET_CHAIN_ID
        && String(proof?.collection ?? '').toLowerCase() === collection
        && String(proof?.tokenId ?? '') === tokenId
        && String(proof?.account ?? '').toLowerCase() === expectedAccount
        && proof?.accountDeployed === true
        && String(proof?.owner ?? '').toLowerCase() === wallet
        && String(proof?.accountOwner ?? '').toLowerCase() === wallet
        && String(proof?.controller ?? '').toLowerCase() === wallet
        && String(proof?.latest?.owner ?? '').toLowerCase() === wallet
        && String(proof?.latest?.controller ?? '').toLowerCase() === wallet
        && Number(proof?.accountToken?.chainId) === LOOPERS_MAINNET_CHAIN_ID
        && String(proof?.accountToken?.collection ?? '').toLowerCase() === collection
        && String(proof?.accountToken?.tokenId ?? '') === tokenId
        && /^[1-9]\d*$/u.test(String(proof?.erc8004AgentId ?? ''));
      if (!valid) throw verificationFailure();
      return Object.freeze({
        chainId: LOOPERS_MAINNET_CHAIN_ID,
        contract: LOOPERS_MAINNET_CONTRACT,
        tokenId,
        owner: wallet,
        erc8004AgentId: String(proof.erc8004AgentId),
        controllerVerified: true,
        canonicalAccount: expectedAccount,
        finalizedBlock: normalizeBlock(proof.safeBlock),
      });
    },

    async verifyCustodyEpoch({ identity, consent } = {}) {
      const tokenId = normalizeVerifierTokenId(identity?.tokenId);
      const owner = normalizeWallet(identity?.owner);
      const erc8004AgentId = String(identity?.erc8004AgentId ?? '');
      const canonicalAccount = deriveReleasedLooperAccount(tokenId);
      const current = normalizeBlock(identity?.finalizedBlock);
      const anchor = normalizeBlock(consent?.finalizedBlock);
      const gap = current.number - anchor.number;
      if (gap < 0 || (gap === 0 && current.hash !== anchor.hash)) throw providerDisagreement();
      if (gap > maxTransferScanBlocks) return Object.freeze({ active: false, reason: 'scan_window_expired' });
      if (gap === 0) return Object.freeze({ active: true, reason: null });
      const request = Object.freeze({
        chainId: LOOPERS_MAINNET_CHAIN_ID,
        collection: LOOPERS_MAINNET_CONTRACT,
        tokenId,
        fromBlock: anchor.number + 1,
        toBlock: current.number,
        previousSafeBlock: anchor,
      });
      let evidence;
      try { evidence = await Promise.all(providers.map((provider) => provider.readCustody(request))); }
      catch { throw new CredifiOwnerOptInError('credifi_opt_in_provider_unavailable', 'Credifi custody verification is unavailable.', { status: 503 }); }
      const normalized = evidence.map((value) => normalizeCustodyEvidence(value, {
        tokenId, owner, erc8004AgentId, canonicalAccount, anchor, current,
      }));
      const primary = JSON.stringify(normalized[0]);
      if (normalized.some((value) => JSON.stringify(value) !== primary)) throw providerDisagreement();
      return Object.freeze(normalized[0].events.length
        ? { active: false, reason: 'intervening_transfer' }
        : { active: true, reason: null });
    },
  });
}

function normalizeCustodyEvidence(value, expected) {
  try {
    const safeBlock = normalizeBlock(value?.safeBlock);
    const range = { fromBlock: Number(value?.range?.fromBlock), toBlock: Number(value?.range?.toBlock) };
    const events = JSON.parse(JSON.stringify(value?.events ?? []));
    const valid = safeBlock.number === expected.current.number && safeBlock.hash === expected.current.hash
      && String(value?.safeOwner ?? '').toLowerCase() === expected.owner
      && String(value?.safeController ?? '').toLowerCase() === expected.owner
      && String(value?.safeErc8004AgentId ?? '') === expected.erc8004AgentId
      && String(value?.latestOwner ?? '').toLowerCase() === expected.owner
      && String(value?.latestController ?? '').toLowerCase() === expected.owner
      && String(value?.latestErc8004AgentId ?? '') === expected.erc8004AgentId
      && String(value?.canonicalAccount ?? '').toLowerCase() === expected.canonicalAccount
      && range.fromBlock === expected.anchor.number + 1 && range.toBlock === expected.current.number
      && String(value?.priorSafeHash ?? '').toLowerCase() === expected.anchor.hash
      && Array.isArray(events);
    if (!valid) throw new Error('mismatch');
    return { safeBlock, range, events, priorSafeHash: expected.anchor.hash };
  } catch { throw providerDisagreement(); }
}

function normalizeBlock(value) {
  const number = Number(value?.number);
  const hash = String(value?.hash ?? '').toLowerCase();
  if (!Number.isSafeInteger(number) || number < 0 || !/^0x[a-f0-9]{64}$/u.test(hash)) throw new TypeError('Credifi finalized block is invalid.');
  return Object.freeze({ number, hash });
}

function normalizeVerifierTokenId(value) {
  const tokenId = String(value ?? '');
  if (!/^[1-9]\d*$/u.test(tokenId)) throw new TypeError('Credifi token ID is invalid.');
  return tokenId;
}

function verificationFailure() {
  return new CredifiOwnerOptInError('credifi_opt_in_verification_failed', 'Credifi owner, identity, and released account verification failed.', { status: 403 });
}

function providerDisagreement() {
  return new CredifiOwnerOptInError('credifi_opt_in_provider_disagreement', 'Credifi providers did not agree on finalized custody evidence.', { status: 503 });
}

export function createCredifiOwnerOptInStore({ databasePath = ':memory:', now = () => new Date().toISOString(), busyTimeoutMs = 2_000, custodyVerifier = null } = {}) {
  if (typeof databasePath !== 'string' || !databasePath) throw new TypeError('Credifi opt-in database path is required.');
  if (typeof now !== 'function') throw new TypeError('Credifi opt-in clock is required.');
  if (!Number.isSafeInteger(busyTimeoutMs) || busyTimeoutMs < 0 || busyTimeoutMs > 10_000) throw new TypeError('Credifi opt-in busy timeout is invalid.');
  const db = new DatabaseSync(databasePath);
  let closed = false;
  try {
    if (databasePath !== ':memory:') chmodSync(databasePath, 0o600);
    db.exec('PRAGMA trusted_schema = OFF');
    db.exec('PRAGMA defensive = ON');
    db.exec('PRAGMA busy_timeout = ' + busyTimeoutMs);
    db.exec('PRAGMA journal_mode = WAL');
    migrateAndValidate(db);
  } catch (error) {
    db.close();
    throw error;
  }

  function assertOpen() { if (closed) throw new Error('Credifi owner opt-in store is closed.'); }

  const selectConsent = db.prepare(`SELECT token_id, canonical_account, owner_wallet, erc8004_agent_id, cohort_version, amount_cents, consented_at,
    anchor_block_number, anchor_block_hash, custody_epoch, invalidated_at, invalidation_reason
    FROM credifi_owner_opt_ins WHERE token_id = ? AND owner_wallet = ? AND cohort_version = ?`);

  function inactive(subject) {
    return { ...subject, eligible: true, optedIn: false, created: false, cohortVersion: CREDIFI_PILOT_COHORT_VERSION, amountUsd: CREDIFI_PILOT_AMOUNT_USD, consentedAt: null };
  }

  async function readStatus(subject) {
    const row = selectConsent.get(subject.tokenId, subject.ownerWallet, CREDIFI_PILOT_COHORT_VERSION);
    if (!row || row.invalidated_at !== null) return { value: inactive(subject), row: null };
    if (row.canonical_account !== subject.canonicalAccount || row.erc8004_agent_id !== subject.erc8004AgentId) {
      throw new CredifiOwnerOptInError('credifi_opt_in_binding_changed', 'Stored Credifi consent no longer matches the verified identity.', { status: 409 });
    }
    if (typeof custodyVerifier?.verifyCustodyEpoch !== 'function') {
      throw new CredifiOwnerOptInError('credifi_opt_in_custody_unavailable', 'Credifi custody epoch verification is unavailable.', { status: 503 });
    }
    const consent = projectRow(row, false);
    const checked = await custodyVerifier.verifyCustodyEpoch({ identity: { ...subject, owner: subject.ownerWallet }, consent });
    if (checked?.active === true) return { value: consent, row };
    if (!['intervening_transfer', 'scan_window_expired'].includes(checked?.reason)) throw new Error('Credifi custody verifier returned an invalid result.');
    const invalidatedAt = normalizeTimestamp(now());
    db.prepare(`UPDATE credifi_owner_opt_ins SET invalidated_at = ?, invalidation_reason = ?
      WHERE token_id = ? AND owner_wallet = ? AND cohort_version = ? AND invalidated_at IS NULL`).run(
      invalidatedAt, checked.reason, subject.tokenId, subject.ownerWallet, CREDIFI_PILOT_COHORT_VERSION,
    );
    return { value: inactive(subject), row: null };
  }

  return Object.freeze({
    async getStatus({ identity } = {}) {
      assertOpen();
      const subject = normalizeAuthorizedSubject(identity);
      return (await readStatus(subject)).value;
    },

    async optIn({ identity } = {}) {
      assertOpen();
      const subject = normalizeAuthorizedSubject(identity);
      const existing = await readStatus(subject);
      if (existing.row) return existing.value;
      const consentedAt = normalizeTimestamp(now());
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`INSERT INTO credifi_owner_opt_ins (
          token_id, canonical_account, owner_wallet, erc8004_agent_id, cohort_version, amount_cents, consented_at,
          anchor_block_number, anchor_block_hash, custody_epoch, invalidated_at, invalidation_reason
        ) VALUES (?, ?, ?, ?, ?, 5000, ?, ?, ?, 1, NULL, NULL)
        ON CONFLICT(token_id, owner_wallet, cohort_version) DO UPDATE SET
          canonical_account = excluded.canonical_account,
          erc8004_agent_id = excluded.erc8004_agent_id,
          consented_at = excluded.consented_at,
          anchor_block_number = excluded.anchor_block_number,
          anchor_block_hash = excluded.anchor_block_hash,
          custody_epoch = credifi_owner_opt_ins.custody_epoch + 1,
          invalidated_at = NULL,
          invalidation_reason = NULL
        WHERE credifi_owner_opt_ins.invalidated_at IS NOT NULL`).run(
          subject.tokenId, subject.canonicalAccount, subject.ownerWallet, subject.erc8004AgentId,
          CREDIFI_PILOT_COHORT_VERSION, consentedAt, subject.finalizedBlock.number, subject.finalizedBlock.hash,
        );
        const row = selectConsent.get(subject.tokenId, subject.ownerWallet, CREDIFI_PILOT_COHORT_VERSION);
        if (!row || row.invalidated_at !== null || row.canonical_account !== subject.canonicalAccount
          || row.erc8004_agent_id !== subject.erc8004AgentId || Number(row.amount_cents) !== 5000
          || Number(row.anchor_block_number) !== subject.finalizedBlock.number || row.anchor_block_hash !== subject.finalizedBlock.hash) {
          throw new Error('Stored Credifi consent binding does not match current verified identity.');
        }
        db.exec('COMMIT');
        return projectRow(row, true);
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },

    inspect() {
      assertOpen();
      const integrity = db.prepare('PRAGMA integrity_check').all().map((row) => row.integrity_check).join(',');
      const meta = db.prepare('SELECT schema_version FROM credifi_owner_opt_in_meta WHERE singleton = 1').get();
      const count = db.prepare('SELECT count(*) AS count FROM credifi_owner_opt_ins').get();
      return Object.freeze({ integrity, schemaVersion: Number(meta.schema_version), consentCount: Number(count.count) });
    },

    close() { if (!closed) { db.close(); closed = true; } },
  });
}

function normalizeAuthorizedSubject(identity) {
  const tokenId = String(identity?.tokenId ?? '').trim();
  if (!/^[1-9]\d*$/u.test(tokenId)) throw new TypeError('Verified current owner authority is required.');
  if (!COHORT.has(tokenId)) throw new CredifiOwnerOptInError('credifi_pilot_not_eligible', 'This Looper is not in the prepared Credifi pilot cohort.', { status: 403 });
  const chainId = Number(identity?.chainId);
  const contract = String(identity?.contract ?? '').toLowerCase();
  const ownerWallet = normalizeWallet(identity?.owner);
  const erc8004AgentId = String(identity?.erc8004AgentId ?? '');
  const canonicalAccount = deriveReleasedLooperAccount(tokenId);
  const finalizedBlock = normalizeBlock(identity?.finalizedBlock);
  if (chainId !== LOOPERS_MAINNET_CHAIN_ID || contract !== LOOPERS_MAINNET_CONTRACT.toLowerCase()
    || identity?.controllerVerified !== true || !/^[1-9]\d*$/u.test(erc8004AgentId)
    || String(identity?.canonicalAccount ?? '').toLowerCase() !== canonicalAccount) throw new TypeError('Verified current owner authority is required.');
  return { tokenId, canonicalAccount, ownerWallet, erc8004AgentId, finalizedBlock };
}

function normalizeWallet(value) {
  const wallet = String(value ?? '').trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/u.test(wallet)) throw new TypeError('Verified current owner authority is required.');
  return wallet;
}

function normalizeTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Credifi consent timestamp is invalid.');
  return date.toISOString();
}

function projectRow(row, created) {
  return {
    tokenId: row.token_id, eligible: true, optedIn: true, created, canonicalAccount: row.canonical_account,
    ownerWallet: row.owner_wallet, erc8004AgentId: row.erc8004_agent_id, cohortVersion: row.cohort_version,
    amountUsd: (Number(row.amount_cents) / 100).toFixed(2), consentedAt: row.consented_at,
    finalizedBlock: { number: Number(row.anchor_block_number), hash: row.anchor_block_hash },
    custodyEpoch: Number(row.custody_epoch),
  };
}

function migrateAndValidate(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const migration of MIGRATIONS) for (const statement of migration.statements) db.exec(statement);
    assertExactSchema(db);
    const meta = db.prepare('SELECT schema_version FROM credifi_owner_opt_in_meta WHERE singleton = 1').get();
    if (!meta) db.prepare('INSERT INTO credifi_owner_opt_in_meta (singleton, schema_version, created_at) VALUES (1, ?, ?)').run(SCHEMA_VERSION, normalizeTimestamp(new Date()));
    else if (Number(meta.schema_version) !== SCHEMA_VERSION) throw new Error('Credifi owner opt-in schema version drift.');
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

function assertExactSchema(db) {
  const rows = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name LIKE 'credifi_owner_opt_in%' ORDER BY name").all();
  if (rows.length !== EXPECTED_SCHEMA.size) throw new Error('Credifi owner opt-in schema drift: unexpected table set.');
  for (const row of rows) if (normalizeSchemaSql(row.sql) !== EXPECTED_SCHEMA.get(row.name)) throw new Error('Credifi owner opt-in schema drift: ' + row.name + '.');
}

function normalizeSchemaSql(sql) { return String(sql).replace(/\s+/gu, ' ').trim().toLowerCase().replace(/^create table if not exists/iu, 'create table'); }
