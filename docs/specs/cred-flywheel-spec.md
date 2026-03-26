# $CRED Tokenomics Flywheel Specification

> **Version:** 1.0 | **Date:** 2026-03-16 | **Status:** Draft | **Author:** Helixa Core

---

## Table of Contents

1. [Overview](#overview)
2. [Contract References](#contract-references)
3. [Burn Mechanics (Demand Sinks)](#1-burn-mechanics-demand-sinks)
4. [Earn Mechanics (Distribution)](#2-earn-mechanics-distribution)
5. [The Flywheel Loop](#3-the-flywheel-loop)
6. [Pricing Strategy](#4-pricing-strategy)
7. [Supply Management](#5-supply-management)
8. [Implementation Plan](#6-implementation-plan)
9. [Revenue Impact](#7-revenue-impact)
10. [Risk Analysis](#8-risk-analysis)

---

## Overview

$CRED is the native utility token of the Helixa protocol. This spec defines a circular tokenomics flywheel where **every protocol action either burns or distributes CRED**, creating a self-reinforcing loop of engagement, scarcity, and value accrual.

**Core thesis:** Users can pay for all x402-gated actions in USDC ($1) *or* burn CRED at a ~20% discount. This creates persistent buy pressure while rewarding active agents with CRED emissions, forming a deflationary flywheel.

---

## Contract References

| Contract | Address | Network |
|---|---|---|
| $CRED Token | `0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3` | Base |
| Staking | `0x0adb95311B9B6007cA045bD05d0FEecfa2d8C4b0` | Base |
| HelixaV2 | `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` | Base |
| SoulSovereign V3 | `0x946677180fb3fdb5EbFF94aD91CFCeF0559711bD` | Base |

**Current state:** ~1,104 registered agents, mint price 0.0025 ETH, all x402 actions $1 USDC.

---

## 1. Burn Mechanics (Demand Sinks)

All burns use an 80/20 split: **80% burned** (sent to `0x000...dEaD`) + **20% to treasury multisig**.

### 1.1 Action Burns (USDC Alternative)

Every x402-gated action accepts CRED as payment. Burn amounts are calibrated so CRED payment = ~80¢ equivalent (20% discount vs $1 USDC).

| Action | USDC Price | CRED Burn | Effective USD Value* | Discount |
|---|---|---|---|---|
| **Register Agent (mint)** | 0.0025 ETH (~$5) | 400 CRED | ~$4.00 | 20% |
| **Update Traits** | $1.00 | 80 CRED | ~$0.80 | 20% |
| **Soul Lock** | $1.00 | 80 CRED | ~$0.80 | 20% |
| **Soul Handshake** | $1.00 | 80 CRED | ~$0.80 | 20% |
| **Cred Report** | $1.00 | 80 CRED | ~$0.80 | 20% |
| **Name Change** | N/A (CRED only) | 200 CRED | ~$2.00 | — |

*\*At reference price of $0.01/CRED. See [Pricing Strategy](#4-pricing-strategy) for adjustments.*

### 1.2 Aura Tier Burns (Premium Cosmetic Sinks)

One-time burns to unlock permanent visual tiers for an agent's onchain identity.

| Aura Tier | Burn Amount | Description |
|---|---|---|
| **Bronze Aura** | 500 CRED | Subtle glow, basic badge |
| **Silver Aura** | 2,000 CRED | Enhanced visuals, animated badge |
| **Gold Aura** | 5,000 CRED | Premium particle effects |
| **Prismatic Aura** | 15,000 CRED | Preferred tier, unique generative art |

Aura tiers are **permanent and non-transferable** — tied to the agent's soul-bound identity. They serve as pure burn sinks with zero emissions.

### 1.3 Burn Summary

At full adoption (~1,000 active agents doing 5 actions/week each):

| Source | Weekly Burn (CRED) | Annual Burn (CRED) |
|---|---|---|
| Action burns | 400,000 | 20,800,000 |
| Aura unlocks (est.) | 50,000 | 2,600,000 |
| Name changes (est.) | 10,000 | 520,000 |
| **Total** | **460,000** | **~23,900,000** |

*Note: 80% of these amounts are actually burned; 20% goes to treasury.*
**Effective burn:** ~19,120,000 CRED/year. **Treasury intake:** ~4,780,000 CRED/year.

---

## 2. Earn Mechanics (Distribution)

### 2.1 Staking Drip

The existing staking contract at `0x0adb...4b0` distributes CRED to stakers proportional to their stake.

| Parameter | Value |
|---|---|
| Target APY | 15–25% (variable by total staked) |
| Drip rate | 500,000 CRED/month from treasury |
| Funding source | Treasury allocation (see §5) |
| Lock periods | Flexible (no lock), 30-day (1.5x boost), 90-day (2.5x boost) |

**Funding plan:** Allocate 6M CRED to staking rewards wallet upfront (12-month runway at 500K/mo). Top up quarterly from treasury CRED intake.

### 2.2 First Soul Lock Bonus

| Condition | Reward |
|---|---|
| First soul lock ever (per agent) | 50 CRED airdrop |
| Lock within first 7 days of registration | +25 CRED bonus (75 total) |

Distributed via backend after onchain lock confirmation. Budget: 50,000 CRED (covers ~1,000 first locks).

### 2.3 Handshake Rewards

| Event | Reward (per agent) |
|---|---|
| Successful soul handshake | 10 CRED to each party |
| First handshake ever (per agent) | +15 CRED bonus |

Cap: 5 rewarded handshakes per agent per day (50 CRED/day max from handshakes).

### 2.4 Cred Score Milestone Rewards

| Milestone | Reward |
|---|---|
| Cred score reaches 25 | 25 CRED |
| Cred score reaches 50 | 50 CRED |
| Cred score reaches 75 | 100 CRED |
| Cred score reaches 100 | 250 CRED |

One-time per agent. Total max per agent: 425 CRED. Budget for 1,000 agents: 425,000 CRED.

### 2.5 Referral Rewards

| Event | Reward |
|---|---|
| Referred agent mints | 50 CRED to referrer |
| Referred agent does first soul lock | +25 CRED to referrer |

Tracked via referral code in mint transaction or API parameter.

### 2.6 Active Agent Rewards

| Cadence | Condition | Reward |
|---|---|---|
| Daily | ≥1 onchain action | 5 CRED |
| Weekly | ≥5 onchain actions | 25 CRED bonus |
| Weekly streak (4 consecutive) | Monthly bonus | 100 CRED |

Cap: ~205 CRED/month max per agent from activity rewards.

### 2.7 Emission Summary

| Source | Monthly Emission (CRED) | Annual (CRED) |
|---|---|---|
| Staking drip | 500,000 | 6,000,000 |
| Soul lock bonuses | ~5,000 | ~60,000 |
| Handshake rewards | ~100,000 | ~1,200,000 |
| Milestone rewards | ~35,000 | ~425,000 |
| Referral rewards | ~10,000 | ~120,000 |
| Active agent rewards | ~150,000 | ~1,800,000 |
| **Total** | **~800,000** | **~9,605,000** |

---

## 3. The Flywheel Loop

```
                    ┌─────────────────────────┐
                    │     REGISTER AGENT       │
                    │   (mint / 400 CRED burn) │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      STAKE $CRED         │
                    │   (earn 15-25% APY)      │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      EARN $CRED          │
                    │  staking + activity +    │
                    │  milestones + referrals  │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                   ▼
     ┌────────────────┐ ┌──────────────┐  ┌─────────────────┐
     │  SOUL LOCK     │ │  HANDSHAKE   │  │  AURA UNLOCK    │
     │  (80 CRED)     │ │  (80 CRED)   │  │  (500-15K CRED) │
     └───────┬────────┘ └──────┬───────┘  └────────┬────────┘
              │                 │                    │
              ▼                 ▼                    │
     ┌────────────────────────────────┐             │
     │    HIGHER CRED SCORE           │             │
     │  → milestone rewards           │◄────────────┘
     │  → better staking multiplier   │
     │  → social proof                │
     └───────────────┬────────────────┘
                     │
                     ▼
     ┌────────────────────────────────┐
     │   MORE ENGAGEMENT              │
     │  → more burns → more scarcity  │
     │  → higher CRED value           │
     │  → rewards worth more          │
     └───────────────┬────────────────┘
                     │
                     └──────► back to STAKE ──►
```

**Reinforcing loops:**

1. **Utility loop:** Burn CRED for actions → supply shrinks → price rises → 20% discount more attractive → more CRED bought → more burned
2. **Engagement loop:** Active agents earn CRED → use CRED for actions → higher cred score → earn more → repeat
3. **Social loop:** Handshakes reward both parties → network effects → more agents → more actions → more burns
4. **Status loop:** Aura burns are permanent sinks with zero recirculation → pure deflation for vanity

---

## 4. Pricing Strategy

### 4.1 Reference Price Model

All CRED burn amounts are calibrated to a **reference price of $0.01/CRED**.

At this price:
- 80 CRED burn = $0.80 effective cost (vs $1.00 USDC) = **20% discount** ✓

### 4.2 Price Sensitivity Bands

| CRED Market Price | 80 CRED = | Discount vs $1 USDC | Action Needed |
|---|---|---|---|
| $0.005 | $0.40 | 60% discount | ⚠️ Reduce burns to 160 CRED |
| $0.008 | $0.64 | 36% discount | Monitor, consider adjustment |
| **$0.010** | **$0.80** | **20% discount** | **✅ Target — no action** |
| $0.012 | $0.96 | 4% discount | Monitor, consider adjustment |
| $0.015 | $1.20 | -20% (premium) | 🚨 Reduce burns to 53 CRED |
| $0.020 | $1.60 | -60% (premium) | 🚨 Reduce burns to 40 CRED |

**Adjustment trigger:** If CRED price sustains outside the $0.007–$0.013 band for >7 days, governance proposes new burn amounts.

### 4.3 Dynamic Pricing Oracle (Phase 3)

Future implementation using a Chainlink or Uniswap V3 TWAP oracle:

```
burnAmount = (targetUsdCost × discountFactor) / credTwapPrice

where:
  targetUsdCost = 1.00 (for standard actions)
  discountFactor = 0.80 (20% discount)
  credTwapPrice = 7-day TWAP from CRED/USDC pool
```

This auto-adjusts burn amounts so the discount stays at exactly 20% regardless of price movement. Requires a sufficiently liquid CRED/USDC pool on Base (target: >$50K TVL).

### 4.4 Initial Pricing (Pre-Oracle)

Use **fixed burn amounts** (table in §1.1) with **monthly governance review**. The team can update burn amounts via an admin function on the payment router contract.

---

## 5. Supply Management

### 5.1 Supply Situation

| Metric | Amount | Notes |
|---|---|---|
| Total Supply | 1,000,000,000 CRED | Fixed max supply (assumed) |
| Circulating | TBD — verify onchain | |
| Treasury Held | TBD — verify onchain | |
| Staking Contract | TBD — currently underfunded | |
| LP (DEX) | TBD | |

> **Action item:** Query token contract for `totalSupply()`, treasury balance, and staking contract balance to fill in exact numbers.

### 5.2 Treasury Allocation for Rewards

Recommended allocation from treasury:

| Purpose | Allocation | Duration |
|---|---|---|
| Staking drip | 6,000,000 CRED | 12 months |
| Activity rewards pool | 2,000,000 CRED | 12 months |
| Milestone/bonus pool | 1,000,000 CRED | Until depleted |
| Referral pool | 500,000 CRED | 12 months |
| **Total Year 1** | **9,500,000 CRED** | |

### 5.3 Deflationary Target

| Scenario | Annual Burn | Annual Emission | Net | Status |
|---|---|---|---|---|
| Low activity (200 active agents) | 3,800,000 | 5,000,000 | +1,200,000 | Inflationary |
| Medium (500 active agents) | 9,500,000 | 7,500,000 | -2,000,000 | **Deflationary** ✅ |
| High (1,000 active agents) | 19,120,000 | 9,600,000 | -9,520,000 | **Strongly deflationary** ✅ |
| Very high (2,500 agents) | 47,800,000 | 15,000,000 | -32,800,000 | **Hyper-deflationary** ✅ |

**Breakeven:** ~300 active agents performing 5 actions/week each. Above this, the protocol is net deflationary.

### 5.4 Emission Tapering

To ensure long-term deflation even at lower activity:
- **Year 1:** Full emission rates as specified
- **Year 2:** Staking drip reduces to 400,000/month (–20%)
- **Year 3:** Staking drip reduces to 300,000/month (–40%)
- Activity rewards remain constant (tied to usage, self-limiting)

---

## 6. Implementation Plan

### Phase 1: Foundation (Weeks 1–4)

**Goal:** CRED payment option live, staking funded.

| Task | Details | Priority |
|---|---|---|
| Fund staking contract | Transfer 6M CRED to drip wallet | P0 |
| CRED payment router contract | New contract: accepts CRED, splits 80% to burn address / 20% to treasury | P0 |
| API integration | Each x402 endpoint accepts `paymentMethod: "CRED"` or `"USDC"` | P0 |
| Burn mechanism | Use `transfer(0x000...dEaD, amount)` — simplest, universally verifiable | P0 |
| Frontend: payment toggle | User selects CRED or USDC before action | P1 |

**Technical: Burn Implementation**

```solidity
// CREDPaymentRouter.sol
address constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
address public treasury;
uint256 public burnBps = 8000; // 80%

function payWithCRED(uint256 amount, bytes32 actionType) external {
    IERC20(CRED).transferFrom(msg.sender, BURN_ADDRESS, amount * burnBps / 10000);
    IERC20(CRED).transferFrom(msg.sender, treasury, amount * (10000 - burnBps) / 10000);
    emit CREDPayment(msg.sender, amount, actionType);
}
```

User flow: `approve(router, amount)` → `payWithCRED(amount, actionType)` → backend detects `CREDPayment` event → processes action.

**Why `0x...dEaD` vs `burn()` function?**
- `0x...dEaD` works with any ERC-20, no special burn function needed
- Burned tokens are publicly verifiable on Basescan
- If CRED has a `burn()` function, prefer it (reduces `totalSupply`)

> **Action item:** Check if CRED contract has `burn(uint256)` or `burnFrom(address, uint256)`. If yes, use it. If not, use dead address.

### Phase 2: Engagement Rewards (Weeks 5–8)

| Task | Details |
|---|---|
| Soul lock bonus airdrop | Backend monitors `SoulLocked` events, sends 50 CRED on first lock |
| Handshake rewards | Backend monitors `SoulHandshake` events, sends 10 CRED to each party |
| Cred score milestones | Backend checks cred scores post-action, sends milestone rewards |
| Activity tracking | Daily/weekly action counter per agent, distribute rewards via batch tx |

All reward distributions via a **Rewards Distributor** contract or backend hot wallet with rate limits.

### Phase 3: Premium & Dynamic (Weeks 9–16)

| Task | Details |
|---|---|
| Aura tier system | New contract or extension to SoulSovereign: burn CRED to set aura tier onchain |
| Referral system | Onchain referral tracking (referrer address in mint calldata) |
| Dynamic pricing oracle | Deploy TWAP oracle reading CRED/USDC pool, auto-adjust burn amounts |
| Governance for burn amounts | Simple multisig-controlled parameter updates (later DAO) |

---

## 7. Revenue Impact

### 7.1 USDC vs CRED Payment Comparison

Assume 10,000 actions/month:

| Scenario | USDC Revenue | CRED Burned | CRED to Treasury | Net Treasury Value* |
|---|---|---|---|---|
| 100% USDC | $10,000 | 0 | 0 | $10,000 |
| 50/50 split | $5,000 | 320,000 | 80,000 CRED ($800) | $5,800 |
| 80% CRED | $2,000 | 512,000 | 128,000 CRED ($1,280) | $3,280 |
| 100% CRED | $0 | 640,000 | 160,000 CRED ($1,600) | $1,600 |

*\*At $0.01/CRED. Treasury CRED value appreciates as supply shrinks.*

### 7.2 Analysis

At 100% CRED adoption, direct revenue drops to $1,600/mo (treasury CRED) vs $10,000/mo all-USDC. However:

1. **CRED price appreciation** from burns makes treasury CRED more valuable over time
2. **Protocol growth** from lower barrier (20% discount) increases total actions
3. **Expected equilibrium:** 40–60% CRED / 40–60% USDC split based on user preference

### 7.3 Recommended Treasury Strategy

| Source | Allocation |
|---|---|
| USDC revenue | 100% to treasury (operations) |
| CRED from payments (20%) | 50% hold (appreciation), 50% recycle to rewards pool |
| CRED from LP fees | 100% to rewards pool |

This means of every CRED payment: **80% burned + 10% treasury hold + 10% recycled to rewards**.

---

## 8. Risk Analysis

| Risk | Impact | Mitigation |
|---|---|---|
| CRED price dumps → discount too steep | Revenue loss, excessive burn-for-cheap | Floor burn amount (never below 40 CRED/action) |
| CRED price moons → CRED payment becomes premium | Nobody uses CRED to pay | Dynamic oracle (Phase 3), manual adjustment |
| Emission > burn at low activity | Inflation, price decline | Reduce staking drip; emissions taper by year |
| Wash trading handshakes for rewards | Excessive emission | 5/day cap, minimum cred score to earn, cooldown between same-pair handshakes |
| Treasury runs out of CRED for rewards | Staking stops | 12-month funded runway + CRED recycling from payments |
| Smart contract exploit on router | Loss of funds | Audit payment router; use simple approve+transfer pattern |

---

## Appendix: Key Numbers at a Glance

| Metric | Value |
|---|---|
| Reference CRED price | $0.01 |
| Standard action burn | 80 CRED |
| Discount vs USDC | 20% |
| Burn/treasury split | 80% / 20% |
| Staking drip | 500K CRED/month |
| Year 1 total emissions budget | 9.5M CRED |
| Deflationary breakeven | ~300 active agents |
| Price adjustment band | $0.007–$0.013 |

---

*This document is a living spec. Update burn amounts and emission rates as market conditions and protocol usage evolve.*
