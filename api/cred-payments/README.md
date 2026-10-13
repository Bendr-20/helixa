# Looper payment observer

Observation-only, prospective Base USDC transfer collection for the exact 688 token-bound accounts of Looper collection `0x1649cd37f4748807b4882fc48765ba0b2affa94a`.

## Required inputs

- `looper-payment-roster-proof-v1`: exactly 688 `tokenId/account/owner` rows, each with Base chain, canonical collection, token ID binding, code hash, finalized/safe block provenance, canonical roster hash, and proof commitment. This is derived from the verified Looper proof snapshot; an uncommitted fabricated address list is not accepted.
- `looper-payment-checkpoint-v1`: chain ID 8453, roster hash and proof commitment, immutable inception block number/hash/timestamp, the exact pinned provider set, a `safe` or `finalized` policy with at least 20 confirmations, and either a null predecessor for the first artifact or the exact previous artifact hash/end block.
- Follow-ups only: a separately sourced `looper-payment-continuity-anchor-v1`. Its closed schema and `LOOPER-PAYMENT-CONTINUITY-ANCHOR-v1\0` commitment bind chain, canonical collection, roster hash/proof commitment/provenance, the full immutable inception checkpoint, the exact predecessor artifact and checkpoint hashes, predecessor end block, and next expected start block.

Owner addresses remain proof metadata only. The collector scans only the 688 token-bound account addresses.

## Exact commands

First or follow-up network collection:

`npm run cred:payments:collect -- --roster-proof <roster-proof.json> --checkpoint <checkpoint.json> --from-block <decimal> --to-block <decimal> --output <collection.json>`

First artifact build:

`npm run cred:payments:build -- --roster-proof <roster-proof.json> --checkpoint <checkpoint.json> --collection <collection.json> --output <artifact.json>`

Follow-up artifact build:

`npm run cred:payments:build -- --roster-proof <roster-proof.json> --checkpoint <checkpoint.json> --collection <collection.json> --previous-artifact <previous-artifact.json> --continuity-anchor <trusted-continuity-anchor.json> --output <artifact.json>`

Tests:

`npm run test:cred-payments`

All flags are exact; unknown or duplicate flags, unsafe paths, and noncanonical decimal ranges fail closed. Outputs are exclusive canonical JSON files with mode 0600.

## Network and continuity policy

The collector is pinned exactly to `https://base-rpc.publicnode.com` and `https://base.drpc.org`, requires `eth_chainId=0x2105` from both, and permits only `eth_chainId`, `eth_blockNumber`, `eth_getBlockByNumber`, `eth_getLogs`, and `eth_getTransactionReceipt` over bounded POST JSON-RPC.

It derives the common finality anchor from the lower provider `safe`/`finalized` tip, then requires both providers to agree on that exact numbered block. It checks minimum confirmations, reads every chunk boundary before collection, compares normalized log sets, fetches provider-agreed metadata for each evidence block, binds every log and receipt to block number plus hash, and re-reads every observed block after collection to reject reorgs.

The first range starts exactly at the immutable inception block and does not accept or require a continuity anchor. Every follow-up checkpoint commits to the preceding artifact domain hash and end block; the next range starts exactly at `previousToBlock + 1`. Retroactive ranges, gaps, overlaps, mutable boundaries, and predecessor substitutions fail closed. A follow-up also revalidates its predecessor as a complete closed-schema artifact—including pinned roster/proof provenance, safety labels, checkpoint and lineage links, range boundaries, transfer/receipt counts, and every recomputable commitment—under explicit graph depth, node, and byte bounds before accepting it.

**Trust boundary:** predecessor bytes, their checkpoint, and hashes computed from them are untrusted and cannot authorize their own continuation. The continuity-anchor manifest must come from trusted immutable state outside those predecessor bytes (for example, a release ledger or content-addressed operator record pinned before the follow-up). The builder deliberately does not derive this manifest from `--previous-artifact`; it fails closed when a follow-up omits it. Operators must verify/pin the manifest's `continuityAnchorHash` at that external boundary and archive the manifest with the build. A fully recomputed substitute lineage can be internally hash-consistent, but it cannot match the original trusted anchor's exact predecessor artifact and checkpoint hashes. Supplying an attacker-created replacement manifest instead of the externally pinned manifest defeats that external trust boundary and is explicitly out of scope for this offline verifier.

Anchor schema (all fields required; unknown fields rejected): `continuityAnchorType`, `chainId`, `collection`, `canonicalRosterHash`, `rosterProofCommitment`, `rosterProofProvenance`, `inceptionCheckpoint`, `predecessorArtifactHash`, `predecessorCheckpointHash`, `predecessorToBlock`, `nextExpectedStartBlock`, and `continuityAnchorHash`. The nested inception checkpoint includes checkpoint type, chain, roster commitments, inception number/hash/timestamp, exact provider URLs, and finality policy.

Artifacts make only prospective closed-interval coverage claims. A canonical USDC `Transfer` is labeled `verified-base-usdc-transfer`, never x402. All outputs preserve `x402Confirmed: false`, `scoreEligibleExternalCount: 0`, no owner attribution, no CRED-native signature, deterministic hashes, and production isolation.

## Immutable payment operations

The operations layer pins Base chain ID `8453`, Looper collection `0x1649cd37f4748807b4882fc48765ba0b2affa94a`, inception `52536829 / 0x35cf4014bbd3fd3aea9595f9a4b2b0d6f89f639b587d8fb7e694cd02511f91f7`, and baseline end `52536928 / 0x0bebf8b0164a6c29cd492ac6902375b3f9115b3f3589cf3cba57b99011cc4768`. The fixed roster, checkpoint, and artifact file/domain pins are enforced independently. Providers remain, in order, `https://base-rpc.publicnode.com` and `https://base.drpc.org`, with `finalized` finality and at least 20 confirmations.

Canonical files are UTF-8 canonical JSON plus exactly one LF. Semantic commitments use canonical JSON without that LF. Durable state is rooted only at the absolute operator-selected `--state-dir`; ledger and baseline files are append-only/local trust roots. All public mutation commands enter one non-blocking `/usr/bin/flock` mutation lock through the safe launcher, and contention is recorded in the fixed 1,024-slot O_EXCL spool.

Commands:

- `npm run cred:payments:bootstrap -- --state-dir <absolute> --baseline-dir <absolute>`
- `npm run cred:payments:validate -- --state-dir <absolute>`
- `npm run cred:payments:follow-up -- --state-dir <absolute> --max-blocks <1..10000>`
- `npm run cred:payments:recover -- --state-dir <absolute> --run-id <runId> --action <action> --reason <text>`
- `npm run cred:payments:shadow -- --state-dir <absolute>`
- `npm run cred:payments:cron:preview -- --state-dir <absolute>` (read-only)
- `npm run cred:payments:cron:install -- --state-dir <absolute>`
- `npm run cred:payments:cron:remove -- --state-dir <absolute>`
- `npm run cred:payments:review -- --state-dir <absolute> --decision-file <absolute> --review-public-key ed25519:<hex>`
- `npm run cred:payments:archive -- --state-dir <absolute> --decision-id sha256:<hex> --review-public-key ed25519:<hex> --archive-dir <absolute>`

A scheduled shadow run is blocked until `verifyManualProof` finds a closed manual build with two-provider agreement, at least 20 confirmations, byte-identical independent builds, and the exact observation-only safety tuple. The seven-day review gate is derived only from validated scheduled ledger/report/artifact history and never from mutable status. `gateSatisfied` remains false until an independently signed Ed25519 review decision. Review removes only the managed cron span and restores its bound pre-install bytes exactly. Audit files remain local until the signed `retainUntil` (at least 90 exact days after trusted publication time); archive deletion requires a verified manifest, durable local receipt, and archive-aware byte/hash/domain resolution. Baseline, ledger, the controlling decision, and receipts are retained locally indefinitely. No operation imports CRED, mutates scores, or changes API/frontend behavior.
