> **⚠️ HISTORICAL DOCUMENT** — Early ecosystem research. Some references are outdated (e.g., Clanker). Kept for reference.

# Skills & Tools Research for Helixa (AgentDNA) Promotion

> Compiled 2026-02-11 | Budget: $0 — everything must be free
> Goal: Drive awareness, mints, and developer adoption for an onchain agent identity protocol on Base

---

## 1. OpenClaw / ClawHub Skills

### MUST HAVE

| Name | URL | What It Does | How It Helps Helixa | Free? |
|------|-----|-------------|---------------------|-------|
| **BankrBot/openclaw-skills (erc-8021)** | https://github.com/BankrBot/openclaw-skills/tree/main/erc-8021 | ERC-8021 agent registry skill — mint agent NFTs, establish onchain identity, build reputation | **This IS the Helixa skill.** Already in the BankrBot repo. Ensure it's polished, well-documented, and discoverable. | ✅ |
| **Bankr Skill** | https://github.com/BankrBot/openclaw-skills/tree/main/bankr | Financial infra for agents — token launches, trading, payments, yield | Cross-promote: agents using Bankr should also register identity via Helixa. Natural funnel. | ✅ |
| **Clanker Skill** | https://github.com/BankrBot/openclaw-skills/tree/main/clanker | Deploy ERC20 tokens on Base via Clanker SDK | Token deployers need agent identity — "register your agent before launching tokens" narrative | ✅ |
| **Botchan Skill** | https://github.com/BankrBot/openclaw-skills/tree/main/botchan | Onchain messaging protocol on Base — agent feeds, DMs, data storage | Agents need identity before messaging. Natural prerequisite flow. | ✅ |
| **ClawHub Registry** | https://clawhub.ai | OpenClaw's public skill registry (5,700+ skills, vector search) | **Publish a standalone Helixa/AgentDNA skill** here for maximum discoverability. All OpenClaw users browse this. | ✅ |
| **OnchainKit Skill** | https://github.com/BankrBot/openclaw-skills/tree/main/onchainkit | Coinbase's React components for onchain apps | Build AgentDNA mint UI with OnchainKit; reference in skill docs | ✅ |

### NICE TO HAVE

| Name | URL | What It Does | How It Helps Helixa | Free? |
|------|-----|-------------|---------------------|-------|
| **ENS Primary Name Skill** | https://github.com/BankrBot/openclaw-skills/tree/main/ens-primary-name | Set ENS name on Base/L2s | Complementary identity layer — "get your agent an ENS name + Helixa ID" | ✅ |
| **Veil Cash Skill** | https://github.com/BankrBot/openclaw-skills/tree/main/veil | Privacy/shielded txns on Base via ZK | Privacy-aware agents still need identity. Edge use case. | ✅ |
| **Endaoment Skill** | https://github.com/BankrBot/openclaw-skills/tree/main/endaoment | Onchain charity donations | Reputation-building: agents donate → builds onchain reputation | ✅ |
| **ClawSec** | https://github.com/prompt-security/clawsec | Security suite for OpenClaw — drift detection, audits, skill integrity | Protects agents using Helixa skill. Reference in docs for trust. | ✅ |
| **awesome-openclaw-skills** | https://github.com/VoltAgent/awesome-openclaw-skills | Curated list of 2,999 skills by category | **Get Helixa listed here** for visibility. Categories include "Agent-to-Agent Protocols" (19 skills) — perfect fit. | ✅ |
| **sundial-org/awesome-openclaw-skills** | https://github.com/sundial-org/awesome-openclaw-skills | Another curated skills list | Submit Helixa for inclusion | ✅ |
| **aisa-twitter-api skill** | ClawHub (openclaw/skills) | Search X/Twitter in real-time, extract posts | Monitor Helixa mentions, engage with agent identity conversations | ✅ |
| **agent-identity-kit skill** | ClawHub (openclaw/skills) | Portable identity system for AI agents | Potential competitor or integration partner — investigate overlap with Helixa | ✅ |

---

## 2. Claude Code / Agent Skills (Cross-Platform)

### MUST HAVE

| Name | URL | What It Does | How It Helps Helixa | Free? |
|------|-----|-------------|---------------------|-------|
| **SkillsMP (Agent Skills Marketplace)** | https://skillsmp.com | Cross-platform skill marketplace for Claude Code, Codex, OpenClaw | **Publish Helixa skill here** — reaches Claude Code AND Codex users, not just OpenClaw | ✅ |
| **VS Code Agent Skills** | https://code.visualstudio.com/docs/copilot/customization/agent-skills | VS Code natively supports .github/skills/ and .claude/skills/ | **Create a .github/skills/ folder** in the Helixa repo so anyone using VS Code + Copilot/Claude can discover it | ✅ |

### NICE TO HAVE

| Name | URL | What It Does | How It Helps Helixa | Free? |
|------|-----|-------------|---------------------|-------|
| **levnikolaevich/claude-code-skills** | https://github.com/levnikolaevich/claude-code-skills | Production-ready Claude Code skills collection | Study format, potentially contribute Helixa-related skill | ✅ |

---

## 3. Agent Distribution Platforms

### MUST HAVE

| Name | URL | What It Does | How It Helps Helixa | Free? |
|------|-----|-------------|---------------------|-------|
| **npm** | https://npmjs.com | JavaScript package registry | Publish `@agentdna/sdk` or `helixa-sdk` — every JS agent builder discovers tools here | ✅ |
| **GitHub** | https://github.com | Code hosting + discovery (trending, topics, stars) | Open-source the SDK, use topics like `ai-agent`, `onchain-identity`, `base`, `erc-8021` for discoverability | ✅ |
| **ClawHub** | https://clawhub.ai | OpenClaw skill registry (5,700+ skills) | Primary distribution for OpenClaw ecosystem — already discussed above | ✅ |

### NICE TO HAVE

| Name | URL | What It Does | How It Helps Helixa | Free? |
|------|-----|-------------|---------------------|-------|
| **PyPI** | https://pypi.org | Python package registry | Publish `agentdna` Python SDK for LangChain/CrewAI builders | ✅ |
| **GitHub Awesome Lists** | Various | Curated lists that drive discovery | Submit to awesome-ai-agents, awesome-web3, awesome-base, awesome-openclaw-skills | ✅ |

---

## 4. Social / Marketing Tools

### MUST HAVE

| Name | URL | What It Does | How It Helps Helixa | Free? |
|------|-----|-------------|---------------------|-------|
| **Twikit** | https://github.com/d60/twikit | Twitter/X scraper + poster — NO API key needed | Post about Helixa, monitor mentions, engage with agent builders. Free, no API key. | ✅ |
| **OpenClaw Twitter integration** | Built into OpenClaw | OpenClaw has native Twitter channel support | Use OpenClaw itself to manage Helixa's X presence | ✅ |
| **Farcaster (Warpcast)** | https://warpcast.com | Decentralized social — huge crypto/Base community | Post on /base, /agents, /ai channels. Where Base builders hang out. Free. | ✅ |
| **Telegram Groups** | Various | Crypto/agent community groups | Already present. Share in agent-focused groups. | ✅ |

### NICE TO HAVE

| Name | URL | What It Does | How It Helps Helixa | Free? |
|------|-----|-------------|---------------------|-------|
| **AI-Twitter-X-Bot** | https://github.com/francosion042/AI-Twitter-X-Bot | AI-powered Twitter bot for dynamic content posting | Automate Helixa content — needs X API key (free tier exists) | ✅ (free tier) |
| **dexaai/xbot** | https://github.com/dexaai/xbot | X bot for responding to mentions with AI answers | Auto-reply to people asking about agent identity | ✅ |
| **Buffer Free Plan** | https://buffer.com | Social media scheduler | Schedule Helixa posts across platforms — free for 3 channels | ✅ (limited) |

---

## 5. Crypto / Web3 Agent Tools

### MUST HAVE

| Name | URL | What It Does | How It Helps Helixa | Free? |
|------|-----|-------------|---------------------|-------|
| **ERC-8021 Standard** | https://eips.ethereum.org/EIPS/eip-8021 | The actual Ethereum standard for trustless agent identity | **Helixa IS an ERC-8021 implementation.** Reference this everywhere. Riding the standard's momentum is free marketing. | ✅ |
| **Bankr.bot** | https://bankr.bot | Financial infrastructure for autonomous agents | Primary partner — agents using Bankr need Helixa identity. Cross-skill integration. | ✅ |
| **Clanker** | https://clanker.world | Token deployment on Base | "Register your agent → deploy your token" flow | ✅ |
| **Coinbase OnchainKit** | https://onchainkit.xyz | React components for onchain apps | Build mint page / agent dashboard with OnchainKit. Coinbase ecosystem alignment. | ✅ |
| **Base (Coinbase L2)** | https://base.org | L2 chain where Helixa lives | Leverage Base ecosystem grants, builder programs, social channels | ✅ |

### NICE TO HAVE

| Name | URL | What It Does | How It Helps Helixa | Free? |
|------|-----|-------------|---------------------|-------|
| **Neynar** | https://neynar.com | Farcaster API — build social features | Query Farcaster for agent-related casts, automate posting on /base | ✅ (free tier) |
| **Zapper** | https://zapper.xyz | Portfolio tracking / onchain analytics | Track Helixa mints, agent activity — planned BankrBot skill | ✅ |
| **ERC-6551 (Token Bound Accounts)** | https://eips.ethereum.org/EIPS/eip-6551 | Give NFTs their own wallets | Complement ERC-8021: agent identity NFT gets its own wallet. Powerful narrative. | ✅ |

---

## 6. Developer Outreach / Framework Integrations

### MUST HAVE

| Name | URL | What It Does | How It Helps Helixa | Free? |
|------|-----|-------------|---------------------|-------|
| **ElizaOS Plugin** | https://github.com/elizaOS/eliza | Most popular Web3 AI agent framework | **Build an ElizaOS plugin for AgentDNA.** Every ElizaOS agent could mint identity. Massive reach. | ✅ |
| **ElizaOS Discord/Forum** | https://discord.gg/elizaos | Where ElizaOS builders congregate | Share the plugin, get feedback, drive adoption | ✅ |
| **LangChain Tools** | https://python.langchain.com/docs/integrations/tools/ | Python agent framework with tool integrations | Build a LangChain `AgentDNATool` — registers agent identity onchain | ✅ |
| **CrewAI Tools** | https://docs.crewai.com/concepts/tools | Multi-agent framework with custom tool support | Build a CrewAI tool for agent identity registration | ✅ |

### NICE TO HAVE

| Name | URL | What It Does | How It Helps Helixa | Free? |
|------|-----|-------------|---------------------|-------|
| **Ethereum Magicians Forum** | https://ethereum-magicians.org/t/erc-8021-trustless-agents/25098 | ERC discussion forum | Engage in ERC-8021 discussion thread — position Helixa as the reference implementation | ✅ |
| **r/AI_Agents (Reddit)** | https://reddit.com/r/AI_Agents | AI agent builder community | Share Helixa, answer questions about agent identity | ✅ |
| **OpenAI Codex CLI** | https://github.com/openai/codex | OpenAI's CLI agent (supports same SKILL.md format) | Cross-publish Helixa skill — same format as Claude Code / OpenClaw | ✅ |
| **Alith (LazAI)** | https://alith.lazai.network | Agent framework with ElizaOS + LangChain integrations | Another framework to integrate with | ✅ |

---

## 🎯 Priority Action Items (Top 10)

1. **Publish Helixa skill on ClawHub** — instant visibility to 5,700+ skill ecosystem
2. **Submit PR to awesome-openclaw-skills** — get listed in "Agent-to-Agent Protocols" category
3. **Build ElizaOS plugin** — tap into largest Web3 agent framework community
4. **Publish npm package** (`@agentdna/sdk` or `helixa-sdk`) — JS agent builders discover tools here
5. **Publish on SkillsMP** — cross-platform reach (Claude Code + Codex + OpenClaw)
6. **Create .github/skills/ in repo** — VS Code native discovery
7. **Build LangChain Tool** — reach Python agent builders
8. **Post on Farcaster /base /agents channels** — where Base builders live
9. **Engage in ERC-8021 Ethereum Magicians thread** — position as reference implementation
10. **Cross-integrate with Bankr + Botchan skills** — "identity first, then transact/communicate" flow

---

## 🔑 Key Insight

The **BankrBot/openclaw-skills** repo already has an `erc-8021` skill. This is the beachhead. The strategy is:
1. Make that skill excellent (docs, examples, error handling)
2. Spread to every other distribution channel (ClawHub, SkillsMP, npm, PyPI, awesome lists)
3. Build framework plugins (ElizaOS, LangChain, CrewAI) to reach non-OpenClaw builders
4. Use social (Farcaster, X, Reddit, Discord) to amplify

Everything listed is **free**. The only cost is time and code.
