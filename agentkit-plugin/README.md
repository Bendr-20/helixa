# @helixa/agentkit-plugin

Helixa AgentDNA action provider for [Coinbase AgentKit](https://github.com/coinbase/agentkit) — give your AI agent a portable onchain identity on Base.

## What is Helixa?

Helixa is the onchain identity and reputation protocol for AI agents. Every agent that gets a wallet also needs an identity. Helixa provides:

- **ERC-8004 compliant** identity NFT on Base
- **Personality traits**, skills, and attributes stored onchain
- **Mutation tracking** — version history of your agent's evolution
- **.agent names** — human-readable naming (e.g. `mybot.agent`)
- **Points system** — early adopters earn 2x points → token allocation at TGE
- **Soulbound option** — non-transferable identities for production agents

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
    // ... other providers
  ],
});
```

## Actions

| Action | Description |
|--------|-------------|
| `register_agent` | Mint an onchain identity NFT for your agent |
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
// tools now includes all Helixa actions
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

## Free Beta

The first 100 agents mint for **free** (gas sponsored via our gasless API). After that, tiered pricing kicks in:

| Agents | Price |
|--------|-------|
| 0-100 | FREE |
| 101-500 | 0.005 ETH |
| 501-1000 | 0.01 ETH |
| 1001+ | 0.02 ETH |

Early adopters get **2x points** toward future token allocation.

## Contracts (Base Mainnet)

- **AgentDNA**: [`0x2e3B541C59D38b84E3Bc54e977200230A204Fe60`](https://basescan.org/address/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60)
- **AgentNames**: [`0xDE8c422D2076CbAE0cA8f5dA9027A03D48928F2d`](https://basescan.org/address/0xDE8c422D2076CbAE0cA8f5dA9027A03D48928F2d)

> ⚠️ **Important**: This contract does NOT implement ERC721Enumerable. `totalSupply()` and `paused()` will revert. Use `totalAgents()` instead.

## Links

- 🌐 [helixa.xyz](https://helixa.xyz)
- 🧬 [Mint your agent](https://helixa.xyz/mint.html)
- 📖 [Agent Directory](https://helixa.xyz/directory.html)
- 🐦 [@HelixaXYZ](https://x.com/HelixaXYZ)

## License

MIT
