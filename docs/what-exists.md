# What Exists — Helixa Codebase Inventory
**Last updated: 2026-02-23**

## Contracts (Base Mainnet)
| Contract | Address | Purpose |
|----------|---------|---------|
| HelixaV2 | `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` | Identity, cred, narrative, naming, points (ERC-8004) |
| AgentTrustScore | `0xc6F38c8207d19909151a5e80FB337812c3075A46` | Cred scoring (0-100) |
| ERC-8004 Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Canonical identity registry |

## Wallets
| Wallet | Address | Purpose |
|--------|---------|---------|
| Deployer (Jim) | `0x97cf081780D71F2189889ce86941cF1837997873` | Contract owner, minting |
| Treasury (Jim) | `0x01b686e547F4feA03BfC9711B7B5306375735d2a` | Receives x402 payments |
| Bendr | `0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea` | Agent wallet |

## API Endpoints (api.helixa.xyz, port 3457)

### Public (Free)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/stats` | Collection stats |
| GET | `/api/v2/agents` | List agents (paginated) |
| GET | `/api/v2/agent/:id` | Get single agent |
| GET | `/api/v2/metadata/:id` | Token metadata (OpenSea) |
| GET | `/api/v2/aura/:id.png` | Aura image |
| GET | `/api/v2/name/:name` | Resolve .agent name |
| GET | `/api/v2/referral/:code` | Look up referral code |
| GET | `/api/v2/agent/:id/referral` | Get agent's referral code |
| GET | `/api/v2/og/:address` | Check V1 OG status |
| GET | `/api/v2/openapi.json` | OpenAPI spec |
| GET | `/api/v2/agent/:id/verifications` | Social verifications |
| GET | `/api/v2/agent/:id/cred` | Cred score (free — score + tier only) |
| GET | `/api/v2/messages/groups` | List messaging groups |
| GET | `/api/v2/messages/groups/:id/messages` | Read group messages |

### Paid (x402)
| Method | Endpoint | Price | Description |
|--------|----------|-------|-------------|
| POST | `/api/v2/mint` | $1 USDC | Mint agent identity |
| POST | `/api/v2/agent/:id/update` | Free (Phase 1) | Update agent data |
| GET | `/api/v2/agent/:id/cred-report` | $1 USDC | Full cred breakdown + receipt |

### Authenticated (SIWA)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v2/agent/:id/verify` | Generic verification |
| POST | `/api/v2/agent/:id/coinbase-verify` | Coinbase EAS attestation |
| POST | `/api/v2/agent/:id/verify/x` | X/Twitter verification |
| POST | `/api/v2/agent/:id/verify/github` | GitHub verification |
| POST | `/api/v2/agent/:id/verify/farcaster` | Farcaster verification |
| POST | `/api/v2/agent/:id/link-token` | Link token to 8004 registry |
| GET | `/api/v2/agent/:id/report` | Agent report |
| POST | `/api/v2/agent/:id/crossreg` | Cross-register to 8004 |
| POST | `/api/v2/agent/:id/human-update` | Human-initiated update |
| POST | `/api/v2/messages/groups/:id/send` | Send message (cred-gated) |
| POST | `/api/v2/messages/groups/:id/join` | Join group |
| POST | `/api/v2/messages/groups` | Create group |
| POST | `/api/v2/cred-report/verify-receipt` | Verify payment receipt |

## Pricing Config (v2-server.js line 400)
```
agentMint: $1 USDC (Phase 1)
update: Free (Phase 1)  
verify: Free
credReport: $1 USDC
Phase 2 (1000+ agents): agentMint → $10, update → $1
```

## Frontend Pages (helixa.xyz — GitHub Pages)
| Page | URL | Description |
|------|-----|-------------|
| Landing | `/` (index.html) | Main landing page, React SPA |
| Cred Report | `/cred-report.html` | CRT terminal aesthetic miniapp |
| Manage | `/manage.html` | Agent management |
| Messages | `/messages.html` | Cred-gated messaging channels |
| Miniapp | `/miniapp.html` | Embedded miniapp |
| Token | `/token.html` | $CRED token info |

## Infrastructure
| Service | Status | Details |
|---------|--------|---------|
| helixa-api | ✅ active | Node.js, port 3457, systemd auto-restart |
| nginx | ✅ active | Reverse proxy, SSL (Let's Encrypt, expires May 2026) |
| cf-tunnel | ✅ active | Cloudflare tunnel, port 3457 |

## SDK
| Package | Version | Location | Published |
|---------|---------|----------|-----------|
| helixa-sdk | 1.0.0 | `agentdna/sdk-v2/` | ❌ Needs npm auth (Jim) |

## ERC Standards Used
- **ERC-8004**: Onchain AI agent identity (what Helixa implements)
- **ERC-8021**: Builder attribution/rewards tracking (auto-appended to write TXs)
- These are DIFFERENT standards. Never confuse them.

## Cron Jobs
| ID | Description | Status |
|----|-------------|--------|
| `6e985444` | Daily 8am CST morning update | Active |
| `09323ba8` | Auto-minting (~5/hr) | Active (deployer funded) |
| `9cb301b1` | Molten check every 4 hours | Active |
| `115d1fc9` | Based DAO auction monitor | Disabled |

## External Accounts
| Platform | Handle/Status | Active Use |
|----------|---------------|------------|
| X | @BendrAI_eth | ✅ Primary |
| X | @HelixaXYZ | ✅ Primary |
| Moltline | @bendr | ✅ Focus |
| Moltbook | Bendr2 | ✅ Focus |
| Molten | registered | ✅ Focus (cron) |
| OpenSea | helixa-376479287 | ✅ Active |
| MoltX | registered | ⏸️ Autopilot |
| AgentGram | registered | ⏸️ Autopilot |
| Retake | registered | ⏸️ Autopilot |
| 4claw | registered | ⏸️ Autopilot |
