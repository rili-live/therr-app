#!/usr/bin/env python3
"""Build Google Ads image assets for Friends with Habits from repo content.

WHY A GENERATOR RATHER THAN SIX CHECKED-IN PNGs
The source screenshots change every time the app's UI does, and a stale ad
creative is worse than no creative: it advertises a product that no longer looks
like that. Regenerating is one command. The PNGs are committed too, because the
Ads UI needs files to upload and not everyone running a campaign has a
checkout — but they are outputs, and this file is the source.

WHY THE SOURCES COME OUT OF GIT
The screenshots live on `niche/HABITS-general`
(docs/niche-sub-apps/habits/play-listing-screenshots/) and this directory lives
on `general`, per the branch split in the root CLAUDE.md. Reading them with
`git show` rather than a relative path is what lets this run from `general`,
where the campaign specs that reference the output actually are.

WHY HEADLESS CHROME
Real text layout. ImageMagick can draw a string but not wrap, kern, or lay out
a two-column composition, and an ad frame is mostly typography. Chrome also
loads Lexend — the same face habits.therr.com uses — so the creative matches the
landing page a searcher may have already seen.

WHAT THIS DELIBERATELY DOES NOT DO
No video. App campaign video assets must be YouTube-hosted (you supply a URL,
not a file), so they cannot be produced here at all, and video is the single
largest lever on App campaign CPI. See docs/WORK_IN_PROGRESS.md.

Usage:
    python3 scripts/google-ads/assets/build_frames.py [--out DIR] [--keep-html]
"""

from __future__ import annotations

import argparse
import base64
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = Path(__file__).resolve().parent / "habits"

SCREENSHOT_BRANCH = "niche/HABITS-general"
SCREENSHOT_DIR = "docs/niche-sub-apps/habits/play-listing-screenshots"
LOGO_PATH = "therr-client-web/src/_static/assets/images/habits-logo.svg"

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Sampled from the app itself (the check-in button and streak pill) and from
# habits-logo.svg's crest, so the creative and the post-click experience are the
# same brand rather than two interpretations of it.
PURPLE = "#3B2A4E"
PURPLE_DEEP = "#2A1D38"
AMBER = "#EDBB3C"
CREAM = "#FFF8F3"

# Google Ads App campaign image asset slots. Ratios are what Ads validates on;
# these are the recommended pixel sizes, comfortably above each minimum.
FORMATS = {
    "landscape": (1200, 628),    # 1.91:1, min 600x314
    "square": (1200, 1200),      # 1:1,    min 300x300
    "portrait": (1200, 1500),    # 4:5,    min 480x600
}

# Each concept pairs a screenshot with the one line it is making. Kept short on
# purpose: Ads composes these with the headlines in campaigns/*.yaml, and an
# image that argues its own case competes with the text asset beside it.
CONCEPTS = {
    "streak": {
        "shot": "06-active-streak-widget.png",
        "line": "Don't break<br>the streak.",
        "kicker": "13 days and counting",
    },
    "pact": {
        "shot": "05-dashboard-multi-habit.png",
        "line": "Every habit is<br>a pact.",
        "kicker": "Free for five habits",
    },
    "partner": {
        "shot": "04-pact-onboarding-empty-state.png",
        "line": "Someone else is<br>counting on you.",
        "kicker": "Pacts need a partner",
    },
}

# NOT usable as ad creative, despite being the best-looking screenshots in the
# set: 01-onboarding-make-pacts-hero, 02-onboarding-build-habits and
# 03-onboarding-invite-friends are full-bleed onboarding slides that carry their
# OWN headline burned into the image. Dropped into a frame that supplies a
# headline the result has two competing ones and reads as a mistake — and they
# show stock photography rather than the product. Only screens whose copy
# complements a headline instead of repeating it belong here.


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, capture_output=True, cwd=REPO_ROOT, **kwargs)


def git_bytes(ref: str, path: str) -> bytes:
    """Read a file out of another branch without checking it out."""
    return run(["git", "show", f"{ref}:{path}"]).stdout


def data_uri(payload: bytes, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(payload).decode('ascii')}"


def logo_png() -> bytes:
    """Rasterize habits-logo.svg. rsvg-convert keeps the gradient; sips does not."""
    svg = git_bytes("general", LOGO_PATH)
    with tempfile.NamedTemporaryFile(suffix=".svg", delete=False) as handle:
        handle.write(svg)
        svg_path = handle.name
    png_path = svg_path.replace(".svg", ".png")
    subprocess.run(
        ["rsvg-convert", "-w", "512", "-h", "512", svg_path, "-o", png_path],
        check=True, capture_output=True,
    )
    return Path(png_path).read_bytes()


def build_html(fmt: str, concept: str, shot_uri: str, logo_uri: str) -> str:
    width, height = FORMATS[fmt]
    spec = CONCEPTS[concept]
    is_wide = fmt == "landscape"

    # The phone is bled off the bottom edge rather than fully contained. A whole
    # device floating in a box reads as a press kit; a cropped one reads as an
    # ad, and it buys ~30% more apparent screen area at the same frame size.
    layout = {
        "landscape": dict(cols="1.05fr 0.95fr", pad="64px", title="60px",
                          kicker="21px", logo="52px", phone_w="330px", phone_top="86px"),
        "square": dict(cols="1fr", pad="72px", title="76px",
                       kicker="25px", logo="64px", phone_w="500px", phone_top="0px"),
        "portrait": dict(cols="1fr", pad="76px", title="82px",
                         kicker="27px", logo="68px", phone_w="560px", phone_top="0px"),
    }[fmt]

    stack = (
        f"grid-template-columns: {layout['cols']}; align-items: center;"
        if is_wide else
        "grid-template-rows: auto 1fr; justify-items: center; text-align: center;"
    )

    return f"""<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after {{ box-sizing: border-box; }}
  html, body {{ margin: 0; padding: 0; }}
  body {{
    width: {width}px; height: {height}px; overflow: hidden;
    font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
    /* Off-centre radial so the frame has a light source rather than a flat fill. */
    background:
      radial-gradient(120% 90% at 18% 8%, #4A365F 0%, {PURPLE} 46%, {PURPLE_DEEP} 100%);
    color: {CREAM};
  }}
  .frame {{
    width: 100%; height: 100%; display: grid; {stack}
    padding: {layout['pad']}; gap: 28px; position: relative;
  }}
  /* Amber wash behind the device, tying the crest colour into the composition
     without putting a second block of colour on the page. */
  /* Sits BEHIND the top of the device so it rims the screen like a light
     source. Pooled at the bottom edge it only turned the corners brown. */
  .glow {{
    position: absolute; border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle, rgba(237,187,60,0.17) 0%, rgba(237,187,60,0) 68%);
    width: {'720px' if is_wide else '880px'}; height: {'720px' if is_wide else '880px'};
    {'right: -140px; top: -60px;' if is_wide else 'left: 50%; transform: translateX(-50%); top: 20%;'}
  }}
  .copy {{ position: relative; z-index: 2; }}
  .brand {{ display: flex; align-items: center; gap: 16px; margin-bottom: 26px;
            {'' if is_wide else 'justify-content: center;'} }}
  .brand img {{ width: {layout['logo']}; height: {layout['logo']}; display: block; }}
  .brand span {{ font-weight: 800; font-size: {layout['kicker']}; letter-spacing: -0.01em; }}
  h1 {{
    margin: 0; font-weight: 800; font-size: {layout['title']}; line-height: 1.04;
    letter-spacing: -0.035em; color: #fff;
  }}
  .kicker {{
    margin: 22px 0 0; font-size: {layout['kicker']}; font-weight: 600; color: {AMBER};
    display: inline-flex; align-items: center; gap: 12px;
  }}
  .kicker::before {{
    content: ''; width: 34px; height: 3px; border-radius: 2px; background: {AMBER};
  }}
  .stage {{ position: relative; z-index: 2; display: flex; justify-content: center;
            align-items: flex-end; height: 100%; {'' if is_wide else 'margin-top: 8px;'} }}
  /* Device: a bezel drawn in CSS rather than a mockup image, so nothing here
     depends on an asset we do not own the licence to. */
  .phone {{
    width: {layout['phone_w']}; margin-top: {layout['phone_top']};
    border-radius: 44px; padding: 11px; background: #14101A;
    box-shadow: 0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.09);
    transform: {'rotate(-3deg)' if is_wide else 'none'};
  }}
  .phone img {{ width: 100%; display: block; border-radius: 34px; }}
</style></head>
<body>
  <div class="frame">
    <div class="glow"></div>
    <div class="copy">
      <div class="brand">
        <img src="{logo_uri}" alt="">
        <span>Friends with Habits</span>
      </div>
      <h1>{spec['line']}</h1>
      <p class="kicker">{spec['kicker']}</p>
    </div>
    <div class="stage">
      <div class="phone"><img src="{shot_uri}" alt=""></div>
    </div>
  </div>
</body></html>"""


def shoot(html: str, out: Path, width: int, height: int, workdir: Path) -> None:
    page = workdir / f"{out.stem}.html"
    page.write_text(html)
    subprocess.run(
        [
            CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
            f"--screenshot={out}", f"--window-size={width},{height}",
            # Give the webfont a moment; a frame rendered in the fallback face
            # is the one defect that is invisible until it is on a billboard.
            "--virtual-time-budget=4000",
            f"file://{page}",
        ],
        check=True, capture_output=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=OUT_DIR)
    parser.add_argument("--keep-html", action="store_true")
    args = parser.parse_args()

    if not Path(CHROME).exists():
        print(f"Chrome not found at {CHROME}. Install it, or edit CHROME.", file=sys.stderr)
        return 1

    args.out.mkdir(parents=True, exist_ok=True)
    logo_uri = data_uri(logo_png(), "image/png")

    workdir = Path(tempfile.mkdtemp(prefix="fwh-frames-"))
    written = []
    try:
        for concept, spec in CONCEPTS.items():
            shot_uri = data_uri(
                git_bytes(SCREENSHOT_BRANCH, f"{SCREENSHOT_DIR}/{spec['shot']}"),
                "image/png",
            )
            for fmt, (width, height) in FORMATS.items():
                out = args.out / f"{fmt}-{width}x{height}-{concept}.png"
                shoot(build_html(fmt, concept, shot_uri, logo_uri), out, width, height, workdir)
                written.append(out)
                print(f"  wrote {out.relative_to(REPO_ROOT)}")
    finally:
        if args.keep_html:
            print(f"\n  html kept in {workdir}")
        else:
            shutil.rmtree(workdir, ignore_errors=True)

    print(f"\n{len(written)} frames. Upload them in the Ads UI — "
          "`therrads campaign apply` sends text assets only.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
