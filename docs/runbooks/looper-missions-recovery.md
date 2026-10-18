# Swarm Command recovery runbook

- Reconcile before retrying every side effect.
- Vault ambiguity: verify CREATE2 address, factory event, runtime codehash, and token pins.
- Funding timeout: read transaction, internal liability, and finalized balances; never request a blind second deposit.
- Runtime timeout: find the exact pinned manager/team/workspace before provisioning.
- XMTP timeout: hold the durable lock, sync groups, verify one signed mission marker, exact members, closed permissions, and bridge admin. Never create while ambiguity remains.
- Task timeout: read by deterministic task name before create.
- Outbox crash: resend with the same deterministic XMTP idempotency key, then mark sent.
- Reorg: orphan the divergent range and replay from the last agreed canonical ancestor.
- Launch expiry: move to `expired_refundable`; do not activate agents.
