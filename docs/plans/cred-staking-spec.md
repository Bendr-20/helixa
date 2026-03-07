# $CRED Staking Contract — Design Spec

## Overview
CredStaking allows Helixa agent owners to stake $CRED tokens against an agent token ID, boosting that agent's Cred Score tier on the Agent Terminal.

## Addresses
- **$CRED Token (Base):** `0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3`
- **Helixa V2:** `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60`
- **Treasury:** `0x01b686e547F4feA03BfC9711B7B5306375735d2a`

## Tier System
| Tier | Threshold | Boost Points |
|------|-----------|-------------|
| NONE | < 100 $CRED | 0 |
| QUALIFIED | ≥ 100 $CRED | +10 |
| PRIME | ≥ 500 $CRED | +20 |
| PREFERRED | ≥ 2,000 $CRED | +30 |

## Key Design Decisions

### One staker per agent
Each agent token ID has exactly one staker. This simplifies accounting and prevents stake fragmentation. The staker can add more $CRED incrementally. Once fully unstaked, another address can claim the agent slot.

### Lock period (7 days)
Each stake/top-up resets the 7-day lock timer. This prevents gaming via rapid stake-unstake cycles.

### Early unstake penalty (10%)
Unstaking before the lock period expires sends 10% of the withdrawn amount to the treasury. This discourages short-term manipulation.

### Slash mechanism
Owner can slash an agent's entire stake, sending all funds to treasury. Used to penalize bad actors. Clears the staker slot entirely.

### No Helixa V2 on-chain integration
The contract doesn't call Helixa V2 to verify agent ownership. This is intentional — ownership verification is handled off-chain or by a future integration layer. Keeps the contract simple and under 24KB.

## Events
- `Staked(user, agentId, amount, newTier)`
- `Unstaked(user, agentId, amount, penalty)`
- `Slashed(agentId, amount, slashedStaker)`
- `TierChanged(agentId, oldTier, newTier)`

## Security
- ReentrancyGuard on stake/unstake
- Ownable for admin functions (slash, pause)
- SafeERC20 for token transfers
- Emergency pause capability

## Contract Size
~7KB source, well under 24KB deployed limit.
