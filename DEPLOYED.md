# Deployed Contracts — Base Mainnet (Chain ID 8453)

## Live

| Contract | Address | Description |
|----------|---------|-------------|
| **HelixaV2** | `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` | Identity NFT — ERC-8004, traits, narrative, naming, points |
| **AgentCredScore** | `0xc6F38c8207d19909151a5e80FB337812c3075A46` | Onchain Cred scoring (0-100) |
| **$CRED Token** | `0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3` | ERC-20 — deployed via Bankr, NOT controlled by us |

## Deployer & Treasury

| Role | Address |
|------|---------|
| Deployer (contract owner) | `0x97cf081780D71F2189889ce86941cF1837997873` |
| Treasury | `0x01b686e547F4feA03BfC9711B7B5306375735d2a` |
| Bendr wallet | `0x27E3286c2c1783F67d06f2ff4e3ab41f8e1C91Ea` |

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
| ERC-8004 Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ERC-8021 Builder Code | `bc_doy52p24` |
| Coinbase EAS Indexer | `0x2c7eE1E5f416dfF40054c27A62f7B357C4E8619C` |
| x402 Facilitator | `https://x402.dexter.cash` |

## Notes

- HelixaV2 uses `onlyTokenOwnerOrOwner` — deployer can update any agent's metadata (by design for API minting)
- $CRED token was deployed via Bankr's bonding curve — we have no admin control over the token contract
- Deployer wallet needs ETH for gas (~0.0264 ETH as of Feb 23)
