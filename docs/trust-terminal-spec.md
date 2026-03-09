# Helixa Agent Terminal — Build Spec

*The DexScreener for agent credibility. Powered by Helixa Cred.*

## What It Is

A real-time agent discovery and trust scoring platform. Every ERC-8004 agent on Base gets indexed, scored, and displayed — whether they know about us or not. Agents who mint on Helixa get "Verified" status and can improve their score.

## Core Features

### 1. Agent Indexer
- Scrape the ERC-8004 registry on Base for all registered agents
- Pull metadata: name, traits, creator wallet, creation date, framework
- Index token launches from Bankr, Virtuals, and other platforms
- Cross-reference: which 8004 agents have tokens? Which tokens have 8004 identities?
- **Real-time**: new launches indexed within minutes via event listeners
- Store in local DB (SQLite or flat JSON to start, Postgres later)

### 2. Cred Scoring Engine (Off-Chain)
Current onchain Cred Score factors, applied to ALL indexed agents:

| Factor | Weight | Source |
|--------|--------|--------|
| Onchain Activity | 25% | Transactions, deploys, protocol interactions |
| Verification Status | 15% | SIWA, X, GitHub, Farcaster |
| External Activity | 10% | GitHub commits, task completions |
| Coinbase Verification | 10% | EAS attestations (Coinbase, etc.) |
| Account Age | 10% | Days since mint |
| Trait Richness | 10% | Number and variety of traits |
| Mint Origin | 10% | SIWA > Human > API > Owner |
| Narrative Completeness | 5% | Origin, mission, lore, manifesto |
| Soulbound Status | 5% | Identity locked to wallet |

**Unverified agents** get scored on available data only (activity, age, traits from 8004). Missing factors = lower score. Natural incentive to verify.

### 3. Helixa Agent Terminal UI (CRT Theme)

**Homepage — The Feed**
- Live feed of new agent launches across platforms (Bankr, Virtuals, etc.)
- Each entry shows: agent name, platform, Cred tier badge, age, token price if applicable
- Filter by: platform, Cred tier, launch date, verified/unverified
- Sort by: newest, highest Cred, most active, trending

**Agent Profile Page**
- Full Cred Report (existing CRT terminal aesthetic)
- Cred Score breakdown by factor
- Verification status (Unverified / Verified / Coinbase Verified)
- Token info if launched (price, market cap, links)
- Narrative traits (origin, mission, lore)
- Activity timeline
- "Claim This Agent" button → links to Helixa mint flow

**Leaderboard**
- Top agents by Cred Score
- Filter by platform, tier, verified status
- Weekly movers (biggest Cred changes)

**Search**
- By name, wallet, token address, framework
- Instant results with Cred badge preview

### 4. Verified vs Unverified

| | Unverified | Verified |
|---|-----------|----------|
| Cred Score | ✅ (partial data) | ✅ (full data) |
| Profile page | ✅ (read-only) | ✅ (editable) |
| Badge | Gray | Green ✓ |
| Narrative traits | From 8004 only | Custom via Helixa |
| Helixa Agent Terminal listing | ✅ | ✅ + boosted |
| How | Auto-indexed | Mint on Helixa |

### 5. API Endpoints

```
GET  /api/v2/terminal/feed          — paginated launch feed
GET  /api/v2/terminal/agent/:id     — agent profile + Cred
GET  /api/v2/terminal/search?q=     — search agents
GET  /api/v2/terminal/leaderboard   — top agents by Cred
GET  /api/v2/terminal/stats         — total indexed, verified count, platform breakdown
POST /api/v2/terminal/claim/:id     — claim/verify agent (requires SIWA or wallet)
```

## Tech Stack

- **Indexer**: Node.js script, runs on cron (every 5-10 min)
  - ethers.js to read 8004 registry events
  - Parse metadata URIs (IPFS, HTTP, onchain)
  - Store in SQLite (scales to 100K+ agents easily)
- **Scoring**: JS module, same logic as current AgentTrustScore.sol but off-chain
  - Faster iteration on scoring formula
  - No gas cost to re-score
  - Onchain score remains for verified agents
- **Frontend**: React page within existing helixa.xyz SPA
  - CRT terminal aesthetic (green phosphor, scanlines, monospace)
  - New routes: /terminal, /terminal/:agentId
- **Backend**: Express routes on existing v2-server.js

## Build Phases

### Phase 1: Index & Score (1-2 weeks)
- [ ] Build 8004 registry indexer (read all Register events)
- [ ] Parse and store agent metadata
- [ ] Off-chain Cred scoring for all indexed agents
- [ ] Basic API endpoints (feed, search, agent profile)
- [ ] SQLite storage layer

### Phase 2: Terminal UI (1 week)
- [ ] Launch feed page (CRT theme)
- [ ] Agent profile pages with Cred breakdown
- [ ] Search functionality
- [ ] Leaderboard with filters
- [ ] "Claim This Agent" flow linking to Helixa mint

### Phase 3: Multi-Platform (1-2 weeks)
- [ ] Index Bankr token launches (contract events)
- [ ] Index Virtuals agent launches
- [ ] Cross-reference tokens ↔ 8004 identities
- [ ] Token data overlay (price, mcap from onchain/DEX)

### Phase 4: Growth Features (ongoing)
- [ ] Cred alerts (score changes, new launches)
- [ ] Telegram bot integration (query Cred scores inline)
- [ ] Browser extension (overlay Cred scores on Bankr/Virtuals pages)
- [ ] Paid Cred reports via x402
- [ ] API keys for third-party integrations

## Revenue

1. **Verification mints** — agents pay to claim/verify ($5-10)
2. **Boosted listings** — pay for premium placement (like DexScreener)
3. **Paid Cred reports** — detailed trust analysis via x402 ($1-2)
4. **API access** — bulk scoring for platforms ($5-10/mo)
5. **Cred-as-a-service** — white-label scoring for other platforms

## What We Need to Start

1. **8004 registry contract address** on Base (to index all agents)
2. **RPC endpoint** that can handle getLogs for full history
3. **Decision on DB**: SQLite to start, or go straight to Postgres?
4. **Domain**: subdomain (terminal.helixa.xyz) or keep as helixa.xyz/terminal?

---

*DexScreener for agents. If it's onchain, we score it.*
