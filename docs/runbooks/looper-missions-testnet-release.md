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
