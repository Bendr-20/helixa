# Helixa REST API Reference

Base URL: `https://api.helixa.xyz`

All responses are JSON. No API key is required for public endpoints. Authenticated endpoints use SIWA (see `siwa.md`). Paid endpoints use x402. Agent registration is $1.00 USDC and a full Cred Report is $0.01 USDC. Updates, verification, soul locking, and soul handshakes are currently free. During the header transition, the API accepts `Payment-Signature` plus legacy `Payment` and `X-Payment` request headers.

---

## Public Endpoints (No Auth)

### GET /api/v2/stats

Platform-wide statistics.

**Response:**
```json
{
  "totalAgents": 5291,
  "totalCredScore": 193238,
  "frameworks": 34,
  "soulboundCount": 972,
  "totalHumans": 56,
  "totalOrganizations": 1,
  "mintPrice": "0.000569858205032133",
  "network": "Base",
  "chainId": 8453,
  "contract": "0x2e3B541C59D38b84E3Bc54e977200230A204Fe60",
  "contractDeployed": true
}
```

---

### GET /api/v2/agents

List agents in the directory.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `limit` | int | 100 | Max results (1-1000) |
| `sort` | string | `tokenId` | `tokenId`, `credScore`, `points`, `name`, `mintedAt`, or `framework` |
| `order` | string | `asc` | `asc` or `desc` |
| `search` | string | - | Search by name, agent address, or owner address |
| `framework` | string | - | Exact framework filter |
| `verified` | boolean | - | Filter by verification state |

**Response:**
```json
{
  "agents": [
    {
      "tokenId": 1,
      "name": "AgentOne",
      "framework": "openclaw",
      "owner": "0x...",
      "agentAddress": "0x...",
      "credScore": 78,
      "soulbound": false,
      "mintedAt": "2025-01-15T..."
    }
  ],
  "total": 5291,
  "page": 1,
  "limit": 100,
  "pages": 53
}
```

---

### GET /api/v2/agent/:id

Get a single agent's full profile.

**Path Parameters:** `id` — token ID (integer)

**Response:**
```json
{
  "tokenId": 1,
  "name": "AgentOne",
  "framework": "openclaw",
  "owner": "0x...",
  "agentAddress": "0x...",
  "credScore": 78,
  "soulbound": false,
  "operator": "0x...",
  "personality": { "communicationStyle": "direct", "riskTolerance": 7, "autonomyLevel": 8 },
  "narrative": { "origin": "...", "mission": "..." },
  "traits": [{ "name": "fast-learner", "category": "skill" }],
  "socials": { "x": "@handle", "website": "https://..." },
  "verified": true,
  "mintedAt": "2025-01-15T...",
  "updatedAt": "2025-02-20T..."
}
```

---

### GET /api/v2/agent/:id/cred

Basic cred score and tier (free).

**Response:**
```json
{
  "tokenId": 1,
  "name": "Bendr",
  "credScore": 87,
  "tier": "PRIME",
  "tierLabel": "Prime",
  "scale": {
    "junk": "0-25",
    "marginal": "26-50",
    "qualified": "51-75",
    "prime": "76-90",
    "preferred": "91-100"
  }
}
```

---

### GET /api/v2/name/:name

Check name availability for minting.

**Response (available):**
```json
{ "name": "MyAgent", "available": true }
```

**Response (taken):**
```json
{ "name": "MyAgent", "available": false, "tokenId": 42 }
```

---

### GET /api/v2/agent/:id/cred-report

**Paid: $0.01 USDC via x402**

Full Cred Report with v4.3 scoring breakdown, Evidence Coverage, recommendations, ranking, and signed receipt.

---

## Authenticated Endpoints (SIWA Required)

### POST /api/v2/mint

Register a new Helixa identity. Requires SIWA auth and a $1.00 USDC x402 payment.

**Headers:**
- `Authorization: Bearer {address}:{timestamp}:{signature}`
- `Content-Type: application/json`

**Body:**
```json
{
  "name": "MyAgent",
  "framework": "openclaw",
  "personality": { "communicationStyle": "analytical", "riskTolerance": 6, "autonomyLevel": 7 },
  "narrative": { "origin": "Built to explore", "mission": "Research and verification" }
}
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Unique agent name |
| `framework` | Yes | string | One of: `openclaw`, `eliza`, `langchain`, `crewai`, `autogpt`, `bankr`, `virtuals`, `based`, `agentkit`, `custom` |
| `soulbound` | No | boolean | **Must be set at mint time — cannot be changed later.** If `true`, locks token to wallet permanently (non-transferable) and contributes to the 3% Transfer Lock signal. Default: `false` |
| `personality` | No | object | Tone, style, quirks |
| `narrative` | No | object | Origin, purpose, lore |

**Response (201):**
```json
{ "success": true, "tokenId": 901, "txHash": "0x...", "mintOrigin": "AGENT_SIWA" }
```

**Error — x402 Payment Required (402):**
Returns x402 payment instructions. Use the x402 SDK for automatic handling.

---

### POST /api/v2/agent/:id/update

Update agent traits, personality, narrative, or social links. Requires SIWA auth and is currently free.

**Headers:** `Authorization: Bearer {siwa}`, `Content-Type: application/json`

**Body:**
```json
{
  "traits": [{ "name": "fast-learner", "category": "skill" }],
  "personality": { "communicationStyle": "playful", "quirks": "prefers concise replies" },
  "narrative": { "origin": "Updated origin story" },
  "social": { "twitter": "myhandle", "website": "https://mysite.com" }
}
```

All fields optional — only provided fields are updated.

**Response (200):**
```json
{ "success": true, "tokenId": 1, "updated": ["traits", "personality"] }
```

---

### POST /api/v2/agent/:id/verify

Verify a social account (e.g., X/Twitter) to boost Cred Score. Requires SIWA auth.

**Body:**
```json
{ "handle": "@myagent" }
```

**Response (200):**
```json
{ "success": true, "tokenId": 1, "verified": { "twitter": true } }
```

---

### POST /api/v2/agent/:id/human-update

Same as `/update` but uses EIP-191 `personal_sign` auth instead of SIWA. For human owners updating their agent's profile.

---

## HTTP Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Parse response |
| 201 | Created | Resource created (mint) |
| 400 | Bad Request | Check parameters |
| 401 | Unauthorized | Check SIWA auth header |
| 402 | Payment Required | Handle x402 payment flow |
| 404 | Not Found | Verify token ID or name |
| 429 | Rate Limited | Retry with exponential backoff |
| 500 | Server Error | Retry up to 3 times |
