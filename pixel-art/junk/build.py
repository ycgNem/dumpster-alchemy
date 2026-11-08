"""The junk chain, tiers 1-12 (item_cart, tier 8, is the style anchor in pixel-art/anchor).
Run: python3 pixel-art/junk/build.py

Inputs (never edited), art-src/dl/junk_*.png: PixelLab drafts (see art-src/prompts.md).
The cap, the crushed can and the tire are drawn here by hand.
Sizes grow up the chain: cap ~11 px ... the car and the Trash King fill the cell.
Light: the sodium streetlight, top-left. Outline: 1 px ink0. Every pixel on the palette.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "anchor"))
from kit import *  # noqa: E402,F403

SLUG = "junk"
OUT = Path(__file__).resolve().parent / "out"
W = H = 32


def cell_pick(file, index):
    """The index-th sprite (left to right) of a four-up draft sheet."""
    im = load(DL / file)
    boxes = components(im, min_px=40)
    x0, y0, x1, y1, _ = boxes[index]
    return im.crop((x0, y0, x1, y1))


def finish(names, dx=0, dy=0):
    n = clean_outline(drop_orphans(names))
    return fit(n, W, H, "bottom", margin=1, dx=dx, dy=dy)


def lit_rim(n, mapping, depth=1):
    """The streetlight rim: the first interior pixel down the top-left edges steps up one shade."""
    for (x, y), name in list(n.items()):
        if name == "ink0":
            continue
        if n.get((x - 1, y)) == "ink0" or n.get((x, y - 1)) == "ink0":
            if name in mapping:
                n[(x, y)] = mapping[name]


# ---------------------------------------------------------------- tier 1: bottle cap (hand)

def cap():
    """M7 (critic P2-10): a size up (13 x 10 drawn) and a 1 px light rim on the top-left, so the
    smallest tier still reads at 1x on both dirt cells."""
    s = new_sprite(W, H)
    # side band (crimped skirt), then the flat top face seen at a slant
    for x in range(9, 22):
        for y in range(23, 29):
            s.px(x, y, C["rust2"])
    for x in range(9, 22, 2):                      # crimp teeth along the bottom
        s.px(x, 29, C["rust1"])
    for x in range(10, 21, 2):                     # the crimp ridges down the band
        for y in (27, 28):
            s.px(x, y, C["rust1"])
    s.ellipse(9, 20, 21, 25, C["red"])
    for x, y in [(17, 24), (18, 24), (19, 23), (19, 24), (16, 25), (17, 25), (18, 25)]:
        s.px(x, y, C["rust2"])                     # the dent, in shade
    for x, y in [(13, 21), (14, 21)]:
        s.px(x, y, C["sodium3"])                   # a glint
    s.outline(C["ink0"], where="outside")
    n = image_to_names(s.composite(1))
    lit_rim(n, {"red": "pink", "rust2": "rust3", "rust1": "rust3"})
    for p in [(12, 20), (13, 20), (11, 21)]:       # the brightest arc, where the streetlight hits
        if n.get(p) == "pink":
            n[p] = "sodium3"
    return n


# ---------------------------------------------------------------- tier 2: crushed can (hand)

def can():
    """Stepped on: squashed into an accordion, leaning, lid still on."""
    s = new_sprite(W, H)
    rows = [(20, 11, 20), (21, 10, 21), (22, 12, 20), (23, 9, 21), (24, 11, 20), (25, 10, 22),
            (26, 11, 21), (27, 10, 21), (28, 11, 20)]
    for y, x0, x1 in rows:
        for x in range(x0, x1 + 1):
            s.px(x, y, C["blue"])
        s.px(x1, y, C["night2"]); s.px(x1 - 1, y, C["night3"])
        s.px(x0, y, C["steel3"] if y < 25 else C["blue"])
    for y in (22, 24, 26):                           # the folds, in shade
        for x in range(12, 20):
            s.px(x, y, C["night2"])
    for x in range(12, 20):
        s.px(x, 19, C["steel3"])                     # lid
    for x in range(11, 21):
        s.px(x, 20, C["steel2"])                     # rim
    s.px(13, 18, C["steel2"]); s.px(14, 18, C["steel2"]); s.px(15, 18, C["steel1"])  # pull tab
    for x in range(11, 21):
        s.px(x, 28, C["steel1"])                     # bottom rim
    for x in range(13, 17):
        s.px(x, 25, C["bone"])                       # the label stripe
    s.px(12, 21, C["white"]); s.px(10, 23, C["white"]); s.px(13, 23, C["white"])   # lit edges
    s.outline(C["ink0"], where="outside")
    n = image_to_names(s.composite(1))
    # M7 (critic P2-10): a 1 px light rim down the top-left, so it reads at 1x on the dirt
    lit_rim(n, {"blue": "white", "night2": "steel3", "night3": "steel3", "steel3": "white",
                "steel2": "steel3", "steel1": "steel2", "bone": "white"})
    return n


# ---------------------------------------------------------------- tier 7: bald tire (hand)

def tire():
    s = new_sprite(W, H)
    cx, cy = 15, 17
    s.circle(cx, cy, 12, C["ink1"], fill=True)
    s.circle(cx, cy, 11, C["fur1"], fill=True)
    s.circle(cx, cy, 10, C["fur1"], fill=True)
    # tread blocks, worn away on the bald top
    import math
    for k in range(28):
        a = k / 28 * 2 * math.pi
        x = round(cx + 11 * math.cos(a)); y = round(cy + 11 * math.sin(a))
        if math.sin(a) > -0.3 and k % 2 == 0:
            s.px(x, y, C["ink1"])
    # sidewall shading: lit top-left arc, shade bottom-right
    s.circle(cx - 1, cy - 1, 8, C["fur2"], fill=False)
    s.circle(cx - 1, cy - 1, 9, C["fur2"], fill=False)
    for x, y in [(8, 9), (9, 8), (10, 7), (7, 10), (11, 7)]:
        s.px(x, y, C["fur3"])
    s.px(9, 9, C["sodium3"]); s.px(8, 10, C["fur4"])
    s.circle(cx + 1, cy + 1, 9, C["ink1"], fill=False)
    # the rusty rim, then the hole
    s.circle(cx, cy, 6, C["rust2"], fill=True)
    s.circle(cx, cy, 5, C["rust1"], fill=False)
    for x, y in [(11, 13), (12, 12), (13, 12)]:
        s.px(x, y, C["rust3"])
    s.circle(cx, cy, 3, None, fill=True)
    for x, y in [(15, 13), (15, 21), (11, 17), (19, 17)]:
        s.px(x, y, C["steel2"])                     # lug nuts
    # a flat spot where it sits
    for x in range(10, 21):
        s.px(x, 29, None)
    for x in range(9, 22):
        if s.get(x, 28):
            s.px(x, 28, C["ink1"])
    s.outline(C["ink0"], where="outside")
    return image_to_names(s.composite(1))


# ---------------------------------------------------------------- drafts

def takeout():
    """An oyster-pail takeout box (kraft cardboard), flaps open, wire handle, a fork in it."""
    s = new_sprite(W, H)
    for y in range(17, 29):                          # the pail: wide at the top
        t_ = (y - 17) / 11
        x0, x1 = round(9 + 2 * t_), round(22 - 2 * t_)
        for x in range(x0, x1 + 1):
            s.px(x, y, C["card2"])
        s.px(x0, y, C["card3"]); s.px(x0 + 1, y, C["card3"])
        s.px(x1, y, C["card0"]); s.px(x1 - 1, y, C["card1"])
    for x in range(9, 23):
        s.px(x, 17, C["card3"])                      # the lit top fold
    s.polygon([(9, 17), (10, 13), (13, 16)], C["card3"])       # left flap, lit
    s.polygon([(22, 17), (21, 12), (18, 16)], C["card1"])      # right flap, in shade
    s.line(21, 12, 22, 17, C["card0"])
    for x, y in [(11, 16), (12, 14), (14, 12), (16, 11), (18, 12), (20, 14)]:
        s.px(x, y, C["steel2"])                      # the wire handle
    s.px(16, 11, C["steel3"])
    for x, y in [(15, 15), (15, 14), (15, 13), (14, 12), (16, 12), (14, 11), (16, 10)]:
        s.px(x, y, C["white"])                       # the plastic fork, tines up
    s.px(15, 16, C["bone"])
    for x, y in [(15, 21), (16, 21), (15, 22), (16, 22), (14, 23), (17, 23)]:
        s.px(x, y, C["red"])                         # the red pagoda stamp
    s.px(15, 20, C["red"])
    for x, y in [(12, 27), (13, 28), (19, 26)]:
        s.px(x, y, C["card1"])                       # grease stains
    s.outline(C["ink0"], where="outside")
    return image_to_names(s.composite(1))


def bag():
    im = crop_alpha(load(DL / "junk_bag_v1.png"))
    w, h = im.size
    def cls(x, y, hsv_, p):
        h_, s, v = hsv_
        if v < 0.2:
            # the draft's face: eyes and mouth inside the body become bag shade, edges stay ink
            return "ink0"
        if s > 0.4 and 15 < h_ < 50:
            return "toxic1" if v > 0.6 else "grime1"   # the leaking drips
        return by_value(["grime0", "grime1", "grime2", "grime3"], v, [0.3, 0.45, 0.68])
    n = map_draft(im, cls)
    # remove the face: interior ink pixels (not on the silhouette edge) -> grime1 / grime2
    for (x, y), name in list(n.items()):
        if name == "ink0":
            nb = [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
            if all(q in n for q in nb) and y > 6:
                n[(x, y)] = "grime1" if y > h * 0.62 else "grime2"
    # base from grime2 (STYLE): lift one step everywhere, sheen top-left
    step(n, lambda x, y: True, {"grime0": "grime1", "grime1": "grime2", "grime2": "grime3"})
    n = finish(n)
    xs = [x for x, _ in n]; ys = [y for _, y in n]
    x0, y0 = min(xs), min(ys)
    for p in [(x0 + 5, y0 + 9), (x0 + 6, y0 + 9), (x0 + 5, y0 + 10)]:
        if n.get(p) not in (None, "ink0"):
            n[p] = "bone"
    return n


def bag_frames():
    a = bag()
    b = dict(a)
    # frame 2: a drip of bin juice runs off the bottom-right
    xs = [x for x, _ in a]; ys = [y for _, y in a]
    x1, y1 = max(xs), max(ys)
    for p in [(x1 - 2, y1 - 1)]:
        b[p] = "toxic2"
    return a, b


def simple(file, greys=FURS, overrides=None, dx=0, dy=0, sheet_index=None):
    im = cell_pick(file, sheet_index) if sheet_index is not None else crop_alpha(load(DL / file))
    n = map_draft(im, classify_generic(greys=greys, overrides=overrides))
    return finish(n, dx, dy)


def boot():
    n = simple("junk_boot_v1.png")
    return n


def toaster_frames():
    n = simple("junk_toaster_v1.png", greys=STEELS)
    b = dict(n)
    # frame 2: a spark off the cord side
    xs = [x for x, _ in n]; ys = [y for _, y in n]
    x1, y0 = max(xs), min(ys)
    sx, sy = x1 + 1, y0 + 8
    for p, c in [((sx, sy), "sodium3"), ((sx + 1, sy - 1), "yellow"), ((sx + 1, sy + 1), "white")]:
        if 0 <= p[0] < W:
            b[p] = c
    return n, b


def mattress():
    im = cell_pick("junk_mattress_sheet_v1.png", 2)
    def cls(x, y, hsv_, p):
        h, s, v = hsv_
        if v < 0.12:
            return "ink0"
        if s < 0.12:
            return by_value(STEELS, v)               # the springs
        return by_value(["ink1", "fur1", "fur2", "fur3", "fur4", "bone"], v, [0.22, 0.34, 0.48, 0.62, 0.76])
    n = finish(map_draft(im, cls))
    for (x, y), name in list(n.items()):             # ticking stripes along the folds
        if (x - y // 2) % 4 == 0 and name in ("fur4", "bone"):
            n[(x, y)] = "blue"
        elif (x - y // 2) % 4 == 0 and name in ("fur2", "fur3"):
            n[(x, y)] = "night3"
    xs = [x for x, _ in n]; ys = [y for _, y in n]
    cx, cy = (min(xs) + max(xs)) // 2 - 2, min(ys) + 5
    for p_ in [(cx, cy), (cx + 1, cy), (cx - 1, cy + 1), (cx, cy + 1), (cx + 1, cy + 1), (cx + 2, cy + 1), (cx, cy + 2), (cx + 1, cy + 2)]:
        if n.get(p_) not in (None, "ink0"):
            n[p_] = "sodium1"                        # we don't talk about the stain
    setpx(n, [(cx, cy + 1)], "sodium0")
    return n


def fridge_frames():
    n = simple("junk_fridge_sheet_v1.png", greys=["ink1", "steel0", "steel1", "steel2", "steel3", "bone", "white"], sheet_index=0)
    # something alive in the crisper: two toxic eyes low in the open fridge
    xs = [x for x, _ in n]; ys = [y for _, y in n]
    x0, y1 = min(xs), max(ys)
    eyes = [(x0 + 5, y1 - 5), (x0 + 7, y1 - 5)]
    a = dict(n)
    setpx(a, eyes, "toxic3")
    b = dict(n)
    setpx(b, eyes, "toxic0")                        # it blinks
    return a, b


def car():
    over = [(lambda x, y, h, s, v: h < 50 and s > 0.3, ["rust0", "rust1", "rust2", "rust3", "sodium2"])]
    n = simple("junk_car_v2.png", greys=STEELS, overrides=over)
    # a bald tire strapped to the roof: the car fills the cell, and it's sillier
    roof = {}
    for x in range(7, 21):
        for y in range(4, 10):
            if ((x - 13.5) / 7) ** 2 + ((y - 6.5) / 3) ** 2 <= 1:
                roof[(x, y)] = "fur1"
    for x in range(8, 20):
        if (x, 4) in roof or (x, 5) in roof:
            roof[(x, min(y for (xx, y) in roof if xx == x))] = "fur2"      # lit top of the tread
    for x in range(11, 17):
        roof[(x, 6)] = "ink1"; roof[(x, 7)] = "ink1"                        # the hole, seen flat
    roof[(9, 5)] = "fur3"; roof[(10, 5)] = "sodium3"
    for y in range(4, 11):
        roof[(17, y)] = "card2"                                             # the strap
    roof[(17, 4)] = "card3"
    n = {k: v for k, v in n.items() if not (k[1] <= 10 and v == "ink0")}
    n.update(roof)
    return clean_outline(n)


def king_frames():
    im = cell_pick("junk_king_sheet_v1.png", 0)
    n = map_draft(im, classify_generic())
    # drop the draft's grey dome hat (rows 0-6 between the ears and the raised arm)
    for (x, y) in list(n):
        if y <= 6 and x <= 16:
            del n[(x, y)]
    setpx(n, [(x, 6) for x in range(5, 17)], "ink0")             # the head's top line
    # the throne is a mattress: bone ticking, blue stripes
    for (x, y), name in list(n.items()):
        if y >= 18 and name not in ("ink0",):
            lv = {"ink1": "fur2", "ink2": "fur2", "fur1": "fur3", "steel1": "fur3", "fur2": "fur4",
                  "steel2": "fur4", "fur3": "bone", "steel3": "bone", "fur4": "bone", "bone": "bone", "white": "white"}
            if name in lv:
                n[(x, y)] = "blue" if x % 3 == 0 and lv[name] in ("bone", "fur4") else lv[name]
    # the hubcap crown: a silver disc tilted on the head, slots, a hub, gold points
    crown = {}
    cx, cy = 11, 3
    for dx in range(-6, 7):
        for dy in range(-2, 3):
            if dx * dx / 42 + dy * dy / 6.5 <= 1:
                crown[(cx + dx, cy + dy)] = "steel2"
    for dx in range(-5, 6):
        crown[(cx + dx, cy - 2)] = "steel3"              # lit rim
    for dx in (-4, -1, 2, 5):
        crown[(cx + dx, cy + 1)] = "steel1"              # slots
    crown[(cx, cy)] = "ink1"; crown[(cx - 1, cy)] = "steel3"     # the hub
    crown[(cx - 4, cy - 1)] = "sodium3"
    for dx in (-5, 0, 5):
        crown[(cx + dx, cy - 3)] = "yellow"             # crown points
        crown[(cx + dx, cy - 4)] = "sodium3"
    n = {k: v for k, v in n.items()}
    n = shift_names(n, 0, 2)
    n.update(shift_names(crown, 0, 2))
    a = finish(n)
    # the royal cape (red, lit on the left) flaring past the throne
    for y in range(13, 25):
        flare = 1 if y > 20 else 0
        for x, c in ((5 - flare, "pink" if y < 16 else "red"), (4 - flare, "red"),
                     (25 + flare, "rust2"), (26 + flare, "rust1")):
            if a.get((x, y)) in (None, "ink0"):
                a[(x, y)] = c
    # a plunger scepter in the raised hand
    for k, (x, y) in enumerate([(26, 10), (26, 9), (26, 8), (27, 7), (27, 6), (27, 5), (28, 4)]):
        a[(x, y)] = "card3" if k % 2 else "card2"
    for x in range(26, 31):
        a[(x, 2)] = "red"; a[(x, 3)] = "rust2"
    for x in range(27, 30):
        a[(x, 1)] = "red"
    a[(27, 1)] = "pink"; a[(26, 2)] = "pink"
    a = clean_outline({k: v for k, v in a.items() if not (v == "ink0" and k[0] >= 22 and k[1] <= 11)})
    a = {k: v for k, v in a.items() if 0 <= k[0] < W and 0 <= k[1] < H}
    b = dict(a)
    for p_ in [(3, 9), (24, 4), (2, 18)]:
        b[p_] = "sodium3"                                   # a golden shimmer
    xs = [x for x, (_, y) in zip([k[0] for k in a], a) if True]
    top = min(y for (_, y) in a)
    left = min(x for (x, y) in a if y == top + 1)
    b[(left + 1, top + 1)] = "white"                     # a royal glint that comes and goes
    return a, b


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    out = {}
    out["item_cap"] = [cap()]
    out["item_can"] = [can()]
    out["item_takeout"] = [takeout()]
    out["item_bag"] = list(bag_frames())
    out["item_boot"] = [boot()]
    out["item_toaster"] = list(toaster_frames())
    out["item_tire"] = [tire()]
    out["item_mattress"] = [mattress()]
    out["item_fridge"] = list(fridge_frames())
    out["item_car"] = [car()]
    out["item_king"] = list(king_frames())
    fps = {"item_bag": 2, "item_toaster": 3, "item_fridge": 1, "item_king": 2}
    for name, frames in out.items():
        save_final(SLUG, name, frames, W, H, fps=fps.get(name, 0) if len(frames) > 1 else 0, anchor=[16, 31])
    order = ["item_cap", "item_can", "item_takeout", "item_bag", "item_boot", "item_toaster", "item_tire",
             "item_cart", "item_mattress", "item_fridge", "item_car", "item_king"]
    rows = [(n.replace("item_", f"{i + 1}. "), frames_of(n)) for i, n in enumerate(order)]
    review("junk.png", rows, scale=3, title="junk chain 1-12: dirt + night0 at 3x, 1x at right")
    # the whole chain at 1x and 2x on the board, in tier order, plus silhouettes
    chain = Image.new("RGBA", (12 * 32, 32), (0, 0, 0, 0))
    sil = Image.new("RGBA", (12 * 32, 32), RGB["bone"] + (255,))
    for i, n in enumerate(order):
        f = frames_of(n)[0]
        chain.alpha_composite(f, (i * 32, 0))
        m = Image.new("RGBA", f.size, RGB["ink1"] + (255,))
        sil.paste(m, (i * 32, 0), f)
    board = board_bg(12 * 32, 32)
    board.alpha_composite(chain)
    sheet = Image.new("RGBA", (12 * 32 * 2 + 8, 32 * 3 + 32 * 2 + 16), (34, 30, 40, 255))
    sheet.alpha_composite(board, (4, 4))
    sheet.alpha_composite(sil, (4, 40))
    sheet.alpha_composite(board.resize((board.width * 2, 64), Image.NEAREST), (4, 76))
    sheet.save(REVIEW / "junk_chain.png")
    pack("items")


if __name__ == "__main__":
    main()
