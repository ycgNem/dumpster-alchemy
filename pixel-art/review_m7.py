"""Review sheets for the M7 art wave (critic fixes), read from the built atlases in public/art/.

    python3 pixel-art/review_m7.py [--before DIR]

-> art-src/review/m7/
   possum.png        the possum set beside Gary, on the board dirt and on night0, 4x and 1x
   possum_lot.png    possum_walk on the lot at 1x and 3x: the lane, the dark ground, the board
   king.png          king_portrait (both frames) on night0 and dirt, 1x and 2x, beside the 28 px item
   sky.png           moon + gull_fly (written by pixel-art/backdrop/build.py)
   sky_lot.png       moon and gulls placed on the real backdrop sky, 1x and 3x
   dirt.png          the board before / after (DIR holds the old board.png/.json, items.png/.json)
                     with the tiers on it, 1x and 3x
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "anchor"))
from kit import ART, REVIEW, RGB, FONT, Image, ImageDraw  # noqa: E402

OUT = REVIEW / "m7"
BG = (34, 30, 40, 255)


def atlas(fam, base=ART):
    meta = json.loads((Path(base) / f"{fam}.json").read_text(encoding="utf-8"))["sprites"]
    return Image.open(Path(base) / f"{fam}.png").convert("RGBA"), meta


def frames(fam, name, base=ART):
    im, meta = atlas(fam, base)
    e = meta[name]
    return [im.crop((e["x"] + i * e["w"], e["y"], e["x"] + (i + 1) * e["w"], e["y"] + e["h"]))
            for i in range(e["frames"])]


def board(w, h, base=ART, ox=0, oy=0):
    im, meta = atlas("board", base)
    ca = im.crop((meta["cell_a"]["x"], meta["cell_a"]["y"], meta["cell_a"]["x"] + 32, meta["cell_a"]["y"] + 32))
    cb = im.crop((meta["cell_b"]["x"], meta["cell_b"]["y"], meta["cell_b"]["x"] + 32, meta["cell_b"]["y"] + 32))
    out = Image.new("RGBA", (w, h))
    for r in range(-1, h // 32 + 2):
        for c in range(-1, w // 32 + 2):
            out.alpha_composite(ca if (r + c) % 2 == 0 else cb, (ox + c * 32, oy + r * 32)) if \
                0 <= ox + c * 32 < w and 0 <= oy + r * 32 < h else None
    return out


def night(w, h):
    return Image.new("RGBA", (w, h), RGB["night0"] + (255,))


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def label(sheet, xy, text):
    ImageDraw.Draw(sheet).text(xy, text, fill=(235, 225, 205), font=FONT)


def tile_row(sheet, x, y, sprites, bg, k, pad=2):
    """sprites on a background (dirt or night) at scale k, left to right; returns new x."""
    for f in sprites:
        base = (board(f.width + 2 * pad, f.height + 2 * pad) if bg == "dirt" else night(f.width + 2 * pad, f.height + 2 * pad))
        base.alpha_composite(f, (pad, pad))
        sheet.alpha_composite(up(base, k), (x, y))
        x += base.width * k + 4
    return x


def possum_sheet():
    gary = frames("cast", "raccoon_gary_idle")[0]
    rows = [("raccoon_gary_idle (reference) / possum_idle (idle, blink)", [gary] + frames("cast", "possum_idle")),
            ("possum_shutdown / possum_dead", frames("cast", "possum_shutdown") + frames("cast", "possum_dead"))]
    walk = frames("cast", "possum_walk")
    W, H = 1300, 760
    sheet = Image.new("RGBA", (W, H), BG)
    label(sheet, (8, 4), "M7 Inspector Possum: dirt + night0 at 4x, then 1x. Hood down, white cone face, pink snout, bare pink ears, pink rat tail.")
    y = 20
    for text, fr in rows:
        label(sheet, (8, y), text)
        x = tile_row(sheet, 8, y + 12, fr, "dirt", 4)
        x = tile_row(sheet, x + 8, y + 12, fr[:2], "night", 4)
        x1 = x + 8
        for bg in ("dirt", "night"):
            x1 = tile_row(sheet, x1, y + 12, fr, bg, 1, pad=1) + 4
        y += 12 + 52 * 4 + 10
    label(sheet, (8, y), "possum_walk (4 frames, 8 fps, facing right): dirt + night0 at 4x, then 1x")
    x = tile_row(sheet, 8, y + 12, walk, "dirt", 4)
    x = tile_row(sheet, 8, y + 12 + 36 * 4 + 4, walk, "night", 4)
    x1 = 8 + 4 * (36 * 4 + 4) + 12
    tile_row(sheet, x1, y + 12, walk, "dirt", 1, pad=1)
    tile_row(sheet, x1, y + 12 + 40, walk, "night", 1, pad=1)
    sheet.save(OUT / "possum.png")
    print("review -> art-src/review/m7/possum.png")


def possum_lot():
    """The walk where the game will show it: the truck lane, the dark ground, the board."""
    bd = frames("backdrop", "backdrop")[0]
    walk = frames("cast", "possum_walk")
    scene = bd.crop((0, 40, 320, 200)).copy()
    for i, f in enumerate(walk):
        scene.alpha_composite(f, (20 + i * 40, 26))                       # in the truck lane
        scene.alpha_composite(f, (20 + i * 40, 150 - 40))                 # on the dark ground
    b = board(160, 64)
    for i, f in enumerate(walk):
        b.alpha_composite(f, (i * 40, 16 + (i % 2) * 8))
    scene.alpha_composite(b, (160, 100))
    W = scene.width * 3 + 8 + scene.width + 16
    sheet = Image.new("RGBA", (W, scene.height * 3 + 24), BG)
    label(sheet, (8, 4), "possum_walk on the lot: 3x (left) and 1x (right). Lane, dark ground, board dirt.")
    sheet.alpha_composite(up(scene, 3), (8, 18))
    sheet.alpha_composite(scene, (scene.width * 3 + 16, 18))
    sheet.save(OUT / "possum_lot.png")
    print("review -> art-src/review/m7/possum_lot.png")


def king_sheet():
    kp = frames("cast", "king_portrait")
    item = frames("items", "item_king")[0]
    W, H = 1240, 560
    sheet = Image.new("RGBA", (W, H), BG)
    label(sheet, (8, 4), "king_portrait (frame 1, frame 2 = shimmer, 2 fps) on night0 and dirt at 2x, 1x at right; the 28 px item_king for reference")
    x = tile_row(sheet, 8, 18, kp, "night", 2)
    x = tile_row(sheet, x + 8, 18, kp[:1], "dirt", 2)
    x = tile_row(sheet, x + 8, 18, kp + [item], "night", 1, pad=2)
    y = 18 + 100 * 2 + 12
    label(sheet, (8, y), "frame 1 at 3x on night0 | item_king at 3x")
    x = tile_row(sheet, 8, y + 12, kp[:1], "night", 3)
    tile_row(sheet, x + 8, y + 12, [item], "night", 3)
    sheet.save(OUT / "king.png")
    print("review -> art-src/review/m7/king.png")


def sky_lot():
    bd = frames("backdrop", "backdrop")[0]
    moon = frames("backdrop", "moon")[0]
    gull = frames("backdrop", "gull_fly")
    scene = bd.crop((160, 0, 640, 104)).copy()
    scene.alpha_composite(moon, (330, 6))
    for i, (gx, gy) in enumerate(((60, 18), (120, 10), (200, 24), (260, 14))):
        scene.alpha_composite(gull[i % 2], (gx, gy))
    sheet = Image.new("RGBA", (scene.width * 3 + 16, scene.height * 4 + 40), BG)
    label(sheet, (8, 4), "moon + gull_fly on the real backdrop sky: 1x (top), 3x (below)")
    sheet.alpha_composite(scene, (8, 18))
    sheet.alpha_composite(up(scene, 3), (8, 18 + scene.height + 8))
    sheet.save(OUT / "sky_lot.png")
    print("review -> art-src/review/m7/sky_lot.png")


TIERS = ["item_cap", "item_can", "item_takeout", "item_bag", "item_boot", "item_toaster", "item_gull", "item_golden_egg"]


def dirt_board(base):
    """A 9 x 3 slice of the board with the small tiers spread on both cells."""
    b = board(288, 96, base)
    for i, n in enumerate(TIERS):
        try:
            f = frames("items", n, base)[0]
        except KeyError:
            continue
        b.alpha_composite(f, ((i % 9) * 32 + (32 if i >= 4 else 0), 32 * (i // 4 % 2) + 16 * 0))
    for i, n in enumerate(("item_cap", "item_can", "item_cap", "item_can", "item_cap")):
        b.alpha_composite(frames("items", n, base)[0], (i * 32 + 128 + 0, 64))
    return b


def dirt_sheet(before):
    after = dirt_board(ART)
    old = dirt_board(before) if before else None
    W = 288 * 3 + 16 + 288 + 16
    H = (96 * 3 + 30) * (2 if old else 1) + 10
    sheet = Image.new("RGBA", (W, H), BG)
    y = 4
    for name, im in (("BEFORE", old), ("AFTER (no cap-red or white specks, calmer checker, rimmed cap + can)", after)):
        if im is None:
            continue
        label(sheet, (8, y), f"{name}: 3x and 1x")
        sheet.alpha_composite(up(im, 3), (8, y + 14))
        sheet.alpha_composite(im, (288 * 3 + 24, y + 14))
        y += 96 * 3 + 30
    sheet.save(OUT / "dirt.png")
    print("review -> art-src/review/m7/dirt.png")


def main(argv):
    OUT.mkdir(parents=True, exist_ok=True)
    before = None
    if "--before" in argv:
        before = Path(argv[argv.index("--before") + 1])
    possum_sheet()
    possum_lot()
    king_sheet()
    sky_lot()
    dirt_sheet(before)


if __name__ == "__main__":
    main(sys.argv[1:])
