const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Database = require('better-sqlite3');
const metrics = require('./blocktronics-token-metrics');

const BNKR = '0x22af33fe49fd1fa80c7149773dde5890d3c76f3b';
const GITLAWB = '0x5f980dcfc4c0fa3911554cf5ab288ed0eb13dba3';
const LFI = '0x3722264ab15a1dfce5a5af89e6547f7949a8aba3';
const JUNO = '0x4e6c9f48f73e54ee5f3ab7e2992b2d733d0d0b07';
const SURPLUS = '0xc52aedec3374422d7510e294cfaa90799595cba3';
const AEON = '0xbf8e8f0e8866a7052f948c16508644347c57aba3';
const UNSUPPORTED = '0x0000000000000000000000000000000000000001';

function makeDb() {
    return new Database(':memory:');
}

function okPayload(token = '0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b') {
    return {
        schema_version: '1.1',
        client: 'helixa',
        status: 'ok',
        chain: 'base',
        token,
        as_of: '2026-06-26T13:10:44.715Z',
        cached_at: '2026-06-26T13:10:44.715Z',
        window_days: 14,
        refreshed: true,
        data_changed: false,
        price_usdc: '0.04',
        metrics: {
            active_holders: { value: 2735, label: 'Active holders (as of today)' },
            avg_weekly_netflow: { value_usd: 9100.34, per_day_usd: 1300.05, direction: 'outflow', label: 'Average weekly netflow' },
            holders_in_profit: { pct: 39.28, in_profit: 1233, counted: 3139, label: 'Percentage of active holders in profit' }
        }
    };
}

function preparingPayload(token = '0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b') {
    return {
        schema_version: '1.1',
        client: 'helixa',
        status: 'preparing',
        chain: 'base',
        token,
        note: 'This token is being prepared. Refresh again shortly.'
    };
}

function cachedOk(token, fetchedAt) {
    return metrics.normalizeBlocktronicsResponse(okPayload(token), { token, fetchedAt });
}

function cachedPreparing(token, fetchedAt) {
    return metrics.normalizeBlocktronicsResponse(preparingPayload(token), { token, fetchedAt });
}

function addresses(candidates) {
    return candidates.map((candidate) => candidate.address);
}

function runRefreshScript(args, env = {}) {
    return spawnSync(process.execPath, [path.join(__dirname, '../scripts/refresh-blocktronics-token-metrics.js'), ...args], {
        cwd: path.join(__dirname, '../..'),
        env: {
            ...process.env,
            BLOCKTRONICS_ALLOW_PAID_REFRESH: '',
            DEPLOYER_KEY: '',
            AGENT_PRIVATE_KEY: '',
            ...env,
        },
        encoding: 'utf8',
    });
}

async function run() {
    const fetchedAt = '2026-06-26T13:11:00.000Z';
    const token = metrics.normalizeTokenAddress('0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b');
    assert.equal(token, BNKR);
    assert.throws(() => metrics.normalizeTokenAddress('https://user:pass@example.com'), /invalid_token/);
    assert.throws(() => metrics.normalizeTokenAddress('0x1234'), /invalid_token/);
    assert.throws(() => metrics.normalizeTokenAddress(`${token}?chain=base`), /invalid_token/);
    assert.equal(metrics.normalizeChain('BASE'), 'base');
    assert.equal(metrics.normalizeChain(8453), 'base');
    assert.throws(() => metrics.normalizeChain('ethereum'), /invalid_chain/);

    const normalized = metrics.normalizeBlocktronicsResponse(okPayload(), { fetchedAt });
    assert.equal(normalized.token_address, token);
    assert.equal(normalized.status, 'ok');
    assert.deepEqual(normalized.public, {
        source: 'blocktronics_x402',
        status: 'ok',
        active_holders: 2735,
        weekly_active_holder_growth_pct: null,
        weekly_active_holder_growth_count: null,
        avg_weekly_netflow_usd: 9100.34,
        avg_weekly_netflow_per_day_usd: 1300.05,
        avg_weekly_netflow_direction: 'outflow',
        holders_in_profit_pct: 39.28,
        holders_in_profit_count: 1233,
        holders_counted: 3139,
        as_of: '2026-06-26T13:10:44.715Z',
        cached_at: '2026-06-26T13:10:44.715Z',
        fetched_at: fetchedAt,
        price_usdc: '0.04',
        window_days: 14
    });

    const normalizedWithRequestedToken = metrics.normalizeBlocktronicsResponse(okPayload(BNKR), { token: BNKR, fetchedAt });
    assert.equal(normalizedWithRequestedToken.token_address, BNKR);
    assert.throws(
        () => metrics.normalizeBlocktronicsResponse(okPayload(GITLAWB), { token: BNKR, fetchedAt }),
        (err) => err.code === 'response_token_mismatch' && /response_token_mismatch/.test(err.message)
    );
    assert.throws(
        () => metrics.normalizeBlocktronicsResponse(okPayload(UNSUPPORTED), { fetchedAt }),
        (err) => err.code === 'unknown_token' && /unknown_token/.test(err.message)
    );

    const preparing = metrics.normalizeBlocktronicsResponse(preparingPayload(), { fetchedAt });
    assert.equal(preparing.status, 'preparing');
    assert.equal(preparing.public.status, 'preparing');
    assert.equal(preparing.public.active_holders, null);
    assert.equal(preparing.public.avg_weekly_netflow_usd, null);
    assert.equal(preparing.public.fetched_at, fetchedAt);

    const db = makeDb();
    try {
        metrics.ensureTokenMetricsTables(db);
        const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'token_metrics_cache'").get();
        assert.equal(table.name, 'token_metrics_cache');

        metrics.upsertTokenMetricsCache(db, normalized);
        const cached = metrics.readCachedTokenMetrics(db, token, 'base');
        assert.equal(cached.status, 'ok');
        assert.equal(cached.active_holders, 2735);
        assert.equal(cached.avg_weekly_netflow_direction, 'outflow');
        assert.throws(
            () => metrics.upsertTokenMetricsCache(db, {
                public: {},
                chain: 'base',
                token_address: UNSUPPORTED,
                status: 'ok',
                fetched_at: fetchedAt,
                payload_json: '{}',
                source: 'blocktronics_x402'
            }),
            (err) => err.code === 'unknown_token' && /unknown_token/.test(err.message)
        );
        assert.throws(
            () => metrics.upsertTokenMetricsCache(db, {
                public: {},
                chain: 'base',
                token_address: token,
                status: 'error',
                fetched_at: fetchedAt,
                payload_json: '{}',
                source: 'blocktronics_x402'
            }),
            (err) => err.code === 'invalid_status' && /invalid_status/.test(err.message)
        );
        db.prepare(`
            INSERT INTO token_metrics_cache (chain, token_address, status, fetched_at, payload_json, source)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run('base', UNSUPPORTED, 'ok', fetchedAt, '{}', 'blocktronics_x402');
        assert.equal(metrics.readCachedTokenMetrics(db, UNSUPPORTED, 'base'), null);

        const attached = metrics.attachCachedTokenMetrics(db, [
            { name: 'Bankr', chain_id: 8453, token_address: token },
            { name: 'Other', chain_id: 1, token_address: token },
            { name: 'Missing', chain_id: 8453, token_address: UNSUPPORTED }
        ]);
        assert.equal(attached[0].token_metrics.active_holders, 2735);
        assert.equal(attached[1].token_metrics, undefined);
        assert.equal(attached[2].token_metrics, undefined);
    } finally {
        db.close();
    }

    const noCacheDb = makeDb();
    try {
        metrics.ensureTokenMetricsTables(noCacheDb);
        const noCacheCandidates = metrics.selectRefreshCandidates(noCacheDb, { limit: 2, now: fetchedAt });
        assert.deepEqual(addresses(noCacheCandidates), [BNKR, GITLAWB]);
    } finally {
        noCacheDb.close();
    }

    const candidatesDb = makeDb();
    try {
        metrics.ensureTokenMetricsTables(candidatesDb);
        metrics.upsertTokenMetricsCache(candidatesDb, cachedOk(BNKR, '2026-06-26T12:50:00.000Z'));
        metrics.upsertTokenMetricsCache(candidatesDb, cachedOk(GITLAWB, '2026-06-25T12:00:00.000Z'));
        metrics.upsertTokenMetricsCache(candidatesDb, cachedPreparing(LFI, '2026-06-26T13:05:00.000Z'));
        metrics.upsertTokenMetricsCache(candidatesDb, cachedPreparing(JUNO, '2026-06-26T12:55:00.000Z'));
        metrics.upsertTokenMetricsCache(candidatesDb, cachedOk(SURPLUS, '2026-06-25T00:00:00.000Z'));
        metrics.upsertTokenMetricsCache(candidatesDb, cachedOk(AEON, '2026-06-25T00:00:00.000Z'));

        const candidates = metrics.selectRefreshCandidates(candidatesDb, {
            now: fetchedAt,
            maxAgeHours: 24,
            preparingMaxAgeMinutes: 10,
            limit: 20
        });
        const candidateAddresses = addresses(candidates);
        assert.equal(candidateAddresses.includes(BNKR), false);
        assert.equal(candidateAddresses.includes(GITLAWB), true);
        assert.equal(candidateAddresses.includes(LFI), false);
        assert.equal(candidateAddresses.includes(JUNO), true);

        const preparingBypassesNormalMaxAge = metrics.selectRefreshCandidates(candidatesDb, {
            now: fetchedAt,
            maxAgeHours: null,
            preparingMaxAgeMinutes: 10,
            limit: 6
        });
        const bypassAddresses = addresses(preparingBypassesNormalMaxAge);
        assert.equal(bypassAddresses.includes(BNKR), false);
        assert.equal(bypassAddresses.includes(GITLAWB), false);
        assert.equal(bypassAddresses.includes(LFI), false);
        assert.equal(bypassAddresses.includes(JUNO), true);

        const limited = metrics.selectRefreshCandidates(candidatesDb, {
            now: fetchedAt,
            maxAgeHours: 24,
            preparingMaxAgeMinutes: 10,
            limit: 3
        });
        assert.equal(limited.length, 3);
    } finally {
        candidatesDb.close();
    }

    assert.equal(metrics.isCoveredToken(token), true);
    assert.equal(metrics.isCoveredToken(UNSUPPORTED), false);

    let calledUrl = null;
    let calledOptions = null;
    const fakeFetch = async (url, options) => {
        calledUrl = String(url);
        calledOptions = options;
        return {
            ok: true,
            status: 200,
            json: async () => okPayload()
        };
    };
    const fetched = await metrics.fetchBlocktronicsTokenMetrics({ token, chain: 'base', fetchImpl: fakeFetch, fetchedAt });
    assert.equal(fetched.status, 'ok');
    assert.ok(calledUrl.includes('/helixia?'));
    assert.ok(calledUrl.includes('token=0x22af33fe49fd1fa80c7149773dde5890d3c76f3b'));
    assert.ok(calledUrl.includes('chain=base'));
    assert.equal(calledOptions.headers.accept, 'application/json');
    assert.equal(fetched.fetched_at, fetchedAt);

    let fetchCalled = false;
    await assert.rejects(
        () => metrics.fetchBlocktronicsTokenMetrics({
            token: UNSUPPORTED,
            chain: 'base',
            fetchImpl: async () => {
                fetchCalled = true;
                throw new Error('fetch should not be called for unsupported tokens');
            }
        }),
        (err) => err.code === 'unknown_token' && /unknown_token/.test(err.message)
    );
    assert.equal(fetchCalled, false);

    const dryRun = runRefreshScript(['--token', BNKR, '--dry-run']);
    assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
    assert.match(dryRun.stdout, /dry_run: true/);
    assert.match(dryRun.stdout, new RegExp(BNKR));

    const paidGate = runRefreshScript(['--token', BNKR]);
    assert.notEqual(paidGate.status, 0);
    assert.match(`${paidGate.stdout}\n${paidGate.stderr}`, /BLOCKTRONICS_ALLOW_PAID_REFRESH=1/);

    console.log('blocktronics token metrics tests passed');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
