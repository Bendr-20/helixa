# Helixa Code Audit — February 23, 2025

**Auditor:** Automated deep-dive audit  
**Scope:** Smart contracts, API/backend, frontend, code cleanliness  
**Date:** 2025-02-23  
**Codebase:** `agentdna/` (Helixa V2 — onchain AI agent identity)

---

## Executive Summary

Helixa is an ambitious project building onchain identity infrastructure for AI agents. The V2 contract (HelixaV2.sol) is well-designed and the ERC-8004 compliance work is solid. However, the codebase has **one true critical vulnerability** (deployer private key in plaintext .env committed to the workspace), several high-severity API issues, and significant code hygiene problems typical of a fast-moving early-stage project.

The API layer (`v2-server.js`) is a **2,945-line monolith** that handles authentication, payments, minting, verification, messaging, social verification, cred reports, and more — all in a single file. It works, but it's a maintenance and security liability.

**Overall assessment:** The smart contracts are competent. The API is functional but fragile. The frontend/docs directory is a mess. There's a lot of dead code.

**Slop Score: 4.5/10** — Functional prototype quality. Not production-grade. The team clearly moves fast and ships, but hasn't circled back to clean up.

---

## Findings by Severity

### 🔴 CRITICAL

#### C-01: Deployer Private Key in Plaintext .env
- **Location:** `.env:1`
- **Description:** `DEPLOYER_KEY=0x6a28b39709a30a1efad15224c8525c43bb7ca25478cd86cf24528d93b010e050` is stored in plaintext. While `.env` is in `.gitignore`, the key is sitting on disk in the workspace. Anyone with read access to this server can drain the deployer wallet and execute owner-only contract functions (verify agents, mint for free, withdraw funds, set pricing to 0, etc.).
- **Impact:** Total compromise of all contract admin functions. Fund theft. Ability to mint unlimited agents, verify/unverify at will, change treasury address.
- **Recommendation:** 
  1. **Rotate this key immediately** — it's now in this audit file's context
  2. Use a hardware wallet or KMS (AWS KMS, GCP Cloud HSM) for signing
  3. At minimum, use environment injection (systemd EnvironmentFile, Docker secrets) — never on disk

#### C-02: Deployer Key Used as HMAC Secret for Cred Report Receipts
- **Location:** `api/v2-server.js:1807` — `crypto.createHmac('sha256', DEPLOYER_KEY.slice(0, 32))`
- **Description:** The deployer's private key (first 32 chars, which is `0x6a28b39709a30a1efad15224c852`) is used as the HMAC key for signing Cred Report receipts. This means:
  1. The receipt verification endpoint effectively leaks oracle access to a derivative of the private key
  2. If the HMAC is ever reverse-engineered or brute-forced, it reveals a prefix of the private key
- **Impact:** Weakened key security, correlation attack vector
- **Recommendation:** Use a separate, dedicated HMAC secret for receipt signing. Never derive secrets from the deployer key.

#### C-03: X/Twitter Bearer Token in .env
- **Location:** `.env:4` — `X_BEARER_TOKEN=AAAAAAA...`
- **Description:** Twitter/X API bearer token stored in plaintext alongside the deployer key.
- **Impact:** If compromised, attacker can read Twitter data, potentially post as the app.
- **Recommendation:** Rotate. Use proper secret management.

---

### 🟠 HIGH

#### H-01: V1 API Server Has No Authentication on Minting
- **Location:** `api/server.js` — `POST /api/mint`
- **Description:** The V1 server's mint endpoint has zero authentication. Anyone can POST to it and get a free gasless mint via `mintFree()`. The only protection is a 1-hour cooldown per address, which is trivially bypassed with multiple addresses.
- **Impact:** Unlimited free minting by anyone who finds the V1 endpoint. Sybil attack vector.
- **Recommendation:** Disable the V1 server entirely, or add SIWA auth. If both servers run simultaneously, this is an open door.

#### H-02: V1 API CORS Set to Wildcard `*`
- **Location:** `api/server.js:~line 10` — `res.setHeader('Access-Control-Allow-Origin', '*')`
- **Description:** V1 server allows requests from any origin. Combined with H-01, any website can trigger mints.
- **Impact:** Cross-origin attacks, CSRF-like minting from malicious sites.
- **Recommendation:** Restrict CORS to known origins (V2 already does this correctly).

#### H-03: V2 CORS Bypass for Non-Browser Requests
- **Location:** `api/v2-server.js:~line 375`
- **Description:** When `!origin` (no Origin header), the server sets `Access-Control-Allow-Origin: *`. This is intentional for agent/curl access, but means any server-side proxy can bypass CORS restrictions.
- **Impact:** CORS is effectively advisory, not a security boundary. Any backend can call authenticated endpoints.
- **Recommendation:** This is acceptable for an agent-facing API, but document it explicitly. Don't rely on CORS for security — SIWA auth is the real boundary.

#### H-04: `onlyTokenOwnerOrOwner` Modifier — Centralization Risk
- **Location:** `src/v2/HelixaV2.sol:~line 131`
- **Description:** The `onlyTokenOwnerOrOwner` modifier allows the **contract owner** to modify ANY agent's metadata, personality, narrative, traits, and wallet — without the token holder's consent. This means:
  - Owner can overwrite any agent's personality/narrative
  - Owner can change any agent's wallet address (with a forged signature — see H-05)
  - Owner can add traits to any agent
  - Owner can set metadata URI for any agent
- **Impact:** The contract owner is a single EOA with god-mode over all agent data. This undermines the trust model — agents can't trust that their identity is immutable.
- **Recommendation:**
  1. Document this clearly as a known centralization vector
  2. Plan migration to a multi-sig or timelock for owner actions
  3. Consider removing owner override for `setPersonality`, `setNarrative`, individual narrative setters — these should be token-owner-only
  4. Keep owner override only for `setMetadata`/`setAgentURI` (needed for API-minted agents)

#### H-05: `setAgentWallet` Signature Verification Bypass via Owner
- **Location:** `src/v2/HelixaV2.sol:~line 233`
- **Description:** `setAgentWallet` requires the new wallet to sign approval, but the `onlyTokenOwnerOrOwner` modifier means the **contract owner** can call this for any token. The owner could set any agent's wallet to an address they control (they'd need to also provide a valid signature from that address, but since they control the new address, this is trivial).
- **Impact:** Contract owner can hijack any agent's wallet mapping.
- **Recommendation:** `setAgentWallet` should use `onlyTokenOwner` (not `onlyTokenOwnerOrOwner`).

#### H-06: No Input Sanitization on Onchain Strings
- **Location:** `src/v2/HelixaV2.sol` — all `calldata string` parameters
- **Description:** No length limits on personality strings, narrative strings, trait names, etc. A single transaction could store megabytes of data in personality.quirks, for example.
- **Impact:** Storage griefing — attacker can bloat contract state, increase gas costs for reads, potentially DoS view functions.
- **Recommendation:** Add `require(bytes(text).length <= MAX_LEN)` checks on all string inputs. The API does this (256 char limit), but the contract doesn't — anyone calling directly bypasses the API limits.

#### H-07: Points Can Be Farmed Infinitely via Repeated Updates
- **Location:** `src/v2/HelixaV2.sol` — `setPersonality`, `setNarrative`, `setOrigin`, `setMission`, `setLore`, `setManifesto`
- **Description:** Each call to any narrative setter awards `UPDATE_POINTS` (5 points). There's no cooldown or cap. A token owner can call `setOrigin()` in a loop 10,000 times and accumulate 50,000 points + the initial `NARRATIVE_POINTS` bonuses.
- **Impact:** Points system is meaningless — anyone can inflate their score. Undermines Cred Score if points factor in.
- **Recommendation:** Either remove points from repeated updates, add a cooldown, or cap total points per action type.

---

### 🟡 MEDIUM

#### M-01: V2 Server is a 2,945-line Monolith
- **Location:** `api/v2-server.js`
- **Description:** Authentication, payment processing, minting, trait management, social verification, messaging, cred reports, referrals, OG benefits, metadata rendering, aura generation, OpenAPI spec, and 8004 cross-registration — all in one file.
- **Impact:** Maintenance nightmare. Hard to test, hard to review, hard to audit. Any change risks breaking unrelated functionality.
- **Recommendation:** Split into modules: `routes/`, `middleware/`, `services/`, `utils/`.

#### M-02: Race Condition in `usedPayments` Replay Prevention
- **Location:** `api/v2-server.js:~line 226`
- **Description:** `usedPayments` is an in-memory Set that's persisted to JSON. If the server crashes between adding to the Set and saving to disk, a payment could be replayed after restart. Also, the x402 facilitator flow (verify → settle) doesn't use the usedPayments set at all — it relies entirely on the facilitator's replay protection.
- **Impact:** Potential payment replay if server crashes at the wrong moment (legacy flow). x402 flow delegates replay protection to facilitator.
- **Recommendation:** Use a database (SQLite is already available via the indexer) for atomic payment tracking.

#### M-03: Referral Code Generation is Predictable
- **Location:** `api/v2-server.js:~line 490`
- **Description:** Referral codes are derived from agent names (lowercased, sanitized). If name is "Bendr", code is "bendr". Collision avoidance just appends `-2`, `-3`, etc.
- **Impact:** Low — referral codes are public anyway. But predictability means competitors could pre-register referral codes for common agent names.
- **Recommendation:** Add a random suffix to all codes.

#### M-04: Social Verification Can Be Gamed
- **Location:** `api/v2-server.js` — `/verify/x`, `/verify/github`, `/verify/farcaster`
- **Description:** 
  - X verification: bio check via syndication scraper is easily spoofable (put pattern in bio, verify, remove it)
  - GitHub verification: gist check — same issue (create gist, verify, delete gist)
  - Farcaster: cast check — same (post, verify, delete)
  - Once verified, the onchain trait is permanent. No re-verification mechanism.
- **Impact:** Verification is a one-time check that can be gamed. A verified X trait doesn't mean the account still has the verification string.
- **Recommendation:** Document this limitation. Consider periodic re-verification or storing the verified handle onchain for public audit.

#### M-05: `totalAgents` Counter Never Decrements
- **Location:** `src/AgentDNA.sol:~line 71`, `src/v2/HelixaV2.sol`
- **Description:** `totalAgents++` on mint, but there's no burn function and no decrement. If tokens are burned (via ERC721 mechanics), `totalAgents` becomes inaccurate.
- **Impact:** Misleading protocol statistics.
- **Recommendation:** Override `_update` to decrement on burn, or rename to `totalMinted`.

#### M-06: `_lower()` Function Mutates Input String In-Place
- **Location:** `src/v2/HelixaV2.sol:~line 465`
- **Description:** `_lower(string memory s)` modifies the bytes of `s` in place and returns it. In Solidity, `memory` parameters can be aliased. If the caller holds another reference to the same memory, it's now lowercased unexpectedly.
- **Impact:** Potential logic bugs if `_lower` is called on a string that's used elsewhere. Currently safe because it's only called on `name` parameter in `registerName`, but fragile.
- **Recommendation:** Create a new bytes array instead of mutating in place.

#### M-07: V1 and V2 Servers Share Same Contract and Deployer
- **Location:** `api/server.js`, `api/v2-server.js`
- **Description:** Both V1 (port 3456) and V2 (port 3457) servers use the same `DEPLOYER_KEY` and `V2_CONTRACT`. V1 has weaker security (no auth on mint). If both are running, V1 is a backdoor.
- **Impact:** V1 bypasses all V2 security improvements.
- **Recommendation:** Kill V1. If it must exist, put it behind the same SIWA auth.

#### M-08: Cred Report Receipt HMAC Verification Endpoint is Unauthenticated
- **Location:** `api/v2-server.js:~line 1820`
- **Description:** `POST /api/v2/cred-report/verify-receipt` accepts any payload and tells you if the HMAC matches. This is an oracle that could be used to brute-force the HMAC key (which is derived from the deployer key per C-02).
- **Impact:** Information leakage — attacker can test HMAC keys at API speed.
- **Recommendation:** Rate-limit this endpoint aggressively, or better, use a proper JWT/signature scheme.

---

### 🟢 LOW

#### L-01: `withdraw()` in `contracts/AgentDNA.sol` Uses `transfer()`
- **Location:** `contracts/AgentDNA.sol:~line 117`
- **Description:** Uses `payable(owner()).transfer(address(this).balance)` which has a 2300 gas stipend. If the owner is a contract (multisig), this will fail.
- **Impact:** Funds could become locked if owner is upgraded to a multisig.
- **Recommendation:** Use `call{value: ...}("")` pattern (V2 already does this correctly).

#### L-02: Soulbound Check Can Be Bypassed by Owner
- **Location:** `src/v2/HelixaV2.sol:~line 436` 
- **Description:** The `_update` override blocks transfers of soulbound tokens, but there's no mechanism to prevent the contract owner from calling `setAgentWallet` to effectively reassign the agent's operating address.
- **Impact:** Soulbound guarantee is weaker than advertised.
- **Recommendation:** Clarify that soulbound prevents NFT transfer but not wallet reassignment.

#### L-03: Rate Limiter Uses In-Memory Maps
- **Location:** `api/v2-server.js:~line 395`
- **Description:** Rate limiting state is in-memory. Server restart resets all limits.
- **Impact:** Attacker can bypass rate limits by waiting for server restart or causing a crash.
- **Recommendation:** Use Redis or SQLite for rate limit state.

#### L-04: `hasMinted` in HelixaV2 Uses `msg.sender` for Human Mint but `agentAddress` for SIWA Mint
- **Location:** `src/v2/HelixaV2.sol:~line 160, 175`
- **Description:** `mint()` checks `hasMinted[msg.sender]`, while `mintWithSIWA()` checks `hasMinted[agentAddress]`. This means one wallet could mint once as human AND once via SIWA (if they control the agent address).
- **Impact:** Double-mint possible for sophisticated users.
- **Recommendation:** Check both `msg.sender` and `agentAddress` in both functions.

#### L-05: No ERC-8004 Interface ID in `supportsInterface`
- **Location:** `src/v2/HelixaV2.sol`
- **Description:** Claims ERC-8004 compliance but doesn't register an ERC-8004 interface ID in `supportsInterface()`. Other contracts can't detect 8004 compliance programmatically.
- **Impact:** Interoperability — other protocols can't verify 8004 compliance onchain.
- **Recommendation:** Define and register an ERC-8004 interface ID.

#### L-06: `mintFor` Allows Setting Arbitrary `MintOrigin`
- **Location:** `src/v2/HelixaV2.sol:~line 200`
- **Description:** Owner-only `mintFor` accepts any `MintOrigin` enum value. Owner could mint with `AGENT_SIWA` origin even though no SIWA verification occurred.
- **Impact:** Origin data is unreliable for owner-minted tokens.
- **Recommendation:** Force `MintOrigin.OWNER` for `mintFor`, or validate the origin parameter.

---

### ℹ️ INFO

#### I-01: 54MB of Privy/WalletConnect Bundles in `docs/assets/`
- **Location:** `docs/assets/` — 1,861 JavaScript files
- **Description:** The `docs/` directory contains a built frontend with massive bundled assets including Privy auth screens, WalletConnect modals, Reservoir, secp256k1, ethers, etc.
- **Impact:** Bloated repo, slow clones, confusing structure (docs/ is actually a deployed frontend).
- **Recommendation:** Move to a proper deployment pipeline. Don't store built assets in the repo.

#### I-02: DNAToken.sol is Unused/Aspirational
- **Location:** `src/DNAToken.sol`
- **Description:** A fully implemented ERC-20 token with staking, burn mechanics, governance, and reward distribution. No evidence it's deployed or referenced anywhere. The project uses $CRED (deployed via Bankr) instead.
- **Impact:** Dead code creating confusion about the token model.
- **Recommendation:** Move to `archive/` or delete. Add a note that $CRED is the actual token.

#### I-03: AgentTrustScore.sol Has Buggy Scaling Math
- **Location:** `src/AgentTrustScore.sol:~line 100-110`
- **Description:** When `registry == address(0)`, the scaling math attempts to redistribute 10 points across other components. The calculation `activity * 100 / maxRaw` (where maxRaw=90) can overflow the component's intended maximum. The clamping logic at the end only caps `ownerStability`, creating distorted scores.
- **Impact:** Trust scores could be inaccurate when no cross-registry is configured.
- **Recommendation:** Fix the scaling math or remove the redistribution logic.

#### I-04: `contracts/AgentDNA.sol` vs `src/AgentDNA.sol` — Two Different V1 Contracts
- **Location:** `contracts/AgentDNA.sol`, `src/AgentDNA.sol`
- **Description:** Two different V1 contracts with the same name but different features. `contracts/` version is simpler (no ERC-8004), `src/` version is fuller (ERC-8004, points, tiers, referrals). Unclear which was deployed.
- **Impact:** Confusion about which contract is canonical.
- **Recommendation:** Archive the older version. Add a clear `DEPLOYED.md` documenting which contracts are live and at what addresses.

#### I-05: Multiple OG Migration Scripts
- **Location:** `api/og-traits.js`, `api/og-traits2.js`, `api/og-traits3.js`, `api/og-migrate.js`, `api/og-update.js`
- **Description:** Five separate one-shot migration/fix scripts left in the `api/` directory.
- **Impact:** Clutter. Someone might accidentally run them.
- **Recommendation:** Move to `scripts/archive/` or delete.

#### I-06: `test-x402-mint.js`, `test-x402-v2.js` in Root
- **Location:** Root directory
- **Description:** Test files with hardcoded contract addresses and test logic sitting in the project root.
- **Impact:** Clutter, potential confusion.
- **Recommendation:** Move to `test/` directory.

#### I-07: `fix-token-uris.js`, `register-8004-*.js`, `reregister-8004.js` in Root
- **Location:** Root directory
- **Description:** One-shot fix/migration scripts in the root.
- **Impact:** Clutter.
- **Recommendation:** Move to `scripts/` or delete.

#### I-08: 67 `console.log` Statements in v2-server.js
- **Location:** `api/v2-server.js`
- **Description:** 67 console.log/error/warn calls. Many include sensitive context (tx hashes, wallet addresses, error messages).
- **Impact:** Log noise in production. Potential information leakage if logs are exposed.
- **Recommendation:** Use a proper logging library (winston/pino) with log levels. Remove or downgrade debug logs.

#### I-09: `api/contract.js` Uses ES Modules but `api/server.js` Uses CommonJS
- **Location:** `api/contract.js` (ES `import`), `api/server.js` (CommonJS `require`)
- **Description:** Mixed module systems in the same directory.
- **Impact:** Can't import `contract.js` from `server.js` without transpilation.
- **Recommendation:** Pick one. CommonJS is fine for Node.js backend.

#### I-10: No Tests
- **Location:** `test/` directory
- **Description:** The `test/` directory exists but appears to have no meaningful test coverage for the API or contracts.
- **Impact:** No regression protection. Changes break things silently.
- **Recommendation:** Add at minimum: contract unit tests (Foundry), API integration tests (supertest), and SIWA auth tests.

---

## Code Cleanup Recommendations

### Files to Delete
| File/Directory | Reason |
|---|---|
| `api/og-traits.js`, `og-traits2.js`, `og-traits3.js` | One-shot migration scripts, done |
| `api/og-migrate.js`, `og-update.js` | One-shot migration scripts, done |
| `api/test-siwa.js` | Test file in production code |
| `fix-token-uris.js` | One-shot fix script |
| `register-8004-remaining.js` | One-shot script |
| `register-8004-v2.js` | One-shot script |
| `reregister-8004.js` | One-shot script |
| `test-x402-mint.js`, `test-x402-v2.js` | Test files in root |
| `src/DNAToken.sol` | Unused aspirational token |
| `contracts/AgentDNA.sol` | Superseded by `src/AgentDNA.sol` and `src/v2/HelixaV2.sol` |
| `api/server.js` | V1 server — security risk, superseded by v2-server |
| `docs/assets/` (1,861 JS files) | Built frontend bundles — use CI/CD instead |

### Files to Refactor
| File | Issue |
|---|---|
| `api/v2-server.js` (2,945 lines) | Split into modules |
| `src/AgentTrustScore.sol` | Fix scaling math |
| `.env` | Move secrets to proper secret management |

### Structural Issues
1. **No clear separation between deployed and deprecated contracts** — need a `DEPLOYED.md`
2. **`docs/` is actually a deployed frontend**, not documentation — rename or restructure
3. **Root directory has 8+ one-shot scripts** that should be in `scripts/archive/`
4. **Two API servers** (V1 on 3456, V2 on 3457) — kill V1

---

## Smart Contract Summary

| Contract | Status | Quality |
|---|---|---|
| `src/v2/HelixaV2.sol` | **Live (V2)** | Good — well-structured, ERC-8004 compliant, proper events. Main issues: `onlyTokenOwnerOrOwner` centralization, no string length limits, points farming |
| `src/AgentDNA.sol` | **Live (V1?)** | Decent — ERC-8004, points, referrals, tiers. Superseded by V2 |
| `contracts/AgentDNA.sol` | **Deprecated** | Simple V1 without 8004. Uses `transfer()` for withdrawals |
| `src/AgentTrustScore.sol` | **Live** | Has a scaling bug. Gas-heavy view functions (O(n²) category dedup) |
| `src/AgentNames.sol` | **Live** | Clean. No major issues. Missing expiry/renewal mechanism |
| `src/DNAToken.sol` | **Never deployed** | Well-written but unused. $CRED is the actual token |

---

## $CRED Token Note

The project uses $CRED as its token, deployed via Bankr. **We do not control this contract.** This means:
- No ability to add burn mechanics, staking, or governance at the token level
- Token distribution and supply are managed by Bankr's infrastructure
- Any token-gating or burn mechanics would need to be via wrapper contracts

---

## Slop Score: 4.5/10

**Breakdown:**
- **Smart Contracts: 7/10** — Well-written for an early project. Clean inheritance, proper events, good use of OZ. Deducted for centralization, no string limits, points farming.
- **API/Backend: 3/10** — Works, but it's a monolith with 67 console.logs, mixed patterns, no tests, deployer key handling is criminal.
- **Frontend/Docs: 2/10** — 54MB of bundled assets in `docs/`, confusing structure, built artifacts in the repo.
- **Code Hygiene: 3/10** — 12+ dead files in root and api/, two versions of everything, no clear deprecation path, TODOs in production code.
- **Security Posture: 4/10** — SIWA auth is well-implemented, x402 integration is thoughtful, rate limiting exists. But the deployer key issue and V1 backdoor are serious. No audit, no tests.

**The good:** The team clearly understands web3 architecture. The SIWA implementation is clean, x402 integration is ahead of the curve, ERC-8004 compliance is real, and the Cred Score system is a genuinely interesting design.

**The bad:** It's all held together with console.logs and a plaintext private key. One bad day and everything burns.

---

*End of audit.*
