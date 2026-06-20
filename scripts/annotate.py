#!/usr/bin/env python3
"""Annotate ASUBK screenshots: circle UI text, label its meaning in English."""
from PIL import Image, ImageDraw, ImageFont

SHOTS = "screenshots"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
S = 1.549  # displayed->real scale (img is 2x retina)
RED = (220, 30, 30)

def f(sz):
    return ImageFont.truetype(FONT, int(sz * S))

def box(d, cx, cy, hw, hh, w=3):
    x, y = cx * S, cy * S
    d.rectangle([x - hw * S, y - hh * S, x + hw * S, y + hh * S], outline=RED, width=w)

def line(d, x1, y1, x2, y2, w=3):
    d.line([x1 * S, y1 * S, x2 * S, y2 * S], fill=RED, width=w)

def text(d, x, y, s, sz=22):
    d.text((x * S, y * S), s, fill=RED, font=f(sz))

# ---- dashboard: circle each sidebar domain, label meaning ----
img = Image.open(f"{SHOTS}/02-dashboard.png").convert("RGB")
d = ImageDraw.Draw(img)
# (label_y, russian_text_center_x, half-width, english meaning)
groups = [
    (50,  53, 55, "Operations"),
    (279, 75, 80, "Lending"),
    (313, 62, 65, "Guarantees"),
    (348, 88, 90, "Corporate"),
    (381, 36, 38, "Subsidies"),
    (416, 86, 88, "Debt collection"),
    (451, 55, 58, "Reference data"),
    (485, 45, 47, "Services"),
    (519, 72, 75, "Administration"),
    (554, 41, 43, "Reports"),
    (588, 56, 58, "Security"),
]
label_x = 360
for y, cx, hw, meaning in groups:
    box(d, cx, y, hw, 12)
    line(d, cx + hw, y, label_x - 8, y)
    text(d, label_x, y - 11, "<- " + meaning, 22)
img.save(f"{SHOTS}/02-dashboard-annotated.png")

# ---- login: circle fields + button ----
img2 = Image.open(f"{SHOTS}/01-login.png").convert("RGB")
d2 = ImageDraw.Draw(img2)
items = [
    (299, 705, 110, 16, "Username"),
    (350, 705, 110, 16, "Password"),
    (392, 705, 110, 16, "Log in"),
]
for y, cx, hw, hh, meaning in items:
    box(d2, cx, y, hw, hh)
    line(d2, cx + hw, y, 845, y)
    text(d2, 850, y - 11, "<- " + meaning, 22)
img2.save(f"{SHOTS}/01-login-annotated.png")
print("wrote 01-login-annotated.png, 02-dashboard-annotated.png")
