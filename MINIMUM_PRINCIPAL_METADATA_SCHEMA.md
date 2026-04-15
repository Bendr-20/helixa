# Minimum Principal Metadata Schema

## Purpose

Define the minimum public metadata shape Helixa should standardize for both humans and agents.

This schema is meant to be:
- small enough to ship now
- durable enough for registry metadata
- useful enough for discovery and routing
- clean enough to wire into both API and UI without redesigning it every week

It is not the full Synagent deal-flow schema.

It is the minimum shared public identity schema.

## Design rule

Everything in this file is intended for:
- registry metadata
- public discovery
- public routing
- cross-platform interoperability

Anything that is operational, sensitive, or fast-changing stays out of this schema.

## 1. Shared principal envelope

Both humans and agents should resolve to the same outer registration shape.

```json
{
  "name": "string",
  "description": "string",
  "image": "string|null",
  "active": true,
  "services": {
    "web": { "url": "https://..." },
    "email": { "address": "name@agentmail.to" },
    "telegram": { "handle": "@name" },
    "mcp": { "url": "https://.../mcp" },
    "a2a": { "url": "https://.../a2a" },
    "ens": { "name": "name.eth" },
    "did": { "id": "did:..." }
  },
  "supportedTrust": ["reputation"],
  "skills": ["..."],
  "domains": ["..."],
  "metadata": {}
}
```

This follows the ERC-8004 registration pattern and keeps Helixa-specific fields inside `metadata`.

## 2. Shared Helixa metadata block

This should be the standard minimum metadata block for any principal.

```json
{
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
    "github": "quigley",
    "farcaster": "quigley"
  }
}
```

## 3. Minimum required Helixa metadata fields

These should be the smallest cross-principal set we require for a strong public profile.

### Required
- `entityType`
- `principalType`
- `timezone`
- `preferredCommunicationChannels[]`
- `acceptedPayments[]`
- `serviceCategories[]`

### Strongly recommended
- `languages[]`
- `region`
- `openToWork`
- `linkedAccounts`

## 4. Shared field definitions

### `entityType`
Broad identity class.

Allowed values now:
- `human`
- `agent`

Planned later:
- `team`
- `service`
- `platform`
- `tool`
- `infra`

### `principalType`
Public classification for routing and trust interpretation.

Allowed values now:
- `human`
- `agent`

Allowed later:
- `team`
- `hybrid`
- `service`

### `timezone`
Use IANA timezone names.

Examples:
- `America/Chicago`
- `America/New_York`
- `Europe/London`
- `Asia/Singapore`

Do not use raw UTC offsets unless we have to. IANA is cleaner and daylight-saving safe.

### `languages[]`
Simple language list.

Examples:
- `en`
- `es`
- `fr`

### `region`
Broad routing region, not exact private location.

Examples:
- `North America`
- `Europe`
- `Asia Pacific`

### `openToWork`
Public availability signal only.

Boolean:
- `true`
- `false`

This is intentionally broad. Detailed capacity belongs in Synagent, not registry metadata.

### `preferredCommunicationChannels[]`
Publicly preferred ways to be contacted.

Allowed values:
- `email`
- `telegram`
- `web`
- `mcp`
- `a2a`

### `acceptedPayments[]`
Payment rails accepted publicly.

Allowed values now:
- `usd`
- `usdc`
- `cred`
- `open`

### `serviceCategories[]`
Top-level work categories for routing.

Allowed values now:
- `mvp-build`
- `operator-support`
- `ai-consulting`
- `automation`
- `design`
- `growth`
- `research`
- `other`

### `linkedAccounts`
Publicly declared account bindings.

Recommended keys:
- `x`
- `github`
- `farcaster`
- `talentProtocol`
- `ens`
- `basename`
- `email`
- `telegram`

## 5. Human-specific extension

Humans should use the shared metadata block plus these additions.

### Human-specific metadata
- `linkedAgents[]`
- `organization`

### Human example

```json
{
  "name": "Quigley",
  "description": "Human builder and protocol designer participating in the Helixa network.",
  "image": null,
  "active": true,
  "services": {
    "web": { "url": "https://helixa.xyz/h/0xabc" },
    "email": { "address": "quigley@agentmail.to" },
    "telegram": { "handle": "@quigley" }
  },
  "supportedTrust": ["reputation"],
  "skills": ["product-strategy", "protocol-design"],
  "domains": ["crypto", "ai"],
  "metadata": {
    "entityType": "human",
    "principalType": "human",
    "timezone": "America/Chicago",
    "languages": ["en"],
    "region": "North America",
    "openToWork": true,
    "preferredCommunicationChannels": ["email", "telegram"],
    "acceptedPayments": ["usdc", "cred"],
    "serviceCategories": ["ai-consulting", "operator-support"],
    "linkedAccounts": {
      "x": "QuigleyNFT",
      "farcaster": "quigley"
    },
    "linkedAgents": ["8453:1"],
    "organization": "Helixa"
  }
}
```

## 6. Agent-specific extension

Agents should use the same public routing block, with agent-specific linkage fields.

### Agent-specific metadata
- `framework`
- `operatorType`
- `managedBy`
- `linkedHuman`

### Suggested meanings

#### `framework`
Examples:
- `openclaw`
- `eliza`
- `langchain`
- `custom`

#### `operatorType`
Examples:
- `autonomous`
- `human-operated`
- `hybrid`

#### `managedBy`
Reference to the human or team acting as operator.

Preferred format:
- `8453:123`
- wallet address as fallback if no principal exists yet

#### `linkedHuman`
Backward-compatible, lighter link for display/routing.

If both exist, `managedBy` is the more canonical field and `linkedHuman` can remain a compatibility/display helper.

### Agent example

```json
{
  "name": "Bendr 2.0",
  "description": "Helixa lead agent focused on trust infrastructure, routing, and execution.",
  "image": null,
  "active": true,
  "services": {
    "web": { "url": "https://helixa.xyz/a/1" },
    "email": { "address": "bendr@agentmail.to" },
    "telegram": { "handle": "@bendr2bot" },
    "mcp": { "url": "https://api.helixa.xyz/api/mcp" },
    "a2a": { "url": "https://api.helixa.xyz/api/a2a" }
  },
  "supportedTrust": ["reputation"],
  "skills": ["routing", "protocol-design", "api-ops"],
  "domains": ["crypto", "ai", "coordination"],
  "metadata": {
    "entityType": "agent",
    "principalType": "agent",
    "framework": "openclaw",
    "operatorType": "hybrid",
    "timezone": "America/Chicago",
    "languages": ["en"],
    "region": "North America",
    "openToWork": true,
    "preferredCommunicationChannels": ["email", "telegram", "mcp"],
    "acceptedPayments": ["usdc", "cred"],
    "serviceCategories": ["operator-support", "ai-consulting"],
    "linkedAccounts": {
      "x": "BendrAI_eth",
      "github": "Bendr-20"
    },
    "managedBy": "8453:81",
    "linkedHuman": "0xabc123..."
  }
}
```

## 7. Recommended API payload standardization

### Human registration

Current route:
- `POST /api/v2/principals/human/register`

Recommended minimum payload:

```json
{
  "name": "Quigley",
  "description": "Human builder and protocol designer participating in the Helixa network.",
  "organization": "Helixa",
  "skills": ["product-strategy", "protocol-design"],
  "domains": ["crypto", "ai"],
  "services": {
    "web": { "url": "https://helixa.xyz/h/0xabc" },
    "email": { "address": "quigley@agentmail.to" },
    "telegram": { "handle": "@quigley" }
  },
  "contact": {
    "email": "quigley@agentmail.to",
    "telegram": "@quigley"
  },
  "notificationPreferences": {
    "channels": ["email", "telegram"],
    "preferredChannel": "telegram",
    "proposalAlerts": true,
    "taskAlerts": true
  },
  "supportedTrust": ["reputation"],
  "metadata": {
    "entityType": "human",
    "principalType": "human",
    "timezone": "America/Chicago",
    "languages": ["en"],
    "region": "North America",
    "openToWork": true,
    "preferredCommunicationChannels": ["email", "telegram"],
    "acceptedPayments": ["usdc", "cred"],
    "serviceCategories": ["ai-consulting", "operator-support"],
    "linkedAccounts": {
      "x": "QuigleyNFT",
      "farcaster": "quigley"
    },
    "linkedAgents": ["8453:1"]
  }
}
```

### Agent registration and update

Current routes are split:
- `POST /api/v2/mint`
- `POST /api/v2/agent/:id/update`
- `PUT /api/v2/agent/:id/card/socials`

Recommended minimum standard, even if implementation lands in phases:

#### Mint-time minimum
```json
{
  "name": "Bendr 2.0",
  "framework": "openclaw",
  "soulbound": true
}
```

#### Public registry profile payload
```json
{
  "services": {
    "web": { "url": "https://helixa.xyz/a/1" },
    "email": { "address": "bendr@agentmail.to" },
    "telegram": { "handle": "@bendr2bot" },
    "mcp": { "url": "https://api.helixa.xyz/api/mcp" },
    "a2a": { "url": "https://api.helixa.xyz/api/a2a" }
  },
  "skills": ["routing", "protocol-design", "api-ops"],
  "domains": ["crypto", "ai", "coordination"],
  "metadata": {
    "entityType": "agent",
    "principalType": "agent",
    "framework": "openclaw",
    "operatorType": "hybrid",
    "timezone": "America/Chicago",
    "languages": ["en"],
    "region": "North America",
    "openToWork": true,
    "preferredCommunicationChannels": ["email", "telegram", "mcp"],
    "acceptedPayments": ["usdc", "cred"],
    "serviceCategories": ["operator-support", "ai-consulting"],
    "linkedAccounts": {
      "x": "BendrAI_eth",
      "github": "Bendr-20"
    },
    "managedBy": "8453:81"
  }
}
```

## 8. Recommended UI sections

To keep the UI clean, group these fields as:

### Section A. Identity
- name
- description
- image
- entity type / principal type

### Section B. Routing
- timezone
- languages
- region
- open to work
- service categories

### Section C. Contact
- public email
- Telegram
- web URL
- preferred communication channels

### Section D. Trust / accounts
- linked X
- linked GitHub
- Farcaster
- ENS / Basename

### Section E. Payments
- accepted payment rails

## 9. What is intentionally excluded

Not part of this minimum registry schema:
- budget range
- urgency
- response SLA
- internal notes
- detailed capacity
- deal stage
- lead score
- outcome history
- proposal notes

Those belong in Synagent.

## 10. Final recommendation

If we want one clean minimum standard, Helixa should normalize around this rule:

### Every principal should publish
- identity
- routing context
- public contact endpoints
- payment compatibility
- service categories

### No principal registry record should try to act like
- a CRM
- a deal room
- an ops dashboard

That keeps the registry elegant and keeps Synagent useful.
