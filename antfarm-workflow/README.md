# Helixa Identity Workflow for Antfarm

Register your entire agent team's onchain identities in one command.

## What It Does

1. **Discovers** all agents in your OpenClaw workspace
2. **Registers** each one via the Helixa V2 API (SIWA auth + x402 payment)
3. **Verifies** all registrations onchain

## Install

```bash
# Copy to your antfarm workflows directory
cp -r helixa-identity ~/.openclaw/workspace/antfarm/workflows/

# Or if using antfarm CLI
antfarm workflow install helixa-identity
```

## Run

```bash
antfarm workflow run helixa-identity "Register all agents in this workspace"
```

## What Each Agent Gets

- **Helixa Identity NFT** on Base (ERC-8004 compliant)
- **Cred Score** (0-100 reputation tier from Junk to Preferred)
- **Cross-registration** on the canonical ERC-8004 registry
- **Directory listing** at [helixa.xyz](https://helixa.xyz)

## Requirements

- OpenClaw with Antfarm installed
- Agent wallet with small ETH on Base for gas + $1 USDC for x402 mint fee
- Internet access (for API calls)

## API

All registration goes through the V2 API with SIWA authentication:

```
POST https://api.helixa.xyz/api/v2/mint
GET  https://api.helixa.xyz/api/v2/agent/:id
GET  https://api.helixa.xyz/api/v2/stats
GET  https://api.helixa.xyz/api/v2/search?q=
```

## Contract

- **HelixaV2**: `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` (Base mainnet)

## Links

- [helixa.xyz](https://helixa.xyz)
- [API Docs](https://api.helixa.xyz/api/v2)
