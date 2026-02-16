# Helixa V2 Security Audit Report

**Date:** 2026-02-16  
**Auditor:** OpenClaw Security Subagent  
**Scope:** V2 API Server, HelixaV2 Smart Contract, Frontend, Infrastructure  
**Severity Scale:** CRITICAL / HIGH / MEDIUM / LOW

---

## Executive Summary

The Helixa V2 system has **2 critical**, **5 high**, **7 medium**, and **6 low** severity findings. The most urgent issue is a **plaintext private key committed to the `.env` file** which controls all minting and verification operations. Several API endpoints lack rate limiting, input sanitization is incomplete, and the payment verification system has replay vulnerabilities.

---

## CRITICAL

### C1 — Deployer Private Key Exposed in `.env` File

**Severity:** CRITICAL  
**Location:** `/agentdna/.env`

The deployer private key is stored in plaintext:
```
DEPLOYER_KEY=0xf4c7d8de8afd557beadd803fb1e07b0237ee57e64059b7870c9fc018c2b4e6fa
```

This key controls:
- All `mintFor()` calls (owner-only minting)
- `verify()` — marking agents as verified
- `setCoinbaseVerified()` — Coinbase attestation status
- `addPoints()` / `awardBonusPoints()` — arbitrary point inflation
- `setPricing()` — zeroing mint/trait/name prices
- `withdraw()` — draining contract ETH balance
- `setTreasury()` — redirecting treasury
- All ERC-8004 cross-registrations (signed by this wallet)

If this EC2 instance is compromised, the attacker gains full control of the protocol.

**Recommended Fix:**
1. **Immediately rotate this key** — deploy a new contract with a fresh deployer or transfer ownership.
2. Use AWS Secrets Manager or KMS for key storage.
3. Use a multisig (Safe) as contract owner instead of an EOA.
4. Never commit `.env` to git — verify `.gitignore` includes it.
5. Consider a hardware wallet or MPC signer for production.

---

### C2 — x402 Payment Proof Replay Attack

**Severity:** CRITICAL  
**Location:** `v2-server.js` lines ~130-165 (`paymentCache`, `verifyUSDCPayment`)

The payment verification caches `txHash → true` but **never checks if a txHash has already been used for a different request**. An attacker can:

1. Pay once (send USDC tx).
2. Reuse the same `X-Payment-Proof` txHash on unlimited future requests.

The `paymentCache` is a simple `Map()` that stores `true` for verified hashes, and re-returns `true` on subsequent lookups — effectively an **infinite replay**.

Additionally, the cache is **in-memory only** — a server restart clears it, allowing re-use of old txHashes.

**Recommended Fix:**
1. Track used txHashes in a persistent store (database/file) and reject duplicates.
2. Associate each payment with a specific request (nonce or endpoint+params).
3. Verify the payment was made recently (block timestamp within N minutes).
4. Check `from` address matches the authenticated SIWA address.

---

## HIGH

### H1 — No Rate Limiting on Any Endpoint

**Severity:** HIGH  
**Location:** `v2-server.js` — entire Express app

No rate limiting middleware exists. An attacker can:
- **DoS the API** with request floods.
- **Drain the deployer wallet's gas** by spamming authenticated mint/update endpoints (each triggers on-chain transactions paid by the deployer).
- **Enumerate all agents** via `/api/v2/agents` pagination.
- **Brute-force referral codes** via `/api/v2/referral/:code`.

The gas-drain vector is especially severe: each SIWA-authenticated mint costs the deployer gas for 4+ transactions (mint, personality, narrative, tokenURI, cross-reg).

**Recommended Fix:**
1. Add `express-rate-limit` — e.g., 10 req/min for write endpoints, 60 req/min for reads.
2. Per-IP and per-SIWA-address rate limits for authenticated endpoints.
3. Gas budget monitoring with auto-pause if spend exceeds threshold.

---

### H2 — Deployer Wallet as Single Point of Failure (Centralization Risk)

**Severity:** HIGH  
**Location:** Smart contract `onlyOwner` functions + `v2-server.js` wallet usage

A single EOA controls all privileged operations:
- `mintFor`, `verify`, `setCoinbaseVerified`, `awardBonusPoints`, `setPricing`, `setCredWeights`, `setTreasury`, `withdraw`

If this key is compromised, lost, or the server goes down, no one else can mint agents via SIWA or perform admin operations.

**Recommended Fix:**
1. Transfer ownership to a multisig (Gnosis Safe).
2. Implement role-based access (OpenZeppelin `AccessControl`) — separate minter, verifier, admin roles.
3. Add a timelock for sensitive admin functions (`setPricing`, `setTreasury`, `setCredWeights`).

---

### H3 — CORS Allows All Origins

**Severity:** HIGH  
**Location:** `v2-server.js` line ~213

```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```

Any website can make authenticated API calls to the Helixa API. While SIWA requires wallet signatures (limiting direct exploitation), this enables:
- Phishing sites that trick agents into signing SIWA tokens and forwarding them.
- Cross-origin data exfiltration of agent data.
- Third-party sites embedding API calls without permission.

**Recommended Fix:**
```javascript
const ALLOWED_ORIGINS = ['https://helixa.xyz', 'https://api.helixa.xyz', 'http://localhost:5173'];
res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(req.headers.origin) ? req.headers.origin : '');
```

---

### H4 — Points System Inflation via Repeated Updates

**Severity:** HIGH  
**Location:** `HelixaV2.sol` — `setPersonality`, `setNarrative`, `setOrigin`, `setMission`, `setLore`, `setManifesto`

Every call to these functions awards `UPDATE_POINTS` (5 points) with no cooldown or cap. An agent owner can call `setPersonality` thousands of times to farm unlimited points, inflating their score and gaming the leaderboard.

The API compounds this: via `POST /api/v2/agent/:id/update`, the deployer wallet pays gas for each update, meaning an attacker gets free point farming at the deployer's expense.

**Recommended Fix:**
1. Add a cooldown (e.g., 1 update per hour per tokenId) on the contract.
2. Cap total update points per token (e.g., max 100 from updates).
3. On the API side, rate-limit updates per SIWA address.

---

### H5 — `setMetadata` Access Control Mismatch (API vs Contract)

**Severity:** HIGH  
**Location:** `HelixaV2.sol` `setMetadata` is `onlyTokenOwner`, but `v2-server.js` calls it via the deployer wallet

The contract's `setMetadata(tokenId, uri)` requires `msg.sender == ownerOf(tokenId)`. But the API server calls it using the deployer wallet. This only works because the deployer is the `owner` (from `Ownable`)... **except `setMetadata` uses `onlyTokenOwner`, not `onlyOwner`**.

This means `setMetadata` in the mint flow will **revert** unless the deployer is also the token owner. Since `mintFor` mints to `agentAddress` (not deployer), the deployer is NOT the token owner. The tokenURI set call in the mint flow is likely failing silently (caught in try/catch).

**Recommended Fix:**
1. Add an `onlyOwner` override for `setMetadata` in the contract, or
2. Have the API set the tokenURI before transferring ownership, or  
3. Use a separate `setTokenURIByOwner` function that is `onlyOwner`.

---

## MEDIUM

### M1 — SIWA Token Not Bound to Specific Action

**Severity:** MEDIUM  
**Location:** `v2-server.js` SIWA authentication

The SIWA token format is: `Bearer {address}:{timestamp}:{signature}`

The signed message is generic: `"Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet {address} at {timestamp}"`

This token is valid for **any endpoint** for 1 hour. An attacker who intercepts a SIWA token (e.g., from logs, MITM on non-TLS connection) can use it for any action: minting, updating, verifying.

**Recommended Fix:**
1. Include the intended action/endpoint in the signed message.
2. Add a nonce to prevent replay within the validity window.
3. Reduce expiry to 5-10 minutes.

---

### M2 — Referral System Gaming

**Severity:** MEDIUM  
**Location:** `v2-server.js` referral logic

**Self-referral prevention is weak.** The only check is:
```javascript
if (refWallet && refWallet.toLowerCase() !== agentAddress.toLowerCase())
```

An attacker with two wallets (trivial to create) can:
1. Mint agent A with wallet 1 → gets referral code.
2. Mint agent B with wallet 2, using A's referral code → both get bonus points.

The referral lookup iterates **all tokens** to find the referrer's tokenId (`O(n)` linear scan), which also creates a DoS vector at scale.

**Recommended Fix:**
1. Require on-chain referral validation or Coinbase attestation before referral eligibility.
2. Cap referral rewards per code (e.g., max 10 referrals).
3. Store a `wallet → tokenId` mapping instead of linear scanning.

---

### M3 — Unbounded On-Chain String Storage

**Severity:** MEDIUM  
**Location:** `HelixaV2.sol` — personality, narrative, traits, name, framework, version

No length limits on string fields (except `_validName` for .agent names at 32 chars). An attacker can store arbitrarily large strings in personality quirks, narrative lore, etc., causing:
- High gas costs for readers (view functions return full strings).
- Storage bloat on-chain.
- Potential OOG (out of gas) on `getAgent` / `formatAgentV2` calls.

**Recommended Fix:**
Add `require(bytes(text).length <= 500)` (or similar) to all string setters.

---

### M4 — No Input Sanitization on Agent Names/Strings

**Severity:** MEDIUM  
**Location:** `v2-server.js` mint endpoint, `HelixaV2.sol`

The API validates `name.length` (1-64 chars) but doesn't sanitize content. Malicious names could contain:
- XSS payloads rendered in the frontend (e.g., `<script>alert(1)</script>`).
- Unicode/zero-width characters for impersonation.
- Control characters breaking JSON responses.

The frontend renders agent names directly, potentially enabling stored XSS via the API → contract → API → frontend pipeline.

**Recommended Fix:**
1. Sanitize names to alphanumeric + limited punctuation on the API side.
2. HTML-encode all user content in the frontend.
3. Add Content-Security-Policy headers.

---

### M5 — In-Memory Referral Database

**Severity:** MEDIUM  
**Location:** `v2-server.js` — `referralRegistry`, `referralStats`, `paymentCache`

Critical state is stored in-memory:
- `paymentCache` — lost on restart (enables payment replay).
- `referralRegistry` — persisted to JSON file but loaded on startup; concurrent writes could corrupt.
- `referralStats` — same file, same risks.

No file locking, no atomic writes, no backup.

**Recommended Fix:**
1. Use SQLite or PostgreSQL for persistent state.
2. Atomic file writes (write to temp, rename).
3. Regular backups of `data/referrals.json`.

---

### M6 — Error Messages Leak Internal Details

**Severity:** MEDIUM  
**Location:** `v2-server.js` — multiple `catch` blocks

Error responses include raw error messages:
```javascript
res.status(500).json({ error: 'Mint failed: ' + e.message.slice(0, 200) });
```

This can leak contract revert reasons, RPC errors, file paths, and internal state to attackers.

**Recommended Fix:**
Return generic error messages to clients. Log detailed errors server-side only.

---

### M7 — Frontend Exposes WalletConnect Project ID

**Severity:** MEDIUM  
**Location:** `frontend-v2/.env`

```
VITE_PROJECT_ID=79555f4c73d677402a6c1b29978b3569
```

While `VITE_`-prefixed vars are intentionally public in Vite, this project ID could be abused for rate-limited WalletConnect API calls or impersonation.

**Recommended Fix:**
1. Set WalletConnect project ID usage restrictions in the WalletConnect dashboard (domain allowlist).
2. Monitor usage for anomalies.

---

## LOW

### L1 — No Helmet/Security Headers

**Severity:** LOW  
**Location:** `v2-server.js`

Missing standard security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`.

**Fix:** Add `helmet` middleware.

---

### L2 — Custom `.env` Parser Instead of `dotenv`

**Severity:** LOW  
**Location:** `v2-server.js` lines 22-27

Hand-rolled `.env` parser doesn't handle edge cases (quoted values, comments, multiline). Could lead to parsing bugs or unexpected behavior.

**Fix:** Use the `dotenv` package.

---

### L3 — `uncaughtException` Handler Continues Execution

**Severity:** LOW  
**Location:** `v2-server.js` — bottom

```javascript
process.on('uncaughtException', (err) => console.error('Uncaught:', err.message || err));
```

Catching uncaught exceptions without exiting leaves the process in an undefined state. Node.js docs explicitly warn against this.

**Fix:** Log the error and exit: `process.exit(1)`. Use a process manager (PM2) to restart.

---

### L4 — No Request Logging/Audit Trail

**Severity:** LOW  
**Location:** `v2-server.js`

No request logging middleware. Impossible to detect attacks, trace issues, or audit access patterns post-incident.

**Fix:** Add `morgan` or similar request logger. Log SIWA-authenticated requests with wallet address.

---

### L5 — Cloudflare Tunnel URL is Ephemeral

**Severity:** LOW  
**Location:** Frontend `.env` — `VITE_API_URL=https://doctrine-deals-helped-searching.trycloudflare.com`

Using a `trycloudflare.com` quick tunnel means the URL changes on restart. This is fine for dev but in production:
- No persistent domain for API consumers.
- No Cloudflare WAF/DDoS protection configuration possible.

**Fix:** Use a named Cloudflare Tunnel with a permanent subdomain.

---

### L6 — Contract `withdraw()` Sends to Treasury with No Reentrancy Guard

**Severity:** LOW  
**Location:** `HelixaV2.sol` `withdraw()` function

```solidity
(bool ok,) = treasury.call{value: address(this).balance}("");
```

If `treasury` is a malicious contract, it could re-enter. However, since `withdraw()` is `onlyOwner` and treasury is set by owner, this is low-risk in practice.

**Fix:** Add `nonReentrant` modifier (OpenZeppelin `ReentrancyGuard`) or use `Address.sendValue`.

---

## Smart Contract Specific Notes

### No Reentrancy in Minting
The `_safeMint` in `_mintAgent` calls `onERC721Received` on the recipient if it's a contract. This could enable reentrancy, but since `_nextTokenId` is incremented before the external call and `hasMinted` is set before minting, the risk is mitigated. Still, adding `ReentrancyGuard` is best practice.

### Soulbound Implementation is Correct
The `_update` override properly blocks transfers of soulbound tokens while allowing minting. No bypass found.

### Cred Score Calculation
Integer arithmetic is safe (no overflow risk in Solidity 0.8+). The score is capped at 100. No manipulation vector beyond the points inflation issue (H4).

### Name Validation
The `_validName` function correctly restricts to alphanumeric + hyphen + underscore, 2-32 chars. The `_lower` function works correctly for ASCII. No homoglyph or Unicode bypass possible due to the strict charset.

---

## Priority Remediation Order

| Priority | Issue | Effort |
|----------|-------|--------|
| 1 | **C1** — Rotate deployer key, use secrets manager | Hours |
| 2 | **C2** — Fix payment replay with persistent used-tx tracking | Hours |
| 3 | **H1** — Add rate limiting | Hours |
| 4 | **H2** — Migrate to multisig ownership | Days |
| 5 | **H3** — Restrict CORS origins | Minutes |
| 6 | **H4** — Cap update points | Hours |
| 7 | **H5** — Fix setMetadata access control | Hours |
| 8 | **M1** — Bind SIWA tokens to actions | Days |
| 9 | **M4** — Input sanitization | Hours |
| 10 | **M2** — Anti-gaming for referrals | Days |
| 11 | **M5** — Persistent database | Days |
| 12 | **M3** — String length limits on-chain | Requires redeploy |
| 13 | **M6** — Sanitize error messages | Hours |
| 14 | **L1-L6** — Security headers, logging, misc | Hours each |

---

## Summary

The system's architecture is sound but has critical operational security gaps, primarily around key management and payment verification. The smart contract is well-structured with no major vulnerabilities, though the centralized owner model and unbounded string storage are concerns. The API layer needs rate limiting, CORS restrictions, and persistent state management before handling real value.

**Immediate actions:** Rotate the deployer key, restrict CORS, add rate limiting.
