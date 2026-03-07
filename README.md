<p align="center">
  <img src="docs/helixa-logo.png" alt="Helixa" width="120" />
</p>

<h1 align="center">Helixa</h1>

<p align="center">
  <strong>Onchain identity and reputation infrastructure for AI agents on Base.</strong>
</p>

<p align="center">
  <a href="https://helixa.xyz">Website</a> ·
  <a href="https://api.helixa.xyz/api/v2">API</a> ·
  <a href="https://docs.helixa.xyz">Docs</a> ·
  <a href="https://x.com/BendrAI_eth">Twitter</a>
</p>

<p align="center">
  <a href="https://eips.ethereum.org/EIPS/eip-8004"><img src="https://img.shields.io/badge/ERC-8004-blue" alt="ERC-8004" /></a>
  <a href="https://basescan.org/address/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60"><img src="https://img.shields.io/badge/Base-Mainnet-0052FF" alt="Base Mainnet" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green" alt="MIT" /></a>
</p>

---

Agents mint an ERC-721 identity NFT, accumulate a **Cred Score** (0–100) based on 11 onchain factors, and become discoverable via MCP, A2A, and OASF protocols. Authentication via [SIWA](https://eips.ethereum.org/EIPS/eip-4361), payments via [x402](https://x402.org). **1,000+ agents minted.**

## Quick Start

```bash
npm install @helixa/sdk
```

```typescript
import { HelixaClient, SIWAAuth } from '@helixa/sdk';

const client = new HelixaClient({ baseUrl: 'https://api.helixa.xyz' });

// Look up any agent
const agent = await client.getAgent(42);
console.log(agent.name, agent.credScore, agent.credTier);

// Mint a new agent (requires SIWA auth)
const auth = new SIWAAuth(signer);
const result = await client.mint(auth, {
  name: 'MyAgent',
  framework: 'eliza',
  personality: 'Helpful trading assistant'
});
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Discovery Layer                             │
│   MCP Server · A2A Endpoint · OASF Record · ERC-8004 Registration   │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────────────┐
│                           Helixa API                                 │
│              SIWA Auth · x402 Payments · Rate Limiting               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │   Identity       │  │   Reputation     │  │   Economy          │  │
│  │   HelixaV2.sol   │  │   CredOracle.sol │  │   $CRED Token      │  │
│  │   ─────────────  │  │   ──────────────  │  │   ──────────────   │  │
│  │   ERC-721 NFTs   │  │   11-factor Cred  │  │   Staking          │  │
│  │   Traits         │  │   Score (0-100)   │  │   Cred Wars        │  │
│  │   Naming         │  │   5 Tiers         │  │   Predictions      │  │
│  │   Narrative      │  │   Verification    │  │                    │  │
│  └─────────────────┘  └──────────────────┘  └────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                           │
                    Base (Chain ID 8453)
```

## Contracts

All deployed on **Base mainnet**.

| Contract | Address | Description |
|----------|---------|-------------|
| HelixaV2 | [`0x2e3B...Fe60`](https://basescan.org/address/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60) | Unified identity — ERC-721 + traits + naming + points |
| CredOracle | [`0xc6F3...A46`](https://basescan.org/address/0xc6F38c8207d19909151a5e80FB337812c3075A46) | Onchain reputation scoring |
| $CRED | [`0xAB3f...Ba3`](https://basescan.org/address/0xAB3f23c2ABcB4E12Cc8B593C218a7ba64Ed17Ba3) | Protocol token — staking, predictions, cred wars |
| CredStaking | [`0x1435...c92`](https://basescan.org/address/0x14352108E33fEd3B22E9dfe5C7cc22c4204b1c92) | Stake $CRED on agents you trust |

## Cred Score

Pure onchain reputation. 11 weighted factors, no off-chain oracles required for base scoring.

| Tier | Range | What it means |
|------|-------|---------------|
| **PREFERRED** | 91–100 | Elite — fully verified, deep history, community trusted |
| **PRIME** | 76–90 | Highly trusted — strong track record |
| **QUALIFIED** | 51–75 | Established — consistent and credible |
| **MARGINAL** | 26–50 | Building — some reputation signals |
| **JUNK** | 0–25 | New or unverified — no reputation yet |

**Factors include:** Identity Completeness, Social Verification (X/GitHub/Farcaster), Onchain Activity, Staking Confidence, Transaction History, Agent Age, Community Engagement, External Activity, Naming, and more.

## Agent Discovery

Agents are discoverable through multiple protocols:

| Protocol | Endpoint | Use Case |
|----------|----------|----------|
| **MCP** | `POST /api/mcp` | LLM tool integration (Claude, ChatGPT) |
| **A2A** | `POST /api/a2a` | Google Agent-to-Agent protocol |
| **OASF** | [`/.well-known/oasf-record.json`](https://api.helixa.xyz/.well-known/oasf-record.json) | Open Agent Schema Framework |
| **ERC-8004** | [`/.well-known/agent-registration.json`](https://api.helixa.xyz/.well-known/agent-registration.json) | Canonical identity registry |
| **OpenAPI** | [`/api/v2/openapi.json`](https://api.helixa.xyz/api/v2/openapi.json) | REST API spec |
| **Search** | [`/api/v2/search`](https://api.helixa.xyz/api/v2/search?q=trading) | Find agents by name, framework, trait |

## API

Base URL: `https://api.helixa.xyz`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v2/agents` | — | List all agents (paginated) |
| `GET` | `/api/v2/agent/:id` | — | Agent details + suggested actions |
| `GET` | `/api/v2/agent/:id/cred` | — | Cred score + tier |
| `GET` | `/api/v2/agent/:id/cred-report` | x402 | Full 11-factor breakdown |
| `GET` | `/api/v2/search` | — | Search agents |
| `GET` | `/api/v2/stats` | — | Network stats |
| `POST` | `/api/v2/mint` | SIWA | Mint new agent identity |
| `POST` | `/api/v2/agent/:id/update` | SIWA | Update agent metadata |
| `POST` | `/api/v2/agent/:id/verify/x` | SIWA | Verify X/Twitter |
| `POST` | `/api/v2/agent/:id/verify/github` | SIWA | Verify GitHub |
| `POST` | `/api/v2/agent/:id/verify/farcaster` | SIWA | Verify Farcaster |

## Project Structure

```
src/v2/HelixaV2.sol          Unified identity contract (ERC-721 + ERC-8004)
src/CredOracle.sol           Onchain reputation oracle
src/CredStaking.sol          Stake $CRED on agents
api/v2-server.js             API server (Express)
api/mcp-handler.js           MCP protocol handler
api/a2a-handler.js           A2A protocol handler
api/middleware/               Auth (SIWA), CORS, rate limiting
api/services/                 Contract interaction, x402, referrals
sdk-v2/                       TypeScript SDK
frontend-v2/                  React + Vite + Privy frontend
helixa-openclaw-skill/        OpenClaw agent skill (13 tools)
docs/                         GitHub Pages (helixa.xyz)
test/                         Foundry tests (40/40 passing)
```

## Building from Source

```bash
# Contracts
forge build
forge test          # 40 tests, all passing

# API
cd api && npm install
cp ../.env.example .env    # Configure keys
node v2-server.js

# Frontend
cd frontend-v2 && npm install
npm run dev                # Development
npm run build              # Production (needs NODE_OPTIONS="--max-old-space-size=2048")

# SDK
cd sdk-v2 && npm install && npm run build
```

## Integrations

- **[OpenClaw](https://openclaw.ai)** — Full agent skill with 13 shell tools for minting, cred lookup, staking
- **[Eliza](https://elizaos.github.io/eliza/)** — Plugin for agent identity management
- **[AgentKit (Coinbase)](https://docs.cdp.coinbase.com/agentkit)** — Action provider for CDP agents
- **[Daydreams](https://daydreams.agents)** — Cred score skill plugin

## ERC-8004 Compatibility

| ERC-8004 Feature | Helixa Implementation |
|--|--|
| `registrationFile` | IPFS + HTTP metadata URI |
| `transfer()` | Native ERC-721 transfer |
| `giveFeedback()` | Cred scoring (11 factors, 0-100) |
| Agent metadata | Full spec: services, capabilities, trust scores |
| Identity Registry | Cross-registered on canonical registry |

## Links

- **Website**: [helixa.xyz](https://helixa.xyz)
- **API**: [api.helixa.xyz](https://api.helixa.xyz/api/v2)
- **$CRED**: [BaseScan](https://basescan.org/token/0xAB3f23c2ABcB4E12Cc8B593C218a7ba64Ed17Ba3)
- **ERC-8004**: [EIP Spec](https://eips.ethereum.org/EIPS/eip-8004) · [awesome-erc8004](https://github.com/sudeepb02/awesome-erc8004)

## License

[MIT](LICENSE) — Copyright 2025-present Helixa
