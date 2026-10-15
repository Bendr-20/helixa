# Looper Provisional CRED and Pantheon Vault Evidence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish 40/Marginal/PROVISIONAL records for every verified activated Looper and prospectively score amount-independent Pantheon lifecycles up to 55.

**Architecture:** A production-isolated CommonJS package builds a signed identity manifest from the live activated roster, observes finalized Pantheon state through two RPCs, materializes immutable lifecycle events, and atomically publishes SQLite generations. A narrow Helixa router and Multipass consumer expose status-rich records; legacy AgentDNA/Terminal/oracle and the shadow scorer remain untouched.

**Tech Stack:** Node.js, `node:test`, `better-sqlite3`, Ed25519/sha256, Base JSON-RPC, Express router factory, systemd.

**Design:** `docs/superpowers/specs/2026-10-15-looper-provisional-cred-vault-evidence-design.md`

---

## Chunk 1: Identity, authority, and policy

### Task 1: Canonical primitives and live activation source
**Files:** Create `api/cred-looper-provisional/canonical.js`, `activation-source.js`; test `api/test/cred-looper-provisional/activation-source.test.js`.
- [ ] Test the exact live schema at `/var/www/helixa.xyz/multipass/data/looper-activated-roster.json`: Base 8453, collection, implementation, observed block/time, count, unique canonical IDs, max 10,000, freshness, and monotonic predecessor count.
- [ ] Run `cd api && node --test test/cred-looper-provisional/activation-source.test.js`; expect module-not-found.
- [ ] Implement closed validators and domain-separated canonical hashing; no network/database access.
- [ ] Rerun the exact command; expect PASS.
- [ ] Commit `feat: validate activated Looper sources`.

### Task 2: Produce activation account-proof snapshots
**Files:** Create `api/cred-looper-provisional/account-proof-collector.js`, `api/scripts/collect-looper-provisional-proofs.js`; test `account-proof-collector.test.js`.
- [ ] Test deterministic ERC-6551 derivation from each activation token ID, up to 10,000 rows, finalized dual-RPC agreement for account code/`owner()`/`token()`, complete coverage, and exclusive canonical output.
- [ ] Run `cd api && node --test test/cred-looper-provisional/account-proof-collector.test.js`; expect FAIL.
- [ ] Implement the standalone collector and CLI `node scripts/collect-looper-provisional-proofs.js --activation-source <path> --providers <path> --output <path>`.
- [ ] Rerun; expect PASS; live invocation must produce exactly the current signed activation count.
- [ ] Commit `feat: collect activated Looper account proofs`.

### Task 3: Build, sign, and verify identity manifests
**Files:** Create `api/cred-looper-provisional/manifest.js`, `manifest-builder.js`, `api/scripts/build-looper-provisional-manifest.js`; test `manifest.test.js`, `manifest-cli.test.js`.
- [ ] Test conversion from activation source + fresh proof snapshot, activation source hashes, token/account/owner/code/token-binding rows, actor epochs, predecessor linkage, 30-hour expiry, overlapping key rotation, Ed25519 signing, tamper rejection, and explicit eligibility reason codes.
- [ ] Run `cd api && node --test test/cred-looper-provisional/manifest.test.js test/cred-looper-provisional/manifest-cli.test.js`; expect FAIL.
- [ ] Implement offline builder/verifier and strict CLI `--activation-source --proof-snapshot --private-key-file --output [--previous-manifest]`; cap 10,000.
- [ ] Rerun; expect PASS and byte-identical repeated builds.
- [ ] Commit `feat: build signed Looper CRED manifests`.

### Task 4: Read authoritative status and quarantine legacy conflicts
**Files:** Create `api/cred-looper-provisional/authority.js`; test `authority.test.js`.
- [ ] Test closed signed `cred-authoritative-records-v1` schema (issuer/key epochs, generatedAt, 30-hour expiry, predecessor hash and subject/status/methodology rows), precedence SUSPENDED > RATED > PROVISIONAL > UNRATED, a signed launch declaration that no RATED/SUSPENDED Looper source exists, and read-only detection of legacy Looper numeric rows without methodology/status.
- [ ] Run `cd api && node --test test/cred-looper-provisional/authority.test.js`; expect FAIL.
- [ ] Add strict CLI `node scripts/build-looper-cred-authority.js --source <path|none> --private-key-file <0600 path> --output <path>` and pin the public key through deployment config.
- [ ] Implement read-only authority loading; never infer RATED from legacy numerics; return conflict reason codes for the launch report.
- [ ] Rerun; expect PASS.
- [ ] Commit `feat: enforce Looper CRED authority precedence`.

### Task 5: Deterministic 40→55 policy
**Files:** Create `api/cred-looper-provisional/policy.js`; test `policy.test.js`.
- [ ] Test baseline 40, +2/+2/+3/+6 distinct events, +15 cap, -8/-5/-3 request-time penalties, no double penalty, earned milestone retention, epoch scope/reset, 0 floor, 55 ceiling, top-up/sponsorship/amount neutrality, and authority precedence.
- [ ] Include principal vectors 1, 10^18, 10^30, uint256 max; all must score identically.
- [ ] Run `cd api && node --test test/cred-looper-provisional/policy.test.js`; expect FAIL.
- [ ] Implement pure `scoreProvisionalActor` returning null confidence/coverage/effectivePrivilegeTier.
- [ ] Rerun; expect PASS.
- [ ] Commit `feat: score provisional Looper CRED`.

## Chunk 2: Pantheon observation

### Task 6: Decode and pin Pantheon contracts
**Files:** Create `api/cred-looper-provisional/pantheon-codec.js`; test `pantheon-codec.test.js`.
- [ ] Test the exact nine-word tuple, exact 288 bytes, CRED/vault/chain pins, EIP-1967 slot, proxy hash, implementation address/hash, ABI manifest hash, pool `active=true` and `cliffMonths=0` (totalStaked is dynamic), CRED code hash `sha256:f2127e5735da92360dab1141c47ec73737d639c25b56c1107d7ebec29dd66390`, ABI-manifest hash `sha256:8122bbbf68dca8cdf4f04ec8a4fcd75814a12bf900fcfad724a4179641fb5860`, and all malformed inputs.
- [ ] Run `cd api && node --test test/cred-looper-provisional/pantheon-codec.test.js`; expect FAIL.
- [ ] Implement strict encoders/decoders and immutable pins from the approved design.
- [ ] Rerun; expect PASS.
- [ ] Commit `feat: pin Pantheon CRED protocol`.

### Task 7: Classify lifecycle transitions
**Files:** Create `api/cred-looper-provisional/lifecycle.js`; test `lifecycle.test.js`.
- [ ] Test NONE/ACTIVE/TOPPED_UP/EXIT_REQUESTED/EXITED/MATURED/CLOSED/AUTO_RESTAKED/reopened lifecycle, auto-restake quarantined pending published Pantheon semantics, six-month eligibility, 30/90/completion milestones across checkpoints, post-maturity neutral exit, cooldown/restake, cumulative lifecycle penalties, preexisting-position zero retroactivity, fundingAttribution persistence, custody freeze, and unsupported emergency quarantine.
- [ ] Run `cd api && node --test test/cred-looper-provisional/lifecycle.test.js`; expect FAIL.
- [ ] Implement pure transition and event materialization with stable IDs and exactly-once milestone keys.
- [ ] Rerun; expect PASS.
- [ ] Commit `feat: materialize Pantheon lifecycles`.

### Task 8: Collect finalized dual-RPC snapshots
**Files:** Create `api/cred-looper-provisional/collector.js`; test `collector.test.js`.
- [ ] Test exactly two distinct pinned hosts, Base chain, common finalized block with ≥20 confirmations, block/hash/time agreement, account `owner()/token()/code`, proxy/implementation/CRED/pool checks, complete tuple agreement, bounded batches/responses/timeouts, and partial-roster rejection.
- [ ] Run `cd api && node --test test/cred-looper-provisional/collector.test.js`; expect FAIL.
- [ ] Implement the bounded transport using established `cred-looper`/`cred-payments` patterns.
- [ ] Rerun; expect PASS.
- [ ] Commit `feat: collect finalized Pantheon positions`.

### Task 9: Immutable lineage
**Files:** Create `api/cred-looper-provisional/artifact.js`; test `artifact.test.js`.
- [ ] Test inception, contiguous predecessor hashes, trusted external continuity anchors, complete manifest/snapshot commitments, stable event IDs, replay limits, and byte-identical repeated builds.
- [ ] Run `cd api && node --test test/cred-looper-provisional/artifact.test.js`; expect FAIL.
- [ ] Implement closed checkpoint/artifact/anchor schemas and materialization.
- [ ] Rerun; expect PASS.
- [ ] Commit `feat: chain Pantheon lifecycle artifacts`.

### Task 10: Signed deep-reorg recovery
**Files:** Create `api/cred-looper-provisional/recovery.js`; test `recovery.test.js`.
- [ ] Define and test `looper-cred-recovery-decision-v1` (plan hash, ancestor, reason, issuedAt, keyId, Ed25519 signature), two-provider ancestry walk, cursor/publication freeze, unchanged validUntil, bounded common-ancestor search, signed operator decision, orphan revocations, baseline fallback, mandatory reviewed new inception, and rejection of unsigned recovery.
- [ ] Run `cd api && node --test test/cred-looper-provisional/recovery.test.js`; expect FAIL.
- [ ] Implement recovery plan generation/verification only; publication ordering is tested in Task 12.
- [ ] Rerun; expect PASS.
- [ ] Commit `feat: verify Pantheon reorg recovery`.

## Chunk 3: Persistence and operations

### Task 11: Atomic generation store
**Files:** Create `api/cred-looper-provisional/store.js`; test `store.test.js`.
- [ ] Test immutable generation/record schemas, all status-rich fields, active pointer, transaction rollback/fault injection, historical reads, 48-hour staleness, and pointer rollback.
- [ ] Run `cd api && node --test test/cred-looper-provisional/store.test.js`; expect FAIL.
- [ ] Implement `cred_generations`, `cred_records`, `cred_active_generation`; one immediate transaction flips the pointer.
- [ ] Rerun; expect PASS.
- [ ] Commit `feat: persist Looper CRED generations`.

### Task 12: Runner core
**Files:** Create `api/cred-looper-provisional/runner.js`, `index.js`; test `runner.test.js`.
- [ ] Test bootstrap/follow-up/validate/publish/recover flows, dry-run default, exact eligible/conflict counts, preexisting baseline, manifest expiry, no cursor advance on failure, no validUntil extension, and non-target file hashes unchanged.
- [ ] Test recovery transaction order: revoke/recompute generation atomically becomes active before replacement-chain effects.
- [ ] Run `cd api && node --test test/cred-looper-provisional/runner.test.js`; expect FAIL.
- [ ] Implement orchestration with dependency injection and no CLI parsing.
- [ ] Rerun; expect PASS.
- [ ] Commit `feat: orchestrate Looper provisional CRED`.

### Task 13: Strict operations CLI
**Files:** Create `api/scripts/operate-looper-provisional-cred.js`; modify `api/package.json`; test `cli.test.js`.
- [ ] Test exact/duplicate flags, absolute safe paths, symlink/overwrite rejection, lock contention, secret-free output, exit codes, and commands `manifest-build bootstrap follow-up validate publish recover status`.
- [ ] Run `cd api && node --test test/cred-looper-provisional/cli.test.js`; expect FAIL.
- [ ] Implement CLI and scripts `test:cred-looper-provisional`, `cred:looper-provisional`.
- [ ] Rerun; expect PASS.
- [ ] Commit `feat: add Looper CRED operations CLI`.

## Chunk 4: Evidence and public consumers

### Task 14: Offline vNext lifecycle adapter
**Files:** Create `api/cred-evidence/pantheon-lifecycle-adapter.js`; modify `api/cred-evidence/adapters.js`; test `api/test/cred-evidence/pantheon-lifecycle-adapter.test.js`.
- [ ] Test `pantheon-position-lifecycle-1.0.0`, no network access, one provider/control group, score-eligible open/duration/completion/exit only, top-ups/unclassified transitions excluded from mass/confidence/coverage/diversity/age, and correction/revocation references.
- [ ] Run `cd api && node --test test/cred-evidence/pantheon-lifecycle-adapter.test.js`; expect FAIL.
- [ ] Implement adapter registration without changing candidate methodology parameters or production imports.
- [ ] Rerun plus `cd api && npm run test:cred-evidence && npm run test:cred-shadow`; expect PASS.
- [ ] Commit `feat: adapt Pantheon lifecycles for CRED shadow`.

### Task 15: Testable Helixa router and service
**Files:** Create `api/services/looper-provisional-cred.js`, `api/routes/looper-cred.js`; modify `api/v2-server.js`; test `api/test/cred-looper-provisional/api.test.js`.
- [ ] Test router factory independently: `GET /api/v2/looper/:id/cred`, `GET /api/v2/loopers/cred`, extended fields, status filter/sort, stale state, store-unconfigured 503, and null privilege.
- [ ] Run `cd api && node --test test/cred-looper-provisional/api.test.js`; expect FAIL.
- [ ] Implement read-only service + `createLooperCredRouter({storePath,now})`; mount one router in `v2-server.js` without refactoring server startup.
- [ ] Add static/behavior regressions proving existing `/api/v2/agent/:id/cred`, Terminal SQL, oracle paths, and canonical sync are unchanged.
- [ ] Run the route test, `cd api && node --check v2-server.js`, and canonical-sync tests; expect PASS.
- [ ] Commit `feat: expose status-aware Looper CRED`.

### Task 16: Multipass consumer in its own clean worktree
**Files (`Bendr-20/multipass`):** Modify `apps/api/src/loopers-owned-agents.js`, `apps/web/src/live-helixa-resolver.js`, `apps/web/src/loopers-console-agents.js`; tests in matching `apps/api/test` and `apps/web/test` files.
- [ ] Create a clean worktree from the current live lineage; do not modify the dirty `/home/ubuntu/multipass` checkout.
- [ ] Test status-rich fetch, PROVISIONAL badge/reason/freshness, no “RATED” implication, stale handling, and legacy fallback only when the new endpoint is unavailable.
- [ ] Run the exact affected pnpm tests; expect FAIL before implementation and PASS after.
- [ ] Implement minimal consumer changes, build production assets, and commit in the Multipass repository.
- [ ] Do not deploy until Task 19's API and store gates pass.

### Task 17: Production isolation gate
**Files:** Create `api/test/cred-looper-provisional/isolation.test.js`.
- [ ] Test no imports from `cred-shadow` in production modules, no Terminal/oracle/AgentDNA writes, no privilege from PROVISIONAL 53, top-up zero influence, and no secrets in reports.
- [ ] Run `cd api && node --test test/cred-looper-provisional/isolation.test.js`; expect PASS after minimal fixes.
- [ ] Commit `test: lock Looper CRED isolation`.

## Chunk 5: Deployment and launch

### Task 18: Systemd-only scheduling and operations docs
**Files:** Create `ops/systemd/helixa-looper-provisional-cred.service`, `.timer`, `docs/operations/looper-provisional-cred.md`; test `operations.test.js`.
- [ ] Choose systemd as the sole scheduler; do not create or modify crontab.
- [ ] Pin store `/home/ubuntu/.local/state/helixa/looper-provisional-cred/cred.db`, state root, config/manifest paths, lock under writable state, deployment scripts under `/home/ubuntu/.local/libexec/helixa`, and API env `LOOPER_PROVISIONAL_CRED_DB`.
- [ ] Test hardening, `ReadWritePaths`, low CPU/I/O priority, `OnCalendar=*-*-* 02:47:00 UTC`, `RandomizedDelaySec=600` (latest 02:57, before 03:17 canonical sync), and a hard gate that the activation artifact is successful and <26 hours old, stale alerts, and exact deployed bytes.
- [ ] Run `cd api && node --test test/cred-looper-provisional/operations.test.js`; expect PASS.
- [ ] Document install, status, backup, rollback, recovery, and uninstall; commit `ops: schedule Looper provisional CRED`.

### Task 19: Verify, merge, deploy inactive, publish, then enable
- [ ] Run `cd api && npm run test:cred-looper-provisional && npm run test:cred-looper && npm run test:cred-payments && npm run test:cred-evidence && npm run test:cred-shadow`.
- [ ] Run `cd api && find cred-looper-provisional services routes scripts -type f -name '*.js' -print0 | xargs -0 -n1 node --check` and `git diff --check`.
- [ ] Build manifest/artifacts twice; `cmp` all canonical outputs. Dry-run all current 848 activated IDs (or newer signed count) and prove conflict-free records are 40/Marginal/PROVISIONAL, no retroactive points, max 55, legacy DB hashes unchanged.
- [ ] Run independent security/spec review; fix blockers and rerun every gate.
- [ ] Push both repository branches, open PRs, pass checks, and merge source **before** production installation.
- [ ] Deploy Helixa code with endpoint configured but inactive; verify unconfigured/missing store returns controlled 503 and legacy endpoints remain healthy.
- [ ] Back up existing production state; build/sign live manifest, bootstrap the canonical store in rehearsal, verify generation/hash/count, then atomically copy verified state into the pinned directory.
- [ ] Restart API and verify sampled/boundary Looper endpoints plus status-aware list; verify legacy API/Terminal/oracle hashes and responses unchanged.
- [ ] Deploy Multipass only after the API is live; verify desktop/mobile PROVISIONAL rendering.
- [ ] Install/enable the systemd timer last; run one manual service invocation and require Result=success, cursor/generation integrity, API consistency, no warnings, and a tested rollback pointer/unit backup.
