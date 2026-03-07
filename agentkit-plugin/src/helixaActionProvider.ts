import { z } from "zod";
import { ActionProvider } from "@coinbase/agentkit";
import { EvmWalletProvider } from "@coinbase/agentkit";
import { CreateAction } from "@coinbase/agentkit";
import { Network } from "@coinbase/agentkit";
import { encodeFunctionData, decodeFunctionResult, Hex } from "viem";
import {
  RegisterAgentSchema,
  GetAgentSchema,
  GetAgentByAddressSchema,
  MutateAgentSchema,
  AddTraitSchema,
  ResolveNameSchema,
  CheckNameSchema,
  GetStatsSchema,
} from "./schemas";
import {
  AGENTDNA_CONTRACT,
  AGENTNAMES_CONTRACT,
  AGENTDNA_ABI,
  AGENTNAMES_ABI,
  GASLESS_API_URL,
  NO_PARENT,
} from "./constants";

/**
 * HelixaActionProvider provides Coinbase AgentKit actions for Helixa AgentDNA —
 * the onchain identity and reputation protocol for AI agents on Base.
 *
 * Actions:
 * - register_agent: Mint an onchain identity NFT (ERC-8004) for an AI agent
 * - get_agent: Look up an agent's onchain identity by token ID
 * - get_agent_by_address: Look up an agent's identity by wallet address
 * - mutate_agent: Record a version change / mutation
 * - add_trait: Add a personality trait, skill, or attribute
 * - resolve_name: Resolve a .agent name to a wallet address
 * - check_name: Check if a .agent name is available
 * - get_stats: Get Helixa protocol statistics
 */
export class HelixaActionProvider extends ActionProvider<EvmWalletProvider> {
  constructor() {
    super("helixa", []);
  }

  /**
   * Check if we're on the right network (Base mainnet).
   */
  private async ensureBase(walletProvider: EvmWalletProvider): Promise<void> {
    const network = await walletProvider.getNetwork();
    if (network.chainId !== "8453" && network.chainId !== 8453) {
      throw new Error(
        `Helixa AgentDNA is deployed on Base (chain 8453). Current chain: ${network.chainId}. Please switch to Base.`
      );
    }
  }

  /**
   * Register a new AI agent on Helixa AgentDNA (ERC-8004 identity NFT).
   * During the free beta (first 100 agents), gas is sponsored.
   * After that, the mint fee applies automatically.
   */
  @CreateAction({
    name: "register_agent",
    description: `
Register a new AI agent on Helixa AgentDNA — the onchain identity protocol for AI agents on Base.

This mints an ERC-8004 compliant identity NFT that includes:
- Agent name and framework
- Soulbound option (non-transferable, recommended for production agents)
- Optional .agent name (e.g. mybot.agent)
- 2x early adopter points for the first 100 agents → token allocation at TGE

The first 100 mints are FREE (gas sponsored). After that: 0.005 ETH (101-500), 0.01 ETH (501-1000), 0.02 ETH (1001+).

IMPORTANT: Do NOT call totalSupply() or paused() on this contract — they will revert. Use totalAgents() instead.
`,
    schema: RegisterAgentSchema,
  })
  async registerAgent(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RegisterAgentSchema>
  ): Promise<string> {
    await this.ensureBase(walletProvider);

    try {
      // Check current mint price
      const priceData = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "mintPrice",
      });

      const priceResult = await walletProvider.readContract(
        AGENTDNA_CONTRACT,
        priceData
      );

      const mintPrice = BigInt(priceResult as string);
      const agentAddress = await walletProvider.getAddress();

      // If free, try gasless API first
      if (mintPrice === 0n) {
        try {
          const response = await fetch(`${GASLESS_API_URL}/api/mint`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: agentAddress,
              agentAddress,
              name: args.name,
              framework: args.framework,
              soulbound: args.soulbound,
              agentName: args.agentName,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            let msg = `✅ Agent "${args.name}" registered on Helixa AgentDNA!\n`;
            msg += `Token ID: ${result.tokenId}\n`;
            msg += `TX: https://basescan.org/tx/${result.txHash}\n`;
            msg += `Contract: ${AGENTDNA_CONTRACT}\n`;
            msg += `Soulbound: ${args.soulbound}\n`;
            msg += `Framework: ${args.framework}\n`;
            msg += `Gas: Sponsored (free beta)\n`;
            if (result.agentName) {
              msg += `Name: ${result.agentName}.agent\n`;
            }
            msg += `\nView: https://helixa.xyz/directory.html`;
            return msg;
          }
          // If gasless fails, fall through to direct mint
        } catch {
          // Gasless API unavailable, fall through
        }
      }

      // Direct mint (paid or gasless API unavailable)
      const data = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "mint",
        args: [
          agentAddress as Hex,
          args.name,
          args.framework,
          args.tokenURI || "",
          args.soulbound,
          BigInt(NO_PARENT),
        ],
      });

      const hash = await walletProvider.sendTransaction({
        to: AGENTDNA_CONTRACT as `0x${string}`,
        data,
        value: mintPrice,
      });

      await walletProvider.waitForTransactionReceipt(hash);

      // Register .agent name if requested
      if (args.agentName) {
        try {
          const nameData = encodeFunctionData({
            abi: AGENTNAMES_ABI,
            functionName: "register",
            args: [args.agentName],
          });

          const nameHash = await walletProvider.sendTransaction({
            to: AGENTNAMES_CONTRACT as `0x${string}`,
            data: nameData,
          });

          await walletProvider.waitForTransactionReceipt(nameHash);
        } catch (nameError) {
          return `Agent registered (TX: ${hash}) but .agent name registration failed: ${nameError}`;
        }
      }

      let msg = `✅ Agent "${args.name}" registered on Helixa AgentDNA!\n`;
      msg += `TX: https://basescan.org/tx/${hash}\n`;
      msg += `Contract: ${AGENTDNA_CONTRACT}\n`;
      if (mintPrice > 0n) {
        msg += `Fee: ${Number(mintPrice) / 1e18} ETH\n`;
      }
      if (args.agentName) {
        msg += `Name: ${args.agentName}.agent\n`;
      }
      return msg;
    } catch (error) {
      return `Error registering agent: ${error}`;
    }
  }

  /**
   * Look up an agent's onchain identity by token ID.
   */
  @CreateAction({
    name: "get_agent",
    description: `
Look up an AI agent's onchain identity on Helixa AgentDNA by token ID.
Returns the agent's name, framework, mint date, verification status, soulbound status, generation, version, and mutation count.
`,
    schema: GetAgentSchema,
  })
  async getAgent(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetAgentSchema>
  ): Promise<string> {
    await this.ensureBase(walletProvider);

    try {
      const data = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "getAgent",
        args: [BigInt(args.tokenId)],
      });

      const result = await walletProvider.readContract(AGENTDNA_CONTRACT, data);

      // Get points
      const pointsData = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "getPoints",
        args: [BigInt(args.tokenId)],
      });

      const points = await walletProvider.readContract(AGENTDNA_CONTRACT, pointsData);

      return `Agent #${args.tokenId}:\n${JSON.stringify(result, null, 2)}\nPoints: ${points}`;
    } catch (error) {
      return `Error looking up agent #${args.tokenId}: ${error}`;
    }
  }

  /**
   * Look up an agent by wallet address.
   */
  @CreateAction({
    name: "get_agent_by_address",
    description: `Look up an AI agent's onchain identity by wallet address. Returns the token ID associated with that address.`,
    schema: GetAgentByAddressSchema,
  })
  async getAgentByAddress(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetAgentByAddressSchema>
  ): Promise<string> {
    await this.ensureBase(walletProvider);

    try {
      const data = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "addressToTokenId",
        args: [args.agentAddress as Hex],
      });

      const tokenId = await walletProvider.readContract(AGENTDNA_CONTRACT, data);

      if (tokenId === "0" || tokenId === 0n) {
        return `No Helixa identity found for address ${args.agentAddress}. Register at https://helixa.xyz/mint.html`;
      }

      return `Address ${args.agentAddress} is registered as Agent #${tokenId}`;
    } catch (error) {
      return `Error looking up address: ${error}`;
    }
  }

  /**
   * Mutate (version update) an agent's identity.
   */
  @CreateAction({
    name: "mutate_agent",
    description: `
Record a version change (mutation) for an AI agent on Helixa. Tracks the agent's evolution over time.
Only the agent's owner can mutate. Awards 50 mutation points.
`,
    schema: MutateAgentSchema,
  })
  async mutateAgent(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof MutateAgentSchema>
  ): Promise<string> {
    await this.ensureBase(walletProvider);

    try {
      const data = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "mutate",
        args: [BigInt(args.tokenId), args.newVersion, args.reason],
      });

      const hash = await walletProvider.sendTransaction({
        to: AGENTDNA_CONTRACT as `0x${string}`,
        data,
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `✅ Agent #${args.tokenId} mutated to version ${args.newVersion}. TX: https://basescan.org/tx/${hash}`;
    } catch (error) {
      return `Error mutating agent: ${error}`;
    }
  }

  /**
   * Add a trait to an agent.
   */
  @CreateAction({
    name: "add_trait",
    description: `
Add a trait to an AI agent's onchain identity. Traits are key-value pairs like personality:analytical, skill:defi-trading, alignment:chaotic-good.
Only the agent's owner can add traits. Awards 10 trait points.
`,
    schema: AddTraitSchema,
  })
  async addTrait(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof AddTraitSchema>
  ): Promise<string> {
    await this.ensureBase(walletProvider);

    try {
      const data = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "addTrait",
        args: [BigInt(args.tokenId), args.traitType, args.traitValue],
      });

      const hash = await walletProvider.sendTransaction({
        to: AGENTDNA_CONTRACT as `0x${string}`,
        data,
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return `✅ Trait added to Agent #${args.tokenId}: ${args.traitType} = ${args.traitValue}. TX: https://basescan.org/tx/${hash}`;
    } catch (error) {
      return `Error adding trait: ${error}`;
    }
  }

  /**
   * Resolve a .agent name to a wallet address.
   */
  @CreateAction({
    name: "resolve_name",
    description: `Resolve a .agent name to a wallet address. For example, resolving "helixa" returns the address that owns helixa.agent.`,
    schema: ResolveNameSchema,
  })
  async resolveName(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ResolveNameSchema>
  ): Promise<string> {
    await this.ensureBase(walletProvider);

    try {
      const data = encodeFunctionData({
        abi: AGENTNAMES_ABI,
        functionName: "resolve",
        args: [args.name],
      });

      const result = await walletProvider.readContract(AGENTNAMES_CONTRACT, data);

      if (result === "0x0000000000000000000000000000000000000000") {
        return `${args.name}.agent is not registered.`;
      }

      return `${args.name}.agent resolves to: ${result}`;
    } catch (error) {
      return `Error resolving name: ${error}`;
    }
  }

  /**
   * Check .agent name availability.
   */
  @CreateAction({
    name: "check_name",
    description: `Check if a .agent name is available for registration.`,
    schema: CheckNameSchema,
  })
  async checkName(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckNameSchema>
  ): Promise<string> {
    await this.ensureBase(walletProvider);

    try {
      const data = encodeFunctionData({
        abi: AGENTNAMES_ABI,
        functionName: "available",
        args: [args.name],
      });

      const result = await walletProvider.readContract(AGENTNAMES_CONTRACT, data);

      return result ? `✅ ${args.name}.agent is available!` : `❌ ${args.name}.agent is already taken.`;
    } catch (error) {
      return `Error checking name: ${error}`;
    }
  }

  /**
   * Get Helixa protocol stats.
   */
  @CreateAction({
    name: "get_helixa_stats",
    description: `Get Helixa AgentDNA protocol statistics — total agents registered, current mint price, and free mints remaining.`,
    schema: GetStatsSchema,
  })
  async getStats(
    walletProvider: EvmWalletProvider,
    _args: z.infer<typeof GetStatsSchema>
  ): Promise<string> {
    await this.ensureBase(walletProvider);

    try {
      const totalData = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "totalAgents",
      });

      const priceData = encodeFunctionData({
        abi: AGENTDNA_ABI,
        functionName: "mintPrice",
      });

      const [total, price] = await Promise.all([
        walletProvider.readContract(AGENTDNA_CONTRACT, totalData),
        walletProvider.readContract(AGENTDNA_CONTRACT, priceData),
      ]);

      const totalNum = Number(total);
      const priceEth = Number(price) / 1e18;
      const freeRemaining = totalNum < 100 ? 100 - totalNum : 0;

      let msg = `🧬 Helixa AgentDNA Stats\n`;
      msg += `Total Agents: ${totalNum}\n`;
      msg += `Mint Price: ${priceEth === 0 ? "FREE (beta)" : `${priceEth} ETH`}\n`;
      if (freeRemaining > 0) {
        msg += `Free Mints Remaining: ${freeRemaining}\n`;
        msg += `Early adopters get 2x points → token allocation at TGE\n`;
      }
      msg += `\nContract: ${AGENTDNA_CONTRACT}\n`;
      msg += `Explorer: https://basescan.org/address/${AGENTDNA_CONTRACT}\n`;
      msg += `Mint: https://helixa.xyz/mint.html`;

      return msg;
    } catch (error) {
      return `Error fetching stats: ${error}`;
    }
  }

  /**
   * Checks if the action provider supports the given network.
   * Helixa is deployed on Base (chain 8453) only.
   */
  supportsNetwork(network: Network): boolean {
    return network.chainId === "8453" || (network.chainId as unknown as number) === 8453;
  }
}

export const helixaActionProvider = () => new HelixaActionProvider();
