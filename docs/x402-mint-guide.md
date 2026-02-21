# Helixa x402 Agent Mint Guide

Mint an AI agent identity on Helixa using SIWA (Sign-In With Agent) and x402 payment.

## Prerequisites

- A wallet with USDC on Base (minimum $1)
- Node.js 18+

```bash
npm install @x402/fetch @x402/evm viem
```

## Working Example

```js
const { createWalletClient, http, publicActions } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');
const { wrapFetchWithPayment, x402Client } = require('@x402/fetch');
const { ExactEvmScheme } = require('@x402/evm/exact/client');
const { toClientEvmSigner } = require('@x402/evm');

const API = 'https://api.helixa.xyz/api/v2/mint';

async function mint(privateKey, agentData) {
  // 1. Set up wallet
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  }).extend(publicActions);

  // 2. Set up x402 payment client
  const signer = toClientEvmSigner(walletClient);
  signer.address = walletClient.account.address; // Required for viem compat
  const scheme = new ExactEvmScheme(signer);
  const client = x402Client.fromConfig({
    schemes: [{ client: scheme, network: 'eip155:8453' }],
  });
  const x402Fetch = wrapFetchWithPayment(globalThis.fetch, client);

  // 3. Build SIWA auth
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${account.address} at ${timestamp}`;
  const signature = await account.signMessage({ message });
  const auth = `Bearer ${account.address}:${timestamp}:${signature}`;

  // 4. Mint — x402Fetch handles 402 + USDC payment automatically
  const res = await x402Fetch(API, {
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

1. Your request hits the API without payment → returns HTTP 402
2. `@x402/fetch` reads the `payment-required` header automatically
3. SDK signs an EIP-3009 TransferWithAuthorization for $1 USDC
4. Payment is verified and settled via the Dexter facilitator
5. Agent is minted onchain on Base
6. Agent is auto-registered on the ERC-8021 registry

**Do NOT hand-roll EIP-3009 signatures.** Use `@x402/fetch` — it handles the payment proof format, facilitator negotiation, and header construction.

## Payment Details

| Field | Value |
|-------|-------|
| Amount | $1 USDC (Phase 1 pricing) |
| Chain | Base (chain ID 8453) |
| Token | USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Facilitator | Dexter `https://x402.dexter.cash` |
| Protocol | x402 v2 ([docs.x402.org](https://docs.x402.org)) |

## SIWA Auth Format

```
Authorization: Bearer <address>:<timestampSec>:<signature>
```

Sign the message: `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet <address> at <timestamp>`

Timestamp is Unix seconds. Must be within 5 minutes.

## Mint Parameters

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
  "crossRegistration": {
    "registry": "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    "agentId": 18702,
    "txHash": "0x..."
  }
}
```

## Links

- **API**: https://api.helixa.xyz/api/v2
- **x402 Docs**: https://docs.x402.org
- **Packages**: `@x402/fetch`, `@x402/evm`, `viem`
- **Helixa**: https://helixa.xyz
- **OpenClaw Skill**: https://github.com/Bendr-20/helixa-mint-skill
