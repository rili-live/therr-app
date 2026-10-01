"""Builds the streak widget's chameleon art from the Friends with Habits email header.

    python3 TherrMobile/resources/widget-art/build_streak_widget_art.py   # from the repo root; needs Pillow

Source: therr-client-web/src/_static/assets/images/habits-email-header-friends.jpg, the yellow
chameleon on the right. The crop is extended upward with night sky so the streak count has room
above the chameleon's head, and outward so a wide widget still shows the whole face.

Output: TherrMobile/android/app/src/main/res/drawable-nodpi/habits_streak_widget_art.webp,
drawn full-bleed (centerCrop) by layout/widget_habits_streak.xml. Its top row is TOP below, which
@color/habits_streak_widget_sky matches, so the card's own background reads as more of the sky.
"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SRC = os.path.join(ROOT, 'therr-client-web/src/_static/assets/images/habits-email-header-friends.jpg')
OUT = os.path.join(ROOT, 'TherrMobile/android/app/src/main/res/drawable-nodpi/habits_streak_widget_art.webp')

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

out = canvas.resize((int(w * SCALE), int((EXT + h) * SCALE)), Image.LANCZOS)
out.save(OUT, 'WEBP', quality=84, method=6)
print(OUT, out.size)
