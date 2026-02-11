import { z } from "zod";

export const RegisterAgentSchema = z.object({
  name: z.string().describe("The agent's name (e.g. 'MyTradingBot')"),
  framework: z.string().describe("The framework the agent runs on (e.g. 'AgentKit', 'LangChain', 'ElizaOS', 'OpenClaw', 'CrewAI')"),
  soulbound: z.boolean().default(true).describe("Whether the identity NFT is soulbound (non-transferable). Default true for serious agents."),
  agentName: z.string().optional().describe("Optional .agent name to register (e.g. 'mybot' becomes mybot.agent). Lowercase a-z, 0-9, hyphens, 3-32 chars."),
  tokenURI: z.string().optional().describe("Optional metadata URI for the agent's identity"),
});

export const GetAgentSchema = z.object({
  tokenId: z.string().describe("The token ID of the agent to look up"),
});

export const GetAgentByAddressSchema = z.object({
  agentAddress: z.string().describe("The wallet address to look up agent identity for"),
});

export const MutateAgentSchema = z.object({
  tokenId: z.string().describe("The token ID of the agent to mutate"),
  newVersion: z.string().describe("The new version string (e.g. '2.0.0')"),
  reason: z.string().describe("The reason for the mutation"),
});

export const AddTraitSchema = z.object({
  tokenId: z.string().describe("The token ID of the agent to add a trait to"),
  traitType: z.string().describe("The trait category (e.g. 'personality', 'skill', 'alignment')"),
  traitValue: z.string().describe("The trait value (e.g. 'analytical', 'defi-trading', 'chaotic-good')"),
});

export const ResolveNameSchema = z.object({
  name: z.string().describe("The .agent name to resolve (without the .agent suffix)"),
});

export const CheckNameSchema = z.object({
  name: z.string().describe("The .agent name to check availability for (without the .agent suffix)"),
});

export const SetAgentWalletSchema = z.object({
  tokenId: z.string().describe("The token ID of the agent"),
  newWallet: z.string().describe("The new wallet address to associate with this agent identity"),
});

export const GetStatsSchema = z.object({}).describe("Get Helixa protocol statistics");
