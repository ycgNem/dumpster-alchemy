"""The Marina at night: across the bay a far shore with a few lit windows, a lighthouse on the
breakwater throwing its beam, two fishing boats moored at the quay (PixelLab draft, finished
here), pilings with gulls on them, a quay crane on the right, and a harbour lantern on the left
where Lot 9 has its cobra-head (same light, same pool). The truck lane is a plank wharf road;
the ground under the board is the same calm dark dirt. In the margins: the bay goes on, the
wharf crosses the water on pilings at the left, crates, traps and buoys pile up on the right.
"""
import math
import random
from pathlib import Path

from pano import (LANE_Y0, LANE_Y1, LAMP, POLE_X, SKY_H, SW, X0, X1, Y1, Pano, crate, dith, drum,
                  ellipse_mask, far_gull, ground, gull_sitting, heap_line, lamp_cone, light_pool,
                  on_stage, poly_mask, puddle, rect_mask, ruts, shade_mask, sky, stamp)

ROOT = Path(__file__).resolve().parents[2]
WATER_Y = 34          # the far shore meets the water
QUAY_Y = 52           # the quay's top edge (the lane starts at 56)
LH_X, LH_BASE = 470, 41   # the lighthouse's centre and foot (in the gap between the HUD's night bar and its clock)


def shore(x):
    return heap_line(x, 7, 33, 9)


# ---------------------------------------------------------------- the boats (PixelLab draft #41)

def boat_maps():
    """The two boats of art-src/dl/backdrop_marina_boats_v1.png as names-maps, night colours.
    The draft's white wheelhouse windows become lit windows."""
    import sys
    sys.path.insert(0, str(ROOT / "pixel-art" / "anchor"))
    from kit import components, hsv, load
    im = load(ROOT / "art-src" / "dl" / "backdrop_marina_boats_v1.png")
    px = im.load()
    out = []
    for (x0, y0, x1, y1, _) in components(im):
        m = {}
        for y in range(y0, y1):
            for x in range(x0, x1):
                c = px[x, y]
                if c[3] < 128:
                    continue
                h, s, v = hsv(c)
                lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255
                if v < 0.13:
                    n = "ink0"
                elif v > 0.9 and s < 0.12:
                    n = "sodium3"                                   # a lit window
                elif s > 0.3 and (h < 25 or h > 330):
                    n = "rust1" if lum > 0.3 else "rust0"
                elif s > 0.25 and h < 60:
                    n = "card0" if lum < 0.45 else "card1"
                elif lum < 0.22:
                    n = "ink1"
                elif lum < 0.38:
                    n = "ink2"
                elif lum < 0.55:
                    n = "night1"
                elif lum < 0.72:
                    n = "night2"
                else:
                    n = "night3"
                m[(x - x0, y - y0)] = n
        out.append(m)
    return out


def boat(p, m, x, waterline, flip=False, sink=34):
    """Paint a boat with draft row `sink` on the waterline; what's below is under water."""
    w = max(xx for xx, _ in m) + 1
    for (bx, by), n in m.items():
        if by > sink + 1:
            continue
        X = x + (w - 1 - bx if flip else bx)
        p.set(X, waterline - sink + by, n)
    # its reflection, broken up
    for (bx, by), n in m.items():
        if sink - 8 <= by <= sink and n not in ("ink0",):
            X = x + (w - 1 - bx if flip else bx)
            Y = waterline + (sink - by) + 2
            if Y < QUAY_Y and dith(X, Y, 0.45) and p.get(X, Y) in ("night0", "night1"):
                p.set(X, Y, "night2" if n not in ("sodium3",) else "sodium1")


# ---------------------------------------------------------------- the landmarks

def lighthouse(p):
    cx, foot = LH_X, LH_BASE
    top = 14
    for y in range(top, foot):
        k = (y - top) / (foot - top)
        half = 3 + round(k * 2.4)
        band = ((y - top) // 5) % 2 == 0
        for x in range(cx - half, cx + half + 1):
            edge = x in (cx - half, cx + half)
            if edge:
                c = "ink0"
            elif band:
                c = "rust1" if x > cx - half + 1 else "rust2"
            else:
                c = "night3" if x > cx - half + 1 else "bone"
            if not edge and x >= cx + half - 1:
                c = "rust0" if band else "night2"
            p.set(x, y, c)
    p.set(cx - 1, foot - 6, "ink0"); p.set(cx - 1, foot - 5, "ink0")                # the door
    p.set(cx + 1, 24, "sodium1")                                                 # a lit slit window
    # the gallery, the lamp room, the cap
    p.hline(cx - 5, cx + 6, top - 1, "ink0")
    p.hline(cx - 5, cx + 6, top - 2, "steel1")
    for x in range(cx - 5, cx + 6, 2):
        p.set(x, top - 3, "ink0")
    p.hline(cx - 5, cx + 6, top - 4, "ink0")
    for y in range(top - 9, top - 4):
        for x in range(cx - 3, cx + 4):
            p.set(x, y, "ink0" if x in (cx - 3, cx + 3) else ("white" if abs(x - cx) <= 1 else "sodium3"))
    for y, half in ((top - 10, 3), (top - 11, 2), (top - 12, 1)):
        p.hline(cx - half, cx + half + 1, y, "ink0")
    p.set(cx, top - 13, "ink0")
    # the beam: a long dithered wedge up and to the left, into the sky above the stage
    ly = top - 7
    for x in range(cx - 4, X0 - 1, -1):
        d = cx - x
        mid = ly - d * 0.42
        half = 1.5 + d * 0.11
        fade = max(0.0, 1 - d / 520)
        for y in range(math.floor(mid - half), math.ceil(mid + half) + 1):
            c = p.get(x, y)
            if c not in ("night0", "night1", "night2"):
                continue
            core = abs(y - mid) < half * 0.35
            if dith(x, y, (0.42 if core else 0.2) * fade):
                p.set(x, y, "sodium1" if core and d < 60 else "sodium0")
    # the halo round the lamp
    for (x, y) in ellipse_mask(cx, ly, 7, 5):
        if p.get(x, y) in ("night0", "night1") and dith(x, y, 0.5):
            p.set(x, y, "sodium0")


def breakwater(p, rnd):
    """Rocks at the lighthouse's foot: a short breakwater running out from the left."""
    x0, x1 = LH_X - 70, LH_X + 18
    for x in range(x0, x1):
        top = LH_BASE - 2 + round(2 * math.sin(x * 0.3) + 1.5 * math.sin(x * 0.11))
        if x < LH_X - 22:
            top += 3 + (LH_X - 22 - x) // 24
        for y in range(top, LH_BASE + 4):
            p.set(x, y, "ink2" if y > top else "night1")
    for _ in range(60):
        x, y = rnd.randrange(x0, x1), rnd.randrange(LH_BASE - 3, LH_BASE + 3)
        if p.get(x, y) == "ink2":
            p.set(x, y, "night1" if rnd.random() < 0.7 else "ink1")


def crane(p, x0=562):
    """A quay crane on the right: an A-frame gantry on the quay, the cab, a lattice boom up and
    to the left (its tip in the sky above the stage, a red light on it), the hook hanging."""
    body, lit, dark = "rust1", "rust2", "rust0"
    feet = QUAY_Y + 1
    deck = 30
    for (fx, tx) in ((x0, x0 + 18), (x0 + 50, x0 + 34)):          # two A-frame legs
        p.line(fx, feet, tx, deck, body)
        p.line(fx + 1, feet, tx + 1, deck, dark)
        p.line(fx + 6, feet, tx + 2, deck + 6, dark)
    for y in range(deck + 6, feet, 7):
        p.line(x0 + 4, y, x0 + 46, y, "ink2")
    for fx in (x0 - 1, x0 + 47):                                  # bogies
        p.rect(fx, feet - 1, 6, 3, "ink0")
        p.set(fx + 1, feet - 1, "steel1"); p.set(fx + 4, feet - 1, "steel1")
    deck_m = rect_mask(x0 + 8, deck, 36, 3)
    shade_mask(p, deck_m, body, lit=lit, shade=dark)
    cab = rect_mask(x0 + 22, deck - 11, 20, 11)
    shade_mask(p, cab, body, lit=lit, shade=dark)
    p.rect(x0 + 34, deck - 8, 5, 4, "sodium2")                    # the operator's lit window
    p.set(x0 + 35, deck - 8, "sodium3")
    p.hline(x0 + 24, x0 + 32, deck - 6, dark)
    p.set(x0 + 40, deck - 12, "ink0"); p.set(x0 + 40, deck - 13, "red")    # a warning light
    # the boom: two chords from the cab up-left, a zigzag between
    bx0, by0 = x0 + 24, deck - 8
    bx1, by1 = x0 - 64, -58
    p.line(bx0, by0 - 1, bx1, by1 - 1, "ink0")
    p.line(bx0, by0, bx1, by1, lit)
    p.line(bx0, by0 + 3, bx1, by1 + 2, body)
    p.line(bx0, by0 + 4, bx1, by1 + 3, "ink0")
    n = 22
    for k in range(n):
        a = k / n
        b = (k + 1) / n
        xa, ya = bx0 + (bx1 - bx0) * a, by0 + (by1 - by0) * a
        xb, yb = bx0 + (bx1 - bx0) * b, by0 + (by1 - by0) * b
        if k % 2 == 0:
            p.line(round(xa), round(ya + 1), round(xb), round(yb + 2 - b * 1), dark)
        else:
            p.line(round(xa), round(ya + 2 - a * 1), round(xb), round(yb + 1), dark)
    p.line(x0 + 30, deck - 11, x0 - 10, -40, "steel0")           # the luffing cable
    p.set(bx1, by1 - 1, "red"); p.set(bx1 - 1, by1 - 1, "ink0")
    # the hook on its cable, over the water
    hx = bx1 + 4
    p.vline(hx, by1 + 2, 12, "steel1")
    stamp(p, hx - 2, 12, [".##.", "#..#", "...#", "#..#", ".##."], {"#": "steel2"})


def pilings(p, xs, top, bottom):
    for x in xs:
        for y in range(top, bottom):
            p.set(x, y, "ink0"); p.set(x + 1, y, "ink2"); p.set(x + 2, y, "ink1")
        p.set(x + 1, top, "night2"); p.set(x + 2, top, "night1")


def harbour_lantern(p, flicker):
    """The harbour lamp: a dark iron post with a curled arm and a hanging lantern, the bulb where
    Lot 9's is, so the pool on the ground matches."""
    lx, ly = LAMP
    for y in range(3, LANE_Y0 + 2):
        p.set(POLE_X - 2, y, "ink0"); p.set(POLE_X - 1, y, "grime1"); p.set(POLE_X, y, "grime0")
        p.set(POLE_X + 1, y, "ink1"); p.set(POLE_X + 2, y, "ink0")
    for y in range(LANE_Y0 - 4, LANE_Y0 + 3):                     # the foot
        for x in range(POLE_X - 4, POLE_X + 5):
            p.set(x, y, "ink0" if (y == LANE_Y0 + 2 or x in (POLE_X - 4, POLE_X + 4) or y == LANE_Y0 - 4) else "grime0")
    for y in range(LANE_Y0 - 14, LANE_Y0 - 11):                   # a collar
        for x in range(POLE_X - 3, POLE_X + 4):
            p.set(x, y, "ink0" if y != LANE_Y0 - 13 else "grime1")
    p.set(POLE_X, 1, "ink0"); p.set(POLE_X, 2, "grime1")          # the finial
    for x in range(POLE_X + 2, lx + 1):                           # the arm, and its curl
        p.set(x, 3, "ink0"); p.set(x, 4, "grime1"); p.set(x, 5, "ink0")
    for (x, y) in ((POLE_X + 4, 6), (POLE_X + 5, 7), (POLE_X + 6, 7), (POLE_X + 7, 6), (POLE_X + 6, 8), (POLE_X + 4, 7)):
        p.set(x, y, "ink0")
    p.set(lx, 6, "ink0")                                          # the lantern on its hook
    glass = ("sodium2", "sodium3") if not flicker else ("sodium1", "sodium2")
    for y in range(7, 14):
        half = 3 if 8 <= y <= 12 else 2
        for x in range(lx - half, lx + half + 1):
            edge = abs(x - lx) == half or y in (7, 13)
            p.set(x, y, "ink0" if edge else (glass[1] if abs(x - lx) <= 1 and 9 <= y <= 11 else glass[0]))
    p.set(lx, 14, "ink0")
    if not flicker:
        for (x, y) in ellipse_mask(lx, ly + 2, 11, 9):
            c = p.get(x, y)
            if c in ("night0", "night1") and dith(x, y, 0.45):
                p.set(x, y, "sodium1" if math.hypot(x - lx, y - ly - 2) < 6 else "sodium0")


# ---------------------------------------------------------------- the wharf road

def plank_lane(p, rnd):
    """Deck boards running along the road: a seam every 6 rows, staggered butt joints with a
    pair of nail heads, a paler board now and then, the wheels' worn tracks."""
    for y in range(LANE_Y0, LANE_Y1):
        row = (y - LANE_Y0 - 2) // 6
        seam = (y - LANE_Y0 - 2) % 6 == 5
        joint = 23 + (row * 37) % 61
        for x in range(X0, X1):
            if y < LANE_Y0 + 2 or y >= LANE_Y1 - 2:
                c = "dirt0"
            elif seam:
                c = "dirt0"
            elif (x - joint) % 61 == 0:
                c = "dirt0"
            elif row % 3 == 1 and ((x - joint) % 61) < 30 and dith(x, y, 0.35):
                c = "dirt2"
            else:
                c = "dirt1"
            for ry in (70, 92):
                if y in (ry - 1, ry, ry + 1) and c == "dirt1" and dith(x, y, 0.5):
                    c = "dirt2"
            p.set(x, y, c)
            if not seam and LANE_Y0 + 2 <= y < LANE_Y1 - 2 and (x - joint) % 61 in (1, 60) and (y - LANE_Y0 - 2) % 6 in (1, 3):
                p.set(x, y, "steel0")
    for _ in range(700):
        x, y = rnd.randrange(X0, X1), rnd.randrange(LANE_Y0 + 2, LANE_Y1 - 2)
        if p.get(x, y) == "dirt1" and rnd.random() < 0.6:
            p.set(x, y, "dirt0" if rnd.random() < 0.4 else "dirt2")


# ---------------------------------------------------------------- the margins

def water_patch(p, rnd, x0, x1, y0, y1):
    for y in range(y0, y1):
        for x in range(x0, x1):
            p.set(x, y, "night0" if dith(x, y, 0.75) else "night1")
    for _ in range((x1 - x0) * (y1 - y0) // 60):
        x, y = rnd.randrange(x0, x1), rnd.randrange(y0, y1)
        for k in range(rnd.randrange(2, 6)):
            if x0 <= x + k < x1:
                p.set(x + k, y, "night1" if rnd.random() < 0.7 else "night2")


def rowboat(p, x, y):
    hull = poly_mask([(x, y - 6), (x + 30, y - 6), (x + 26, y), (x + 4, y)])
    shade_mask(p, hull, "night1", lit="night2", shade="ink2")
    p.hline(x + 3, x + 28, y - 5, "dirt0")
    p.hline(x + 9, x + 12, y - 6, "card0"); p.hline(x + 18, x + 21, y - 6, "card0")   # the thwarts
    p.line(x + 6, y - 7, x + 22, y - 10, "card0")                                     # an oar
    for k in range(4):
        p.set(x + 4 + k * 7, y + 1, "night2")


def buoy(p, x, y):
    m = ellipse_mask(x, y - 4, 4, 4)
    shade_mask(p, m, "rust1", lit="rust2", shade="rust0")
    for xx in range(x - 3, x + 4):
        p.set(xx, y - 4, "fur3")
    p.set(x - 1, y - 7, "fur3")


def trap(p, x, y):
    m = rect_mask(x, y - 10, 18, 10)
    shade_mask(p, m, "card0", lit="card1", shade="ink2")
    for xx in range(x + 2, x + 17, 3):
        p.vline(xx, y - 8, y - 1, "ink2")
    p.hline(x + 1, x + 17, y - 5, "ink2")


def rope_coil(p, x, y):
    for r in (5, 3):
        m = ellipse_mask(x, y - 2, r, r / 2.2)
        edge = {q for q in m if any((q[0] + dx, q[1] + dy) not in m for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
        for q in edge:
            p.set(q[0], q[1], "card1" if q[1] < y - 2 else "card0")


def fish_bones(p, x, y):
    rows = [
        "#.........",
        "##.#.#.#..",
        "#bbbbbbbb#",
        "##.#.#.#.#",
        "#.........",
    ]
    stamp(p, x, y, rows, {"#": "fur2", "b": "bone"})
    p.set(x + 9, y + 2, "ink0")


# ---------------------------------------------------------------- the scene

def build(flicker=False):
    p = Pano()
    rnd = random.Random(19)
    glow = 0.55 if flicker else 1.0

    # the sky (no stars low over the far shore's glow)
    sky(p, rnd, seed=119, avoid=())
    for gx, gy in ((330, 8), (342, 5), (612, -52), (-60, -88), (-48, -84), (150, -30)):
        far_gull(p, gx, gy)

    # the far shore, a radio mast, the town's windows
    for x in range(X0, X1):
        top = shore(x)
        for y in range(top, WATER_Y):
            p.set(x, y, "night1" if y > top else "night2")
    for y in range(-6, shore(-104)):
        p.set(-104, y, "night2")
    for k in range(-6, 22, 6):
        p.line(-104, k, -110 + k // 3, shore(-110), "night1")
        p.line(-104, k, -98 - k // 3, shore(-98), "night1")
    p.set(-104, -7, "red")
    for town in (-120, -20, 130, 300, 420, 560, 720):             # a few huddles of lit windows
        for _ in range(16):
            x = town + round(rnd.gauss(0, 14))
            y = rnd.randrange(shore(x) + 2, WATER_Y)
            if p.get(x, y) == "night1":
                p.set(x, y, "sodium1" if rnd.random() < 0.55 else "sodium0")

    # the water: night1 far, darkening to night0 by the quay, with ripples and reflections
    for y in range(WATER_Y, QUAY_Y):
        t = (y - WATER_Y) / (QUAY_Y - WATER_Y)
        for x in range(X0, X1):
            p.set(x, y, "night0" if dith(x, y, 0.15 + t * 0.7) else "night1")
    for _ in range(900):
        x, y = rnd.randrange(X0, X1), rnd.randrange(WATER_Y + 1, QUAY_Y)
        n = rnd.randrange(2, 6)
        for k in range(n):
            if p.get(x + k, y) in ("night0", "night1"):
                p.set(x + k, y, "night2" if (y - WATER_Y) < 9 or rnd.random() < 0.4 else "night1")
    for x in range(X0, X1):                                       # the far lights, wobbling down
        if p.get(x, WATER_Y - 2) in ("sodium1", "bone") or p.get(x, WATER_Y - 3) in ("sodium1", "bone"):
            for y in range(WATER_Y + 1, WATER_Y + 7, 2):
                p.set(x + (1 if (y // 2) % 2 else 0), y, "sodium0")

    breakwater(p, rnd)
    lighthouse(p)
    for y in range(LH_BASE + 4, QUAY_Y, 2):                       # its lamp on the water
        w = 1 + (y - LH_BASE) // 4
        for x in range(LH_X - w, LH_X + w + 1):
            if dith(x, y, 0.5):
                p.set(x + (1 if y % 4 == 0 else -1), y, "sodium1" if abs(x - LH_X) < 2 else "sodium0")
    for y in range(WATER_Y + 2, QUAY_Y, 2):                       # the lantern on the water
        w = 1 + (y - WATER_Y) // 5
        for x in range(LAMP[0] - w, LAMP[0] + w + 1):
            if dith(x, y, 0.45 * glow):
                p.set(x + (1 if y % 4 == 0 else 0), y, "sodium1" if abs(x - LAMP[0]) < 2 and not flicker else "sodium0")

    crane(p)

    boats = boat_maps()
    boat(p, boats[0], 272, QUAY_Y + 1)
    boat(p, boats[1], 384, QUAY_Y + 1, flip=True)
    boat(p, boats[0], -150, QUAY_Y - 6)                           # one further out, in the margin
    boat(p, boats[1], 700, QUAY_Y - 4, flip=True)

    # the quay: a timber cap, the bulkhead, bollards, pilings with gulls on them
    for x in range(X0, X1):
        p.set(x, QUAY_Y, "dirt2")
        p.set(x, QUAY_Y + 1, "dirt1")
        p.set(x, QUAY_Y + 2, "dirt0" if x % 9 else "ink1")
        p.set(x, QUAY_Y + 3, "ink1")
    for bx in range(-148, X1, 64):
        if 540 < bx < 622:
            continue
        stamp(p, bx, QUAY_Y - 4, [".##.", "#lS#", ".#L.", "#LL#"], {"#": "ink0", "l": "steel2", "S": "steel1", "L": "steel0"})
    pilings(p, [250, 262, 360, 434, 446, -40, 640, 668], 42, QUAY_Y)
    gull_sitting(p, 251, 42)
    gull_sitting(p, 435, 42, flip=True)
    gull_sitting(p, 669, 42)
    p.line(332, QUAY_Y - 2, 320, QUAY_Y - 9, "card0")                # mooring lines
    p.line(400, QUAY_Y - 2, 410, QUAY_Y - 8, "card0")

    # the wharf road, the ground, the lantern's light
    plank_lane(p, rnd)
    ground(p, rnd, seed=519)
    light_pool(p, glow)
    lamp_cone(p, glow)
    harbour_lantern(p, flicker)

    # --- the margins on the ground
    # left: the yard ends at a bulkhead, the bay beyond; the wharf crosses it on pilings
    r = random.Random(619)
    edge = -62                                                    # (past a 1920 x 945 window's margin)
    water_patch(p, r, X0, edge, LANE_Y1, Y1)
    for y in range(LANE_Y1, Y1):
        p.set(edge, y, "ink0"); p.set(edge + 1, y, "dirt1" if y % 6 else "ink2"); p.set(edge + 2, y, "dirt0")
    for x in range(X0, edge):                                     # under the wharf: shadow, then pilings
        for y in range(LANE_Y1, LANE_Y1 + 5):
            p.set(x, y, "ink0" if y < LANE_Y1 + 3 or dith(x, y, 0.5) else p.get(x, y))
    pilings(p, list(range(edge - 18, X0, -22)), LANE_Y1, LANE_Y1 + 16)
    rowboat(p, -112, 214)
    buoy(p, -96, 300)
    rowboat(p, -150, 420)
    # right: crates, traps, a drum, buoys, rope
    crate(p, 652, 168)
    crate(p, 668, 168, w=14, h=10)
    crate(p, 656, 156, w=12, h=10, base="card1", lit="card2")
    trap(p, 700, 230)
    trap(p, 704, 220)
    drum(p, 744, 196, base="steel0", lit="steel1")
    buoy(p, 662, 290)
    buoy(p, 770, 270)
    rope_coil(p, 720, 330)
    trap(p, 754, 352)
    # below: a puddle, ruts, the remains of somebody's fish supper
    for k, y in enumerate((384, 402)):
        ruts(p, y, phase=k * 1.1 + 0.4)
    puddle(p, 210, 430, 30)
    puddle(p, 560, 460, 20)
    fish_bones(p, 410, 420)
    fish_bones(p, 690, 470)
    return p.image()
