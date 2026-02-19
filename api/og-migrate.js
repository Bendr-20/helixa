const { ethers } = require('ethers');
require('dotenv').config({ path: '/home/ubuntu/.openclaw/workspace/agentdna/.env' });

const OGS = [
  { name: "deola", wallet: "0x20d76f14b9fe678ff17db751492d0b5b1edefa97", code: "deola" },
  { name: "butter alpha", wallet: "0xef05cb759c8397667286663902e79bd29f435e1b", code: "butter" },
  { name: "MrsMillion", wallet: "0xd43e021a28be16d91b75feb62575fe533f27c344", code: "mrsmillion" },
  { name: "MoltBot Agent", wallet: "0x867bbb504cdbfc6742035a810b2cc1fe1c42407c", code: "moltbot" },
  { name: "LienXinOne", wallet: "0x1d15ac2caa30abf43d45ce86ee0cb0f3c8b929f6", code: "lienxin" },
  { name: "irvinecold", wallet: "0x3862f531cf80f3664a287c4de453db8f2452d3eb", code: "irvine" },
  { name: "ANCNAgent", wallet: "0x1a751188343bee997ff2132f5454e0b5da477705", code: "ancn" },
  { name: "mell_agent", wallet: "0x331aa75a851cdbdb5d4e583a6658f9dc5a4f6ba3", code: "mell" },
  { name: "PremeBot", wallet: "0x73286b4ae95358b040f3a405c2c76172e9f46ffa", code: "premebot" },
  { name: "Xai", wallet: "0x34bdbca018125638f63cbac2780d7bd3d069dc83", code: "xai" },
  { name: "Blockhead", wallet: "0x8a4c8bb8f70773b3ab8e18e0f0f469fad4637000", code: "blockhead" },
  { name: "R2d2", wallet: "0xf459dbaa62e3976b937ae9a4f6c31df96cd12a44", code: "r2d2" },
];

const ABI = [
  "function mintFor(address to, address agentAddress, string name, string framework, bool soulbound, uint8 origin) external",
  "function addTrait(uint256 tokenId, string name, string category) external",
  "function addPoints(uint256 tokenId, uint256 amount) external",
  "function hasMinted(address) view returns (bool)",
  "function totalAgents() view returns (uint256)",
  "event AgentRegistered(uint256 indexed tokenId, address indexed agentAddress, string name, string framework)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(process.env.DEPLOYER_KEY, provider);
  const contract = new ethers.Contract(process.env.V2_CONTRACT, ABI, wallet);
  
  console.log(`Deployer: ${wallet.address}`);
  const bal = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(bal)} ETH`);
  console.log(`Contract: ${process.env.V2_CONTRACT}`);
  console.log(`\nMigrating ${OGS.length} V1 OGs...\n`);
  
  for (const og of OGS) {
    // Check if already minted
    const hasMinted = await contract.hasMinted(og.wallet);
    if (hasMinted) {
      console.log(`SKIP ${og.name} — already minted`);
      continue;
    }
    
    try {
      // Mint with MintOrigin.OWNER (3) — owner minting on behalf
      console.log(`Minting ${og.name} → ${og.wallet}...`);
      const tx = await contract.mintFor(og.wallet, og.wallet, og.name, 'custom', false, 3);
      console.log(`  TX: ${tx.hash}`);
      const receipt = await tx.wait();
      
      // Get tokenId
      let tokenId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed?.name === 'AgentRegistered') {
            tokenId = Number(parsed.args.tokenId);
          }
        } catch {}
      }
      console.log(`  Token #${tokenId}`);
      
      if (tokenId !== null) {
        // Add "V1 OG" trait
        const traitTx = await contract.addTrait(tokenId, "V1 OG", "badge");
        await traitTx.wait();
        console.log(`  Added V1 OG trait`);
        
        // Add 200 bonus points
        const ptsTx = await contract.addPoints(tokenId, 200);
        await ptsTx.wait();
        console.log(`  Added 200 pts`);
      }
      
      console.log(`  ✓ ${og.name} done\n`);
    } catch (err) {
      console.error(`  ✗ ${og.name} FAILED: ${err.message}\n`);
    }
  }
  
  const total = await contract.totalAgents();
  console.log(`\nDone. Total agents: ${total}`);
}

main().catch(console.error);
