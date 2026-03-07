# HELIXA 15-DAY SPRINT — Feb 27 → Mar 13, 2026

## PHASE 1: REVENUE NOW (Days 1-5, Feb 27 - Mar 3)

### Day 1 (Feb 27) — Staking Contract
- [ ] Design $CRED staking contract: stake to boost tier, lock periods, slash conditions
- [ ] Write + test Solidity contract (CredStaking.sol)
- [ ] Define tier thresholds: 100 $CRED = QUALIFIED, 500 = PRIME, 2000 = PREFERRED

### Day 2 (Feb 28) — Staking Deploy + API
- [ ] Deploy staking contract to Base
- [ ] Add staking endpoints to v2-server.js (stake, unstake, check stake)
- [ ] Wire staking into Cred Score calculation (staked $CRED = score boost)

### Day 3 (Mar 1) — Staking Frontend + Boosted Listings
- [ ] Build staking UI on manage page (stake/unstake/status)
- [ ] Build "Featured Agent" row at top of terminal (paid placement)
- [ ] Pricing: 500 $CRED/week for featured spot, 200 $CRED/week for highlighted row

### Day 4 (Mar 2) — Cred Score API Pricing
- [ ] Create /api/v2/cred-score endpoint (public, rate-limited free tier: 100/day)
- [ ] Paid tier: API key + $0.10/call beyond free tier (x402 or prepaid $CRED)
- [ ] Publish pricing page at helixa.xyz/pricing
- [ ] API docs update with pricing + rate limits

### Day 5 (Mar 3) — Score Decay + Real Signal
- [ ] Implement cred score decay: -2 points/week for inactive agents (no onchain tx in 7 days)
- [ ] Add onchain activity tracking: tx count, contract interactions, token transfers
- [ ] "Maintain your score" flow: agents pay $CRED or show onchain activity to prevent decay
- [ ] Deploy all Phase 1 + announce

---

## PHASE 2: DISTRIBUTION (Days 6-10, Mar 4 - Mar 8)

### Day 6 (Mar 4) — Outreach Prep
- [ ] Build pitch deck / one-pager for platform integrations
- [ ] Create embeddable Cred Score widget (iframe/JS snippet platforms can drop in)
- [ ] "Powered by Helixa" badge with live score

### Day 7 (Mar 5) — Cold Outreach Round 1
- [ ] Reach out to Virtuals team — pitch Cred Scores on their agent pages
- [ ] Reach out to DXRG — they already have 4,875 agents indexed, warm lead
- [ ] Reach out to a0x (jessexbt connection) — Farcaster DM or X
- [ ] Post embeddable widget demo on X + Farcaster

### Day 8 (Mar 6) — Base Batches + Incident Reporting
- [ ] Submit Base Batches application with revenue data + staking numbers
- [ ] Build incident reporting: POST /api/v2/agent/:id/report (flag bad agents)
- [ ] Report dashboard on terminal: flagged agents show warning badge
- [ ] Reports require SIWA or wallet signature (anti-spam)

### Day 9 (Mar 7) — Agent Comparison Tool
- [ ] Side-by-side agent comparison page (helixa.xyz/compare?a=X&b=Y)
- [ ] Cred breakdown bars, token data, activity, trust signals
- [ ] "Which agent should I trust?" framing
- [ ] Share card generation for comparisons

### Day 10 (Mar 8) — Terminal Access Tiers
- [ ] Free tier: browse, basic search, top 100 agents
- [ ] Pro tier ($CRED staked): real-time data, alerts, full API, export
- [ ] Implement wallet-gated pro features on terminal
- [ ] Deploy Phase 2 + announce

---

## PHASE 3: NARRATIVE + MOAT (Days 11-15, Mar 9 - Mar 13)

### Day 11 (Mar 9) — Performance Data
- [ ] Pull onchain PnL for trading agents (DXRG agents have this data)
- [ ] Track agent uptime via periodic endpoint pings (for service agents)
- [ ] Integrate performance metrics into Cred Score (predictive, not just descriptive)

### Day 12 (Mar 10) — State of Agent Credibility Report
- [ ] Write comprehensive report: score entire ecosystem, name top/bottom agents
- [ ] Include data: avg scores by platform, trust distribution, red flags
- [ ] Publish at helixa.xyz/report + PDF download
- [ ] Post highlights thread on X + Farcaster

### Day 13 (Mar 11) — Cross-Platform Reputation Push
- [ ] Integrate more data sources: Farcaster social graph, GitHub activity, onchain history depth
- [ ] Weight Ethos + Talent Protocol scores more heavily in Cred calc
- [ ] Build "reputation passport" view — all scores in one place

### Day 14 (Mar 12) — Agent-to-Agent Escrow (Design)
- [ ] Design escrow flow: Agent A hires Agent B, $CRED locked, released on completion
- [ ] Smart contract spec for escrow (CredEscrow.sol)
- [ ] API spec for escrow lifecycle
- [ ] This is the long-term moat — agent commerce infrastructure

### Day 15 (Mar 13) — Ship + Retrospective
- [ ] Deploy remaining features
- [ ] Revenue check: staking TVL, API calls, featured listings sold
- [ ] Retrospective: what worked, what didn't, what's next
- [ ] Publish "Week 2 Update" on X + Farcaster
- [ ] Plan next 15-day sprint based on results

---

## SUCCESS METRICS (Day 15)
- [ ] $CRED staking live with >$1K TVL
- [ ] ≥1 external platform integration (even in-progress counts)
- [ ] Cred Score API serving >100 external calls/day
- [ ] ≥1 featured listing sold
- [ ] Base Batches application submitted
- [ ] "State of Agent Credibility" report published
- [ ] Score decay live and driving $CRED demand

## DAILY STANDUP FORMAT
Each morning at 9:00 AM CST, Bendr posts:
- ✅ What shipped yesterday
- 🎯 Today's targets (from checklist above)
- 🚧 Blockers
- 📊 Key metrics ($CRED price, staking TVL, API calls, terminal visitors)
