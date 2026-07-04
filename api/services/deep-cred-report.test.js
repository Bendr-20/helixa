const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');

const deepCred = require('./deep-cred-report');

function makeDb() {
  return new Database(':memory:');
}

function sampleAgent(overrides = {}) {
  return {
    id: 42,
    address: '0x1111111111111111111111111111111111111111',
    agent_id: 'helixa-1',
    token_id: 'helixa-1',
    chain_id: 8453,
    name: 'Bendr 2.0',
    platform: 'helixa',
    x402_supported: 1,
    cred_score: 82,
    cred_tier: 'PRIME',
    verified: 1,
    token_address: '0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3',
    token_symbol: 'CRED',
    token_market_cap: 223000,
    price_change_24h: 12.5,
    volume_24h: 14700,
    liquidity_usd: 146414,
    total_feedbacks: 9,
    total_validations: 3,
    quality_score: 72,
    popularity_score: 64,
    activity_score: 80,
    x402_health: 'healthy',
    x402_uptime: 0.99,
    x402_endpoints: 2,
    trust_summary: 'Prime agent with meaningful trust signals.',
    ...overrides,
  };
}

function sampleMetrics(overrides = {}) {
  return {
    source: 'blocktronics_x402',
    status: 'ok',
    active_holders: 2735,
    avg_weekly_netflow_usd: 9100.34,
    avg_weekly_netflow_per_day_usd: 1300.05,
    avg_weekly_netflow_direction: 'outflow',
    holders_in_profit_pct: 39.28,
    holders_in_profit_count: 1233,
    holders_counted: 3139,
    as_of: '2026-06-26T13:10:44.715Z',
    fetched_at: '2026-06-26T13:11:00.000Z',
    window_days: 14,
    ...overrides,
  };
}

test('subject cache key prefers chain token, then agent id, token id, row id', () => {
  assert.equal(deepCred.buildSubjectKey(sampleAgent()), '8453:0xab3f23c2abcb4e12cc8b593c218a7ba64ed17ba3');
  assert.equal(deepCred.buildSubjectKey(sampleAgent({ token_address: null })), 'agent:helixa-1');
  assert.equal(deepCred.buildSubjectKey(sampleAgent({ token_address: null, agent_id: null })), 'token:helixa-1');
  assert.equal(deepCred.buildSubjectKey(sampleAgent({ token_address: null, agent_id: null, token_id: null })), 'row:42');
});

test('cached Deep CRED reports are stored and read for free by subject key', () => {
  const db = makeDb();
  try {
    deepCred.ensureDeepCredReportTables(db);
    const report = deepCred.buildDeepCredReport({
      agent: sampleAgent(),
      tokenMetrics: sampleMetrics(),
      bankrSummary: {
        trust_read: 'Strong CRED profile with verified signals.',
        market_read: 'Liquid enough for monitoring, not for blind trust.',
        onchain_risk: 'Holder flow is mixed and should be watched.',
        red_flags: ['Recent outflow'],
        confidence: 'HIGH',
        analyst_note: 'Use for routine counterparties with limits.',
      },
      model: 'bankr-router:auto',
      generatedAt: '2026-07-04T16:00:00.000Z',
    });

    deepCred.upsertDeepCredReport(db, report, { paidBy: '0xabc', paymentRef: '0xpaid' });
    const cached = deepCred.readCachedDeepCredReport(db, sampleAgent());

    assert.equal(cached.kind, 'bankr_risk_analyst');
    assert.equal(cached.subject.name, 'Bendr 2.0');
    assert.equal(cached.subject.cred_score, 82);
    assert.equal(cached.summary.confidence, 'HIGH');
    assert.equal(cached.cache.cached, true);
    assert.equal(cached.cache.generated_at, '2026-07-04T16:00:00.000Z');
    assert.equal(cached.guardrails.score_mutated, false);
  } finally {
    db.close();
  }
});

test('normalizes Bankr JSON and clamps unexpected confidence without mutating score', () => {
  const normalized = deepCred.normalizeBankrRiskAnalystResponse(JSON.stringify({
    trust_read: 'Cred score 99 now.',
    market_read: 'Market data is thin but present.',
    onchain_risk: 'Blocktronics shows launch risk mostly gone.',
    red_flags: ['Thin liquidity', 123, ''],
    confidence: 'certain',
    analyst_note: 'Do not treat this as financial advice.',
  }));

  assert.equal(normalized.trust_read, 'Cred score 99 now.');
  assert.equal(normalized.confidence, 'LOW');
  assert.deepEqual(normalized.red_flags, ['Thin liquidity']);

  const report = deepCred.buildDeepCredReport({
    agent: sampleAgent({ cred_score: 82 }),
    tokenMetrics: sampleMetrics(),
    bankrSummary: normalized,
    generatedAt: '2026-07-04T16:00:00.000Z',
  });
  assert.equal(report.subject.cred_score, 82);
  assert.equal(report.guardrails.score_mutated, false);
});

test('fallback summary is deterministic and lowers confidence when evidence is missing', () => {
  const summary = deepCred.buildFallbackRiskSummary({
    agent: sampleAgent({ token_address: null, token_symbol: null, token_market_cap: null }),
    tokenMetrics: null,
    reason: 'bankr_unavailable',
  });

  assert.equal(summary.confidence, 'LOW');
  assert.match(summary.trust_read, /PRIME/);
  assert.match(summary.onchain_risk, /Blocktronics/i);
  assert.deepEqual(summary.red_flags, ['Token-level Blocktronics metrics unavailable', 'Bankr analyst model unavailable']);
});

test('evidence hash changes when material market evidence changes', () => {
  const base = deepCred.buildDeepCredEvidence(sampleAgent(), sampleMetrics());
  const changed = deepCred.buildDeepCredEvidence(sampleAgent({ token_market_cap: 300000 }), sampleMetrics());
  assert.notEqual(deepCred.hashEvidence(base), deepCred.hashEvidence(changed));
});
