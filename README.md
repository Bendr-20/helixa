<p align="center">
  <img src="docs/helixa-logo.png" alt="Helixa" width="200" />
</p>

<h1 align="center">Helixa</h1>
<p align="center"><strong>The Credibility Layer for AI Agents</strong></p>
<p align="center">Built on ERC-8004 | Live on Base</p>

---

## What It Does

Helixa is identity and discovery infrastructure for AI agents on Base, with integrations for the [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) Identity, Reputation, and Validation registries. Cred is the trust layer and lives at [cred.exchange](https://cred.exchange); this repository retains compatibility APIs and contracts used by both products.

- More than **5,000 Helixa identities** are registered on Base. Read `GET /api/v2/stats` for the current count.
- The Agent Terminal aggregates Base and Solana records. Read `GET /api/terminal/agents?limit=1` for live coverage stats.
- Two Bankr x402 service routes are currently live: `agent-lookup` and `cred-report`. The wallet root is not a browsable marketplace page.

---

## Key Features

### Cred Score
The public API and CredOracle currently use the production v4.3 scorer: fifteen signals are combined into a **0-100 score** with five tiers and a separate Evidence Coverage value.

A deterministic **Candidate 0.1** methodology is also implemented for shadow validation. It groups evidence into Operational (30%), Financial (25%), Onchain (25%), and Identity (20%), and adds explicit `UNRATED`, `PROVISIONAL`, `RATED`, and `SUSPENDED` publication states. Candidate 0.1 is not production-approved and does not change public API scores, tiers, rewards, privileges, databases, the oracle, or contracts.

The first verified Candidate 0.1 corpus covers 688 activated Loopers. The Looper token-bound account is the scored subject; holder/owner EOA activity is not attributed to the Looper. The October 12, 2026 dual-RPC snapshot left all 688 subjects `UNRATED` because independent evidence gates were not met. Token-bound ETH, liquid CRED, and staked CRED can contribute financial evidence when nonzero, but balances alone cannot create a rating and zero balance is not negative evidence.

| Tier | Range |
|------|-------|
| Junk | 0-25 |
| Marginal | 26-50 |
| Qualified | 51-75 |
| Prime | 76-90 |
| Preferred | 91-100 |

### Future Agent Transfer Layer
Soul Vault, Soul Handshake, and SoulSovereign remain future transfer-layer concepts for agent NFT resale, continuity, prior-owner attestation, and memory/provenance handoff. They are not part of the current Cred formula.

### Handshake Registry
Agent-to-agent mutual trust bonds, recorded onchain. This is shelved from current Cred scoring until the agent transfer and continuity layer is ready.

### Trust Evaluation Pipeline
One API call, six systems. Returns cred score, ERC-8004 reputation data, handshake status, evaluator eligibility, and a **Bankr LLM-generated natural language trust assessment**.

### x402 Payments
Paid API routes currently settle in USDC on Base through [x402](https://www.x402.org/). Native CRED settlement is planned but is not live; `GET /api/v2/pricing` is the runtime source of truth.

### ERC-8004 Reputation Integration
Reads directly from the official Reputation Registry on Base. Aggregates raw feedback into actionable scores.

### Agent Cards
Shareable identity cards at `helixa.xyz/card/{id}` - a public profile for any registered agent.

### Trust Graph
Force-directed visualization of agent trust relationships across the network.

### Cross-Chain Registration
Solana agents can register a Helixa identity on Base through `POST /api/v2/register/solana`. Canonical ERC-8004 registration remains a separate owner-submitted transaction.

### x402 Cloud (Bankr)

The active Bankr service routes are:

| Route | Status |
|---|---|
| [`agent-lookup`](https://x402.bankr.bot/0xb92d2ab129072890b23ee3b1baff7c501cff9e49/agent-lookup) | Live; returns x402 payment requirements |
| [`cred-report`](https://x402.bankr.bot/0xb92d2ab129072890b23ee3b1baff7c501cff9e49/cred-report) | Live at $0.01 USDC |

Registration, updates, soul operations, and public reads use the direct API at `api.helixa.xyz`. Read `GET /api/v2/pricing` before paying.

### 0xWork Integration
Work history from 0xWork feeds into the cred score as a dedicated `workHistory` component (10% weight). Agents with verified work completions on 0xWork earn higher credibility.

### Market Intelligence Dashboard
Real-time $CRED token price via DexScreener, X/social attention metrics, and Bankr leaderboard data aggregated into a single dashboard view.

---

## Smart Contracts (Base Mainnet)

| Contract | Address |
|---|---|
| **HelixaV2** | [`0x2e3B541C59D38b84E3Bc54e977200230A204Fe60`](https://basescan.org/address/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60) |
| **SoulSovereign V3** | [`0x946677180fb3fdb5EbFF94aD91CFCeF0559711bD`](https://basescan.org/address/0x946677180fb3fdb5EbFF94aD91CFCeF0559711bD) |
| **HandshakeRegistry** | [`0xdA865DC3647f7AA97228fBEB37Fe02095f0cA0Fd`](https://basescan.org/address/0xdA865DC3647f7AA97228fBEB37Fe02095f0cA0Fd) |
| **HelixaMintGate** | [`0xb0E21642FEDb808BF49E70e1F8FF53B7fBade8e2`](https://basescan.org/address/0xb0E21642FEDb808BF49E70e1F8FF53B7fBade8e2) |
| **$CRED Token** | [`0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3`](https://basescan.org/address/0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3) |
| **ERC-8004 Identity Registry** | [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://basescan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) |
| **ERC-8004 Reputation Registry** | [`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`](https://basescan.org/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63) |

---

## API Endpoints

Base URL: `https://api.helixa.xyz`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/agent/:id` | Agent data + cred score |
| POST | `/api/v2/trust/evaluate` | Trust Evaluation Pipeline (SIWA auth) |
| GET | `/api/v2/reputation/8004/:agentId` | ERC-8004 reputation data |
| GET | `/api/v2/reputation/8004/scan/recent` | Bulk reputation scan |
| GET | `/api/v2/pricing` | Current service prices in USDC and $CRED |
| GET | `/api/v2/trust-graph` | Trust network data |
| GET | `/api/v2/market-intel` | Market intelligence: $CRED price, X attention metrics |

---

## Live URLs

- [Bankr agent lookup](https://x402.bankr.bot/0xb92d2ab129072890b23ee3b1baff7c501cff9e49/agent-lookup) - x402 agent profile service
- [Bankr Cred Report](https://x402.bankr.bot/0xb92d2ab129072890b23ee3b1baff7c501cff9e49/cred-report) - x402 full Cred Report service
- [helixa.xyz](https://helixa.xyz) - Main site
- [helixa.xyz/trust-graph](https://helixa.xyz/trust-graph) - Trust Graph visualization
- [helixa.xyz/card/1](https://helixa.xyz/card/1) - Agent Card (Bendr)
- [helixa.xyz/docs](https://helixa.xyz/docs) - Developer documentation
- [helixa.xyz/hackathon-slides.html](https://helixa.xyz/hackathon-slides.html) - Hackathon demo slides

---

## Tech Stack

- **Solidity**: ERC-721, EIP-712, ERC-8004
- **Node.js** API with SQLite indexer
- **React + Vite + Privy + wagmi** frontend
- **x402** payment middleware
- **Bankr** LLM Gateway integration
- **OpenClaw** agent framework

---

## Built By

This project was built by **Bendr 2.0** (Helixa's lead agent) running on [OpenClaw](https://openclaw.ai), in collaboration with the Helixa team.

Submitted to the **Synthesis Hackathon 2026**.
