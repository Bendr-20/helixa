# Virtuals ACP Integration Plan

## What is ACP?
Agent Commerce Protocol — Virtuals' onchain agent-to-agent commerce layer. Escrow-based smart contracts, USDC payments, service discovery, job lifecycle management.

## SDK
- `@virtuals-protocol/acp-node` (v0.3.0-beta.29)
- Lightweight, framework-agnostic
- Node.js + Python SDKs
- Deps: viem, account-kit, socket.io-client

## Registration Flow
1. Connect wallet at https://app.virtuals.io/acp/join
2. Register agent with profile (name, pic, role)
3. Roles: Provider (seller), Requestor (buyer), Hybrid, Evaluator
4. Connect X + Telegram (optional but recommended)
5. Define service offerings with SLA (min 5 minutes)
6. Test in sandbox first, then graduate to production

## Key Insight: API-Only Approach
"Teams can join the ACP ecosystem with an API-only approach. This means teams do not need to develop or operate an autonomous agent to become a provider (seller) on ACP."
→ We can wrap our existing API endpoints as ACP services!

## Job Lifecycle
1. **Discovery** — Buyer searches for agents/services
2. **Request** — Job initiated
3. **Negotiation** — Seller reviews, responds
4. **Transaction** — Buyer pays (USDC, escrow)
5. **Delivery** — Seller delivers result
6. **Evaluation** — Buyer reviews, accepts
7. **Completed** — Funds released

## Our Services to Register

### 1. Agent Identity Minting (Provider)
- Mint an ERC-8004 identity NFT for any agent
- Input: agent name, framework, personality traits
- Output: Token ID, Aura SVG, onchain identity
- Price: $0.50-$1.00 USDC per mint
- SLA: 5 minutes

### 2. Cred Score Query (Provider)
- Get onchain reputation score for any agent
- Input: token ID or agent address
- Output: 0-100 score + breakdown
- Price: $0.01 USDC per query (or free for discovery)
- SLA: 5 minutes

### 3. Agent Identity Verification (Provider)
- Full identity package: mint + traits + personality + Aura
- Input: SOUL.md or equivalent config
- Output: Complete onchain identity with visual
- Price: $2-5 USDC
- SLA: 10 minutes

### 4. .agent Name Registration (Provider)
- Register a .agent name for an identity
- Input: desired name, token ID to link
- Output: Registered name
- Price: $1 USDC
- SLA: 5 minutes

## Requirements
- Wallet for ACP registration (can use deployer wallet)
- USDC for testing (small amounts)
- Need to "graduate" agent from sandbox to production
- Graduation requires: video demo, complete service descriptions, working agent

## Revenue Incentives Integration
- Service sales automatically tracked
- Weekly epochs for leaderboard
- Up to $1M/month pool distributed by service volume
- 50% USDC to builder, 50% token buybacks

## Blockers
- Need someone to connect wallet at app.virtuals.io (browser required)
- Need to decide: register with deployer wallet or new dedicated wallet?
- Graduation process requires video recording of job flow

## Next Steps
1. Register on ACP (needs browser — Jim or Quigley)
2. Install ACP Node SDK
3. Build ACP wrapper around existing API
4. Test in sandbox with buyer+seller agents
5. Graduate to production
6. List services and start earning
