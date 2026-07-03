const assert = require('node:assert/strict');
const test = require('node:test');
const Database = require('better-sqlite3');
const { syncHelixaAgentToTerminal } = require('../terminal-sync');

function createDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT,
      agent_id TEXT,
      token_id TEXT,
      chain_id INTEGER DEFAULT 8453,
      name TEXT,
      description TEXT,
      image_url TEXT,
      metadata_uri TEXT,
      metadata JSON,
      registry TEXT,
      owner_address TEXT,
      platform TEXT,
      x402_supported INTEGER DEFAULT 0,
      services JSON,
      block_number INTEGER,
      timestamp INTEGER,
      registered_at TEXT,
      cred_score INTEGER DEFAULT 0,
      cred_tier TEXT DEFAULT 'JUNK',
      verified INTEGER DEFAULT 0,
      last_scored INTEGER,
      created_at TEXT,
      token_address TEXT,
      token_symbol TEXT,
      token_name TEXT,
      token_market_cap REAL,
      price_change_24h REAL,
      volume_24h REAL,
      liquidity_usd REAL,
      UNIQUE(chain_id, token_id)
    );
  `);
  return db;
}

test('Helixa terminal sync keys by token id, not shared wallet address', () => {
  const db = createDb();
  db.prepare(`INSERT INTO agents (address, agent_id, token_id, chain_id, name, platform, cred_score, cred_tier)
    VALUES (?, ?, ?, 8453, ?, 'helixa', 31, 'MARGINAL')`)
    .run('0x84631a26fab1525449063c7dce50019c6ceedc9c', 'helixa-2079', 'helixa-2079', 'd1mka17Agent');

  syncHelixaAgentToTerminal(db, {
    tokenId: 1069,
    name: 'Axobotl',
    agentAddress: '0x84631A26Fab1525449063c7Dce50019c6CeeDc9C',
    owner: '0x84631A26Fab1525449063c7Dce50019c6CeeDc9C',
    framework: 'openclaw',
    mintOrigin: 'AGENT_SIWA',
    soulbound: true,
    credScore: 85,
    verified: false,
    mintedAt: '2026-03-19T05:25:15.000Z',
  });

  const rows = db.prepare('SELECT token_id, name, cred_score, cred_tier, address FROM agents ORDER BY token_id').all();
  assert.deepEqual(rows.map(row => [row.token_id, row.name, row.cred_score, row.cred_tier]), [
    ['helixa-1069', 'Axobotl', 85, 'PRIME'],
    ['helixa-2079', 'd1mka17Agent', 31, 'MARGINAL'],
  ]);
  assert.equal(rows[0].address, '0x84631a26fab1525449063c7dce50019c6ceedc9c');
});

test('Helixa terminal sync accepts Helixa token 0', () => {
  const db = createDb();

  syncHelixaAgentToTerminal(db, {
    tokenId: 0,
    name: 'E2ETest',
    agentAddress: '0x3B401da4452bCEDD7c219c5c5Fddd6Aea428B53F',
    owner: '0x3B401da4452bCEDD7c219c5c5Fddd6Aea428B53F',
    framework: 'openclaw',
    mintOrigin: 'AGENT_SIWA',
    soulbound: true,
    credScore: 41,
    verified: false,
    mintedAt: '2026-02-17T03:47:39.000Z',
  });

  const row = db.prepare('SELECT token_id, agent_id, name, cred_score, cred_tier FROM agents').get();
  assert.deepEqual(row, {
    token_id: 'helixa-0',
    agent_id: 'helixa-0',
    name: 'E2ETest',
    cred_score: 41,
    cred_tier: 'MARGINAL',
  });
});

test('Helixa terminal sync updates the same token id without duplicating or clearing token data', () => {
  const db = createDb();
  db.prepare(`INSERT INTO agents (address, agent_id, token_id, chain_id, name, platform, cred_score, cred_tier, token_address, token_symbol)
    VALUES (?, ?, ?, 8453, ?, 'helixa', 80, 'PRIME', ?, ?)`)
    .run('0xold', 'helixa-1069', 'helixa-1069', 'Old Axobotl', '0xToken', 'AXO');

  syncHelixaAgentToTerminal(db, {
    tokenId: 1069,
    name: 'Axobotl',
    agentAddress: '0x84631A26Fab1525449063c7Dce50019c6CeeDc9C',
    owner: '0x84631A26Fab1525449063c7Dce50019c6CeeDc9C',
    framework: 'openclaw',
    mintOrigin: 'AGENT_SIWA',
    soulbound: true,
    credScore: 85,
    verified: false,
    mintedAt: '2026-03-19T05:25:15.000Z',
  });

  const rows = db.prepare('SELECT token_id, name, cred_score, token_address, token_symbol FROM agents').all();
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    token_id: 'helixa-1069',
    name: 'Axobotl',
    cred_score: 85,
    token_address: '0xToken',
    token_symbol: 'AXO',
  });
});
