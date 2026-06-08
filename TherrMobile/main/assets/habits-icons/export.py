#!/usr/bin/env python3
"""
Export the HABITS app-icon raster set from the canonical SVG.

Usage:
    python3 export.py

Outputs (relative to this script's directory):
    ios/Icon-{size}.png              — iOS AppIcon.appiconset pixel sizes
    android/mipmap-{density}/        — Android legacy launcher icons
        ic_launcher.png              — square
        ic_launcher_round.png        — circular mask applied
    android/mipmap-{density}/        — Android adaptive-icon layers
        ic_launcher_foreground.png   — 108dp foreground (chameleon, 66% safe zone)
        ic_launcher_background.png   — 108dp background (solid white)
    android/playstore/icon-512.png   — Play Store listing
"""
from pathlib import Path
import cairosvg

HERE = Path(__file__).parent
MASTER_SVG = HERE.parent / "habits-logo.svg"
FG_SVG = HERE / "adaptive-foreground.svg"
BG_SVG = HERE / "adaptive-background.svg"

IOS_SIZES = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024]

# Android launcher: (density, legacy-size-px, adaptive-size-px)
# Adaptive foreground/background are 108dp; legacy ic_launcher is 48dp.
ANDROID_DENSITIES = [
    ("mdpi",    48,  108),
    ("hdpi",    72,  162),
    ("xhdpi",   96,  216),
    ("xxhdpi",  144, 324),
    ("xxxhdpi", 192, 432),
]


def rasterize(svg_path: Path, out_path: Path, size: int) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cairosvg.svg2png(
        url=str(svg_path),
        write_to=str(out_path),
        output_width=size,
        output_height=size,
    )
    print(f"  {out_path.relative_to(HERE)}  ({size}x{size})")


def main() -> None:
    print("iOS AppIcon.appiconset:")
    for size in IOS_SIZES:
        rasterize(MASTER_SVG, HERE / "ios" / f"Icon-{size}.png", size)

    print("\nAndroid mipmap (legacy square + round + adaptive layers):")
    for density, legacy_px, adaptive_px in ANDROID_DENSITIES:
        mipmap_dir = HERE / "android" / f"mipmap-{density}"
        rasterize(MASTER_SVG, mipmap_dir / "ic_launcher.png",            legacy_px)
        rasterize(MASTER_SVG, mipmap_dir / "ic_launcher_round.png",      legacy_px)
        rasterize(FG_SVG,     mipmap_dir / "ic_launcher_foreground.png", adaptive_px)
        rasterize(BG_SVG,     mipmap_dir / "ic_launcher_background.png", adaptive_px)

    print("\nPlay Store listing:")
    rasterize(MASTER_SVG, HERE / "android" / "playstore" / "icon-512.png", 512)

    print("\nDone.")


if __name__ == "__main__":
    main()
