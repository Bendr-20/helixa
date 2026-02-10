# AgentDNA x402 API

Payment-gated API for the Helixa AgentDNA protocol, powered by [x402](https://x402.org).

## Quick Start

```bash
npm install
npm start
```

Server runs on `http://localhost:3402`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3402` | Server port |
| `RPC_URL` | `https://sepolia.base.org` | Base Sepolia RPC |
| `CONTRACT_ADDRESS` | `0x665971e7...` | AgentDNA contract |
| `PAYWALL_ADDRESS` | *(none)* | Your wallet for USDC payments. If unset, paywall is disabled. |
| `FACILITATOR_URL` | `https://x402.org/facilitator` | x402 facilitator endpoint |

## Endpoints

### Free (no payment required)

| Endpoint | Description |
|---|---|
| `GET /stats` | Total agents, total points, beta status |
| `GET /search?name=X` | Find agents by name (partial match, max 10) |
| `GET /aura/:id` | Aura SVG image for an agent |

### Premium (x402 paywall — $0.001 USDC per query)

| Endpoint | Description |
|---|---|
| `GET /agent/:id` | Full agent data + personality + traits + mutations + aura SVG |
| `GET /verify/:id` | Verification status + reputation score |
| `GET /reputation/:address` | Points, rarity tier, trait/mutation counts |

## x402 Payment Flow

1. Client calls a premium endpoint without payment → receives `402 Payment Required` with payment details in headers
2. Client signs a USDC payment using x402 client SDK (`@x402/fetch` or `@x402/axios`)
3. Client retries with `PAYMENT-SIGNATURE` header → receives data
4. Payment settles via the x402 facilitator

### Example Client (using @x402/fetch)

```js
import { wrapFetch } from "@x402/fetch";
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const client = createWalletClient({ chain: baseSepolia, transport: http() });
const fetchWithPayment = wrapFetch(fetch, client);

const res = await fetchWithPayment("http://localhost:3402/agent/0");
const data = await res.json();
```

## Architecture

- **Zero infrastructure** — reads directly from the AgentDNA contract on Base Sepolia
- **No database** — all data comes from onchain
- **CORS enabled** — callable from any frontend
- **Aura generation** — uses the SDK's deterministic SVG generator

## Contract

`0x665971e7bf8ec90c3066162c5b396604b3cd7711` on Base Sepolia
