# Looper Wallet-Value Sorting Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded marketplace sorting by estimated ETH + liquid CRED + Pantheon-staked CRED value while keeping price ascending as the default.

**Architecture:** The API builds one dual-provider, pinned-block snapshot from the existing verified roster, fixed ETH/CRED quote sources, and Multicall3 batches. The web client verifies roster provenance, joins the snapshot into the existing marketplace model, and renders/sorts the same rows on list and detail views. All failures preserve the existing marketplace and disable only wallet-value sorting.

**Tech Stack:** Node.js ESM, viem, native Fetch/Response/Web Crypto, Node test runner, Vite, systemd/nginx production deployment.

**Source specification:** `docs/superpowers/specs/2026-10-12-looper-wallet-value-sort-design.md`

---

## File map

- Create `apps/api/src/bounded-io.js` — bounded streaming HTTP-body and file-byte readers for API data sources.
- Create `apps/api/test/bounded-io.test.mjs` — body/file limits, aborts, and atomic-rename behavior.
- Create `apps/api/src/looper-wallet-value-contract.js` — fixed identities, strict roster/quote parsing, e8 math, and response invariants.
- Create `apps/api/src/looper-wallet-values.js` — dual-provider pinned-block Multicall3 refresh, single-flight cache, and HTTP-ready loader result.
- Create `apps/api/test/looper-wallet-value-contract.test.mjs` — schema, quote identity, formula, and completeness tests.
- Create `apps/api/test/looper-wallet-values.test.mjs` — provider consensus, batching, capacity, cache, and failure tests.
- Modify `apps/api/src/index.js` — inject loader and expose the read-only endpoint.
- Modify `apps/api/src/server.js` — parse the roster path and compose the production loader.
- Modify `apps/api/test/server.test.mjs` — environment/config and route composition coverage.
- Modify `apps/api/test/looper-marketplace.test.mjs` — endpoint status/body/cache-header integration coverage.
- Modify `apps/web/src/bounded-response-body.js` — expose bounded bytes before UTF-8 decoding.
- Create `apps/web/test/bounded-response-body.test.mjs` — byte/text bounds and abort behavior.
- Modify `apps/web/src/looper-activated-roster.js` — preserve exact roster bytes and SHA-256 provenance for wallet-value matching.
- Create `apps/web/src/looper-wallet-values.js` — same-origin fetch, strict response normalization, and exact roster matching.
- Create `apps/web/test/looper-wallet-values.test.mjs` — browser contract and provenance tests.
- Modify `apps/web/src/looper-marketplace.js` — load/join wallet rows, add sorts, and render compact/detail balances.
- Modify `apps/web/src/app.js` — inject/load one wallet snapshot and remove detail-only RPC holdings reads.
- Modify `apps/web/src/styles.css` — compact value block and responsive styles.
- Modify `apps/web/test/looper-marketplace.test.mjs` — sort/default/render/failure behavior.
- Modify `apps/web/test/app.test.mjs` — four-source request orchestration and cancellation.
- Modify `apps/web/test/mobile-layout.test.mjs` — narrow viewport overflow guard.

## Chunk 1: Server snapshot and endpoint

### Task 1: Lock the data contract and fixed-point valuation

**Files:**
- Create: `apps/api/src/bounded-io.js`
- Create: `apps/api/test/bounded-io.test.mjs`
- Create: `apps/api/src/looper-wallet-value-contract.js`
- Create: `apps/api/test/looper-wallet-value-contract.test.mjs`

- [ ] **Step 1: Write failing tests for the exact roster schema**

First cover `readBoundedResponseBytes` and `readBoundedFileBytes`: early content-length rejection, stream overflow, abort/cancel, file overflow after exactly `limit + 1` bytes, and a fixture renamed while its already-open file handle is read consistently. Then cover roster exact keys, fixed chain/contract/implementation using case-insensitive address equality, canonical ordered unique token IDs, count equality, 256 KiB limit, 1,000-row maximum, and SHA-256 over exact bytes.

```js
assert.deepEqual(parseWalletValueRoster(bytes).tokenIds, ['1', '2245']);
assert.throws(() => parseWalletValueRoster(extraKeyBytes), /roster/i);
assert.throws(() => parseWalletValueRoster(duplicateBytes), /roster/i);
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `node --test apps/api/test/bounded-io.test.mjs apps/api/test/looper-wallet-value-contract.test.mjs`
Expected: FAIL because the contract module does not exist.

- [ ] **Step 3: Implement strict roster parsing and fixed constants**

Implement `apps/api/src/bounded-io.js` with stream readers that never buffer more than `maxBytes + 1`, and use an opened file handle with a bounded read loop rather than `readFile()`. Export immutable contract constants plus:

```js
export function parseWalletValueRoster(rawBytes) {
  // enforce byte bound, exact keys, fixed identities, canonical token order
  return Object.freeze({ rawSha256, count, observedBlock, observedAt, tokenIds });
}
```

Do not duplicate address literals outside this module.

- [ ] **Step 4: Add failing quote-adapter and valuation tests**

Test exact HTTPS host/path allowlists, Coinbase ETH identity, the pinned Dexscreener Base CRED/WETH pool, redirects/oversize/timeouts via injected fetch, quote observation age <= 60 seconds and cross-source skew <= 10 seconds, liquidity floor, duplicate pinned pairs, decimal truncation to e8, uint256 limits, case-insensitive fixed-address input validation, checksummed response accounts, the exact nine-field Pantheon `stakes` ABI names/types, and inclusion of `amount` exactly once.

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

Export `loadWalletValueQuotes`, `decimalToUsdE8`, `computeTotalUsdE8`, and `validateWalletValueSnapshot`. Use the new API bounded-byte helper. Never use floating point for price conversion, total calculation, or sorting.

- [ ] **Step 6: Run contract tests and verify GREEN**

Run: `node --test apps/api/test/bounded-io.test.mjs apps/api/test/looper-wallet-value-contract.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit the contract unit**

```bash
git add apps/api/src/bounded-io.js apps/api/test/bounded-io.test.mjs apps/api/src/looper-wallet-value-contract.js apps/api/test/looper-wallet-value-contract.test.mjs
git commit -m "feat(api): define Looper wallet-value contract"
```

### Task 2: Build the dual-provider snapshot and bounded cache

**Files:**
- Create: `apps/api/src/looper-wallet-values.js`
- Create: `apps/api/test/looper-wallet-values.test.mjs`

- [ ] **Step 1: Write failing pinned-block and full-capacity tests**

Before implementation, cover lower-head selection, exact shared block hash, all calls at that block, post-read hash revalidation, one-provider failure, disagreement, reorg, malformed tuple count, matching per-row failure, and cross-provider row disagreement. Add the full 1,000-row fixture and require:

- exactly 16 Multicall3 requests per provider;
- one JSON-RPC object per POST, never an array;
- maximum observed concurrency of two per provider;
- rejection at decoded data above 4 MiB;
- rejection at serialized response above 1 MiB;
- per-request abort at 8,000 ms;
- whole-refresh abort at 30,000 ms.

Use injected clocks/signals so timeout tests are deterministic rather than sleeping.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test apps/api/test/looper-wallet-values.test.mjs`
Expected: FAIL because the snapshot loader does not exist.

- [ ] **Step 3: Implement single-request RPC and Multicall3 reading**

Use one JSON-RPC object per POST. Pack exactly three inner calls per Looper into `aggregate3` and cap each aggregate at 192 inner calls/64 rows. Schedule no more than two concurrent RPC requests per provider. Apply the 8-second request and 30-second refresh aborts, and count bytes before retaining decoded/serialized data.

```js
export function createLooperWalletValueRefresher({
  rosterPath,
  fetchImpl = fetch,
  providers = PINNED_BASE_RPC_ORIGINS,
  now = Date.now,
  requestTimeoutMs = 8_000,
  refreshTimeoutMs = 30_000,
} = {}) {
  return async function refresh({ signal } = {}) {
    // bounded roster bytes -> shared block -> dual Multicall3 -> quotes -> validate
  };
}
```

Rely on the roster generator's dual-provider successful `owner()` calls as deployment proof; do not add `eth_getCode` fan-out. Normalize every derived account through `getAddress` before serialization.

- [ ] **Step 4: Implement snapshot completeness and balance-only mode**

Require one row per roster token in identical order and enforce the 4 MiB decoded/1 MiB serialized caps. Quote failure returns verified raw balances with `valuation_status: 'unavailable'` and null totals. Onchain refresh failure rejects the refresh.

- [ ] **Step 5: Run the snapshot-capacity tests and verify GREEN**

Run: `node --test --test-name-pattern='pinned|provider|capacity|timeout|size|complete' apps/api/test/looper-wallet-values.test.mjs`
Expected: PASS, including the full 1,000-row fixture and every enforced failure boundary.

- [ ] **Step 6: Write failing cache and byte-response tests**

Cover cold-start coalescing, `age < 5m` fresh, `5m <= age < 15m` stale-while-refreshing, `age >= 15m` await-refresh/no expired serving, refresh failure, exact 503 bytes, and 60-second retry cooldown. Define the loader result as:

```js
{
  status: 200,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': '...', etag: '"..."' },
  bodyBytes: Uint8Array,
}
```

The strong ETag is SHA-256 over the exact `bodyBytes`. The 503 body bytes decode exactly to the design's error object and contain no `schema_version`.

- [ ] **Step 7: Implement the process-local single-flight cache**

```js
export function createLooperWalletValuesLoader({ refresh, now = Date.now } = {}) {
  return async function load() {
    // return status + headers + exact serialized bytes; never expose expired snapshots
  };
}
```

Serialize once, validate the 1 MiB cap, compute the ETag from those bytes, and retain those same bytes. Fresh responses use `public, max-age=30`; stale responses use `no-cache`; unavailable responses use `no-store`.

- [ ] **Step 8: Run all snapshot tests and verify GREEN**

Run: `node --test apps/api/test/looper-wallet-values.test.mjs`
Expected: PASS.

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

Require explicit `LOOPER_MARKETPLACE_ROSTER_PATH` parsing, dependency injection, GET success with exact content-type/cache/ETag headers and exact response bytes, and the exact 503 bytes when no loader exists or refresh fails. Assert HEAD remains rejected by the existing global 405 gate; this feature adds GET only.

- [ ] **Step 2: Run the focused integration tests and verify RED**

Run: `node --test apps/api/test/server.test.mjs apps/api/test/looper-marketplace.test.mjs`
Expected: FAIL on the missing option/route.

- [ ] **Step 3: Compose the loader in `server.js`**

Parse the roster path without a permissive default in source. Construct the refresher/loader only when the path is configured. Preserve test injection through `options.looperMarketplaceWalletValuesLoader`.

- [ ] **Step 4: Add the read-only route in `index.js`**

At `/api/loopers/marketplace/wallet-values`, construct `new Response(result.bodyBytes, { status: result.status, headers: result.headers })` directly. Do not pass it through `jsonResponse` or `errorResponse`, because either would serialize again and `errorResponse` would add `schema_version`. Do not add authentication, writes, HEAD support, or `?api=` handling.

- [ ] **Step 5: Run API gates**

Run:

```bash
node --test apps/api/test/bounded-io.test.mjs \
  apps/api/test/looper-wallet-value-contract.test.mjs \
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
- Modify: `apps/web/src/bounded-response-body.js`
- Create: `apps/web/test/bounded-response-body.test.mjs`
- Modify: `apps/web/src/looper-activated-roster.js:46-110`
- Create: `apps/web/src/looper-wallet-values.js`
- Create: `apps/web/test/looper-wallet-values.test.mjs`

- [ ] **Step 1: Write failing exact-byte roster tests**

First add failing tests for `readBoundedResponseBytes`, and refactor `readBoundedResponseBody` to decode that shared byte result. Require the daily roster loader to hash those exact bytes with Web Crypto before UTF-8 decoding, retain `rawSha256`, and preserve the current token-set result. Include malformed UTF-8/oversize/abort cases so hashing can never occur over re-encoded text.

- [ ] **Step 2: Write failing wallet-response validation tests**

Cover exact keys, fixed identities, rows/count/order/completeness, canonical uints/addresses/timestamps, available and balance-only modes, 1 MiB response bound, and malformed/extra/duplicate rows.

- [ ] **Step 3: Verify RED**

Run: `node --test apps/web/test/bounded-response-body.test.mjs apps/web/test/looper-wallet-values.test.mjs`
Expected: FAIL because the byte API/client module does not exist.

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

Run: `node --test apps/web/test/bounded-response-body.test.mjs apps/web/test/looper-wallet-values.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit the client contract**

```bash
git add apps/web/src/bounded-response-body.js apps/web/test/bounded-response-body.test.mjs apps/web/src/looper-activated-roster.js apps/web/src/looper-wallet-values.js apps/web/test/looper-wallet-values.test.mjs
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

Add the two sort labels exactly as approved. Reuse the server row for detail and remove browser-derived detail wallet data from renderer inputs. Because the server row intentionally has no NFT holder, remove the current-holder link and holder-specific ownership facts from this marketplace detail surface; retain Multipass ID, activated agent-wallet address/link, verification block, and public-read-only access copy. Do not fabricate or stale-cache a holder.

- [ ] **Step 7: Run marketplace tests and verify GREEN**

Run: `node --test apps/web/test/looper-marketplace.test.mjs`
Expected: PASS.

- [ ] **Step 8: Commit marketplace behavior**

```bash
git add apps/web/src/looper-marketplace.js apps/web/test/looper-marketplace.test.mjs
git commit -m "feat(web): sort Loopers by wallet value"
```

### Task 6: Integrate four-source loading and responsive styling

**Files:**
- Modify: `apps/web/src/looper-marketplace.js:45-145`
- Modify: `apps/web/src/app.js:95,2880-2960`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/test/app.test.mjs`
- Modify: `apps/web/test/looper-marketplace.test.mjs`
- Modify: `apps/web/test/mobile-layout.test.mjs`

- [ ] **Step 1: Write failing four-source orchestration tests**

In `apps/web/test/app.test.mjs` and marketplace tests, assert exactly one call each per refresh to:

1. live Blockscout activation;
2. exact static daily roster;
3. listings;
4. wallet values.

Require all four to settle under the same AbortController and marketplace timeout. Test cancellation/stale-request suppression. Prove static fallback still renders the marketplace when live discovery fails, but wallet rows/sorts remain disabled. Prove live/static/hash mismatch also disables wallet rows without hiding listings.

- [ ] **Step 2: Verify orchestration RED**

Run: `node --test apps/web/test/app.test.mjs apps/web/test/looper-marketplace.test.mjs`
Expected: FAIL because the current snapshot loader fetches only live activation/listings concurrently and performs static fallback later.

- [ ] **Step 3: Refactor `loadLooperMarketplaceSnapshot`**

Add explicit `activationFallbackLoader` and `walletValuesLoader` parameters and start all four promises before awaiting. Keep the timeout active until all four settle. Build the display activation from live discovery when available, otherwise the static roster. Attach wallet rows only when live discovery is available, the live/static token sets are exactly equal, and the wallet roster hash equals the exact static-byte hash.

- [ ] **Step 4: Replace detail-only holdings loading in `app.js`**

Inject `marketplaceWalletValuesLoader = loadLooperWalletValues`. Remove the detail-route call to `marketplaceHoldingsLoader/loadLooperPublicHoldings` from this surface and pass only the joined server row to rendering.

- [ ] **Step 5: Write and implement deterministic control transitions**

Add tests proving that when a selected wallet sort later becomes unavailable, state changes deterministically to `price-asc`, wallet sort options render disabled, and list/detail content remains usable. Implement this in the marketplace refresh/state normalization path rather than only in markup.

- [ ] **Step 6: Add bounded styles**

Add a compact two-line value block to `apps/web/src/styles.css` with wrapping numeric text. At existing mobile breakpoints, keep sort controls full-width and prevent addresses/balances from increasing viewport width.

- [ ] **Step 7: Run web tests and build**

Run:

```bash
node --test apps/web/test/bounded-response-body.test.mjs \
  apps/web/test/looper-wallet-values.test.mjs \
  apps/web/test/looper-marketplace.test.mjs \
  apps/web/test/app.test.mjs \
  apps/web/test/mobile-layout.test.mjs
pnpm web:build
```

Expected: all tests PASS and Vite build succeeds.

- [ ] **Step 8: Commit integration and styles**

```bash
git add apps/web/src/looper-marketplace.js apps/web/src/app.js apps/web/src/styles.css apps/web/test/app.test.mjs apps/web/test/looper-marketplace.test.mjs apps/web/test/mobile-layout.test.mjs
git commit -m "feat(web): display Looper wallet balances"
```

## Chunk 3: Verification and release

### Task 7: Run complete gates, publish the revision, and deploy safely

**Source checkout:** `/home/ubuntu/releases/multipass-1941620713f91c2d7ad1bb3e81fa17627cd8890b`
**API runtime checkout:** `/home/ubuntu/multipass`
**API service:** `multipass-api.service`, observed `WorkingDirectory=/home/ubuntu/multipass` and `ExecStart=/usr/bin/node apps/api/src/server.js`
**Environment file:** `/etc/default/multipass-api`
**Web root:** `/var/www/helixa.xyz/multipass`
**Public wallet endpoint:** `https://helixa.xyz/multipass-api/api/loopers/marketplace/wallet-values`

- [ ] **Step 1: Run source gates**

From the source checkout:

```bash
set -euo pipefail
git diff --check
node --test apps/api/test/bounded-io.test.mjs apps/api/test/looper-wallet-value-contract.test.mjs apps/api/test/looper-wallet-values.test.mjs apps/api/test/looper-marketplace.test.mjs apps/api/test/server.test.mjs
node --test apps/web/test/bounded-response-body.test.mjs apps/web/test/looper-wallet-values.test.mjs apps/web/test/looper-marketplace.test.mjs apps/web/test/app.test.mjs apps/web/test/mobile-layout.test.mjs
node --test apps/api/test/*.test.mjs
pnpm web:build
```

Expected: all feature gates and every API test pass; Vite build succeeds. Do not use `pnpm --filter @helixa/multipass-api test` because that package has no test script. If the repository-wide historical `/tmp` fixture issue appears outside the API suite, record it separately; do not waive any listed gate.

- [ ] **Step 2: Inspect the security and data contract**

Confirm fixed quote/RPC hosts, `redirect: 'error'`, bounded body/file reads, 8/30-second aborts, no arbitrary API override, no floats in valuation/sorting, exact roster/row matching, checksummed accounts, exact Pantheon tuple decoding, and no wallet mutation surface.

- [ ] **Step 3: Commit any gate-only corrections and re-run affected gates**

Use one narrowly scoped commit only if Steps 1–2 required changes. End with a clean worktree.

- [ ] **Step 4: Push and verify the exact source revision before production mutation**

Use the repository's `github-push-recovery` procedure so credentials remain opaque. Perform a non-force update equivalent to:

```bash
git push <authorized-transport> HEAD:refs/heads/feature/console-cred-staking-alpha-live
local_sha=$(git rev-parse HEAD)
remote_sha=$(git ls-remote <same-authorized-transport> refs/heads/feature/console-cred-staking-alpha-live | cut -f1)
test "$local_sha" = "$remote_sha"
```

Record `release_sha=$local_sha`. Do not deploy unless remote equality passes.

- [ ] **Step 5: Run production preflight and create recoverable backups**

```bash
set -euo pipefail
src=/home/ubuntu/releases/multipass-1941620713f91c2d7ad1bb3e81fa17627cd8890b
api_live=/home/ubuntu/multipass
web_live=/var/www/helixa.xyz/multipass
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup=/home/ubuntu/backups/multipass-wallet-values-$stamp
mkdir -p "$backup/web"

test "$(systemctl show multipass-api.service -p WorkingDirectory --value)" = "$api_live"
systemctl show multipass-api.service -p ExecStart --value | grep -Fq '/usr/bin/node apps/api/src/server.js'
systemctl show multipass-api.service -p EnvironmentFiles --value | grep -Fq '/etc/default/multipass-api'
test "$(systemctl is-active multipass-api.service)" = active
restart_baseline=$(systemctl show multipass-api.service -p NRestarts --value)
release_sha=$(git -C "$src" rev-parse HEAD)
state=/tmp/multipass-wallet-values-deploy-state
printf 'src=%q\napi_live=%q\nweb_live=%q\nbackup=%q\nrelease_sha=%q\nrestart_baseline=%q\n' \
  "$src" "$api_live" "$web_live" "$backup" "$release_sha" "$restart_baseline" > "$state"
chmod 600 "$state"

tar -C "$api_live" -czf "$backup/api-src.tgz" apps/api/src
sudo cp --preserve=mode,ownership,timestamps /etc/default/multipass-api "$backup/multipass-api.env"
rsync -a "$web_live/" "$backup/web/"
sha256sum "$web_live/data/looper-activated-roster.json" > "$backup/roster.sha256"
printf '%s\n' "$release_sha" > "$backup/release-sha.txt"
```

Require all commands to pass. The backup directory is the rollback handle.

- [ ] **Step 6: Merge the root-owned environment setting without replacing the file**

```bash
set -euo pipefail
source /tmp/multipass-wallet-values-deploy-state
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
sudo awk '
  BEGIN { wanted="LOOPER_MARKETPLACE_ROSTER_PATH=/var/www/helixa.xyz/multipass/data/looper-activated-roster.json" }
  /^LOOPER_MARKETPLACE_ROSTER_PATH=/ { if (!seen++) print wanted; next }
  { print }
  END { if (!seen) print wanted }
' /etc/default/multipass-api > "$tmp"
sudo install -o root -g root -m 600 "$tmp" /etc/default/multipass-api
sudo grep -Fx 'LOOPER_MARKETPLACE_ROSTER_PATH=/var/www/helixa.xyz/multipass/data/looper-activated-roster.json' /etc/default/multipass-api
```

The `awk` edit preserves every unrelated line and collapses duplicate wallet-roster settings to one.

- [ ] **Step 7: Install only the verified API source files and restart once**

Do not run `git checkout` in the dirty API runtime checkout. Install the exact reviewed files from `$src`:

```bash
set -euo pipefail
source /tmp/multipass-wallet-values-deploy-state
for file in bounded-io.js looper-wallet-value-contract.js looper-wallet-values.js index.js server.js; do
  install -m 0644 "$src/apps/api/src/$file" "$api_live/apps/api/src/$file"
done
sudo systemctl restart multipass-api.service
for attempt in $(seq 1 30); do
  test "$(systemctl is-active multipass-api.service)" = active && curl -fsS --max-time 2 http://127.0.0.1:8788/.well-known/helixa-multipass.json >/dev/null && break
  sleep 1
done
test "$(systemctl is-active multipass-api.service)" = active
sleep 5
test "$(systemctl show multipass-api.service -p NRestarts --value)" = "$restart_baseline"
```

- [ ] **Step 8: Warm and verify the additive API before web deployment**

```bash
set -euo pipefail
source /tmp/multipass-wallet-values-deploy-state
endpoint=https://helixa.xyz/multipass-api/api/loopers/marketplace/wallet-values
curl -fsS --max-time 40 -D "$backup/wallet-values.headers" -o "$backup/wallet-values.json" "$endpoint"
test "$(wc -c < "$backup/wallet-values.json")" -le 1048576
jq -e '.schema_version=="1.0.0" and .chain_id==8453 and .status=="fresh" and (.rows|length)==.roster.count and .roster.count>0 and .block.number>0 and (.block.hash|test("^0x[0-9a-f]{64}$"))' "$backup/wallet-values.json" >/dev/null
jq -e '.valuation_status=="available" and .quotes.eth.source=="coinbase" and .quotes.cred.source=="dexscreener-uniswap-base"' "$backup/wallet-values.json" >/dev/null
roster_hash=$(sha256sum "$web_live/data/looper-activated-roster.json" | cut -d' ' -f1)
test "$(jq -r '.roster.sha256' "$backup/wallet-values.json")" = "$roster_hash"
test "$(jq -r '.roster.count' "$backup/wallet-values.json")" = "$(jq -r '.count' "$web_live/data/looper-activated-roster.json")"
grep -qi '^cache-control: public, max-age=30' "$backup/wallet-values.headers"
test "$(systemctl is-active multipass-api.service)" = active
test "$(systemctl show multipass-api.service -p NRestarts --value)" = "$restart_baseline"
```

Do not deploy the web if any warm gate fails.

- [ ] **Step 9: Deploy the web bundle without touching roster-owned artifacts**

Preserve the generated daily roster and generated numbered detail routes while updating `the-loop/index.html` and bundle assets:

```bash
set -euo pipefail
source /tmp/multipass-wallet-values-deploy-state
roster_before=$(sha256sum "$web_live/data/looper-activated-roster.json" | cut -d' ' -f1)
route_count_before=$(find "$web_live/the-loop" -maxdepth 1 -type f ! -name index.html | wc -l)
rsync -a --delete \
  --exclude='/data/looper-activated-roster.json' \
  --exclude='/the-loop/[0-9]*' \
  "$src/apps/web/dist/" "$web_live/"
roster_after=$(sha256sum "$web_live/data/looper-activated-roster.json" | cut -d' ' -f1)
route_count_after=$(find "$web_live/the-loop" -maxdepth 1 -type f ! -name index.html | wc -l)
test "$roster_after" = "$roster_before"
test "$route_count_after" = "$route_count_before"
main_js=$(grep -o 'assets/index-[^" ]*\.js' "$src/apps/web/dist/index.html" | head -1)
grep -Fq "$main_js" "$web_live/index.html"
curl -fsS --max-time 10 "https://helixa.xyz/multipass/$main_js" >/dev/null
```

- [ ] **Step 10: Run production behavior smoke checks**

Verify with endpoint data plus a real browser at desktop and mobile widths:

- default remains Price: low to high;
- Wallet value high-to-low and low-to-high match exact `BigInt(total_usd_e8)` ordering;
- one endpoint row with nonzero `staked_cred_base_units` renders staked CRED;
- one zero-stake detail renders `0 CRED staked` only on detail;
- card/detail show the same row, Base block, and quote timestamp;
- live Blockscout/static/hash provenance passes and wallet options are enabled;
- stale/unavailable simulation in tests already proved listings survive;
- no horizontal overflow at 390 px and 1440 px.

Also require:

```bash
set -euo pipefail
source /tmp/multipass-wallet-values-deploy-state
curl -fsS --max-time 10 https://helixa.xyz/multipass/the-loop >/dev/null
curl -fsS --max-time 10 https://helixa.xyz/multipass/the-loop/2245 >/dev/null
test "$(systemctl is-active multipass-api.service)" = active
test "$(systemctl show multipass-api.service -p NRestarts --value)" = "$restart_baseline"
```

- [ ] **Step 11: Roll back exactly if a live gate fails**

Web rollback first:

```bash
set -euo pipefail
source /tmp/multipass-wallet-values-deploy-state
rsync -a --delete "$backup/web/" "$web_live/"
```

If the API/config is also unhealthy:

```bash
set -euo pipefail
source /tmp/multipass-wallet-values-deploy-state
rm -f "$api_live/apps/api/src/bounded-io.js" "$api_live/apps/api/src/looper-wallet-value-contract.js" "$api_live/apps/api/src/looper-wallet-values.js"
tar -C "$api_live" -xzf "$backup/api-src.tgz"
sudo install -o root -g root -m 600 "$backup/multipass-api.env" /etc/default/multipass-api
sudo systemctl restart multipass-api.service
test "$(systemctl is-active multipass-api.service)" = active
curl -fsS --max-time 10 https://helixa.xyz/multipass/the-loop >/dev/null
```

- [ ] **Step 12: Report verified completion**

Report the pushed `release_sha`, exact focused/API test counts, web build result, live endpoint status/bytes/roster hash/count/block, service restart count, desktop/mobile smoke result, backup path, and `https://helixa.xyz/multipass/the-loop`.
