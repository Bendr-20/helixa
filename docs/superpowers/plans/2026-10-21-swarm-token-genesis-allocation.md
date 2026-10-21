# Swarm Token Genesis and Allocation Implementation Plan

**Goal:** Add deterministic, provider-neutral Base-mainnet token creation, exact full-supply allocation, canonical no-broadcast packet generation, and read-only/fork verification while preserving unanimous authorization safeguards.

## Safety boundary

- [x] Keep all execution local/read-only: no deployment, signing, signature collection, funding, RPC transaction submission, production mutation, or broadcast.
- [x] Restrict executable contracts and packets to Base chain ID 8453, 3-5 members, and the existing signed readiness hash root.
- [x] Keep API/Console wallet invocation, live collection UI, and database persistence out of scope.
- [x] Treat absent RPC/fork tooling as an explicitly reported verification limitation, never as permission to broadcast.

## TDD implementation tasks

- [x] **RED — deterministic genesis token:** extend `packages/contracts/test/swarm-launch-execution.test.mjs` and add Foundry coverage under `packages/contracts/foundry-test/` for a fixed-supply 18-decimal ERC-20 with no owner/admin/mint/pause/blacklist/upgrade/fee/tax surface; verify compilation and locked ABI fail before implementation.
- [x] **GREEN — token contract and compiler:** add `packages/contracts/src/missions/launch/FixedSupplySwarmToken.sol`; update `packages/contracts/scripts/compile-swarm-launch.js` and `packages/contracts/foundry.toml` inputs/remappings as needed.
- [x] **RED — exact allocation and CREATE2:** add JS/onchain tests for token prediction, token parameters, four explicit allocation buckets totaling 10,000 bps, three distinct nonzero external recipients, deterministic category/member remainder handling, atomic stream funding, exact balances, replay/expiry/reentrancy/signature failures, ERC-1271, and zero factory residue.
- [x] **GREEN — factory genesis/allocation:** update `packages/contracts/src/missions/launch/SwarmLaunchFactory.sol` to deploy the token by CREATE2, validate every explicit amount/bps/recipient, create/fund member streams atomically, transfer all non-agent allocations, bind all fields into deployment ID/EIP-712, preserve sorted unanimous EOA/ERC-1271 authorization, and enforce Base/3-5-member rules.
- [x] **RED — canonical packet:** extend `packages/contracts/test/swarm-launch-execution-manifest.test.mjs` with defaults/validation for `PREPARATION_ONLY`, no keys/signatures, false authorization/broadcast flags, exact allocation inputs, cross-language deployment ID/digest/CREATE2 parity, unselected mechanism rejection, and pure offline attachment.
- [x] **GREEN — packet generator:** update `packages/contracts/scripts/swarm-launch-execution-manifest.js` and add `packages/contracts/scripts/generate-swarm-launch-packet.js` plus a canonical fixture/input under `packages/contracts/fixtures/swarm-launch/`; ensure deterministic JSON and provider-neutral fields only.
- [x] **RED/GREEN — read-only verifier:** add `packages/contracts/test/swarm-launch-read-only-verifier.test.mjs` and `packages/contracts/scripts/verify-swarm-launch-packet.js`; validate packet hashes, compiler/source hashes, bytecode sizes, Base RPC chain/code reads, CREATE2 parity, and optional local Base fork simulation using only `eth_chainId`, `eth_getCode`, `eth_call` or a local fork process—never `eth_sendTransaction`/raw transaction methods.
- [x] **Scripts/docs:** update `packages/contracts/package.json` scripts and `docs/runbooks/swarm-token-launch.md` with generation, deterministic/fork verification, unavailable-RPC reporting, and future approval gates.

## Verification gates

- [x] Run each focused test at RED and record the expected missing-feature failure before production edits; rerun GREEN after each slice.
- [ ] Run all Swarm Launch JS tests and Foundry tests. JS: 11/11 pass. Foundry source compiles with pinned solc; `forge` is unavailable on this host.
- [x] Run the full applicable `@helixa/loopers-contracts` test suite (130 pass; sole failure is the known unrelated missing `/tmp/looper-agent-account-base-preview-2026-09-22T1849Z.json` fixture); exclude only the known unrelated missing historical `/tmp` fixture if it is the sole unrelated failure and name it.
- [x] Run deterministic compilation twice and compare source/artifact hashes.
- [x] Run available formatting/whitespace and syntax checks plus EIP-170 runtime/initcode size checks (no repository formatter executable is installed).
- [ ] Run the Base fork/read-only verification when a public Base RPC and fork tooling are available; otherwise capture the exact missing prerequisite/error. Public Base RPC reads succeeded for chain/code and precisely reported `FACTORY_NOT_DEPLOYED`; `forge`/`anvil` are unavailable, so no local fork was run.
- [x] Inspect the final diff, verify no secret/signature material or provider calldata is present, confirm no RPC send methods are reachable, and commit all source changes locally.
