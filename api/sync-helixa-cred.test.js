'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const sync = require('./sync-helixa-cred');

const SCRIPT = path.join(__dirname, 'sync-helixa-cred.js');
const HELIXA_REGISTRY = '0x2e3b541c59d38b84e3bc54e977200230a204fe60';

function makeCase(rows) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'helixa-cred-sync-'));
  const dbPath = path.join(dir, 'terminal.db');
  const backupPath = path.join(dir, 'rollback.db');
  const reportPath = path.join(dir, 'report.json');
  const db = new DatabaseSync(dbPath);
  db.exec(`CREATE TABLE agents (
    id INTEGER PRIMARY KEY,
    platform TEXT,
    registry TEXT,
    token_id TEXT,
    cred_score INTEGER,
    cred_tier TEXT,
    last_scored INTEGER
  )`);
  const insert = db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const row of rows) insert.run(
    row.id, row.platform ?? 'unknown', row.registry ?? '', row.token_id ?? null,
    row.cred_score ?? 0, row.cred_tier ?? 'JUNK', row.last_scored ?? null,
  );
  db.close();
  return { dir, dbPath, backupPath, reportPath };
}

function readRows(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const rows = db.prepare('SELECT * FROM agents ORDER BY id').all();
  db.close();
  return rows;
}

function helixa(id, tokenId, score = 1, tier = 'JUNK', lastScored = 7) {
  return { id, platform: 'helixa', registry: HELIXA_REGISTRY, token_id: `helixa-${tokenId}`, cred_score: score, cred_tier: tier, last_scored: lastScored };
}

async function startServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function runCli(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], { cwd: __dirname, env: { ...process.env, HELIXA_INTERNAL_KEY: '', ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

function endpoint(handler) {
  return async (req, res) => {
    const match = req.url.match(/^\/api\/v2\/agent\/(\d+)\/cred$/);
    if (!match) { res.writeHead(404).end(); return; }
    await handler(Number(match[1]), req, res);
  };
}

function sendJson(res, value, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
}

function canonical(tokenId, score, tier) {
  return { tokenId, name: `Agent ${tokenId}`, credScore: score, tier };
}

async function withServer(handler, fn) {
  const server = await startServer(endpoint(handler));
  try { return await fn(server.baseUrl); }
  finally { await server.close(); }
}

test('default dry-run fetches exact canonical mappings and does not mutate', async () => {
  const p = makeCase([helixa(1, 2, 9), helixa(2, 1, 8)]);
  const before = readRows(p.dbPath);
  await withServer((tokenId, req, res) => sendJson(res,
    tokenId === 1 ? canonical(1, 65, 'QUALIFIED') : canonical(2, 43, 'MARGINAL')
  ), async (baseUrl) => {
    const result = await runCli([`--db=${p.dbPath}`, `--base-url=${baseUrl}`, '--expected-count=2', '--concurrency=2', '--retries=0']);
    assert.equal(result.code, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.mode, 'dry-run');
    assert.equal(report.helixaCount, 2);
    assert.equal(report.updated, 0);
    assert.deepEqual(report.scores.map(({ tokenId, credScore, credTier }) => ({ tokenId, credScore, credTier })), [
      { tokenId: 1, credScore: 65, credTier: 'QUALIFIED' },
      { tokenId: 2, credScore: 43, credTier: 'MARGINAL' },
    ]);
  });
  assert.deepEqual(readRows(p.dbPath), before);
  assert.equal(fs.existsSync(p.backupPath), false);
});

test('successful apply updates only Helixa rows with one timestamp and creates compact backup plus report', async () => {
  const generic = { id: 3, platform: 'virtuals', registry: 'other', token_id: '77', cred_score: 88, cred_tier: 'PRIME', last_scored: 99 };
  const p = makeCase([helixa(1, 2, 9), helixa(2, 1, 8), generic]);
  await withServer((tokenId, req, res) => sendJson(res,
    tokenId === 1 ? canonical(1, 65, 'QUALIFIED') : canonical(2, 43, 'MARGINAL')
  ), async (baseUrl) => {
    const report = await sync.runSync({
      dbPath: p.dbPath, baseUrl, apply: true, backupPath: p.backupPath, reportPath: p.reportPath,
      expectedCount: 2, concurrency: 2, timeoutMs: 1000, retries: 0, internalKey: '',
    }, 1_800_000_000_000, { allowNonProductionCount: true });
    assert.deepEqual(JSON.parse(fs.readFileSync(p.reportPath, 'utf8')), report);
    assert.equal(fs.readFileSync(p.reportPath, 'utf8'), JSON.stringify(report) + '\n');
    assert.equal(report.mode, 'apply');
    assert.equal(report.updated, 2);
    assert.equal(report.backupPath, fs.realpathSync(p.backupPath));
    assert.deepEqual(fs.readdirSync(p.dir).filter((name) => name.includes('.staged-')), []);
  });

  const rows = readRows(p.dbPath);
  assert.deepEqual(rows.slice(0, 2).map((row) => [row.cred_score, row.cred_tier]), [[43, 'MARGINAL'], [65, 'QUALIFIED']]);
  assert.equal(rows[0].last_scored, rows[1].last_scored);
  assert.equal(Number.isSafeInteger(rows[0].last_scored), true);
  assert.deepEqual({ ...rows[2] }, generic);

  const backup = new DatabaseSync(p.backupPath, { readOnly: true });
  assert.deepEqual(backup.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all().map((r) => r.name), ['agent_scores', 'backup_metadata']);
  assert.deepEqual(backup.prepare('SELECT id, token_id, cred_score, cred_tier, last_scored FROM agent_scores ORDER BY id').all().map((row) => ({ ...row })), [
    { id: 1, token_id: 'helixa-2', cred_score: 9, cred_tier: 'JUNK', last_scored: 7 },
    { id: 2, token_id: 'helixa-1', cred_score: 8, cred_tier: 'JUNK', last_scored: 7 },
  ]);
  assert.equal(backup.prepare("SELECT value FROM backup_metadata WHERE key='helixaRowCount'").get().value, '2');
  assert.equal(backup.prepare('PRAGMA quick_check').get().quick_check, 'ok');
  backup.close();
});

test('rejects mismatched token mapping or tier before writing', async () => {
  for (const response of [canonical(999, 43, 'MARGINAL'), canonical(1, 43, 'QUALIFIED'), canonical(1, 101, 'PREFERRED')]) {
    const p = makeCase([helixa(1, 1, 9)]);
    const before = readRows(p.dbPath);
    await withServer((tokenId, req, res) => sendJson(res, response), async (baseUrl) => {
      const result = await runCli([`--db=${p.dbPath}`, `--base-url=${baseUrl}`, '--expected-count=1', '--retries=0']);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /tokenId|tier|credScore/i);
    });
    assert.deepEqual(readRows(p.dbPath), before);
    assert.equal(fs.existsSync(p.backupPath), false);
  }
});

test('HTTP, non-JSON, and timeout failures exit nonzero with no writes', async () => {
  const scenarios = [
    async (tokenId, req, res) => sendJson(res, { error: 'boom' }, 503),
    async (tokenId, req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('not json'); },
    async () => { await new Promise((resolve) => setTimeout(resolve, 300)); },
  ];
  for (const scenario of scenarios) {
    const p = makeCase([helixa(1, 1, 9)]);
    const before = readRows(p.dbPath);
    await withServer(scenario, async (baseUrl) => {
      const result = await runCli([
        `--db=${p.dbPath}`, `--base-url=${baseUrl}`, '--expected-count=1',
        '--timeout-ms=50', '--retries=0',
      ]);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /HTTP|JSON|timeout|abort|fetch/i);
    });
    assert.deepEqual(readRows(p.dbPath), before);
    assert.equal(fs.existsSync(p.backupPath), false);
  }
});

test('duplicate or missing Helixa token IDs and count mismatches fail before HTTP or writes', async () => {
  const cases = [
    [helixa(1, 1), helixa(2, 1)],
    [helixa(1, 1), { ...helixa(2, 2), token_id: null }],
  ];
  for (const rows of cases) {
    const p = makeCase(rows);
    const before = readRows(p.dbPath);
    let requests = 0;
    await withServer((tokenId, req, res) => { requests += 1; sendJson(res, canonical(tokenId, 43, 'MARGINAL')); }, async (baseUrl) => {
      const result = await runCli([`--db=${p.dbPath}`, `--base-url=${baseUrl}`, `--expected-count=${rows.length}`, '--retries=0']);
      assert.notEqual(result.code, 0);
      assert.match(result.stderr, /duplicate|missing|token/i);
    });
    assert.equal(requests, 0);
    assert.deepEqual(readRows(p.dbPath), before);
  }

  const p = makeCase([helixa(1, 1)]);
  await withServer((tokenId, req, res) => sendJson(res, canonical(tokenId, 43, 'MARGINAL')), async (baseUrl) => {
    const result = await runCli([`--db=${p.dbPath}`, `--base-url=${baseUrl}`, '--expected-count=2', '--retries=0']);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /expected.*2.*found.*1/i);
  });
});

test('rejects database/output path aliases', async () => {
  const p = makeCase([helixa(1, 1)]);
  const alias = path.join(p.dir, 'db-alias');
  fs.linkSync(p.dbPath, alias);
  const result = await runCli([`--db=${p.dbPath}`, '--base-url=http://127.0.0.1:1', `--report=${alias}`, '--retries=0']);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /same file|alias/i);
});

test('late write failure rolls back all rows and removes incomplete backup and report', async () => {
  const p = makeCase([helixa(1, 1, 9), helixa(2, 2, 8)]);
  const db = new DatabaseSync(p.dbPath);
  db.exec(`CREATE TRIGGER fail_second BEFORE UPDATE ON agents WHEN OLD.id = 2 BEGIN SELECT RAISE(ABORT, 'late failure'); END`);
  db.close();
  const before = readRows(p.dbPath);
  await withServer((tokenId, req, res) => sendJson(res,
    tokenId === 1 ? canonical(1, 65, 'QUALIFIED') : canonical(2, 43, 'MARGINAL')
  ), async (baseUrl) => {
    await assert.rejects(() => sync.runSync({
      dbPath: p.dbPath, baseUrl, apply: true, backupPath: p.backupPath, reportPath: p.reportPath,
      expectedCount: 2, concurrency: 2, timeoutMs: 1000, retries: 0, internalKey: '',
    }, 1_800_000_000_000, { allowNonProductionCount: true }), /late failure/i);
  });
  assert.deepEqual(readRows(p.dbPath), before);
  for (const suffix of ['', '-journal', '-wal', '-shm']) assert.equal(fs.existsSync(p.backupPath + suffix), false);
  assert.equal(fs.existsSync(p.reportPath), false);
  assert.deepEqual(fs.readdirSync(p.dir).filter((name) => name.includes('.staged-')), []);
});


test('internal auth comes only from HELIXA_INTERNAL_KEY, sends x-internal-key, and is never exposed', async () => {
  const p = makeCase([helixa(1, 1)]);
  const secret = 'internal-secret-that-must-never-appear';
  let receivedKey;
  await withServer((tokenId, req, res) => {
    receivedKey = req.headers['x-internal-key'];
    sendJson(res, canonical(tokenId, 43, 'MARGINAL'));
  }, async (baseUrl) => {
    const result = await runCli([
      `--db=${p.dbPath}`, `--base-url=${baseUrl}`, '--expected-count=1',
      `--report=${p.reportPath}`, '--retries=0',
    ], { HELIXA_INTERNAL_KEY: secret });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(receivedKey, secret);
    assert.equal(result.stdout.includes(secret), false);
    assert.equal(result.stderr.includes(secret), false);
    assert.equal(fs.readFileSync(p.reportPath, 'utf8').includes(secret), false);
  });
});

test('ordinary 429 honors Retry-After with a bounded delay', async () => {
  const delays = [];
  let attempts = 0;
  const value = await sync.fetchCanonical({
    baseUrl: 'http://example.test', timeoutMs: 100, retries: 1, internalKey: '',
  }, 7, {
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) return new Response('{}', { status: 429, headers: { 'retry-after': '3' } });
      return new Response(JSON.stringify(canonical(7, 43, 'MARGINAL')), { status: 200, headers: { 'content-type': 'application/json' } });
    },
    sleep: async (ms) => { delays.push(ms); },
  });
  assert.deepEqual(value, { tokenId: 7, credScore: 43, credTier: 'MARGINAL' });
  assert.deepEqual(delays, [3_000]);
  assert.equal(sync.retryAfterDelay('999999'), 60_000);
});

test('apply CLI fails closed unless all production safeguards are explicit and count is 5003', () => {
  const required = [
    [[], /--db/i],
    [['--db=/tmp/x'], /--expected-count/i],
    [['--db=/tmp/x', '--expected-count=5003'], /--backup/i],
    [['--db=/tmp/x', '--expected-count=5003', '--backup=/tmp/b'], /--report/i],
  ];
  for (const [args, pattern] of required) {
    assert.throws(() => sync.parseArgs(['--apply', ...args]), pattern);
  }
  assert.throws(() => sync.parseArgs([
    '--apply', '--db=/tmp/x', '--expected-count=177', '--backup=/tmp/b', '--report=/tmp/r',
  ]), /expected-count=5003/i);
});

test('report staging failure occurs before BEGIN, mutation, or backup creation', async () => {
  const p = makeCase([helixa(1, 1, 9)]);
  const before = readRows(p.dbPath);
  await withServer((tokenId, req, res) => sendJson(res, canonical(tokenId, 43, 'MARGINAL')), async (baseUrl) => {
    await assert.rejects(() => sync.runSync({
      dbPath: p.dbPath, baseUrl, apply: true, backupPath: p.backupPath, reportPath: p.reportPath,
      expectedCount: 1, concurrency: 1, timeoutMs: 1000, retries: 0, internalKey: '',
    }, 1_800_000_000_000, {
      allowNonProductionCount: true,
      stageReport: () => { throw new Error('injected report staging failure'); },
    }), /report staging failure/i);
  });
  assert.deepEqual(readRows(p.dbPath), before);
  assert.equal(fs.existsSync(p.backupPath), false);
  assert.equal(fs.existsSync(p.reportPath), false);
});


test('post-commit report publish failure reports committed state and retains staged report', async () => {
  const p = makeCase([helixa(1, 1, 9)]);
  await withServer((tokenId, req, res) => sendJson(res, canonical(tokenId, 43, 'MARGINAL')), async (baseUrl) => {
    await assert.rejects(() => sync.runSync({
      dbPath: p.dbPath, baseUrl, apply: true, backupPath: p.backupPath, reportPath: p.reportPath,
      expectedCount: 1, concurrency: 1, timeoutMs: 1000, retries: 0, internalKey: '',
    }, 1_800_000_000_000, {
      allowNonProductionCount: true,
      finalizeStagedReport: () => { throw new Error('injected rename failure'); },
    }), /Database commit succeeded.*report publish failed/i);
  });
  const [row] = readRows(p.dbPath);
  assert.equal(row.cred_score, 43);
  assert.equal(row.cred_tier, 'MARGINAL');
  assert.equal(fs.existsSync(p.backupPath), true);
  assert.equal(fs.existsSync(p.reportPath), false);
  assert.equal(fs.readdirSync(p.dir).filter((name) => name.includes('.staged-')).length, 1);
});


test('cross-origin redirects are rejected before internal key can reach the target', async () => {
  const p = makeCase([helixa(1, 1)]);
  const secret = 'redirect-secret-must-not-leak';
  let targetRequests = 0;
  let leakedKey;
  const target = await startServer((req, res) => {
    targetRequests += 1;
    leakedKey = req.headers['x-internal-key'];
    sendJson(res, canonical(1, 43, 'MARGINAL'));
  });
  const redirect = await startServer((req, res) => {
    res.writeHead(302, { location: `${target.baseUrl}${req.url}` });
    res.end();
  });
  try {
    const result = await runCli([
      `--db=${p.dbPath}`, `--base-url=${redirect.baseUrl}`, '--expected-count=1', '--retries=0',
    ], { HELIXA_INTERNAL_KEY: secret });
    assert.notEqual(result.code, 0);
    assert.equal(targetRequests, 0);
    assert.equal(leakedKey, undefined);
    assert.equal((result.stdout + result.stderr).includes(secret), false);
  } finally {
    await redirect.close();
    await target.close();
  }
});

test('backup reservation rejects a symlink swap during preflight without touching target or source DB', async () => {
  const p = makeCase([helixa(1, 1, 9)]);
  const victim = path.join(p.dir, 'victim.sqlite');
  const victimDb = new DatabaseSync(victim);
  victimDb.exec('CREATE TABLE sentinel (value TEXT); INSERT INTO sentinel VALUES (\'untouched\')');
  victimDb.close();
  const victimBefore = fs.readFileSync(victim);
  const sourceBefore = readRows(p.dbPath);
  let swapped = false;
  await withServer((tokenId, req, res) => {
    if (!swapped) {
      if (fs.existsSync(p.backupPath) || fs.lstatSync(p.backupPath, { throwIfNoEntry: false })) fs.unlinkSync(p.backupPath);
      fs.symlinkSync(victim, p.backupPath);
      swapped = true;
    }
    sendJson(res, canonical(tokenId, 43, 'MARGINAL'));
  }, async (baseUrl) => {
    await assert.rejects(() => sync.runSync({
      dbPath: p.dbPath, baseUrl, apply: true, backupPath: p.backupPath, reportPath: p.reportPath,
      expectedCount: 1, concurrency: 1, timeoutMs: 1000, retries: 0, internalKey: '',
    }, 1_800_000_000_000, { allowNonProductionCount: true }), /backup.*(swap|symlink|identity|reservation)/i);
  });
  assert.deepEqual(fs.readFileSync(victim), victimBefore);
  assert.deepEqual(readRows(p.dbPath), sourceBefore);
  assert.equal(fs.existsSync(p.reportPath), false);
});

test('staged report parent is fsynced before BEGIN IMMEDIATE', async () => {
  const p = makeCase([helixa(1, 1, 9)]);
  const events = [];
  await withServer((tokenId, req, res) => sendJson(res, canonical(tokenId, 43, 'MARGINAL')), async (baseUrl) => {
    await sync.runSync({
      dbPath: p.dbPath, baseUrl, apply: true, backupPath: p.backupPath, reportPath: p.reportPath,
      expectedCount: 1, concurrency: 1, timeoutMs: 1000, retries: 0, internalKey: '',
    }, 1_800_000_000_000, {
      allowNonProductionCount: true,
      reportIo: { fsyncDirectory: (directory, phase) => events.push(phase) },
      beforeBegin: () => events.push('begin'),
    });
  });
  assert.deepEqual(events, ['stage', 'begin', 'finalize']);
});

test('rename failure after commit accurately retains staged report', async () => {
  const p = makeCase([helixa(1, 1, 9)]);
  await withServer((tokenId, req, res) => sendJson(res, canonical(tokenId, 43, 'MARGINAL')), async (baseUrl) => {
    await assert.rejects(() => sync.runSync({
      dbPath: p.dbPath, baseUrl, apply: true, backupPath: p.backupPath, reportPath: p.reportPath,
      expectedCount: 1, concurrency: 1, timeoutMs: 1000, retries: 0, internalKey: '',
    }, 1_800_000_000_000, {
      allowNonProductionCount: true,
      reportIo: { renameSync: () => { throw new Error('injected rename failure'); } },
    }), /Database commit succeeded.*rename failed.*staged report retained/i);
  });
  assert.equal(fs.existsSync(p.reportPath), false);
  assert.equal(fs.readdirSync(p.dir).filter((name) => name.includes('.staged-')).length, 1);
});

test('directory fsync failure after rename reports committed DB and existing final report', async () => {
  const p = makeCase([helixa(1, 1, 9)]);
  await withServer((tokenId, req, res) => sendJson(res, canonical(tokenId, 43, 'MARGINAL')), async (baseUrl) => {
    await assert.rejects(() => sync.runSync({
      dbPath: p.dbPath, baseUrl, apply: true, backupPath: p.backupPath, reportPath: p.reportPath,
      expectedCount: 1, concurrency: 1, timeoutMs: 1000, retries: 0, internalKey: '',
    }, 1_800_000_000_000, {
      allowNonProductionCount: true,
      reportIo: { fsyncDirectory: (directory, phase) => { if (phase === 'finalize') throw new Error('injected directory fsync failure'); } },
    }), /Database commit succeeded.*final report exists.*directory fsync failed/i);
  });
  assert.equal(fs.existsSync(p.reportPath), true);
  assert.equal(fs.readdirSync(p.dir).filter((name) => name.includes('.staged-')).length, 0);
  assert.equal(readRows(p.dbPath)[0].cred_score, 43);
});


test('production apply uses indexed roster lookup and updates only changed rows in row-id order', async () => {
  const p = makeCase([
    helixa(30, 3, 1, 'JUNK', 7),
    helixa(10, 1, 1, 'JUNK', 7),
    helixa(20, 2, 43, 'MARGINAL', 123),
  ]);
  const setup = new DatabaseSync(p.dbPath);
  setup.exec(`CREATE INDEX idx_agents_platform ON agents(platform);
    CREATE INDEX idx_agents_registry ON agents(registry);
    CREATE TABLE update_order (seq INTEGER PRIMARY KEY AUTOINCREMENT, agent_id INTEGER NOT NULL);
    CREATE TRIGGER log_update AFTER UPDATE ON agents BEGIN
      INSERT INTO update_order(agent_id) VALUES (NEW.id);
    END;`);
  const plan = setup.prepare(`EXPLAIN QUERY PLAN ` + sync.ROSTER_SQL).all(sync.HELIXA_REGISTRY);
  assert.equal(plan.some((row) => /SCAN agents/i.test(row.detail)), false, JSON.stringify(plan));
  assert.equal(plan.some((row) => /INDEX/i.test(row.detail)), true, JSON.stringify(plan));
  setup.close();

  await withServer((tokenId, req, res) => {
    const values = {
      1: canonical(1, 43, 'MARGINAL'),
      2: canonical(2, 43, 'MARGINAL'),
      3: canonical(3, 65, 'QUALIFIED'),
    };
    sendJson(res, values[tokenId]);
  }, async (baseUrl) => {
    const report = await sync.runSync({
      dbPath: p.dbPath, baseUrl, apply: true, backupPath: p.backupPath, reportPath: p.reportPath,
      expectedCount: 3, concurrency: 3, timeoutMs: 1000, retries: 0, internalKey: '',
    }, 1_800_000_000_000, { allowNonProductionCount: true });
    assert.equal(report.changed, 2);
    assert.equal(report.unchanged, 1);
    assert.equal(report.updated, 2);
  });

  const check = new DatabaseSync(p.dbPath, { readOnly: true });
  const rows = check.prepare('SELECT id, cred_score, cred_tier, last_scored FROM agents ORDER BY id').all();
  const order = check.prepare('SELECT agent_id FROM update_order ORDER BY seq').all().map((row) => row.agent_id);
  check.close();
  assert.deepEqual(order, [10, 30]);
  assert.equal(rows.find((row) => row.id === 20).last_scored, 123);
  assert.equal(rows.find((row) => row.id === 10).last_scored, 1_800_000_000);
  assert.equal(rows.find((row) => row.id === 30).last_scored, 1_800_000_000);
});
