# Verified CRED Evidence Pipeline Design

Status: approved execution direction; shadow-only and non-production
Date: 2026-10-11
Owner: Helixa

## 1. Decision

Build the first evidence-pipeline slice as a deterministic, offline, content-addressed compiler. It accepts signed provider exports plus pinned provider/schema/identity registries, resolves canonical subjects and actor epochs, validates and normalizes evidence, records an append-only audit ledger, and emits scorer-ready hourly corpus snapshots.

Do not begin with a network listener or production database. This keeps the evidence boundary testable before credentials, webhooks, chain RPCs, private payloads, or production schedulers are introduced. Live collectors will later produce the same closed input envelopes and must pass this compiler's fixtures.

This pipeline does not change live scores, start the 60-day clock, sign score artifacts, publish roots, or modify APIs, rewards, privileges, or contracts.

## 2. Alternatives rejected

1. **Write directly into production tables.** Rejected because adapter, identity, lifecycle, and privacy failures could contaminate live state before the protocol boundary is proven.
2. **Let each adapter emit scorer records directly.** Rejected because provider authorization, identity resolution, replay defense, schema semantics, corrections, and commitments would diverge by integration.
3. **Use provider-native scores.** Rejected because CRED requires normalized evidence and bounded provider authority, not opaque score averaging.

## 3. Trust boundaries

- Native provider payloads are untrusted until signature, key epoch, replay window, provider state, schema authorization, and proof policy pass.
- Permissionless claims are always quarantined and score-ineligible until a registered verifier adopts them through a new append-only record.
- Registry bundles are explicit immutable inputs. Nothing is discovered from the environment or network.
- Adapter code is an allowlisted pure function selected by exact adapter ID and version. Dynamic loading and arbitrary expressions are forbidden.
- Identity links are claims until their proof and issuer authority pass. Ambiguity or conflict never auto-merges subjects.
- Private payload bytes never enter the public corpus. Public outputs carry normalized metadata, commitments, hashes, and authorized proof references only.
- The scorer consumes only compiler output; it never authenticates providers or resolves identities itself.

## 4. Versioned inputs

### 4.1 Registry bundle

A 'cred-evidence-registry-v1' bundle contains:

- registry version, generated time, previous registry hash, and canonical bundle hash;
- providers with state, signing-key epochs, authorized schemas, families, categories/domains, rate/volume policy, observation status, and influence policy references;
- schemas with immutable version, adapter binding, event type, category, direction rules, proof class, materiality mapping, privacy class, correction policy, finality policy, and EMP binding;
- identity issuers with authorized coordinate namespaces and relationship types;
- subjects, coordinates, verified relationship edges, actor epochs, and encumbrance/conflict state;
- EMP policies and the exact registry root/proofs required by the Candidate 0.1 scorer;
- ontology and registry version commitments.

All unexpected fields fail closed. Identifiers, timestamps, integer strings, hashes, and enums use canonical encodings.

### 4.2 Native submission envelope

A 'cred-native-submission-v1' record contains:

- submission ID, lane, provider/submitter ID, provider event ID, schema ID/version;
- occurred, observed, and received timestamps;
- subject coordinates and claimed actor epoch when known;
- native payload as canonical JSON for public fixtures or a payload commitment for private data;
- native payload hash, proof references, signature suite, key ID, and signature;
- correction/revocation/dispute references where applicable.

The signature covers a domain-separated canonical projection of every security-relevant field, including the native payload hash and registry version. Receipt time is compiler input, never current wall-clock time.

## 5. Identity resolution

Coordinates are typed tuples, never free-form aliases. Initial namespaces include ERC-8004, Looper NFT, EVM wallet, Solana wallet, DID, UBID, platform account, and agent endpoint.

Resolution rules:

1. Canonicalize and deduplicate coordinates.
2. Match only verified, currently valid edges from authorized issuers.
3. One matching subject resolves; no match is unresolved; multiple subjects are ambiguous.
4. Contradictory current-control edges are conflict, even when one candidate appears more convenient.
5. Evidence is bound to the actor epoch valid at 'occurredAt', not merely the current owner.
6. Transfers and controller changes open a new epoch only through an explicit finalized transition record. Debt and obligations remain on the originating epoch unless an assumption record says otherwise.
7. Unresolved, ambiguous, conflicted, transfer-pending, or encumbered states remain visible and fail closed according to schema policy.

The resolver returns the subject, epoch, assurance, matched edges, candidates, reason codes, and the exact identity-graph version/hash.

## 6. Provider and schema authorization

Approved-lane evidence requires:

- provider state 'observation' or 'active' at 'observedAt';
- a valid non-revoked key epoch covering the signed observation;
- an authorized schema/version, evidence family, category, and domain;
- a signature over the canonical submission projection;
- unique provider event ID and submission hash within the replay window;
- schema-valid units, direction, materiality, severity, proof class, privacy, finality, and proof references.

Observation providers may generate verified corpus rows, but those rows are marked score-ineligible. Suspended or revoked providers cannot create new eligible influence. Historical records are preserved.

Permissionless submissions consume deterministic quota inputs supplied in the batch policy, coalesce exact duplicates, and remain quarantined. Bond/payment data is audit metadata only and can never grant eligibility.

## 7. Adapter and verification contract

Each allowlisted adapter receives immutable native data, schema policy, registry bundle, and resolved identity. It returns either a normalized candidate record or a deterministic quarantine/rejection result.

Adapters must:

- be pure, synchronous, and network-free;
- emit a pinned transformation manifest hash and adapter receipt hash;
- preserve native payload and proof commitments;
- map units/direction/materiality without floating-point arithmetic;
- emit incident and correlation keys suitable for cross-provider deduplication;
- never set score eligibility by itself.

A verifier separately confirms proof/finality policy. Initial implementation uses fixture-backed deterministic proof declarations; chain RPC, EIP-712/EIP-1271, and selective-disclosure verifiers are explicit later adapters with their own conformance plans.

## 8. Append-only ledger

The compiler emits 'cred-evidence-ledger-v1' JSONL. Each entry contains a monotonic sequence, prior-entry hash, entry hash, submission/native/transformation hashes, registry versions, identity resolution, lifecycle state, reason codes, and the public normalized record when allowed.

Lifecycle changes append new entries. Corrections, revocations, disputes, verifier adoption, and expiration reference prior evidence IDs; no entry is edited or deleted. Replaying the ledger from genesis must produce the same active evidence set and corpus manifest.

Rejected inputs receive bounded audit receipts without private payloads. Batch failure is atomic: no partial ledger or corpus output is committed.

## 9. Scorer-ready corpus

The compiler groups active records into complete 'cred-shadow-snapshot-v1' envelopes by subject, actor epoch, and configured hourly cutoff. It pins:

- identity graph, provider registry, schema registry, EMP registry, and ontology versions;
- input manifest hash, evidence-set commitment, and snapshot root;
- identity resolution/assurance and current risk state;
- every record in relevant lifecycle state, not only score-bearing records;
- contradictions, corrections, disputes, risks, and segment labels;
- no legacy value except explicitly supplied comparison data.

Records observed after a cutoff cannot enter that snapshot. Output ordering is canonical and byte-identical across input permutations.

## 10. CLI and filesystem safety

The offline CLI accepts only local registry/submission/previous-ledger inputs and new sibling output paths. It rejects stdin, URLs, database paths, symlinks, directories, unknown flags, oversized files/rows, existing outputs, dynamic adapters, RPC/key/signer/broadcast options, and production service imports.

Outputs use mode 0600, sibling temporary files, fsync, atomic no-clobber links, and deterministic bytes. The CLI never reads environment secrets or opens network sockets.

## 11. Clock-start gate

The compiler may emit a readiness report, but it cannot start the 60-day clock. Governance must explicitly record a clock-start decision after all of these are evidenced:

- at least one real provider export and identity source continuously feed the pipeline;
- provider keys and schema/EMP versions are pinned and conformance-tested;
- identity ambiguity/conflict metrics are visible;
- correction, revocation, replay, outage, and deterministic rebuild drills pass;
- private payload leakage tests pass;
- hourly corpus generation and monitoring are operational;
- the exact start timestamp and corpus manifest are committed.

Synthetic fixtures, manual exports, or observation-only providers do not start the clock.

## 12. First implementation slice

Implement only the deterministic offline boundary:

1. canonical registry codecs and domain-separated hashes;
2. canonical identity resolution with actor epochs;
3. Ed25519 signed submission verification and provider/schema authorization;
4. one generic signed-outcome adapter plus deterministic proof declarations;
5. append-only hash-chained ledger and lifecycle replay;
6. scorer-ready hourly corpus compiler;
7. fail-closed CLI, fixtures, isolation tests, and readiness report.

Defer live HTTP ingestion, database persistence, chain RPC verification, EIP-712/EIP-1271, encrypted payload storage, permissionless bonds/payments, selective disclosure, schedulers, score publication, and production API integration to separately reviewed slices.

## 13. Verification gates

- Registry and submission permutations produce byte-identical hashes and outputs.
- Invalid, rotated, expired, revoked, or unauthorized keys fail closed.
- Schema direction/unit/materiality violations cannot normalize.
- Self-review, duplicates, replayed provider events, related-party incidents, and conflicting identities cannot become eligible.
- Observation and permissionless records remain score-ineligible.
- Corrections/revocations/disputes preserve history and rebuild deterministically.
- Future evidence cannot enter earlier hourly snapshots.
- Ledger tampering breaks the hash chain.
- Corpus output is accepted by the Candidate 0.1 scorer without translation.
- Production runtime graphs cannot reach the offline pipeline or shadow scorer.
- No network, database, secret, signer, scheduler, or production state mutation is possible from the CLI graph.
