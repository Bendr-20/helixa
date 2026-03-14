# Status Network Sepolia Deployment

**Date:** 2026-03-13
**Chain:** Status Network Sepolia Testnet (Chain ID: 1660990954)
**RPC:** https://public.sepolia.rpc.status.network
**Explorer:** https://sepoliascan.status.network
**Deployer:** 0x339559A2d1CD15059365FC7bD36b3047BbA480E0

## Deployed Contracts

| Contract | Address | Status |
|----------|---------|--------|
| MockCredOracle | `0x85BbAC72D26751bb0dc76eeDd8972a77386c9267` | ✅ Deployed |
| MockHelixaV2 | `0x53958d4430718c167816B1145EEBF70afF818404` | ✅ Deployed |
| **HelixaEvaluator** | `0x197e4a502B75772f0b09555D937875FA6170f798` | ✅ Deployed & Verified |

## Transaction Hashes

### Deploy Transactions
- **MockCredOracle deploy:** `0xbfb325221fb03ed597e519e9b00adf19f2e7f4281fa9ccf96885c6ffd8cb2d07`
- **MockHelixaV2 deploy:** `0xf4a24859a266a77d0e99eafb9687f148aaef05cda932b4da63770f060e71cb6f`
- **HelixaEvaluator deploy:** `0xe25ca83924f8bfc668390072bdba3f1b4df46699e5d03b1e2b1ab7230925ba58`

### Gasless Transaction Proof
- **setThresholds(60, 15) call:** `0xa36b1314f8f0b01a6983e1e8b8313889e2ef10a93526b1ef061f9c451176b238`
  - effectiveGasPrice: **0**
  - gasUsed: 35,162
  - Status: ✅ Success
  - Event emitted: `ThresholdsUpdated(60, 15)`

## Verification

- **Blockscout:** https://sepoliascan.status.network/address/0x197e4a502b75772f0b09555d937875fa6170f798
- Source code verified ✅

## Notes

- Status Network Sepolia is a Linea-based L2 — does **not** support PUSH0 opcode
- Must compile with `evm_version = "london"` (not shanghai/cancun)
- Gas is free at protocol level (gasPrice=0, effectiveGasPrice=0)
- No ETH balance needed for deployment or transactions
