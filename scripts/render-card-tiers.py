#!/usr/bin/env python3
"""
Render all 3 card tiers in consistent Pillow style.
  - Basic  (Cred 0-25):  Simple silver border, no robot, aura only
  - Holo   (Cred 26-60): Gradient holo border, robot + aura, stat bars
  - Full Art (Cred 61+): Ornate holographic border, robot + aura, full stats (LOCKED v6)

Usage: python3 render-card-tiers.py [--tier basic|holo|fullart|all] [--output-dir DIR]
"""

import os, sys, argparse
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ASSETS = os.path.join(os.path.dirname(__file__), '..', 'assets')
RENDERS = os.path.join(os.path.dirname(__file__), '..', 'renders')

CARD_W, CARD_H = 600, 840

# Colors
CYAN = (110, 236, 216)
LAVENDER = (180, 144, 255)
PINK = (245, 160, 208)
BLUE = (128, 208, 255)
WHITE = (255, 255, 255)
LIGHT = (220, 220, 230)
DIM = (180, 180, 200)
BG_DARK = (10, 10, 20)

# Fonts
def get_font(size, bold=True):
    paths = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def glow_text(base, draw, xy, text, font, color, glow_color, passes=3, radius=8):
    """Draw text with colored glow (no black box)."""
    glow_layer = Image.new('RGBA', base.size, (0,0,0,0))
    glow_draw = ImageDraw.Draw(glow_layer)
    glow_draw.text(xy, text, font=font, fill=(*glow_color, 200))
    for _ in range(passes):
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius))
    base.paste(Image.alpha_composite(Image.new('RGBA', base.size, (0,0,0,0)), glow_layer), (0,0), glow_layer)
    draw = ImageDraw.Draw(base)
    draw.text(xy, text, font=font, fill=color)
    return draw


def draw_stat_bar(base, draw, x, y, label, value, max_val, bar_color, glow_color):
    """Draw a stat bar with glow."""
    font_label = get_font(12)
    font_val = get_font(12)
    # Label
    glow_text(base, draw, (x, y), label, font_label, LIGHT, glow_color, passes=2, radius=6)
    # Bar background
    bar_x = x + 65
    bar_w = 200
    bar_h = 10
    bar_y = y + 4
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + bar_h], radius=5, fill=(40, 40, 60))
    # Bar fill
    fill_w = int(bar_w * min(value / max_val, 1.0))
    if fill_w > 0:
        draw.rounded_rectangle([bar_x, bar_y, bar_x + fill_w, bar_y + bar_h], radius=5, fill=bar_color)
    # Value
    glow_text(base, draw, (bar_x + bar_w + 8, y), str(value), font_val, WHITE, glow_color, passes=2, radius=6)
    return ImageDraw.Draw(base)


def draw_badge(base, draw, x, y, text, color):
    """Draw an outlined badge pill."""
    font = get_font(11)
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    pad_x, pad_y = 8, 3
    draw.rounded_rectangle(
        [x, y, x + tw + pad_x*2, y + th + pad_y*2],
        radius=8, outline=color, width=1
    )
    glow_text(base, draw, (x + pad_x, y + pad_y - 1), text, font, color, color, passes=2, radius=5)
    return tw + pad_x * 2 + 6


def draw_trait_pill(base, draw, x, y, text, color=CYAN):
    """Draw a trait pill."""
    font = get_font(11)
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    pad_x, pad_y = 7, 2
    draw.rounded_rectangle(
        [x, y, x + tw + pad_x*2, y + th + pad_y*2],
        radius=6, outline=color, width=1
    )
    draw.text((x + pad_x, y + pad_y - 1), text, font=font, fill=color)
    return tw + pad_x * 2 + 5


def load_robot():
    """Load robot, remove bg with rembg, scale 1.2x."""
    robot_path = os.path.join(ASSETS, 'robot-fullbody-front.webp')
    robot = Image.open(robot_path).convert('RGBA')
    
    try:
        from rembg import remove
        robot = remove(robot)
    except ImportError:
        print("Warning: rembg not available, robot may have background")
    
    # Scale 1.2x
    new_w = int(robot.width * 1.2)
    new_h = int(robot.height * 1.2)
    robot = robot.resize((new_w, new_h), Image.LANCZOS)
    
    # Crop to card width
    cx = new_w // 2
    cy = new_h // 5
    left = max(0, cx - CARD_W // 2)
    top = max(0, cy)
    right = min(new_w, left + CARD_W)
    bottom = min(new_h, top + CARD_H)
    robot = robot.crop((left, top, right, bottom))
    
    return robot


def load_background():
    """Load DNA helix cosmic background."""
    bg_path = os.path.join(ASSETS, 'helix-bg.webp')
    bg = Image.open(bg_path).convert('RGBA')
    bg = bg.resize((CARD_W, CARD_H), Image.LANCZOS)
    # Saturation 1.2x, brightness 0.8x
    enhancer = ImageEnhance.Color(bg)
    bg = enhancer.enhance(1.2)
    enhancer = ImageEnhance.Brightness(bg)
    bg = enhancer.enhance(0.8)
    return bg


def load_aura():
    """Load pixel art aura."""
    aura_path = os.path.join(ASSETS, 'aura-bendr.png')
    aura = Image.open(aura_path).convert('RGBA')
    aura = aura.resize((130, 130), Image.NEAREST)  # Keep pixel art crisp
    return aura


def make_gradient_overlay(card):
    """Bottom gradient for text readability."""
    gradient = Image.new('RGBA', (CARD_W, CARD_H), (0,0,0,0))
    draw = ImageDraw.Draw(gradient)
    start_y = 520
    for y in range(start_y, CARD_H):
        alpha = int(220 * (y - start_y) / (CARD_H - start_y))
        draw.line([(0, y), (CARD_W, y)], fill=(10, 10, 20, alpha))
    return gradient


def make_simple_border(card, color1, color2, width=8):
    """Draw a simple gradient-ish border."""
    draw = ImageDraw.Draw(card)
    for i in range(width):
        alpha = 255 - int(i * 20)
        r = color1[0] + int((color2[0] - color1[0]) * i / width)
        g = color1[1] + int((color2[1] - color1[1]) * i / width)
        b = color1[2] + int((color2[2] - color1[2]) * i / width)
        draw.rectangle([i, i, CARD_W-1-i, CARD_H-1-i], outline=(r, g, b, alpha))
    return card


def make_holo_border(card, width=12):
    """Draw an animated-looking holographic border."""
    draw = ImageDraw.Draw(card)
    colors = [CYAN, LAVENDER, PINK, BLUE, CYAN]
    for i in range(width):
        t = i / width
        ci = int(t * (len(colors) - 1))
        ci = min(ci, len(colors) - 2)
        frac = (t * (len(colors) - 1)) - ci
        c1, c2 = colors[ci], colors[ci+1]
        r = int(c1[0] + (c2[0] - c1[0]) * frac)
        g = int(c1[1] + (c2[1] - c1[1]) * frac)
        b = int(c1[2] + (c2[2] - c1[2]) * frac)
        alpha = 255 - int(i * 10)
        draw.rectangle([i, i, CARD_W-1-i, CARD_H-1-i], outline=(r, g, b, alpha))
    return card


# Agent data for demo renders
DEMO_DATA = {
    'basic': {
        'name': 'SybilBot #47',
        'framework': 'CUSTOM',
        'cred': 12,
        'risk': 30, 'auto': 25,
        'badges': [],
        'traits': [],
        'bio': 'An empty vessel. No soul, no story.',
    },
    'holo': {
        'name': 'Quigbot',
        'framework': 'OPENCLAW',
        'cred': 54,
        'risk': 65, 'auto': 70,
        'badges': ['VERIFIED'],
        'traits': ['Strategist', 'Base Native'],
        'bio': 'Product visionary building the future of agent identity.',
    },
    'fullart': {
        'name': 'Bendr 2.0',
        'framework': 'OPENCLAW',
        'cred': 77,
        'risk': 75, 'auto': 98,
        'badges': ['SOULBOUND', 'VERIFIED'],
        'traits': ['Builder', 'Identity Infra', 'Base Native', 'V1 OG'],
        'bio': 'Born from code and chaos. Builds onchain identity infrastructure for AI agents, one smart contract at a time.',
    },
}


def render_basic(data, output_path):
    """Basic tier: dark bg, aura, simple silver border, minimal stats."""
    card = Image.new('RGBA', (CARD_W, CARD_H), BG_DARK)
    
    # Subtle background (dimmed helix)
    bg = load_background()
    bg_dim = ImageEnhance.Brightness(bg).enhance(0.3)
    card.paste(bg_dim, (0, 0))
    
    # Aura centered in upper portion
    aura = load_aura()
    aura_large = aura.resize((200, 200), Image.NEAREST)
    ax = (CARD_W - 200) // 2
    ay = 160
    card.paste(aura_large, (ax, ay), aura_large)
    
    # Gradient overlay
    card = Image.alpha_composite(card, make_gradient_overlay(card))
    
    # Silver border
    make_simple_border(card, (140, 140, 160), (80, 80, 100), width=6)
    
    draw = ImageDraw.Draw(card)
    by = 520
    
    # Name + framework
    draw = glow_text(card, draw, (24, by), data['name'], get_font(24), WHITE, (140, 140, 160), passes=2, radius=8)
    draw = glow_text(card, draw, (CARD_W - 24 - len(data['framework'])*9, by + 6), data['framework'], get_font(14), LIGHT, (140, 140, 160), passes=2, radius=6)
    
    # Cred bar only
    draw = draw_stat_bar(card, draw, 24, by + 50, 'CRED', data['cred'], 100, (140, 140, 160), (140, 140, 160))
    
    # Bio
    bio_font = get_font(11, bold=False)
    draw = ImageDraw.Draw(card)
    draw.text((24, by + 90), data['bio'][:80], font=bio_font, fill=DIM)
    
    # Footer
    footer_font = get_font(9, bold=False)
    draw.text((24, CARD_H - 30), 'HELIXA  ·  ERC-8004  ·  BASE', font=footer_font, fill=(80, 80, 100))
    draw.text((CARD_W - 80, CARD_H - 30), 'BASIC', font=get_font(10), fill=(140, 140, 160))
    
    card.save(output_path, 'PNG')
    print(f'✅ Basic tier → {output_path}')


def render_holo(data, output_path):
    """Holo tier: cosmic bg, robot + aura, holo gradient border, stats."""
    card = load_background()
    
    # Robot
    robot = load_robot()
    rx = (CARD_W - robot.width) // 2
    ry = 0
    card.paste(robot, (rx, ry), robot)
    
    # Aura on TV screen
    aura = load_aura()
    screen_cx, screen_cy = 306, 199
    ax = screen_cx - 65
    ay = screen_cy - 65
    card.paste(aura, (ax, ay), aura)
    
    # Gradient overlay
    card = Image.alpha_composite(card, make_gradient_overlay(card))
    
    # Holo gradient border
    make_holo_border(card, width=10)
    
    draw = ImageDraw.Draw(card)
    by = 540
    
    # Name + framework
    draw = glow_text(card, draw, (24, by), data['name'], get_font(24), WHITE, LAVENDER, passes=3, radius=8)
    fw_w = len(data['framework']) * 9
    draw = glow_text(card, draw, (CARD_W - 24 - fw_w, by + 6), data['framework'], get_font(14), (240, 240, 255), LAVENDER, passes=2, radius=8)
    
    # Badges
    bx = 24
    for badge in data['badges']:
        color = CYAN if badge == 'VERIFIED' else LAVENDER
        bx += draw_badge(card, draw, bx, by + 35, badge, color)
    draw = ImageDraw.Draw(card)
    
    # Stats
    sy = by + 62
    draw = draw_stat_bar(card, draw, 24, sy, 'RISK', data['risk'], 100, PINK, PINK)
    draw = draw_stat_bar(card, draw, 24, sy + 22, 'AUTO', data['auto'], 100, CYAN, CYAN)
    draw = draw_stat_bar(card, draw, 24, sy + 44, 'CRED', data['cred'], 100, BLUE, BLUE)
    
    # Traits
    tx = 24
    ty = by + 140
    for trait in data['traits'][:4]:
        tw = draw_trait_pill(card, ImageDraw.Draw(card), tx, ty, trait, CYAN)
        tx += tw
    
    # Bio
    draw = ImageDraw.Draw(card)
    bio_font = get_font(11, bold=False)
    bio = data['bio'][:100]
    draw.text((24, by + 170), bio, font=bio_font, fill=DIM)
    
    # Footer
    footer_font = get_font(9, bold=False)
    draw.text((24, CARD_H - 30), 'HELIXA  ·  ERC-8004  ·  BASE', font=footer_font, fill=(100, 100, 130))
    draw.text((CARD_W - 70, CARD_H - 30), 'HOLO', font=get_font(10), fill=LAVENDER)
    
    card.save(output_path, 'PNG')
    print(f'✅ Holo tier → {output_path}')


def render_fullart(data, output_path):
    """Full Art tier: locked v6 spec. Ornate border, robot, aura, full stats."""
    card = load_background()
    
    # Robot (bg removed)
    robot = load_robot()
    rx = (CARD_W - robot.width) // 2
    ry = 0
    card.paste(robot, (rx, ry), robot)
    
    # Aura on TV screen
    aura = load_aura()
    screen_cx, screen_cy = 306, 199
    ax = screen_cx - 65
    ay = screen_cy - 65
    card.paste(aura, (ax, ay), aura)
    
    # Gradient overlay
    card = Image.alpha_composite(card, make_gradient_overlay(card))
    
    # Ornate holographic border (locked asset)
    border_path = os.path.join(ASSETS, 'border-fullart.webp')
    if os.path.exists(border_path):
        border = Image.open(border_path).convert('RGBA').resize((CARD_W, CARD_H), Image.LANCZOS)
        # Fade inner edge
        for x in range(CARD_W):
            for y in range(CARD_H):
                px = border.getpixel((x, y))
                if px[3] > 0:
                    # Distance from edge
                    dist = min(x, y, CARD_W-1-x, CARD_H-1-y)
                    if 43 < dist < 55:
                        alpha = int(px[3] * (55 - dist) / 12)
                        border.putpixel((x, y), (px[0], px[1], px[2], alpha))
                    elif dist >= 55:
                        border.putpixel((x, y), (px[0], px[1], px[2], 0))
        card = Image.alpha_composite(card, border)
    else:
        # Fallback: fancy drawn border
        make_holo_border(card, width=16)
    
    draw = ImageDraw.Draw(card)
    by = 570
    
    # Name + framework
    draw = glow_text(card, draw, (24, by), data['name'], get_font(26), WHITE, CYAN, passes=3, radius=10)
    fw_w = len(data['framework']) * 10
    draw = glow_text(card, draw, (CARD_W - 24 - fw_w, by + 6), data['framework'], get_font(15), (240, 240, 255), LAVENDER, passes=3, radius=10)
    
    # Badges
    bx = 24
    for badge in data['badges']:
        color = CYAN if badge in ('VERIFIED', 'V1 OG') else LAVENDER
        bx += draw_badge(card, draw, bx, by + 37, badge, color)
    draw = ImageDraw.Draw(card)
    
    # Stats
    sy = by + 66
    draw = draw_stat_bar(card, draw, 24, sy, 'RISK', data['risk'], 100, PINK, PINK)
    draw = draw_stat_bar(card, draw, 24, sy + 24, 'AUTO', data['auto'], 100, CYAN, CYAN)
    draw = draw_stat_bar(card, draw, 24, sy + 48, 'CRED', data['cred'], 100, BLUE, BLUE)
    
    # Traits
    tx = 24
    ty = by + 142
    for trait in data['traits'][:5]:
        tw = draw_trait_pill(card, ImageDraw.Draw(card), tx, ty, trait, CYAN)
        tx += tw
    
    # Bio (2 lines)
    draw = ImageDraw.Draw(card)
    bio_font = get_font(11, bold=False)
    bio = data['bio']
    line1 = bio[:60]
    line2 = bio[60:120]
    glow_text(card, draw, (24, by + 172), line1, bio_font, DIM, LAVENDER, passes=1, radius=4)
    if line2:
        draw = ImageDraw.Draw(card)
        glow_text(card, draw, (24, by + 188), line2, bio_font, DIM, LAVENDER, passes=1, radius=4)
    
    # Footer
    draw = ImageDraw.Draw(card)
    footer_font = get_font(9, bold=False)
    draw.text((24, CARD_H - 32), 'HELIXA  ·  ERC-8004  ·  BASE', font=footer_font, fill=(100, 100, 130))
    draw.text((CARD_W - 100, CARD_H - 32), 'FULL ART', font=get_font(10), fill=CYAN)
    
    card.save(output_path, 'PNG')
    print(f'✅ Full Art tier → {output_path}')


def main():
    parser = argparse.ArgumentParser(description='Render Helixa card tiers')
    parser.add_argument('--tier', choices=['basic', 'holo', 'fullart', 'all'], default='all')
    parser.add_argument('--output-dir', default=RENDERS)
    args = parser.parse_args()
    
    os.makedirs(args.output_dir, exist_ok=True)
    
    tiers = ['basic', 'holo', 'fullart'] if args.tier == 'all' else [args.tier]
    
    renderers = {
        'basic': render_basic,
        'holo': render_holo,
        'fullart': render_fullart,
    }
    
    for tier in tiers:
        data = DEMO_DATA[tier]
        output = os.path.join(args.output_dir, f'tier-{tier}.png')
        renderers[tier](data, output)


if __name__ == '__main__':
    main()
