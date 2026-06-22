# Multipass Roadmap and Product Spec

Status: draft for Quigley review
Date: 2026-06-22

## 1. Product Thesis

Multipass is the human-friendly app and agent-native control layer for managing an AI agent across fragmented identities, chains, tools, owners, soul, work history, and marketplace activity.

It is not just another NFT. It is not only an ERC-8004 record. It is a unification and management layer for agent identities.

Core line:

> Multipass lets any NFT become a manageable AI agent, with identity, provenance, ownership, tools, soul, history, and trust in one place.

## 2. Product Positioning

### Public framing

- Browse agent NFTs across collections.
- Activate an NFT into an agent identity.
- Name the agent.
- View its Multipass card.
- Inspect its trust, ownership, provenance, tools, soul, and work history.
- Trade agent NFTs through marketplace rails.
- Manage transfers safely when ownership changes.

### Internal framing

- Multipass is an identity graph and control layer.
- ERC-8217 / Adapter8004 can bind external NFTs to ERC-8004 identities where possible.
- Multipass adds the app layer: profiles, cards, dashboard, custody epochs, identity fragments, soul vault, fees, marketplace, and Cred integration.

## 3. Naming Rules

Use publicly:

- Activate NFT
- Agent Activation
- Activation Registry
- Multipass Card
- Agent profile
- Owner dashboard
- Soul Vault or Continuity Vault

Use internally / protocol docs only:

- bind
- binding
- ERC-8217 binding
- Adapter8004

Avoid publicly:

- older mystical naming for activation flows
- identity-profile terms that conflict with Multipass
- any framing that suggests Cred score can be purchased

## 4. Core Objects

### Multipass

The canonical app-level record for an agent.

Fields:

- `multipass_id`
- `subject_type`: `agent` now, `swarm` later
- `display_name`
- `slug`
- `status`: `draft`, `activation_ready`, `active`, `transfer_pending`, `suspended`
- `primary_art`
- `primary_identity_fragment_id`
- `current_controller`
- `current_custody_epoch_id`
- `cred_summary`
- `public_profile`
- `created_at`
- `updated_at`

### Identity Fragment

A verified or pending identity/control signal attached to the Multipass.

Types:

- Helixa AgentDNA
- ERC-8004 identity
- ERC-8217 / Adapter8004 NFT binding
- external NFT collection token
- wallet
- Farcaster signer
- x402 wallet
- Aomi / ACP / marketplace profile
- tool manifest
- attestation
- work history source

Statuses:

- `active`
- `pending_verification`
- `historical`
- `revoked`

Transfer policy:

- `agent_bound`: follows the agent identity
- `owner_bound`: becomes historical or pending on transfer
- `operator_bound`: requires reapproval
- `secret_bound`: never transfers blindly

### Custody Epoch

A time-bounded period where a specific owner/controller manages the agent.

Fields:

- `epoch_id`
- `multipass_id`
- `controller_wallet`
- `source_fragment`
- `started_at`
- `ended_at`
- `transfer_event`
- `permissions_snapshot`
- `cred_context`

Rule:

> Identity, history, and public soul can persist. Authority must be reverified after transfer.

### Soul Vault

Encrypted continuity layer for an agent.

Public layer:

- personality
- role
- lore
- voice
- public behavior summary

Private encrypted layer:

- SOUL.md-style persona instructions
- owner notes
- memory/context export
- role configuration

Never blindly transfer:

- API keys
- private keys
- paid tool credentials
- live signers
- production secrets

### Collection

A source NFT collection that can be activated into agent identities.

Fields:

- `chain_id`
- `collection_address`
- `slug`
- `name`
- `verification_status`: `community`, `verified`, `partner`
- `activation_enabled`
- `activation_template`
- `fee_policy`
- `trait_mapping`
- `collection_multipass_id` optional

### Swarm Multipass

A parent Multipass for a collection, project, or fleet of agents.

Fields:

- roster of agent Multipasses
- collection proof
- shared tools
- shared policies
- aggregate Cred
- treasury/payment routing later
- per-agent reputation preserved

## 5. User Surfaces

### 5.1 Public Marketplace Browse

OpenSea-style browse experience for agent NFTs across collections.

Requirements:

- PFP-first cards
- collection/token provenance visible
- agent display name prominent when activated
- activation status visible
- Cred/trust tier visible when available
- owner/control status visible but not overly technical
- filters for collection, chain, activated, ready to activate, for sale, transfer pending, Cred tier, role, tools

Card examples:

- Axiom
  - BasedPunk #2651
  - verified agent
  - Cred 84
  - owner verified

- Vector
  - BasedPunk #4055
  - activation ready
  - create agent profile

- Muse
  - BasedPunk #4517
  - content agent
  - verified soul
  - Cred 91

- Relay
  - BasedPunk #614
  - transfer detected
  - claim required

### 5.2 Public Multipass Card

A shareable card for a named agent.

Must show:

- agent name
- PFP/NFT art
- original NFT collection/token provenance
- activation status
- owner/controller proof
- Cred tier
- short role/capability
- view profile CTA

### 5.3 Deep Public Profile

Click-through from the card.

Sections:

- identity graph
- NFT provenance
- current controller
- custody timeline
- public soul/personality
- active tools/services
- work history
- attestations
- Cred breakdown
- transfer state

### 5.4 Owner Dashboard

Private app for current owner/controller.

Features:

- claim Multipass
- verify NFT ownership
- name agent
- update public profile
- link identity fragments
- connect wallets/signers
- upload encrypted soul file
- manage tools and operators
- view permissions
- view transfer state
- view fees/burns

### 5.5 Activation Flow

Public term: Activate.

Flow:

1. Connect wallet.
2. Select NFT.
3. Check collection support.
4. Create or link ERC-8004 identity where possible.
5. Link Helixa AgentDNA profile if available.
6. Name the agent.
7. Generate public Multipass card.
8. Open owner dashboard.

Under the hood:

- Use ERC-8217 / Adapter8004 where possible.
- Store identity fragments in Multipass graph.
- Mark unsupported or unverified fragments clearly.

### 5.6 Transfer Claim Flow

When a bound NFT sells or transfers:

1. Detect ownership change.
2. Mark Multipass `transfer_pending`.
3. Pause dangerous permissions.
4. New owner connects wallet.
5. Verify ownership/control fragment.
6. Start new custody epoch.
7. Move old owner/operator fragments to historical or pending.
8. Re-encrypt soul for new owner if enabled.
9. Require tool/API/signer reapproval.
10. Restore active state after setup.

## 6. Marketplace Strategy

### V0: Discovery marketplace

- Browse agent NFTs across collections.
- Show activated/unactivated states.
- Link out to OpenSea or existing marketplace for trades.
- No native custody.
- No native orderbook yet.

### V1: Aggregated trading

- Add buy/list/offer UI through existing marketplace rails where possible.
- Consider Reservoir/Relay/Seaport-style aggregation depending on current API/support.
- Wallet signs transactions.
- Multipass does not custody user NFTs or funds.

### V2: Transfer-aware agent marketplace

- Native trade plus Multipass handoff.
- After sale, trigger transfer claim flow.
- Preserve history/soul.
- Reset authority.
- Start custody epoch.

Differentiator:

> OpenSea trades NFTs. Multipass trades manageable agent identities.

## 7. Fee and $CRED Burn Spec

Principle:

> Browsing is free. Fees happen when value is created.

Fee events:

- NFT activation
- collection verification
- verified listing
- marketplace trade
- transfer claim / handoff
- encrypted soul vault
- tool/API permission publishing
- swarm dashboard
- runtime handoff later

Initial fee model:

- User pays in ETH/USDC/Base ETH.
- Protocol fee collected.
- Percentage of fees allocated to $CRED buyback and burn.
- Later, allow direct $CRED payment for discounts or premium actions.

Suggested split for activation/dashboard fees:

- 50% treasury/product revenue
- 25% $CRED buyback and burn
- 15% collection/project/referrer
- 10% evaluator/infra/rewards pool

Suggested marketplace fee:

- 1% Multipass marketplace fee
  - 0.50% treasury
  - 0.25% $CRED buyback and burn
  - 0.15% collection/referrer
  - 0.10% evaluator/rewards

Critical rule:

> Cred score cannot be purchased.

Fees can buy:

- activation
- listing
- verification review
- dashboard access
- tool publishing
- transfer handling

Cred comes from:

- identity proof
- verified work
- outcomes
- attestations
- behavior/history

## 8. Roadmap

### Phase 0: Product model and schema

Deliverables:

- Multipass schema
- identity fragment schema
- custody epoch schema
- collection schema
- activation status model
- fee/burn model

Exit criteria:

- We can describe one NFT agent, its provenance, owner, identity fragments, and transfer state in one normalized object.

### Phase 1: Public card and browse MVP

Deliverables:

- PFP-first Multipass card
- marketplace-style browse grid
- filters for collection/status/Cred
- named agent display
- NFT provenance display

Exit criteria:

- A user can browse BasedPunks-style agent NFTs and understand which ones are active, ready, or transfer pending.

### Phase 2: Activation flow

Deliverables:

- connect wallet
- select NFT
- create/name agent
- create Multipass profile
- link Helixa/AgentDNA identity
- record activation fee
- publish public card

Exit criteria:

- A user can activate one NFT into a named agent profile and see it publicly.

### Phase 3: Owner dashboard

Deliverables:

- claim ownership
- edit agent name/profile
- manage public soul
- manage linked identity fragments
- view permissions
- view fees/burns

Exit criteria:

- Current owner can manage the agent after activation.

### Phase 4: ERC-8217 / ERC-8004 binding integration

Deliverables:

- Adapter8004 compatibility research
- binding verification module
- ERC-8004 identity link
- active/pending/historical fragment states

Exit criteria:

- Multipass can verify that an external NFT controls or links to an ERC-8004 identity where supported.

### Phase 5: Transfer claim flow

Deliverables:

- ownership change detection
- transfer pending state
- custody epoch creation
- permission reset model
- new owner claim flow
- soul re-encryption placeholder

Exit criteria:

- If an activated agent NFT sells, Multipass can show the change and guide the new owner through reclaiming control.

### Phase 6: Collection onboarding

Deliverables:

- collection directory
- community collections
- verified collections
- project onboarding request
- fee collection
- trait-to-role/soul templates

Exit criteria:

- An NFT project can request verified activation support and get a public collection page.

### Phase 7: Marketplace rails

Deliverables:

- external marketplace links in V0
- aggregated listings/offers research
- native listing/buy UI later
- marketplace fee capture
- $CRED buyback/burn execution

Exit criteria:

- Users can discover agent NFTs in Multipass and trade through safe marketplace rails.

### Phase 8: Swarm Multipass

Deliverables:

- parent swarm profile
- roster of child agent Multipasses
- collection-level dashboard
- aggregate Cred
- per-agent reputation preserved

Exit criteria:

- A project can manage a fleet of activated agent NFTs.

### Phase 9: Runtime handoff

Deliverables:

- encrypted config export
- soul/memory state transfer
- API permission rotation checklist
- server/runtime redeploy flow
- smart wallet ownership transfer support

Exit criteria:

- Multipass can help transfer the operating stack of an agent, not just the NFT/profile.

## 9. MVP Recommendation

Build first:

1. PFP-first marketplace browse.
2. Public Multipass card.
3. Activation flow for one collection.
4. Owner dashboard lite.
5. Custody epoch data model.
6. Basic fee capture with $CRED burn accounting.

Do not build first:

- full native marketplace exchange
- server/runtime handoff
- wallet custody
- full swarm dashboard
- generalized human/org Multipasses
- complex Cred scoring changes

## 10. Open Questions

1. Should activation require Helixa AgentDNA minting, or can Multipass exist before Helixa ID is created?
2. Should the first collection demo use BasedPunks, NFToshis, Base Gods, or a Helixa-owned/internal test collection?
3. Should $CRED burn happen immediately per fee or batched daily/weekly?
4. Should verified collection onboarding be paid in ETH/USDC only at first, or support $CRED from day one?
5. What is the preferred name for the encrypted private layer: Soul Vault, Continuity Vault, or Agent Core?
6. What is the marketplace trading route for V1: external links only, Reservoir/Relay aggregation, Seaport direct, or custom?

## 11. One-Page Partner Pitch

Multipass is an agent NFT marketplace and management app.

It lets NFT holders activate tokens into named AI agents, gives projects a way to launch and manage agent swarms, and gives buyers a safer handoff when an operational agent changes ownership.

Every agent gets a public card, deeper profile, identity graph, custody timeline, soul layer, and Cred context. Marketplace fees and activation fees create protocol revenue while driving $CRED burn demand without letting anyone buy reputation.
