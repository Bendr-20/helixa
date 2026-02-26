import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { mintViaV2API } from "../utils";

export const mintAction: Action = {
  name: "AGENTDNA_MINT",
  description: "Mint a new Helixa agent identity via V2 API with SIWA auth and optional x402 payment",
  similes: ["MINT_AGENT", "CREATE_AGENT_DNA", "MINT_DNA", "CREATE_ONCHAIN_IDENTITY", "HELIXA_MINT"],

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    return !!runtime.getSetting("EVM_PRIVATE_KEY");
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
      const soulbound: boolean = content.soulbound ?? false;
      const referralCode: string | undefined = content.referralCode;

      if (!name) {
        callback?.({ text: "Missing required param: name" });
        return false;
      }

      // Build personality from content if provided
      const personality = content.personality ? {
        quirks: content.personality.quirks,
        communicationStyle: content.personality.communicationStyle,
        values: content.personality.values,
        humor: content.personality.humor,
        riskTolerance: content.personality.riskTolerance,
        autonomyLevel: content.personality.autonomyLevel,
      } : undefined;

      // Build narrative from content if provided
      const narrative = content.narrative ? {
        origin: content.narrative.origin,
        mission: content.narrative.mission,
        lore: content.narrative.lore,
        manifesto: content.narrative.manifesto,
      } : undefined;

      const result = await mintViaV2API(runtime, {
        name,
        framework,
        soulbound,
        personality,
        narrative,
        referralCode,
      });

      const lines = [
        `✅ Helixa Agent minted! Token #${result.tokenId}`,
        `TX: ${result.txHash}`,
        `Name: ${name} | Framework: ${framework}`,
        `Explorer: ${result.explorer}`,
      ];
      if (result.crossRegistration) {
        lines.push(`8004 Registry: #${result.crossRegistration.agentId}`);
      }
      if (result.yourReferralCode) {
        lines.push(`Your referral link: ${result.yourReferralLink}`);
      }

      callback?.({ text: lines.join("\n") });
      return true;
    } catch (err: any) {
      callback?.({ text: `❌ Mint failed: ${err.message}` });
      return false;
    }
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "Mint a Helixa agent called Atlas with ElizaOS framework" } },
      { user: "{{agentName}}", content: { text: "✅ Helixa Agent minted! Token #42\nTX: 0x...\nName: Atlas | Framework: ElizaOS" } },
    ],
  ],
};
