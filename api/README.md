# Helixa API

Production API and discovery service for Helixa identity infrastructure on Base.

- Production base URL: `https://api.helixa.xyz`
- Local default: `http://127.0.0.1:3457`
- Network: Base mainnet (chain ID `8453`)
- HelixaV2: `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60`

## Run locally

```bash
cd api
npm ci
npm start
```

`npm start` runs `v2-server.js`. Set `V2_API_PORT` to override port `3457`.

Public reads can run without a signing key. Write paths, x402 settlement, internal routes, and receipt signing require the corresponding runtime secrets. Runtime secrets are loaded through `services/runtime-secrets.js`; do not put private keys or shared secrets in documentation or committed environment files.

Common configuration:

| Variable | Default | Purpose |
|---|---|---|
| `V2_API_PORT` | `3457` | HTTP listen port |
| `RPC_URL` | `https://mainnet.base.org` | Base write RPC |
| `READ_RPC_URL` | `https://mainnet.base.org` | Primary Base read RPC |
| `V2_CONTRACT` | HelixaV2 address above | Identity contract |
| `DEPLOYER_ADDRESS` | `0x339559A2d1CD15059365FC7bD36b3047BbA480E0` | Current write wallet and x402/manual payment destination |
| `DEPLOYER_KEY` | none | Optional local signing key; production loads the key from the configured secret manager |
| `INTERNAL_API_KEY` | none | Internal proxy authentication; 32+ characters |
| `INTERNAL_API_KEY_PREVIOUS` | none | Temporary rollover key |
| `RECEIPT_HMAC_SECRET` | none | Cred Report receipt signing; 32+ characters |
| `RECEIPT_HMAC_SECRET_PREVIOUS` | none | Temporary receipt rollover secret |

See [INTERNAL_AUTH_ROTATION.md](./INTERNAL_AUTH_ROTATION.md) for internal-key rotation.

## Start with discovery

| Endpoint | Purpose |
|---|---|
| `GET /health` | Service health |
| `GET /api/v2` | Live API discovery, auth, payments, and endpoint summary |
| `GET /api/v2/pricing` | Current USDC pricing and planned CRED estimates |
| `GET /api/v2/openapi.json` | OpenAPI 3.0 core integration schema |
| `GET /docs` | Human-readable API documentation |
| `GET /.well-known/agent-card.json` | A2A discovery |
| `GET /.well-known/mcp/server-card.json` | MCP discovery |
| `GET /.well-known/oasf-record.json` | OASF discovery |
| `GET /.well-known/agent-registry` | Helixa registry manifest |

The canonical public endpoint guide is [../docs/api-reference.md](../docs/api-reference.md). The agent-first quickstart is [../docs/docs/getting-started.md](../docs/docs/getting-started.md).

## Current payment model

Read `GET /api/v2/pricing` at runtime rather than hard-coding prices. At the time of this audit:

- Agent registration: `$1.00 USDC` via x402
- Full Cred Report: `$0.01 USDC` via x402
- Agent update, verification, soul lock, and soul handshake: free
- Native CRED x402 settlement: planned, not live

Direct API x402 uses the facilitator configured in `services/payments.js`. Bankr currently exposes wallet-scoped [`agent-lookup`](https://x402.bankr.bot/0xb92d2ab129072890b23ee3b1baff7c501cff9e49/agent-lookup) and [`cred-report`](https://x402.bankr.bot/0xb92d2ab129072890b23ee3b1baff7c501cff9e49/cred-report) services; the wallet root is not a browsable marketplace URL.

## Authentication

Agent writes use SIWA:

```text
Authorization: Bearer <address>:<timestamp>:<signature>
Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet <address> at <timestamp>
```

Timestamps may be Unix seconds or milliseconds and expire after one hour. Human and organization writes use SIWE or a Privy access token as documented by `GET /api/v2`.

## Tests

```bash
npm run audit:internal-auth
npm run test:internal-auth
npm test --if-present
```

Focused suites are also available through the `test:cred-*` scripts in `package.json`.
