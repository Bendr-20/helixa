# Credifi controlled Looper rollout

## Status

**PREPARATION ONLY.** The #2431 compatibility pilot already completed end to end on 2026-10-21 and must not be repeated as a prerequisite. Credit remains disabled in production. This package authorizes no authentication, invitation, vouch acceptance, EVC authorization, token approval, loan, repayment, deployment, or configuration change.

## Current blocker

The live Credifi guide fetched on 2026-10-23 still documents deployed ERC-1271 login, ERC-6551 accounts, wallet-executed authorization/approvals/repayment, flags, and vouch discovery/acceptance. It no longer publishes the previously reviewed loan preview/create, chain-info, or indexer endpoints. Do not enable the rollout until Credifi confirms the current exact API contract or restores equivalent public documentation, and the implementation is reconciled against it.

## Prepared invite cohort

The machine-readable packet is [controlled-rollout-preparation-v1.json](../../review-artifacts/credifi/controlled-rollout-preparation-v1.json). At Base block **52,997,613** (hash `0xb7bad3b39764c21414482073be1584d8ca69b6270ed68ef160f68d362eb638a8`), PublicNode and BlastAPI agreed on current NFT owner, ERC-6551 owner/token binding, ERC-8004 identity, and controller authority. The public CRED endpoint independently published methodology `cred-looper-provisional-1.1.0`, score 42, and an active Pantheon position for each candidate.

- Looper #11 — invite pending owner opt-in
- Looper #32 — invite pending owner opt-in
- Looper #46 — invite pending owner opt-in
- Looper #51 — invite pending owner opt-in
- Looper #70 — invite pending owner opt-in

The candidates have five distinct current owners. Selection used verified identity, active Pantheon participation, CRED >= 40, one Looper per owner, and ascending token ID. These are reproducible activity/compatibility criteria, **not** claims of creditworthiness or repayment reliability. No owner has been contacted.

## Dataset boundaries

- **Live cohort identity evidence:** five candidates, block 52,997,613.
- **Pantheon-to-Looper map:** 271 verified Looper stakers, block 52,995,624. This is discovery evidence, not current Credifi eligibility.
- **Public scores:** on-demand live records for the five candidates under `cred-looper-provisional-1.1.0`.
- **Completed control:** Looper #2431. It remains the only production allowlist entry while Credit is disabled.

## Promotion gates

1. **Provider contract gate:** Credifi confirms the exact current login, flags, vouch, market, quote, authorization, 2FA, loan creation, loan listing, chain-info, indexing, and repayment contracts. Update code/tests for any drift.
2. **Owner enrollment gate:** each current owner opts in. Reverify ownership, canonical released account runtime, `token()`, ERC-8004 controller, custody epoch, and public CRED at one fresh dual-provider block. Do not enroll transferred Loopers.
3. **Signer compatibility gate:** the owner proves the exact fresh Credifi challenge is accepted through the Looper account's ERC-1271 path. Stop after flags and read-only borrower state on first contact.
4. **Allowlist gate:** add only opted-in token IDs. Keep `MULTIPASS_CREDIT_ENABLED=false` while validating startup and denial boundaries.
5. **Enablement gate:** a separate explicit production approval is required before setting Credit true. Admit at most one new borrower at a time.
6. **Financial gates:** exact offer acceptance, informational quote, EVC authorization, 2FA, borrowing, token funding/approval, repayment, and allowance reset each require separate immediate owner approval. Never substitute the controller EOA for the canonical Looper account.
7. **Evidence gate:** Credifi observations stay score impact 0 until signed provider evidence and CRED governance approve ingestion.

## Rollback

Set `MULTIPASS_CREDIT_ENABLED=false`, preserve the explicit allowlist, restart the Multipass API, verify all Credit routes fail closed, and confirm no in-memory Credifi sessions survive the restart. Rollback does not revoke any already-broadcast EVC authorization or token allowance; those require separately approved onchain revocation/reset through the affected Looper account.

## Next authorized action

Resolve the provider API-contract blocker. After that, request explicit approval before contacting candidate owners or changing production configuration.
