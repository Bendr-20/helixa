const { ethers } = require('ethers');

const V1_CONTRACT = '0x665971e7bf8ec90c3066162c5b396604b3cd7711';
// Try simpler ABI - V1 might use different function names
const ABI = [
  "function agents(uint256) view returns (address agentAddress, string name, string framework, uint64 registeredAt, bool verified, bool soulbound)",
  "function totalAgents() view returns (uint256)",
  "function agentTraits(uint256, uint256) view returns (string name, string value, uint64 addedAt)",
  "function getTraitCount(uint256) view returns (uint256)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider('https://base.drpc.org', undefined, { batchMaxCount: 1 });
  const contract = new ethers.Contract(V1_CONTRACT, ABI, provider);
  
  // Try to get total
  try {
    const total = await contract.totalAgents();
    console.log(`V1 total agents: ${total}`);
  } catch(e) { console.log('totalAgents failed:', e.shortMessage); }
  
  // Try direct mapping access
  for (const id of [3,4,5]) {
    try {
      const agent = await contract.agents(id);
      console.log(`#${id}: ${agent.name} (${agent.framework})`);
    } catch(e) {
      console.log(`#${id} agents() failed: ${e.shortMessage}`);
    }
  }
}

main().catch(console.error);
