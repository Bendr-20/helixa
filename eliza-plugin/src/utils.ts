import { ethers } from "ethers";
import { AGENT_DNA_ABI } from "./abi";
import type { IAgentRuntime } from "@elizaos/core";

const DEFAULT_RPC = "https://mainnet.base.org";
const ERC8004_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const ERC8004_ABI = [
  "function register(string agentURI) external returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getAgentWallet(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
];

/** Get an ethers provider from runtime settings. */
export function getProvider(runtime: IAgentRuntime): ethers.JsonRpcProvider {
  const rpc = runtime.getSetting("EVM_PROVIDER_URL") || DEFAULT_RPC;
  return new ethers.JsonRpcProvider(rpc);
}

/** Get a wallet signer from the runtime's EVM_PRIVATE_KEY setting. */
export function getSigner(runtime: IAgentRuntime): ethers.Wallet {
  const key = runtime.getSetting("EVM_PRIVATE_KEY");
  if (!key) throw new Error("EVM_PRIVATE_KEY not configured");
  return new ethers.Wallet(key, getProvider(runtime));
}

/** Get a read-only contract instance. */
export function getContract(runtime: IAgentRuntime): ethers.Contract {
  const addr = runtime.getSetting("AGENTDNA_CONTRACT_ADDRESS");
  if (!addr) throw new Error("AGENTDNA_CONTRACT_ADDRESS not configured");
  return new ethers.Contract(addr, AGENT_DNA_ABI, getProvider(runtime));
}

/** Get a writable contract instance (with signer). */
export function getWritableContract(runtime: IAgentRuntime): ethers.Contract {
  const addr = runtime.getSetting("AGENTDNA_CONTRACT_ADDRESS");
  if (!addr) throw new Error("AGENTDNA_CONTRACT_ADDRESS not configured");
  return new ethers.Contract(addr, AGENT_DNA_ABI, getSigner(runtime));
}

/** Build a base64-encoded data URI for agent metadata. */
export function buildMetadataURI(params: {
  name: string;
  framework: string;
  version: string;
  soulbound: boolean;
  description?: string;
}): string {
  const metadata = {
    name: params.name,
    description: params.description || `${params.name} — an AI agent on ${params.framework}`,
    attributes: [
      { trait_type: "framework", value: params.framework },
      { trait_type: "version", value: params.version },
      { trait_type: "soulbound", value: params.soulbound },
    ],
  };
  const json = JSON.stringify(metadata);
  const b64 = Buffer.from(json).toString("base64");
  return `data:application/json;base64,${b64}`;
}

/** Get a read-only 8004.org registry contract. */
export function get8004Contract(runtime: IAgentRuntime): ethers.Contract {
  return new ethers.Contract(ERC8004_REGISTRY, ERC8004_ABI, getProvider(runtime));
}

/** Get a writable 8004.org registry contract. */
export function get8004WritableContract(runtime: IAgentRuntime): ethers.Contract {
  return new ethers.Contract(ERC8004_REGISTRY, ERC8004_ABI, getSigner(runtime));
}

/** Fetch and parse an 8004 agent's metadata by token ID. */
export async function fetch8004Agent(runtime: IAgentRuntime, tokenId: number) {
  const contract = get8004Contract(runtime);
  const uri = await contract.tokenURI(tokenId);
  const owner = await contract.ownerOf(tokenId);
  const wallet = await contract.getAgentWallet(tokenId);
  let metadata: any = {};
  if (typeof uri === "string" && uri.startsWith("data:application/json;base64,")) {
    metadata = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString());
  }
  return { tokenId, uri, owner, wallet, metadata };
}

/** Build an 8004-compliant agent URI with cross-reference to AgentDNA. */
export function build8004URI(params: {
  name: string;
  description: string;
  agentAddress: string;
  agentDnaTokenId: number;
  agentDnaContract: string;
  chainId?: number;
}): string {
  const agentURI = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: params.name,
    description: params.description,
    services: [
      { name: "agentWallet", endpoint: `eip155:${params.chainId || 8453}:${params.agentAddress}` }
    ],
    registrations: [
      { agentId: params.agentDnaTokenId, agentRegistry: `eip155:${params.chainId || 8453}:${params.agentDnaContract}` }
    ],
    active: true,
  };
  return `data:application/json;base64,${Buffer.from(JSON.stringify(agentURI)).toString("base64")}`;
}

/** Parse the tuple returned by getAgent into a readable object. */
export function parseAgentData(data: any[]) {
  return {
    owner: data[0],
    name: data[1],
    framework: data[2],
    version: Number(data[3]),
    soulbound: data[4],
    active: data[5],
    createdAt: Number(data[6]),
    mutationCount: Number(data[7]),
    tokenURI: data[8],
    points: Number(data[9]),
  };
}
