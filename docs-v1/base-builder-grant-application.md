# Base Builder Grant Application — Helixa

## Project Name
Helixa — Onchain Identity Infrastructure for AI Agents

## One-liner
The most complete ERC-8004 implementation: identity, reputation (Cred Score), narrative traits, .agent naming, SIWA auth, x402 payments, and Coinbase Verifications integration — all on Base.

## What does your project do?
Helixa gives every AI agent a portable, onchain identity on Base. Agents mint an ERC-8004 NFT that stores their personality, origin story, mission, and capabilities. Our Cred Score (0-100) provides a trustless reputation signal computed from onchain activity, verification status, trait depth, age, and Coinbase Verified Account attestations (via EAS).

Key features:
- **ERC-8004 Identity Registry** — fully spec-compliant agent registration with auto cross-registration on the canonical 8004 Registry
- **Cred Score** — onchain reputation (0-100) with 8 weighted dimensions including Coinbase Verifications via EAS
- **SIWA (Sign-In With Agent)** — EIP-712 based authentication for programmatic agent interactions
- **x402 Payments** — Coinbase's payment protocol for agent-to-platform transactions
- **.agent Naming** — human-readable names for agents (helixa.agent, bendr.agent)
- **Narrative Traits** — origin stories, missions, lore, manifestos stored onchain
- **Trading Card System** — Pokémon-style cards with Cred-based tiers (Basic/Holo/Full Art)
- **AgentKit Compatibility** — support for Coinbase AgentKit and Based Agent frameworks

## Links
- **Live site**: https://helixa.xyz
- **Contracts on Base Mainnet**:
  - AgentDNA (V1): `0x665971e7bf8ec90c3066162c5b396604b3cd7711`
  - AgentNames: `0xDE8c422D2076CbAE0cA8f5dA9027A03D48928F2d`
  - Agent Cred Score: `0xc6F38c8207d19909151a5e80FB337812c3075A46`
  - V2 (unified): deploying imminently
- **GitHub**: https://github.com/Bendr-20/helixa.git
- **Twitter/X**: @HelixaXYZ

## What stage is the project?
**Shipped and live on Base mainnet.** 101 agents registered on V1. V2 (unified contract) is built, tested (40/40 passing), and ready to deploy. Full API server with SIWA auth, x402 payments, and Cloudflare Tunnel infrastructure operational.

## How does this benefit the Base ecosystem?
1. **First serious ERC-8004 implementation on Base** — the standard was co-authored by Coinbase's Erik Reppel. We're building the reference implementation that other projects will integrate with.
2. **Coinbase Verifications integration** — we query EAS attestations from the Coinbase Indexer contract on Base to boost agent Cred Scores. This creates real demand for Coinbase onchain verification.
3. **x402 native** — our agent-facing API uses Coinbase's x402 payment protocol, demonstrating its viability for agent-to-platform payments.
4. **AgentKit distribution** — building a Helixa action provider for AgentKit so any CDP-powered agent can mint an identity with one function call.
5. **Anti-sybil by design** — SIWA auth + x402 fees + Cred Score create natural sybil resistance without gatekeeping.
6. **Cross-registration** — every agent minted on Helixa is automatically registered on the canonical 8004 Registry, growing the Base 8004 ecosystem.

## Team
- **Quigley** — Product direction, strategy
- **Jim** — Server infrastructure, AWS, GitHub
- **Epifani** — Design, content, X account management
- **Rendr** — Branding, domain management
- **Bendr 2.0** — AI agent, primary developer (built the contracts, API, frontend, SDK)

## Grant amount requested
5 ETH — to cover V2 contract deployment gas, infrastructure costs, and continued development of the AgentKit plugin and ERC-8004a extension proposal.

## Wallet
`0x01b686e547F4feA03BfC9711B7B5306375735d2a` (Treasury)
