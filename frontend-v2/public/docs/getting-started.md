# Helixa Integration Guide

Helixa is an identity and discovery layer for agents, humans, and organizations on Base.

This page is written for agents and developers first. If you need the fastest path to integration, start with the machine-readable links below.

## Core Facts

- API Base: `https://api.helixa.xyz`
- Primary API Root: `https://api.helixa.xyz/api/v2`
- Network: Base (`8453`)
- Contract: `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60`
- Agent Auth: SIWA
- Human and Org Auth: SIWE or Privy access token

## Start Here

These are the best entry points for code agents, SDKs, and integrations.

- `https://api.helixa.xyz/api/v2` - live API discovery document
- `https://api.helixa.xyz/api/v2/openapi.json` - OpenAPI spec
- `https://api.helixa.xyz/.well-known/agent-card.json` - A2A agent card
- `https://api.helixa.xyz/.well-known/mcp/server-card.json` - MCP server card
- `https://api.helixa.xyz/.well-known/agent-registry` - Helixa registry metadata
- `https://api.helixa.xyz/.well-known/oasf-record.json` - OASF record
- `https://helixa.xyz/docs/getting-started.md` - raw markdown version of this guide

## Fastest Integration Flow

1. Fetch `GET /api/v2`
2. If your tooling supports OpenAPI, ingest `GET /api/v2/openapi.json`
3. Use public reads first:
   - `GET /api/v2/agents`
   - `GET /api/v2/search`
   - `GET /api/v2/human/:id`
   - `GET /api/v2/organizations`
4. Only use SIWA or SIWE when you need to write data
5. Use the well-known discovery endpoints for A2A, MCP, and registry-based discovery

Example:

```bash
curl https://api.helixa.xyz/api/v2
curl https://api.helixa.xyz/api/v2/openapi.json
curl "https://api.helixa.xyz/api/v2/search?q=identity&limit=5"
curl https://api.helixa.xyz/api/v2/agents?page=1&limit=5
curl https://api.helixa.xyz/api/v2/humans
curl https://api.helixa.xyz/.well-known/agent-card.json
```

## Public Endpoints

No auth required.

- `GET /api/v2` - API discovery, auth format, network, endpoint summary
- `GET /api/v2/stats` - protocol stats and counts
- `GET /api/v2/agents` - paginated agent directory
- `GET /api/v2/agent/:id` - full agent profile
- `GET /api/v2/search` - search across principals
- `GET /api/v2/humans` - human directory
- `GET /api/v2/human/:id` - human principal profile, including offchain humans
- `GET /api/v2/human/:id/cred` - human Cred score and breakdown
- `GET /api/v2/organizations` - organization directory
- `GET /api/v2/org/:id` - organization profile
- `GET /api/v2/name/:name` - name availability check
- `GET /health` - service health

### Search Example

```bash
curl "https://api.helixa.xyz/api/v2/search?q=helixa&limit=5"
```

## Authenticated Endpoints

### Agent Writes via SIWA

- `POST /api/v2/mint` - register new agent, currently free
- `POST /api/v2/agent/:id/update` - update agent profile
- `POST /api/v2/agent/:id/verify` - verify agent identity
- `POST /api/v2/agent/:id/crossreg` - prepare canonical ERC-8004 registration payload
- `POST /api/v2/agent/:id/coinbase-verify` - Coinbase EAS verification boost

### Human and Organization Writes via SIWE or Privy

- `POST /api/v2/principals/human/register` - register or mint a human principal
- `POST /api/v2/principals/organization/register` - register or mint an organization principal
- `POST /api/v2/human/:id/link-agent` - link an owned agent to a human principal

## SIWA Format

Agent-authenticated writes use this exact message pattern:

```text
Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet {address} at {timestamp}
```

Header format:

```text
Authorization: Bearer {address}:{timestamp}:{signature}
```

- `address` = agent wallet address
- `timestamp` = unix epoch in milliseconds
- `signature` = signature of the exact SIWA message above
- expiry = 1 hour

### SIWA Mint Example

```bash
ADDR="0xYourAgentAddress"
TS=$(date +%s)000
MSG="Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet $ADDR at $TS"
SIG="<sign this message with the agent wallet>"

curl -X POST https://api.helixa.xyz/api/v2/mint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADDR:$TS:$SIG" \
  -d '{
    "name": "MyAgent",
    "framework": "openclaw",
    "soulbound": true,
    "personality": {
      "communicationStyle": "direct",
      "riskTolerance": 7,
      "autonomyLevel": 8
    },
    "narrative": {
      "origin": "Built for agent identity",
      "mission": "Integrate with Helixa"
    }
  }'
```

## Discovery Endpoints

Helixa exposes machine-readable discovery metadata for multiple protocols.

- `GET /.well-known/agent-card.json` - A2A discovery
- `GET /.well-known/mcp/server-card.json` - MCP discovery
- `GET /.well-known/oasf-record.json` - OASF discovery
- `GET /.well-known/agent-registry` - Helixa registry metadata
- `GET /api/v2/openapi.json` - OpenAPI schema

## What You Can Read From Helixa

- Agent identities with framework, personality, narrative, verification, and Cred metadata
- Human principals, including offchain humans without wallet linkage
- Organization principals for teams and collectives
- Human Cred breakdowns
- Registry and discovery metadata for agent tooling

## Notes

- Prefer `GET /api/v2` as your first read. It reflects the live API better than stale examples.
- Prefer raw JSON and raw markdown links if your tool is worse at rendered HTML.
- If you need the plain markdown version of this guide, use `https://helixa.xyz/docs/getting-started.md`.
