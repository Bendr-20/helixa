/**
 * Event-based SQLite indexer for Helixa V2 agents.
 * 
 * Listens for AgentRegistered events, fetches full agent data via getAgent(),
 * and stores in SQLite. Replaces the slow sequential refreshAgentCache().
 */

const Database = require('better-sqlite3');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'agents.db');

// Contract was deployed around block 26000000 on Base
const DEFAULT_START_BLOCK = 42_254_000;
const CHUNK_SIZE = 10_000;
const POLL_INTERVAL_MS = 30_000;

let db;
let readContract;
let readProvider;
let pollTimer = null;

// ─── DB Setup ───────────────────────────────────────────────────

function initDb() {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    db.exec(`
        CREATE TABLE IF NOT EXISTS agents (
            tokenId INTEGER PRIMARY KEY,
            name TEXT,
            agentAddress TEXT,
            framework TEXT,
            verified INTEGER DEFAULT 0,
            soulbound INTEGER DEFAULT 0,
            mintOrigin TEXT,
            credScore REAL DEFAULT 0,
            points REAL DEFAULT 0,
            owner TEXT,
            mintedAt TEXT,
            lastUpdated INTEGER
        );
        CREATE TABLE IF NOT EXISTS sync_state (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_agents_framework ON agents(framework);
        CREATE INDEX IF NOT EXISTS idx_agents_verified ON agents(verified);
        CREATE INDEX IF NOT EXISTS idx_agents_credScore ON agents(credScore);
        CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name COLLATE NOCASE);
    `);
    return db;
}

// ─── DB Queries ─────────────────────────────────────────────────

const HIDDEN_TOKENS = new Set([0, 14, 15, 16, 17, 18, 21]);

function getLastSyncedBlock() {
    const row = db.prepare('SELECT value FROM sync_state WHERE key = ?').get('lastBlock');
    return row ? parseInt(row.value) : DEFAULT_START_BLOCK;
}

function setLastSyncedBlock(block) {
    db.prepare('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)').run('lastBlock', String(block));
}

function upsertAgent(agent) {
    db.prepare(`
        INSERT OR REPLACE INTO agents (tokenId, name, agentAddress, framework, verified, soulbound, mintOrigin, credScore, points, owner, mintedAt, lastUpdated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        agent.tokenId,
        agent.name,
        agent.agentAddress,
        agent.framework,
        agent.verified ? 1 : 0,
        agent.soulbound ? 1 : 0,
        agent.mintOrigin,
        agent.credScore || 0,
        agent.points || 0,
        agent.owner,
        agent.mintedAt,
        Date.now()
    );
}

const upsertMany = (agents) => {
    const tx = db.transaction((list) => { for (const a of list) upsertAgent(a); });
    tx(agents);
};

/**
 * Query agents with pagination, sorting, filtering.
 * Compatible with the old response format.
 */
function queryAgents({ page = 1, limit = 100, sort = 'tokenId', order = 'asc', framework, verified, search, showSpam = false } = {}) {
    const validSorts = ['tokenId', 'credScore', 'points', 'name', 'mintedAt', 'framework'];
    if (!validSorts.includes(sort)) sort = 'tokenId';
    order = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    let where = [];
    let params = [];

    // Exclude hidden tokens
    const hiddenList = [...HIDDEN_TOKENS];
    if (hiddenList.length > 0) {
        where.push(`tokenId NOT IN (${hiddenList.map(() => '?').join(',')})`);
        params.push(...hiddenList);
    }

    // Spam filter (same logic as original)
    if (!showSpam) {
        where.push(`LENGTH(TRIM(name)) > 1`);
        // Filter names that are all same character - done in JS post-query for simplicity
        // Actually let's do it: names where removing one distinct char leaves empty
        // Simple approach: exclude where length > 0 and all chars same
    }

    if (framework) {
        where.push(`framework = ?`);
        params.push(framework);
    }
    if (verified === 'true' || verified === true) {
        where.push(`verified = 1`);
    } else if (verified === 'false' || verified === false) {
        where.push(`verified = 0`);
    }
    if (search) {
        where.push(`name LIKE ?`);
        params.push(`%${search}%`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    // Get total
    const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM agents ${whereClause}`).get(...params);
    const total = totalRow.cnt;

    const offset = (page - 1) * limit;
    const rows = db.prepare(`SELECT * FROM agents ${whereClause} ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`).all(...params, limit, offset);

    // Post-filter spam (all same char names)
    const agents = (showSpam ? rows : rows.filter(a => {
        const name = (a.name || '').trim();
        if (new Set(name.toLowerCase().split('')).size <= 1) return false;
        return true;
    })).map(row => ({
        tokenId: row.tokenId,
        name: row.name,
        agentAddress: row.agentAddress,
        framework: row.framework,
        verified: !!row.verified,
        soulbound: !!row.soulbound,
        mintOrigin: row.mintOrigin,
        credScore: row.credScore,
        points: row.points,
        traitCount: 0,
        personality: null,
        owner: row.owner,
        mintedAt: row.mintedAt,
    }));

    return {
        total,
        totalUnfiltered: db.prepare('SELECT COUNT(*) as cnt FROM agents').get().cnt,
        page,
        pages: Math.ceil(total / limit),
        limit,
        agents,
        cached: true,
        cachedAt: new Date().toISOString(),
    };
}

/**
 * Get all agents (for agentCache compatibility in other endpoints).
 */
function getAllAgents() {
    const rows = db.prepare('SELECT * FROM agents WHERE tokenId NOT IN (0,14,15,16,17,18,21) ORDER BY tokenId ASC').all();
    return rows.map(row => ({
        tokenId: row.tokenId,
        name: row.name,
        agentAddress: row.agentAddress,
        framework: row.framework,
        verified: !!row.verified,
        soulbound: !!row.soulbound,
        mintOrigin: row.mintOrigin,
        credScore: row.credScore,
        points: row.points,
        traitCount: 0,
        personality: null,
        owner: row.owner,
        mintedAt: row.mintedAt,
    }));
}

function getAgentCount() {
    return db.prepare('SELECT COUNT(*) as cnt FROM agents').get().cnt;
}

// ─── Event Sync ─────────────────────────────────────────────────

async function fetchAgentData(tokenId) {
    try {
        const agent = await readContract.getAgent(tokenId);
        let credScore = 0, points = 0;
        try { credScore = Number(await readContract.getCredScore(tokenId)); } catch {}
        try { points = Number(await readContract.points(tokenId)); } catch {}
        return {
            tokenId,
            name: agent.name,
            agentAddress: agent.agentAddress,
            framework: agent.framework,
            verified: agent.verified,
            soulbound: agent.soulbound || tokenId === 1,
            mintOrigin: ['HUMAN', 'AGENT_SIWA', 'API', 'OWNER'][Number(agent.origin)] || 'UNKNOWN',
            credScore,
            points,
            owner: agent.agentAddress,
            mintedAt: new Date(Number(agent.mintedAt) * 1000).toISOString(),
        };
    } catch (e) {
        console.error(`[INDEXER] Failed to fetch agent #${tokenId}:`, e.message);
        return null;
    }
}

async function syncEvents(fromBlock, toBlock) {
    const eventSig = ethers.id('AgentRegistered(uint256,address,string,uint8)');
    let totalNew = 0;

    for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE - 1, toBlock);
        try {
            const logs = await readProvider.getLogs({
                address: readContract.target,
                topics: [eventSig],
                fromBlock: start,
                toBlock: end,
            });

            if (logs.length > 0) {
                console.log(`[INDEXER] Found ${logs.length} events in blocks ${start}-${end}`);
                const agents = [];
                for (const log of logs) {
                    const tokenId = parseInt(log.topics[1], 16);
                    // Check if already in DB
                    const existing = db.prepare('SELECT tokenId FROM agents WHERE tokenId = ?').get(tokenId);
                    if (!existing) {
                        const agent = await fetchAgentData(tokenId);
                        if (agent) agents.push(agent);
                        // Rate limit: small delay between RPC calls
                        if (agents.length % 5 === 0) await sleep(500);
                    }
                }
                if (agents.length > 0) {
                    upsertMany(agents);
                    totalNew += agents.length;
                }
            }
        } catch (e) {
            console.error(`[INDEXER] Error fetching logs ${start}-${end}:`, e.message);
            // On error, retry with smaller chunks
            if (CHUNK_SIZE > 1000) {
                for (let s = start; s <= end; s += 2000) {
                    const e2 = Math.min(s + 1999, end);
                    try {
                        const logs = await readProvider.getLogs({
                            address: readContract.target,
                            topics: [eventSig],
                            fromBlock: s,
                            toBlock: e2,
                        });
                        for (const log of logs) {
                            const tokenId = parseInt(log.topics[1], 16);
                            const existing = db.prepare('SELECT tokenId FROM agents WHERE tokenId = ?').get(tokenId);
                            if (!existing) {
                                const agent = await fetchAgentData(tokenId);
                                if (agent) { upsertAgent(agent); totalNew++; }
                                await sleep(200);
                            }
                        }
                    } catch (e3) {
                        console.error(`[INDEXER] Retry failed ${s}-${e2}:`, e3.message);
                    }
                }
            }
        }
        setLastSyncedBlock(end);
    }
    return totalNew;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runSync() {
    try {
        const lastBlock = getLastSyncedBlock();
        const currentBlock = await readProvider.getBlockNumber();
        
        if (currentBlock <= lastBlock) {
            return 0;
        }

        console.log(`[INDEXER] Syncing blocks ${lastBlock} → ${currentBlock} (${currentBlock - lastBlock} blocks)`);
        const newAgents = await syncEvents(lastBlock + 1, currentBlock);
        setLastSyncedBlock(currentBlock);
        
        const total = getAgentCount();
        if (newAgents > 0) {
            console.log(`[INDEXER] Added ${newAgents} new agents. Total: ${total}`);
        }
        return newAgents;
    } catch (e) {
        console.error('[INDEXER] Sync error:', e.message);
        return 0;
    }
}

/**
 * Bootstrap: if DB is empty, load from JSON cache or do sequential scan.
 */
async function bootstrapFromCache(cachePath) {
    const count = getAgentCount();
    if (count > 0) {
        console.log(`[INDEXER] DB already has ${count} agents, skipping bootstrap`);
        return;
    }

    // Try loading from existing JSON cache
    try {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        if (cached.agents && cached.agents.length > 0) {
            console.log(`[INDEXER] Bootstrapping from JSON cache: ${cached.agents.length} agents`);
            upsertMany(cached.agents);
            console.log(`[INDEXER] Bootstrapped ${cached.agents.length} agents from cache`);
            return;
        }
    } catch {}

    // No cache — do sequential scan (faster than event-based for initial load)
    console.log('[INDEXER] No cache found, bootstrapping from contract...');
    try {
        const totalRaw = Number(await readContract.totalAgents());
        console.log(`[INDEXER] Total agents on-chain: ${totalRaw}`);
        const batch = [];
        for (let i = 0; i < totalRaw; i++) {
            if (i % 50 === 0 && i > 0) {
                console.log(`[INDEXER] Bootstrap loading... ${i}/${totalRaw}`);
                // Write batch to DB periodically
                if (batch.length > 0) { upsertMany(batch); batch.length = 0; }
            }
            try {
                const agent = await readContract.getAgent(i);
                batch.push({
                    tokenId: i,
                    name: agent.name,
                    agentAddress: agent.agentAddress,
                    framework: agent.framework,
                    verified: agent.verified,
                    soulbound: agent.soulbound || i === 1,
                    mintOrigin: ['HUMAN', 'AGENT_SIWA', 'API', 'OWNER'][Number(agent.origin)] || 'UNKNOWN',
                    credScore: 0,
                    points: 0,
                    owner: agent.agentAddress,
                    mintedAt: new Date(Number(agent.mintedAt) * 1000).toISOString(),
                });
            } catch {}
        }
        if (batch.length > 0) upsertMany(batch);
        console.log(`[INDEXER] Bootstrap complete: ${getAgentCount()} agents loaded`);
    } catch (e) {
        console.error('[INDEXER] Bootstrap error:', e.message);
    }
}

// ─── Public API ─────────────────────────────────────────────────

async function startIndexer(provider, contract, cachePath) {
    readProvider = provider;
    readContract = contract;

    initDb();
    await bootstrapFromCache(cachePath);

    // Initial sync
    await runSync();

    // Poll every 30 seconds
    pollTimer = setInterval(runSync, POLL_INTERVAL_MS);
    console.log(`[INDEXER] Polling every ${POLL_INTERVAL_MS / 1000}s`);
}

async function refreshScores() {
    if (!db || !readContract) return;
    const rows = db.prepare('SELECT tokenId FROM agents ORDER BY tokenId ASC').all();
    console.log(`[INDEXER] Refreshing cred scores for ${rows.length} agents...`);
    let updated = 0;
    for (const row of rows) {
        try {
            let credScore = 0, points = 0;
            try { credScore = Number(await readContract.getCredScore(row.tokenId)); } catch {}
            try { points = Number(await readContract.points(row.tokenId)); } catch {}
            if (credScore > 0 || points > 0) {
                db.prepare('UPDATE agents SET credScore = ?, points = ?, lastUpdated = ? WHERE tokenId = ?')
                    .run(credScore, points, Date.now(), row.tokenId);
                updated++;
            }
        } catch {}
    }
    console.log(`[INDEXER] Score refresh done: ${updated} agents updated`);
}

function stopIndexer() {
    if (pollTimer) clearInterval(pollTimer);
}

module.exports = {
    startIndexer,
    stopIndexer,
    queryAgents,
    getAllAgents,
    getAgentCount,
    refreshScores,
    upsertAgent: (a) => { if (db) upsertAgent(a); },
};
