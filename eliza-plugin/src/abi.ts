/** Minimal ABI for the AgentDNA contract. */
export const AGENT_DNA_ABI = [
  "function register(string agentURI) payable returns (uint256)",
  "function register(string agentURI, tuple(string,bytes)[] metadata) payable returns (uint256)",
  "function mint(address,string,string,string,bool,string,uint256) payable returns (uint256)",
  "function mintWithReferral(address,string,string,string,bool,string,uint256,address) payable returns (uint256)",
  "function addTrait(uint256,string,string) payable",
  "function mutate(uint256,string,string,string) payable",
  "function getAgent(uint256) view returns (address,string,string,uint256,bool,bool,uint256,uint256,string,uint256)",
  "function getAgentByAddress(address) view returns (uint256,tuple(address,string,string,uint256,bool,bool,uint256,uint256,string,uint256))",
  "function points(address) view returns (uint256)",
  "function mintPrice() view returns (uint256)",
  "function totalAgents() view returns (uint256)",
] as const;
