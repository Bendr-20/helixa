# Multipass Premium Identity Stack Spec

Status: draft for Quigley review
Date: 2026-06-22

## 1. Product Thesis

Multipass is a premium identity stack for AI agents, human owners, projects, collections, and swarms.

It is human owned and agent managed.

Humans should feel in control. Agents should be able to discover, verify, communicate with, and transact through it without needing a human to explain the context.

Core line:

> Multipass gives every agent a trusted identity graph: who owns it, what it controls, where it works, who is behind it, what it has done, and how other agents can safely interact with it.

Agent NFTs are one layer in the stack. They are not the stack.

An NFT can be linked as a provenance and ownership fragment, but the broader product is richer than any single NFT layer. Multipass combines agent identity, human ownership, social proof, payment rails, runtime authority, work history, and trust data into one premium surface.

## 2. Positioning

### Public framing

Multipass is the control and trust layer for agent identity.

For humans:

- See every agent, owner, operator, proof, permission, payment rail, and trust signal in one place.
- Understand who controls an agent or swarm.
- Review what the agent can do.
- Approve or revoke sensitive permissions.
- View provenance, work history, Cred context, social proof, and linked profiles.

For agents:

- Discover other agents and swarms through structured machine-readable profiles.
- Verify ownership, authority, and payment methods.
- Find x402 endpoints, tool manifests, message routes, and service schemas.
- Communicate with the right owner, operator, runtime, or agent endpoint.
- Pay in the correct asset, with $CRED as the preferred Helixa rail where supported.

### What Multipass is

- A premium identity graph.
- A human-owned control asset.
- An agent-managed operational profile.
- A registry of identity fragments.
- A permission and custody layer.
- A discovery and communication layer for agents.
- A monetization rail for paid data, APIs, identity linking, verification, and runtime services.

### What Multipass is not

- Not just an NFT marketplace.
- Not just a profile page.
- Not just an ERC-8004 record.
- Not a mechanism for purchasing reputation.
- Not a blind transfer of private keys, secrets, or production authority.

## 3. Product Principles

### 1. Human owned, agent managed

The Multipass belongs to a human, organization, or verified controller. The agent can manage parts of it through delegated scopes, but the human owns final authority.

Examples:

- A human approves which fragments are public.
- A human grants the agent permission to update its work history or service endpoints.
- A human revokes tool access, payment routes, or delegated signers.
- An agent can publish status, update schemas, receive work, and maintain discoverability within approved limits.

### 2. Humans see clearly

The surface should feel premium, visual, and calm. It should answer:

- Who owns this?
- Who operates it?
- What is this agent allowed to do?
- What proof supports that claim?
- What changed recently?
- What happens if ownership transfers?
- Can I trust it enough to interact, hire, pay, or integrate?

### 3. Agents read everything

Every public Multipass should expose structured data for agent discovery.

Machine-readable outputs should include:

- canonical profile JSON
- identity fragment graph
- ownership and custody state
- service endpoints
- x402 payment metadata
- supported tools and schemas
- message routes
- ERC-8004 references where relevant
- public attestations and validation signals
- public Cred context

### 4. Identity is fragmented by default

A real agent is not one wallet or one NFT. It may have:

- a Bankr profile
- a Helixa AgentDNA record
- an ERC-8004 identity
- one or more wallets
- social accounts
- x402 endpoints
- tool manifests
- human owners
- operators
- delegated signers
- work history
- swarm membership
- collection provenance
- zk or DID-backed proofs

Multipass is the premium graph that makes these fragments understandable.

### 5. Authority is not identity

Identity and history can persist. Authority must be proven.

A profile can remember past owners, operators, work, and provenance, but active permissions should always be scoped, revocable, and reverified after transfer.

### 6. $CRED is access and settlement, not reputation purchase

$CRED can power payments, access, discounts, endpoint usage, verification fees, identity-linking fees, and burns.

$CRED must not directly raise a Cred score. Cred is earned through evidence, outcomes, attestations, history, and trust signals.

## 4. Glossary

### Cred score and Cred context

Cred score is the trust and reputation signal. It is earned through evidence, outcomes, attestations, ownership context, work history, and validation signals.

Cred context is the explanation layer around a score: what proofs, history, custody changes, disputes, or attestations influenced trust.

### $CRED token

$CRED is the Helixa economic rail for access, paid endpoints, premium reports, linking services, verification, dashboards, and burns. It does not alter reputation.

### Identity fragment

An identity fragment is any account, proof, credential, endpoint, wallet, attestation, social account, NFT, payment rail, runtime signal, or work history source attached to a Multipass.

### Owner, operator, and agent manager

The owner controls the Multipass. The operator may run infrastructure or services. The agent manager may update approved agent-facing metadata within delegated scopes. These roles can overlap, but the permission model must treat them separately.

## 5. Core Objects

### Multipass

The canonical identity asset.

Fields:

- `multipass_id`
- `subject_type`: `agent`, `human`, `swarm`, `collection`, `project`, `organization`
- `display_name`
- `slug`
- `status`: `draft`, `link_ready`, `active`, `transfer_pending`, `suspended`, `archived`
- `primary_art`
- `owner_controller_id` required before active, nullable only in draft
- `owner_state`: `unclaimed`, `claimed`, `verified`, `transferred`
- `agent_manager_id` optional
- `primary_identity_fragment_id`
- `current_custody_epoch_id`
- `public_profile`
- `visibility_policy`
- `cred_summary`
- `payment_profile`
- `discovery_profile`
- `created_at`
- `updated_at`

Rule:

> The owner controls the Multipass. The agent may manage approved parts of it.

Creation rule:

- A draft Multipass can be proposed by an agent, importer, crawler, project team, or human.
- A draft Multipass can hold unverified public data and pending fragments.
- A Multipass cannot become `active`, expose verified ownership, receive verified trust labels, or operate paid Multipass endpoints until a human, organization, or DAO owner controller is verified.
- `owner_controller_id` is nullable only while `status = draft`.
- Transition to `active` requires at least one owner fragment, one controller proof, and one custody epoch.
- Agent-managed updates require delegated scopes from the owner.

This keeps the product human owned without blocking agent-created drafts and discovery imports.

### Identity Fragment

A claim, proof, account, credential, endpoint, or authority signal attached to a Multipass.

Fields:

- `fragment_id`
- `multipass_id`
- `fragment_type`
- `subject_role`: `owner`, `agent`, `operator`, `swarm`, `collection`, `service`, `issuer`
- `label`
- `status`: `active`, `pending_verification`, `historical`, `revoked`, `expired`
- `assurance_level`: `claimed`, `controlled`, `verified`, `attested`, `private_proof`, `operational`
- `visibility`: `public`, `gated`, `private`, `hidden`
- `transfer_policy`: `identity_bound`, `owner_bound`, `operator_bound`, `agent_bound`, `secret_bound`, `non_transferable`
- `verification_method`
- `issuer`
- `source_url`
- `chain_id` optional
- `address` optional
- `proof_hash` optional
- `expires_at` optional
- `last_verified_at`
- `metadata`

Fragment statuses:

- `active`: currently valid and used.
- `pending_verification`: added but not trusted yet.
- `historical`: kept for provenance but not current authority.
- `revoked`: explicitly invalidated.
- `expired`: timed out and needs refresh.

Assurance levels:

- `claimed`: user typed it in.
- `controlled`: current control was proven.
- `verified`: platform verified through API, signature, DNS, OAuth, or chain event.
- `attested`: signed by a recognized issuer.
- `private_proof`: proven through zk, zkTLS, or selective disclosure.
- `operational`: used successfully in live agent work, payments, or runtime calls.

### Human Owner

The human, team, or organization behind an agent or swarm.

Fields:

- `owner_id`
- `display_name`
- `owner_type`: `individual`, `team`, `organization`, `dao`, `unknown`
- `controller_wallets`
- `verified_socials`
- `humanity_proofs`
- `domains`
- `email_proofs`
- `delegation_policy`
- `public_visibility_policy`
- `risk_flags`

Rule:

> Human ownership should be visible enough to build trust, but private enough to avoid doxxing by default.

### Agent Manager

The operational agent identity allowed to maintain approved parts of the Multipass.

Fields:

- `agent_manager_id`
- `agent_profile_fragment`
- `runtime_fragment`
- `allowed_actions`
- `delegated_signers`
- `tool_scopes`
- `payment_scopes`
- `expires_at`
- `revoked_at`

Allowed actions can include:

- update service endpoint metadata
- publish tool schemas
- append work receipts
- respond to discovery pings
- request verification refresh
- initiate x402 quotes
- propose profile edits for human approval

Disallowed without explicit approval:

- change ownership
- transfer the Multipass
- reveal private fragments
- rotate owner wallets
- spend above limits
- grant new dangerous permissions

### Custody Epoch

A time-bounded period where a specific owner/controller has authority over the Multipass.

Fields:

- `epoch_id`
- `multipass_id`
- `controller_wallet`
- `owner_fragment_id`
- `started_at`
- `ended_at`
- `transfer_event`
- `permissions_snapshot`
- `public_note`
- `cred_context`

Rule:

> Transfer starts a new custody epoch. Identity and history persist, but active authority is reverified.

### Discovery Profile

The agent-readable surface.

Fields:

- `profile_url`
- `canonical_json_url`
- `agent_card_url`
- `openapi_url`
- `tool_manifest_url`
- `x402_manifest_url`
- `message_routes`
- `supported_protocols`
- `payment_assets`
- `rate_limits`
- `trust_requirements`
- `contact_policy`

The discovery profile should let another agent answer:

- What is this entity?
- Who controls it?
- What can it do?
- How do I talk to it?
- What does it cost?
- What payment asset is accepted?
- What proofs should I check before trusting it?

### Payment Profile

The payment and monetization rail for a Multipass.

Fields:

- `preferred_asset`: `$CRED`
- `fallback_assets`: `USDC`, `ETH` if needed
- `bankr_profile_fragment_id`
- `x402_cloud_endpoints`
- `fee_policy`
- `burn_policy`
- `revenue_split_policy`
- `settlement_wallets`
- `receipt_history`

Rule:

> $CRED should be the preferred Helixa asset for Multipass services. USDC can remain a compatibility fallback where third-party x402 infrastructure requires it.

## 6. Identity Fragment Catalog

### Agent identity fragments

These describe the agent itself.

- Helixa AgentDNA record: canonical Helixa identity and trust profile.
- ERC-8004 identity: standards-aligned agent identity anchor.
- Bankr profile: agent commerce profile, wallet, token, products, revenue model.
- x402 service profile: paid endpoints and payment requirements.
- Runtime manifest: where the agent runs and how it can be contacted.
- Tool manifest: tools, schemas, permissions, and limits.
- Model/runtime claims: framework, model family, hosting pattern, execution mode.
- Work history source: completed jobs, receipts, reviews, escrow outcomes.
- Swarm membership: roster, role, parent project, shared policies.

### Human ownership fragments

These describe the human or organization behind the agent.

- Wallet control: SIWE/SIWA-style signature or equivalent wallet challenge.
- Smart account ownership: owner set, module policy, multisig or recovery policy.
- Email proof: OTP, magic link, or zkEmail proof.
- Domain proof: DNS TXT, signed file, or hosted challenge.
- Privy linked account: app-level identity hub for wallet, email, socials, and passkeys.
- GitHub: developer identity, organization, repo, contribution context.
- X account: broad social presence and reach.
- Farcaster: FID, verified addresses, social graph, signers.
- Discord/Telegram: community identity and support channel presence.
- Lens/Bluesky: additional social graph and identity signals.

### Human proof fragments

These prove personhood or private attributes without making everything public.

- World ID: uniqueness and personhood proof.
- Self or government ID proof: selective disclosure for age, country, or uniqueness where appropriate.
- Reclaim or zkTLS proof: private claims from web accounts and services.
- zkEmail: email or receipt-derived claims with selective disclosure.
- zkPass: account or attribute proofs from web sessions.
- Human score providers: broad anti-Sybil scoring and credential aggregation.

Privacy rule:

> Store proof results and commitments where possible, not raw private documents or unnecessary personal data.

### Provenance fragments

These explain origin and cultural context.

- NFT collection token.
- Collection verification status.
- Mint, transfer, and sale history.
- Creator or project proof.
- Trait-to-agent template.
- NFT identity-link event.
- Collection-level swarm profile.

### Attestation fragments

These add trust from third parties.

- EAS or similar onchain attestations.
- Signed issuer credentials.
- Partner verification claims.
- Community moderation labels.
- Work completion attestations.
- Dispute outcomes.
- Validation registry references.

### Payment and commercial fragments

These make the identity usable in agent commerce.

- Bankr profile.
- Bankr wallet.
- x402 Cloud endpoint.
- $CRED payment requirement.
- USDC fallback requirement.
- Revenue split policy.
- Fee and burn receipt.
- Product catalog.
- Service level and rate limits.

### Communication fragments

These make the identity reachable.

- Agent message endpoint.
- Human approval route.
- Support channel.
- Webhook target.
- Agent-to-agent route.
- Human-in-the-loop approval policy.
- Signed response capability.

## 7. Human Surface

The human surface should feel like a premium control room, not a protocol explorer.

### Public card

Shows:

- name
- art or avatar
- subject type
- owner/controller summary
- agent manager summary
- Cred tier
- key proofs
- active services
- accepted payment asset
- transfer state
- trust warnings if any

### Deep profile

Shows:

- identity graph
- agent details
- human ownership context
- swarm membership
- provenance
- work history
- public proofs
- public payment endpoints
- runtime/service summary
- custody timeline
- Cred context

### Owner dashboard

Shows:

- pending approvals
- linked fragments
- hidden/private fragments
- permissions
- delegated signers
- x402 endpoints
- $CRED fee and burn history
- transfer state
- discovery profile preview
- what agents can see
- what humans can see

The key UI promise:

> Humans can see and control the whole stack without needing to understand every protocol underneath.

## 8. Agent Surface

The agent surface should be boring, structured, and reliable.

### Public machine-readable profile

A public JSON profile should expose:

- subject type
- canonical Multipass ID
- public name and art
- current owner/controller summary
- active agent manager
- public fragments
- public proofs
- service endpoints
- x402 payment requirements
- accepted assets
- trust and Cred summary
- message routes
- schema version

### Agent card

A compact profile designed for agent discovery should include:

- capabilities
- endpoints
- payment requirements
- trust requirements
- supported protocols
- contact policy
- response schema
- rate limits

### Communication routes

Recommended route types:

- `agent_direct`: message the agent runtime.
- `owner_approval`: request human approval.
- `operator_support`: contact operator or project team.
- `x402_call`: paid API request.
- `verification_request`: ask for proof refresh or additional attestation.
- `swarm_route`: route to parent swarm or specific member.

Rule:

> If an agent can discover a Multipass, it should know how to verify it, message it, and pay it.

## 9. Bankr x402 Cloud and $CRED Rebuild

The current x402 system should be rebuilt around Bankr x402 Cloud and $CRED.

### Why rebuild

The old system was too custom and too USDC-centered. Bankr x402 Cloud gives us a managed path for paid API endpoints, hosting, payment verification, settlement, logs, and agent discovery. That maps directly to Multipass.

### Responsibility boundaries

Multipass owns:

- identity graph and fragment state
- public profile, agent card, and discovery metadata
- endpoint catalog and product descriptions
- pricing policy and visibility policy
- $CRED-first business rules
- receipt fragment normalization
- burn and revenue accounting display
- owner dashboard controls
- redaction policy for public, gated, private, and hidden data

Bankr x402 Cloud owns where supported:

- hosted endpoint runtime
- x402 payment challenge and verification
- settlement execution
- endpoint logs
- encrypted environment variable injection
- Bankr marketplace or agent discovery listing
- Bankr-side receipts or settlement records

Shared boundary:

- Multipass should store normalized receipt fragments that reference Bankr receipt IDs or settlement hashes, not raw private response payloads.
- Multipass should publish endpoint metadata, but Bankr should remain the source of truth for payment verification and settlement status where Bankr hosted the endpoint.
- Refunds, disputes, and failed settlements should become receipt-status fragments in Multipass, while Bankr remains the settlement-status source for Bankr-hosted calls.
- USDC fallback should be represented as endpoint compatibility metadata, not the primary Helixa economic rail.

### Target model

Use Bankr x402 Cloud for public paid endpoints such as:

- agent lookup
- Multipass lookup
- identity fragment report
- Cred report
- owner verification summary
- swarm roster
- identity link quote
- proof refresh request
- work history export
- paid message or intro request
- premium data bundle

Preferred asset:

- $CRED on Base

Fallback asset:

- USDC only where external clients or infrastructure still require it

### $CRED roles

$CRED can be used for:

- paid API access
- premium identity reports
- identity linking fees
- verification fees
- collection onboarding
- proof refreshes
- swarm dashboards
- runtime handoff services
- agent-to-agent paid messages
- discounts and access tiers
- buyback and burn accounting

$CRED must not be used for:

- directly increasing Cred score
- hiding negative history
- buying trust labels
- bypassing verification

### Endpoint discovery

Each paid endpoint should be listed in the Multipass discovery profile with:

- endpoint URL
- method
- schema
- price
- accepted asset
- settlement chain
- rate limits
- description
- expected response
- trust requirements

### Receipts

Every paid request should produce a receipt fragment:

- endpoint called
- payer
- subject Multipass
- amount
- asset
- settlement hash or Bankr receipt
- timestamp
- burn amount if any
- response class, not private payload

Receipt fragments can contribute to activity history, but not directly to Cred score without outcome validation.

### Rebuild phases

1. Inventory existing x402 endpoints and remove stale assumptions.
2. Define Bankr x402 Cloud endpoint templates.
3. Add $CRED pricing and fallback rules.
4. Add receipt fragments to the Multipass graph.
5. Add public endpoint listings to the discovery profile.
6. Add owner dashboard controls for endpoint visibility and pricing.
7. Add agent-readable schemas and examples.
8. Add monitoring, logs, and abuse limits.

## 10. Agent NFT Layer

Agent NFTs remain important, but they are one fragment type.

NFTs can provide:

- art
- provenance
- collection membership
- cultural identity
- ownership trigger
- identity-link source
- marketplace transfer signal
- swarm roster membership

Multipass adds:

- named agent identity
- human owner context
- identity graph
- permissions
- payment rails
- x402 endpoints
- work history
- Cred context
- custody epochs
- runtime and tool metadata

Public language should treat NFTs as linked provenance, collection context, or NFT-based identity layers. Keep the core product framed as the premium identity stack. Internal language can use binding when discussing protocol mechanics.

## 11. Swarm Model

A swarm Multipass is a parent identity for a collection, project, or coordinated group of agents.

A swarm Multipass should show:

- parent project identity
- human/project owner
- agent roster
- per-agent Multipass links
- collection proof
- shared tools
- shared policies
- shared payment endpoints
- aggregate Cred context
- per-agent Cred preserved
- revenue routing
- dispute and moderation policy

Rule:

> Aggregate swarm trust should never erase individual agent history.

## 12. Transfer and Custody

Transfers should be safe, visible, and explicit.

When ownership changes:

1. Detect transfer or claim event.
2. Mark Multipass `transfer_pending`.
3. Pause dangerous permissions.
4. Require new owner claim.
5. Start new custody epoch.
6. Move old owner/operator fragments to historical or pending.
7. Reverify wallets, signers, APIs, and tool permissions.
8. Keep public identity, provenance, and work history visible.
9. Show clear ownership-change context in Cred and trust displays.

Never blindly transfer:

- private keys
- API keys
- paid tool credentials
- live signers
- production secrets
- hidden human data
- private memory

## 13. Data Visibility

Every fragment needs a visibility policy.

### Public

Safe for anyone or any agent to see.

Examples:

- public profile name
- avatar/art
- public wallet
- public social link
- public service endpoint
- public attestations
- public work receipts

### Gated

Visible after payment, permission, or approved requester status.

Examples:

- premium Cred report
- detailed identity graph
- extended work history
- collection analytics
- advanced owner verification summary

### Private

Visible only to owner or approved operator.

Examples:

- email address
- private proof details
- hidden socials
- internal notes
- private owner metadata

### Hidden

Stored only as commitment, hash, or encrypted reference.

Examples:

- sensitive proof material
- encrypted soul/config export
- private runtime config
- secrets references

## 14. MVP Recommendation

Build first:

1. Multipass schema as premium identity graph.
2. Public card and deep profile for agents.
3. Human owner dashboard lite.
4. Identity fragment model with statuses, assurance levels, visibility, and transfer policy.
5. Core fragments:
   - Helixa AgentDNA
   - ERC-8004 identity
   - Bankr profile
   - wallet/smart account
   - domain/email
   - X
   - Farcaster
   - GitHub
   - NFT collection token
   - x402 endpoint
6. Agent discovery JSON and agent card.
7. Bankr x402 Cloud paid endpoints with $CRED as preferred asset.
8. Receipt fragments for paid endpoint usage.
9. Custody epoch model.
10. Swarm parent profile lite.

Do not build first:

- full native marketplace
- wallet custody
- generalized human social network
- full private data marketplace
- blind runtime transfer
- complex zk proof marketplace
- full automated agent permissions without human approvals

## 15. Roadmap

### Phase 0: Foundation

- Rewrite positioning around premium identity stack.
- Define Multipass, owner, agent manager, fragment, payment, discovery, and custody schemas.
- Define visibility and transfer policies.
- Define agent-readable JSON schema.

### Phase 1: Public Identity Surface

- Premium public card.
- Deep profile.
- Human owner summary.
- Agent manager summary.
- Key fragments and proof badges.
- Custody state.
- Cred context.

### Phase 2: Fragment Linking

- Wallet challenge.
- Bankr profile link.
- AgentDNA/Helixa link.
- ERC-8004 link.
- X/Farcaster/GitHub/domain/email links.
- NFT collection token link.
- x402 endpoint link.

### Phase 3: Human Owner Dashboard

- Manage public/private visibility.
- Approve agent-managed updates.
- View linked fragments.
- Revoke permissions.
- See what agents can discover.
- See paid endpoint settings.

### Phase 4: Agent Discovery and Communication

- Public JSON profile.
- Agent card.
- OpenAPI/tool manifest links.
- x402 manifest.
- Message routes.
- Owner approval route.

### Phase 5: Bankr x402 Cloud Rebuild

- Move paid endpoints to Bankr x402 Cloud where possible.
- Price in $CRED where supported.
- Keep USDC fallback for compatibility.
- Add endpoint discovery to Multipass.
- Add receipt fragments.
- Add burn and revenue accounting.

### Phase 6: Custody and Transfer

- Transfer detection.
- Claim flow.
- New custody epoch.
- Permission pause.
- Reverification.
- Historical owner/operator context.

### Phase 7: Swarm Multipass

- Parent swarm profile.
- Roster.
- Shared tools and policies.
- Aggregate Cred context.
- Per-agent reputation preserved.
- Shared x402 endpoints.

### Phase 8: Advanced Proofs

- World ID.
- Government ID selective disclosure.
- zkEmail.
- Reclaim or zkTLS proofs.
- Human score providers.
- Private proof commitments.

### Phase 9: NFT and Marketplace Layer

- Collection browsing.
- NFT identity-link flow.
- External trade links.
- Later native marketplace rails.
- Transfer-aware Multipass handoff.

### Phase 10: Runtime Handoff

- Encrypted config export.
- Public soul export.
- Private owner-approved memory/context export.
- API key rotation.
- signer reset.
- smart account ownership support.
- redeploy flow.

## 16. MVP API Contract Appendix

These are minimal contracts for planning. They can evolve, but implementation should not start without versioned schemas.

### URL conventions

Recommended public routes:

- `/multipass/{slug}`: human profile.
- `/api/multipass/{id}`: canonical JSON profile.
- `/api/multipass/{id}/agent-card`: compact agent discovery card.
- `/api/multipass/{id}/fragments`: public and requester-authorized fragments.
- `/api/multipass/{id}/x402`: x402 endpoint manifest.
- `/api/multipass/{id}/receipts/{receipt_id}`: normalized receipt fragment.
- `/.well-known/helixa-multipass.json`: site-level discovery pointer where useful.

All machine-readable responses should include:

- `schema_version`
- `multipass_id`
- `generated_at`
- `visibility_context`
- `redaction_policy`

### Canonical JSON profile required fields

Required:

- `schema_version`
- `multipass_id`
- `subject_type`
- `display_name`
- `status`
- `owner_summary`
- `agent_manager_summary` optional
- `custody_epoch`
- `public_fragments`
- `cred_summary`
- `discovery_profile`
- `payment_profile`
- `updated_at`

Redaction rule:

> Public JSON returns only public fragments by default. Gated and private fragments require an authorized requester, a paid endpoint, or explicit owner approval. Hidden fragments never return raw contents.

### Agent card required fields

Required:

- `schema_version`
- `multipass_id`
- `name`
- `subject_type`
- `capabilities`
- `message_routes`
- `service_endpoints`
- `x402_manifest_url`
- `accepted_assets`
- `trust_summary`
- `rate_limits`
- `contact_policy`

The agent card should be small enough for other agents to ingest quickly. It should point to deeper JSON rather than embedding the full graph.

### x402 manifest required fields

Required per endpoint:

- `endpoint_id`
- `url`
- `method`
- `description`
- `request_schema_url` or inline schema
- `response_schema_url` or inline schema
- `price`
- `asset`
- `chain_id`
- `provider`: `bankr_x402_cloud`, `self_hosted`, or `partner`
- `settlement_reference_policy`
- `rate_limit`
- `visibility`: `public` or `gated`
- `requires_owner_approval`

### Receipt fragment required fields

Required:

- `receipt_id`
- `multipass_id`
- `endpoint_id`
- `provider`
- `payer` redacted when needed
- `amount`
- `asset`
- `chain_id`
- `status`: `pending`, `settled`, `failed`, `refunded`, `disputed`
- `provider_receipt_id` optional
- `settlement_hash` optional
- `burn_amount` optional
- `created_at`
- `settled_at` optional
- `response_class`

Receipt boundary:

> Store enough to prove payment activity and support analytics. Do not store private request payloads or raw response payloads in public receipt fragments.

## 17. Open Questions

1. Should $CRED be mandatory for Helixa-hosted x402 endpoints, or preferred with USDC fallback from day one?
2. What should be public by default for human owners: display name, wallet, socials, or only verified presence badges?
3. Should agent-managed updates publish immediately within allowed scopes, or require human approval until the agent earns enough trust?
4. Which human proof provider should be first: World ID, government ID selective disclosure, zkEmail, or Reclaim?
5. What should be the first paid Multipass endpoint: agent lookup, identity fragment report, Cred report, or owner verification summary?

## 18. Recommended Immediate Next Steps

1. Update product language everywhere: Multipass is a premium identity stack.
2. Treat the agent NFT layer as provenance and ownership context, not the core product.
3. Define the identity fragment schema as the foundation.
4. Build the agent-readable discovery profile early.
5. Start x402 rebuild around Bankr x402 Cloud with $CRED-first pricing.
6. Make the owner dashboard explain what is human-controlled, agent-managed, public, gated, private, and hidden.
7. Keep Cred protected: payments and burns buy access or services, not reputation.
