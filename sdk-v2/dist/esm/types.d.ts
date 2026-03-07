/** Agent personality traits */
export interface Personality {
    quirks?: string;
    communicationStyle?: string;
    values?: string;
    humor?: string;
    riskTolerance?: number;
    autonomyLevel?: number;
}
/** Agent narrative metadata */
export interface Narrative {
    origin?: string;
    mission?: string;
    lore?: string;
    manifesto?: string;
}
/** Agent trait */
export interface Trait {
    name: string;
    category: string;
    addedAt?: string;
}
/** Linked token info */
export interface LinkedToken {
    contractAddress: string;
    chain: string;
    symbol: string;
    name: string;
}
/** Full agent profile */
export interface Agent {
    tokenId: number;
    agentAddress: string;
    name: string;
    framework: string;
    mintedAt: string;
    verified: boolean;
    soulbound: boolean;
    mintOrigin: string;
    generation: number;
    version: string;
    mutationCount: number;
    points: number;
    credScore: number;
    ethosScore: number | null;
    owner: string;
    agentName: string | null;
    linkedToken: LinkedToken | null;
    personality: Personality | null;
    narrative: Narrative | null;
    traits: Trait[];
    explorer: string;
}
/** Protocol stats */
export interface Stats {
    totalAgents: number;
    mintPrice: string;
    network: string;
    chainId: number;
    contract: string;
    contractDeployed: boolean;
    phase: number;
    gasWallet: string;
    gasBalance: string;
}
/** Paginated agent list */
export interface AgentList {
    total: number;
    page: number;
    agents: Agent[];
}
/** Name availability check */
export interface NameCheck {
    name: string;
    available: boolean;
    tokenId: number | null;
    contract: string;
}
/** Mint request body */
export interface MintRequest {
    name: string;
    framework?: string;
    soulbound?: boolean;
    personality?: Personality;
    narrative?: Narrative;
    referralCode?: string;
}
/** Mint response */
export interface MintResponse {
    success: boolean;
    tokenId: number;
    txHash: string;
    mintOrigin: string;
    explorer: string;
    message: string;
    crossRegistration: {
        registry: string;
        agentId: number;
        txHash: string;
        explorer: string;
    } | null;
    yourReferralCode: string;
    yourReferralLink: string;
    og: {
        v1Name: string;
        bonusPoints: number;
        trait: string;
    } | null;
    referral: {
        code: string;
        referrerTokenId: number;
        referrerPoints: number;
        minterPoints: number;
    } | null;
}
/** Update request body */
export interface UpdateRequest {
    personality?: Personality;
    narrative?: Narrative;
    traits?: Trait[];
}
/** Social links */
export interface SocialLinks {
    twitter?: string;
    website?: string;
    github?: string;
}
/** Verification status */
export interface Verifications {
    tokenId: number;
    x: {
        handle: string;
        verifiedAt: string;
        txHash: string;
    } | null;
    github: {
        username: string;
        verifiedAt: string;
        txHash: string;
    } | null;
    farcaster: {
        username: string;
        fid: number | null;
        verifiedAt: string;
        txHash: string;
    } | null;
}
/** Referral info */
export interface ReferralInfo {
    valid: boolean;
    code: string;
    referrer: string;
    bonusPoints: number;
    isOG: boolean;
    stats: {
        totalReferrals: number;
    };
}
/** Agent report */
export interface AgentReport {
    tokenId: number;
    name: string;
    walletAddress: string;
    owner: string;
    balances: {
        eth: string;
        usdc: string;
        linkedToken: any;
    };
    recentTransactions: any[];
    credScore: {
        total: number;
        tier: string;
        verified: boolean;
    };
    verifications: Record<string, any>;
    points: number;
    rank: number | null;
    totalAgents: number;
    ethosScore: number | null;
}
/** Message group */
export interface MessageGroup {
    id: string;
    topic: string;
    description: string;
    minCred: number;
    isPublic: boolean;
}
/** Chat message */
export interface ChatMessage {
    id: string;
    senderAddress: string;
    senderName: string;
    content: string;
    timestamp: string;
}
/** Agent list query options */
export interface AgentQueryOptions {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    framework?: string;
    verified?: string;
    search?: string;
    spam?: boolean;
}
/** Helixa client options */
export interface HelixaOptions {
    /** API base URL (default: https://api.helixa.xyz) */
    baseUrl?: string;
    /** Private key for SIWA authentication */
    privateKey?: string;
}
//# sourceMappingURL=types.d.ts.map