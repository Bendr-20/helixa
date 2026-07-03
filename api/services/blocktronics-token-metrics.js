const coveredTokenConfig = require('../config/blocktronics-covered-tokens.json');

const BLOCKTRONICS_ENDPOINT = coveredTokenConfig.endpoint;
const SOURCE = 'blocktronics_x402';
const TOKEN_RE = /^0x[a-fA-F0-9]{40}$/;

function codedError(code, message = code) {
    const err = new Error(message);
    err.code = code;
    return err;
}

function normalizeTokenAddress(value) {
    const token = String(value || '').trim();
    if (!TOKEN_RE.test(token)) {
        throw codedError('invalid_token');
    }
    return token.toLowerCase();
}

function normalizeChain(value = 'base') {
    if (value === undefined || value === null || String(value).trim() === '') {
        return 'base';
    }

    const chain = String(value).trim().toLowerCase();
    if (chain === 'base' || chain === String(coveredTokenConfig.chain_id)) {
        return 'base';
    }

    throw codedError('invalid_chain');
}

const coveredTokens = new Map(
    coveredTokenConfig.tokens.map((token) => {
        const address = normalizeTokenAddress(token.address);
        return [address, { ...token, address }];
    })
);

function getCoveredToken(value) {
    const token = normalizeTokenAddress(value);
    return coveredTokens.get(token) || null;
}

function isCoveredToken(value, chain = 'base') {
    try {
        normalizeChain(chain);
        const token = normalizeTokenAddress(value);
        return coveredTokens.has(token);
    } catch (_) {
        return false;
    }
}

function assertCoveredToken(value, chain = 'base') {
    const token = normalizeTokenAddress(value);
    normalizeChain(chain);
    if (!coveredTokens.has(token)) {
        throw codedError('unknown_token');
    }
    return token;
}

function buildBlocktronicsUrl(token, chain = 'base') {
    const tokenAddress = assertCoveredToken(token, chain);
    const normalizedChain = normalizeChain(chain);
    const url = new URL(BLOCKTRONICS_ENDPOINT);
    url.searchParams.set('token', tokenAddress);
    url.searchParams.set('chain', normalizedChain);
    return url.toString();
}

function toInteger(value) {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : null;
}

function toNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function stringOrNull(value) {
    if (value === undefined || value === null) return null;
    const string = String(value).trim();
    return string === '' ? null : string;
}

function hasOwn(object, property) {
    return Object.prototype.hasOwnProperty.call(object || {}, property);
}

function resolveResponseToken(payload, options, chain) {
    const requestedToken = hasOwn(options, 'token') ? normalizeTokenAddress(options.token) : null;
    const payloadTokens = [];

    for (const key of ['token', 'token_address']) {
        if (hasOwn(payload, key)) {
            payloadTokens.push(normalizeTokenAddress(payload[key]));
        }
    }

    let payloadToken = null;
    for (const normalized of payloadTokens) {
        if (!payloadToken) {
            payloadToken = normalized;
        } else if (payloadToken !== normalized) {
            throw codedError('response_token_mismatch');
        }
    }

    if (requestedToken && payloadToken && requestedToken !== payloadToken) {
        throw codedError('response_token_mismatch');
    }

    return assertCoveredToken(requestedToken || payloadToken, chain);
}

function publicFromFields(row) {
    return {
        source: row.source || SOURCE,
        status: row.status,
        active_holders: toInteger(row.active_holders),
        weekly_active_holder_growth_pct: null,
        weekly_active_holder_growth_count: null,
        avg_weekly_netflow_usd: toNumber(row.avg_weekly_netflow_usd),
        avg_weekly_netflow_per_day_usd: toNumber(row.avg_weekly_netflow_per_day_usd),
        avg_weekly_netflow_direction: stringOrNull(row.avg_weekly_netflow_direction),
        holders_in_profit_pct: toNumber(row.holders_in_profit_pct),
        holders_in_profit_count: toInteger(row.holders_in_profit_count),
        holders_counted: toInteger(row.holders_counted),
        as_of: stringOrNull(row.as_of),
        cached_at: stringOrNull(row.cached_at),
        fetched_at: stringOrNull(row.fetched_at),
        price_usdc: stringOrNull(row.price_usdc),
        window_days: toInteger(row.window_days),
    };
}

function normalizeBlocktronicsResponse(payload, options = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw codedError('invalid_response');
    }

    const status = String(payload.status || '').trim().toLowerCase();
    if (status !== 'ok' && status !== 'preparing') {
        throw codedError('invalid_status');
    }

    const chain = normalizeChain(payload.chain || options.chain || 'base');
    const tokenAddress = resolveResponseToken(payload, options, chain);
    const covered = getCoveredToken(tokenAddress);
    const metrics = payload.metrics || {};
    const activeHolders = metrics.active_holders || {};
    const netflow = metrics.avg_weekly_netflow || {};
    const holdersInProfit = metrics.holders_in_profit || {};
    const fetchedAt = stringOrNull(options.fetchedAt) || new Date().toISOString();

    const row = {
        chain,
        token_address: tokenAddress,
        token_symbol: stringOrNull(options.tokenSymbol || payload.token_symbol || payload.symbol || covered?.symbol),
        status,
        active_holders: status === 'ok' ? toInteger(activeHolders.value) : null,
        avg_weekly_netflow_usd: status === 'ok' ? toNumber(netflow.value_usd) : null,
        avg_weekly_netflow_per_day_usd: status === 'ok' ? toNumber(netflow.per_day_usd) : null,
        avg_weekly_netflow_direction: status === 'ok' ? stringOrNull(netflow.direction) : null,
        holders_in_profit_pct: status === 'ok' ? toNumber(holdersInProfit.pct) : null,
        holders_in_profit_count: status === 'ok' ? toInteger(holdersInProfit.in_profit) : null,
        holders_counted: status === 'ok' ? toInteger(holdersInProfit.counted) : null,
        as_of: stringOrNull(payload.as_of),
        cached_at: stringOrNull(payload.cached_at),
        fetched_at: fetchedAt,
        price_usdc: stringOrNull(payload.price_usdc || coveredTokenConfig.price_usdc),
        window_days: toInteger(payload.window_days),
        payload_json: JSON.stringify(payload),
        error_code: stringOrNull(payload.error_code || payload.error),
        error_message: stringOrNull(payload.error_message || payload.message || payload.note),
        source: SOURCE,
    };

    row.public = publicFromFields(row);
    return row;
}

function ensureTokenMetricsTables(db) {
    if (!db || typeof db.exec !== 'function') {
        throw codedError('invalid_db');
    }

    db.exec(`
        CREATE TABLE IF NOT EXISTS token_metrics_cache (
          chain TEXT NOT NULL DEFAULT 'base',
          token_address TEXT NOT NULL,
          token_symbol TEXT,
          status TEXT NOT NULL,
          active_holders INTEGER,
          avg_weekly_netflow_usd REAL,
          avg_weekly_netflow_per_day_usd REAL,
          avg_weekly_netflow_direction TEXT,
          holders_in_profit_pct REAL,
          holders_in_profit_count INTEGER,
          holders_counted INTEGER,
          as_of TEXT,
          cached_at TEXT,
          fetched_at TEXT NOT NULL,
          price_usdc TEXT,
          window_days INTEGER,
          payload_json TEXT NOT NULL,
          error_code TEXT,
          error_message TEXT,
          source TEXT NOT NULL DEFAULT 'blocktronics_x402',
          PRIMARY KEY (chain, token_address)
        );
        CREATE INDEX IF NOT EXISTS idx_token_metrics_cache_fetched_at ON token_metrics_cache(fetched_at);
        CREATE INDEX IF NOT EXISTS idx_token_metrics_cache_status ON token_metrics_cache(status);
    `);

    return db;
}

const CACHE_COLUMNS = [
    'chain',
    'token_address',
    'token_symbol',
    'status',
    'active_holders',
    'avg_weekly_netflow_usd',
    'avg_weekly_netflow_per_day_usd',
    'avg_weekly_netflow_direction',
    'holders_in_profit_pct',
    'holders_in_profit_count',
    'holders_counted',
    'as_of',
    'cached_at',
    'fetched_at',
    'price_usdc',
    'window_days',
    'payload_json',
    'error_code',
    'error_message',
    'source',
];

function normalizeCacheStatus(value) {
    const status = (stringOrNull(value) || 'ok').toLowerCase();
    if (status !== 'ok' && status !== 'preparing') {
        throw codedError('invalid_status');
    }
    return status;
}

function normalizeCacheRow(record) {
    const row = record && record.public ? record : normalizeBlocktronicsResponse(record || {});
    const chain = normalizeChain(row.chain || 'base');
    const tokenAddress = assertCoveredToken(row.token_address, chain);
    const status = normalizeCacheStatus(row.status);
    const payloadJson = typeof row.payload_json === 'string'
        ? row.payload_json
        : JSON.stringify(row.payload || row.public || {});

    return {
        chain,
        token_address: tokenAddress,
        token_symbol: stringOrNull(row.token_symbol),
        status,
        active_holders: toInteger(row.active_holders),
        avg_weekly_netflow_usd: toNumber(row.avg_weekly_netflow_usd),
        avg_weekly_netflow_per_day_usd: toNumber(row.avg_weekly_netflow_per_day_usd),
        avg_weekly_netflow_direction: stringOrNull(row.avg_weekly_netflow_direction),
        holders_in_profit_pct: toNumber(row.holders_in_profit_pct),
        holders_in_profit_count: toInteger(row.holders_in_profit_count),
        holders_counted: toInteger(row.holders_counted),
        as_of: stringOrNull(row.as_of),
        cached_at: stringOrNull(row.cached_at),
        fetched_at: stringOrNull(row.fetched_at) || new Date().toISOString(),
        price_usdc: stringOrNull(row.price_usdc),
        window_days: toInteger(row.window_days),
        payload_json: payloadJson,
        error_code: stringOrNull(row.error_code),
        error_message: stringOrNull(row.error_message),
        source: stringOrNull(row.source) || SOURCE,
    };
}

function upsertTokenMetricsCache(db, record) {
    const row = normalizeCacheRow(record);
    const values = CACHE_COLUMNS.map((column) => `@${column}`).join(', ');
    const updates = CACHE_COLUMNS
        .filter((column) => column !== 'chain' && column !== 'token_address')
        .map((column) => `${column} = excluded.${column}`)
        .join(', ');

    return db.prepare(`
        INSERT INTO token_metrics_cache (${CACHE_COLUMNS.join(', ')})
        VALUES (${values})
        ON CONFLICT(chain, token_address) DO UPDATE SET ${updates}
    `).run(row);
}

function readCachedTokenMetrics(db, token, chain = 'base') {
    let tokenAddress;
    let normalizedChain;
    try {
        normalizedChain = normalizeChain(chain);
        tokenAddress = assertCoveredToken(token, normalizedChain);
    } catch (err) {
        if (err && (err.code === 'invalid_token' || err.code === 'invalid_chain' || err.code === 'unknown_token')) {
            return null;
        }
        throw err;
    }

    let row;
    try {
        row = db.prepare('SELECT * FROM token_metrics_cache WHERE chain = ? AND token_address = ?').get(normalizedChain, tokenAddress);
    } catch (err) {
        if (/no such table/i.test(err.message || '')) return null;
        throw err;
    }

    return row ? publicFromFields(row) : null;
}

function isBaseTokenRow(row) {
    const chainId = row?.chain_id ?? row?.chainId;
    if (chainId !== undefined && chainId !== null && String(chainId).trim() !== '') {
        return Number(chainId) === coveredTokenConfig.chain_id;
    }

    const chain = row?.chain ?? row?.network;
    if (chain !== undefined && chain !== null && String(chain).trim() !== '') {
        try {
            return normalizeChain(chain) === 'base';
        } catch (_) {
            return false;
        }
    }

    return false;
}

function attachCachedTokenMetrics(db, rows) {
    if (!Array.isArray(rows)) return rows;

    return rows.map((row) => {
        const next = { ...row };
        if (!isBaseTokenRow(row)) return next;

        const tokenValue = row.token_address || row.tokenAddress;
        let tokenAddress;
        try {
            tokenAddress = normalizeTokenAddress(tokenValue);
        } catch (_) {
            return next;
        }

        const cached = readCachedTokenMetrics(db, tokenAddress, 'base');
        if (cached) {
            next.token_metrics = cached;
        }
        return next;
    });
}

function cacheAgeMsOption(value, defaultValue, unitMs) {
    const raw = value === undefined ? defaultValue : value;
    if (raw === null) return null;
    const number = Number(raw);
    return Number.isFinite(number) ? Math.max(0, number) * unitMs : null;
}

function isCacheRowStale(cached, nowMs, maxAgeMs) {
    if (maxAgeMs === null) return false;
    const fetchedMs = Date.parse(cached.fetched_at || '');
    return !Number.isFinite(fetchedMs) || (nowMs - fetchedMs) >= maxAgeMs;
}

function selectRefreshCandidates(db, options = {}) {
    const chain = normalizeChain(options.chain || 'base');
    const limit = Math.max(0, toInteger(options.limit) ?? coveredTokens.size);
    const maxAgeMs = cacheAgeMsOption(options.maxAgeHours, 24, 60 * 60 * 1000);
    const preparingMaxAgeMs = cacheAgeMsOption(options.preparingMaxAgeMinutes, 10, 60 * 1000);
    const parsedNowMs = options.now ? Date.parse(options.now) : Date.now();
    const nowMs = Number.isFinite(parsedNowMs) ? parsedNowMs : Date.now();
    const rowsByToken = new Map();

    if (db) {
        try {
            for (const row of db.prepare('SELECT token_address, status, fetched_at FROM token_metrics_cache WHERE chain = ?').all(chain)) {
                rowsByToken.set(normalizeTokenAddress(row.token_address), row);
            }
        } catch (err) {
            if (!/no such table/i.test(err.message || '')) throw err;
        }
    }

    return coveredTokenConfig.tokens
        .map((token) => ({ symbol: token.symbol, address: normalizeTokenAddress(token.address), chain }))
        .filter((token) => {
            const cached = rowsByToken.get(token.address);
            if (!cached) return true;
            const status = String(cached.status || '').trim().toLowerCase();
            const ageMs = status === 'preparing' ? preparingMaxAgeMs : maxAgeMs;
            return isCacheRowStale(cached, nowMs, ageMs);
        })
        .slice(0, limit);
}

async function fetchBlocktronicsTokenMetrics({ token, chain = 'base', fetchImpl, fetchedAt } = {}) {
    const tokenAddress = assertCoveredToken(token, chain);
    const normalizedChain = normalizeChain(chain);
    const impl = fetchImpl || globalThis.fetch;
    if (typeof impl !== 'function') {
        throw codedError('fetch_unavailable');
    }

    const url = buildBlocktronicsUrl(tokenAddress, normalizedChain);
    const res = await impl(url, { headers: { accept: 'application/json' } });
    let body = null;
    try {
        body = await res.json();
    } catch (_) {
        body = null;
    }

    if (!res.ok) {
        const code = body?.error || `http_${res.status}`;
        const err = codedError(code);
        err.status = res.status;
        err.body = body;
        throw err;
    }

    return normalizeBlocktronicsResponse(body, {
        token: tokenAddress,
        chain: normalizedChain,
        fetchedAt: fetchedAt || new Date().toISOString(),
    });
}

module.exports = {
    BLOCKTRONICS_ENDPOINT,
    normalizeTokenAddress,
    normalizeChain,
    isCoveredToken,
    buildBlocktronicsUrl,
    normalizeBlocktronicsResponse,
    ensureTokenMetricsTables,
    upsertTokenMetricsCache,
    readCachedTokenMetrics,
    attachCachedTokenMetrics,
    selectRefreshCandidates,
    fetchBlocktronicsTokenMetrics,
};
