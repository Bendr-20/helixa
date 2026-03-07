import type { Plugin } from "@elizaos/core";
import { mintAction } from "./actions/mint";
import { registerAction } from "./actions/register";
import { addTraitAction } from "./actions/addTrait";
import { mutateAction } from "./actions/mutate";
import { lookupAction } from "./actions/lookup";
import { checkPointsAction } from "./actions/checkPoints";
import { import8004Action } from "./actions/import8004";
import { register8004Action } from "./actions/register8004";

/**
 * AgentDNA Plugin for ElizaOS
 *
 * Lets any Eliza agent mint and manage their onchain identity via AgentDNA.
 *
 * Required settings:
 *   - AGENTDNA_CONTRACT_ADDRESS — the AgentDNA contract address
 *   - EVM_PRIVATE_KEY — wallet private key for write operations
 *   - EVM_PROVIDER_URL — (optional) RPC URL, defaults to https://mainnet.base.org
 */
const agentDnaPlugin: Plugin = {
  name: "agentdna",
  description: "Mint and manage onchain agent identities via AgentDNA",
  actions: [
    mintAction,
    registerAction,
    addTraitAction,
    mutateAction,
    lookupAction,
    checkPointsAction,
    import8004Action,
    register8004Action,
  ],
  evaluators: [],
  providers: [],
};

export default agentDnaPlugin;
