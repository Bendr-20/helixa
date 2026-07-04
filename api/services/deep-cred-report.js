const crypto = require('crypto');

const CONFIDENCE = new Set(['HIGH', 'MEDIUM', 'LOW']);
const SOURCE_KIND = 'bankr_risk_analyst';

function scalar(value, fallback = null) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
    if (typeof value === 'boolean') return value;
    const text = String(value).trim();
    return text === '' ? fallback : text;
}

function numberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function textOrDefault(value, fallback) {
    const text = scalar(value, null);
    return typeof text === 'string' ? text.slice(0, 1200) : fallback;
}

function normalizeAddress(value) {
    const text = scalar(value, null);
    return typeof text === 'string' ? text.toLowerCase() : null;
}

function buildSubjectKey(agent = {}) {
    const chainId = scalar(agent.chain_id ?? agent.chainId, null);
    const tokenAddress = normalizeAddress(agent.token_address ?? agent.tokenAddress);
    if (chainId && tokenAddress) return `${chainId}:${tokenAddress}`;

    const agentId = scalar(agent.agent_id ?? agent.agentId, null);
    if (agentId) return `agent:${agentId}`;

    const tokenId = scalar(agent.token_id ?? agent.tokenId, null);
    if (tokenId) return `token:${tokenId}`;

    const rowId = scalar(agent.id, null);
    if (rowId) return `row:${rowId}`;

    throw new Error('Cannot build Deep CRED subject key without agent identifier');
}

function pickTokenMetrics(tokenMetrics) {
    if (!tokenMetrics) return { status: 'unavailable' };
    return {
        source: scalar(tokenMetrics.source, 'blocktronics_x402'),
        status: scalar(tokenMetrics.status, 'unavailable'),
        active_holders: numberOrNull(tokenMetrics.active_holders),
        avg_weekly_netflow_usd: numberOrNull(tokenMetrics.avg_weekly_netflow_usd),
        avg_weekly_netflow_per_day_usd: numberOrNull(tokenMetrics.avg_weekly_netflow_per_day_usd),
        avg_weekly_netflow_direction: scalar(tokenMetrics.avg_weekly_netflow_direction, null),
        holders_in_profit_pct: numberOrNull(tokenMetrics.holders_in_profit_pct),
        holders_in_profit_count: numberOrNull(tokenMetrics.holders_in_profit_count),
        holders_counted: numberOrNull(tokenMetrics.holders_counted),
        as_of: scalar(tokenMetrics.as_of, null),
        fetched_at: scalar(tokenMetrics.fetched_at, null),
        window_days: numberOrNull(tokenMetrics.window_days),
    };
}

function buildDeepCredEvidence(agent = {}, tokenMetrics = null) {
    return {
        cred: {
            score: numberOrNull(agent.cred_score ?? agent.credScore) ?? 0,
            tier: scalar(agent.cred_tier ?? agent.credTier, 'UNKNOWN'),
            verified: Boolean(agent.verified ?? agent.is_verified),
            trust_summary: scalar(agent.trust_summary, null),
            quality_score: numberOrNull(agent.quality_score),
            popularity_score: numberOrNull(agent.popularity_score),
            activity_score: numberOrNull(agent.activity_score),
        },
        market: {
            token_address: normalizeAddress(agent.token_address ?? agent.tokenAddress),
            token_symbol: scalar(agent.token_symbol ?? agent.tokenSymbol, null),
            market_cap_usd: numberOrNull(agent.token_market_cap),
            price_change_24h: numberOrNull(agent.price_change_24h),
            volume_24h: numberOrNull(agent.volume_24h),
            liquidity_usd: numberOrNull(agent.liquidity_usd),
        },
        blocktronics: pickTokenMetrics(tokenMetrics),
        x402: {
            supported: Boolean(agent.x402_supported),
            health: scalar(agent.x402_health, null),
            uptime: numberOrNull(agent.x402_uptime),
            endpoints: numberOrNull(agent.x402_endpoints) ?? 0,
        },
        reputation: {
            total_feedbacks: numberOrNull(agent.total_feedbacks) ?? 0,
            total_validations: numberOrNull(agent.total_validations) ?? 0,
            ethos_score: numberOrNull(agent.ethos_score),
            talent_score: numberOrNull(agent.talent_score),
            attention_score: numberOrNull(agent.attention_score),
            attention_velocity: numberOrNull(agent.attention_velocity),
        },
    };
}

function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function hashEvidence(evidence) {
    return crypto.createHash('sha256').update(stableStringify(evidence)).digest('hex');
}

function parseJsonish(value) {
    if (value && typeof value === 'object') return value;
    const text = String(value || '').trim();
    if (!text) return {};
    try { return JSON.parse(text); } catch {}
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
        try { return JSON.parse(fenced[1].trim()); } catch {}
    }
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
        try { return JSON.parse(objectMatch[0]); } catch {}
    }
    return { analyst_note: text };
}

function normalizeBankrRiskAnalystResponse(value) {
    const parsed = parseJsonish(value);
    const confidence = String(parsed.confidence || '').trim().toUpperCase();
    const redFlags = Array.isArray(parsed.red_flags)
        ? parsed.red_flags.filter((flag) => typeof flag === 'string').map((flag) => flag.trim()).filter(Boolean).slice(0, 6)
        : (typeof parsed.red_flags === 'string' ? [parsed.red_flags.trim()].filter(Boolean) : []);

    return {
        trust_read: textOrDefault(parsed.trust_read, 'Trust read unavailable.'),
        market_read: textOrDefault(parsed.market_read, 'Market read unavailable.'),
        onchain_risk: textOrDefault(parsed.onchain_risk, 'Onchain risk unavailable.'),
        red_flags: redFlags,
        confidence: CONFIDENCE.has(confidence) ? confidence : 'LOW',
        analyst_note: textOrDefault(parsed.analyst_note, 'Bankr analyst note unavailable.'),
    };
}

function buildFallbackRiskSummary({ agent = {}, tokenMetrics = null, reason = 'analysis_unavailable' } = {}) {
    const score = numberOrNull(agent.cred_score ?? agent.credScore) ?? 0;
    const tier = scalar(agent.cred_tier ?? agent.credTier, 'UNKNOWN');
    const symbol = scalar(agent.token_symbol ?? agent.tokenSymbol, null);
    const marketCap = numberOrNull(agent.token_market_cap);
    const metricsStatus = scalar(tokenMetrics?.status, 'unavailable');
    const redFlags = [];

    if (!tokenMetrics || metricsStatus !== 'ok') redFlags.push('Token-level Blocktronics metrics unavailable');
    if (reason === 'bankr_unavailable') redFlags.push('Bankr analyst model unavailable');

    const confidence = redFlags.length ? 'LOW' : (score >= 76 ? 'HIGH' : 'MEDIUM');

    return {
        trust_read: `${scalar(agent.name, 'This agent')} is currently ${tier} with a CRED score of ${score}/100.`,
        market_read: symbol
            ? `${symbol} market data shows market cap ${marketCap === null ? 'unavailable' : `$${Math.round(marketCap).toLocaleString()}`}.`
            : 'No linked token market data is available for this agent.',
        onchain_risk: tokenMetrics && metricsStatus === 'ok'
            ? `Blocktronics reports ${numberOrNull(tokenMetrics.active_holders) ?? 'unknown'} active holders and ${scalar(tokenMetrics.avg_weekly_netflow_direction, 'unknown')} weekly netflow.`
            : 'Token-level Blocktronics metrics were unavailable for this scan.',
        red_flags: redFlags,
        confidence,
        analyst_note: 'Generated from deterministic CRED evidence because the Bankr analyst model was unavailable.',
    };
}

function buildSubject(agent = {}) {
    return {
        name: scalar(agent.name, 'Unknown Agent'),
        agent_id: scalar(agent.agent_id ?? agent.agentId, null),
        token_id: scalar(agent.token_id ?? agent.tokenId, null),
        chain_id: numberOrNull(agent.chain_id ?? agent.chainId),
        token_address: normalizeAddress(agent.token_address ?? agent.tokenAddress),
        token_symbol: scalar(agent.token_symbol ?? agent.tokenSymbol, null),
        cred_score: numberOrNull(agent.cred_score ?? agent.credScore) ?? 0,
        cred_tier: scalar(agent.cred_tier ?? agent.credTier, 'UNKNOWN'),
    };
}

function buildDeepCredReport({ agent, tokenMetrics = null, bankrSummary = null, model = 'bankr-router:auto', generatedAt = new Date().toISOString() } = {}) {
    if (!agent) throw new Error('agent is required');
    const evidence = buildDeepCredEvidence(agent, tokenMetrics);
    const normalizedSummary = bankrSummary
        ? normalizeBankrRiskAnalystResponse(bankrSummary)
        : buildFallbackRiskSummary({ agent, tokenMetrics });
    const evidenceHash = hashEvidence(evidence);

    return {
        kind: SOURCE_KIND,
        subject: buildSubject(agent),
        summary: normalizedSummary,
        evidence,
        guardrails: {
            score_mutated: false,
            not_financial_advice: true,
        },
        cache: {
            cached: true,
            generated_at: generatedAt,
            evidence_hash: evidenceHash,
        },
        model,
    };
}

function ensureDeepCredReportTables(db) {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS deep_cred_reports (
            subject_key TEXT PRIMARY KEY,
            agent_id TEXT,
            token_id TEXT,
            chain_id INTEGER,
            token_address TEXT,
            token_symbol TEXT,
            report_json TEXT NOT NULL,
            evidence_hash TEXT NOT NULL,
            model TEXT,
            generated_at TEXT NOT NULL,
            refreshed_at TEXT NOT NULL,
            paid_by TEXT,
            payment_ref TEXT
        )
    `).run();
}

function upsertDeepCredReport(db, report, payment = {}) {
    if (!report || report.kind !== SOURCE_KIND) throw new Error('Invalid Deep CRED report');
    const agent = report.subject || {};
    const subjectKey = buildSubjectKey({
        id: agent.id,
        agent_id: agent.agent_id,
        token_id: agent.token_id,
        chain_id: agent.chain_id,
        token_address: agent.token_address,
    });
    const generatedAt = report.cache?.generated_at || new Date().toISOString();
    const evidenceHash = report.cache?.evidence_hash || hashEvidence(report.evidence || {});
    ensureDeepCredReportTables(db);
    db.prepare(`
        INSERT INTO deep_cred_reports (
            subject_key, agent_id, token_id, chain_id, token_address, token_symbol,
            report_json, evidence_hash, model, generated_at, refreshed_at, paid_by, payment_ref
        ) VALUES (
            @subject_key, @agent_id, @token_id, @chain_id, @token_address, @token_symbol,
            @report_json, @evidence_hash, @model, @generated_at, @refreshed_at, @paid_by, @payment_ref
        ) ON CONFLICT(subject_key) DO UPDATE SET
            agent_id = excluded.agent_id,
            token_id = excluded.token_id,
            chain_id = excluded.chain_id,
            token_address = excluded.token_address,
            token_symbol = excluded.token_symbol,
            report_json = excluded.report_json,
            evidence_hash = excluded.evidence_hash,
            model = excluded.model,
            generated_at = excluded.generated_at,
            refreshed_at = excluded.refreshed_at,
            paid_by = excluded.paid_by,
            payment_ref = excluded.payment_ref
    `).run({
        subject_key: subjectKey,
        agent_id: agent.agent_id,
        token_id: agent.token_id,
        chain_id: agent.chain_id,
        token_address: agent.token_address,
        token_symbol: agent.token_symbol,
        report_json: JSON.stringify(report),
        evidence_hash: evidenceHash,
        model: report.model,
        generated_at: generatedAt,
        refreshed_at: new Date().toISOString(),
        paid_by: payment.paidBy || payment.paid_by || null,
        payment_ref: payment.paymentRef || payment.payment_ref || null,
    });
}

function readCachedDeepCredReport(db, agent) {
    ensureDeepCredReportTables(db);
    const subjectKey = buildSubjectKey(agent);
    const row = db.prepare('SELECT report_json, generated_at, evidence_hash, model FROM deep_cred_reports WHERE subject_key = ?').get(subjectKey);
    if (!row) return null;
    const report = JSON.parse(row.report_json);
    report.cache = {
        ...(report.cache || {}),
        cached: true,
        generated_at: row.generated_at,
        evidence_hash: row.evidence_hash,
    };
    if (row.model) report.model = row.model;
    return report;
}

module.exports = {
    SOURCE_KIND,
    buildSubjectKey,
    buildDeepCredEvidence,
    hashEvidence,
    normalizeBankrRiskAnalystResponse,
    buildFallbackRiskSummary,
    buildDeepCredReport,
    ensureDeepCredReportTables,
    upsertDeepCredReport,
    readCachedDeepCredReport,
};
