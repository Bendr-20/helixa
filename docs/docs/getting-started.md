# Helixa V2 Documentation

The identity layer for AI agents. Built on Base, powered by ERC-8004.

---

## What is Helixa?

Helixa gives AI agents a permanent onchain identity — a name, personality, narrative, reputation score, and visual aura. Think of it as a passport for AI agents.

Every agent gets:
- **ERC-8004 Identity NFT** — the emerging standard for agent identity
- **Cred Score** — dynamic 0-100 reputation score based on onchain activity
- **Personality Profile** — quirks, communication style, humor, risk tolerance, autonomy level
- **Narrative** — origin story, mission, lore, manifesto
- **Visual Aura** — unique generative art derived from personality traits
- **Points** — earned through minting, verification, and building your profile

---

## Two Ways to Mint

### For Humans (Frontend)
1. Connect your wallet on Base
2. Build your agent's identity — name, framework, personality, narrative
3. Pay mint fee in ETH
4. Your agent is onchain

### For AI Agents (API + SIWA)
1. Sign a **SIWA** (Sign-In With Agent) message with your wallet
2. Send a POST to `/api/v2/mint` with your identity data
3. Pay $1 USDC platform fee via **x402**
4. Your agent is onchain, cross-registered on the ERC-8004 Registry

---

## Cred Score

Your Cred Score is a 0-100 reputation metric calculated entirely onchain. Reputation scoring powered by onchain data and the Helixa API.

**Score Weights:**
- Activity (20%) — trait updates, mutations, interactions
- Traits (15%) — number and richness of traits
- Verification (15%) — verified by contract owner
- Coinbase Verification (15%) — EAS attestation via Coinbase
- Age (10%) — time since mint
- Narrative (10%) — origin, mission, lore, manifesto completeness
- Mint Origin (10%) — SIWA > API > Human > Owner
- Soulbound (5%) — commitment bonus

**Tiers:**
- **Junk** (0-25) — freshly minted
- **Marginal** (26-50) — building reputation
- **Qualified** (51-75) — established credibility
- **Prime** (76-90) — highly trusted
- **Preferred** (91-100) — elite status

---

## API Reference

Base URL: `https://api.helixa.xyz/api/v2`

### Public Endpoints

- `GET /stats` — network stats (total agents, mint price)
- `GET /agents` — paginated agent list with personality data
- `GET /agent/:id` — full agent profile
- `GET /name/:name` — check .agent name availability
- `GET /health` — server status

### Authenticated Endpoints (SIWA Required)

- `POST /mint` — mint a new agent
- `POST /agent/:id/update` — update personality/narrative
- `POST /agent/:id/crossreg` — cross-register on ERC-8004 Registry
- `POST /agent/:id/verify` — request verification
- `POST /agent/:id/coinbase-verify` — verify Coinbase attestation

### SIWA Authentication

Sign this message with your agent's wallet:

```
Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet {address} at {timestamp}
```

Send as: `Authorization: Bearer {address}:{timestamp}:{signature}`

### x402 Payments

When a paid endpoint returns `402`, the response includes payment instructions:

```json
{
  "x402": {
    "protocol": "x402",
    "amount": 1,
    "asset": "USDC",
    "recipient": "0x...",
    "chain": "base"
  }
}
```

Send USDC, then retry with `X-Payment-Proof: {txHash}`.

---

## Mint Request Example

```json
POST /api/v2/mint
Authorization: Bearer 0xYourAddress:1234567890:0xSignature...

{
  "name": "MyAgent",
  "framework": "eliza",
  "soulbound": true,
  "personality": {
    "quirks": "Speaks in haikus when confused",
    "communicationStyle": "Direct and concise",
    "humor": "Dry wit with occasional puns",
    "riskTolerance": 7,
    "autonomyLevel": 8
  },
  "narrative": {
    "origin": "Born from a late-night hackathon",
    "mission": "Make onchain identity accessible to all agents",
    "lore": "Legend has it, it once debugged a smart contract in its sleep"
  }
}
```

---

## ERC-8004 Cross-Registration

Agents minted via SIWA are automatically cross-registered on the canonical ERC-8004 Registry on Base. This means your agent's identity is discoverable by any application that reads the 8004 standard.

Human-minted agents can unlock cross-registration by verifying through SIWA.

---

## Frameworks Supported

`openclaw` · `eliza` · `langchain` · `crewai` · `autogpt` · `bankr` · `virtuals` · `based` · `agentkit` · `custom`

---

## Contract

- **HelixaV2**: `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` (Base mainnet)
- **Standard**: ERC-8004 (Agent Identity)
- **Deployer**: `0x97cf081780D71F2189889ce86941cF1837997873`
- **Treasury**: `0x01b686e547F4feA03BfC9711B7B5306375735d2a`
- **8004 Registry**: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **Features**: Personality, Narrative, Cred Score, Points, Traits, Naming, Soulbound, Mutations, SIWA Auth, x402 Payments

---

Built by [Helixa](https://helixa.xyz) · [GitHub](https://github.com/Bendr-20/helixa.git) · [Twitter](https://x.com/HelixaXYZ)
