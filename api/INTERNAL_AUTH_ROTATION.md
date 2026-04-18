# Internal Auth Rotation Runbook

## Current touchpoints
- `api/v2-server.js`
  - `hasValidInternalKey(req)`
  - internal-key bypass middleware for x402 routes
  - `GET /api/v2/internal/agent/:id/cred-report`
  - `POST /api/v2/internal/mint-signature`
  - `POST /api/v2/internal/mint`
- deployment env
  - `INTERNAL_API_KEY`
  - `INTERNAL_API_KEY_PREVIOUS` (optional rollover window)
  - `RECEIPT_HMAC_SECRET`
  - `RECEIPT_HMAC_SECRET_PREVIOUS` (optional receipt verification rollover window)
  - on this box, `helixa-api.service` reads `/home/ubuntu/.openclaw/workspace/agentdna/.env`
- external trusted callers
  - Bankr/x402 proxy or any service that sends `x-internal-key`
  - current workspace caller paths use `HELIXA_INTERNAL_KEY`:
    - `/home/ubuntu/.openclaw/workspace/x402/mint/index.ts`
    - `/home/ubuntu/.openclaw/workspace/x402/cred-report/index.ts`
    - `/home/ubuntu/.openclaw/workspace/x402/agent-update/index.ts`
    - `/home/ubuntu/.openclaw/workspace/x402/soul-lock/index.ts`
    - `/home/ubuntu/.openclaw/workspace/x402/soul-share/index.ts`
- docs
  - `docs/api-reference.md`

## Rollover model
- signing always uses the primary values:
  - `INTERNAL_API_KEY`
  - `RECEIPT_HMAC_SECRET`
- validation can temporarily accept the previous values too:
  - `INTERNAL_API_KEY_PREVIOUS`
  - `RECEIPT_HMAC_SECRET_PREVIOUS`
- after callers have moved, remove the `*_PREVIOUS` values and restart once more

## Preflight
1. Identify the real live env source for `helixa-api`.
2. Identify every trusted caller that sends `x-internal-key`.
3. Generate:
   - a new `INTERNAL_API_KEY` of at least 32 characters
   - a new `RECEIPT_HMAC_SECRET` of at least 32 characters
4. Store the previous values somewhere safe for rollback.
5. Confirm someone can update both app env and caller config in the same window.

## Cutover sequence
1. Pause manual mint or internal-admin actions.
2. Update `helixa-api` env like this:
   - `INTERNAL_API_KEY=<new>`
   - `INTERNAL_API_KEY_PREVIOUS=<old>`
   - `RECEIPT_HMAC_SECRET=<new>`
   - `RECEIPT_HMAC_SECRET_PREVIOUS=<old>`
3. Restart or reload `helixa-api`.
4. Update trusted caller config to send the new key, for example `HELIXA_INTERNAL_KEY=<new>` in the x402 handlers.
5. Validate both old and new paths during the overlap window.
6. Remove `INTERNAL_API_KEY_PREVIOUS` and `RECEIPT_HMAC_SECRET_PREVIOUS` after all callers are confirmed on the new key, then restart once more.

## Validation
- Public `POST /api/v2/mint` still behaves as expected for x402.
- Trusted caller can hit:
  - `POST /api/v2/internal/mint`
  - `POST /api/v2/internal/mint-signature`
  - `GET /api/v2/internal/agent/:id/cred-report`
- During the overlap window, both old and new internal keys work.
- After removing `INTERNAL_API_KEY_PREVIOUS`, the old internal key returns `403`.
- `POST /api/v2/cred-report/verify-receipt` validates receipts signed by both current and rollover secrets during the overlap window.

## Rollback
1. Restore the previous values as primary secrets.
2. Clear the `*_PREVIOUS` values or set them to the newer values only if you still need overlap.
3. Restore the previous caller key config.
4. Restart or reload `helixa-api`.
5. Re-run the validation checks.

## Safe prep before cutover
- Run `npm run audit:internal-auth` from `api/`.
- Run `npm run test:internal-auth` from `api/`.
- Confirm there is no fallback secret logic in `api/v2-server.js`.
- Treat backup files as archival only, never as deployment source.
- Keep `.env` gitignored and avoid using the repo copy as the source of truth for production secrets.
