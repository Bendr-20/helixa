# Multipass API

API boundary primitives for Multipass profiles, agent-readable documents, A1 saved public records, and B1/B2 developer reads.

This server exposes public Multipass activation, profile, and discovery data. It does not transfer custody, reveal private fields, mutate live runtime routes, grant tool access, or make payments and receipts count as trust.

## Current routes

Discovery and developer surface:

- `GET /.well-known/helixa-multipass.json`
- `GET /.well-known/multipass.json`
- `GET /api/openapi.json`
- `GET /api/resolve?agent={input}`
- `GET /api/search?q={query}`

Activation and saved records:

- `POST /api/multipass/activate` preview a live AgentDNA activation without saving it
- `POST /api/multipass` activate and persist a public Multipass record

Loopers launch intake:

- `POST /api/loopers/allowlist/register` register one wallet address for the Loopers allowlist
- `GET /api/loopers/allowlist/status?address={address}` check whether one wallet address is registered
- `GET /api/loopers/allowlist/proof?address={address}` fetch a frozen mint proof from the final Merkle snapshot

Public profile reads:

- `GET /api/multipass/{id}`
- `GET /api/v0/multipass/{id}`
- `GET /api/multipass/{id}/fragments`
- `GET /api/multipass/{id}/tools` public tool and service cards
- `GET /api/multipass/{id}/agent-card` canonical agent-readable card
- `GET /api/multipass/{id}/card` compatibility alias for the agent-readable card
- `GET /api/multipass/{id}/standards`
- `GET /api/multipass/{id}/x402`
- `GET /api/multipass/{id}/receipts`
- `GET /api/multipass/{id}/receipts/{receipt_id}`
- `GET /api/multipass/{id}/changes`

Manager routes are session and CSRF protected. Public fragment responses return public fragments only. Public tool cards are discovery metadata only, not tool execution, credentials, payments, or access grants. Activated records are public trust profiles until a claim flow verifies a manager.

Canonical route notes:

- Use `/.well-known/multipass.json` as the canonical discovery document. `/.well-known/helixa-multipass.json` remains a legacy alias.
- Use `/api/multipass/{id}/agent-card` as the canonical agent-readable card route. `/api/multipass/{id}/card` remains a compatibility alias.
- Public `/changes` responses expose saved-record change history only when available.

## Local server

Run a public-neutral fixture:

```bash
pnpm api:generic
```

Run the Bendr demo fixture:

```bash
pnpm api:bendr
```

Default URL: `http://127.0.0.1:8787`.

### Canonical Looper CRED

Authenticated `GET /api/loopers/owned` responses enrich each already-authorized Looper with a normalized `cred` object from the canonical server endpoint `GET /api/v2/cred/erc8004/:chainId/:agentId`. The browser reads only the same-origin Multipass route. It never calls the CRED service directly and receives no internal service credential.

Server-only configuration:

```bash
MULTIPASS_LOOPER_CRED_API_BASE_URL=https://api.helixa.xyz
MULTIPASS_LOOPER_CRED_TIMEOUT_MS=4000
MULTIPASS_LOOPER_CRED_CONCURRENCY=4
```

The production-safe base URL is the default, no secret is required, the timeout is capped at 30 seconds, and concurrency is capped at 16. Multipass validates the returned chain, canonical ERC-8004 registry, identity ID, Loopers collection, Looper token ID, score, coverage, freshness, methodology, and timestamps before exposing a score. Failures return `cred.status: "unavailable"`; stale backend snapshots retain their score only with explicit stale freshness metadata. Legacy `credScore` and `credLabel` fields are derived solely from validated canonical `cred` during migration.

### Console credit private beta

The authenticated Multipass Console can expose a sponsor-vouch credit workspace for a selected, currently owned Looper. It gates Credifi access on live canonical CRED, keeps the Credifi bearer session server-side, validates current market and EVC configuration, and separates vouch acceptance, permission review, quote review, and borrowing into distinct owner actions. The beta does not claim to submit a public credit application because Credifi does not expose an application endpoint.

The feature is disabled by default:

```bash
MULTIPASS_CREDIT_ENABLED=true
MULTIPASS_CREDIFI_API_BASE_URL=https://backend.credi.fi
MULTIPASS_CREDIT_CRED_BASE_URL=https://helixa.xyz
MULTIPASS_CREDIT_MIN_CRED=40
MULTIPASS_CREDIT_TIMEOUT_MS=10000
```

No static Credifi API key is configured. The owner signs a fresh Credifi challenge that the server binds to the exact Looper account, `credi.fi`, and Base; the resulting bearer token remains in bounded server memory for the authenticated Console session. Logout revokes that local session. The beta accepts only Base USDC (`0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`) in the exact vouched vault. The EVC permission is broad across all subaccounts sharing the wallet prefix; the Console displays that scope, validates canonical calldata, and re-fetches the live configuration immediately before wallet broadcast. Quotes are single-use, concurrent vouch/borrow submissions are serialized, and an uncertain loan result locks new borrowing for operator reconciliation instead of permitting a retry.

Advertise a production URL while listening locally:

```bash
MULTIPASS_PUBLIC_BASE_URL=https://helixa.xyz pnpm api:bendr
```

Enable persistent saved records with SQLite:

```bash
MULTIPASS_DB_PATH=/tmp/multipass.sqlite pnpm api:bendr
```

Enable persistent Loopers allowlist registrations with JSON:

```bash
MULTIPASS_LOOPERS_ALLOWLIST_PATH=/tmp/multipass-loopers-allowlist.json pnpm api:bendr
```

Serve a frozen Loopers mint proof snapshot:

```bash
MULTIPASS_LOOPERS_ALLOWLIST_SNAPSHOT_PATH=/tmp/loopers-allowlist-snapshot.json pnpm api:bendr
```

You can also pass `--database /tmp/multipass.sqlite`, `--loopers-allowlist /tmp/multipass-loopers-allowlist.json`, `--loopers-allowlist-snapshot /tmp/loopers-allowlist-snapshot.json`, and `--public-base-url https://helixa.xyz` to the server CLI.

Useful routes:

- `GET /.well-known/multipass.json`
- `GET /api/openapi.json`
- `GET /api/resolve?agent=demo-agent`
- `GET /api/search?q=demo`
- `GET /api/multipass/demo-agent`
- `GET /api/multipass/demo-agent/fragments`
- `GET /api/multipass/demo-agent/tools`
- `GET /api/multipass/demo-agent/agent-card`
- `GET /api/multipass/demo-agent/card` compatibility alias
- `GET /api/multipass/demo-agent/standards`
- `GET /api/multipass/demo-agent/x402`
- `GET /api/multipass/demo-agent/receipts`
- `GET /api/multipass/demo-agent/receipts/receipt_demo_lookup`
- `GET /api/multipass/demo-agent/changes`
- `POST /api/loopers/allowlist/register`
- `GET /api/loopers/allowlist/status?address=0x...`
- `GET /api/loopers/allowlist/proof?address=0x...`

Bendr fixture routes use the same pattern with `bendr-2`.

## Loopers allowlist

The Looper allowlist stores checksum-normalized Ethereum addresses, a registration timestamp, and a bounded source label. Duplicate registrations are idempotent: the first source and timestamp are preserved and later duplicate submissions return `created: false`.

For production, configure:

```bash
MULTIPASS_LOOPERS_ALLOWLIST_PATH=/var/lib/helixa/multipass-loopers-allowlist.json
```

The live `multipass-api.service` reads `/etc/default/multipass-api`, so this value can be staged there before restart. The service user must be able to write the containing directory.

## Console XMTP worker

The browser Console can call `POST /api/multipass/console/agent/message` directly. For wallet-native XMTP chat, run the worker as a separate long-lived process:

```bash
MULTIPASS_XMTP_WALLET_KEY=0x... \
MULTIPASS_XMTP_DB_ENCRYPTION_KEY=0x... \
MULTIPASS_XMTP_AGENT_ID=81 \
MULTIPASS_XMTP_AGENT_NAME=Quigbot \
pnpm --filter @helixa/multipass-api xmtp:worker
```

The worker listens for inbound XMTP text and built-in static image attachments, resolves the sender wallet from the conversation member identity, revalidates image bytes, passes the turn through the existing Console runtime, stores recall in Sibyl, and sends only the agent response back into the same XMTP conversation. Incoming human messages are stored with their XMTP message ID but are not re-sent. Sibyl stores image MIME, sanitized filename, dimensions when known, decoded byte length, and SHA-256 digest only - never base64 or plaintext payload bytes.

For hackathon proof, run the cold-start verifier with real Sibyl required:

```bash
pnpm --filter @helixa/multipass-api sibyl:prove-cold-start -- \
  --namespace multipass:hackathon-proof:looper-1234:activation-20260906 \
  --message "Watchlist preference: Sepolia rehearsal, Merkle freeze, and review-only launch moves." \
  --query Merkle
```

The verifier writes through one Sibyl-backed runtime, creates a fresh reader with fallback disabled, and fails unless the saved memory is recalled from `sibyl_memory`.

Optional production environment:

```bash
MULTIPASS_XMTP_ENV=production
MULTIPASS_XMTP_DB_PATH=/var/lib/helixa/multipass-xmtp.db3
MULTIPASS_XMTP_APP_VERSION=multipass-console-worker
MULTIPASS_AGENT_BANKR_LLM_ENABLED=true
MULTIPASS_AGENT_LLM_MODEL=...
MULTIPASS_AGENT_LLM_VISION_MODEL=...
```

Image understanding fails visibly unless `MULTIPASS_AGENT_LLM_VISION_MODEL` names a Bankr model verified to accept OpenAI-compatible image input. Text-only turns continue to use `MULTIPASS_AGENT_LLM_MODEL`.

Console image V1 accepts exactly one JPEG, PNG, WebP, or GIF with an optional 2,000-byte caption. JPEG/PNG/WebP source files are capped at 12 MiB, browser-decoded, and re-encoded at no more than 2,048 px per axis to remove EXIF/GPS, then reduced to at most 750 KiB decoded. GIF is strict MIME/magic validated and capped at 512 KiB. The JSON request body is stream-counted and capped at 1,100,000 bytes, including dishonest or chunked requests. The server independently verifies canonical base64, decoded size, sanitized filename, MIME, magic bytes, encoded dimensions, ownership, CSRF, and quotas before provider calls. Every image turn carries a retry-stable client message ID so XMTP attachment and caption idempotency keys remain unchanged after ambiguous failures.

Images use XMTP SDK 6.1.0 built-in static attachments: `sendAttachment({ filename, mimeType, content: Uint8Array }, { idempotencyKey })`. The encrypted XMTP attachment is sent first; an optional caption follows as deterministic adjacent text. The inbound worker briefly buffers an authorized attachment so an immediately adjacent caption becomes one vision turn, and restart recovery collapses the attachment/caption pair back into one thread message. No public object storage or plaintext off-network URL is used.

Mint handoff: this JSON allowlist is the collection/admin source, not the final onchain gate. Before a Looper mint, snapshot the normalized addresses, generate a Merkle tree, set the Merkle root in the mint contract, and serve the frozen proof snapshot separately:

```bash
MULTIPASS_LOOPERS_ALLOWLIST_SNAPSHOT_PATH=/var/lib/helixa/loopers-allowlist-snapshot.json
```

The mint page should call `GET /api/loopers/allowlist/proof?address=0x...`. Eligible wallets receive the proof array and Merkle root; ineligible wallets receive `eligible: false` with an empty proof. This route must point at the frozen final snapshot, not the live registration JSON.

Operational scripts:

```bash
pnpm --filter @helixa/multipass-api loopers:allowlist:backup -- --input /var/lib/helixa/multipass-loopers-allowlist.json
pnpm --filter @helixa/multipass-api loopers:allowlist:import-batch -- --store /var/lib/helixa/multipass-loopers-allowlist.json --input /secure/path/new-addresses.txt --manifest /secure/path/import-manifest.json
pnpm --filter @helixa/multipass-api loopers:allowlist:import-batch -- --store /var/lib/helixa/multipass-loopers-allowlist.json --input /secure/path/new-addresses.txt --manifest /secure/path/import-manifest.json --apply
pnpm --filter @helixa/multipass-api loopers:allowlist:export -- --input /var/lib/helixa/multipass-loopers-allowlist.json --output /tmp/loopers-allowlist-snapshot.json
```

Batch import dry-runs by default. It rejects invalid rows and duplicate rows inside the batch, reports addresses that already exist in the store, preserves first-seen order, and previews the post-merge Merkle root in the manifest before `--apply` writes the live store.

The export includes ordered entries, one leaf per normalized address, a Merkle root, and per-wallet proofs. Keep the public page framed as early registration only: no promised mint, timing, price, allocation, or final supply until the collection and contract plan are final.

## Public-web enrichment

Saved records can be enriched from public agent docs without claiming owner verification. The importer fetches a seed URL plus common agent-readable docs such as `llms.txt`, `llms-full.txt`, `.well-known/openapi.json`, `.well-known/ai-plugin.json`, `openapi.json`, `strategy-plugin.txt`, and MCP docs. Imported routes and tools are stored as pending `public_web_observed` metadata so owners can claim the Multipass and correct or verify it.

Dry run:

```bash
node apps/api/scripts/enrich-public-web-docs.js \
  --database /var/lib/helixa/multipass.sqlite \
  --identifier velvet-unicorn-1127 \
  --seed-url https://vu.velvetdao.xyz/landing/
```

Apply:

```bash
node apps/api/scripts/enrich-public-web-docs.js \
  --database /var/lib/helixa/multipass.sqlite \
  --identifier velvet-unicorn-1127 \
  --seed-url https://vu.velvetdao.xyz/landing/ \
  --apply
```

Use `--docs-json captured-docs.json` to import from a reviewed capture instead of live fetching.

Save a persistent public record after previewing or activating a live source record:

```bash
curl -s http://127.0.0.1:8787/api/multipass \
  -H 'content-type: application/json' \
  -d '{"agent":"1"}'
```

`POST /api/multipass/activate` is preview-only. `POST /api/multipass` is the public save path in A1.

## Live operator docs

- `docs/live-status.md` describes the current V0 public surface and safety boundary.
- `docs/live-smoke-checklist.md` contains copy-paste local and live smoke checks.

## ERC-8004 import

Activation supports direct Base ERC-8004 identity sources in addition to Helixa AgentDNA sources. Accepted ERC-8004 forms are `erc8004:8453:{tokenId}`, `eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:{tokenId}`, and `erc8004:eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432:{tokenId}`.

For Helixa AgentDNA activation, the importer also checks the canonical Base ERC-8004 Identity Registry for identities already held by the live Helixa agent owner, agent address, or configured platform wallets. Matching identities are imported as public `standard_ref` fragments and reflected in the standards profile.

Custody labels:

- `agent_owned` - held by the agent custody wallet or an AGENT_SIWA source owner
- `owner_owned` - held by the public Helixa source owner
- `platform_held_mirror` - held by a configured Helixa/platform wallet
- `candidate_match` - metadata matched, but custody could not be classified

Optional environment:

```bash
MULTIPASS_ERC8004_PLATFORM_WALLETS=0x...,0x...
MULTIPASS_ERC8004_REGISTRY_ADDRESS=0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
MULTIPASS_ERC8004_BLOCKSCOUT_API=https://base.blockscout.com/api
BASE_RPC_URL=https://mainnet.base.org
```

## Looper #3802 RESTAP canary

The four RESTAP surfaces are **default off** and require the reviewed phased gates. See [the Looper #3802 RESTAP canary runbook](../../docs/loopers/looper-restap-3802-canary.md).
