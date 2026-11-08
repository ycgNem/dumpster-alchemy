"""The favicon: a raccoon's masked face, 16 x 16, on the game palette.
Run: python3 pixel-art/favicon/build.py
Writes public/favicon.ico (16 and 32, nearest-neighbour), public/favicon.png (32 x 32) and a review
copy at art-src/review/v2/favicon.png (8x, on night0 and on white, like a browser tab).
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pixel-art"))
from PIL import Image  # noqa: E402
from pal import rgb  # noqa: E402

# The left half of each row; the right half is its mirror. '.' is clear.
HALF = [
    "........",
    ".##.....",
    "#33#....",
    "#3p3####",
    "#3p22222",
    "#2222222",
    "#2kkk222",
    "#kkwkk24",
    "#2kkk444",
    ".#224444",
    ".#22444#",
    "..#24444",
    "...#4444",
    "....####",
    "........",
    "........",
]
KEY = {"#": "ink0", "2": "fur2", "3": "fur3", "4": "fur4", "k": "ink1", "w": "white", "p": "pink"}


def face():
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, half in enumerate(HALF):
        row = half + half[::-1]
        assert len(row) == 16, row
        for x, ch in enumerate(row):
            if ch in KEY:
                im.putpixel((x, y), rgb(KEY[ch]) + (255,))
    # the glint sits on the same side of both eyes (top-left light)
    im.putpixel((12, 7), rgb("ink1") + (255,))
    im.putpixel((11, 7), rgb("white") + (255,))
    return im


def main():
    f16 = face()
    f32 = f16.resize((32, 32), Image.NEAREST)
    pub = ROOT / "public"
    f32.save(pub / "favicon.png")
    f32.save(pub / "favicon.ico", sizes=[(16, 16), (32, 32)], append_images=[f16])
    rev = ROOT / "art-src" / "review" / "v2"
    rev.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (16 * 8 * 2 + 30, 16 * 8 + 20), (34, 30, 40, 255))
    for i, bg in enumerate((rgb("night0"), (255, 255, 255))):
        tile = Image.new("RGBA", (16, 16), bg + (255,))
        tile.alpha_composite(f16)
        sheet.alpha_composite(tile.resize((128, 128), Image.NEAREST), (10 + i * 138, 10))
    sheet.save(rev / "favicon.png")
    print("favicon -> public/favicon.ico, public/favicon.png; review -> art-src/review/v2/favicon.png")


if __name__ == "__main__":
    main()
