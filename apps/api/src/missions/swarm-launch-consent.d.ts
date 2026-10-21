export interface SwarmLaunchExecutionPreviewRequest {
  beneficiaries: readonly { tokenId: string; beneficiary: string }[];
  recipients: { credRewards: string; swarmTreasury: string; publicDistribution: string };
  revenueAssets: readonly string[];
}

export interface SwarmLaunchExecutionPreview {
  packet: Readonly<Record<string, unknown>>;
  packetSha256: string;
}

export interface SwarmLaunchConsentService {
  createProposal(input: Record<string, unknown>): Promise<unknown>;
  readProposal(input: Record<string, unknown>): Promise<unknown>;
  createReadinessPacket(input: Record<string, unknown>): Promise<unknown>;
  createExecutionPreview(input: { actorAddress: string; proposalId: string; input: SwarmLaunchExecutionPreviewRequest }): Promise<SwarmLaunchExecutionPreview>;
  readChallenge(input: Record<string, unknown>): Promise<unknown>;
  recordConsent(input: Record<string, unknown>): Promise<unknown>;
}

export interface SwarmLaunchConsentServiceOptions {
  store: Record<string, unknown>;
  preview(input: Record<string, unknown>): Promise<unknown> | unknown;
  authorizeLooper(input: Record<string, unknown>): Promise<unknown> | unknown;
  verifySignature(input: Record<string, unknown>): Promise<boolean> | boolean;
  createId(): string;
  now?: () => number;
  ttlMs?: number;
  factoryAddress?: string | null;
  executionArtifacts?: unknown;
  executionPacketBuilder?: (input: Record<string, unknown>) => Promise<unknown> | unknown;
}

export declare function createSwarmLaunchConsentService(options: SwarmLaunchConsentServiceOptions): SwarmLaunchConsentService;
export declare function buildSwarmLaunchConsentMessage(input: Record<string, unknown>): string;
export declare class ConsentError extends Error { code: string; status: number; }
