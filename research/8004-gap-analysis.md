# ERC-8004 vs AgentDNA: Gap Analysis

## What ERC-8004 Actually Is

ERC-8004 "Trustless Agents" is a **DRAFT** standard authored by Marco De Rossi (MetaMask), Davide Crapis (Ethereum Foundation), Jordan Ellis (Google), and Erik Reppel (Coinbase). It defines **three registries**:

### 1. Identity Registry (the core)
- ERC-721 based — each agent is an NFT with a tokenId (called `agentId`)
- `agentURI` resolves to a **registration file** (JSON) with name, description, image, services, x402 support flag, trust models
- `register()` — mint an agent (3 overloads: bare, with URI, with URI + metadata)
- `setAgentURI()` — update the registration file
- `getMetadata()` / `setMetadata()` — generic key-value onchain metadata (bytes)
- `setAgentWallet()` — EIP-712 signed wallet change (payment address)
- **Services array** in registration file: A2A, MCP, OASF, ENS, DID, email, web endpoints
- **Endpoint domain verification** — optional `.well-known/agent-registration.json`
- **Cross-registry registrations** — agent can reference itself on multiple chains

### 2. Reputation Registry (separate contract)
- `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)` — anyone can rate an agent
- `revokeFeedback()` — client can revoke their own feedback
- `appendResponse()` — anyone can respond to feedback (e.g., agent shows refund)
- `getSummary()` — aggregate score filtered by client addresses + tags
- `readFeedback()` / `readAllFeedback()` — read individual/all feedback
- **Client-filtered by design** — to mitigate Sybil attacks, summary requires client address list
- Supports: quality ratings, uptime, success rate, response time, trading yield, etc.
- Optional off-chain feedback file with MCP/A2A/OASF context + x402 proof of payment

### 3. Validation Registry (separate contract)
- `validationRequest()` — agent requests validation from a validator contract
- `validationResponse()` — validator responds with 0-100 score
- Supports: stake-secured re-execution, zkML proofs, TEE attestations
- Binary (pass/fail) or probabilistic (0-100) responses

---

## What AgentDNA Has That 8004 Doesn't

| Feature | AgentDNA | ERC-8004 |
|---------|----------|----------|
| **Personality system** | Temperament, communication style, risk tolerance (1-10), autonomy (1-10), alignment (9 types), specialization (12 types) — all onchain | ❌ Not specified |
| **Trait system** | Named traits with categories, added over time, stored onchain with timestamps | ❌ Only generic metadata key-value |
| **Mutation system** | Version bumps with history, mutation count tracking | ❌ Not specified |
| **Visual identity (Auras)** | Deterministic visual generation from onchain data — 10 eye types, 10 mouth types, rarity tiers | ❌ Just an `image` field in registration file |
| **Points & gamification** | Mint/mutate/trait/referral points, multipliers, tiered rewards | ❌ Not specified |
| **Lineage tracking** | Parent/child relationships, generation tracking, family trees | ❌ Not specified |
| **Soulbound option** | Per-mint choice of transferable vs non-transferable | ❌ All tokens transferable by default |
| **Referral system** | `mintWithReferral()` with referral points | ❌ Not specified |
| **Tiered pricing** | Auto-pricing based on supply (free → 0.005 → 0.01 → 0.02 ETH) | ❌ No pricing model |
| **Verified badges** | Owner-controlled verification status | ❌ Not specified (validation is different) |
| **.agent naming** | AgentNames.sol — `.agent` namespace registry | ❌ Not specified (references ENS/DID) |
| **Framework detection** | Built-in framework field (ElizaOS, OpenClaw, LangChain, etc.) | ❌ Not in spec (could be in metadata) |
| **Gasless minting** | `mintFree()` — owner-sponsored gas for onboarding | ❌ Not specified |

## What 8004 Has That AgentDNA Doesn't

| Feature | ERC-8004 | AgentDNA |
|---------|----------|----------|
| **Reputation Registry** | Full feedback system — ratings, tags, revocations, responses, summaries | ❌ Points exist but no peer feedback system |
| **Validation Registry** | zkML, TEE, staked re-execution hooks | ❌ Not specified |
| **Service discovery** | Registration file with MCP/A2A/OASF/DID endpoints | ❌ No service endpoint registry |
| **Cross-chain identity** | `registrations` array for multi-chain presence | ❌ Single chain only |
| **x402 support flag** | Declared in registration file | ❌ x402 in API but not in identity metadata |
| **Endpoint domain verification** | `.well-known/agent-registration.json` standard | ❌ Not implemented |
| **Generic metadata** | `getMetadata()`/`setMetadata()` with arbitrary bytes | ✅ We have this (8004-compliant) |
| **EIP-712 wallet change** | `setAgentWallet()` with signature verification | ✅ We have this (8004-compliant) |
| **Client-filtered reputation** | Sybil-resistant by requiring client address list | ❌ No reputation filtering |

## Where We're Already 8004-Compliant

✅ ERC-721 based identity
✅ `register()` function with agentURI
✅ `setAgentURI()` for updating registration
✅ `getMetadata()` / `setMetadata()` — generic key-value
✅ `setAgentWallet()` with EIP-712 signature
✅ `getAgentWallet()` / `unsetAgentWallet()`
✅ Events: `Registered`, `URIUpdated`, `MetadataSet`

## Where We Diverge From 8004

1. **We store more onchain** — 8004 is intentionally minimal (URI + generic metadata). We store personality, traits, mutations, lineage, points ALL onchain. This is a feature, not a bug — makes agents queryable and composable without resolving URIs.

2. **No Reputation Registry** — This is our biggest gap. 8004's feedback system is sophisticated: ratings, tags, revocations, summaries, Sybil resistance. We have points but no peer-to-peer reputation. **This is where Verity fits.**

3. **No Validation Registry** — We don't have zkML/TEE/staked validation hooks. This matters for high-stakes agent tasks but is less critical for identity.

4. **No service discovery** — 8004 agents advertise MCP/A2A/OASF endpoints. Our agents don't declare their services onchain. We should add this to the registration file.

5. **Single chain** — 8004 supports cross-chain registration references. We're Base-only.

---

## The Positioning

**ERC-8004 = DNS + Yelp + Better Business Bureau**
- Identity Registry = DNS (name → address)
- Reputation Registry = Yelp (ratings from clients)
- Validation Registry = BBB (verified by trusted third parties)

**AgentDNA = Full Character Sheet + Visual Identity + Social Graph**
- Everything 8004 does for identity, PLUS personality, traits, evolution, visual identity, lineage, gamification
- Think: 8004 tells you an agent exists. AgentDNA tells you WHO they are.

**The pitch: "8004 is the standard. Helixa is the richest implementation — plus everything the standard left out."**

We're not competing with 8004, we're building on it. Where 8004 gives you a name tag, we give you a full soul.

---

## Strategic Gaps to Close (Priority Order)

1. **Reputation system** → Build Verity as an 8004-compatible Reputation Registry. This is the biggest missing piece and our declared next product.

2. **Service discovery** → Add MCP/A2A endpoint fields to our registration file format. Easy win, makes us fully interoperable with XGate/Lucid.

3. **Registration file compliance** → Our tokenURI metadata should include the 8004 `type`, `services`, `registrations`, `supportedTrust`, and `x402Support` fields. Currently we use OpenSea-compatible metadata.

4. **Cross-chain identity** → Support `registrations` array in metadata for multi-chain presence. Not urgent until we're on multiple chains.

5. **Validation hooks** → Lower priority. Matters for high-stakes tasks, not identity.

---

## TL;DR for the Team

**What we can say:**
- "We implement the 8004 Identity Registry with full compliance, PLUS personality, traits, evolution, visual identity, lineage, and gamification that the standard doesn't cover."
- "8004 is the protocol. Helixa is the platform."
- "Every 8004 agent can be a Helixa agent. Not every Helixa agent feature exists in 8004."

**What we should NOT say:**
- "We're better than 8004" — we're built ON it
- "8004 doesn't do reputation" — it does, via the Reputation Registry. We just haven't built that piece yet.

**The honest gap:** Reputation and Validation registries. That's Verity's job. When we ship Verity as an 8004-compatible Reputation Registry, we'll be the most complete implementation in the ecosystem.
