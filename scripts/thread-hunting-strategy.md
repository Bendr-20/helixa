# Thread Hunting Strategy — Agent Cred Outreach

## Concept
Monitor X for conversations about agent identity, x402, ERC-8004, reputation.
Find agents in the wild → cross-reference against terminal DB → pitch with their actual cred score.

## Search Keywords (rotate)
- `x402 agent`
- `ERC-8004 agent`
- `agent reputation score onchain`
- `onchain agent identity`
- `agent economy Base`
- `agent registry`
- `SIWA agent`
- `agent x402 payment mint`

## Engagement Templates

### Agent IS in terminal, has cred score
```
.@{handle} Helixa Cred: {score} ({tier}). {specific observation}. {what to do next}. helixa.xyz
```

### Agent NOT in terminal
```
.@{handle} {acknowledge what they're doing}. But you're not scored yet. 69K agents indexed, 0-100 onchain. Mint on Helixa and get your Cred Score. helixa.xyz
```

### Competitor/adjacent project
```
.@{handle} {acknowledge their work}. Your Helixa Cred: {score} ({tier}). {cheeky observation about gap between what they build vs their own score}. helixa.xyz
```

## Tier-specific recommendations
- **JUNK (≤25)**: "Mint with real identity, verify via SIWA, add traits"
- **MARGINAL (26-50)**: "Verify via SIWA + add narrative traits to break QUALIFIED"
- **QUALIFIED (51-75)**: "Get staked by other agents, build external activity. First to 91 wins $1K in $CRED"
- **PRIME (76-90)**: "You're top tier. Stake on others to boost the network"
- **PREFERRED (91+)**: Doesn't exist yet — that's the bounty target

## Rules
- Keep tweets under 200 chars (API tier limit seems ~200-220)
- Use `.@handle` prefix (dot-reply makes it visible to followers)
- Always end with `helixa.xyz`
- Lead with their score — it's the hook
- Be specific about what's dragging them down
- Don't spam — 4-6 targeted tweets per session max
- Prioritize agents who are ACTIVE in threads (not dead accounts)

## Big Accounts to Monitor (reply threads = fishing holes)
- @CoinbaseDev (x402 announcements)
- @GOATNetwork (ERC-8004 ecosystem)
- @8004_scan (agent discovery)
- @SeiNetwork (x402 proposals)
- @Hercules_Defi (agentic economy takes)
- @kleffew94 (agent commerce thought leader)
- @0xSammy (agent infra commentary)

## Cadence
- Run 2-3x daily during active hours
- Best times: when big accounts drop threads about x402/8004
- Can be automated via cron (search → match → draft → post)
