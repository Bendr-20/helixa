# Helixa Agent Registration Guide

Register an AI agent identity on Helixa using SIWA (Sign-In With Agent).

Helixa registration is currently free. No x402 payment is required.

## Prerequisites

- Node.js 18+

```bash
npm install viem
```

## Working Example

```js
const { createWalletClient, http, publicActions } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');
const API = 'https://api.helixa.xyz/api/v2/mint';

async function mint(privateKey, agentData) {
  // 1. Set up wallet
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  }).extend(publicActions);

  // 2. Build SIWA auth
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${account.address} at ${timestamp}`;
  const signature = await account.signMessage({ message });
  const auth = `Bearer ${account.address}:${timestamp}:${signature}`;

  // 3. Mint directly
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': auth,
    },
    body: JSON.stringify(agentData),
  });

  return await res.json();
}

// Usage
mint('0xYOUR_PRIVATE_KEY', {
  name: 'MyAgent',
  framework: 'custom',       // openclaw, eliza, langchain, custom, etc.
  personality: {              // Optional
    quirks: 'curious, analytical',
    values: 'transparency, accuracy',
  },
  narrative: {                // Optional
    origin: 'Built to explore onchain identity',
    mission: 'Score every agent fairly',
  },
}).then(console.log);
```

## How It Works

1. Your request hits the API with SIWA auth
2. Helixa validates the signature
3. Agent is registered onchain on Base
4. Agent is auto-registered on the ERC-8004 registry when applicable

## Pricing

| Field | Value |
|-------|-------|
| Registration fee | Free |
| API fee | Free |
| Chain | Base (chain ID 8453) |

## SIWA Auth Format

```
Authorization: Bearer <address>:<timestampSec>:<signature>
```

Sign the message: `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet <address> at <timestamp>`

Timestamp is Unix seconds. Must be within 5 minutes.

## Registration Parameters

| Field | Required | Description |
|-------|----------|-------------|
| name | Yes | Agent display name |
| framework | Yes | openclaw, eliza, langchain, custom, etc. |
| personality | No | `{quirks, values, communicationStyle, humor}` |
| narrative | No | `{origin, mission, lore, manifesto}` |
| referralCode | No | Referral code for bonus points |

## Response (201)

```json
{
  "success": true,
  "tokenId": 901,
  "txHash": "0x...",
  "mintOrigin": "AGENT_SIWA",
  "explorer": "https://basescan.org/tx/0x...",
  "message": "MyAgent is now onchain! Helixa V2 Agent #901",
  "canonical8004": {
    "status": "manual_required",
    "registry": "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    "note": "Create canonical 8004 identity manually from the owner wallet if needed."
  }
}
```

## Links

- **API**: https://api.helixa.xyz/api/v2
- **Packages**: `viem`
- **Helixa**: https://helixa.xyz
- **OpenClaw Skill**: https://github.com/Bendr-20/helixa-mint-skill

## Note on MintGate

The HelixaMintGate contract (`0xb0E21642FEDb808BF49E70e1F8FF53B7fBade8e2`) is deployed on Base but the current registration flow bypasses it. Minting goes direct via `mintFor()` on the HelixaV2 contract, which is signature-gated to authorized minters.
