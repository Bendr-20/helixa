const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const DEFAULT_DB_PATH = path.join(__dirname, '..', '..', 'data', 'agents.db');

function normalizeAddress(value) {
  const address = String(value || '').trim();
  return ADDRESS_RE.test(address) ? address.toLowerCase() : null;
}

function findIndexedAgentByAddress(address, options = {}) {
  const normalized = normalizeAddress(address);
  if (!normalized) return null;

  const dbPath = options.dbPath || DEFAULT_DB_PATH;
  if (!dbPath || !fs.existsSync(dbPath)) return null;

  let db;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const row = db.prepare(`
      SELECT tokenId, name, agentAddress, owner, framework, mintOrigin, mintedAt, credScore, points
      FROM agents
      WHERE lower(agentAddress) = ? OR lower(owner) = ?
      ORDER BY tokenId DESC
      LIMIT 1
    `).get(normalized, normalized);
    if (!row) return null;
    return {
      tokenId: Number(row.tokenId),
      name: row.name || null,
      agentAddress: row.agentAddress || null,
      owner: row.owner || row.agentAddress || null,
      framework: row.framework || null,
      mintOrigin: row.mintOrigin || null,
      mintedAt: row.mintedAt || null,
      credScore: Number(row.credScore || 0),
      points: Number(row.points || 0),
    };
  } catch {
    return null;
  } finally {
    if (db) db.close();
  }
}

module.exports = {
  findIndexedAgentByAddress,
  normalizeAddress,
};
