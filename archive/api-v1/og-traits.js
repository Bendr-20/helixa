const { ethers } = require('ethers');
require('dotenv').config({ path: '/home/ubuntu/.openclaw/workspace/agentdna/.env' });

const OGS = [
  "0x20d76f14b9fe678ff17db751492d0b5b1edefa97",
  "0xef05cb759c8397667286663902e79bd29f435e1b",
  "0xd43e021a28be16d91b75feb62575fe533f27c344",
  "0x867bbb504cdbfc6742035a810b2cc1fe1c42407c",
  "0x1d15ac2caa30abf43d45ce86ee0cb0f3c8b929f6",
  "0x3862f531cf80f3664a287c4de453db8f2452d3eb",
  "0x1a751188343bee997ff2132f5454e0b5da477705",
  "0x331aa75a851cdbdb5d4e583a6658f9dc5a4f6ba3",
  "0x73286b4ae95358b040f3a405c2c76172e9f46ffa",
  "0x34bdbca018125638f63cbac2780d7bd3d069dc83",
  "0x8a4c8bb8f70773b3ab8e18e0f0f469fad4637000",
  "0xf459dbaa62e3976b937ae9a4f6c31df96cd12a44",
];

const ABI = [
  "function addTrait(uint256 tokenId, string name, string category) external",
  "function addPoints(uint256 tokenId, uint256 amount) external",
  "function getAgentByAddress(address) view returns (tuple(uint256 tokenId, address agentAddress, string name, string framework, uint256 createdAt, bool verified, bool soulbound, uint8 mintOrigin, uint256 generation, string version, uint256 mutationCount, uint256 points))",
  "function getTraits(uint256 tokenId) view returns (tuple(string name, string category, uint256 addedAt)[])",
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const readProvider = new ethers.JsonRpcProvider('https://base.drpc.org', undefined, { batchMaxCount: 1 });
  const writeProvider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.DEPLOYER_KEY, writeProvider);
  const readContract = new ethers.Contract(process.env.V2_CONTRACT, ABI, readProvider);
  const writeContract = new ethers.Contract(process.env.V2_CONTRACT, ABI, wallet);
  
  for (const addr of OGS) {
    try {
      const agent = await readContract.getAgentByAddress(addr);
      const tokenId = Number(agent[0]);
      const name = agent[2];
      console.log(`${name} → Token #${tokenId}`);
      
      // Check if already has V1 OG trait
      const traits = await readContract.getTraits(tokenId);
      const hasOG = traits.some(t => t[0] === 'V1 OG');
      
      if (hasOG) {
        console.log(`  Already has V1 OG trait, skipping`);
        continue;
      }
      
      // Add trait
      await sleep(2000);
      const tx1 = await writeContract.addTrait(tokenId, "V1 OG", "badge");
      await tx1.wait();
      console.log(`  + V1 OG trait`);
      
      // Add points
      await sleep(2000);
      const tx2 = await writeContract.addPoints(tokenId, 200);
      await tx2.wait();
      console.log(`  + 200 pts`);
      console.log(`  ✓ done\n`);
    } catch (err) {
      console.error(`  ✗ ${addr} FAILED: ${err.shortMessage || err.message}\n`);
    }
  }
  console.log('All done.');
}

main().catch(console.error);
