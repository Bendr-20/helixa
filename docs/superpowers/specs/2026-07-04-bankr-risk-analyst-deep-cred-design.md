# Bankr Risk Analyst inside Deep CRED Report - Design

Date: 2026-07-04
Repo: `/home/ubuntu/.openclaw/workspace/agentdna`
Related frontend repo: `/home/ubuntu/cred-exchange`

## Goal

Add a paid Deep Scan layer to the existing free CRED report experience.

The free report remains a fast CRED summary. Deep Scan adds a `BANKR RISK ANALYST` section that translates Helixa CRED data, market data, and Blocktronics onchain token metrics into a concise analyst brief.

## Product decisions

- Normal CRED report stays free.
- Deep Scan generation/refresh costs `$0.15`.
- Cached Deep Scan reports are readable for free, so future viewers do not keep paying for the same report.
- Bankr LLM explains evidence, but never directly changes the CRED score.
- Blocktronics is evidence input only. If unavailable, the report should degrade gracefully and lower confidence.
- No emojis or lucide icon additions in user-facing frontend changes.

## Current state observed

### `agentdna` API

- `api/v2-server.js` already exposes terminal endpoints:
  - `GET /api/terminal/agents`
  - `GET /api/terminal/agent/:address`
  - `GET /api/terminal/token-metrics/:token`
- `GET /api/terminal/agent/:address` attaches cached Blocktronics metrics with `blocktronicsTokenMetrics.attachCachedTokenMetrics(...)`.
- `api/services/blocktronics-token-metrics.js` supports:
  - covered-token validation
  - cache table setup
  - cached metric reads
  - refresh candidate selection
  - live Blocktronics fetch/normalization
- `api/scripts/refresh-blocktronics-token-metrics.js` exists for refresh workflows.
- `api/services/bankr-router.js` exists and is already used by trust evaluation.
- `api/services/payments.js` has x402 route helpers and a current `PRICING.credReport = 0.01`, but the old `/cred-report` frontend still says full report is free.
- `api/v2-server.js` also has an older paid `GET /api/v2/agent/:id/cred-report` path with embedded Bankr LLM logic. Do not extend that path as the primary CRED Exchange scanner path.

### `cred-exchange` frontend

- Static `index.html`, no React bundle.
- Report modal is already in `index.html`:
  - `runCredReport(...)`
  - `renderBlocktronicsWidget(...)`
  - `appendReportActions(...)`
- Search/analyze uses `https://api.helixa.xyz` terminal endpoints.
- Blocktronics metrics already render in the free modal when cached.
- Existing static checks assert the modal/report functions and Blocktronics copy.

## Considered approaches

### Option A - Extend old `frontend-v2/src/pages/CredReport.tsx` only

Pros:
- React app already has wallet-related dependencies.
- Easier to make a polished wallet payment UX later.

Cons:
- Not the live CRED Exchange scanner users are using.
- Would leave `cred.exchange` unchanged.
- Duplicates report experiences.

Verdict: not enough.

### Option B - Put everything into `cred-exchange/index.html`

Pros:
- Directly touches the live CRED Exchange scanner.
- Minimal deployment surface for the UI.

Cons:
- Static page has no payment client/bundler.
- Browser-side x402 signing from a static file is risky to rush.
- Backend still needs to own Bankr, Blocktronics refresh, caching, and schema validation.

Verdict: UI-only is wrong.

### Option C - Backend-owned Deep Scan, static UI consumes it

Pros:
- Correct trust boundary: backend owns payment verification, Blocktronics refresh, Bankr prompt/schema, caching, and rate limiting.
- Static `cred.exchange` can safely render cached reports and call a paid generation endpoint.
- Cached reads are free by design.
- Allows later wallet/x402 UX improvements without changing the core report engine.

Cons:
- Requires both `agentdna` API and `cred-exchange` static UI changes.
- First pass may rely on existing x402/TX-hash compatibility instead of a fully polished browser checkout.

Verdict: recommended.

## Recommended design

Implement Option C.

### API endpoints

Add terminal Deep CRED endpoints to `api/v2-server.js`:

1. `GET /api/terminal/agent/:id/deep-cred-report`
   - Free read path.
   - Resolves the same identifiers as `GET /api/terminal/agent/:id`.
   - Returns cached `BANKR RISK ANALYST` report if present.
   - If no cache exists, returns `404` or `402-style` JSON telling the caller a paid Deep Scan is required.
   - Does not generate a report.

2. `POST /api/terminal/agent/:id/deep-cred-report`
   - Paid generation/refresh path.
   - Price: `$0.15` USDC on Base.
   - Accepts existing x402 payment flow and existing TX-hash fallback headers where possible.
   - After payment verification:
     - resolve the terminal agent
     - refresh Blocktronics metrics if token is covered and stale/missing
     - collect CRED, market, x402, reputation, and Blocktronics evidence
     - call Bankr Router/Bankr LLM
     - validate and normalize response into strict JSON
     - cache report
     - return report

### Cache

Create a terminal DB table, not a loose JSON file:

```sql
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
);
```

Cache key preference:

1. `chain_id:token_address` when token address exists
2. `agent_id`
3. `token_id`
4. fallback terminal row id

Freshness behavior:

- Cached report is readable for free.
- UI shows `generated_at` and `evidence_age`.
- Paid POST may refresh/regenerate when the user explicitly asks.
- If data changed materially, the backend can mark cache as stale in response metadata, but still return the cached report instead of forcing every viewer to pay.

### Report schema

Return a predictable object:

```json
{
  "kind": "bankr_risk_analyst",
  "subject": {
    "name": "Bendr 2.0",
    "agent_id": "helixa-1",
    "chain_id": 8453,
    "token_address": "0x...",
    "token_symbol": "CRED",
    "cred_score": 80,
    "cred_tier": "PRIME"
  },
  "summary": {
    "trust_read": "...",
    "market_read": "...",
    "onchain_risk": "...",
    "red_flags": ["..."],
    "confidence": "HIGH",
    "analyst_note": "..."
  },
  "evidence": {
    "cred": {},
    "market": {},
    "blocktronics": {},
    "x402": {},
    "reputation": {}
  },
  "guardrails": {
    "score_mutated": false,
    "not_financial_advice": true
  },
  "cache": {
    "cached": true,
    "generated_at": "...",
    "evidence_hash": "..."
  },
  "model": "bankr-router:auto"
}
```

### Prompt contract

Bankr prompt should be strict:

- You are a risk analyst, not a score calculator.
- Do not change or recommend changes to the CRED score.
- Explain evidence in plain English.
- Be concise and skeptical.
- If evidence is missing, lower confidence instead of inventing facts.
- Return JSON only.

Required output fields:

- `trust_read`
- `market_read`
- `onchain_risk`
- `red_flags`
- `confidence`: `HIGH | MEDIUM | LOW`
- `analyst_note`

### Blocktronics behavior

When a token is present and covered:

- Read cached token metrics.
- If missing/stale/preparing, attempt one refresh using `fetchBlocktronicsTokenMetrics(...)` and `upsertTokenMetricsCache(...)`.
- If refresh fails, continue with cached/preparing/unavailable status and lower confidence.

When token is absent or not covered:

- Generate the report without Blocktronics metrics.
- `onchain_risk` should explicitly say token-level Blocktronics metrics were unavailable.
- Confidence should usually be `MEDIUM` or `LOW`, depending on remaining evidence.

### Frontend behavior: `cred.exchange`

Update the existing report modal in `/home/ubuntu/cred-exchange/index.html`:

- Keep the existing free report output.
- Add `[ DEEP SCAN $0.15 ]` to `appendReportActions(...)`.
- On click:
  1. call `GET /api/terminal/agent/:id/deep-cred-report`
  2. if cached report exists, render `BANKR RISK ANALYST`
  3. if no cache, show paid generation instructions and trigger paid POST flow
- Render section:

```text
BANKR RISK ANALYST
────────────────────────────────────────
TRUST READ: ...
MARKET READ: ...
ONCHAIN RISK: ...
RED FLAGS: ...
CONFIDENCE: HIGH/MEDIUM/LOW
ANALYST NOTE: ...
```

Payment UX for first pass:

- Use backend x402/TX-hash compatibility.
- If browser x402 signing is not practical in the static app, show a clear payment panel rather than faking payment.
- Do not block cached report viewing behind wallet connection.

### Frontend behavior: `agentdna/frontend-v2`

Minimum cleanup:

- Update `CredReport.tsx` stale text so it no longer says the full detailed report is simply free if the backend says it is paid.
- Prefer copy like: normal report free; Deep Scan is paid when uncached.

Avoid broad redesign of `Report.tsx` in this pass. It uses `lucide-react`, but that is existing code. Do not add new icons.

## Failure modes

- Bankr unavailable: return report with deterministic fallback fields from evidence and `confidence: LOW`; do not fail the paid request after taking payment if avoidable.
- Blocktronics unavailable: continue and state unavailable evidence.
- Invalid LLM JSON: attempt JSON extraction once, then fallback to deterministic summary.
- Duplicate payment tx: respect existing used-payment protection.
- Unknown agent/token: no payment should be consumed if agent resolution fails before generation.

## Tests and verification

### API unit tests

Add/extend tests for:

- cache key generation
- report schema validation
- Bankr response normalization
- fallback summary when Bankr fails
- Blocktronics unavailable/stale/preparing branches
- CRED score is not mutated
- cached GET is free
- uncached POST requires payment

### Static frontend checks

Extend `/home/ubuntu/cred-exchange/scripts/check-static.js` to assert:

- `[ DEEP SCAN $0.15 ]`
- `BANKR RISK ANALYST`
- `GET /api/terminal/agent/` deep report path
- no emojis
- existing Blocktronics widget still present

### Live-ish checks

After implementation:

- API GET cached path for known cached report
- API paid POST path with mocked payment in tests, not live spend
- CRED Exchange modal renders free report then deep report section
- Existing `npm test`/static checks pass in `cred-exchange`
- Existing relevant `agentdna` API tests pass

## Open implementation question

The only remaining product/UX choice is how polished the first browser payment flow must be:

1. Ship backend x402 + cached UI first, with static-page payment instructions for uncached scans.
2. Add full wallet/x402 signing in the static CRED Exchange page now.
3. Route paid generation through a Bankr-hosted x402 payment URL if Bankr route setup exists.

Recommendation: ship option 1 first. It is honest, low-risk, and gets the analyst engine live without overbuilding the static payment layer.
