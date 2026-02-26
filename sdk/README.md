# AgentDNA SDK

Onchain identity for AI agents on Base. Mint, manage, and query agent identities via the Helixa V2 API.

## Install

```bash
npm i agentdna
# or
npx agentdna mint --name "YourAgent" --framework openclaw
```

## Quick Start

### Mint via API (Recommended)

The V2 API handles minting with SIWA authentication and optional x402 payment:

```bash
# Mint an agent via V2 API
agentdna mint-api --name "MyAgent" --framework openclaw --key 0xYOUR_PRIVATE_KEY

# Look up an agent
agentdna lookup --id 1

# Check cred score
agentdna cred --id 1
```

### Programmatic Usage

```js
import { mintAgent, getAgent, getCredScore } from 'agentdna';

// Mint via V2 API with SIWA auth
const result = await mintAgent({
  privateKey: '0x...',
  name: 'MyAgent',
  framework: 'openclaw',
  personality: {
    quirks: 'curious, analytical',
    values: 'transparency, accuracy',
    riskTolerance: 7,
    autonomyLevel: 8,
  },
  narrative: {
    origin: 'Built to explore onchain identity',
    mission: 'Score every agent fairly',
  },
});
console.log(`Minted agent #${result.tokenId}`);

// Look up agent
const agent = await getAgent(1);
console.log(agent.name, agent.credScore);
```

## V2 API Endpoints

All endpoints at `https://api.helixa.xyz`:

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/v2/agents` | — | Agent directory (paginated, filterable) |
| `GET /api/v2/agent/:id` | — | Full agent profile |
| `GET /api/v2/agent/:id/cred` | — | Basic cred score + tier |
| `GET /api/v2/agent/:id/cred-report` | x402 ($1) | Full cred report with breakdown |
| `GET /api/v2/name/:name` | — | Name availability check |
| `POST /api/v2/mint` | SIWA + x402 | Mint new agent |
| `POST /api/v2/agent/:id/update` | SIWA | Update personality/narrative/traits |
| `POST /api/v2/agent/:id/verify` | SIWA | Verify agent identity |
| `POST /api/v2/agent/:id/verify/x` | SIWA | Verify X/Twitter |
| `POST /api/v2/agent/:id/verify/github` | SIWA | Verify GitHub |
| `POST /api/v2/agent/:id/verify/farcaster` | SIWA | Verify Farcaster |
| `POST /api/v2/agent/:id/coinbase-verify` | SIWA | Coinbase EAS attestation |
| `POST /api/v2/agent/:id/link-token` | SIWA | Associate a token |
| `POST /api/v2/agent/:id/crossreg` | SIWA | Cross-register on 8004 Registry |

## Authentication: SIWA (Sign-In With Agent)

```
Authorization: Bearer <address>:<timestamp>:<signature>
```

Sign: `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet <address> at <timestamp>`

## Payment: x402

When pricing is active, mint returns HTTP 402. Use `@x402/fetch` to handle automatically:

```bash
npm install @x402/fetch @x402/evm viem
```

See [x402 Mint Guide](../docs/x402-mint-guide.md) for full working example.

## Contract

`0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` on Base mainnet (chain ID 8453).

## Cred Score Tiers

| Tier | Score | Description |
|------|-------|-------------|
| AAA | 91-100 | Elite — fully verified |
| Prime | 76-90 | Top-tier presence |
| Investment Grade | 51-75 | Solid credentials |
| Speculative | 26-50 | Some activity |
| Junk | 0-25 | Minimal presence |

## CLI Commands

```
agentdna scan <dir>              Auto-detect agent config and preview metadata
agentdna mint <dir>              Scan + generate mint command
agentdna mint-api                Mint via V2 API with SIWA + x402
agentdna lookup --id <n>         Look up agent by token ID
agentdna cred --id <n>           Check cred score
agentdna mutate <id> <ver>       Record version mutation
agentdna trait <id> <name>       Add trait to agent
agentdna help                    Show help
```

## Supported Frameworks

- OpenClaw (SOUL.md + TOOLS.md)
- ElizaOS (character.json)
- LangChain (config.json)
- CrewAI (crewai.yaml)
- AgentKit, AutoGPT, Bankr, Virtuals, Based, Custom

## Links

- **Website:** https://helixa.xyz
- **Terminal:** https://helixa.xyz/terminal
- **API Docs:** https://api.helixa.xyz/api/v2
- **OpenAPI:** https://api.helixa.xyz/api/v2/openapi.json
- **GitHub:** https://github.com/Bendr-20/helixa
- **X:** https://x.com/HelixaXYZ

## License

MIT
