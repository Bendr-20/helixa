#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const HELIXA_REGISTRY = '0x2e3b541c59d38b84e3bc54e977200230a204fe60';
const DEFAULT_DB_PATH = path.join(__dirname, 'data', 'terminal.db');
const DEFAULT_BASE_URL = 'http://127.0.0.1:3457';
const PRODUCTION_HELIXA_COUNT = 5003;
const MAX_RETRY_DELAY_MS = 60_000;
const TIERS = ['JUNK', 'MARGINAL', 'QUALIFIED', 'PRIME', 'PREFERRED'];
const ROSTER_SQL = `SELECT id, platform, registry, token_id, cred_score, cred_tier, last_scored
  FROM agents
  WHERE platform = 'helixa' OR registry = ?
  ORDER BY id`;

function getTier(score) {
  if (score >= 91) return 'PREFERRED';
  if (score >= 76) return 'PRIME';
  if (score >= 51) return 'QUALIFIED';
  if (score >= 26) return 'MARGINAL';
  return 'JUNK';
}

function integerOption(name, value, min, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`--${name} must be an integer from ${min} to ${max}`);
  }
  return parsed;
}

function normalizeBaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('--base-url must be a valid URL'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('--base-url must use http or https');
  if (url.username || url.password) throw new Error('--base-url must not contain credentials');
  if (url.search || url.hash) throw new Error('--base-url must not contain a query or fragment');
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/$/, '');
}

function parseArgs(argv, env = process.env) {
  const options = {
    dbPath: DEFAULT_DB_PATH,
    baseUrl: (typeof env.HELIXA_CRED_BASE_URL === 'string' && env.HELIXA_CRED_BASE_URL.trim()) || DEFAULT_BASE_URL,
    apply: false,
    backupPath: null,
    reportPath: null,
    expectedCount: null,
    concurrency: 8,
    timeoutMs: 5000,
    retries: 2,
    internalKey: typeof env.HELIXA_INTERNAL_KEY === 'string' ? env.HELIXA_INTERNAL_KEY.trim() : '',
    help: false,
  };
  let dryRun = false;
  let explicitDb = false;
  let explicitExpectedCount = false;
  let explicitBackup = false;
  let explicitReport = false;
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--apply') options.apply = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--db=')) { options.dbPath = arg.slice(5); explicitDb = true; }
    else if (arg.startsWith('--base-url=')) options.baseUrl = arg.slice(11);
    else if (arg.startsWith('--backup=')) { options.backupPath = arg.slice(9); explicitBackup = true; }
    else if (arg.startsWith('--report=')) { options.reportPath = arg.slice(9); explicitReport = true; }
    else if (arg.startsWith('--expected-count=')) {
      options.expectedCount = integerOption('expected-count', arg.slice(17), 0, Number.MAX_SAFE_INTEGER);
      explicitExpectedCount = true;
    }
    else if (arg.startsWith('--concurrency=')) options.concurrency = integerOption('concurrency', arg.slice(14), 1, 32);
    else if (arg.startsWith('--timeout-ms=')) options.timeoutMs = integerOption('timeout-ms', arg.slice(13), 10, 60000);
    else if (arg.startsWith('--retries=')) options.retries = integerOption('retries', arg.slice(10), 0, 5);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.help) return options;
  if (!options.dbPath) throw new Error('--db requires a non-empty path');
  if (!options.baseUrl) throw new Error('--base-url requires a non-empty URL');
  if (options.apply && dryRun) throw new Error('--apply and --dry-run are mutually exclusive');
  if (!options.apply && options.backupPath) throw new Error('--backup is only valid with --apply');
  if (options.apply && !explicitDb) throw new Error('--apply requires explicit --db=PATH');
  if (options.apply && !explicitExpectedCount) throw new Error('--apply requires explicit --expected-count=5003');
  if (options.apply && options.expectedCount !== PRODUCTION_HELIXA_COUNT) {
    throw new Error('--apply requires --expected-count=5003');
  }
  if (options.apply && (!explicitBackup || !options.backupPath)) throw new Error('--apply requires explicit --backup=PATH');
  if (options.apply && (!explicitReport || !options.reportPath)) throw new Error('--apply requires explicit --report=PATH');
  options.dbPath = path.resolve(options.dbPath);
  options.backupPath = options.backupPath ? path.resolve(options.backupPath) : null;
  options.reportPath = options.reportPath ? path.resolve(options.reportPath) : null;
  options.baseUrl = normalizeBaseUrl(options.baseUrl);
  return options;
}

function printHelp() {
  process.stdout.write(`Usage: node sync-helixa-cred.js [options]

Fetch every persisted Helixa agent's public /api/v2/agent/:id/cred result.
Default mode is a complete read-only dry-run. Optional internal auth is read only from HELIXA_INTERNAL_KEY.

Options:
  --db=PATH             Terminal SQLite database
  --base-url=URL        Helixa API origin (default: HELIXA_CRED_BASE_URL or http://127.0.0.1:3457)
  --dry-run             Fetch and validate only (default)
  --apply               Atomically update all Helixa rows after complete preflight
                        Requires explicit --db, --expected-count=5003, --backup, and --report
  --backup=PATH         Required compact rollback SQLite database for --apply
  --report=PATH         Atomically write the compact JSON report
  --expected-count=N    Require exactly N persisted Helixa rows
  --concurrency=N       Concurrent requests (1-32; default 8)
  --timeout-ms=N        Per-attempt timeout (10-60000; default 5000)
  --retries=N           Retries after a failed attempt (0-5; default 2)
  --help                Show this help
`);
}

function nativeRealpath(filename) {
  return (fs.realpathSync.native || fs.realpathSync)(filename);
}

function existingIdentity(filename, label) {
  if (!fs.existsSync(filename)) throw new Error(`${label} does not exist: ${filename}`);
  const realPath = nativeRealpath(filename);
  const stat = fs.statSync(realPath);
  if (!stat.isFile()) throw new Error(`${label} is not a file: ${filename}`);
  return { path: realPath, exists: true, dev: stat.dev, ino: stat.ino, label };
}

function outputIdentity(filename, label) {
  if (fs.existsSync(filename)) return existingIdentity(filename, label);
  const resolved = path.resolve(filename);
  const parent = nativeRealpath(path.dirname(resolved));
  if (!fs.statSync(parent).isDirectory()) throw new Error(`${label} parent is not a directory: ${parent}`);
  return { path: path.join(parent, path.basename(resolved)), exists: false, label };
}

function sameIdentity(a, b) {
  return a.path === b.path || (a.exists && b.exists && a.dev === b.dev && a.ino === b.ino);
}

function canonicalizeOptions(options) {
  const db = existingIdentity(options.dbPath, 'Source database');
  let backup = null;
  let report = null;
  if (options.backupPath) {
    backup = outputIdentity(options.backupPath, 'Backup');
    if (sameIdentity(db, backup)) throw new Error('Source database and backup refer to the same file or alias');
    if (backup.exists) throw new Error(`Backup already exists: ${backup.path}`);
  }
  if (options.reportPath) {
    report = outputIdentity(options.reportPath, 'Report');
    if (sameIdentity(db, report)) throw new Error('Source database and report refer to the same file or alias');
    if (report.exists) throw new Error(`Report already exists: ${report.path}`);
    if (backup && sameIdentity(backup, report)) throw new Error('Backup and report refer to the same path or alias');
  }
  return { ...options, dbPath: db.path, backupPath: backup && backup.path, reportPath: report && report.path };
}

function ensureSchema(db) {
  const columns = new Set(db.prepare('PRAGMA table_info(agents)').all().map((row) => row.name));
  for (const name of ['id', 'platform', 'registry', 'token_id', 'cred_score', 'cred_tier', 'last_scored']) {
    if (!columns.has(name)) throw new Error(`Source database agents table is missing ${name}`);
  }
}

function tokenIdFor(row) {
  const raw = String(row.token_id ?? '').trim();
  let match = /^helixa-(\d+)$/i.exec(raw);
  if (!match && String(row.registry || '').toLowerCase() === HELIXA_REGISTRY) match = /^(\d+)$/.exec(raw);
  if (!match) return null;
  const tokenId = Number(match[1]);
  return Number.isSafeInteger(tokenId) && tokenId >= 0 ? tokenId : null;
}

function readRoster(db) {
  ensureSchema(db);
  const rows = db.prepare(ROSTER_SQL).all(HELIXA_REGISTRY);
  const seen = new Map();
  return rows.map((row) => {
    const tokenId = tokenIdFor(row);
    if (tokenId === null) throw new Error(`Helixa row ${row.id} has missing or invalid token_id`);
    if (seen.has(tokenId)) throw new Error(`Duplicate Helixa tokenId ${tokenId} in rows ${seen.get(tokenId)} and ${row.id}`);
    seen.set(tokenId, row.id);
    return { ...row, tokenId };
  });
}

function assertExpectedCount(roster, expectedCount) {
  if (expectedCount !== null && roster.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} Helixa rows but found ${roster.length}`);
  }
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function retryAfterDelay(value, nowMs = Date.now()) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  const seconds = Number(trimmed);
  let delay;
  if (Number.isFinite(seconds) && seconds >= 0) delay = Math.ceil(seconds * 1000);
  else {
    const date = Date.parse(trimmed);
    if (!Number.isFinite(date)) return null;
    delay = Math.max(0, date - nowMs);
  }
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

async function fetchAttempt(options, tokenId, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timeout after ${options.timeoutMs}ms`)), options.timeoutMs);
  const headers = { accept: 'application/json' };
  if (options.internalKey) headers['x-internal-key'] = options.internalKey;
  try {
    const response = await fetchImpl(`${options.baseUrl}/api/v2/agent/${tokenId}/cred`, {
      signal: controller.signal,
      headers,
      redirect: options.internalKey ? 'error' : 'follow',
    });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      if (response.status === 429) error.retryAfterMs = retryAfterDelay(response.headers.get('retry-after'));
      throw error;
    }
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) throw new Error(`Non-JSON response (content-type ${contentType || 'missing'})`);
    const text = await response.text();
    if (text.length > 1_000_000) throw new Error('JSON response exceeds 1MB');
    try { return JSON.parse(text); }
    catch { throw new Error('Invalid JSON response'); }
  } finally {
    clearTimeout(timer);
  }
}

function validateResponse(tokenId, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON response must be an object');
  if (!Number.isSafeInteger(value.tokenId) || value.tokenId !== tokenId) {
    throw new Error(`tokenId mismatch: requested ${tokenId}, received ${value.tokenId}`);
  }
  if (!Number.isInteger(value.credScore) || value.credScore < 0 || value.credScore > 100) {
    throw new Error(`Invalid credScore for tokenId ${tokenId}`);
  }
  if (!TIERS.includes(value.tier)) throw new Error(`Invalid tier for tokenId ${tokenId}: ${value.tier}`);
  const expectedTier = getTier(value.credScore);
  if (value.tier !== expectedTier) {
    throw new Error(`tier mismatch for tokenId ${tokenId}: score ${value.credScore} requires ${expectedTier}, received ${value.tier}`);
  }
  return { tokenId, credScore: value.credScore, credTier: value.tier };
}

async function fetchCanonical(options, tokenId, dependencies = {}) {
  const sleepImpl = dependencies.sleep || sleep;
  let lastError;
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try { return validateResponse(tokenId, await fetchAttempt(options, tokenId, dependencies)); }
    catch (error) {
      lastError = error;
      if (attempt < options.retries) {
        const fallback = Math.min(100 * (attempt + 1), MAX_RETRY_DELAY_MS);
        await sleepImpl(error.status === 429 && Number.isFinite(error.retryAfterMs) ? error.retryAfterMs : fallback);
      }
    }
  }
  throw new Error(`tokenId ${tokenId}: ${lastError.message}`);
}

async function mapBounded(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try { results[index] = { ok: true, value: await worker(items[index]) }; }
      catch (error) { results[index] = { ok: false, error }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(items.length, 1)) }, run));
  return results;
}

async function completePreflight(options, roster, dependencies = {}) {
  const outcomes = await mapBounded(roster, options.concurrency, (row) => fetchCanonical(options, row.tokenId, dependencies));
  const errors = outcomes.filter((outcome) => !outcome.ok).map((outcome) => outcome.error.message);
  if (errors.length) throw new Error(`Canonical CRED preflight failed; no writes made: ${errors.join('; ')}`);
  const values = outcomes.map((outcome) => outcome.value);
  if (values.length !== roster.length || new Set(values.map((value) => value.tokenId)).size !== roster.length) {
    throw new Error('Canonical CRED preflight returned missing or duplicate responses; no writes made');
  }
  const byToken = new Map(values.map((value) => [value.tokenId, value]));
  return roster.map((row) => {
    const score = byToken.get(row.tokenId);
    if (!score) throw new Error(`Missing canonical response for tokenId ${row.tokenId}`);
    return {
      ...row,
      ...score,
      changed: row.cred_score !== score.credScore || row.cred_tier !== score.credTier,
    };
  }).sort((a, b) => a.tokenId - b.tokenId || a.id - b.id);
}

function rosterSignature(rows) {
  return JSON.stringify(rows.map((row) => [row.id, row.tokenId, row.token_id, row.cred_score, row.cred_tier, row.last_scored]));
}

function removeFiles(filename) {
  if (!filename) return;
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    try { fs.rmSync(filename + suffix, { force: true }); } catch {}
  }
}

function fsyncDirectory(directory, phase, io = {}) {
  if (io.fsyncDirectory) return io.fsyncDirectory(directory, phase);
  const fd = fs.openSync(directory, 'r');
  try { fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
}

function reserveBackup(filename) {
  const flags = fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR |
    (fs.constants.O_NOFOLLOW || 0);
  let fd;
  let reservation;
  try {
    fd = fs.openSync(filename, flags, 0o600);
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) throw new Error('Backup reservation is not a regular file');
    reservation = { path: filename, fd, dev: stat.dev, ino: stat.ino };
    fsyncDirectory(path.dirname(filename), 'backup-reserve');
    return reservation;
  } catch (error) {
    if (reservation && reservedPathMatches(reservation)) {
      try { fs.unlinkSync(filename); } catch {}
    }
    if (fd !== undefined) try { fs.closeSync(fd); } catch {}
    throw new Error(`Failed to reserve backup destination: ${error.message}`);
  }
}

function reservedPathMatches(reservation) {
  try {
    const pathStat = fs.lstatSync(reservation.path);
    const fdStat = fs.fstatSync(reservation.fd);
    return pathStat.isFile() && !pathStat.isSymbolicLink() &&
      pathStat.dev === reservation.dev && pathStat.ino === reservation.ino &&
      fdStat.dev === reservation.dev && fdStat.ino === reservation.ino;
  } catch {
    return false;
  }
}

function assertReservedBackup(reservation) {
  if (!reservation || !reservedPathMatches(reservation)) {
    throw new Error('Backup reservation identity changed (symlink, hardlink, or path swap detected)');
  }
}

function releaseBackupReservation(reservation, remove) {
  if (!reservation) return;
  if (remove && reservedPathMatches(reservation)) {
    try {
      fs.unlinkSync(reservation.path);
      fsyncDirectory(path.dirname(reservation.path), 'backup-remove');
    } catch {}
  }
  try { fs.closeSync(reservation.fd); } catch {}
}

function createCompactBackup(reservation, sourcePath, roster, createdAt) {
  let backup;
  try {
    assertReservedBackup(reservation);
    backup = new DatabaseSync(':memory:');
    backup.exec(`PRAGMA journal_mode = DELETE;
      CREATE TABLE backup_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE agent_scores (
        id INTEGER PRIMARY KEY,
        token_id TEXT NOT NULL,
        cred_score INTEGER,
        cred_tier TEXT,
        last_scored INTEGER
      );`);
    const meta = backup.prepare('INSERT INTO backup_metadata (key, value) VALUES (?, ?)');
    meta.run('schemaVersion', '1');
    meta.run('sourcePath', sourcePath);
    meta.run('createdAt', createdAt);
    meta.run('helixaRowCount', String(roster.length));
    const insert = backup.prepare('INSERT INTO agent_scores VALUES (?, ?, ?, ?, ?)');
    backup.exec('BEGIN');
    try {
      for (const row of roster) insert.run(row.id, String(row.token_id), row.cred_score, row.cred_tier, row.last_scored);
      const count = Number(backup.prepare('SELECT COUNT(*) AS count FROM agent_scores').get().count);
      if (count !== roster.length) throw new Error(`Backup row count mismatch: expected ${roster.length}, found ${count}`);
      backup.exec('COMMIT');
    } catch (error) {
      backup.exec('ROLLBACK');
      throw error;
    }
    if (backup.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('Backup quick_check failed');
    const serialized = backup.serialize();
    backup.close();
    backup = null;
    assertReservedBackup(reservation);
    fs.ftruncateSync(reservation.fd, 0);
    let offset = 0;
    while (offset < serialized.length) {
      offset += fs.writeSync(reservation.fd, serialized, offset, serialized.length - offset, offset);
    }
    fs.fsyncSync(reservation.fd);
    assertReservedBackup(reservation);
  } catch (error) {
    if (backup) try { backup.close(); } catch {}
    throw error;
  }
}

function tierDistribution(scores) {
  const result = Object.fromEntries(TIERS.map((tier) => [tier, 0]));
  for (const score of scores) result[score.credTier] += 1;
  return result;
}

function buildReport(options, scores, state) {
  const changed = scores.filter((score) => score.changed).length;
  return {
    schemaVersion: 1,
    mode: options.apply ? 'apply' : 'dry-run',
    source: 'public-cred-endpoint',
    dbPath: options.dbPath,
    baseUrl: options.baseUrl,
    expectedCount: options.expectedCount,
    helixaCount: scores.length,
    fetched: scores.length,
    changed,
    unchanged: scores.length - changed,
    updated: state.updated,
    lastScored: state.lastScored,
    backupPath: state.backupPath,
    tierDistribution: tierDistribution(scores),
    scores: scores.map((score) => ({
      rowId: score.id,
      tokenId: score.tokenId,
      credScore: score.credScore,
      credTier: score.credTier,
      changed: score.changed,
    })),
  };
}

function stageReport(filename, report, io = {}) {
  if (!filename) return null;
  const stagedPath = `${filename}.staged-${process.pid}`;
  let fd;
  try {
    const flags = fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY |
      (fs.constants.O_NOFOLLOW || 0);
    fd = fs.openSync(stagedPath, flags, 0o600);
    fs.writeFileSync(fd, JSON.stringify(report) + '\n');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fsyncDirectory(path.dirname(stagedPath), 'stage', io);
    return stagedPath;
  } catch (error) {
    if (fd !== undefined) try { fs.closeSync(fd); } catch {}
    removeFiles(stagedPath);
    throw error;
  }
}

function finalizeStagedReport(stagedPath, filename, io = {}) {
  if (!stagedPath) return;
  try {
    (io.renameSync || fs.renameSync)(stagedPath, filename);
  } catch (error) {
    error.reportPublishPhase = 'rename';
    throw error;
  }
  try {
    fsyncDirectory(path.dirname(filename), 'finalize', io);
  } catch (error) {
    error.reportPublishPhase = 'directory-fsync';
    throw error;
  }
}

function applyScores(options, originalRoster, scores, lastScored, backupReservation, dependencies = {}) {
  const db = new DatabaseSync(options.dbPath);
  let transaction = false;
  try {
    db.exec('PRAGMA busy_timeout = 5000');
    assertReservedBackup(backupReservation);
    if (dependencies.beforeBegin) dependencies.beforeBegin();
    db.exec('BEGIN IMMEDIATE');
    transaction = true;
    const currentRoster = readRoster(db);
    assertExpectedCount(currentRoster, options.expectedCount);
    if (rosterSignature(currentRoster) !== rosterSignature(originalRoster)) {
      throw new Error('Helixa roster or score state changed after preflight; no writes made');
    }
    const createdAt = new Date(lastScored * 1000).toISOString();
    assertReservedBackup(backupReservation);
    createCompactBackup(backupReservation, options.dbPath, currentRoster, createdAt);
    const update = db.prepare('UPDATE agents SET cred_score = ?, cred_tier = ?, last_scored = ? WHERE id = ?');
    const changedScores = scores.filter((score) => score.changed).sort((a, b) => a.id - b.id);
    let updated = 0;
    for (const score of changedScores) {
      const result = update.run(score.credScore, score.credTier, lastScored, score.id);
      if (Number(result.changes) !== 1) throw new Error(`Helixa row ${score.id} disappeared during apply`);
      updated += 1;
    }
    assertReservedBackup(backupReservation);
    db.exec('COMMIT');
    transaction = false;
    return updated;
  } catch (error) {
    if (transaction) try { db.exec('ROLLBACK'); } catch {}
    throw error;
  } finally {
    db.close();
  }
}

async function runSync(rawOptions, nowMs = Date.now(), dependencies = {}) {
  if (rawOptions.apply && rawOptions.expectedCount !== PRODUCTION_HELIXA_COUNT && dependencies.allowNonProductionCount !== true) {
    throw new Error('Apply requires expectedCount 5003 unless an explicit programmatic non-production gate is provided');
  }
  const options = canonicalizeOptions(rawOptions);
  let backupReservation = null;
  let stagedPath = null;
  let committed = false;
  try {
    if (options.apply) backupReservation = reserveBackup(options.backupPath);
    const db = new DatabaseSync(options.dbPath, { readOnly: true });
    let roster;
    try { roster = readRoster(db); }
    finally { db.close(); }
    assertExpectedCount(roster, options.expectedCount);
    const scores = await completePreflight(options, roster, dependencies);
    const state = options.apply
      ? {
          updated: scores.filter((score) => score.changed).length,
          lastScored: Math.floor(nowMs / 1000),
          backupPath: options.backupPath,
        }
      : { updated: 0, lastScored: null, backupPath: null };
    const report = buildReport(options, scores, state);
    const stage = dependencies.stageReport || stageReport;
    const finalize = dependencies.finalizeStagedReport || finalizeStagedReport;
    stagedPath = stage(options.reportPath, report, dependencies.reportIo);
    if (options.apply && !stagedPath) throw new Error('Apply requires a successfully staged report');
    if (options.apply) {
      const updated = applyScores(options, roster, scores, state.lastScored, backupReservation, dependencies);
      committed = true;
      if (updated !== state.updated) throw new Error(`Update count mismatch: expected ${state.updated}, updated ${updated}`);
    }
    finalize(stagedPath, options.reportPath, dependencies.reportIo);
    stagedPath = null;
    return report;
  } catch (error) {
    if (!committed) {
      removeFiles(stagedPath);
      throw error;
    }
    if (error.reportPublishPhase === 'rename') {
      const retained = stagedPath && fs.existsSync(stagedPath) ? `; staged report retained at ${stagedPath}` : '';
      throw new Error(`Database commit succeeded but report rename failed: ${error.message}${retained}`);
    }
    if (error.reportPublishPhase === 'directory-fsync') {
      throw new Error(`Database commit succeeded; final report exists but directory fsync failed: ${error.message}`);
    }
    const retained = stagedPath && fs.existsSync(stagedPath) ? `; staged report retained at ${stagedPath}` : '';
    throw new Error(`Database commit succeeded but staged report publish failed: ${error.message}${retained}`);
  } finally {
    releaseBackupReservation(backupReservation, !committed);
  }
}

async function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    if (options.help) { printHelp(); return 0; }
    const report = await runSync(options);
    process.stdout.write(JSON.stringify(report) + '\n');
    return 0;
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    return 1;
  }
}

module.exports = {
  HELIXA_REGISTRY, ROSTER_SQL, TIERS, getTier, parseArgs, readRoster, validateResponse,
  fetchCanonical, retryAfterDelay, stageReport, finalizeStagedReport, runSync, main,
};

if (require.main === module) main().then((code) => { process.exitCode = code; });
