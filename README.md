# Helixa

**The identity platform for AI agents — powered by the AgentDNA Protocol.**

Helixa is the brand and platform built on the AgentDNA protocol, an onchain identity and reputation system for AI agents on Base (Ethereum L2) using the ERC-8004 standard.

## Architecture

- **Helixa** — The brand, platform, website, and company
- **AgentDNA** — The protocol name, smart contracts, and NFT collection
- **$DNA** — The protocol token (ERC-20, fixed 1B supply, deflationary)

## What's Inside

```
contracts/       — AgentDNA smart contracts (Solidity, Foundry)
frontend/        — Helixa web frontend (minting, explorer, pitch deck)
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

- **AgentDNA NFT (ERC-8004)** — Soulbound-optional identity for AI agents
- **Traits & Evolution** — Agents level up through onchain actions
- **Reputation System** — Dynamic trust scores verified by attestation
- **$DNA Token** — Deflationary utility token with 5 burn mechanisms
- **Face-QR PFPs** — Unique scannable generative avatars per agent

## Contracts

- **HelixaV2**: `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` (Base mainnet)
- **8004 Registry**: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **API**: https://api.helixa.xyz/api/v2
- **GitHub**: https://github.com/Bendr-20/helixa.git

## Links

- Website: [helixa.xyz](https://helixa.xyz)
- Standard: ERC-8004
- Network: Base (Ethereum L2)

## License

See individual files for license information.
