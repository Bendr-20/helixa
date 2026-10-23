# Credifi controlled Looper rollout

## Status

**PREPARATION ONLY.** The #2431 compatibility pilot already completed end to end on 2026-10-21 and must not be repeated as a prerequisite. Credit remains disabled in production. This package authorizes no authentication, invitation, vouch acceptance, EVC authorization, token approval, loan, repayment, deployment, or configuration change.

## Current provider contract

The live Credifi guide was re-fetched in full on 2026-10-23. It documents deployed ERC-1271 login, ERC-6551 accounts, wallet-executed authorization/approvals/repayment, flags, vouch discovery/acceptance, markets, quote preview, loan creation/listing, chain-info, indexer refresh, and repayment. The earlier blocker was a false result caused by inspecting truncated extracted content; the API reference at the end of the same page contains the endpoints. The reviewed implementation remains aligned with the documented direct ERC-6551 flow.

## Prepared invite cohort

The machine-readable packet is [controlled-rollout-preparation-v1.json](../../review-artifacts/credifi/controlled-rollout-preparation-v1.json). At Base block **53,004,584** (hash `0x1df094618665245be760888c1f864b5f700cbc0698b78eb885e8ec7a5ef09a70`), PublicNode and BlastAPI agreed on current NFT owner, ERC-6551 owner/token binding, ERC-8004 identity, and controller authority for **50 Loopers controlled by 50 distinct owners**. The live production scoring service independently produced methodology `cred-looper-provisional-1.1.0` with CRED >= 40 for every candidate.

Prepared token IDs: #11, #19, #20, #32, #46, #70, #100, #106, #143, #149, #194, #210, #273, #285, #312, #349, #402, #420, #480, #548, #550, #558, #612, #641, #645, #667, #827, #905, #4151, #941, #1008, #1090, #1104, #1169, #1171, #1442, #1615, #1687, #1713, #1787, #1827, #2015, #2017, #2150, #2250, #2285, #2620, #2653, #2916, #3328.

Selection used verified released-v1 activation, current identity/controller proof, CRED >= 40, one Looper per owner, and ascending token ID. Pantheon participation is optional supporting evidence: 17 of 50 currently have an active position. Neither stake size nor selection is a claim of creditworthiness or repayment reliability. Every candidate remains invite-pending owner opt-in; no owner has been contacted.

## Dataset boundaries

- **Live cohort identity evidence:** 50 candidates controlled by 50 distinct owners, block 53,004,584.
- **Pantheon-to-Looper map:** 271 verified Looper stakers, block 52,995,624. This is discovery evidence, not current Credifi eligibility.
- **Public scores:** direct live production-service records for all 50 candidates under `cred-looper-provisional-1.1.0`; public-edge batching is intentionally avoided because that surface is rate-limited.
- **Completed control:** Looper #2431. It remains the only production allowlist entry while Credit is disabled.

## Promotion gates

1. **Provider contract gate — passed for preparation:** the live guide documents the exact current login, flags, vouch, market, quote, authorization, 2FA, loan creation, loan listing, chain-info, indexing, and repayment paths. Re-fetch it immediately before each enrollment and stop on material drift.
2. **Owner enrollment gate:** each current owner opts in. Reverify ownership, canonical released account runtime, `token()`, ERC-8004 controller, custody epoch, and public CRED at one fresh dual-provider block. Do not enroll transferred Loopers.
3. **Signer compatibility gate:** the owner proves the exact fresh Credifi challenge is accepted through the Looper account's ERC-1271 path. Stop after flags and read-only borrower state on first contact.
4. **Allowlist gate:** add only opted-in token IDs. Keep `MULTIPASS_CREDIT_ENABLED=false` while validating startup and denial boundaries.
5. **Enablement gate:** a separate explicit production approval is required before setting Credit true. Admit at most one new borrower at a time.
6. **Financial gates:** exact offer acceptance, informational quote, EVC authorization, 2FA, borrowing, token funding/approval, repayment, and allowance reset each require separate immediate owner approval. Never substitute the controller EOA for the canonical Looper account.
7. **Evidence gate:** Credifi observations stay score impact 0 until signed provider evidence and CRED governance approve ingestion.

## Rollback

Set `MULTIPASS_CREDIT_ENABLED=false`, preserve the explicit allowlist, restart the Multipass API, verify all Credit routes fail closed, and confirm no in-memory Credifi sessions survive the restart. Rollback does not revoke any already-broadcast EVC authorization or token allowance; those require separately approved onchain revocation/reset through the affected Looper account.

## Next authorized action

Request explicit approval before contacting candidate owners. Owner outreach, authentication, allowlist changes, production enablement, and every financial action remain separately gated.
