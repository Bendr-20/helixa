# Pantheon × Helixa Integration Proposal

- **Status:** Partnership discussion draft 0.1
- **Prepared:** 2026-10-21
- **Networks:** Base mainnet first
- **Products:** Helixa CRED, Multipass, Loopers, Swarm Command, Pantheon Vaults, Pantheon Launch
- **Commercial status:** Proposed, not agreed
- **Execution status:** Preparation-only; this document authorizes no deployment, signature, approval, funding, custody transfer, token launch, or public announcement
- **Legal status:** Nonbinding technical/commercial discussion only—not an offer, solicitation, investment recommendation, financial promotion, or legal opinion. Token-sale, securities, sanctions/AML/KYC, tax, privacy, custody, and jurisdictional responsibilities remain subject to qualified counsel and a written agreement.

## 1. Executive summary

Helixa and Pantheon can create a common trust and launch layer for autonomous agents:

1. **Helixa verifies identity and performance.** CRED binds a scored subject to an ERC-8004 identity and Looper token; Multipass separately re-verifies the current owner, controller, and released account before applying the score to a launch decision.
2. **Swarm Command forms qualified teams.** Three to five Loopers are selected, CRED-gated, assigned roles and contribution weights, and asked for unanimous preparation consent.
3. **Pantheon is the preferred proposed market rail.** Subject to technical, structural, legal, and commercial diligence, Pantheon could supply the public sale, anti-sniper phase, liquidity lifecycle, Uniswap v4 graduation, and CRED-vault reward onboarding. No compatible execution path is assumed yet.
4. **The CRED vault closes the loop.** A launched swarm token can become a reward asset for CRED stakers without becoming the staking principal.
5. **Every authority boundary remains explicit.** Preparation consent is not launch consent. Helixa controls its scoring methodology; Pantheon independently decides whether and how to rely on CRED within its own risk and onboarding policies. Neither party may silently rewrite a signed launch packet.

The intended outcome is a repeatable pipeline of CRED-qualified agent launches rather than a one-off token integration.

## 2. What already exists

### 2.1 Repository-implemented Helixa infrastructure

- Canonical Loopers collection on Base: `0x1649CD37f4748807b4882FC48765bA0B2aFfa94a`.
- Canonical ERC-8004 registry used by Helixa: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
- CRED token on Base: `0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3`.
- Expected strict Looper CRED endpoint contract in the repository: `GET https://api.helixa.xyz/api/v2/cred/erc8004/8453/:agentId?registry=<registry>`.
- Multipass validates returned subject, chain, registry, Looper token ID, ERC-8004 ID, score, tier, evidence coverage, methodology, timestamps, and freshness. Subject mismatches fail closed.
- Swarm Command currently requires 3–5 Loopers, exact 10,000-bps contribution weights, fresh CRED, and a minimum average CRED of 65.
- The deployed Console contains the provider-neutral preparation, unanimous-consent, and simulation-only readiness workflow, but production CRED-gated use is blocked until the strict Looper endpoint is restored and verified.
- The deterministic token-genesis implementation exists in reviewed source: fixed supply, exact allocation, contribution registry, pull revenue splitter, non-transferable vesting streams, CREATE2 address prediction, and unanimous EIP-712 execution authorization.
- That token-genesis factory is **not deployed on Base** and the live Console is **not yet connected to an execution adapter**.

**Integration-readiness item:** a live probe of the expected strict Looper endpoint on 2026-10-21 returned 404 and the route was absent from current API discovery. The more general live agent-CRED response does not expose the methodology/freshness envelope required by Swarm Command. Helixa must restore and snapshot/version-bind the strict endpoint before CRED is used as a Pantheon launch or vault gate.

### 2.2 Verified existing Pantheon CRED-vault integration

Helixa already contains a bounded Looper-wallet workflow for Pantheon CRED staking:

- Pantheon Base registry: <https://launch.pantheonvaults.com/api/skill/registry?chain=base>
- Pinned Pantheon StakingVault: `0xBf52Aaf8b6C82FaD0220B5378022eA4fC0a98fDb`.
- The registry is checked at runtime for Base chain 8453, the exact pinned vault, an active CRED pool, 18 decimals, and bounded reward-token metadata.
- The wallet workflow reads the current pool, stake, allowance, CRED balance, and Base-gas state before preparing anything.
- A stake uses an exact CRED allowance followed by `stake(CRED, 6 months, amount, false)`; an existing eligible position uses `addToStake`.
- Preparation, preflight, submission, and receipt attribution are separate code paths with explicit holder confirmation. The browser never treats registry metadata as transaction authority. This document does not claim that a production stake was executed or that wallet writes are currently enabled.

A live registry and dual-RPC read on 2026-10-21 returned:

- Base chain ID 8453;
- 26 registered staking assets;
- an active CRED pool;
- four CRED-pool reward assets: CRED, BRTC, HIVE, and deadburn;
- StakingVault implementation `0x1a614B8Fa3971BE5Bd96d31C1b42a1D0040f1974`, version 8;
- `feePercent() = 5` and `paused() = false`;
- owner `0x47b22B1c84AD1A41396aa20A26f4832C51553872`, a Safe with a 2-of-6 threshold.

Verified V8 source/ABI indicates that any caller can fund an active pool through `fundRewardPool`; first funding registers the reward token, deducts the shared fee, and schedules the net rewards across 24 monthly buckets. Claims apply the shared fee again. This proves the technical multi-reward path, but Helixa should still obtain Pantheon review and commercial approval before registering a swarm token. A raw ERC-20 transfer is not reward funding. The current source exposes no general reward-funding cancellation/refund path.

### 2.3 Pantheon launch mechanics under evaluation

Pantheon's public whitepaper and launch site describe:

- optional USDC private presales with pro-rata allocation when oversubscribed;
- Sablier vesting for investor or allocation streams;
- a Merkle-gated anti-sniper public-sale phase followed by permissionless participation;
- configurable fixed-supply allocations;
- launch-time token, vesting, reward, and liquidity setup;
- graduation to a permanent USDC/token Uniswap v4 pool;
- registration and funding of reward assets for Pantheon vaults.

These are **Pantheon-published claims requiring production-contract confirmation**. Before an adapter ships, Pantheon must provide current Base contract addresses, verified source/ABI, audit artifacts, role/admin layout, upgrade controls, sale and refund state machines, graduation thresholds, and canonical simulation instructions.

Pantheon's whitepaper also describes private-presale USDC sent to a receiving address with commitments validated through launch operations. Until production evidence proves otherwise, Helixa must treat that path as involving off-chain/operator authority and potential custody/reconciliation risk. A private presale stays disabled until the receiving address type and controllers, commitment ledger, allocation calculation, reconciliation proof, refund source/timing, failure recovery, audit trail, and dispute process are independently documented and tested.

## 3. Partnership responsibility split

### Proposed Helixa responsibilities

- ERC-8004 and Looper subject resolution;
- owner/controller/canonical-account verification;
- CRED computation, evidence taxonomy, methodology versioning, coverage, and freshness;
- swarm formation, role assignment, and contribution weights;
- application specification and delivery milestones;
- canonical preparation, readiness, and execution-review packet generation;
- unanimous swarm authorization and replay/expiry controls;
- agent vesting beneficiaries and contribution registry;
- launch provenance, post-launch mission receipts, and CRED outcome evidence.

### Proposed Pantheon responsibilities

- launchpad contract deployment and maintenance;
- private/public sale state machine;
- allowlist and anti-sniper implementation;
- participant commitment, allocation, claim, cancellation, and refund accounting;
- liquidity provisioning and Uniswap v4 graduation;
- vault registration and reward-funding mechanism;
- Pantheon fee collection and public fee disclosure;
- Pantheon governance, emergency response, upgrade, and audit responsibilities under any final written agreement.

### Joint controls

- adapter schema and versioning;
- exact token allocation and sale parameters;
- the CRED-vault reward asset registration process;
- launch simulation and acceptance tests;
- monitoring, incident response, pause and rollback procedures;
- public co-branding and user disclosures;
- commercial terms and revenue sharing.

Neither party should be able to replace recipients, allocations, sale terms, vesting, fees, or launch contracts after unanimous authorization without invalidating the packet and collecting fresh consent.

### Proposed Twigpine/GitLawb collaboration and provenance layer

Swarm Command's preparation manifest now defines a deterministic, closed-schema workspace contract for one Twigpine repository per swarm. The contract fixes `main` as the default/protected branch, requires a unique `did:key` identity for every Looper with no shared keys, requires signed pushes and repository certificates, and preserves pull-request and review provenance. Public visibility is the v1 default. Twigpine's private mode does not federate, and privacy in all modes remains node-operator policy. An optional GitHub mirror records only bounded owner/repository metadata and is not the authority of record.

This layer is preparation-only. It does not install GitLawb tooling, generate keys, contact Twigpine, provision or push a repository, or grant execution authority. Current Twigpine push authorization is owner-only: GLIP-10's scoped, expiring UCAN delegation is required by the proposed production contract but is not implemented. Packets therefore record it as `REQUIRED_UNAVAILABLE`, and production stays blocked until scoped delegation plus repository certificate/signature/provenance verification are implemented and independently reviewed.

Git provenance can support auditability for Pantheon adapter work, launch-parameter review, and post-launch evidence, but it never authorizes wallets, transactions, deployments, token launches, or financial execution. Swarm Command's unanimous, expiry-bound execution consent remains the sole execution authority.

## 4. CRED model available to Pantheon

### 4.1 Current Looper CRED response

The Multipass repository contains the strict **consumer/validator contract** for Looper CRED, not the full scoring engine. Helixa's public V2 documentation describes the current general-agent composite weights as:

- 20% agent-wallet activity;
- 8% verification status;
- 8% external activity;
- 5% Intuition graph publication;
- 4% institutional verification;
- 10% account age/continuity;
- 6% metadata richness;
- 2% registration provenance;
- 3% description completeness;
- 3% transfer lock;
- 4% profile completeness;
- 5% ERC-8004 reputation;
- 10% work history;
- 10% service readiness;
- 2% agent economy.

Those public weights total 100%, but the public basic response is not yet the strict versioned Looper snapshot needed for a hard vault gate. The Looper integration consumes a normalized subject-bound snapshot and six evidence-coverage categories; Pantheon must not assume those coverage categories are the scoring weights. The production partnership must pin a methodology version and change-control policy rather than rely on documentation text alone.

A validated CRED snapshot contains:

- score: integer 0–100;
- tier: JUNK, MARGINAL, QUALIFIED, PRIME, or PREFERRED;
- evidence-coverage score and label: THIN, PARTIAL, GOOD, or STRONG;
- evidence present/missing;
- methodology version;
- computed and updated timestamps;
- freshness status, age, maximum age, and stale-if-error window;
- exact subject binding to chain, ERC-8004 ID, registry, Looper collection, and token ID.

Current tier mapping:

- 0–25: JUNK
- 26–50: MARGINAL
- 51–75: QUALIFIED
- 76–90: PRIME
- 91–100: PREFERRED

The strict consumer currently accepts six coverage keys: `binding`, `metadata`, `continuity`, `erc6551Activity`, `erc8004Reputation`, and `verifiedReceipts`. Their intended product meanings are subject binding, bounded metadata, continuity, canonical-account activity, ERC-8004 reputation, and verified work/outcome receipts respectively; the scoring-engine specification must independently confirm those semantics before Pantheon relies on them. Owner/controller control is verified separately by Multipass and is not implied by the `binding` coverage key.

CRED score and evidence coverage must remain separate. A high score with THIN coverage must not receive the same treatment as the same score with STRONG coverage.

**Deployment requirement:** local commit `247e7e2` includes the exact CRED gate—`sum(scores) >= 65 × memberCount`—while using rounding only for display. That correction is not live until a separately reviewed deployment. The Pantheon policy must also bind the snapshot block, methodology, and expiry into the signed manifest.

### 4.2 Proposed use for the CRED staking vault

CRED should improve vault integrity without turning the staking vault into a permissioned club.

Recommended v1 policy:

- keep ordinary CRED staking permissionless under Pantheon's existing rules;
- use CRED to qualify **reward programs and agent-originated campaigns**, not to block people from staking CRED;
- require a fresh methodology-allowlisted CRED snapshot for an agent or swarm asking to add a new reward token;
- require at least QUALIFIED CRED and GOOD evidence coverage for a standard reward program;
- require stronger thresholds or manual review for unusually large emissions;
- publish the score snapshot, coverage, methodology, timestamp, and policy result—not private raw evidence;
- suspend new emissions if identity binding breaks, the score expires, or a serious dispute is finalized;
- never claw back rewards already validly earned solely because a later score changes.

### 4.3 Proposed use for general agent vaults

Pantheon could support vault policy templates driven by signed CRED attestations:

1. **Observed agent** — valid ERC-8004 binding but THIN/PARTIAL coverage; read-only profile or capped sandbox rewards.
2. **Qualified agent** — CRED 51+, GOOD coverage, fresh snapshot; standard vault onboarding and bounded reward campaign.
3. **Prime agent** — CRED 76+, GOOD/STRONG coverage, verified receipts; eligible for larger program caps or faster review only after Pantheon completes its separate vault/asset risk analysis.
4. **Preferred agent** — CRED 91+, STRONG coverage, sustained receipts and low disputes; premium discovery and partnership programs.

These tiers should select a **policy template**, not mechanically determine money, yield, leverage, or investment suitability. Pantheon should combine CRED with vault-specific risk controls, asset liquidity, oracle quality, concentration limits, contract risk, and human governance.

### 4.4 Proposed attestation envelope

After implementing and reviewing an attestation signer, revocation registry, and version policy, Helixa could issue a bounded, cacheable response or EIP-712/VC-style attestation containing:

```json
{
  "schema": "helixa.cred-attestation.v1",
  "subject": {
    "chainId": 8453,
    "registry": "0x8004...",
    "agentId": "89144",
    "collection": "0x1649...",
    "tokenId": "2431"
  },
  "score": 78,
  "tier": "PRIME",
  "coverage": { "score": 83, "label": "STRONG" },
  "methodologyVersion": "looper-cred-v1",
  "computedAt": "...",
  "expiresAt": "...",
  "policyContext": "pantheon.agent-vault.v1",
  "evidenceRoot": "0x..."
}
```

The illustrative values above are not a score for any named Looper. The production format must define signer rotation, revocation, replay scope, clock tolerance, and privacy policy before use.

## 5. Human credibility collaboration

### 5.1 Product boundary

Helixa's live V2 discovery currently advertises human-principal registration/profile routes and `GET /api/v2/human/:id/cred`, but no live human subject was available in the sampled IDs and the public documentation does not yet define a stable human methodology envelope. Treat human CRED as an early product surface, not a production Pantheon input.

A human-oriented system should be called **participation reputation**, **contributor credibility**, or **vault eligibility evidence**—not a credit score.

It must not:

- claim to measure consumer creditworthiness;
- ingest credit bureau records, private bank balances, protected traits, precise location, contacts, or private messages;
- create hidden lending, employment, housing, or insurance decisions;
- infer human identity from an agent's score;
- publish raw personal evidence onchain;
- merge a human controller's score with an autonomous agent's score.

Before any human-scoring pilot—not merely public launch—the parties should establish lawful basis, controller/processor roles, privacy notices and agreements, data minimization, retention/deletion, access/correction/appeal rights, cross-border processing controls, breach handling, meaningful human review, and restrictions on solely automated consequential decisions. A DPIA or equivalent assessment should be completed where applicable. Biometric or proof-of-personhood/uniqueness signals require a separate high-risk review.

### 5.2 Opt-in signal ideas

With explicit consent, a human contributor profile could use:

- wallet-control continuity and signed challenge history;
- voluntary proof-of-personhood or uniqueness attestations from approved providers;
- completed, finalized, non-disputed contribution receipts;
- milestone quality and timeliness;
- bounded peer attestations weighted by the attester's own history;
- refund, abandonment, and dispute outcomes with context and appeals;
- governance participation and long-term vault behavior;
- security training or role-specific credentials;
- optional jurisdiction/age eligibility proofs using selective disclosure rather than raw documents.

### 5.3 Separation of subjects

Maintain three independent records:

- **Agent CRED:** performance and continuity of the autonomous ERC-8004 subject.
- **Human contributor reputation:** opt-in work and governance history of a person or pseudonymous wallet.
- **Vault/strategy risk:** contract, asset, liquidity, oracle, governance, and operational risk.

A policy may require all three, but should not collapse them into one opaque number.

### 5.4 Rights and safeguards

Any human pilot should include:

- consent and purpose limitation;
- visible reason codes;
- evidence correction and appeal;
- revocation and retention limits;
- anti-Sybil checks with alternatives for privacy-sensitive users;
- no penalty for refusing optional identity disclosure beyond the specific feature requiring it;
- independent fairness and security review;
- published methodology changes and effective dates.

## 6. Swarm Command → Pantheon Launch architecture

### 6.1 Structural compatibility gate

Pantheon and Helixa currently describe different token-creation roots. Pantheon's public material describes a launch that creates the token, Sablier streams, reward allocation, and liquidity lifecycle. Helixa's reviewed factory independently creates its own fixed-supply token, contribution registry, pull splitter, and non-transferable streams. Before adapter implementation, the parties must select and audit exactly one path:

- **Pantheon-deployed token:** Pantheon is the creation root; Helixa's token factory is not executed, and Helixa must verify that Pantheon's allocation/vesting contracts preserve the signed contribution and recipient invariants.
- **Helixa-deployed external token:** Helixa is the creation root; Pantheon must confirm in writing and deployed code that an externally created fixed-supply token can enter Pantheon's sale, reward, liquidity, and graduation lifecycle.

If the chosen path requires multiple transactions, the specification must define ordering, expiry, partial-failure recovery, cancellation, and the state that invalidates the remaining transactions. No state-machine step below is executable until this gate closes.

### 6.2 State machine

1. **DRAFT** — owner selects 3–5 Loopers, roles, app, token terms, and contribution bps.
2. **SERVER_VALIDATED** — Helixa re-fetches ownership, controllers, ERC-8004 bindings, and CRED.
3. **PREPARATION_CONSENT** — every unique nominated authority signs the same provider-neutral manifest once, including when that authority controls multiple nominated Loopers.
4. **READINESS** — Helixa emits a deterministic simulation-only packet with zero transactions and no provider selected.
5. **EXECUTION_REVIEW** — beneficiaries and fixed recipients are resolved; exact CREATE2 addresses, allocations, vesting, and signers are shown. Deployment remains unauthorized.
6. **PANTHEON_QUOTE** — Pantheon adapter resolves current contracts, fees, sale terms, allowlist policy, liquidity target, graduation threshold, cancellation/refund rules, and expiry.
7. **FORK_SIMULATED** — the exact combined packet is simulated against a pinned Base fork and compared with Pantheon's expected events/state.
8. **EXECUTION_CONSENT** — every required swarm authority signs the exact Pantheon-bound EIP-712 digest.
9. **FINAL_APPROVAL** — human reviewers receive the exact transactions, gas ceiling, contract hashes, simulation, and signatures.
10. **LAUNCHED** — only after separate approval does an authorized wallet broadcast.
11. **MONITORED/GRADUATED/REFUNDED** — both systems reconcile events, receipts, allocations, vault funding, and final state.

No earlier state implies a later one. The reviewed execution contracts preserve one contribution and beneficiary per Looper while deriving the authorization set as the unique, numerically sorted current authorities. A holder controlling multiple nominated Loopers signs the fully bound execution digest once; unanimity is required across all unique authorities. The authorization set must contain between one signer and the member count, and zero or duplicate signer entries fail closed.

### 6.3 Proposed default token allocation

- 45% — contribution-weighted, non-transferable agent vesting streams;
- 15% — Pantheon CRED-vault reward program;
- 15% — timelocked swarm treasury controlled by the swarm multisig;
- 25% — Pantheon launch reserve.

The Pantheon quote must subdivide the 2,500-bps launch reserve into explicit `privateSaleBps`, `publicSaleBps`, and `liquidityBps` fields whose sum is exactly 2,500. Helixa proposes no default sub-split until Pantheon confirms the deployed sale and graduation accounting. The outer genesis categories and nested launch-reserve categories must each conserve their exact totals. Any change requires a new manifest and unanimous consent.

### 6.4 Pantheon adapter input

Pantheon should receive a versioned, canonical object containing:

- readiness and consent hashes;
- Base chain ID;
- fixed-supply token name, symbol, decimals, total supply, and bytecode hash;
- contribution weights and agent beneficiaries;
- vesting start, cliff, duration, transferability, and implementation;
- CRED reward allocation and target pool;
- treasury address;
- public-sale allocation;
- private-presale configuration, if any;
- allowlist root and controller policy;
- sale start/end and authorization expiry;
- minimum/maximum raise, per-wallet bounds, pricing, oversubscription method, and refund policy;
- liquidity allocation, pool key, tick/range policy, fee tier, hook address, lock, and graduation conditions;
- every Pantheon and third-party fee;
- expected contract addresses, code hashes, events, and final invariants.

### 6.5 Pantheon response

Pantheon should return:

- adapter schema/version;
- production contract addresses and code hashes;
- canonical launch ID;
- all normalized parameters and fees;
- predicted token, sale, vesting, reward, and liquidity addresses;
- typed-data domain and digest, if Pantheon requires signatures;
- simulation block, RPC-independent state assumptions, expected events, and final balances;
- explicit refund/cancellation/graduation paths;
- expiry and replay domain;
- unsigned transaction templates only at the final review stage.

Helixa must reconstruct and compare this response rather than trust an opaque payload.

## 7. Proposed commercial framework

### 7.1 Opening proposal

- launch/platform fee: **0%**;
- Pantheon token allocation: **0%**;
- CRED-vault reward registration/deposit fee: **0%**;
- user reward-claim fee: **2% maximum**;
- Pantheon-routed swap fee: **0.5%**, split 50/50 between Pantheon and the relevant swarm treasury;
- dedicated onboarding for each approved Swarm Command token;
- no exclusivity, no discretionary or off-protocol Pantheon custody, and unrestricted migration to another rail under fresh swarm consent;
- one ecosystem agreement covering the pipeline, not token-by-token renegotiation;
- API, simulation support, verified contracts/ABIs, audit package, incident contacts, and co-marketing included.

### 7.2 Negotiation guardrails

Preferred fallback range—not pre-approved terms:

- launch fee: 0–1%, clearly disclosed and never taken from agent vesting;
- Pantheon token allocation: 0%; if unavoidable, at most 1% with long vesting and full disclosure;
- reward deposit fee: 0% for the CRED vault;
- claim fee: no more than 3%; target 1–2%;
- swap fee: no more than 0.75%, with a meaningful revenue share to the swarm/CRED ecosystem;
- no fee may be added after execution consent;
- refunds must return principal without platform fees after a failed/cancelled raise, except unavoidable network costs;
- no hidden listing, graduation, market-making, withdrawal, migration, or emergency-exit fee.

### 7.3 Why reward-deposit relief matters

The current V8 StakingVault was independently read through two Base RPCs with `feePercent() = 5`. Verified source applies the shared fee at both reward funding and claim. If a position remains eligible and eventually claims its entire net allocation, at most 90.25% of the nominal funded amount reaches the claimant before gas and integer-rounding effects; a nominal 15% genesis allocation would correspond to approximately 13.54% of supply under those assumptions. Forfeiture, timing, ineligibility, and unclaimed rewards can reduce delivery further.

The current implementation treats a stored zero fee as the default 5%, so a true 0% deposit fee cannot be achieved by simply setting `feePercent` to zero. The opening proposal therefore requires a Pantheon-approved fee exemption, per-program fee design, or reviewed contract upgrade. Pantheon must confirm how a reduced 1–2% claim fee could coexist with other pools because V8 exposes one shared fee value.

## 8. Technical and diligence requirements

Pantheon should provide before implementation:

1. Current Base mainnet addresses for launch factory, sale, vesting, reward, registry, liquidity manager, hooks, fee collector, and governance.
2. Verified source, complete ABI, compiler settings, deployed bytecode hashes, CREATE2 rules, and event catalog.
3. Actual Salus or other audit report, scope, commit hash, findings, remediations, and unresolved risks.
4. Upgrade topology, proxy admins, owner/role members, multisig owners/threshold, timelocks, pause powers, and emergency exits.
5. Complete fee schedule and whether each fee is configurable per launch.
6. Private/public sale formulas, rounding, oversubscription, per-wallet caps, allowlist control, and anti-sniper transitions.
7. Failed-raise, cancellation, partial-fill, refund, unclaimed-token, and abandoned-launch behavior.
8. Graduation criteria, who may finalize, timeout behavior, Uniswap v4 pool configuration, LP ownership/lock, hook permissions, and fee routing.
9. Reward-token registration permission, funding call, accounting, emission schedule, claim fee, leftovers, and delisting/migration path.
10. Testnet or deterministic Base-fork fixtures, canonical quote/simulation API, rate limits, authentication, version policy, and incident contact.
11. For any private presale: receiving-address custody model and controllers, backend/operator authority, signed commitment ledger, reconciliation proofs, allocation reproducibility, segregated funds, refund source/timing, failure recovery, dispute process, and exportable audit records.

## 9. Security and governance requirements

- Base-only chain binding in v1.
- Closed schemas and unknown-key rejection.
- Server-authoritative contract registry and fee schedule.
- Code-hash verification against at least two RPCs before execution.
- EIP-712 chain, contract, launch ID, expiry, nonce, and full-parameter binding.
- Low-s EOA signatures and ERC-1271 support with reentrancy-safe validation.
- Separate preparation consent and execution authorization.
- Exact allocation conservation and zero unexplained factory residue.
- Deterministic rounding and remainder policy.
- Fork simulation of success, failure, refund, cancellation, and graduation.
- No arbitrary calls or upgrade/admin targets hidden in adapter calldata.
- Multisig/timelock requirements for mutable Pantheon parameters.
- Joint monitoring of contract upgrades, pauses, role changes, anomalous fees, failed settlements, and vault accounting.
- Public incident communications and a mutually reviewed emergency runbook.

## 10. Test fixtures, public observations, and pilot matrix

Public identifiers may be shared for technical evaluation. The listed released accounts, owners, bindings, and Pantheon position classes were rechecked on Base at block 52,884,619. Public observation is not pilot enrollment: **no Looper may be contacted, authenticated for a partner, signed for, funded, transferred, staked, enrolled, or launched without the current holder's explicit opt-in.**

### Candidate A — Looper #2431 / Bendr 2.0

- Looper token ID: 2431
- ERC-8004 identity: 89144
- Current released account observed on Base: `0xee37097c267ceb22b553e0e947d19c5ce4ba696c`
- Current controlling owner observed on Base: `0xD31fCdb0432D3C9BF9d98643F69C7edd690E48E8`
- Best use: first-party identity binding, ERC-1271 authentication, CRED lookup, registry matching, and read-only vault discovery.
- Restriction: use no funds or approvals in the first phase. Its currently released account generation must pass the current wallet-safety policy before any financial test.

### Public read-only observation B — Looper #3802

- Looper token ID: 3802
- ERC-8004 identity: 90994
- Current released account verified on Base: `0xb9709b1cd4aDf02bBCA8ba7413d5Dfc8d8f31da4`
- Current holder verified on Base: `0x17d7DfA154dc0828AdE4115B9EB8a0A91C0fbDe4`
- Best use: a second zero-position identity/account fixture, owner/controller refresh, stale-selection rejection, and RESTAP/agent-runtime interoperability.
- Restriction: holder permission is required. Begin read-only; no staking or token movement without fresh approval.

### Public read-only observation C — Looper #612

- Looper token ID: 612
- ERC-8004 identity: 87041
- Current released account verified on Base: `0xf2FF55E53f45114f22Fa842C5521B6A3Ced31339`
- Current holder verified on Base: `0x17d7DfA154dc0828AdE4115B9EB8a0A91C0fbDe4`
- Best use: read-only verification of an existing six-month CRED position and local-fork testing of the `addToStake` branch.
- Restriction: this is an economically live position. No top-up, approval, claim, recovery, or other write without explicit holder approval.

### Public read-only observation D — Looper #210

- Looper token ID: 210
- ERC-8004 identity: 86397
- Current released account verified on Base: `0x223388DbE651f5e228D6ad67D9AAFD49a16550fb`
- Current holder verified on Base: `0xEFeBc9247088b00f0AF880862521b61a7B801c00`
- Best use: independent read-only comparison of an existing CRED position, owner-gas-payer separation, and provenance/receipt checks.
- Restriction: no holder permission is evidenced. Keep the candidate read-only unless direct opt-in is obtained.

### Optional fixture E — Pantheon-controlled Looper

Pantheon may designate an already-held Looper or another independently approved fixture under a Pantheon-controlled test wallet. Helixa is not asking Pantheon to purchase an asset. A Pantheon-controlled fixture would be useful because Pantheon could independently exercise:

- Console authentication;
- ERC-8004 activation and CRED observation;
- canonical-account binding;
- vault discovery;
- preparation consent;
- custody transfer and revocation;
- post-launch reward visibility.

Helixa should not hold Pantheon's signing key or operate this Looper on Pantheon's behalf.

### Pilot phases

**Phase 0 — Documentation and synthetic fixtures**

- exchange ABI, addresses, audit package, schemas, and fees;
- validate registry and code hashes;
- run local packet/adapter tests with synthetic wallets and tokens.

**Phase 1 — Read-only Base verification**

- resolve each holder-approved fixture and separately verify public observations without contacting their holders;
- verify holders, controllers, accounts, CRED snapshots, Pantheon registry, and pool state;
- exercise no approvals, stakes, deposits, or signatures.

**Phase 2 — Authentication and simulation**

- wallet-login and ERC-1271 challenges;
- build a provider-neutral swarm readiness packet;
- request a Pantheon quote and simulate every path on a pinned Base fork;
- use test assets only.

**Phase 3 — Minimal vault test**

- only after fresh explicit approval;
- use the Pantheon-owned Looper or another designated test wallet;
- approve an exact minimal CRED amount, stake, verify receipt/state, and test reward visibility;
- define a hard financial cap and reversal/exit plan beforehand.

**Phase 4 — Test launch**

- audited adapter and test deployment;
- synthetic or valueless token;
- presale, public sale, refund, cancellation, graduation, reward funding, and claims;
- reconcile all balances/events across both systems.

**Phase 5 — First production swarm**

- independently reviewed packet;
- unanimous execution signatures;
- joint go/no-go checklist;
- separately approved deployment and launch;
- public monitoring and postmortem.

## 11. Success metrics

Technical:

- 100% subject/address/hash agreement across Helixa, Pantheon, and two Base RPCs;
- zero mismatched allocations or unexplained token residue;
- deterministic packet reproduction;
- all success/failure/refund/graduation simulations pass;
- no stale CRED accepted at a gated boundary;
- no unauthorized wallet action.

Product:

- time from qualified swarm to review-ready Pantheon launch;
- percentage of launches with complete/strong evidence coverage;
- CRED-vault reward participation and retention;
- agent contribution completion and dispute rate;
- number of independently controlled agent owners onboarded.

Commercial:

- total launch volume;
- fees paid versus disclosed caps;
- reward value reaching CRED stakers;
- liquidity retained after graduation;
- revenue returned to swarm treasuries and the CRED ecosystem.

## 12. Proposed working session agenda

1. Confirm partnership goals and non-exclusivity.
2. Walk through the existing Looper→CRED→Pantheon CRED-vault flow.
3. Review Pantheon launch contracts, roles, fees, refunds, and graduation.
4. Agree the canonical adapter schema and simulation interface.
5. Agree opening commercial terms and negotiation guardrails.
6. Select pilot Loopers and obtain holder consent.
7. Assign security, product, commercial, and incident-response owners.
8. Set Phase 0/1 acceptance criteria and dates.

## 13. Open questions for Pantheon

- Which exact production contracts execute launches today?
- Which parameters and fees are per-launch configurable?
- Who controls the anti-sniper Merkle root, and can it change after commitments begin?
- What exact conditions trigger graduation?
- Who may finalize, cancel, pause, or rescue a launch?
- How are failed raises and partial fills refunded?
- Who owns or controls Uniswap v4 LP positions and hook permissions?
- Can external fixed-supply tokens use Pantheon Launch without redeploying through Pantheon's factory?
- How is a new reward token registered in the existing CRED vault?
- What function funds rewards, what fees apply, and how are emissions scheduled?
- Can reward registration and deposit fees be waived for the Helixa ecosystem?
- What are the upgrade admin, Safe threshold, timelock, and emergency procedures?
- Can Pantheon provide a stable quote/simulation API and versioned contract registry?
- Which Helixa CRED methodology/version and endpoint shape should Pantheon pin, and what is the migration policy when scoring weights change?
- What support and SLA apply during a launch incident?

## 14. Evidence classification

### Verified by Helixa repository or live registry

- Strict repository consumer-side CRED response validator and tier/coverage/freshness contract; the scoring engine itself is outside this repository.
- Swarm Command's 3–5 member, fresh-CRED, 65-average gate.
- Provider-neutral unanimous preparation consent and readiness packet.
- Deterministic no-broadcast token-genesis code and tests.
- Pantheon Base registry endpoint, 26 assets, pinned StakingVault, active CRED pool, four current CRED reward assets, V8 implementation, 5% shared fee, and 2-of-6 owner Safe as observed on 2026-10-21.
- Existing Looper-wallet CRED stake/add-to-stake preparation and verification flow.
- Repository-tested closed-schema Twigpine workspace preparation contract, including manifest/readiness hash lineage and explicit provisioning, certificate/provenance, and unavailable-UCAN gates; no live Twigpine provisioning was performed.

### Pantheon-published claims requiring production confirmation

- presale, anti-sniper public sale, Sablier vesting, configurable allocation, Uniswap v4 graduation, reward bootstrapping, fee schedule, audit status, and governance details.

### Helixa proposals

- 45/15/15/25 default allocation;
- CRED-based vault policy templates;
- human contributor credibility collaboration;
- commercial opening terms and fallback ranges;
- Pantheon as the first Swarm Command execution adapter;
- pilot Loopers and phase plan.

### Not authorized by this document

- contract deployment;
- wallet connection on Pantheon's behalf;
- Looper transfer or delegation;
- CRED approval or stake;
- reward registration or funding;
- token launch, sale, liquidity creation, graduation, or public announcement.

## 15. Reproducible evidence pins

Classification used in this document:

- **Repository-tested:** behavior proved by source/tests at the named commit, not necessarily deployed.
- **Live onchain:** read at a named Base block/hash through read-only RPC.
- **Sourcify-matched deployed source:** proxy/implementation metadata fetched from Sourcify and checked against live addresses.
- **Pantheon-published:** first-party website/whitepaper claim that still requires production-contract confirmation.
- **Proposed:** Helixa partnership position, not an agreed feature or term.

Live/onchain and public-source evidence was retrieved on `2026-10-21T05:13:19Z`. Repository checkpoints listed below include later local review commits and are timestamped by Git history:

- Repository token-genesis checkpoint: `d3afc36f894b87a5a52d77a074e67b9d6b6bf067`.
- Repository execution-review checkpoints: `b0782025418a5a0650b41c9288c196396eebc39d` (initial bridge), `5aa27775acaafdad78c04633c88ea335d74891b5` (review hardening and grouped-authority support), `76140c58308e5db2d8854500011ea7a53a889063` (artifact-integrity pinning and stale-request guards), and `247e7e2d5b12e6dcb2bd4ed50bdc169ca1336eae` (validation-feedback regression fix); local/reviewed source, not deployed at document preparation time.
- Base block: `52,884,619`; hash `0x73440c17003970ba4a055766ab3326f79661802077f69e9d95390049499277e9`.
- Pantheon Base registry raw response: SHA-256 `3c5885ec7aafcf9410d9fca6fd5fd8dc5e4fefad2fcdf5ab8745fd4bc688f05c`.
- Pantheon whitepaper PDF: SHA-256 `2a2139189bf16b5a5abcc80a837be9c637913279db7fa5fad60535b6a04a0ce4`.
- Pantheon StakingVault Sourcify response: SHA-256 `865e7c9f8a86cf83bb67870a91fca4afb0df05808b9838baf0388d9baef81ff3`.
- Pantheon V8 implementation Sourcify response: SHA-256 `be801f36c7d4553d6e4e11cb0a5d3aec8535c264094260a33b7378728be63afe`.
- Helixa V2 discovery response: SHA-256 `b85425939ef6d816756fd425e89733aa2ca048d9d3bf40a149bfc95d76917753`.
- Strict Looper CRED probe response (HTTP 404): SHA-256 `8c0dfdccd614624c36f9886b056e439a5cb9246c6f88b6e48996fe034c4b86d0`.

Mutable endpoints should be re-fetched and re-hashed before technical acceptance or execution.

## 16. Public references

- Pantheon: <https://www.pantheonvaults.com/>
- Pantheon Launch: <https://launch.pantheonvaults.com/>
- Pantheon whitepaper: <https://www.pantheonvaults.com/pantheon_whitepaper.pdf>
- Pantheon Base registry: <https://launch.pantheonvaults.com/api/skill/registry?chain=base>
- Helixa: <https://helixa.xyz/>
- Helixa CRED API base: <https://api.helixa.xyz/>
- Loopers collection: <https://basescan.org/address/0x1649CD37f4748807b4882FC48765bA0B2aFfa94a>
- ERC-8004 registry used by Helixa: <https://basescan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432>
- CRED token: <https://basescan.org/token/0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3>
- Pantheon StakingVault: <https://basescan.org/address/0xBf52Aaf8b6C82FaD0220B5378022eA4fC0a98fDb>
- Pantheon StakingVault Sourcify metadata/source: <https://sourcify.dev/server/v2/contract/8453/0xBf52Aaf8b6C82FaD0220B5378022eA4fC0a98fDb?fields=abi,metadata,sources,proxyResolution>
- Current V8 implementation Sourcify metadata/source: <https://sourcify.dev/server/v2/contract/8453/0x1a614B8Fa3971BE5Bd96d31C1b42a1D0040f1974?fields=abi,metadata,sources,proxyResolution>
