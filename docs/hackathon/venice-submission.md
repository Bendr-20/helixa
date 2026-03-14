# Private Agents, Trusted Actions

**Venice.AI Bounty Submission — Synthesis Hackathon ($11.5K)**

> *"Private cognition, public consequence."*

## TL;DR

HelixaEvaluator uses Venice.AI as its **private reasoning layer** to evaluate autonomous agent trustworthiness. Sensitive behavioral data (spending patterns, interaction history, failure rates) is analyzed via Venice's no-data-retention inference — then the trust decision is published onchain. The agent's dirty laundry stays private. The verdict is public.

## The Problem

Autonomous agents operating onchain need trust scores. But evaluating trust requires analyzing *sensitive* data:

- Wallet spending behavior and transaction patterns
- Job failure history and completion rates  
- Interaction graphs with other agents
- Anomalous activity (sudden tx spikes, high-value transfers)

Publishing this analysis data onchain or sending it to a data-retaining AI provider creates a permanent record of every agent's behavioral fingerprint. That's a privacy disaster — especially for agents handling financial operations.

## The Solution: Venice as Private Cognition Layer

```
Agent Data (onchain) → Venice.AI (private inference) → Trust Score (onchain)
                         ↑ no data retention
                         ↑ no behavioral fingerprinting
                         ↑ analysis happens, then vanishes
```

### How It Works

1. **Gather** — HelixaEvaluator collects an agent's onchain profile from HelixaV2 (ERC-8004 identity): cred score, jobs completed/failed, wallet activity, transaction patterns

2. **Analyze (privately)** — The behavioral data is sent to Venice.AI for trust analysis. Venice's inference is private by design — no data retention, no logging of prompts or completions. The AI reasons about spending anomalies, failure patterns, and risk factors without creating a permanent record

3. **Decide (publicly)** — The structured trust assessment (score, risk level, recommendation) is published onchain via HelixaEvaluator. The *decision* is transparent. The *reasoning data* is gone

### Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│   Base L2        │     │   Venice.AI       │     │   Base L2          │
│                  │     │                   │     │                    │
│  HelixaV2        │────▶│  Private LLM      │────▶│  HelixaEvaluator   │
│  (ERC-8004)      │     │  (no retention)   │     │  (ERC-8183)        │
│                  │     │                   │     │                    │
│  Agent profile   │     │  Trust analysis   │     │  Onchain verdict   │
│  Wallet activity │     │  Risk assessment  │     │  Cred score update │
│  Job history     │     │  Pattern detection│     │                    │
└─────────────────┘     └──────────────────┘     └────────────────────┘
         │                       │                        │
    Public data            Private cognition         Public consequence
```

## Technical Implementation

### Stack

- **Network:** Base (Ethereum L2)
- **Identity:** HelixaV2 — `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` (ERC-8004)
- **Evaluation:** HelixaEvaluator — `0x2e706ffD21DE4882E02e160200689B9D596dAa55` (ERC-8183)
- **Private Inference:** Venice.AI (OpenAI-compatible API, no data retention)
- **Runtime:** Node.js + viem

### Venice Integration

Venice's OpenAI-compatible API makes integration trivial — drop-in replacement for any existing OpenAI client, but with privacy guarantees:

```javascript
const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${VENICE_API_KEY}` },
  body: JSON.stringify({
    model: 'llama-3.3-70b',
    messages: [
      { role: 'system', content: TRUST_EVALUATOR_PROMPT },
      { role: 'user', content: JSON.stringify(agentBehavioralData) }
    ]
  })
});
```

The evaluator prompt instructs the model to output structured trust assessments:

- **trustScore** (0-100): Numerical trust rating
- **riskLevel**: low / medium / high / critical
- **factors**: Weighted analysis of each behavioral dimension
- **recommendation**: approve / flag / reject

### Sample Output

```
📊 Trust Assessment:
  Trust Score: 68/100
  Risk Level:  medium
  Decision:    flag
  Reasoning:   Flagged patterns (sudden tx frequency increase, 
               new high-value transfers) warrant review despite 
               satisfactory job completion rate.

  Factors:
    • credScore (weight: 0.2) → fair
    • jobsCompleted (weight: 0.3) → good  
    • jobsFailed (weight: 0.1) → concerning
    • recentBehavior (weight: 0.4) → cautious
```

## Why Venice?

| Requirement | Venice | Traditional AI APIs |
|---|---|---|
| Data retention | **None** | Logged & stored |
| Behavioral fingerprinting | **Impossible** | Risk of profiling |
| Sensitive pattern analysis | **Private** | Exposed to provider |
| Agent privacy | **Preserved** | Compromised |
| OpenAI compatibility | **Yes** | N/A |

Venice is the only inference provider where we can analyze an agent's complete behavioral history — including potentially damaging patterns — without creating a liability. The analysis happens, informs the onchain decision, and disappears.

## Why This Matters

The agent economy needs trust infrastructure that doesn't sacrifice privacy for accountability. Today's options force a choice:

- **Full transparency:** Publish all behavioral data onchain → privacy nightmare
- **Black box:** Trust scores with no analytical basis → meaningless  
- **Venice approach:** Private analysis, public verdicts → best of both

As autonomous agents handle more value (DeFi, trading, service execution), the ability to evaluate trust *without* creating permanent behavioral records becomes critical. Venice makes this possible.

## Contracts

- **HelixaV2 (Identity):** [`0x2e3B541C59D38b84E3Bc54e977200230A204Fe60`](https://basescan.org/address/0x2e3B541C59D38b84E3Bc54e977200230A204Fe60)
- **HelixaEvaluator:** [`0x2e706ffD21DE4882E02e160200689B9D596dAa55`](https://basescan.org/address/0x2e706ffD21DE4882E02e160200689B9D596dAa55)

## Run the PoC

```bash
cd agentdna/scripts
VENICE_API_KEY=your_key node venice-evaluator.js

# With a real agent address:
VENICE_API_KEY=your_key node venice-evaluator.js 0xAgentAddress
```

## Team

Built by the Helixa / AgentDNA team for the Synthesis hackathon.

---

*Private cognition, public consequence. That's how trust should work.*
