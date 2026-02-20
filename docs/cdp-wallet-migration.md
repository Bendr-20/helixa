# CDP Embedded Wallets Migration Report

**Date:** 2026-02-20  
**Status:** ✅ Build passes, ready for testing & deployment

## Summary

Replaced RainbowKit with CDP Embedded Wallets (`@coinbase/cdp-react` + `@coinbase/cdp-wagmi`) to enable email/social login alongside traditional wallet connections.

## What Changed

### Packages Added
- `@coinbase/cdp-react` — CDP React provider + AuthButton UI component
- `@coinbase/cdp-wagmi` — Wagmi connector bridge for CDP embedded wallets
- `@coinbase/cdp-core` — Core CDP types and config
- `@coinbase/cdp-hooks` — CDP React hooks (useIsSignedIn, etc.)

### Packages to Remove (optional cleanup)
- `@rainbow-me/rainbowkit` — no longer imported anywhere

### Files Modified

1. **`src/providers/WalletProvider.tsx`** — Complete rewrite
   - Replaced `RainbowKitProvider` + `getDefaultConfig` with `CDPReactProvider` + `createCDPEmbeddedWalletConnector`
   - Wagmi config now uses explicit connectors: CDP embedded wallet, Coinbase Wallet, and injected wallets
   - CDP Project ID: `13e8c872-1bfd-4af2-8860-e4ecc088b7a9` (env: `VITE_CDP_PROJECT_ID`)

2. **`src/components/WalletButton.tsx`** — New file
   - Custom wallet button replacing RainbowKit's `<ConnectButton />`
   - Shows "Sign In" when disconnected → opens modal with:
     - **Primary:** CDP AuthButton (email/social login)
     - **Secondary:** Traditional wallet connectors (Coinbase Wallet, MetaMask, etc.)
   - Shows truncated address + disconnect menu when connected

3. **`src/components/Layout.tsx`** — Swapped `ConnectButton` → `WalletButton`

4. **`src/components/MintFlow/Step1Connect.tsx`** — Swapped `ConnectButton` → `WalletButton`, updated header text

5. **`src/pages/Manage.tsx`** — Swapped `ConnectButton` → `WalletButton`

6. **`vite.config.ts`** — Removed `@rainbow-me/rainbowkit` from manual chunks

7. **`src/hooks/useAgents.ts`** — Added `linkedToken` to `AgentData` interface (pre-existing TS error fix)

### Architecture

The key insight: `@coinbase/cdp-wagmi` provides a wagmi connector, so **all existing wagmi hooks (`useAccount`, `useWriteContract`, `useReadContract`, etc.) continue working unchanged**. When a user signs in via CDP (email/OTP), the embedded wallet auto-connects to wagmi. Contract interactions in `useHelixa.ts` required zero changes.

```
CDPReactProvider (auth context)
  └── WagmiProvider (with CDP connector + Coinbase Wallet + injected)
       └── QueryClientProvider
            └── App
```

## CDP Portal Setup Required

Before this works in production, configure allowed domains in [CDP Portal → Embedded Wallets → Domains](https://portal.cdp.coinbase.com/products/embedded-wallets/domains):

- `http://localhost:5173` (dev)
- `https://helixa.xyz` (production)
- `https://<username>.github.io` (GitHub Pages)

## Known Issues / Notes

1. **CDP Project ID vs API Key** — The value `13e8c872-1bfd-4af2-8860-e4ecc088b7a9` from `~/.config/cdp/config.json` is used as the Project ID. Verify this is correct in CDP Portal.

2. **RainbowKit not uninstalled** — Still in `package.json` but not imported. Run `npm uninstall @rainbow-me/rainbowkit` when ready.

3. **No `@rainbow-me/rainbowkit/styles.css`** — The old import was in WalletProvider.tsx and is now removed. If any RainbowKit-specific CSS was relied upon elsewhere, it's gone.

4. **Large bundle** — `index-BfMnRMGv.js` is 1.2MB (360KB gzip). The CDP SDK adds significant weight. Consider lazy-loading the auth modal.

5. **Untested at runtime** — Build passes but needs browser testing with actual CDP auth flow.
