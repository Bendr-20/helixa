# Swarm Command testnet release gate

Release requires a separate explicit approval after:

- local manifest commands pass;
- independent contract and implementation review completes;
- Foundry invariant and fast escrow suites pass;
- the pinned ID Agents runtime is built and verified from recorded hashes;
- one authorized XMTP dev room proves create/recovery/membership/permissions/outbox behavior;
- deployment simulation verifies chain, registry, factory, version, tokens, codehashes, Safe/timelock roles, and signer authority;
- rollback/refund/arbitration drills pass;
- browser proof passes at desktop, 390px, and 320px;
- secret/path scans pass.

Broadcast only to the approved testnet. Mainnet and real funding remain separately prohibited until another explicit review and approval.

## No-broadcast simulation

Run from the repository root:

```bash
pnpm --filter @helixa/loopers-contracts simulate:missions -- --output review-artifacts/looper-missions/external-proof/base-sepolia-simulation.json
```

The simulator uses a deterministic in-memory chain with chain ID `84532`. It deploys two mock tokens, a two-of-two authority fixture, `VersionRegistry`, and `MissionEscrowFactory`; advances the one-day registry delay; activates the exact compiled `MissionEscrowV1`; verifies roles, token pins, constructor-bound runtime code hashes, factory compatibility, and version code hashes; and records eleven unsigned local transactions.

The generated addresses are simulation-only. They are not approved Base Sepolia destinations and must never be broadcast. Before preparing the approval packet, replace the fixture inputs with independently verified RPC endpoints, a real Safe and threshold, emergency council, deployer and fresh nonce, and the approved test-token choice. Regenerate and review the complete transaction plan, then obtain separate explicit broadcast approval.
