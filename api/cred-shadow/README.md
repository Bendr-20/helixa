# Canonical CRED shadow engine

This directory contains the deterministic Candidate 0.1 CRED scorer and the pure offline legacy-to-candidate replay engine. It is **not production-approved**. Legacy scores are comparison data, not labels or training truth. No module here changes a live score, API, tier, privilege, reward, database, oracle, or contract.

## Safety boundary

- Production runtime roots must not import this directory. `production-isolation.test.js` builds an Acorn dependency graph and fails on direct or indirect reachability.
- The only executable is `scripts/run-cred-shadow-replay.js`. It reads a local JSON/JSONL corpus and writes a new local JSON report.
- The CLI does not acquire evidence. Provider adapters, identity-graph persistence, registry ingestion, webhooks, and verified corpus construction require separate plans.
- Network clients, listeners, secrets, signers/providers, child processes, schedulers, production database filenames, and onchain writers are forbidden in the shadow graph.
- Artifacts are unsigned. External signing, envelope assembly, publication, and distribution are deferred.
- The 60-day shadow-validation clock starts only after a verified evidence/corpus pipeline is live; synthetic replay does not start it.

The production graph has an exact-file legacy loader allowlist only for `api/cred-oracle-updater.js` (`ethers` and AWS Secrets Manager loaded from its local `node_modules`) and `api/v2-server.js` (AWS Secrets Manager plus the Talent Protocol and Bankr user-config files). Every expression is pinned verbatim in `production-isolation.test.js`; no shadow loader is allowlisted.

## Commands

From the repository root:

```sh
npm run test:cred-shadow --prefix api
npm run cred:shadow:replay --prefix api -- --input /absolute/corpus.jsonl --output /absolute/report.json
npm run cred:shadow:replay --prefix api -- --input corpus.json --output report.json --pretty
```

Only `--input <json|jsonl>`, `--output <json>`, and `--pretty` are accepted. Input must be a real local regular file, not stdin, a URL, directory, symlink, or database path. Output must not exist; its parent must be a real directory. The CLI writes a mode-0600 sibling temporary file, fsyncs it, links it without clobbering, removes the temporary file, and fsyncs the directory.

Limits: 64 MiB per input file, 100,000 snapshots, 1 MiB per JSONL row or serialized JSON snapshot, and 100,000 evidence records per snapshot.

## Normalized input contract

Each row is a closed `cred-shadow-snapshot-v1` object. Unknown fields, unknown enum values, invalid timestamps, duplicate evidence IDs, missing pinned versions, invalid EMP proofs, and future evidence fail closed.

```text
snapshotSchemaVersion, methodologyId, computedAt, validUntil
subject: subjectId, actorEpochId
versions: identityGraph, providerRegistry, schemaRegistry, empRegistry, ontology
roots: inputManifestHash, snapshotRoot, empRegistryRoot
empPolicies[]: empId, empVersion, policyHash, registryLeafIndex, registryProof,
  evidenceFamily, positiveHalfLifeDays, negativeHalfLifeDays, correlationWindowSeconds,
  clusterCapMicroEu, providerBucket, schemaBucket, p4Bucket
identity: resolution, assurance, controlProofObservedAt, compromised
records[]: evidenceId, subjectId, actorEpochId, schemaId, schemaVersion, schemaFamilyId,
  empId, empVersion, empWindowSeconds, providerId, providerControlGroup, category,
  direction, proofClass, materiality, severity, evidenceFamily, observedAt, incidentKey,
  correlationKey, domainTags, status, scoreEligible, finality, correctionOf, remediationOf,
  disputeId, nativePayloadHash, transformationHash, proofRefs
contradictions[]: contradictionId, massMicroEu, status, recordIds
risks[]: riskId, type, status, severity, observedAt, remediationObservedAt, proofRefs, remediationProofRefs
legacy: score, tier, ratingStatus, categoryScores, confidence, coverage
segments: ecosystem, evidenceVolumeBand, subjectAgeBand, identityQualityBand,
  sourceAvailabilityBand, categoryCoverageBand
```

`validUntil` must be exactly one hour after `computedAt`. Records score only when they are `ACTIVE`, score-eligible, and final or not-applicable. Every record remains in lifecycle accounting even when excluded, quarantined, deduplicated, capped, or decayed. Each record must bind to one EMP policy whose leaf/proof validates against the pinned EMP registry root. See the authoritative field enums and Merkle contract in `docs/superpowers/specs/2026-10-10-canonical-cred-methodology-design.md`.

## Deterministic scoring

All consensus arithmetic is bounded `BigInt` fixed point at scale 1,000,000; division rounds half away from zero.

1. Candidate event mass applies proof, materiality, and independence factors sequentially with deterministic rounding. Duplicate incidents are removed; correlated observations receive 1, 1/2, 1/4, then 1/8 independence and a 2 EU cluster cap.
2. Positive mass is constrained by provider-control-group, schema-family, and P4 token buckets. Negative mass is not suppressed by positive-influence buckets.
3. Rational aging uses `decay = H / (H + age)`. Negative score mass applies the severity multiplier before decay; independent sample mass is not severity-amplified.
4. Each category posterior starts at neutral 4 EU positive and 4 EU negative: `100 × (4 EU + positive) / (8 EU + positive + negative)`.
5. Overall score weights operational 30%, financial 25%, onchain 25%, and identity 20%, with no redistribution for missing evidence.
6. Category coverage is `min(100, 100 × independentMass / 4 EU)`; overall coverage uses the category weights.
7. Confidence combines sample support, source diversity, recency, consistency, and identity assurance using an integer fifth-root geometric mean capped at weakest dimension + 20. Identity ambiguity/conflict, a single control group, and P4-only evidence apply hard caps.
8. Publication precedence is Suspended, Unrated, Provisional, then Rated. Only Rated subjects expose canonical score/tier or advanced eligibility. Provisional/Suspended may expose estimates; Unrated exposes neither.

Tiers are Junk 0–25, Marginal 26–50, Qualified 51–75, Prime 76–90, and Preferred 91–100. Active risk flags and privilege ceilings remain separate from evidence score mass. Remediation clears eligible active ceilings only when verified; it never erases history.

## Outputs and artifacts

Replay rows are sorted by subject ID, actor epoch, then computation time. Every snapshot reports legacy/candidate score, tier, rating state, categories, confidence dimensions, coverage, identity resolution, freshness, flags, evidence hash, transition, explanations, and included/excluded/quarantined/deduplicated/capped/decayed counts and mass. Aggregates include the complete sorted delta series, >5/>10/>20/>30 counts, status/tier matrices, and every closed segment summary.

Sensitivity is baseline plus one-at-a-time, non-Cartesian variants in protocol order. Half-life variants round to whole days, half away from zero; fixed-point factors and caps use the same tie rule. Every variant carries a parameter-set hash and per-subject/aggregate delta; production constants remain frozen. Lifecycle and deduplication mass metrics use nominal proof × materiality event mass; capped and decayed mass report the mass actually removed at those stages.

`artifact.js` emits `cred-cjson-v1` canonical bytes and domain-separated parameter, evidence, and unsigned-artifact hashes. Object keys use unsigned UTF-8 byte order, arrays retain field-defined canonical order, unsupported JSON values are rejected, and consensus integers are canonical decimal strings.

## Reason codes

Evidence preparation: `LIFECYCLE_INELIGIBLE`, `DUPLICATE_EXCLUDED`, `CORRELATION_DISCOUNT_APPLIED`, `CORRELATION_CAP_APPLIED`, `PROVIDER_CAP_APPLIED`, `SCHEMA_CAP_APPLIED`, `P4_CAP_APPLIED`, `STALE_EVIDENCE_DECAYED`.

Publication gates: `UNRATED_INSUFFICIENT_EVIDENCE`, `IDENTITY_AMBIGUOUS`, `IDENTITY_CONFLICT`, `PROVISIONAL_IDENTITY_GATE`, `PROVISIONAL_VOLUME_GATE`, `PROVISIONAL_CATEGORY_GATE`, `PROVISIONAL_DIVERSITY_GATE`, `PROVISIONAL_AGE_GATE`, `PROVISIONAL_FRESHNESS_GATE`, `PROVISIONAL_COVERAGE_GATE`, `PROVISIONAL_CONFIDENCE_GATE`, `ADVANCED_PRIVILEGE_GATE_UNMET`.

Risk/remediation: `ACTIVE_EXPLOIT`, `VERIFIED_DEFAULT_UNCURED`, `IDENTITY_COMPROMISED`, `COMPLIANCE_RESTRICTED`, `PENDING_HIGH_IMPACT_REVIEW`, `REMEDIATION_VERIFIED`.

## Known limitations and deferred work

This candidate has only synthetic/normative fixtures until a verified corpus pipeline exists. It does not discover identity links, attest providers, ingest chain/runtime/app events, adjudicate disputes, train a model, predict outcomes, sign artifacts, publish roots, mutate production state, or enforce product privileges. Outcome validity, calibration, manipulation/fairness analysis, and operational launch gates require the planned 60-day time-split shadow corpus and final approval.

## Methodology traceability

| Methodology section | Code/test or explicit deferral |
|---|---|
| 1 Decision/non-decision | This safety boundary; `production-isolation.test.js` |
| 2 Meaning of CRED | Canonical outputs in `score.js`; prediction remains deferred |
| 3 Determinism/numeric conventions | `integer-math.js`, `artifact.js`; integer/artifact tests |
| 4 Eligible evidence | `evidence.js`; evidence/adversarial tests |
| 5 EMP gate | EMP validation and Merkle proof in `evidence.js`; evidence tests |
| 6 Candidate event mass | `evidence.js`, `parameters.js`; methodology fixtures |
| 7 Evidence-specific aging | `category.js`; category and replay fractional-day tests |
| 8 Category posterior | `category.js`; normative category fixtures |
| 9 Overall CRED | `category.js`, `score.js`; score tests |
| 10 Domain profiles | `scoreDomainProfile`; adversarial domain-isolation tests |
| 11 Coverage | `confidence.js`; score tests |
| 12 Confidence | `confidence.js`; score/adversarial tests |
| 13 Rating/publication gates | `score.js`; boundary/adversarial tests |
| 14 Tiers/advanced eligibility | `score.js`; exact tier and privilege tests |
| 15 Risk flags/ceilings | `score.js`; adversarial risk tests |
| 16 Remediation/recovery | `score.js`; remediation history tests |
| 17 Confidence/score/prediction separation | Score and confidence outputs implemented; prediction deferred |
| 18 Required reason codes | `evidence.js`, `category.js`, `score.js`; fixture assertions |
| 19 Normative arithmetic fixtures | `fixtures/methodology-fixtures.json`; methodology fixture tests |
| 20 Sensitivity envelope | `replay.js`; pinned replay sensitivity tests |
| 21 Outcome corpus/replay | Offline replay implemented; verified corpus acquisition deferred |
| 22 Evaluation/launch gates | Determinism/safety/migration tests implemented; 60-day outcome, fairness, and operational gates deferred |
| 23 Artifact contract | Canonical unsigned payload/hashes in `artifact.js`; signing/distribution deferred |
| 24 Governance/versioning | Pinned methodology/registry/ontology versions in snapshot/artifact; governance process deferred |
| 25 Candidate recommendation | Shadow-only candidate; production switch requires corpus results and final approval |
