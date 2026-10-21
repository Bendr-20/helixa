# Swarm Token Launch — Base Mainnet Preparation Runbook

This runbook covers deterministic packet generation and read-only verification only. It does **not** authorize deployment, signatures, funding, approvals, or broadcast.

## Safety boundary

- Chain ID is fixed to Base mainnet (8453).
- A launch has exactly 3-5 Looper members and binds the existing signed readiness hash as its root.
- The canonical packet is `PREPARATION_ONLY`, `deploymentAuthorized: false`, `broadcastPrepared: false`, and contains zero signatures, keys, or external adapter data.
- The generator and verifier do not expose an RPC send path. The verifier allows only `eth_chainId`, `eth_getCode`, and `eth_call`.
- Do not add external adapter data, wallet invocation, live signature collection, or database persistence to this workflow.

## Twigpine workspace preparation contract

Every launch manifest and readiness packet binds a closed `multipass.swarm-workspace.v1` section into its canonical SHA-256 lineage. This is a declaration of required collaboration controls, not live repository provisioning:

- exactly one Twigpine repository per swarm, with a bounded slug, `main` as both the default and protected branch, and `NOT_PROVISIONED` status;
- `PUBLIC` visibility by default; `PRIVATE` is node-operator-enforced and does not federate, while `WITHHELD` can encrypt selected paths but GLIP-09 leaves its client-versus-node encryption point implementation-sensitive;
- one unique Ed25519 `did:key` identity per Looper member, in roster order, with shared keys prohibited;
- signed pushes, repository certificates, pull-request provenance, and review provenance all required and initially `NOT_VERIFIED`;
- optional, bounded GitHub mirror owner/repository metadata only—never credentials or executable adapter data;
- scoped, expiring UCAN delegation for the canonical `git/fetch`, `git/push`, `pr/open`, and `pr/review` actions is required for production, but Twigpine GLIP-10 is currently spec-ahead-of-code. Current push authorization is owner-only, so the manifest records `capabilityStatus: REQUIRED_UNAVAILABLE` and readiness carries `ENABLE_SCOPED_EXPIRING_UCAN_DELEGATION` as a blocking gate.

The server rejects unknown workspace fields, alternate providers/branches/policies, shared or malformed identities, unsafe slugs, unbounded mirror metadata, and any claim that UCAN delegation is already available. Readiness additionally requires `PROVISION_TWIGPINE_REPOSITORY` and `VERIFY_TWIGPINE_CERTIFICATES_AND_PROVENANCE`. Do not install `gl`, generate keys, call Twigpine, create a repository, or mirror/push from this preparation workflow.

Git authority is deliberately separate from execution authority. Git state, signatures, certificates, pull requests, and reviews never authorize a wallet, transaction, deployment, token launch, or financial execution. Swarm Command's separate execution-consent flow remains authoritative.

## Execution-plan prerequisites

Start from the immutable canonical `multipass.swarm-launch-readiness.v2` artifact and its exact `multipass.swarm-launch.v2` consent-manifest ancestor. The generator verifies both SHA-256 links and every member consent authority, token ID, contribution weight, allocation, and vesting-month field. A reviewed `multipass.swarm-launch-execution-conversion.v1` child binds the exact parent readiness hash and resolves only the execution details absent from the immutable parent:

1. Token name, symbol, 18 decimals, and fixed base-unit supply.
2. Four allocation bps values totaling exactly 10,000. Defaults are 4,500 agent vesting / 1,500 CRED-staker rewards / 1,500 swarm treasury / 2,500 public distribution, but the signed readiness values control.
3. Explicit amounts matching deterministic bps math. The first three category amounts round down and public distribution receives the deterministic remainder.
4. Three nonzero, mutually distinct fixed recipients for CRED rewards, treasury, and public distribution.
5. Exactly `DIRECT_FIXED_RECIPIENT` for CRED rewards, treasury, and public distribution; alternatives are rejected.
6. Timing under the closed `SOURCE_CONSENT_EXPIRY_PLUS_7D_30D_MONTHS_V1` policy: authorization deadline equals the parent consent expiry, start is exactly seven days later, and cliff/duration are the parent readiness months multiplied by 30 days. Operators cannot choose alternate timing for the same parent hash.
7. Three to five members with unique agent keys, nonzero vesting beneficiaries, contribution bps totaling 10,000, and one unanimous consent authority per member.
8. Sorted required signer addresses, vesting times, authorization expiry, revenue splitter terms, and a nonzero deployment salt.

Member vesting amounts use contribution bps. Every member except the last receives floor(agent allocation × contribution bps / 10,000); the last member receives the exact remainder. The factory validates every amount again onchain.

## Generate the canonical no-broadcast packet

Copy the example while preserving the exact parent artifacts and their hashes. Replace only reviewed conversion resolutions and the placeholder factory address. The example factory address is intentionally not a deployment claim. Unknown fields at any relevant schema level are rejected.

```bash
cd packages/contracts
cp fixtures/swarm-launch/base-mainnet-preparation-input.json /secure/review/swarm-launch-input.json
node scripts/generate-swarm-launch-packet.js \
  --input /secure/review/swarm-launch-input.json \
  --output /secure/review/swarm-launch-packet.json
```

The generator refuses input objects containing key- or signature-named fields and refuses to overwrite output unless `--force` is explicitly provided. Generate twice to separate files and compare bytes or `manifestSha256`.

## Offline deterministic verification

```bash
node scripts/verify-swarm-launch-packet.js \
  --packet /secure/review/swarm-launch-packet.json
```

A successful offline report is `VERIFIED_OFFLINE` and proves:

- canonical packet hash;
- pinned solc 0.8.24 source and bytecode hashes;
- EIP-170 runtime and EIP-3860 initcode size bounds;
- cross-language deployment ID and CREATE2 predictions;
- EIP-712 digest;
- no-broadcast packet state.

## Base public-RPC or local-fork read-only simulation

Use a trusted Base mainnet RPC endpoint or an already-running local fork. Never put credentials in the packet.

```bash
node scripts/verify-swarm-launch-packet.js \
  --packet /secure/review/swarm-launch-packet.json \
  --rpc "$BASE_READ_ONLY_RPC_URL"
```

The verifier reads chain ID and factory bytecode, then runs `computeDeploymentId` and `predict` through `eth_call`. It never submits a transaction. Expected outcomes:

- `VERIFIED_READ_ONLY`: factory code exists and all onchain view results match.
- `FACTORY_NOT_DEPLOYED`: the packet's factory address has no code at the selected block. This is expected for a preparation fixture and is not a waiver.
- `RPC_UNAVAILABLE`: the report includes the exact transport/RPC error.
- `RPC_CHAIN_MISMATCH`: the endpoint is not Base chain ID 8453.

If Foundry/anvil is unavailable, record that prerequisite precisely. Do not replace fork verification with a write transaction.

## Contract invariants to review

- `FixedSupplySwarmToken` mints once in construction and has no mint, owner/admin, pause, blacklist, fee/tax, or upgrade surface.
- All token fields, bps, amounts, recipients, member splits, signer list, timing, salts, and readiness root are in the deployment ID and unanimous EIP-712 digest.
- CREATE2 predicts token, registry, splitter, and all vesting streams.
- Deployment creates the token, fully funds every non-transferable stream, transfers all three fixed allocations, and requires a zero final factory token balance in one atomic transaction.
- Factory authorization is unanimous, ordered, expiry-bound, replay-protected, low-s EOA compatible, and ERC-1271 compatible.
- Exact token balance deltas and reentrancy guards protect all funding/release paths.

## Future approval gates

The following remain separate, explicit human-controlled gates after generation and verification:

1. Independent contract/security review and Base-fork pass against the actual factory address.
2. Approval of the final signed readiness manifest and byte-identical packet.
3. Offline unanimous signature attachment review. Closed deterministic EOA recovery may produce `SIGNATURES_VERIFIED_EOA_OFFLINE` and `AUTHORIZED_NO_BROADCAST`. ERC-1271 attachments are structural only (`SIGNATURES_ATTACHED_UNVERIFIED`), move to `SIGNATURES_ATTACHED_NO_BROADCAST`, and keep `deploymentAuthorized: false` until a separately approved pinned-state/onchain proof exists. Callback-based verification is forbidden.
4. Explicit deployment approval by the authorized operator.
5. Separate wallet invocation and broadcast approval.
6. Post-deployment code, event, balances, vesting funding, recipient balances, and zero factory residue verification.

A prepared or offline-signed packet is never deployment authority by itself.
