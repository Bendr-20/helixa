import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { getWritableContract, getContract, fetch8004Agent, buildMetadataURI } from "../utils";
import { ethers } from "ethers";

export const import8004Action: Action = {
  name: "AGENTDNA_IMPORT_8004",
  description: "Import an existing 8004.org identity into AgentDNA. Pulls name, description, and wallet from the 8004 registry and mints an AgentDNA NFT with a cross-reference.",
  similes: ["IMPORT_8004", "IMPORT_FROM_8004", "LINK_8004"],

  validate: async (runtime: IAgentRuntime) => {
    return !!(runtime.getSetting("AGENTDNA_CONTRACT_ADDRESS") && runtime.getSetting("EVM_PRIVATE_KEY"));
  },

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown>, callback?: HandlerCallback) => {
    try {
      const { tokenId8004, framework, soulbound } = message.content as any;
      if (tokenId8004 === undefined) {
        callback?.({ text: "Missing required param: tokenId8004 (your 8004.org token ID)" });
        return false;
      }

      callback?.({ text: `🔍 Fetching 8004.org identity #${tokenId8004}...` });
      const agent8004 = await fetch8004Agent(runtime, Number(tokenId8004));
      const name = agent8004.metadata?.name || `Agent-${tokenId8004}`;
      const description = agent8004.metadata?.description || "";
      const agentAddr = agent8004.wallet !== ethers.ZeroAddress ? agent8004.wallet : agent8004.owner;

      // Build metadata with 8004 cross-reference
      const metadata = {
        name,
        description,
        erc8004: { tokenId: Number(tokenId8004), registry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", chain: "base" },
        attributes: [
          { trait_type: "framework", value: framework || "custom" },
          { trait_type: "imported_from", value: "8004.org" },
        ],
      };
      const tokenURI = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString("base64")}`;

      const contract = getWritableContract(runtime);
      const mintPrice = await getContract(runtime).mintPrice();
      const tx = await contract.mint(
        agentAddr, name, framework || "custom", tokenURI, soulbound || false,
        "1.0.0", ethers.MaxUint256, { value: mintPrice }
      );
      const receipt = await tx.wait();

      callback?.({ text: `✅ Imported 8004 #${tokenId8004} → AgentDNA! Name: ${name}, TX: ${receipt.hash}` });
      return true;
    } catch (err: any) {
      callback?.({ text: `❌ Import failed: ${err.message}` });
      return false;
    }
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "Import my 8004 identity #1 into AgentDNA" } },
      { user: "{{agentName}}", content: { text: "✅ Imported 8004 #1 → AgentDNA! Name: ClawNews, TX: 0x..." } },
    ],
  ],
};
