# Helixa Registries — Architecture Spec

## Overview

Two standalone, UUPS-upgradeable contracts completing the ERC-8004 tri-registry model:

| Registry | Contract | Purpose |
|----------|----------|---------|
| Identity | SoulSovereign V2 (deployed) | ERC-721 agent NFTs |
| **Reputation** | `ReputationRegistry.sol` | On-chain cred scores |
| **Validation** | `ValidationRegistry.sol` | On-chain attestations |

Both are **address-keyed** (not token-ID-keyed), so any address — Helixa-minted NFT holder, external agent, EOA, or contract — can be scored and validated.

## Design Principles

1. **Identity-agnostic** — Works with V2, V3, third-party 8004, or no NFT at all
2. **Upgradeable** — UUPS proxy pattern; admin-gated upgrades
3. **Role-based access** — OpenZeppelin AccessControl (`ORACLE_ROLE`, `VALIDATOR_ROLE`, `DEFAULT_ADMIN_ROLE`)
4. **Migration-ready** — `identityRegistry` pointer can be updated from V2 → V3 without redeployment

## ReputationRegistry

### Storage
- `latestReputation[agent]` — current score entry
- `_history[agent]` — append-only array of all score entries
- `identityRegistry` — pointer to identity contract

### Functions
| Function | Access | Description |
|----------|--------|-------------|
| `initialize(admin)` | once | Sets admin + oracle roles |
| `submitReputation(agent, score, metadata)` | ORACLE_ROLE | Submit score (0-100), appends to history |
| `getReputation(agent)` | public view | Returns (score, timestamp, metadata) |
| `getReputationHistory(agent)` | public view | Returns full score history array |
| `getTier(agent)` | public view | Returns tier enum from score |
| `getReputationCount(agent)` | public view | Number of historical entries |
| `setIdentityRegistry(addr)` | ADMIN | Update identity contract pointer |

### Tiers
| Tier | Score Range |
|------|------------|
| Junk | 0–19 |
| Marginal | 20–39 |
| Qualified | 40–59 |
| Prime | 60–79 |
| Preferred | 80–100 |

### Events
- `ReputationUpdated(agent, score, oracle, timestamp)`
- `IdentityRegistryUpdated(registry)`

## ValidationRegistry

### Storage
- `_validations[agent]` — array of Validation structs
- `_validationAgent[id]` — reverse lookup: validation ID → agent
- `_validationIndex[id]` — reverse lookup: validation ID → array index
- `_activeCount[agent][typeHash]` — active (non-revoked) count per type
- `nextValidationId` — auto-incrementing counter (starts at 1)
- `identityRegistry` — pointer to identity contract

### Functions
| Function | Access | Description |
|----------|--------|-------------|
| `initialize(admin)` | once | Sets admin + validator roles |
| `submitValidation(agent, type, evidence)` | VALIDATOR_ROLE | Create attestation, returns ID |
| `revokeValidation(agent, id)` | VALIDATOR_ROLE (original only) | Revoke own attestation |
| `getValidations(agent)` | public view | All validations for agent |
| `getValidation(id)` | public view | Single validation by ID |
| `isValidated(agent, type)` | public view | True if ≥1 active validation of type |
| `getValidationCount(agent)` | public view | Total validations (incl. revoked) |
| `setIdentityRegistry(addr)` | ADMIN | Update identity contract pointer |

### Standard Validation Types
- `"identity"` — Agent identity verified
- `"capability"` — Agent capabilities attested
- `"security"` — Security audit passed
- `"compliance"` — Regulatory compliance verified
- Custom strings supported

### Events
- `ValidationSubmitted(id, agent, validator, type, timestamp)`
- `ValidationRevoked(id, agent, validator, timestamp)`
- `IdentityRegistryUpdated(registry)`

## Deployment

```bash
DEPLOYER_PRIVATE_KEY=0x... \
IDENTITY_REGISTRY=0x2e3B541C59D38b84E3Bc54e977200230A204Fe60 \
forge script script/DeployRegistries.s.sol:DeployRegistries \
  --rpc-url $BASE_RPC --broadcast --verify -vvvv
```

Deploys 4 contracts: 2 implementations + 2 UUPS proxies. Admin receives all roles.

## Migration Path (V2 → V3)

1. Deploy V3 identity contract
2. Call `reputation.setIdentityRegistry(v3Address)`
3. Call `validation.setIdentityRegistry(v3Address)`
4. No data migration needed — scores/validations are keyed by address, not token ID

## Test Coverage

35 tests covering:
- Initialization & re-initialization guard
- Score submission, range validation, zero-address checks
- Full history tracking
- All 5 tier boundaries
- Multi-oracle support
- Validation submission, revocation, double-revoke guard
- Original-validator-only revocation
- Multiple validations of same type (revoke one, still validated)
- Custom validation types
- Identity registry pointer management
- Access control enforcement
