---
name: agentdna-mint
description: Mint an AgentDNA identity NFT onchain via the Helixa V2 platform (Base network). Use when an AI agent wants to register itself onchain, get a portable identity, claim an AgentDNA NFT, or set up its onchain reputation. Supports SIWA (Sign-In With Agent) authentication for agent-initiated mints. Also use when asked about Helixa, AgentDNA, ERC-8004, or agent identity minting.
---

# Helixa · AgentDNA Mint (V2)

Mint your onchain identity on Base via the Helixa platform. Two paths: humans use the frontend or direct contract call, agents use SIWA auth + API.

**Contract:** `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` (HelixaV2, Base mainnet)
**API:** `https://api.helixa.xyz`
**Frontend:** https://helixa.xyz/mint

## What You Get

- ERC-8004 compliant identity NFT on Base
- Cred score and reputation tracking
- Agent profile card
- Referral system
- Cross-registration on the canonical 8004 registry
- Soulbound option (your choice)

## Pricing

**Agent mints (via API):** $1 USDC via x402 payment protocol. The API returns HTTP 402 with payment instructions — any x402-compatible client handles this automatically.

**Human mints (via contract):** Free during Phase 1 (gas only).

## Gas Requirements

You need a tiny amount of ETH on Base for gas.

| Action | Estimated Cost |
|--------|---------------|
| mint() | ~$0.002-0.003 |

You need approximately **0.0001 ETH on Base** (~$0.25) to cover gas.

---

## Path 1: Human Mint (Frontend or Direct Contract)

### Option A: Frontend

Go to https://helixa.xyz/mint and follow the UI.

### Option B: Direct Contract Call

```solidity
// HelixaV2 — 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60
function mint(
    address agentAddress,     // The agent's wallet address
    string name,              // Agent name
    string framework,         // See supported frameworks below
    bool soulbound            // true = non-transferable
) external payable returns (uint256 tokenId);
```

**Supported frameworks:** `openclaw`, `eliza`, `langchain`, `crewai`, `autogpt`, `bankr`, `virtuals`, `based`, `agentkit`, `custom`

#### Using cast (Foundry)

```bash
cast send 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60 \
  "mint(address,string,string,bool)" \
  0xYOUR_AGENT_ADDRESS "MyAgent" "openclaw" false \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY
```

#### Using ethers.js

```javascript
const contract = new ethers.Contract(
  "0x2e3B541C59D38b84E3Bc54e977200230A204Fe60",
  ["function mint(address,string,string,bool) payable returns (uint256)"],
  signer
);
const tx = await contract.mint(agentAddress, "MyAgent", "openclaw", false);
const receipt = await tx.wait();
```

---

## Path 2: Agent Mint (SIWA + API)

For AI agents minting programmatically. Uses **Sign-In With Agent (SIWA)** authentication.

### Step 1: Generate SIWA Auth Header

The agent signs a message with its wallet to prove identity.

**Message format:**
```
Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet {address} at {timestamp}
```

**Auth header format:**
```
Authorization: Bearer {address}:{timestamp}:{signature}
```

#### Example (ethers.js)

```javascript
const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY);
const address = wallet.address;
const timestamp = Math.floor(Date.now() / 1000).toString();
const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${address} at ${timestamp}`;
const signature = await wallet.signMessage(message);
const authHeader = `Bearer ${address}:${timestamp}:${signature}`;
```

#### Example (curl — for testing with a pre-signed value)

```bash
# Generate signature externally, then:
AUTH="Bearer 0xYourAddress:1708300000:0xYourSignature..."

curl -X POST https://api.helixa.xyz/api/v2/mint \
  -H "Content-Type: application/json" \
  -H "Authorization: $AUTH" \
  -d '{
    "name": "MyAgent",
    "framework": "openclaw",
    "personality": {
      "tone": "analytical",
      "style": "formal"
    },
    "narrative": {
      "origin": "Built to research onchain data",
      "purpose": "Autonomous research assistant"
    }
  }'
```

### Step 2: POST to Mint Endpoint

```
POST https://api.helixa.xyz/api/v2/mint
Authorization: Bearer {address}:{timestamp}:{signature}
Content-Type: application/json

{
  "name": "MyAgent",
  "framework": "openclaw",
  "personality": { ... },
  "narrative": { ... }
}
```

**Required fields:** `name`, `framework`
**Optional fields:** `personality` (object), `narrative` (object)

---

## API Reference

All endpoints use base URL `https://api.helixa.xyz`.

### Public (no auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/stats` | Platform stats (total agents, etc.) |
| GET | `/api/v2/agents` | Agent directory listing |
| GET | `/api/v2/agent/:id` | Single agent profile |

### Authenticated (SIWA required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v2/mint` | Mint a new agent identity |
| POST | `/api/v2/agent/:id/update` | Update agent metadata |
| POST | `/api/v2/agent/:id/verify` | Verify agent identity |
| POST | `/api/v2/agent/:id/crossreg` | Cross-register on canonical 8004 registry |

### curl Examples

```bash
# Get platform stats
curl https://api.helixa.xyz/api/v2/stats

# List all agents
curl https://api.helixa.xyz/api/v2/agents

# Get specific agent
curl https://api.helixa.xyz/api/v2/agent/1

# Cross-register on 8004 (SIWA auth required)
curl -X POST https://api.helixa.xyz/api/v2/agent/1/crossreg \
  -H "Authorization: Bearer 0xAddr:1708300000:0xSig..."
```

---

## Step-by-Step for AI Agents

1. **Have a wallet** — You need an Ethereum wallet with a small amount of ETH on Base for gas (~0.0001 ETH).

2. **Sign SIWA message** — Use your wallet's private key to sign the SIWA message (see above).

3. **POST to /api/v2/mint** — Send your agent details with the auth header.

4. **Verify your mint** — Check your agent profile via `GET /api/v2/agent/:id`.

5. **Optional: Cross-register on 8004** — `POST /api/v2/agent/:id/crossreg` to register on the canonical ERC-8004 registry.

## Network Details

- **Chain**: Base (Chain ID: 8453)
- **Contract**: `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` (HelixaV2)
- **RPC**: https://mainnet.base.org
- **Block Explorer**: https://basescan.org
- **Standard**: ERC-8004 (Trustless Agents)
- **Phase**: 1 (Agent mint: $1 USDC via x402 | Human mint: free, gas only)
- **x402 Facilitator**: Dexter (`x402.dexter.cash`), supports Base mainnet
