"""The 20 recipe results (docs/V2.md, pillar 1): public/art/recipes.png + .json, review sheet
art-src/review/v2/recipes.png. Run: python3 pixel-art/recipes/build.py

Every result is 32 x 32 like the junk (anchor [16, 31], the bottom-centre foot, ~28 px drawn,
1 px ink0 outline, the sodium streetlight from the top-left) and says what went into it: most are
built here from the finished junk sprites (base(...)) with the other ingredient drawn on by hand.
Two frames each:
  - tools carry the shared green brew bubble at the top-right (tool_cue), bobbing;
  - treasures carry a sodium glint on their top-left (treasure_glint), flashing.
Every pixel is a palette name, so every pixel snaps to src/data/palette.ts.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from v2kit import *  # noqa: E402,F403

SLUG = "recipes"
W = H = 32

# the V2 recipe table, in order: id -> kind
RECIPES = [
    ("chime", "treasure"), ("stew", "tool"), ("bagbomb", "tool"), ("burrito", "treasure"),
    ("piggyboot", "treasure"), ("bootcoffee", "tool"), ("elecsoup", "tool"), ("magnet", "tool"),
    ("forkgull", "tool"), ("chum", "tool"), ("tirefire", "tool"), ("blanket", "tool"),
    ("leftovers", "tool"), ("truckshoe", "treasure"), ("rotisserie", "treasure"), ("gokart", "treasure"),
    ("getaway", "treasure"), ("shopbed", "treasure"), ("panicroom", "treasure"), ("icecream", "treasure"),
]

MINI_CAP = [
    ".#####.",
    "#pRRRq#",
    "#RRRRq#",
    "#qQqQq#",
    ".#####.",
]
MINI_CAP_FLAT = [          # lying flat, seen from above at an angle
    ".#####.",
    "#pRRRR#",
    "#RRRRq#",
    ".#####.",
]
MINI_CAN = [
    ".###.",
    "#TTt#",
    "#wBm#",
    "#wbm#",
    "#wBm#",
    "#BBm#",
    "#ttl#",
    ".###.",
]


def fin(n, bottom=True, dx=0):
    """Outline, then sit the sprite on the cell's foot like the junk (bottom row 30)."""
    n = clean_outline(n)
    if bottom:
        n = fit(n, W, H, "bottom", margin=1, dx=dx)
    return clip(n, W, H)


def flame(n, cx, top, base_y, hw, colors=("red", "hivis", "yellow", "sodium3")):
    """One tongue of fire: widest at the base, a point at the top, banded from the outside in."""
    for y in range(top, base_y + 1):
        t = (y - top) / max(1, base_y - top)
        w = hw * (t ** 0.55)
        for x in range(int(cx - w - 1), int(cx + w + 2)):
            d = abs(x + 0.5 - cx - 0.5) / max(w, 0.01) if w > 0 else 2
            if d > 1.0:
                continue
            band = 0 if d > 0.72 else 1 if d > 0.45 else 2 if d > 0.2 else 3
            if t < 0.25:
                band = min(band, 1)              # the tips stay orange-red
            n[(x, y)] = colors[band]


def tire_disc(n, cx, cy, r):
    """A small knobby tire seen side-on: ink knobs, fur1 rubber, a lit arc, a rusty hub."""
    for y in range(int(cy - r - 2), int(cy + r + 3)):
        for x in range(int(cx - r - 2), int(cx + r + 3)):
            d = math.hypot(x - cx, y - cy)
            a = math.atan2(y - cy, x - cx)
            if d <= r:
                n[(x, y)] = "fur1"
            elif d <= r + 1 and int((a + math.pi) / (2 * math.pi) * 14) % 2 == 0:
                n[(x, y)] = "ink1"               # the knobs
    for y in range(int(cy - r), int(cy + r + 1)):
        for x in range(int(cx - r), int(cx + r + 1)):
            d = math.hypot(x - cx, y - cy)
            if r - 1.6 < d <= r - 0.6 and (x - cx) + (y - cy) < -1:
                n[(x, y)] = "fur2"               # the lit shoulder, top-left
            if d <= r * 0.48:
                n[(x, y)] = "rust2"
            if d <= r * 0.48 and (x - cx) + (y - cy) < -0.5:
                n[(x, y)] = "rust3"
            if d < 0.9:
                n[(x, y)] = "ink1"


# ---------------------------------------------------------------- 1. Hobo Wind Chime (cap + can)

def chime():
    n = {}
    # the string it hangs from, a V to the stick
    line(n, 16, 1, 6, 7, "ink1")
    line(n, 16, 1, 25, 7, "ink1")
    # a crooked stick
    for x in range(3, 29):
        y = 8 + (1 if 11 < x < 20 else 0)
        n[(x, y)] = "card2" if x % 5 else "card1"
        n[(x, y + 1)] = "card1" if x % 7 else "card0"
    n[(3, 8)] = "card3"; n[(4, 8)] = "card3"; n[(28, 9)] = "card0"
    # the strings and what clinks on them
    for x, y0, y1 in ((6, 10, 13), (12, 11, 18), (19, 11, 16), (25, 10, 11)):
        line(n, x, y0, x, y1, "ink1")
    bmp(n, 3, 14, MINI_CAP)
    bmp(n, 10, 19, MINI_CAN)
    bmp(n, 16, 17, MINI_CAP)
    bmp(n, 23, 12, MINI_CAN)
    # a fork as the clapper, dangling in the middle
    line(n, 16, 23, 16, 26, "ink1")
    bmp(n, 15, 27, ["T.T", "TTT", ".t."])
    return fin(n), (5, 7)


# ---------------------------------------------------------------- 2. Mystery Stew (can + takeout)

def stew():
    n = base("item_takeout")
    erase(n, lambda x, y: y < 17)
    mound = {}
    ell(mound, 15.5, 16.5, 7.2, 4.2, "grime1")
    ell(mound, 14.5, 15.5, 5.5, 2.6, "grime2")
    for p in [(11, 15), (12, 14), (13, 14)]:
        mound[p] = "grime3"
    for p, c in [((17, 15), "sodium1"), ((18, 14), "sodium2"), ((12, 16), "sodium1"),
                 ((20, 16), "rust2"), ((15, 13), "bone"), ((16, 13), "grime3")]:
        mound[p] = c
    # a bubble about to pop
    for p in [(10, 13), (11, 12), (12, 13), (11, 14)]:
        mound[p] = "grime3"
    mound[(11, 13)] = "grime1"
    for p, c in mound.items():
        if p[1] < 17:
            n[p] = c
    # the can, dunked, leaning out of the stew
    bmp(n, 18, 8, [
        ".###.",
        "#TTt#",
        "#wBm#",
        "#wbm#",
        "#wBm#",
    ])
    n[(17, 11)] = "ink0"
    # a fish bone poking out
    bmp(n, 8, 9, ["b.b..", ".bbbb", "b.b.."])
    # a drip over the rim
    n[(9, 17)] = "grime1"; n[(9, 18)] = "grime1"; n[(9, 19)] = "grime2"
    out = fin(n)
    for p in [(14, 11), (13, 10), (14, 9), (13, 8), (14, 7)]:
        if p not in out:
            out[p] = "fur4" if p[1] > 8 else "fur3"
    return out


# ---------------------------------------------------------------- 3. Bag Bomb (cap + bag)

def bagbomb(frame=0):
    n = base("item_bag")
    # bottle caps jammed into the bag like spikes
    bmp(n, 5, 20, MINI_CAP)
    bmp(n, 20, 23, MINI_CAP)
    # duct tape wrapped round it in a cross
    for i in range(12):
        for (x, y) in ((9 + i, 19 + (i * 9) // 11), (21 - i, 19 + (i * 9) // 11)):
            if (x, y) in n and n[(x, y)] != "ink0" or 10 <= x <= 21:
                n[(x, y)] = "steel3" if i % 4 else "bone"
                n[(x, y + 1)] = "steel2"
    # a fuse out of the knot
    for p in [(15, 10), (15, 9), (14, 8), (14, 7), (13, 6), (12, 5)]:
        n[p] = "bone"
    n[(15, 10)] = "card2"; n[(14, 7)] = "card2"
    out = fin(n)
    # the lit end fizzes (frame 2: bigger)
    if frame == 0:
        bmp(out, 10, 2, [".Y.", "YwS", ".h."])
    else:
        bmp(out, 9, 1, ["h...h", ".YSY.", ".SwS.", ".YSh.", "h...."])
    return out


# ---------------------------------------------------------------- 4. Garbage Burrito (takeout + bag)

def burrito():
    n = {}
    # the body: a fat roll of bin bag, lying a little tilted
    for x in range(5, 25):
        yc = 21 - (x - 5) * 0.18
        ell(n, x, yc, 0.6, 6.2, "grime2")
    ell(n, 5.5, 21.4, 3.2, 5.6, "grime2")
    # light along the top, shade along the bottom
    for (x, y), c in list(n.items()):
        yc = 21 - (x - 5) * 0.18
        if y < yc - 3.8:
            n[(x, y)] = "grime3"
        elif y > yc + 3.6:
            n[(x, y)] = "grime1"
    # the wrap folds, diagonal
    for k, x0 in enumerate((8, 14, 20)):
        for i in range(10):
            p = (x0 + i // 3, 16 + i - (x0 - 5) // 6)
            if p in n:
                n[p] = "grime1" if i > 2 else "grime2"
    # the twisted end (left): a knot like a sweet wrapper
    poly(n, [(0, 16), (5, 19), (5, 23), (0, 26)], "grime2")
    for p in [(0, 16), (1, 17), (0, 17)]:
        n[p] = "grime3"
    line(n, 1, 25, 4, 23, "grime1")
    # the open end (right): the takeout spilling out
    ell(n, 25.5, 17.6, 3.2, 6.0, "grime1")
    ell(n, 26.0, 17.6, 2.4, 5.0, "card1")
    for p in [(26, 13), (25, 14), (26, 15), (27, 16), (25, 17), (26, 18), (27, 19), (25, 20), (26, 21)]:
        n[p] = "bone"                           # noodles
    for p in [(24, 16), (27, 14), (26, 20), (27, 21)]:
        n[p] = "red"                            # sauce
    n[(25, 19)] = "toxic1"                      # something green
    # the fork sticking out of the end
    bmp(n, 27, 8, ["T.T", "TTT", ".T.", ".t.", ".t."])
    # a drip of bin juice
    n[(14, 28)] = "toxic1"; n[(14, 27)] = "grime1"
    return fin(n), (8, 15)


# ---------------------------------------------------------------- 5. Piggy Boot (cap + boot)

def gold(rows):
    return [r.translate(str.maketrans("pRqQ", "SYso")) for r in rows]


def piggyboot():
    n = base("item_boot")
    recolor(n, {"card3": "pink", "card2": "pink", "card1": "red", "card0": "rust1"})
    lit_rim(n, {"pink": "bone", "red": "pink"})
    # caps piled over the top of the shaft like change, more spilling out
    bmp(n, 6, 10, gold(MINI_CAP_FLAT))
    bmp(n, 11, 8, gold(MINI_CAP))
    bmp(n, 13, 11, gold(MINI_CAP_FLAT))
    # the snout on the toe and an ear on the shaft
    bmp(n, 20, 21, [
        ".#####.",
        "#bpppp#",
        "#pQpQp#",
        "#ppppR#",
        ".#####.",
    ])
    bmp(n, 16, 16, ["#.", "p#", "pp#"])
    n[(16, 16)] = "ink0"
    # a curly tail off the heel
    bmp(n, 3, 21, [".pp", "p..", ".p.", "..p"])
    # a cap rolling away
    bmp(n, 24, 26, MINI_CAP_FLAT)
    out = fin(n)
    return out, (8, 11)


# ---------------------------------------------------------------- 6. Boot Coffee (can + boot)

def bootcoffee(frame=0):
    n = base("item_boot")
    # coffee to the brim in the shaft
    for x in range(9, 17):
        n[(x, 14)] = "sodium0"
        n[(x, 15)] = "card0"
    for p in [(10, 14), (11, 14), (12, 14)]:
        n[p] = "card1"                             # the light on the coffee
    n[(15, 14)] = "card2"
    # a pull loop at the back for a mug handle
    bmp(n, 3, 15, [
        ".###.",
        "#ddd#",
        "#d.#.",
        "#d#..",
        "#d#..",
        "#dd#.",
        ".##..",
    ])
    # a can as the sugar scoop, dunked
    bmp(n, 14, 9, [".###", "#TTt", "#wBm", "#wBm", "#wbm"])
    out = fin(n)
    # steam, unoutlined so it reads as steam
    wisps = [[(10, 12), (9, 11), (10, 10), (11, 9), (10, 8), (9, 7)], [(13, 12), (12, 11), (13, 10), (12, 9)]]
    for k, w in enumerate(wisps):
        for i, (x, y) in enumerate(w):
            x2 = x + (1 if (frame + i + k) % 3 == 0 else 0)
            if (x2, y) not in out:
                out[(x2, y)] = "fur4" if i < 3 else "fur3"
    return out


# ---------------------------------------------------------------- 7. Electric Soup (bag + toaster)

def elecsoup(frame=0):
    n = base("item_toaster")
    erase(n, lambda x, y: y < 20 and 10 <= x <= 22)      # the toast goes
    # green bin-juice soup boiling up out of the slots
    blob = {}
    ell(blob, 16, 17, 6.5, 4.0, "toxic1")
    ell(blob, 15, 16, 4.6, 2.6, "toxic2")
    for p in [(13, 14), (14, 14), (12, 15)]:
        blob[p] = "toxic3"
    for p in [(19, 15), (18, 18), (13, 18)]:
        blob[p] = "toxic0"
    for p, c in blob.items():
        if p[1] <= 20:
            n[p] = c
    # drips down the sides
    for x, y1 in ((10, 24), (20, 26), (14, 22)):
        for y in range(20, y1):
            n[(x, y)] = "toxic1"
        n[(x, y1)] = "toxic2"
    out = fin(n)
    # zaps: yellow bolts with an ink edge (outlined by hand so they stay thin)
    bolts = [
        (2, 10, ["..#.", ".#Y#", "#YY#", ".#Y#", "..#Y#", "...#"]),
        (24, 15, [".#..", "#Y#.", "#YY#", ".#Y#", "..#."]),
    ]
    if frame == 1:
        bolts = [(3, 12, [".#..", "#Y#.", "#YY#", ".#Y#", "..#."]),
                 (24, 12, ["..#.", ".#Y#", "#YY#", ".#Y#", "..#Y#", "...#"])]
    for x0, y0, rows in bolts:
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != "." and (x0 + x, y0 + y) not in out:
                    out[(x0 + x, y0 + y)] = KEY[ch]
    return out


# ---------------------------------------------------------------- 8. Junk Magnet (can + toaster)

def magnet():
    n = {}
    # a big red horseshoe, opening down
    for y in range(6, 27):
        for x in range(5, 27):
            d = math.hypot((x - 15.5) / 10.5, (y - 15.5) / 9.5) if y < 15.5 else None
            if y < 15.5:
                if 0.48 <= d <= 1.0:
                    n[(x, y)] = "red"
            elif 5 <= x <= 9 or 22 <= x <= 26:
                n[(x, y)] = "red"
    # light on the left of each arm and the top of the arch, shade on the right
    for (x, y), c in list(n.items()):
        if (x, y - 1) not in n or (x - 1, y) not in n:
            n[(x, y)] = "pink"
        elif (x + 1, y) not in n or (x, y + 1) not in n:
            n[(x, y)] = "rust1"
    for x in range(6, 9):
        n[(x, 15)] = "rust2"
    # the steel pole tips
    for y in range(23, 27):
        for x in list(range(5, 10)) + list(range(22, 27)):
            n[(x, y)] = "steel3" if x in (5, 22) else "steel2" if x in (6, 7, 23, 24) else "steel1"
    for x in list(range(5, 10)) + list(range(22, 27)):
        n[(x, 22)] = "ink1"
    # the toaster's cord, plugged into the top of the arch
    for p in [(15, 5), (14, 4), (13, 3), (12, 3), (11, 4), (10, 5), (9, 5), (8, 4)]:
        n[p] = "ink1"
    bmp(n, 5, 1, ["TTt", "Ttl", "#.#"])
    # a crushed can flying up to it
    bmp(n, 13, 22, MINI_CAN[:6] + [".###."])
    out = fin(n)
    for p in [(12, 30), (12, 29), (18, 30), (18, 29)]:
        if p not in out:
            out[p] = "steel3"                    # zip lines under the can
    return out


# ---------------------------------------------------------------- 9. Gull With A Fork (gull + takeout)

def forkgull():
    n = base("item_gull")
    n = shift(n, 2, 0)
    # a napkin bib, red check
    bmp(n, 19, 19, ["wRw", "RwR", "wRw", ".R."])
    # a big steel fork held like a trident, behind the tail
    fork = {}
    for y in range(4, 8):
        for x in (2, 4, 6):
            fork[(x, y)] = "steel3"
    for x in range(2, 7):
        fork[(x, 8)] = "steel3"
    fork[(3, 9)] = "steel2"; fork[(4, 9)] = "steel3"; fork[(5, 9)] = "steel2"
    for y in range(10, 30):
        fork[(4, y)] = "steel2" if y % 4 else "steel3"
    for p, c in fork.items():
        if p not in n:
            n[p] = c
    # the wing tip wrapped round the shaft
    bmp(n, 5, 21, ["tt", "ll"])
    # hungry: a drool drop off the beak
    n[(25, 18)] = "blue"
    return fin(n, bottom=False)


# ---------------------------------------------------------------- 10. Chum Bucket (fatgull + bag)

def chum():
    n = {}
    # the bucket: a steel pail, wider at the top
    for y in range(14, 30):
        t = (y - 14) / 15
        x0, x1 = round(6 + 2 * t), round(25 - 2 * t)
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1, x1 - x0)
            n[(x, y)] = "steel3" if u < 0.18 else "steel2" if u < 0.62 else "steel1" if u < 0.88 else "steel0"
    for y in (17, 26):
        for x in range(6, 26):
            if (x, y) in n:
                n[(x, y)] = "steel1" if n[(x, y)] != "steel0" else "steel0"
    # a red CHUM band
    for y in (20, 21, 22):
        for x in range(6, 26):
            if (x, y) in n:
                n[(x, y)] = "red" if n[(x, y)] in ("steel3", "steel2") else "rust1"
    for x in (11, 15, 19):
        n[(x, 21)] = "bone"
    # the rim, and the slop heaped over it
    for x in range(6, 26):
        n[(x, 13)] = "steel3" if x < 14 else "steel2"
    slop = {}
    ell(slop, 15.5, 12.0, 9.0, 4.0, "rust1")
    ell(slop, 14.5, 11.0, 7.0, 2.8, "rust2")
    for p in [(10, 10), (11, 9), (16, 9), (19, 11), (13, 12)]:
        slop[p] = "pink"
    for p in [(12, 11), (18, 10), (21, 12), (9, 12)]:
        slop[p] = "grime2"
    for p in [(14, 9), (20, 13)]:
        slop[p] = "bone"
    for p, c in slop.items():
        if p[1] <= 13:
            n[p] = c
    # a fish tail out of the left, a gull feather out of the right
    bmp(n, 6, 3, ["B...B", "BB.BB", ".BBB.", "..m..", "..m.."])
    for p in [(7, 8), (8, 8), (9, 8)]:
        n[p] = "night2"
    for y in range(3, 10):
        n[(19 + (1 if y < 6 else 0), y)] = "white"
        n[(18 + (1 if y < 6 else 0), y)] = "bone" if y > 3 else "white"
    out = fin(n)
    return out


# ---------------------------------------------------------------- 11. Tire Fire (tire + takeout)

def tirefire(frame=0):
    n = {}
    cx, top_y, bot_y = 16, 22, 26
    # the cylinder: side wall first, then the top face
    for y in range(top_y - 6, bot_y + 6):
        for x in range(2, 31):
            in_top = ((x - cx) / 12.5) ** 2 + ((y - top_y) / 4.6) ** 2 <= 1
            in_bot = ((x - cx) / 12.5) ** 2 + ((y - bot_y) / 4.6) ** 2 <= 1
            if in_bot or (top_y <= y <= bot_y and abs(x - cx) <= 12.5):
                n[(x, y)] = "ink1" if (x + y // 2) % 3 == 0 else "fur1"
            if in_top:
                n[(x, y)] = "fur2"
    for (x, y), c in list(n.items()):
        if c == "fur2" and ((x - cx) / 12.5) ** 2 + ((y - top_y + 1) / 4.6) ** 2 > 1 and x < cx:
            n[(x, y)] = "fur3"                  # the lit back rim
    # the hole, glowing
    ell(n, cx, top_y, 6.2, 2.2, "sodium1")
    ell(n, cx, top_y - 0.5, 4.5, 1.2, "yellow")
    # the fire
    jit = 0 if frame == 0 else 1
    flame(n, cx, 2 + jit, 22, 5.6)
    flame(n, 10.5, 9 - jit, 22, 3.4)
    flame(n, 21.5, 7 + jit, 22, 3.6)
    # the front rim in front of the fire
    for y in range(top_y, top_y + 5):
        for x in range(2, 31):
            if ((x - cx) / 12.5) ** 2 + ((y - top_y) / 4.6) ** 2 <= 1 and \
                    ((x - cx) / 6.2) ** 2 + ((y - top_y) / 2.2) ** 2 > 1:
                n[(x, y)] = "fur2"
    for x in range(4, 29, 3):
        if (x, 31) in n:
            del n[(x, 31)]
    return fin(n)


# ---------------------------------------------------------------- 12. Electric Blanket (mattress + toaster)

def blanket(frame=0):
    n = base("item_mattress")
    # the ticking becomes a pink quilt, the stripes become glowing heating wires
    recolor(n, {"white": "white", "bone": "blue", "fur4": "blue", "fur3": "night3", "fur2": "night2",
                "fur1": "night1", "blue": "sodium2", "night3": "sodium1", "night2": "sodium0"})
    lit_rim(n, {"blue": "white", "night3": "blue", "night2": "night3"})
    # the cord out of the top, and its plug
    for p in [(10, 9), (9, 8), (8, 7), (7, 7), (6, 6), (5, 5)]:
        n[p] = "ink1"
    bmp(n, 2, 1, ["#.#", "ttl", "TTt", "Tt#"])
    out = fin(n, bottom=False)
    # heat shimmer over it
    waves = [(17, 9), (18, 8), (17, 7), (18, 6), (21, 10), (22, 9), (21, 8), (22, 7)]
    for i, (x, y) in enumerate(waves):
        p = (x + (1 if frame else 0) * (1 if i % 2 else -1), y - frame)
        if p not in out:
            out[p] = "sodium2" if i % 4 < 2 else "sodium3"
    return out


# ---------------------------------------------------------------- 13. Leftovers (fridge + takeout)

def leftovers():
    n = base("item_takeout")
    erase(n, lambda x, y: y < 17)
    # cling film stretched over the top in a dome, the food squashed under it
    dome = {}
    ell(dome, 15.5, 17.0, 7.0, 5.0, "steel3")
    ell(dome, 15.5, 17.5, 5.8, 3.8, "sodium1")
    for p in [(12, 15), (13, 14), (16, 14), (18, 15), (14, 16)]:
        dome[p] = "bone"
    for p in [(17, 16), (19, 16), (11, 16)]:
        dome[p] = "toxic1"
    for p in [(11, 14), (12, 13), (13, 13)]:
        dome[p] = "white"                          # the glare on the film
    for p, c in dome.items():
        if p[1] < 17:
            n[p] = c
    # frost on the rim, icicles
    for x in range(9, 23):
        n[(x, 17)] = "white" if x % 3 else "blue"
    for p in [(10, 18), (13, 18), (13, 19), (19, 18), (21, 18), (21, 19)]:
        n[p] = "white"
    # a sticky note: MINE (a scribble)
    bmp(n, 11, 21, [
        "YYYYYY",
        "Y####Y",
        "YYYYYY",
        "Y###YY",
        "YYYYYs",
    ])
    n[(16, 21)] = "red"                              # a fridge magnet holding it
    out = fin(n)
    # a snowflake glint of cold off the side
    bmp(out, 5, 13, [".b.", "bwb", ".b."])
    return out


# ---------------------------------------------------------------- 14. Monster Truck Shoe (boot + tire)

def truckshoe():
    n = shift(base("item_boot"), 1, -8)
    # a tire laid flat as the sole: a fat tread slab with knobs, whitewall lettering
    sole = {}
    for y in range(21, 30):
        for x in range(3, 29):
            r = 4
            cxl, cxr = 3 + r, 28 - r
            if x < cxl and math.hypot(x - cxl, (y - 25) * 1.0) > r + 0.4:
                continue
            if x > cxr and math.hypot(x - cxr, (y - 25) * 1.0) > r + 0.4:
                continue
            sole[(x, y)] = "fur1"
    for (x, y) in list(sole):
        if y == 21 or (x - 1, y) not in sole and y < 25:
            sole[(x, y)] = "fur2"
        if y >= 28:
            sole[(x, y)] = "ink1"
    for x in range(5, 27, 3):                     # the tread blocks
        for y in (26, 27):
            if (x, y) in sole:
                sole[(x, y)] = "ink1"
                sole[(x + 1, y + 1)] = "ink1"
    for x in range(8, 24):                        # a whitewall stripe
        if x % 4 != 3:
            sole[(x, 23)] = "bone"
    sole[(5, 22)] = "fur3"; sole[(6, 22)] = "fur3"
    for x in range(4, 28, 3):                     # knobs on the ground
        sole[(x, 30)] = "ink1"
    n.update(sole)
    return fin(n), (9, 6)


# ---------------------------------------------------------------- 15. Rotisserie Gull (fatgull + toaster)

def rotisserie():
    n = base("item_toaster")
    erase(n, lambda x, y: y < 20 and 10 <= x <= 22)
    n = shift(n, 1, 0)
    # the roast: a plump golden bird, legs up, jammed in the toaster slot
    roast = {}
    ell(roast, 15.0, 15.0, 8.0, 5.6, "sodium1")
    ell(roast, 14.0, 14.0, 6.4, 4.2, "sodium2")
    ell(roast, 12.5, 12.6, 3.2, 1.8, "sodium3")
    for x in range(9, 22, 3):                     # grill marks
        for k in range(3):
            if (x + k, 17 - k) in roast:
                roast[(x + k, 17 - k)] = "rust1"
    for (x, y) in list(roast):
        if y >= 19:
            roast[(x, y)] = "sodium0"
    # two drumsticks up, paper frills on the ends
    for (x0, y0) in ((10, 9), (19, 8)):
        for k in range(4):
            roast[(x0 + (k // 2) * (1 if x0 > 15 else -1), y0 - k)] = "sodium1" if k else "sodium2"
            roast[(x0 + 1 + (k // 2) * (1 if x0 > 15 else -1), y0 - k)] = "sodium0"
    bmp(roast, 7, 3, ["w.w", "www", "bwb"])
    bmp(roast, 20, 2, ["w.w", "www", "bwb"])
    # the gull's head flopped over the side: white, a yellow beak, an X eye
    bmp(roast, 21, 12, [
        ".www.",
        "wwwbb",
        "w#.#hh",
        "ww#whhY",
        "w#.#bY.",
        ".bbb..",
    ])
    roast[(23, 14)] = "white"
    for p, c in roast.items():
        n[p] = c
    # the spit through it, with a crank
    for x in range(3, 30):
        if (x, 15) not in roast or x in (3, 4, 5, 26, 27, 28, 29):
            n[(x, 15)] = "steel3" if x < 8 else "steel2"
    bmp(n, 1, 15, ["t", "t", "tt"])
    return fin(n), (8, 11)


# ---------------------------------------------------------------- the cart family (16-18)

def cart_empty():
    """The cart with its bag taken out: the basket's inside goes dark between the bars."""
    n = base("item_cart")
    erase(n, lambda x, y: y < 9 and x >= 8)
    recolor(n, {"grime0": "ink2", "grime1": "ink2", "grime2": "ink2", "grime3": "ink2"},
            lambda x, y: 8 <= x <= 28 and 10 <= y <= 18)
    return n


def gokart():
    n = cart_empty()
    erase(n, lambda x, y: y >= 26)                  # the little wheels go
    # dragster tires: a fat one at the back, a small one at the front
    tire_disc(n, 11.0, 24.5, 5.4)
    tire_disc(n, 25.0, 27.0, 3.2)
    # hot-rod flames down the basket, licking backwards
    bmp(n, 9, 12, [
        "...........hhh",
        "......hhh.hhYYh",
        "..hhhhhYYhhYYYh",
        "hhhYYYYYYYYYYYh",
        ".hhhhhhhhhhhhhh",
    ])
    # a hi-vis stripe along the top rail
    for x in range(9, 29):
        if n.get((x, 10)) not in (None, "ink0"):
            n[(x, 10)] = "hivis"
    # the chequered flag up front
    for y in range(1, 10):
        n[(27, y)] = "steel2"
    bmp(n, 28, 1, ["#w#", "w#w", "#w#"])
    out = fin(n)
    # the exhaust: a puff of flame out of the back
    bmp(out, 1, 19, ["..h", ".hY", "hYw", ".hY", "..h"])
    return out, (4, 3)


def getaway():
    n = cart_empty()
    # a sack of loot in the back
    bmp(n, 8, 2, [
        "..#.#..",
        "...#...",
        ".#ddd#.",
        "#dDdddC#",
        "#DdYYdC#",
        "#dYddCC#",
        "#ddYYCC#",
        "#dYYdCc#",
    ])
    # the Gull Boss riding up front in a robber's mask, the cart's front rail in front of him
    head = bmp({}, 12, 0, [
        ".....#####.........",
        "....#wwwwwb#.......",
        "...#wwwwwwwb#......",
        "..#KKKKKKKKKK#.....",
        "##KKKKKKKwwKKK#....",
        "#K#KKKKKKw#KKKw##..",
        "...#wwwwwwwwwwYYY##",
        "...#wwwwwwwwwsYRYY#",
        "...#bwwwwwwww#####.",
        "...#tbwwwwwwb#.....",
        "..#tttbwwwwww#.....",
        ".#ttttbbwwwww#.....",
    ])
    for p, c in head.items():
        if p[1] < 9 or p not in n:
            n[p] = c
    bmp(n, 25, 8, ["#tt#", "#Ttl#"])                    # a wing gripping the rail
    out = fin(n)
    # speed lines out the back
    for y, x0, x1 in ((12, 0, 5), (16, 1, 6), (20, 0, 5)):
        for x in range(x0, x1):
            if (x, y) not in out:
                out[(x, y)] = "bone"
    return out, (10, 3)


def shopbed():
    n = cart_empty()
    # a mattress laid across the basket, overhanging
    for y in range(4, 10):
        for x in range(7, 30):
            n[(x, y)] = "bone" if y < 7 else "fur3" if y < 9 else "fur2"
    for x in range(7, 30, 3):
        for y in range(4, 10):
            n[(x, y)] = "blue" if y < 7 else "night3"
    for x in range(7, 30):
        n[(x, 4)] = "white" if x < 18 else "bone"
    # a pillow at the head end, a pink blanket thrown over the foot end
    bmp(n, 20, 0, [
        ".#######.",
        "#wwwwwwb#",
        "#wbwwwwb#",
        "#bbbbbbf#",
    ])
    for x in range(7, 19):
        for y in range(3, 9 + (2 if x % 4 in (1, 2) else 1)):
            n[(x, y)] = "pink" if y < 5 else "red" if y < 9 else "rust2"
    for x in range(7, 19):
        n[(x, 3)] = "pink"
    n[(8, 3)] = "white"; n[(9, 3)] = "bone"
    out = fin(n)
    return out, (9, 2)


# ---------------------------------------------------------------- 19. Panic Room (mattress + fridge)

def panicroom():
    n = base("item_fridge")
    # padded walls: the inside becomes mattress ticking, quilted
    for y in range(7, 27):
        for x in range(11, 23):
            if (x, y) in n:
                c = "bone" if (x + y) % 6 else "fur3"
                if (x - 11) % 4 == 0:
                    c = "blue" if y < 17 else "night3"
                if y > 18:
                    c = {"bone": "fur4", "fur3": "fur2", "blue": "night3", "night3": "night2"}[c]
                n[(x, y)] = c
    for y in range(9, 26, 4):
        for x in range(13, 22, 4):
            n[(x, y)] = "fur2"                         # quilting buttons
    # someone in there: two eyes in the dark gap at the bottom
    for x in range(12, 22):
        n[(x, 25)] = "ink1"; n[(x, 26)] = "ink1"
    for p in [(15, 25), (18, 25)]:
        n[p] = "white"
    # chains across, a big padlock
    for i in range(0, 17):
        x, y = 8 + i, 10 + (i * 11) // 16
        n[(x, y)] = "steel3" if i % 2 else "steel1"
        x2, y2 = 8 + i, 21 - (i * 11) // 16
        n[(x2, y2)] = "steel3" if i % 2 else "steel1"
    bmp(n, 13, 13, [
        "..###..",
        ".#t.t#.",
        ".#t.t#.",
        "#YYYYY#",
        "#SY#YY#",
        "#YY#Ys#",
        "#Ysssh#",
        ".#####.",
    ])
    return fin(n), (7, 4)


# ---------------------------------------------------------------- 20. Ice Cream Truck (car + fridge)

def icecream():
    n = base("item_car")
    erase(n, lambda x, y: y <= 10)
    n = shift(n, 0, 1)
    # a little fridge strapped upright on the roof: freezer door on top
    bmp(n, 7, 0, [
        "##########",
        "#wwwwwwwb#",
        "#wbbbbbbt#",
        "#wbbbbblt#",
        "#tttttttl#",
        "#wbbbbblt#",
        "#wbbbbblt#",
        "#bbbbbbbt#",
        "#bbbbbbtl#",
        "#tttttttl#",
        "##########",
    ])
    for x in range(5, 19):
        n[(x, 6)] = "card2" if x % 2 else "card1"         # the strap round it
    n[(5, 7)] = "card1"; n[(5, 8)] = "card1"; n[(18, 7)] = "card1"; n[(18, 8)] = "card1"
    # a giant cone on top: the sign
    bmp(n, 20, 0, [
        ".####.",
        "#ppwp#",
        "#pppp#",
        "#RpRp#",
        "#dDdC#",
        ".#dC#.",
        ".#dC#.",
        "..#C#.",
        "..#c#.",
    ])
    return fin(n), (6, 5)


# ---------------------------------------------------------------- build

def frames_for(rid, kind):
    """Two frames per recipe: tools bob their bubble, treasures flash their glint."""
    fn = globals()[rid]
    if kind == "tool":
        try:
            a, b = fn(0), fn(1)
        except TypeError:
            a = b = fn()
        return [tool_cue(a, 0), tool_cue(b, 1)]
    n, (gx, gy) = fn()
    return [treasure_glint(n, 0, gx, gy), treasure_glint(n, 1, gx, gy)]


def main():
    entries, rows = [], []
    for i, (rid, kind) in enumerate(RECIPES):
        frames = [clip(f, W, H) for f in frames_for(rid, kind)]
        entries.append((f"item_{rid}", frames, {"w": W, "h": H, "fps": 2, "anchor": [16, 31]}))
        rows.append((f"{i + 1}. {rid} ({kind})", [names_to_image(f, W, H) for f in frames]))
        save_final(SLUG, f"item_{rid}", frames, W, H, fps=2, anchor=[16, 31])
    pack_family("recipes", entries)
    review_v2("recipes.png", rows, scale=3, cols=4,
              title="recipes: 20 results, tools bubble (top-right), treasures glint; 3x then 1x on the dirt")


if __name__ == "__main__":
    main()
