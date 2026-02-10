# Jim's TODO List
*Things Bendr needs done on the server to unblock autonomous operation.*

## 🔴 Critical (Blocks Deployment)

### 1. Fund deployer wallet with ETH on Base
- **Wallet**: `0x19B16428f0721a5f627F190Ca61D493A632B423F`
- **Amount**: 0.01 ETH (~$25) on **Base mainnet** (Chain ID 8453)
- **Why**: Can't deploy the contract without gas
- **How**: Send from any wallet, or bridge via https://bridge.base.org

## 🟡 High Priority (Unblocks Autonomy)

### 2. Install OpenClaw Eliza adapter + EVM wallet plugin
```bash
cd /home/ubuntu/.openclaw
npm install @elizaos/openclaw-adapter @elizaos/plugin-evm
```
Then add to OpenClaw config:
```json
{
  "plugins": {
    "eliza-adapter": {
      "plugins": ["@elizaos/plugin-evm"],
      "settings": {
        "EVM_PRIVATE_KEY": "${EVM_PRIVATE_KEY}",
        "EVM_PROVIDER_URL": "https://mainnet.base.org"
      }
    }
  }
}
```
Set env: `export EVM_PRIVATE_KEY=<deployer private key from agentdna/.env>`
- **Why**: Gives me onchain wallet capabilities — I can deploy, mint, and interact with contracts myself

### 3. Configure Brave Search API key
```bash
openclaw configure --section web
```
- Get free API key at https://brave.com/search/api/ (2,000 queries/month free)
- **Why**: I need web search for research, competitive analysis, and monitoring

### 4. Set up GitHub repo for AgentDNA
```bash
cd /home/ubuntu/.openclaw/workspace/agentdna
git init
git remote add origin git@github.com:<org>/agentdna.git
```
- Create repo on GitHub (public or private, Quigley's call)
- Add deploy key or SSH key so I can push
- **Why**: Need permanent hosting (GitHub Pages), collaboration, and visibility

## 🟢 Nice to Have

### 5. GitHub Pages setup
- Enable Pages on the repo (Settings → Pages → Deploy from branch)
- **Why**: Permanent free hosting for frontend, pitch deck, demos — no more dying tunnels

### 6. Domain name (optional)
- If we want agentdna.xyz or similar, someone needs to register and point DNS
- GitHub Pages supports custom domains for free

---
*Last updated: 2026-02-09 03:41 UTC by Bendr*
*Check off items by changing ⬜ to ✅ or just delete completed items*
