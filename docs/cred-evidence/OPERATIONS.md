# CRED Evidence Compiler Operations

## Safety boundary

The compiler is an offline, passive system. It reads versioned registry and signed submission files, verifies and normalizes them, builds an append-only ledger, and invokes the existing CRED shadow scorer. It does not import production servers, databases, schedulers, signers, or network clients. It never writes a score to production.

Run it only from the API package:

    npm run cred:evidence:compile -- --registry test/cred-evidence/fixtures/registry.json --input test/cred-evidence/fixtures/submissions.jsonl --output /secure/path/cred-evidence-output.json

The output path must be a new `.json` file in a real (non-symlinked) directory. Output is created mode `0600`; overwrite is refused. The output contains unsigned shadow artifacts only.

## Provider enrollment

1. Add the provider in `observation` state with contiguous state epochs, an Ed25519 key epoch, schema authorizations, control group, rate/volume policy, and exact scope.
2. Collect signed evidence in observation mode. Observation records remain auditable but are always score-ineligible.
3. Compile representative batches and review signature/schema/identity rejection rates, duplicate and correlation rates, cap frequency, resolution ambiguity, and source/category coverage.
4. Move to `active` only by publishing a new registry version with a contiguous provider state epoch. Never rewrite the old registry.

Permissionless submissions remain quarantined until separately verified and promoted through an approved, signed lifecycle event.

## Lifecycle rules

- Corrections append a replacement and make the referenced record ineligible; they never overwrite it.
- Revocations are terminal for the referenced record.
- Remediation can close negative evidence but cannot erase history.
- Opening a dispute is an audit signal and does not directly alter score mass. An explicit signed resolution either dismisses it or upholds it and revokes the record.
- Private committed payloads are not emitted to scorer snapshots. Only public, allowlisted adapter inputs can become normalized records.

## Incident runbooks

### Provider key compromise

1. Stop accepting the affected key operationally.
2. Publish a new registry version setting `revokedAt` on the compromised key and adding a valid replacement key epoch.
3. Recompile the affected receipt window. Submissions observed at or after revocation must fail closed.
4. Append signed revocation or correction events for affected evidence; do not delete ledger entries.

### Schema or adapter defect

1. End the provider's schema authorization in a new registry version.
2. Do not change an existing adapter version in place. Publish a new exact adapter and schema version.
3. Recompile fixtures and compare canonical hashes, scorer inclusion, duplicate handling, and cap effects.
4. Correct affected records through append-only signed references.

### Identity ambiguity or control conflict

1. Quarantine affected submissions; do not choose a convenient subject.
2. Publish corrected issuer edges or actor epochs in a new identity-graph version.
3. Preserve old actor epochs and encumbrance state. Historical behavior remains bound to the epoch that acted.
4. Recompile and verify the identity graph hash and subject/epoch assignment before promotion.

### Ledger or output hash mismatch

1. Treat the output as invalid and stop downstream review.
2. Re-run from the exact registry and submission bytes in a new output file.
3. Compare registry, ledger head, compiler, evidence-set, and artifact hashes.
4. If mismatch persists, preserve both files and investigate input order, registry version, lifecycle references, and filesystem integrity. Never patch a committed ledger entry.

## Verification

    npm run test:cred-evidence
    npm run test:cred-shadow

The isolation suite must prove that production cannot reach `cred-evidence/` or `cred-shadow/`, while the compiler graph is restricted to those directories, its CLI entry point, and Node built-ins.
