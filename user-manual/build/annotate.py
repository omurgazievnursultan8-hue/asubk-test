#!/usr/bin/env python3
"""Crop + annotate auth screenshots for the user manual.
Screenshots are 2x (deviceScaleFactor=2); coords below are in real pixels."""
from PIL import Image, ImageDraw, ImageFont

IMG = "user-manual/images"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
RED = (220, 30, 30)
WHITE = (255, 255, 255)


def font(sz):
    return ImageFont.truetype(FONT_B, sz)


def box(d, x0, y0, x1, y1, w=4):
    d.rectangle([x0, y0, x1, y1], outline=RED, width=w)


def badge(d, cx, cy, n, r=26):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=RED, outline=WHITE, width=3)
    fnt = font(30)
    s = str(n)
    bb = d.textbbox((0, 0), s, font=fnt)
    d.text((cx - (bb[2] - bb[0]) / 2, cy - (bb[3] - bb[1]) / 2 - bb[1]), s, fill=WHITE, font=fnt)


# ---------- 1) login form ----------
im = Image.open(f"{IMG}/01-login-empty.png").convert("RGB")
crop = (1030, 520, 1850, 1280)
im = im.crop(crop)
ox, oy = crop[0], crop[1]
d = ImageDraw.Draw(im)
# field/button boxes in real px, shifted by crop origin
fields = [
    (1, 1140, 780, 1740, 852),   # username
    (2, 1140, 934, 1692, 1006),  # password
    (3, 1128, 1062, 1752, 1134), # submit
]
for n, x0, y0, x1, y1 in fields:
    box(d, x0 - ox, y0 - oy, x1 - ox, y1 - oy)
    badge(d, x0 - ox, (y0 + y1) / 2 - oy, n)
im.save(f"{IMG}/login-annotated.png")
print("wrote login-annotated.png", im.size)

# ---------- 2) home / main screen ----------
im2 = Image.open(f"{IMG}/03-home.png").convert("RGB")
crop2 = (0, 0, 820, 1800)
im2 = im2.crop(crop2)
d2 = ImageDraw.Draw(im2)
# sidebar toggle (hamburger) at top
box(d2, 582, 18, 668, 98, 4)
badge(d2, 548, 58, 1)
# left nav menu region
box(d2, 20, 120, 800, 1560, 4)
badge(d2, 60, 130, 2)
# current user + logout (bottom)
box(d2, 20, 1660, 560, 1790, 4)
badge(d2, 60, 1725, 3)
im2.save(f"{IMG}/home-annotated.png")
print("wrote home-annotated.png", im2.size)

# ---------- 3) quick-login mockup ----------
im3 = Image.open(f"{IMG}/05-quicklogin.png").convert("RGB")
d3 = ImageDraw.Draw(im3)
# whole role panel
box(d3, 66, 662, 814, 1078, 4)
badge(d3, 104, 672, 1)
# "Войти" button of first role row
box(d3, 636, 684, 782, 734, 4)
badge(d3, 636, 709, 2)
im3.save(f"{IMG}/quicklogin-annotated.png")
print("wrote quicklogin-annotated.png", im3.size)
