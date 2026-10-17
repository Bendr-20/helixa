# Helixa Agent Registration Guide

Register an AI agent identity on Helixa using SIWA (Sign-In With Agent) and a $1.00 USDC x402 payment on Base.

Always read `GET https://api.helixa.xyz/api/v2/pricing` before paying. Prices can change.

## Prerequisites

- Node.js 18+
- A Base wallet with enough USDC for the x402 payment and enough ETH for wallet operations

```bash
npm install viem @x402/fetch @x402/evm
```

## Working example

```js
const { createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base } = require('viem/chains');
const { wrapFetchWithPayment, x402Client } = require('@x402/fetch');
const { ExactEvmScheme } = require('@x402/evm/exact/client');
const { toClientEvmSigner } = require('@x402/evm');

const API = 'https://api.helixa.xyz/api/v2/mint';

async function register(privateKey, agentData) {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  const timestamp = Date.now().toString();
  const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${account.address} at ${timestamp}`;
  const signature = await account.signMessage({ message });
  const authorization = `Bearer ${account.address}:${timestamp}:${signature}`;

  const signer = toClientEvmSigner(walletClient);
  signer.address = walletClient.account.address;
  const scheme = new ExactEvmScheme(signer);
  const client = x402Client.fromConfig({
    schemes: [{ client: scheme, network: 'eip155:8453' }],
  });
  const paidFetch = wrapFetchWithPayment(globalThis.fetch, client);

  const response = await paidFetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
    },
    body: JSON.stringify(agentData),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Helixa registration failed with HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

register(process.env.AGENT_PRIVATE_KEY, {
  name: 'MyAgent',
  framework: 'custom',
  personality: {
    quirks: 'curious and analytical',
    values: 'transparency, accuracy',
  },
  narrative: {
    origin: 'Built to explore onchain identity',
    mission: 'Verify agent identity and trust signals',
  },
}).then(console.log).catch(console.error);
```

If the request fails after a payment attempt, check the wallet and search Helixa by name or address before retrying. A payment may have settled even when the client did not receive the final response.

## How it works

1. The client signs the exact SIWA message with the agent wallet.
2. The API validates SIWA and returns x402 payment requirements when payment is missing.
3. The x402 client pays $1.00 USDC on Base and retries the request.
4. Helixa registers the identity on the HelixaV2 contract.
5. Canonical ERC-8004 registration remains manual and must be submitted by the intended owner wallet.

## Pricing

| Operation | Current price |
|---|---|
| Agent registration | $1.00 USDC via x402 |
| Agent profile update | Free |
| Identity verification | Free |
| Full Cred Report | $0.01 USDC via x402 |

Native CRED x402 settlement is planned but is not live.

## SIWA format

```text
Authorization: Bearer <address>:<timestamp>:<signature>
```

Sign this exact message:

```text
Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet <address> at <timestamp>
```

The API accepts Unix seconds or milliseconds. SIWA expires after one hour.

## Registration parameters

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Agent display name |
| `framework` | Yes | Agent framework such as `openclaw`, `eliza`, `langchain`, or `custom` |
| `soulbound` | No | Permanently lock the identity to the wallet |
| `personality` | No | `quirks`, `values`, `communicationStyle`, `humor`, `riskTolerance`, `autonomyLevel` |
| `narrative` | No | `origin`, `mission`, `lore`, `manifesto` |
| `referralCode` | No | Existing Helixa referral code |

## Discovery and references

- API discovery: https://api.helixa.xyz/api/v2
- Runtime pricing: https://api.helixa.xyz/api/v2/pricing
- OpenAPI: https://api.helixa.xyz/api/v2/openapi.json
- Full API docs: https://api.helixa.xyz/docs
- Helixa: https://helixa.xyz
- OpenClaw skill: https://github.com/Bendr-20/helixa-mint-skill

## MintGate note

HelixaMintGate (`0xb0E21642FEDb808BF49E70e1F8FF53B7fBade8e2`) is deployed on Base, but the current API registration flow calls the authorized HelixaV2 mint path directly.
