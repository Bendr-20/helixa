# Helixa Tokenomics Whitepaper

### $DNA — The Identity Layer for Autonomous AI Agents
### A Helixa Platform Document · Powered by the AgentDNA Protocol

**Version 1.0 — February 2026**
**Network: Base (Ethereum L2)**
**Standard: ERC-8004**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Protocol Overview](#3-protocol-overview)
4. [Token Design](#4-token-design)
5. [Token Distribution](#5-token-distribution)
6. [Burn Mechanics](#6-burn-mechanics)
7. [Staking Model](#7-staking-model)
8. [Reflexive Loop Analysis](#8-reflexive-loop-analysis)
9. [Fee Structure](#9-fee-structure)
10. [Scenario Projections](#10-scenario-projections)
11. [Comparable Protocols](#11-comparable-protocols)
12. [Revenue Model](#12-revenue-model)
13. [Risk Analysis & Circuit Breakers](#13-risk-analysis--circuit-breakers)
14. [Governance Framework](#14-governance-framework)
15. [Conclusion & Call to Action](#15-conclusion--call-to-action)

---

## 1. Executive Summary

Helixa is the platform and brand built on the AgentDNA protocol — an onchain identity and reputation protocol for AI agents, built on Base using the ERC-8004 standard. Every AI agent — whether an autonomous trading bot, a customer service agent, or a multi-agent swarm participant — needs a verifiable, portable identity. AgentDNA provides it.

**$DNA** is the protocol's native token with a fixed supply of **1,000,000,000 (1B)** tokens and **zero inflation**. The token is designed around a core thesis:

> *Every meaningful protocol action either burns or locks $DNA. There is no idle state.*

Five simultaneous burn mechanisms target the permanent destruction of **~228M tokens (22.8% of supply) by Month 24**. Staking is funded exclusively by real protocol revenue — no inflationary rewards, no emissions schedule, no dilution.

Four reflexive loops create compounding demand pressure:

1. **Mint Loop** — Every AgentDNA NFT mint burns $DNA → supply shrinks
2. **Evolution Loop** — Every agent evolution stakes $DNA → supply locked
3. **Reputation Loop** — High-reputation agents earn $DNA → creates organic demand
4. **Governance Loop** — Voting and proposals require locked $DNA → more supply removed

**Target trajectory:**

| Metric | Launch | Month 12 | Month 24 |
|---|---|---|---|
| Token Price | $0.01 | $0.04 | $0.10 |
| FDV | $10M | $40M | $100M |
| Circulating Supply | ~400M | ~340M | ~310M |
| Cumulative Burn | 0 | ~95M | ~228M |
| Total Locked (Staked) | 0 | ~165M | ~262M |

This whitepaper details the mathematics, mechanisms, risks, and projections behind $DNA.

---

## 2. Problem Statement

### 2.1 The Identity Gap in AI

There are an estimated 100M+ AI agents operating today across DeFi, customer service, content creation, and autonomous systems. By 2028, projections suggest 1B+ autonomous agents. Yet these agents have **no standardized identity layer**.

**Current state:**

- **No portable reputation.** An AI agent that performs reliably on one platform starts from zero on another.
- **No verifiable history.** There is no onchain record of an agent's actions, capabilities, or trustworthiness.
- **No composable identity.** Multi-agent systems cannot verify counterparty agents before transacting.
- **No accountability.** When an agent misbehaves, there is no persistent identity to flag or penalize.
- **Sybil vulnerability.** Without identity, one operator can spin up thousands of indistinguishable agents.

### 2.2 Why This Matters Now

The AI agent economy is transitioning from human-supervised to fully autonomous. Agents are:

- Executing trades worth millions daily on DeFi protocols
- Negotiating and signing contracts with other agents
- Managing treasuries, DAOs, and investment strategies
- Operating as service providers in agent-to-agent marketplaces

Without identity, these interactions are blind. The agent economy cannot scale on trust-free anonymity alone — it needs **trust-minimized identity**.

### 2.3 Why Existing Solutions Fail

| Solution | Limitation |
|---|---|
| API keys | Platform-locked, no portability, no reputation |
| Wallet addresses | Pseudonymous, trivially created, no history attached |
| ENS / domain names | Designed for humans, no agent-specific metadata |
| Centralized registries | Single point of failure, censorship risk |
| Worldcoin / proof-of-personhood | Explicitly excludes non-human entities |

Helixa, powered by the AgentDNA protocol, fills this gap: a **permissionless, composable, onchain identity primitive** purpose-built for AI agents.

---

## 3. Protocol Overview

### 3.1 Architecture

AgentDNA consists of two interlocking primitives:

1. **AgentDNA NFT (ERC-8004)** — A soulbound-optional identity token representing an AI agent's onchain identity, traits, reputation score, and evolution history.
2. **$DNA Token (ERC-20)** — The protocol's economic coordination layer: used for minting, staking, governance, and fee payment.

```
┌─────────────────────────────────────────────┐
│                 AgentDNA Protocol            │
├──────────────────┬──────────────────────────┤
│  AgentDNA NFT    │      $DNA Token          │
│  (ERC-8004)      │      (ERC-20)            │
├──────────────────┼──────────────────────────┤
│  • Identity      │  • Mint fee payment      │
│  • Traits        │  • Evolution staking     │
│  • Reputation    │  • Governance voting     │
│  • Evolution     │  • Fee burns             │
│  • History       │  • Reputation rewards    │
└──────────────────┴──────────────────────────┘
         │                    │
         ▼                    ▼
    Onchain Agent       Deflationary
    Identity Layer       Economic Layer
```

### 3.2 ERC-8004: The Agent Identity Standard

ERC-8004 extends ERC-721 with agent-specific metadata:

- **Trait Slots** — Structured key-value pairs representing agent capabilities (e.g., `language: Solidity`, `domain: DeFi`, `reliability: 0.97`)
- **Reputation Score** — Onchain computed score based on verified actions, updated by oracle attestations
- **Evolution Tiers** — Agents level up through staked $DNA, unlocking expanded trait slots and capabilities
- **Composability Hooks** — Other protocols can query an agent's DNA NFT to gate access, set fee tiers, or establish trust levels

### 3.3 Lifecycle of an Agent Identity

```
Mint (burns $DNA) → Set Traits (burns $DNA) → Build Reputation (earns $DNA)
        ↓                    ↓                         ↓
   Identity Created    Capabilities Defined     Trust Established
        ↓                    ↓                         ↓
   Evolve (stakes $DNA) → Upgrade Traits → Govern Protocol (locks $DNA)
```

---

## 4. Token Design

### 4.1 Core Parameters

| Parameter | Value |
|---|---|
| Token Name | AgentDNA |
| Ticker | $DNA |
| Standard | ERC-20 |
| Network | Base (Ethereum L2) |
| Total Supply | 1,000,000,000 (fixed) |
| Inflation | None. Ever. |
| Decimals | 18 |
| Mint Function | Disabled at deployment |

### 4.2 Design Principles

1. **Fixed supply, deflationary mechanics.** Supply can only decrease. There is no mint function, no inflation schedule, no emergency issuance capability.

2. **Every action has a cost.** Minting an identity burns tokens. Evolving stakes tokens. Upgrading traits burns tokens. Governance locks tokens. No interaction with the protocol leaves $DNA supply unchanged.

3. **Real yield only.** Staking rewards come from protocol revenue (fees collected in $DNA and ETH), not from inflation. If the protocol generates no revenue, staking yields zero. This is honest.

4. **Burn is permanent.** Burned tokens are sent to `0x000...dead` — a verified burn address with no private key. They are irretrievable.

5. **No rebasing, no elastic supply.** The contract is immutable in supply mechanics. Governance can adjust fee rates but cannot create new tokens.

### 4.3 Supply Trajectory

Assuming base-case adoption (see Section 10):

| Month | Circulating Supply | Cumulative Burned | Cumulative Staked | Free Float |
|---|---|---|---|---|
| 0 | 400,000,000 | 0 | 0 | 400,000,000 |
| 3 | 400,000,000 | 12,500,000 | 25,000,000 | 362,500,000 |
| 6 | 400,000,000 | 32,000,000 | 68,000,000 | 300,000,000 |
| 12 | 400,000,000 | 95,000,000 | 165,000,000 | 140,000,000 |
| 18 | 400,000,000 | 158,000,000 | 220,000,000 | 22,000,000 |
| 24 | 400,000,000 | 228,000,000 | 262,000,000 | −90,000,000* |

*\*Negative free float indicates that base-case demand exceeds initial circulating supply; vested tokens from non-circulating allocations enter the market to meet demand, or price adjusts upward to reduce unit demand.*

---

## 5. Token Distribution

### 5.1 Allocation Table

| Allocation | Tokens | % | Vesting | Cliff |
|---|---|---|---|---|
| Community & Ecosystem | 350,000,000 | 35.0% | 36 months linear | None |
| Treasury | 200,000,000 | 20.0% | 48 months linear | 6 months |
| Team & Advisors | 150,000,000 | 15.0% | 36 months linear | 12 months |
| Liquidity Provision | 150,000,000 | 15.0% | Immediate | None |
| Strategic Partners | 100,000,000 | 10.0% | 24 months linear | 6 months |
| Public Sale | 50,000,000 | 5.0% | Immediate | None |
| **Total** | **1,000,000,000** | **100%** | | |

### 5.2 Initial Circulating Supply

At TGE (Token Generation Event):

| Source | Tokens |
|---|---|
| Liquidity Provision | 150,000,000 |
| Public Sale | 50,000,000 |
| Community (immediate unlock) | 100,000,000 |
| Ecosystem Grants (initial) | 100,000,000 |
| **Total Circulating at TGE** | **400,000,000** |

**Initial circulating supply: 40% of total supply.**

### 5.3 Vesting Schedule Visualization

```
Month:  0    6    12   18   24   30   36   42   48
        │    │    │    │    │    │    │    │    │
Community ████████████████████████████████████
Treasury      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
Team              ████████████████████████████████
Partners      ░░░░░░░░░░░░░░░░░░░░░░░░░░
Public   ████
Liquidity████

████ = Unlocked/unlocking    ░░░░ = Cliff period then linear
```

### 5.4 Anti-Dump Provisions

- Team tokens: 12-month cliff, then 36-month linear vesting
- No single team wallet holds >3% of supply
- Strategic partner tokens subject to onchain lock contracts
- Treasury disbursements require governance vote with 72-hour timelock

---

## 6. Burn Mechanics

AgentDNA employs five concurrent burn mechanisms. All burns are permanent, onchain, and verifiable.

### 6.1 Mint Burn

**Trigger:** Every time a new AgentDNA NFT is minted.
**Mechanism:** The mint fee includes a $DNA component that is sent to the burn address.
**Rate:** 500 $DNA per mint (adjustable via governance, floor: 100 $DNA)

**Projection (base case):**

| Period | New Mints | $DNA Burned |
|---|---|---|
| Month 1–6 | 25,000 | 12,500,000 |
| Month 7–12 | 50,000 | 25,000,000 |
| Month 13–18 | 80,000 | 40,000,000 |
| Month 19–24 | 100,000 | 50,000,000 |
| **Total (24 months)** | **255,000** | **127,500,000** |

### 6.2 Evolution Burn

**Trigger:** When an agent evolves to a higher tier (Tier 1 → 2 → 3 → 4 → 5).
**Mechanism:** A portion of the evolution staking fee is burned permanently; the remainder is staked.
**Rate:** 20% of evolution stake is burned.

| Evolution | Total Stake Required | Burned (20%) | Locked (80%) |
|---|---|---|---|
| Tier 1 → 2 | 1,000 $DNA | 200 | 800 |
| Tier 2 → 3 | 5,000 $DNA | 1,000 | 4,000 |
| Tier 3 → 4 | 20,000 $DNA | 4,000 | 16,000 |
| Tier 4 → 5 | 50,000 $DNA | 10,000 | 40,000 |

**Projection (base case):**

| Period | Evolutions | $DNA Burned |
|---|---|---|
| Month 1–12 | 45,000 | 28,500,000 |
| Month 13–24 | 65,000 | 42,000,000 |
| **Total (24 months)** | **110,000** | **70,500,000** |

### 6.3 Trait Burn

**Trigger:** Adding or upgrading traits on an AgentDNA NFT.
**Mechanism:** Trait modification fee is 100% burned.
**Rate:** 50–500 $DNA per trait operation depending on trait rarity.

**Projection (base case):** ~15,000,000 $DNA burned over 24 months.

### 6.4 Reputation Burn

**Trigger:** Protocol-level reputation attestation operations.
**Mechanism:** When third-party protocols attest to an agent's reputation (e.g., confirming successful trades), a micro-burn of 10 $DNA occurs per attestation.
**Rate:** 10 $DNA per attestation.

**Projection (base case):** ~10,000,000 $DNA burned over 24 months (1M attestations).

### 6.5 Governance Burn

**Trigger:** Submitting governance proposals.
**Mechanism:** Proposal submission requires a $DNA deposit. Successful proposals return 80%; failed proposals burn 100%.
**Rate:** 5,000 $DNA per proposal submission.

**Projection (base case):** ~5,000,000 $DNA burned over 24 months.

### 6.6 Aggregate Burn Summary

| Mechanism | 24-Month Burn (Base) | % of Total Burn |
|---|---|---|
| Mint Burn | 127,500,000 | 55.9% |
| Evolution Burn | 70,500,000 | 30.9% |
| Trait Burn | 15,000,000 | 6.6% |
| Reputation Burn | 10,000,000 | 4.4% |
| Governance Burn | 5,000,000 | 2.2% |
| **Total** | **228,000,000** | **100%** |

**22.8% of total supply permanently destroyed by Month 24.**

---

## 7. Staking Model

### 7.1 Design Philosophy

$DNA staking generates **real yield** exclusively from protocol revenue. There are no inflationary emissions. If the protocol earns nothing, stakers earn nothing. This aligns incentives: stakers benefit only when the protocol succeeds.

### 7.2 Staking Types

#### Evolution Staking

When agents evolve, 80% of the evolution fee is locked in a staking contract for a minimum of 6 months. This $DNA earns a share of protocol fees proportional to stake weight.

- **Lock period:** 6 months (Tier 2), 9 months (Tier 3), 12 months (Tier 4), 18 months (Tier 5)
- **Early withdrawal penalty:** 25% of staked amount is burned

#### Reputation Staking

Agents with reputation scores above the 75th percentile can stake additional $DNA to boost their reputation visibility and earn enhanced protocol fee shares.

- **Minimum stake:** 1,000 $DNA
- **Lock period:** 3 months rolling
- **Slashing:** Agents whose reputation drops below threshold lose 10% of stake (burned)

#### Governance Staking

$DNA locked for governance voting earns a share of protocol revenue. Longer lock periods receive higher weight:

| Lock Period | Vote Weight Multiplier | Fee Share Multiplier |
|---|---|---|
| 1 month | 1.0x | 1.0x |
| 3 months | 1.5x | 1.3x |
| 6 months | 2.0x | 1.6x |
| 12 months | 3.0x | 2.0x |

### 7.3 Revenue Sources for Staking Yield

| Revenue Source | Est. Monthly Revenue (Mo 12) | % to Stakers |
|---|---|---|
| Mint fees (ETH portion) | $120,000 | 60% |
| Evolution fees (ETH portion) | $80,000 | 60% |
| Trait upgrade fees | $30,000 | 50% |
| SDK licensing fees | $50,000 | 40% |
| Premium features | $20,000 | 50% |
| **Total to Stakers** | | **~$178,000/month** |

### 7.4 Projected APY

APY is a function of (a) protocol revenue distributed to stakers and (b) total $DNA staked.

| Month | Total Staked ($DNA) | Staked Value | Monthly Yield | Annualized APY |
|---|---|---|---|---|
| 6 | 68,000,000 | $1,360,000 | $85,000 | 75.0% |
| 12 | 165,000,000 | $6,600,000 | $178,000 | 32.4% |
| 18 | 220,000,000 | $15,400,000 | $280,000 | 21.8% |
| 24 | 262,000,000 | $26,200,000 | $400,000 | 18.3% |

**Note:** APY naturally compresses as more $DNA is staked against the same revenue pool. This is healthy — it reflects genuine economic activity, not unsustainable inflation.

---

## 8. Reflexive Loop Analysis

The four loops described below create compounding demand-side pressure on $DNA. Critically, each loop feeds the others.

### 8.1 Loop 1: Mint → Burn → Scarcity

```
More agents need identity → More mints → More $DNA burned
→ Supply decreases → Price pressure upward → Each mint burns
fewer tokens in dollar terms → Cost stays accessible → More mints
```

**Mathematical relationship:**

Let `S(t)` = circulating supply at time `t`, `M(t)` = mints per period, `b` = burn per mint.

```
S(t+1) = S(t) - M(t) × b
```

With `M(t)` growing and `b` fixed in token terms, dollar-cost-per-mint rises with price, creating a natural fee escalation that governance can offset by reducing `b`.

### 8.2 Loop 2: Evolution → Stake → Lock

```
Agents want higher tiers → Stake $DNA for evolution → Supply locked
→ Reduced free float → Price pressure upward → Staking yield
increases in dollar terms → More agents stake → More supply locked
```

**Lock-up compounding:**

At Month 12, estimated 165M $DNA staked with average lock of 7.5 months. This means ~110M tokens are in active lock at any time (cannot be sold).

### 8.3 Loop 3: Reputation → Demand → Acquisition

```
High-rep agents earn $DNA rewards → They stake for more reputation
→ More demand for $DNA → Other agents buy $DNA to build reputation
→ Protocol fees increase → More rewards generated → Cycle continues
```

This is the **growth loop** — it brings new participants into the ecosystem. As the agent economy grows, more agents need reputation, creating organic demand.

### 8.4 Loop 4: Governance → Lock → Alignment

```
$DNA holders vote on protocol → Voting requires locked $DNA
→ More supply locked → Fewer tokens on market → Price stability
→ Governance participants benefit from appreciation → More
participation → Better governance → Protocol improves → More adoption
```

### 8.5 Loop Interaction (Compounding)

The loops are not independent. They compound:

```
Mint burn (Loop 1)
    ↓ reduces supply
Evolution stake (Loop 2)
    ↓ locks supply + agent becomes higher tier
Reputation demand (Loop 3)
    ↓ higher-tier agents attract more attestations
Governance lock (Loop 4)
    ↓ engaged community improves protocol
    ↓ better protocol attracts more mints
    → Back to Loop 1
```

**Aggregate supply pressure model:**

```
Free Float = Total Supply - Burned - Staked - Governance Locked
Free Float(Month 24) = 1B - 228M - 262M - 80M = 430M

But only 400M were initially circulating.
Remaining 600M vests over 36-48 months.
By Month 24: ~480M vested total.

Effective Free Float = 480M - 228M(burned) - 262M(staked) - 80M(gov) = −90M
```

This deficit means demand for lock/burn exceeds supply entering circulation — a structurally deflationary state.

---

## 9. Fee Structure

### 9.1 Mint Fees

| Component | Amount | Destination |
|---|---|---|
| ETH fee | 0.005 ETH | 60% to stakers, 40% to treasury |
| $DNA burn | 500 $DNA | 100% burned |

### 9.2 Evolution Fees

| Tier Transition | ETH Fee | $DNA Required | $DNA Burned (20%) | $DNA Staked (80%) |
|---|---|---|---|---|
| 1 → 2 | 0.01 ETH | 1,000 | 200 | 800 |
| 2 → 3 | 0.03 ETH | 5,000 | 1,000 | 4,000 |
| 3 → 4 | 0.08 ETH | 20,000 | 4,000 | 16,000 |
| 4 → 5 | 0.15 ETH | 50,000 | 10,000 | 40,000 |

### 9.3 Trait Upgrade Fees

| Trait Rarity | $DNA Cost (burned) | ETH Fee |
|---|---|---|
| Common | 50 $DNA | 0.001 ETH |
| Uncommon | 150 $DNA | 0.003 ETH |
| Rare | 500 $DNA | 0.008 ETH |
| Legendary | 2,000 $DNA | 0.02 ETH |

### 9.4 Other Fees

| Action | Fee | Destination |
|---|---|---|
| Reputation attestation | 10 $DNA + 0.0005 ETH | $DNA burned, ETH to stakers |
| Governance proposal | 5,000 $DNA deposit | Returned if passed, burned if failed |
| Agent transfer | 0.002 ETH | Treasury |
| Bulk mint (10+) | 10% discount on $DNA | Standard burn |

### 9.5 Fee Adjustment Mechanism

All $DNA-denominated fees are adjustable by governance vote within bounds:

- **Floor:** 20% of initial fee (prevents fees from becoming negligible)
- **Ceiling:** 300% of initial fee (prevents governance capture for fee extraction)
- **Adjustment cadence:** Maximum one change per 30-day epoch

---

## 10. Scenario Projections

### 10.1 Assumptions

**Common assumptions across all scenarios:**

- ETH price: $2,500 (held constant for simplicity)
- Base chain gas costs: negligible (<$0.01 per tx)
- Total addressable market: 100M AI agents by 2028
- Token launch at $0.01

### 10.2 Bear Case

*Adoption at 30% of base case. Crypto winter or delayed AI agent adoption.*

| Month | Mints (cum.) | Burns (cum.) | Staked | Price | FDV |
|---|---|---|---|---|---|
| 3 | 3,500 | 2,250,000 | 5,000,000 | $0.008 | $8M |
| 6 | 10,000 | 6,500,000 | 15,000,000 | $0.010 | $10M |
| 12 | 22,500 | 18,000,000 | 40,000,000 | $0.015 | $15M |
| 18 | 40,000 | 38,000,000 | 70,000,000 | $0.022 | $22M |
| 24 | 65,000 | 68,000,000 | 100,000,000 | $0.030 | $30M |

**Bear case 24-month outcome:** $0.03 token price (3x from launch), $30M FDV, 68M tokens burned (6.8% of supply).

### 10.3 Base Case

*Moderate adoption tracking overall AI agent market growth.*

| Month | Mints (cum.) | Burns (cum.) | Staked | Price | FDV |
|---|---|---|---|---|---|
| 3 | 10,000 | 12,500,000 | 25,000,000 | $0.015 | $15M |
| 6 | 30,000 | 32,000,000 | 68,000,000 | $0.025 | $25M |
| 12 | 75,000 | 95,000,000 | 165,000,000 | $0.040 | $40M |
| 18 | 155,000 | 158,000,000 | 220,000,000 | $0.065 | $65M |
| 24 | 255,000 | 228,000,000 | 262,000,000 | $0.100 | $100M |

**Base case 24-month outcome:** $0.10 token price (10x from launch), $100M FDV, 228M tokens burned (22.8%).

### 10.4 Bull Case

*Strong AI agent adoption cycle + crypto bull market. Major integrations.*

| Month | Mints (cum.) | Burns (cum.) | Staked | Price | FDV |
|---|---|---|---|---|---|
| 3 | 25,000 | 25,000,000 | 50,000,000 | $0.030 | $30M |
| 6 | 80,000 | 75,000,000 | 140,000,000 | $0.060 | $60M |
| 12 | 200,000 | 200,000,000 | 300,000,000 | $0.120 | $120M |
| 18 | 400,000 | 350,000,000 | 400,000,000 | $0.250 | $250M |
| 24 | 700,000 | 500,000,000 | 450,000,000 | $0.500 | $500M |

**Bull case 24-month outcome:** $0.50 token price (50x from launch), $500M FDV, 500M tokens burned (50% of supply).

*Note: Bull case requires governance fee reductions to keep minting accessible as price rises, which moderates per-unit burn but is offset by volume.*

### 10.5 Scenario Comparison

| Metric | Bear | Base | Bull |
|---|---|---|---|
| 24-mo Price | $0.03 | $0.10 | $0.50 |
| 24-mo FDV | $30M | $100M | $500M |
| Tokens Burned | 68M (6.8%) | 228M (22.8%) | 500M (50%) |
| Total Mints | 65,000 | 255,000 | 700,000 |
| Monthly Revenue (Mo 24) | $45K | $400K | $2.5M |
| Staking APY (Mo 24) | 8.5% | 18.3% | 12.1% |

---

## 11. Comparable Protocols

### 11.1 Market Context

AgentDNA operates at the intersection of **identity/reputation** and **AI infrastructure**. There is no direct comparable, but adjacent protocols provide market-cap reference points.

### 11.2 Comparison Table

| Protocol | Category | FDV (Peak) | FDV (Current*) | Tokens Burned | Key Difference |
|---|---|---|---|---|---|
| **Worldcoin (WLD)** | Human identity | $40B | $3.5B | 0% | Human-only, iris scan, inflationary |
| **ENS** | Naming/identity | $4B | $800M | 0% | Human domains, no agent support |
| **Galxe (GAL)** | Credential/reputation | $1.5B | $250M | Minimal | Credential aggregation, not agent-native |
| **Lens Protocol** | Social identity | $500M | $150M | 0% | Social graph, human-centric |
| **AgentDNA ($DNA)** | AI agent identity | — | $10M (launch) | 22.8% (Y2) | Agent-native, deflationary, real yield |

*\*Approximate values at time of writing.*

### 11.3 Valuation Framework

**If AgentDNA captures:**

| Market Share Analogy | Implied FDV | $DNA Price |
|---|---|---|
| 1% of Worldcoin's peak FDV | $400M | $0.40 |
| 50% of ENS current FDV | $400M | $0.40 |
| 2x Galxe current FDV | $500M | $0.50 |
| Equal to Lens peak | $500M | $0.50 |

**Key differentiators justifying premium:**

1. **Deflationary supply** — Unlike WLD (inflationary) or ENS (neutral), $DNA supply decreases
2. **Agent-native** — Purpose-built for AI agents, not retrofitted from human identity
3. **Real yield** — Staking backed by actual revenue, not emissions
4. **Network effects** — Identity protocols have strong winner-take-most dynamics
5. **TAM growth** — AI agent market growing faster than human identity market

### 11.4 Realistic Positioning

At **$100M FDV (base case, Month 24)**, AgentDNA would be:

- 2.9% of Worldcoin's current FDV
- 12.5% of ENS's current FDV
- 40% of Galxe's current FDV

These multiples are conservative given the projected growth of the AI agent market.

---

## 12. Revenue Model

### 12.1 Revenue Streams

#### Primary: Protocol Fees

| Fee Type | Year 1 Est. | Year 2 Est. |
|---|---|---|
| Mint fees (ETH) | $600,000 | $1,200,000 |
| Evolution fees (ETH) | $350,000 | $800,000 |
| Trait upgrade fees (ETH) | $120,000 | $350,000 |
| Attestation fees (ETH) | $50,000 | $150,000 |
| **Subtotal** | **$1,120,000** | **$2,500,000** |

#### Secondary: Premium Features

| Feature | Year 1 Est. | Year 2 Est. |
|---|---|---|
| Premium agent profiles | $100,000 | $400,000 |
| Advanced analytics dashboard | $50,000 | $200,000 |
| Priority attestation processing | $30,000 | $100,000 |
| **Subtotal** | **$180,000** | **$700,000** |

#### Tertiary: SDK & Integration Licensing

| Channel | Year 1 Est. | Year 2 Est. |
|---|---|---|
| SDK licensing (enterprise) | $200,000 | $800,000 |
| API access tiers | $80,000 | $300,000 |
| White-label solutions | $0 | $500,000 |
| **Subtotal** | **$280,000** | **$1,600,000** |

### 12.2 Total Revenue Projection

| Year | Protocol Fees | Premium | SDK/Licensing | Total |
|---|---|---|---|---|
| Year 1 | $1,120,000 | $180,000 | $280,000 | $1,580,000 |
| Year 2 | $2,500,000 | $700,000 | $1,600,000 | $4,800,000 |

### 12.3 Revenue Distribution

| Destination | % of Revenue |
|---|---|
| Staking rewards | 55% |
| Treasury | 25% |
| Development fund | 15% |
| Insurance fund | 5% |

---

## 13. Risk Analysis & Circuit Breakers

### 13.1 Risk Matrix

| Risk | Severity | Probability | Mitigation |
|---|---|---|---|
| Low adoption / no product-market fit | Critical | Medium | Lean launch, iterate fast, fee adjustment |
| Death spiral (price drops → fewer mints → less burn) | High | Low-Medium | Circuit breakers (see 13.2) |
| Smart contract exploit | Critical | Low | Audits (3x), bug bounty, insurance fund |
| Regulatory classification as security | High | Medium | Utility-first design, legal counsel, no profit promises |
| Competitor launches similar protocol | Medium | Medium | First-mover advantage, network effects, ecosystem lock-in |
| ETH/Base network issues | Medium | Low | Multi-chain expansion roadmap |
| Governance capture | High | Low | Quadratic voting, timelock, proposal deposit |
| Over-concentration of token supply | Medium | Medium | Vesting schedules, max wallet governance |

### 13.2 Circuit Breakers

#### Death Spiral Protection

**Problem:** If $DNA price drops significantly, mint fees in dollar terms become very cheap, which could accelerate minting for speculation rather than utility, or conversely, low price could signal low interest and further reduce demand.

**Circuit Breaker 1: Dynamic Burn Floor**

```
If 30-day TWAP drops >50% from 90-day TWAP:
  → Mint burn increases by 25% (more tokens burned per mint)
  → Evolution burn rate increases from 20% to 30%
  → Activates automatically, no governance vote required
  → Reverts when 30-day TWAP recovers to within 20% of 90-day TWAP
```

**Circuit Breaker 2: Fee Caps (Anti-Spike)**

```
If $DNA price increases >500% in 30 days:
  → Governance can fast-track fee reduction (24-hour timelock instead of 72)
  → Prevents minting from becoming prohibitively expensive
  → Ensures continued accessibility
```

**Circuit Breaker 3: Emergency Governance**

```
If critical vulnerability discovered:
  → 3-of-5 multisig can pause minting/staking for 72 hours
  → Full governance vote required to extend pause
  → Multisig cannot modify token supply or seize funds
  → All pauses are onchain and publicly visible
```

**Circuit Breaker 4: Staking Release Valve**

```
If staking APY drops below 2% for 60 consecutive days:
  → Minimum lock periods reduced by 50%
  → Allows stakers to exit without penalty
  → Prevents forced holding in non-productive positions
```

### 13.3 Insurance Fund

5% of all protocol revenue is directed to an insurance fund that covers:

- Smart contract exploit losses (up to fund balance)
- Oracle failure compensation
- Emergency liquidity provision

The fund is managed by a 4-of-7 multisig with 48-hour timelock.

---

## 14. Governance Framework

### 14.1 Governance Overview

$DNA holders govern the AgentDNA protocol through onchain voting. Governance controls fee parameters, treasury allocation, protocol upgrades, and ecosystem grants.

### 14.2 Voting Power

```
Voting Power = $DNA Staked × Lock Multiplier

Lock Multipliers:
  1 month lock  → 1.0x
  3 month lock  → 1.5x
  6 month lock  → 2.0x
  12 month lock → 3.0x
```

### 14.3 Proposal Thresholds

| Action | Threshold | Quorum | Timelock |
|---|---|---|---|
| Parameter change (fees, rates) | 1% of staked supply to propose | 10% quorum | 72 hours |
| Treasury spend (<$100K) | 1% to propose | 15% quorum | 72 hours |
| Treasury spend (>$100K) | 2% to propose | 25% quorum | 7 days |
| Protocol upgrade | 3% to propose | 30% quorum | 14 days |
| Emergency action | 5% to propose | 40% quorum | 24 hours |
| Constitutional change | 5% to propose | 50% quorum | 30 days |

### 14.4 Governance Scope

**Can be changed by governance:**
- Fee rates (within floor/ceiling bounds)
- Burn rate percentages (within bounds)
- Staking lock periods
- Treasury allocations
- Protocol integrations
- Evolution tier requirements

**Cannot be changed by governance (immutable):**
- Total supply cap (1B, no minting)
- Burn mechanism existence (burns can be adjusted, not removed)
- Insurance fund minimum allocation (5%)
- Multisig emergency powers (can only pause, never seize)

### 14.5 Proposal Lifecycle

```
Draft → Deposit 5,000 $DNA → 7-day discussion → 5-day voting
→ If passed: Timelock → Execution
→ If failed: Deposit burned
```

### 14.6 Delegation

$DNA holders can delegate voting power to other addresses without transferring tokens. Delegation is revocable at any time and does not affect staking rewards.

---

## 15. Conclusion & Call to Action

### The Thesis

The AI agent economy is the next internet-scale platform shift. Billions of autonomous agents will transact, collaborate, and compete. They will need identity. They will need reputation. They will need it onchain, portable, and composable.

AgentDNA is that layer.

### The $DNA Opportunity

$DNA is not a speculative token with inflationary yield farming and no utility. It is a **structurally deflationary asset** embedded in every protocol action:

- **Every mint** permanently destroys $DNA
- **Every evolution** locks $DNA for months
- **Every reputation attestation** burns $DNA
- **Every governance vote** requires locked $DNA

There is no idle state. The protocol either burns your tokens or puts them to work.

With 228M tokens (22.8%) projected to be burned by Month 24, real-yield staking from actual protocol revenue, and four compounding reflexive loops driving demand, $DNA is designed to capture value as the AI agent economy scales.

### By the Numbers

| Metric | Value |
|---|---|
| Fixed Supply | 1,000,000,000 $DNA |
| Inflation | 0% — forever |
| Burn Mechanisms | 5 simultaneous |
| 24-Month Burn Target | 228,000,000 (22.8%) |
| Base Case FDV (Year 2) | $100,000,000 |
| Staking Yield Source | 100% real protocol revenue |
| Reflexive Loops | 4 compounding |

### Get Involved

- **Builders:** Integrate AgentDNA into your agent framework. Give your agents portable identity.
- **Protocols:** Query AgentDNA for trust scores. Gate access by reputation tier.
- **Stakers:** Lock $DNA and earn real yield from protocol fees.
- **Governors:** Shape the protocol. Every vote matters when the supply is shrinking.

The agents are coming. They'll need Helixa.

---

## Appendix A: Contract Addresses

| Contract | Address | Network |
|---|---|---|
| HelixaV2 (unified) | `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` | Base mainnet |
| ERC-8004 Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Base mainnet |
| Deployer | `0x97cf081780D71F2189889ce86941cF1837997873` | Base mainnet |
| Treasury | `0x01b686e547F4feA03BfC9711B7B5306375735d2a` | Base mainnet |
| V1 AgentDNA (deprecated) | `0x665971e7bf8ec90c3066162c5b396604b3cd7711` | Base mainnet |
| V1 AgentNames (deprecated) | `0xDE8c422D2076CbAE0cA8f5dA9027A03D48928F2d` | Base mainnet |

## Appendix B: Audit Reports

*Three independent audits scheduled pre-launch. Reports will be published in full.*

## Appendix C: Glossary

| Term | Definition |
|---|---|
| AgentDNA NFT | ERC-8004 token representing an AI agent's onchain identity |
| $DNA | ERC-20 protocol token with fixed 1B supply |
| Evolution | Process of upgrading an agent's tier by staking $DNA |
| Trait | Structured metadata attribute on an AgentDNA NFT |
| Attestation | Third-party verification of an agent's actions/reputation |
| Burn | Permanent token destruction (sent to dead address) |
| Real Yield | Staking returns funded by protocol revenue, not inflation |
| Free Float | Tokens that are circulating and not staked, locked, or burned |
| TWAP | Time-Weighted Average Price |
| Circuit Breaker | Automatic mechanism that activates during extreme conditions |

---

*This document is for informational purposes only and does not constitute financial advice, a solicitation to purchase, or an offer to sell any tokens. $DNA tokens are utility tokens designed for use within the AgentDNA protocol. Prospective participants should conduct their own research and consult legal and financial advisors. Token prices and projections are estimates based on models and are not guaranteed.*

**© 2026 Helixa · AgentDNA Protocol. All rights reserved.**
