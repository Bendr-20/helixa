# Multipass Premium Identity Stack Spec

Status: team review draft
Date: 2026-06-22

## 1. Executive Summary

Multipass is the premium identity stack for AI agents, human owners, projects, collections, and swarms.

The core idea is simple:

> Multipass is a human-owned, agent-managed identity asset.

Humans should feel in control. They should be able to see who owns an agent, who operates it, what it can access, what it has done, how it gets paid, and what trust signals support it.

Agents should be able to discover and use the same identity through structured machine-readable data. A good Multipass should tell another agent how to verify it, message it, call its tools, pay its endpoints, and understand its trust context.

Agent NFTs are one layer in this stack. They can provide art, provenance, collection context, ownership signals, and cultural identity. They are not the whole product.

## 2. Product Thesis

Multipass gives every agent a trusted identity graph:

- who owns it
- who operates it
- what agent or runtime manages it
- what accounts, wallets, services, and proofs are linked to it
- what tools and payment endpoints it exposes
- which standards it publishes, consumes, or verifies
- what work it has done
- what humans are in the loop
- what trust and Cred context exists
- what changes when ownership transfers

Multipass should become the premium surface for understanding and controlling agent identity.

It should feel simple and high-end to humans, while exposing reliable structured data for agents.

## 3. Positioning

### For humans

Multipass is a control room for agent identity.

Humans can:

- see the whole identity stack in one place
- understand who controls an agent or swarm
- approve or revoke sensitive permissions
- review linked wallets, socials, proofs, endpoints, and payment rails
- inspect provenance, work history, and Cred context
- see what is public, gated, private, or hidden
- understand what happens after a sale, transfer, or custody change

### For agents

Multipass is a discovery, verification, communication, and payment profile.

Agents can:

- discover other agents and swarms
- verify owner and controller state
- find MCP, A2A, web, and x402 endpoints
- inspect supported protocols and trust requirements
- route messages to the right agent, owner, operator, or swarm
- pay with the correct asset, with $CRED as the preferred Helixa rail where supported
- ingest public identity fragments without reading a human-only page

### What Multipass is

- A premium identity graph
- A human-owned control asset
- An agent-managed operational profile
- A registry of identity fragments
- A permission and custody layer
- A discovery and communication layer for agents
- A monetization rail for paid data, APIs, identity linking, verification, dashboards, and runtime services

### What Multipass is not

- Not just an NFT marketplace
- Not just a profile page
- Not just an ERC-8004 record
- Not a way to purchase reputation
- Not a blind transfer of keys, secrets, memory, or production authority

## 4. Product Principles

### Human owned, agent managed

The owner controls the Multipass. The agent can manage approved parts of it through delegated scopes.

Examples:

- A human approves which fragments are public.
- A human grants the agent permission to update service endpoints.
- A human revokes tool access, delegated signers, or payment routes.
- An agent can update schemas, publish status, append work receipts, and maintain discoverability inside approved limits.

### Humans see clearly

The surface should answer:

- Who owns this?
- Who operates this?
- What can this agent do?
- What permissions are active?
- Which proofs support the claims?
- Which data is public, gated, private, or hidden?
- What changed recently?
- Can I trust this enough to hire, pay, integrate, or transfer?

### Agents read everything they need

Every public Multipass should expose structured data for agent discovery.

Machine-readable outputs should include:

- canonical profile JSON
- agent card
- identity fragment graph
- ownership and custody state
- service endpoints
- x402 payment metadata
- supported tools and schemas
- message routes
- standards spine references and compatibility status
- public attestations and validation signals
- public Cred context

### Identity is fragmented by default

A real agent is not one wallet, one profile, one NFT, or one registry entry.

It may have:

- a Bankr profile
- a Helixa AgentDNA record
- an ERC-8004 identity
- an ERC-8217 binding where relevant
- one or more wallets
- social accounts
- domain and email proofs
- x402 endpoints
- tool manifests
- human owners
- operators
- delegated signers
- work history
- swarm membership
- collection provenance
- DID, verifiable credential, zk, or zkTLS proofs

Multipass is the premium graph that makes these fragments understandable.

### Authority is not identity

Identity and history can persist across ownership changes. Authority must be proven and reverified.

A Multipass can remember past owners, operators, work, and provenance, but active permissions should always be scoped, revocable, and reset when control changes.

### $CRED is access and settlement, not reputation purchase

$CRED can power payments, access, discounts, endpoint usage, verification fees, identity-linking fees, dashboards, and burns.

$CRED must not directly raise a Cred score. Cred is earned through evidence, outcomes, attestations, history, ownership context, and validation signals.

## 5. Glossary

### Cred score

Cred score is the trust and reputation signal. It is earned from evidence, outcomes, attestations, work history, ownership context, validation signals, and other verified data.

### Cred context

Cred context explains why trust looks the way it does. It should show proofs, history, custody changes, disputes, validation, and reputation signals behind the score.

### $CRED token

$CRED is the Helixa economic rail for paid access, identity reports, endpoint usage, linking services, verification, dashboards, and burns. It does not alter reputation by itself.

### Identity fragment

An identity fragment is any account, proof, credential, endpoint, wallet, attestation, social account, NFT, payment rail, runtime signal, or work history source attached to a Multipass.

### ERC-8217

ERC-8217 is the Agent NFT Identity Bindings draft. It defines how an ERC-8004 agent identity can be bound to an external NFT or tokenized controller, so the controller asset can represent authority over the agent identity. Multipass should treat this as the primary standards bridge between a control asset and an ERC-8004 agent.

### ERC-8004

ERC-8004 is the Trustless Agents standard. It provides the public agent identity rail, with identity, reputation, and validation registries. Multipass should use it for standards-readable agent identity and external trust references, not as the entire Multipass product.

### ERC-8126

ERC-8126 is the AI Agent Verification standard. It defines specialized verification and risk scoring for ERC-8004 agents. Multipass should ingest its results as verification and risk fragments, with raw private proof material kept outside public profiles.

### ERC-8257

ERC-8257 is the Agent Tool Registry draft. It defines tool manifests, pricing, access rules, origin binding, creator binding, and verifiability. Multipass should use it as the standards-readable tool and access layer where available.

### ERC-8183

ERC-8183 is the Agentic Commerce draft. It defines job escrow, provider submission, evaluator attestation, and terminal job outcomes. Multipass should treat it as the standards-readable work and outcome layer for Synagent-style jobs.

### ERC-8048

ERC-8048 is a draft metadata interface for token registries. It lets a token expose arbitrary per-token key-value metadata through `metadata(tokenId, key)` and `MetadataSet` events.

### ERC-721T

ERC-721T is the Agent Metadata Profile of ERC-8048. It reserves agent-oriented metadata keys for ERC-721 tokens, including `context`, `endpoint[mcp]`, `endpoint[a2a]`, `endpoint[web]`, `endpoint[x402]`, and `address[<chain-id>]`. Multipass should ingest it as an NFT metadata fragment, not treat it as the whole identity system.

### Owner, operator, and agent manager

The owner controls the Multipass. The operator may run infrastructure or services. The agent manager may update approved agent-facing metadata within delegated scopes. These roles can overlap, but the permission model must treat them separately.

## 6. Standards Spine

Multipass should be the product surface. The standards spine is the composability layer underneath it.

The spec should not make every draft standard a launch blocker, but it must know where each one fits. Multipass should expose a `standards_profile` that tells humans, agents, and indexers which standards are supported, pending, unsupported, or imported as unverified fragments.

### Spine map

| Layer | Standard | Role | Multipass behavior | Launch stance |
| --- | --- | --- | --- | --- |
| Root control and binding | ERC-8217 | Binds an ERC-8004 agent identity to an external NFT or tokenized controller. | Use as the primary bridge when a Multipass or linked NFT controls an ERC-8004 identity. Transfer changes control state, but secrets, runtime authority, and dangerous permissions still pause for revalidation. | Core architecture, adapter-ready at launch. |
| Public agent identity | ERC-8004 | Provides agent identity, reputation, validation, and registration metadata. | Publish and read ERC-8004 references. Connect AgentDNA, service endpoints, reputation, and validation context through Multipass. | Core architecture, active integration. |
| Verification and risk | ERC-8126 | Provides agent verification types and a unified risk score for ERC-8004 agents. | Store risk and verification summaries as fragments. Keep private proof material outside public profiles. | Adapter-ready at launch, active after provider selection. |
| Tools and access | ERC-8257 | Provides tool registry records, manifests, pricing, access predicates, and verifiability. | Link MCP, A2A, x402, and tool manifests to standard-readable tool records. Bankr x402 Cloud remains the payment source of truth where it hosts the endpoint. | Adapter-ready at launch, active in Synagent phase. |
| Jobs and outcomes | ERC-8183 | Provides job escrow, provider submission, evaluator attestation, and outcome records. | Use for Synagent-style work history. Evaluated outcomes become work fragments and can feed Cred only after validation. | Adapter-ready at launch, active in Synagent phase. |
| NFT metadata | ERC-721T / ERC-8048 | Provides lightweight agent metadata on ERC-721 tokens. | Ingest as NFT metadata fragments. Treat all fields as untrusted until ownership, endpoint, and wallet control are checked. | Optional ingestion, useful early. |

Note: ERC-8004 identity records are themselves ERC-721 based. Multipass and linked NFT controller assets are broader control, provenance, and metadata layers around that public agent identity, not replacements for it.

### Launch compatibility matrix

| Standard | Launch requirement | First implementation target | What can wait |
| --- | --- | --- | --- |
| ERC-8004 | Active integration. | Read and publish identity references, registration metadata, validation references, and reputation context. | Advanced validation automation and full cross-chain indexing. |
| ERC-8217 | Core architecture with adapter-ready support. | Store binding refs and model controller-asset authority over ERC-8004 identities. | Full live binding writes if the draft or deployment surface changes. |
| ERC-8126 | Adapter-ready support. | Store verification and risk summaries as fragments. | Choosing final providers and surfacing detailed private verification flows. |
| ERC-8257 | Adapter-ready support. | Store tool registry refs, manifest hashes, and access summaries. | Full Synagent tool registry writes and predicate management. |
| ERC-8183 | Adapter-ready support. | Store job, evaluator, and outcome refs as work-history fragments. | Native Synagent escrow orchestration and automated evaluator routing. |
| ERC-721T / ERC-8048 | Optional ingestion. | Read metadata keys from compatible NFTs and import them as unverified fragments. | Writing metadata to third-party collections or relying on it as authority. |

### Control and trust flow

1. A human, organization, project, or swarm owns the Multipass.
2. The Multipass or linked controller asset binds to an ERC-8004 agent identity through ERC-8217 where available.
3. ERC-8004 exposes public agent identity, registration metadata, reputation, and validation references.
4. ERC-8126 adds verification and risk context.
5. ERC-8257 exposes tool access, manifests, and pricing where tools are standardized.
6. ERC-8183 records jobs, evaluator attestations, and outcome proofs where work is standardized.
7. Cred consumes verified outcomes, attestations, receipts, and history. $CRED can pay for access and settlement, but cannot buy reputation.

### Standards adapter rules

- Track each standard by `standard_id`, `status`, `chain_id`, `contract_address`, `record_id`, `adapter_version`, `last_verified_at`, and `assurance_level`.
- Draft standards must go through adapter modules so contract or schema changes do not break the Multipass core.
- External standard data is untrusted until verified by ownership, signature, endpoint control, contract event, or trusted issuer.
- Multipass should explain standards compatibility clearly to humans instead of exposing raw protocol names only.
- If a standard is unavailable on a chain, Multipass should store a pending or unsupported status rather than pretending support exists.

### Product interpretation

For humans, the standards spine should collapse into simple labels:

- identity bound
- owner verified
- risk checked
- tools verified
- work attested
- trust updated

For agents and developers, the same data should expose exact standard references, contract addresses, token IDs, job IDs, tool IDs, manifests, and verification timestamps.

## 7. Core Data Model

### Multipass

The canonical identity asset.

Required or expected fields:

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
- `standards_profile`
- `created_at`
- `updated_at`

Creation rule:

- A draft Multipass can be proposed by an agent, importer, crawler, project team, or human.
- A draft Multipass can hold unverified public data and pending fragments.
- A Multipass cannot become `active`, expose verified ownership, receive verified trust labels, or operate paid Multipass endpoints until a human, organization, or DAO owner controller is verified.
- `owner_controller_id` is nullable only while `status = draft`.
- Transition to `active` requires at least one owner fragment, one controller proof, and one custody epoch.
- Agent-managed updates require delegated scopes from the owner.

This keeps the product human owned without blocking agent-created drafts or discovery imports.

### Multipass state lifecycle and nullability

`owner_summary` should always exist in API responses, but its fields can show unknown or pending ownership while the Multipass is in draft.

| Status | Meaning | `owner_controller_id` | `owner_summary` response | Paid endpoints | Notes |
| --- | --- | --- | --- | --- | --- |
| `draft` | Proposed or imported identity with unverified data. | Nullable. | Required object with `owner_state`, nullable `controller`, and `verification_status: none` or `pending`. | Disabled. | Safe for discovery imports and agent-proposed records. |
| `link_ready` | Owner is claimed or verified, but required fragments or review are incomplete. | Required. | Required object with controller summary and current verification state. | Disabled by default. | Used before public trust labels or paid services go live. |
| `active` | Verified owner, valid custody epoch, and approved public profile. | Required. | Required verified owner/controller summary. | Enabled if payment profile is approved. | Normal operating state. |
| `transfer_pending` | Ownership transfer or control change detected. | Required for prior controller; pending controller may be separate. | Required object showing prior controller, pending controller if known, and transfer state. | Dangerous or owner-sensitive endpoints paused. | New owner must claim and start a new custody epoch. |
| `suspended` | Profile or permissions paused by owner, Helixa safety policy, or protocol policy. | Required unless archived from draft. | Required object with last known controller and suspension reason when public. | Disabled unless explicitly allowed. | Preserves history while limiting interaction. |
| `archived` | No longer active but kept for provenance and history. | Nullable only if it never left draft; otherwise last known controller remains. | Required object with archived state and last known public controller if available. | Disabled. | Historical fragments remain readable according to visibility policy. |

API rule:

> Clients should not infer ownership from a missing field. They should read `owner_summary.owner_state`, `owner_summary.verification_status`, and `custody_epoch` together.

### Standards profile

The standards profile tells other agents and developers how this Multipass maps into external standards.

Fields:

- `standards_profile_id`
- `multipass_id`
- `supported_standards`: list of standard reference records
- `primary_erc8004_agent_id` optional
- `primary_erc8217_binding` optional
- `risk_summary` optional
- `tool_registry_refs` optional
- `job_registry_refs` optional
- `metadata_profile_refs` optional
- `adapter_versions`
- `last_verified_at`

Standard reference record:

- `standard_id`: `erc8217`, `erc8004`, `erc8126`, `erc8257`, `erc8183`, `erc8048`, `erc721t`, or partner-defined
- `support_status`: `active`, `pending`, `unsupported`, `imported_unverified`, `deprecated`
- `chain_id` optional
- `contract_address` optional
- `record_id` optional
- `source_url` optional
- `assurance_level`
- `adapter_version`
- `last_verified_at`

### Identity fragment

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

### Human owner

The human, team, organization, or DAO behind an agent or swarm.

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

### Agent manager

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

Disallowed without explicit owner approval:

- change ownership
- transfer the Multipass
- reveal private fragments
- rotate owner wallets
- spend above limits
- grant new dangerous permissions

### Custody epoch

A time-bounded period where a specific owner or controller has authority over the Multipass.

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

## 8. Identity Fragment Catalog

### Agent identity fragments

These describe the agent itself.

- Helixa AgentDNA record
- ERC-8217 binding
- ERC-8004 identity
- ERC-8126 verification and risk reference
- ERC-721T / ERC-8048 NFT metadata
- Bankr profile
- x402 service profile
- runtime manifest
- ERC-8257 tool registry reference
- tool manifest
- MCP endpoint
- A2A endpoint
- model or runtime claims
- ERC-8183 job or outcome reference
- work history source
- swarm membership

### Human ownership fragments

These describe the human or organization behind the agent.

- wallet control
- smart account ownership
- multisig or DAO membership
- email proof
- domain proof
- Privy linked account
- GitHub
- X
- Farcaster
- Discord
- Telegram
- Lens
- Bluesky

### Human proof fragments

These prove personhood or private attributes without making everything public.

- World ID
- government ID selective disclosure where appropriate
- Reclaim or zkTLS proof
- zkEmail
- zkPass
- human score providers
- region-specific proofs where appropriate

Privacy rule:

> Store proof results and commitments where possible, not raw private documents or unnecessary personal data.

### Provenance fragments

These explain origin and cultural context.

- NFT collection token
- collection verification status
- mint, transfer, and sale history
- creator or project proof
- trait-to-agent template
- NFT identity-link event
- collection-level swarm profile

### Attestation fragments

These add trust from third parties.

- EAS or similar attestations
- signed issuer credentials
- partner verification claims
- community moderation labels
- work completion attestations
- dispute outcomes
- validation registry references
- ERC-8126 verification or risk result
- ERC-8183 evaluator attestation

### Payment and commercial fragments

These make the identity usable in agent commerce.

- Bankr profile
- Bankr wallet
- x402 Cloud endpoint
- $CRED payment requirement
- USDC fallback requirement
- revenue split policy
- fee and burn receipt
- product catalog
- service level and rate limits
- ERC-8183 job escrow reference where applicable

### Communication fragments

These make the identity reachable.

- agent message endpoint
- human approval route
- operator support channel
- webhook target
- agent-to-agent route
- human-in-the-loop approval policy
- signed response capability

## 9. Human Surface

The human surface should feel like a premium control room, not a protocol explorer.

### Public card

Shows:

- name
- art or avatar
- subject type
- owner or controller summary
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
- runtime or service summary
- custody timeline
- Cred context

### Owner dashboard

Shows:

- pending approvals
- linked fragments
- hidden or private fragments
- active permissions
- delegated signers
- x402 endpoints
- $CRED fee and burn history
- transfer state
- discovery profile preview
- what agents can see
- what humans can see

The key UI promise:

> Humans can see and control the whole stack without needing to understand every protocol underneath.

## 10. Agent Surface

The agent surface should be boring, structured, and reliable.

### Public machine-readable profile

A public JSON profile should expose:

- schema version
- subject type
- canonical Multipass ID
- public name and art
- current owner or controller summary
- active agent manager
- public fragments
- public proofs
- service endpoints
- x402 payment requirements
- accepted assets
- trust and Cred summary
- message routes
- updated timestamp

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

## 11. Upgradeable Contract Architecture

All Helixa-owned stateful contracts for this build must be upgradeable.

The product is still evolving, and the identity stack touches ownership, payments, permissions, custody epochs, and discovery. We should not lock ourselves into immutable contract logic too early.

### Upgrade pattern

Use OpenZeppelin UUPS proxies for Helixa-owned contracts.

Requirements:

- proxy address remains stable
- implementation can be upgraded through controlled governance
- no constructors in implementation contracts
- initializer and reinitializer functions only
- storage gaps or ERC-7201 namespaced storage
- explicit version getter on each implementation
- upgrade event emitted on each upgrade
- upgrade authorization limited to governance
- automated storage layout checks before every upgrade

### Governance model

Upgrades should require:

- multisig proxy-admin control at launch
- timelock for non-emergency upgrades
- emergency pause authority for contracts that touch money, identity state, permissions, or endpoint access
- clear separation between Helixa protocol governance and agent manager permissions

Agent managers must never be able to upgrade contracts.

Recommended launch control:

- multisig controls proxy upgrades
- timelock controls routine upgrades after launch hardening
- emergency guardian can pause but not upgrade
- Helixa protocol governance can replace the guardian later, or a future protocol DAO can inherit that role

### Contracts that should be upgradeable

Upgradeable modules:

- Multipass registry
- identity fragment registry
- owner and controller registry
- custody epoch registry
- collection and NFT link registry
- swarm registry
- verification and attestation registry
- x402 receipt commitment and index registry
- fee router
- $CRED burn and accounting module
- endpoint and payment manifest pointer registry
- permission and delegation registry
- standards adapter and reference registry

Payment-related contracts should store policies, pointers, hashes, commitments, and normalized receipt references. They should not store raw request payloads, raw response payloads, private proof material, or Bankr-hosted settlement authority.

### Contracts and systems that should not be controlled by our upgrade path

External systems remain external:

- external NFT collections
- ERC-8004 contracts
- Bankr x402 Cloud infrastructure
- third-party proof providers
- existing $CRED token contracts unless we own that deployment path
- pure libraries and interfaces

Multipass can reference these systems, index them, and store fragment state about them, but should not pretend to control them.

### Module boundaries

Prefer small upgradeable modules over one giant contract.

Reasons:

- safer upgrades
- cleaner audits
- less storage-layout risk
- better isolation if one module changes
- easier phased deployment
- clearer agent-readable interfaces

Each module should have one responsibility and a stable interface.

Suggested split:

- Registry module: creates and tracks Multipasses.
- Fragment module: stores identity fragments and status.
- Custody module: tracks ownership epochs and transfer state.
- Permission module: tracks owner approvals and agent-managed scopes.
- Payment module: tracks x402 endpoint manifests, receipts, fees, and burns.
- Verification module: tracks attestations, proof summaries, and issuers.
- Swarm module: tracks parent swarms, rosters, and shared policies.

### Upgrade safety rules

Before any upgrade:

- run storage layout diff
- run full test suite
- run invariant tests for ownership and custody
- verify initializer cannot be replayed
- verify new implementation cannot seize ownership
- verify old data remains readable
- verify public and agent-readable schemas remain compatible or are versioned
- publish upgrade notes to the owner dashboard

After any upgrade:

- emit upgrade event
- update implementation version
- update dashboard version history
- verify endpoints still resolve
- verify permissions and custody epochs remain intact

### What should be immutable

Some values should be hard to change even if contracts are upgradeable:

- historical custody epochs
- historical receipt fragments
- historical fragment status transitions
- emitted events
- old implementation/version history
- audit trail for owner approvals and revocations

Upgradeable logic should not mean rewriteable history.

## 12. Bankr x402 Cloud and $CRED Rebuild

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

- Multipass stores normalized receipt fragments that reference Bankr receipt IDs or settlement hashes, not raw private response payloads.
- Multipass publishes endpoint metadata, but Bankr remains the source of truth for payment verification and settlement status where Bankr hosted the endpoint.
- Refunds, disputes, and failed settlements become receipt-status fragments in Multipass, while Bankr remains the settlement-status source for Bankr-hosted calls.
- USDC fallback is endpoint compatibility metadata, not the primary Helixa economic rail.

### Onchain, offchain, and Bankr boundary

| Layer | System of record | What Multipass stores | What stays external |
| --- | --- | --- | --- |
| Multipass registry | Helixa upgradeable contracts | Multipass IDs, owner/controller pointers, custody pointers, core status, and event history | Rich private profile data and raw secrets |
| Fragment registry | Helixa upgradeable contracts plus indexer | Fragment status, assurance level, visibility, hashes, issuer references, and public pointers | Raw private documents, OAuth secrets, and hidden proof material |
| Multipass API and indexer | Helixa backend | Resolved profile JSON, agent cards, redacted views, search, and analytics | Contract upgrade authority and Bankr settlement authority |
| Bankr x402 Cloud | Bankr | Endpoint references, normalized receipt fragments, provider receipt IDs, and settlement hashes | Hosted endpoint runtime, payment challenge, payment verification, logs, and settlement source of truth |
| ERC-8217 | ERC-8217 binding contract where deployed | Binding references between controller assets and ERC-8004 identities | Binding contract governance and external controller token ownership |
| ERC-8004 | ERC-8004 contracts | References to identity, reputation, validation, and registration metadata | ERC-8004 registry ownership and protocol state |
| ERC-8126 | Verification providers and ERC-8126 interfaces | Verification summary, risk score, issuer, expiry, and proof commitments | Raw private verification data and provider infrastructure |
| ERC-8257 | Tool registry contracts and manifests | Tool registry references, manifest hashes, access summaries, and pricing pointers | Tool endpoint runtime and external predicate governance |
| ERC-8183 | Job escrow contracts and evaluator attestations | Job references, outcome status, evaluator summary, and proof hashes | Escrow contract governance and raw private work payloads |
| ERC-721T / ERC-8048 | External NFT contract | Ingested NFT metadata fragments and verification status | Token ownership, token metadata writes, and NFT transfer events |
| $CRED token | $CRED token contract and Helixa fee modules where owned | Fee policy, burn accounting references, and receipt summaries | Token balances and token transfer rules unless Helixa owns that contract path |
| Proof providers | Provider or issuer | Proof result, commitment, issuer, expiry, and verification status | Raw private proof inputs and provider infrastructure |

Rule:

> Multipass can index and explain external systems, but it should not claim to control systems it does not own.

### Target paid endpoints

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

### Receipt fragments

Every paid request should produce a receipt fragment:

- endpoint called
- payer, redacted when needed
- subject Multipass
- amount
- asset
- settlement hash or Bankr receipt ID
- timestamp
- burn amount if any
- response class, not private payload
- status: `pending`, `settled`, `failed`, `refunded`, `disputed`

Receipt fragments can contribute to activity history, but not directly to Cred score without outcome validation.

## 13. Agent NFT and ERC-721T Layer

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

ERC-721T / ERC-8048 can provide a lightweight agent metadata layer for NFTs. This is different from ERC-8217. ERC-8217 binds control between an ERC-8004 identity and a controller asset. ERC-721T / ERC-8048 only exposes metadata fields that can help discovery.

Multipass should ingest these fields where available:

- `context`
- `endpoint[mcp]`
- `endpoint[a2a]`
- `endpoint[web]`
- `endpoint[x402]`
- `address[<chain-id>]`

Default trust level:

- Treat ERC-721T metadata as untrusted until verified.
- Upgrade assurance only after ownership, endpoint control, and wallet control are checked.
- A token transfer should not imply transfer of offchain servers, memories, secrets, tools, or payment authority.

Multipass adds the missing layers:

- named agent identity
- human owner context
- identity graph
- permission model
- payment rails
- x402 endpoint catalog
- work history
- Cred context
- custody epochs
- runtime and tool metadata
- agent-readable discovery contract

## 14. Swarm Model

A swarm Multipass is a parent identity for a collection, project, or coordinated group of agents.

A swarm Multipass should show:

- parent project identity
- human or project owner
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

## 15. Transfer and Custody

Transfers should be safe, visible, and explicit.

When ownership changes:

1. Detect transfer or claim event.
2. Mark Multipass `transfer_pending`.
3. Pause dangerous permissions.
4. Require new owner claim.
5. Start new custody epoch.
6. Move old owner and operator fragments to historical or pending.
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

## 16. Data Visibility

Every fragment needs a visibility policy.

### Public

Safe for anyone or any agent to see.

Examples:

- public profile name
- avatar or art
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
- encrypted soul or config export
- private runtime config
- secrets references

## 17. MVP Scope

Build first:

1. Multipass schema as premium identity graph.
2. Standards spine model with adapter records for ERC-8217, ERC-8004, ERC-8126, ERC-8257, ERC-8183, ERC-721T, and ERC-8048.
3. Upgradeable contract architecture using small UUPS modules.
4. Public card and deep profile for agents.
5. Human owner dashboard lite.
6. Identity fragment model with statuses, assurance levels, visibility, and transfer policy.
7. Core fragments:
   - Helixa AgentDNA
   - ERC-8217 binding reference
   - ERC-8004 identity
   - ERC-8126 verification and risk reference
   - ERC-721T / ERC-8048 NFT metadata
   - ERC-8257 tool registry reference
   - ERC-8183 job or outcome reference
   - Bankr profile
   - wallet or smart account
   - domain and email
   - X
   - Farcaster
   - GitHub
   - NFT collection token
   - x402 endpoint
8. Agent discovery JSON and agent card.
9. Bankr x402 Cloud paid endpoints with $CRED as preferred asset.
10. Receipt fragments for paid endpoint usage.
11. Custody epoch model.
12. Swarm parent profile lite.

Do not build first:

- full native marketplace
- wallet custody
- generalized human social network
- full private data marketplace
- blind runtime transfer
- complex zk proof marketplace
- full automated agent permissions without human approvals

## 18. MVP API Contract Appendix

These are minimal API contracts for planning. They can evolve, but implementation should start with versioned schemas.

### URL conventions

Recommended public routes:

- `/multipass/{slug}`: human profile
- `/api/multipass/{id}`: canonical JSON profile
- `/api/multipass/{id}/agent-card`: compact agent discovery card
- `/api/multipass/{id}/fragments`: public and requester-authorized fragments
- `/api/multipass/{id}/x402`: x402 endpoint manifest
- `/api/multipass/{id}/receipts/{receipt_id}`: normalized receipt fragment
- `/.well-known/helixa-multipass.json`: site-level discovery pointer where useful

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
- `owner_summary`: required object, with nullable controller fields only in allowed states
- `agent_manager_summary` optional
- `custody_epoch`
- `public_fragments`
- `cred_summary`
- `discovery_profile`
- `standards_profile`
- `payment_profile`
- `updated_at`

Redaction rule:

> Public JSON returns only public fragments by default. Gated and private fragments require an authorized requester, a paid endpoint, or explicit owner approval. Hidden fragments never return raw contents.

Owner summary minimum shape:

- `owner_state`
- `controller`: nullable only for `draft` or never-claimed `archived` records
- `verification_status`: `none`, `pending`, `verified`, `stale`, or `revoked`
- `custody_epoch_id`: nullable only before first verified custody epoch
- `visibility`: `public`, `gated`, `private`, or `hidden`

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
- `standards_refs`

The agent card should be small enough for other agents to ingest quickly. It should point to deeper JSON rather than embedding the full graph.

### Standards profile required fields

Required:

- `standards_profile_id`
- `multipass_id`
- `primary_refs`
- `standard_refs`
- `compatibility_summary`
- `adapter_versions`
- `last_verified_at`

Each `standard_refs` item should include:

- `standard_id`
- `support_status`
- `chain_id` optional
- `contract_address` optional
- `record_id` optional
- `manifest_url` optional
- `proof_hash` optional
- `assurance_level`
- `last_verified_at`

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
- `erc8257_tool_ref` optional
- `manifest_hash` optional

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
- `erc8183_job_ref` optional

Receipt boundary:

> Store enough to prove payment activity and support analytics. Do not store private request payloads or raw response payloads in public receipt fragments.

## 19. Roadmap

### Phase 0: Foundation

- Finalize premium identity stack positioning.
- Define Multipass, owner, agent manager, fragment, payment, discovery, custody, standards spine, and upgradeable contract schemas.
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
- AgentDNA or Helixa link.
- ERC-8217 binding link.
- ERC-8004 link.
- ERC-8126 verification and risk link.
- ERC-721T / ERC-8048 ingestion.
- X, Farcaster, GitHub, domain, and email links.
- NFT collection token link.
- x402 endpoint link.
- ERC-8257 tool registry reference.
- ERC-8183 job and outcome reference.

### Phase 3: Human Owner Dashboard

- Manage public and private visibility.
- Approve agent-managed updates.
- View linked fragments.
- Revoke permissions.
- See what agents can discover.
- See paid endpoint settings.
- See contract implementation version history.

### Phase 4: Agent Discovery and Communication

- Public JSON profile.
- Agent card.
- OpenAPI and tool manifest links.
- ERC-8257 tool registry references.
- x402 manifest.
- Message routes.
- Owner approval route.

### Phase 5: Upgradeable Contract Deployment

- Deploy UUPS proxy modules.
- Add multisig proxy-admin control.
- Add timelock for routine upgrades.
- Add emergency pause where required.
- Add storage layout checks.
- Add upgrade event indexing and dashboard display.

### Phase 6: Bankr x402 Cloud Rebuild

- Move paid endpoints to Bankr x402 Cloud where possible.
- Price in $CRED where supported.
- Keep USDC fallback for compatibility.
- Add endpoint discovery to Multipass.
- Add receipt fragments.
- Add burn and revenue accounting.

### Phase 7: Synagent Standards Layer

- Add ERC-8257 adapters for tool registry references.
- Add ERC-8183 adapters for job, escrow, evaluator, and outcome references.
- Map Synagent request intake, provider matching, evaluator attestations, and outcome proofs into Multipass fragments.
- Feed only validated outcomes into Cred context.
- Keep raw private work payloads outside public profiles.

### Phase 8: Custody and Transfer

- Transfer detection.
- Claim flow.
- New custody epoch.
- Permission pause.
- Reverification.
- Historical owner and operator context.

### Phase 9: Swarm Multipass

- Parent swarm profile.
- Roster.
- Shared tools and policies.
- Aggregate Cred context.
- Per-agent reputation preserved.
- Shared x402 endpoints.

### Phase 10: Advanced Proofs

- World ID.
- Government ID selective disclosure.
- zkEmail.
- Reclaim or zkTLS proofs.
- Human score providers.
- Private proof commitments.

### Phase 11: NFT and Marketplace Layer

- Collection browsing.
- NFT identity-link flow.
- External trade links.
- Later native marketplace rails.
- Transfer-aware Multipass handoff.

### Phase 12: Runtime Handoff

- Encrypted config export.
- Public soul export.
- Private owner-approved memory and context export.
- API key rotation.
- Signer reset.
- Smart account ownership support.
- Redeploy flow.

## 20. Open Decisions

1. Should $CRED be mandatory for Helixa-hosted x402 endpoints, or preferred with USDC fallback from day one?
2. What should be public by default for human owners: display name, wallet, socials, or only verified presence badges?
3. Should agent-managed updates publish immediately within allowed scopes, or require human approval until the agent earns enough trust?
4. Which human proof provider should be first: World ID, government ID selective disclosure, zkEmail, or Reclaim?
5. What should be the first paid Multipass endpoint: agent lookup, identity fragment report, Cred report, or owner verification summary?
6. What multisig and timelock policy should govern launch upgrades?

## 21. Immediate Next Steps

1. Share this draft with the team for product and architecture review.
2. Confirm the upgradeable contract policy as a launch requirement.
3. Define the first contract module boundaries.
4. Define the first agent-readable schemas.
5. Define the standards spine adapter schema and launch compatibility matrix.
6. Start x402 rebuild planning around Bankr x402 Cloud with $CRED-first pricing.
7. Decide default human-owner visibility.
8. Keep Cred protected: payments and burns buy access or services, not reputation.
