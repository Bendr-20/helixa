# Looper Wallet-Value Sorting Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded marketplace sorting by estimated ETH + liquid CRED + Pantheon-staked CRED value while keeping price ascending as the default.

**Architecture:** The API builds one dual-provider, pinned-block snapshot from the existing verified roster, fixed ETH/CRED quote sources, and Multicall3 batches. The web client verifies roster provenance, joins the snapshot into the existing marketplace model, and renders/sorts the same rows on list and detail views. All failures preserve the existing marketplace and disable only wallet-value sorting.

**Tech Stack:** Node.js ESM, viem, native Fetch/Response/Web Crypto, Node test runner, Vite, systemd/nginx production deployment.

**Source specification:** `docs/superpowers/specs/2026-10-12-looper-wallet-value-sort-design.md`

---

## File map

- Create `apps/api/src/looper-wallet-value-contract.js` — fixed identities, strict roster/quote parsing, e8 math, and response invariants.
- Create `apps/api/src/looper-wallet-values.js` — dual-provider pinned-block Multicall3 refresh, single-flight cache, and HTTP-ready loader result.
- Create `apps/api/test/looper-wallet-value-contract.test.mjs` — schema, quote identity, formula, and completeness tests.
- Create `apps/api/test/looper-wallet-values.test.mjs` — provider consensus, batching, capacity, cache, and failure tests.
- Modify `apps/api/src/index.js` — inject loader and expose the read-only endpoint.
- Modify `apps/api/src/server.js` — parse the roster path and compose the production loader.
- Modify `apps/api/test/server.test.mjs` — environment/config and route composition coverage.
- Modify `apps/api/test/looper-marketplace.test.mjs` — endpoint status/body/cache-header integration coverage.
- Modify `apps/web/src/looper-activated-roster.js` — preserve exact roster bytes and SHA-256 provenance for wallet-value matching.
- Create `apps/web/src/looper-wallet-values.js` — same-origin fetch, strict response normalization, and exact roster matching.
- Create `apps/web/test/looper-wallet-values.test.mjs` — browser contract and provenance tests.
- Modify `apps/web/src/looper-marketplace.js` — load/join wallet rows, add sorts, and render compact/detail balances.
- Modify `apps/web/src/app.js` — inject/load one wallet snapshot and remove detail-only RPC holdings reads.
- Modify `apps/web/src/style.css` — compact value block and responsive styles.
- Modify `apps/web/test/looper-marketplace.test.mjs` — sort/default/render/failure behavior.
- Modify `apps/web/test/mobile-layout.test.mjs` — narrow viewport overflow guard.

## Chunk 1: Server snapshot and endpoint

### Task 1: Lock the data contract and fixed-point valuation

**Files:**
- Create: `apps/api/src/looper-wallet-value-contract.js`
- Create: `apps/api/test/looper-wallet-value-contract.test.mjs`

- [ ] **Step 1: Write failing tests for the exact roster schema**

Cover exact keys, fixed chain/contract/implementation, canonical ordered unique token IDs, count equality, 256 KiB limit, 1,000-row maximum, and SHA-256 over exact bytes.

```js
assert.deepEqual(parseWalletValueRoster(bytes).tokenIds, ['1', '2245']);
assert.throws(() => parseWalletValueRoster(extraKeyBytes), /roster/i);
assert.throws(() => parseWalletValueRoster(duplicateBytes), /roster/i);
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `node --test apps/api/test/looper-wallet-value-contract.test.mjs`  
Expected: FAIL because the contract module does not exist.

- [ ] **Step 3: Implement strict roster parsing and fixed constants**

Export immutable constants plus:

```js
export function parseWalletValueRoster(rawBytes) {
  // enforce byte bound, exact keys, fixed identities, canonical token order
  return Object.freeze({ rawSha256, count, observedBlock, observedAt, tokenIds });
}
```

Do not duplicate address literals outside this module.

- [ ] **Step 4: Add failing quote-adapter and valuation tests**

Test Coinbase ETH identity, the pinned Dexscreener Base CRED/WETH pool, redirects/oversize/timeouts via injected fetch, liquidity floor, duplicate pinned pairs, decimal truncation to e8, uint256 limits, and inclusion of staked CRED exactly once.

```js
assert.equal(computeTotalUsdE8({
  ethWei: '1000000000000000000',
  liquidCredBaseUnits: '2000000000000000000',
  stakedCredBaseUnits: '3000000000000000000',
  ethPriceUsdE8: '250000000000',
  credPriceUsdE8: '110',
}), '250000000550');
```

- [ ] **Step 5: Implement bounded quote parsing and BigInt valuation**

Export `loadWalletValueQuotes`, `decimalToUsdE8`, `computeTotalUsdE8`, and `validateWalletValueSnapshot`. Use the repository's bounded-response helper. Never use floating point for price conversion, total calculation, or sorting.

- [ ] **Step 6: Run contract tests and verify GREEN**

Run: `node --test apps/api/test/looper-wallet-value-contract.test.mjs`  
Expected: PASS.

- [ ] **Step 7: Commit the contract unit**

```bash
git add apps/api/src/looper-wallet-value-contract.js apps/api/test/looper-wallet-value-contract.test.mjs
git commit -m "feat(api): define Looper wallet-value contract"
```

### Task 2: Build the dual-provider snapshot and bounded cache

**Files:**
- Create: `apps/api/src/looper-wallet-values.js`
- Create: `apps/api/test/looper-wallet-values.test.mjs`

- [ ] **Step 1: Write failing pinned-block consensus tests**

Cover lower-head selection, exact shared block hash, all calls at that block, post-read hash revalidation, one-provider failure, disagreement, reorg, malformed tuple count, matching per-row failure, and cross-provider row disagreement.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test apps/api/test/looper-wallet-values.test.mjs`  
Expected: FAIL because the snapshot loader does not exist.

- [ ] **Step 3: Implement single-request RPC and Multicall3 reader**

Use one JSON-RPC object per POST. Pack exactly three inner calls per Looper into `aggregate3` and cap each aggregate at 192 inner calls/64 rows. Schedule no more than two concurrent RPC requests per provider.

```js
export function createLooperWalletValueRefresher({
  rosterPath,
  fetchImpl = fetch,
  providers = PINNED_BASE_RPC_ORIGINS,
  now = Date.now,
} = {}) {
  return async function refresh({ signal } = {}) {
    // read exact roster bytes -> pin shared block -> dual Multicall3 -> quotes -> validate
  };
}
```

Rely on the roster generator's dual-provider successful `owner()` calls as deployment proof; do not add `eth_getCode` fan-out.

- [ ] **Step 4: Add the full 1,000-row capacity test**

Assert exactly 16 Multicall3 requests per provider, maximum observed concurrency of two, no JSON-RPC array bodies, response below 1 MiB, decoded fixture below 4 MiB, and deterministic completion before the injected 30-second deadline.

- [ ] **Step 5: Implement snapshot completeness and balance-only mode**

Require one row per roster token in identical order. Quote failure returns verified raw balances with `valuation_status: 'unavailable'` and null totals. Onchain refresh failure rejects the refresh.

- [ ] **Step 6: Add failing cache-boundary tests**

Cover cold-start coalescing, `age < 5m` fresh, `5m <= age < 15m` stale-while-refreshing, `age >= 15m` await-refresh/no expired serving, refresh failure, exact 503 body, and 60-second retry cooldown.

- [ ] **Step 7: Implement the process-local single-flight cache**

```js
export function createLooperWalletValuesLoader({ refresh, now = Date.now } = {}) {
  return async function load() {
    // return { statusCode, headers, body }; never expose expired snapshots
  };
}
```

Use a strong content ETag for fresh responses; stale responses use `no-cache`; unavailable responses use `no-store`.

- [ ] **Step 8: Run snapshot tests and verify GREEN**

Run: `node --test apps/api/test/looper-wallet-values.test.mjs`  
Expected: PASS, including the 1,000-row capacity fixture.

- [ ] **Step 9: Commit the snapshot unit**

```bash
git add apps/api/src/looper-wallet-values.js apps/api/test/looper-wallet-values.test.mjs
git commit -m "feat(api): cache Looper wallet-value snapshots"
```

### Task 3: Wire the API route and production configuration

**Files:**
- Modify: `apps/api/src/index.js:282-420,1503-1535`
- Modify: `apps/api/src/server.js:1-60,38-130,215-300,500-550`
- Modify: `apps/api/test/server.test.mjs`
- Modify: `apps/api/test/looper-marketplace.test.mjs`

- [ ] **Step 1: Write failing server-option and endpoint tests**

Require explicit `LOOPER_MARKETPLACE_ROSTER_PATH` parsing, dependency injection, GET success headers/body, HEAD parity, and exact 503 response when no loader/refresh fails.

- [ ] **Step 2: Run the focused integration tests and verify RED**

Run: `node --test apps/api/test/server.test.mjs apps/api/test/looper-marketplace.test.mjs`  
Expected: FAIL on the missing option/route.

- [ ] **Step 3: Compose the loader in `server.js`**

Parse the roster path without a permissive default in source. Construct the refresher/loader only when the path is configured. Preserve test injection through `options.looperMarketplaceWalletValuesLoader`.

- [ ] **Step 4: Add the read-only route in `index.js`**

At `/api/loopers/marketplace/wallet-values`, forward the loader's validated status, headers, and body. Return the exact schema-locked 503 if unavailable. Do not add authentication, writes, or `?api=` handling.

- [ ] **Step 5: Run API gates**

Run:

```bash
node --test apps/api/test/looper-wallet-value-contract.test.mjs \
  apps/api/test/looper-wallet-values.test.mjs \
  apps/api/test/looper-marketplace.test.mjs \
  apps/api/test/server.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit API wiring**

```bash
git add apps/api/src/index.js apps/api/src/server.js apps/api/test/server.test.mjs apps/api/test/looper-marketplace.test.mjs
git commit -m "feat(api): expose Looper wallet values"
```

## Chunk 2: Marketplace client and UI

### Task 4: Add same-origin wallet-value loading and roster provenance

**Files:**
- Modify: `apps/web/src/looper-activated-roster.js:46-110`
- Create: `apps/web/src/looper-wallet-values.js`
- Create: `apps/web/test/looper-wallet-values.test.mjs`

- [ ] **Step 1: Write failing exact-byte roster tests**

Require the daily roster loader to retain `rawSha256` computed with Web Crypto from the exact fetched bytes while preserving the current token-set result.

- [ ] **Step 2: Write failing wallet-response validation tests**

Cover exact keys, fixed identities, rows/count/order/completeness, canonical uints/addresses/timestamps, available and balance-only modes, 1 MiB response bound, and malformed/extra/duplicate rows.

- [ ] **Step 3: Verify RED**

Run: `node --test apps/web/test/looper-wallet-values.test.mjs`  
Expected: FAIL because the client module does not exist.

- [ ] **Step 4: Implement a same-origin-only loader**

```js
export async function loadLooperWalletValues({ fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl('/multipass-api/api/loopers/marketplace/wallet-values', {
    method: 'GET', credentials: 'omit', headers: { accept: 'application/json' }, signal,
  });
  // bounded parse + strict normalization
}
```

Do not call `getApiBaseFromLocation` and do not honor `?api=`.

- [ ] **Step 5: Implement provenance matching**

Export a pure join guard that requires wallet `roster.sha256` to equal the static roster hash and requires exact equality between live Blockscout and static token sets. Return an unavailable wallet state on mismatch or live discovery failure.

- [ ] **Step 6: Run client contract tests and verify GREEN**

Run: `node --test apps/web/test/looper-wallet-values.test.mjs`  
Expected: PASS.

- [ ] **Step 7: Commit the client contract**

```bash
git add apps/web/src/looper-activated-roster.js apps/web/src/looper-wallet-values.js apps/web/test/looper-wallet-values.test.mjs
git commit -m "feat(web): verify Looper wallet-value snapshots"
```

### Task 5: Join, sort, and render wallet values

**Files:**
- Modify: `apps/web/src/looper-marketplace.js:20-175,229-380`
- Modify: `apps/web/test/looper-marketplace.test.mjs`

- [ ] **Step 1: Write failing sorting tests**

Add `wallet-desc` and `wallet-asc` cases using `BigInt(totalUsdE8)`. Assert unavailable/null last in both directions and token ID ascending for ties. Assert initial state still uses `price-asc`.

- [ ] **Step 2: Write failing rendering tests**

Cards must show estimated total, ETH, liquid CRED, and only nonzero staked CRED. Detail must show all balances including zero staked CRED, pinned Base block, quote observation, and stale label. Balance-only mode shows raw balances but no USD estimate or wallet sort.

- [ ] **Step 3: Verify RED**

Run: `node --test apps/web/test/looper-marketplace.test.mjs`  
Expected: FAIL on missing wallet sorts/rendering.

- [ ] **Step 4: Extend the marketplace snapshot model**

Attach one validated wallet row to each item only after provenance verification. Add `walletValuesStatus`, `walletBlock`, `walletQuotes`, and stale metadata at snapshot level. Keep listings independent.

- [ ] **Step 5: Implement exact comparators and formatters**

Use `BigInt` only. Format display values without converting full balances/totals to `Number`. Keep unavailable rows last regardless of sort direction.

- [ ] **Step 6: Implement compact card and detail markup**

Add the two sort labels exactly as approved. Reuse the server row for detail; remove browser-derived detail wallet data from renderer inputs.

- [ ] **Step 7: Run marketplace tests and verify GREEN**

Run: `node --test apps/web/test/looper-marketplace.test.mjs`  
Expected: PASS.

- [ ] **Step 8: Commit marketplace behavior**

```bash
git add apps/web/src/looper-marketplace.js apps/web/test/looper-marketplace.test.mjs
git commit -m "feat(web): sort Loopers by wallet value"
```

### Task 6: Integrate app loading and responsive styling

**Files:**
- Modify: `apps/web/src/app.js:95,2880-2960`
- Modify: `apps/web/src/style.css`
- Modify: `apps/web/test/mobile-layout.test.mjs`
- Modify: `apps/web/test/looper-marketplace.test.mjs`

- [ ] **Step 1: Write failing app orchestration tests**

Assert one wallet snapshot request per marketplace refresh, no `loadLooperPublicHoldings` call on detail routes, cancellation with the existing request controller, and graceful listings/roster rendering when wallet values fail.

- [ ] **Step 2: Replace detail-only holdings loading**

Inject `marketplaceWalletValuesLoader = loadLooperWalletValues`. Load live activation, exact static roster, listings, and wallet values under the one existing marketplace timeout/controller, then join deterministically.

- [ ] **Step 3: Add bounded styles**

Add a compact two-line value block with wrapping numeric text. At existing mobile breakpoints, keep sort controls full-width and prevent addresses/balances from increasing viewport width.

- [ ] **Step 4: Run web tests and build**

Run:

```bash
node --test apps/web/test/looper-wallet-values.test.mjs \
  apps/web/test/looper-marketplace.test.mjs \
  apps/web/test/mobile-layout.test.mjs
pnpm web:build
```

Expected: all tests PASS and Vite build succeeds.

- [ ] **Step 5: Commit integration and styles**

```bash
git add apps/web/src/app.js apps/web/src/style.css apps/web/test/looper-marketplace.test.mjs apps/web/test/mobile-layout.test.mjs
git commit -m "feat(web): display Looper wallet balances"
```

## Chunk 3: Verification and release

### Task 7: Run complete gates and deploy in safe order

**Files:**
- Modify only if a test exposes a feature regression; do not broaden scope.
- Runtime config: `/etc/default/multipass-api` (preserve/merge; never replace whole file).
- Runtime artifact: `/var/www/helixa.xyz/multipass`.

- [ ] **Step 1: Run diff, focused tests, full API tests, and production build**

```bash
git diff --check
node --test apps/api/test/looper-wallet-value-contract.test.mjs apps/api/test/looper-wallet-values.test.mjs apps/api/test/looper-marketplace.test.mjs apps/api/test/server.test.mjs
node --test apps/web/test/looper-wallet-values.test.mjs apps/web/test/looper-marketplace.test.mjs apps/web/test/mobile-layout.test.mjs
pnpm --filter @helixa/multipass-api test
pnpm web:build
```

Expected: all applicable gates PASS. If the repository-wide historical `/tmp` fixture issue persists, record it separately; do not waive any feature-focused or API suite failure.

- [ ] **Step 2: Perform a security/contract inspection**

Confirm fixed quote/RPC hosts, redirects disabled, bounded bodies/timeouts, no arbitrary API override, no floats in valuation/sorting, exact roster/row matching, and no wallet mutation surface.

- [ ] **Step 3: Commit any gate-only fixes**

Use one narrowly scoped commit only if Step 1 or 2 required changes. Re-run every affected gate.

- [ ] **Step 4: Merge the runtime environment setting safely**

Inspect `/etc/default/multipass-api`, preserve all existing lines, and add/update exactly:

`LOOPER_MARKETPLACE_ROSTER_PATH=/var/www/helixa.xyz/multipass/data/looper-activated-roster.json`

Create a timestamped backup before editing. Do not change systemd unit contents.

- [ ] **Step 5: Deploy and warm the additive API first**

Back up the current API source/runtime state, install the verified source revision, restart `multipass-api.service`, and request the wallet-values endpoint. Require HTTP 200, exact roster count/hash, dual-provider block metadata, pinned quotes, response under 1 MiB, and fresh cache state. Check `systemctl is-active` and restart count.

- [ ] **Step 6: Deploy the web bundle second**

Back up the current web root, copy the verified `apps/web/dist` contents without deleting unrelated runtime data/routes, and verify the production asset hash appears in the live HTML.

- [ ] **Step 7: Run production smoke checks**

Verify:

- default remains Price: low to high;
- both wallet-value sorts order exact endpoint totals correctly;
- one known nonzero Pantheon position shows staked CRED;
- one zero position shows zero only on detail;
- card and detail use the same row/block/quote timestamp;
- roster hash and live/static sets match;
- unavailable/stale behavior does not break listings;
- desktop and mobile layouts have no horizontal overflow.

- [ ] **Step 8: Roll back narrowly on failure**

Roll back the web bundle first. If the additive endpoint itself is unhealthy, restore API source/runtime config and restart the service. Re-verify the original price-sorted marketplace.

- [ ] **Step 9: Push and verify the source branch**

Push the exact non-force `HEAD` to `feature/console-cred-staking-alpha-live` and require remote SHA equality. Report the commit, focused/full test counts, live endpoint status, cache/roster proof, and the marketplace link.
