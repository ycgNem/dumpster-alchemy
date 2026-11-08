"""The gull chain (gull, fatgull, gullgang, gullboss, gullgod) and the specials (golden_egg,
bin_juice). Run: python3 pixel-art/gulls/build.py

Inputs (never edited), art-src/dl/gull_*.png: PixelLab drafts. The specials are drawn by hand.
Gulls: bone/white feathers, cool steel greys on the wings, yellow beaks (STYLE).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "anchor"))
from kit import *  # noqa: E402,F403

SLUG = "gulls"
W = H = 32
GULL_GREYS = ["ink1", "steel0", "steel1", "steel2", "steel3", "bone", "white"]


def gull_cls(extra=None):
    over = [(lambda x, y, h, s, v: 15 <= h < 55 and s > 0.45 and v > 0.55, ["sodium2", "yellow", "sodium3", "hivis"]),  # beaks
            (lambda x, y, h, s, v: (h < 15 or h > 330) and s > 0.35, ["rust1", "rust2", "rust3", "pink"])]           # legs
    return classify_generic(greys=GULL_GREYS, overrides=(extra or []) + over)


def crop_box(file, box):
    return load(DL / file).crop(box)


def finish(n, dx=0, dy=0):
    return fit(clean_outline(drop_orphans(n)), W, H, "bottom", margin=1, dx=dx, dy=dy)


def trim_x(n, x0, x1):
    return {k: v for k, v in n.items() if x0 <= k[0] <= x1}


def gull():
    return finish(map_draft(crop_alpha(load(DL / "gull_gull_v1.png")), gull_cls()))


def fatgull():
    return finish(map_draft(crop_box("gull_fatgull_sheet_v1.png", (63, 0, 92, 32)), gull_cls()))


def gullgang():
    n = map_draft(crop_box("gull_gullgang_sheet_v1.png", (65, 0, 95, 32)), gull_cls())
    return finish(n)


def gullboss():
    # the sack becomes a stolen chip bag: red foil, a crimped top, chips spilling
    chip = [(lambda x, y, h, s, v: 18 <= h < 45 and s > 0.3 and v < 0.85, ["rust1", "red", "pink"]),
            (lambda x, y, h, s, v: 40 <= h < 60 and s > 0.4, ["yellow", "sodium3", "sodium2"])]
    n = map_draft(crop_box("gull_gullboss_sheet_v1.png", (57, 0, 89, 32)), gull_cls(chip))
    n = finish(n)
    reds = [k for k, v in n.items() if v in ("red", "rust1", "pink")]
    if reds:
        ys = [y for _, y in reds]; xs = [x for x, _ in reds]
        my = (min(ys) + max(ys)) // 2
        for x in range(min(xs) + 2, max(xs) - 1):          # a yellow label band across the bag
            if n.get((x, my)) in ("red", "rust1", "pink"):
                n[(x, my)] = "yellow"
    return n


def gullgod_frames():
    halo = [(lambda x, y, h, s, v: 35 <= h < 65 and s > 0.35, ["sodium2", "yellow", "sodium3", "white"])]
    n = map_draft(crop_box("gull_gullgod_sheet_v1.png", (8, 0, 38, 32)), gull_cls(halo))
    a = finish(n)
    # holy light: rays around the halo, swapping on frame 2
    hy = min(y for (_, y) in a)
    hx = [x for (x, y) in a if y == hy]
    cx = (min(hx) + max(hx)) // 2
    b = dict(a)
    for (x, y), v in a.items():
        if v in ("yellow", "sodium3"):
            b[(x, y)] = "sodium3" if v == "yellow" else "white"
    for dx in (-7, 7):
        for k in range(2):
            p = (cx + dx + (k if dx > 0 else -k), hy + 1 - k)
            if p not in a and 0 <= p[0] < W and p[1] >= 0:
                (a if k == 0 else b)[p] = "sodium3"
    return a, b


EGG_W = [4, 6, 8, 10, 10, 12, 12, 12, 14, 14, 14, 14, 14, 14, 14, 12, 12, 10, 8, 4]   # rows from y = 10


def golden_egg_frames():
    s = new_sprite(W, H)
    for k, w in enumerate(EGG_W):                            # an egg: narrow top, round bottom
        y = 10 + k
        x0 = 16 - w // 2
        for x in range(x0, x0 + w):
            d = (x - x0) / max(1, w - 1)
            c = "sodium3" if d < 0.3 and k < 9 else "yellow"
            if d > 0.72 or k > 15:
                c = "sodium2"
            if (d > 0.9 and k > 6) or (k > 17):
                c = "sodium1"
            s.px(x, y, C[c])
    for x, y in [(13, 13), (14, 13), (13, 14), (12, 15)]:
        s.px(x, y, C["white"])                               # the shine
    s.outline(C["ink0"], where="outside")
    base = image_to_names(s.composite(1))

    def sparkle(n, cx, cy):
        n[(cx, cy)] = "white"
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n[(cx + dx, cy + dy)] = "toxic3"

    a, b = dict(base), dict(base)
    sparkle(a, 6, 12); sparkle(a, 25, 22); a[(25, 9)] = "toxic2"
    sparkle(b, 25, 11); sparkle(b, 6, 23); b[(7, 17)] = "toxic2"
    return a, b


def bin_juice_frames():
    def jar(bubble):
        s = new_sprite(W, H)
        s.rect(10, 12, 21, 29, C["steel1"])                 # glass, back
        s.rect(11, 16, 20, 28, C["toxic1"])                 # the juice
        s.rect(11, 16, 20, 16, C["toxic3"])                 # its lit surface
        s.rect(17, 17, 20, 28, C["toxic0"])                 # shade side
        for x, y in [(12, 20), (13, 24), (15, 19)]:
            s.px(x, y, C["toxic2"])                          # sludge lumps
        s.px(14 + bubble, 22 - 3 * bubble, C["toxic3"])     # a bubble rising
        for y in range(13, 28):
            s.px(10, y, C["steel3"])                        # lit glass edge
        s.px(12, 14, C["white"]); s.px(12, 15, C["white"])  # glints
        s.rect(9, 9, 22, 11, C["rust2"])                    # the rusty lid
        s.rect(9, 9, 22, 9, C["rust3"])
        s.px(21, 11, C["rust1"]); s.px(22, 10, C["rust1"])
        for x, y in [(22, 13), (22, 14), (23, 15)]:
            s.px(x, y, C["toxic2"])                          # it leaks
        s.px(21, 29, C["toxic1"]); s.px(22, 29, C["toxic2"])
        s.outline(C["ink0"], where="outside")
        return image_to_names(s.composite(1))
    return jar(0), jar(1)


def main():
    out = {
        "item_gull": [gull()],
        "item_fatgull": [fatgull()],
        "item_gullgang": [gullgang()],
        "item_gullboss": [gullboss()],
        "item_gullgod": list(gullgod_frames()),
        "item_golden_egg": list(golden_egg_frames()),
        "item_bin_juice": list(bin_juice_frames()),
    }
    fps = {"item_gullgod": 3, "item_golden_egg": 2, "item_bin_juice": 2}
    for name, frames in out.items():
        save_final(SLUG, name, frames, W, H, fps=fps.get(name, 0), anchor=[16, 31])
    rows = [(n.replace("item_", ""), frames_of(n)) for n in out]
    review("gulls.png", rows, scale=4, title="gull chain + specials: dirt + night0 at 4x, 1x at right")
    pack("items")


if __name__ == "__main__":
    main()
