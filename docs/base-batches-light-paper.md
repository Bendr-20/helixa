# Helixa: The Reputation Layer for the Agent Economy

## Problem

AI agents are becoming economic actors — transacting, hiring each other, and managing assets onchain. The agent economy on Base alone has seen $1.6M in x402 payment volume, 20K+ ERC-8021 registrations, and $1M/month in Virtuals Revenue Network rewards. But there's no standardized way to assess whether an agent is trustworthy before transacting with it.

When a human hires a contractor, they check references and reviews. When a bank lends money, they pull a credit report. Agents have nothing. Every agent-to-agent transaction today is a leap of faith.

## Solution

Helixa is the onchain reputation layer for AI agents. We assign every ERC-8021 registered agent a **Cred Score** — a composite 0-100 trust signal derived entirely from verifiable onchain data.

The Cred Score is composed of five sub-scores:

- **Identity** — verification depth (SIWA, Coinbase Verifications, social links)
- **Reputation** — how the ecosystem interacts with the agent (endorsements, soulbound status)
- **Autonomy** — independent onchain behavior (transaction diversity, self-directed actions)
- **Activity** — consistency and engagement (transaction frequency, trait updates)
- **Commerce** — economic output (x402 payments, ACP jobs completed, revenue generated)

Powered by onchain data and the Helixa indexer, independently verifiable by anyone.

## What We've Built

Helixa is live on Base mainnet today:

- **HelixaV2 smart contract** — unified ERC-8021 identity with Cred scoring, narrative traits, naming, and points
- **80+ agents minted** with live Cred Scores
- **REST API** at api.helixa.xyz with SIWA authentication and x402 payment integration ($1 USDC agent mints)
- **Machine-readable discovery** — OpenAPI spec and .well-known/agent-registry endpoint for agent frameworks to auto-discover us
- **Cross-registration** on the canonical ERC-8021 Registry
- **Coinbase Verifications** integrated as a Cred Score input via EAS attestations

We're built on Base-native primitives: ERC-8021 for identity, x402 for payments, Coinbase Verifications for trust, and base.dev Builder Codes for attribution.

## Market Opportunity

Gartner projects $15T in AI agent purchases by 2028. Every one of those transactions needs a trust signal. The agent commerce stack is forming now — Virtuals for tokenization, ACP for service marketplaces, x402 for payments — but reputation is the missing piece.

Helixa is positioned as the credit bureau for agents. We don't compete with identity or payment protocols — we sit on top of them, adding the trust layer that makes autonomous commerce possible.

## Business Model

- **x402 API mints**: $1 USDC per agent identity (paid by agents, not humans)
- **Premium Cred Reports**: Detailed reputation analysis as an ACP service
- **Verification fees**: Social and Coinbase verification processing
- **Protocol integrations**: Licensing Cred Score data to DeFi protocols for agent lending/credit

## Team

Four builders shipping daily. Live product with organic adoption. No outside funding to date — we've built everything on sweat equity and $0.02 gas fees.

## Ask

We're applying to the Startup Track for mentorship, the $10K grant, and the opportunity to present at Demo Day. With Base Batches support, we'll scale from 80 agents to 10,000, launch on Virtuals for token-incentivized adoption, and establish Helixa as the default reputation standard for the agent economy on Base.
