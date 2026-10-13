# AFG independent evidence shadow

This directory reads Agentic Finance Graph (AFG) as an independent external source. It is **not** a CRED provider integration. AFG did not sign a CRED-native submission, its root signature is never copied into a CRED envelope, and every output remains observation-only and score-ineligible.

## Trust boundary

A direct observation is attributable to a Looper only when the lookup, full agent record, signed statement, and queried Looper token-bound account agree on the same Base wallet and canonical ERC-8004 token ID. Both agent records must use onchain confidence, wallet set `erc8004_owners`, and bind method `1`; self-asserted, non-ERC-8004, null-bind, or disagreement cases fail closed. An owner-wallet match is retained only as context and is never inherited by any Looper controlled by that owner. The reporter always emits:

- `scoreEligibleExternalCount: 0`
- `ownerAttributedCount: 0`
- `afgCredNativeSignature: false`
- the existing corpus rating distribution unchanged

No CRED record or provider registry entry is created.

## Signed-statement verification

`verifier.js` is pure and verifies all of the following:

1. exact lowercase Base account and chain 8453 binding;
2. AFG canonical JSON bytes using the shared CRED canonicalizer and Keccak-256;
3. `keccak256(uint256(agentId) || statementHash)`;
4. the sorted-pair Keccak Merkle proof;
5. the currently pinned AFG key `afg-stmt-ed25519-8cda0c3066b3a73c` and public key;
6. Ed25519 over `afg-statement-root:v1:<windowStartEpoch>:<windowEndEpoch>:<root>:<prevRoot>:<leaves>`;
7. exact linkage to the matching root window; and
8. three-hour window shape, nine-hour freshness from an explicit trusted replay time, empty flags, `chain_ok: true`, and `stale: false`.

For every positive signed outgoing amount/count, `receipt.js` requires the in-window AFG `money_path` entries to be canonical onchain Base USDC transfers that exactly cover the signed micros and count. Every referenced transaction must have structurally identical successful receipts from the two distinct allowlisted HTTPS providers `https://mainnet.base.org` and `https://base-rpc.publicnode.com`; canonical USDC `Transfer` logs bind transaction hash, sender, destination, and value. Provider disagreement fails closed. Zero direct matches cause zero RPC requests.

The compact result preserves the statement hash, leaf, Merkle proof, root, previous root, key id and AFG root signature with signature scope `afg-statement-root-v1`. It explicitly says `credNativeSignature: false`.

Offline verification:

`npm run cred:afg:verify -- --statement /local/statement.json --roots /local/roots.json --account 0x... --now-epoch-seconds 1791855900 --output /local/observation.json`

## Bounded collection

`collector.js` accepts only a normalized `looper-base-roster-v1` roster (maximum 688 rows). It fetches roots once, queries each supplied account once, and queries each unique supplied owner once. For a preliminarily valid exact ERC-8004 account match only, it fetches the free agent record and free signed statement, then rechecks agreement across all sources. Positive signed payment windows additionally fetch the required receipts from both Base providers.

It uses GET only under `https://agenticfinancegraph.com/api/`, refuses redirects, credentials and other hosts, and never calls `/check/*` or buys x402 packs. One shared limiter enforces a global maximum of four concurrent HTTP requests across lookup, detail, statement, and RPC work (including four simultaneous direct matches). Every lookup must carry a canonical `as_of`. The collector preserves it as `lookupAsOf` on every row, fails closed unless all account and owner rows share one exact lookup snapshot, and derives both scan `sourceAsOf` values from that validated lookup clock. The separately fetched canonical roots `as_of` is retained as its own root snapshot clock; live API semantics do not promise equality between lookup and roots snapshots. Limits are four concurrent requests, two retries, 10-second timeouts, 1 MiB per response, 1,376 total scan rows, and 16 MiB output. Output paths refuse overwrite and symlink traversal and are written mode 0600.

`npm run cred:afg:collect -- --roster /local/roster.json --output /local/afg-collection.json`

## Deterministic reporter

The offline reporter requires `--as-of` as an explicit trusted canonical ISO replay timestamp; it never derives freshness from mutable scan metadata. It requires every preserved row `lookupAsOf` to equal both account- and owner-scan `sourceAsOf` values, and requires those scan clocks to equal each other. Roots `as_of` remains an independent canonical clock and is not relabeled as a lookup clock. Against trusted replay time, both the lookup snapshot and roots snapshot must be non-future and no more than nine hours old, including zero-match negative scans. Signed-statement verification independently keeps its own signed-window freshness checks. The hashed artifact provenance records the clocks distinctly as `lookupSourceAsOf`, `rootsAsOf`, and `replayedAsOf`. It takes the roster, the collection's account scan, owner scan and roots, plus a compact existing-corpus input containing `corpusType`, `corpusHash`, and `report`. It emits one numeric-token-sorted row per Looper, direct match and verified observation state, owner context, owner Looper count, decision and reason codes. The artifact uses domain `LOOPER-AFG-ATTRIBUTION-SHADOW-v1\0` and canonical `cred-cjson-v1` bytes.

`npm run cred:afg:build -- --roster /local/roster.json --collection /local/afg-collection.json --corpus /local/looper-corpus.json --as-of 2026-10-13T01:45:00.000Z --output /local/afg-shadow.json`

## Tests

- `npm run test:cred-afg`
- `npm run test:cred-looper`
- `npm run test:cred-shadow`
- `npm run test:cred-evidence`
