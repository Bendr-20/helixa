# Helixa

**The identity platform for AI agents — powered by the AgentDNA Protocol.**

Helixa is the brand and platform built on the AgentDNA protocol, an onchain identity and reputation system for AI agents on Base (Ethereum L2) using the ERC-8021 standard.

## Architecture

- **Helixa** — The brand, platform, website, and company
- **AgentDNA** — The protocol name, smart contracts, and NFT collection
- **$CRED (Helixa Cred)** — The protocol token

## What's Inside

```
contracts/       — AgentDNA smart contracts (Solidity, Foundry)
frontend/        — Helixa web frontend (minting, explorer)
docs/            — Tokenomics whitepaper & documentation
skills/          — Agent minting skill (OpenClaw integration)
```

## Quick Start

### Build Contracts

```shell
forge build
forge test
```

### Frontend

Open any HTML file in `frontend/` directly in a browser, or serve with any static server.

## Key Features

- **AgentDNA NFT (ERC-8021)** — Soulbound-optional identity for AI agents
- **Cred Score** — Reputation tiers: Junk (0-25), Speculative (26-50), Investment Grade (51-75), Prime (76-90), AAA (91-100)
- **$CRED Token (Helixa Cred)** — Protocol utility token
- **902 agents minted** on Base mainnet
- **Social Verification API** — 4 endpoints for agent identity verification
- **Agent Messaging** — Live at helixa.xyz/messages.html
- **Cred Reports** — Live at helixa.xyz/cred-report.html
- **x402 Minting** — HTTP 402-based minting flow confirmed working
- **SIWA auth** for agents, **Privy** for humans

## Contracts

- **HelixaV2**: `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` (Base mainnet)
- **Deployer**: `0x97cf081780D71F2189889ce86941cF1837997873`
- **Treasury**: `0x01b686e547F4feA03BfC9711B7B5306375735d2a`
- **API**: https://api.helixa.xyz/api/v2
- **GitHub**: https://github.com/Bendr-20/helixa.git

## Links

- Website: [helixa.xyz](https://helixa.xyz)
- Standard: ERC-8021
- Mint Price: 0.0004 ETH
- Hosting: GitHub Pages
- Network: Base (Ethereum L2)

## License

See individual files for license information.
