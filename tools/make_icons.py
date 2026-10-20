"""Draws the app icons into app/public/.

Run from the repository root:  python tools/make_icons.py
Needs Pillow (pip install pillow). Re-run after changing the design below.
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "app" / "public"

BACKGROUND = "#0f172a"  # slate-900, same as the app
BARS = "#f8fafc"  # near white
SCAN_LINE = "#34d399"  # emerald-400

# Barcode pattern as (width, is_bar) pairs, in narrow-module units.
PATTERN = [(2, 1), (1, 0), (1, 1), (1, 0), (3, 1), (1, 0), (1, 1), (2, 0), (2, 1), (1, 0),
           (1, 1), (1, 0), (3, 1), (2, 0), (1, 1), (1, 0), (2, 1)]

# Share of the icon used by the barcode. 0.56 keeps it inside the safe circle
# that Android uses when it crops "maskable" icons.
CONTENT = 0.56


def shapes(size: int):
    """Yields ("bar"|"line", (x0, y0, x1, y1)) rectangles for an icon of `size` pixels."""
    units = sum(width for width, _ in PATTERN)
    box = size * CONTENT
    left = (size - box) / 2
    top = (size - box * 0.8) / 2
    bottom = top + box * 0.8
    unit = box / units
    x = left
    for width, is_bar in PATTERN:
        if is_bar:
            yield "bar", (x, top, x + width * unit, bottom)
        x += width * unit
    mid = size / 2
    thickness = size * 0.035
    yield "line", (left - size * 0.05, mid - thickness / 2, left + box + size * 0.05, mid + thickness / 2)


def png(size: int, name: str, rounded: bool) -> None:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0) if rounded else BACKGROUND)
    draw = ImageDraw.Draw(image)
    if rounded:
        draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=size * 0.22, fill=BACKGROUND)
    for kind, rect in shapes(size):
        if kind == "bar":
            draw.rectangle(rect, fill=BARS)
        else:
            draw.rounded_rectangle(rect, radius=(rect[3] - rect[1]) / 2, fill=SCAN_LINE)
    image.save(OUT / name)


def svg(name: str) -> None:
    size = 512
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">',
             f'<rect width="{size}" height="{size}" rx="{size * 0.22:.1f}" fill="{BACKGROUND}"/>']
    for kind, (x0, y0, x1, y1) in shapes(size):
        if kind == "bar":
            parts.append(f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{x1 - x0:.1f}" '
                         f'height="{y1 - y0:.1f}" fill="{BARS}"/>')
        else:
            height = y1 - y0
            parts.append(f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{x1 - x0:.1f}" '
                         f'height="{height:.1f}" rx="{height / 2:.1f}" fill="{SCAN_LINE}"/>')
    parts.append("</svg>")
    (OUT / name).write_text("".join(parts) + "\n")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    png(192, "icon-192.png", rounded=True)
    png(512, "icon-512.png", rounded=True)
    png(512, "icon-maskable-512.png", rounded=False)  # full square: the phone crops it
    png(180, "apple-touch-icon.png", rounded=False)  # iPhone rounds the corners itself
    svg("icon.svg")
    print(f"Icons written to {OUT}")
