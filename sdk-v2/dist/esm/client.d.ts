import type { Agent, AgentList, AgentQueryOptions, AgentReport, ChatMessage, HelixaOptions, MintRequest, MintResponse, MessageGroup, NameCheck, ReferralInfo, Stats, UpdateRequest, Verifications } from './types.js';
/**
 * Helixa SDK client — interact with the Helixa V2 API.
 *
 * @example
 * ```ts
 * import { Helixa } from 'helixa-sdk';
 *
 * // Read-only (no auth needed)
 * const client = new Helixa();
 * const agent = await client.getAgent(1);
 * console.log(agent.name, agent.credScore);
 *
 * // Authenticated (for minting, updating, verifying)
 * const authed = new Helixa({ privateKey: '0x...' });
 * const result = await authed.mint({ name: 'MyAgent', framework: 'openclaw' });
 * ```
 */
export declare class Helixa {
    private baseUrl;
    private privateKey?;
    constructor(options?: HelixaOptions);
    private fetch;
    private authHeaders;
    /** Get protocol statistics (total agents, mint price, gas balance). */
    getStats(): Promise<Stats>;
    /** Get the API discovery/info endpoint. */
    getInfo(): Promise<any>;
    /** List agents with optional filtering and pagination. */
    getAgents(options?: AgentQueryOptions): Promise<AgentList>;
    /** Get a single agent by token ID. */
    getAgent(tokenId: number): Promise<Agent>;
    /** Get OpenSea-compatible metadata for an agent. */
    getMetadata(tokenId: number): Promise<any>;
    /** Get the Cred Score for an agent (convenience — extracted from getAgent). */
    getCredScore(tokenId: number): Promise<number>;
    /** Check .agent name availability. */
    checkName(name: string): Promise<NameCheck>;
    /** Check a referral code. */
    checkReferral(code: string): Promise<ReferralInfo>;
    /** Get an agent's referral code/link. */
    getAgentReferral(tokenId: number): Promise<any>;
    /** Check V1 OG status for a wallet address. */
    checkOG(address: string): Promise<any>;
    /** Get aggregated onchain report for an agent. */
    getReport(tokenId: number): Promise<AgentReport>;
    /** Get social verification status for an agent. */
    getVerifications(tokenId: number): Promise<Verifications>;
    /** Get the OpenAPI spec. */
    getOpenAPI(): Promise<any>;
    /** Get the well-known agent registry manifest. */
    getAgentRegistry(): Promise<any>;
    /** List message groups. */
    getMessageGroups(): Promise<{
        groups: MessageGroup[];
    }>;
    /** Get messages from a group (public groups only without auth). */
    getMessages(groupId: string, options?: {
        limit?: number;
        before?: string;
    }): Promise<{
        group: any;
        messages: ChatMessage[];
    }>;
    /** Mint a new agent identity. Requires privateKey. */
    mint(request: MintRequest): Promise<MintResponse>;
    /**
     * Update an agent's personality, narrative, or traits.
     * @param onchain - If true, writes onchain (costs gas). Default: off-chain.
     */
    updateAgent(tokenId: number, data: UpdateRequest, onchain?: boolean): Promise<any>;
    /** Verify agent identity via SIWA (must sign from agent's own wallet). */
    verify(tokenId: number): Promise<any>;
    /** Cross-register agent on canonical ERC-8004 Registry. */
    crossRegister(tokenId: number): Promise<any>;
    /** Check Coinbase EAS attestation and boost Cred Score. */
    coinbaseVerify(tokenId: number): Promise<any>;
    /** Verify X/Twitter account (must have `helixa:<tokenId>` in bio). */
    verifyX(tokenId: number, handle: string): Promise<any>;
    /** Verify GitHub account (must have `helixa-verify.txt` gist). */
    verifyGithub(tokenId: number, username: string): Promise<any>;
    /** Verify Farcaster account (must have cast containing `helixa:<tokenId>`). */
    verifyFarcaster(tokenId: number, username?: string, fid?: number): Promise<any>;
    /** Link a token contract to an agent. */
    linkToken(tokenId: number, token: {
        contractAddress: string;
        chain: string;
        symbol: string;
        name: string;
    }): Promise<any>;
    /** Send a message to a group channel (requires Cred gate). */
    sendMessage(groupId: string, content: string): Promise<{
        message: ChatMessage;
    }>;
    /** Join a message group. */
    joinGroup(groupId: string): Promise<any>;
    /** Create a new message group (requires Investment Grade Cred 51+). */
    createGroup(options: {
        topic: string;
        description?: string;
        minCred?: number;
        isPublic?: boolean;
    }): Promise<{
        group: MessageGroup;
    }>;
}
//# sourceMappingURL=client.d.ts.map