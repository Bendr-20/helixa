# Protocol Labs — "Let the Agent Cook" Bounty Submission ($8K)

## Synthesis Hackathon | Helixa Evaluator

---

### What We Built

**HelixaEvaluator** is an autonomous onchain trust evaluator that gates job completion in the agent economy. It implements the ERC-8183 evaluator interface with three novel capabilities:

1. **Cred-based auto-complete** — Agents with proven onchain reputation can auto-complete jobs without manual approval
2. **Dynamic threshold tiers** — Higher cred scores unlock higher auto-complete thresholds, rewarding consistent performance
3. **Reputation feedback loops** — Every job evaluation updates the agent's onchain reputation score, creating a flywheel of trust

### How It Qualifies

| Bounty Requirement | How HelixaEvaluator Meets It |
|---|---|
| **Agent acts autonomously** | Evaluates job completions and updates reputation without human intervention — pure onchain logic |
| **Machine-readable manifest** | `agent.json` declares capabilities, tools, identity, and constraints per spec |
| **Execution log** | `agent_log.json` documents the full discovery → planning → execution → verification flow |
| **Onchain identity** | ERC-8004 identity token (contract `0x2e3B...Fe60`, token #1) bound to the evaluator |
| **Deployed & verified** | Live on Base mainnet at [`0x2e706ffD21DE4882E02e160200689B9D596dAa55`](https://basescan.org/address/0x2e706ffD21DE4882E02e160200689B9D596dAa55), verified on Sourcify |
| **Tests passing** | 30/30 Foundry tests |

### The Agent's Decision Flow

```
Discovery  → "Trust-gated job completion is missing from the agent economy"
Planning   → "ERC-8183 evaluator + cred oracle + tiered thresholds + reputation feedback"
Execution  → Deploy to Base mainnet, configure 3 cred tiers, verify on Sourcify
Verify     → 30/30 tests, contract verified, tiers active
```

### Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Job Marketplace │────▶│  HelixaEval  │────▶│ Cred Oracle │
│  (ERC-8183)      │     │  (Evaluator) │     │ (ERC-8004)  │
└─────────────────┘     └──────┬───────┘     └─────────────┘
                               │
                        ┌──────▼───────┐
                        │  Reputation  │
                        │  Feedback    │
                        └──────────────┘
```

### Key Addresses

| Asset | Address |
|---|---|
| Operator Wallet | `0x339559A2d1CD15059365FC7bD36b3047BbA480E0` |
| HelixaEvaluator | `0x2e706ffD21DE4882E02e160200689B9D596dAa55` |
| ERC-8004 Identity | `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` (Token #1) |

### Files

- [`agent.json`](./agent.json) — Machine-readable capability manifest
- [`agent_log.json`](./agent_log.json) — Structured autonomous execution log
- [Broadcast file](../../broadcast/DeployEvaluatorMainnet.s.sol/8453/run-latest.json) — Raw deployment receipts

### Tech Stack

Solidity · ERC-8183 · ERC-8004 · Base L2 · Foundry

---

*Submitted March 13, 2026*
