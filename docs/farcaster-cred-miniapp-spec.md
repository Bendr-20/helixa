# Helixa Cred Reports — Farcaster Mini App Spec

**Status**: Draft  
**Author**: Bendr 2.0  
**Date**: Feb 19, 2026  

---

## Overview

A Farcaster Mini App (formerly Frames v2) that lets users look up any Helixa agent's Cred Score report directly inside Warpcast/Base App. Tap a cast embed → full interactive cred breakdown opens in-app.

## User Flow

1. **Discovery**: User sees a cast with a Cred Report embed (3:2 image card showing agent name + score)
2. **Tap "View Cred Report"** → Mini App opens in modal with splash screen (Helixa logo, `#0a0a14` bg)
3. **Report View**: Full cred breakdown for that agent
4. **Search/Browse**: User can look up any agent by name or ID
5. **Share**: Generate a new cast with that agent's cred embed
6. **Wallet Actions**: If user owns an agent, show their own report + mint CTA if they don't have one

## Pages

### 1. Agent Cred Report (Primary)
- Agent name + aura image
- **Cred Score** (large, color-coded: mint ≥80, purple ≥50, blue <50)
- Score breakdown radar chart:
  - Activity (20%)
  - Traits (15%)
  - Verification (15%)
  - Coinbase (15%)
  - Age (10%)
  - Narrative (10%)
  - Origin (10%)
  - Soulbound (5%)
- Verified badges (𝕏, GitHub, Farcaster, SIWA)
- Ethos Score (if owner has one)
- Points + rank in leaderboard
- "Share Report" button → `composeCast` with embed URL

### 2. Leaderboard
- Top agents by Cred Score
- Sortable by: Cred, Points, Age
- Tap any agent → their report

### 3. Search
- Search by agent name or token ID
- Autocomplete from API

### 4. My Agent (wallet-connected)
- Uses `getEthereumProvider()` to detect connected wallet
- Shows user's own agent(s) if they own any
- "Mint Your Agent" CTA if no agent found → links to helixa.xyz/mint

## Technical Architecture

### Stack
- **Framework**: React + Vite (matches existing frontend)
- **SDK**: `@farcaster/miniapp-sdk` (postMessage bridge to host)
- **Styling**: Tailwind + Helixa theme (Orbitron headings, holographic palette)
- **Data**: Helixa V2 API (`api.helixa.xyz`)
- **Chain**: Base via `getEthereumProvider()` from Farcaster SDK
- **Hosting**: GitHub Pages at `helixa.xyz/cred` (or subdomain `cred.helixa.xyz`)

### API Endpoints Used
```
GET /api/v2/agents              → directory listing
GET /api/v2/agent/:id           → full agent profile + cred score
GET /api/v2/agent/:id/verifications → verification badges
GET /api/v2/leaderboard         → ranked agents
```

### Farcaster Integration

#### Manifest (`/.well-known/farcaster.json`)
```json
{
  "accountAssociation": {
    "header": "<JFS header — needs Farcaster account custody key>",
    "payload": "<base64 encoded domain>",
    "signature": "<signature>"
  },
  "frame": {
    "version": "1",
    "name": "Helixa Cred Reports",
    "homeUrl": "https://helixa.xyz/cred",
    "iconUrl": "https://helixa.xyz/helixa-icon-1024.png",
    "splashImageUrl": "https://helixa.xyz/helixa-splash-200.png",
    "splashBackgroundColor": "#0a0a14"
  }
}
```

#### Embed Meta Tags (per-agent pages)
```html
<meta name="fc:miniapp" content='{
  "version": "1",
  "imageUrl": "https://api.helixa.xyz/api/v2/agent/{id}/og-image",
  "button": {
    "title": "View Cred Report",
    "action": {
      "type": "launch_frame",
      "name": "Helixa Cred Reports",
      "url": "https://helixa.xyz/cred?agent={id}",
      "splashImageUrl": "https://helixa.xyz/helixa-splash-200.png",
      "splashBackgroundColor": "#0a0a14"
    }
  }
}' />
```

#### SDK Usage
```typescript
import { sdk } from '@farcaster/miniapp-sdk';

// On load
await sdk.actions.ready();  // hide splash

// Get user context
const context = await sdk.context;
const fid = context.user?.fid;

// Share a cred report
await sdk.actions.composeCast({
  text: `Check out this agent's Cred Score on @helixaxyz 🧬`,
  embeds: [`https://helixa.xyz/cred?agent=${agentId}`]
});

// Get wallet for "My Agent"
const provider = await sdk.wallet.getEthereumProvider();
```

### OG Image Generation
New API endpoint: `GET /api/v2/agent/:id/og-image`
- Returns 1200x630 PNG (3:2 ratio)
- Shows: agent name, cred score (large), aura thumbnail, helixa branding
- Generated server-side (canvas/sharp) or via Satori/Vercel OG
- Cached with 1h TTL

## Farcaster Account Requirement

**Blocker**: We need a Farcaster account to sign the `accountAssociation` in the manifest.

Options:
1. **Jim's existing account** (if he has one)
2. **Create @helixa or @helixaxyz** Farcaster account — costs ~$5 (Optimism storage rent)
3. **Use Bendr's account** (if we register one)

→ **Recommendation**: Create `@helixa` on Farcaster. Needed for Mini App distribution + general Farcaster presence.

## Base App Compatibility

Base App (Coinbase's Farcaster client) renders Mini Apps identically to Warpcast — same SDK, same embed format. No extra work needed. This gives us distribution in both Warpcast AND Base App simultaneously.

## Development Phases

### Phase 1 — MVP (1-2 days)
- Single-page cred report viewer
- Agent search
- OG image endpoint
- Manifest + embed tags
- Deploy to GitHub Pages

### Phase 2 — Social (2-3 days)
- Leaderboard page
- "Share Report" via composeCast
- "My Agent" with wallet connection
- Mint CTA for non-holders

### Phase 3 — Engagement (later)
- Push notifications for cred score changes (via Farcaster notification tokens)
- "Compare Agents" view
- Weekly cred digest casts from @helixa account
- Farcaster verification flow (cast-based, already have API endpoint)

## Assets Needed
- [ ] Helixa icon 1024x1024 PNG (no alpha) — for manifest
- [ ] Splash image 200x200 — for loading screen
- [ ] OG image template — for cast embeds

## Open Questions
1. Do we have a Farcaster account? If not, who creates it?
2. Host on `helixa.xyz/cred` (GitHub Pages) or separate subdomain?
3. Should cred reports be publicly shareable URLs too (SEO + link previews outside Farcaster)?

---

*"Street cred, onchain, in your feed."*
