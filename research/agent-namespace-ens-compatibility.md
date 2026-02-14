# `.agent` Namespace ENS Compatibility — Technical Research Report

**Date:** February 14, 2026  
**Author:** Helix (Research Sub-Agent)  
**For:** Helixa Team  
**Status:** Strategic Planning Document

---

## Executive Summary

Helixa's `.agent` naming registry (AgentNames.sol, ERC-8004) can achieve full ENS ecosystem interoperability through a phased approach. The most viable path—and the one validated by Basenames (base.eth), cb.id, and uni.eth—is to operate as **ENS subnames** under a parent `.eth` name (e.g., `agent.eth`) rather than trying to get `.agent` recognized as a standalone TLD.

**Critical finding:** ENS published a blog post in January 2026 explicitly discussing AI agent identity via ENS, referencing ERC-8004 by name. ENS treats agent names as a first-class use case. This creates a strategic opening for Helixa to become the canonical agent naming layer within ENS's ecosystem.

### Recommended Strategy (Priority Order)

| Phase | What | Effort | Impact |
|-------|------|--------|--------|
| 1 | Implement ENS resolver interfaces in AgentNames.sol | 2-3 weeks | Wallet compatibility |
| 2 | Deploy CCIP-Read gateway + L1 resolver stub | 3-4 weeks | Cross-chain resolution |
| 3 | Reverse resolution support | 1-2 weeks | Block explorer display |
| 4 | Multi-chain records & text records | 2-3 weeks | Rich agent profiles |
| 5 | ENS DAO partnership / agent.eth acquisition | Ongoing | Ecosystem legitimacy |

**Total estimated engineering effort:** 8-12 weeks for Phases 1-4.

---

## 1. ENS Resolver Interface Compatibility

### Background

ENS resolvers are smart contracts that answer queries about names. The protocol is modular—resolvers implement whichever interfaces they support, advertising capabilities via ERC-165 (`supportsInterface`).

### Required Interfaces

The following interfaces must be implemented for full wallet compatibility:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// EIP-137: Core address resolution
/// Interface ID: 0x3b3b57de
interface IAddrResolver {
    function addr(bytes32 node) external view returns (address payable);
}

/// ENSIP-9 / EIP-2304: Multi-chain address resolution
/// Interface ID: 0xf1cb7e06
interface IAddressResolver {
    function addr(bytes32 node, uint256 coinType) external view returns (bytes memory);
}

/// EIP-634: Text record resolution
/// Interface ID: 0x59d1d43c
interface ITextResolver {
    function text(bytes32 node, string calldata key) external view returns (string memory);
}

/// EIP-1577: Content hash resolution
/// Interface ID: 0xbc1c58d1
interface IContentHashResolver {
    function contenthash(bytes32 node) external view returns (bytes memory);
}

/// EIP-181: Reverse resolution
/// Interface ID: 0x691f3431
interface INameResolver {
    function name(bytes32 node) external view returns (string memory);
}

/// ENSIP-10: Wildcard resolution
/// Interface ID: 0x9061b923
interface IExtendedResolver {
    function resolve(bytes memory name, bytes memory data) external view returns (bytes memory);
}

/// ERC-165: Interface detection
interface IERC165 {
    function supportsInterface(bytes4 interfaceID) external pure returns (bool);
}
```

### Minimum Viable Resolver for AgentNames.sol

```solidity
contract AgentNameResolver is IAddrResolver, ITextResolver, INameResolver, IERC165 {
    // Reference to your existing AgentNames registry
    IAgentNames public immutable agentNames;
    
    // node => coinType => address
    mapping(bytes32 => mapping(uint256 => bytes)) private _addresses;
    // node => key => value  
    mapping(bytes32 => mapping(string => string)) private _texts;
    // address => name (reverse records)
    mapping(bytes32 => string) private _names;
    
    function addr(bytes32 node) external view override returns (address payable) {
        // Look up the agent NFT owner or linked address from AgentNames
        return payable(agentNames.resolveAddress(node));
    }
    
    function text(bytes32 node, string calldata key) external view override returns (string memory) {
        return _texts[node][key];
    }
    
    function name(bytes32 node) external view override returns (string memory) {
        return _names[node];
    }
    
    function supportsInterface(bytes4 interfaceID) external pure override returns (bool) {
        return interfaceID == 0x01ffc9a7  // ERC-165
            || interfaceID == 0x3b3b57de  // IAddrResolver
            || interfaceID == 0x59d1d43c  // ITextResolver
            || interfaceID == 0x691f3431  // INameResolver
            || interfaceID == 0xf1cb7e06  // IAddressResolver (multicoin)
            || interfaceID == 0xbc1c58d1; // IContentHashResolver
    }
}
```

### How Wallets Resolve Names

MetaMask, Rainbow, and other wallets use this flow:

1. Call ENS Registry on L1: `registry.resolver(namehash("myagent.agent.eth"))` → get resolver address
2. Check `supportsInterface()` on the resolver
3. Call `addr(node)` to get the ETH address
4. For sending to other chains, call `addr(node, coinType)`

**Key insight:** Wallets don't need to know about `.agent` specifically. If `.agent` names resolve through ENS infrastructure (via CCIP-Read from a parent `.eth` name), every ENS-compatible wallet automatically supports them.

### Relevant Standards

- [EIP-137](https://eips.ethereum.org/EIPS/eip-137) — ENS core specification
- [EIP-181](https://eips.ethereum.org/EIPS/eip-181) — Reverse resolution
- [EIP-2304](https://eips.ethereum.org/EIPS/eip-2304) — Multi-chain address resolution
- [EIP-634](https://eips.ethereum.org/EIPS/eip-634) — Text records
- [EIP-1577](https://eips.ethereum.org/EIPS/eip-1577) — Content hash

---

## 2. ENSIP-10 Wildcard Resolution & L2 Integration

### How It Works

ENSIP-10 introduced the `resolve(bytes name, bytes data)` function, enabling a single resolver to handle resolution for an entire subtree of names. This is how all L2/offchain ENS subname systems work.

When a client queries `myagent.agent.eth`:
1. Client looks up the resolver for `agent.eth` on L1 ENS Registry
2. Resolver implements `IExtendedResolver` (ENSIP-10)
3. Resolver reverts with `OffchainLookup` (EIP-3668/CCIP-Read)
4. Client fetches data from the specified gateway URL
5. Gateway reads from Base L2 (your AgentNames contract)
6. Response is verified and returned to the client

### How Basenames (base.eth) Did It — The Blueprint

Basenames is the closest analogue to what Helixa wants to achieve. Their architecture:

**Three components:**
1. **L1 ENS Resolver** — Deployed on Ethereum mainnet for `base.eth`. When queried for `user.base.eth`, reverts with `OffchainLookup`
2. **CCIP Gateway** — HTTP service operated by Base that reads from Base L2 contracts
3. **L2 Registry + Resolver** — Deployed on Base, stores ownership (ERC-721), resolver addresses, text records, etc.

**Key technical details:**
- The L1 resolver uses ENSIP-10 wildcard resolution
- The CCIP gateway retrieves ownership and text records from Base L2
- Standard ENS resolver functions (`addr`, `text`, `contenthash`) are implemented on L2
- Profile updates happen in single L2 transactions (cheap gas)
- ethers.js, viem, and ENSjs resolve Basenames out of the box with zero configuration

### Getting a Parent Name

**Option A: Acquire `agent.eth`** (Recommended)
- Check if `agent.eth` is available or negotiate purchase
- Register/acquire the name, set up ENSIP-10 resolver
- Names become: `myagent.agent.eth`

**Option B: Get a subname under an existing name**
- Partner with Base/Coinbase for something under `base.eth`
- Less autonomy but faster path

**Option C: Register a custom `.eth` name**
- e.g., `helixa.eth` → `myagent.helixa.eth`
- Full control, but less memorable for the agent use case

### ENS DAO Proposal Process

Getting `.agent` recognized as a standalone TLD in ENS is theoretically possible but practically very difficult:

1. ENS DAO operates via governance at [discuss.ens.domains](https://discuss.ens.domains)
2. Process: Temperature Check → Draft Proposal → Executable Proposal
3. ENS has historically aligned with ICANN DNS TLDs (their constitution states: "ENS aims to integrate with the legacy DNS naming system")
4. `.agent` is not an ICANN TLD, so ENS would not natively support it
5. ENS is exploring ICANN's gTLD expansion program for `.eth` recognition

**Recommendation:** Do NOT pursue standalone `.agent` TLD recognition in ENS. Instead, use the subname approach (`*.agent.eth`) which is the proven, supported path.

### Reference Implementations

- [Basenames contracts](https://github.com/base-org/basenames) — Fork of ENS contracts on Base
- [ensdomains/offchain-resolver](https://github.com/ensdomains/offchain-resolver) — Reference CCIP-Read resolver
- [gskril/ens-offchain-registrar](https://github.com/gskril/ens-offchain-registrar) — Offchain subname registrar
- [Unruggable Gateways](https://github.com/unruggable-labs/unruggable-gateways) — Trust-minimized L2 verification
- [ccip-tools](https://github.com/ensdomains/ccip-tools) — CCIP-Read tooling and deployable resolver

---

## 3. Reverse Resolution

### How ENS Reverse Resolution Works

Reverse resolution maps addresses → names. ENS uses a special namespace: `addr.reverse`.

For address `0x1234...abcd`, the reverse record lives at:
```
<address>.addr.reverse
```
(where `<address>` is the lowercase hex address without `0x`)

The node is computed as:
```
namehash("<address>.addr.reverse")
```

### Interface Required

```solidity
/// INameResolver — EIP-181
/// Interface ID: 0x691f3431
interface INameResolver {
    function name(bytes32 node) external view returns (string memory);
}

/// For setting reverse records
interface IReverseRegistrar {
    function setName(string memory name) external returns (bytes32);
    function setNameForAddr(
        address addr,
        address owner,
        address resolver,
        string memory name
    ) external returns (bytes32);
}
```

### How Block Explorers Pick Up Reverse Records

1. Etherscan, Basescan, etc. call the ENS Universal Resolver with `reverse(address)` 
2. Universal Resolver looks up `<addr>.addr.reverse` in the reverse registrar
3. Gets the resolver for that node, calls `name(node)`
4. Returns the ENS name (e.g., "myagent.agent.eth")
5. Explorer does a forward resolution to verify (name → address must match)

### Implementation for Helixa

On Base L2, you need:
1. A reverse registrar contract that lets agent owners set their reverse record
2. Your resolver must implement `name(bytes32 node)` 
3. When an agent NFT is minted/transferred, automatically set the reverse record

```solidity
// In AgentNames.sol or a companion contract
function setAgentReverse(uint256 tokenId) external {
    require(ownerOf(tokenId) == msg.sender, "Not owner");
    string memory agentName = tokenIdToName[tokenId];
    // Set reverse record: msg.sender → "agentname.agent.eth"
    reverseRegistrar.setName(
        string(abi.encodePacked(agentName, ".agent.eth"))
    );
}
```

**Note:** Primary names from L2 are still under active development in ENS. The CCIP-Read gateway would need to serve reverse lookups too. Monitor [ENS docs on L2 primary names](https://docs.ens.domains/learn/ccip-read/).

### Effort & Complexity
- **Complexity:** Medium
- **Effort:** 1-2 weeks
- **Dependency:** Requires Phase 2 (CCIP-Read gateway) to be functional first

---

## 4. Multi-Chain Records

### ENS Coin Type System (ENSIP-9 / EIP-2304)

ENS uses SLIP-44 coin types to store addresses for any blockchain:

| Coin Type | Chain | Constant |
|-----------|-------|----------|
| 60 | Ethereum | `ETH` |
| 0 | Bitcoin | `BTC` |
| 501 | Solana | `SOL` |
| 2147483648 + chainId | EVM L2s | e.g., Base = `2147492101` |
| 354 | Polkadot | `DOT` |
| 397 | NEAR | `NEAR` |

For EVM chains, the coin type is calculated as: `0x80000000 | chainId`

Base (chainId 8453) → coin type: `2147491901` (0x80002105)

### Storing Multi-Chain Addresses

```solidity
// Set the Base address (most common for .agent names)
resolver.setAddr(node, 2147491901, abi.encodePacked(baseAddress));

// Set ETH mainnet address
resolver.setAddr(node, 60, abi.encodePacked(ethAddress));

// Set BTC address (encoded as scriptPubkey)
resolver.setAddr(node, 0, btcScriptPubkey);

// Set SOL address (32 bytes)
resolver.setAddr(node, 501, solanaPublicKey);
```

### Text Records — Agent-Specific Use Cases

Standard text record keys that wallets/apps already support:

| Key | Use | Example |
|-----|-----|---------|
| `avatar` | Profile picture | `eip155:8453/erc721:0x.../123` |
| `description` | Bio/description | "Trading agent on Base" |
| `url` | Website | `https://myagent.helixa.xyz` |
| `com.twitter` | Twitter handle | `@myagent` |
| `com.github` | GitHub | `myagent-repo` |
| `com.discord` | Discord | `myagent#1234` |
| `email` | Contact email | `contact@myagent.ai` |

**Agent-specific text records** (custom keys Helixa should define):

| Key | Use | Example |
|-----|-----|---------|
| `ai.agent.model` | AI model used | `gpt-4o`, `claude-3.5-sonnet` |
| `ai.agent.framework` | Agent framework | `helixa`, `langchain` |
| `ai.agent.capabilities` | JSON capability list | `["trade","analyze","chat"]` |
| `ai.agent.api` | Agent API endpoint | `https://api.myagent.ai/v1` |
| `ai.agent.version` | Agent version | `1.2.3` |
| `ai.agent.status` | Active/inactive | `active` |
| `ai.agent.owner` | Human owner ENS/addr | `alice.eth` |
| `ai.agent.fee` | Service fee info | `0.001 ETH/request` |
| `ai.agent.protocol` | Interaction protocol | `x402`, `a2a` |

### Recommended Agent Profile Schema

```solidity
// Setting a complete agent profile
resolver.setText(node, "avatar", "eip155:8453/erc721:0xAgentNFT/42");
resolver.setText(node, "description", "Autonomous trading agent on Base");
resolver.setText(node, "url", "https://myagent.helixa.xyz");
resolver.setText(node, "ai.agent.model", "gpt-4o");
resolver.setText(node, "ai.agent.capabilities", '["trade","analyze"]');
resolver.setText(node, "ai.agent.api", "https://api.myagent.ai");
resolver.setText(node, "ai.agent.protocol", "x402");

// Set Base address (primary)
resolver.setAddr(node, 2147491901, abi.encodePacked(agentWallet));
// Set ETH mainnet address
resolver.setAddr(node, 60, abi.encodePacked(agentMainnetWallet));
```

### Most Commonly Used Record Types

Based on ENS usage data:
1. **addr (ETH)** — ~100% of names
2. **avatar** — ~15-20% of names
3. **description** — ~10-15%
4. **com.twitter** — ~10%
5. **url** — ~8%
6. **contenthash** — ~5%
7. **addr (multi-chain)** — growing, ~5%

### Effort & Complexity
- **Complexity:** Low-Medium
- **Effort:** 2-3 weeks
- **Notes:** Most of this is mapping storage + getter/setter functions. The agent-specific text records are the novel contribution.

---

## 5. CCIP-Read (ERC-3668)

### How Off-Chain Resolution Works

CCIP-Read is the mechanism that enables ENS names to resolve data stored anywhere—L2s, databases, APIs. It's the bridge between L1 ENS and your Base contracts.

**Flow:**

```
Client → L1 Resolver.resolve("myagent.agent.eth", addr_calldata)
       ← REVERT OffchainLookup(sender, urls, callData, callback, extraData)
       
Client → HTTP GET/POST to gateway URL with callData
       ← Gateway returns {data: "0x...(signed response)"}
       
Client → L1 Resolver.callback(response, extraData)
       ← Returns: resolved address
```

### L1 Resolver Contract (Deploy on Ethereum Mainnet)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IExtendedResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IExtendedResolver.sol";

contract AgentL1Resolver is IExtendedResolver {
    string[] public gateways;
    address public signer; // Gateway signer for verification
    
    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );
    
    constructor(string[] memory _gateways, address _signer) {
        gateways = _gateways;
        signer = _signer;
    }
    
    /// @notice ENSIP-10 wildcard resolve — entry point for all queries
    function resolve(bytes calldata name, bytes calldata data) 
        external view override returns (bytes memory) 
    {
        revert OffchainLookup(
            address(this),
            gateways,
            abi.encode(name, data),
            this.resolveCallback.selector,
            abi.encode(name, data)
        );
    }
    
    /// @notice Callback after gateway returns data
    function resolveCallback(bytes calldata response, bytes calldata extraData)
        external view returns (bytes memory)
    {
        // Verify gateway signature
        (bytes memory result, bytes memory sig) = abi.decode(response, (bytes, bytes));
        bytes32 hash = keccak256(abi.encodePacked(extraData, result));
        address recovered = _recoverSigner(hash, sig);
        require(recovered == signer, "Invalid signature");
        return result;
    }
    
    function supportsInterface(bytes4 interfaceID) external pure returns (bool) {
        return interfaceID == 0x9061b923 // IExtendedResolver
            || interfaceID == 0x01ffc9a7; // ERC-165
    }
    
    function _recoverSigner(bytes32 hash, bytes memory sig) internal pure returns (address) {
        // ECDSA recovery implementation
        // ...
    }
}
```

### CCIP Gateway Server (TypeScript Reference)

```typescript
// Gateway that reads from Base L2
import { ethers } from "ethers";

const baseProvider = new ethers.JsonRpcProvider("https://mainnet.base.org");
const agentNames = new ethers.Contract(AGENT_NAMES_ADDRESS, AGENT_NAMES_ABI, baseProvider);

async function handleCCIPRequest(sender: string, callData: string) {
  const [name, data] = ethers.AbiCoder.defaultAbiCoder().decode(["bytes", "bytes"], callData);
  
  // Parse DNS-encoded name to get the agent name
  const agentName = decodeDNSName(name); // e.g., "myagent"
  
  // Decode the inner call (addr, text, etc.)
  const selector = data.slice(0, 4);
  
  let result: string;
  if (selector === "0x3b3b57de") { // addr(bytes32)
    const address = await agentNames.resolveAddress(agentName);
    result = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [address]);
  } else if (selector === "0x59d1d43c") { // text(bytes32, string)
    const [, key] = ethers.AbiCoder.defaultAbiCoder().decode(["bytes32", "string"], data);
    const value = await agentNames.getText(agentName, key);
    result = ethers.AbiCoder.defaultAbiCoder().encode(["string"], [value]);
  }
  
  // Sign the response
  const sig = await signer.signMessage(ethers.getBytes(
    ethers.keccak256(ethers.solidityPacked(["bytes", "bytes"], [callData, result]))
  ));
  
  return ethers.AbiCoder.defaultAbiCoder().encode(["bytes", "bytes"], [result, sig]);
}
```

### Trust-Minimized vs. Trusted Gateway

| Approach | Trust Model | Complexity | Used By |
|----------|-------------|------------|---------|
| **Signed gateway** | Trust gateway operator's signature | Low | cb.id, uni.eth |
| **Storage proofs** | Trustless (verify L2 state on L1) | High | linea.eth, clv.eth |
| **Hybrid** | Proofs with fallback | Medium | Basenames |

**Recommendation for Helixa:** Start with signed gateway (simpler), then upgrade to storage proofs via [Unruggable Gateways](https://gateway-docs.unruggable.com/) for trust minimization.

### Reference Implementations

- [ensdomains/offchain-resolver](https://github.com/ensdomains/offchain-resolver) — Official reference
- [ensdomains/ccip-tools](https://github.com/ensdomains/ccip-tools) — Deploy via UI at https://ccip-tools.pages.dev/
- [ensdomains/ccip-read-router](https://github.com/ensdomains/ccip-read-router) — Gateway routing library
- [Unruggable Gateways](https://github.com/unruggable-labs/unruggable-gateways) — L2 storage proof verification
- [gskril/ens-offchain-registrar](https://github.com/gskril/ens-offchain-registrar) — Complete working example

### Effort & Complexity
- **Complexity:** Medium-High
- **Effort:** 3-4 weeks (signed gateway), +4-6 weeks (storage proofs)
- **Infrastructure:** Requires running a gateway server (can be serverless/Cloudflare Workers)

---

## 6. Ecosystem Integration Path

### How Basenames / cb.id Got Integrated

**cb.id (Coinbase Wallet) — Offchain Model:**
- Coinbase registered `cb.id` as a DNS name and set up ENS integration
- Uses CCIP-Read with an offchain database (no L2 storage)
- Names are free, stored on Coinbase servers
- Resolution works in all ENS-compatible wallets automatically
- No ENS DAO proposal was needed — they just set up a resolver

**Basenames (base.eth) — L2 Model (Our Blueprint):**
- Base acquired `base.eth` on ENS
- Forked ENS core contracts to Base L2 (registry, resolver, registrar)
- Deployed L1 CCIP-Read resolver pointing to Base CCIP gateway
- Names stored as ERC-721 tokens on Base
- Integrated onchain attestations (EAS) for reputation
- Added gasless registration via Paymaster for Smart Wallet users
- Launched with Dutch auction pricing, transitioned to tiered annual pricing

**Key takeaway:** Neither cb.id nor Basenames required ENS DAO approval. They used existing ENS infrastructure (subnames + CCIP-Read) to build independently.

### What Helixa Needs To Do

1. **Acquire `agent.eth`** (or similar parent name)
   - Check availability on [app.ens.domains](https://app.ens.domains)
   - If taken, negotiate purchase or use alternative (e.g., `helixa.eth`, `agentid.eth`)
   
2. **Deploy L1 resolver** on Ethereum mainnet
   - ENSIP-10 + CCIP-Read resolver pointing to your gateway
   
3. **Run CCIP gateway** 
   - Reads from AgentNames.sol on Base
   - Returns signed responses for L1 verification
   
4. **Integration happens automatically**
   - ethers.js, viem, wagmi, ENSjs all support CCIP-Read natively
   - MetaMask, Rainbow, Coinbase Wallet resolve subnames automatically
   - No wallet-specific integrations needed

### Base-Native Naming Landscape

| Service | Model | Status |
|---------|-------|--------|
| **Basenames** (base.eth) | L2 ENS subnames | Live, dominant on Base |
| **cb.id** | Offchain ENS subnames | Live, Coinbase Wallet |
| **Helixa .agent** | L2 agent names | Building — needs ENS bridge |

**Is there a Base-native naming standard?** Basenames IS the de facto standard on Base. It uses ENS contracts forked to Base. There is no separate "Base naming standard" — it's ENS all the way down.

### Partnership Opportunities

1. **ENS Labs** — ENS has explicitly called out ERC-8004 and agent naming as a priority. Reach out to discuss becoming the canonical agent naming layer under ENS.
2. **Base/Coinbase** — Natural partner given Basenames infrastructure. Could potentially get subnames under `base.eth` or co-market.
3. **Wallet teams** — Once CCIP-Read is live, wallets work automatically. But co-marketing helps adoption.
4. **Agent frameworks** — ElizaOS, AutoGPT, LangChain etc. could integrate `.agent` name resolution for agent discovery.

---

## 7. Competitive Analysis

### AI Agent Naming Systems

**ENS + ERC-8004 Ecosystem:**
- ENS itself is positioning as THE agent naming layer (Jan 2026 blog post)
- ERC-8004 (Ethereum Foundation, Google, MetaMask, Coinbase) uses ENS names as first-class agent identifiers
- Agent NFTs in ERC-8004 Identity Registry reference ENS names

**AIWS (ENS Grant Recipient):**
- AI agent framework using ENS names + IPFS
- Every agent gets an ENS name, contenthash points to IPFS-hosted agent portal
- Received ENS DAO Term 6 grant

**ERC-8122 (Minimal Agent Registry):**
- Proposed by Prem Makeig (Unruggable)
- Lightweight, deployable onchain registry for AI agent discovery
- Designed for custom deployments (curated collections, specialized domains)
- Complementary to ENS rather than competing

### Naming Services on Base

| Service | Type | Agent-Specific? |
|---------|------|-----------------|
| Basenames (base.eth) | General ENS subnames | No |
| cb.id | Wallet identity | No |
| **Helixa .agent** | Agent identity | **Yes — unique positioning** |

### Helixa's Competitive Advantage

1. **Only agent-specific naming service** — Basenames and cb.id are general-purpose
2. **ERC-8004 native** — Purpose-built for the agent identity standard
3. **Agent NFT integration** — Names linked to agent NFTs with reputation/validation registries
4. **Agent-specific text records** — Capabilities, API endpoints, model info, status
5. **First mover** on Base for agent naming

---

## 8. Detailed Implementation Roadmap

### Phase 1: ENS Resolver Interfaces (Weeks 1-3)

**Goal:** Make AgentNames.sol implement standard ENS resolver interfaces.

**Tasks:**
- [ ] Add `IAddrResolver`, `ITextResolver`, `IContentHashResolver`, `INameResolver` to AgentNames.sol
- [ ] Implement `supportsInterface()` with correct interface IDs
- [ ] Add text record storage (mapping node → key → value)
- [ ] Add multi-chain address storage (mapping node → coinType → address)
- [ ] Implement `namehash` computation compatible with ENS
- [ ] Write comprehensive tests
- [ ] Deploy updated contract on Base testnet (Sepolia)

**Deliverable:** AgentNames.sol that any ENS-aware library can query directly on Base.

### Phase 2: CCIP-Read Gateway + L1 Resolver (Weeks 3-7)

**Goal:** Enable resolution of `*.agent.eth` from any ENS client.

**Tasks:**
- [ ] Acquire parent ENS name (`agent.eth` or alternative)
- [ ] Deploy L1 ENSIP-10 resolver on Ethereum mainnet
- [ ] Build CCIP gateway server (Node.js/Cloudflare Workers)
- [ ] Gateway reads from AgentNames.sol on Base via RPC
- [ ] Implement signature verification in L1 callback
- [ ] Set resolver for parent name in ENS Registry
- [ ] Test with ethers.js, viem, wagmi
- [ ] Test in MetaMask, Rainbow, Coinbase Wallet
- [ ] Deploy gateway to production (redundant, CDN-backed)

**Deliverable:** `myagent.agent.eth` resolves in any ENS-compatible wallet.

### Phase 3: Reverse Resolution (Weeks 7-9)

**Goal:** Block explorers show agent names instead of hex addresses.

**Tasks:**
- [ ] Deploy reverse registrar on Base
- [ ] Implement `name()` in resolver
- [ ] Auto-set reverse records on agent name registration
- [ ] Extend CCIP gateway to serve reverse lookups
- [ ] Test on Basescan

**Deliverable:** Basescan shows "myagent.agent.eth" next to agent wallet addresses.

### Phase 4: Rich Agent Profiles (Weeks 9-12)

**Goal:** Full agent metadata via ENS text records.

**Tasks:**
- [ ] Define and document agent-specific text record schema
- [ ] Build agent profile UI (set avatar, description, capabilities, API endpoint, etc.)
- [ ] Implement batch record updates (multicall)
- [ ] Add contenthash support for agent documentation hosting
- [ ] Create SDK/library for agent frameworks to resolve agent profiles
- [ ] Publish schema as community standard (propose as ENSIP or ERC)

**Deliverable:** Rich, queryable agent profiles accessible from any ENS client.

### Phase 5: Ecosystem & Partnerships (Ongoing)

**Tasks:**
- [ ] Reach out to ENS Labs about agent naming collaboration
- [ ] Propose agent text record schema to ENS community
- [ ] Integrate with agent frameworks (ElizaOS, etc.)
- [ ] Explore trust-minimized resolution via Unruggable Gateways
- [ ] Monitor ENSv2 developments (per-name registries could change the game)
- [ ] Consider ERC-8122 compatibility for the agent registry

---

## 9. Key Links & References

### EIPs & ENSIPs
- [EIP-137: ENS](https://eips.ethereum.org/EIPS/eip-137)
- [EIP-181: Reverse Resolution](https://eips.ethereum.org/EIPS/eip-181)
- [EIP-634: Text Records](https://eips.ethereum.org/EIPS/eip-634)
- [EIP-1577: Content Hash](https://eips.ethereum.org/EIPS/eip-1577)
- [EIP-2304 / ENSIP-9: Multi-chain Addresses](https://eips.ethereum.org/EIPS/eip-2304)
- [ENSIP-10: Wildcard Resolution](https://docs.ens.domains/ensip/10/)
- [EIP-3668: CCIP-Read](https://eips.ethereum.org/EIPS/eip-3668)
- [ERC-8004: Agent Identity](https://eips.ethereum.org/EIPS/eip-8004)
- [ERC-8122: Minimal Agent Registry](https://ethereum-magicians.org/t/erc-8122-minimal-agent-registry/27405)

### ENS Documentation
- [Resolver Interfaces](https://docs.ens.domains/resolvers/interfaces/)
- [Writing a Resolver](https://docs.ens.domains/resolvers/writing/)
- [CCIP-Read / Offchain Resolvers](https://docs.ens.domains/resolvers/ccip-read/)
- [L2 & Offchain Resolution](https://docs.ens.domains/learn/ccip-read/)
- [Public Resolver](https://docs.ens.domains/resolvers/public/)

### Reference Implementations
- [ENS Contracts (GitHub)](https://github.com/ensdomains/ens-contracts)
- [Offchain Resolver (GitHub)](https://github.com/ensdomains/offchain-resolver)
- [CCIP Tools](https://github.com/ensdomains/ccip-tools) / [Deploy UI](https://ccip-tools.pages.dev/)
- [Offchain Registrar Example](https://github.com/gskril/ens-offchain-registrar)
- [Unruggable Gateways](https://github.com/unruggable-labs/unruggable-gateways) / [Docs](https://gateway-docs.unruggable.com/)
- [CCIP-Read Router](https://github.com/ensdomains/ccip-read-router)

### Ecosystem
- [ENS Blog: AI Agent Identity & ERC-8004](https://ens.domains/blog/post/ens-ai-agent-erc8004)
- [How Base uses ENS](https://ens.domains/ecosystem/base)
- [Coinbase's ENS Integration](https://ens.domains/blog/post/coinbase-strategic-integration-of-ens)
- [ENS DAO Governance](https://discuss.ens.domains/)
- [ENS App](https://app.ens.domains/)

---

## 10. Actionable Next Steps (This Week)

1. **Check `agent.eth` availability** — Go to app.ens.domains and check. If taken, check `agentid.eth`, `agents.eth`, `onchainagent.eth`. Consider negotiating a purchase if `agent.eth` is owned but unused.

2. **Read the ENS blog post on AI agents** — [ens.domains/blog/post/ens-ai-agent-erc8004](https://ens.domains/blog/post/ens-ai-agent-erc8004). This is directly about Helixa's use case. ENS is looking for partners.

3. **Contact ENS Labs** — They explicitly want to work with agent identity projects. Introduce Helixa and ERC-8004 integration plans.

4. **Fork the offchain-resolver repo** — Start adapting [ensdomains/offchain-resolver](https://github.com/ensdomains/offchain-resolver) as the base for the L1 resolver + gateway.

5. **Add ENS interfaces to AgentNames.sol** — Begin implementing `IAddrResolver`, `ITextResolver`, `supportsInterface()` on the existing contract.

---

*This document should be treated as a living reference. Update as ENSv2 details emerge and as the agent naming ecosystem evolves.*
