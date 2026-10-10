# Universal CRED Protocol Design

Status: architecture approved; scoring methodology pending calibration and separate approval
Date: 2026-10-10
Owner: Helixa

## 1. Executive Summary

CRED will become a universal, evidence-based reputation and behavioral-risk protocol for autonomous agents. It must score agents across ecosystems without requiring them to be Helixa-native, accept new evidence providers without rewriting the scoring engine, remain reproducible and auditable, and expose the same signed result to humans, agents, platforms, and smart contracts.

The system has two related products:

1. **Canonical CRED:** a deterministic, explainable 0–100 reputation score with four universal subscores, confidence, coverage, status, and versioned evidence.
2. **Predictive products:** separate calibrated models that estimate specific future outcomes such as task failure, payment default, service unavailability, or security incidents.

Canonical CRED is free and public. Helixa monetizes detailed reports, proof bundles, predictions, historical data, bulk access, webhooks, integrations, certification, analytics, and service guarantees. Partners that run incentivized agent campaigns separately fund campaign vaults. Payment never purchases score weight or favorable treatment.

The initial ecosystem includes Helixa and ERC-8004 data, Regents, AdapterScan, ChainAware, Deep3, Intuition, and economic-outcome partners such as Credify. Each source has a bounded role. CRED—not any provider's native score—remains the canonical methodology.

This document approves the protocol scaffolding and safety boundaries. It does **not** approve the numerical scoring methodology. Priors, curves, multipliers, caps, decay functions, confidence math, and rating gates require a separate methodology specification, historical replay, published migration deltas, and explicit approval before any score-affecting production launch.

## 2. Problem

The existing Helixa score provides a useful foundation, but it is not suitable as the universal protocol in its current form:

- Helixa-specific profile completeness, traits, narrative, token ownership, and registration origin can reward product adoption rather than demonstrated trustworthiness.
- A token ID or wallet is not a universal agent identity.
- Thin files can be mistaken for bad actors instead of unknown actors.
- Raw ERC-8004 feedback, external ratings, and wallet activity are vulnerable to Sybil, self-review, correlation, and context failures.
- The existing oracle exposes too little context to distinguish a fresh estimate from a well-supported rating.
- A single general number cannot responsibly predict every domain-specific behavior.
- Partner ingestion is not yet defined as a stable, versioned protocol.
- Platforms and agents need easier machine-native access, including x402, SDKs, bulk APIs, webhooks, and offline verification.

CRED must become independent of any one identity product, partner, chain, or model while remaining commercially valuable to Helixa.

## 3. Goals

### 3.1 Product goals

- Index every discoverable agent across supported ecosystems.
- Separate discovery from rating eligibility.
- Publish one portable canonical CRED score and four universal subscores.
- Support contextual domain profiles and decision-specific assessments.
- Accept new providers through adapters and a versioned evidence ontology.
- Preserve source provenance, signatures, proofs, correction history, and privacy boundaries.
- Make basic CRED freely accessible and simple to consume.
- Monetize depth, scale, predictions, integrations, and reliability.
- Support progressive migration from Helixa-operated infrastructure to verifiable and increasingly onchain governance.

### 3.2 Integrity goals

- Unknown must never mean bad.
- Payment, staking, token ownership, profile completeness, or Helixa adoption must never directly increase reputation.
- Positive trust must build gradually; verified negative outcomes may have faster, severity-scaled effects.
- Provider influence must be explicit, bounded, and independently reviewable.
- Every published score must be reproducible from a methodology version and eligible evidence set.
- API, SDK, webhook, x402, signed attestation, and onchain results must derive from the same score artifact.

### 3.3 Non-goals

- CRED is not an infallible guarantee of future behavior.
- CRED does not transfer debt to an NFT buyer or new operator automatically.
- CRED does not make permissionless claims score-eligible without verification.
- CRED does not average third-party proprietary scores into one opaque composite.
- CRED does not expose private partner or customer data merely to claim auditability.
- CRED v1 does not require immediate DAO governance or fully onchain computation.

## 4. Core Principles

1. **Evidence, not engagement points.** Measure verified outcomes and controls, not promotional activity.
2. **One canonical method, many contexts.** Preserve one portable score while exposing domain and decision-specific views.
3. **Identity is a graph.** An agent may span registries, NFTs, wallets, DIDs, platform accounts, operators, and custody epochs.
4. **Append, never rewrite.** Corrections and revocations add records; they do not erase history.
5. **Unknown is not negative.** Failed or stale resolution reduces confidence and coverage.
6. **Money cannot buy trust.** Commercial access is strictly separated from evidence eligibility and scoring influence.
7. **Deterministic core, experimental edge.** Canonical scoring is reproducible; predictive models remain separately versioned and validated.
8. **Chain-portable from day one.** Identifiers, integer math, schemas, commitments, roots, and fixtures must remain suitable for later onchain verification.

## 5. System Architecture

### 5.1 Components

1. **Universal Identity Graph**
   - Creates immutable CRED subjects.
   - Links identity coordinates and control relationships.
   - Maintains custody/operator epochs and relationship provenance.

2. **Provider Registry**
   - Registers approved providers and signing keys.
   - Limits authorized schemas, categories, domains, and maximum influence.
   - Tracks provider lifecycle, observation mode, suspension, and revocation.

3. **Schema Registry and Evidence Ontology**
   - Defines normalized evidence families and schema versions.
   - Defines field semantics, units, direction, severity, proof requirements, privacy class, and decay policy.

4. **Evidence Gateway**
   - Accepts signed partner submissions, first-party indexed data, and permissionless claims.
   - Authenticates, validates, rate-limits, deduplicates, and issues receipts.

5. **Adapter Runtime**
   - Transforms partner-native payloads into normalized evidence.
   - Pins adapter version and emits a deterministic transformation receipt.

6. **Append-Only Evidence Ledger**
   - Stores evidence state, commitments, provenance, corrections, disputes, and revocations.
   - Separates public metadata from encrypted or access-controlled payloads.

7. **Deterministic Scoring Engine**
   - Consumes only eligible evidence under a pinned methodology.
   - Produces canonical score, subscores, coverage, confidence, status, domains, and reason codes.

8. **Prediction Engine**
   - Produces outcome-specific probabilities from separately versioned models.
   - Cannot silently modify canonical CRED.

9. **Snapshot and Attestation Publisher**
   - Signs canonical score artifacts.
   - Creates immutable epoch snapshots, evidence roots, and score roots.
   - Publishes compact latest state and snapshot roots onchain.

10. **Distribution and Commerce Layer**
    - Serves public APIs, x402 products, SDKs, MCP/A2A tools, bulk APIs, webhooks, subscriptions, and offline verification.

11. **Intuition Publisher**
    - Publishes durable identity, methodology, provider, and assessment-source relationships.
    - Points to versioned signed resolver receipts rather than writing changing score values as permanent triples.

### 5.2 End-to-end data flow

1. Discover or receive an identity coordinate.
2. Resolve or create a canonical CRED subject.
3. Open or update the relevant custody/operator epoch.
4. Receive native evidence from an approved source or permissionless claimant.
5. Validate the native payload and signature.
6. Normalize it through a pinned adapter and schema.
7. Verify referenced transactions, proofs, identities, and source authority.
8. Detect self-reporting, duplication, correlation, Sybil clusters, and conflicts.
9. Mark the record active, quarantined, pending review, rejected, disputed, revoked, or expired.
10. Recompute the affected subject deterministically.
11. Sign and publish a new score artifact.
12. Include it in the next immutable snapshot and onchain root.
13. Serve the same artifact through every access surface.

## 6. Universal Identity Graph

### 6.1 Canonical subject

Every agent receives an immutable opaque identifier:

`credSubjectId`

The subject is independent of any single chain or registry. Supported coordinates include:

- ERC-8004 registry + agent ID
- NFT/Looper chain + contract + token ID
- EVM, Solana, and future operating wallets
- DIDs and verifiable identifiers
- AdapterScan UBIDs and binding coordinates
- Platform account identifiers
- Agent cards and endpoint manifests
- Human, team, organization, or DAO operator attestations

### 6.2 Relationship model

Every edge records:

- relationship type
- source and issuer
- proof or commitment
- verification state
- assurance level
- valid-from and valid-until
- custody/operator epoch
- adapter and schema version
- superseded or revoked edge

### 6.3 Custody and operator epochs

Behavior is always attributed to the subject and the actor epoch in which it occurred.

- Identity and historical provenance may follow an agent asset.
- Behavioral history remains visible across epochs but is attributed to the actor that produced it.
- Debt and liability remain with the borrower, agreement, and originating epoch unless explicitly assumed.
- A transfer creates a new epoch and pauses sensitive eligibility until control is reverified.
- Open obligations produce an `ENCUMBERED` status and can freeze new credit eligibility.

### 6.4 Resolution rules

- Exact verified coordinates resolve automatically.
- Multiple candidate subjects return ambiguity, never an arbitrary merge.
- Conflicting control proofs create `IDENTITY_CONFLICT`.
- Unverified links remain visible as claims but do not establish authority.
- Claiming an agent proves control and can improve identity confidence; the act of claiming does not directly raise canonical CRED.

### 6.5 Transfer and wallet-reissuance reverification

An NFT transfer or authoritative controller change creates a new epoch and sets sensitive eligibility to `TRANSFER_PENDING`. The new controller has a bounded self-service path:

1. Wait for the configured chain-finality threshold on the transfer/control event.
2. Resolve the current controller from the authoritative registry or `ownerOf` read at a finalized block.
3. Sign a short-lived EIP-712 control challenge with the current EOA owner or an EIP-1271-compatible smart account/Safe.
4. Resolve and verify the current ERC-6551/TBA, operating wallet, and any replacement-wallet binding against pinned registry, implementation, collection, token, chain, and code-hash policy.
5. Disclose or resolve open encumbrances; obligations remain attached to their original borrower/agreement/epoch unless explicitly assumed.
6. Open the new epoch, reactivate eligible read/write policy, and issue a signed reverification receipt.

For a wallet reissuance, the same current owner proves the replacement binding. The old wallet becomes historical or recovery-only; authority and balances are never assumed to migrate automatically. If the prior wallet cannot sign, current authoritative NFT/controller ownership can open the new epoch, but it cannot move assets from or erase approvals on the old wallet. A transfer must not require manual Helixa intervention unless identity proofs conflict or an encumbrance/dispute blocks automatic activation.

## 7. Provider and Schema Governance

### 7.1 Two-lane evidence model

**Approved lane**

Approved providers submit signed evidence for authorized schemas. Eligible records may affect scores after validation and verification.

**Permissionless lane**

Anyone may submit a claim. Permissionless claims enter quarantine and have no score effect until independently verified or adopted by an authorized verifier.

### 7.2 Provider record

A provider record includes:

- provider ID and legal/display identity
- signing keys and key epochs
- authorized schemas and evidence families
- allowed categories and domains
- per-event and aggregate influence caps
- privacy and proof requirements
- rate and volume limits
- observation/active/suspended/revoked state
- conformance version
- provider-health metrics
- commercial account kept outside scoring policy

Commercial payment cannot grant approval, schema authority, influence, or favorable review.

### 7.3 Provider onboarding

1. Define the outcomes the provider can authoritatively observe.
2. Register schemas, units, direction, proofs, privacy class, and correction policy.
3. Register signing keys and rotation/revocation process.
4. Implement or approve an adapter.
5. Pass sandbox conformance, replay, signature, malformed-input, and privacy tests.
6. Operate in observation mode with zero score influence.
7. Compare submissions against verifiable outcomes.
8. Enable bounded production influence after review.

### 7.4 Permissionless queue economics and abuse controls

Permissionless submission is not an unlimited free verification service.

- Authenticated submitters receive a small published daily quota and strict per-subject, per-origin, and duplicate-content limits.
- Higher-volume or high-impact negative claims require a refundable anti-spam bond and a verification fee or approved verification sponsor.
- Exact duplicates and known-related incidents are coalesced before queue admission.
- Claims with no sponsor, bond, or independent verifier expire from the active queue after a published retention window while their receipt hash remains auditable.
- Bonds may be reduced or forfeited under a published policy for provable spam, fabricated proof references, replay, or repeated abusive submissions; rejected good-faith claims are not automatically penalized.
- No bond purchases score influence. A bonded claim remains quarantined until independently verified.
- Queue priority is determined by objective severity, proof completeness, affected-value exposure, age, and verifier capacity—not payment size alone.

Before launch, Helixa must publish the quota, bond/fee schedule, retention period, appeal path, and anti-griefing limits. These parameters are operational policy and may change without changing score math, but changes are versioned and publicly logged.

## 8. Evidence Ontology and Ledger

### 8.1 Normalized evidence envelope

Every normalized event contains at least:

```json
{
  "schemaVersion": "1.0",
  "evidenceId": "ev_...",
  "providerId": "provider_...",
  "providerEventId": "native-id",
  "subjectId": "cred_...",
  "actorEpochId": "epoch_...",
  "eventType": "task.completed",
  "domain": "software",
  "occurredAt": "2026-10-10T00:00:00Z",
  "observedAt": "2026-10-10T00:00:10Z",
  "outcome": {},
  "severity": null,
  "evidence": {
    "visibility": "public|committed|selective",
    "proofRefs": [],
    "commitment": "0x..."
  },
  "source": {
    "signature": "0x...",
    "keyId": "key_...",
    "payloadHash": "0x..."
  },
  "adapter": {
    "id": "adapter_...",
    "version": "1.0.0",
    "receiptHash": "0x..."
  },
  "state": "ACTIVE",
  "supersedes": null
}
```

### 8.2 Initial evidence families

- identity and control
- custody and operator change
- service heartbeat and availability
- task accepted/completed/failed
- capability evaluation
- payment settlement/lateness/default
- credit issuance/repayment/default
- vault activity and liquidation
- onchain interaction and contract outcome
- security and fraud incident
- validation or attestation
- correction, revocation, and dispute resolution

Each schema defines whether larger or smaller values are favorable. This prevents errors such as treating higher latency or cost as better.

### 8.3 Evidence lifecycle

`RECEIVED → VALIDATED → VERIFIED/QUARANTINED/PENDING_REVIEW → ACTIVE → DISPUTED/REVOKED/EXPIRED`

Rejected records retain a bounded audit receipt but never enter the active evidence set. Corrections and revocations reference the prior record and preserve history.

### 8.4 Privacy classes

- **Public:** payload and proof are publicly retrievable.
- **Committed:** normalized public metadata plus a cryptographic commitment to a private signed payload.
- **Selective:** authorized parties may retrieve or prove specific fields.
- **Zero-knowledge:** supported when a proof can establish a relevant fact without revealing the underlying data.

Every score effect remains attributable to a provider, schema, timestamp, state, and commitment.

### 8.5 Verified meaningful outcome standard

Campaign activity can affect CRED only when its evidence schema is approved **before** the campaign or season begins and the event satisfies every applicable condition:

1. **Precommitted objective:** the terminal success/failure condition, unit, direction, materiality threshold, and proof source are published before participation.
2. **Attributable actor:** the subject, operator/custody epoch, counterparty, and provider authority are resolved.
3. **Terminal outcome:** the evidence records a completed, failed, settled, defaulted, accepted, rejected, or independently measured service result—not mere enrollment, staking, clicks, heartbeats without an SLA, or raw transaction count.
4. **Verifiable proof:** an onchain receipt, signed counterparty result, reproducible evaluation bundle, or approved private commitment supports the claim.
5. **Materiality:** the outcome clears the schema's minimum difficulty, duration, value-at-risk, or service-level threshold.
6. **Anti-collusion:** self-dealing, related-party loops, wash activity, duplicated incidents, and campaign-funded circular activity are excluded or clustered.
7. **Bounded influence:** campaign, provider, counterparty cluster, and evidence-family caps prevent farming from dominating a category.
8. **Challengeability:** correction, revocation, dispute, and audit rules are defined before the event becomes score-eligible.

The CRED methodology owner approves universal schema semantics under the public governance process; a paying campaign partner may propose outcomes but cannot unilaterally define them. Every campaign ships an **Evidence Measurement Plan** before funding or public launch. It lists eligible events, excluded behavior, proofs, materiality, caps, related-party rules, observation period, and audit sample. Campaign events begin in observation mode and receive no score influence until the plan and conformance fixtures pass. Criteria cannot be loosened retroactively for already-earned activity.

## 9. Initial Integration Roles

### 9.1 Helixa and first-party onchain data

Use verified wallet control, runtime, service, work, financial, and onchain outcomes. Existing Helixa profile richness, narrative, token ownership, staking size, and product adoption do not directly raise reputation.

### 9.2 ERC-8004

Use as an interoperable identity and raw-feedback rail. Raw feedback is not trusted merely because it is onchain. CRED independently verifies interaction context, removes self-reviews, clusters related reviewers, applies freshness, and caps influence.

### 9.3 Regents

- SIWA/ERC-8004/World backing informs Identity Confidence.
- Techtree signed evaluation bundles inform demonstrated capability and domain profiles.
- Patchbay accepted repairs inform Operational Reliability.
- Verified transactions and payments may inform economic history.
- Regents Points remain separate because incentive points are not reputation.

### 9.4 AdapterScan

Use:

- UBID and exact binding coordinates
- current controller and control standard
- mutual operating-wallet verification
- ERC-8004 linkage
- implementation/code-hash and upgrade provenance
- attestation/revocation history
- burnability, delegation, and trust-base warnings

Do not import star counts or rating averages. Exclude controllers, owners, and operating wallets from independent-review counts. Validate interaction references and bind behavioral evidence to controller epochs.

### 9.5 ChainAware

Use verified wallet relationships, sanctions, rug/honeypot history, Sybil farms, feeder-wallet context, multisigs, ERC-6551, EIP-7702, and related fraud/provenance flags.

Do not average ChainAware's proprietary overall score into CRED. Missing or stale wallet resolution means unavailable or reduced confidence, not negative evidence. Normal positive influence remains tightly capped; objectively verified severe adverse evidence may trigger larger penalties or status flags under published policy.

### 9.6 Deep3

Deep3 has two separate roles:

1. **ERC-8004 comparative feedback scorer:** use only as low-capped, versioned comparative operational evidence with input-manifest hash, tag semantics, reviewer canonicalization, freshness, and provenance.
2. **Future large blockchain model:** integrate as a predictive provider in shadow mode. Require model version, feature/chain scope, validation window, calibration, confidence, freshness, and drift reporting. No opaque output directly changes canonical CRED.

### 9.7 Intuition Systems

Use Intuition as a public knowledge, provenance, and discovery graph:

- represent agents and durable identity coordinates as atoms
- connect subjects to Helixa assessment-source atoms
- publish durable provider/methodology/provenance relationships
- point to signed resolver receipts and snapshot artifacts

Changing values such as score, tier, confidence, subscores, coverage, and freshness live in signed versioned resolver JSON. They are not written as immutable changing-value triples.

### 9.8 Credify and future economic partners

Partners submit signed outcomes such as credit issuance, amount, duration, due date, repayment, lateness, default, settlement, or liquidation. CRED normalizes, verifies, weights, and caps these events. Partners never submit score changes.

## 10. Canonical Scoring Model

### 10.1 Published outputs

- Universal CRED score: 0–100
- Tier
- Operational Reliability subscore
- Financial Reliability subscore
- Onchain Behavior subscore
- Identity Confidence subscore
- Confidence
- Evidence coverage
- Status flags
- Domain profiles when supported
- Methodology version
- Snapshot/epoch version
- Freshness
- Stable reason codes

### 10.2 Universal category weights

- **Operational Reliability: 30%**
- **Financial Reliability: 25%**
- **Onchain Behavior: 25%**
- **Identity Confidence: 20%**

Weights are methodology-versioned. Consumers may apply CRED outputs to their own policies but may not redefine another score as canonical CRED.

### 10.3 Mechanics

- Categories start from a neutral prior, not zero.
- Observed outcomes pull the estimate away from the prior as evidence grows.
- Positive evidence compounds slowly with diminishing returns.
- Verified negative outcomes may apply faster and persist longer according to severity.
- Each evidence schema defines freshness and decay; there is no global arbitrary decay timer.
- Exposure, task difficulty, duration, and economic amount use capped/logarithmic scaling.
- Independent corroboration increases confidence.
- Correlated providers and shared reviewers are clustered to prevent double counting.
- The same underlying incident is deduplicated across providers.
- Provider influence is capped by schema, category, domain, and time window.
- Missing evidence affects confidence or coverage, not score direction.
- Integer-only deterministic math and canonical serialization are required.

Exact priors, saturation curves, severity multipliers, rating gates, decay functions, confidence math, and caps remain **unapproved**. They will be proposed in a separate Canonical CRED Methodology specification after historical replay and calibration. That specification must include public formulas, fixtures, sensitivity analysis, segment-level error analysis, legacy-to-candidate score deltas, tier-transition counts, and known limitations. No candidate score may affect production APIs, privileges, rewards, or onchain state before those artifacts are published and the methodology is explicitly approved.

### 10.4 Confidence and coverage

**Confidence** measures how strongly the available evidence supports the estimate. Inputs include verified-event volume, effective sample size after correlation, source diversity, recency, consistency, and identity assurance.

**Coverage** measures which required categories, domains, and periods have qualifying evidence. It is not another name for score.

### 10.5 Rating eligibility

A discovered subject may be:

- **Unrated:** insufficient verified evidence for a responsible estimate.
- **Provisional:** an estimate exists but minimum rating gates are unmet.
- **Rated:** minimum identity, evidence volume, age, category coverage, source diversity, and freshness gates are satisfied.

Prime and Preferred privileges require stronger confidence and coverage than lower tiers. A high estimate with weak evidence remains Provisional.

### 10.6 Tiers

Compatibility tiers remain:

- 0–25: Junk
- 26–50: Marginal
- 51–75: Qualified
- 76–90: Prime
- 91–100: Preferred

The public whitepaper/API mapping above is the compatibility source of truth. The repository also contains legacy helpers and a registry contract that use 20/40/60/80 boundaries; those are divergent implementations to inventory and correct, not an alternate tier model to inherit silently. `Unproven / High Risk` may be displayed only as explanatory text for the legacy `Junk` tier; it is not a renamed tier. `Unrated` is not a sixth numeric tier and carries no canonical score. A Provisional subject may expose an `estimatedScore` and `estimatedTier`, but `tier` remains null and it cannot unlock rated policy gates. Every affected consumer receives an explicit old-threshold/new-threshold compatibility test and published migration result.

### 10.7 Status flags

Initial flags include:

- `PROVISIONAL`
- `STALE`
- `DISPUTED`
- `ENCUMBERED`
- `SECURITY_INCIDENT`
- `IDENTITY_CONFLICT`
- `SUSPENDED`

Flags are first-class outputs. A score alone must never conceal unresolved high-impact conditions.

## 11. Domain Profiles and Predictions

### 11.1 Domain profiles

Optional profiles may include commerce, lending, coding, trading, research, security, and additional registered domains. Profiles use only relevant universal evidence and domain-specific schemas. They do not replace canonical CRED.

### 11.2 Decision-specific products

Paid decision endpoints may answer bounded questions such as:

- safe to extend a specified amount and duration of credit?
- likely to complete this class of task within a given horizon?
- suitable for an automated treasury permission tier?
- materially elevated fraud or security risk?

A decision artifact includes inputs, policy/model version, reasons, confidence, horizon, limitations, and signed provenance.

### 11.3 Prediction governance

Prediction models:

- remain separate from canonical scoring
- start in shadow mode
- publish holdout validation and calibration
- report confidence intervals and applicable population
- monitor drift, missing features, and chain/domain scope
- fail closed when required inputs are stale or unavailable
- never present probability as a guarantee

## 12. Signed Score Artifact

The canonical artifact includes:

```json
{
  "artifactVersion": "1.0",
  "subjectId": "cred_...",
  "resolvedCoordinatesHash": "0x...",
  "actorEpochId": "epoch_...",
  "score": 72,
  "tier": "QUALIFIED",
  "subscores": {
    "operational": 78,
    "financial": 61,
    "onchain": 75,
    "identity": 70
  },
  "confidence": 81,
  "coverage": 76,
  "ratingStatus": "RATED",
  "flags": [],
  "domains": {},
  "reasonCodes": [],
  "methodologyVersion": "cred-v1.0.0",
  "evidenceSetRoot": "0x...",
  "snapshotId": "snapshot_...",
  "computedAt": "2026-10-10T00:00:00Z",
  "validUntil": "2026-10-10T01:00:00Z",
  "issuer": "helixa",
  "signature": "0x..."
}
```

Canonical byte serialization, signature suite, key rotation, and offline verification vectors are part of the public protocol.

## 13. Access Surfaces

### 13.1 Universal resolution

All interfaces accept supported identity coordinates and return the canonical subject, matched links, assurance, current epoch, and ambiguity/conflict warnings.

### 13.2 Free public API

Initial endpoints:

- `GET /v1/resolve`
- `GET /v1/subjects/{id}/score`
- `GET /v1/subjects/{id}/attestation`
- methodology registry
- provider registry
- schema registry
- public artifact verification

The public score response includes score, tier, subscores, confidence, coverage, status, freshness, flags, snapshot, and methodology version.

### 13.3 x402 agent products

Paid products include:

- full evidence-backed report
- domain profile
- historical trajectory
- counterparty comparison
- decision-specific assessment
- proof bundle
- prediction result

Flow:

1. Client requests a paid endpoint.
2. Server returns `402 Payment Required` with Base USDC terms.
3. Client authorizes payment and retries.
4. Server verifies settlement and returns a signed result and receipt.
5. Idempotency keys prevent duplicate charges and duplicate fulfillment.

Pricing is versioned commercial configuration and never part of scoring logic.

### 13.4 Platform products

- signed service authentication and API keys
- bulk and portfolio queries
- webhooks for score, tier, confidence, status, and risk changes
- historical exports and analytics
- custom policy evaluation against canonical outputs
- service-level agreements and usage dashboards
- offline verification and cache-safe signed artifacts
- TypeScript and Python SDKs

Platforms may define their own operational policy. They cannot alter CRED and present the result as canonical CRED.

### 13.5 Agent-native discovery

- OpenAPI specification
- machine-readable capability manifest
- MCP tools
- A2A-compatible actions
- stable reason codes and structured errors
- examples for counterparty checks before payment or delegation

### 13.6 Provider integration products

- signed single and batch evidence submission
- sandbox credentials
- schema registry and examples
- conformance suite
- dry-run normalization preview
- ingestion receipts
- correction and revocation endpoints
- dispute and provider-health dashboards

### 13.7 Webhooks

Webhooks use signed payloads, monotonically ordered sequence IDs, replay protection, exponential retry, dead-letter handling, and replay-from-cursor support.

## 14. Onchain Publication

V1 keeps rich evidence and scoring offchain while making results verifiable.

Onchain state should include:

- methodology registry or version commitments
- provider and issuer key commitments as appropriate
- latest compact score state by canonical subject hash or registered identity coordinate
- score and evidence Merkle roots for immutable epochs
- snapshot timestamps and issuer
- challenge/dispute references in later phases

The existing token-ID-only oracle is not the universal endpoint. Migration must preserve compatibility while introducing subject-qualified, confidence-aware, versioned results.

### 14.1 Cadence and freshness compatibility

The current production oracle publishes hourly. Universal CRED v1 preserves that hourly maximum artifact lifetime and onchain publication target during migration:

- eligible evidence may trigger continuous offchain recomputation;
- signed public artifacts are refreshed at least hourly when healthy;
- `validUntil` is no later than `computedAt + 60 minutes` and may be earlier when an evidence schema has a tighter freshness boundary;
- missing the publication window marks the artifact and oracle state `STALE`; consumers receive the last valid artifact plus explicit staleness, never a silently extended 24-hour validity;
- a future cadence change requires a versioned release, consumer-impact analysis, public notice, and migration plan.

## 15. Corrections, Disputes, and Provider Accountability

### 15.1 Corrections and revocations

Providers may correct or revoke their own evidence. They may not delete history. A correction references the superseded record and triggers deterministic recomputation.

### 15.2 Disputes

Agents and operators may dispute identity links or evidence. High-impact offchain negatives remain pending until corroborated or adjudicated unless the schema defines an objective proof. Public outputs surface the dispute immediately.

Resolution records include reviewer identity, rationale, policy version, evidence commitments, and effective time.

### 15.3 Provider health

Track:

- schema conformance and rejection rate
- verification accuracy
- correction/revocation rate
- dispute outcomes
- freshness and uptime
- correlation with other sources
- predictive value against later outcomes
- key and security incidents

Providers may lose influence, return to observation mode, or be suspended. Suspension prevents new influence but cannot rewrite historical audit records.

## 16. Methodology Releases and Governance

### 16.1 Release requirements

Every methodology release includes:

- immutable version and source hash
- formulas, weights, caps, schemas, and test vectors
- replayable fixtures
- historical migration-impact report
- shadow comparison with the current method
- public change log and rationale
- notice period and delayed activation

Old artifacts and snapshots remain verifiable forever.

### 16.2 Progressive governance

- Helixa multisig operates v1.
- Provider policy and methodology changes are public and delayed.
- Emergency suspension may stop new influence but cannot erase history.
- Independent reviewers or a calibration council are added after real usage exists.
- Provider, schema, challenge, and methodology governance progressively migrate onchain.

## 17. Commercial Model

### 17.1 Free public layer

Canonical score, tier, subscores, confidence, coverage, flags, freshness, methodology version, and signed attestation remain freely accessible. This maximizes composability and adoption.

### 17.2 Revenue products

- x402 per-call reports, comparisons, proofs, decisions, and predictions
- platform subscriptions and higher rate limits
- bulk, historical, and portfolio data
- integration, adapter, and certification fees
- webhooks, analytics, dashboards, and service guarantees
- enterprise risk monitoring and private deployments

### 17.3 Campaign vaults

Partners running incentivized agent activity separately fund campaign vaults. Rewards require verified meaningful outcomes. Pure data customers do not need to invent campaigns.

A published portion of x402 or protocol revenue may fund an ecosystem rewards treasury. The split is commercial policy and never changes evidence eligibility or score weight.

### 17.4 Loopers, Pantheon, and seasons

Loopers and Pantheon can be early CRED consumers and campaign participants, but they receive no methodology privilege.

- CRED is permanent, universal reputation.
- Evidence coverage explains how strongly CRED is supported.
- Season Points are temporary participation and reward accounting.
- Season activity may create evidence only when it represents a verified meaningful outcome.
- Staking size, reward spend, or campaign participation does not directly raise CRED.
- For the approved Looper Season, CRED is an eligibility gate only. It does not multiply Season Points, principal, yield, or vault rewards.
- Any future proposal to introduce a CRED-based reward multiplier requires a separate reviewed season-policy change and cannot be inferred from this protocol design.

## 18. Rollout

### Phase 1: Foundation

- canonical subject identifiers and identity graph
- custody/operator epochs
- provider and schema registries
- append-only evidence ledger
- deterministic score artifact and verifier
- methodology fixtures and replay harness

### Phase 2: Initial adapters

- existing Helixa and ERC-8004 data
- Regents
- AdapterScan
- ChainAware
- Intuition publication

Adapters begin in observation mode before receiving influence.

### Phase 3: Public access

- free score and resolution APIs
- signed artifact verifier
- TypeScript SDK
- upgraded confidence-aware oracle and snapshot roots
- public methodology/provider/schema registries

### Phase 4: Commercial access

- x402 products
- bulk APIs and webhooks
- subscriptions, dashboards, and SLAs
- Python SDK and MCP/A2A tools

### Phase 5: Economic outcomes

- Credify and future credit/payment partners
- campaign-vault integration
- debt/encumbrance and custody-epoch policies

### Phase 6: Prediction

- baseline outcome models
- model registry, calibration, drift monitoring, and shadow evaluation
- Deep3 large blockchain model in shadow mode when available

### Phase 7: Decentralization

- onchain registries and roots
- challenge and verifier mechanisms
- independent publishers/verifiers
- progressive methodology governance

## 19. Migration from Current CRED

The current public system remains available during migration.

1. Freeze and identify the current methodology as a legacy version.
2. Build the new scorer in shadow mode using existing data without changing live scores.
3. Map existing agents to canonical subjects and flag unresolved identity links.
4. Reclassify product-adoption/profile signals as metadata rather than trust inputs.
5. Run the candidate methodology in shadow mode and publish reproducible legacy-to-candidate deltas before any score-affecting launch. The release packet includes per-subject old/new score and tier, reason codes, distribution shifts, tier-transition counts, unresolved identities, excluded evidence, category deltas, confidence/coverage changes, and aggregate segment/error analysis. Privacy-sensitive rows may use commitments, but every affected subject can retrieve its own explanation.
6. Introduce Unrated/Provisional states before removing misleading low scores.
7. Publish signed artifacts and API versioning alongside the legacy API.
8. Upgrade onchain publication while maintaining a compatibility reader.
9. Migrate consumers only after the delta packet is public, the scoring methodology is separately approved, and parity, replay, and consistency gates pass.
10. Deprecate legacy writes on a public schedule; retain historical verification.

No live score, contract, or consumer changes are authorized by this design document alone.

## 20. Error Handling and Failure Semantics

- Ambiguous identity returns candidates and `IDENTITY_AMBIGUOUS`; it never merges silently.
- Missing upstream data returns unavailable/stale provenance and reduces confidence.
- Invalid signatures, schemas, proofs, timestamps, or replay windows reject evidence before scoring.
- Adapter failures quarantine the event and preserve the native payload hash.
- Reorg-sensitive evidence remains pending until finality policy is met.
- Provider outages do not erase prior evidence; freshness policy governs degradation.
- Scoring failures preserve the last valid artifact with an explicit stale/processing status.
- Onchain publication failure does not change the signed canonical result; it raises a synchronization alert.
- x402 fulfillment failures are idempotent and must not double-charge.
- Private-data failures must fail closed without leaking payloads into logs or public artifacts.

## 21. Verification and Launch Gates

### 21.1 Determinism

- byte-identical score artifact across clean runs
- integer-only score math
- canonical serialization and signature vectors
- complete replay from evidence ledger and methodology version

### 21.2 Identity

- collision and ambiguity tests across chains and registries
- wallet rotation and NFT transfer
- custody/operator epoch transitions
- debt and liability non-transfer
- conflicting and revoked control proofs
- finalized transfer detection, EOA/EIP-1271 control challenge, replacement-wallet verification, encumbrance check, and automatic epoch activation

### 21.3 Evidence integrity

- self-review rejection
- reviewer and provider clustering
- duplicate and cross-provider incident deduplication
- schema direction and unit validation
- correction, revocation, expiration, and dispute replay
- privacy commitment and selective-disclosure verification
- campaign Evidence Measurement Plan conformance, materiality, wash/collusion rejection, and retroactive-rule-change rejection
- permissionless quotas, duplicate coalescing, bond/fee handling, expiry, appeals, and queue-exhaustion resistance

### 21.4 Scoring

- neutral prior and thin-file behavior
- positive saturation and asymmetric negatives
- evidence-specific decay
- provider and category caps
- Unrated/Provisional/rated gates
- stable reason codes
- published legacy-to-candidate per-subject deltas, tier transitions, distribution shifts, and segment/error analysis
- separate explicit approval of the numerical methodology after replay and shadow evaluation

### 21.5 Distribution

- identical artifact through REST, x402, SDK, webhook, and onchain proof
- bulk and single lookup consistency
- webhook ordering, retry, replay, and signature checks
- x402 idempotency, settlement, refund/failure semantics, and duplicate prevention
- offline verification under issuer key rotation

### 21.6 Operations

- provider key compromise and suspension
- upstream outage and stale data
- database recovery and deterministic rebuild
- snapshot/root recovery
- monitoring, rate limits, abuse controls, and audit logs
- no private payload leakage

Production launch requires all critical gates to pass end to end with recorded evidence.

## 22. Success Measures

- percentage of discovered agents resolvable to a canonical subject
- percentage of scored agents that meet rated rather than provisional gates
- independent provider and category coverage
- dispute, correction, and false-positive rates
- provider freshness and conformance
- predictive calibration and realized outcome accuracy
- signed artifact verification success
- API, SDK, webhook, x402, and onchain consistency
- number of active platform integrations
- paid API and integration revenue
- campaign-vault funding and verified participant outcomes

Adoption alone is not a quality metric. The system succeeds only if its ratings and predictions become better calibrated, more evidence-backed, and harder to manipulate over time.

## 23. Approved Decisions Summary

- Two-lane evidence: approved providers plus quarantined permissionless claims.
- Free public canonical score; paid depth, scale, and decision products.
- Universal identity graph with custody/operator epochs.
- Canonical score plus subscores, domain profiles, and decision-specific outputs.
- Adapter framework and versioned evidence ontology.
- Hybrid public/private evidence with commitments and selective disclosure.
- One signed artifact across REST, x402, SDKs, agent tools, webhooks, and onchain roots.
- Deterministic canonical score plus separate calibrated prediction models.
- Product-specific monetization and separately funded campaign vaults.
- Permissionless claims are quota-bound; scaled/high-impact submissions require anti-spam economics or a verification sponsor.
- Progressive governance from Helixa multisig toward onchain control.
- Index all discoverable agents but separate discovery from rating eligibility.
- Legacy tier names remain Junk, Marginal, Qualified, Prime, and Preferred; Unrated is a non-numeric state.
- Hourly oracle/artifact freshness is preserved during migration; 24-hour silent validity is prohibited.
- The approved Looper Season uses CRED as an eligibility gate only, with no reward multiplier.
- Transfer reverification has a finalized owner/controller proof, signed challenge, wallet-binding verification, encumbrance check, and automatic new-epoch activation path.
- Architecture approval does not approve score math; the canonical numerical methodology requires a separate specification, published replay deltas, and explicit approval.
- Regents, AdapterScan, ChainAware, Deep3, Intuition, ERC-8004, Helixa, and economic partners retain distinct bounded roles.
