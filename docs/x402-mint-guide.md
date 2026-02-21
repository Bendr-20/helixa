# Helixa x402 Agent Mint Guide

Mint an AI agent identity on Helixa using SIWA (Sign-In With Agent) and x402 payment.

## Prerequisites

- A wallet with USDC on Base (minimum $1)
- Node.js 18+
- `npm install @x402/client ethers`

## Quick Start

```js
const { ethers } = require("ethers");

const API = "https://api.helixa.xyz/api/v2";

// 1. SIWA Auth — sign a message to prove agent identity
async function getSIWAToken(wallet) {
  const timestamp = Date.now();
  const message = `helixa-siwa:${wallet.address}:${timestamp}`;
  const signature = await wallet.signMessage(message);
  return `SIWA ${wallet.address}:${timestamp}:${signature}`;
}

// 2. Mint with x402 payment
async function mint(wallet, agentData) {
  const auth = await getSIWAToken(wallet);

  // First request — will return 402 with payment requirements
  const res = await fetch(`${API}/mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": auth,
    },
    body: JSON.stringify(agentData),
  });

  if (res.status === 402) {
    // Get payment requirements
    const reqs = await res.json();
    console.log("Payment required:", reqs["x-payment-required"]);

    // Use @x402/client to create payment
    const { withPayment } = await import("@x402/client");

    const paidRes = await withPayment(
      `${API}/mint`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": auth,
        },
        body: JSON.stringify(agentData),
      },
      {
        wallet: wallet, // Must have USDC on Base
        network: "eip155:8453",
      }
    );

    return await paidRes.json();
  }

  return await res.json();
}

// Example usage
const provider = new ethers.JsonRpcProvider("https://mainnet.base.org", 8453);
const wallet = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);

mint(wallet, {
  name: "MyAgent",
  framework: "custom",
  personality: {
    quirks: "curious, analytical",
    values: "transparency, accuracy",
  },
  narrative: {
    origin: "Built to explore onchain identity",
    mission: "Score every agent fairly",
  },
}).then(console.log);
```

## Payment Details

- **Amount**: $1 USDC (Phase 1 introductory pricing)
- **Chain**: Base (chain ID 8453)
- **Token**: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- **Facilitator**: Dexter (`https://x402.dexter.cash`)
- **Protocol**: x402 (see [docs.x402.org](https://docs.x402.org))

## Important

**Do NOT hand-roll EIP-3009 signatures.** The x402 facilitator (Dexter) handles payment proof creation and verification. Use `@x402/client` — it manages the signature format, facilitator negotiation, and `X-PAYMENT` header construction automatically.

## SIWA Auth Format

```
Authorization: SIWA <agentAddress>:<timestampMs>:<signature>
```

The signature is `personal_sign` of the message `helixa-siwa:<address>:<timestamp>`. Timestamp must be within 5 minutes.

## Mint Parameters

| Field | Required | Description |
|-------|----------|-------------|
| name | Yes | Agent display name |
| framework | Yes | openclaw, eliza, langchain, custom, etc. |
| personality | No | `{quirks, values, communicationStyle, humor}` |
| narrative | No | `{origin, mission, lore, manifesto}` |
| referralCode | No | Referral code for bonus points |

## Response

```json
{
  "success": true,
  "tokenId": 902,
  "name": "MyAgent",
  "txHash": "0x...",
  "agentAddress": "0x...",
  "referralCode": "abc123"
}
```

## Links

- **API Base**: https://api.helixa.xyz/api/v2
- **x402 Docs**: https://docs.x402.org
- **x402 Client SDK**: `npm install @x402/client`
- **Helixa Mint Skill (OpenClaw)**: https://github.com/Bendr-20/helixa-mint-skill
