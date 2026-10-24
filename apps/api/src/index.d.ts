import type {
  ValidationIssue,
} from '@helixa/multipass-sdk';

export interface MemoryStoreInput {
  profiles?: unknown[];
  fragments?: unknown[];
  agentCards?: unknown[];
  standardsProfiles?: unknown[];
  x402Manifests?: unknown[];
  receiptFragments?: unknown[];
}

export interface MemoryStore {
  resolveProfile(identifier: string): unknown | null;
  getPublicFragments(multipassId: string): unknown[];
  getTools(multipassId: string): unknown;
  getAgentCard(multipassId: string, options?: { baseUrl?: string }): unknown | null;
  getStandardsProfile(multipassId: string): unknown | null;
  getX402Manifest(multipassId: string): unknown | null;
  getReceiptFragment(multipassId: string, receiptId: string): unknown | null;
  getChangeLog?(multipassId: string): unknown;
}

export interface SavedRecordsStore extends MemoryStore {
  saveActivatedRecord(record: unknown): unknown;
  getSourceContext?(multipassId: string): unknown;
  createClaimNonce(identifier: string, options?: Record<string, unknown>): unknown;
  consumeClaimNonce(nonce: string, options?: Record<string, unknown>): { message: string } & Record<string, unknown>;
  createManualReviewRequest(identifier: string, input?: Record<string, unknown>): unknown;
  approveManualReviewClaim(identifier: string, claimId: string, input?: Record<string, unknown>): unknown;
  markOwnerWalletVerified(identifier: string, input?: Record<string, unknown>): unknown;
  getClaimState(multipassId: string): { status: string } & Record<string, unknown>;
  findApprovedManagerClaim(multipassId: string, wallet: string): unknown | null;
  createManagerSession(identifier: string, input?: Record<string, unknown>): { sessionId: string; csrfToken: string; expires_at: string; multipass_id: string };
  validateManagerSession(input?: Record<string, unknown>): Record<string, unknown>;
  revokeManagerSession(sessionId: string, input?: Record<string, unknown>): void;
  updatePublicProfile(identifier: string, edits?: Record<string, unknown>, input?: Record<string, unknown>): unknown;
}

export type SignatureVerifier = (input: { wallet: string; message: string; signature: string }) => boolean | Promise<boolean>;

export declare function createSwarmInvitationStore(options: { filename: string; maxActiveDraftsPerOwner?: number; maxActiveDrafts?: number }): Record<string, unknown>;
export declare function createSwarmInvitationAuthorityVerifier(options: { providers: unknown[]; accountIntegrityReader?: { read(input: { tokenId: string }): Promise<unknown> }; timeoutMs?: number }): { verify(input: { tokenId: string }): Promise<Record<string, unknown>> };
export declare function createSwarmInvitationService(options: { store: Record<string, unknown>; authority: { verify(input: { tokenId: string }): Promise<Record<string, unknown>> }; createId(kind: 'draft' | 'invite'): string; now?: () => Date | string }): Record<string, unknown>;
export declare class SwarmInvitationError extends Error { code: string; status: number; }

export interface LooperCodexRuntime {
  available: boolean;
  status: {
    available: boolean;
    schemaVersion?: string;
    artifactHash?: string;
    codexVersion?: string;
    count?: number;
    reason?: string;
  };
  query(operation: string, input: unknown): unknown;
}

export interface MultipassLogger {
  info?(event: Record<string, unknown>): void;
  warn?(event: Record<string, unknown>): void;
}

export interface ConsoleCreditService {
  requestLoginChallenge(input: Record<string, unknown>): Promise<unknown>;
  verifyLogin(input: Record<string, unknown>): Promise<unknown>;
  getOverview(input: Record<string, unknown>): Promise<unknown>;
  acceptVouch(input: Record<string, unknown>): Promise<unknown>;
  prepareAuthorization(input: Record<string, unknown>): Promise<unknown>;
  requestTwoFactor(input: Record<string, unknown>): Promise<unknown>;
  verifyTwoFactor(input: Record<string, unknown>): Promise<unknown>;
  previewLoan(input: Record<string, unknown>): Promise<unknown>;
  createLoan(input: Record<string, unknown>): Promise<unknown>;
  revokeAll?(input: { sessionKey: string }): void;
}

export interface MultipassApiOptions {
  store: MemoryStore;
  baseUrl?: string;
  savedRecords?: SavedRecordsStore;
  missionService?: MissionService;
  swarmLaunchConsentService?: { createProposal(input: Record<string, unknown>): Promise<unknown>; readProposal(input: Record<string, unknown>): Promise<unknown>; createReadinessPacket(input: Record<string, unknown>): Promise<unknown>; readChallenge(input: Record<string, unknown>): Promise<unknown>; recordConsent(input: Record<string, unknown>): Promise<unknown> };
  swarmInvitationService?: { createDraft(input: Record<string, unknown>): Promise<unknown>; readDraft(input: Record<string, unknown>): Promise<unknown>; addInvite(input: Record<string, unknown>): Promise<unknown>; revoke(input: Record<string, unknown>): Promise<unknown>; readInvite(input: Record<string, unknown>): Promise<unknown>; respond(input: Record<string, unknown>): Promise<unknown> };
  activationService?: (agent: string) => Promise<unknown> | unknown;
  allowedOrigins?: string[];
  adminSecret?: string | null;
  signatureVerifier?: SignatureVerifier;
  cookieSecure?: boolean;
  fetchImpl?: typeof fetch;
  loopersAllowlist?: unknown;
  loopersAllowlistSnapshot?: unknown;
  loopersAllowlistRateLimit?: unknown;
  loopersAllowlistSubnetRateLimit?: unknown;
  loopersTurnstileSecretKey?: string | null;
  loopersOwnedAgentLoader?: (input: { address: string }) => Promise<unknown[]>;
  loopersOwnedRpcUrl?: string;
  loopersOwnedMetadataBaseUrl?: string;
  loopersPublicClients?: unknown[];
  loopersAuthorizer?: (input: { tokenId: string; wallet: string }) => Promise<Record<string, unknown>>;
  looperCanonicalWalletResolver?: (input: { tokenId: string }) => Promise<Record<string, unknown>>;
  consoleAuthStore?: unknown;
  consoleCreditService?: ConsoleCreditService | null;
  consoleRuntimeRegistry?: unknown;
  bankrLlmKey?: string | null;
  bankrLlmModel?: string | null;
  bankrLlmVisionModel?: string | null;
  consoleAgentBankrLlmEnabled?: boolean;
  consoleSkillProposalsEnabled?: boolean;
  consoleMarketReadEnabled?: boolean;
  consoleAccountReadEnabled?: boolean;
  consoleXmtpEnabled?: boolean;
  consoleXmtpEnv?: string;
  consoleXmtpWalletKey?: string | null;
  consoleXmtpDbPath?: string | null;
  consoleXmtpDbEncryptionKey?: string | Uint8Array | null;
  consoleXmtpHistorySyncUrl?: string | null;
  consoleXmtpApiUrl?: string | null;
  consoleXmtpGatewayHost?: string | null;
  consoleXmtpAppVersion?: string;
  consoleXmtpClient?: unknown;
  consoleAgentRuntime?: {
    handleMessage(input?: Record<string, unknown>): Promise<unknown> | unknown;
    getThread?(input?: Record<string, unknown>): Promise<unknown> | unknown;
  };
  looperCodexRuntime?: LooperCodexRuntime;
  restapNetworkService?: { status: { enabled: boolean; gates: Record<string, boolean>; transcriptCapability: 'unavailable' }; close(): Promise<void> } | null;
  restapVerifiedSendService?: RestapVerifiedSendService | null;
  logger?: MultipassLogger;
  consoleCodexWalletRateLimit?: { limit: number; windowMs: number };
  consoleCodexGlobalRateLimit?: { limit: number; windowMs: number };
  consoleCodexRateLimitNow?: () => number;
  consoleCodexWalletMaxBuckets?: number;
  restapDiscoveryEnabled?: boolean;
  restapTalkEnabled?: boolean;
  restap3802Policy?: {
    authorize(input: { surface: 'discovery' | 'talk' | 'news-write' }): Promise<{ discovery?: unknown; publicProjection?: unknown }> | { discovery?: unknown; publicProjection?: unknown };
  };
  restapTalkRuntime?: {
    talk(input: { message: string; sessionId?: string; publicProjection: unknown }): Promise<{ reply: string; session_id: string }> | { reply: string; session_id: string };
  };
  restapNewsWriteEnabled?: boolean;
  restapNewsReadEnabled?: boolean;
  restapNewsStore?: { accept(input: unknown): { itemId: string; receivedAt: string }; list(input: { cursor?: string; limit: number }): { items: Array<{ canonicalBody: unknown }>; nextCursor?: string | null } };
  restapNewsAuthenticator?: { authenticate(input: unknown): Promise<unknown> | unknown };
  restapTalkLimits?: { perIpPerMinute?: number; perSessionPerMinute?: number; globalPerDay?: number; concurrency?: number };
  restapRateLimitNow?: () => number;
}

export interface RestapVerifiedSendResult {
  schemaVersion: '0.1.0';
  operationId: string;
  status: 'reserved' | 'sender_dispatched' | 'recipient_dispatched' | 'committed' | 'charged_unknown' | 'cancelled_charged';
  senderTokenId: string;
  recipientTokenId: string;
  topic: string;
  openingDigest: string | null;
  replyDigest: string | null;
  usage: { sender: { inputTokens: number; outputTokens: number; totalTokens: number } | null; recipient: { inputTokens: number; outputTokens: number; totalTokens: number } | null };
  replayed: boolean;
  reason?: string;
  reply?: string;
}

export interface RestapVerifiedSendService {
  send(input: { senderTokenId: string; recipientTokenId: string; topic: string; idempotencyKey: string; owner: string }): Promise<RestapVerifiedSendResult>;
}

export interface MultipassApi {
  handleRequest(request: Request): Promise<Response>;
}

export interface ApiErrorBody {
  schema_version: string;
  error: {
    code: string;
    message: string;
    issues?: ValidationIssue[];
  };
}

export interface MissionMutationCommand {
  actorAddress: string;
  missionId?: string;
  applicationId?: string;
  milestoneId?: string;
  taskId?: string;
  disputeId?: string;
  expectedRevision: number;
  idempotencyKey: string;
  input: Record<string, unknown>;
}

export interface MissionService {
  listPublicMissions(query?: { state?: string | null; cursor?: string | null; limit?: number }): Promise<{ missions: readonly unknown[]; nextCursor: string | null }> | { missions: readonly unknown[]; nextCursor: string | null };
  getPublicMission(input: { missionId: string }): Promise<unknown> | unknown;
  createMission(input: MissionMutationCommand): Promise<unknown> | unknown;
  updateMission(input: MissionMutationCommand): Promise<unknown> | unknown;
  publishMission(input: MissionMutationCommand): Promise<unknown> | unknown;
  cancelMission(input: MissionMutationCommand): Promise<unknown> | unknown;
  applyToMission(input: MissionMutationCommand): Promise<unknown> | unknown;
  withdrawApplication(input: MissionMutationCommand): Promise<unknown> | unknown;
  selectTeam(input: MissionMutationCommand): Promise<unknown> | unknown;
  readLaunchTerms(input: { missionId: string; actorAddress: string }): Promise<unknown> | unknown;
  signLaunchTerms(input: MissionMutationCommand): Promise<unknown> | unknown;
  publishLaunchManifest(input: MissionMutationCommand): Promise<unknown> | unknown;
  prepareVault(input: MissionMutationCommand): Promise<unknown> | unknown;
  retryLaunch(input: MissionMutationCommand): Promise<unknown> | unknown;
  refundLaunch(input: MissionMutationCommand): Promise<unknown> | unknown;
  fundMission(input: MissionMutationCommand): Promise<unknown> | unknown;
  reconcileMission(input: MissionMutationCommand): Promise<unknown> | unknown;
  readWorkspace(input: { missionId: string; actorAddress: string }): Promise<unknown> | unknown;
  createTask(input: MissionMutationCommand): Promise<unknown> | unknown;
  assignTask(input: MissionMutationCommand): Promise<unknown> | unknown;
  updateTask(input: MissionMutationCommand): Promise<unknown> | unknown;
  submitArtifact(input: MissionMutationCommand): Promise<unknown> | unknown;
  approveMilestone(input: MissionMutationCommand): Promise<unknown> | unknown;
  releaseMilestone(input: MissionMutationCommand): Promise<unknown> | unknown;
  openDispute(input: MissionMutationCommand): Promise<unknown> | unknown;
  prepareArbitration(input: MissionMutationCommand): Promise<unknown> | unknown;
  readDispute(input: { missionId: string; milestoneId: string; disputeId: string; actorAddress: string }): Promise<unknown> | unknown;
}

export interface MissionServiceDependencies {
  repository: Record<string, unknown>;
  custody?: Record<string, unknown>;
  chain?: Record<string, unknown>;
  runtime?: Record<string, unknown>;
  xmtp?: Record<string, unknown>;
}

export class MissionServiceError extends Error {
  code: string;
  status: number;
}

export const MISSION_REQUEST_MAX_BYTES: number;
export function createMissionService(dependencies: MissionServiceDependencies): MissionService;
export function projectPublicMission(value: Record<string, unknown>): Readonly<Record<string, unknown>>;
export function projectPrivateMission(value: unknown): unknown;
export function createMemoryStore(input?: MemoryStoreInput): MemoryStore;
export function createMultipassApi(options: MultipassApiOptions): MultipassApi;
export function createRestapVerifiedSendService(options: Record<string, unknown>): RestapVerifiedSendService;
export function createSameProcessRestapTalkTransport(options: Record<string, unknown>): { talk(input: { recipientTokenId: string; message: string }): Promise<unknown> };
