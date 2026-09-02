#!/usr/bin/env python3
"""Repair TherrFont.ttf's left side bearings so icons stop drawing off-center.

A TrueType glyph carries its own bounding box in `glyf` and its left side bearing in
`hmtx`, and the spec requires `lsb == xMin`. When they disagree, FreeType -- the
rasterizer behind Android and iOS -- slides the outline by `lsb - xMin` so the ink
lands at the advertised bearing.

Commit 6e6d6882d rebuilt this font from IcoMoon to add the cami-glyph. The rebuild
recalculated each glyph's true `xMin` but left every `lsb` at 0, so FreeType dragged
all 95 icons left by their own bearing: 3px for "trophy", 8px for "dots-horiz", 11px
for "idea" at 24dp on a 2.625-density screen. `general` kept the pre-rebuild font,
which is why only the niche builds looked wrong.

react-native-vector-icons makes this especially visible: it renders an icon as a bare
<Text>, so the laid-out box IS the advance width and a displaced outline cannot be
recovered by centering the box. Several rounds of layout workarounds (fixed-size
wrappers, `includeFontPadding: false`, nudge transforms) chased this before the cause
was found -- none of them could have worked.

This rewrites `lsb` to match `xMin`. It touches no outline coordinates, so the
rendered result is identical to what `general` ships. It is idempotent, and safe to
re-run after any IcoMoon export:

    pip install fonttools
    python3 resources/fonts/fix-icon-font-bearings.py

Both checked-in copies are written together. Never point this at SSOFont.ttf -- its
glyphs are fragments of layered multi-color logos whose bearings are load-bearing.
"""
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

MOBILE_ROOT = Path(__file__).resolve().parent.parent.parent
TARGETS = [
    MOBILE_ROOT / 'resources' / 'fonts' / 'TherrFont.ttf',
    MOBILE_ROOT / 'android' / 'app' / 'src' / 'main' / 'assets' / 'fonts' / 'TherrFont.ttf',
]


def fix(path: Path) -> int:
    # recalcBBoxes would rewrite every glyph's stored box on save, which is the other
    # half of this bug -- keep the file's own boxes and only correct the bearings.
    font = TTFont(path, recalcBBoxes=False)
    glyf, hmtx = font['glyf'], font['hmtx']
    fixed = 0

    for name in font.getGlyphOrder():
        glyph = glyf[name]
        advance, lsb = hmtx[name]
        # An empty glyph (space) has no outline and no meaningful bounding box.
        if glyph.numberOfContours == 0:
            continue
        if lsb != glyph.xMin:
            hmtx[name] = (advance, glyph.xMin)
            fixed += 1

    if fixed:
        font.save(path)
    print(f'{path.relative_to(MOBILE_ROOT)}: corrected {fixed} side bearing(s)')
    return fixed


if __name__ == '__main__':
    missing = [t for t in TARGETS if not t.exists()]
    if missing:
        sys.exit(f'missing font copies: {", ".join(str(m) for m in missing)}')
    for target in TARGETS:
        fix(target)
