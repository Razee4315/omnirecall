"""Make generated README art web-ready.

    python -I tools/readme-art/process.py [--raw DIR] [--out DIR]

For each PNG in the raw folder:
  * report the alpha range and how much of the image is semi-transparent,
    so a fake "transparent" background (baked checkerboard, hazy alpha) is
    caught by numbers rather than by eye;
  * transparent icons: trim empty margins, pad evenly, fit to a square;
  * banners: resize to the target width;
  * save as WebP and write sizes.json with every output's width and height.
"""
import argparse
import json
from pathlib import Path

from PIL import Image

# Output width per image family (height follows the aspect ratio).
TARGETS = {"hero": 1600, "feature": 320}
PAD = 0.08  # breathing room around trimmed icons, as a share of the side


def alpha_report(img: Image.Image) -> dict:
    if img.mode != "RGBA":
        return {"alpha": False}
    a = img.getchannel("A")
    hist = a.histogram()
    total = img.width * img.height
    # Near-opaque (>= 247) counts as solid: glass renders at ~253.
    clear = sum(hist[:9]) / total
    solid = sum(hist[247:]) / total
    semi = 1 - clear - solid
    lo, hi = a.getextrema()
    return {"alpha": True, "min": lo, "max": hi, "clear": round(clear, 3), "solid": round(solid, 3), "semi": round(semi, 3)}


def process_icon(img: Image.Image, size: int) -> Image.Image:
    img = img.convert("RGBA")
    # Trim to the visible object (ignore near-invisible haze).
    mask = img.getchannel("A").point(lambda v: 255 if v > 8 else 0)
    box = mask.getbbox() or (0, 0, img.width, img.height)
    obj = img.crop(box)
    side = int(max(obj.size) * (1 + 2 * PAD))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(obj, ((side - obj.width) // 2, (side - obj.height) // 2), obj)
    return canvas.resize((size, size), Image.LANCZOS)


def process_banner(img: Image.Image, width: int) -> Image.Image:
    img = img.convert("RGB")
    height = round(img.height * width / img.width)
    return img.resize((width, height), Image.LANCZOS)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", default="tools/readme-art/raw")
    parser.add_argument("--out", default="docs/assets/readme")
    args = parser.parse_args()
    raw, out = Path(args.raw), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    sizes = {}
    for path in sorted(raw.glob("*.png")):
        img = Image.open(path)
        report = alpha_report(img)
        family = path.stem.split("-")[0]
        if family == "feature":
            result = process_icon(img, TARGETS["feature"])
        else:
            result = process_banner(img, TARGETS.get(family, 1600))
        dest = out / f"{path.stem}.webp"
        result.save(dest, "WEBP", quality=88, method=6)
        sizes[path.stem] = {"width": result.width, "height": result.height}
        kb = dest.stat().st_size / 1024
        print(f"{path.stem:18} {img.width}x{img.height} {img.mode:5} -> {result.width}x{result.height} {kb:6.1f} KB  {report}")

    (out / "sizes.json").write_text(json.dumps(sizes, indent=2) + "\n")


if __name__ == "__main__":
    main()
