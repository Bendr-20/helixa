# AFG Independent Evidence Shadow Plan

Goal: ingest cryptographically verifiable Agentic Finance Graph observations for the 688 activated Loopers without misattributing owner activity, claiming unsupported provider authorization, spending funds, or changing production.

## Admission boundary

1. Match only the Looper token-bound account address. Owner-wallet matches are audit context, never Looper evidence.
2. Require an exact Base ERC-8004 wallet binding to that account.
3. Verify the AFG statement canonical Keccak hash, agent leaf, sorted-pair Merkle proof, pinned Ed25519 root signature, window linkage, chain, wallet, freshness, and flags.
4. Verify any positive USDC payment claim against byte-identical successful Base receipts from two RPC providers.
5. Keep AFG data observation-only until AFG signs a CRED-native envelope or CRED formally adopts a detached-attestation authorization profile. Never re-sign it as if AFG signed CRED evidence.

## Implementation

1. Add pure signed-statement and USDC receipt verifiers with tamper, wrong-wallet, stale, and provider-disagreement tests.
2. Add a bounded collector for exact account-address lookups, one pinned AFG host, response-size/time limits, retries, throttling, and safe local output.
3. Add a deterministic replay report that proves which observations were cryptographically verified, which were directly attributable, and why none can affect scores yet.
4. Run a live 688-account collection, compile the compact shadow report twice, and require byte-identical results.
5. Run the Looper, shadow, evidence, and independent-source suites plus syntax, isolation, secret, and diff checks.

## Explicit non-goals

- No x402 purchases or paid AFG packs.
- No owner-to-all-Loopers credit inheritance.
- No public rating, privilege, reward, oracle, API, database, or validation-clock mutation.
