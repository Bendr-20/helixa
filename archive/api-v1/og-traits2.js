const { ethers } = require('ethers');
require('dotenv').config({ path: '/home/ubuntu/.openclaw/workspace/agentdna/.env' });

// First-copy OG token IDs (not the duplicates)
const OG_TOKENS = [2, 7, 8, 9, 10, 11, 12, 19, 20, 22, 24, 25];

const ABI = [
  "function addTrait(uint256 tokenId, string name, string category) external",
  "function addPoints(uint256 tokenId, uint256 amount) external",
  "function getTraits(uint256 tokenId) view returns (tuple(string name, string category, uint256 addedAt)[])",
  "function getAgent(uint256 tokenId) view returns (tuple(uint256 tokenId, address agentAddress, string name, string framework, uint256 createdAt, bool verified, bool soulbound, uint8 mintOrigin, uint256 generation, string version, uint256 mutationCount, uint256 points))",
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const readProvider = new ethers.JsonRpcProvider('https://base.drpc.org', undefined, { batchMaxCount: 1 });
  const writeProvider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.DEPLOYER_KEY, writeProvider);
  const readContract = new ethers.Contract(process.env.V2_CONTRACT, ABI, readProvider);
  const writeContract = new ethers.Contract(process.env.V2_CONTRACT, ABI, wallet);
  
  for (const tokenId of OG_TOKENS) {
    try {
      const agent = await readContract.getAgent(tokenId);
      const name = agent[2];
      
      // Check existing traits
      const traits = await readContract.getTraits(tokenId);
      const hasOG = traits.some(t => t[0] === 'V1 OG');
      
      if (hasOG) {
        console.log(`#${tokenId} ${name} — already has V1 OG, skip`);
        continue;
      }
      
      console.log(`#${tokenId} ${name} — adding V1 OG + 200 pts...`);
      
      await sleep(2500);
      const tx1 = await writeContract.addTrait(tokenId, "V1 OG", "badge");
      await tx1.wait();
      console.log(`  + V1 OG trait`);
      
      await sleep(2500);
      const tx2 = await writeContract.addPoints(tokenId, 200);
      await tx2.wait();
      console.log(`  + 200 pts ✓\n`);
    } catch (err) {
      console.error(`  ✗ #${tokenId} FAILED: ${err.shortMessage || err.message}\n`);
    }
  }
  
  const endBal = await writeProvider.getBalance(wallet.address);
  console.log(`Done. Remaining: ${ethers.formatEther(endBal)} ETH`);
}

main().catch(console.error);
