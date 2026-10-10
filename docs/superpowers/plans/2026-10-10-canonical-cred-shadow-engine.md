# Canonical CRED Shadow Engine Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, fixture-proven Canonical CRED candidate scorer and offline legacy-to-candidate replay tool without changing any production score, API, privilege, reward, database, oracle, or onchain state.

**Architecture:** Add a self-contained CommonJS module under `api/cred-shadow/`. The pure scoring core accepts a pinned parameter set, canonical subject, normalized eligible evidence, and computation time; it returns a versioned shadow artifact. A separate offline replay CLI reads JSON/JSONL snapshots and writes comparison reports. No existing production route imports the module in this plan.

**Tech Stack:** Node.js 24, CommonJS, built-in `node:test`, `node:assert/strict`, `node:crypto`, BigInt fixed-point arithmetic, JSON/JSONL fixtures, and test-only `acorn`/`acorn-walk` for dependency-graph isolation.

**Authoritative spec:** `docs/superpowers/specs/2026-10-10-canonical-cred-methodology-design.md`

---

## Scope and safety boundary

This plan covers the first independently testable subsystem: deterministic shadow scoring and offline replay. Evidence acquisition, provider adapters, identity-graph persistence, production APIs, database migrations, webhooks, oracle publication, and live policy integration require separate plans after this engine passes fixtures and replay.

The implementation must remain unreachable from `api/v2-server.js`, `api/indexer.js`, `api/cred-oracle-updater.js`, production databases, and contracts. The only executable entry point is an operator-invoked offline CLI. Tests must fail if a production module imports `api/cred-shadow`.

## File map

- Create `api/cred-shadow/parameters.js` — immutable candidate parameter set and enums.
- Create `api/cred-shadow/integer-math.js` — bounded BigInt division, multiplication, rational decay, integer roots, and public rounding.
- Create `api/cred-shadow/evidence.js` — normalized event validation, canonical ordering, incident deduplication, correlation discounts, and token-bucket caps.
- Create `api/cred-shadow/category.js` — decayed positive/negative mass and category posterior.
- Create `api/cred-shadow/confidence.js` — coverage dimensions, weak-link confidence, rating gates, and hard caps.
- Create `api/cred-shadow/score.js` — four-category orchestration, overall score, tiers, risk ceilings, domain profiles, and reason codes.
- Create `api/cred-shadow/artifact.js` — canonical unsigned payload, evidence-set hash, parameter hash, and stable serialization.
- Create `api/cred-shadow/replay.js` — pure legacy/candidate comparison and aggregate migration report.
- Create `api/scripts/run-cred-shadow-replay.js` — offline JSON/JSONL CLI; refuses production mutation options.
- Create `api/cred-shadow/README.md` — input contract, commands, safety boundary, and limitations.
- Create `api/test/cred-shadow/*.test.js` — focused unit, fixture, adversarial, artifact, replay, and import-boundary tests.
- Create `api/test/cred-shadow/fixtures/methodology-fixtures.json` — normative spec fixtures.
- Create `api/test/cred-shadow/fixtures/replay-input.jsonl` — synthetic migration examples only.
- Modify `api/package.json` — add `test:cred-shadow` and `cred:shadow:replay` scripts plus test-only `acorn`/`acorn-walk`.
- Modify `api/package-lock.json` — lock those test-only parser dependencies.

## Versioned shadow snapshot envelope

The pure engine accepts one complete, closed snapshot envelope. Every string enum is closed and every unexpected field is rejected. The envelope separates score-bearing records from confidence/risk state while preserving excluded and quarantined records for replay accounting.

```js
{
  snapshotSchemaVersion: 'cred-shadow-snapshot-v1',
  methodologyId: 'cred-methodology-candidate-0.1.0',
  computedAt: '2026-10-10T00:00:00.000Z',
  validUntil: '2026-10-10T01:00:00.000Z',
  subject: { subjectId: 'subject_...', actorEpochId: 'epoch_...' },
  versions: {
    identityGraph: 'identity-...', providerRegistry: 'providers-...',
    schemaRegistry: 'schemas-...', empRegistry: 'emps-...', ontology: 'ontology-...'
  },
  roots: { inputManifestHash: 'sha256:...', snapshotRoot: null, empRegistryRoot: 'sha256:...' },
  empPolicies: [{
    empId: 'emp_...', empVersion: '1.0.0', policyHash: 'sha256:...',
    registryLeafIndex: 0, registryProof: ['sha256:...'],
    evidenceFamily: 'operational', positiveHalfLifeDays: 90, negativeHalfLifeDays: 180,
    correlationWindowSeconds: 7776000, clusterCapMicroEu: '2000000',
    providerBucket: { capacityMicroEu: '4000000', refillSeconds: 7776000 },
    schemaBucket: { capacityMicroEu: '6000000', refillSeconds: 7776000 },
    p4Bucket: { capacityMicroEu: '1000000', refillSeconds: 7776000 }
  }],
  identity: {
    resolution: 'resolved|ambiguous|conflict|unresolved',
    assurance: 'current-control-bindings|current-control-partial|registry-only|none',
    controlProofObservedAt: null|'ISO timestamp', compromised: false
  },
  records: [/* normalized evidence records below, including excluded lifecycle states */],
  contradictions: [{
    contradictionId: 'contradiction_...', massMicroEu: '1000000',
    status: 'unresolved|resolved', recordIds: ['ev_a', 'ev_b']
  }],
  risks: [{
    riskId: 'risk_...', type: 'active-exploit|default|identity-compromise|compliance-restriction|pending-allegation',
    status: 'active|remediated|reversed', severity: 'material|severe|critical',
    observedAt: 'ISO timestamp', remediationObservedAt: null|'ISO timestamp',
    proofRefs: ['https://...'], remediationProofRefs: []
  }],
  legacy: null|{
    score: null|72, tier: null|'Junk|Marginal|Qualified|Prime|Preferred',
    ratingStatus: 'UNRATED|PROVISIONAL|RATED|SUSPENDED',
    categoryScores: { operational: null|70, financial: null|50, onchain: null|60, identity: null|80 },
    confidence: null|81, coverage: null|76
  },
  segments: {
    ecosystem: 'base|ethereum|solana|other',
    evidenceVolumeBand: 'none|thin|established|deep',
    subjectAgeBand: 'new|developing|mature',
    identityQualityBand: 'unresolved|registry|controlled|fully-bound',
    sourceAvailabilityBand: 'single|limited|diverse|broad',
    categoryCoverageBand: 'none|one|two|three|four'
  }
}
```

The scorer requires all pinned version fields and derives lifecycle counts/mass from `records`; no registry-version placeholders are allowed. Every record must resolve to exactly one matching `empPolicies` entry by `empId` and `empVersion`. Canonical EMP policy bytes are SHA-256 hashed and each `registryProof` is verified against the pinned `empRegistryRoot`; caller-asserted policy data without a valid inclusion proof is rejected.

**EMP Merkle contract:** policy bytes are `cred-cjson-v1` of exactly `[empId, empVersion, evidenceFamily, positiveHalfLifeDays, negativeHalfLifeDays, correlationWindowSeconds, clusterCapMicroEu, providerBucket.capacityMicroEu, providerBucket.refillSeconds, schemaBucket.capacityMicroEu, schemaBucket.refillSeconds, p4Bucket.capacityMicroEu, p4Bucket.refillSeconds]`, preserving this array order and using `null` for non-applicable positive half-life. The leaf is `SHA256(UTF8("CRED-EMP-LEAF-v1\0") || policyBytes)`. Proof entries are exactly `{side:"left|right",hash:"sha256:<64 lowercase hex>"}`. Internal nodes are `SHA256(UTF8("CRED-EMP-NODE-v1\0") || left32 || right32)` in proof-declared orientation. Tree construction duplicates the final node at odd-width levels. `policyHash` equals the prefixed leaf hash. Validate leaf index/proof orientation and require the calculated prefixed root to equal `roots.empRegistryRoot`. The parameter/evidence hash domains and unsigned payload bind the EMP registry version, root, policy hashes, and canonical policy bytes. EMP half-lives must be positive and no longer than the methodology family maximum, except `severe-critical.positiveHalfLifeDays` must be null because positive evidence is not applicable. EMP correlation windows and provider/schema/cluster caps may only be equal to or tighter than methodology maxima. P4 limits can only tighten. `computedAt` in each envelope is mandatory and authoritative. The CLI has no computation-time override.

## Normalized evidence record

Each `records` item has this shape:

```js
{
  evidenceId: 'ev_...',
  subjectId: 'subject_...',
  actorEpochId: 'epoch_...',
  schemaId: 'schema_...',
  schemaVersion: '1.0.0',
  schemaFamilyId: 'schema-family_...',
  empId: 'emp_...',
  empVersion: '1.0.0',
  empWindowSeconds: 7776000,
  providerId: 'provider_...',
  providerControlGroup: 'control_...',
  category: 'operational|financial|onchain|identity',
  direction: 'positive|negative',
  proofClass: 'P1|P2|P3|P4',
  materiality: 'micro|standard|meaningful|substantial|major',
  severity: null|'minor'|'material'|'severe'|'critical',
  evidenceFamily: 'operational|financial|onchain|identity|severe-critical|comparative',
  observedAt: '2026-10-10T00:00:00.000Z',
  incidentKey: 'incident_...',
  correlationKey: 'cluster_...',
  domainTags: ['coding'],
  status: 'RECEIVED|VALIDATED|VERIFIED|QUARANTINED|PENDING_REVIEW|ACTIVE|DISPUTED|REVOKED|EXPIRED',
  scoreEligible: true,
  finality: 'final|pending|reorged|not-applicable',
  correctionOf: null|'ev_...',
  remediationOf: null|'ev_...',
  disputeId: null|'dispute_...',
  nativePayloadHash: 'sha256:...',
  transformationHash: 'sha256:...',
  proofRefs: ['https://...']
}
```

The caller supplies resolved identity and lifecycle facts. The engine independently enforces that only ACTIVE, final/not-applicable, score-eligible records enter score mass; all others remain available for counts, excluded/quarantined mass, confidence contradictions, and explanations. Remediation records never erase prior records.

# Chunk 1: Deterministic scoring core

### Task 1: Candidate parameters and fixed-point arithmetic

**Files:**
- Create: `api/cred-shadow/parameters.js`
- Create: `api/cred-shadow/integer-math.js`
- Test: `api/test/cred-shadow/integer-math.test.js`

- [ ] **Step 1: Write failing tests for integer operations**

Cover:

```js
assert.equal(roundDiv(1n, 2n), 1n);
assert.equal(roundDiv(-1n, 2n), -1n);
assert.equal(mulDivRound(1_000_000n, 750_000n, 1_000_000n), 750_000n);
assert.equal(decayFactor(30n, 90n), 750_000n);
assert.equal(decayFactor(90n, 90n), 500_000n);
assert.equal(integerNthRoot(32n ** 5n, 5), 32n);
assert.equal(integerNthRoot((32n ** 5n) - 1n, 5), 31n);
```

Also assert division-by-zero rejection, negative half-life rejection, bounded fifth-root input, `INT64_MIN` division, and rounding near both int64 limits without addition/absolute-value overflow.

- [ ] **Step 2: Run the focused test and prove RED**

Run: `node --test api/test/cred-shadow/integer-math.test.js`

Expected: FAIL because `api/cred-shadow/integer-math.js` does not exist.

- [ ] **Step 3: Implement immutable candidate parameters**

Export deeply frozen values for:

- `methodologyId = cred-methodology-candidate-0.1.0`
- `SCALE = 1_000_000n`, `EU = 1_000_000n`
- category weights 30/25/25/20
- prior positive/negative mass 4 EU each
- proof, materiality, severity, and independence factors
- evidence-family positive/negative half-lives
- deterministic provider/schema/P4 token-bucket capacities and 90-day refill period
- coverage, confidence, rating, Prime, and Preferred candidate gates
- canonical tier bands

Reject mutation attempts in tests.

- [ ] **Step 4: Implement bounded BigInt helpers**

Define `INT64_MIN = -(2n ** 63n)`, `INT64_MAX = (2n ** 63n) - 1n`, maximum 100,000 records per snapshot, maximum raw event mass 16 EU before severity, and maximum category aggregate mass 1,000,000 EU. Reject inputs or accumulations exceeding those bounds. No arithmetic helper may require a wide intermediate even when the final result fits.

`mulDivRound` first GCD-reduces operands, then uses an exact signed-64 binary multiply/divide algorithm when the reduced product still would overflow. The algorithm tracks quotient and remainder while scanning multiplier bits and uses overflow-safe modular addition (`x >= m - y ? x - (m - y) : x + y`) rather than forming a wide product; quotient accumulation is monotonic and bounded against int64 on every step. Round half away from zero from the final remainder. Tests must include a valid coprime case where the unreduced and GCD-reduced products exceed int64 but the quotient fits, a valid reducible-overflow case, and true quotient/aggregate overflow failures. Use explicit functions rather than floating point:

```js
function roundDiv(numerator, denominator) {
  // Use signed quotient/remainder directly: q = numerator / denominator, r = numerator % denominator.
  // Compare remainder magnitude with `denominator - magnitude` and adjust q by sign.
  // Never negate INT64_MIN and never add half the denominator to the numerator.
}

function mulDivRound(left, right, denominator) {
  // GCD-reduce, then use overflow-safe bitwise quotient/remainder accumulation;
  // never construct left * right when that product exceeds int64.
}

function decayFactor(ageDays, halfLifeDays) {
  if (ageDays < 0n || halfLifeDays <= 0n) throw new RangeError('invalid decay input');
  return mulDivRound(SCALE, halfLifeDays, halfLifeDays + ageDays);
}
```

Add conservative intermediate bounds and an integer binary-search nth root.

- [ ] **Step 5: Run focused tests and prove GREEN**

Run: `node --test api/test/cred-shadow/integer-math.test.js`

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add api/cred-shadow/parameters.js api/cred-shadow/integer-math.js api/test/cred-shadow/integer-math.test.js
git commit -m "feat: add deterministic CRED integer math"
```

### Task 2: Strict evidence validation and canonical ordering

**Files:**
- Create: `api/cred-shadow/evidence.js`
- Test: `api/test/cred-shadow/evidence.test.js`

- [ ] **Step 1: Write failing validation tests**

Test one valid event and reject:

- unknown envelope/record fields or enums;
- missing/mismatched methodology, identity-graph, provider, schema, or ontology versions;
- missing or duplicate EMP policy entries, invalid EMP Merkle inclusion proofs, or EMP policy hashes that do not match canonical policy bytes; missing EMP/schema-family/window, provenance hashes, or lifecycle/finality fields;
- EMP hashes, families, half-lives, windows, or caps that do not match the record or exceed methodology maxima;
- noncanonical timestamps or future observations;
- negative evidence without severity;
- positive evidence with severity;
- duplicate evidence IDs;
- mismatched subject or actor epoch;
- non-ACTIVE, disputed, revoked, expired, pending-finality, or score-ineligible records entering score mass while still retaining their counts/mass;
- P4 critical/severe evidence;
- empty incident/correlation/control-group keys;
- unsorted or duplicate domain tags and proof references.

- [ ] **Step 2: Run focused test and prove RED**

Run: `node --test api/test/cred-shadow/evidence.test.js`

Expected: FAIL because the evidence module does not exist.

- [ ] **Step 3: Implement strict normalization**

Return new frozen objects. Validate the complete envelope, identity state, contradictions, risks, registry versions, and roots. Parse timestamps once to epoch seconds. Canonical order is ascending `observedAt`, then bytewise `evidenceId`. Do not accept caller-provided factors or computed score mass; `massMicroEu` is accepted only for independently verified contradiction accounting and is bounded by total verified independent mass.

- [ ] **Step 4: Implement deduplication and correlation ranking**

- First resolve lifecycle/finality/score eligibility and separate ineligible records for accounting. Only then group otherwise score-eligible records by `incidentKey`; select the first eligible canonical event as score-bearing and retain later eligible records only as corroboration metadata. An earlier quarantined, disputed, pending, revoked, expired, or score-ineligible record can never preempt a later eligible record. Add a dedicated preemption regression test.
- Within each `correlationKey` and EMP window, apply factors `1, 0.5, 0.25, 0.125...`.
- Cap pre-severity cluster mass at 2 EU.
- Include stable reason codes for duplicate exclusion and correlation discount.

- [ ] **Step 5: Implement deterministic token buckets**

For positive evidence only, scope buckets to subject + category + provider-control group, `schemaFamilyId`, or P4 class. Each EMP supplies validated correlation, decay, and cap policy. Effective limits are the tighter of the EMP policy and methodology maximum; candidate defaults use 7,776,000-second refill periods. Initialize full at the first canonical event, refill using elapsed seconds, and debit the minimum available mass across all applicable buckets. Store pre-cap and post-cap mass plus cap reason codes.

- [ ] **Step 6: Run focused tests and prove GREEN**

Run: `node --test api/test/cred-shadow/evidence.test.js`

Expected: PASS with exact mass assertions for duplicate, cluster, provider, schema, and P4 cases.

- [ ] **Step 7: Commit Task 2**

```bash
git add api/cred-shadow/evidence.js api/test/cred-shadow/evidence.test.js
git commit -m "feat: normalize and cap CRED evidence"
```

### Task 3: Category posterior and normative fixtures

**Files:**
- Create: `api/cred-shadow/category.js`
- Create: `api/test/cred-shadow/fixtures/methodology-fixtures.json`
- Test: `api/test/cred-shadow/category.test.js`
- Test: `api/test/cred-shadow/methodology-fixtures.test.js`

- [ ] **Step 1: Encode the normative fixtures as data**

Represent the spec table exactly: no evidence = 50; 1/4/8/12/32/36 positive EU; mixed failure rows; operational half-life examples; weighted score = 65; missing-category overall = 56 and coverage = 30.

- [ ] **Step 2: Write failing posterior and decay tests**

Assert:

```js
category(0, 0) === 50
category(1, 0) === 56
category(8, 0) === 75
category(4, 8) === 40
category(12, 8) === 57
```

Use internal millionth precision and public round only at the output boundary.

- [ ] **Step 3: Run focused tests and prove RED**

Run: `node --test api/test/cred-shadow/category.test.js api/test/cred-shadow/methodology-fixtures.test.js`

Expected: FAIL because category scoring is not implemented.

- [ ] **Step 4: Implement event and category mass**

Compute:

`baseMass = EU × proof × materiality × independence`

`negativeRawMass = baseMass × severity`

`effectiveMass = cappedRawMass × H/(H+ageDays)`

Then compute `P = 4 EU + positive`, `N = 4 EU + negative`, and `category = 100 × P/(P+N)`. Return positive mass, negative mass, independent pre-severity mass, internal fixed-point score, public integer, freshness inputs, and reason codes.

- [ ] **Step 5: Run fixtures and prove GREEN**

Run: `node --test api/test/cred-shadow/category.test.js api/test/cred-shadow/methodology-fixtures.test.js`

Expected: PASS for every normative fixture.

- [ ] **Step 6: Commit Task 3**

```bash
git add api/cred-shadow/category.js api/test/cred-shadow/category.test.js api/test/cred-shadow/methodology-fixtures.test.js api/test/cred-shadow/fixtures/methodology-fixtures.json
git commit -m "feat: score CRED category posteriors"
```

### Task 4: Coverage, confidence, ratings, tiers, and risk ceilings

**Files:**
- Create: `api/cred-shadow/confidence.js`
- Create: `api/cred-shadow/score.js`
- Test: `api/test/cred-shadow/score.test.js`
- Test: `api/test/cred-shadow/adversarial.test.js`

- [ ] **Step 1: Write failing overall-score tests**

Cover fixed category weighting, no redistribution, per-category and overall coverage, exact tier boundaries, Unrated/Provisional/Rated state, Prime/Preferred privilege gates, and null canonical score/tier for non-Rated subjects.

- [ ] **Step 2: Write failing confidence tests**

Implement fixtures for the five dimensions:

- sample support `100 × M/(M+8 EU)`;
- source diversity table where corroborating records count only when their provider-control group is independent; P4-only sources cannot satisfy Rated diversity;
- mass-weighted recency over effective independent pre-severity mass; if mass is zero, recency is 0;
- exact contradiction formula;
- identity assurance from the validated envelope enum mapped to 100/80/60/0.

Define status precedence as `Suspended > Unrated > Provisional > Rated`; identity conflict/ambiguity is Unrated, active identity compromise is Suspended, and active critical flags persist independently of score decay until a verified remediation lifecycle transition. Suspended artifacts retain `estimatedScore`/`estimatedTier` for audit while canonical `score`/`tier` are null.

Assert integer fifth-root geometric combination and `min(G, weakest + 20)`. Test identity conflict, one-source, P4-only, and active identity-compromise caps.

- [ ] **Step 3: Write failing active-risk tests**

Assert score, score tier, effective privilege tier, rating status, and flags remain separate. Active exploit caps effective privileges at Junk; uncured default caps at Marginal; identity compromise suspends rating; compliance restriction blocks regulated eligibility. Pending allegations do not change score mass. For policy gating only, evidence/risk severity `severe` maps to the human-facing `high` flag used by the methodology privilege language; stored evidence severity remains `severe`.

- [ ] **Step 4: Run focused tests and prove RED**

Run: `node --test api/test/cred-shadow/score.test.js api/test/cred-shadow/adversarial.test.js`

Expected: FAIL because orchestration modules do not exist.

- [ ] **Step 5: Implement coverage and weak-link confidence**

All dimension values are integers from 0–100. Severity cannot increase coverage. Corroboration may improve source diversity/consistency but duplicate reports cannot add sample mass.

- [ ] **Step 6: Implement overall score and publication states**

Compute the overall score from unrounded category fixed-point values and round once. Keep internal estimates for all states, but expose canonical `score` and `tier` only when Rated. Expose `estimatedScore` and `estimatedTier` for Provisional.

- [ ] **Step 7: Implement risk ceilings and domain profiles**

Domain profiles reuse the same pure scorer after filtering to ontology-approved domain tags. They cannot feed Universal CRED. A numeric domain profile remains Provisional until it has 4 EU effective independent domain evidence, two independent non-P4 control groups, a 30-day observation span, confidence 40, and domain coverage 50. Emit canonical reason codes in sorted order. Add combination tests for zero mass, corroboration, P4 exclusions, status precedence, Suspended audit estimates, persistent active flags, remediated flags with retained historical mass, and every domain gate boundary.

- [ ] **Step 8: Run focused and adversarial tests and prove GREEN**

Run: `node --test api/test/cred-shadow/score.test.js api/test/cred-shadow/adversarial.test.js`

Expected: PASS, including duplicate farming, correlated farming, missing categories, old evidence, P4-only, active-critical, and remediation-history cases.

- [ ] **Step 9: Commit Task 4**

```bash
git add api/cred-shadow/confidence.js api/cred-shadow/score.js api/test/cred-shadow/score.test.js api/test/cred-shadow/adversarial.test.js
git commit -m "feat: produce canonical CRED shadow estimates"
```

# Chunk 2: Artifacts, replay, and isolation

### Task 5: Deterministic unsigned artifact payload

**Files:**
- Create: `api/cred-shadow/artifact.js`
- Test: `api/test/cred-shadow/artifact.test.js`

- [ ] **Step 1: Write failing canonical artifact tests**

Assert identical logical inputs with different event order produce byte-identical serialization and hashes. Assert one evidence byte or parameter byte changes the appropriate hash. Reject BigInt leakage into JSON.

- [ ] **Step 2: Run focused test and prove RED**

Run: `node --test api/test/cred-shadow/artifact.test.js`

Expected: FAIL because artifact construction does not exist.

- [ ] **Step 3: Implement canonical serialization and hashes**

Implement `cred-cjson-v1` exactly: accepted values are null, booleans, strings, arrays, plain objects, and safe integers; all consensus BigInts are converted to canonical base-10 strings before serialization. Reject floats, negative zero, non-plain objects, undefined, functions, symbols, and lone UTF-16 surrogates. Object keys sort by unsigned UTF-8 byte order. Escape quote, backslash, and U+0000–U+001F using lowercase `\u00xx` (with the short escapes forbidden); emit every other valid Unicode scalar as raw UTF-8. Emit no whitespace. Arrays preserve the field-specific order below.

Include methodology ID, parameter-set hash, subject/epoch, state, canonical or provisional score fields, category internals/public values, confidence dimensions, coverage, flags, reason codes, computation/validity time, evidence-set hash, exact validated registry/ontology/identity-graph/EMP-registry versions, EMP policy hashes/proofs, and root references.

This task produces an `unsignedPayload`, not the complete signed artifact required by methodology §23. Name the type and README accordingly. Include `canonicalSerializationVersion = cred-cjson-v1`, exact pinned registry versions, `snapshotRoot`, and `inputManifestHash`. Encode all BigInts as canonical base-10 strings. Preserve arrays in defined canonical order: evidence by observed time/evidence ID, categories `[operational,financial,onchain,identity]`, EMP policies by EMP ID/version, domains/flags/reasons/proof references by unsigned UTF-8 bytes. Derive `validUntil` as exactly one hour after `computedAt` and reject caller disagreement.

`parameterBytes` is `cred-cjson-v1` of exactly `{methodologyId,parameters,empRegistryVersion,empRegistryRoot,empPolicies}`, where `parameters` contains every candidate constant in `parameters.js` and each EMP policy contains canonical policy fields, policy hash, leaf index, and proof. `evidenceBytes` is `cred-cjson-v1` of exactly `{snapshotSchemaVersion,subject,computedAt,validUntil,versions,roots,identity,records,contradictions,risks}` after validation/canonical ordering; it includes every input record in every lifecycle state and excludes all derived masses/scores/reasons plus `legacy` and `segments`. Hash exact UTF-8 domains: `SHA256(UTF8("CRED-PARAMS-v1\0") || parameterBytes)` and `SHA256(UTF8("CRED-EVIDENCE-v1\0") || evidenceBytes)`. Fixture-pin the full canonical bytes and hashes, including escapes, non-ASCII key ordering, excluded/quarantined records, and EMP proofs. External signature/envelope assembly is explicitly deferred to the distribution plan.

- [ ] **Step 4: Run focused test and prove GREEN**

Run: `node --test api/test/cred-shadow/artifact.test.js`

Expected: PASS with pinned hashes.

- [ ] **Step 5: Commit Task 5**

```bash
git add api/cred-shadow/artifact.js api/test/cred-shadow/artifact.test.js
git commit -m "feat: build deterministic CRED artifacts"
```

### Task 6: Offline legacy-to-candidate replay

**Files:**
- Create: `api/cred-shadow/replay.js`
- Create: `api/scripts/run-cred-shadow-replay.js`
- Create: `api/test/cred-shadow/fixtures/replay-input.jsonl`
- Test: `api/test/cred-shadow/replay.test.js`
- Modify: `api/package.json`

- [ ] **Step 1: Write failing replay tests**

A synthetic input row is the complete versioned snapshot envelope, including subject + epoch + hourly computation timestamp, full legacy score/tier/category/rating fields, and segment labels. Assert each per-snapshot output contains subject ID, actor epoch, computation time, freshness, flags, evidence-set hash, identity resolution, all old/new score/category/confidence/coverage values, tier transition, status transition, and included/excluded/quarantined/**deduplicated**/capped/decayed counts **and mass**. Assert aggregate output contains the complete sorted per-subject score-delta series (not only buckets), threshold counts, transition matrix, and every closed segment summary. Add a time-split test proving later evidence cannot enter an earlier hourly snapshot, and fixtures that pin every sensitivity sweep and parameter-set hash.

- [ ] **Step 2: Run focused test and prove RED**

Run: `node --test api/test/cred-shadow/replay.test.js`

Expected: FAIL because replay is not implemented.

- [ ] **Step 3: Implement pure replay aggregation**

Replay takes parsed rows and never opens a database, network socket, contract, or production module. Sort by subject ID, actor epoch, then computed time. Report the complete sorted score-delta distribution plus counts moving by >5, >10, >20, and >30 points, rating-state transitions, tier matrix, per-snapshot freshness/flags/evidence hash/identity epoch and resolution, category/confidence/coverage deltas, extreme-delta explanations, and included/excluded/quarantined/deduplicated/capped/decayed evidence counts and mass. Fixture-pin all fields. Reject evidence observed after the envelope computation cutoff.

- [ ] **Step 4: Implement the mandatory sensitivity envelope**

Add a validated in-memory parameter override constructor usable only by replay/tests. Run a baseline plus **one-at-a-time**, non-Cartesian variants in this exact order: prior mass 2/4/8 EU; each evidence-family positive half-life at 75%/125%, skipping `severe-critical` where positive half-life is null; each evidence-family negative half-life at 75%/125%; each severity factor at 75%/125% while preserving monotonic order; all provider/schema/P4 caps at 50%/150%; Rated mass 6/12 EU; category mass 1/4 EU; confidence gate -10/+10; coverage gate -10/+10. Candidate values are not emitted twice. Fractional day values round half away from zero to whole days (for example 273.75 → 274 and 912.5 → 913); fixed-point factors/caps round half away from zero. Order variants by the dimension order above, then evidence-family/severity protocol order, then low before high. Report every parameter-set hash and subject/aggregate delta. The production candidate constants remain immutable.

- [ ] **Step 5: Implement a fail-closed CLI**

Supported arguments only:

```text
--input <json|jsonl>
--output <json>
--pretty
```

Reject unknown flags, stdin by default, URLs, database paths, directories, symlinks, existing outputs, inputs above 64 MiB, more than 100,000 rows, or rows above 1 MiB. Open input with no-follow/read-only semantics and verify it is a regular file. Create a mode-600 sibling temporary output with `wx`; after fsync, atomically commit without clobber via `link(temp, target)` and unlink the temporary file. Add symlink, existing-target, target-race, oversized-file, row-limit, and byte-limit tests. Never accept RPC URLs, keys, signers, broadcast flags, or production database paths.

- [ ] **Step 6: Add package scripts**

```json
{
  "test:cred-shadow": "node --test test/cred-shadow/*.test.js",
  "cred:shadow:replay": "node scripts/run-cred-shadow-replay.js"
}
```

Preserve every existing script.

- [ ] **Step 7: Run focused tests and prove GREEN**

Run: `npm run test:cred-shadow --prefix api`

Expected: PASS for all shadow-engine tests.

- [ ] **Step 8: Run the synthetic replay twice**

Run the CLI twice to distinct temporary outputs and compare SHA-256 hashes.

Expected: identical hashes and no repository or database changes.

- [ ] **Step 9: Commit Task 6**

```bash
git add api/cred-shadow/replay.js api/scripts/run-cred-shadow-replay.js api/test/cred-shadow/replay.test.js api/test/cred-shadow/fixtures/replay-input.jsonl api/package.json api/package-lock.json
git commit -m "feat: add offline CRED shadow replay"
```

### Task 7: Isolation guard, documentation, and final verification

**Files:**
- Create: `api/cred-shadow/README.md`
- Create: `api/test/cred-shadow/production-isolation.test.js`

- [ ] **Step 1: Write the production-isolation test**

Use test-only `acorn` plus `acorn-walk` to parse JavaScript as both script and module where applicable, and build a dependency graph covering literal CommonJS `require`, static ESM `import`/`export ... from`, and literal `import()`. Reject unresolved modules and every nonliteral/dynamic loader edge in production or shadow graphs unless it is on a documented exact-file allowlist unrelated to shadow scoring. Build the graph from every **production** executable/runtime root under `api/` (server, indexer, workers, schedulers, and production scripts/services reached transitively) and fail if any production graph reaches `api/cred-shadow`. Explicitly exclude `api/scripts/run-cred-shadow-replay.js`, `api/test/**`, and fixture files from the production-root set. Separately require that the shadow CLI graph is an explicit allowlist of Node built-ins plus `api/cred-shadow/*`; it must not reach HTTP clients, Express/listeners, databases, environment secret readers, ethers signers/providers, contract writers, child processes, schedulers, or production services. Include at minimum these roots:

- `api/v2-server.js`
- `api/indexer.js`
- `api/cred-oracle-updater.js`
- `api/terminal-sync.js`
- `api/compliance-endpoints.js`
- `api/mcp-handler.js`

Do not use regex as the authority. Fail on parse errors, unsupported module syntax, unresolved edges, and dynamic `require`/`import` capable of hiding a shadow edge. Also assert shadow files contain no production database filename, network fetch/http import, private-key/environment-secret loading, signer/provider construction, RPC broadcast method, HTTP listener, child process, scheduler, or onchain writer. Add a fixture proving an indirect production import is caught.

- [ ] **Step 2: Run the isolation test and prove RED if documentation/boundary is incomplete**

Run: `node --test api/test/cred-shadow/production-isolation.test.js`

Expected before completion: FAIL on missing documented module allowlist or boundary assertion.

- [ ] **Step 3: Document the shadow engine**

Include normalized input schema, formulas, commands, reason codes, limits, deterministic guarantees, known limitations, and explicit statements that:

- legacy scores are comparison data, not labels;
- the candidate is not production-approved;
- the CLI does not acquire evidence;
- no live score/API/tier/privilege/reward/oracle/contract changes occur;
- external signing and publication are deferred;
- the 60-day shadow clock starts only after a verified corpus pipeline is live.

- [ ] **Step 4: Run complete verification**

```bash
npm run test:cred-shadow --prefix api
node --check api/scripts/run-cred-shadow-replay.js
for file in api/cred-shadow/*.js; do node --check "$file"; done
git diff --check
git status --short
```

Expected: all tests and syntax checks pass; only intended files are changed.

- [ ] **Step 5: Run spec-to-test traceability check**

Produce a checked-in table in the README mapping every methodology section from event eligibility through launch gates to code/tests or an explicitly deferred plan. No requirement may silently disappear.

- [ ] **Step 6: Commit Task 7**

```bash
git add api/cred-shadow/README.md api/test/cred-shadow/production-isolation.test.js
git commit -m "docs: verify CRED shadow isolation"
```

## Completion gate

Implementation is complete only when:

1. Every normative fixture passes with integer-only scoring math.
2. Event-order permutations produce byte-identical artifacts.
3. Duplicate/correlated/provider/P4 farming tests cannot manufacture material score or confidence.
4. Missing evidence remains neutral and lowers only coverage/confidence.
5. Critical events affect evidence, flags, and policy ceilings independently.
6. Non-Rated subjects expose no canonical score/tier.
7. Replay output is deterministic and contains migration/segment analysis.
8. Production entry points do not import the shadow engine.
9. No live database, API, oracle, privilege, reward, or contract state changes.
10. A separate evidence-pipeline plan is written before the 60-day shadow clock can begin.
