import { ethers } from "ethers";
import { AGENT_DNA_ABI } from "./abi";
import type { IAgentRuntime } from "@elizaos/core";

const DEFAULT_RPC = "https://mainnet.base.org";
const V2_API = "https://api.helixa.xyz";
const V2_CONTRACT = "0x2e3B541C59D38b84E3Bc54e977200230A204Fe60";
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
  const addr = runtime.getSetting("AGENTDNA_CONTRACT_ADDRESS") || V2_CONTRACT;
  return new ethers.Contract(addr, AGENT_DNA_ABI, getProvider(runtime));
}

/** Get a writable contract instance (with signer). */
export function getWritableContract(runtime: IAgentRuntime): ethers.Contract {
  const addr = runtime.getSetting("AGENTDNA_CONTRACT_ADDRESS") || V2_CONTRACT;
  return new ethers.Contract(addr, AGENT_DNA_ABI, getSigner(runtime));
}

/** Get the V2 API base URL from settings or default. */
export function getApiUrl(runtime: IAgentRuntime): string {
  return runtime.getSetting("HELIXA_API_URL") || V2_API;
}

/** Build SIWA authorization header for V2 API. */
export async function buildSIWAAuth(runtime: IAgentRuntime): Promise<string> {
  const signer = getSigner(runtime);
  const address = await signer.getAddress();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${address} at ${timestamp}`;
  const signature = await signer.signMessage(message);
  return `Bearer ${address}:${timestamp}:${signature}`;
}

/** Mint agent via V2 API with SIWA auth. Returns the API response. */
export async function mintViaV2API(
  runtime: IAgentRuntime,
  params: {
    name: string;
    framework?: string;
    soulbound?: boolean;
    personality?: {
      quirks?: string;
      communicationStyle?: string;
      values?: string;
      humor?: string;
      riskTolerance?: number;
      autonomyLevel?: number;
    };
    narrative?: {
      origin?: string;
      mission?: string;
      lore?: string;
      manifesto?: string;
    };
    referralCode?: string;
  }
): Promise<any> {
  const apiUrl = getApiUrl(runtime);
  const auth = await buildSIWAAuth(runtime);

  const res = await fetch(`${apiUrl}/api/v2/mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body: JSON.stringify({
      name: params.name,
      framework: params.framework || "ElizaOS",
      soulbound: params.soulbound ?? false,
      personality: params.personality,
      narrative: params.narrative,
      referralCode: params.referralCode,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Mint failed (${res.status})`);
  }
  return data;
}

/** Fetch agent from V2 API. */
export async function fetchAgentV2(runtime: IAgentRuntime, tokenId: number): Promise<any> {
  const apiUrl = getApiUrl(runtime);
  const res = await fetch(`${apiUrl}/api/v2/agent/${tokenId}`);
  if (!res.ok) throw new Error(`Agent #${tokenId} not found`);
  return res.json();
}

/** Fetch cred score from V2 API. */
export async function fetchCredScore(runtime: IAgentRuntime, tokenId: number): Promise<any> {
  const apiUrl = getApiUrl(runtime);
  const res = await fetch(`${apiUrl}/api/v2/agent/${tokenId}/cred`);
  if (!res.ok) throw new Error(`Cred score not available for #${tokenId}`);
  return res.json();
}

/** Update agent via V2 API with SIWA auth. */
export async function updateAgentV2(
  runtime: IAgentRuntime,
  tokenId: number,
  params: {
    personality?: any;
    narrative?: any;
    traits?: Array<{ name: string; category: string }>;
  }
): Promise<any> {
  const apiUrl = getApiUrl(runtime);
  const auth = await buildSIWAAuth(runtime);

  const res = await fetch(`${apiUrl}/api/v2/agent/${tokenId}/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Update failed (${res.status})`);
  return data;
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
