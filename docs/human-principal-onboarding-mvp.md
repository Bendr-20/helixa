# Human Principal Onboarding MVP

## Goal

Move Helixa from a human mint flow to a human onboarding flow.

Humans should enter Helixa by creating a profile, becoming discoverable, and optionally linking an agent.

They should not need to mint or pay gas just to exist in the system.

## Current Surface

Current frontend files:
- `frontend-v2/src/pages/Home.tsx`
- `frontend-v2/src/pages/Mint.tsx`

Current behavior:
- Home hero sends both humans and agents into `/mint`
- `/mint` presents a two-button chooser
- Human path currently reuses the existing `MintFlow`
- Human path copy still frames the action as onchain registration on Base mainnet
- Human card still advertises `~$5 in ETH + gas`
- Agent path already has a distinct SIWA + x402 flow and should stay separate

## Product Rule

Humans onboard.
Agents authenticate.
Both become principals.
Onchain publish is an upgrade, not the entry fee.

## MVP Outcome

A human should be able to:
- sign in
- create a human principal profile
- publish a public human page
- be searchable
- link an owned or operated agent
- be matchable in later Synagent work

This MVP should not require:
- minting
- gas
- Human Cred
- full verification stack
- ERC-8004 publish on day one

## Frontend Changes

### 1. Home page copy

File:
- `frontend-v2/src/pages/Home.tsx`

#### Current CTA section
Current buttons:
- `I'm Human` -> `/mint`
- `I'm an Agent` -> `/mint#agent-mint`

#### Replace with
Human CTA:
- label: `I'm Human`
- destination: `/join/human`

Agent CTA:
- label: `I'm an Agent`
- destination: `/mint#agent-mint`

#### Copy updates
Current hero flow language is agent-centric.
Do not rewrite the whole homepage yet.
Only change the human entrypoint so it stops dumping humans into mint.

### 2. Replace human mint entry in Mint page

File:
- `frontend-v2/src/pages/Mint.tsx`

#### Current chooser card copy
Current human card:
- title: `I'm Human`
- body: `Sign in with email, social, or wallet. Register directly from the contract.`
- badge: `~$5 in ETH + gas`

#### Replace with
Human card:
- title: `I'm Human`
- body: `Create your profile, link your work, and get discovered on Helixa.`
- badge: `No gas required`
- click action: route to `/join/human`

Agent card stays mostly as-is:
- title: `I'm an Agent`
- body: `Authenticate with SIWA. Pay via x402. Fully programmatic.`
- badge: `$5 USDC via x402`

#### Remove
Do not keep the current `mintPath === 'human'` branch using `MintFlow`.
That is the wrong product shape for humans.

### 3. New human routes

Add these frontend routes:
- `/join/human`
- `/join/human/profile`
- `/join/human/work`
- `/join/human/links`
- `/join/human/review`
- `/h/:id`
- `/humans` or `/directory/humans`

If route count needs to stay smaller for MVP, compress to:
- `/join/human`
- `/join/human/review`
- `/h/:id`
- `/humans`

## Route-by-Route UI Spec

### `/join/human`

Purpose:
- entrypoint for human onboarding

UI:
- headline: `Join Helixa as a Human`
- subhead: `Create your profile first. Publish onchain later if and when it matters.`
- auth options:
  - continue with email
  - continue with wallet
  - continue with social

Notes:
- no contract language
- no gas language
- no mint framing

### `/join/human/profile`

Purpose:
- collect identity basics

Fields:
- display name
- short bio
- timezone
- region
- languages
- profile image optional

Validation:
- display name required
- bio recommended
- timezone required

### `/join/human/work`

Purpose:
- collect public routing info

Fields:
- skills
- service categories
- accepted payments
- open to work
- preferred communication channels

Recommended service category options:
- mvp-build
- operator-support
- ai-consulting
- automation
- design
- growth
- research
- other

Recommended communication channel options:
- email
- telegram
- web

Recommended payment options:
- usd
- usdc
- cred
- open

### `/join/human/links`

Purpose:
- attach public account bindings and optional agent relationship

Fields:
- X
- GitHub
- Farcaster
- ENS
- Basename
- website optional
- optional linked agent
- relationship type

Relationship options:
- owner
- operator
- creator
- contributor

### `/join/human/review`

Purpose:
- preview public profile before save

Display:
- name
- bio
- timezone
- region
- languages
- skills
- service categories
- accepted payments
- communication channels
- public links
- linked agent summary if present

CTAs:
- `Save Profile`
- `Save and Link Agent`
- later action, not primary: `Publish Identity`

## Public Human Profile Spec

### `/h/:id`

Show:
- name
- bio
- timezone
- region
- skills
- service categories
- payment rails
- public links
- linked agents
- open to work
- CTA: `Request Intro` or `Match With This Human`

Do not lead with:
- score
- wallet internals
- mint status
- chain details

## Human Principal Data Shape

Use the shared principal schema.

Example:

```json
{
  "name": "Quigley",
  "description": "Human builder and protocol designer.",
  "image": null,
  "active": true,
  "services": {
    "web": { "url": "https://helixa.xyz/h/quigley" },
    "email": { "address": "quigley@example.com" },
    "telegram": { "handle": "@QuigleyNFT" }
  },
  "supportedTrust": ["reputation"],
  "skills": ["product-strategy", "creative-direction", "protocol-design"],
  "domains": ["crypto", "ai", "coordination"],
  "metadata": {
    "entityType": "human",
    "principalType": "human",
    "timezone": "America/Chicago",
    "languages": ["en"],
    "region": "North America",
    "openToWork": true,
    "preferredCommunicationChannels": ["email", "telegram"],
    "acceptedPayments": ["usdc", "cred"],
    "serviceCategories": ["operator-support", "ai-consulting"],
    "linkedAccounts": {
      "x": "QuigleyNFT",
      "github": "quigley",
      "farcaster": "quigley"
    },
    "linkedAgents": ["8453:1"]
  }
}
```

## Backend Endpoints

### Ship in MVP

- `POST /api/v2/principals/human/register`
- `PUT /api/v2/principals/human/:id`
- `GET /api/v2/human/:id`
- `GET /api/v2/humans/search`
- `POST /api/v2/human/:id/link-agent`

### Do not block MVP on these

- `POST /api/v2/human/:id/publish`
- `POST /api/v2/human/:id/verify/coinbase`
- `POST /api/v2/human/:id/verify/talent`
- `POST /api/v2/human/:id/verify/ethos`
- `GET /api/v2/human/:id/cred`

## Endpoint Payloads

### `POST /api/v2/principals/human/register`

```json
{
  "name": "Quigley",
  "description": "Human builder and protocol designer.",
  "image": null,
  "skills": ["product-strategy", "creative-direction", "protocol-design"],
  "domains": ["crypto", "ai", "coordination"],
  "services": {
    "web": { "url": "https://helixa.xyz/h/quigley" },
    "email": { "address": "quigley@example.com" },
    "telegram": { "handle": "@QuigleyNFT" }
  },
  "metadata": {
    "entityType": "human",
    "principalType": "human",
    "timezone": "America/Chicago",
    "languages": ["en"],
    "region": "North America",
    "openToWork": true,
    "preferredCommunicationChannels": ["email", "telegram"],
    "acceptedPayments": ["usdc", "cred"],
    "serviceCategories": ["operator-support", "ai-consulting"],
    "linkedAccounts": {
      "x": "QuigleyNFT",
      "github": "quigley",
      "farcaster": "quigley"
    },
    "linkedAgents": ["8453:1"]
  }
}
```

### `POST /api/v2/human/:id/link-agent`

```json
{
  "agentId": "8453:1",
  "relationship": "operator"
}
```

## Implementation Checklist

### Ticket 1 - Entry surface
- [ ] Update Home human CTA from `/mint` to `/join/human`
- [ ] Update Mint chooser human card copy
- [ ] Remove gas language from human card
- [ ] Route human card click to `/join/human`
- [ ] Remove dependency on `MintFlow` for human onboarding

### Ticket 2 - Human onboarding UI
- [ ] Create `/join/human`
- [ ] Create profile step UI
- [ ] Create work step UI
- [ ] Create links step UI
- [ ] Create review step UI
- [ ] Save draft state across steps
- [ ] Submit create human principal request

### Ticket 3 - Human profile backend
- [ ] Add human registration store
- [ ] Add create endpoint
- [ ] Add update endpoint
- [ ] Add get-by-id endpoint
- [ ] Add search endpoint
- [ ] Add link-agent endpoint

### Ticket 4 - Public human profile
- [ ] Build `/h/:id`
- [ ] Render public principal fields
- [ ] Render linked agent cards
- [ ] Add `Request Intro` / `Match With This Human` CTA

### Ticket 5 - Agent relationship surface
- [ ] Add linked human summary to agent API response
- [ ] Show `operated by` / `linked human` on agent pages where present

## Acceptance Criteria

A user can:
- click `I'm Human`
- create a human profile without minting
- receive a public human profile URL
- appear in human search results
- link a human profile to an agent

A user does not need to:
- pay gas
- mint first
- complete verification
- have a Human Cred score

## Recommended Build Order

1. Entry surface changes
2. Human create + update + get endpoints
3. Multi-step onboarding UI
4. Public human page
5. Search humans
6. Link human to agent
7. Show linked human on agent pages
8. Synagent human matching later

## Explicit Non-Goals for MVP

Do not include in first ship:
- Human Cred
- paid human onboarding
- onchain publish by default
- validator integrations
- identity proofs beyond basic account linking
- full human reputation math

## Why this is the right sequence

This gets humans into the Helixa graph quickly without forcing them through the wrong UX.

The first useful version is:
- principal record
- public profile
- optional agent linkage
- discovery

That is enough to make humans real in the product.

Scoring, verification, and onchain publish can layer on afterward.
