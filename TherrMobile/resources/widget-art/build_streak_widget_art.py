"""Builds the streak widget's chameleon art, night and day, from the Friends with Habits email header.

    python3 TherrMobile/resources/widget-art/build_streak_widget_art.py   # from the repo root; needs Pillow + numpy

Source: therr-client-web/src/_static/assets/images/habits-email-header-friends.jpg, the yellow
chameleon on the right. The crop is extended upward with night sky so the streak count has room
above the chameleon's head, and outward so a wide widget still shows the whole face.

Outputs, both drawn full-bleed (centerCrop) by layout/widget_habits_streak.xml and picked by the
device's local hour in widget/HabitsStreakWidgetProvider.kt:
  drawable-nodpi/habits_streak_widget_art.webp      night: the source scene, plus stars
  drawable-nodpi/habits_streak_widget_art_day.webp  day: the same scene re-lit under a blue sky

The night art's top row is TOP below, which @color/habits_streak_widget_sky matches, so the card's
own background reads as more of the sky. The day art's is DAY_TOP / @color/habits_streak_widget_sky_day.

The day variant is a re-light, not a second painting: every pixel that reads as night sky (blue
over green and red, and not bright) is replaced by a daytime gradient, weighted so antialiased
edges and the purple rim glow blend instead of fringing, and the foreground is lifted and warmed.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SRC = os.path.join(ROOT, 'therr-client-web/src/_static/assets/images/habits-email-header-friends.jpg')
RES = os.path.join(ROOT, 'TherrMobile/android/app/src/main/res/drawable-nodpi')
OUT = os.path.join(RES, 'habits_streak_widget_art.webp')
OUT_DAY = os.path.join(RES, 'habits_streak_widget_art_day.webp')

src = Image.open(SRC).convert('RGB')

CROP = (990, 140, 1500, 545)          # yellow chameleon, crest to just under the branch
EXT = 290                              # sky added above the crop
FEATHER = 70                           # rows of the crop blended into the added sky
TOP = (15, 17, 54)                     # sky color at the very top (sampled from the source's top edge)
SIDE = 105                             # columns added on each side, for wide widgets
SEAM = 36                              # columns crossfaded where the mirrored left side meets the core
SCALE = 1.4                            # ~1000px wide: sharp on a 3-4 cell widget at xxxhdpi

core = src.crop(CROP)
# Right: the real scene continues (bokeh, a sparkle, leaves). Left: the source has a gold
# checkmark there and the core's own left edge holds the chameleon's eye, so the right side's
# scenery is mirrored instead and crossfaded into the core's sky and branch.
right = src.crop((CROP[2], CROP[1], CROP[2] + SIDE + SEAM, CROP[3]))
left = right.transpose(Image.FLIP_LEFT_RIGHT)  # its last SEAM columns overlap the core
crop = Image.new('RGB', (core.size[0] + 2 * SIDE, core.size[1]))
crop.paste(core, (SIDE, 0))
crop.paste(right.crop((0, 0, SIDE, core.size[1])), (SIDE + core.size[0], 0))
seam_mask = Image.new('L', left.size, 255)
sd = ImageDraw.Draw(seam_mask)
for x in range(SEAM):
    sd.line([(SIDE + x, 0), (SIDE + x, left.size[1])], fill=int(255 * (1 - x / SEAM)))
crop.paste(left, (0, 0), seam_mask)
w, h = crop.size

# Seam color per column: the crop's own top rows, blurred so bokeh dots do not streak upward.
seam = crop.crop((0, 0, w, 12)).filter(ImageFilter.GaussianBlur(24)).resize((w, 1), Image.BILINEAR)
seam_px = [seam.getpixel((x, 0)) for x in range(w)]

canvas = Image.new('RGB', (w, EXT + h))
px = canvas.load()
for y in range(EXT + FEATHER):
    t = min(1.0, y / (EXT + FEATHER)) ** 1.35
    for x in range(w):
        s = seam_px[x]
        px[x, y] = tuple(int(TOP[i] + (s[i] - TOP[i]) * t) for i in range(3))

# Paste the crop with its top rows feathered into the sky gradient.
mask = Image.new('L', (w, h), 255)
md = ImageDraw.Draw(mask)
for y in range(FEATHER):
    md.line([(0, y), (w, y)], fill=int(255 * (y / FEATHER) ** 1.5))
canvas.paste(crop, (0, EXT), mask)
scene = canvas.copy()                  # undecorated; the day variant starts here

# A few soft bokeh dots and two gold sparkles in the added sky, kept off the center column
# where the count sits.
glow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
for x, y, r, a in [(60, 60, 3, 150), (660, 40, 2, 130), (110, 210, 2, 110), (600, 230, 3, 120),
                   (30, 300, 2, 90), (690, 150, 2, 100), (200, 24, 2, 90), (520, 110, 2, 90)]:
    gd.ellipse([x - r, y - r, x + r, y + r], fill=(230, 220, 255, a))

def sparkle(cx, cy, size, color):
    long, short = size, size * 0.22
    gd.polygon([(cx, cy - long), (cx + short, cy - short), (cx + long, cy), (cx + short, cy + short),
                (cx, cy + long), (cx - short, cy + short), (cx - long, cy), (cx - short, cy - short)], fill=color)

sparkle(95, 130, 13, (255, 214, 120, 235))
sparkle(625, 300, 10, (255, 214, 120, 220))
halo = glow.filter(ImageFilter.GaussianBlur(6))
canvas = Image.alpha_composite(canvas.convert('RGBA'), halo)
canvas = Image.alpha_composite(canvas, glow).convert('RGB')

SIZE = (int(w * SCALE), int((EXT + h) * SCALE))
out = canvas.resize(SIZE, Image.LANCZOS)
out.save(OUT, 'WEBP', quality=84, method=6)
print(OUT, out.size)

# ---- Day ---------------------------------------------------------------------------------------
DAY_TOP = (58, 146, 230)               # Duolingo-ish noon blue at the top, where the count sits
DAY_HORIZON = (190, 228, 252)          # paler toward the branch
# Gold sparkles that come with the source scene (right side, and its mirror on the left). Stars
# have no place in a day sky, so they are painted over as sky.
SOURCE_SPARKLES = [(SIDE + 1570 - CROP[0], EXT + 360 - CROP[1]), (SIDE + SEAM - 1 - (1570 - CROP[2]), EXT + 360 - CROP[1])]
# The glow of a star just above the crop (source ~(1520, 115)) bleeds into its feathered top rows.
SOURCE_GLOWS = [(SIDE + 1520 - CROP[0] + 5, EXT + 15, 52, 34)]

px = np.asarray(scene).astype(np.float32) / 255
r, g, b = px[..., 0], px[..., 1], px[..., 2]
lum = 0.299 * r + 0.587 * g + 0.114 * b
# Night sky is well blue over green (never under ~0.145 here), blue at least level with red (the
# purple glow counts), and not bright. The chameleon (yellow), its crest (bright), its dusky-blue
# right foot and the moonlit top of the branch (both only ~0.10-0.12 blue over green), the bark
# (red over blue) and the leaves (green) each fail at least one of the three.
skyness = (np.clip((b - g - 0.10) / 0.045, 0, 1)
           * np.clip((b - r + 0.08) / 0.10, 0, 1)
           * np.clip((0.62 - lum) / 0.14, 0, 1))
# The band added above the photo is sky by construction; its top is also where the color test
# sits at its threshold, which would band.
skyness[:EXT] = 1
sky_mask = Image.fromarray((skyness * 255).astype(np.uint8))
# A median drops the specks the test leaves (stray bokeh, rim-glow pixels) in either direction.
sky_mask = sky_mask.filter(ImageFilter.MedianFilter(5))
sd = ImageDraw.Draw(sky_mask)
for cx, cy in SOURCE_SPARKLES:
    sd.ellipse([cx - 46, cy - 46, cx + 46, cy + 46], fill=255)
for cx, cy, rx, ry in SOURCE_GLOWS:
    sd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
sky_mask = sky_mask.filter(ImageFilter.GaussianBlur(1.0))
skyness = np.asarray(sky_mask).astype(np.float32)[..., None] / 255

H = px.shape[0]
t = (np.linspace(0, 1, H) ** 0.9)[:, None, None]
day_sky = (np.array(DAY_TOP) / 255) * (1 - t) + (np.array(DAY_HORIZON) / 255) * t
lit = np.clip(px * 1.18 + np.array([0.03, 0.025, 0.0]), 0, 1)
day = lit * (1 - skyness) + day_sky * skyness
day_img = Image.fromarray((day * 255).round().astype(np.uint8))

# Two soft clouds, high and to the sides, clear of the count in the middle.
# Drawn as an alpha mask over plain white, so the blur softens the edge instead of greying it.
cloud_alpha = Image.new('L', day_img.size, 0)
cd = ImageDraw.Draw(cloud_alpha)
for cx, cy, scale in [(105, 150, 1.0), (620, 95, 0.8)]:
    for dx, dy, rx, ry in [(-38, 8, 34, 20), (0, 0, 44, 28), (40, 8, 32, 19), (8, 14, 58, 18)]:
        cd.ellipse([cx + (dx - rx) * scale, cy + (dy - ry) * scale, cx + (dx + rx) * scale, cy + (dy + ry) * scale], fill=215)
cloud_alpha = cloud_alpha.filter(ImageFilter.GaussianBlur(3))
day_img = Image.composite(Image.new('RGB', day_img.size, (255, 255, 255)), day_img, cloud_alpha)

day_out = day_img.resize(SIZE, Image.LANCZOS)
day_out.save(OUT_DAY, 'WEBP', quality=84, method=6)
print(OUT_DAY, day_out.size)
