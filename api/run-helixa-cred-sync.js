#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const sync = require('./sync-helixa-cred');

const HELIXA_REGISTRY = sync.HELIXA_REGISTRY;
const DEFAULTS = Object.freeze({
  dbPath: '/home/ubuntu/.openclaw/workspace/terminal/data/terminal.db',
  backupDir: '/home/ubuntu/.openclaw/workspace/terminal/data/backups/canonical-cred',
  reportDir: '/home/ubuntu/.openclaw/workspace/artifacts/canonical-cred-sync',
  stateDir: '/home/ubuntu/.local/state/helixa/cred-sync',
  expectedCount: 5003,
  baseUrl: 'http://127.0.0.1:3457',
  mode: 'apply',
});

function timestamp(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('Invalid run timestamp');
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function secureDirectory(dirname) {
  fs.mkdirSync(dirname, { recursive: true, mode: 0o700 });
  const real = fs.realpathSync(dirname);
  const stat = fs.statSync(real);
  if (!stat.isDirectory()) throw new Error('Operational path is not a directory: ' + dirname);
  fs.chmodSync(real, 0o700);
  return real;
}

function fsyncDirectory(dirname) {
  const fd = fs.openSync(dirname, fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY || 0));
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function writeAtomicJson(filename, value) {
  const dir = secureDirectory(path.dirname(filename));
  const target = path.join(dir, path.basename(filename));
  const staged = target + '.staged-' + process.pid + '-' + Date.now();
  let fd;
  try {
    fd = fs.openSync(staged, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | (fs.constants.O_NOFOLLOW || 0), 0o600);
    fs.writeFileSync(fd, JSON.stringify(value) + '\n');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(staged, target);
    fsyncDirectory(dir);
  } catch (error) {
    if (fd !== undefined) try { fs.closeSync(fd); } catch {}
    try { fs.unlinkSync(staged); } catch {}
    throw error;
  }
  return target;
}

function redact(text, secrets) {
  let result = String(text || 'Unknown failure');
  for (const secret of secrets) if (secret) result = result.split(secret).join('[REDACTED]');
  return result.slice(0, 2000);
}

async function defaultHealthCheck(baseUrl) {
  const started = Date.now();
  const response = await fetch(baseUrl.replace(/\/+$/, '') + '/health', { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('Health check returned HTTP ' + response.status);
  const body = await response.json();
  if (!body || body.status !== 'ok') throw new Error('Health check returned an invalid body');
  return { status: response.status, latencyMs: Date.now() - started };
}

function validateReport(report, options, reportPath) {
  if (!report || report.schemaVersion !== 1) throw new Error('Sync returned an invalid report');
  if (report.mode !== options.mode) throw new Error('Sync report mode mismatch');
  if (report.expectedCount !== options.expectedCount || report.helixaCount !== options.expectedCount) {
    throw new Error('Sync report Helixa count mismatch');
  }
  if (!Array.isArray(report.scores) || report.scores.length !== options.expectedCount) throw new Error('Sync report score count mismatch');
  const stored = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (JSON.stringify(stored) !== JSON.stringify(report)) throw new Error('Published sync report differs from returned report');
}

function verifyBackup(filename, expectedCount) {
  const stat = fs.statSync(filename);
  if (!stat.isFile() || (stat.mode & 0o077) !== 0) throw new Error('Rollback backup permissions are not private');
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    if (db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Rollback backup quick_check failed');
    const count = Number(db.prepare('SELECT COUNT(*) AS count FROM agent_scores').get().count);
    const metadata = Number(db.prepare("SELECT value FROM backup_metadata WHERE key='helixaRowCount'").get().value);
    if (count !== expectedCount || metadata !== expectedCount) throw new Error('Rollback backup row count mismatch');
  } finally { db.close(); }
}

function verifyPersistedRows(dbPath, report) {
  const expected = new Map(report.scores.map((row) => [Number(row.rowId), row]));
  if (expected.size !== report.helixaCount) throw new Error('Sync report contains duplicate row IDs');
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const rows = db.prepare("SELECT id, cred_score, cred_tier FROM agents WHERE platform = 'helixa' OR registry = ? ORDER BY id").all(HELIXA_REGISTRY);
    if (rows.length !== report.helixaCount) throw new Error('Persisted Helixa row count mismatch');
    for (const row of rows) {
      const wanted = expected.get(Number(row.id));
      if (!wanted || Number(row.cred_score) !== wanted.credScore || row.cred_tier !== wanted.credTier) {
        throw new Error('Persisted row mismatch for Helixa row ' + row.id);
      }
    }
  } finally { db.close(); }
}

function normalizeConfig(config) {
  const result = { ...DEFAULTS, ...config };
  if (!['apply', 'dry-run'].includes(result.mode)) throw new Error('mode must be apply or dry-run');
  if (!Number.isSafeInteger(result.expectedCount) || result.expectedCount < 1) throw new Error('expectedCount must be a positive integer');
  for (const key of ['dbPath', 'backupDir', 'reportDir', 'stateDir', 'baseUrl']) {
    if (typeof result[key] !== 'string' || !result[key]) throw new Error(key + ' is required');
  }
  result.dbPath = fs.realpathSync(result.dbPath);
  result.backupDir = secureDirectory(result.backupDir);
  result.reportDir = secureDirectory(result.reportDir);
  result.stateDir = secureDirectory(result.stateDir);
  result.internalKey = typeof result.internalKey === 'string' ? result.internalKey : '';
  return result;
}

async function runOperationalSync(config = {}, dependencies = {}) {
  const options = normalizeConfig(config);
  const now = dependencies.now || (() => new Date());
  const runSync = dependencies.runSync || sync.runSync;
  const healthCheck = dependencies.healthCheck || defaultHealthCheck;
  const started = now();
  const stamp = timestamp(started);
  const prefix = options.mode === 'apply' ? 'canonical-cred' : 'canonical-cred-dry-run';
  const reportPath = path.join(options.reportDir, prefix + '-' + stamp + '.json');
  const backupPath = options.mode === 'apply' ? path.join(options.backupDir, prefix + '-' + stamp + '.sqlite') : null;
  const statusPath = path.join(options.stateDir, 'status.json');
  for (const filename of [reportPath, backupPath].filter(Boolean)) if (fs.existsSync(filename)) throw new Error('Run artifact already exists: ' + filename);
  writeAtomicJson(statusPath, { schemaVersion: 1, state: 'running', mode: options.mode, startedAt: started.toISOString(), expectedCount: options.expectedCount, reportPath, backupPath });
  let committed = false;
  try {
    const preHealth = await healthCheck(options.baseUrl);
    const report = await runSync({
      dbPath: options.dbPath, baseUrl: options.baseUrl, apply: options.mode === 'apply',
      backupPath, reportPath, expectedCount: options.expectedCount, concurrency: 8,
      timeoutMs: 15_000, retries: 3, internalKey: options.internalKey,
    });
    committed = options.mode === 'apply';
    validateReport(report, options, reportPath);
    if (options.mode === 'apply') {
      verifyBackup(backupPath, options.expectedCount);
      verifyPersistedRows(options.dbPath, report);
    }
    const health = await healthCheck(options.baseUrl);
    const finished = now();
    const status = {
      schemaVersion: 1, state: 'ok', mode: options.mode, startedAt: started.toISOString(), finishedAt: finished.toISOString(),
      expectedCount: options.expectedCount, helixaCount: report.helixaCount, changed: report.changed, updated: report.updated,
      tierDistribution: report.tierDistribution, reportPath, backupPath, preHealth, health,
    };
    writeAtomicJson(statusPath, status);
    return status;
  } catch (error) {
    const failed = {
      schemaVersion: 1, state: 'failed', mode: options.mode, startedAt: started.toISOString(), finishedAt: now().toISOString(),
      expectedCount: options.expectedCount, reportPath, backupPath, committed, error: redact(error.message, [options.internalKey]),
    };
    try { writeAtomicJson(statusPath, failed); } catch {}
    throw new Error(redact(error.message, [options.internalKey]));
  }
}

function cliConfig(argv, env = process.env) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  for (const arg of argv) if (arg !== '--dry-run') throw new Error('Unknown argument: ' + arg);
  return {
    ...DEFAULTS,
    mode: argv.includes('--dry-run') ? 'dry-run' : 'apply',
    dbPath: env.CRED_SYNC_DB || DEFAULTS.dbPath,
    backupDir: env.CRED_SYNC_BACKUP_DIR || DEFAULTS.backupDir,
    reportDir: env.CRED_SYNC_REPORT_DIR || DEFAULTS.reportDir,
    stateDir: env.CRED_SYNC_STATE_DIR || DEFAULTS.stateDir,
    baseUrl: env.HELIXA_CRED_BASE_URL || DEFAULTS.baseUrl,
    expectedCount: env.CRED_SYNC_EXPECTED_COUNT ? Number(env.CRED_SYNC_EXPECTED_COUNT) : DEFAULTS.expectedCount,
    internalKey: env.INTERNAL_API_KEY || env.HELIXA_INTERNAL_KEY || '',
  };
}

async function main(argv = process.argv.slice(2), env = process.env) {
  try {
    const config = cliConfig(argv, env);
    if (config.help) { process.stdout.write('Usage: node run-helixa-cred-sync.js [--dry-run]\n'); return 0; }
    const result = await runOperationalSync(config);
    process.stdout.write(JSON.stringify(result) + '\n');
    return 0;
  } catch (error) {
    process.stderr.write('CRED sync failed: ' + error.message + '\n');
    return 1;
  }
}

module.exports = { HELIXA_REGISTRY, DEFAULTS, timestamp, writeAtomicJson, verifyBackup, verifyPersistedRows, runOperationalSync, cliConfig, main };
if (require.main === module) main().then((code) => { process.exitCode = code; });
