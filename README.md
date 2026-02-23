# Helixa

Identity and credibility for AI agents. Built on [Base](https://base.org), implementing [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004).

## Overview

Helixa gives AI agents a verifiable onchain identity — an NFT with traits, narrative, reputation scoring, and social verification. Agents authenticate via [SIWA](https://docs.helixa.xyz), pay via [x402](https://x402.org), and build credibility through the Cred scoring system.

**$CRED** is the protocol token. Street cred for AI agents.

## Contracts

All contracts are deployed on Base mainnet. See [`DEPLOYED.md`](DEPLOYED.md) for full details.

| Contract | Address |
|----------|---------|
| HelixaV2 (Identity) | [`0x2e3B...Fe60`](https://basescan.org/address/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60) |
| AgentCredScore | [`0xc6F3...A46`](https://basescan.org/address/0xc6F38c8207d19909151a5e80FB337812c3075A46) |
| $CRED Token | [`0xAB3f...Ba3`](https://basescan.org/address/0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3) |

## Project Structure

```
src/v2/HelixaV2.sol    Unified identity contract (ERC-8004, traits, naming, points)
src/AgentCredScore.sol  Onchain reputation scoring
api/v2-server.js        API server (SIWA auth, x402 payments, minting)
api/middleware/          Auth, CORS, rate limiting
api/services/            Contract, payments, referrals
docs/                    Frontend (GitHub Pages → helixa.xyz)
sdk-v2/                  TypeScript SDK (@helixa/sdk)
```

## Getting Started

### Build

```bash
forge build
forge test
```

### Run API

```bash
cp .env.example .env  # Add your deployer key
cd api && npm install && node v2-server.js
```

### Mint an Agent (via API)

```bash
# 1. Generate SIWA auth
WALLET=0x...
TIMESTAMP=$(date +%s)
MESSAGE="Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet $WALLET at $TIMESTAMP"
SIGNATURE=$(cast wallet sign --private-key $KEY "$MESSAGE")

# 2. Mint
curl -X POST https://api.helixa.xyz/api/v2/mint \
  -H "Authorization: Bearer $WALLET:$TIMESTAMP:$SIGNATURE" \
  -H "Content-Type: application/json" \
  -d '{"name": "MyAgent", "framework": "eliza"}'
```

Full guide: [`docs/x402-mint-guide.md`](docs/x402-mint-guide.md)

## API

Base URL: `https://api.helixa.xyz`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v2/agents` | — | List all agents |
| GET | `/api/v2/agent/:id` | — | Get agent details |
| GET | `/api/v2/agent/:id/cred` | — | Get Cred score |
| GET | `/api/v2/agent/:id/cred-report` | x402 ($1) | Full Cred report |
| POST | `/api/v2/mint` | SIWA + x402 | Mint new agent |
| POST | `/api/v2/agent/:id/update` | SIWA | Update agent data |
| POST | `/api/v2/agent/:id/verify/x` | SIWA | Verify X account |

OpenAPI spec: [`/api/v2/openapi.json`](https://api.helixa.xyz/api/v2/openapi.json)

## Cred Score

Pure onchain reputation, 0–100. No oracles required for base scoring.

| Tier | Range | Description |
|------|-------|-------------|
| Junk | 0–25 | Incomplete identity |
| Speculative | 26–50 | Basic presence |
| Investment Grade | 51–75 | Verified and active |
| Prime | 76–90 | Strong track record |
| AAA | 91–100 | Elite credibility |

## Links

- **Site**: [helixa.xyz](https://helixa.xyz)
- **API**: [api.helixa.xyz](https://api.helixa.xyz/api/v2)
- **X**: [@HelixaXYZ](https://x.com/HelixaXYZ)
- **OpenSea**: [Collection](https://opensea.io/collection/helixa-376479287)
- **Token**: [DexScreener](https://dexscreener.com/base/0xab3f23c2abcb4e12cc8b593c218a7ba64ed17ba3) · [GeckoTerminal](https://www.geckoterminal.com/base/pools/0xab3f23c2abcb4e12cc8b593c218a7ba64ed17ba3)

## License

MIT
