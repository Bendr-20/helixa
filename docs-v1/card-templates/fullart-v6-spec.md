# Full Art Card Template v6 — LOCKED (Epifani approved Feb 16, 2026)

## Render: `agentdna/renders/fullart-template-v6.png`

## Composition (600x840)
1. **Background**: DNA helix cosmic art (`assets/helix-bg.webp`), saturation 1.2x, brightness 0.8x
2. **Robot**: `assets/robot-fullbody-front.webp`, scaled 1.2x, bg removed via `rembg`, composited on helix bg
3. **Aura**: Pixel art aura centered on TV screen (center ~306,199 after scale+crop), size 130x130
4. **Gradient overlay**: Fade from transparent at y=520 to alpha 220 at bottom (for text readability)
5. **Text**: All text uses bold fonts + multi-pass colored glow (no black boxes)
6. **Border**: `assets/border-fullart.webp` — ornate holographic, fade inner edge at dist 43-55px

## Text Style
- **Glow technique**: Draw text on transparent layer, GaussianBlur at radius 6-10, composite 2-3 passes, then sharp text on top
- **Name**: DejaVuSans-Bold 26px, white, cyan glow (110,236,216), 3 passes radius 10
- **Framework**: DejaVuSans-Bold 15px, bright white (240,240,255), lavender glow (180,144,255), 3 passes radius 10
- **Stat labels**: Bold 12px, light (220,220,230), glow matches bar color
- **Badges**: Bold 12px, outlined rounded rect + glow in badge color
- **Traits**: Bold 12px, cyan outline pills with glow
- **Bio**: Regular 11px, light purple (180,180,200), subtle purple glow

## Layout (y offsets from by=570)
- Name: y+0, Framework: y+6 (right-aligned)
- Badges: y+37
- Stats: y+66, spacing 24px
- Traits: y+142
- Bio: y+172
- Footer: card_h-32

## Key Assets
- `assets/robot-fullbody-front.webp` — front-facing CRT TV head robot
- `assets/helix-bg.webp` — DNA helix cosmic background
- `assets/border-fullart.webp` — ornate holographic border (LOCKED by Epifani)
- `assets/aura-bendr.png` — Bendr's pixel art aura

## Robot bg removal
- Uses `rembg` (u2net model) for clean background removal
- Robot scaled 1.2x before crop to make TV head bigger
- Crop: center horizontally, bias top (1/5 from top)

## Notes
- Aura must be SQUARE (1:1), centered on TV screen, not touching edges
- Robot must face STRAIGHT FORWARD (no angle)
- DNA helix goes BEHIND robot (proper layering via bg removal)
- No black boxes on text — glow only
