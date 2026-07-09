const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const { findIndexedAgentByAddress } = require('./agent-index-lookup');

test('findIndexedAgentByAddress returns the latest indexed token for an owner or agent address', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-index-lookup-'));
  const dbPath = path.join(dir, 'agents.db');
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE agents (
      tokenId INTEGER PRIMARY KEY,
      name TEXT,
      agentAddress TEXT,
      owner TEXT,
      framework TEXT,
      mintOrigin TEXT,
      mintedAt TEXT,
      credScore REAL DEFAULT 0,
      points REAL DEFAULT 0
    );
  `);
  const ack = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
  db.prepare('INSERT INTO agents (tokenId, name, agentAddress, owner, framework, mintOrigin) VALUES (?, ?, ?, ?, ?, ?)')
    .run(11, 'Old ACK', '0x1111111111111111111111111111111111111111', ack, 'custom', 'AGENT_SIWA');
  db.prepare('INSERT INTO agents (tokenId, name, agentAddress, owner, framework, mintOrigin) VALUES (?, ?, ?, ?, ?, ?)')
    .run(12, 'ACK', ack, '0x2222222222222222222222222222222222222222', 'custom', 'AGENT_SIWA');
  db.close();

  const byOwner = findIndexedAgentByAddress('0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD', { dbPath });
  assert.equal(byOwner.tokenId, 12);
  assert.equal(byOwner.name, 'ACK');

  const byAgent = findIndexedAgentByAddress('0x1111111111111111111111111111111111111111', { dbPath });
  assert.equal(byAgent.tokenId, 11);
});

test('findIndexedAgentByAddress safely returns null when missing or invalid', () => {
  assert.equal(findIndexedAgentByAddress('not-an-address', { dbPath: '/tmp/nope.db' }), null);
  assert.equal(findIndexedAgentByAddress('0x3333333333333333333333333333333333333333', { dbPath: '/tmp/nope.db' }), null);
});
