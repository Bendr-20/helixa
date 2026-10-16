# Swarm Command: ID Agents Swarms, XMTP Rooms, and Base Escrow Design

**Date:** 2026-10-16  
**Status:** Independent review blockers resolved; pending final user review
**Scope:** Marketplace missions, wallet-bound Looper teams, ID Agents execution, XMTP swarm rooms, immutable versioned escrow vaults, USDC/$CRED settlement, and CRED outcome evidence

## Goal

Ship **Swarm Command** (working title), a visible, useful Looper coordination marketplace inside Multipass Console. A wallet holder posts a funded mission, recruits wallet-bound Loopers, forms a team, launches an isolated ID Agents swarm and private XMTP room, reviews artifacts, and settles real Base USDC, $CRED, or both through bounded non-custodial escrow.

The MVP must use Premm's open-source ID Agents core and its native RESTAP/task concepts wherever they fit. Multipass must not rebuild a second general swarm engine. Helixa adds the marketplace, identity binding, authenticated gateway, escrow lifecycle, evidence, and owner-facing Console surfaces that ID Agents does not provide.

The product must not treat chat text, model claims, token amounts, or a task status alone as proof of completion. Funds move only under the escrow contract's explicit authorization rules. CRED receives verified outcome evidence after final settlement; paying or staking more does not buy reputation.

## Product decisions

1. The MVP is a public marketplace rather than an admin-only pilot.
2. A mission may be funded in canonical Base USDC, canonical Base $CRED, or both.
3. Funds are real and onchain from the first release. Simulated balances are not labeled funded.
4. A mission launches only after the full declared bounty is confirmed in escrow and the selected team accepts its immutable launch terms.
5. Normal milestone release requires both the mission owner and the manifest's transfer-stable lead approval address. The selected lead Looper's current owner/controller must sign the launch manifest that delegates this mission authority.
6. Either party may dispute an unpaid milestone. A Helixa arbitration Safe may resolve only among predeclared recipients and the original refund address.
7. Existing funded vaults are immutable. Evolution happens through versioned immutable vault templates behind an evolvable registry/factory surface.
8. One funded mission maps to one isolated ID Agents manager/team/workspace for the hosted MVP.
9. Each launched mission receives one private XMTP swarm room using Multipass's existing production XMTP group transport.
10. XMTP coordinates humans and agents; the Helixa mission ledger and escrow contract remain authoritative for tasks, approvals, and settlement.
11. Initial participation is limited to verified wallet-bound Loopers. ID Agents public-agent support is a later extension.
12. Mainnet deployment and production money movement remain separately gated by contract review, testnet rehearsal, and explicit release approval.

## Approaches considered

### ID Agents as the primary swarm runtime — selected

Pin and run the MIT-licensed ID Agents core. Use its manager, teams, isolated workspaces, task API, RESTAP messaging, news, outputs, artifacts, schedules, and supported Codex/Claude/Cursor runtimes. Multipass reaches it only through a typed authenticated gateway.

**Benefits:** aligns with the standards already used by Loopers; avoids rebuilding orchestration; preserves compatibility with RESTAP, OWS, skills, public agents, and Premm's evolving runtime; gives Console a proven manager-worker core.

**Trade-off:** the public ID Agents manager API is intentionally local and unauthenticated. Hosted marketplace use therefore requires containment and a narrow gateway. Stable production embedding and XMTP group semantics should be reviewed with Premm, but neither blocks building the MVP integration against the open-source core.

### Build a Helixa-native swarm engine

**Rejected:** duplicates ID Agents, fragments the standards stack, delays visible product value, and recreates task/message/runtime problems already solved upstream.

### Use ID Agents only as inspiration

**Rejected:** produces another proprietary coordination path and fails the product direction to use Premm's stack whenever possible.

## Terms and actors

- **Mission owner:** wallet that creates and funds a mission. It is the immutable refund authority for that mission version.
- **Looper:** canonical collection token plus its verified ERC-6551 account, current owner/controller evidence, custody epoch, Multipass identity, and runtime registration.
- **Lead Looper:** selected team lead identity. The escrow records a separately consented, transfer-stable lead approval address; it must differ from the mission owner and must not be the NFT-controlled Looper ERC-6551 account.
- **Contributor:** selected Looper with a predeclared transfer-stable settlement address and mission role.
- **Recipient:** contributor settlement address recorded before funding. In V1 it must be an EOA or ERC-1271 contract wallet whose authority does not automatically change when the Looper NFT transfers; the NFT-controlled Looper ERC-6551 account is not a V1 payout or approval address.
- **Arbitrator:** a Helixa-controlled Safe multisig address. It has only bounded dispute resolution authority.
- **Mission gateway:** private authenticated service translating typed Multipass actions into bounded ID Agents manager calls.
- **Swarm bridge:** service identity included in the XMTP room to post selected runtime events and ingest explicitly structured room commands.
- **Mission ledger:** canonical offchain state, append-only event history, artifacts, applications, ID Agents bindings, XMTP binding, and onchain reconciliation state.
- **Vault:** full, immutable-code per-mission escrow deployment created from one versioned creation-code commitment.

## High-level architecture

### Multipass Console

Provides:

- public mission board;
- mission creation and funding UX;
- Looper applications and team selection;
- payout and milestone review;
- launch status;
- mission workspace with tasks, agents, artifacts, blockers, approvals, XMTP room, and settlement state;
- dispute and refund actions;
- transaction and outcome receipts.

The browser never calls ID Agents directly and never receives manager credentials, runtime credentials, bridge keys, escrow admin keys, or raw internal service paths.

### Multipass API and mission ledger

Provides:

- authenticated mission commands;
- exact state-machine transitions with optimistic version checks;
- Looper identity and custody-epoch verification;
- onchain escrow reconciliation;
- typed mission-gateway requests;
- XMTP room creation/recovery through the existing node SDK adapter;
- artifact hashing and immutable receipt assembly;
- bounded public projections and private current-party projections;
- CRED evidence publication after final settlement.

### ID Agents core

The pinned upstream core provides:

- one local manager daemon per hosted mission;
- one named team and mission-scoped workspace;
- agent deployment and lifecycle;
- task creation, assignment, claiming, and completion;
- RESTAP /talk, /news, /talk-to, and /news-to behavior;
- agent output and artifact retrieval;
- schedules and heartbeats when enabled;
- compatible Codex, Claude Code, and Cursor runtimes.

Multipass does not expose a generic pass-through to ID Agents /remote. Only reviewed typed gateway operations are available.

### XMTP swarm room

Multipass already supports production XMTP groups through the node SDK, including group creation by identifiers, canonical conversation binding, message identity, recovery, and browser wallet registration. The mission integration reuses that adapter rather than ID Agents' current direct-message XMTP skill.

The room includes:

- mission owner;
- lead Looper address;
- contributor Looper addresses;
- the swarm bridge service identity;
- optional predeclared reviewer identities.

The first MVP creates the room only after funding and team acceptance. Membership is fixed for that mission version. A material team change requires cancellation before launch or a successor mission/room; the system does not silently mutate the funded participant set.

### Base escrow

A version registry approves immutable vault creation-code versions for new missions. The V1 factory deploys a full immutable-code vault with CREATE2; it does not use a proxy, clone, or delegatecall. Each vault receives its complete terms in the constructor, stores them without mutable setters, and snapshots its version, creation-code commitment, deployed runtime code hash, terms hash, parties, tokens, milestones, recipients, and deadlines.

The registry or factory may evolve for new missions. No registry, factory, proxy admin, pause key, or arbitrator can change executable behavior, recipients, or allocations in an already created vault.

## Mission lifecycle

The system uses separate, executable state machines rather than one overloaded status.

**Mission ledger:** `draft -> recruiting -> team_selected -> funding -> funded -> launching -> active -> review -> settled`, with terminal `cancelled` or `refunded`. A dispute is a milestone condition projected onto the mission, not a second mission state.

**Launch operation:** `not_started -> reserved -> provisioning -> runtime_ready -> room_ready -> tasks_ready -> committed`, with `failed_retryable` and terminal `expired_refundable`. A retryable launch failure does not make the mission terminal.

**Vault:** `awaiting_funding -> funded -> active -> settled`, with terminal `refunded`.

**Milestone:** `pending -> submitted -> releasable -> released`; either approval may arrive first and is stored as a bit bound to the exact artifact/payout commitment. `pending` may move directly to terminal `timeout_settled` after the delivery deadline and grace by executing the exact per-asset delivery-timeout allocation. `pending` or `submitted` may enter `disputed`; `disputed` moves to terminal `resolved` through owner+lead settlement or arbitrator resolution, or to terminal `timeout_settled` after the dispute deadline through the exact per-asset dispute-timeout allocation. `released`, `resolved`, `timeout_settled`, and `refunded` are terminal and record the exact per-asset amounts sent to each allowed destination. No terminal state moves backward.

### Draft

The creator defines:

- title and bounded public summary;
- full mission specification;
- required capabilities and roles;
- application close time;
- target launch deadline;
- milestone titles, acceptance criteria, review windows, and amounts;
- Base USDC and/or $CRED bounty;
- intended maximum team size;
- refund address;
- disclosure and content policy.

Draft data is editable by the owner and has no funding authority.

### Recruiting

The owner publishes the mission. Verified wallet-bound Loopers may apply. Each application binds:

- chain, collection, token ID, canonical account, current owner/controller, and custody epoch;
- proposed role;
- public capability claims backed by current Multipass/CRED evidence;
- availability and runtime preference;
- requested transfer-stable settlement address, which must be signed by the current Looper owner/controller and must not be the NFT-controlled Looper account in V1;
- application signature and expiry.

Applications are not credit decisions. CRED and evidence help selection but cannot guarantee performance.

### Team selected

The owner selects:

- one lead Looper;
- contributors;
- exact recipient addresses;
- role labels;
- milestone payout allocations per token;
- mission terms hash.

The canonical EIP-712 launch manifest binds chain ID, factory address, registry/version ID, immutable vault creation-code hash, predicted CREATE2 vault address, mission/terms hash, owner, refund address, transfer-stable lead approval address, every Looper identity and custody epoch, every transfer-stable settlement address, token addresses, raw integer amounts, all allocations, all deadlines and timeout allocations, participant nonces, expiry, ID Agents release pin, and XMTP room policy. Required signers are the mission owner, every selected Looper's current owner/controller at the bound custody epoch, the transfer-stable lead approval address, and every distinct transfer-stable settlement address. One address may satisfy several roles with one signature over the same manifest, but every distinct signer has its own factory nonce.

Under the factory reentrancy guard, deployment validates fields, domain, predicted address, expiry, signer set, and nonce availability; marks the manifest hash and every distinct signer nonce consumed; verifies every EOA/ERC-1271 signature; deploys the vault; and verifies its code. Any failed signature, callback, or deployment reverts the whole transaction, including nonce consumption. A manifest cannot deploy twice or replay across chain, factory, version, vault, party, or terms.

The owner and lead approval addresses must differ. Neither approval address may be an NFT-controlled ERC-6551 account whose authority follows collection ownership. The MVP does not permit post-funding allocation amendments. A desired change requires cancel/recreate before funding or a successor mission after consented refund. Later vault versions may add unanimous amendments under a separate review.

### Funding

The factory creates the vault from the signed manifest. The owner funds one or both approved tokens. Funding uses exact raw token units; UI decimal rendering is informational and derived only from the pinned token configuration.

Only the immutable mission owner may make authorized deposits in V1. The vault tracks internal funded liability per asset and caps accepted deposits at the declared total. Each deposit requires the vault balance increase to equal the requested amount; fee-on-transfer or callback-dependent behavior fails. The vault is `funded` only when each internal funded liability equals its declared total. Raw ERC-20 balance is not used as equality authority because an outsider can transfer tokens directly. Unsolicited excess is excluded from liabilities and may be sent only to the immutable refund address through a bounded excess-recovery function after preserving all unpaid liabilities. If the funding deadline passes before full funding, anyone may execute a refund of all accounted partial deposits to the immutable refund address.

### Launching

After confirmed funding:

1. Mission API reserves one idempotent launch operation.
2. The gateway creates an isolated ID Agents manager/team/workspace from a deterministic mission config.
3. It verifies manager health, exact pinned release, expected agent roster, task API, and workspace isolation.
4. Multipass creates the private XMTP group with the exact manifest participants and bridge identity.
5. It recovers the created conversation, verifies membership, and binds the conversation ID to the mission.
6. Initial milestones/tasks are created in ID Agents with deterministic mission/task IDs.
7. The API records runtime, room, and task commitments.
8. Owner and lead approve the onchain launch commitment.
9. Only after both launch approvals does the mission become `active` and agents receive executable work.

If any step fails, the launch operation becomes `failed_retryable`; no agent work starts and the mission remains `launching`. Retry uses the same launch idempotency key and reconciles existing manager/team, room, and task state before creating anything. After the launch deadline and grace period, the launch operation becomes `expired_refundable`; anyone may call the vault's bounded unlaunched refund path, which sends all accounted liabilities only to the immutable refund address if dual launch approval never completed.

### Active execution

The lead decomposes milestones into tasks. Tasks have:

- deterministic mission-scoped ID;
- title and bounded instructions;
- assigned agent or unassigned state;
- dependency IDs;
- status `todo | doing | blocked | review | done | cancelled` in the Helixa ledger;
- corresponding ID Agents task name and status where applicable;
- artifact requirements;
- revision and idempotency key.

ID Agents remains the execution runtime. Helixa's richer task projection wraps, but does not falsify, the upstream `todo | doing | done` lifecycle. `blocked`, `review`, and `cancelled` are mission-ledger states with explicit mapping and must not be presented as native ID Agents states.

Selected runtime updates are posted to XMTP as structured informational events. Messages contain mission ID, task ID where applicable, event type, actor, timestamp, and deduplication ID. They set `noAutoReply` or equivalent bridge behavior so system events cannot trigger reply loops.

### Review and settlement

For each milestone:

1. The lead submits a final artifact commitment: content hash, artifact manifest hash, URI/reference, and task receipt set.
2. The owner approves the exact artifact and immutable payout commitment.
3. The lead approves the same artifact and payout commitment.
4. Anyone may execute release after both approvals.
5. The vault pays recipients directly according to the predeclared allocations.
6. The indexer records transaction/log finality and emits a signed outcome receipt.
7. CRED receives verified outcome evidence only after final settlement.

A task marked done, an XMTP message saying done, or an artifact uploaded without dual approval cannot release funds.

### Dispute

Before release, the owner or lead may dispute a milestone. Dispute freezes only that unpaid milestone. Other independent milestones may proceed unless the manifest marks them dependent.

The arbitrator may resolve each token amount only among:

- the milestone's predeclared recipient addresses;
- the mission's immutable refund address.

The resolution amounts must sum exactly to the disputed milestone balance and cannot exceed escrowed funds. The arbitrator cannot add addresses, change tokens, charge a fee, seize unrelated balances, or modify released milestones.

The arbitrator address is a Safe multisig. Arbitration operations are public onchain and require a reason/evidence hash. The Helixa ledger stores the human-readable decision separately with privacy filtering.

Every milestone manifest includes two fixed exact allocations per asset among only its predeclared recipients and refund address: a delivery-timeout allocation and a dispute-timeout allocation. Each allocation must sum to that milestone's full remaining amount for the asset. If no artifact is submitted by the delivery deadline plus grace, anyone may execute the delivery-timeout allocation and move the milestone to `timeout_settled`. If an artifact is submitted but required review/approval does not complete by the review deadline, anyone may move the milestone into `disputed`. Owner and the manifest lead address may jointly settle a dispute using an allowed exact allocation. The arbitrator may resolve it before the dispute deadline. If neither happens by that deadline, anyone may execute the dispute-timeout allocation and move it to `timeout_settled`. These calls are permissionless to execute but can never choose destinations or amounts.

### Completion

A mission becomes `settled` only after every milestone is `released`, `resolved`, `timeout_settled`, or `refunded` and the indexer observes finalized events. Remaining accidental unsupported-token transfers are not counted as mission funds and require a separately reviewed recovery posture; the v1 contract exposes no general admin sweep for supported mission assets.

## Escrow contract design

### VersionRegistry

The registry is the evolvable control plane for new missions only. It stores:

- version ID;
- immutable vault creation-code hash;
- expected deployed runtime code hash for the constructor/storage model;
- activation and retirement times;
- status `pending | active | paused | retired`;
- exact supported token addresses for that version;
- factory compatibility version.

Governance is a Safe multisig plus timelock for routine version activation and token-list changes. Emergency pause may stop new vault creation immediately. Governance cannot call or mutate existing vault payout state.

The registry may be UUPS-upgradeable only if storage-layout, initializer, authorization, and upgrade-history tests pass. A replaceable immutable registry is also acceptable. In both cases, each full vault stores its selected version, creation-code commitment, and deployed runtime code hash and never consults mutable registry values for release or refund behavior.

### MissionEscrowFactory

The factory:

- checks the selected active version and exact immutable vault creation-code hash;
- under a factory reentrancy guard, validates the full canonical EIP-712 manifest, signer set, signer nonce availability, expiry, predicted CREATE2 address, fields, totals, and bounds;
- derives deterministic salt from chain ID, owner, manifest nonce, and terms hash;
- atomically marks the manifest hash and every distinct signer nonce consumed, then verifies every required EOA/ERC-1271 signature before deployment; any later failure reverts the entire transaction;
- deploys the full vault with constructor-bound terms and no proxy/clone/delegatecall;
- verifies the deployed runtime code hash;
- emits the complete vault/version/terms commitment;
- prevents duplicate creation.

The factory holds no mission funds and cannot execute a vault action. Replacing or upgrading it affects only future vault creation.

### MissionEscrowV1

The immutable implementation uses:

- Solidity 0.8.24 or later reviewed compiler pin;
- OpenZeppelin SafeERC20, SignatureChecker, ReentrancyGuard, and EIP-712 primitives where applicable;
- constructor-only initialization with no reinitializer;
- pull-free direct milestone distribution under reentrancy protection;
- exact internal per-token liability accounting plus bounded raw-balance delta checks;
- bounded arrays and explicit custom errors;
- no proxy, clone, delegatecall, arbitrary call, selfdestruct, fallback execution, admin withdrawal, or generic sweep;
- a bounded excess-recovery path that preserves all internal liabilities and can send only unsolicited excess to the immutable refund address.

V1 bounds are constants reviewed before deployment:

- at most 2 supported assets;
- at most 8 recipients;
- at most 12 milestones;
- at most 8 payouts per asset per milestone;
- nonzero amounts and addresses;
- payout totals exactly matching declared milestone amounts;
- total milestone amounts exactly matching declared funding totals;
- bounded launch, review, and dispute deadlines.

If product testing needs larger teams, a new reviewed vault version changes the bounds; an active V1 vault does not.

### Signatures and smart wallets

Owner and lead approvals may be direct transactions or EIP-712 authorizations. Relayed authorizations include chain ID, vault address, action, milestone ID, artifact hash, payout commitment, nonce, and deadline. Verification uses SignatureChecker so EOA ECDSA and ERC-1271 smart-wallet signatures are both supported.

Manifest nonces are consumed by the factory per participant and manifest hash. Vault action nonces are per signer and action domain. Expired, replayed, cross-chain, cross-factory, cross-version, cross-vault, wrong-party, wrong-milestone, wrong-artifact, or wrong-payout signatures fail closed. The escrow never accepts a claimed Looper token ID or dynamically resolved NFT owner as authority; only the transfer-stable manifest approval addresses and valid signatures count.

### Token rules

The deployment configuration pins canonical Base USDC and $CRED addresses and expected code hashes from live verified sources. These values are not guessed or copied from UI metadata. Before mainnet release, two approved RPC providers and a block explorer must agree on address, code, symbol/decimals metadata, and current implementation where a token itself is proxied.

Onchain accounting uses raw integer units only. It never assumes both assets use the same decimals. Token amount is score-neutral.

### Required events

At minimum:

- `MissionVaultCreated`
- `FundingReceived`
- `MissionFullyFunded`
- `LaunchApproved`
- `MissionActivated`
- `ArtifactCommitted`
- `MilestoneApproved`
- `MilestoneDisputed`
- `MilestoneReleased`
- `DisputeResolved`
- `MissionRefunded`
- `MissionSettled`

Every event carries the vault/mission commitment and bounded indexed identifiers needed for deterministic reconciliation, without putting private mission content onchain.

## Mission ledger

Use a dedicated SQLite database or dedicated STRICT tables in the existing canonical API database, with WAL, foreign keys, busy timeout, integrity checks, bounded backups, and one transaction coordinator for each state transition.

Core records:

- missions and revisions;
- public/private mission specifications and terms hashes;
- applicants and signed applications;
- selected members, roles, custody epochs, and payout addresses;
- milestones, payout commitments, review windows, and dependencies;
- vault versions, addresses, creation/funding/release transactions, block numbers, hashes, and confirmation state;
- launch operations and idempotency records;
- ID Agents release pin, manager instance, team, agents, tasks, health, and artifact bindings;
- XMTP conversation binding, expected members, bridge identity, and deduplication state;
- append-only mission events;
- disputes, evidence hashes, decisions, and final receipts;
- CRED evidence publication status.

Private task instructions, XMTP bodies, model prompts, provider credentials, wallet keys, manager tokens, and bridge secrets do not enter the mission ledger. XMTP remains the encrypted message store. Artifact contents remain in the mission workspace or approved object storage; the ledger stores commitments and bounded metadata.

All state-changing requests require an idempotency key and expected mission revision. The same key/body returns the original result. The same key with changed canonical body is rejected. No partial transaction may advance a mission without the corresponding durable operation record.

## Identity and custody behavior

At application, team selection, funding, launch, task assignment, artifact acceptance, and CRED publication, Multipass resolves fresh:

- chain and collection;
- token existence;
- canonical ERC-6551 account and expected runtime code;
- current owner/controller;
- custody epoch;
- current runtime activation status;
- current eligibility/blocked state.

Selected identity and payout terms snapshot the custody epoch, but approval and settlement authority use the separately signed transfer-stable addresses. A later transfer or controller change:

- cannot give the buyer owner/lead approval, dispute, refund, or payout authority;
- prevents new task assignment and new agent work for that Looper;
- posts a bounded participant-change alert;
- pauses affected milestone review;
- requires dispute/refund resolution under the existing transfer-stable destinations and timeout allocation;
- never silently transfers contribution evidence to a new custody epoch.

V1 disallows the NFT-controlled Looper account as approval or payout address. CRED evidence for completed pre-transfer work binds the contribution-time custody epoch, the transfer-stable contributor signer, and settlement event, not the current NFT owner.

## ID Agents integration

### Release pin

The repository commit, package version, MIT license notice, configuration schema version, RESTAP version, and relevant source hashes are pinned in the mission-runtime release manifest. Runtime startup fails if the installed core differs.

### Private deployment

Each hosted mission separates the manager control plane, gateway, credential mediator, and workers into distinct network/process security domains. The manager control port is reachable only by the authenticated gateway. Workers cannot connect to /remote, manager admin routes, the host loopback interface, or each other except through explicitly mediated RESTAP/task data-plane paths. Manager-to-worker traffic is allowlisted by exact port and direction. Startup proves these denies before work is accepted. The deployment also uses:

- manager and worker ports bound to private namespaces only;
- no public ingress;
- dedicated non-root UID;
- read-only root filesystem plus mission workspace/output mounts;
- no host Docker socket, SSH agent, cloud metadata access, home directory, or unrelated repositories;
- dropped Linux capabilities, no-new-privileges, seccomp/AppArmor policy where available;
- CPU, memory, process, file, runtime, inference, and disk quotas;
- explicit egress allowlist;
- per-mission logs and kill switch;
- no escrow, arbitrator, deployer, or general treasury signing key.

ID Agents defaults that bypass interactive runtime permissions are acceptable only inside this bounded container and only for mission-scoped tools. A worker must not inherit unrestricted host access merely because its CLI runtime uses a force/bypass flag.

Hosted model credentials must be dedicated, restricted, revocable, and mediated outside the worker security domain. Workers receive no reusable provider token, CLI login database, SSH agent, or readable credential file/environment variable. They call a policy-enforcing local inference/credential broker with mission, model, method, token, cost, and expiry bounds. If a chosen CLI runtime cannot operate without exposing reusable credentials to its shell/tool process, that runtime is not eligible for Helixa-hosted missions; it remains owner-hosted only. Personal operator sessions are never copied into mission containers. Production launch is blocked until the mediator, provider terms, and per-mission cost attribution are proven.

### Typed mission gateway

The gateway authenticates Multipass with mutually authenticated local transport or a short-lived signed service grant. It exposes typed operations such as:

- `provisionMissionTeam`
- `readMissionHealth`
- `createMissionTask`
- `assignMissionTask`
- `sendMissionInstruction`
- `readMissionNews`
- `listMissionOutputs`
- `readMissionArtifact`
- `pauseMission`
- `terminateMission`

Each operation binds mission ID, manager instance ID, expected release, exact team/agent/task names, canonical body hash, nonce, issue/expiry times, and idempotency key. The gateway maps these to the smallest supported ID Agents /remote, /tasks, /news, /output, or /artifact call.

It rejects arbitrary commands, shell strings, traversal, unknown agents, cross-mission identifiers, unbounded artifacts, non-loopback manager URLs, and stale grants. Manager /remote remains unauthenticated only inside its isolated private namespace.

### Polling and events

The current upstream core exposes REST/task/news reads rather than a stable external event stream. The MVP uses bounded polling with cursors, ETags/hashes where available, jitter, backoff, and per-mission budgets. It emits normalized mission events only after validating the expected manager/team/task binding.

If upstream adds a stable event stream, a later adapter may replace polling without changing the mission event contract.

### Artifact boundary

Agents write to the mission output directory. Gateway artifact reads:

- resolve beneath the exact mission output root;
- reject symlinks, devices, sockets, traversal, and hard-link surprises;
- cap file count and byte size;
- compute SHA-256 and content type;
- never execute artifacts;
- require explicit lead submission before owner review.

## XMTP swarm-room integration

### Creation and recovery

Extend the existing Multipass XMTP node adapter from its current single-holder activation path to create a group with the exact normalized multi-identifier manifest set plus the bridge. After synchronization, launch verifies actual cryptographic membership from the XMTP conversation, exact closed permission policy, bridge admin role, and absence of unexpected members; participant metadata alone is never accepted as membership proof. Members cannot add/remove members or relax permissions in V1.

Creation runs under one exclusive durable mission launch lock and one idempotency record. Before creation, the bridge synchronizes its conversations and searches for a unique signed mission marker in group metadata and the first bridge event. After any ambiguous failure or restart, it repeats that recovery scan and verifies the exact participant/permission commitment before it may create. A second room is forbidden while an unresolved candidate marker exists.

The mission stores conversation ID, topic/thread binding, signed mission marker, expected and observed participant/permission commitments, creation operation ID, and bridge version. Durable SQLite tables store the room binding, exclusive lock, inbound deduplication keys, outbound outbox rows, delivery attempts, and cursors so restart cannot duplicate a room or system event. They do not store XMTP private keys or plaintext history.

### Structured system events

The bridge may post only closed event types:

- mission funded;
- swarm launching/ready/failed;
- task created/assigned/blocked/reviewed/completed;
- approval requested;
- artifact submitted;
- custody or runtime warning;
- dispute opened/resolved;
- milestone released;
- mission settled/refunded.

Each event has a deterministic deduplication ID and is marked non-conversational. The bridge ignores its own messages and any already-seen ID. Runtime event text is data, never an instruction to execute wallet or mission actions.

### Commands from chat

Free-form chat never directly mutates escrow or authoritative state. The MVP may recognize a small explicit command syntax such as `/mission status` or `/task <id> status` as read-only. Any proposed write produces a Console deep link or review card. The user completes a wallet/session-authorized Console action before mutation.

### Membership and privacy

XMTP open mode is forbidden. Only manifest members may join. Removal or replacement after funding requires a successor mission/room in V1. The Console clearly distinguishes encrypted XMTP chat from public mission data and from ID Agents' local RESTAP traffic.

## API surface

Exact route names may follow existing server conventions, but the public contract must cover:

### Public reads

- `GET /api/multipass/missions` — bounded filterable mission board.
- `GET /api/multipass/missions/:missionId` — public mission projection with funding and lifecycle status.

Public responses omit private scope, applications, participant contact data, internal IDs, manager locations, conversation IDs, evidence under review, and secrets.

### Authenticated owner/participant routes

- create/update/publish/cancel draft mission;
- apply/withdraw application;
- select team and publish canonical launch manifest;
- read/sign launch terms;
- prepare vault creation and funding transaction;
- reconcile transaction status;
- retry/refund failed launch;
- read mission workspace projection;
- create/assign/update tasks within role policy;
- submit artifacts;
- approve milestone as owner or lead;
- execute release;
- open/read dispute;
- prepare bounded arbitration action for authorized arbitrators.

All writes use existing Origin/session/CSRF conventions, exact JSON schemas, body caps, current wallet authority, mission revision, and idempotency keys. Wallet signatures are verified against exact EIP-712 domains where used.

## Console UX

### Mission board

Shows mission title, lifecycle, required roles, verified bounty asset/amount, application deadline, owner identity, and bounded trust context. A card never labels a bounty funded until finalized escrow evidence exists.

### Create mission

A guided flow captures scope, roles, milestones, review windows, payout assets, and refund address. It renders raw-address verification and token decimals clearly before wallet approval. It previews contract version, terms hash, fees (zero in V1 unless separately approved), and dispute policy.

### Recruiting

The owner compares applicants using verified identity, capabilities, availability, CRED status/evidence freshness, and proposed role. Stake size, loan size, bounty size, and token holdings do not automatically improve selection rank.

### Funding and launch

The surface shows separate steps for token approval, deposit, confirmation, runtime launch, XMTP creation, task creation, and dual activation. A failed step is recoverable and never represented as success.

### Mission workspace

One workspace contains:

- overview and lifecycle;
- XMTP swarm chat;
- task board;
- agent/runtime health;
- milestones;
- artifact review;
- funding and payout ledger;
- blockers and approvals;
- dispute controls.

The UI labels the source of every state: onchain, Helixa ledger, ID Agents, or XMTP. Stale/degraded sources are explicit.

### Settlement

The settlement panel displays artifact commitments, dual approvals, recipient allocations, transaction simulation, wallet prompt, finality status, and signed receipt. Payment amount is never presented as a CRED score increase.

## CRED evidence

A settled outcome may create evidence containing:

- mission and vault commitment;
- contributor Looper identity and contribution-time custody epoch;
- role and accepted milestone IDs;
- artifact hashes;
- owner/lead approval events;
- settlement transaction/log references;
- dispute/refund status;
- runtime confidence label;
- timestamps and evidence version.

Positive completion evidence requires accepted artifacts and finalized payment. Disputed, refunded, timed-out, or abandoned outcomes retain their actual state. CRED scoring policy remains separate and versioned. Bounty denomination and amount are not direct score inputs.

To avoid circularity, CRED may help a mission owner select a team, but participation in a mission does not become positive evidence until the mission outcome independently settles.

## Error and recovery behavior

- **Vault creation ambiguity:** reconcile deterministic address, factory event, and code hash before retry.
- **Funding transaction timeout:** reconcile chain transaction and vault balances; never ask for a blind second deposit.
- **Partial dual-asset funding:** remain in funding and show exact missing internal liability; after the funding deadline anyone may execute refund of accounted deposits to the immutable refund address.
- **ID Agents provision timeout:** inspect manager/team/workspace before retry; never create a second active runtime silently.
- **XMTP creation timeout:** recover canonical bound conversation and verify participants before retry.
- **Task creation ambiguity:** deterministic task name and read-before-write retry.
- **Bridge outage:** mission/task state remains available; chat event delivery resumes idempotently.
- **Runtime failure:** pause assignments, preserve accepted artifact commitments, restart only the exact pinned release, or move to launch/runtime dispute policy.
- **Custody change:** halt affected agent and milestone; require bounded dispute handling.
- **Provider auth/cost failure:** no unrestricted fallback credential or model; surface blocked runtime.
- **Database failure:** no partial lifecycle transition or onchain-success concealment; reconciler resumes from durable operations.
- **Chain reorg/provider disagreement:** fail closed until the indexed block is canonical and provider agreement returns.
- **Arbitration unavailable:** funds remain frozen only until the immutable dispute deadline. After it, anyone may execute the exact predeclared dispute-timeout allocation; no caller or third party chooses destinations or amounts.

## Security boundaries

- Escrow contracts never call agent-produced addresses or calldata.
- Agent/model output cannot create recipients, approve milestones, resolve disputes, sign transactions, or change token addresses.
- The browser never sees ID Agents /remote, manager topology, runtime credentials, bridge wallet key, deployer key, or arbitrator signer material.
- The gateway never receives escrow signing keys.
- The swarm bridge never receives escrow signing authority.
- Contract deployer/registry governance cannot withdraw active vault funds.
- Supported token addresses and code hashes are pinned from verified live evidence.
- All external text, artifacts, RESTAP messages, and XMTP messages are untrusted data.
- Public mission content is separately sanitized from private workspace content.
- Logs redact wallet signatures, auth headers, session tokens, XMTP keys, provider credentials, prompts, private scope, and artifact contents.
- Metrics use bounded labels and never raw message/task/artifact content.

## Observability

Required bounded metrics and operator views:

- missions by lifecycle and age;
- recruiting/application counts;
- vault creation/funding confirmation lag;
- partial funding and launch-failure counts;
- ID Agents manager/agent health, control-plane isolation, denied worker-to-manager attempts, credential-mediator limits, and pinned release mismatch;
- task status reconciliation lag and conflicts;
- XMTP creation/recovery/deduplication failures;
- artifact count/bytes/hash failures;
- approval and review age;
- disputes and unresolved age;
- release/refund transaction state and chain-finality lag;
- CRED evidence publication state;
- container CPU/memory/disk/inference spend;
- gateway auth/replay/schema rejection classes.

Alerts fire on implementation-codehash mismatch, unsupported token, unexpected vault balance, duplicate room, duplicate task, duplicate payout event, cross-mission gateway access, manager public exposure, secret sentinel hit, unbounded runtime access, post-transfer work, or ledger/onchain settlement disagreement.

## Rollout and release gates

### Phase 0 — local implementation

- Pin ID Agents commit and build the typed adapter.
- Implement mission ledger and fake/on-device runtime integration.
- Implement contracts and tests.
- Implement Console flows with local chain and local XMTP test adapter.
- No public deployment or real funds.

### Phase 1 — integrated local proof

- Anvil deploys version registry, factory, mock USDC, mock CRED, and vault.
- A mission is created, fully funded in both assets, and activated.
- A real local ID Agents team executes tasks and writes artifacts.
- Multipass creates and recovers an XMTP test/dev group.
- Owner and lead approve; recipients receive exact funds.
- Dispute/refund/failure paths are rehearsed.

### Phase 2 — Base testnet pilot

- Deploy reviewed contracts with test assets or canonical testnet equivalents.
- Use real wallet and ERC-1271 approval paths.
- Use real ID Agents and XMTP environments.
- Run at least two mission lifecycles plus launch failure, transfer, dispute, and refund drills.
- Publish release hashes and evidence.

### Phase 3 — mainnet release candidate

Requires:

- independent contract security review;
- Foundry unit, fuzz, and invariant gates;
- existing package contract tests;
- static analysis;
- compiler/dependency locks and reproducible bytecode;
- canonical Base USDC/$CRED address and code verification;
- registry/factory Safe and timelock configuration review;
- container threat-model and escape review;
- ID Agents pin and license notice;
- provider-hosting authorization and cost controls;
- real XMTP group/recovery proof;
- rollback, pause-new-creation, and reconciliation drills;
- explicit mainnet deployment approval.

### Phase 4 — controlled public launch

Start with bounded mission/team/bounty caps even though the board is publicly visible. Raise caps only after evidence. Public-agent participation, owner-hosted runtimes, arbitrary external teams, and automatic chat commands remain separately gated.

## Verification

### Contract unit tests

- one-time initialization and deterministic deployment;
- registry/version/codehash enforcement;
- only approved exact token addresses;
- exact single- and dual-asset internal-liability funding;
- owner-only authorized deposit;
- underfund, overfund, fee-on-transfer, rebasing simulation, malicious callback, unsolicited direct transfer, excess recovery, and partial-funding deadline refund behavior;
- owner and lead distinct;
- manifest totals, recipient bounds, milestone bounds, and deadline validation;
- EOA and ERC-1271 direct/relayed approvals;
- nonce, deadline, domain, chain, vault, artifact, payout, and milestone replay rejection;
- full EIP-712 manifest verification, all participant signatures, predicted CREATE2 address, and atomic manifest/nonce consumption;
- dual launch approval from transfer-stable owner/lead addresses;
- dual milestone approval before release;
- NFT transfer cannot transfer approval, dispute, refund, or payout authority;
- direct exact recipient payouts;
- reentrancy resistance and state-before-transfer behavior;
- dispute freezes release;
- delivery deadlines, direct delivery-timeout settlement, review deadlines, permissionless dispute entry, joint settlement, arbitration deadline, and permissionless per-asset delivery/dispute timeout allocations;
- arbitration cannot add destination, exceed amount, change token, collect a fee, or touch another milestone;
- partial-funding and unlaunched timeout refunds only under exact conditions;
- released milestones final;
- registry/factory upgrades or replacement cannot mutate existing vault behavior/funds;
- emergency pause stops new vaults but not valid existing release/refund paths.

### Fuzz and invariant tests

- total released + refunded + remaining equals total funded per asset;
- no supported asset leaves except to predeclared recipients/refund address;
- no milestone reaches `released`, `resolved`, `timeout_settled`, or `refunded` more than once;
- no signature succeeds twice;
- no party can bypass the required second approval;
- arbitrator power remains destination- and amount-bounded;
- factory/registry admin has zero withdrawal path;
- arbitrary action sequences preserve accounting and terminal-state monotonicity.

### API and ledger tests

- exact lifecycle transition table;
- current-wallet authorization and role matrix;
- optimistic revision conflicts;
- idempotent same-body retries and changed-body conflicts;
- Looper identity/custody checks at every named boundary;
- private/public projection isolation;
- transaction confirmation and reorg reconciliation;
- no false funded/active/settled labels;
- append-only event and receipt consistency;
- CRED evidence only after finalized settlement.

### ID Agents gateway tests

- exact pinned release required;
- manager control plane remains gateway-only and worker-to-manager control access is denied;
- worker RESTAP/task data plane is separately allowlisted;
- reusable provider credentials are absent from worker files, environment, process view, and tool access;
- credential mediator enforces mission/model/method/token/cost/expiry bounds;
- typed operations map to expected upstream calls;
- generic /remote commands and shell injection rejected;
- cross-mission agent/task/artifact access rejected;
- deterministic retry creates no duplicate manager/team/task;
- artifact traversal/symlink/device/size cases rejected;
- runtime pause/kill and resource caps proven;
- secret and host-access sentinels fail;
- provider credential outage fails closed.

### XMTP tests

- exact multi-identifier group member set, actual synchronized membership proof, closed permission policy, and bridge identity/admin role;
- wallet and smart-wallet registration paths;
- creation ambiguity recovers one canonical room by unique signed mission marker under an exclusive durable lock;
- room binding, permission/member commitment, cursors, deduplication, and outbox survive process restart;
- message/event deduplication and crash-safe outbox delivery;
- bridge ignores self/system events and prevents loops;
- unauthorized members and open mode rejected;
- chat writes cannot mutate tasks or escrow without Console authorization;
- plaintext messages do not enter mission database/logs.

### Browser proof

At desktop, 390px, and 320px widths, inspect:

- mission board;
- creation/funding flow;
- recruiting/team selection;
- funding confirmation and launch sequence;
- mission workspace with chat/tasks/artifacts;
- dual approval and release;
- dispute/refund states;
- source labels and stale/degraded states;
- keyboard/focus behavior and no horizontal overflow;
- no secret/internal identifier exposure.

### Full regression gates

- package contract tests;
- full API suite;
- full web suite;
- production web build;
- schema/type tests;
- syntax and diff checks;
- existing Console chat/XMTP/Codex/RESTAP isolation tests;
- static secret/path scan;
- independent specification, implementation, and contract review.

## Deliverables

1. Reviewed design and implementation plan.
2. Versioned escrow contracts, tests, deployment and verification scripts.
3. Mission ledger, API, indexer/reconciler, and signed receipt codec.
4. Pinned ID Agents integration and isolated mission gateway.
5. XMTP swarm-room integration using existing Multipass transport.
6. Mission board, creation, recruiting, workspace, and settlement Console UI.
7. CRED outcome evidence adapter.
8. Local and testnet end-to-end proof packets.
9. Operations, threat model, rollback, arbitration, and release runbooks.

## Non-goals for MVP

- Deploying mainnet contracts without the named gates and explicit approval.
- Custodial Helixa balances or an admin sweep.
- Upgradeable active vault behavior.
- Post-funding participant or payout-address mutation.
- Arbitrary external agents or public ID Agents managers.
- Automatic execution of free-form XMTP commands.
- Treating ID Agents task completion as escrow approval.
- Treating payment amount, holdings, or stake as reputation.
- General-purpose dispute court beyond bounded mission escrow.
- Cross-chain escrow.
- Fiat payments.
- Hidden platform fees.
- Exposing the proprietary ID Agents Mac Dashboard or depending on it for server operation.

## Acceptance criteria

The MVP is complete when a verified wallet holder can, in a non-production environment:

1. create and publish a mission;
2. receive verified Looper applications and select a distinct lead plus team;
3. commit exact USDC/$CRED milestone allocations;
4. deploy and fully fund a versioned immutable vault;
5. launch one isolated pinned ID Agents team and one private canonical XMTP group;
6. coordinate tasks and conversation without reply loops or authority confusion;
7. submit and hash real artifacts;
8. approve and release a milestone with owner + lead authorization;
9. distribute exact token amounts to only predeclared recipients;
10. exercise dispute and unlaunched-refund paths;
11. produce finalized onchain, runtime, artifact, chat-binding, and CRED evidence receipts;
12. pass the complete contract, API, gateway, XMTP, browser, regression, and independent-review gates.
