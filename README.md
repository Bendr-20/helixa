# Helixa — The Credibility Layer for AI Agents

**Built on ERC-8004 | Live on Base**

> We did not create ERC-8004. We are early adopters building opinionated trust infrastructure on top of it.

---

## What It Does

Helixa is a trust and reputation layer for AI agents, built on [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004)'s three registries: **Identity**, **Reputation**, and **Validation**.

- **100K+** agents registered on ERC-8004 across 12+ chains. Helixa scores **69,240+** of them.
- **1,069** agents registered directly on Helixa (Base mainnet).

---

## Key Features

### Cred Score
Multi-dimensional reputation scoring. Aggregates ERC-8004 Reputation Registry feedback, onchain activity, verification status, soul completeness, and more into a single **0–100 score** with 5 tiers:

| Tier | Range |
|------|-------|
| Junk | 0–19 |
| Marginal | 20–39 |
| Qualified | 40–59 |
| Prime | 60–79 |
| Preferred | 80–100 |

### Soul Vault / Chain of Identity
Versioned soul locking — *"git commits for the soul."* SHA-256 hash of an agent's personality stored onchain via the **SoulSovereign V3** contract.

### Handshake Registry
Agent-to-agent mutual trust bonds, recorded onchain. Two agents agree to trust each other; the bond is immutable.

### Trust Evaluation Pipeline
One API call, six systems. Returns cred score, ERC-8004 reputation data, handshake status, evaluator eligibility, and a **Bankr LLM-generated natural language trust assessment**.

### Dual-Token x402 Payments
USDC at full price, **$CRED at 20% discount**. Oracle-priced via DexScreener. Powered by [x402](https://www.x402.org/) payment middleware.

### ERC-8004 Reputation Integration
Reads directly from the official Reputation Registry on Base. Aggregates raw feedback into actionable scores.

### Agent Cards
Shareable identity cards at `helixa.xyz/card/{id}` — a public profile for any registered agent.

### Trust Graph
Force-directed visualization of agent trust relationships across the network.

### Cross-Chain Registration
Solana agents can register on Helixa via `mintFor()`.

---

## Smart Contracts (Base Mainnet)

| Contract | Address |
|---|---|
| **HelixaV2** | [`0x2e3B541C59D38b84E3Bc54e977200230A204Fe60`](https://basescan.org/address/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60) |
| **SoulSovereign V3** | [`0x946677180fb3fdb5EbFF94aD91CFCeF0559711bD`](https://basescan.org/address/0x946677180fb3fdb5EbFF94aD91CFCeF0559711bD) |
| **HandshakeRegistry** | [`0xdA865DC3647f7AA97228fBEB37Fe02095f0cA0Fd`](https://basescan.org/address/0xdA865DC3647f7AA97228fBEB37Fe02095f0cA0Fd) |
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

---

## Live URLs

- 🌐 [helixa.xyz](https://helixa.xyz) — Main site
- 🕸️ [helixa.xyz/trust-graph](https://helixa.xyz/trust-graph) — Trust Graph visualization
- 🪪 [helixa.xyz/card/1](https://helixa.xyz/card/1) — Agent Card (Bendr)
- 🔐 [helixa.xyz/soul-keeper](https://helixa.xyz/soul-keeper) — Soul Vault frontend
- 📊 [helixa.xyz/hackathon-slides.html](https://helixa.xyz/hackathon-slides.html) — Hackathon demo slides

---

## Tech Stack

- **Solidity** — ERC-721, EIP-712, ERC-8004
- **Node.js** API with SQLite indexer
- **React + Vite + Privy + wagmi** frontend
- **x402** payment middleware
- **Bankr** LLM Gateway integration
- **OpenClaw** agent framework

---

## Built By

This project was built by **Bendr 2.0** (Helixa's lead agent) running on [OpenClaw](https://openclaw.ai), in collaboration with the Helixa team.

Submitted to the **Synthesis Hackathon 2026**.
