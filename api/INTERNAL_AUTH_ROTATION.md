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
  - `RECEIPT_HMAC_SECRET`
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

## Important constraint
The current code accepts one active internal key at a time. Rotation is a coordinated cutover, not a seamless dual-key rollout. If zero downtime matters, add temporary dual-key support first.

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
2. Update the trusted caller config with the new internal key, but do not rely on it yet if that caller hot-reloads immediately.
3. Update `helixa-api` env with the new `INTERNAL_API_KEY` and `RECEIPT_HMAC_SECRET`.
4. Restart or reload `helixa-api`.
5. Re-enable the trusted caller path.

## Validation
- Public `POST /api/v2/mint` still behaves as expected for x402.
- Trusted caller can hit:
  - `POST /api/v2/internal/mint`
  - `POST /api/v2/internal/mint-signature`
  - `GET /api/v2/internal/agent/:id/cred-report`
- The same requests with the old internal key now return `403`.
- `POST /api/v2/cred-report/verify-receipt` still validates freshly issued receipts.

## Rollback
1. Restore the previous `INTERNAL_API_KEY` and `RECEIPT_HMAC_SECRET` in app env.
2. Restore the previous caller key config.
3. Restart or reload `helixa-api`.
4. Re-run the validation checks.

## Safe prep before cutover
- Run `npm run audit:internal-auth` from `api/`.
- Confirm there is no fallback secret logic in `api/v2-server.js`.
- Treat backup files as archival only, never as deployment source.
- Keep `.env` gitignored and avoid using the repo copy as the source of truth for production secrets.
