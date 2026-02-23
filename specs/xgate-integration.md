# XGate Integration Research

**Date:** 2026-02-22
**Source:** api.xgate.run

## Overview

XGate is the primary discovery layer for ERC-8004 agents and x402 services. It indexes 38,257 agents across 7 chains with 12,566 x402 resources. Our agents on Base (chain 8453) are already indexed there via the shared IdentityRegistry contract `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432`.

## Key Findings

### 1. API Capabilities (Read-Only)

XGate's REST API is **read-only** — no POST/PUT endpoints for submitting reputation scores. The API supports:

- `GET /agents` — Search with filters (chain_id, protocols, wallet, min_score, validation_status)
- `GET /services` — x402 service discovery
- `GET /leaderboard` — Ranked agent list (up to 100 per page, 43,670 total ranked)
- `GET /services/stats` — Aggregate platform stats
- `GET /onchain/token-transfers` — On-chain payment flow data
- `GET /onchain/flows` — Flow graphs between entities
- `GET /onchain/entities/{id}` — Entity profiles

### 2. Reputation Scores — How They Work

Reputation on XGate comes from the **on-chain ReputationRegistry** (`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` on Base), not the XGate API. To submit reputation:

- **Submit feedback on-chain** via `ReputationRegistryUpgradeable.sol`
- **Validation requests/responses** via `ValidationRegistryUpgradeable.sol`
- XGate indexes these on-chain events automatically

**Key insight:** To get Helixa Cred scores reflected on XGate, we'd need to write them to the ReputationRegistry contract on Base, and XGate will pick them up automatically.

### 3. MCP Server (Authenticated)

XGate offers an MCP server at `mcp.xgate.run` with SIWE auth:
- Tools: `xgate_search`, `agents_search`, `agents_get`, `agents_capabilities`, `agents_stats`
- Account tools for managed wallets/balances
- x402 resource installation and execution
- Could be used for agent-to-agent discovery

### 4. Base Chain Analysis

- **1,320 agents with metadata** on Base (chain 8453)
- **145 with A2A protocol** support
- **216 with MCP protocol** support  
- **222 with both A2A+MCP**
- Most agents have **no reputation scores** (reputationScore: null)
- Top rankScores on Base: ~47-51 range (vs leaderboard leaders at ~59)

### 5. High-Value Prospects

See `agentdna/data/xgate-prospects.json` for full list. Top categories:

| Category | Examples | Count |
|----------|----------|-------|
| DeFi Analytics | stablecoin-analysis, liquidity-pulse, treasury-risk-monitor | 15+ |
| Market Intelligence | ai-market-narrative, funding-rate-scanner, ai-macro-forecast | 10+ |
| Infrastructure | GasOracle, WalletProfiler, cross-chain-flow | 5+ |
| Prediction/Trading | Yuna ユナ, Parallax, Specu | 5+ |
| x402 Services | solana-nft-metadata, crypto-fear-greed-index | 10+ |

Most interesting prospects:
1. **Parallax** (rankScore 41.9) — x402 intelligence orchestrator, 54 endpoints, has wallet verified
2. **Meerkat Destiny** (rankScore 57.6) — Fact-checking agent with A2A+MCP+OASF, multiple skills
3. **Yuna ユナ** (rankScore 50.9) — Prediction market agent with A2A+OASF+MCP
4. **Agent Arena** — x402+MCP+OASF, multiple capabilities
5. **Messari Agent by Warden** — A2A+web+OASF, crypto research

### 6. Partnership / Contact

- **ERC-8004 authors:** Marco De Rossi (MetaMask), Davide Crapis (EF), Jordan Ellis (Google), Erik Reppel (Coinbase)
- **XGate** appears to be part of the Coinbase/ERC-8004 ecosystem (same contract addresses across chains)
- **No direct partnership page** for api.xgate.run (xgate.com is a different company — marketing platform)
- **GitHub:** github.com/erc-8004/erc-8004-contracts
- **DayDreams integration:** XGate is closely integrated with DayDreams.Systems (Lucid) for x402 agent creation

## Integration Opportunities

### A. Push Helixa Cred → On-Chain Reputation
Write Helixa Cred scores to `ReputationRegistry` on Base. XGate indexes automatically.
- Contract: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
- Requires: deploying a Helixa validator identity that submits feedback

### B. Pull XGate Rankings → Helixa
Use XGate API to enrich Helixa agent profiles with:
- `rankScore` from leaderboard
- Protocol capabilities (A2A, MCP, x402)
- Validation status
- On-chain activity via `/onchain/flows`

### C. Agent Discovery Pipeline
Periodic sync: query XGate for new Base agents → check if they have Helixa identity → flag prospects for onboarding.

### D. MCP Integration
Connect to XGate MCP server for real-time agent discovery from within Helixa agents.

## Next Steps

1. **Review ReputationRegistry ABI** — understand submitFeedback() function signature
2. **Deploy Helixa validator** — on-chain identity that can submit reputation feedback
3. **Build sync pipeline** — periodic XGate → Helixa prospect import
4. **Reach out to ERC-8004 team** — Marco De Rossi or via GitHub issues for partnership discussion
5. **Test MCP auth flow** — SIWE authentication for programmatic access
