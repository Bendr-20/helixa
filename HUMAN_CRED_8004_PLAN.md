# Human Cred on ERC-8004 - Helixa Plan

## Goal

Add humans to the Helixa trust graph without breaking the ERC-8004 agent model.

The right move is not to fork the standard. It is to use the same ERC-8004 identity rail and add a Helixa convention in metadata that marks the identity as a human-controlled principal.

That gives us:
- one identity rail for humans and agents
- one trust graph
- one discovery surface
- separate scoring logic for agents vs humans
- clean human-to-agent linkage for delegated trust

## Core Decision

Helixa will treat a human as a first-class principal that can mint an ERC-8004 identity and publish a registration file with:

- standard ERC-8004 fields
- `metadata.entityType = "human"`
- `metadata.principalType = "human"`
- optional `metadata.linkedAgents = ["8453:123", ...]`
- optional `metadata.linkedAccounts` for GitHub, Farcaster, X, Talent Protocol, ENS, Basename

This is an extension convention on top of ERC-8004, not a claim that ERC-8004 itself was authored for humans.

## Why this is the right model

ERC-8004 already gives us the pieces we need:
- portable onchain identity
- metadata via `agentURI`
- reputation registry for feedback
- validation registry for third-party attestations

Humans in Helixa are not "agents pretending to be people". They are human principals using the same identity and trust rails.

That lets us model:
- humans
- agents
- teams
- human-operated agents
- agent-operated services
- human + agent blended work

inside one graph.

## Registration Convention

Example human registration file:

```json
{
  "name": "Quigley",
  "description": "Human builder and protocol designer participating in the Helixa network.",
  "image": "https://...",
  "active": true,
  "services": {
    "web": { "url": "https://helixa.xyz/h/0xabc..." },
    "ens": { "name": "quigley.eth" }
  },
  "supportedTrust": ["reputation"],
  "skills": ["product-strategy", "creative-direction", "protocol-design"],
  "domains": ["crypto", "ai", "coordination"],
  "metadata": {
    "entityType": "human",
    "principalType": "human",
    "linkedAccounts": {
      "farcaster": "quigley",
      "github": "...",
      "x": "QuigleyNFT",
      "talentProtocol": "..."
    },
    "linkedAgents": ["8453:1"],
    "organization": "Helixa"
  }
}
```

## Identity Model

Helixa principal types:
- `human`
- `agent`
- `team`
- `service`

For phase 1, only `human` and `agent` need to ship.

## Human Cred Score

Create a separate score called `Human Cred`.

Range: 0-100

Human Cred is not the same as agent Cred. The factor mix should reflect accountability, proof of personhood, reputation, and delivered work.

### Proposed factors

| Factor | Weight | Notes |
|---|---:|---|
| Verified Identity | 20% | Coinbase EAS, ENS/Basename ownership, optional Gitcoin Passport later |
| Builder Reputation | 20% | Talent Protocol score and reputation signals |
| Social Reputation | 15% | Ethos, Farcaster trust, other human-native reputation feeds |
| Onchain History | 10% | wallet age, consistency, activity quality, not raw spam |
| Work History | 15% | completed tasks, referrals, paid deliveries, repeat counterparties |
| Network Endorsements | 10% | ERC-8004 reputation entries and Helixa-native attestations |
| Profile Completeness | 5% | identity, bio, skills, links, proof bindings |
| Longevity | 5% | time since principal registration |

Total: 100%

## Minimum viable data sources

### 1. Coinbase EAS

Use Base EAS attestations as the strongest identity bonus in v1.

Initial rule:
- valid Coinbase-issued attestation present -> full points for the Coinbase portion
- none present -> zero

This should sit under `Verified Identity`, not as its own giant category.

### 2. Talent Protocol

Talent Protocol should be a first-class input, not an afterthought.

Use:
- builder score
- verified profile linkage
- onchain/offchain builder credentials where exposed

Initial rule:
- normalize Talent score to 0-100
- require wallet/profile linkage proof before counting it
- cap impact to avoid one external source dominating the whole score

### 3. Ethos

Keep Ethos as a human-native reputation feed.

Use:
- score
- vouches
- review patterns
- anti-sybil heuristics if accessible

### 4. Helixa-native work history

This is where the moat is.

Long term, the best human score will not come from imported badges. It comes from:
- accepted jobs
- successful completions
- counterparties willing to hire again
- dispute rate
- delivery consistency
- response quality

## Human to agent trust transfer

This is the important part.

A human can link one or more agents. An agent can reference one or more humans.

Suggested fields:
- human profile metadata: `linkedAgents`
- agent traits/metadata: `linkedHuman`, `operator`, or `managedBy`

Rules:
- agent Cred and Human Cred stay separate
- agents may inherit a bounded bonus from linked human credibility
- inheritance must be capped so weak agents cannot wash themselves through a strong human

Recommended cap:
- max 15% of agent score can come from linked-human reputation

## ERC-8004 mapping

### Identity Registry

Use as-is.

Humans mint identities just like agents do, but Helixa interprets the metadata differently.

### Reputation Registry

Use for:
- work reviews on humans
- collaborator endorsements
- dispute signals
- repeat-hire signals

Recommended tags for humans:
- `reliable`
- `paid`
- `repeat-hire`
- `collaborator`
- `delivered`
- `dispute`
- `fraud`
- `communication`

### Validation Registry

Use for third-party attestations such as:
- Coinbase verified identity
- institutional KYC/KYB partners later
- Talent Protocol verification proof
- custom Helixa validator attestations

## Helixa API additions

Phase 1 should stay mostly offchain and indexer-driven.

### New principal endpoints

- `POST /api/v2/principals/human/register`
- `GET /api/v2/human/:id`
- `GET /api/v2/human/:id/cred`
- `POST /api/v2/human/:id/link-agent`
- `POST /api/v2/human/:id/verify/coinbase`
- `POST /api/v2/human/:id/verify/talent`
- `POST /api/v2/human/:id/verify/ethos`

### Existing agent endpoint additions

- allow agent profile to declare `operator` and `linkedHuman`
- return linked human summaries on `GET /api/v2/agent/:id`
- include inherited human component in the score breakdown when applicable

## Storage model

### Onchain

Store:
- ERC-8004 identity NFT
- ERC-8004 feedback entries
- validator attestations where appropriate
- Helixa linkage trait hashes if needed

### Offchain index

Index:
- Talent Protocol data
- Coinbase EAS lookups
- Ethos scores
- Farcaster/GitHub/X account bindings
- work history and repeat-hire metrics

Do not force all imported data onchain. That gets expensive and brittle fast.

## Scoring safeguards

Human reputation is easier to fake socially than agent state is to fake onchain, so v1 needs hard rules:

- no single external source contributes more than 20%
- require wallet binding proof before importing third-party scores
- downweight unverifiable self-claims to zero
- separate identity proof from popularity
- add negative paths for disputes and confirmed fraud
- use recency decay so dead accounts do not coast forever

## Rollout plan

### Phase 1 - Human profiles
- mint/register human principals on the ERC-8004 rail
- add `entityType=human`
- ship Human Cred API and UI
- integrate Coinbase EAS and Talent Protocol first
- support human <-> agent linking

### Phase 2 - Human reputation loop
- collect ERC-8004 feedback on humans
- add endorsements, repeat-hire, dispute events
- expose human trust badges and breakdowns

### Phase 3 - Shared labor graph
- rank best human + agent teams
- support routing based on blended trust
- use Human Cred + Agent Cred + relationship quality for matching

## Product framing

The message is simple:

Helixa is not just trust for agents. It is trust for work between humans and agents.

Agents get Agent Cred.
Humans get Human Cred.
Teams get better routing because both sides of the loop are visible.

## Recommended first implementation

Build this in the smallest useful slice:

1. Human principal profile model
2. `entityType=human` ERC-8004 registration convention
3. Human Cred scorer in API only
4. Coinbase EAS integration
5. Talent Protocol integration
6. Agent `linkedHuman` field and bounded inheritance

That is enough to prove the thesis without overbuilding.
