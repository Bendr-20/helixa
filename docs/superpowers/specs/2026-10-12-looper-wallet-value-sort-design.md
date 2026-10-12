# Looper Marketplace Wallet-Value Sorting Design

**Date:** 2026-10-12  
**Status:** Approved for specification review

## Goal

Add an optional wallet-value sort to the activated Loopers marketplace and expose public ETH, liquid CRED, and Pantheon-staked CRED balances without turning the marketplace into an analytics product.

The existing default remains **Price: low to high**. The feature is read-only and informational.

## Scope

### Included

- A bounded, cached server snapshot for every activated Looper.
- ETH, liquid CRED, and Pantheon-staked CRED balances.
- Estimated USD values using current ETH and CRED quotes.
- Two additional sort choices:
  - Wallet value: high to low
  - Wallet value: low to high
- Compact balance/value display on marketplace cards.
- The same balances and valuation timestamp on the individual Multipass detail view.
- Explicit unavailable and stale states.

### Excluded

- Historical charts, portfolio analytics, PnL, rewards forecasting, rankings, alerts, or exports.
- Wallet mutations or staking actions.
- Arbitrary ERC-20 discovery or valuation.
- Changing the marketplace's default sort.

## Architecture

### Server snapshot

Add a read-only `/api/loopers/marketplace/wallet-values` route beside the existing listings route. Its loader receives the canonical activated roster and produces one schema-locked snapshot.

For each activated token ID, derive the released ERC-6551 account and read, at one pinned Base block:

- native ETH balance;
- CRED `balanceOf(account)`;
- Pantheon `stakes(account, CRED)` principal.

Use bounded batch calls rather than one browser request per Looper. Provider responses must agree under the repository's existing fail-closed Base-read rules. A malformed, inconsistent, or missing row becomes unavailable; it must not receive a fabricated zero value.

The loader fetches bounded current USD quotes for ETH and CRED, validates positive finite decimal strings, records source and observation time, and computes values with integer/fixed-point arithmetic. Floating-point numbers are not used for balance comparison or ordering.

The completed snapshot is cached for five minutes. Only one refresh may be in flight. A failed refresh may serve the last valid snapshot as stale for at most fifteen minutes; after that the endpoint returns unavailable rather than indefinitely presenting old valuations.

### Response contract

The response contains:

- schema version;
- Base chain ID and pinned block metadata;
- quote values, sources, and timestamps;
- generated/stale timestamps;
- one row per activated token ID containing account, raw ETH, liquid CRED, staked CRED, and total estimated USD value;
- an explicit unavailable marker where verification failed.

Rows not present in the exact activated roster are rejected. Duplicate or non-canonical token IDs, negative values, unbounded precision, unknown assets, and partial quote documents are rejected.

## Client behavior

The marketplace loads roster, listings, and wallet-value snapshots independently. Listings remain usable if wallet valuation fails.

The sort menu adds wallet-value ascending and descending. Comparison uses the server's canonical fixed-point total, with token ID as a deterministic tie-breaker. Unavailable rows always sort after available rows in both directions.

Each card shows a compact block:

- **Wallet ~\$X**
- ETH balance
- liquid CRED balance
- staked CRED balance when nonzero

The detail page shows all three balances, the estimated total, Base block, and quote timestamp. Copy labels USD values as estimates and raw onchain balances as authoritative. Zero staked CRED is shown as `0 CRED staked` on the detail view but may be omitted from the compact card.

The existing **Price: low to high** default is unchanged. Search, listed-only filtering, and listing metrics are unchanged.

## Failure handling

- Wallet snapshot unavailable: wallet sorts remain selectable but show an unavailable state; existing marketplace data still renders.
- Individual row unavailable: show `Wallet unavailable` and sort it last.
- Quotes stale but within the bounded stale window: show the last estimate with a visible stale label.
- Quotes or onchain data beyond the stale window: do not calculate or display USD totals.
- No client-side fallback fan-out to hundreds of RPC calls.

## Performance guardrails

- One marketplace wallet-value request per page load.
- Five-minute server cache and single-flight refresh.
- Bounded response size and fetch timeout.
- Batched onchain reads with explicit concurrency limits.
- No new background worker, database, analytics service, or user-specific state.

## Testing

Unit and integration coverage must prove:

- staked CRED is included exactly once in total value;
- fixed-point totals and sorting remain exact for large balances;
- unavailable values sort last in both directions;
- token ID tie-breaking is deterministic;
- malformed, duplicate, partial, inconsistent, and oversized snapshots fail closed;
- stale-cache boundaries work as specified;
- listings remain functional when valuations fail;
- the default remains price ascending;
- cards and detail pages label estimated value, liquid CRED, and staked CRED correctly;
- desktop and mobile layouts have no overflow;
- production smoke checks exercise wallet-value sorting and one known staked-CRED detail.

## Release and rollback

Ship behind the availability of the new snapshot endpoint, without a persistent feature flag. Deploy the API first, then the web bundle. Verify snapshot shape, cache headers, sort order, detail rendering, and mobile layout. If verification fails, roll back the web bundle and API together; the existing price-sorted marketplace remains the known-good state.
