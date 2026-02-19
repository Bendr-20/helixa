const { ethers } = require('ethers');
const V1_CONTRACT = '0x665971e7bf8ec90c3066162c5b396604b3cd7711';
const ABI = [
  "function agents(uint256) view returns (address agentAddress, string name, string framework, uint64 registeredAt, bool verified, bool soulbound)",
  "function getTraitCount(uint256) view returns (uint256)",
  "function agentTraits(uint256, uint256) view returns (string name, string value, uint64 addedAt)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider('https://base.drpc.org', undefined, { batchMaxCount: 1 });
  const contract = new ethers.Contract(V1_CONTRACT, ABI, provider);
  
  for (const id of [3,4,5,6,7,8,9,10,11,12,13,14]) {
    try {
      const agent = await contract.agents(id);
      let traits = [];
      try {
        const count = await contract.getTraitCount(id);
        for (let i = 0; i < Number(count); i++) {
          const t = await contract.agentTraits(id, i);
          traits.push(`${t.name}=${t.value}`);
        }
      } catch(e) {}
      console.log(`V1 #${id} ${agent.name} | fw:${agent.framework} | addr:${agent.agentAddress} | traits: ${traits.join(', ') || 'none'}`);
    } catch(e) {
      console.log(`V1 #${id} error: ${e.shortMessage}`);
    }
  }
}
main().catch(console.error);
