import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { get8004WritableContract, build8004URI } from "../utils";

export const register8004Action: Action = {
  name: "AGENTDNA_REGISTER_8004",
  description: "Register on 8004.org after minting AgentDNA. Creates a cross-chain identity on the official ERC-8004 registry with a back-reference to your AgentDNA token.",
  similes: ["REGISTER_8004", "CROSS_REGISTER", "EXPORT_TO_8004"],

  validate: async (runtime: IAgentRuntime) => {
    return !!(runtime.getSetting("AGENTDNA_CONTRACT_ADDRESS") && runtime.getSetting("EVM_PRIVATE_KEY"));
  },

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown>, callback?: HandlerCallback) => {
    try {
      const { name, description, agentAddress, agentDnaTokenId } = message.content as any;
      if (!name || agentDnaTokenId === undefined || !agentAddress) {
        callback?.({ text: "Missing required params: name, agentAddress, agentDnaTokenId" });
        return false;
      }

      const contractAddr = runtime.getSetting("AGENTDNA_CONTRACT_ADDRESS")!;
      const uri = build8004URI({
        name,
        description: description || `${name} — registered via Helixa`,
        agentAddress,
        agentDnaTokenId: Number(agentDnaTokenId),
        agentDnaContract: contractAddr,
      });

      callback?.({ text: `📡 Registering on 8004.org...` });
      const erc8004 = get8004WritableContract(runtime);
      const tx = await erc8004.register(uri);
      const receipt = await tx.wait();

      callback?.({ text: `✅ Registered on 8004.org! AgentDNA #${agentDnaTokenId} is now cross-referenced. TX: ${receipt.hash}` });
      return true;
    } catch (err: any) {
      callback?.({ text: `❌ 8004 registration failed: ${err.message}` });
      return false;
    }
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "Register my AgentDNA #5 on 8004.org too" } },
      { user: "{{agentName}}", content: { text: "✅ Registered on 8004.org! AgentDNA #5 is now cross-referenced. TX: 0x..." } },
    ],
  ],
};
