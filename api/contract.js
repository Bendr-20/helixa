import { ethers } from "ethers";

const RPC = process.env.RPC_URL || "https://sepolia.base.org";
const CONTRACT = process.env.CONTRACT_ADDRESS || "0x2e3B541C59D38b84E3Bc54e977200230A204Fe60";

// Minimal ABI — only the view functions we need
const ABI = [
  "function getAgent(uint256 tokenId) view returns (tuple(address agentAddress, string name, string framework, uint256 mintedAt, bool verified, bool soulbound, uint256 generation, uint256 parentDNA, string currentVersion, uint256 mutationCount))",
  "function getPersonality(uint256 tokenId) view returns (tuple(string temperament, string communicationStyle, uint8 riskTolerance, uint8 autonomyLevel, string alignment, string specialization))",
  "function getTraits(uint256 tokenId) view returns (tuple(string name, string category, uint256 addedAt)[])",
  "function getMutations(uint256 tokenId) view returns (tuple(string fromVersion, string toVersion, string description, uint256 timestamp)[])",
  "function isVerified(uint256 tokenId) view returns (bool)",
  "function points(address) view returns (uint256)",
  "function totalAgents() view returns (uint256)",
  "function totalPointsAwarded() view returns (uint256)",
  "function betaEnded() view returns (bool)",
  "function hasAgent(address) view returns (bool)",
  "function agentAddressToToken(address) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
];

const provider = new ethers.JsonRpcProvider(RPC);
const contract = new ethers.Contract(CONTRACT, ABI, provider);

export { contract, provider };
