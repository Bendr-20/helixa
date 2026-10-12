# Looper Marketplace Wallet-Value Sorting Design

**Date:** 2026-10-12  
**Status:** Approved product design; specification revision 2

## Goal and scope boundary

Add an optional wallet-value sort to the activated Loopers marketplace and show public ETH, liquid CRED, and Pantheon-staked CRED. This is a small read-only marketplace tool, not a portfolio product.

The existing default remains **Price: low to high**.

Included:

- one bounded, process-local, cached server snapshot;
- ETH, liquid CRED, and Pantheon-staked CRED balances;
- estimated USD value of all three balances;
- wallet-value ascending and descending sorts;
- compact card values and the same data on the detail page.

Excluded:

- history, charts, PnL, yield/reward estimates, rankings, alerts, exports, arbitrary tokens, persistence, a new worker, or wallet actions.

## Fixed identities and sources

### Base contracts

All addresses are checksummed with `viem.getAddress` and equality is byte/case insensitive:

- chain: Base, `8453`;
- Loopers collection: `0x1649CD37f4748807b4882FC48765bA0B2aFfa94a`;
- ERC-6551 registry: `0x000000006551c19487814612e58FE06813775758`;
- released implementation: `0xf192f350427c8F58bC28e78b1e6Af164279F486e`;
- account salt: `0xff28549509272e76f1d1c6ef7d6976d848c5ff6cb5068b2183c8d52f4cbe2bee`;
- CRED: `0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3`, 18 decimals;
- Pantheon vault: `0xBf52Aaf8b6C82FaD0220B5378022eA4fC0a98fDb`;
- Multicall3: `0xcA11bde05977b3631167028862bE2a173976CA11`.

The Pantheon read is exactly `stakes(address user, address stakingToken)` returning `(uint256 amount, bool autoRestake, uint16 lockMonths, uint32 lockDuration, uint32 stakeTime, uint32 unstakeRequestTime, uint32 unstakeTime, uint32 stakeMonthIndex, bool compounderEnabled)`. Only tuple element `amount` is staked principal and is included once in wallet value.

### RPC providers and block agreement

Use only the two existing fixed providers:

- `https://base-rpc.publicnode.com`
- `https://base.drpc.org`

Both providers must succeed. Read each latest head, choose the lower block number, then fetch that exact block from both. The number and hash must match. Execute every balance and stake call with that block tag. Re-fetch the block from both providers after all batches and require the hash to remain unchanged.

A provider timeout, one-provider-only success, block disagreement/reorg, malformed call result, cross-provider row disagreement, or provider-level batch failure rejects the whole refresh. A single well-formed call that fails identically at both providers makes only that Looper row unavailable. Empty deployed code agreed by both providers also makes that row unavailable. Tuple length/type disagreement is a malformed batch and rejects the whole refresh.

### Activated roster

The API reads the exact static artifact maintained by the existing roster refresh job. Production config must set `LOOPER_MARKETPLACE_ROSTER_PATH=/var/www/helixa.xyz/multipass/data/looper-activated-roster.json`; tests provide an explicit fixture path. There is no network fallback.

The roster job remains the sole update owner and must continue temp-file-plus-rename atomic writes. The API reads at most 256 KiB, hashes the raw bytes with SHA-256, parses once, and accepts only these exact top-level keys:

- `schema_version` = `1.0.0`;
- `chain_id` = `8453`;
- `contract` and `implementation` equal the fixed identities above;
- `observed_block` is a safe positive integer;
- `observed_at` is canonical UTC ISO-8601;
- `count` equals `token_ids.length`;
- `token_ids` contains 1–1,000 unique canonical decimal uint256 strings in ascending numeric order.

The response includes `roster_sha256`. The browser hashes the exact independently fetched roster bytes with Web Crypto and requires equality before attaching rows. On mismatch, all wallet values are unavailable, wallet sorting is disabled with a short refresh message, and the existing roster/listings UI remains intact. Newly activated Loopers are never silently omitted.

### USD quote adapters

Fetch both sources in parallel with `redirect: 'error'`, credentials omitted, an exact HTTPS host/path allowlist, a five-second timeout, and bounded response bodies. There is no fallback source.

**ETH:** `GET https://api.coinbase.com/v2/prices/ETH-USD/spot`, maximum 32 KiB. Require a plain-object response with `data.base === 'ETH'`, `data.currency === 'USD'`, and `data.amount` as a positive canonical decimal. Ignore documented extra keys.

**CRED:** `GET https://api.dexscreener.com/latest/dex/tokens/0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3`, maximum 512 KiB. Select exactly one entry with:

- `chainId === 'base'` and `dexId === 'uniswap'`;
- pool ID `0x55a4f7a23c4c2616cf848e639a08bd4283d13e66f5fcf34f828b5ca7e4e96324`;
- base token equal to CRED with symbol `CRED`;
- quote token `0x4200000000000000000000000000000000000006` with symbol `WETH`;
- positive canonical `priceUsd`;
- finite `liquidity.usd >= 10_000`.

The source observation time is the local UTC instant after its bounded body validates. The two observations may differ by at most ten seconds and must both be no older than sixty seconds when the snapshot is generated. A missing identity, duplicate pinned pair, low liquidity, malformed value, redirect, timeout, oversized body, or quote failure leaves valuation unavailable; it never turns a balance into zero.

A deployment feasibility probe on 2026-10-12 verified the pinned CRED pool returns Base CRED/WETH with approximately USD 81k liquidity and a positive USD price. This proves current source availability, not future trust.

## Bounded refresh

For each Looper, derive the released ERC-6551 account and read:

1. Multicall3 `getEthBalance(account)`;
2. CRED `balanceOf(account)`;
3. Pantheon `stakes(account, CRED)`.

Before including a row, require deployed account code at the pinned block using bounded JSON-RPC `eth_getCode` batches under the same 192-request and concurrency limits. Use at most 192 inner calls per Multicall3 batch, two concurrent batches per provider, an eight-second request timeout, and a thirty-second whole-refresh deadline. The roster limit is 1,000 rows; decoded in-memory data is capped at 4 MiB; serialized response is capped at 1 MiB.

A capacity test must exercise at least 700 rows against deterministic dual-provider fixtures and prove the batch count, concurrency ceiling, thirty-second deadline behavior, and response-size limit.

## Exact response contract

Route: `GET /api/loopers/marketplace/wallet-values`. Production web access is same-origin through `/multipass-api/api/loopers/marketplace/wallet-values`. The wallet-value loader never honors the marketplace `?api=` override. Development injection occurs only through constructor/test dependencies, not a user-controlled URL.

Top-level and nested objects reject unknown keys. The JSON shape is:

```json
{
  "schema_version": "1.0.0",
  "chain_id": 8453,
  "status": "fresh | stale",
  "valuation_status": "available | unavailable",
  "roster": {
    "sha256": "<64 lowercase hex>",
    "count": 688,
    "observed_block": 52488246,
    "observed_at": "<UTC ISO-8601>"
  },
  "block": {
    "number": 52490000,
    "hash": "<0x + 64 lowercase hex>",
    "observed_at": "<UTC ISO-8601>"
  },
  "generated_at": "<UTC ISO-8601>",
  "fresh_until": "<UTC ISO-8601>",
  "stale_until": "<UTC ISO-8601>",
  "quotes": null,
  "rows": []
}
```

When `valuation_status === 'available'`, `quotes` is exactly:

```json
{
  "eth": { "asset": "ETH", "source": "coinbase", "price_usd_e8": "254256500000", "observed_at": "<UTC ISO-8601>" },
  "cred": { "asset": "CRED", "contract": "0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3", "source": "dexscreener-uniswap-base", "pool_id": "0x55a4f7a23c4c2616cf848e639a08bd4283d13e66f5fcf34f828b5ca7e4e96324", "price_usd_e8": "110", "observed_at": "<UTC ISO-8601>" }
}
```

Each row is exactly one of:

```json
{
  "status": "available",
  "token_id": "2245",
  "account": "<checksummed address>",
  "eth_wei": "<uint256 decimal>",
  "liquid_cred_base_units": "<uint256 decimal>",
  "staked_cred_base_units": "<uint256 decimal>",
  "total_usd_e8": "<non-negative decimal or null>"
}
```

```json
{ "status": "unavailable", "token_id": "2245", "reason": "account_unavailable" }
```

Strings use canonical decimal form (`0` or no leading zero), balances are 0 through 2^256−1, and token IDs are positive uint256. Quote prices use USD e8, must be 1 through 10^20, and are produced by truncating source decimals after eight places. Compute with unbounded `BigInt`:

`total_usd_e8 = floor(eth_wei * eth_price_usd_e8 / 10^18) + floor((liquid_cred + staked_cred) * cred_price_usd_e8 / 10^18)`.

Require the result to be at most 10^38−1. When valuation is unavailable, `quotes` is null and every available row has `total_usd_e8: null`; verified raw balances remain displayable.

## Cache and HTTP behavior

The cache is process-local and single-flight:

- fresh when `age < 300,000 ms`;
- stale when `300,000 <= age < 900,000 ms`;
- unusable when `age >= 900,000 ms`.

`generated_at` is successful onchain completion time, `fresh_until = generated_at + 5 minutes`, and `stale_until = generated_at + 15 minutes`. A stale request starts one refresh and serves the stale snapshot. A failed refresh sets a sixty-second retry cooldown; requests during cooldown do not start more work.

A successful quote failure with successful onchain reads creates a fresh `valuation_status: unavailable` balance snapshot. A failed onchain refresh may serve the prior snapshot only inside the total fifteen-minute window.

- Fresh 200: `Cache-Control: public, max-age=30` plus a strong ETag.
- Stale 200: `Cache-Control: no-cache` and `status: stale`.
- No usable snapshot: 503 with schema-locked `wallet_values_unavailable` error and `Cache-Control: no-store`.

## Client behavior

Roster, listings, and wallet values load independently. Listings and price sorting remain usable if wallet values fail.

Add:

- **Wallet value: high to low**;
- **Wallet value: low to high**.

The existing default stays **Price: low to high**. Compare canonical `total_usd_e8` values as `BigInt`. For ties, token ID is ascending in both wallet sort directions. Unavailable/null values always follow available values. If the whole snapshot or valuation is unavailable, wallet sort options are disabled and the current non-wallet sort remains selected.

Cards show estimated total, ETH, liquid CRED, and nonzero staked CRED. Detail pages use the exact same server row; this marketplace surface no longer performs an independent browser RPC holdings read. Details show zero staked CRED explicitly, Base block, quote time, and stale state. USD copy says `Estimated wallet value`; raw balances remain authoritative.

## Tests

Tests must cover:

- exact contract identities, ABI output shape, and inclusion of Pantheon `amount` exactly once;
- two-provider shared block/hash, post-read revalidation, reorg, timeout, disagreement, and one-provider-only failure;
- malformed batch tuple lengths, per-row call failure, whole-batch failure, and account-code absence;
- roster exact keys, atomic-read fixture, provenance mismatch, duplicate/order/count/size failures;
- quote host/path and asset identity, redirects, size/time bounds, age/skew, pinned pair uniqueness, liquidity floor, and malformed prices;
- exact e8 truncation/formula, uint boundaries, very large values, response unknown keys, and response-size bounds;
- single-flight refresh, sixty-second failed-refresh cooldown, and exact 5/15-minute inclusive boundaries;
- 700-row capacity, batch count/concurrency, deadline, memory, and payload bounds;
- available values, balances-only state, and unavailable values; null/unavailable always last;
- deterministic ascending token-ID ties in both wallet directions;
- default price ascending, disabled wallet sorts during valuation failure, and listings surviving wallet failure;
- card/detail snapshot identity, staked-CRED rendering, stale labels, and desktop/mobile overflow.

## Release and rollback

1. Configure the API roster path and deploy the additive endpoint.
2. Complete and inspect one full-size warm refresh: roster hash/count, dual-provider block hash, pinned quotes, response size, and cache state.
3. Deploy the web bundle only after that check passes.
4. Smoke-test default price sorting, both wallet sorts, one nonzero Pantheon stake, one zero stake, roster hash matching, detail/card identity, and mobile layout.
5. On failure, roll back the web bundle first. The additive API can then be removed independently; the existing marketplace remains the known-good state.
