"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Helixa = void 0;
const siwa_js_1 = require("./siwa.js");
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
class Helixa {
    constructor(options = {}) {
        this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
        this.privateKey = options.privateKey;
    }
    // ─── Internal helpers ────────────────────────────────────────
    async fetch(path, init) {
        const url = `${this.baseUrl}${path}`;
        const res = await fetch(url, init);
        if (!res.ok) {
            const body = await res.text();
            let parsed;
            try {
                parsed = JSON.parse(body);
            }
            catch {
                parsed = { error: body };
            }
            const err = new Error(parsed.error || `HTTP ${res.status}`);
            err.status = res.status;
            err.body = parsed;
            throw err;
        }
        return res.json();
    }
    async authHeaders() {
        if (!this.privateKey)
            throw new Error('privateKey required for authenticated endpoints');
        const token = await (0, siwa_js_1.createSIWAToken)(this.privateKey);
        return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    }
    // ─── Public (no auth) ────────────────────────────────────────
    /** Get protocol statistics (total agents, mint price, gas balance). */
    async getStats() {
        return this.fetch('/api/v2/stats');
    }
    /** Get the API discovery/info endpoint. */
    async getInfo() {
        return this.fetch('/api/v2');
    }
    /** List agents with optional filtering and pagination. */
    async getAgents(options = {}) {
        const params = new URLSearchParams();
        if (options.page)
            params.set('page', String(options.page));
        if (options.limit)
            params.set('limit', String(options.limit));
        if (options.sort)
            params.set('sort', options.sort);
        if (options.order)
            params.set('order', options.order);
        if (options.framework)
            params.set('framework', options.framework);
        if (options.verified)
            params.set('verified', options.verified);
        if (options.search)
            params.set('search', options.search);
        if (options.spam)
            params.set('spam', 'true');
        const qs = params.toString();
        return this.fetch(`/api/v2/agents${qs ? '?' + qs : ''}`);
    }
    /** Get a single agent by token ID. */
    async getAgent(tokenId) {
        return this.fetch(`/api/v2/agent/${tokenId}`);
    }
    /** Get OpenSea-compatible metadata for an agent. */
    async getMetadata(tokenId) {
        return this.fetch(`/api/v2/metadata/${tokenId}`);
    }
    /** Get the Cred Score for an agent (convenience — extracted from getAgent). */
    async getCredScore(tokenId) {
        const agent = await this.getAgent(tokenId);
        return agent.credScore;
    }
    /** Check .agent name availability. */
    async checkName(name) {
        return this.fetch(`/api/v2/name/${encodeURIComponent(name)}`);
    }
    /** Check a referral code. */
    async checkReferral(code) {
        return this.fetch(`/api/v2/referral/${encodeURIComponent(code)}`);
    }
    /** Get an agent's referral code/link. */
    async getAgentReferral(tokenId) {
        return this.fetch(`/api/v2/agent/${tokenId}/referral`);
    }
    /** Check V1 OG status for a wallet address. */
    async checkOG(address) {
        return this.fetch(`/api/v2/og/${address}`);
    }
    /** Get aggregated onchain report for an agent. */
    async getReport(tokenId) {
        return this.fetch(`/api/v2/agent/${tokenId}/report`);
    }
    /** Get social verification status for an agent. */
    async getVerifications(tokenId) {
        return this.fetch(`/api/v2/agent/${tokenId}/verifications`);
    }
    /** Get the OpenAPI spec. */
    async getOpenAPI() {
        return this.fetch('/api/v2/openapi.json');
    }
    /** Get the well-known agent registry manifest. */
    async getAgentRegistry() {
        return this.fetch('/.well-known/agent-registry');
    }
    /** List message groups. */
    async getMessageGroups() {
        return this.fetch('/api/v2/messages/groups');
    }
    /** Get messages from a group (public groups only without auth). */
    async getMessages(groupId, options) {
        const params = new URLSearchParams();
        if (options?.limit)
            params.set('limit', String(options.limit));
        if (options?.before)
            params.set('before', options.before);
        const qs = params.toString();
        const headers = {};
        if (this.privateKey) {
            const h = await this.authHeaders();
            Object.assign(headers, h);
        }
        return this.fetch(`/api/v2/messages/groups/${groupId}/messages${qs ? '?' + qs : ''}`, { headers });
    }
    // ─── Authenticated (SIWA required) ───────────────────────────
    /** Mint a new agent identity. Requires privateKey. */
    async mint(request) {
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
    async updateAgent(tokenId, data, onchain = false) {
        const headers = await this.authHeaders();
        return this.fetch(`/api/v2/agent/${tokenId}/update${onchain ? '?onchain=true' : ''}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(data),
        });
    }
    /** Verify agent identity via SIWA (must sign from agent's own wallet). */
    async verify(tokenId) {
        const headers = await this.authHeaders();
        return this.fetch(`/api/v2/agent/${tokenId}/verify`, {
            method: 'POST',
            headers,
        });
    }
    /** Cross-register agent on canonical ERC-8004 Registry. */
    async crossRegister(tokenId) {
        const headers = await this.authHeaders();
        return this.fetch(`/api/v2/agent/${tokenId}/crossreg`, {
            method: 'POST',
            headers,
        });
    }
    /** Check Coinbase EAS attestation and boost Cred Score. */
    async coinbaseVerify(tokenId) {
        const headers = await this.authHeaders();
        return this.fetch(`/api/v2/agent/${tokenId}/coinbase-verify`, {
            method: 'POST',
            headers,
        });
    }
    /** Verify X/Twitter account (must have `helixa:<tokenId>` in bio). */
    async verifyX(tokenId, handle) {
        const headers = await this.authHeaders();
        return this.fetch(`/api/v2/agent/${tokenId}/verify/x`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ handle }),
        });
    }
    /** Verify GitHub account (must have `helixa-verify.txt` gist). */
    async verifyGithub(tokenId, username) {
        const headers = await this.authHeaders();
        return this.fetch(`/api/v2/agent/${tokenId}/verify/github`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ username }),
        });
    }
    /** Verify Farcaster account (must have cast containing `helixa:<tokenId>`). */
    async verifyFarcaster(tokenId, username, fid) {
        const headers = await this.authHeaders();
        return this.fetch(`/api/v2/agent/${tokenId}/verify/farcaster`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ username, fid }),
        });
    }
    /** Link a token contract to an agent. */
    async linkToken(tokenId, token) {
        const headers = await this.authHeaders();
        return this.fetch(`/api/v2/agent/${tokenId}/link-token`, {
            method: 'POST',
            headers,
            body: JSON.stringify(token),
        });
    }
    /** Send a message to a group channel (requires Cred gate). */
    async sendMessage(groupId, content) {
        const headers = await this.authHeaders();
        return this.fetch(`/api/v2/messages/groups/${groupId}/send`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ content }),
        });
    }
    /** Join a message group. */
    async joinGroup(groupId) {
        const headers = await this.authHeaders();
        return this.fetch(`/api/v2/messages/groups/${groupId}/join`, {
            method: 'POST',
            headers,
        });
    }
    /** Create a new message group (requires Investment Grade Cred 51+). */
    async createGroup(options) {
        const headers = await this.authHeaders();
        return this.fetch('/api/v2/messages/groups', {
            method: 'POST',
            headers,
            body: JSON.stringify(options),
        });
    }
}
exports.Helixa = Helixa;
