#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate PWA icons from the existing store asset using Pillow."""
import sys
from pathlib import Path
from PIL import Image


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: make-pwa-icons.py <dist-dir>", file=sys.stderr)
        return 2
    repo = Path(__file__).resolve().parents[1]
    src = repo / "store-assets" / "icon" / "lyco_music_icon_1024.png"
    out = Path(sys.argv[1]) / "icons"
    out.mkdir(parents=True, exist_ok=True)
    im = Image.open(src).convert("RGBA")
    im.resize((192, 192), Image.LANCZOS).save(out / "icon-192.png")
    im.resize((512, 512), Image.LANCZOS).save(out / "icon-512.png")
    # maskable: keep a 10% safe zone so the glyph survives circular masks
    canvas = Image.new("RGBA", (512, 512), (255, 255, 255, 255))
    inner = im.resize((410, 410), Image.LANCZOS)
    canvas.alpha_composite(inner, (51, 51))
    canvas.save(out / "icon-maskable-512.png")
    for name in ("icon-192.png", "icon-512.png", "icon-maskable-512.png"):
        print(name, (out / name).stat().st_size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
