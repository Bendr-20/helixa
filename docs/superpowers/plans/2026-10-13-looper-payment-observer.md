# Looper Prospective Payment Observer Plan

Status: implemented and hardened on 2026-10-13. The observer remains offline/observation-only except for its dedicated bounded read collector. No scheduler, production import, score mutation, signing, spending, or deployment is part of this work.

## Goal

Start a prospective Base USDC observation history for the exact 688 activated Looper token-bound accounts without inventing retroactive coverage, treating generic USDC as x402, attributing owner activity, or affecting production scores.

## Hardened admission boundary

1. Require `eth_chainId=0x2105` from both exact pinned providers.
2. Read each provider's configured `safe` or `finalized` tip, select the lower height, and require both providers to agree on that exact numbered common anchor. Enforce at least 20 confirmations.
3. Require a versioned canonical roster proof for collection `0x1649cd37f4748807b4882fc48765ba0b2affa94a`: 688 exact `tokenId/account/owner` rows, per-row Base/collection/token binding and code hash, canonical roster hash, proof commitment, and block provenance. Scan token-bound accounts only; never scan owners.
4. Require an immutable versioned checkpoint containing chain, roster/proof commitments, inception number/hash/timestamp, exact provider set, finality policy, and predecessor hash/end block when continuing.
5. First coverage starts exactly at inception. Follow-up coverage starts exactly at `previousToBlock + 1`, supplies the complete previous artifact, and separately supplies a closed-schema `looper-payment-continuity-anchor-v1` sourced from trusted immutable state outside the predecessor bytes. The domain-separated anchor commitment binds chain, canonical collection, roster hash/proof/provenance, immutable inception checkpoint, exact predecessor artifact/checkpoint hashes, predecessor end, and next start. Missing/malformed anchors, retroactive ranges, gaps, overlaps, one-sided substitutions, and fully recomputed nested substitutions against the original anchor fail closed.
6. Before scans, read provider-agreed metadata for every chunk boundary. Compare both providers' normalized incoming/outgoing Base USDC log sets. For each discovered log or receipt block, fetch exact provider-agreed block metadata and bind both number and hash.
7. After all log/receipt work, re-read every observed boundary/evidence block and reject any metadata change as a reorg.
8. Require successful equivalent receipts and exact transfer-field binding. Label only `verified-base-usdc-transfer`; keep `x402Confirmed=false`.
9. Emit closed-schema, deeply immutable, canonically serialized artifacts with checkpoint, predecessor, roster proof commitment, provider provenance, collection, and artifact domain hashes.

## Bounded implementation

- Pinned providers: `https://base-rpc.publicnode.com`, `https://base.drpc.org`.
- Allowed methods: `eth_chainId`, `eth_blockNumber`, `eth_getBlockByNumber`, `eth_getLogs`, `eth_getTransactionReceipt`.
- POST only; redirects refused; response body, retry, timeout, total range, chunk size, and shared concurrency bounds enforced.
- Output uses exclusive mode-0600 canonical JSON and rejects unsafe/symlink paths.
- Offline builder has no network or environment-secret capability and never derives a follow-up continuity anchor from an untrusted predecessor. The operator must pin and verify the anchor commitment in an external immutable release record; replacing both the predecessor and its anchor is outside this verifier's trust boundary.
- Production dependency graph excludes the observer module and CLIs.

## Hardened live baseline

Artifacts: `/home/ubuntu/.openclaw/workspace/artifacts/cred-shadow/looper-payment-observer-2026-10-13/`.

- Immutable inception: block 52,536,829, hash `0x35cf4014bbd3fd3aea9595f9a4b2b0d6f89f639b587d8fb7e694cd02511f91f7`.
- Common finalized end: block 52,536,928, hash `0x0bebf8b0164a6c29cd492ac6902375b3f9115b3f3589cf3cba57b99011cc4768`.
- Range: 100 closed blocks; zero matching transfers and receipts.
- Roster proof commitment: `sha256:518d92a13ef988e466ae4a50aad56ea55f36a4d331b058d792355b60c9a68229`.
- Checkpoint hash: `sha256:eb0c6308aa358a1c12f1f73ac7028d64d17035eaeed1037dfb7ad43580d5ab66`.
- Artifact hash: `sha256:157c4a6eea7d5dfdc609aa83a3df6f6c356c8023e5240bc718c726e994e71dcc`.
- Two builds are byte-identical; file SHA-256 `da32712ec0037f1f6ffcb3843fa9fdc4e2ec248c75b22d687611b30f3ab56bb9`.

## Explicit non-goals

No claim before inception; no generic-USDC x402 claim; no paid API; no wallet, signing, score, owner-attribution, production, deploy, or scheduler change.
