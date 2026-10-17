#!/usr/bin/env python3
"""Regenerate the PWA icons (assets/icon-*.png). Requires Pillow.

A teal→cyan diagonal gradient tile with a white radio-tower glyph, matching
the in-app brand mark. Maskable variants keep the glyph inside the safe zone.
"""

from PIL import Image, ImageDraw

TOP = (45, 212, 191)    # #2dd4bf
BOTTOM = (8, 145, 178)  # #0891b2


def gradient(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
    return img


def draw_glyph(d: ImageDraw.ImageDraw, size: int, scale: float) -> None:
    """Radio tower: mast, triangular base, two broadcast arcs."""
    cx, cy = size / 2, size / 2
    u = size * scale  # glyph bounding half-unit

    w = max(2, round(size * 0.028))

    # Mast
    d.line([(cx, cy - u * 0.55), (cx, cy + u * 0.1)], fill="white", width=w)
    # Base legs
    d.line([(cx, cy + u * 0.1), (cx - u * 0.35, cy + u * 0.62)], fill="white", width=w)
    d.line([(cx, cy + u * 0.1), (cx + u * 0.35, cy + u * 0.62)], fill="white", width=w)
    # Crossbar
    d.line([(cx - u * 0.2, cy + u * 0.38), (cx + u * 0.2, cy + u * 0.38)], fill="white", width=w)
    # Tip
    r = size * 0.045
    d.ellipse([cx - r, cy - u * 0.55 - r * 2, cx + r, cy - u * 0.55], fill="white")
    # Broadcast arcs
    for rr in (u * 0.42, u * 0.66):
        bbox = [cx - rr, cy - u * 0.55 - rr, cx + rr, cy - u * 0.55 + rr]
        d.arc(bbox, start=-65, end=-20, fill="white", width=w)
        d.arc(bbox, start=-160, end=-115, fill="white", width=w)


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def make(size: int, maskable: bool) -> Image.Image:
    img = gradient(size)
    d = ImageDraw.Draw(img)
    # Maskable icons may be cropped to a circle by launchers: shrink the glyph
    # into the central safe zone and keep the full-bleed background.
    draw_glyph(d, size, 0.30 if maskable else 0.38)
    if not maskable:
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(img, (0, 0), rounded_mask(size, round(size * 0.22)))
        return out
    return img


if __name__ == "__main__":
    import pathlib

    here = pathlib.Path(__file__).parent
    for size in (192, 512):
        make(size, maskable=False).save(here / f"icon-{size}.png")
        make(size, maskable=True).save(here / f"icon-maskable-{size}.png")
        print(f"wrote icon-{size}.png + icon-maskable-{size}.png")
