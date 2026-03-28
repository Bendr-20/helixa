# ERC-8004 Compliance Gap Analysis

**Date:** 2026-03-28
**V2 Contract:** `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` (Base)
**Contracts Audited:** `AgentDNA.sol`, `SoulSovereign.sol`, `SoulSovereignV3.sol`, `HandshakeRegistry.sol`

## Identity Registry Interface (ERC-8004 spec)

| Function | ERC-8004 Spec | Helixa V2 Status | Notes |
|----------|--------------|-------------------|-------|
| `register(string agentURI)` | Required | ❌ Missing | We use `mint(address, string, string, string, bool)` — different signature. URI is set but bundled with other params. |
| `register(string agentURI, MetadataEntry[] metadata)` | Optional overload | ❌ Missing | No batch metadata on registration. |
| `register()` | Optional (URI-less) | ❌ Missing | Not supported. |
| `setAgentURI(uint256 agentId, string newURI)` | Required | ⚠️ Partial | We inherit `ERC721URIStorage._setTokenURI()` but no public `setAgentURI` function exposed. Token URI is set at mint and via API server (deployer calls `_setTokenURI` internally). |
| `tokenURI(uint256)` → registration file | Required | ✅ Compliant | `/api/v2/metadata/:id` now returns ERC-8004 registration file format with `type`, `services`, `registrations`, `supportedTrust`. |
| `getMetadata(uint256 agentId, string key)` | Required | ❌ Missing | No on-chain key-value metadata store. We use off-chain profiles + on-chain traits (different schema). |
| `setMetadata(uint256 agentId, string key, bytes value)` | Required | ❌ Missing | Same as above. |
| `setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes signature)` | Required | ❌ Missing | No EIP-712 wallet rotation. SoulSovereign has `lockSoul` but that's a one-time lock, not rotation. |
| `agentWallet` reserved metadata key | Required | ⚠️ Partial | `agentAddress` stored in Agent struct, but not as a metadata key. No EIP-712 signature-based update. |
| ERC-721 base | Required | ✅ Compliant | Inherits ERC721 + ERC721URIStorage. |
| `supportsInterface` | Required | ✅ Compliant | Standard OZ implementation. |

## Registration File (tokenURI JSON)

| Field | ERC-8004 Spec | Status |
|-------|--------------|--------|
| `type` | `https://eips.ethereum.org/EIPS/eip-8004#registration-v1` | ✅ Present |
| `name` | Agent name | ✅ Present |
| `description` | Agent description | ✅ Present |
| `image` | Image URL | ✅ Present (dynamic aura PNG) |
| `services[]` | Service endpoints | ✅ Present (web, A2A, MCP, OASF) |
| `x402Support` | Boolean | ✅ Present |
| `active` | Boolean | ✅ Present |
| `registrations[]` | Registry references | ✅ Present |
| `supportedTrust[]` | Trust mechanisms | ✅ Present |

## Domain Verification

| Endpoint | Status |
|----------|--------|
| `/.well-known/agent-registration.json` | ✅ Implemented |
| `/.well-known/agent.json` | ✅ Implemented (with registrations + supportedTrust) |

## Reputation Registry

| Feature | ERC-8004 Spec | Helixa Status |
|---------|--------------|---------------|
| `giveFeedback()` | Required | ❌ Not implemented (separate contract) |
| `revokeFeedback()` | Required | ❌ Not implemented |
| `getSummary()` | Required | ❌ Not implemented |
| Feedback system | Required | ⚠️ We have Cred Scores (off-chain oracle) but not the on-chain feedback registry |

## Validation Registry

| Feature | ERC-8004 Spec | Helixa Status |
|---------|--------------|---------------|
| `validationRequest()` | Required | ❌ Not implemented |
| `validationResponse()` | Required | ❌ Not implemented |
| Full validation flow | Required | ❌ Not implemented |

## Summary

### ✅ Compliant
- Registration file format (tokenURI JSON)
- ERC-721 base with URI storage
- Domain verification endpoints
- Service discovery (A2A, MCP, OASF, web)
- x402 payment support declaration

### ⚠️ Gaps (Contract-Level)
1. **No `register(string agentURI)` function** — Our mint function has a different signature. Would need a V3 contract or wrapper.
2. **No `getMetadata`/`setMetadata` key-value store** — Spec requires on-chain bytes metadata. We use structured Agent struct + off-chain profiles.
3. **No `setAgentWallet` with EIP-712 signature** — Critical for agent wallet rotation. Would need contract upgrade.
4. **No Reputation Registry** — Separate contract needed for on-chain feedback.
5. **No Validation Registry** — Separate contract needed for validation flows.

### Recommendation
- **Phase 1 (Done):** Registration file compliance, domain verification, service endpoints ✅
- **Phase 2:** Deploy a thin proxy/wrapper contract implementing `register(agentURI)`, `setAgentURI`, `getMetadata`/`setMetadata`, and `setAgentWallet` that delegates to existing V2 contract.
- **Phase 3:** Deploy Reputation Registry and Validation Registry as separate contracts linked to V2.
