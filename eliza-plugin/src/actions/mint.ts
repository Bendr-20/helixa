import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { getWritableContract, getContract, buildMetadataURI } from "../utils";

export const mintAction: Action = {
  name: "AGENTDNA_MINT",
  description: "Mint a new AgentDNA NFT with full metadata (name, framework, version, soulbound flag)",
  similes: ["MINT_AGENT", "CREATE_AGENT_DNA", "MINT_DNA", "CREATE_ONCHAIN_IDENTITY"],

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    return !!(
      runtime.getSetting("AGENTDNA_CONTRACT_ADDRESS") &&
      runtime.getSetting("EVM_PRIVATE_KEY")
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State | undefined,
    _options: Record<string, unknown>,
    callback?: HandlerCallback
  ) => {
    try {
      const content = message.content as any;
      const name: string = content.name;
      const framework: string = content.framework || "ElizaOS";
      const agentAddress: string = content.agentAddress;
      const soulbound: boolean = content.soulbound ?? true;
      const version: string = content.version || "1";
      const referrer: string | undefined = content.referrer;

      if (!name || !agentAddress) {
        callback?.({ text: "Missing required params: name and agentAddress" });
        return false;
      }

      const tokenURI = buildMetadataURI({ name, framework, version, soulbound });
      const contract = getWritableContract(runtime);
      const mintPrice = await getContract(runtime).mintPrice();

      let tx;
      if (referrer) {
        tx = await contract.mintWithReferral(
          agentAddress, name, framework, tokenURI, soulbound, version, mintPrice,
          referrer, { value: mintPrice }
        );
      } else {
        tx = await contract.mint(
          agentAddress, name, framework, tokenURI, soulbound, version, mintPrice,
          { value: mintPrice }
        );
      }

      const receipt = await tx.wait();
      callback?.({
        text: `✅ AgentDNA minted! TX: ${receipt.hash}\nName: ${name} | Framework: ${framework} | Soulbound: ${soulbound}`,
      });
      return true;
    } catch (err: any) {
      callback?.({ text: `❌ Mint failed: ${err.message}` });
      return false;
    }
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "Mint an AgentDNA NFT called Atlas on ElizaOS for 0xABC..." } },
      { user: "{{agentName}}", content: { text: "✅ AgentDNA minted! TX: 0x..." } },
    ],
  ],
};
