import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { fetchCredScore } from "../utils";

export const checkPointsAction: Action = {
  name: "AGENTDNA_CHECK_CRED",
  description: "Check a Helixa agent's Cred Score and tier via V2 API",
  similes: ["CHECK_POINTS", "CHECK_CRED", "CRED_SCORE", "AGENT_SCORE", "AGENT_REPUTATION"],

  validate: async (_runtime: IAgentRuntime) => {
    return true; // Public endpoint
  },

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown>, callback?: HandlerCallback) => {
    try {
      const { tokenId } = message.content as any;
      if (tokenId == null) {
        callback?.({ text: "Provide a tokenId to check cred score" });
        return false;
      }

      const cred = await fetchCredScore(runtime, parseInt(tokenId));

      const lines = [
        `📊 Cred Score — ${cred.name}`,
        `Score: ${cred.credScore} / 100`,
        `Tier: ${cred.tierLabel}`,
        ``,
        `Scale: Junk (0-25) → Speculative (26-50) → Investment Grade (51-75) → Prime (76-90) → AAA (91-100)`,
      ];

      callback?.({ text: lines.join("\n") });
      return true;
    } catch (err: any) {
      callback?.({ text: `❌ Cred check failed: ${err.message}` });
      return false;
    }
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "Check cred score for agent #1" } },
      { user: "{{agentName}}", content: { text: "📊 Cred Score — Bendr\nScore: 87 / 100\nTier: Prime" } },
    ],
  ],
};
