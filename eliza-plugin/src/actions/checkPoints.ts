import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { ethers } from "ethers";
import { getContract } from "../utils";

export const checkPointsAction: Action = {
  name: "AGENTDNA_CHECK_POINTS",
  description: "Check the AgentDNA points balance for an address",
  similes: ["CHECK_POINTS", "AGENT_POINTS", "POINTS_BALANCE", "DNA_POINTS"],

  validate: async (runtime: IAgentRuntime) => {
    return !!runtime.getSetting("AGENTDNA_CONTRACT_ADDRESS");
  },

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown>, callback?: HandlerCallback) => {
    try {
      const { address } = message.content as any;
      if (!address || !ethers.isAddress(address)) {
        callback?.({ text: "Provide a valid Ethereum address" });
        return false;
      }

      const contract = getContract(runtime);
      const pts = await contract.points(address);

      callback?.({ text: `🏆 Points for ${address}: ${pts.toString()}` });
      return true;
    } catch (err: any) {
      callback?.({ text: `❌ Points check failed: ${err.message}` });
      return false;
    }
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "Check points for 0xABC..." } },
      { user: "{{agentName}}", content: { text: "🏆 Points for 0xABC...: 150" } },
    ],
  ],
};
