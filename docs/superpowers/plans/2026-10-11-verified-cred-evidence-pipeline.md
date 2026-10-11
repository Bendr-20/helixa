# Verified CRED Evidence Pipeline Implementation Plan

Goal: Build a deterministic offline compiler that turns signed, registry-authorized provider exports into a hash-chained evidence ledger and scorer-ready hourly CRED shadow corpus without touching production state.

Architecture: Add a self-contained CommonJS subsystem under api/cred-evidence. The only executable is an operator-invoked offline CLI. It receives complete local inputs, performs strict identity/provider/schema/signature/adapter/lifecycle checks, and atomically writes deterministic ledger, corpus, and readiness artifacts. Production runtime roots must not import either cred-evidence or cred-shadow.

Authoritative design: docs/superpowers/specs/2026-10-11-verified-cred-evidence-pipeline-design.md

Safety boundary:
- no listener, database, RPC, network client, environment secret, signer, scheduler, or production import;
- no live score/API/oracle/reward/privilege/contract change;
- no automatic 60-day clock start;
- all inputs are explicit local files and all outputs are new files;
- private payload bytes are never copied into ledger or corpus output.

## Task 1: Canonical registry bundle

Files:
- Create api/cred-evidence/registry.js
- Create api/test/cred-evidence/registry.test.js
- Create api/test/cred-evidence/fixtures/registry.json

Steps:
1. Write failing tests for exact closed fields, canonical ordering, immutable normalized output, domain-separated registry hashes, duplicate IDs, timestamp/hash/integer encoding, provider key epochs, provider/schema authorization references, identity edges/epochs, and embedded EMP/ontology version pins.
2. Implement strict validators with no coercion and exact unsigned UTF-8 ordering. Reuse cred-cjson-v1 from the shadow artifact module and domain hash CRED-EVIDENCE-REGISTRY-v1 followed by NUL.
3. Require provider state, key epochs, schema authorization, issuer authority, subject coordinates, relationship validity, non-overlapping actor epochs, and exact version commitments.
4. Pin canonical registry bytes/hash in the fixture.
5. Run node --test api/test/cred-evidence/registry.test.js and the complete shadow suite.
6. Commit: feat: define canonical CRED evidence registries

## Task 2: Canonical identity resolution

Files:
- Create api/cred-evidence/identity.js
- Create api/test/cred-evidence/identity.test.js

Steps:
1. Test canonical coordinate tuples for ERC-8004, Looper NFT, EVM, Solana, DID, UBID, platform account, and endpoint namespaces.
2. Test resolved, unresolved, ambiguous, conflict, transfer-pending, and encumbered results; never choose among multiple candidates.
3. Bind evidence to the actor epoch covering occurredAt. Test exact boundaries, gaps, overlaps, transfer/controller transitions, revoked edges, wallet rotation, and non-transfer of debt/obligations.
4. Return subject, epoch, assurance, candidates, matched edge IDs, graph version/hash, flags, and stable reason codes.
5. Prove input-order invariance and deep immutability.
6. Run focused plus shadow tests.
7. Commit: feat: resolve canonical CRED subjects and epochs

## Task 3: Signed submission verification and authorization

Files:
- Create api/cred-evidence/submission.js
- Create api/test/cred-evidence/submission.test.js
- Create api/test/cred-evidence/fixtures/submissions.jsonl

Steps:
1. Define strict cred-native-submission-v1 and the exact canonical signed projection.
2. Implement domain-separated Ed25519 verification with node:crypto. Accept only raw public keys encoded as canonical base64url and signatures as canonical base64url; reject noncanonical variants.
3. Verify native payload hash/commitment, registry version, provider state, key validity/revocation, schema authorization, lane, timestamps, replay window, proof references, and unique provider event IDs.
4. Approved active providers may proceed; observation providers remain ineligible; permissionless claims quarantine; suspended/revoked providers fail new authorization.
5. Test invalid/rotated/expired/revoked keys, altered bytes, replay, future events, unauthorized schemas/categories/domains, duplicate IDs, and private payload non-disclosure.
6. Pin signature vectors and canonical hashes.
7. Commit: feat: verify signed CRED evidence submissions

## Task 4: Adapter, proof declaration, and normalized records

Files:
- Create api/cred-evidence/adapters.js
- Create api/cred-evidence/normalize.js
- Create api/test/cred-evidence/normalize.test.js

Steps:
1. Add an exact allowlist containing generic-signed-outcome@1.0.0; reject dynamic or unknown adapters.
2. Define integer-only native fields for category, direction, materiality, severity, proof class, lifecycle/finality, incident/correlation keys, domains, transformations, and public proof declarations.
3. Validate schema direction, unit, range, materiality, finality, privacy, related-party, self-review, and proof policies.
4. Emit the complete normalized record required by cred-shadow evidence.js, adapter manifest hash, transformation receipt hash, native payload hash, and reason codes.
5. Ensure adapters are pure and cannot grant score eligibility. Compiler policy decides eligibility from provider state, lane, proof, identity, and schema.
6. Test malformed input, self-review, wash/related-party markers, duplicate incidents, private payload redaction, adapter order invariance, and proof failure quarantine.
7. Commit: feat: normalize verified CRED evidence

## Task 5: Append-only lifecycle ledger

Files:
- Create api/cred-evidence/ledger.js
- Create api/test/cred-evidence/ledger.test.js

Steps:
1. Define cred-evidence-ledger-v1 entries with sequence, prior hash, entry hash, operation, evidence/submission/provider/schema IDs, registry hashes, identity resolution, lifecycle state, public record or bounded rejection receipt, and references.
2. Build and verify a domain-separated hash chain. Reject sequence gaps, prior-hash mismatch, altered entries, duplicate provider events, duplicate active evidence IDs, and invalid lifecycle transitions.
3. Implement append-only RECEIVED, VALIDATED, VERIFIED/QUARANTINED/PENDING_REVIEW, ACTIVE, DISPUTED, REVOKED, and EXPIRED transitions.
4. Corrections, verifier adoption, revocations, disputes, and expiration append references and never mutate history.
5. Replay the ledger to a deterministic current-state projection and preserve all audit history.
6. Test deterministic rebuild, tamper detection, correction/revocation/dispute replay, and private receipt redaction.
7. Commit: feat: add append-only CRED evidence ledger

## Task 6: Hourly scorer-ready corpus compiler

Files:
- Create api/cred-evidence/corpus.js
- Create api/test/cred-evidence/corpus.test.js
- Create api/test/cred-evidence/fixtures/corpus-pins.json

Steps:
1. Compile complete cred-shadow-snapshot-v1 rows grouped by subject, actor epoch, and explicit hourly cutoff.
2. Pin all registry/ontology/identity/EMP versions and roots, input manifest hash, snapshot root, identity state, records in every relevant lifecycle state, contradictions, risks, segments, and optional legacy comparison.
3. Reject future evidence, version mixing, unresolved EMP bindings, missing lifecycle history, and nondeterministic ordering.
4. Feed every emitted snapshot directly to normalizeEvidenceSnapshot and scoreShadowSnapshot; no translation layer is allowed.
5. Emit a corpus manifest with exact source/ledger/registry hashes and readiness metrics. Readiness always states clockStarted false and lists unmet operational gates.
6. Pin canonical bytes/hashes and prove input-order invariance.
7. Commit: feat: compile verified CRED shadow corpus

## Task 7: Fail-closed offline CLI and isolation

Files:
- Create api/scripts/compile-cred-evidence.js
- Create api/test/cred-evidence/cli.test.js
- Create api/test/cred-evidence/isolation.test.js
- Create api/cred-evidence/README.md
- Modify api/package.json and api/package-lock.json

CLI flags only:
- --registry <json>
- --submissions <json|jsonl>
- --ledger-output <jsonl>
- --corpus-output <jsonl>
- --manifest-output <json>
- --pretty

Steps:
1. Reject unknown/duplicate flags, stdin, URLs, database paths, directories, symlinks, existing outputs, oversized files/rows, and production/RPC/key/signer/broadcast options.
2. Read with no-follow regular-file semantics. Precompute all outputs before writing; create mode-0600 sibling temporary files; fsync; atomically link every target without clobber; clean up all temporaries on any failure.
3. Add package scripts test:cred-evidence and cred:evidence:compile without changing existing scripts.
4. Extend Acorn graph tests so production roots cannot reach cred-evidence or cred-shadow, and the evidence CLI reaches only built-ins, cred-evidence, and the explicitly documented shadow validation modules.
5. Document schemas, commands, hash domains, lifecycle, reason codes, privacy boundary, limitations, and clock-start gate.
6. Run the CLI twice to distinct outputs and compare every SHA-256 hash. Verify repository databases and git status do not change.
7. Run npm run test:cred-shadow --prefix api, npm run test:cred-evidence --prefix api, syntax checks, git diff --check, and git status.
8. Commit: docs: verify offline CRED evidence compiler

## Completion gate

Implementation is complete only when:
1. Every registry and signed-input fixture is canonical and pinned.
2. Identity ambiguity/conflict/epoch transitions fail closed.
3. Unauthorized, replayed, malformed, or invalidly signed submissions cannot normalize.
4. Observation and permissionless evidence cannot become score-eligible.
5. Ledger replay is deterministic and tamper-evident.
6. Corrections/revocations/disputes preserve history.
7. Every corpus row is accepted directly by the Candidate 0.1 scorer.
8. Input permutations produce byte-identical ledger/corpus/manifest outputs.
9. Production entry points cannot import offline pipeline/scorer code.
10. No private payload, network, database, secret, production state, or automatic clock-start path exists.
