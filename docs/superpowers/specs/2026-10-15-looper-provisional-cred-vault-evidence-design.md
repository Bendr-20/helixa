# Looper Provisional CRED and Pantheon Vault Evidence Design

**Date:** 2026-10-15
**Status:** Review candidate 2
**Repository:** `github.com/Bendr-20/helixa`

## 1. Decision

Every canonically verified, activated Looper that has no authoritative RATED or SUSPENDED CRED record receives a public **PROVISIONAL score of 40 (Marginal)**. Verified Pantheon CRED-vault behavior provides a deterministic, amount-independent path to Qualified. A completed first six-month lifecycle reaches 53.

This ships a useful reputation signal now without modifying the production-isolated CRED vNext candidate scorer and without allowing deposits to buy Prime, Preferred, or any implicit privilege.

## 2. Architecture and ownership

The feature has four isolated units:

1. **Looper identity manifest** — signs and versions the activated roster plus the dual-RPC account proof snapshot.
2. **Pantheon observer** — reads the complete nine-field position tuple at finalized Base checkpoints and emits an append-only lifecycle artifact.
3. **Provisional policy engine** — a new production module with methodology `cred-looper-provisional-1.0.0`; computes only Looper PROVISIONAL records from identity and lifecycle artifacts.
4. **Public record store/API** — atomically publishes extended CRED records and serves Looper pages, APIs, and status-aware leaderboard rows.

The provisional policy engine is **not** an overlay inside `api/cred-shadow` and must not import that directory. The existing candidate compiler stays `cred-methodology-candidate-0.1.0`, remains shadow-only, and keeps its production-isolation tests. A dedicated Pantheon adapter may additionally transform the same lifecycle artifacts into vNext evidence for replay, but that secondary path cannot mutate public scores.

## 3. Goals and non-goals

### Goals

- Give newly activated Loopers a public CRED record immediately.
- Reward verified duration and completion rather than deposit size.
- Collect prospective Pantheon outcomes for the evidence-native vNext scorer.
- Preserve deterministic replay, rollback, and current non-Looper CRED behavior.

### Non-goals

- No score credit from deposit amount, approvals, reward claims, or top-ups.
- No Prime or Preferred tier from the provisional methodology.
- No inferred slashing/default semantics; the deployed tuple does not expose a verified slashing classification.
- No onchain CRED oracle update or automatic authorization change in this release.
- No rewrite of current AgentDNA/Terminal CRED records.

## 4. Eligibility and status precedence

### 4.1 Eligibility

A provisional record is eligible only when:

- the token appears as activated in the current signed Looper identity manifest;
- token ID, collection, ERC-6551 account, account bytecode, `token()`, and `owner()` agree across two pinned Base RPCs at one finalized block;
- the identity resolves to exactly one current actor epoch with no custody conflict;
- the manifest and its source artifacts are fresh and valid.

Any missing, duplicated, stale, or contradictory mapping remains UNRATED and receives a machine-readable failure reason. Eligibility is all-or-nothing per subject; a single bad subject does not authorize a guessed mapping.

### 4.2 Authoritative precedence

For the current actor epoch, publication selects exactly one record in this order:

1. **SUSPENDED** evidence-native record, if present.
2. **RATED** evidence-native record, regardless of numeric score.
3. **PROVISIONAL Looper** record from this methodology.
4. **UNRATED**.

An explicit RATED score below 40 is preserved as RATED; it is never replaced by the bootstrap. A higher explicit RATED score is likewise preserved. A legacy numeric score with no methodology/status is not assumed RATED: it is quarantined for migration and not overwritten. The launch report must list every such conflict. Candidate vNext PROVISIONAL estimates do not override this production provisional methodology.

## 5. Normative provisional score math

### 5.1 Baseline and tiers

- Baseline: 40
- Initial tier: Marginal
- Status: PROVISIONAL
- Reason: `PROVISIONAL_LOOPER_BOOTSTRAP`
- Methodology: `cred-looper-provisional-1.0.0`

Tier names use the canonical title-case values: Junk, Marginal, Qualified, Prime, Preferred.

### 5.2 Positive events

| Event | Points | Repeat rule |
|---|---:|---|
| First actor-authorized or sponsored active six-month position observed | +2 | Once per actor epoch |
| Lifecycle maintained continuously for 30 days | +2 | Once per lifecycle |
| Lifecycle maintained continuously for 90 days | +3 | Once per lifecycle |
| Full six-month lifecycle completed without an early-exit request | +6 | Once per lifecycle |
| Deposit amount or `addToStake` | +0 | Never affects score or any gate |

A complete first lifecycle yields `40 + 2 + 2 + 3 + 6 = 53` (Qualified).

### 5.3 Adverse events

The penalty clock uses `unstakeRequestTime`, not the later principal transfer:

| Event | Penalty |
|---|---:|
| Exit requested before day 30 | 8 |
| Exit requested from day 30 through day 89 | 5 |
| Exit requested from day 90 until term completion | 3 |
| Post-maturity exit request/withdrawal | 0 |
| Reduction with no attributable supported transition | quarantined; 0 until classified |

A lifecycle can incur at most one early-exit penalty. Finalization never applies a second penalty.

### 5.4 Formula and lifetime scope

For current actor epoch `E`:

`positive(E) = min(15, sum(distinct positive event points in E))`

`negative(E) = sum(distinct early-exit penalties in E)`

`score(E) = min(55, max(0, 40 + positive(E) - negative(E)))`

Order is deduplicate, sum positive, cap positive at 15, sum penalties, add to baseline, then clamp to 0–55. “Lifetime” means the current actor epoch, not the NFT's entire history and not a wallet's activity elsewhere.

Earned duration milestones survive a later early exit because they describe behavior that actually occurred; the exit penalty is then subtracted. Completion is not earned if an early-exit request occurred. Provisional positive points and penalties do not decay. Promotion to RATED replaces this formula rather than blending it with the candidate scorer.

## 6. Capital, top-ups, cycling, and sponsorship

- Principal amount is retained only as provenance needed to detect transitions; it never enters score math.
- A top-up emits an audit transition only. It is excluded from score mass, confidence, coverage, source diversity, observation span, rating gates, and every vNext eligibility calculation.
- Top-ups do not reset `stakeTime`, `stakeMonthIndex`, milestone clocks, or the early-exit penalty clock.
- Closing and reopening creates a new lifecycle. Deduplication and the actor-epoch +15 cap prevent cycling from exceeding 55.
- Sponsored positions are accepted when the canonical Looper account is the position beneficiary. They are explicitly interpreted as bounded third-party economic backing, not proof that the controller supplied the capital. Sponsored and self-funded positions share the same event weights and the same +15 actor-epoch cap.
- The API exposes `fundingAttribution: self | sponsored | unknown` when transaction evidence supports it; attribution never changes points. Unknown attribution is allowed because beneficiary-bound lock behavior, not payer wealth, is the scored claim.

## 7. Signed activated-Looper identity manifest

Add `looper-provisional-roster-manifest-v1`, a closed canonical JSON schema containing:

- chain ID and canonical Looper collection;
- `looper-base-roster-v1` bytes hash and row count;
- `looper-base-proof-snapshot-v1` bytes hash, block number/hash, provider IDs, and proof commitment;
- one activation record per token with `activatedAt` and source-record hash;
- generated time, 30-hour expiry, previous-manifest hash, issuer key ID, signature suite, and Ed25519 signature.

The issuer key is pinned in deployment configuration and rotation requires overlapping signed key epochs. Unknown fields, duplicate token/account rows, row-count regression, expiry, broken predecessor linkage, invalid signature, or a proof snapshot that does not commit to the roster fail closed.

The initial manifest uses the live activated-roster artifact plus fresh dual-RPC account proofs; it does not infer activation from mere NFT ownership. At the 2026-10-15 design check the roster contained 848 token IDs at Base block 52,616,887. The schema is bounded at 10,000 rows and accepts later signed additions without a methodology change; every addition still requires a fresh dual-RPC account proof.

## 8. Pantheon scope and proxy identity

Pinned scope:

- Base chain ID 8453
- CRED: `0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3`
- Pantheon proxy: `0xBf52Aaf8b6C82FaD0220B5378022eA4fC0a98fDb`
- EIP-1967 implementation slot: `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`
- Implementation observed at Base block 52,640,437: `0x1a614b8fa3971be5bd96d31c1b42a1d0040f1974`
- Proxy bytecode SHA-256: `sha256:f55a37e088e18f7b1d583c2a443edeab3c3dade48a026933fff77ad240f11eee`
- Implementation bytecode SHA-256: `sha256:320a75330046431311ca328f34d1469cf585ef3f52da3699194dc5292845ee9c`
- Reads: `pools(CRED)` and the complete `stakes(account,CRED)` tuple
- CRED bytecode SHA-256 at Base block 52,641,267: `sha256:f2127e5735da92360dab1141c47ec73737d639c25b56c1107d7ebec29dd66390`
- Pinned ABI-manifest SHA-256: `sha256:8122bbbf68dca8cdf4f04ec8a4fcd75814a12bf900fcfad724a4179641fb5860`
- Pool invariants: `active=true`, `cliffMonths=0`; `totalStaked` is dynamic and is not a pin

Every observation verifies chain ID, proxy code, implementation slot/address/code hash, ABI manifest hash, CRED code hash, and active pool. Any drift pauses ingestion and expires score freshness; it never silently accepts a new implementation. A new reviewed configuration version is required before resuming.

## 9. Observer and finalized lineage

### 9.1 Checkpoints

The observer reuses the hardened Looper payment observer's artifact pattern:

- exactly two pinned, distinct Base RPC hosts;
- the lower common `finalized` block with at least 20 confirmations;
- exact agreement on block number/hash/timestamp and all calls;
- immutable inception checkpoint;
- contiguous, non-overlapping artifacts linked by predecessor hash;
- an external trusted continuity anchor for every follow-up;
- bounded responses, concurrency, retries, and output sizes.

The complete nine-field tuple is recorded and conformance-tested in this order:
`amount, autoRestake, lockMonths, lockDuration, stakeTime, unstakeRequestTime, unstakeTime, stakeMonthIndex, compounderEnabled`.

### 9.2 State machine

- `NONE -> ACTIVE`: positive amount, six-month term, zero exit request, new valid anchor.
- `ACTIVE -> TOPPED_UP`: amount rises while anchor/term/request fields remain unchanged; audit only.
- `ACTIVE -> EXIT_REQUESTED`: `unstakeRequestTime` changes from zero to a canonical timestamp. Apply one penalty based on request time.
- `EXIT_REQUESTED -> EXITED`: principal falls or becomes zero; no second penalty.
- `ACTIVE -> MATURED`: verified term boundary passes with zero exit request. Emit completion once.
- `MATURED -> CLOSED`: post-maturity withdrawal; neutral.
- `MATURED -> AUTO_RESTAKED`: quarantined in methodology 1.0.0. The tuple exposes the flag but Pantheon has not published enough canonical transition semantics to assign score safely. A later methodology may support it with conformance vectors.
- `CLOSED -> ACTIVE`: subsequent stake with a new valid anchor; new lifecycle.
- Any principal decrease without a prior supported request, premature anchor change, time regression, lock-term drift, impossible tuple combination, or emergency path not represented by the pinned semantics becomes `QUARANTINED_TRANSITION` with no score change.

A custody transition closes the old actor epoch. Positive and negative events already attributed remain in that historical epoch and do not affect the new controller's provisional score. An active position spanning custody is frozen: the new actor gets baseline 40 but receives no inherited opening, duration, or completion points. New positive vault credit requires a lifecycle opened after the new actor epoch begins. Ambiguous transitions around custody are quarantined.

### 9.3 Historical bootstrap

Existing positions at observer inception receive no retroactive open/30/90/completion points from tuple age alone. They are marked `PREEXISTING_POSITION`. Their future transitions are observed, but positive scoring begins only with a new lifecycle whose opening is inside the immutable observer lineage. This preserves the claim that scored behavior was prospectively verified. The public baseline 40 does not depend on having a vault position.

## 10. Deep-reorg and recovery algorithm

Before collecting a follow-up, both RPCs must still return the prior artifact's end-block hash. A mismatch at a previously finalized checkpoint is a critical deep-reorg condition:

1. Stop collection and publication; do not advance the cursor.
2. Mark the active public generation stale at its existing `validUntil`; never extend it.
3. Walk the immutable local artifact lineage backward, bounded by inception, until both providers agree on a committed checkpoint.
4. Produce a recovery manifest listing orphaned artifacts/events and the common ancestor.
5. Require an independently signed operator recovery decision.
6. Append revocation records for orphaned events, recompute every affected provisional record from the retained common ancestor, and build a replacement lineage.
7. Atomically publish the recomputed generation before normal forward collection resumes.

No score update from the replacement chain is published before orphaned effects are removed. If no committed common ancestor exists, all vault contributions are removed, baseline-only provisional records are published, and a new reviewed inception is required. Ordinary pre-finality reorgs are excluded by collecting only finalized blocks.

## 11. Public record contract and storage

### 11.1 Authoritative record

Create a dedicated canonical SQLite store, separate from the legacy `agents.cred_score/cred_tier` cache. Each immutable generation contains:

- subject ID and actor epoch ID;
- score and title-case tier;
- rating status and methodology ID;
- computed time and `validUntil = computedAt + 48 hours`;
- confidence and coverage (both null for the provisional formula rather than fabricated);
- reason-code array;
- effective privilege tier (null for PROVISIONAL in this release);
- roster, observer, lifecycle, and record commitments;
- generation ID and predecessor generation hash.

A single SQLite transaction inserts the complete generation, verifies counts/commitments, and flips one active-generation pointer. Rollback flips that pointer to the previous verified generation. Public Looper CRED routes and status-aware leaderboard queries read only this store, so publication has one atomic boundary.

### 11.2 Compatibility

This release adds a Looper-specific CRED route and updates Multipass/Looper surfaces to consume the extended record. It does not write provisional records into the legacy Terminal numeric columns or onchain oracle. Existing AgentDNA routes and the 5,003-agent canonical sync remain unchanged. A later consumer migration may project score/tier only if it also preserves status and methodology.

API responses expose score, tier, ratingStatus, methodologyId, computedAt, validUntil, freshness, reasonCodes, effectivePrivilegeTier, and commitments. After 30 hours without success, operators are alerted. After 48 hours, the last score may remain visible as historical, but `freshness=STALE` and `effectivePrivilegeTier=null`.

## 12. Consumer and privilege policy

PROVISIONAL is a public reputation label, not RATED authorization. This release grants no implicit lending, capital, oracle, or access privilege from the number alone. `effectivePrivilegeTier` is null, and existing score-only consumers are not pointed at the new store.

Any future consumer must explicitly choose a status-aware policy. Low-risk products may elect to accept Provisional Marginal/Qualified after their own review; financial or irreversible privileges continue to require RATED. This prevents publishing 53 from silently changing permissions.

## 13. vNext evidence integration

A dedicated `pantheon-position-lifecycle-1.0.0` adapter consumes observer artifacts offline and emits normalized financial/onchain provenance. It never performs network I/O. Only open, duration, completion, and attributed early-exit lifecycle events enter the ledger. Top-ups and unclassified transitions remain audit records with `scoreEligible=false` and are excluded from confidence, coverage, diversity, age, mass, and every rating gate.

All Pantheon events use one provider/control group and one bounded schema family, so they cannot independently satisfy source-diversity gates. Corrections/revocations reference the original evidence IDs during signed deep-reorg recovery. The candidate scorer remains shadow-only until its separate launch gate.

## 14. Operations and alerts

Run after the activated-roster refresh and before public generation expiry. Use one non-blocking mutation lock, low CPU/I/O priority, bounded RPC batches, durable append-only lineage, atomic status, and compact backups.

Alert on stale success, manifest expiry/regression, RPC disagreement, checkpoint ancestry failure, proxy/implementation/code drift, malformed tuple, impossible lifecycle, custody ambiguity, target/non-target publication mismatch, or partial publish failure. A failed run preserves the last generation without extending validity.

## 15. Tests and launch acceptance

### Required tests

- closed-schema/signature/key-rotation/freshness tests for the roster manifest;
- exact precedence across SUSPENDED, RATED, PROVISIONAL, legacy-ambiguous, and UNRATED;
- conformance vectors for every field in `stakes` and every supported transition;
- formula boundaries, deduplication, cumulative penalties, actor-epoch reset, floor 0, ceiling 55;
- amount independence from 1 CRED through uint256 bounds;
- top-up/cycling/sponsorship cases prove no extra gate or score influence;
- request-time penalty bands and no double penalty at finalization;
- auto-restake, preexisting position, emergency/unclassified path, cooldown/restake, and custody transitions;
- proxy and implementation upgrade drift;
- finalized checkpoint continuity, deep-reorg recovery, revocation-before-republish ordering;
- atomic generation publish/rollback and 48-hour stale behavior;
- API/Multipass/leaderboard extended-field consistency;
- production-isolation tests proving provisional code cannot import shadow scoring code;
- zero writes to legacy non-Looper records, Terminal cache, or onchain oracle.

### Launch acceptance

- all existing shadow, evidence, Looper corpus, payment observer, API, and canonical-sync tests pass;
- two independent full builds are byte-identical;
- every conflict-free eligible Looper receives 40/Marginal/PROVISIONAL;
- a synthetic first full lifecycle deterministically reaches 53/Qualified/PROVISIONAL;
- amount and top-ups cannot change either result;
- provisional score cannot exceed 55 and has no effective privilege tier;
- historical/preexisting vault age earns no retroactive points;
- production backup integrity and rollback rehearsal pass before apply.

## 16. Promotion to RATED

When a Looper later satisfies the standard vNext evidence mass, category, source-diversity, age, coverage, and confidence gates, its explicit RATED record wins under Section 4.2. Promotion is a versioned generation change; provisional points are not added to the RATED score. Historical actor epochs, provisional reasons, and vault artifacts remain auditable.
