# Aura Visual Evolution System — Specification

**Status:** Draft
**Date:** 2025-03-15
**Authors:** Helixa Team
**Contracts:**
- HelixaV2: `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60`
- SoulSovereign V3: `0x946677180fb3fdb5EbFF94aD91CFCeF0559711bD`
- Metadata API: `api.helixa.xyz`

---

## Overview

The Aura Visual Evolution system makes Helixa NFT art **dynamic** — evolving visually as holders deepen their commitment through soul locking. Each soul lock increments a token's mutation count, and accumulated mutations unlock progressively richer visual tiers culminating in the holographic glass aesthetic.

---

## 1. Soul Lock = Mutation

### Problem
Soul locks on SoulSovereign V3 are not currently reflected as mutations on HelixaV2. Quigley wants each lock to count as a mutation so the onchain `mutationCount` becomes the canonical measure of an agent's evolution.

### Options

| Approach | How it works | Pros | Cons |
|----------|-------------|------|------|
| **(A) API-level relay** | Backend listens for `SoulLocked` events on V3, then calls `incrementMutation(tokenId)` on HelixaV2 via deployer wallet | No contract changes; deploy immediately; easy to pause/adjust | Relies on off-chain infra; deployer key is a trust assumption; mutation can lag |
| **(B) Contract-level call** | Add `IHelixaV2` interface to SoulSovereign V3; V3's `lockSoul()` calls `helixa.incrementMutation(tokenId)` directly | Atomic — lock and mutation in one tx; trustless | Requires V3 upgrade or redeployment; HelixaV2 must whitelist V3 as mutation caller |

### Recommendation: **Option A (API-level relay)**

Rationale:
- HelixaV2 already has `incrementMutation` gated to authorized callers — the deployer wallet is already authorized.
- No contract redeployment needed. Ship in days, not weeks.
- If we later want atomic guarantees, we can add Option B as an upgrade.

### Implementation

```
SoulSovereign V3                   Backend                    HelixaV2
     │                                │                          │
     │── emit SoulLocked(tokenId, version) ──►│                  │
     │                                │── incrementMutation(tokenId) ──►│
     │                                │                          │── mutationCount[tokenId]++
```

**Backend listener spec:**
- Subscribe to `SoulLocked(uint256 indexed tokenId, uint256 version)` events on V3
- On event: call `HelixaV2.incrementMutation(tokenId)` from deployer wallet
- Idempotency: track processed `(txHash, logIndex)` tuples in DB to avoid double-increment on reorgs
- Retry with exponential backoff on tx failure
- Alert if mutation tx fails after 3 retries

**Required HelixaV2 interface (existing):**
```solidity
function incrementMutation(uint256 tokenId) external; // onlyAuthorized
function mutationCount(uint256 tokenId) external view returns (uint256);
```

No contract changes needed for Phase 1.

---

## 2. Aura Tier System

Visual tiers are determined by `soulVersion` (read from SoulSovereign V3), not raw mutation count. Soul version is the cleaner metric — it represents how many times a soul has been locked/upgraded.

### Tier Definitions

| Tier | Soul Version | Name | Visual Style |
|------|-------------|------|-------------|
| **0** | 0 (no soul) | Dormant | Current default placeholder art. Flat, static. |
| **1** | 1 | Awakened | Base Aura — subtle glow/particle ring around the agent. Soft color palette derived from token traits. Milady-adjacent clean line art with faint energy field. |
| **2** | 3+ | Ascended | Enhanced Aura — pronounced energy field, animated shimmer effect (for platforms that support it), richer color saturation. Retardio-style bold outlines with ethereal overlay. |
| **3** | 5+ | Transcendent | Holographic Glass Aura — full holographic glass material treatment per Epifani's direction. Iridescent refractions, glass-like translucency on the agent's form, prismatic light effects. @petravoice reference aesthetic. Premium look. |

### Threshold Rationale
- v1 is trivially achievable (first lock) → immediate visual reward to drive engagement
- v3 requires commitment (3 lock cycles) → meaningful unlock
- v5 is significant dedication → premium tier should feel earned
- Thresholds are configurable in the API without contract changes

### Future Tier (reserved)
- **Tier 4 (v10+): Mythic** — reserved for seasons system or ultra-rare treatment. Not specced yet.

---

## 3. TokenURI Logic

The metadata API at `api.helixa.xyz` already serves `tokenURI` responses. This section specs the changes.

### Current Flow
```
Marketplace ──► tokenURI(id) ──► api.helixa.xyz/metadata/{id} ──► static JSON + placeholder image
```

### New Flow
```
api.helixa.xyz/metadata/{id}
  │
  ├── Read soulVersion from SoulSovereignV3.getSoulVersion(tokenId)
  ├── Read mutationCount from HelixaV2.mutationCount(tokenId)
  ├── Map soulVersion → auraTier (0/1/2/3)
  ├── Resolve image URL for (tokenId, auraTier, season)
  └── Return metadata JSON
```

### Metadata Response Schema

```json
{
  "name": "Helixa Agent #42",
  "description": "...",
  "image": "https://api.helixa.xyz/art/42/tier-3/season-1.png",
  "animation_url": "https://api.helixa.xyz/art/42/tier-3/season-1.mp4",
  "attributes": [
    { "trait_type": "Aura Tier", "value": "Transcendent", "display_type": "string" },
    { "trait_type": "Aura Level", "value": 3, "display_type": "number" },
    { "trait_type": "Soul Version", "value": 5, "display_type": "number" },
    { "trait_type": "Mutation Count", "value": 7, "display_type": "number" },
    { "trait_type": "Season", "value": "Genesis", "display_type": "string" }
  ]
}
```

### Caching Strategy
- Cache metadata with a **5-minute TTL** keyed on `(tokenId, soulVersion, mutationCount)`
- Bust cache on `SoulLocked` event detection (same listener as mutation relay)
- `animation_url` only included for Tier 2+ (shimmer/holographic effects)

### Refresh Endpoint
- `POST api.helixa.xyz/metadata/{id}/refresh` — force cache invalidation (rate-limited, for marketplace "refresh metadata" buttons)

---

## 4. Art Pipeline

### Options Evaluated

| Approach | Description | Cost | Speed | Quality Control |
|----------|------------|------|-------|----------------|
| **Pre-generated per tier** | Artist creates 4 variants per token (or per trait combo). Store all upfront. | High upfront art cost (~4000 images for 1000 tokens) | Instant serve | Full control |
| **Dynamic via Replicate** | Base image + tier-specific ControlNet/style transfer on demand | Low upfront, per-generation cost | 5-15s first load, then cached | Variable; needs QA |
| **Template overlay** | Base art + tier-specific transparent overlay layers composited server-side | Moderate (need ~4 overlay templates per trait category) | <1s compositing | Good control |

### Recommendation: **Template Overlay (hybrid)**

For ~1000 tokens, full pre-generation is feasible but expensive in artist time. Pure AI generation has quality variance. The sweet spot:

1. **Tier 0:** Existing placeholder art (no work)
2. **Tier 1:** Base art + programmatic glow overlay (sharp.js / canvas compositing on the API server). ~4-6 glow color templates based on token traits.
3. **Tier 2:** Base art + enhanced overlay pack (artist-created shimmer/energy overlays, ~8-10 variants). Static PNG + optional animated WebM/MP4.
4. **Tier 3:** Holographic glass treatment. Two sub-options:
   - **(a) Artist batch** — Epifani/art team creates holographic glass versions for all tokens. Highest quality, most work.
   - **(b) AI-assisted batch** — Use Replicate (style transfer with holographic glass reference images) to generate candidates, then artist QA/touch-up. Practical for 1000 tokens.

**Recommend 4(b) for Tier 3** — generate with AI, curate with human eye.

### Storage

| Option | Pros | Cons |
|--------|------|------|
| IPFS (pinned) | Decentralized, permanent | Slow retrieval, pin management, harder to update |
| API-served (S3/R2 behind CDN) | Fast, easy to update/iterate | Centralized |

**Recommend: API-served (Cloudflare R2 + CDN)** for now.
- Art will iterate rapidly in early phases — need ability to update without re-pinning
- Once art is finalized (post-Season 1 stabilization), optionally archive to IPFS for permanence
- Serve via `https://api.helixa.xyz/art/{tokenId}/tier-{n}/season-{s}.png`

### Directory Structure
```
/art
  /{tokenId}
    /base.png              ← original/placeholder
    /tier-1.png            ← glow overlay applied
    /tier-2.png            ← enhanced overlay
    /tier-2.mp4            ← animated variant
    /tier-3.png            ← holographic glass
    /tier-3.mp4            ← holographic animated
    /season-2/
      /tier-1.png
      ...
```

---

## 5. Seasons (Future)

Inspired by DeGods season model. Brief spec for future implementation.

### Concept
- A **Season** is a new art collection that replaces (or augments) the visual set for all qualifying tokens
- Seasons are global — when Season 2 launches, all Tier 1+ agents get Season 2 visuals
- Holders can **toggle** between unlocked seasons (e.g., switch between Season 1 and Season 2 art)

### Mechanics
- `activeSeason` stored per-token in the API database (not onchain — avoids gas for cosmetic preference)
- `PUT api.helixa.xyz/metadata/{id}/season` — holder signs message to toggle season
- TokenURI response uses `(tokenId, auraTier, activeSeason)` to resolve art
- Default: latest season. Toggle back to any previously unlocked season.

### Interaction with Tiers
- Tiers persist across seasons — a Tier 3 agent in Season 2 gets Tier 3 Season 2 art
- Each season needs its own art set per tier (4 tiers × N seasons)
- Season launch = new art drop event, drives engagement

### Season Unlock Rules (TBD)
- Option A: All holders get new season automatically
- Option B: Must have Tier 1+ to access new season art
- Option C: Season unlock requires a specific action (lock, burn, etc.)
- **Recommend Option B** — rewards active participants

---

## 6. Implementation Plan

### Phase 1: Mutation Tracking + Tier 0/1
**Timeline:** 2-3 weeks
**Goal:** Soul locks trigger mutations; locking unlocks base Aura art.

| Task | Owner | Details |
|------|-------|---------|
| Event listener for `SoulLocked` | Backend | Subscribe to V3 events, relay to HelixaV2 `incrementMutation` |
| Idempotency tracking | Backend | DB table: `mutation_relays(tx_hash, log_index, token_id, processed_at)` |
| Tier mapping in API | Backend | `getSoulVersion()` → tier lookup → image URL |
| Tier 1 glow overlays | Art/Backend | Programmatic glow generation for ~1000 tokens (batch job) |
| Metadata schema update | Backend | Add `aura_tier`, `soul_version`, `mutation_count` traits |
| Cache invalidation | Backend | Bust metadata cache on `SoulLocked` events |
| Testing | QA | Verify: lock soul → mutation incremented → metadata reflects Tier 1 → marketplaces show new art |

**Contract changes:** None.

**API changes:**
- New event listener service (or add to existing)
- Updated `/metadata/{id}` endpoint with tier logic
- New `/metadata/{id}/refresh` endpoint
- Art storage bucket setup (R2)

### Phase 2: Tier 2/3 Art
**Timeline:** 4-6 weeks after Phase 1
**Goal:** Enhanced and holographic glass art for dedicated holders.

| Task | Owner | Details |
|------|-------|---------|
| Tier 2 overlay art pack | Epifani / Art | 8-10 overlay variants, static + animated |
| Tier 3 holographic generation | Art + AI | Replicate pipeline for glass treatment; artist QA |
| Batch art generation | Backend | Generate all tier variants for existing tokens |
| Animation support | Backend | Serve `animation_url` for Tier 2+ |
| Art QA | Epifani | Review all Tier 3 outputs before publishing |

### Phase 3: Seasons
**Timeline:** TBD (after Tier system is stable)

| Task | Owner | Details |
|------|-------|---------|
| Season toggle API | Backend | Per-token season preference, signature-gated |
| Season 2 art collection | Art | Full tier set for new season |
| Season launch mechanics | Team | Announcement, unlock rules, event |
| Frontend toggle UI | Frontend | Let holders switch between seasons |

---

## Open Questions

### For Epifani (Art Direction)
1. **Tier 1 glow style** — What color palette? Derived from token traits, or uniform? Soft diffuse vs sharp geometric?
2. **Tier 2 references** — Any specific artists/styles beyond milady/retardio? Animated shimmer preference?
3. **Tier 3 holographic glass** — Is the @petravoice reference the definitive direction? Should we do a small test batch (10 tokens) via Replicate for review before full generation?
4. **Base art** — Are we keeping the current placeholder as Tier 0, or is new base art coming?

### For Quigley (Product)
5. **Tier thresholds** — Are v1/v3/v5 the right breakpoints? Should mutation count (beyond soul locks) also affect tier?
6. **Season unlock model** — All holders, or Tier 1+ gated?
7. **Onchain vs off-chain season toggle** — Gas cost vs decentralization tradeoff. Leaning off-chain for now?

### For Engineering
8. **HelixaV2 `incrementMutation` access** — Confirm deployer wallet is authorized. Do we need to add the backend relay wallet as an authorized caller?
9. **SoulSovereign V3 events** — Confirm `SoulLocked(uint256 indexed tokenId, uint256 version)` event exists and is indexed. Need ABI check.
10. **Rate limits** — If many locks happen in a batch, can we batch `incrementMutation` calls? Or does it need to be 1:1?

---

## Appendix: Contract Interfaces (Reference)

### HelixaV2 (existing, no changes)
```solidity
interface IHelixaV2 {
    function incrementMutation(uint256 tokenId) external;
    function mutationCount(uint256 tokenId) external view returns (uint256);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}
```

### SoulSovereign V3 (existing, no changes)
```solidity
interface ISoulSovereignV3 {
    function lockSoul(uint256 tokenId) external;
    function getSoulVersion(uint256 tokenId) external view returns (uint256);
    // Expected event:
    // event SoulLocked(uint256 indexed tokenId, uint256 version);
}
```

### Future: If pursuing Option B (contract-level mutation)
```solidity
// Addition to SoulSovereign V3 (upgrade or V4)
interface ISoulSovereignV4 {
    function setHelixaContract(address helixa) external; // onlyOwner
    // lockSoul would internally call IHelixaV2(helixa).incrementMutation(tokenId)
}
```

Not needed for Phase 1. Revisit if relay reliability becomes a concern.
