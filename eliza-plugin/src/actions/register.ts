import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { getWritableContract, getContract } from "../utils";

export const registerAction: Action = {
  name: "AGENTDNA_REGISTER",
  description: "Register a new agent with just a URI",
  similes: ["REGISTER_AGENT", "SIMPLE_MINT", "REGISTER_DNA"],

  validate: async (runtime: IAgentRuntime) => {
    return !!(runtime.getSetting("AGENTDNA_CONTRACT_ADDRESS") && runtime.getSetting("EVM_PRIVATE_KEY"));
  },

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown>, callback?: HandlerCallback) => {
    try {
      const { agentURI } = message.content as any;
      if (!agentURI) {
        callback?.({ text: "Missing required param: agentURI" });
        return false;
      }

      const contract = getWritableContract(runtime);
      const mintPrice = await getContract(runtime).mintPrice();
      const tx = await contract["register(string)"](agentURI, { value: mintPrice });
      const receipt = await tx.wait();

      callback?.({ text: `✅ Agent registered! TX: ${receipt.hash}` });
      return true;
    } catch (err: any) {
      callback?.({ text: `❌ Register failed: ${err.message}` });
      return false;
    }
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "Register an agent with URI ipfs://Qm..." } },
      { user: "{{agentName}}", content: { text: "✅ Agent registered! TX: 0x..." } },
    ],
  ],
};
