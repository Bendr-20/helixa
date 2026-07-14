#!/usr/bin/env node
/**
 * Refresh persisted Helixa Cred scores from the computed v2 Cred endpoint.
 *
 * The local SQLite indexer stores fast directory rows, while /api/v2/agent/:id/cred
 * hydrates richer profile context. This script keeps the indexed AgentDNA and
 * terminal tables aligned with the computed model before publishing/fallback export.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const API_BASE = (process.env.HELIXA_API_BASE || 'http://127.0.0.1:3457').replace(/\/$/, '');
const AGENT_DB_PATH = process.env.AGENT_DB_PATH || path.resolve(__dirname, '..', '..', 'data', 'agents.db');
const TERMINAL_DB_PATH = process.env.TERMINAL_DB_PATH || path.resolve(__dirname, '..', '..', '..', 'terminal', 'data', 'terminal.db');
const CONCURRENCY = Math.max(1, Math.min(80, Number.parseInt(process.env.CRED_REFRESH_CONCURRENCY || '40', 10) || 40));
const REQUEST_TIMEOUT_MS = Math.max(1000, Number.parseInt(process.env.CRED_REFRESH_TIMEOUT_MS || '8000', 10) || 8000);
const AGENT_TIMEOUT_MS = Math.max(3000, Number.parseInt(process.env.CRED_REFRESH_AGENT_TIMEOUT_MS || '12000', 10) || 12000);

function loadEnvFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return;
    fs.readFileSync(filePath, 'utf8').split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        const trimmedKey = key?.trim();
        if (!trimmedKey || !val.length || trimmedKey.startsWith('#')) return;
        if (process.env[trimmedKey]) return;
        process.env[trimmedKey] = val.join('=').trim();
    });
}

loadEnvFile(process.env.HELIXA_API_ENV_FILE || path.join(require('os').homedir(), '.config', 'helixa', 'agentdna-api.env'));
loadEnvFile(path.resolve(__dirname, '..', '..', '.env'));

function parseArgs(argv) {
    const out = { limit: null, ids: null, backup: true };
    for (const arg of argv) {
        if (arg === '--no-backup') out.backup = false;
        else if (arg.startsWith('--limit=')) out.limit = Math.max(1, Number.parseInt(arg.slice('--limit='.length), 10) || 0) || null;
        else if (arg.startsWith('--ids=')) {
            out.ids = arg.slice('--ids='.length)
                .split(',')
                .map(v => Number.parseInt(v.trim(), 10))
                .filter(v => Number.isInteger(v) && v >= 0);
        }
    }
    return out;
}

function tierOf(score) {
    const s = Number(score || 0);
    if (s >= 91) return 'PREFERRED';
    if (s >= 76) return 'PRIME';
    if (s >= 51) return 'QUALIFIED';
    if (s >= 26) return 'MARGINAL';
    return 'JUNK';
}

async function backupDb(dbPath) {
    if (!fs.existsSync(dbPath)) return null;
    const dir = path.join(path.dirname(dbPath), 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z');
    const backupPath = path.join(dir, `${path.basename(dbPath, '.db')}-before-computed-cred-refresh-${stamp}.db`);
    const db = new Database(dbPath, { readonly: true });
    await db.backup(backupPath);
    db.close();
    return backupPath;
}

async function fetchCred(tokenId) {
    const url = `${API_BASE}/api/v2/agent/${tokenId}/cred?timeoutMs=${AGENT_TIMEOUT_MS}`;
    const res = await fetch(url, {
        headers: {
            accept: 'application/json',
            ...(process.env.INTERNAL_API_KEY ? { 'x-internal-key': process.env.INTERNAL_API_KEY } : {}),
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`non_json_response:${text.slice(0, 120)}`);
    }
    if (!res.ok) throw new Error(data?.detail || data?.error || `http_${res.status}`);
    const score = Number(data.credScore);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
        throw new Error(`invalid_score:${data.credScore}`);
    }
    return {
        tokenId,
        name: data.name || null,
        score: Math.round(score),
        tier: String(data.tier || tierOf(score)).toUpperCase(),
        evidenceCoverage: data.evidenceCoverage?.score ?? null,
        intuitionStatus: data.intuition?.status || null,
    };
}

async function mapConcurrent(items, worker, concurrency) {
    const results = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (next < items.length) {
            const index = next++;
            try {
                results[index] = { ok: true, value: await worker(items[index], index) };
            } catch (error) {
                results[index] = { ok: false, error, item: items[index] };
            }
        }
    });
    await Promise.all(workers);
    return results;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(AGENT_DB_PATH)) throw new Error(`Agent DB not found: ${AGENT_DB_PATH}`);

    const agentDb = new Database(AGENT_DB_PATH);
    agentDb.pragma('journal_mode = WAL');
    const terminalDb = fs.existsSync(TERMINAL_DB_PATH) ? new Database(TERMINAL_DB_PATH) : null;
    if (terminalDb) terminalDb.pragma('journal_mode = WAL');

    try {
        if (args.backup) {
            const [agentBackup, terminalBackup] = await Promise.all([
                backupDb(AGENT_DB_PATH),
                terminalDb ? backupDb(TERMINAL_DB_PATH) : Promise.resolve(null),
            ]);
            if (agentBackup) console.log(`Agent DB backup: ${agentBackup}`);
            if (terminalBackup) console.log(`Terminal DB backup: ${terminalBackup}`);
        }

        let tokenIds = args.ids && args.ids.length
            ? args.ids
            : agentDb.prepare('SELECT tokenId FROM agents ORDER BY tokenId ASC').all().map(row => Number(row.tokenId));
        if (args.limit) tokenIds = tokenIds.slice(0, args.limit);

        console.log(`Refreshing ${tokenIds.length} computed Cred scores from ${API_BASE} (concurrency ${CONCURRENCY})`);
        let completed = 0;
        const results = await mapConcurrent(tokenIds, async (tokenId) => {
            const value = await fetchCred(tokenId);
            completed += 1;
            if (completed % 250 === 0 || completed === tokenIds.length) {
                console.log(`Fetched ${completed}/${tokenIds.length}`);
            }
            return value;
        }, CONCURRENCY);

        const ok = results.filter(r => r.ok).map(r => r.value);
        const failed = results.filter(r => !r.ok);
        const nowMs = Date.now();
        const nowSec = Math.floor(nowMs / 1000);

        const updateAgent = agentDb.prepare('UPDATE agents SET credScore = ?, lastUpdated = ? WHERE tokenId = ?');
        const updateAgentTx = agentDb.transaction((rows) => {
            for (const row of rows) updateAgent.run(row.score, nowMs, row.tokenId);
        });
        updateAgentTx(ok);

        let terminalUpdated = 0;
        if (terminalDb) {
            terminalDb.prepare('CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id)').run();
            const updateTerminal = terminalDb.prepare(`
                UPDATE agents
                SET cred_score = ?, cred_tier = ?, last_scored = ?
                WHERE token_id = ?
            `);
            const updateTerminalTx = terminalDb.transaction((rows) => {
                for (const row of rows) {
                    const id = `helixa-${row.tokenId}`;
                    const result = updateTerminal.run(row.score, row.tier, nowSec, id);
                    terminalUpdated += result.changes;
                }
            });
            updateTerminalTx(ok);
        }

        console.log(`Updated AgentDNA rows: ${ok.length}`);
        if (terminalDb) console.log(`Updated terminal rows: ${terminalUpdated}`);
        if (failed.length) {
            console.log(`Failed rows: ${failed.length}`);
            for (const item of failed.slice(0, 20)) {
                console.log(`  ${item.item}: ${item.error.message}`);
            }
        }
        for (const row of ok.filter(r => [1, 73, 1037, 1069, 1127].includes(r.tokenId))) {
            console.log(`Sample #${row.tokenId} ${row.name || ''}: ${row.score} ${row.tier}, coverage ${row.evidenceCoverage ?? 'n/a'}, intuition ${row.intuitionStatus || 'n/a'}`);
        }
    } finally {
        agentDb.close();
        if (terminalDb) terminalDb.close();
    }
}

main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
});
