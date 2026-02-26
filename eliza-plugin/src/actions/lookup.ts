import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { fetchAgentV2 } from "../utils";

export const lookupAction: Action = {
  name: "AGENTDNA_LOOKUP",
  description: "Look up a Helixa agent by token ID via V2 API",
  similes: ["LOOKUP_AGENT", "GET_AGENT", "FIND_AGENT", "AGENT_INFO", "HELIXA_LOOKUP"],

  validate: async (_runtime: IAgentRuntime) => {
    return true; // Public endpoint, no auth needed
  },

  handler: async (runtime: IAgentRuntime, message: Memory, _state: State | undefined, _options: Record<string, unknown>, callback?: HandlerCallback) => {
    try {
      const { tokenId } = message.content as any;

      if (tokenId == null) {
        callback?.({ text: "Provide a tokenId to look up" });
        return false;
      }

      const agent = await fetchAgentV2(runtime, parseInt(tokenId));

      const tierLabel = agent.credScore >= 91 ? 'AAA' : agent.credScore >= 76 ? 'Prime' : agent.credScore >= 51 ? 'Investment Grade' : agent.credScore >= 26 ? 'Speculative' : 'Junk';

      const lines = [
        `🧬 Agent #${agent.tokenId} — ${agent.name}`,
        `Framework: ${agent.framework}`,
        `Owner: ${agent.owner}`,
        `Cred Score: ${agent.credScore} (${tierLabel})`,
        `Points: ${agent.points}`,
        `Verified: ${agent.verified}`,
        `Soulbound: ${agent.soulbound}`,
        `Mint Origin: ${agent.mintOrigin}`,
        `Minted: ${agent.mintedAt}`,
        `Mutations: ${agent.mutationCount}`,
      ];

      if (agent.personality?.quirks) lines.push(`Quirks: ${agent.personality.quirks}`);
      if (agent.narrative?.mission) lines.push(`Mission: ${agent.narrative.mission}`);
      if (agent.linkedToken) lines.push(`Token: ${agent.linkedToken.symbol} (${agent.linkedToken.contractAddress})`);

      lines.push(`Explorer: ${agent.explorer}`);

      callback?.({ text: lines.join("\n") });
      return true;
    } catch (err: any) {
      callback?.({ text: `❌ Lookup failed: ${err.message}` });
      return false;
    }
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "Look up Helixa agent #1" } },
      { user: "{{agentName}}", content: { text: "🧬 Agent #1 — Bendr\nFramework: openclaw\nCred Score: 87 (Prime)" } },
    ],
  ],
};
