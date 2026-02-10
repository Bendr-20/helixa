# AgentDNA Technical Architecture v0.1

## Overview

AgentDNA is an ERC-721-based identity system for AI agents deployed on Base (Ethereum L2).

## Smart Contract Architecture

### Core Contract: AgentDNA.sol

```
AgentDNA (ERC-721)
├── mint(metadata) → tokenId
├── updateMetadata(tokenId, metadata)
├── getAgent(tokenId) → AgentInfo
├── getAgentByAddress(address) → tokenId
├── verify(tokenId) → bool (admin only, verified badge)
└── setMintPrice(price) (admin only)
```

**Key design decisions:**
- One NFT per agent address (1:1 mapping)
- Metadata URI points to IPFS/Arweave (hash stored onchain)
- Mint price: 0.01 ETH (~$25) — adjustable by admin
- Verified badge: admin-granted after provenance check
- Non-transferable option (soulbound mode) available per mint

### Metadata Schema (stored on IPFS)

```json
{
  "name": "Agent Name",
  "description": "What this agent does",
  "image": "ipfs://...",
  "attributes": {
    "creator": "0x... or ENS",
    "framework": "langchain|crewai|autogpt|custom",
    "capabilities": ["text-generation", "code", "research", "trading"],
    "version": "1.0.0",
    "created_at": "2025-02-08T00:00:00Z",
    "model": "gpt-4|claude-3|llama-3|custom",
    "source_repo": "https://github.com/...",  // optional
    "parent_dna": "tokenId or null",  // lineage tracking
    "endpoints": {
      "api": "https://...",
      "health": "https://..."
    }
  }
}
```

### Future Contracts (deferred)

- **ReputationRegistry.sol** — ERC-8004 implementation (Month 4+)
- **AttestationManager.sol** — third-party attestations (Month 4+)
- **PaymentEscrow.sol** — agent-to-agent payments (Month 6+)

## Infrastructure

### MVP Stack (all free tier)

| Component | Tool | Cost |
|-----------|------|------|
| Smart contracts | Solidity + Hardhat | Free |
| Contract libs | OpenZeppelin | Free |
| Chain | Base Sepolia (test) → Base Mainnet | Gas only |
| Frontend | Next.js + wagmi + viem | Free |
| Hosting | Vercel | Free |
| Metadata storage | Pinata IPFS (free tier) | Free |
| Database (if needed) | Supabase free tier | Free |
| Indexing | Direct RPC / Alchemy free tier | Free |

### Architecture Diagram

```
┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│  Base Chain   │
│  (Next.js)   │     │  AgentDNA.sol │
│  Vercel      │     └──────────────┘
└──────┬───────┘            │
       │              ┌─────▼──────┐
       │              │   Events   │
       │              └─────┬──────┘
       │              ┌─────▼──────┐
       ▼              │  Indexer   │
┌──────────────┐     │ (Alchemy)  │
│  IPFS/Pinata │     └─────┬──────┘
│  (metadata)  │     ┌─────▼──────┐
└──────────────┘     │  Supabase  │
                     │  (cache)   │
                     └────────────┘
```

## Security Considerations

- **Reentrancy:** Use OpenZeppelin ReentrancyGuard on mint
- **Access control:** Ownable for admin functions, consider multisig later
- **Metadata integrity:** Onchain hash verification of IPFS content
- **Upgrade path:** Use UUPS proxy pattern (allows bug fixes without migration)
- **Rate limiting:** Max mints per block to prevent spam

## What's In Scope (v0.1)
- ✅ ERC-721 minting with metadata
- ✅ Public registry / explorer
- ✅ Wallet-based minting UI
- ✅ IPFS metadata storage
- ✅ Verified badge (admin)

## What's Deferred
- ❌ Reputation scores (Month 4)
- ❌ Attestation system (Month 4)
- ❌ Payment infrastructure (Month 6)
- ❌ Governance / DAO (Month 8+)
- ❌ Cross-chain deployment (Month 8+)
- ❌ ZK proofs for reputation (Month 10+)
