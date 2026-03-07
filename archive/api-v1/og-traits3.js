const { ethers } = require('ethers');
require('dotenv').config({ path: '/home/ubuntu/.openclaw/workspace/agentdna/.env' });

const OG_TOKENS = [2, 7, 8, 9, 10, 11, 12, 19, 20, 22, 24, 25];

const ABI = [
  "function addTrait(uint256 tokenId, string name, string category) external",
  "function addPoints(uint256 tokenId, uint256 amount) external",
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.DEPLOYER_KEY, provider);
  const contract = new ethers.Contract(process.env.V2_CONTRACT, ABI, wallet);
  
  for (const tokenId of OG_TOKENS) {
    try {
      console.log(`#${tokenId} — adding V1 OG + 200 pts...`);
      
      const tx1 = await contract.addTrait(tokenId, "V1 OG", "badge");
      await tx1.wait();
      console.log(`  + V1 OG trait`);
      
      await sleep(3000);
      
      const tx2 = await contract.addPoints(tokenId, 200);
      await tx2.wait();
      console.log(`  + 200 pts ✓`);
      
      await sleep(3000);
    } catch (err) {
      console.error(`  ✗ #${tokenId} FAILED: ${err.shortMessage || err.message}`);
    }
  }
  
  const endBal = await provider.getBalance(wallet.address);
  console.log(`\nDone. Remaining: ${ethers.formatEther(endBal)} ETH`);
}

main().catch(console.error);
