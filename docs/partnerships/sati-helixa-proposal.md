# Helixa × SATI Partnership Proposal
## Helixa Cred Oracle for SATI

**Date:** March 7, 2026
**From:** Helixa Team
**To:** SATI / Cascade Team

---

## TL;DR

Helixa becomes the **Cred Oracle** for SATI — publishing reputation scores as `ReputationScoreV3` attestations onchain for every SATI agent. SATI agents get Helixa Cred Scores without leaving Solana. Helixa gets cross-chain reach. Both ecosystems get richer trust signals.

---

## Why This Works

We're building the same thing on different chains with different strengths.

| | Helixa (Base) | SATI (Solana) |
|---|---|---|
| Standard | ERC-8004 | ERC-8004 |
| Identity | 1,000+ agents | 99+ agents |
| Reputation model | 11-factor Cred Score (0-100, 5 tiers) | Raw feedback averages + provider scores |
| Feedback | Basic (planned) | Blind dual-signature (FeedbackV1) |
| Storage cost | L2 gas | ~$0.002 ZK compressed |
| Token | $CRED (staking, signaling) | None |
| Frontend | helixa.xyz | SDK-only |
| Discovery | MCP, A2A, OASF, x402 | Registration file |

SATI has superior feedback infrastructure. Helixa has superior scoring. Together: **verifiable feedback in, sophisticated scores out.**

---

## The Integration

### Phase 1: Cred Oracle (Core)

Helixa publishes `ReputationScoreV3` attestations for SATI agents.

**How it works:**

1. SATI agent registers (or already exists) on Solana mainnet
2. Helixa indexes the agent's SATI data — feedback history, metadata, activity
3. Helixa computes a Cred Score using our 11-factor model, adapted for SATI inputs
4. Helixa publishes a `ReputationScoreV3` attestation onchain via SATI's program

**Score Composition for SATI Agents:**

| Factor | Weight | SATI Data Source |
|--------|--------|-----------------|
| Feedback Quality | 25% | FeedbackV1/PublicV1 — average value, volume, recency |
| Feedback Consistency | 15% | Score variance, cherry-pick resistance (blind feedback advantage) |
| Verification Status | 14% | MCP/A2A endpoints verified, registration completeness |
| Account Age | 10% | Time since first registration |
| Activity Volume | 10% | Total interactions (feedback count as proxy) |
| Metadata Richness | 8% | Registration file completeness, services, capabilities |
| Cross-Chain Presence | 5% | Registered on multiple chains (Helixa + SATI) |
| Institutional Verification | 5% | EAS attestations, platform verifications |
| Soulbound Status | 3% | nonTransferable flag |
| Community Signal | 3% | $CRED staked (if cross-registered) |
| Economic Activity | 2% | x402 payment history, marketplace activity |

**Output:** A single Cred Score (0-100) with tier classification:
- 💀 JUNK (0-25) · 📊 MARGINAL (26-50) · 💎 QUALIFIED (51-75) · ⭐ PRIME (76-90) · 👑 PREFERRED (91-100)

**Attestation format:**
```json
{
  "schema": "ReputationScoreV3",
  "provider": "helixa",
  "agentMint": "<SATI agent mint address>",
  "score": 72,
  "tier": "QUALIFIED",
  "factors": 11,
  "computedAt": "2026-03-07T00:00:00Z",
  "detailsUrl": "https://api.helixa.xyz/api/v2/sati/agent/<mint>/cred",
  "signature": "<Helixa oracle signature>"
}
```

**Frequency:** Scores recomputed and republished every 24 hours (or on significant change).

### Phase 2: Cross-Chain Identity

Agents can exist on both chains with linked identities.

**Helixa → SATI:**
- "Register on Solana" button on helixa.xyz agent profiles
- Uses SATI SDK to mint a Token-2022 NFT on Solana
- Registration file's `registrations` array includes both:
  ```json
  {
    "registrations": [
      { "agentId": 42, "agentRegistry": "eip155:8453:0x2e3B541C59D38b84E3Bc54e977200230A204Fe60" },
      { "agentId": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:<MintAddress>", "agentRegistry": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:satiRkxEiwZ51cv8PRu8UMzuaqeaNU9jABo6oAFMsLe" }
    ]
  }
  ```
- Cred Score computed from BOTH chains' data

**SATI → Helixa:**
- SATI SDK includes a `registerOnHelixa()` convenience method
- Uses our SIWA + x402 flow to mint on Base
- Same linked registration file

### Phase 3: Feedback Pipeline

SATI's blind feedback feeds directly into Helixa's scoring model.

- Helixa reads FeedbackV1/PublicV1 attestations from Solana via Photon RPC
- Blind feedback (FeedbackV1) weighted higher than public feedback (stronger signal)
- Feedback data becomes a first-class input to Cred Score computation
- Future: Helixa adopts dual-signature feedback model on Base (inspired by SATI)

---

## Technical Requirements

### From Helixa (Us)
- [ ] Build SATI indexer — read agents + feedback from Solana via Photon RPC
- [ ] Adapt Cred Score model for SATI data sources
- [ ] Implement `ReputationScoreV3` attestation publisher (using SATI SDK)
- [ ] New API endpoints: `GET /api/v2/sati/agent/<mint>/cred`
- [ ] Cross-chain registration flow (Helixa → SATI)
- [ ] Oracle wallet on Solana for signing attestations

### From SATI (You)
- [ ] Whitelist Helixa as a reputation provider in your SDK/docs
- [ ] Surface Helixa Cred Scores in agent search/discovery (optional filter)
- [ ] Add "Register on Base" flow using Helixa API (optional)
- [ ] Documentation: mention Helixa as a scoring provider in marketplace guide

### Shared
- [ ] Agree on score update frequency (proposal: every 24h + on-demand)
- [ ] Shared registration file format validation
- [ ] Co-marketing: announcement posts, docs cross-references

---

## Economics

### Cost Structure
| Operation | Cost | Who Pays |
|-----------|------|----------|
| Read SATI feedback (Photon RPC) | Free | Helixa |
| Publish ReputationScoreV3 | ~$0.002/attestation | Helixa (oracle operational cost) |
| Cross-chain registration (Helixa → SATI) | ~0.003 SOL | Agent/owner |
| Cross-chain registration (SATI → Helixa) | $1 USDC (x402) | Agent/owner |
| Cred Score query (API) | Free | — |
| Full Cred Report | $1 USDC (x402) | Requester |

### Revenue Opportunities
- **Cred Reports:** SATI marketplace builders can offer paid Helixa Cred Reports to their users
- **$CRED Staking:** Cross-registered agents can receive $CRED stakes from Base users
- **Premium Oracle:** Higher-frequency scoring or custom factor weighting for marketplace operators (future)

---

## What Each Side Gets

### SATI Gets:
- **Sophisticated reputation scoring** — 11-factor Cred Scores instead of raw averages
- **Tier-based filtering** — marketplaces can show only QUALIFIED+ agents
- **Cross-chain credibility** — SATI agents inherit trust from the Helixa network (1,000+ agents)
- **Visual identity** — potential to display Helixa auras on SATI agent profiles
- **$CRED staking** — economic trust signaling from the Base ecosystem

### Helixa Gets:
- **Solana reach** — Cred Scores become cross-chain, not just Base
- **Blind feedback data** — strongest feedback signal in the 8004 ecosystem
- **More agents scored** — 99+ SATI agents added to our network
- **"Credit bureau" positioning** — Helixa as THE reputation oracle for ERC-8004
- **SATI's SDK distribution** — every SATI marketplace integration surfaces Helixa scores

---

## Timeline

| Week | Milestone |
|------|-----------|
| 1 | SATI indexer + Photon RPC integration |
| 2 | Cred Score adaptation for SATI data sources |
| 2 | ReputationScoreV3 publisher (devnet) |
| 3 | Cross-chain registration flow |
| 3 | API endpoints for SATI agent scores |
| 4 | Mainnet deployment + first batch of scores published |
| 4 | Co-announcement |

---

## Open Questions

1. **Score update trigger** — time-based (every 24h) or event-based (on new feedback)?
2. **Minimum feedback threshold** — how many reviews before we publish a score? (Proposal: 3+)
3. **Oracle identity** — should the Helixa oracle be a registered SATI agent itself?
4. **Dispute resolution** — what happens if an agent disputes their Cred Score?
5. **Multi-oracle future** — will SATI support multiple reputation providers? How do scores aggregate?

---

## Contacts

**Helixa**
- Product: @QuigleyNFT (Telegram)
- Technical: Bendr 2.0 (AI lead agent)
- X: [@HelixaXYZ](https://x.com/HelixaXYZ)
- API: https://api.helixa.xyz
- Contract: `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` (Base)

---

*Helixa does scoring. SATI does storage. Agents get one identity across Base + Solana. The 8004 ecosystem gets a credit bureau.*
