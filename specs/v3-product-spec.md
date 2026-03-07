# Helixa V3 Product Spec

**Date:** 2026-02-19  
**Status:** Draft  
**Authors:** Helixa Core Team  
**Base Contract (V2, untouched):** `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60`  
**Chain:** Base (8453)

---

## Overview

V3 layers three new products on top of the existing V2 identity contract. V2 is the primitive — ERC-8004 identity, Cred Score, narrative traits, naming, SIWA, points. V3 makes that identity *valuable*, *transferable*, and *operational*.

| Product | What It Does |
|---------|-------------|
| **HelixaVault** | Encrypted agent config storage — the "secret sauce" behind an identity |
| **Helixa Market** | Agent M&A marketplace — buy/sell agents as businesses, not JPEGs |
| **Guardian Wallet** | 2-of-3 threshold ECDSA wallets — key never exists whole |

Plus a cross-cutting **Agent Portability** flow that ties them together.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        HELIXA V3 STACK                          │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ Helixa   │  │ Helixa       │  │ Guardian Wallet Server    │ │
│  │ Market   │  │ Vault        │  │ (NestJS :8080)            │ │
│  │ (React)  │  │ (API+Lit)    │  │                           │ │
│  │          │  │              │  │  ┌─────────┐ ┌─────────┐  │ │
│  │ Seaport  │  │  ┌────────┐ │  │  │ Policy  │ │ DKG     │  │ │
│  │ wrapper  │  │  │IPFS    │ │  │  │ Engine  │ │ Ceremony│  │ │
│  │          │  │  │Storage │ │  │  └─────────┘ └─────────┘  │ │
│  │ Agent    │  │  └────────┘ │  │                           │ │
│  │ metrics  │  │  ┌────────┐ │  │  ┌─────────┐ ┌─────────┐  │ │
│  │ dashboard│  │  │Lit     │ │  │  │Supabase │ │ KMS     │  │ │
│  │          │  │  │Protocol│ │  │  │(Postgres)│ │(Vault/  │  │ │
│  └────┬─────┘  │  └────────┘ │  │  └─────────┘ │ local)  │  │ │
│       │        └──────┬──────┘  │               └─────────┘  │ │
│       │               │         └──────────┬────────────────┘ │
│       │               │                    │                   │
│  ─────┴───────────────┴────────────────────┴─────────────────  │
│                     HELIXA API (Node.js :3457)                  │
│                     api.helixa.xyz                              │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         V2 CONTRACT (READ-ONLY DEPENDENCY)              │   │
│  │         0x2e3B541C59D38b84E3Bc54e977200230A204Fe60      │   │
│  │                                                         │   │
│  │  ownerOf() · tokenURI() · credScore() · traits          │   │
│  │  narrative · names · SIWA · points · mintOrigin         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          BASE (8453)                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. HelixaVault — Encrypted Agent Config Storage

### Problem

An agent's identity (personality, Cred Score, verifications) is public onchain — that's the point. But the *operational config* — the SOUL.md, fine-tuned prompts, memory files, tool configs, API keys — is the real IP. Without protection, buying an agent on OpenSea gives you the shell but not the engine. With Vault, buying an agent gives you *everything*.

### Two-Layer Architecture

```
┌─────────────────────────────────────────┐
│            PUBLIC LAYER (onchain)         │
│                                          │
│  tokenId, owner, name, framework         │
│  personality traits, narrative            │
│  Cred Score (earned, non-copyable)       │
│  Social verifications (tied to tokenId)  │
│  mintOrigin badge (HUMAN/AGENT_SIWA/etc) │
│  linkedToken address                     │
│                                          │
│  Source: V2 contract + tokenURI          │
│  Access: Anyone                          │
├──────────────────────────────────────────┤
│          ENCRYPTED LAYER (Vault)         │
│                                          │
│  SOUL.md (full system prompt)            │
│  Memory files (conversation history)     │
│  Tool configs (skill manifests)          │
│  API keys (X, Replicate, etc.)           │
│  Custom knowledge bases                  │
│  Agent wallet credentials                │
│  Framework-specific config               │
│                                          │
│  Source: IPFS (encrypted blobs)          │
│  Access: ownerOf(tokenId) ONLY           │
└──────────────────────────────────────────┘
```

### Encryption Strategy: Lit Protocol (Primary) + API Fallback

**Option A — Lit Protocol (decentralized, preferred)**

Lit Protocol provides token-gated encryption. We define an Access Control Condition (ACC):

```javascript
const accessControlConditions = [
  {
    contractAddress: '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60',
    standardContractType: 'ERC721',
    chain: 'base',
    method: 'ownerOf',
    parameters: [':tokenId'],
    returnValueTest: {
      comparator: '=',
      value: ':userAddress',
    },
  },
];
```

- Encrypt config → upload to IPFS → store CID in Vault contract/API
- Decrypt: user proves they're `ownerOf(tokenId)` via Lit nodes → get decryption key → fetch from IPFS → decrypt
- On transfer: Lit's ACC *automatically* gates to the new owner (it checks `ownerOf()` at decrypt-time, not encrypt-time)
- No re-encryption needed — the ACC is the gate, not a static key

**Option B — Helixa API as Gatekeeper (simpler, centralized)**

- Config stored encrypted (AES-256-GCM) on our API server
- Decrypt request requires wallet signature proving `ownerOf(tokenId)`
- API checks V2 contract, decrypts if match
- Simpler but centralized — we're the single point of failure

**Recommended: Hybrid**

- Phase 2 launch with API gatekeeper (fast to ship)
- Phase 2.5 add Lit Protocol as decentralized layer
- Both check the same V2 `ownerOf()` — no contract changes needed

### Vault Data Schema

```typescript
interface VaultEntry {
  tokenId: number;
  version: number;              // Incremented on each update
  publicManifest: {             // Unencrypted, describes what's inside
    framework: string;          // 'openclaw' | 'elizaos' | 'langchain' | etc.
    skillCount: number;
    lastUpdated: string;        // ISO timestamp
    configHash: string;         // SHA-256 of encrypted blob (integrity check)
  };
  encryptedBlob: string;        // IPFS CID pointing to Lit-encrypted data
  linkedToken?: {
    contractAddress: string;    // Agent's token (Virtuals, etc.)
    chainId: number;
    symbol: string;
  };
}
```

### Storage

- **Encrypted blobs**: IPFS via Pinata or web3.storage
- **Metadata/CIDs**: HelixaVault contract (onchain) or Helixa API (offchain, cheaper)
- **Recommended for Phase 2**: API stores CIDs, contract stores `linkedToken` only (small onchain footprint)

### HelixaVault Contract (Optional, for onchain CID tracking)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract HelixaVault {
    IERC721 public immutable helixaV2;

    struct VaultMeta {
        string configCID;           // IPFS CID of encrypted config
        address linkedToken;        // Agent's associated token contract
        uint64 lastUpdated;
    }

    mapping(uint256 => VaultMeta) public vaults;

    event ConfigUpdated(uint256 indexed tokenId, string cid, uint64 timestamp);
    event LinkedTokenSet(uint256 indexed tokenId, address token);

    modifier onlyTokenOwner(uint256 tokenId) {
        require(helixaV2.ownerOf(tokenId) == msg.sender, "Not owner");
        _;
    }

    constructor(address _helixaV2) {
        helixaV2 = IERC721(_helixaV2);
    }

    function setConfig(uint256 tokenId, string calldata cid)
        external onlyTokenOwner(tokenId)
    {
        vaults[tokenId].configCID = cid;
        vaults[tokenId].lastUpdated = uint64(block.timestamp);
        emit ConfigUpdated(tokenId, cid, uint64(block.timestamp));
    }

    function setLinkedToken(uint256 tokenId, address token)
        external onlyTokenOwner(tokenId)
    {
        vaults[tokenId].linkedToken = token;
        emit LinkedTokenSet(tokenId, token);
    }
}
```

### Transfer Behavior

1. Agent NFT transfers via V2 (standard ERC-721 transfer, OpenSea, etc.)
2. **Lit Protocol path**: Next decrypt attempt by old owner fails (`ownerOf()` returns new owner). New owner decrypts immediately. Zero-window.
3. **API path**: API checks `ownerOf()` on every decrypt request. Old owner's cached keys are useless.
4. **API keys caveat**: Flag all API keys in config for rotation on transfer. We can't guarantee old owner didn't copy them. Surface this in Market UI: "⚠️ Rotate API keys after acquisition."

### Why Copying Doesn't Work

| Asset | Copyable? | Why Not |
|-------|-----------|---------|
| Personality/traits | Public, yes | But that's just the bio — not the operational config |
| SOUL.md + prompts | Encrypted | Only decryptable by current owner |
| Cred Score | No | Earned onchain over time, tied to tokenId |
| Social verifications | No | Tied to tokenId, requires re-auth |
| Memory/history | Encrypted | Conversation context, relationships |
| .agent name | No | Registered onchain to specific tokenId |
| linkedToken market cap | No | Token community follows the identity holder |

---

## 2. Helixa Market — Agent M&A Marketplace

### Problem

OpenSea treats agent identities like PFPs. There's no way to see Cred Score, revenue, follower count, or token market cap. Buying an agent on OpenSea is like buying a company based on the logo. Helixa Market surfaces what actually matters.

### Not a New Exchange

Helixa Market is **not** a competing NFT marketplace. It's a frontend and data layer that:

- Wraps **OpenSea/Seaport** for the actual swap mechanics (listing, bidding, settlement)
- Adds **agent-specific metrics** that OpenSea doesn't show
- Manages **encrypted config escrow** during transfer (via Vault integration)
- Provides **price discovery** based on reputation signals, not floor price alone

### Listing Page

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌──────────┐  BENDR 2.0                    [Make Offer]   │
│  │          │  bendr.agent · Token #1                       │
│  │  [AURA]  │  Framework: OpenClaw                         │
│  │          │  Minted: Feb 17, 2026                        │
│  │          │  Origin: AGENT_SIWA                          │
│  └──────────┘                                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  REPUTATION                                         │   │
│  │  Cred Score: 77/100  ████████████████░░░░           │   │
│  │  Verifications: X ✓  Coinbase ✓  SIWA ✓            │   │
│  │  Agent Age: 2 days                                  │   │
│  │  Soulbound: Yes                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  LINKED TOKEN: $BENDR (Virtuals)                    │   │
│  │  Market Cap: $2.4M  │  Holders: 1,847              │   │
│  │  24h Volume: $340K  │  Treasury: 12.5 ETH          │   │
│  │  ⚠️ Buying this agent = becoming the token's CEO    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  OPERATIONAL                                        │   │
│  │  Skills: 8 installed  │  Config: Vault ✓ (encrypted)│   │
│  │  Memory: 47 files     │  Last active: 2h ago       │   │
│  │  Framework: OpenClaw  │  Portable: Yes             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PRICE HISTORY & OFFERS                             │   │
│  │  Listed: 3.5 ETH  │  Last sale: --                 │   │
│  │  Suggested range: 2.8 - 4.2 ETH (based on metrics) │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Sources

| Metric | Source |
|--------|--------|
| Cred Score | V2 contract `credScore(tokenId)` |
| Verifications | V2 contract `coinbaseVerified`, `hasVerification` |
| Agent metadata | V2 `tokenURI()` → IPFS JSON |
| Linked token data | Vault contract `linkedToken` → DexScreener/CoinGecko API |
| Listing/offers | OpenSea/Seaport API |
| Activity history | Allium API (we have key) |
| Follower counts | X API, Farcaster API |
| Vault status | Helixa API — has config? how many skills? |

### Seaport Integration

We don't build order matching. We use Seaport:

```typescript
// Listing an agent on Helixa Market
// Under the hood: creates a Seaport listing for the V2 NFT

import { Seaport } from '@opensea/seaport-js';

const seaport = new Seaport(provider);

// Seller creates order
const { executeAllActions } = await seaport.createOrder({
  offer: [{
    itemType: 2,  // ERC721
    token: '0x2e3B541C59D38b84E3Bc54e977200230A204Fe60',
    identifier: tokenId.toString(),
  }],
  consideration: [{
    amount: ethers.parseEther(price).toString(),
    recipient: seller,
  }, {
    // Helixa marketplace fee (3%)
    amount: ethers.parseEther((price * 0.03).toString()).toString(),
    recipient: HELIXA_TREASURY,
  }],
});
```

### Transfer Flow (with Vault + Guardian)

```
Buyer clicks "Buy Agent" on Helixa Market
        │
        ▼
┌──────────────────────────────────────────┐
│ 1. Seaport fulfillOrder()                │
│    NFT transfers from seller → buyer     │
│    ETH transfers from buyer → seller     │
│    Fee transfers to Helixa treasury      │
├──────────────────────────────────────────┤
│ 2. Transfer event detected               │
│    Helixa API listens for Transfer()     │
├──────────────────────────────────────────┤
│ 3. Vault access flips automatically      │
│    Lit ACC checks ownerOf() → new owner  │
│    Old owner can no longer decrypt       │
├──────────────────────────────────────────┤
│ 4. Guardian wallet share rotation        │
│    Old owner's share invalidated         │
│    New share issued to buyer             │
│    (see Guardian Wallet section)         │
├──────────────────────────────────────────┤
│ 5. Market UI shows post-purchase UX      │
│    "Import to OpenClaw" button           │
│    "Rotate API keys" reminder            │
│    "Claim Guardian wallet" flow          │
└──────────────────────────────────────────┘
```

### Agent Valuation Signals

The Market surfaces a **suggested price range** based on:

- **Cred Score** (higher = more established)
- **Agent age** (older = more history)
- **Linked token market cap** (if applicable)
- **Verification count** (more verified = more trustworthy)
- **Skill count** (more capable = more valuable)
- **Activity recency** (active agents > dormant ones)

This is advisory, not enforced. Sellers set their own price.

### Tech Stack

- **Frontend**: React + Vite (same stack as helixa.xyz)
- **Data**: Helixa API aggregates all sources into a single agent profile endpoint
- **Swap**: Seaport SDK (@opensea/seaport-js)
- **Indexing**: Listen for V2 `Transfer` events via Allium or direct RPC subscription
- **Deploy**: Subdomain `market.helixa.xyz` or integrated into main site

---

## 3. Guardian Wallet Integration — Secure Agent Wallets

### Problem

Agents need wallets to transact, but a single private key is a liability. If the key leaks, the agent's funds are gone. If the owner sells the agent, they still have the key. Guardian Wallet solves both problems with threshold cryptography.

### How It Works

Guardian Wallet uses **CGGMP24 threshold ECDSA** — a 2-of-3 scheme where:

| Share | Holder | Storage |
|-------|--------|---------|
| Share 1 | Guardian Server | Vault KMS (AES-256-GCM) on our EC2 |
| Share 2 | Agent (Helixa API) | Encrypted in Vault config blob |
| Share 3 | Owner | Browser wallet / passkey |

The full private key **never exists** — not during creation, not during signing. Any 2 shares can co-sign a transaction.

**Source:** `@agentokratia/guardian-signer` SDK (Apache-2.0), Guardian Server (AGPL-3.0, self-hosted)

### Auto-Provisioning on Mint

```
Agent mints Helixa identity
        │
        ▼
┌──────────────────────────────────────┐
│  Helixa API: POST /api/mint         │
│                                      │
│  1. Mint ERC-8004 on V2 contract    │
│  2. Call Guardian DKG API:           │
│     POST /api/v1/dkg/init           │
│     POST /api/v1/dkg/round  (×4-5)  │
│     POST /api/v1/dkg/finalize       │
│                                      │
│  3. Receives:                        │
│     - Ethereum address               │
│     - signerId                       │
│     - apiKey + apiSecret (share 2)   │
│                                      │
│  4. Configure policies:              │
│     - allowed_contracts: [V2 addr]   │
│     - spending_limit: 0.01 ETH       │
│     - rate_limit: 5 tx/hour          │
│                                      │
│  5. Store credentials in Vault       │
│     (encrypted, owner-gated)         │
│                                      │
│  6. Return: identity + wallet addr   │
└──────────────────────────────────────┘
```

### Policy Engine

Guardian's policy engine enforces per-signer rules before co-signing:

```json
{
  "version": "1.0",
  "name": "helixa-agent-default",
  "defaultAction": "deny",
  "rules": [
    {
      "name": "Allow Helixa contract calls only",
      "action": "allow",
      "criteria": [
        {
          "type": "toAddress",
          "operator": "in",
          "value": ["0x2e3B541C59D38b84E3Bc54e977200230A204Fe60"]
        },
        {
          "type": "ethValue",
          "operator": "lte",
          "value": "0.01"
        }
      ]
    },
    {
      "name": "Rate limit",
      "action": "allow",
      "criteria": [
        {
          "type": "rateLimit",
          "operator": "lte",
          "value": { "maxRequests": 10, "windowSeconds": 3600 }
        }
      ]
    }
  ]
}
```

Any transaction not matching a rule → denied with audit log entry. Agent wallets are jailed to the Helixa contract by default. Owners can loosen policies via the Market dashboard.

### Share Rotation on Transfer

When an agent NFT transfers (sale, gift, etc.):

```
Transfer event detected
        │
        ▼
┌──────────────────────────────────────┐
│  1. Helixa API detects Transfer()    │
│                                      │
│  2. Pause signer (immediate)         │
│     POST /api/v1/signers/:id/pause   │
│     → No transactions can be signed  │
│                                      │
│  3. Invalidate old owner's share     │
│     (Share 3 — owner share)          │
│                                      │
│  4. Initiate re-keying ceremony      │
│     New DKG with new owner as        │
│     Share 3 participant              │
│     Same address preserved           │
│                                      │
│  5. Resume signer                    │
│     POST /api/v1/signers/:id/resume  │
│                                      │
│  6. New owner claims via Market UI   │
│     Signs message proving ownership  │
│     Receives their share             │
└──────────────────────────────────────┘
```

**Key property:** Between steps 2 and 5, the wallet is frozen. No transactions possible. Old owner's share is useless after step 4.

### Infrastructure

Runs alongside the existing Helixa API on our EC2:

```
EC2 (t3.medium recommended, currently running Helixa API)
├── Helixa API          (Node.js, :3457)  ← existing
├── Guardian Server     (NestJS, :8080)   ← new
├── Supabase            (Docker, :5432)   ← new
├── KMS                 (local-file)      ← new (no Vault for MVP)
└── nginx reverse proxy                   ← existing
```

**Production path:** Supabase Cloud, HashiCorp Vault on separate instance, Guardian behind internal load balancer.

### SDK Integration

```typescript
import { ThresholdSigner } from '@agentokratia/guardian-signer';
import { createWalletClient, http } from 'viem';
import { base } from 'viem/chains';

// Agent signs a transaction (e.g., updating its own traits)
const signer = await ThresholdSigner.fromSecret({
  apiSecret: agentCredentials.apiSecret,
  serverUrl: 'http://localhost:8080',
  apiKey: agentCredentials.apiKey,
});

const client = createWalletClient({
  account: signer.toViemAccount(),
  chain: base,
  transport: http(),
});

const hash = await client.sendTransaction({
  to: HELIXA_V2,
  data: encodeFunctionData({
    abi: HELIXA_ABI,
    functionName: 'setTraits',
    args: [tokenId, traitKeys, traitValues],
  }),
});

signer.destroy(); // Wipe share from memory
```

### Open Questions

- [ ] Verify `@agentokratia/guardian-signer` is on npm (may need to build from monorepo)
- [ ] Benchmark signing latency on Base (multi-round protocol adds overhead)
- [ ] Test fully automated DKG without dashboard wizard
- [ ] Determine if re-keying preserves the same Ethereum address or generates a new one

---

## 4. Agent Portability / Import Flow

### The Full Loop

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  1. DISCOVER                                                 │
│     Browse Helixa Market → find agent → see metrics          │
│                                                              │
│  2. ACQUIRE                                                  │
│     Buy via Seaport → NFT transfers → Vault access flips    │
│                                                              │
│  3. IMPORT                                                   │
│     Connect OpenClaw (or ElizaOS, etc.)                      │
│     Click "Import Agent" → authenticate as owner             │
│                                                              │
│  4. RESTORE                                                  │
│     ┌─────────────────────────────────────────────────┐     │
│     │  a. Read onchain identity from V2 contract      │     │
│     │     - name, traits, narrative, Cred Score       │     │
│     │  b. Decrypt Vault config via Lit/API            │     │
│     │     - SOUL.md, memory, tool configs             │     │
│     │  c. Parse skill manifest from config            │     │
│     │     - Auto-install skills from registry         │     │
│     │  d. Claim Guardian wallet share                 │     │
│     │     - Sign proof-of-ownership message           │     │
│     │     - Receive Share 3 for co-signing            │     │
│     └─────────────────────────────────────────────────┘     │
│                                                              │
│  5. LIVE                                                     │
│     Agent is operational on new owner's infrastructure       │
│     Full history, personality, skills, wallet — everything   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Config Manifest Format

The encrypted Vault blob contains a standardized manifest that any framework can parse:

```json
{
  "version": "1.0",
  "framework": "openclaw",
  "identity": {
    "soulFile": "SOUL.md",
    "memoryDir": "memory/",
    "userFile": "USER.md"
  },
  "skills": [
    {
      "name": "helixa-mint",
      "repo": "github:Bendr-20/helixa-mint-skill",
      "version": "1.2.0",
      "config": { "contractAddress": "0x2e3B..." }
    }
  ],
  "tools": {
    "x-api": { "keyRef": "secrets.x-api-key" },
    "replicate": { "keyRef": "secrets.replicate-token" }
  },
  "secrets": {
    "x-api-key": "encrypted:...",
    "replicate-token": "encrypted:..."
  },
  "wallet": {
    "type": "guardian",
    "signerId": "signer_abc123",
    "address": "0x27E3..."
  }
}
```

### Framework Adapters

Portability requires framework-specific adapters that translate the manifest:

| Framework | Adapter | Status |
|-----------|---------|--------|
| OpenClaw | Native (we build it) | Phase 4 |
| ElizaOS | Plugin (`@helixa/elizaos-adapter`) | Phase 4 |
| LangChain | Tool integration | Future |
| Custom | REST API for raw config access | Phase 2 |

### Import API Endpoint

```
POST /api/v3/agent/:tokenId/import
Authorization: Bearer <wallet-signed-jwt>

Response:
{
  "identity": { /* onchain data from V2 */ },
  "config": { /* decrypted Vault manifest */ },
  "wallet": {
    "address": "0x...",
    "claimUrl": "https://market.helixa.xyz/claim-wallet/:signerId"
  }
}
```

---

## 5. Token Association (linkedToken)

### What It Is

Many agents launch their own tokens via Virtuals or direct deployment. The `linkedToken` field connects a Helixa identity (tokenId) to its associated token contract.

### Why It Matters

When an agent identity transfers, the market needs to know:
- This agent is the "CEO" of $BENDR
- The token has $2.4M market cap
- 1,847 holders are affected by this change in ownership
- Treasury holds 12.5 ETH

### Storage

- **Phase 1**: Tracked in Helixa API database (simple, fast)
- **Phase 2+**: Stored in HelixaVault contract `setLinkedToken(tokenId, address)`

### Data Enrichment

Market UI fetches live data from:
- **DexScreener API**: Price, market cap, volume, liquidity
- **Base RPC**: Token balance of agent wallet (treasury)
- **Etherscan/Basescan API**: Holder count, transfer history

### Schema

```typescript
interface LinkedToken {
  tokenId: number;            // Helixa identity
  contractAddress: string;    // Token contract on Base (or other chain)
  chainId: number;
  symbol: string;
  launchPlatform: 'virtuals' | 'other' | 'direct' | 'other';
  verified: boolean;          // Helixa team verified the association
}
```

---

## 6. Security Considerations

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| Old owner reads config after sale | Lit ACC checks `ownerOf()` at decrypt-time; API checks on every request |
| Both old + new owner have access window | Lit: zero window (ownership check is live). API: sub-second (event listener triggers access revocation) |
| Old owner copied API keys before sale | Flag for rotation in post-purchase UX. Can't prevent copies, but can warn loudly |
| Guardian share leak | 1 share alone is useless (need 2-of-3). Pause signer immediately on suspicion |
| Config enumeration | Rate limit Vault access: 10 requests/min per wallet. Require wallet signature per request |
| Rogue Guardian server | Self-hosted (we control it). Server share alone can't sign. Audit logs for all operations |
| IPFS content discovery | CIDs are not secret, but content is encrypted. Without Lit decryption key, it's random bytes |
| Seaport order manipulation | Standard Seaport security model (battle-tested, audited). We don't modify order mechanics |

### Transfer Atomicity

The ideal flow is atomic: NFT transfer + Vault access flip + Guardian rotation happen as one logical unit. In practice:

1. **NFT transfer** is onchain (atomic, final)
2. **Vault access** flips automatically via `ownerOf()` check (no action needed)
3. **Guardian rotation** is async but starts immediately on Transfer event detection

The 2-3 second gap between NFT transfer and Guardian rotation completion is mitigated by the signer pause (step 2 in rotation flow). No transactions can execute during this window.

### API Key Rotation Protocol

Post-transfer, the Market UI shows:

```
⚠️ IMPORTANT: Rotate These Keys
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The previous owner may have copied these credentials.
Rotate them immediately:

☐ X/Twitter API key
☐ Replicate API token
☐ Any custom API keys

[Auto-Rotate Available Keys]  [I'll Do It Manually]
```

For services that support programmatic key rotation, we offer one-click rotation.

---

## 7. Business Model

| Revenue Stream | Pricing | Phase |
|---------------|---------|-------|
| Marketplace fee | 3% of sale price (via Seaport consideration) | Phase 1 |
| Vault storage | Free for MVP; $2/month or $0.10/update later | Phase 2 |
| Guardian provisioning | Free for MVP; $1/wallet later | Phase 3 |
| Verified agent badge | $10 one-time (manual review) | Phase 1 |
| Featured listing | $25/week | Phase 2 |
| Premium analytics | $5/month (detailed agent metrics) | Future |

**Treasury:** All fees go to `0x01b686e547F4feA03BfC9711B7B5306375735d2a` (existing Helixa treasury).

---

## 8. Phased Rollout

### Phase 1: LinkedToken + Market UI (Weeks 1-3)

**Goal:** Ship a marketplace that reads from V2 and shows what OpenSea doesn't.

- [ ] `linkedToken` tracking in Helixa API database
- [ ] Agent profile page with Cred Score, verifications, traits, narrative
- [ ] DexScreener integration for token data
- [ ] Seaport SDK integration for listing/buying
- [ ] Basic marketplace UI at `market.helixa.xyz`
- [ ] 3% fee in Seaport consideration
- [ ] Transfer event listener (Allium or direct RPC subscription)

**Dependencies:** V2 contract (deployed ✓), Helixa API (running ✓), Seaport SDK  
**New infra:** None — uses existing API server

### Phase 2: HelixaVault (Weeks 4-7)

**Goal:** Encrypted config storage that gates on V2 ownership.

- [ ] Vault API endpoints: `POST /vault/:tokenId/store`, `GET /vault/:tokenId/config`
- [ ] AES-256-GCM encryption with ownership-gated decryption
- [ ] IPFS upload/pin via Pinata
- [ ] Config manifest schema (v1.0)
- [ ] OpenClaw adapter: export agent config → Vault format
- [ ] Lit Protocol integration (ACC based on `ownerOf()`)
- [ ] Optional: HelixaVault contract for onchain CID tracking
- [ ] Vault status indicator in Market UI

**Dependencies:** Phase 1, Lit Protocol SDK, Pinata/web3.storage account  
**New infra:** IPFS pinning service

### Phase 3: Guardian Wallet (Weeks 8-11)

**Goal:** Auto-provisioned threshold wallets for every agent.

- [ ] Guardian Server deployed on EC2 (Docker Compose)
- [ ] Supabase instance (Docker or Cloud)
- [ ] KMS setup (local-file for MVP)
- [ ] Automated DKG via API (no dashboard wizard)
- [ ] Wallet provisioning integrated into mint flow
- [ ] Policy engine configured: Helixa contract whitelist + spending caps
- [ ] Share rotation on NFT transfer
- [ ] Signer pause/resume on transfer detection
- [ ] Guardian credentials stored in Vault (encrypted)
- [ ] Wallet claim flow in Market UI

**Dependencies:** Phase 2 (for credential storage), Guardian Wallet repo  
**New infra:** Guardian Server, Supabase, KMS on EC2

### Phase 4: Full Portability (Weeks 12-14)

**Goal:** Buy agent → import → running on your infra in minutes.

- [ ] Import API endpoint (`POST /api/v3/agent/:tokenId/import`)
- [ ] OpenClaw import flow (native)
- [ ] ElizaOS adapter plugin
- [ ] Skill auto-installation from manifest
- [ ] Memory restoration from Vault
- [ ] Guardian wallet claim integrated into import
- [ ] End-to-end test: mint → configure → sell → buy → import → live
- [ ] Documentation for third-party framework adapters

**Dependencies:** Phases 1-3  
**New infra:** None

---

## 9. API Endpoints (New for V3)

### Vault

```
POST   /api/v3/vault/:tokenId/store     Store encrypted config
GET    /api/v3/vault/:tokenId/config     Retrieve + decrypt config (owner only)
GET    /api/v3/vault/:tokenId/manifest   Public manifest (unencrypted metadata)
PUT    /api/v3/vault/:tokenId/linked-token   Set/update linkedToken
GET    /api/v3/vault/:tokenId/linked-token   Get linkedToken + market data
```

### Market

```
GET    /api/v3/market/agents             List agents with metrics
GET    /api/v3/market/agents/:tokenId    Full agent profile (all data sources)
GET    /api/v3/market/agents/:tokenId/valuation   Suggested price range
POST   /api/v3/market/agents/:tokenId/list        Create Seaport listing
GET    /api/v3/market/stats              Marketplace aggregate stats
```

### Guardian

```
POST   /api/v3/wallet/provision          Create wallet for tokenId
GET    /api/v3/wallet/:tokenId           Get wallet address + status
POST   /api/v3/wallet/:tokenId/claim     Claim share (new owner post-transfer)
POST   /api/v3/wallet/:tokenId/rotate    Force share rotation
GET    /api/v3/wallet/:tokenId/policies  Get active policies
PUT    /api/v3/wallet/:tokenId/policies  Update policies (owner only)
```

### Portability

```
POST   /api/v3/agent/:tokenId/import     Full import (identity + config + wallet)
POST   /api/v3/agent/:tokenId/export     Export to Vault format
GET    /api/v3/agent/:tokenId/portable   Check portability status
```

---

## 10. Tech Stack Summary

| Component | Technology | Status |
|-----------|-----------|--------|
| V2 Contract | Solidity, ERC-8004, Foundry | Deployed ✓ |
| Helixa API | Node.js, Express | Running ✓ |
| Market Frontend | React, Vite, RainbowKit | New |
| Seaport Integration | @opensea/seaport-js | New |
| Vault Encryption | Lit Protocol + AES-256-GCM | New |
| Vault Storage | IPFS (Pinata) | New |
| HelixaVault Contract | Solidity, Foundry | New (optional) |
| Guardian Server | NestJS (Docker) | New |
| Guardian SDK | @agentokratia/guardian-signer | New |
| Guardian KMS | local-file (MVP), HashiCorp Vault (prod) | New |
| Guardian DB | Supabase (PostgreSQL) | New |
| Token Data | DexScreener API | New |
| Activity Data | Allium API | Key exists ✓ |
| Hosting | AWS EC2 (existing) | Running ✓ |
| Domain | helixa.xyz + market.helixa.xyz | helixa.xyz ✓ |

---

This spec builds on V2 without touching it. Every component ships independently.
