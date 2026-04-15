# Principal Registry Boundary Spec

## Purpose

Define what belongs in the Helixa registry layer versus the Synagent deal-flow layer.

This boundary matters because the system now has two very different jobs:
- the registry helps with identity, discovery, trust, and public routing
- Synagent helps with matching, deal execution, and ongoing operations

If we blur those layers, we end up putting fast-changing marketplace data into a slow public identity surface.

## Core rule

### Registry layer
Store fields that are:
- durable
- public by default
- useful for discovery
- useful across platforms, not just Synagent
- stable enough to sit in metadata without constant churn

### Synagent layer
Store fields that are:
- operational
- private or semi-private
- deal-specific
- changing frequently
- only useful inside matching and routing workflows

## Sharp summary

Registry = who you are, what you do, where you operate, how to reach you.

Synagent = what you need right now, what you cost, whether you are available, and what happened to the deal.

## Field boundary

### A. Good registry fields

These should live in the Helixa metadata layer.

#### Identity
- `entityType`
- `principalType`
- `displayName`
- `description`
- `image`
- `organization`
- `linkedAccounts`
- `linkedAgents`

#### Discovery / trust hints
- `skills[]`
- `domains[]`
- `serviceCategories[]`
- `supportedTrust[]`
- `active`
- `openToWork`

#### Routing context
- `timezone`
- `languages[]`
- `region`
- `overlapPreference`
- `preferredCommunicationChannels[]`

#### Public contact / service endpoints
- `services.web`
- `services.email`
- `services.telegram`
- `services.mcp`
- `services.a2a`
- `services.ens`
- `services.did`

#### Commercial compatibility hints
- `acceptedPayments[]`

### Why these belong in registry

Because they help with:
- discovery
- interoperability
- routing across products
- public trust and contactability

These are not just Synagent concerns. They are principal-level facts.

## B. Synagent-only fields

These should stay offchain / internal / deal-layer only.

#### Deal intake
- `budgetRange`
- `budgetActual`
- `urgency`
- `deadlineAt`
- `desiredOutcome`
- `successCriteria[]`
- `constraints[]`
- `attachments[]`
- `decisionMakerStatus`
- `projectStage`
- `scopeSize`
- `deliveryType`

#### Provider operations
- `minEngagement`
- `pricingModel`
- `pricingNotes`
- `typicalTurnaround`
- `capacityStatus`
- `currentCapacity`
- `responseSla`
- `availabilityWindow`
- `maxConcurrentProjects`
- `notAvailableUntil`

#### Matching internals
- `leadScore`
- `matchScore`
- `matchReason[]`
- `internalOwner`
- `routingNotes[]`
- `qualificationNotes[]`
- `riskFlags[]`

#### Deal execution
- `requestId`
- `matchedProfileIds[]`
- `status`
- `contactLog[]`
- `nextActionAt`
- `proposalVersion`
- `selectedProfileId`
- `outcome`
- `rating`
- `closedAt`

### Why these stay in Synagent

Because they are:
- dynamic
- sensitive
- context-specific
- not generally useful outside the matching engine

If these go into registry metadata, the public profile becomes noisy and stale fast.

## C. Fields that exist in both layers

Some fields should exist in both places, but in different forms.

### Contact

#### Registry
- public contact endpoints or public-facing channels
- example: public AgentMail address, public Telegram handle

#### Synagent
- preferred notification route
- backup channel
- internal delivery status
- whether a message bounced or was acknowledged

### Availability

#### Registry
- broad public signal only
- example: `openToWork: true`

#### Synagent
- detailed operational reality
- example: `capacityStatus: limited`, `notAvailableUntil`, `maxConcurrentProjects`

### Geography / timezone

#### Registry
- yes, include timezone
- yes, include language
- optional region

#### Synagent
- overlap requirements
- scheduling constraints
- client-specific timing notes

### Payments

#### Registry
- accepted rails, e.g. `usdc`, `cred`, `usd`

#### Synagent
- minimum engagement
- pricing structure
- quote history
- negotiation notes

## Timezone decision

Yes, timezone should be included in Helixa registry metadata.

Reason:
- it is genuinely useful for routing
- it is durable enough
- it helps humans and agents coordinate
- it is not overly sensitive on its own

Recommended representation:

```json
{
  "metadata": {
    "timezone": "UTC-6"
  }
}
```

If we want a stronger format later, use IANA timezone names instead:

```json
{
  "metadata": {
    "timezone": "America/Chicago"
  }
}
```

IANA is better long term.

## Recommended minimum registry metadata for Helixa principals

This is the smallest useful public metadata extension.

```json
{
  "metadata": {
    "entityType": "human",
    "principalType": "human",
    "timezone": "America/Chicago",
    "languages": ["en"],
    "region": "North America",
    "openToWork": true,
    "preferredCommunicationChannels": ["email", "telegram"],
    "acceptedPayments": ["usdc", "cred"],
    "serviceCategories": ["mvp-build", "ai-consulting"],
    "linkedAccounts": {
      "x": "QuigleyNFT",
      "farcaster": "quigley"
    },
    "linkedAgents": ["8453:1"]
  },
  "services": {
    "web": { "url": "https://helixa.xyz/h/0xabc" },
    "email": { "address": "name@agentmail.to" },
    "telegram": { "handle": "@name" }
  }
}
```

## Recommended Synagent private extensions

These should not be treated as registry metadata.

```json
{
  "contact": {
    "email": "name@agentmail.to",
    "telegram": "@name",
    "preferredChannel": "telegram",
    "backupChannel": "email"
  },
  "operations": {
    "capacityStatus": "limited",
    "responseSla": "same-day",
    "minEngagement": 2500,
    "typicalTurnaround": "7-10 days"
  },
  "dealFlow": {
    "leadScore": 82,
    "notes": ["strong fit for MVP intake build"],
    "status": "matched"
  }
}
```

## Product guidance

The registry should stay elegant.

If a field helps someone discover, trust, or contact a principal, it probably belongs there.

If a field helps Synagent operate a live deal, it probably belongs offchain.

That is the clean boundary.

## Final recommendation

### Put in registry now
- timezone
- languages
- region
- preferred communication channels
- public contact endpoints
- service categories
- accepted payment rails
- open-to-work signal
- entity/principal type

### Keep Synagent-only for now
- budget
- detailed pricing
- detailed availability
- response SLA
- urgency
- deal stage
- scoring
- internal notes
- outcomes

This gives Helixa a stronger public identity layer without turning the registry into a CRM.
