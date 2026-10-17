# Swarm Command testnet release gate

Release requires a separate explicit approval after:

- local manifest commands pass;
- independent contract and implementation review completes;
- Foundry invariant and fast escrow suites pass;
- the pinned ID Agents runtime is built and verified from recorded hashes;
- one authorized XMTP dev room proves create/recovery/membership/permissions/outbox behavior;
- local chain-84532 simulation verifies deterministic registry/factory/version/token/vault behavior and rejects activation before the registry delay;
- a separate live no-broadcast simulation verifies Base Sepolia RPC consensus, production Safe implementation/owners/threshold/nonce, emergency authority, deployer nonce/fees, approved token bytecode, and the exact chain-bound unsigned transaction plan;
- rollback/refund/arbitration drills pass;
- browser proof passes at desktop, 390px, and 320px;
- secret/path scans pass.

Broadcast only to the approved testnet. Mainnet and real funding remain separately prohibited until another explicit review and approval.

## No-broadcast simulation

Run from the repository root:

```bash
pnpm --filter @helixa/loopers-contracts simulate:missions -- --output review-artifacts/looper-missions/external-proof/base-sepolia-simulation.json
```

The simulator uses a deterministic in-memory chain with chain ID `84532`. It deploys two mock tokens, a deliberately non-Safe two-of-two authority fixture, `VersionRegistry`, `MissionEscrowFactory`, and the exact compiled `MissionEscrowV1`; proves early activation reverts; advances the one-day registry delay; activates V1; reads token properties from chain; verifies the deployed vault runtime hash; and records thirteen chain-labelled local execution traces.

These traces are not an unsigned deployment plan: their fee handling and execution occur only inside Ganache. The generated addresses are simulation-only, are not approved Base Sepolia destinations, and must never be broadcast. The committed artifact therefore records `liveTransactionPlan: null` and blocks live readiness.

Before preparing the approval packet, independently verify two Base Sepolia RPC endpoints, the production Safe implementation/owners/threshold/nonce, emergency council, deployer and fresh nonce/fee fields, and the approved test-token bytecode. Only then generate and simulate the complete EIP-155 chain-bound unsigned transaction plan against live state. Broadcast still requires separate explicit approval.

The reviewed live plan uses a canonical Safe 1.4.1 proxy with threshold 2. Its owners are the deployment wallet and Quigley admin wallet; the verified Looper-holder wallet is the separate emergency council. It deploys isolated `mUSDC` and `mCRED` test tokens, never canonical assets. Generate the live proof at an explicit confirmed block:

    pnpm --filter @helixa/loopers-contracts simulate:missions:live -- --anchor <confirmed-block> --output review-artifacts/looper-missions/external-proof/base-sepolia-live-plan.json

This command performs read-only dual-RPC verification and executes the exact deployment and Safe actions only inside a forked local EVM. It collects no authorization material and cannot broadcast. The resulting plan expires at its recorded `liveReadiness.validUntil` boundary and must be refreshed immediately before any separately approved broadcast.
