# Looper Missions MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available and authorized) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking. For Quigley’s current authorization, execute directly in the main session; do not spawn subagents unless he explicitly re-enables them.

**Goal:** Build a local-first Looper mission marketplace that binds verified Loopers to isolated ID Agents swarms and private XMTP rooms, then settles exact USDC/$CRED milestone allocations through immutable Base escrow.

**Architecture:** A dedicated STRICT SQLite mission ledger owns offchain lifecycle and idempotency; an authenticated typed gateway contains one pinned ID Agents runtime per mission; the existing XMTP node adapter gains crash-safe mission-group binding and an outbox. Immutable per-mission vaults own funds, while the API reconciles chain events and exposes public/private projections to focused Console modules.

**Tech Stack:** Node.js 24 ESM, built-in `node:sqlite`, Node test runner, viem/ethers, Solidity 0.8.24, OpenZeppelin 4.8.3, solc/Ganache for fast contract tests, Foundry for fuzz/invariants, XMTP Node/Browser SDK 6.1.0, React 19, Vite 7.

**Specification:** `docs/superpowers/specs/2026-10-16-looper-missions-id-agents-escrow-design.md`

**Release boundary:** This plan stops at local and Base-testnet proof. No Base mainnet deployment, real production funding, registry activation, or public launch occurs without the separate review and explicit approval gates in the specification.

---

## File map

### Shared mission contract

- Create `packages/types/src/missions.js` — closed lifecycle enums, transition predicates, limits, event/source labels, and canonical domain helpers.
- Create `packages/types/src/missions.d.ts` — public mission-domain types.
- Create `packages/types/test/missions.test.mjs` — exact state-machine and bounds contract tests.
- Modify `packages/types/src/index.js` and `packages/types/src/index.d.ts` — export the mission contract without changing existing schemas.

### Mission ledger and application service

- Create `apps/api/src/missions/database.js` — dedicated STRICT/WAL SQLite schema, integrity checks, and transaction boundary.
- Create `apps/api/src/missions/repository.js` — persistence primitives and append-only event reads.
- Create `apps/api/src/missions/idempotency.js` — canonical body hashes and same-key/same-body replay enforcement.
- Create `apps/api/src/missions/domain.js` — transition/role/custody rules independent from HTTP.
- Create `apps/api/src/missions/service.js` — mission commands, projections, and durable operation coordination.
- Create `apps/api/src/missions/routes.js` — bounded HTTP routing and schemas.
- Create `apps/api/src/missions/index.js` — narrow composition/export surface.
- Modify `apps/api/src/server.js`, `apps/api/src/index.js`, and `apps/api/src/index.d.ts` — mount/inject the mission service.
- Create focused tests under `apps/api/test/missions-*.test.mjs`.

### Escrow and reconciliation

- Create `packages/contracts/src/missions/MissionTypes.sol` — bounded manifest structs and shared constants.
- Create `packages/contracts/src/missions/VersionRegistry.sol` — future-vault-only version control.
- Create `packages/contracts/src/missions/MissionEscrowFactory.sol` — EIP-712 signer/nonce validation and CREATE2 deployment.
- Create `packages/contracts/src/missions/MissionEscrowV1.sol` — immutable accounting, approvals, releases, disputes, timeout settlement, and refunds.
- Create `packages/contracts/test/mission-escrow-*.test.mjs` — fast compile/deploy/unit/security tests.
- Create `packages/contracts/foundry.toml` and `packages/contracts/foundry-test/MissionEscrowInvariant.t.sol` — fuzz/invariant gate.
- Create `packages/contracts/scripts/compile-mission-escrow.js` and `packages/contracts/scripts/deploy-mission-escrow-local.js`.
- Modify `packages/contracts/package.json` — mission compile/test scripts.
- Create `apps/api/src/missions/manifest.js`, `chain-reconciler.js`, and `receipts.js` — typed data, finalized chain projection, and signed evidence codec.

### ID Agents, XMTP, and launch orchestration

- Create `apps/api/src/missions/id-agents-release.json` — exact upstream repository, commit/package/schema/source hashes, license notice.
- Create `apps/api/src/missions/id-agents-gateway.js` — typed grant validation and smallest-call adapter.
- Create `apps/api/src/missions/id-agents-artifacts.js` — path-safe bounded artifact reads.
- Create `apps/api/src/missions/runtime-isolation.js` — deterministic container/process policy and startup proof checks.
- Create `apps/api/src/missions/xmtp-groups.js` — exact member/permission commitments and recovery by signed mission marker.
- Create `apps/api/src/missions/xmtp-outbox.js` — durable deduplicated event delivery.
- Create `apps/api/src/missions/launch-coordinator.js` — reserve/reconcile/provision/bind/tasks/commit state machine.
- Modify `apps/api/src/xmtp-agent/index.js` only to expose generic group sync, lookup, metadata, membership, and permission primitives; mission policy stays in `missions/xmtp-groups.js`.

### Console and proof

- Create `apps/web/src/missions/api.js`, `domain.js`, `mission-board.js`, `mission-editor.js`, `mission-recruiting.js`, `mission-workspace.js`, and `mission-settlement.js`.
- Modify `apps/web/src/multipass-console.js`, `apps/web/src/route-manager.js`, and `apps/web/src/styles.css` to add mission routes and responsive surfaces.
- Create corresponding `apps/web/test/missions-*.test.mjs` plus `apps/web/test/missions-browser.test.mjs`.
- Create `scripts/missions/run-local-proof.mjs` and `docs/runbooks/looper-missions-*.md` for reproducible proof, recovery, arbitration, and release gates.

---

## Chunk 1: Shared contract and durable ledger

### Task 1: Lock the mission lifecycle contract

**Files:**
- Create: `packages/types/src/missions.js`
- Create: `packages/types/src/missions.d.ts`
- Create: `packages/types/test/missions.test.mjs`
- Modify: `packages/types/src/index.js`
- Modify: `packages/types/src/index.d.ts`

- [ ] **Step 1: Write the failing lifecycle test**

Assert exact mission, launch, vault, milestone, task, and source enums; exact allowed transitions; terminal monotonicity; and immutable exported arrays. Include failures for `funded -> active`, `released -> disputed`, and unknown state names.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test packages/types/test/missions.test.mjs`  
Expected: FAIL because the mission exports do not exist.

- [ ] **Step 3: Implement the minimal closed contract**

Export frozen values and fail-closed helpers:

`missionStates`, `launchStates`, `vaultStates`, `milestoneStates`, `taskStates`, `missionSourceLabels`, `missionLimits`, `canTransitionMission`, `canTransitionLaunch`, `canTransitionMilestone`, and `assertMissionBound`.

The implementation must encode the specification exactly and must not conflate a milestone dispute with mission lifecycle.

- [ ] **Step 4: Run focused and shared-type tests**

Run: `node --test packages/types/test/missions.test.mjs packages/types/test/schema-contract.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

`git add packages/types && git commit -m "feat: define Looper mission lifecycle contract"`

### Task 2: Create the dedicated STRICT mission database

**Files:**
- Create: `apps/api/src/missions/database.js`
- Create: `apps/api/test/missions-database.test.mjs`

- [ ] **Step 1: Write schema tests**

Require WAL, foreign keys, configurable busy timeout, `integrity_check=ok`, schema-version fail-closed behavior, mode 0600, and STRICT tables for missions, revisions, applications, members, milestones, allocations, vaults, operations, runtime bindings, tasks, artifacts, XMTP bindings/locks/outbox/dedup, disputes, chain events, outcome receipts, CRED publication, and append-only events.

- [ ] **Step 2: Run RED**

Run: `node --test apps/api/test/missions-database.test.mjs`  
Expected: FAIL because `createMissionDatabase` does not exist.

- [ ] **Step 3: Implement schema and narrow transaction API**

Follow `apps/api/src/restap-network/database.js`: one owner connection, prepared parameter binding, named transactions, rollback on throw, read-only inspection methods, no arbitrary mutation API, additive schema version 1, and canonical millisecond timestamps.

- [ ] **Step 4: Prove rollback and restart**

Add tests that crash between mission mutation and event append, reopen the file, and prove neither partial state nor duplicate operation survives.

- [ ] **Step 5: Run focused test and commit**

Run: `node --test apps/api/test/missions-database.test.mjs`  
Expected: PASS.  
Commit: `git add apps/api/src/missions/database.js apps/api/test/missions-database.test.mjs && git commit -m "feat: add durable mission ledger schema"`

### Task 3: Add repository, revisions, idempotency, and append-only events

**Files:**
- Create: `apps/api/src/missions/repository.js`
- Create: `apps/api/src/missions/idempotency.js`
- Create: `apps/api/test/missions-repository.test.mjs`
- Create: `apps/api/test/missions-idempotency.test.mjs`

- [ ] **Step 1: Test expected-revision writes and canonical retry behavior**

Cover same key/body returning the stored response; same key/different canonical body failing; stale revision failing; event ordering; immutable historical revisions; and no plaintext XMTP body, prompt, credential, signature, or artifact content fields.

- [ ] **Step 2: Run RED**

Run: `node --test apps/api/test/missions-repository.test.mjs apps/api/test/missions-idempotency.test.mjs`.

- [ ] **Step 3: Implement canonical SHA-256 body digests and repository transactions**

Canonicalization must reject unsupported JSON values, normalize object-key order, preserve array order, and hash raw integer token amounts as decimal strings rather than JavaScript numbers.

- [ ] **Step 4: Run focused tests and commit**

Expected: PASS.  
Commit: `git add apps/api/src/missions apps/api/test/missions-repository.test.mjs apps/api/test/missions-idempotency.test.mjs && git commit -m "feat: add mission revisions and idempotent operations"`

### Task 4: Implement lifecycle, role, and custody rules

**Files:**
- Create: `apps/api/src/missions/domain.js`
- Create: `apps/api/test/missions-domain.test.mjs`

- [ ] **Step 1: Write table-driven RED tests**

Cover draft/recruit/team/funding/launch/review/settled transitions, role matrix, owner/lead distinctness, transfer-stable payout and approval addresses, ERC-6551 exclusion, fresh custody checks at every named boundary, and transfer-induced work/review pause without authority transfer.

- [ ] **Step 2: Implement pure fail-closed decisions**

Return explicit decisions/errors; never consult chat, model output, mutable NFT ownership, or CRED amount as settlement authority.

- [ ] **Step 3: Run and commit**

Run: `node --test apps/api/test/missions-domain.test.mjs`  
Expected: PASS.  
Commit: `git add apps/api/src/missions/domain.js apps/api/test/missions-domain.test.mjs && git commit -m "feat: enforce mission authority and custody rules"`

---

## Chunk 2: Immutable escrow

### Task 5: Define bounded manifest and version registry

**Files:**
- Create: `packages/contracts/src/missions/MissionTypes.sol`
- Create: `packages/contracts/src/missions/VersionRegistry.sol`
- Create: `packages/contracts/test/mission-version-registry.test.mjs`
- Create: `packages/contracts/scripts/compile-mission-escrow.js`
- Modify: `packages/contracts/package.json`

- [ ] **Step 1: Write compile/ABI/authorization tests**

Assert exact bounds (2 assets, 8 recipients, 12 milestones, 8 payouts per asset/milestone), version statuses, timelocked activation/retirement, emergency pause of new creation only, and zero registry fund-moving surface.

- [ ] **Step 2: Run RED**

Run: `pnpm --filter @helixa/loopers-contracts test -- mission-version-registry`.

- [ ] **Step 3: Implement with constructor-bound Safe/timelock roles**

Store creation-code hash, expected runtime-code hash, supported token addresses, activation/retirement times, and factory compatibility. Existing vaults never consult the registry for payout behavior.

- [ ] **Step 4: Compile, test, and commit**

Run: `pnpm --filter @helixa/loopers-contracts compile:missions && node --test packages/contracts/test/mission-version-registry.test.mjs`.  
Expected: PASS.  
Commit: `git add packages/contracts && git commit -m "feat: add mission vault version registry"`

### Task 6: Implement CREATE2 factory and atomic EIP-712 manifest consent

**Files:**
- Create: `packages/contracts/src/missions/MissionEscrowFactory.sol`
- Create: `packages/contracts/test/mission-escrow-factory.test.mjs`
- Create: `apps/api/src/missions/manifest.js`
- Create: `apps/api/test/missions-manifest.test.mjs`

- [ ] **Step 1: Write RED tests for typed-data parity and replay isolation**

Cover chain/factory/version/vault/terms binding, predicted address, owner + every selected controller + lead approval address + every distinct recipient signature, EOA/ERC-1271, per-signer nonce, expiry, duplicate signer collapse, wrong signer, reentrant 1271 callback, and full rollback of nonce/manifest consumption on any failure.

- [ ] **Step 2: Implement the canonical manifest codec first**

Use raw decimal strings offchain and uint256 onchain. The Node helper and Solidity type hash must produce identical digest fixtures.

- [ ] **Step 3: Implement guarded factory validation and deployment**

Validate all bounds/totals/addresses before external signature callbacks; mark nonces consumed inside the reverting transaction; deploy full code with CREATE2; verify expected runtime code hash; emit complete public commitments.

- [ ] **Step 4: Run and commit**

Run both focused tests; Expected: PASS.  
Commit: `git add packages/contracts apps/api/src/missions/manifest.js apps/api/test/missions-manifest.test.mjs && git commit -m "feat: deploy consented mission vaults deterministically"`

### Task 7: Implement exact funding and launch activation

**Files:**
- Create: `packages/contracts/src/missions/MissionEscrowV1.sol`
- Create: `packages/contracts/test/mission-escrow-funding.test.mjs`
- Create: `packages/contracts/test/fixtures/MissionEscrowTokens.sol`

- [ ] **Step 1: Write RED funding tests**

Cover owner-only deposits, one/two assets, balance-delta equality, internal liabilities, under/overfunding, fee-on-transfer, malicious callback, unsolicited direct transfer, bounded excess recovery only to refund address, partial-funding deadline refund, dual launch approval, unlaunched timeout refund, and state-before-transfer reentrancy resistance.

- [ ] **Step 2: Implement minimal funding/activation code**

No proxy, clone, delegatecall, arbitrary call, fallback execution, admin withdrawal, supported-asset sweep, or mutable recipients/allocations.

- [ ] **Step 3: Run focused tests and commit**

Run: `node --test packages/contracts/test/mission-escrow-funding.test.mjs`  
Expected: PASS.  
Commit: `git add packages/contracts && git commit -m "feat: fund and activate immutable mission vaults"`

### Task 8: Implement milestones, disputes, timeout allocations, and invariants

**Files:**
- Create: `packages/contracts/test/mission-escrow-settlement.test.mjs`
- Create: `packages/contracts/test/mission-escrow-security.test.mjs`
- Create: `packages/contracts/foundry.toml`
- Create: `packages/contracts/foundry-test/MissionEscrowInvariant.t.sol`
- Modify: `packages/contracts/src/missions/MissionEscrowV1.sol`

- [ ] **Step 1: Write RED settlement/security tests**

Cover artifact+payout-bound dual approvals in either order, release, dispute freeze, owner+lead joint settlement, arbitrator destination/amount bounds, delivery timeout, review-to-dispute deadline, dispute timeout, terminal monotonicity, independent milestones, and exact direct payouts.

- [ ] **Step 2: Implement the smallest state machine satisfying tests**

Every external transfer follows effects-before-interactions under non-reentrancy. Permissionless timeout callers choose neither recipients nor amounts.

- [ ] **Step 3: Add fuzz/invariants**

Prove per asset: released + refunded + remaining = funded; every destination is predeclared; no terminal milestone settles twice; no signature succeeds twice; admin has no withdrawal path.

- [ ] **Step 4: Run all contract gates and commit**

Run: `pnpm --filter @helixa/loopers-contracts test` and `forge test --root packages/contracts` when Forge is available.  
Expected: PASS; if Forge is unavailable, record that toolchain blocker and do not claim the invariant gate passed.  
Commit: `git add packages/contracts && git commit -m "feat: settle mission milestones with bounded disputes"`

---

## Chunk 3: Service, chain, runtime, and messaging

### Task 9: Build mission commands and privacy-safe projections

**Files:**
- Create: `apps/api/src/missions/service.js`
- Create: `apps/api/src/missions/routes.js`
- Create: `apps/api/src/missions/index.js`
- Create: `apps/api/test/missions-service.test.mjs`
- Create: `apps/api/test/missions-routes.test.mjs`
- Create: `apps/api/test/missions-privacy.test.mjs`
- Modify: `apps/api/src/server.js`, `apps/api/src/index.js`, `apps/api/src/index.d.ts`

- [ ] **Step 1: Write RED service/route tests**

Cover public list/detail, authenticated create/update/publish/cancel/apply/withdraw/select/read-sign/fund/reconcile/workspace/task/artifact/approve/release/dispute routes, body caps, exact keys, session/Origin/CSRF conventions, revision/idempotency headers, and current-wallet role checks.

- [ ] **Step 2: Implement service commands against repository/domain ports**

Inject custody, chain, runtime, and XMTP dependencies. Public projections must omit applications, private scope, contact data, conversation IDs, manager locations, internal IDs, and evidence under review.

- [ ] **Step 3: Run API regression and commit**

Run: `node --test apps/api/test/missions-*.test.mjs apps/api/test/server.test.mjs`  
Expected: PASS.  
Commit: `git add apps/api && git commit -m "feat: expose authenticated mission API"`

### Task 10: Reconcile chain state and issue settlement receipts

**Files:**
- Create: `apps/api/src/missions/chain-reconciler.js`
- Create: `apps/api/src/missions/receipts.js`
- Create: `apps/api/src/missions/cred-evidence.js`
- Create: `apps/api/test/missions-chain-reconciler.test.mjs`
- Create: `apps/api/test/missions-receipts.test.mjs`
- Create: `apps/api/test/missions-cred-evidence.test.mjs`

- [ ] **Step 1: Write RED confirmation/reorg/evidence tests**

Require two-provider canonical agreement, confirmation depth, codehash/token pin checks, idempotent log ingestion, duplicate/reordered logs, reorg rollback to last canonical projection, no false funded/active/settled state, and CRED evidence only after finalized settlement.

- [ ] **Step 2: Implement cursor-based reconciliation and signed receipt codec**

Persist transaction/log identity and canonical block hash. Bind contribution-time custody epoch and real outcome; exclude bounty amount as direct score input.

- [ ] **Step 3: Run and commit**

Run focused tests; Expected: PASS.  
Commit: `git add apps/api/src/missions apps/api/test/missions-*.test.mjs && git commit -m "feat: reconcile mission escrow outcomes"`

### Task 11: Pin and contain ID Agents behind a typed gateway

**Files:**
- Create: `apps/api/src/missions/id-agents-release.json`
- Create: `apps/api/src/missions/id-agents-gateway.js`
- Create: `apps/api/src/missions/id-agents-artifacts.js`
- Create: `apps/api/src/missions/runtime-isolation.js`
- Create: `apps/api/test/missions-id-agents-gateway.test.mjs`
- Create: `apps/api/test/missions-id-agents-artifacts.test.mjs`
- Create: `apps/api/test/missions-runtime-isolation.test.mjs`

- [ ] **Step 1: Record the reviewed upstream pin**

Verify repository URL, commit, MIT license, package/config/RESTAP versions, and hashes from Premm’s source. Do not guess or silently advance the pin.

- [ ] **Step 2: Write RED gateway/isolation tests**

Cover short-lived signed service grants, typed allowlist, exact mission/manager/release/team/agent/task binding, replay/expiry/body-hash rejection, non-loopback manager rejection, generic `/remote`/shell/traversal rejection, cross-mission denial, worker-to-manager control-plane denial, brokered credentials, quotas, and kill switch.

- [ ] **Step 3: Implement typed operations and bounded polling**

Implement only `provisionMissionTeam`, `readMissionHealth`, `createMissionTask`, `assignMissionTask`, `sendMissionInstruction`, `readMissionNews`, `listMissionOutputs`, `readMissionArtifact`, `pauseMission`, and `terminateMission`.

- [ ] **Step 4: Implement artifact boundary tests/code**

Resolve beneath the mission output root; reject symlinks/devices/sockets/traversal/hard-link surprises; cap file count/bytes; hash without executing.

- [ ] **Step 5: Run and commit**

Run focused tests; Expected: PASS.  
Commit: `git add apps/api/src/missions apps/api/test/missions-*.test.mjs && git commit -m "feat: contain pinned ID Agents missions"`

### Task 12: Add crash-safe private XMTP mission groups

**Files:**
- Create: `apps/api/src/missions/xmtp-groups.js`
- Create: `apps/api/src/missions/xmtp-outbox.js`
- Create: `apps/api/test/missions-xmtp-groups.test.mjs`
- Create: `apps/api/test/missions-xmtp-outbox.test.mjs`
- Modify: `apps/api/src/xmtp-agent/index.js`

- [ ] **Step 1: Write RED creation/recovery tests**

Cover exact normalized identifier set + bridge, synchronized cryptographic membership, closed permissions, bridge admin, unique signed marker, durable exclusive lock, ambiguous-create recovery, unexpected candidate/member rejection, fixed membership, and no second room while ambiguity exists.

- [ ] **Step 2: Write RED outbox/loop tests**

Cover closed event types, deterministic deduplication, crash after send/before commit, restart, cursor persistence, own-message ignore, non-conversational system markers, and zero plaintext message storage/logging.

- [ ] **Step 3: Expose generic XMTP primitives and implement mission policy**

Keep existing holder chat behavior unchanged. Free-form chat remains non-authoritative; only read-only explicit commands may return data.

- [ ] **Step 4: Run existing plus mission XMTP suites and commit**

Run: `node --test apps/api/test/xmtp-agent.test.mjs apps/api/test/xmtp-worker.test.mjs apps/api/test/missions-xmtp-*.test.mjs`  
Expected: PASS.  
Commit: `git add apps/api && git commit -m "feat: bind crash-safe XMTP mission rooms"`

### Task 13: Orchestrate recoverable launch

**Files:**
- Create: `apps/api/src/missions/launch-coordinator.js`
- Create: `apps/api/test/missions-launch-coordinator.test.mjs`

- [ ] **Step 1: Write RED phase-boundary crash tests**

For every boundary—reservation, runtime provisioning, runtime verification, room creation, membership verification, task creation, commitment, and dual activation—simulate process death and prove read-before-write retry produces one manager/team/workspace, one room, and one task set.

- [ ] **Step 2: Implement exact launch operation states**

Use `not_started -> reserved -> provisioning -> runtime_ready -> room_ready -> tasks_ready -> committed`, plus `failed_retryable` and `expired_refundable`. Agents receive executable work only after onchain dual launch approval.

- [ ] **Step 3: Run and commit**

Run: `node --test apps/api/test/missions-launch-coordinator.test.mjs`  
Expected: PASS.  
Commit: `git add apps/api/src/missions/launch-coordinator.js apps/api/test/missions-launch-coordinator.test.mjs && git commit -m "feat: orchestrate recoverable mission launch"`

---

## Chunk 4: Console and end-to-end proof

### Task 14: Add mission client/domain adapters

**Files:**
- Create: `apps/web/src/missions/api.js`
- Create: `apps/web/src/missions/domain.js`
- Create: `apps/web/test/missions-api.test.mjs`
- Create: `apps/web/test/missions-domain.test.mjs`

- [ ] **Step 1: Write RED tests for exact request/response handling**

Cover revision/idempotency headers, wallet/session credentials, raw integer amount strings, typed failure states, stale source labels, and zero internal identifier leakage.

- [ ] **Step 2: Implement narrow API methods and view models**

No component constructs ad-hoc routes or decides authoritative chain/runtime state.

- [ ] **Step 3: Run and commit**

Run focused tests; Expected: PASS.  
Commit: `git add apps/web/src/missions apps/web/test/missions-*.test.mjs && git commit -m "feat: add mission Console client"`

### Task 15: Build board, creation, and recruiting flows

**Files:**
- Create: `apps/web/src/missions/mission-board.js`
- Create: `apps/web/src/missions/mission-editor.js`
- Create: `apps/web/src/missions/mission-recruiting.js`
- Create: `apps/web/test/missions-board.test.mjs`
- Create: `apps/web/test/missions-editor.test.mjs`
- Create: `apps/web/test/missions-recruiting.test.mjs`
- Modify: `apps/web/src/multipass-console.js`, `apps/web/src/route-manager.js`, `apps/web/src/styles.css`

- [ ] **Step 1: Write RED rendering/interaction tests**

Require bounded cards, truthful funding labels, roles/deadlines, raw-address/token-decimal confirmation, milestone allocation validation, applicant evidence freshness, payout signature state, keyboard focus, and responsive no-overflow behavior.

- [ ] **Step 2: Implement accessible focused modules**

Reuse current Console shell and wallet client; do not expose unrevealed Looper art or internal runtime topology.

- [ ] **Step 3: Run web regression and commit**

Run focused tests plus `pnpm --filter @helixa/multipass-web build`; Expected: PASS.  
Commit: `git add apps/web && git commit -m "feat: add mission board and recruiting"`

### Task 16: Build workspace, settlement, dispute, and refund flows

**Files:**
- Create: `apps/web/src/missions/mission-workspace.js`
- Create: `apps/web/src/missions/mission-settlement.js`
- Create: `apps/web/test/missions-workspace.test.mjs`
- Create: `apps/web/test/missions-settlement.test.mjs`
- Create: `apps/web/test/missions-browser.test.mjs`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Write RED source-of-truth and wallet-action tests**

Show chat, tasks, agents, artifacts, milestones, funding, blockers, approvals, disputes, and receipts with explicit source labels. Require transaction simulation and exact immutable recipient allocation before wallet prompts; never equate payment with CRED gain.

- [ ] **Step 2: Implement components and browser fixtures**

Include failure/retry, custody change, degraded source, launch timeout, dispute, timeout settlement, refund, and finalized success states.

- [ ] **Step 3: Capture desktop/390/320 browser proof**

Verify focus behavior, no horizontal overflow, and no secret/internal identifiers.

- [ ] **Step 4: Run and commit**

Run focused tests and production build; Expected: PASS.  
Commit: `git add apps/web && git commit -m "feat: add mission workspace and settlement"`

### Task 17: Produce the integrated local proof and operations package

**Files:**
- Create: `scripts/missions/run-local-proof.mjs`
- Create: `docs/runbooks/looper-missions-local-proof.md`
- Create: `docs/runbooks/looper-missions-security.md`
- Create: `docs/runbooks/looper-missions-recovery.md`
- Create: `docs/runbooks/looper-missions-arbitration.md`
- Create: `docs/runbooks/looper-missions-testnet-release.md`
- Create: `review-artifacts/looper-missions/local-proof/.gitkeep`

- [ ] **Step 1: Write the proof harness assertions**

The script must create/publish/select, deploy/fund both mock assets, launch one real pinned local ID Agents team, create/recover one XMTP dev group, execute tasks/artifacts, dual-approve/release exact payouts, exercise dispute and refund paths, and emit a manifest of hashes/transactions/test results/screenshots.

- [ ] **Step 2: Rehearse failure paths**

Include partial funding, ambiguous vault creation, runtime timeout, room ambiguity, custody transfer, reorg simulation, arbitrator unavailable until timeout, and restart recovery.

- [ ] **Step 3: Run full gates**

Run: `pnpm test`, `pnpm web:build`, contract compile/unit tests, Foundry fuzz/invariants, mission local proof, syntax/diff checks, and a secret/path scan.  
Expected: all required gates PASS; any unavailable external environment is recorded as a named blocker, not waived.

- [ ] **Step 4: Perform direct implementation review**

Because subagents are currently disabled by user preference, review the diff directly against every specification acceptance criterion and record evidence paths in the proof packet. If Quigley re-enables subagents, add independent contract and implementation review before testnet.

- [ ] **Step 5: Commit proof package**

`git add scripts/missions docs/runbooks review-artifacts/looper-missions && git commit -m "test: prove Looper Missions local lifecycle"`

---

## Final verification checklist

- [ ] Every acceptance criterion in the approved specification has a test or proof artifact.
- [ ] No mainnet deployment or real-fund action was performed.
- [ ] Contract authority never follows mutable Looper NFT ownership.
- [ ] Runtime/XMTP text cannot mutate escrow or authoritative mission state.
- [ ] Existing vault execution cannot be changed by registry/factory/admin evolution.
- [ ] All retryable operations reconcile before create/send/deposit.
- [ ] Public projections and logs contain no secrets, private content, or internal topology.
- [ ] Full regression, build, contract, browser, and secret-scan gates pass.
