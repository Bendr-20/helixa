const { ethers } = require('ethers');

const V1_CONTRACT = '0x665971e7bf8ec90c3066162c5b396604b3cd7711';
const ABI = [
  "function getAgentIdentity(uint256 tokenId) view returns (tuple(address agentAddress, string name, string framework, uint64 registeredAt, bool verified, bool soulbound, uint8 origin, uint16 generation, uint256 parentId, uint16 mutationCount, string currentVersion))",
  "function getTraits(uint256 tokenId) view returns (tuple(string name, string value, uint64 addedAt)[])",
  "function totalAgents() view returns (uint256)",
];

// V1 OG token IDs: #3-14 (the named externals)
const OG_IDS = [3,4,5,6,7,8,9,10,11,12,13,14];

async function main() {
  const provider = new ethers.JsonRpcProvider('https://base.drpc.org', undefined, { batchMaxCount: 1 });
  const contract = new ethers.Contract(V1_CONTRACT, ABI, provider);
  
  for (const id of OG_IDS) {
    try {
      const agent = await contract.getAgentIdentity(id);
      const traits = await contract.getTraits(id);
      const traitList = traits.map(t => `${t[0]}=${t[1]}`).join(', ');
      console.log(`V1 #${id} ${agent.name} (${agent.framework}) — ${traits.length} traits: ${traitList || 'none'}`);
    } catch (e) {
      console.log(`V1 #${id} — error: ${e.shortMessage || e.message}`);
    }
  }
}

main().catch(console.error);
