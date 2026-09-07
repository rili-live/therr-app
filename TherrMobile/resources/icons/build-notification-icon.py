#!/usr/bin/env python3
"""Regenerate the Android notification small icon (`ic_notification_icon`) for
Friends with Habits from the chameleon glyph in `main/assets/habits-logo.svg`.

NICHE(HABITS): this whole file is niche-only. `general` ships the Therr "T" mark
and must never take this output.

Why a script instead of a hand-drawn asset
------------------------------------------
Android draws a notification small icon from its **alpha channel only** — every
opaque pixel is repainted white (or the status bar's foreground color) and every
color in the source is thrown away. The launcher icon is therefore unusable as-is:
flattened to alpha it is a featureless blob, because the eyes, the forehead stripe
and the smile are all *color* contrast against an opaque body, not holes.

So the glyph has to be re-derived as a silhouette, where the rule is "anything the
logo draws in a body/ink color is opaque, anything it draws white is a hole":

    ink = (head U eyeRimL U eyeRimR) - (scleraL U scleraR) U pupilL U pupilR

The stripe, the nostrils and the smile are deliberately dropped. The nostrils and
the smile are dark-on-dark once color is gone, so they contribute nothing. The
stripe is light-on-dark, so the only way to keep it is to punch it out — and at
24dp that cut lands on the head's peak and reads as damage rather than as a
stripe. Rendered side by side at 24/36/48/72/96px, dropping it is clearly better.

Usage
-----
    pip install shapely cairosvg pillow
    python3 TherrMobile/resources/icons/build-notification-icon.py

Writes, relative to `TherrMobile/android/app/src/main/res/`:
    drawable-anydpi-v24/ic_notification_icon.xml   <- what every device actually uses
    drawable-{m,h,xh,xxh,xxxh}dpi/ic_notification_icon.png

`minSdkVersion` is 25 and `anydpi` outranks every density qualifier, so the vector
is the asset that ships; the PNGs are regenerated only so the two representations
cannot drift apart.
"""
import os

from PIL import Image
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union
import cairosvg

RES_DIR = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', '..', 'android', 'app', 'src', 'main', 'res',
))

# Geometry transcribed from main/assets/habits-logo.svg (1024x1024 viewBox).
HEAD_START = (437, 335)
HEAD_SEGMENTS = [
    ((512, 205), (587, 335)),
    ((722, 482), (757, 629)),
    ((832, 759), (682, 759)),
    ((512, 779), (342, 759)),
    ((192, 759), (267, 629)),
    ((302, 482), (437, 335)),
]
EYE_RIM_RADIUS = 148
SCLERA_RADIUS = 95
PUPIL_RADIUS = 44
EYE_CENTERS = ((260, 510), (764, 510))
PUPIL_CENTERS = ((280, 517), (744, 517))

# Layout inside the 24dp canvas. 22.5dp of artwork matches the footprint of the
# Therr mark on `general`, so the two brands' status-bar icons read at one size.
CANVAS_DP = 24.0
ARTWORK_DP = 22.5
# Flattening tolerance, in source units. 1 unit is ~0.028dp, so 1.6 units stays
# well inside a single pixel even at xxxhdpi.
SIMPLIFY_TOLERANCE = 1.6
DENSITIES = (('mdpi', 24), ('hdpi', 36), ('xhdpi', 48), ('xxhdpi', 72), ('xxxhdpi', 96))


def flatten_quad(p0, p1, p2, samples=96):
    points = []
    for i in range(1, samples + 1):
        t = i / samples
        mt = 1 - t
        points.append((
            mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
            mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
        ))
    return points


def build_ink():
    points = [HEAD_START]
    cursor = HEAD_START
    for control, end in HEAD_SEGMENTS:
        points.extend(flatten_quad(cursor, control, end))
        cursor = end
    head = Polygon(points)

    def circle(center, radius):
        return Point(*center).buffer(radius, quad_segs=64)

    rims = [circle(c, EYE_RIM_RADIUS) for c in EYE_CENTERS]
    scleras = [circle(c, SCLERA_RADIUS) for c in EYE_CENTERS]
    pupils = [circle(c, PUPIL_RADIUS) for c in PUPIL_CENTERS]

    ink = unary_union([head, *rims]).difference(unary_union(scleras))
    return unary_union([ink, *pupils])


def to_path_data(geometry):
    """Emit `d` as closed polylines. Rings are disjoint or nested after the boolean
    ops, so evenOdd fills them correctly without relying on winding direction."""
    geometry = geometry.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
    polygons = list(geometry.geoms) if geometry.geom_type == 'MultiPolygon' else [geometry]
    subpaths = []
    for polygon in polygons:
        for ring in [polygon.exterior, *polygon.interiors]:
            coords = list(ring.coords)[:-1]
            head = f'M{coords[0][0]:.1f},{coords[0][1]:.1f}'
            subpaths.append(head + ''.join(f'L{x:.1f},{y:.1f}' for x, y in coords[1:]) + 'Z')
    return ''.join(subpaths)


def main():
    ink = build_ink()
    min_x, min_y, max_x, max_y = ink.bounds
    scale = ARTWORK_DP / (max_x - min_x)
    translate_x = (CANVAS_DP - ARTWORK_DP) / 2 - min_x * scale
    translate_y = (CANVAS_DP - (max_y - min_y) * scale) / 2 - min_y * scale
    path_data = to_path_data(ink)

    vector = f"""<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24"
    android:tint="#FFFFFF">
  <!-- Generated by TherrMobile/resources/icons/build-notification-icon.py from
       main/assets/habits-logo.svg. Edit the logo and re-run; do not hand-edit. -->
  <group android:scaleX="{scale:.8f}"
      android:scaleY="{scale:.8f}"
      android:translateX="{translate_x:.4f}"
      android:translateY="{translate_y:.4f}">
    <path
        android:pathData="{path_data}"
        android:fillType="evenOdd"
        android:fillColor="#ffffff"/>
  </group>
</vector>
"""
    vector_path = os.path.join(RES_DIR, 'drawable-anydpi-v24', 'ic_notification_icon.xml')
    with open(vector_path, 'w') as handle:
        handle.write(vector)
    print(f'wrote {vector_path}')

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">'
        f'<g transform="translate({translate_x:.4f},{translate_y:.4f}) scale({scale:.8f})">'
        f'<path d="{path_data}" fill="#FFFFFF" fill-rule="evenodd"/></g></svg>'
    )
    for density, size in DENSITIES:
        png_path = os.path.join(RES_DIR, f'drawable-{density}', 'ic_notification_icon.png')
        cairosvg.svg2png(bytestring=svg.encode(), write_to=png_path,
                         output_width=size, output_height=size)
        # cairosvg writes RGBA already, but be explicit: the alpha channel is the
        # only thing Android reads off these.
        Image.open(png_path).convert('RGBA').save(png_path)
        print(f'wrote {png_path}')


if __name__ == '__main__':
    main()
