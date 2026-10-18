# Swarm Command security runbook

- Pin ID Agents repository, commit, package, RESTAP version, license, and reviewed source hashes.
- Keep every manager listener loopback-only; workers cannot reach the manager control plane.
- Permit only the ten typed gateway operations. Reject generic `/remote`, shell text, traversal, cross-mission bindings, expired/replayed grants, and reusable worker credentials.
- Keep escrow immutable: no proxy, delegatecall, arbitrary call, mutable recipient, admin withdrawal, or caller-selected timeout payout.
- Require two-provider canonical agreement, confirmation depth, codehash/token pins, and reorg rollback before finalized labels or CRED evidence.
- Persist commitments and bounded metadata only; never plaintext XMTP bodies, prompts, signatures, credentials, or artifact contents.
- Pause new assignments/review on custody change without transferring payout or approval authority.
