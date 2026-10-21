# Swarm Command Console-to-Execution Bridge Plan

**Goal:** Connect the live, unanimous preparation-consent/readiness flow to the already-reviewed deterministic token-genesis packet builder, while remaining strictly no-broadcast and provider-neutral. Add a partner-ready Pantheon × Helixa integration document grounded in verified public and repository evidence.

## Safety boundary

- No deployment, transaction preparation, calldata, wallet invocation, signature collection, approval, funding, broadcast, external outreach, or production mutation.
- The bridge emits only canonical review material with `deploymentAuthorized: false`, `broadcastPrepared: false`, and zero transactions.
- Pantheon is described as the preferred proposed adapter, not as an integrated or contracted provider.
- Commercial terms are labeled proposals; public mechanics are labeled verified, claimed, or requiring confirmation.
- Existing preparation consent never becomes execution consent. A fresh execution authorization remains mandatory.

## Task 1 — Execution-preview service and API

1. Add focused RED tests for a protected POST endpoint at `/api/loopers/swarm-launch/consents/:proposalId/execution-preview`.
2. Require authenticated Console session, CSRF, unanimous live consent, current manifest revalidation, and the existing rate limit.
3. Accept a closed request schema containing exactly:
   - one beneficiary address per consented Looper token ID;
   - fixed recipient addresses for CRED rewards, swarm treasury, and public distribution;
   - one-to-four reviewed revenue assets.
4. Keep the factory address server-authoritative/configured; never accept it from the browser.
5. Deterministically derive the deployment salt and conversion timing from the exact readiness packet and existing reviewed policy.
6. Invoke the existing canonical execution-packet builder through an injected service seam so tests do not compile or touch RPC.
7. Reject unknown keys, duplicate/missing members, zero/duplicate recipients where unsafe, stale/changed consent, unconfigured factory, transaction/calldata/key/signature fields, and any executable state.
8. Return a no-store response with the complete preparation packet, canonical packet hash, allocation summary, predicted CREATE2 addresses, required signers, and explicit no-deployment state.

## Task 2 — Console execution-review UI

1. Add focused RED tests for an execution-review form rendered only after a readiness packet exists.
2. Collect member beneficiary addresses, three fixed recipients, and reviewed revenue assets.
3. Submit only through the authenticated API client with CSRF.
4. Render token terms, exact allocation amounts, vesting schedule, required signers, predicted token/registry/splitter/stream addresses, consent/readiness lineage, and packet hash.
5. Display `Provider adapter: not selected`, `Deployment authorized: false`, and `Transactions: 0` prominently.
6. Add no signing, approve, deploy, execute, calldata, or broadcast control.

## Task 3 — Pantheon × Helixa integration document

Create `docs/partnerships/pantheon-helixa-integration.md` with:

- executive summary and current integration status;
- existing Helixa Pantheon CRED staking integration;
- Swarm Command/Pantheon responsibility split;
- CRED scoring for the CRED vault and general agent vaults;
- privacy-preserving, opt-in concepts for human credibility signals, explicitly not a consumer credit score;
- launchpad architecture, state machine, API/contract data requirements, security boundaries, and phased test plan;
- proposed allocations and commercial terms, including opening asks and fallback negotiation ranges;
- governance, audit, refund/cancellation, graduation, upgradeability, custody, and incident-response requirements;
- 3–5 verified Looper pilot candidates, with public identifiers only and explicit owner permission required before any live use;
- an appendix separating verified facts, Pantheon claims, Helixa proposals, and open questions.

## Verification

- Focused type/API/web tests pass.
- Existing Swarm Launch readiness, consent, execution-manifest, verifier, and Foundry tests remain green.
- Full applicable package tests and web production build pass; name any known unrelated fixture failure.
- Security grep confirms no private keys, signatures, calldata, raw transactions, send methods, or provider credentials in new artifacts.
- Independent spec-compliance review precedes code-quality/security review.
- Final diff is clean and committed locally; do not deploy or push unless separately authorized by the user’s existing repository publication scope and verification succeeds.
## Implementation record

- Tasks 1–2 completed as a strictly preparation-only execution-review bridge in commits `b078202`, `5aa2777`, `76140c5`, and `247e7e2`.
- Task 3 completed in `docs/partnerships/pantheon-helixa-integration.md`.
- Independent spec and code-quality/security reviews were applied; all material findings were fixed before completion.
- No deployment, broadcast, live RPC, wallet action, push, or external partner outreach occurred.
