import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { ethers } from "ethers";
import { getContract, parseAgentData } from "../utils";

export const lookupAction: Action = {
  name: "AGENTDNA_LOOKUP",
  description: "Look up an AgentDNA by token ID or wallet address",
  similes: ["LOOKUP_AGENT", "GET_AGENT", "FIND_AGENT", "AGENT_INFO"],

  validate: async (runtime: IAgentRuntime) => {
    return !!runtime.getSetting("AGENTDNA_CONTRACT_ADDRESS");
  },

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown>, callback?: HandlerCallback) => {
    try {
      const { tokenId, agentAddress } = message.content as any;
      const contract = getContract(runtime);

      let agent;
      let id = tokenId;

      if (agentAddress && ethers.isAddress(agentAddress)) {
        const result = await contract.getAgentByAddress(agentAddress);
        id = Number(result[0]);
        agent = parseAgentData(result[1]);
      } else if (tokenId != null) {
        const result = await contract.getAgent(tokenId);
        agent = parseAgentData(result);
      } else {
        callback?.({ text: "Provide either tokenId or agentAddress" });
        return false;
      }

      const lines = [
        `🧬 Agent #${id}`,
        `Owner: ${agent.owner}`,
        `Name: ${agent.name}`,
        `Framework: ${agent.framework}`,
        `Version: ${agent.version}`,
        `Soulbound: ${agent.soulbound}`,
        `Active: ${agent.active}`,
        `Mutations: ${agent.mutationCount}`,
        `Points: ${agent.points}`,
        `Created: ${new Date(agent.createdAt * 1000).toISOString()}`,
      ];

      callback?.({ text: lines.join("\n") });
      return true;
    } catch (err: any) {
      callback?.({ text: `❌ Lookup failed: ${err.message}` });
      return false;
    }
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "Look up agent #42" } },
      { user: "{{agentName}}", content: { text: "🧬 Agent #42\nOwner: 0x...\nName: Atlas" } },
    ],
  ],
};
