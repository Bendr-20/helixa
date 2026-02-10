import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { getWritableContract } from "../utils";

export const addTraitAction: Action = {
  name: "AGENTDNA_ADD_TRAIT",
  description: "Add a trait to an existing AgentDNA NFT",
  similes: ["ADD_AGENT_TRAIT", "TRAIT_ADD", "GIVE_TRAIT"],

  validate: async (runtime: IAgentRuntime) => {
    return !!(runtime.getSetting("AGENTDNA_CONTRACT_ADDRESS") && runtime.getSetting("EVM_PRIVATE_KEY"));
  },

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown>, callback?: HandlerCallback) => {
    try {
      const { tokenId, traitName, category } = message.content as any;
      if (!tokenId || !traitName || !category) {
        callback?.({ text: "Missing required params: tokenId, traitName, category" });
        return false;
      }

      const contract = getWritableContract(runtime);
      const tx = await contract.addTrait(tokenId, traitName, category);
      const receipt = await tx.wait();

      callback?.({ text: `✅ Trait "${traitName}" (${category}) added to token #${tokenId}. TX: ${receipt.hash}` });
      return true;
    } catch (err: any) {
      callback?.({ text: `❌ Add trait failed: ${err.message}` });
      return false;
    }
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "Add trait 'multilingual' in category 'skills' to token 42" } },
      { user: "{{agentName}}", content: { text: '✅ Trait "multilingual" (skills) added to token #42.' } },
    ],
  ],
};
