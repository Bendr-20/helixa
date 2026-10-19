export interface SwarmLaunchCred { status: 'available'; score: number; tier: 'JUNK' | 'MARGINAL' | 'QUALIFIED' | 'PRIME' | 'PREFERRED'; coverage: { score: number; label: string }; freshness: { stale: false }; methodologyVersion: string; computedAt: string; }
export interface SwarmLaunchMember { tokenId: string; ownerAddress: string; name: string; role: string; contributionBps: number; cred: SwarmLaunchCred; erc8004Id: string | null; }
export interface SwarmLaunchDraft { members: readonly SwarmLaunchMember[]; app: { name: string; pitch: string; template: string; revenueModel: string; shipTarget: string }; token: { name: string; ticker: string; supply: string; supplyUnit: 'WHOLE_TOKENS'; decimals: null; curve: string }; gate: { eligible: boolean; averageCred: number | null; totalContributionBps: number; blockers: readonly string[] }; }
export declare const SWARM_LAUNCH_SCHEMA: 'multipass.swarm-launch.v1';
export declare const SWARM_LAUNCH_CHAIN_ID: 8453;
export declare const SWARM_LAUNCH_LOOPERS_COLLECTION: string;
export declare const SWARM_LAUNCH_LIMITS: Readonly<{ minimumMembers: 3; maximumMembers: 5; minimumAverageCred: 65; totalContributionBps: 10000 }>;
export declare const SWARM_LAUNCH_OPTIONS: Readonly<{ supplies: readonly string[]; curves: readonly string[]; templates: readonly string[]; revenueModels: readonly string[]; shipTargets: readonly string[] }>;
export declare function evaluateSwarmLaunchGate(input?: { members?: readonly Partial<SwarmLaunchMember>[] }): SwarmLaunchDraft['gate'];
export declare function normalizeSwarmLaunchDraft(input: unknown): SwarmLaunchDraft;
export declare function normalizeSwarmLaunchRequestForm(formData: { get(key: string): unknown }, memberSlots?: readonly unknown[]): Readonly<{ members: readonly Readonly<{ tokenId: string; ownerAddress: string; role: string; contributionBps: number }>[]; app: SwarmLaunchDraft['app']; token: SwarmLaunchDraft['token'] }>;
export declare function normalizeSwarmLaunchForm(formData: { get(key: string): unknown }, verifiedMembers?: readonly SwarmLaunchMember[]): SwarmLaunchDraft;
export declare function buildSwarmLaunchManifest(input: unknown): Readonly<Record<string, unknown>>;
export declare function canonicalSwarmLaunchJson(value: unknown): string;
