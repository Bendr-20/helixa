#!/usr/bin/env python3
"""
Full Art Card Renderer v6 — Rebuilds Epifani-approved composition.
Usage: python3 render-fullart.py [--name NAME] [--framework FW] [--aura PATH] [--out PATH]

Layers (bottom to top):
1. Helix cosmic background (saturated, dimmed)
2. Robot body (bg removed via rembg, scaled 1.2x)
3. Pixel aura centered on TV screen
4. Gradient overlay for text readability
5. Text with colored glow (no black boxes)
6. Ornate holographic border
"""
import argparse
import os
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ASSETS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets')
CARD_W, CARD_H = 600, 840

def load_asset(name):
    path = os.path.join(ASSETS, name)
    return Image.open(path).convert('RGBA')

def remove_bg(img):
    """Remove background using rembg."""
    try:
        from rembg import remove
        from io import BytesIO
        buf = BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        result = remove(buf.read())
        return Image.open(BytesIO(result)).convert('RGBA')
    except ImportError:
        print("WARNING: rembg not available, using image as-is")
        return img

def draw_glow_text(card, text, xy, font, text_color, glow_color, glow_radius=10, passes=3):
    """Draw text with colored multi-pass glow behind it."""
    # Create glow layer
    glow_layer = Image.new('RGBA', card.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    glow_draw.text(xy, text, fill=glow_color, font=font)
    
    for _ in range(passes):
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=glow_radius))
    
    card = Image.alpha_composite(card, glow_layer)
    
    # Draw sharp text on top
    draw = ImageDraw.Draw(card)
    draw.text(xy, text, fill=text_color, font=font)
    return card

def draw_badge(card, text, xy, color, font):
    """Draw outlined badge pill with glow."""
    draw = ImageDraw.Draw(card)
    bbox = font.getbbox(text)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    px, py = 8, 3
    x, y = xy
    
    # Glow
    glow = Image.new('RGBA', card.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle([x-px, y-py, x+tw+px, y+th+py], radius=8, outline=color, width=1)
    gd.text((x, y), text, fill=color, font=font)
    glow = glow.filter(ImageFilter.GaussianBlur(radius=6))
    card = Image.alpha_composite(card, glow)
    
    # Sharp
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle([x-px, y-py, x+tw+px, y+th+py], radius=8, outline=color, width=1)
    draw.text((x, y), text, fill=color, font=font)
    return card, tw + px * 2 + 8

def draw_stat_bar(card, label, value, max_val, xy, bar_color, font_label, font_val):
    """Draw a stat bar with glow."""
    x, y = xy
    bar_x = x + 55
    bar_w = 260
    bar_h = 12
    fill_w = max(int(bar_w * value / max_val), 4)
    
    # Label with glow
    card = draw_glow_text(card, label, (x, y), font_label, (220, 220, 230), bar_color, glow_radius=6, passes=2)
    
    # Bar background
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle([bar_x, y+3, bar_x+bar_w, y+3+bar_h], radius=3, fill=(20, 20, 30, 120))
    
    # Bar fill
    bar_fill = Image.new('RGBA', card.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(bar_fill)
    bd.rounded_rectangle([bar_x, y+3, bar_x+fill_w, y+3+bar_h], radius=3, fill=bar_color)
    # Subtle glow on fill
    bar_glow = bar_fill.filter(ImageFilter.GaussianBlur(radius=4))
    card = Image.alpha_composite(card, bar_glow)
    card = Image.alpha_composite(card, bar_fill)
    
    # Value — colored to match bar
    card = draw_glow_text(card, str(value), (bar_x + bar_w + 10, y), font_val, bar_color, bar_color, glow_radius=6, passes=2)
    return card

def render_fullart(name="Bendr 2.0", framework="OpenClaw", aura_path=None,
                   soulbound=True, verified=True, risk=75, auto=98, cred=77,
                   traits=None, bio=None, out_path=None):
    if traits is None:
        traits = ["Analytical", "Chaotic Good", "Snarky", "Builder"]
    if bio is None:
        bio = "Born from code and chaos. Builds onchain identity infrastructure for AI agents, one smart contract at a time."
    
    # --- Load fonts ---
    try:
        font_name = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
        font_fw = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
        font_badge = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 12)
        font_stat_label = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 12)
        font_stat_val = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 12)
        font_trait = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 12)
        font_bio = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
        font_footer = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10)
    except:
        font_name = font_fw = font_badge = font_stat_label = font_stat_val = font_trait = font_bio = font_footer = ImageFont.load_default()

    # --- 1. Background: helix cosmic ---
    bg = load_asset('helix-bg.webp').resize((CARD_W, CARD_H))
    bg = ImageEnhance.Color(bg).enhance(1.2)
    bg = ImageEnhance.Brightness(bg).enhance(0.8)
    card = bg.copy()

    # --- 2. Robot body ---
    robot = load_asset('robot-fullbody-front.webp')
    robot = remove_bg(robot)
    
    # Scale robot to fit card width with some margin, keeping aspect ratio
    rw, rh = robot.size
    # Scale robot up — bigger TV head per Epifani
    robot_scale = 1.5
    new_rw = int(rw * robot_scale)
    new_rh = int(rh * robot_scale)
    robot = robot.resize((new_rw, new_rh), Image.LANCZOS)
    
    # Crop: center horizontally, bias toward top
    crop_x = (new_rw - CARD_W) // 2
    crop_y = new_rh // 10  # less top crop to show full TV head
    robot_cropped = robot.crop((max(0, crop_x), crop_y, max(0, crop_x) + CARD_W, crop_y + CARD_H))
    
    card.paste(robot_cropped, (0, 0), robot_cropped)
    
    # TV screen center: original robot ~(462, 235), scaled then offset by crop
    screen_cx = int(462 * robot_scale) - max(0, crop_x)
    screen_cy = int(255 * robot_scale) - crop_y

    # --- 3. Aura on TV screen ---
    if aura_path and os.path.exists(aura_path):
        aura = Image.open(aura_path).convert('RGBA')
    else:
        default_aura = os.path.join(ASSETS, 'aura-bendr.png')
        if os.path.exists(default_aura):
            aura = Image.open(default_aura).convert('RGBA')
        else:
            aura = None
    
    if aura:
        aura_size = 260  # fills the TV screen interior (~300px wide at 1.5x scale)
        aura = aura.resize((aura_size, aura_size), Image.LANCZOS)
        if aura.mode == 'RGB':
            aura = aura.convert('RGBA')
        ax = screen_cx - aura_size // 2
        ay = screen_cy - aura_size // 2
        
        # Draw a dark screen backdrop first so the aura is visible
        screen_layer = Image.new('RGBA', card.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(screen_layer)
        # Slightly rounded dark rect for the screen area
        pad = 10
        sd.rounded_rectangle(
            [ax - pad, ay - pad, ax + aura_size + pad, ay + aura_size + pad],
            radius=8, fill=(5, 5, 15, 220)
        )
        card = Image.alpha_composite(card, screen_layer)
        
        # Paste the aura WITH its black background (don't remove black — it IS the screen)
        card.paste(aura, (ax, ay), aura)

    # --- 4. Gradient overlay for text ---
    gradient = Image.new('RGBA', (CARD_W, CARD_H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gradient)
    start_y = 520
    for y in range(start_y, CARD_H):
        alpha = int(220 * (y - start_y) / (CARD_H - start_y))
        gd.line([(0, y), (CARD_W, y)], fill=(8, 8, 16, alpha))
    card = Image.alpha_composite(card, gradient)

    # --- 5. Text with glow ---
    by = 570  # base y for text section
    lx = 55  # left margin (inside border)
    rx = CARD_W - 55  # right margin
    
    # Name
    card = draw_glow_text(card, name, (lx, by), font_name, (255, 255, 255), (110, 236, 216), glow_radius=10, passes=3)
    
    # Framework (right-aligned)
    fw_bbox = font_fw.getbbox(framework.upper())
    fw_w = fw_bbox[2] - fw_bbox[0]
    card = draw_glow_text(card, framework.upper(), (rx - fw_w, by + 6), font_fw, (240, 240, 255), (180, 144, 255), glow_radius=10, passes=3)
    
    # Badges
    bx = lx
    badge_y = by + 37
    if soulbound:
        card, w = draw_badge(card, "SOULBOUND", (bx, badge_y), (180, 136, 255), font_badge)
        bx += w
    if verified:
        card, w = draw_badge(card, "VERIFIED", (bx, badge_y), (105, 240, 174), font_badge)
    
    # Stats
    stat_y = by + 66
    card = draw_stat_bar(card, "RISK", risk, 100, (lx, stat_y), (255, 82, 82), font_stat_label, font_stat_val)
    card = draw_stat_bar(card, "AUTO", auto, 100, (lx, stat_y + 24), (64, 196, 255), font_stat_label, font_stat_val)
    card = draw_stat_bar(card, "CRED", cred, 100, (lx, stat_y + 48), (180, 136, 255), font_stat_label, font_stat_val)
    
    # Traits
    trait_y = by + 142
    tx = lx
    for trait in traits:
        card = draw_glow_text(card, trait, (tx + 8, trait_y), font_trait, (180, 220, 230), (110, 236, 216), glow_radius=4, passes=2)
        # Draw pill outline
        tb = font_trait.getbbox(trait)
        tw = tb[2] - tb[0]
        pill_layer = Image.new('RGBA', card.size, (0, 0, 0, 0))
        pd = ImageDraw.Draw(pill_layer)
        pd.rounded_rectangle([tx, trait_y - 2, tx + tw + 16, trait_y + 16], radius=10, outline=(110, 236, 216, 100), width=1)
        card = Image.alpha_composite(card, pill_layer)
        tx += tw + 24
    
    # Bio
    bio_y = by + 172
    # Word wrap
    words = bio.split()
    lines = []
    line = ""
    for w in words:
        test = line + " " + w if line else w
        if font_bio.getbbox(test)[2] - font_bio.getbbox(test)[0] < CARD_W - 110:
            line = test
        else:
            lines.append(line)
            line = w
    if line:
        lines.append(line)
    
    for i, l in enumerate(lines):
        card = draw_glow_text(card, l, (lx, bio_y + i * 16), font_bio, (180, 180, 200), (120, 80, 180), glow_radius=4, passes=1)
    
    # Footer
    card = draw_glow_text(card, "HELIXA · ERC-8004 · BASE", (lx, CARD_H - 38), font_footer, (80, 80, 100), (60, 60, 80), glow_radius=3, passes=1)

    # --- 6. Border ---
    border = load_asset('border-fullart.webp').resize((CARD_W, CARD_H))
    
    # Fade inner edge of border (alpha falloff at dist 43-55px from edge)
    border_arr = list(border.getdata())
    w, h = border.size
    new_border = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    pixels = []
    for y in range(h):
        for x in range(w):
            idx = y * w + x
            r, g, b, a = border_arr[idx]
            # Distance from nearest edge
            dist = min(x, y, w - 1 - x, h - 1 - y)
            if dist > 55:
                # Inner area — make transparent
                pixels.append((r, g, b, 0))
            elif dist > 43:
                # Fade zone
                fade = 1.0 - (dist - 43) / 12.0
                pixels.append((r, g, b, int(a * fade)))
            else:
                pixels.append((r, g, b, a))
    new_border.putdata(pixels)
    
    card = Image.alpha_composite(card, new_border)
    
    # Save
    if out_path is None:
        out_path = os.path.join(os.path.dirname(ASSETS), 'renders', 'fullart-generated.png')
    card.save(out_path)
    print(f"Saved Full Art card to {out_path}")
    return out_path

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Render Full Art card')
    parser.add_argument('--name', default='Bendr 2.0')
    parser.add_argument('--framework', default='OpenClaw')
    parser.add_argument('--aura', default=None)
    parser.add_argument('--out', default=None)
    parser.add_argument('--cred', type=int, default=77)
    parser.add_argument('--risk', type=int, default=75)
    parser.add_argument('--auto', type=int, default=98)
    args = parser.parse_args()
    
    render_fullart(name=args.name, framework=args.framework, aura_path=args.aura,
                   out_path=args.out, cred=args.cred, risk=args.risk, auto=args.auto)
