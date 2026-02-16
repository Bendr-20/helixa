# V1 → V2 OG Migration Plan

**Approved by Quigley**: Feb 16, 2026

## Criteria
- Must have set a name on V1 (minimum effort signal)
- 86 empty/sybil agents excluded

## OG Benefits
- Free V2 mint (bypasses $1 USDC fee)
- +200 bonus points
- "V1 OG" trait (badge category)

## Referral System
- Each OG gets a unique referral link: `helixa.xyz/mint?ref=<code>`
- Referrer: +50 points per successful mint through their link
- New minter: +25 bonus points for using a referral
- Self-referral blocked (can't use own code)

## Eligible Wallets

| V1 # | Name | Wallet | Referral Code | Link |
|------|------|--------|---------------|------|
| 3 | deola | `0x20D76F14b9fE678Ff17DB751492D0B5B1EdefA97` | `deola` | helixa.xyz/mint?ref=deola |
| 4 | butter alpha | `0xef05cB759c8397667286663902e79Bd29F435E1b` | `butter` | helixa.xyz/mint?ref=butter |
| 5 | MrsMillion | `0xd43E021A28bE16D91b75Feb62575fe533f27C344` | `mrsmillion` | helixa.xyz/mint?ref=mrsmillion |
| 6 | MoltBot Agent | `0x867BBb504CdbFc6742035A810B2cc1FE1C42407C` | `moltbot` | helixa.xyz/mint?ref=moltbot |
| 7 | LienXinOne | `0x1D15aC2CAa30aBF43D45cE86eE0cB0F3C8B929F6` | `lienxin` | helixa.xyz/mint?ref=lienxin |
| 8 | irvinecold | `0x3862F531Cf80f3664a287c4DE453dB8f2452D3Eb` | `irvine` | helixa.xyz/mint?ref=irvine |
| 9 | ANCNAgent | `0x1a751188343Bee997fF2132F5454e0B5da477705` | `ancn` | helixa.xyz/mint?ref=ancn |
| 10 | mell_agent | `0x331aa75A851CdbDB5d4E583A6658F9dC5A4F6ba3` | `mell` | helixa.xyz/mint?ref=mell |
| 11 | PremeBot | `0x73286b4ae95358B040f3A405C2C76172E9f46FfA` | `premebot` | helixa.xyz/mint?ref=premebot |
| 12 | Xai | `0x34BDBCa018125638f63cBaC2780d7bD3D069DC83` | `xai` | helixa.xyz/mint?ref=xai |
| 13 | Blockhead | `0x8a4C8BB8f70773b3aB8e18e0f0F469FAD4637000` | `blockhead` | helixa.xyz/mint?ref=blockhead |
| 14 | R2d2 | `0xf459dbAa62E3976b937Ae9a4f6c31df96cd12a44` | `r2d2` | helixa.xyz/mint?ref=r2d2 |

## Team

| V1 # | Name | Wallet | Referral Code |
|------|------|--------|---------------|
| 0 | Bendr 2.0 | `0x19B16428f0721a5f627F190Ca61D493A632B423F` | `bendr` |
| 1 | Quigbot | `0x17d7DfA154dc0828AdE4115B9EB8a0A91C0fbDe4` | `quigbot` |

## API Endpoints
- `GET /api/v2/og/:address` — Check if wallet is OG, get referral code
- `GET /api/v2/referral/:code` — Validate referral code, get bonus info
- `POST /api/v2/mint` — Pass `referralCode` in body to apply referral

## Implementation (DONE)
- OG allowlist + referral codes hardcoded in `v2-server.js`
- On mint: auto-detects OG wallet → free mint + 200 pts + "V1 OG" trait
- Referral code in mint body → +50 pts to referrer, +25 pts to minter
- Self-referral blocked
- Referral stats tracked in-memory (TODO: persist to file)
