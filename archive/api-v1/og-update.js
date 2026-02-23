const { ethers } = require('ethers');
require('dotenv').config({ path: '/home/ubuntu/.openclaw/workspace/agentdna/.env' });

// V2 tokenId → V1 framework mapping
const OGS = [
  { v2: 7, name: "deola", fw: "openclaw" },
  { v2: 8, name: "butter alpha", fw: "autogpt" },
  { v2: 9, name: "MrsMillion", fw: "openclaw" },
  { v2: 10, name: "MoltBot Agent", fw: "openclaw" },
  { v2: 11, name: "LienXinOne", fw: "custom" },
  { v2: 12, name: "PremeBot", fw: "custom" },
  { v2: 2, name: "ANCNAgent", fw: "autogpt" },
  { v2: 19, name: "irvinecold", fw: "custom" },
  { v2: 20, name: "mell_agent", fw: "openclaw" },
  { v2: 22, name: "Xai", fw: "openclaw" },
  { v2: 24, name: "Blockhead", fw: "openclaw" },
  { v2: 25, name: "R2d2", fw: "custom" },
];

const ABI = [
  "function addTrait(uint256 tokenId, string name, string category) external",
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.DEPLOYER_KEY, provider);
  const contract = new ethers.Contract(process.env.V2_CONTRACT, ABI, wallet);
  
  for (const og of OGS) {
    try {
      // Add framework as trait if not 'custom'
      if (og.fw !== 'custom') {
        const fwName = og.fw.charAt(0).toUpperCase() + og.fw.slice(1);
        console.log(`#${og.v2} ${og.name} — adding ${fwName} framework trait...`);
        const tx = await contract.addTrait(og.v2, fwName, "framework");
        await tx.wait();
        console.log(`  ✓ done`);
        await sleep(2500);
      } else {
        console.log(`#${og.v2} ${og.name} — custom framework, skipping`);
      }
    } catch(e) {
      console.error(`  ✗ #${og.v2} FAILED: ${e.shortMessage || e.message}`);
    }
  }
  
  const bal = await provider.getBalance(wallet.address);
  console.log(`\nDone. Remaining: ${ethers.formatEther(bal)} ETH`);
}

main().catch(console.error);
