# Deployed Contracts - Base Mainnet (Chain ID 8453)

## Live

| Contract | Address | Description |
|----------|---------|-------------|
| **HelixaV2** | `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` | Identity NFT - ERC-8004, traits, narrative, naming, points |
| **AgentCredScore** | `0xc6F38c8207d19909151a5e80FB337812c3075A46` | Onchain Cred scoring (0-100) |
| **CredOracle** | `0xD77354Aebea97C65e7d4a605f91737616FFA752f` | Onchain Cred score storage, hourly batch updates |
| **CredStakingV2** | `0xd40ECD47201D8ea25181dc05a638e34469399613` | Cred-gated staking, vouch system, 7-day lock |
| **SoulSovereignV3** | `0x946677180fb3fdb5EbFF94aD91CFCeF0559711bD` | Chain of Identity - versioned soul locking |
| **HandshakeRegistry** | `0xdA865DC3647f7AA97228fBEB37Fe02095f0cA0Fd` | Onchain soul handshake receipts between agents |
| **HelixaEvaluator (ERC-8183)** | `0xF6F5De45eDB8751fc974A17d55339fe6dda8CC42` | Onchain agent evaluation - budget-gated eligibility |
| **$CRED Token** | `0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3` | ERC-20 - deployed via Bankr, NOT controlled by us |

## Deployer & Treasury

| Role | Address |
|------|---------|
| Deployer (contract owner) | `0x339559A2d1CD15059365FC7bD36b3047BbA480E0` |
| Old deployer (COMPROMISED) | `0x97cf081780D71F2189889ce86941cF1837997873` *(EIP-7702 attack, key blanked)* |
| Treasury | `0x01b686e547F4feA03BfC9711B7B5306375735d2a` |
| Bendr wallet | `0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea` |

## Deprecated

| Contract | Address | Notes |
|----------|---------|-------|
| SoulSovereign V3 (bad struct) | `0xb780EeF4254b96F979Fba66B2576be3561bf7a64` | Bad struct layout - replaced by corrected V3 deploy |
| SoulSovereign V2 | `0x41058AaE3c3160413a40771ae261291D94A95971` | Superseded by V3 - no tokens were locked |
| SoulSovereign V1 | `0x9e268732F64C6F3C108223FBF1528d8AC342Aab3` | Superseded by V2 |

## Deprecated (V1)

| Contract | Address | Notes |
|----------|---------|-------|
| AgentDNA (V1) | `0x665971e7bf8ec90c3066162c5b396604b3cd7711` | Superseded by HelixaV2 |
| AgentNames (V1) | `0xDE8c422D2076CbAE0cA8f5dA9027A03D48928F2d` | Naming now in HelixaV2 |
| Failed deploy 1 | `0x0cAdD7228...` | Wrong constructor args |
| Failed deploy 2 | `0xF21820879...` | Missing modifier |

## Integrations

| Service | Address/ID |
|---------|-----------|
| ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ERC-8004 Reputation Registry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| ERC-8021 Builder Code | `bc_doy52p24` |
| Coinbase EAS Indexer | `0x2c7eE1E5f416dfF40054c27A62f7B357C4E8619C` |
| x402 Facilitator | `https://x402.dexter.cash` |

## Notes

- HelixaV2 uses `onlyTokenOwnerOrOwner` - deployer can update any agent's metadata (by design for API minting)
- $CRED token was deployed via Bankr's bonding curve - we have no admin control over the token contract
- Deployer wallet needs ETH for gas (~0.0264 ETH as of Feb 23)
