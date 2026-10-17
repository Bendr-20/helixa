# Swarm Command Base Sepolia Post-Deployment Verification Plan

**Goal:** Replace the expired pre-deployment readiness gate with a canonical, read-only verification path for the confirmed Swarm Command Base Sepolia infrastructure.

**Safety boundary:** This slice performs JSON-RPC reads only. It must not sign, broadcast, propose or activate a registry version, mint test tokens, fund a mission, deploy a vault, or collect authorization material.

## Task 1: Pin the confirmed deployment receipt

- [x] Add a canonical deployment manifest under `packages/contracts/deployments/` with packet commit/hash, transaction hashes and blocks, exact addresses, runtime hashes, authority configuration, and an explicit `governance_pending` / `mission_creation_enabled: false` state.
- [x] Validate exact schema, canonical addresses, unique nonces, and the five confirmed transactions in a focused test.

## Task 2: Add a fixed-host post-deployment verifier

- [x] Read only the two approved Base Sepolia RPC origins.
- [x] Require chain/head/block agreement and verify all deployed runtime hashes.
- [x] Verify Safe singleton/version/owners/threshold/nonce, token metadata/issuer/zero supply, registry governance/emergency council/delay, and factory registry/compatibility.
- [x] Require Safe nonce zero, proving no Safe-governed registry action has executed, and keep mission creation blocked until a separately approved governance release.
- [x] Bound time, response bytes, JSON shape, and redirects; expose no generic RPC or mutation surface.

## Task 3: Replace the obsolete live-plan gate

- [x] Keep the committed pre-deployment packet byte-pinned as historical evidence without regenerating it from changed live state.
- [x] Add `verify:missions:live` for post-deployment verification and update the testnet runbook.
- [x] Run focused contract tests, mission API tests, diff checks, and a live read-only verification artifact.
