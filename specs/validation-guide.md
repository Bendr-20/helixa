# Validation Interview Guide

## Target Personas (in priority order)

1. **AI agent developers** — building agents for production use (not hobbyists)
2. **Multi-agent system builders** — orchestrating 3+ agents together
3. **AI platform operators** — running marketplaces or directories of agents
4. **Enterprise AI teams** — deploying agents in regulated/high-stakes environments

## Where to Find Them (free)

- **Twitter/X:** Search "built an AI agent", "multi-agent system", "AI agent framework"
- **Discord:** LangChain, AutoGPT, CrewAI, Eliza, AI Agent communities
- **GitHub:** Contributors to agent frameworks with real deployments
- **Reddit:** r/LocalLLaMA, r/LangChain, r/ChatGPTCoding
- **HackerNews:** "Show HN" posts about AI agents

## Screening (qualify before full interview)

Quick DM: "Hey — we're researching how AI agent developers handle identity and trust when deploying agents. Would you be open to a 15-min call? No pitch, just learning."

**Qualify if they:**
- Have deployed at least 1 agent to production
- Have dealt with multi-agent coordination
- Have paying users or enterprise clients

**Disqualify if they:**
- Only built toy/demo agents
- Pure researchers (no production experience)
- Haven't thought about trust/identity at all (too early)

## Interview Script (~15 minutes)

### Warm-up (2 min)
- "What are you building? Tell me about your agents."
- "How many agents in production? How do they interact?"

### Pain Discovery (5 min)
- "When your agents interact with other agents or services, how do they prove who they are?"
- "Have you ever had a situation where you couldn't verify an agent's identity or capabilities?"
- "What's the worst thing that's happened because of lack of trust/identity for agents?"
- "How do you currently solve this?" (CRITICAL — existing workarounds = real pain)

### Solution Reaction (3 min)
- "Imagine every AI agent had a verifiable onchain identity — an NFT with metadata about its capabilities, creator, and track record. How would that change your workflow?"
- "Would you use a reputation score for agents you're considering integrating with?"
- Don't pitch — describe the concept neutrally and watch their reaction.

### Willingness to Pay (3 min)
- "If this existed today, would you register your agents?"
- "What would you pay for this? $10? $25? $100?" (anchor at $25)
- "Would you pay more for a 'verified' badge that proves your agent's provenance?"
- "Would you pay for API access to check other agents' reputation scores?"

### Close (2 min)
- "What would make this a no-brainer for you?"
- "What would make you NOT use this?"
- "Would you want early access to test this?"
- "Who else should I talk to?" (referrals = gold)

## What to Listen For

### 🟢 Strong Signals (validate)
- "I've been looking for something like this"
- "We built an internal version of this"
- Describes specific incidents where lack of identity caused problems
- Asks when they can use it
- Offers to pay or pilot

### 🟡 Moderate Signals (interesting but not enough)
- "That makes sense" (intellectual agreement ≠ urgency)
- "I could see using that eventually"
- No existing workaround (pain might not be acute)

### 🔴 Kill Signals (invalidate)
- "We don't really need that"
- "API keys are fine for us"
- "We only use our own agents" (no multi-agent need)
- "Interesting but I wouldn't pay for it"
- Consistent pattern of "nice to have"

## Tracking Template

| # | Name | Company | Agents in Prod | Pain Level (1-5) | Would Pay? | Price Point | Early Access? | Referrals |
|---|------|---------|---------------|-------------------|------------|-------------|---------------|-----------|
| 1 | | | | | | | | |

## Go/No-Go Criteria (after 10+ interviews)

**GO if:**
- 7+ rate pain at 4-5
- 5+ would pay $25+
- 3+ want early access
- 0 fatal objections

**PIVOT if:**
- Pain is real but pricing wrong → adjust model
- Pain is in different area → pivot to where pain is
- Enterprise only cares → pivot to enterprise-first

**KILL if:**
- <3 rate pain at 4-5
- <2 would pay anything
- Consistent "nice to have" responses
- Better existing solutions we missed
