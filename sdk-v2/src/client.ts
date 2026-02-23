import { createSIWAToken } from './siwa.js';
import type {
  Agent, AgentList, AgentQueryOptions, AgentReport, ChatMessage,
  HelixaOptions, MintRequest, MintResponse, MessageGroup, NameCheck,
  ReferralInfo, Stats, UpdateRequest, Verifications, SocialLinks,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.helixa.xyz';

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
export class Helixa {
  private baseUrl: string;
  private privateKey?: string;

  constructor(options: HelixaOptions = {}) {
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.privateKey = options.privateKey;
  }

  // ─── Internal helpers ────────────────────────────────────────

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, init);
    if (!res.ok) {
      const body = await res.text();
      let parsed: any;
      try { parsed = JSON.parse(body); } catch { parsed = { error: body }; }
      const err = new Error(parsed.error || `HTTP ${res.status}`) as any;
      err.status = res.status;
      err.body = parsed;
      throw err;
    }
    return res.json() as Promise<T>;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    if (!this.privateKey) throw new Error('privateKey required for authenticated endpoints');
    const token = await createSIWAToken(this.privateKey);
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  // ─── Public (no auth) ────────────────────────────────────────

  /** Get protocol statistics (total agents, mint price, gas balance). */
  async getStats(): Promise<Stats> {
    return this.fetch('/api/v2/stats');
  }

  /** Get the API discovery/info endpoint. */
  async getInfo(): Promise<any> {
    return this.fetch('/api/v2');
  }

  /** List agents with optional filtering and pagination. */
  async getAgents(options: AgentQueryOptions = {}): Promise<AgentList> {
    const params = new URLSearchParams();
    if (options.page) params.set('page', String(options.page));
    if (options.limit) params.set('limit', String(options.limit));
    if (options.sort) params.set('sort', options.sort);
    if (options.order) params.set('order', options.order);
    if (options.framework) params.set('framework', options.framework);
    if (options.verified) params.set('verified', options.verified);
    if (options.search) params.set('search', options.search);
    if (options.spam) params.set('spam', 'true');
    const qs = params.toString();
    return this.fetch(`/api/v2/agents${qs ? '?' + qs : ''}`);
  }

  /** Get a single agent by token ID. */
  async getAgent(tokenId: number): Promise<Agent> {
    return this.fetch(`/api/v2/agent/${tokenId}`);
  }

  /** Get OpenSea-compatible metadata for an agent. */
  async getMetadata(tokenId: number): Promise<any> {
    return this.fetch(`/api/v2/metadata/${tokenId}`);
  }

  /** Get the Cred Score for an agent (convenience — extracted from getAgent). */
  async getCredScore(tokenId: number): Promise<number> {
    const agent = await this.getAgent(tokenId);
    return agent.credScore;
  }

  /** Check .agent name availability. */
  async checkName(name: string): Promise<NameCheck> {
    return this.fetch(`/api/v2/name/${encodeURIComponent(name)}`);
  }

  /** Check a referral code. */
  async checkReferral(code: string): Promise<ReferralInfo> {
    return this.fetch(`/api/v2/referral/${encodeURIComponent(code)}`);
  }

  /** Get an agent's referral code/link. */
  async getAgentReferral(tokenId: number): Promise<any> {
    return this.fetch(`/api/v2/agent/${tokenId}/referral`);
  }

  /** Check V1 OG status for a wallet address. */
  async checkOG(address: string): Promise<any> {
    return this.fetch(`/api/v2/og/${address}`);
  }

  /** Get aggregated onchain report for an agent. */
  async getReport(tokenId: number): Promise<AgentReport> {
    return this.fetch(`/api/v2/agent/${tokenId}/report`);
  }

  /** Get social verification status for an agent. */
  async getVerifications(tokenId: number): Promise<Verifications> {
    return this.fetch(`/api/v2/agent/${tokenId}/verifications`);
  }

  /** Get the OpenAPI spec. */
  async getOpenAPI(): Promise<any> {
    return this.fetch('/api/v2/openapi.json');
  }

  /** Get the well-known agent registry manifest. */
  async getAgentRegistry(): Promise<any> {
    return this.fetch('/.well-known/agent-registry');
  }

  /** List message groups. */
  async getMessageGroups(): Promise<{ groups: MessageGroup[] }> {
    return this.fetch('/api/v2/messages/groups');
  }

  /** Get messages from a group (public groups only without auth). */
  async getMessages(groupId: string, options?: { limit?: number; before?: string }): Promise<{ group: any; messages: ChatMessage[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.before) params.set('before', options.before);
    const qs = params.toString();
    const headers: Record<string, string> = {};
    if (this.privateKey) {
      const h = await this.authHeaders();
      Object.assign(headers, h);
    }
    return this.fetch(`/api/v2/messages/groups/${groupId}/messages${qs ? '?' + qs : ''}`, { headers });
  }

  // ─── Authenticated (SIWA required) ───────────────────────────

  /** Mint a new agent identity. Requires privateKey. */
  async mint(request: MintRequest): Promise<MintResponse> {
    const headers = await this.authHeaders();
    return this.fetch('/api/v2/mint', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
  }

  /**
   * Update an agent's personality, narrative, or traits.
   * @param onchain - If true, writes onchain (costs gas). Default: off-chain.
   */
  async updateAgent(tokenId: number, data: UpdateRequest, onchain = false): Promise<any> {
    const headers = await this.authHeaders();
    return this.fetch(`/api/v2/agent/${tokenId}/update${onchain ? '?onchain=true' : ''}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  }

  /** Verify agent identity via SIWA (must sign from agent's own wallet). */
  async verify(tokenId: number): Promise<any> {
    const headers = await this.authHeaders();
    return this.fetch(`/api/v2/agent/${tokenId}/verify`, {
      method: 'POST',
      headers,
    });
  }

  /** Cross-register agent on canonical ERC-8004 Registry. */
  async crossRegister(tokenId: number): Promise<any> {
    const headers = await this.authHeaders();
    return this.fetch(`/api/v2/agent/${tokenId}/crossreg`, {
      method: 'POST',
      headers,
    });
  }

  /** Check Coinbase EAS attestation and boost Cred Score. */
  async coinbaseVerify(tokenId: number): Promise<any> {
    const headers = await this.authHeaders();
    return this.fetch(`/api/v2/agent/${tokenId}/coinbase-verify`, {
      method: 'POST',
      headers,
    });
  }

  /** Verify X/Twitter account (must have `helixa:<tokenId>` in bio). */
  async verifyX(tokenId: number, handle: string): Promise<any> {
    const headers = await this.authHeaders();
    return this.fetch(`/api/v2/agent/${tokenId}/verify/x`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ handle }),
    });
  }

  /** Verify GitHub account (must have `helixa-verify.txt` gist). */
  async verifyGithub(tokenId: number, username: string): Promise<any> {
    const headers = await this.authHeaders();
    return this.fetch(`/api/v2/agent/${tokenId}/verify/github`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ username }),
    });
  }

  /** Verify Farcaster account (must have cast containing `helixa:<tokenId>`). */
  async verifyFarcaster(tokenId: number, username?: string, fid?: number): Promise<any> {
    const headers = await this.authHeaders();
    return this.fetch(`/api/v2/agent/${tokenId}/verify/farcaster`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ username, fid }),
    });
  }

  /** Link a token contract to an agent. */
  async linkToken(tokenId: number, token: { contractAddress: string; chain: string; symbol: string; name: string }): Promise<any> {
    const headers = await this.authHeaders();
    return this.fetch(`/api/v2/agent/${tokenId}/link-token`, {
      method: 'POST',
      headers,
      body: JSON.stringify(token),
    });
  }

  /** Send a message to a group channel (requires Cred gate). */
  async sendMessage(groupId: string, content: string): Promise<{ message: ChatMessage }> {
    const headers = await this.authHeaders();
    return this.fetch(`/api/v2/messages/groups/${groupId}/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content }),
    });
  }

  /** Join a message group. */
  async joinGroup(groupId: string): Promise<any> {
    const headers = await this.authHeaders();
    return this.fetch(`/api/v2/messages/groups/${groupId}/join`, {
      method: 'POST',
      headers,
    });
  }

  /** Create a new message group (requires Investment Grade Cred 51+). */
  async createGroup(options: { topic: string; description?: string; minCred?: number; isPublic?: boolean }): Promise<{ group: MessageGroup }> {
    const headers = await this.authHeaders();
    return this.fetch('/api/v2/messages/groups', {
      method: 'POST',
      headers,
      body: JSON.stringify(options),
    });
  }
}
