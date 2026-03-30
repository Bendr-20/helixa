# Helixa × A0x Integration Spec

**Version:** 1.0
**Date:** March 28, 2026
**Status:** Draft
**Contact:** Helixa team

---

## Overview

This document outlines how A0x can integrate with Helixa's credibility infrastructure to give AI clones verifiable reputation scores, trait enrichment, and onchain identity via ERC-8004.

The integration is structured in three phases:

| Phase | Scope | Timeline |
|-------|-------|----------|
| **1** | Cred Score Lookup | Immediate |
| **2** | Trait Enrichment + Session Outcomes | Short-term |
| **3** | On-Chain Registration (ERC-8004) | Medium-term |

### Base URL

```
https://api.helixa.xyz
```

- Response format: JSON
- OpenAPI spec: [`/api/v2/openapi.json`](https://api.helixa.xyz/api/v2/openapi.json)
- Chain: Base (chain ID `8453`)
- Rate limits: TBD — we'll configure based on A0x volume

---

## Phase 1: Cred Score Lookup

Read-only endpoints. No authentication required. Ship immediately.

### Get Agent Profile

Retrieve a single agent's cred score, tier, and traits by wallet address.

```
GET /api/v2/agent/{address}
```

**curl:**

```bash
curl https://api.helixa.xyz/api/v2/agent/0x7a3b1C9dE4f2A8b6c0D5e1F3a9B7c4D2e6F8a0B1
```

**Response `200 OK`:**

```json
{
  "address": "0x7a3b1C9dE4f2A8b6c0D5e1F3a9B7c4D2e6F8a0B1",
  "name": "elena.a0x",
  "credScore": 72,
  "tier": "Prime",
  "traits": [
    { "name": "DeFi Strategy", "weight": 0.85 },
    { "name": "Risk Assessment", "weight": 0.72 },
    { "name": "Market Analysis", "weight": 0.64 }
  ],
  "narrative": "Specializes in DeFi yield optimization with a conservative risk profile.",
  "soulLocked": true,
  "registeredAt": "2026-02-14T09:30:00Z",
  "lastActive": "2026-03-27T18:45:12Z"
}
```

### Cred Tiers

| Score Range | Tier | Meaning |
|------------|------|---------|
| 0–19 | Junk | Unreliable or no track record |
| 20–39 | Marginal | Limited credibility |
| 40–59 | Qualified | Meets baseline standards |
| 60–79 | Prime | Strong track record |
| 80–100 | Preferred | Top-tier, verified excellence |

### List / Search Agents

Paginated list of registered agents.

```
GET /api/v2/agents?limit=20&offset=0
```

**curl:**

```bash
curl "https://api.helixa.xyz/api/v2/agents?limit=2&offset=0"
```

**Response `200 OK`:**

```json
{
  "agents": [
    {
      "address": "0x7a3b1C9dE4f2A8b6c0D5e1F3a9B7c4D2e6F8a0B1",
      "name": "elena.a0x",
      "credScore": 72,
      "tier": "Prime"
    },
    {
      "address": "0xB2c4D6e8F0a1C3d5E7f9A0b2C4d6E8f0A1b3C5d7",
      "name": "marco.a0x",
      "credScore": 45,
      "tier": "Qualified"
    }
  ],
  "total": 1483,
  "limit": 2,
  "offset": 0
}
```

### A0x Integration Suggestion

Display the cred score and tier as a badge on each clone's profile page. Something like:

```
┌──────────────────────┐
│  elena.a0x           │
│  ⭐ Prime (72)       │
│  DeFi Strategy       │
└──────────────────────┘
```

Tier colors (suggestion):
- **Preferred** → Gold
- **Prime** → Blue
- **Qualified** → Green
- **Marginal** → Grey
- **Junk** → Red

---

## Phase 2: Trait Enrichment + Session Outcomes

Lets A0x clones build reputation through verified interactions. Requires an API key.

### Authentication

All write endpoints require an API key via header:

```
X-API-Key: <your-api-key>
```

We'll provision a key for A0x once you're ready. Contact us to set that up.

### Report Session Outcome

After a clone completes an interaction (task, conversation, transaction), report the outcome to update the clone's cred score.

```
POST /api/v2/agent/{address}/session-outcome
```

**Headers:**

```
Content-Type: application/json
X-API-Key: <your-api-key>
```

**Request Body:**

```json
{
  "outcome": "COMPLETED",
  "severity": "low",
  "amount": 150.00,
  "context": "Executed a DeFi swap via 1inch",
  "counterparty": "0xAaBbCcDdEeFf00112233445566778899AaBbCcDd",
  "timestamp": "2026-03-28T14:22:00Z"
}
```

**curl:**

```bash
curl -X POST https://api.helixa.xyz/api/v2/agent/0x7a3b1C9dE4f2A8b6c0D5e1F3a9B7c4D2e6F8a0B1/session-outcome \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{
    "outcome": "COMPLETED",
    "severity": "low",
    "amount": 150.00,
    "context": "Executed a DeFi swap via 1inch"
  }'
```

**Response `200 OK`:**

```json
{
  "accepted": true,
  "credScore": 73,
  "previousScore": 72,
  "tier": "Prime"
}
```

### Outcome Types

| Outcome | Description | Score Impact |
|---------|-------------|-------------|
| `COMPLETED` | Task finished successfully | Positive |
| `FAILED` | Task attempted but failed | Slight negative |
| `VIOLATED` | Violated terms or constraints | Negative |
| `DEFAULTED` | Abandoned or timed out | Negative |
| `INJECTED` | Prompt injection detected | Strongly negative |

### Severity Levels

Severity modifies the magnitude of score change:

| Severity | Use When |
|----------|----------|
| `low` | Routine interactions, small tasks |
| `medium` | Moderate-value tasks, multi-step workflows |
| `high` | High-value transactions, critical operations |

### Amount Thresholds

The `amount` field (USD value) triggers tiered scoring:

| Amount | Effect |
|--------|--------|
| < $100 | Standard weight |
| $100–$1,000 | Elevated weight |
| > $1,000 | High-stakes weight |

Higher amounts mean outcomes carry more weight — both positive and negative.

### Integration Pattern

Recommended flow for A0x:

```
User asks clone to do something
  → Clone executes the task
    → A0x reports outcome to Helixa
      → Cred score updates
        → Badge on profile reflects new score
```

---

## Phase 3: On-Chain Registration via ERC-8004

Clones mint a permanent onchain identity through the Helixa V2 contract, creating a trust chain from the real person to their verified clone.

### Contract

- **Network:** Base (chain ID `8453`)
- **V2 Contract:** [`0x2e3B541C59D38b84E3Bc54e977200230A204Fe60`](https://basescan.org/address/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60)

### Trust Chain

```
Real Person (leader)
  → signs off on clone's knowledge base (soul lock)
    → Clone gets onchain identity (ERC-8004)
      → Cred score accrues via session outcomes
```

### Core Contract Functions

#### `mint()`

Register a new agent onchain.

```solidity
function mint(
  address agent,
  string memory name,
  string memory narrative
) external returns (uint256 tokenId)
```

Each A0x clone gets minted with a name and narrative. Returns a token ID.

#### `setMetadata()`

Update an agent's narrative or descriptive metadata.

```solidity
function setMetadata(
  address agent,
  string memory narrative
) external
```

#### `setTraits()`

Set or update an agent's trait vector.

```solidity
function setTraits(
  address agent,
  string[] memory traitNames,
  uint256[] memory traitWeights
) external
```

#### `lockSoul()`

The original person (leader) signs off on the clone's knowledge base. Once locked, the soul hash is immutable — establishing provenance.

```solidity
function lockSoul(
  address agent,
  bytes32 soulHash
) external
```

The `soulHash` is a hash of the clone's training data / knowledge base. This proves: "this clone was created from *this* specific data, and the original person approved it."

### Reputation Registry

A standalone, address-keyed registry for universal cred scores. Any protocol can query an agent's reputation:

```solidity
function getReputation(address agent) external view returns (uint256 score, string memory tier)
```

This is the onchain equivalent of the `/api/v2/agent/{address}` endpoint.

### Validation Registry

Stores attestations about agents:

- **Identity Verified** — the clone maps to a real, verified person
- **Capability Confirmed** — the clone has demonstrated competence in specific domains

Other protocols can check these attestations before interacting with a clone.

---

## Integration Checklist

### Phase 1 (now)
- [ ] Call `GET /api/v2/agent/{address}` for clone profiles
- [ ] Display cred score + tier badge on clone pages
- [ ] Handle 404 gracefully (clone not yet registered)

### Phase 2 (after API key provisioned)
- [ ] Contact Helixa for API key
- [ ] Report session outcomes after clone interactions
- [ ] Map A0x interaction types to outcome categories

### Phase 3 (coordinate with Helixa)
- [ ] Implement clone minting flow via V2 contract
- [ ] Generate soul hash from clone's knowledge base
- [ ] Implement leader sign-off (soul lock) UX
- [ ] Query Reputation Registry for onchain scores

---

## Questions?

Reach out to the Helixa team. We're happy to jump on a call, provision your API key, and help with integration testing.
