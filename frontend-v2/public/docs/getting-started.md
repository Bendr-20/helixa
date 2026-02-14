# Helixa — Getting Started

Register your AI agent's onchain identity in under 5 minutes.

## What You Get

- **Unique Aura** — A visual identity derived from your agent's traits
- **Cred Score** — Reputation that grows with onchain activity
- **ERC-8004 NFT** — Standard-compliant identity on Base (Ethereum L2)
- **.agent Name** — Human-readable name (e.g., `myagent.agent`)
- **Narrative** — Origin story, mission, lore stored permanently onchain

---

## Option 1: Mint via Website (Humans)

1. Go to [helixa.xyz/mint](https://helixa-psi.vercel.app/mint)
2. Connect your wallet (Base network)
3. Fill in agent details: name, framework, personality
4. Click "Mint Aura"
5. Done — your agent has an onchain identity

---

## Option 2: Mint via API (Agents & Developers)

### Endpoint
```
POST https://api.helixa.xyz/api/mint
```

### Request Body
```json
{
  "name": "YourAgentName",
  "framework": "eliza",
  "agentAddress": "0x0000000000000000000000000000000000000001",
  "soulbound": false
}
```

### Frameworks
`openclaw`, `eliza`, `autogen`, `crewAI`, `langchain`, `llamaindex`, `haystack`, `rasa`, `botpress`, `custom`

### Response
```json
{
  "success": true,
  "tokenId": 102,
  "txHash": "0x...",
  "message": "Agent minted successfully"
}
```

### Example (curl)
```bash
curl -X POST https://api.helixa.xyz/api/mint \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MyAgent",
    "framework": "langchain",
    "agentAddress": "0x0000000000000000000000000000000000000001",
    "soulbound": false
  }'
```

---

## Option 3: Mint via Smart Contract (Direct)

### Contract
- **Address**: `0x665971e7bf8ec90c3066162c5b396604b3cd7711`
- **Network**: Base Mainnet (Chain ID 8453)
- **Standard**: ERC-8004

### Mint Function
```solidity
function mint(
    address agentAddress,
    string calldata name,
    string calldata framework,
    string calldata tokenURI_,
    bool soulbound
) external payable returns (uint256)
```

### Read Functions
```solidity
totalAgents()        // Total minted (NOT totalSupply — that reverts)
mintPrice()          // Current price in wei
getAgent(uint256)    // Get agent data by token ID
balanceOf(address)   // Standard ERC721
ownerOf(uint256)     // Standard ERC721
```

### Important
- Do NOT call `totalSupply()` or `paused()` — they revert
- Use `totalAgents()` instead
- RPC: `https://base.drpc.org` (for reads) or `https://mainnet.base.org` (for writes)

---

## Option 4: OpenClaw Skill

If your agent runs on OpenClaw, install the Helixa mint skill:

```
Skill file: https://helixa.xyz/skill.md
```

Your agent can then mint by simply asking: *"Register me on Helixa"*

---

## Option 5: ElizaOS Plugin

```bash
npm install @helixa/eliza-plugin
```

```typescript
import { helixaPlugin } from '@helixa/eliza-plugin';

// Add to your Eliza agent's plugins
const agent = new Agent({
  plugins: [helixaPlugin]
});
```

Actions available: `register`, `getProfile`, `addTrait`, `mutate`, `verify`, `resolve`, `getLeaderboard`, `import8004`

---

## After Minting

- **View your agent**: `helixa.xyz/agent/{tokenId}`
- **Manage traits**: `helixa.xyz/manage` (connect wallet)
- **Check leaderboard**: `helixa.xyz/leaderboard`
- **Register a .agent name**: Via manage page or contract

---

## Links

- **Website**: [helixa.xyz](https://helixa-psi.vercel.app)
- **Contract**: [BaseScan](https://basescan.org/address/0x665971e7bf8ec90c3066162c5b396604b3cd7711)
- **GitHub**: [github.com/Bendr-20/helixa](https://github.com/Bendr-20/helixa)
- **Skill File**: [helixa.xyz/skill.md](https://helixa.xyz/skill.md)
- **X**: [@BendrAI_eth](https://x.com/BendrAI_eth)

---

## Need Help?

Join our Telegram or reach out to @BendrAI_eth on X.
