"""Draws the test images in spec/fixtures/generated/ from spec/gs1-vectors.json.

Every vector with a "barcode" field is drawn as a clean barcode, then copied with
typical photo problems (blur, rotation, glare, ...). The tests decode every image and
check it gives exactly the vector's symbology identifier and message.

Run from the repository root:   python tools/make_fixtures.py
Needs:                          pip install -r tools/requirements.txt
The output is deterministic, so re-running only changes files when the inputs changed.
"""

import json
import random
import shutil
from pathlib import Path

import numpy as np
import zxingcpp
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
VECTORS = ROOT / "spec" / "gs1-vectors.json"
OUT = ROOT / "spec" / "fixtures" / "generated"

MODULE_PX = 4  # pixels per barcode module in the clean image
GS = "\x1d"


def draw_clean(barcode: dict) -> Image.Image:
    """The vector's barcode, black on white, with quiet zones and a white margin."""
    fmt = zxingcpp.barcode_format_from_str(barcode["format"])
    options = {"gs1": True} if barcode.get("gs1") else {}
    symbol = zxingcpp.create_barcode(barcode["content"], fmt, **options)
    image = Image.fromarray(np.array(zxingcpp.write_barcode_to_image(symbol, scale=MODULE_PX)))
    image = image.convert("L")
    return ImageOps.expand(image, border=40, fill=255)


# Each variant takes the clean image and a seeded random generator, and returns
# (image, file extension). Categories group them in the decode-rate report.
def clean(img, rng):
    return img, "png"


def small(img, rng):
    # About 1.5 pixels per module: a code photographed from too far away.
    w, h = img.size
    factor = 1.5 / MODULE_PX
    return img.resize((max(1, round(w * factor)), max(1, round(h * factor))), Image.BILINEAR), "png"


def blur(img, rng):
    return img.filter(ImageFilter.GaussianBlur(radius=MODULE_PX * 0.45)), "png"


def rotate(angle):
    def apply(img, rng):
        return img.rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor=255), "png"
    return apply


def low_contrast(img, rng):
    # Grey on grey: faded print or poor light.
    arr = np.asarray(img, dtype=np.float32)
    return Image.fromarray((110 + arr / 255 * 60).astype(np.uint8)), "png"


def glare(img, rng):
    # A bright reflection over part of the code.
    w, h = img.size
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = w * rng.uniform(0.35, 0.65), h * rng.uniform(0.35, 0.65)
    radius = min(w, h) * 0.3
    spot = np.clip(1 - np.hypot(xx - cx, yy - cy) / radius, 0, 1) ** 1.5 * 0.75
    arr = np.asarray(img, dtype=np.float32)
    return Image.fromarray((arr + (255 - arr) * spot).astype(np.uint8)), "png"


def inverted(img, rng):
    return ImageOps.invert(img), "png"


def perspective(img, rng):
    # Photographed at an angle: one side of the code further away than the other.
    w, h = img.size
    d = 0.12
    coeffs = _perspective_coeffs(
        [(0, 0), (w, 0), (w, h), (0, h)],
        [(w * d, h * d), (w * (1 - d / 2), 0), (w, h), (0, h * (1 - d))],
    )
    return img.transform((w, h), Image.PERSPECTIVE, coeffs, Image.BICUBIC, fillcolor=255), "png"


def jpeg(img, rng):
    return img, "jpg-15"  # saved with heavy JPEG compression below


def noise(img, rng):
    arr = np.asarray(img, dtype=np.float32)
    noisy = arr + np.random.default_rng(rng.randint(0, 2**31)).normal(0, 28, arr.shape)
    return Image.fromarray(np.clip(noisy, 0, 255).astype(np.uint8)), "png"


def photo(img, rng):
    # Several problems at once, on a larger uneven background, like a quick phone photo.
    w, h = img.size
    cw, ch = int(w * 1.8), int(h * 1.8)
    shade = np.linspace(170, 230, cw, dtype=np.float32)[None, :].repeat(ch, 0)
    canvas = Image.fromarray(shade.astype(np.uint8))
    turned = img.rotate(rng.uniform(-12, 12), resample=Image.BICUBIC, expand=True, fillcolor=255)
    canvas.paste(turned, ((canvas.size[0] - turned.size[0]) // 2, (canvas.size[1] - turned.size[1]) // 2))
    canvas = canvas.filter(ImageFilter.GaussianBlur(radius=MODULE_PX * 0.3))
    return canvas, "jpg-40"


VARIANTS = {
    "clean": ("clean", clean),
    "small": ("small", small),
    "blur": ("blur", blur),
    "rotate-15": ("rotation", rotate(15)),
    "rotate-30": ("rotation", rotate(30)),
    "perspective": ("perspective", perspective),
    "low-contrast": ("low contrast", low_contrast),
    "glare": ("glare", glare),
    "inverted": ("inverted", inverted),
    "noise": ("noise", noise),
    "jpeg": ("heavy JPEG", jpeg),
    "photo": ("photo-like", photo),
}


def _perspective_coeffs(target, source):
    """Coefficients for Image.transform(PERSPECTIVE) mapping target corners to source corners."""
    rows = []
    for (x, y), (u, v) in zip(target, source):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    a = np.array(rows, dtype=np.float64)
    b = np.array([c for point in source for c in point], dtype=np.float64)
    return np.linalg.solve(a, b).tolist()


def save(img: Image.Image, path_stem: Path, kind: str) -> Path:
    if kind.startswith("jpg"):
        quality = int(kind.split("-")[1])
        path = path_stem.with_suffix(".jpg")
        img.save(path, quality=quality, optimize=True)
    else:
        path = path_stem.with_suffix(".png")
        img.save(path, optimize=True)
    return path


def check_clean(img: Image.Image, vector: dict) -> None:
    """The clean image must give exactly the vector's scan data, or the drawing is wrong."""
    results = zxingcpp.read_barcodes(np.asarray(img), text_mode=zxingcpp.TextMode.Plain)
    expected = (vector["symbologyId"], vector["message"].replace("{GS}", GS).encode("latin-1"))
    got = [(r.symbology_identifier, bytes(r.bytes)) for r in results]
    if got != [expected]:
        raise SystemExit(f"{vector['id']}: clean image reads as {got}, expected {expected}")


def main() -> None:
    vectors = [v for v in json.loads(VECTORS.read_text())["scans"] if "barcode" in v]
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    manifest = []
    for vector in vectors:
        base = draw_clean(vector["barcode"])
        check_clean(base, vector)
        for name, (category, make) in VARIANTS.items():
            rng = random.Random(f"{vector['id']}/{name}")  # same result on every run
            img, kind = make(base, rng)
            path = save(img, OUT / f"{vector['id']}--{name}", kind)
            manifest.append({"file": path.name, "vector": vector["id"], "variant": name, "category": category})
    (OUT / "manifest.json").write_text(json.dumps({
        "about": "Generated by tools/make_fixtures.py from spec/gs1-vectors.json. Each image must "
                 "decode to its vector's symbologyId and message. Do not edit by hand.",
        "images": manifest,
    }, indent=2) + "\n")
    size = sum(f.stat().st_size for f in OUT.iterdir())
    print(f"{len(manifest)} images from {len(vectors)} vectors, {size / 1e6:.1f} MB, in {OUT}")


if __name__ == "__main__":
    main()
