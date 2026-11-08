"""The county map (docs/V2.md, pillar 3, the map scene): public/art/map.png + .json, review sheet
art-src/review/v2/map.png. Run: python3 pixel-art/map/build.py

map_bg is a 960 x 640 panorama of the County Dump at night, seen from above at an angle. Its
middle 640 x 360 is the stage; the stage's top-left sits at panorama (160, 140), which is the
sprite's anchor (the same convention as the backdrops, pixel-art/backdrop/pano.py), so drawing
it at stage (0, 0) fills any window. Everything below works in STAGE coordinates
(x -160..800, y -140..500).

  stage y 0-36      the night sky and the horizon (hills, the sea, Mount Trashmore's peak)
  stage y 36-120    the far ground: Lot 9's heaps, the marina's bait shack, the mountain
  stage y 120-240   OPEN GROUND for the road of nodes the code draws (no landmarks, no roads)
  stage y 240-360   the near ground: Lot 9's fenced lot, the harbour and pier, the foothills
Three districts left to right: Lot 9 (x < 213) | The Marina (213-426) | Mount Trashmore (> 426).

The landmarks are PixelLab drafts (art-src/dl/map_*.png, see art-src/prompts.md) snapped to the
palette and finished here; the ground, sky, water, lights and the beam are drawn here.
The node badges, the truck and the reward tags are drawn here by hand (map_you from a draft).
"""
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "recipes"))
from v2kit import *  # noqa: E402,F403
from kit import load, crop_alpha, map_draft, classify_generic, components, DL, STEELS, FURS  # noqa: E402

PW, PH = 960, 640
OX, OY = 160, 140
X0, X1, Y0, Y1 = -OX, PW - OX, -OY, PH - OY
HORIZON = 34
BAND = (120, 240)                 # keep clear: the road of nodes
LOT9_X, MARINA_X = 213, 426       # district borders
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def dith(x, y, t):
    return BAYER[y % 4][x % 4] < t * 16


class Pano:
    def __init__(self):
        self.g = [["night0"] * PW for _ in range(PH)]

    def ok(self, x, y):
        return X0 <= x < X1 and Y0 <= y < Y1

    def get(self, x, y):
        return self.g[y + OY][x + OX] if self.ok(x, y) else None

    def set(self, x, y, c):
        if c and self.ok(x, y):
            self.g[y + OY][x + OX] = c

    def stamp(self, names, x0, y0):
        for (x, y), c in names.items():
            self.set(x + x0, y + y0, c)

    def image(self):
        im = Image.new("RGBA", (PW, PH))
        px = im.load()
        for y in range(PH):
            row = self.g[y]
            for x in range(PW):
                px[x, y] = RGB[row[x]] + (255,)
        return im


# ---------------------------------------------------------------- drafts -> palette

def draft(file, greys=STEELS, keep_biggest=False, min_px=30):
    im = crop_alpha(load(DL / file))
    if keep_biggest:
        boxes = components(im, min_px=min_px)
        if boxes:
            # keep every component that touches the biggest one's box (the main cluster)
            big = max(boxes, key=lambda b: b[4])
            px = im.load()
            for (x0, y0, x1, y1, _) in boxes:
                overlap = not (x1 < big[0] - 6 or x0 > big[2] + 6 or y1 < big[1] - 6 or y0 > big[3] + 6)
                if not overlap:
                    for y in range(y0, y1):
                        for x in range(x0, x1):
                            px[x, y] = (0, 0, 0, 0)
            im = crop_alpha(im)
    n = map_draft(im, classify_generic(greys=greys))
    return n


def night(n, amount=1):
    """Pull a draft toward the night: every ramp colour steps one shade down (lights stay)."""
    down = {}
    for ramp in ("steel", "fur", "card", "rust", "grime", "night", "dirt", "sodium", "toxic"):
        names = RAMP.get(ramp, [])
        for i, nm in enumerate(names):
            down[nm] = names[max(0, i - amount)]
    down.update({"white": "steel3", "bone": "fur3", "blue": "night3", "pink": "rust3", "red": "rust2",
                 "hivis": "sodium2", "yellow": "sodium2", "ink2": "ink1"})
    return {k: down.get(v, v) for k, v in n.items()}


# ---------------------------------------------------------------- the panorama

def heap_line(x, seed, base, amp):
    r = random.Random(seed)
    ph = [r.random() * 6.28 for _ in range(4)]
    v = base
    for k, (f, a) in enumerate(((0.011, 1.0), (0.027, 0.55), (0.061, 0.3), (0.13, 0.15))):
        v -= amp * a * (0.5 + 0.5 * math.sin(x * f + ph[k]))
    return round(v)


def district_of(x):
    return 0 if x < LOT9_X else 1 if x < MARINA_X else 2


SHORE = 252                         # the harbour's quay edge (water below), across the marina


def shore_y(x):
    return SHORE + round(2 * math.sin(x * 0.07))


def water_edges(y):
    """The harbour's left and right edges at row y: a bay that opens toward the bottom."""
    t = max(0, y - SHORE)
    return 226 - t * 0.28 - 6 * math.sin(t * 0.05), 424 + t * 0.42 + 5 * math.sin(t * 0.04 + 1)


def in_water(x, y):
    if y <= shore_y(x):
        return False
    lft, rgt = water_edges(y)
    return lft <= x <= rgt


def ground_colour(x, y, h):
    """The ground: hazy and dark at the horizon, the district's dirt nearer. Quiet texture."""
    d = district_of(x)
    t1 = min(1.0, max(0.0, (x - (LOT9_X - 30)) / 60))
    t2 = min(1.0, max(0.0, (x - (MARINA_X - 30)) / 60))
    base = "dirt1"
    if dith(x, y, t2 * 0.9):
        base = "dirt0"
    if y < HORIZON + 14:
        base = "ink2" if not dith(x, y, (y - HORIZON - 5) / 9) else "dirt0"
    elif y < HORIZON + 40 and base == "dirt1":
        base = "dirt0" if not dith(x, y, (y - HORIZON - 14) / 26) else "dirt1"
    if h < 26:
        return "dirt0" if base == "dirt1" else "ink2"
    if h < 34 and y > HORIZON + 20:
        return "dirt2" if base == "dirt1" else "dirt1"
    if d == 1 and h < 46 and y > HORIZON + 20:
        return "steel0"                         # concrete grit near the docks
    if t1 > 0.3 and t2 < 0.5 and h < 40 and y > HORIZON + 20:
        return "steel0"
    return base


def build_bg():
    P = Pano()
    rnd = random.Random(7)

    # --- sky: night0 easing to night1 at the horizon, stars
    for y in range(Y0, HORIZON):
        t = (y - Y0) / (HORIZON - Y0)
        for x in range(X0, X1):
            P.set(x, y, "night1" if dith(x, y, max(0.0, t - 0.6) * 2.2) else "night0")
    for _ in range(420):
        x, y = rnd.randrange(X0, X1), rnd.randrange(Y0, HORIZON - 8)
        P.set(x, y, "bone" if rnd.random() < 0.2 else "night3" if rnd.random() < 0.6 else "night2")
    # the moon, high over Lot 9 (in the top margin)
    mx, my = 120, -60
    for y in range(my - 9, my + 10):
        for x in range(mx - 9, mx + 10):
            d = math.hypot(x - mx, y - my)
            if d <= 8.5:
                dark = math.hypot(x - mx - 4, y - my + 2) <= 7
                P.set(x, y, "night1" if dark else "fur4" if d > 7.5 else "bone")
    for p in [(mx - 5, my - 2), (mx - 4, my + 3), (mx - 6, my + 1)]:
        P.set(*p, "fur3")
    # gulls wheeling over the marina
    for gx, gy in ((300, 8), (318, 3), (352, 12), (276, -20), (380, -8)):
        for dx, dy in ((-2, -1), (-1, 0), (0, 1), (1, 0), (2, -1)):
            P.set(gx + dx, gy + dy, "bone" if dx < 0 else "fur3")

    # --- the far hills along the horizon, with county lights; the sea behind the marina
    for x in range(X0, X1):
        h1 = heap_line(x, 11, HORIZON, 22)
        h2 = heap_line(x, 12, HORIZON + 2, 12)
        if 206 <= x <= 436:
            h1 = HORIZON + 1 - round(2 * math.sin(x * 0.03))
            h2 = HORIZON + 6
        for y in range(h1, HORIZON + 6):
            P.set(x, y, "night1" if y > h1 else "night2")
        for y in range(h2, HORIZON + 6):
            P.set(x, y, "ink2" if y > h2 else "night1")
    for x in range(206, 437):
        for y in range(HORIZON - 1, HORIZON + 6):
            c = "night1"
            if (y + x // 9) % 3 == 0 and dith(x, y, 0.5):
                c = "night2"
            if 290 <= x <= 330 and (x * 7 + y * 3) % 4 == 0:
                c = "night3"                    # the moon's road on the water
            P.set(x, y, c)
    for _ in range(46):
        x = rnd.randrange(X0, X1)
        if 200 <= x <= 442:
            continue
        y = heap_line(x, 12, HORIZON + 2, 12) + rnd.randrange(1, 4)
        P.set(x, y, "sodium2" if rnd.random() < 0.6 else "sodium3")
    # a lighthouse out on the point
    lx = 420
    for y in range(HORIZON - 14, HORIZON + 2):
        w = 1 if y < HORIZON - 8 else 2
        for x in range(lx - w, lx + w + 1):
            P.set(x, y, "bone" if (y // 3) % 2 == 0 else "red")
        P.set(lx - w - 1, y, "ink0"); P.set(lx + w + 1, y, "ink0")
    for x in range(lx - 2, lx + 3):
        P.set(x, HORIZON - 15, "ink0")
    P.set(lx, HORIZON - 16, "sodium3"); P.set(lx - 1, HORIZON - 16, "yellow"); P.set(lx + 1, HORIZON - 16, "yellow")
    P.set(lx, HORIZON - 17, "ink0")

    # --- the ground
    for y in range(HORIZON + 6, Y1):
        for x in range(X0, X1):
            h = (x * 73856093 ^ y * 19349663) & 1023
            P.set(x, y, ground_colour(x, y, h))
    # pebbles and tufts (thinner in the band)
    for _ in range(1400):
        x, y = rnd.randrange(X0, X1), rnd.randrange(HORIZON + 26, Y1)
        if BAND[0] - 4 <= y <= BAND[1] + 4 and rnd.random() < 0.75:
            continue
        if district_of(x) == 2 and rnd.random() < 0.5:
            P.set(x, y, rnd.choice(["rust1", "grime1", "steel0", "card0"]))       # litter
            continue
        if rnd.random() < 0.5:
            P.set(x, y, "dirt2"); P.set(x + 1, y, "dirt2"); P.set(x, y + 1, "dirt0"); P.set(x + 1, y + 1, "dirt0")
        else:
            P.set(x, y, "grime1"); P.set(x + 1, y - 1, "grime1"); P.set(x + 2, y, "grime0")
    # puddles catching the light
    for cx, cy, rx in ((60, 220, 9), (500, 238, 12), (-90, 300, 14), (700, 300, 10), (150, 96, 7)):
        for y in range(cy - 3, cy + 4):
            for x in range(cx - rx, cx + rx + 1):
                if ((x - cx) / rx) ** 2 + ((y - cy) / 3.2) ** 2 <= 1:
                    P.set(x, y, "night1" if (x + y) % 7 else "night2")
        P.set(cx - rx // 2, cy - 1, "night3"); P.set(cx - rx // 2 + 1, cy - 1, "sodium1")

    # --- the quay: a concrete apron along the harbour, then the water
    for y in range(236, SHORE + 3):
        for x in range(214, 438):
            if y <= shore_y(x) and abs(x - 326) < 112 - max(0, 244 - y) * 2:
                c = "steel0"
                if (y - 236) % 8 == 0 or (x + ((y - 236) // 8) * 9) % 18 == 0:
                    c = "ink2"
                P.set(x, y, c)
    for y in range(SHORE - 2, Y1):
        lft, rgt = water_edges(y)
        for x in range(int(lft) - 1, int(rgt) + 2):
            if in_water(x, y):
                c = "night1"
                if (y % 5 == 0 and (x // 6 + y) % 3 == 0) or (x * 5 + y * 11) % 41 == 0:
                    c = "night2"
                if (x * 13 + y * 7) % 97 == 0:
                    c = "night3"
                P.set(x, y, c)
            elif y > SHORE + 1 and (in_water(x + 1, y) or in_water(x - 1, y) or in_water(x, y - 1)):
                P.set(x, y, "ink0")                 # the bank's edge
    for x in range(214, 438):
        if abs(x - 326) < 112:
            sy = shore_y(x)
            P.set(x, sy - 1, "steel1"); P.set(x, sy, "steel0"); P.set(x, sy + 1, "ink0"); P.set(x, sy + 2, "ink1")
    # bollards along the quay
    for x in range(238, 420, 30):
        sy = shore_y(x) - 4
        for dx, dy, c in ((0, 0, "steel2"), (1, 0, "steel1"), (0, 1, "steel1"), (1, 1, "steel0"),
                          (-1, 0, "ink0"), (2, 0, "ink0"), (-1, 1, "ink0"), (2, 1, "ink0"), (0, -1, "ink0"),
                          (1, -1, "ink0"), (0, 2, "ink0"), (1, 2, "ink0")):
            P.set(x + dx, sy + dy, c)
    return P


def light_pool(P, cx, cy, rx, ry, strength=1.0):
    """A dithered pool of streetlight on the ground: the ground lifts a shade or two, warm at the
    core. Outlines and water stay as they are."""
    lift = {"ink2": "dirt0", "dirt0": "dirt1", "dirt1": "dirt2", "dirt2": "dirt3", "steel0": "steel1",
            "grime0": "grime1", "grime1": "grime2"}
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            d = math.hypot((x - cx) / rx, (y - cy) / ry)
            if d >= 1:
                continue
            c = P.get(x, y)
            t = (1 - d) * strength
            if c in lift and dith(x, y, min(1.0, t * 1.3)):
                c2 = lift[c]
                if t > 0.7 and c2 in ("dirt2", "dirt3") and dith(x + 2, y + 1, (t - 0.7) * 2.5):
                    c2 = "sodium0" if c2 == "dirt2" else "sodium1"
                P.set(x, y, c2)


def junk_mound(P, cx, base_y, hw, h, seed):
    """A heap of mini junk (bags, tires, boxes, fridges) like the mountain's, outlined on top."""
    r = random.Random(seed)
    prof = {}
    for x in range(int(cx - hw), int(cx + hw) + 1):
        t = 1 - ((x - cx) / hw) ** 2
        if t <= 0:
            continue
        top = base_y - round(h * math.sqrt(t) * (0.85 + 0.15 * math.sin(x * 0.4 + seed)))
        prof[x] = top
        for y in range(top, base_y + 1):
            P.set(x, y, "ink2")
    parts = [
        ([".Gj.", "GjJj", "Gjjj", ".GG."], 0.4),                  # a bag
        ([".KK.", "K..K", ".KK."], 0.3),                          # a tire
        (["CCC", "Ccd", "ccC"], 0.2),                             # a box
        (["tT", "tl", "tl"], 0.1),                                # a fridge
    ]
    for _ in range(int(hw * h * 0.16)):
        x = r.randrange(int(cx - hw) + 1, int(cx + hw))
        if x not in prof:
            continue
        y = r.randrange(prof[x] + 1, base_y + 1)
        k = r.random()
        acc = 0
        for rows, w in parts:
            acc += w
            if k <= acc:
                for yy, row in enumerate(rows):
                    for xx, ch in enumerate(row):
                        X, Y = x + xx - 1, y + yy - 1
                        if ch != "." and X in prof and prof[X] <= Y <= base_y:
                            P.set(X, Y, KEY[ch])
                break
    for x, top in prof.items():
        P.set(x, top, "ink0")
        if P.get(x, top + 1) == "ink2":
            P.set(x, top + 1, "night2" if x < cx else "ink2")


def outline_names(n):
    return clean_outline(n)


# ---------------------------------------------------------------- landmarks

THRONE_W = 15                     # half-width of the throne at the peak of the mountain draft


def peak_x(n):
    """The throne's centre: the middle of the mountain draft's top rows."""
    y0 = min(y for _, y in n)
    xs = [x for (x, y) in n if y <= y0 + 3]
    return (min(xs) + max(xs)) // 2


def mountain():
    """Mount Trashmore, re-rendered wide and low (A8) so the throne clears the map's top bar."""
    raw = draft("map_trashmore_wide_v4.png", greys=["ink1", "fur1", "fur2", "fur3", "fur4", "bone"])
    x0, y0, x1, y1 = bbox(raw)
    cx = peak_x(raw)
    n = night(raw, 1)
    # the throne: the dark armchair at the peak becomes the King's red velvet one, gold trim, lit
    # by the beam (so it skips the night step)
    m = {"ink1": "rust1", "ink2": "rust2", "fur1": "red", "fur2": "red", "fur3": "pink", "fur4": "pink",
         "steel0": "rust2", "steel1": "red", "steel2": "red", "steel3": "pink", "bone": "yellow",
         "white": "sodium3"}
    for (x, y), c in raw.items():
        if y - y0 < 24 and abs(x - cx) <= THRONE_W:
            n[(x, y)] = m.get(c, c)
    return n


def lot9():
    """Lot 9's fenced lot, re-rendered small (A9) for the top-left; the stray tile goes and the
    streetlight gets back its head and bulb."""
    im = crop_alpha(load(DL / "map_lot9_small_v2.png"))
    n = map_draft(im, classify_generic(greys=STEELS))
    # drop the little stray tile at the bottom-left (everything left of the fence and low down)
    xs = [x for x, _ in n]
    lft = min(xs)
    pole = [(x, y) for (x, y) in n if x <= lft + 2]
    pole_x = round(sum(x for x, _ in pole) / max(1, len(pole)))
    pole_top = min(y for _, y in pole)
    n = {(x, y): c for (x, y), c in n.items() if not (x <= 34 and y >= 62)}
    n = night(n, 1)
    # the lamp: an arm over the lot and a sodium bulb
    for k in range(6):
        n[(pole_x + k, pole_top - 1)] = "steel1"
        n[(pole_x + k, pole_top - 2)] = "ink0"
        n[(pole_x + k, pole_top)] = "ink0" if k else n.get((pole_x, pole_top), "steel1")
    for dx, c in ((4, "sodium3"), (5, "yellow"), (6, "sodium3")):
        n[(pole_x + dx, pole_top + 1)] = c
    n[(pole_x + 3, pole_top + 1)] = "ink0"; n[(pole_x + 7, pole_top + 1)] = "ink0"
    for dx in range(3, 8):
        n[(pole_x + dx, pole_top + 2)] = "ink0" if dx in (3, 7) else n.get((pole_x + dx, pole_top + 2), None) or "ink0"
    n[(pole_x + 5, pole_top + 2)] = "sodium3"
    n[(pole_x + 6, pole_top - 1)] = "steel1"; n[(pole_x + 7, pole_top - 1)] = "ink0"
    return n, (pole_x + 5, pole_top + 2)


def pier():
    n = draft("map_marina_v1.png", greys=STEELS, keep_biggest=True, min_px=40)
    return night(n, 1)


def shack():
    """The bait shack: the draft's grass tile goes, so it stands on the map's own ground."""
    im = crop_alpha(load(DL / "map_shack_v1.png"))
    n = map_draft(im, classify_generic(greys=STEELS))
    green = {"grime0", "grime1", "grime2", "grime3", "toxic0", "toxic1", "toxic2", "toxic3"}
    n = {k: v for k, v in n.items() if v not in green and k[1] <= 68}
    n = drop_orphans(n)
    return night(clean_outline(n), 1)


def build_map_bg():
    P = build_bg()

    # --- Mount Trashmore, top right: the beam first (behind), then the mountain, heaps in front.
    # Its throne sits just under the map scene's top bar (stage y 24), its foot at ~112.
    m = mountain()
    mx0, my0, mx1, my1 = bbox(m)
    px = peak_x(m)
    ox, oy = 532 - px, 27 - my0
    throne_x = ox + px
    top = oy + my0
    for y in range(Y0, top + 12):
        half = 2.5 + (top + 12 - y) * 0.07
        for x in range(int(throne_x - half) - 1, int(throne_x + half) + 2):
            t = 1 - abs(x + 0.5 - throne_x) / max(half, 1)
            if t > 0 and dith(x, y, 0.15 + 0.7 * t):
                P.set(x, y, "sodium3" if t > 0.75 else "sodium2" if t > 0.4 else "sodium1")
    # heaps behind its flanks (so the draft's cut-off sides sink into more trash)
    for k, (cx, hw, h) in enumerate(((ox + mx0 - 4, 30, 34), (ox + mx1 + 10, 44, 50), (ox + mx1 + 70, 60, 60),
                                     (ox + mx1 + 140, 50, 44))):
        junk_mound(P, cx, oy + my1 - 2, hw, h, 30 + k)
    P.stamp(m, ox, oy)
    foot = oy + my1
    for k, (cx, hw, h) in enumerate(((ox + mx0 + 6, 34, 12), (ox + mx0 + 64, 44, 9), (ox + mx0 + 124, 40, 11),
                                     (ox + mx1 + 16, 46, 14), (ox + mx1 + 90, 60, 18), (ox + mx1 + 170, 50, 22))):
        junk_mound(P, cx, foot + 2 + (k % 2), hw, h, 40 + k)
    # far heaps over the left margin, along the horizon
    for k, (cx, hw, h) in enumerate(((-140, 40, 22), (-80, 36, 16), (-20, 44, 20), (190, 30, 12))):
        junk_mound(P, cx, 66 + (k % 3) * 3, hw, h, 60 + k)
    # the county fence behind Lot 9 (the lot stands in front of it)
    for x in range(-160, 206):
        y = 70 + round(1.5 * math.sin(x * 0.05))
        for yy in range(y - 11, y):
            if (x + yy) % 4 == 0 or (x - yy) % 4 == 0:
                P.set(x, yy, "night2")
        if x % 16 == 0:
            for yy in range(y - 12, y + 1):
                P.set(x, yy, "steel1"); P.set(x + 1, yy, "ink0")
            P.set(x, y - 13, "ink0")
        P.set(x, y - 12, "steel2" if x % 2 else "ink0")     # barbed wire along the top

    # --- Lot 9, top left: the fenced lot under its streetlight
    L, bulb = lot9()
    lx0, ly0, lx1, ly1 = bbox(L)
    lox, loy = 26 - lx0, 110 - ly1
    light_pool(P, lox + bulb[0] + 26, loy + bulb[1] + 46, 82, 34, 1.0)
    P.stamp(L, lox, loy)
    junk_mound(P, 176, 112, 22, 12, 72)
    # the near ground of Lot 9 (under the Contraband slots): heaps, a tire stack
    junk_mound(P, 40, 300, 40, 20, 73)
    junk_mound(P, 150, 330, 34, 18, 74)
    junk_mound(P, -70, 330, 40, 22, 81)
    junk_mound(P, -130, 270, 30, 14, 82)
    junk_mound(P, -110, 430, 44, 24, 83)
    junk_mound(P, 40, 470, 50, 26, 84)
    junk_mound(P, 150, 420, 30, 16, 85)
    junk_mound(P, -120, 170, 26, 12, 86)

    # --- the marina's bait shack, up the quay from the harbour, its lamp lit
    K = shack()
    kx0, ky0, kx1, ky1 = bbox(K)
    kox, koy = 268 - kx0, 112 - ky1
    light_pool(P, kox + kx0 + 14, 108, 46, 14, 0.9)
    P.stamp(K, kox, koy)
    for (x, y), c in K.items():
        if c in ("sodium3", "yellow", "sodium2") and y < ky0 + 20:
            P.set(x + kox, y + koy, "sodium3")          # the lamp burns bright

    # --- the harbour: pier and boats, bottom middle; lamps on the quay
    Q = pier()
    qx0, qy0, qx1, qy1 = bbox(Q)
    qox, qoy = 246 - qx0, 254 - qy0
    P.stamp(Q, qox, qoy)
    for x in (262, 396):
        light_pool(P, x, 244, 30, 12, 0.9)
        for y in range(226, 246):
            P.set(x, y, "steel1"); P.set(x - 1, y, "ink0"); P.set(x + 1, y, "ink0")
        for dx, c in ((-2, "ink0"), (-1, "sodium3"), (0, "yellow"), (1, "sodium3"), (2, "ink0")):
            P.set(x + dx, 225, c)
        for dx in range(-2, 3):
            P.set(x + dx, 224, "ink0")
        for k in range(6):                                        # its reflection on the water
            P.set(x + (k % 2), 262 + k * 4, "sodium1")

    # --- the foothills, bottom right: heaps and a toxic puddle
    for k, (cx, by, hw, h) in enumerate(((520, 330, 40, 20), (640, 300, 52, 26), (760, 340, 50, 30),
                                         (600, 400, 60, 30), (720, 440, 70, 36), (480, 440, 40, 18))):
        junk_mound(P, cx, by, hw, h, 90 + k)
    for y in range(352, 368):
        for x in range(530, 590):
            if ((x - 560) / 30) ** 2 + ((y - 360) / 7) ** 2 <= 1:
                P.set(x, y, "toxic1" if ((x - 556) / 22) ** 2 + ((y - 359) / 4) ** 2 <= 1 else "toxic0")
    P.set(548, 357, "toxic3"); P.set(549, 357, "toxic2"); P.set(566, 361, "toxic2")
    return P


# ---------------------------------------------------------------- the small sprites

def cap_badge(r=10, rim=("steel3", "steel2", "steel1"), face=("steel2", "steel1"), crimp=True):
    """A giant bottle cap seen from above: the crimped skirt, the face, lit top-left."""
    n = {}
    cx = cy = r + 1.5
    size = 2 * r + 4
    for y in range(size):
        for x in range(size):
            d = math.hypot(x + 0.5 - cx - 0.5, y + 0.5 - cy - 0.5)
            a = math.atan2(y - cy, x - cx)
            teeth = crimp and int((a + math.pi) / (2 * math.pi) * 22) % 2 == 0
            if d <= r + (1 if teeth else 0):
                lit = (x - cx) + (y - cy) < -r * 0.4
                shade = (x - cx) + (y - cy) > r * 0.5
                if d > r - 2:
                    n[(x, y)] = rim[0] if lit else rim[2] if shade else rim[1]
                else:
                    n[(x, y)] = face[0] if not shade else face[1]
    return n, size


def node_night():
    n, s = cap_badge(9, rim=("steel3", "steel2", "steel1"), face=("night2", "night1"))
    # a crescent moon on the face, and a star
    bmp(n, 7, 6, [".bbb.", "bb...", "b....", "bb...", ".bbb."])
    n[(14, 8)] = "sodium3"
    n[(15, 13)] = "fur4"
    out = clean_outline(n)
    return clip(fit(out, 24, 24, "centre"), 24, 24)


def node_done():
    n, s = cap_badge(9, rim=("sodium3", "yellow", "sodium2"), face=("sodium2", "sodium1"))
    # a fat check mark, stamped
    for p in [(7, 12), (8, 13), (9, 14), (10, 13), (11, 12), (12, 11), (13, 10), (14, 9), (15, 8)]:
        n[p] = "toxic2"
        n[(p[0], p[1] + 1)] = "toxic1"
    n[(7, 11)] = "toxic3"
    out = clean_outline(n)
    return clip(fit(out, 24, 24, "centre"), 24, 24)


def node_locked():
    n, s = cap_badge(9, rim=("fur2", "fur1", "ink2"), face=("ink2", "ink1"))
    bmp(n, 8, 5, [
        "..###..",
        ".#2.2#.",
        ".#2.2#.",
        "#22222#",
        "#21#12#",
        "#22#22#",
        "#11111#",
        ".#####.",
    ])
    out = clean_outline(n)
    return clip(fit(out, 24, 24, "centre"), 24, 24)


def node_boss():
    """The boss badge: a big red cap with Inspector Possum's skull-ish face, crossbones behind."""
    n = {}
    # crossed bones behind the cap
    for i in range(26):
        for (x, y) in ((3 + i, 3 + i), (28 - i, 3 + i)):
            n[(x, y)] = "bone" if i % 6 else "white"
            n[(x + 1, y)] = "fur3"
    for (x, y) in ((2, 2), (3, 2), (2, 3), (29, 2), (28, 2), (29, 3), (2, 29), (3, 29), (2, 28), (29, 29),
                   (28, 29), (29, 28)):
        n[(x, y)] = "bone"
    cap, s = cap_badge(11, rim=("pink", "red", "rust1"), face=("red", "rust2"))
    for (x, y), c in cap.items():
        n[(x + 4, y + 4)] = c
    # the possum skull: a white pointed snout, two hollow eyes, a pink nose
    bmp(n, 8, 8, [
        "....wwwwww......",
        "..wwwwwwwwww....",
        ".wwKKwwwwKKww...",
        ".wwKKwwwwKKww...",
        "..wwwwwwwwwww...",
        "...wwwwwwwww....",
        "....wwwwwww.....",
        ".....bwwwb......",
        "......bwb.......",
        ".......p........",
    ])
    for x in (10, 12, 14, 16):
        n[(x, 15)] = "ink1"
    out = clean_outline(n)
    return clip(fit(out, 32, 32, "centre"), 32, 32)


def you_truck():
    """The crew's beat-up pickup, from the four-up draft (the rusty one), finished by hand."""
    im = load(DL / "map_you_sheet_v1.png")
    boxes = components(im, min_px=40)
    x0, y0, x1, y1, _ = boxes[0]
    n = map_draft(im.crop((x0, y0, x1, y1)), classify_generic(greys=STEELS))
    n = clean_outline(n)
    a = fit(n, 32, 24, "bottom", margin=1)
    b = shift(a, 0, -1)                     # frame 2: a bounce on its springs
    # a puff of exhaust behind it on the bounce
    ax0, ay0, ax1, ay1 = bbox(a)
    for p, c in (((ax0 - 1, ay1 - 2), "fur3"), ((ax0 - 2, ay1 - 3), "fur4"), ((ax0 - 2, ay1 - 2), "fur3")):
        if p not in b:
            b[p] = c
    return clip(a, 32, 24), clip(b, 32, 24)


def tag_frame(fill="card2", lit="card3", dark="card1"):
    """A 14 x 14 paper tag: a rounded square on a string loop at the top-left."""
    n = {}
    for y in range(2, 13):
        for x in range(1, 13):
            if (x in (1, 12) and y in (2, 12)):
                continue
            n[(x, y)] = lit if (x == 2 or y == 3) else dark if (x == 11 or y == 11) else fill
    return n


def tag_loot():
    """+1 Contraband pick: a little sticker with a star, peeled corner."""
    n = {}
    for y in range(1, 13):
        for x in range(1, 13):
            if (x in (1, 12) and y in (1, 12)) or x + y > 21:
                continue
            n[(x, y)] = "yellow" if (x <= 2 or y <= 2) else "sodium2" if (x >= 11 or y >= 11) else "ink2"
    for p in [(10, 11), (11, 10), (11, 11)]:
        n[p] = "bone"
    bmp(n, 4, 3, ["..S..", "..S..", "SSYSS", ".SYS.", ".S.S."])
    return clip(clean_outline(n), 14, 14)


def tag_shop():
    """Swap Meet 25% off: a price tag with a red slash."""
    n = {}
    bmp(n, 1, 2, [
        "...dddddddd",
        "..dDDDDDDDDd",
        ".dDD.DDDRDDd",
        "dDDDDDDDRDDd",
        "dDDDDDDRDDDd",
        ".dDDDDRDDDDd",
        "..dDDRDDDDDd",
        "...ddddddddd",
    ])
    n[(4, 4)] = "ink1"
    return clip(clean_outline(n), 14, 14)


def tag_juice():
    """A Bin Juice: a little jar of green slop."""
    n = {}
    bmp(n, 3, 1, [
        "tTTTt.",
        "ltttl.",
        "TvVvvU",
        "TVvvvU",
        "TvvvUU",
        "TvvUvU",
        "TUvvUU",
        "TUUUUu",
        ".uuuu.",
    ])
    n[(4, 4)] = "white"
    return clip(clean_outline(n), 14, 14)


def tag_elite():
    """Elite: a hot red skull, quota +40%, rare loot."""
    n = {}
    bmp(n, 2, 1, [
        "..hh.h...",
        ".hYhhYh..",
        ".hwwwwwh.",
        "hwwwwwwwh",
        "wwKKwKKww",
        "wwKKwKKww",
        ".wwwKwww.",
        "..wbwbw..",
        "..bwbwb..",
    ])
    return clip(clean_outline(n), 14, 14)


def main():
    P = build_map_bg()
    bg = P.image()
    sprites = []
    sprites.append(("map_bg", [bg], {"w": PW, "h": PH, "fps": 0, "anchor": [OX, OY]}))
    sprites.append(("map_node_boss", [node_boss()], {"w": 32, "h": 32, "fps": 0, "anchor": [16, 16]}))
    for nm, fn in (("map_node_night", node_night), ("map_node_done", node_done), ("map_node_locked", node_locked)):
        sprites.append((nm, [fn()], {"w": 24, "h": 24, "fps": 0, "anchor": [12, 12]}))
    a, b = you_truck()
    sprites.append(("map_you", [a, b], {"w": 32, "h": 24, "fps": 4, "anchor": [16, 23]}))
    for nm, fn in (("map_tag_loot", tag_loot), ("map_tag_shop", tag_shop), ("map_tag_juice", tag_juice),
                   ("map_tag_elite", tag_elite)):
        sprites.append((nm, [fn()], {"w": 14, "h": 14, "fps": 0, "anchor": [7, 7]}))
    pack_family("map", sprites, maxw=960)

    # review sheets: art-src/review/v2/map.png = the whole panorama at 1x (stage in red, the clear
    # band in blue), the stage at 1x with a mock road of nodes, the landmarks at 3x, and the small
    # sprites at 3x and 1x on the dirt (also on their own in map_sprites.png)
    REVIEW_V2.mkdir(parents=True, exist_ok=True)
    smalls = {nm: (frames, meta) for nm, frames, meta in sprites if nm != "map_bg"}

    def img(nm, k=0):
        frames, meta = smalls[nm]
        return to_image(frames[k], meta["w"], meta["h"])

    demo = bg.crop((OX, OY, OX + 640, OY + 360))
    d = ImageDraw.Draw(demo)
    pts = [(40, 180), (110, 150), (110, 210), (180, 180), (260, 150), (260, 210), (330, 180), (400, 150),
           (400, 210), (470, 180), (560, 180)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for k in range(0, 100, 8):
            t = k / 100
            d.rectangle([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, x0 + (x1 - x0) * t + 1, y0 + (y1 - y0) * t + 1],
                        fill=RGB["bone"])
    for i, (x, y) in enumerate(pts):
        nm = "map_node_done" if i < 3 else "map_node_boss" if i == len(pts) - 1 else \
            "map_node_locked" if i > 7 else "map_node_night"
        f = img(nm)
        demo.alpha_composite(f, (x - f.width // 2, y - f.height // 2))
    tr = img("map_you")
    demo.alpha_composite(tr, (110 - 16, 150 - 26))
    for k, nm in enumerate(("map_tag_loot", "map_tag_shop", "map_tag_juice", "map_tag_elite")):
        x, y = pts[4 + k]
        demo.alpha_composite(img(nm), (x + 8, y - 18))
    demo.save(REVIEW_V2 / "map_stage_1x.png")

    rows = [(nm, [to_image(f, meta["w"], meta["h"]) for f in frames]) for nm, (frames, meta) in smalls.items()]
    review_v2("map_sprites.png", rows, scale=3, cols=3, title="map sprites: 3x then 1x on the dirt")
    spr = Image.open(REVIEW_V2 / "map_sprites.png")

    crops = [(OX + 0, OY + 236, 220, 124), (OX + 236, OY + 36, 200, 80), (OX + 236, OY + 240, 200, 120),
             (OX + 440, OY - 4, 200, 132)]
    crop_imgs = [bg.crop((x, y, x + w, y + h)).resize((w * 3, h * 3), Image.NEAREST) for x, y, w, h in crops]
    W = 960 + 8
    blocks = [bg, demo, spr] + crop_imgs
    H = sum(b.height + 8 for b in blocks) + 8
    sheet = Image.new("RGBA", (max(W, max(b.width for b in blocks) + 8), H), (34, 30, 40, 255))
    y = 4
    d2 = ImageDraw.Draw(sheet)
    for i, b in enumerate(blocks):
        sheet.alpha_composite(b, (4, y))
        if i == 0:
            d2.rectangle([4 + OX, y + OY, 4 + OX + 639, y + OY + 359], outline=(255, 80, 80))
            d2.rectangle([4 + OX, y + OY + BAND[0], 4 + OX + 639, y + OY + BAND[1]], outline=(120, 200, 255))
        y += b.height + 8
    sheet.save(REVIEW_V2 / "map.png")
    print("review -> art-src/review/v2/map.png (+ map_stage_1x.png, map_sprites.png)")


if __name__ == "__main__":
    main()
