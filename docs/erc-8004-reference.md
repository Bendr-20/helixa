# ERC-8004 Reference - Accurate Facts

## What ERC-8004 Is
- **Full name**: ERC-8004: Trustless Agents
- **Status**: Draft (Standards Track: ERC)
- **Created**: August 13, 2025
- **Authors**: Marco De Rossi (@MarcoMetaMask), Davide Crapis (davide@ethereum.org), Jordan Ellis (jordanellis@google.com), Erik Reppel (erik.reppel@coinbase.com)
- **Purpose**: Discover agents and establish trust through reputation and validation
- **Requires**: EIP-155, EIP-712, EIP-721, EIP-1271

## Three Registries (NOT just Identity)
1. **Identity Registry** - ERC-721 with URIStorage. Portable, censorship-resistant agent identifiers. Each agent gets an agentId (tokenId) and agentURI pointing to a registration file.
2. **Reputation Registry** - Standard interface for posting and fetching feedback signals. Clients give feedback (signed fixed-point value + tags). Scoring/aggregation happens both onchain (composability) and off-chain (sophisticated algorithms).
3. **Validation Registry** - Generic hooks for requesting and recording independent validator checks (stakers re-running jobs, zkML verifiers, TEE oracles, trusted judges).

## Key Design Principles
- **Pluggable trust models**: reputation systems, crypto-economic validation, zkML proofs, TEE attestations
- **Tiered security**: proportional to value at risk (pizza ordering vs medical diagnosis)
- **Payments are orthogonal**: not covered by 8004, but x402 examples are provided
- **Per-chain singletons**: deployed on any L2 or Mainnet
- **Complements MCP and A2A**: MCP handles capabilities, A2A handles task orchestration, 8004 handles discovery and trust

## Agent Registration File Structure
- type, name, description, image (ERC-721 compat)
- services array: A2A, MCP, OASF, ENS, DID, email endpoints
- x402Support boolean
- active boolean
- registrations array (cross-chain)
- supportedTrust array: ["reputation", "crypto-economic", "tee-attestation"]

## Onchain Metadata
- `getMetadata(agentId, key)` / `setMetadata(agentId, key, value)`
- Reserved key: `agentWallet` - set via EIP-712 signature proof
- Agent wallet auto-cleared on transfer

## Reputation System (BUILT INTO 8004)
- `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`
- value: signed fixed-point (int128), valueDecimals: 0-18
- tag1/tag2: developer-defined for composability/filtering
- Examples: starred (quality 0-100), uptime (%), responseTime (ms), revenues ($), reachable (binary)
- Feedback submitter MUST NOT be agent owner
- Onchain storage for composability, off-chain files via IPFS for rich data
- When agent-to-agent feedback, use agentWallet as clientAddress

## Deployment (as of March 2026)
- **Same contract addresses across all chains** (deterministic deployment)
- Identity Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Reputation Registry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
- **Chains**: Ethereum, Base, Arbitrum, Avalanche, BSC, Celo, Gnosis, GOAT, Linea, Mantle, MegaETH, Abstract + all testnets
- **No Validation Registry deployed yet** (only Identity + Reputation)

## Agent Count (March 2026)
- **100,000+ total across all chains**
- BNB Chain: ~44,000 (leading, launched March 4)
- Ethereum: ~36,500
- Base: ~28,000-30,000
- Other chains: growing
- Our "69,240 indexed" number was our terminal DB snapshot, NOT the total 8004 count

## Key Ecosystem Tools
- **8004scan.io** (by AltLayer) - Official explorer for browsing, filtering, feedback
- **Etherscan** - Native support, tracks registrations
- **Dune Analytics** - Dashboard tracking deployments across chains

## What Helixa Adds ON TOP of 8004
- **Cred Score**: Multi-dimensional reputation scoring (goes beyond 8004's raw feedback signals)
- **Soul Vault / Chain of Identity**: Versioned soul locking (not in 8004)
- **Handshake Registry**: Agent-to-agent trust bonds (not in 8004)
- **Trust Evaluation Pipeline**: Composite trust assessment (not in 8004)
- **$CRED dual-token x402 payments**: Economic layer (not in 8004)
- **Agent Cards**: Visual identity layer (not in 8004)

## What We Were Getting Wrong
1. "69,000+ agents on ERC-8004" - Actually 100K+ across all chains. 69K was our local DB.
2. Didn't mention Reputation Registry as part of 8004 - It IS a core component.
3. Didn't mention Validation Registry at all.
4. Positioning: We should say "Helixa builds opinionated trust infrastructure on top of ERC-8004's three registries" not "ERC-8004 has no reputation."
