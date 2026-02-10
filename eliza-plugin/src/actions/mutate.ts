import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { getWritableContract } from "../utils";

export const mutateAction: Action = {
  name: "AGENTDNA_MUTATE",
  description: "Evolve/mutate an existing AgentDNA NFT to a new version",
  similes: ["EVOLVE_AGENT", "MUTATE_DNA", "UPGRADE_AGENT", "AGENT_EVOLUTION"],

  validate: async (runtime: IAgentRuntime) => {
    return !!(runtime.getSetting("AGENTDNA_CONTRACT_ADDRESS") && runtime.getSetting("EVM_PRIVATE_KEY"));
  },

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown>, callback?: HandlerCallback) => {
    try {
      const { tokenId, newVersion, description, newTokenURI } = message.content as any;
      if (!tokenId || !newVersion || !description) {
        callback?.({ text: "Missing required params: tokenId, newVersion, description" });
        return false;
      }

      const contract = getWritableContract(runtime);
      const tx = await contract.mutate(tokenId, newVersion, description, newTokenURI || "");
      const receipt = await tx.wait();

      callback?.({ text: `✅ Agent #${tokenId} mutated to v${newVersion}. TX: ${receipt.hash}` });
      return true;
    } catch (err: any) {
      callback?.({ text: `❌ Mutation failed: ${err.message}` });
      return false;
    }
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "Mutate agent #7 to version 2 with description 'Added memory module'" } },
      { user: "{{agentName}}", content: { text: "✅ Agent #7 mutated to v2." } },
    ],
  ],
};
