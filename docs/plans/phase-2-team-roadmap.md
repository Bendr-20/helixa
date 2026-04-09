# Helixa Phase 2 - Team Roadmap

## Objective
Shift Helixa from "agent identity product" to trust infrastructure for human + machine work.

The product sequence should be:
1. Trust
2. Routing
3. Capital
4. Launchpad

Launchpad stays in the plan, but not as the first move.

## Working Thesis
Helixa backs proven operators, routes them work, and turns reputation into economic coordination.

## The Wedge
The first Phase 2 surface should be an Operator Console built from the existing graph page and agent data surfaces we already have.

Core modules:
- Trust score and breakdown
- Work history and completion signals
- Recent outcomes and counterparties
- Available jobs and routing recommendations
- Backing state and pool visibility

This should start from the current graph experience if that gives us the fastest path to a stronger homepage.

## What We Already Have
We are not starting from zero.

Already live or substantially built:
- HelixaV2 identity base
- Cred score and CredOracle
- CredStakingV2 and vouch mechanics
- Trust graph and evaluator
- Verifications and DID docs
- 0xWork work stats endpoint
- Session outcome ingestion endpoint
- Jobs aggregator
- Market intel endpoint
- x402, USDC, and CRED payment rails
- Agent Terminal indexing and search infrastructure

## What Gets Demoted
These stay in the stack, but stop being the lead story:
- Soul Keeper as headline product
- heavy handshake / lore UX as primary funnel
- launchpad-first positioning

## Build Sequence

### Phase A - Trust Layer
Goal: rank who should get work.

Ship:
- unified operator profile
- clear trust breakdown
- endorsements / backers / counterparties language
- public trust page per operator

Inputs:
- Cred
- verifications
- work stats
- session outcomes
- trust graph

Success condition:
- Helixa can explain why an operator is trustworthy.

### Phase B - Routing Layer
Goal: match work to trustworthy operators.

Ship:
- jobs feed with filters
- routing recommendations
- eligibility and fit logic
- explainability on every match

Inputs:
- job categories
- work history
- trust score
- recent outcomes
- backing state

Success condition:
- Helixa can explain why a job was routed to a given operator.

### Phase C - Capital Layer
Goal: let third parties back operators and share upside from execution.

Ship:
- operator pools
- backing thresholds
- milestone-based capital unlocks
- revenue share rules

Inputs:
- staking / vouch mechanics
- x402 and stablecoin rails
- routing and outcome data

Success condition:
- backing affects operator capacity and economics, not just vanity ranking.

### Phase D - Launchpad Layer
Goal: launch financial products only after trust and work loops are real.

Ship later:
- launchpad for proven operators
- tokenization tied to performance and reputation
- launch flows backed by real trust and work data

Success condition:
- launchpad feels like a payoff layer, not a speculative wrapper.

## 14-Day Execution Plan

### Days 1-3
- lock positioning and internal language
- define the 4 visible score buckets: Trust, Work, Backing, Momentum
- keep Cred as the canonical underlying score while the 4 buckets act as the explanatory UI layer
- map existing endpoints and data into one operator profile schema

### Days 4-7
- design an Operator Console on top of the current graph page direction
- build first operator profile with trust, work, and outcome modules
- add basic routing recommendation logic using existing job + work data

### Days 8-10
- define operator pool rules
- spec backing mechanics and capital unlocks
- connect backing state to routing priority or capacity limits

### Days 11-14
- tighten public narrative
- choose homepage direction
- decide what stays in design lane only, especially launchpad
- prep partner and investor explanation deck around trust -> routing -> capital

## Owner Split
- Bendr: product sequence, score model, API wiring, routing logic
- Quigley: category framing, narrative, priorities, external positioning
- Rendr: interface system for Operator Console, trust surfaces, capital UX
- Jim: infra, data pipelines, treasury wiring, deployment

## Cred vs 4 Buckets
Cred should stay as the canonical 0-100 score already associated with Helixa.

The 4 buckets are a higher-level presentation and routing layer, not a replacement brand for Cred.

- Trust = core credibility, verification, reputation, identity quality
- Work = execution history, completions, outcomes, reliability
- Backing = stake, vouches, capital support, aligned counterparties
- Momentum = recent activity, improvement, trend, velocity

So the reconciliation is:
- Cred remains the base signal
- the 4 buckets explain operator quality in a way humans can scan fast
- a future routing score can be derived from those buckets without killing the Cred brand

## Decisions Needed This Week
1. Do we make the graph page the foundation of the homepage experience?
2. What exactly belongs in the 4 bucket score model?
3. What user action defines a routed success event?
4. How should backing change routing in v1?
5. What launchpad work, if any, stays in design-only mode for now?

## Success Markers
- people understand Helixa in one sentence
- operator trust pages are more compelling than generic profiles
- routing can be demoed with real logic, not hand-waving
- backing has a concrete mechanical effect
- launchpad is clearly later, not muddled into the first pitch
