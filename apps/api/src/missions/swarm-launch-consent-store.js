import { chmodSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const ADDRESS = /^0x[0-9a-f]{40}$/u;
const HASH = /^[0-9a-f]{64}$/u;
const MANIFEST_HASH = /^0x[0-9a-f]{64}$/u;

export function createSwarmLaunchConsentStore({ filename } = {}) {
  if (typeof filename !== 'string' || !filename) throw new TypeError('Consent database filename is required.');
  const db = new DatabaseSync(filename);
  let closed = false;
  try {
    if (filename !== ':memory:') chmodSync(filename, 0o600);
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA trusted_schema = OFF');
    db.exec('PRAGMA busy_timeout = 2000');
    db.exec('PRAGMA journal_mode = WAL');
    db.exec(`CREATE TABLE IF NOT EXISTS swarm_launch_consent_proposals (
      proposal_id TEXT PRIMARY KEY,
      initiator_wallet TEXT NOT NULL CHECK(length(initiator_wallet)=42),
      manifest_sha256 TEXT NOT NULL CHECK(length(manifest_sha256)=66),
      manifest_json TEXT NOT NULL,
      input_json TEXT NOT NULL,
      participants_json TEXT NOT NULL,
      created_at INTEGER NOT NULL CHECK(created_at>=0),
      expires_at INTEGER NOT NULL CHECK(expires_at>created_at)
    ) STRICT`);
    db.exec(`CREATE TABLE IF NOT EXISTS swarm_launch_consents (
      proposal_id TEXT NOT NULL,
      wallet TEXT NOT NULL CHECK(length(wallet)=42),
      signature_hash TEXT NOT NULL CHECK(length(signature_hash)=64),
      consented_at INTEGER NOT NULL CHECK(consented_at>=0),
      PRIMARY KEY(proposal_id,wallet),
      FOREIGN KEY(proposal_id) REFERENCES swarm_launch_consent_proposals(proposal_id) ON DELETE CASCADE
    ) STRICT`);
  } catch (error) { db.close(); throw error; }

  const readProposal = db.prepare('SELECT * FROM swarm_launch_consent_proposals WHERE proposal_id = ?');
  const readConsents = db.prepare('SELECT wallet, signature_hash, consented_at FROM swarm_launch_consents WHERE proposal_id = ? ORDER BY wallet');
  const insertProposal = db.prepare('INSERT INTO swarm_launch_consent_proposals (proposal_id,initiator_wallet,manifest_sha256,manifest_json,input_json,participants_json,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)');
  const insertConsent = db.prepare('INSERT INTO swarm_launch_consents (proposal_id,wallet,signature_hash,consented_at) VALUES (?,?,?,?) ON CONFLICT(proposal_id,wallet) DO NOTHING');
  const deleteExpiredConsents = db.prepare('DELETE FROM swarm_launch_consents WHERE proposal_id IN (SELECT proposal_id FROM swarm_launch_consent_proposals WHERE expires_at <= ?)');
  const deleteExpiredProposals = db.prepare('DELETE FROM swarm_launch_consent_proposals WHERE expires_at <= ?');
  const countActiveForInitiator = db.prepare('SELECT count(*) AS count FROM swarm_launch_consent_proposals WHERE initiator_wallet = ? AND expires_at > ?');
  const countActiveTotal = db.prepare('SELECT count(*) AS count FROM swarm_launch_consent_proposals WHERE expires_at > ?');

  function assertOpen() { if (closed) throw new Error('Consent store is closed.'); }
  function read(proposalIdValue) {
    assertOpen();
    const proposalId = identifier(proposalIdValue, 'proposalId');
    const row = readProposal.get(proposalId);
    if (!row) return null;
    return Object.freeze({
      proposalId: row.proposal_id,
      initiatorWallet: address(row.initiator_wallet),
      manifestSha256: manifestHash(row.manifest_sha256),
      manifest: freezeJson(JSON.parse(row.manifest_json)),
      input: freezeJson(JSON.parse(row.input_json)),
      participants: freezeJson(JSON.parse(row.participants_json)),
      createdAt: timestamp(row.created_at, 'createdAt'),
      expiresAt: timestamp(row.expires_at, 'expiresAt'),
      consents: Object.freeze(readConsents.all(proposalId).map((entry) => Object.freeze({ wallet: address(entry.wallet), signatureHash: hash(entry.signature_hash), consentedAt: timestamp(entry.consented_at, 'consentedAt') }))),
    });
  }

  return Object.freeze({
    create(value = {}) {
      assertOpen();
      const proposalId = identifier(value.proposalId, 'proposalId');
      const initiatorWallet = address(value.initiatorWallet);
      const manifestSha256 = manifestHash(value.manifestSha256);
      const createdAt = timestamp(value.createdAt, 'createdAt');
      const expiresAt = timestamp(value.expiresAt, 'expiresAt');
      if (expiresAt <= createdAt) throw new TypeError('expiresAt is invalid.');
      const participants = normalizeParticipants(value.participants);
      db.exec('BEGIN IMMEDIATE');
      try {
        deleteExpiredConsents.run(createdAt);
        deleteExpiredProposals.run(createdAt);
        if (Number(countActiveForInitiator.get(initiatorWallet, createdAt).count) >= 10) throw new Error('Active consent proposal limit exceeded.');
        if (Number(countActiveTotal.get(createdAt).count) >= 10_000) throw new Error('Global consent proposal limit exceeded.');
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      const manifestJson = plainJson(value.manifest, 'manifest');
      const inputJson = plainJson(value.input, 'input');
      try { insertProposal.run(proposalId, initiatorWallet, manifestSha256, manifestJson, inputJson, JSON.stringify(participants), createdAt, expiresAt); }
      catch (error) { if (/unique|primary key/iu.test(error?.message ?? '')) throw new Error('Consent proposal ID already exists.'); throw error; }
      return read(proposalId);
    },
    read,
    consent(value = {}) {
      assertOpen();
      const proposalId = identifier(value.proposalId, 'proposalId');
      const wallet = address(value.wallet);
      const signatureHash = hash(value.signatureHash);
      const consentedAt = timestamp(value.consentedAt, 'consentedAt');
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = readProposal.get(proposalId);
        if (!row) throw new Error('Consent proposal not found.');
        if (consentedAt >= Number(row.expires_at)) throw new Error('Consent proposal expired.');
        const participants = JSON.parse(row.participants_json);
        if (!participants.some((participant) => participant.wallet === wallet)) throw new Error('Wallet is not a proposal participant.');
        insertConsent.run(proposalId, wallet, signatureHash, consentedAt);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return read(proposalId);
    },
    close() { if (closed) return; db.close(); closed = true; },
  });
}

function normalizeParticipants(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) throw new TypeError('participants is invalid.');
  const participants = value.map((entry) => ({ wallet: address(entry?.wallet), tokenIds: normalizeTokenIds(entry?.tokenIds) }));
  if (new Set(participants.map((entry) => entry.wallet)).size !== participants.length) throw new TypeError('participants contains duplicate wallets.');
  return participants;
}
function normalizeTokenIds(value) { if (!Array.isArray(value) || value.length < 1 || value.length > 5) throw new TypeError('tokenIds is invalid.'); const ids=value.map((entry)=>{const text=String(entry??'');if(!/^[1-9][0-9]*$/u.test(text))throw new TypeError('tokenId is invalid.');return text;}); if(new Set(ids).size!==ids.length)throw new TypeError('tokenIds contains duplicates.'); return ids; }
function identifier(value,label){const text=String(value??'');if(!ID.test(text))throw new TypeError(label+' is invalid.');return text;}
function address(value){const text=String(value??'').toLowerCase();if(!ADDRESS.test(text))throw new TypeError('wallet is invalid.');return text;}
function hash(value){const text=String(value??'').toLowerCase();if(!HASH.test(text))throw new TypeError('hash is invalid.');return text;}
function manifestHash(value){const text=String(value??'').toLowerCase();if(!MANIFEST_HASH.test(text))throw new TypeError('manifest hash is invalid.');return text;}
function timestamp(value,label){const number=Number(value);if(!Number.isSafeInteger(number)||number<0)throw new TypeError(label+' is invalid.');return number;}
function plainJson(value,label){if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw new TypeError(label+' is invalid.'); try{return JSON.stringify(value);}catch{throw new TypeError(label+' is invalid.');}}
function freezeJson(value){if(Array.isArray(value)){value.forEach(freezeJson);return Object.freeze(value);}if(value&&typeof value==='object'){Object.values(value).forEach(freezeJson);return Object.freeze(value);}return value;}
