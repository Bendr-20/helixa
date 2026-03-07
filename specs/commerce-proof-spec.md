# Commerce Proof API Spec

## Overview
Agents self-submit onchain activity data to boost their Commerce sub-score. Helixa spot-checks claims via free RPC — no indexer costs.

## Endpoint

### `POST /api/v2/agent/:id/commerce-proof`

**Auth:** SIWA token (same as existing endpoints)

**Request Body:**
```json
{
  "wallet": "0x...",
  "signature": "0x...",           // EIP-191 signature proving wallet ownership
  "message": "helixa-commerce:${agentId}:${timestamp}",
  "data": {
    "txCount": 2772,              // total transactions
    "uniqueCounterparties": 145,  // unique addresses interacted with
    "protocolsUsed": 31,          // distinct contract addresses
    "x402Payments": 12,           // x402 protocol payments made
    "acpJobsCompleted": 5,        // ACP service completions
    "totalVolumeUsd": 12400000,   // estimated total volume
    "sampleTxs": [                // 5-10 representative tx hashes for verification
      "0xabc...",
      "0xdef..."
    ]
  }
}
```

**Response (200):**
```json
{
  "commerceScore": 70,
  "tier": "enhanced",
  "verified": true,
  "checksRun": 5,
  "checksPassed": 5,
  "nextUpdate": "2026-02-25T00:00:00Z"  // can re-submit weekly
}
```

## Scoring Logic

### Free Tier (automatic for all agents with linked wallet)
We call `eth_getTransactionCount` via free RPC.

| Tx Count | Commerce Score |
|----------|---------------|
| 0        | 0             |
| 1-50     | 15            |
| 51-500   | 30            |
| 501-2000 | 45            |
| 2000+    | 55            |

### Enhanced Tier (self-submitted data, verified)

Base = Free tier score

Bonuses (additive, capped at 100):
- Unique counterparties > 50: +10
- Protocols used > 10: +10
- x402 payments > 0: +10
- ACP jobs completed > 0: +10
- Total volume > $100K: +5
- Total volume > $1M: +5 (additional)

### Verification Process
1. Check wallet ownership via EIP-191 signature
2. Verify `eth_getTransactionCount` matches claimed txCount (±10% tolerance)
3. Spot-check 3 random txs from `sampleTxs` — confirm they exist and involve the claimed wallet
4. If any check fails: reject submission, keep free tier score
5. Rate limit: 1 submission per agent per 7 days

## Integration with Cred Score

Commerce is one of 5 sub-scores:

| Sub-score  | Weight |
|-----------|--------|
| Identity   | 20%   |
| Reputation | 25%   |
| Autonomy   | 25%   |
| Activity   | 20%   |
| Commerce   | 10%   |

Overall Cred = weighted sum of sub-scores.

## Future: Enhanced Verification
Once we have more volume, we can verify more claims by:
- Checking ERC-20 transfer events for volume claims
- Reading ACP contract for job completion proofs
- Querying x402 facilitator contracts for payment proofs

All verifiable onchain without any external indexer.
