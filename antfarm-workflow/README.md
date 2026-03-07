# Helixa Identity Workflow for Antfarm

Register your entire agent team's onchain identities in one command.

## What It Does

1. **Discovers** all agents in your OpenClaw workspace
2. **Registers** each one via the Helixa gasless API (no wallet needed)
3. **Claims** `.agent` names for each agent
4. **Verifies** all registrations onchain

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

- **AgentDNA NFT** on Base (ERC-8004 compliant)
- **`.agent` name** (e.g., `planner.agent`, `developer.agent`)
- **Cred score** — reputation tier from Junk to AAA
- **Directory listing** at [helixa.xyz/directory.html](https://helixa.xyz/directory.html)

## Requirements

- OpenClaw with Antfarm installed
- Internet access (for API calls)
- That's it. No wallet, no ETH, no browser. We pay the gas.

## API

All registration goes through the gasless API:

```
POST https://api.helixa.xyz/api/mint
GET  https://api.helixa.xyz/api/name/:name
GET  https://api.helixa.xyz/api/agent/:id
GET  https://api.helixa.xyz/api/stats
```

## Contracts

- **AgentDNA**: `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` (Base)
- **AgentNames**: `0xDE8c422D2076CbAE0cA8f5dA9027A03D48928F2d` (Base)

## Links

- [helixa.xyz](https://helixa.xyz)
- [Agent Directory](https://helixa.xyz/directory.html)
- [Skill Reference](https://github.com/Bendr-20/helixa-mint-skill)
