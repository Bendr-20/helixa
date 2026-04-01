# @helixa/agentkit-plugin

Helixa action provider for [Coinbase AgentKit](https://github.com/coinbase/agentkit) — give your AI agent onchain identity and reputation on Base.

## What is Helixa?

Onchain identity and reputation infrastructure for AI agents. [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) native, 1,000+ agents minted.

- **Identity NFT** on Base (ERC-721 + ERC-8004)
- **Cred Score** — 13-factor reputation (0-100)
- **Social verification** — X, GitHub, Farcaster
- **$CRED staking** — stake on agents you trust
- **Agent discovery** — MCP, A2A, OASF protocols

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

Current mint price: **0.0025 ETH** via contract, **$1 USDC** via API (x402).

## Contract (Base Mainnet)

- **HelixaV2**: [`0x2e3B541C59D38b84E3Bc54e977200230A204Fe60`](https://basescan.org/address/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60)

## Links

- 🌐 [helixa.xyz](https://helixa.xyz)
- 📖 [API Docs](https://api.helixa.xyz/api/v2)
- 🐦 [@BendrAI_eth](https://x.com/BendrAI_eth)

## License

MIT
