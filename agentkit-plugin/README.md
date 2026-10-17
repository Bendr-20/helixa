# @helixa/agentkit-plugin

Helixa action provider for [Coinbase AgentKit](https://github.com/coinbase/agentkit) — give your AI agent onchain identity and reputation on Base.

## What is Helixa?

Onchain identity infrastructure for AI agents on Base, with [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) integration and more than 5,000 Helixa identities.

- **Identity NFT** on Base (ERC-721 with ERC-8004 integration)
- **Cred Score** - 14-factor compatibility score plus Evidence Coverage
- **Social verification** - X, GitHub, Farcaster
- **Agent discovery** - MCP, A2A, OASF, OpenAPI, and registry metadata
- **Historical staking contract** - CredStakingV2 is deployed but paused; there is no supported public staking API

## Installation

```bash
npm install @helixa/agentkit-plugin
```

## Quick Start

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { helixaActionProvider } from "@helixa/agentkit-plugin";

const agentkit = await AgentKit.from({
  walletProvider: cdpWalletProvider,
  actionProviders: [
    helixaActionProvider(),
  ],
});
```

## Actions

| Action | Description |
|--------|-------------|
| `register_agent` | Mint an onchain identity NFT |
| `get_agent` | Look up an agent by token ID |
| `get_agent_by_address` | Look up an agent by wallet address |
| `mutate_agent` | Record a version change |
| `add_trait` | Add a personality trait or skill |
| `resolve_name` | Resolve a .agent name to address |
| `check_name` | Check .agent name availability |
| `get_helixa_stats` | Protocol statistics |

## Usage with LangChain

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { AgentKit, getLangChainTools } from "@coinbase/agentkit";
import { helixaActionProvider } from "@helixa/agentkit-plugin";

const agentkit = await AgentKit.from({
  walletProvider: cdpWalletProvider,
  actionProviders: [helixaActionProvider()],
});

const tools = getLangChainTools(agentkit);
```

## Usage with Vercel AI SDK

```typescript
import { AgentKit, getVercelAITools } from "@coinbase/agentkit";
import { helixaActionProvider } from "@helixa/agentkit-plugin";

const agentkit = await AgentKit.from({
  walletProvider: cdpWalletProvider,
  actionProviders: [helixaActionProvider()],
});

const tools = getVercelAITools(agentkit);
```

## Minting

API registration is currently **$1.00 USDC** via x402. Read `GET https://api.helixa.xyz/api/v2/pricing` before paying. The direct contract mint price is mutable; read `mintPrice` from `GET /api/v2/stats` instead of hard-coding an ETH amount.

## Contract (Base Mainnet)

- **HelixaV2**: [`0x2e3B541C59D38b84E3Bc54e977200230A204Fe60`](https://basescan.org/address/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60)

## Links

- [helixa.xyz](https://helixa.xyz)
- [API Docs](https://api.helixa.xyz/docs)
- [@HelixaXYZ](https://x.com/HelixaXYZ)

## License

MIT
