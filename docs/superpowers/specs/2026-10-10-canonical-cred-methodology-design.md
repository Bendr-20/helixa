# Canonical CRED Methodology — Candidate 0.1

Status: candidate for shadow evaluation; not approved for production scoring
Date: 2026-10-10
Owner: Helixa
Depends on: `2026-10-10-universal-cred-protocol-design.md`
Methodology ID: `cred-methodology-candidate-0.1.0`

## 1. Decision and non-decision

This specification defines the first complete candidate mathematics for Canonical CRED. It is suitable for deterministic implementation, public fixtures, historical replay, and shadow evaluation.

It does **not** authorize changes to live scores, tiers, APIs, privileges, rewards, contracts, oracle state, or consumers. Production use requires a verified outcome corpus, replay and shadow results, published legacy-to-candidate deltas, sensitivity and segment analysis, and separate explicit approval.

Legacy CRED values are migration comparators, not calibration truth. The current Helixa agents database contains 5,005 agents and zero session-outcome rows. The public Terminal contains 197,898 agents, but its scores are overwhelmingly outputs of legacy formulas rather than labeled behavioral outcomes.

## 2. Meaning of CRED

Canonical CRED is an **absolute Bayesian trust estimate**, not:

- a percentile rank;
- a probability that an unspecified future task will succeed;
- a measure of popularity, wealth, adoption, profile completeness, or payment to Helixa;
- a provider score averaged into another provider score.

Each category has an independent internal estimate from 0 to 100:

- Operational Reliability — 30%
- Financial Reliability — 25%
- Onchain Behavior — 25%
- Identity Confidence — 20%

All four categories begin from the same neutral internal prior of 50. Missing evidence leaves a category at 50 and reduces coverage/confidence; it never counts as failure. New or thin subjects do not publicly appear as 50 CRED. They are Unrated or Provisional until publication gates are met.

## 3. Determinism and numeric conventions

All consensus-relevant computation uses signed 64-bit integer fixed-point arithmetic.

- `SCALE = 1,000,000`
- one evidence unit, `EU = 1,000,000`
- ratios are represented in millionths
- multiply before divide only when overflow analysis proves safety; otherwise use the specified greatest-common-divisor reduction
- division rounds half away from zero
- event order is canonical: `observedAt`, then `evidenceId` bytewise ascending
- public category and overall scores are integers
- category values retain millionth precision internally
- the overall score is computed from unrounded category values and rounded once
- canonical JSON, input ordering, methodology ID, registry versions, and evidence-set hash are included in every artifact

Implementations that cannot reproduce all fixtures byte-for-byte are non-conforming.

## 4. Eligible evidence

Only ACTIVE, score-eligible evidence under a pinned provider, schema, ontology, and methodology version enters the calculation.

An eligible event must have:

- a canonical subject and custody/operator epoch;
- a registered schema and evidence family;
- an authenticated provider or independently verified permissionless claim;
- a native payload hash and transformation provenance;
- observed time, finality state, direction, materiality, and proof class;
- deduplication and correlation keys;
- no unresolved superseding correction, revocation, or dispute that suspends eligibility.

Permissionless claims remain quarantined until independently verified. High-impact offchain negative claims require independent corroboration or adjudication unless objectively provable. Provider-computed overall ratings, points, token ownership, staking size, purchases, campaign participation, partner payments, and profile completeness are ineligible as direct score inputs.

## 5. Evidence Measurement Plan gate

No schema can generate score-eligible events without a versioned Evidence Measurement Plan (EMP). Each EMP defines:

- the meaningful outcome being measured;
- positive, negative, and neutral outcome conditions;
- materiality and exposure bands;
- proof requirements and finality;
- independence, deduplication, and correlation keys;
- wash, self-dealing, collusion, and Sybil exclusions;
- schema, provider, cluster, and time-window caps;
- positive and negative decay periods;
- severity classification and remediation proofs;
- known blind spots and audit sampling.

Campaign-funded activity is metadata unless the EMP proves that the outcome is economically or operationally meaningful independent of the incentive. Creating volume, staking, checking in, or cycling funds is not a meaningful outcome.

## 6. Candidate event mass

### 6.1 Proof factor

Each verified event receives exactly one proof factor:

| Class | Requirement | Factor |
|---|---|---:|
| P1 | finalized native cryptographic or objectively reproducible proof | 1.00 |
| P2 | signed system-of-record event with independently resolvable proof | 0.80 |
| P3 | independently corroborated multi-party attestation | 0.60 |
| P4 | approved comparative/model-derived evidence | 0.25 |

P4 evidence cannot by itself produce a severe/critical penalty, satisfy independent corroboration, or qualify a subject as Rated.

### 6.2 Materiality factor

EMP-defined materiality uses capped bands, never raw linear value:

| Band | Factor |
|---|---:|
| micro | 0.25 |
| standard | 0.50 |
| meaningful | 1.00 |
| substantial | 1.50 |
| major | 2.00 |

Economic exposure, duration, and task difficulty may determine the band using published logarithmic thresholds. No event exceeds 2.00 because of size.

### 6.3 Direction and severity

Positive evidence has a direction factor of 1.00. Verified negative evidence uses:

| Severity | Factor | Typical meaning |
|---|---:|---|
| minor | 1.00 | bounded failure with little impact |
| material | 2.00 | meaningful missed obligation or harm |
| severe | 4.00 | major loss, repeated material failure, or security incident |
| critical | 8.00 | fraud, catastrophic exploit, uncured default, or compromised control |

A critical classification requires objective proof or adjudicated/corroborated evidence. Severity is part of the schema/EMP and cannot be chosen ad hoc by a provider.

### 6.4 Independence factor

Events are clustered by underlying incident, economic counterparty/control group, campaign, provider-control group, and EMP correlation keys.

- exact duplicates and multiple reports of the same incident: only the canonical event contributes; corroborating records affect confidence, not score mass;
- first independent event in a correlation cluster/window: 1.00;
- second: 0.50;
- third: 0.25;
- fourth and later: 0.125 each;
- total score mass from one cluster in one EMP window is capped at 2.00 EU before severity.

Canonical rank is determined by observed time and evidence ID, never ingestion order.

### 6.5 Provider and schema caps

Before category aggregation, positive influence is limited by deterministic token buckets scoped to each subject and category:

- provider-control group bucket: capacity 4 EU, refill 4 EU per 90 days;
- schema-family bucket: capacity 6 EU, refill 6 EU per 90 days;
- P4 bucket: capacity 1 EU, refill 1 EU per 90 days.

Each bucket starts full at the first eligible event. Events are processed in canonical order. Before each event, refill by `capacity × elapsedSeconds / 7,776,000`, capped at capacity. The event receives the minimum mass available across every applicable bucket; that amount is debited from each. This allocation is stored in the explanation and reproduced during replay.

Negative caps cannot suppress distinct objectively verified incidents, but duplicate/correlated incidents remain deduplicated. No provider may classify or amplify its own unresolved dispute. Provider-control groups—not branding or API keys—define caps.

These are candidate shadow constants. Replay may tighten them; production cannot loosen them without a methodology version change.

### 6.6 Raw mass

For event `e`:

`baseMass_e = EU × proofFactor_e × materialityFactor_e × independenceFactor_e`

For positive evidence:

`rawPositive_e = baseMass_e`

For negative evidence:

`rawNegative_e = baseMass_e × severityFactor_e`

Every factor is stored as an integer millionth. Intermediate results round only at the final division in each multiplication step.

## 7. Evidence-specific aging

Aging uses a deterministic rational half-life curve:

`decay(ageDays, H) = H / (H + ageDays)`

At age `H`, 50% of the event mass remains. Age is whole UTC days from `observedAt` to `computedAt`, floored at zero. Future timestamps are invalid.

Candidate half-lives:

| Evidence family | Positive H | Negative H |
|---|---:|---:|
| operational availability/task completion | 90 days | 180 days |
| financial settlement/repayment | 365 days | 730 days |
| onchain behavior/provenance | 365 days | 730 days |
| identity/control continuity | 365 days | 730 days |
| severe or critical adverse incident | n/a | 1,460 days |
| approved comparative/model evidence | 30 days | 30 days |

An EMP may select a shorter half-life but cannot exceed the family maximum without a methodology revision. Staleness moves an estimate toward neutral and lowers confidence; it never changes the evidence direction.

Active critical flags do not disappear through decay. They require verified remediation or adjudication.

`effectiveMass_e = rawMass_e × decay(ageDays, H_e)`

## 8. Category posterior

Each category uses equal positive and negative prior mass:

- `PRIOR_POSITIVE = 4 EU`
- `PRIOR_NEGATIVE = 4 EU`

For category `c`:

`P_c = 4 EU + Σ effectivePositive_e`

`N_c = 4 EU + Σ effectiveNegative_e`

`category_c = 100 × P_c / (P_c + N_c)`

The result is an absolute, smoothed trust estimate. It is not a literal probability of success for an unspecified task. Diminishing positive returns arise naturally from the posterior ratio. Severity-weighted negative evidence can move the estimate faster.

A category with no eligible evidence remains internally 50 with zero category coverage.

## 9. Overall CRED

Using unrounded category values:

`CRED = round((30×Operational + 25×Financial + 25×Onchain + 20×Identity) / 100)`

No weight is redistributed when a category is missing. This prevents agents from improving their score by avoiding measurable activity.

Public score range is 0–100. Internal arithmetic may approach but not reach exact 0 or 100 while prior mass remains present.

## 10. Domain profiles

Domain profiles are filtered, non-canonical views for task classes such as trading, coding, research, payments, or security. They use the same eligible evidence rules, posterior formula, neutral prior, decay, caps, confidence, and coverage mathematics, restricted to evidence carrying an approved domain tag.

A domain profile never changes Universal CRED and cannot substitute for it. It reports domain category estimates, domain confidence, domain coverage, status, and reason codes. A numeric domain profile remains Provisional until it has at least 4 EU of effective independent domain evidence, two independent control groups, a 30-day observation span, confidence of 40, and domain coverage of 50. Domain tags and cross-domain mappings are ontology-versioned; a provider cannot invent a domain at submission time.

## 11. Coverage

Coverage describes how much of the universal score is supported; it is not score direction.

For each category:

`categoryCoverage_c = min(100, 100 × effectiveIndependentMass_c / 4 EU)`

Here `effectiveIndependentMass` includes eligible positive and negative mass after deduplication, correlation discount, caps, and decay, but before severity multiplication. Severity cannot manufacture coverage.

Overall coverage uses fixed category weights:

`coverage = round((30×covOperational + 25×covFinancial + 25×covOnchain + 20×covIdentity) / 100)`

Category applicability may be reported separately, but canonical weights and coverage are not redistributed.

## 12. Confidence

Confidence measures support for the estimate, not whether the estimate is high.

Five 0–100 dimensions are computed:

1. **Effective sample support (V):** `100 × M / (M + 8 EU)`, where `M` is total effective independent mass before severity.
2. **Source diversity (D):** 0 sources = 0; 1 = 25; 2 = 50; 3 = 70; 4 = 85; 5 or more = 100. Related providers count as one control group.
3. **Recency (R):** mass-weighted mean of the applicable decay factors, expressed 0–100.
4. **Consistency (C):** `max(0, 100 - round(100 × contradictoryMass / max(M, 1 EU)))`. `contradictoryMass` is independently verified mass suspended from scoring because it conflicts with another verified record or binding. Unverified/quarantined claims do not reduce consistency.
5. **Identity assurance (I):** 100 for current controller/custody proof plus verified bindings; 80 for current verified control with partial bindings; 60 for authoritative registry resolution without current control challenge; 0 for unresolved, ambiguous, or conflicted identity.

Let `G = integerFifthRoot(V × D × R × C × I)`, with the greatest integer whose fifth power does not exceed the product. Then:

`confidence = min(G, min(V,D,R,C,I) + 20)`

This geometric weak-link rule prevents event volume from compensating for a single provider, stale evidence, identity ambiguity, or unresolved contradictions.

Hard gates override the number:

- identity conflict or ambiguity: confidence capped at 20 and cannot be Rated;
- one provider-control group only: confidence capped at 39 and cannot be Rated;
- active critical identity compromise: rating status is Suspended;
- P4-only evidence: confidence capped at 25 and cannot be Rated.

## 13. Rating status and publication gates

### 13.1 Unrated

A subject is Unrated when no responsible estimate can be published. Public `score` and `tier` are null. Internal priors are never presented as earned reputation.

Unrated applies when identity cannot be resolved to one canonical subject, or total eligible independent mass is below 1 EU.

### 13.2 Provisional

A subject is Provisional when an estimate exists but one or more Rated gates are unmet. It may expose `estimatedScore`, `estimatedTier`, category estimates, coverage, confidence, and reason codes. Canonical `score` and `tier` remain null, and it cannot unlock Rated policy gates.

### 13.3 Rated

Candidate Rated gates require all of:

- one resolved canonical subject and current custody/operator epoch;
- no `IDENTITY_AMBIGUOUS`, `IDENTITY_CONFLICT`, or active control compromise;
- at least 8 EU total effective independent mass before severity;
- at least two categories with 2 EU each;
- at least two independent provider/control groups, excluding P4-only providers;
- observation span of at least 30 days;
- at least one qualifying event observed within the previous 90 days;
- coverage at least 50;
- confidence at least 40.

These constants are conservative candidates for shadow evaluation. They are not production-approved.

## 14. Tiers and advanced eligibility

Compatibility score bands remain:

- 0–25: Junk
- 26–50: Marginal
- 51–75: Qualified
- 76–90: Prime
- 91–100: Preferred

Unrated is not a numeric tier. Provisional has only an estimated tier.

A Rated subject's score band determines its canonical tier. Prime and Preferred policy privileges require additional support:

- Prime privilege: confidence ≥70, coverage ≥75, at least three independent control groups, observation span ≥90 days, and no active high/critical flag.
- Preferred privilege: confidence ≥85, coverage ≥85, qualifying evidence in at least three categories, at least four independent control groups, observation span ≥180 days, and no active material/high/critical flag.

Failing an advanced privilege gate does not rewrite the numerical score. The artifact reports the tier, privilege eligibility, and limiting reason codes separately.

## 15. Active risk flags and ceilings

Verified current risk affects three independent outputs: evidence mass, status flags, and policy ceilings.

Candidate handling:

| Condition | Score treatment | Status/policy treatment |
|---|---|---|
| active exploit or critical security failure | critical negative evidence | effective privilege tier capped at Junk; sensitive automation blocked |
| uncured verified default | severity-weighted financial negative | effective privilege tier capped at Marginal; new credit blocked |
| identity/control compromise | critical identity negative | rating Suspended; score retained for audit; sensitive actions blocked |
| confirmed sanctions/restriction match | severity-weighted onchain/identity negative evidence under the approved EMP | Compliance Restricted; regulated eligibility blocked; never hidden inside score alone |
| unresolved high-impact offchain allegation | no score effect while pending | PENDING_REVIEW flag; narrowly scoped precautionary policy allowed and disclosed |

The artifact contains `scoreTier`, `effectivePrivilegeTier`, active flags, and reason codes. A strong historical score cannot conceal a current critical risk.

## 16. Remediation and recovery

Time alone does not clear an active serious-risk flag.

- default: proof of repayment, settlement, or adjudicated resolution;
- exploit/security failure: verified patch, containment, affected-scope accounting, and required restitution;
- identity compromise: current controller challenge, binding verification, encumbrance check, and new epoch activation;
- fraud or misconduct: adjudicated correction, restitution where applicable, and published resolution record.

Verified remediation clears the active flag and its temporary ceiling. It does not erase the incident or instantly restore score. The historical negative mass continues to decay under its policy, and recovery requires new independent clean-performance evidence. Corrections, revocations, remediation, and appeals append records; history is never rewritten.

## 17. Confidence, score, and prediction separation

A high score with low confidence is Provisional. A low score may have high confidence. Coverage and confidence never directly raise the category posterior.

Canonical CRED is not a task-specific forecast. Products estimating default, completion, availability, fraud, or exploit probability remain separately versioned predictive models with their own horizons, calibration, validation, drift monitoring, and scope.

## 18. Required reason codes

At minimum, conforming artifacts support:

- `UNRATED_INSUFFICIENT_EVIDENCE`
- `PROVISIONAL_IDENTITY_GATE`
- `PROVISIONAL_VOLUME_GATE`
- `PROVISIONAL_CATEGORY_GATE`
- `PROVISIONAL_DIVERSITY_GATE`
- `PROVISIONAL_AGE_GATE`
- `PROVISIONAL_FRESHNESS_GATE`
- `PROVISIONAL_COVERAGE_GATE`
- `PROVISIONAL_CONFIDENCE_GATE`
- `IDENTITY_AMBIGUOUS`
- `IDENTITY_CONFLICT`
- `IDENTITY_COMPROMISED`
- `ACTIVE_EXPLOIT`
- `VERIFIED_DEFAULT_UNCURED`
- `COMPLIANCE_RESTRICTED`
- `PENDING_HIGH_IMPACT_REVIEW`
- `PROVIDER_CAP_APPLIED`
- `SCHEMA_CAP_APPLIED`
- `CORRELATION_DISCOUNT_APPLIED`
- `DUPLICATE_EXCLUDED`
- `STALE_EVIDENCE_DECAYED`
- `REMEDIATION_VERIFIED`
- `ADVANCED_PRIVILEGE_GATE_UNMET`

## 19. Normative arithmetic fixtures

Unless stated otherwise, events are fresh P1, meaningful, independent, and uncapped.

| Fixture | Positive EU | Negative EU | Category result |
|---|---:|---:|---:|
| no evidence | 0 | 0 | 50 |
| one success | 1 | 0 | 56 |
| four successes | 4 | 0 | 67 |
| eight successes | 8 | 0 | 75 |
| twelve successes | 12 | 0 | 80 |
| thirty-two successes | 32 | 0 | 90 |
| thirty-six successes | 36 | 0 | 91 |
| four successes + minor failure | 4 | 1 | 62 |
| four successes + material failure | 4 | 2 | 57 |
| four successes + severe failure | 4 | 4 | 50 |
| four successes + critical failure | 4 | 8 | 40 |
| twelve successes + critical failure | 12 | 8 | 57 |
| one 90-day-old operational success | 0.5 | 0 | 53 |

Weighted-score fixture:

- Operational = 70
- Financial = 50
- Onchain = 60
- Identity = 80
- Overall = `round((30×70 + 25×50 + 25×60 + 20×80)/100) = 65`

Missing-category fixture:

- Operational = 70 with full category coverage
- other categories = neutral 50 with zero coverage
- Overall = 56
- Overall coverage = 30
- Rating remains Provisional because the two-category and overall coverage gates fail

Correlation fixture:

Four otherwise identical events in one cluster contribute `1 + 0.5 + 0.25 + 0.125 = 1.875 EU`, not 4 EU. A fifth contributes 0.125 but the cluster remains capped at 2 EU.

Decay fixtures for `H=90`:

- age 0: 1.000000
- age 30: 0.750000
- age 90: 0.500000
- age 180: 0.333333
- age 270: 0.250000

## 20. Candidate sensitivity envelope

The initial shadow report must recompute every fixture and replay cohort across:

- prior mass per side: 2, 4, and 8 EU;
- positive half-lives: candidate value ±25%;
- negative half-lives: candidate value ±25%;
- negative severity factors: candidate value ±25%, preserving monotonic order;
- provider/schema caps: 50%, 100%, and 150% of candidate values;
- Rated total mass gate: 6, 8, and 12 EU;
- category gate: 1, 2, and 4 EU;
- confidence and coverage gates: candidate value ±10 points.

Prior sensitivity reference:

| Prior per side | One success | Eight successes | One critical failure |
|---:|---:|---:|---:|
| 2 EU | 60 | 83 | 17 |
| 4 EU | 56 | 75 | 25 |
| 8 EU | 53 | 67 | 33 |

A production proposal must explain why its selected constants outperform alternatives on safety, stability, manipulation resistance, recovery fairness, and predictive validity. Matching legacy scores is not an optimization target.

## 21. Outcome corpus and replay protocol

### 21.1 Corpus construction

Create a versioned, content-addressed corpus of verified outcomes containing:

- canonical subject and epoch;
- native proof or commitment;
- event schema and EMP versions;
- observation, finality, correction, dispute, and remediation times;
- provider and provider-control group;
- category, direction, materiality, exposure band, severity, and correlation keys;
- adjudicated outcome labels where applicable;
- privacy-preserving disclosure sufficient for independent verification.

Sampling must include thin files, mature agents, multiple chains/ecosystems, positive and negative outcomes, disputed/corrected events, provider outages, identity transfers, and attempted wash/Sybil patterns.

### 21.2 Leakage prevention

Time-split replay is mandatory. Evidence observed after the evaluation cutoff cannot affect a score at the cutoff. Provider transformations and identity links must use the versions available at that time. Related subjects, wallets, operators, and counterparties must be grouped to prevent train/test leakage in predictive validation.

### 21.3 Shadow outputs

For every subject and hourly snapshot, publish or privately disclose where required:

- legacy score/tier and candidate estimate/status/tier;
- all four old/new category values where available;
- confidence, coverage, freshness, and flags;
- included, excluded, capped, decayed, deduplicated, and quarantined evidence counts/mass;
- reason codes and evidence-set hash;
- migration delta and tier transition;
- identity resolution state and epoch.

## 22. Evaluation and launch gates

Production approval requires all of the following.

### 22.1 Determinism

- independent implementations reproduce every fixture and sampled artifact byte-for-byte;
- replay order, database order, and provider delivery order do not change results;
- corrections and revocations reproduce historical snapshots without rewriting them.

### 22.2 Safety and monotonicity

- adding eligible positive evidence cannot lower its category absent a simultaneous time/correction change;
- adding eligible negative evidence cannot raise its category;
- duplicate evidence cannot change score mass;
- stale or missing evidence cannot become negative;
- payment, staking, token ownership, adoption, or profile completion cannot raise CRED;
- no single provider or correlated cluster can manufacture Rated/Prime/Preferred eligibility.

### 22.3 Migration transparency

Publish:

- complete score-delta distribution;
- tier-transition matrix using the canonical 0–25/26–50/51–75/76–90/91–100 bands;
- count moving by more than 5, 10, 20, and 30 points;
- changes to Rated/Provisional/Unrated status;
- segment analysis by chain, source availability, age, evidence volume, category coverage, and identity quality;
- named explanations for extreme deltas;
- all known limitations.

### 22.4 Outcome validity

Because Canonical CRED is not itself a probability forecast, evaluation uses ordering and stability rather than claiming direct calibration:

- higher CRED/category cohorts must show monotonically lower relevant verified failure rates after controlling for confidence and coverage;
- bootstrap uncertainty must be reported for every cohort;
- no tier can be called validated where sample size or outcome incidence is insufficient;
- task-specific probability calibration belongs to the separate prediction engine.

### 22.5 Manipulation and fairness

- synthetic wash, replay, duplicate-provider, correlated-counterparty, identity-split, and high-value self-dealing attacks fail to manufacture material score/confidence gains;
- recovery tests prove remediation clears active flags without deleting history or instantly restoring score;
- missing provider coverage and ecosystem choice do not count as failure;
- segment deltas are reviewed for measurement bias, not forced to demographic parity.

### 22.6 Operational gate

Run candidate shadow scoring hourly for at least 60 consecutive days after the verified corpus pipeline is live. No unexplained deterministic drift, evidence loss, or unresolved critical scoring defect may remain. Quigley/authorized governance must explicitly approve the final constants and methodology version before production activation.

## 23. Artifact contract

Every candidate artifact includes:

- methodology ID and parameter-set hash;
- schema, provider-registry, identity-graph, and ontology versions;
- subject and actor/custody epoch;
- rating status;
- canonical score/tier or null;
- provisional estimate/tier where applicable;
- unrounded category fixed-point values and public integers;
- confidence and its five dimensions;
- overall and category coverage;
- score tier, effective privilege tier, advanced eligibility;
- active flags and reason codes;
- computed time, valid-until time, evidence-set hash, snapshot/root references;
- signature and canonical serialization version.

Hourly publication cadence remains the compatibility requirement. A 24-hour validity window must not be introduced silently.

## 24. Governance and versioning

Any change to prior mass, factors, half-lives, caps, formulas, weights, rating gates, tier boundaries, confidence/coverage math, or risk ceilings creates a new methodology version. Parameter changes require fixtures, replay, migration deltas, and approval. Registry additions that conform to existing bounded rules are versioned registry changes but cannot silently expand score influence.

Emergency actions may suspend a provider, schema, or eligibility path. They may not secretly alter historical evidence or score math. The last valid artifact remains available with explicit stale/suspended status.

## 25. Candidate recommendation

Implement `cred-methodology-candidate-0.1.0` only as a deterministic shadow engine and corpus generator. Do not map it to live API fields, privileges, rewards, or onchain publication. Its purpose is to generate the evidence needed to approve, revise, or reject the constants honestly.

The final production methodology must be selected from published replay evidence—not intuition, partner pressure, legacy-score mimicry, or commercial considerations.
