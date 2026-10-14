'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const runner = require('./run-helixa-cred-sync');

function tempCase() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cred-ops-'));
  const dbPath = path.join(root, 'terminal.db');
  const db = new DatabaseSync(dbPath);
  db.exec('CREATE TABLE agents (id INTEGER PRIMARY KEY, platform TEXT, registry TEXT, token_id TEXT, cred_score INTEGER, cred_tier TEXT, last_scored INTEGER)');
  db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?)').run(1, 'helixa', runner.HELIXA_REGISTRY, 'helixa-1', 65, 'QUALIFIED', 1);
  db.close();
  return { root, dbPath, backupDir: path.join(root, 'backups'), reportDir: path.join(root, 'reports'), stateDir: path.join(root, 'state') };
}

function writeBackup(filename, count = 1) {
  const db = new DatabaseSync(filename);
  db.exec('CREATE TABLE backup_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE agent_scores (id INTEGER);');
  db.prepare('INSERT INTO backup_metadata VALUES (?, ?)').run('helixaRowCount', String(count));
  for (let i = 0; i < count; i += 1) db.prepare('INSERT INTO agent_scores VALUES (?)').run(i + 1);
  db.close();
  fs.chmodSync(filename, 0o600);
}

test('successful apply verifies report, backup, persisted rows, and atomic status', async () => {
  const p = tempCase();
  const now = new Date('2026-10-14T23:20:00.000Z');
  let received;
  const result = await runner.runOperationalSync({ ...p, expectedCount: 1, baseUrl: 'http://127.0.0.1:3457', mode: 'apply', internalKey: 'secret' }, {
    now: () => now,
    healthCheck: async () => ({ status: 200, latencyMs: 4 }),
    runSync: async (options) => {
      received = options;
      writeBackup(options.backupPath);
      const report = { schemaVersion: 1, mode: 'apply', expectedCount: 1, helixaCount: 1, changed: 0, unchanged: 1, updated: 0, tierDistribution: { JUNK: 0, MARGINAL: 0, QUALIFIED: 1, PRIME: 0, PREFERRED: 0 }, scores: [{ rowId: 1, tokenId: 1, credScore: 65, credTier: 'QUALIFIED', changed: false }] };
      fs.writeFileSync(options.reportPath, JSON.stringify(report) + '\n', { mode: 0o600 });
      return report;
    },
  });
  assert.equal(received.internalKey, 'secret');
  assert.equal(result.state, 'ok');
  assert.equal(result.helixaCount, 1);
  assert.equal(result.health.status, 200);
  assert.equal(fs.statSync(result.reportPath).mode & 0o777, 0o600);
  assert.equal(fs.statSync(result.backupPath).mode & 0o077, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(p.stateDir, 'status.json'))), result);
});

test('dry-run writes a report without creating or requiring a backup', async () => {
  const p = tempCase();
  const result = await runner.runOperationalSync({ ...p, expectedCount: 1, baseUrl: 'http://127.0.0.1:3457', mode: 'dry-run', internalKey: '' }, {
    now: () => new Date('2026-10-14T23:21:00.000Z'),
    healthCheck: async () => ({ status: 200, latencyMs: 2 }),
    runSync: async (options) => {
      assert.equal(options.backupPath, null);
      const report = { schemaVersion: 1, mode: 'dry-run', expectedCount: 1, helixaCount: 1, changed: 0, unchanged: 1, updated: 0, tierDistribution: { JUNK: 0, MARGINAL: 0, QUALIFIED: 1, PRIME: 0, PREFERRED: 0 }, scores: [{ rowId: 1, tokenId: 1, credScore: 65, credTier: 'QUALIFIED', changed: false }] };
      fs.writeFileSync(options.reportPath, JSON.stringify(report) + '\n', { mode: 0o600 });
      return report;
    },
  });
  assert.equal(result.mode, 'dry-run');
  assert.equal(result.backupPath, null);
});

test('failure state redacts the internal key and preserves the previous run artifacts', async () => {
  const p = tempCase();
  const secret = 'do-not-leak-this';
  await assert.rejects(() => runner.runOperationalSync({ ...p, expectedCount: 1, baseUrl: 'http://127.0.0.1:3457', mode: 'apply', internalKey: secret }, {
    now: () => new Date('2026-10-14T23:22:00.000Z'),
    healthCheck: async () => ({ status: 200, latencyMs: 1 }),
    runSync: async () => { throw new Error('upstream failed ' + secret); },
  }), /upstream failed/);
  const statusText = fs.readFileSync(path.join(p.stateDir, 'status.json'), 'utf8');
  assert.equal(statusText.includes(secret), false);
  const status = JSON.parse(statusText);
  assert.equal(status.state, 'failed');
  assert.match(status.error, /\[REDACTED\]/);
});

test('verification rejects a report that diverges from the persisted Helixa rows', async () => {
  const p = tempCase();
  await assert.rejects(() => runner.runOperationalSync({ ...p, expectedCount: 1, baseUrl: 'http://127.0.0.1:3457', mode: 'apply', internalKey: '' }, {
    now: () => new Date('2026-10-14T23:23:00.000Z'),
    healthCheck: async () => ({ status: 200, latencyMs: 1 }),
    runSync: async (options) => {
      writeBackup(options.backupPath);
      const report = { schemaVersion: 1, mode: 'apply', expectedCount: 1, helixaCount: 1, changed: 1, unchanged: 0, updated: 1, tierDistribution: { JUNK: 0, MARGINAL: 1, QUALIFIED: 0, PRIME: 0, PREFERRED: 0 }, scores: [{ rowId: 1, tokenId: 1, credScore: 40, credTier: 'MARGINAL', changed: true }] };
      fs.writeFileSync(options.reportPath, JSON.stringify(report) + '\n', { mode: 0o600 });
      return report;
    },
  }), /persisted row mismatch/i);
});
