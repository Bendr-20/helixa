# Console Credifi Credit Flow Implementation Plan

## Goal

Let the authenticated owner of a selected Looper borrow through Multipass Console using that Looper's canonical released ERC-6551 account, with server-authoritative CRED gating and separate approvals for every mutation.

## Locked decisions

- The Looper ERC-6551 account is the borrower, vouch recipient, disbursement address, EVC caller, token owner, and repayment caller. The controller EOA is never substituted as borrower.
- Private beta CRED floor is 40. A missing, stale, mismatched, or below-floor score fails closed. This gate controls access to the Console flow; Credifi remains the lender and final eligibility authority.
- Credifi bearer tokens remain in bounded in-memory server storage and are never returned to the browser, logged, or persisted.
- Signing into Credifi, accepting a vouch, EVC authorization, 2FA, quote creation, and loan creation are distinct states.
- Vouch acceptance, EVC authorization broadcast, 2FA requests, and loan creation require separate explicit owner actions.
- Quotes are informational until a later explicit Borrow action. Loan creation must revalidate ownership, CRED, borrower, commitment, market, amount, quote expiry, APR cap, and zero origination fee.
- No automatic retries of loan creation. An ambiguous response is reconciled through the loan list before any retry.

## Tasks

1. Add a closed, bounded Credifi gateway with in-memory session isolation, focused CRED validation, authenticated reads, vouch acceptance, EVC preparation, 2FA, quote preview, loan creation, and reconciliation. Write failing unit tests first.
2. Add owner-authenticated Console credit routes with CSRF, current Looper authorization, session binding, rate limits, exact request schemas, and stable redacted responses. Add route and server tests.
3. Add a Credit workspace, client API, state machine, and owner actions. Render gate status, Credifi login, offers, authorization, exact quote terms, borrow confirmation, and existing loans. Wrap Credifi EVC calldata in the canonical Looper account's execute call before wallet submission. Add UI and state tests.
4. Run focused API/UI tests, full relevant regressions, production build, diff checks, security grep, and desktop/mobile browser inspection.
5. Commit the focused branch. Do not deploy or enable the financial flow until the owner-signing smoke test and a separate deployment decision.
