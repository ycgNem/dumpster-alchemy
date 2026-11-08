"""The shared kit for the scene backdrops (lot9.py, marina.py, trashmore.py; run build.py).

Each backdrop is a 960 x 640 panorama. Its middle 640 x 360 is the stage (src/render/layout.ts):
  stage y 0-56    sky, the horizon (heaps, fence, water, landmarks)
  stage y 56-104  the truck lane
  stage y 104-360 calm dark ground under the orders, the board and the right column
The stage's top-left sits at panorama (OX, OY) = (160, 140), which is the sprite's anchor, so
the game draws it at stage (0, 0) and the margins fill themselves (src/render/backdrop.ts).

Everything here works in STAGE coordinates: x runs -160..800, y -140..500. A Pano is a grid of
palette names; every pixel snaps to the palette by construction.
"""
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "anchor"))
from kit import RGB, Image  # noqa: E402

PW, PH = 960, 640
OX, OY = 160, 140
X0, X1 = -OX, PW - OX            # -160 .. 800
Y0, Y1 = -OY, PH - OY            # -140 .. 500
SW, SH = 640, 360                # the stage
SKY_H, LANE_Y0, LANE_Y1 = 56, 56, 104
LAMP = (78, 9)                   # the streetlight's bulb (every scene keeps it: the light comes from the top-left)
POLE_X = 56
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def dith(x, y, t):
    """True on a fraction t (0..1) of pixels, ordered."""
    return BAYER[y % 4][x % 4] < t * 16


def on_stage(x, y):
    return 0 <= x < SW and 0 <= y < SH


class Pano:
    def __init__(self, fill="night0"):
        self.g = [[fill] * PW for _ in range(PH)]

    @staticmethod
    def ok(x, y):
        return X0 <= x < X1 and Y0 <= y < Y1

    def get(self, x, y):
        return self.g[y + OY][x + OX] if self.ok(x, y) else None

    def set(self, x, y, c):
        if c and self.ok(x, y):
            self.g[y + OY][x + OX] = c

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)

    def hline(self, x0, x1, y, c):
        for x in range(x0, x1):
            self.set(x, y, c)

    def vline(self, x, y0, y1, c):
        for y in range(y0, y1):
            self.set(x, y, c)

    def line(self, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            self.set(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)

    def image(self):
        im = Image.new("RGBA", (PW, PH))
        im.putdata([RGB[c] + (255,) for row in self.g for c in row])
        return im


# ---------------------------------------------------------------- shapes

def stamp(p, x, y, rows, key, flip=False):
    """Paint a char map with its top-left at (x, y); '.' and unknown chars are skipped."""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row[::-1] if flip else row):
            if ch in key:
                p.set(x + i, y + j, key[ch])


def shade_mask(p, mask, base, lit=None, shade=None, outline="ink0", rim=None):
    """Fill a set of points: top-left edge `lit`, bottom-right edge `shade`, a 1 px outline
    outside it. `rim`: an extra colour for the very top edge (a sodium rim)."""
    for (x, y) in mask:
        p.set(x, y, base)
    for (x, y) in mask:
        up = (x, y - 1) not in mask
        left = (x - 1, y) not in mask
        down = (x, y + 1) not in mask
        right = (x + 1, y) not in mask
        if rim and up:
            p.set(x, y, rim)
        elif lit and (up or left):
            p.set(x, y, lit)
        elif shade and (down or right):
            p.set(x, y, shade)
    if outline:
        for (x, y) in mask:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in mask:
                    p.set(q[0], q[1], outline)


def ellipse_mask(cx, cy, rx, ry):
    out = set()
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if ((x - cx) / max(rx, 0.5)) ** 2 + ((y - cy) / max(ry, 0.5)) ** 2 <= 1.0:
                out.add((x, y))
    return out


def rect_mask(x, y, w, h):
    return {(xx, yy) for yy in range(y, y + h) for xx in range(x, x + w)}


def poly_mask(pts):
    """Even-odd scanline fill of a polygon (stage coords)."""
    ys = [y for _, y in pts]
    out = set()
    n = len(pts)
    for y in range(math.floor(min(ys)), math.ceil(max(ys)) + 1):
        xs = []
        for i in range(n):
            (ax, ay), (bx, by) = pts[i], pts[(i + 1) % n]
            if (ay <= y + 0.5 < by) or (by <= y + 0.5 < ay):
                xs.append(ax + (y + 0.5 - ay) * (bx - ax) / (by - ay))
        xs.sort()
        for a, b in zip(xs[::2], xs[1::2]):
            for x in range(math.ceil(a - 0.5), math.floor(b - 0.5) + 1):
                out.add((x, y))
    return out


# a 3 x 5 font for signs
FONT3 = {
    "A": ["###", "#.#", "###", "#.#", "#.#"], "E": ["###", "#..", "##.", "#..", "###"],
    "H": ["#.#", "#.#", "###", "#.#", "#.#"], "I": ["###", ".#.", ".#.", ".#.", "###"],
    "L": ["#..", "#..", "#..", "#..", "###"], "M": ["#.#", "###", "###", "#.#", "#.#"],
    "N": ["##.", "#.#", "#.#", "#.#", "#.#"], "O": ["###", "#.#", "#.#", "#.#", "###"],
    "R": ["##.", "#.#", "##.", "#.#", "#.#"], "S": ["###", "#..", "###", "..#", "###"],
    "T": ["###", ".#.", ".#.", ".#.", ".#."], "9": ["###", "#.#", "###", "..#", "###"],
    "Y": ["#.#", "#.#", ".#.", ".#.", ".#."], "D": ["##.", "#.#", "#.#", "#.#", "##."],
    "U": ["#.#", "#.#", "#.#", "#.#", "###"], "P": ["##.", "#.#", "##.", "#..", "#.."],
    ">": ["#..", ".#.", "..#", ".#.", "#.."], " ": ["...", "...", "...", "...", "..."],
    "!": [".#.", ".#.", ".#.", "...", ".#."], "B": ["##.", "#.#", "##.", "#.#", "##."],
    "K": ["#.#", "#.#", "##.", "#.#", "#.#"], "C": ["###", "#..", "#..", "#..", "###"],
}


def text3(p, x, y, s, c):
    for ch in s:
        stamp(p, x, y, FONT3.get(ch, FONT3[" "]), {"#": c})
        x += 4
    return x


def text3_width(s):
    return len(s) * 4 - 1


# ---------------------------------------------------------------- the sky

def sky(p, rnd_stage, seed, n_stage=140, n_margin=1100, keep_stage_stars=True, avoid=()):
    """night0 at the top easing to night1 toward the horizon, and stars. The stage's star band
    (y 2-34) uses `rnd_stage` exactly as the original Lot 9 did; the margins get their own."""
    lx, ly = LAMP
    for y in range(Y0, SKY_H):
        t = y / SKY_H
        for x in range(X0, X1):
            p.set(x, y, "night1" if dith(x, y, max(0, t - 0.25) * 1.3) else "night0")
    if keep_stage_stars:
        for _ in range(n_stage):
            x, y = rnd_stage.randrange(SW), rnd_stage.randrange(2, 34)
            if math.hypot(x - lx, y - ly) > 70:
                p.set(x, y, "bone" if rnd_stage.random() < 0.25 else "night3")
    r = random.Random(seed)
    for _ in range(n_margin):
        x, y = r.randrange(X0, X1), r.randrange(Y0 + 2, 34)
        if 0 <= x < SW and y >= 2:
            continue                                  # the stage band has its own stars
        if math.hypot(x - lx, y - ly) < 70 or any(math.hypot(x - ax, y - ay) < ar for ax, ay, ar in avoid):
            continue
        # more stars higher up, where the sky is darkest
        if r.random() > 0.35 + 0.65 * min(1.0, (34 - y) / 120):
            continue
        p.set(x, y, "bone" if r.random() < 0.22 else ("night3" if r.random() < 0.8 else "night2"))
    # a few bright ones, only in the top margin: a bone heart and night3 arms
    for _ in range(14):
        x, y = r.randrange(X0 + 4, X1 - 4), r.randrange(Y0 + 6, -8)
        if any(math.hypot(x - ax, y - ay) < ar for ax, ay, ar in avoid):
            continue
        p.set(x, y, "white")
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p.set(x + dx, y + dy, "night3")


def far_gull(p, x, y, c="night3"):
    for dx, dy in ((-2, -1), (-1, 0), (0, 1), (1, 0), (2, -1)):
        p.set(x + dx, y + dy, c)


def heap_line(x, seed, base, amp):
    r = random.Random(seed)
    phases = [r.random() * 6.28 for _ in range(4)]
    v = base
    for k, (f, a) in enumerate(((0.011, 1.0), (0.027, 0.55), (0.061, 0.3), (0.13, 0.15))):
        v -= amp * a * (0.5 + 0.5 * math.sin(x * f + phases[k]))
    return round(v)


def fence(p, posts_from=24, gap=88, top=22, mesh_from=22):
    """The chain-link fence: a faint diamond mesh, a top rail, barbed wire, posts."""
    for y in range(mesh_from - 2, SKY_H):
        for x in range(X0, X1):
            if ((x + y) % 7 == 0 or (x - y) % 7 == 0) and y > mesh_from:
                c = p.get(x, y)
                if c in ("night0", "night1"):
                    p.set(x, y, "night2" if dith(x, y, 0.5) else c)
                elif c in ("night2", "night3"):
                    p.set(x, y, "night1")
    for x in range(X0, X1):
        p.set(x, top, "steel0")
        zig = top - 4 + (x // 2) % 3
        if x % 2 == 0:
            p.set(x, zig, "steel0")
        if x % 9 == 0:
            p.set(x, top - 3, "steel1")
    start = posts_from - gap * math.ceil((posts_from - X0) / gap)
    for px_ in range(start, X1, gap):
        for y in range(top - 6, SKY_H):
            p.set(px_, y, "night3")
            p.set(px_ + 1, y, "steel0")
            p.set(px_ + 2, y, "ink2")
        p.set(px_, top - 7, "ink2")
        p.set(px_ + 1, top - 7, "ink2")


def dirt_lane(p, rnd_stage, seed, ruts=(70, 92)):
    """The rutted dirt road (Lot 9's), margin to margin."""
    for y in range(LANE_Y0, LANE_Y1):
        for x in range(X0, X1):
            c = "dirt1"
            if y < LANE_Y0 + 3:
                c = "dirt0" if (y == LANE_Y0 or dith(x, y, 0.5)) else "dirt1"
            elif y >= LANE_Y1 - 3:
                c = "dirt0" if (y == LANE_Y1 - 1 or dith(x, y, 0.5)) else "dirt1"
            for ry in ruts:
                wob = ry + round(1.2 * math.sin(x * 0.045 + ry))
                if y in (wob, wob + 1):
                    c = "dirt0"
                elif y == wob - 1:
                    c = "dirt2" if dith(x, y, 0.35) else c
            p.set(x, y, c)
    for _ in range(900):
        x, y = rnd_stage.randrange(SW), rnd_stage.randrange(LANE_Y0 + 3, LANE_Y1 - 3)
        if p.get(x, y) == "dirt1":
            p.set(x, y, "dirt2" if rnd_stage.random() < 0.7 else "dirt3")
    r = random.Random(seed)
    for _ in range(460):
        x, y = r.randrange(X0, X1), r.randrange(LANE_Y0 + 3, LANE_Y1 - 3)
        if 0 <= x < SW:
            continue
        if p.get(x, y) == "dirt1":
            p.set(x, y, "dirt2" if r.random() < 0.7 else "dirt3")


def verge_weeds(p, rnd_stage, seed):
    for gx in range(0, SW, 23):
        h = rnd_stage.randrange(2, 5)
        for k in range(h):
            p.set(gx + (k % 2), LANE_Y0 + 2 - k, "grime1")
    r = random.Random(seed)
    for gx in list(range(-23 * 7, 0, 23)) + list(range(23 * 28, X1, 23)):
        h = r.randrange(2, 5)
        for k in range(h):
            p.set(gx + (k % 2), LANE_Y0 + 2 - k, "grime1")


def ground(p, rnd_stage, seed, cx=120, cy=110):
    """Dark, calm, darker away from the light, margin to margin and down to the bottom."""
    for y in range(LANE_Y1, Y1):
        for x in range(X0, X1):
            d = math.hypot((x - cx) / 1.6, (y - cy) * 1.0)
            t = min(1.0, d / 380)
            p.set(x, y, "ink1" if dith(x, y, t) else "dirt0")
    for _ in range(700):
        x, y = rnd_stage.randrange(SW), rnd_stage.randrange(LANE_Y1, SH)
        if p.get(x, y) == "dirt0":
            p.set(x, y, "dirt1")
    r = random.Random(seed)
    for _ in range(1400):
        x, y = r.randrange(X0, X1), r.randrange(LANE_Y1, Y1)
        if on_stage(x, y):
            continue
        c = p.get(x, y)
        if c == "dirt0":
            p.set(x, y, "dirt1")
        elif c == "ink1" and r.random() < 0.25:
            p.set(x, y, "dirt0")


def light_pool(p, glow):
    """The streetlight's warm pool on the lane and the ground: down and toward the board."""
    for y in range(LANE_Y0, Y1):
        for x in range(X0, X1):
            d = math.hypot((x - 150) / 2.4, (y - 88) / 1.0) / glow
            if d < 70:
                t = 1 - d / 70
                c = p.get(x, y)
                if c == "dirt1":
                    p.set(x, y, "dirt3" if (t > 0.7 and dith(x, y, t - 0.5)) else ("dirt2" if dith(x, y, t * 1.2) else c))
                elif c in ("dirt0", "ink1"):
                    if y < LANE_Y1:
                        p.set(x, y, "sodium0" if (t > 0.6 and dith(x, y, t - 0.45)) else ("dirt1" if dith(x, y, t) else c))
                    else:
                        p.set(x, y, "dirt1" if dith(x, y, t * 0.9) else c)
                elif c == "dirt2" and t > 0.6:
                    p.set(x, y, "dirt3")


def lamp_cone(p, glow, onto=("night0", "night1")):
    lx, ly = LAMP
    for y in range(ly + 3, LANE_Y0):
        half = (y - ly) * 0.9
        for x in range(round(lx - half), round(lx + half * 1.3)):
            if p.get(x, y) in onto:
                t = 0.1 * glow * (1 - (y - ly) / LANE_Y0)
                if dith(x, y, t):
                    p.set(x, y, "sodium0")


def rim_lines(p, lines, glow, reach=120):
    """Heap and fence tops near the lamp catch the warm light (the sodium rim)."""
    lx, _ = LAMP
    for x in range(X0, X1):
        if abs(x - lx) < reach:
            for line in lines:
                y = line(x)
                if 0 < y < SKY_H and dith(x, y, (1 - abs(x - lx) / reach) * glow * 0.8):
                    p.set(x, y, "sodium0")


def cobra_lamp(p, flicker):
    """The streetlight: a cobra-head lamp on a steel pole (Lot 9, Mount Trashmore)."""
    lx, _ = LAMP
    for y in range(7, LANE_Y0 + 2):
        p.set(POLE_X - 2, y, "ink0"); p.set(POLE_X - 1, y, "steel2"); p.set(POLE_X, y, "steel1")
        p.set(POLE_X + 1, y, "steel0"); p.set(POLE_X + 2, y, "ink0")
    for y in range(LANE_Y0 - 3, LANE_Y0 + 3):
        for x in range(POLE_X - 4, POLE_X + 5):
            p.set(x, y, "ink0" if (y == LANE_Y0 + 2 or x in (POLE_X - 4, POLE_X + 4)) else "steel0")
    for x in range(POLE_X - 2, lx - 4):
        p.set(x, 5, "ink0"); p.set(x, 6, "steel2"); p.set(x, 7, "steel0"); p.set(x, 8, "ink0")
    for x in range(lx - 8, lx + 9):
        p.set(x, 6, "ink0")
        p.set(x, 7, "steel1" if x < lx + 6 else "steel0")
        p.set(x, 8, "steel0")
        p.set(x, 9, "ink0")
    for y in (6, 7, 8):
        p.set(lx - 9, y, "ink0")
    p.set(lx + 9, 7, "ink0"); p.set(lx + 9, 8, "ink0")
    bulb_row(p, flicker, 10, 6)


def bulb_row(p, flicker, y, half):
    """The lit underside of a lamp at row y, and its halo."""
    lx, _ = LAMP
    bulb = "sodium3" if not flicker else "sodium2"
    for x in range(lx - half, lx + half + 1):
        p.set(x, y, bulb if abs(x - lx) < half else "ink0")
    for x in range(lx - 2, lx + 2):
        p.set(x, y, "white" if not flicker else "sodium3")
    for x in range(lx - half + 1, lx + half):
        p.set(x, y + 1, "sodium2" if not flicker else "sodium1")
    if not flicker:
        for x in range(lx - 9, lx + 10):
            for yy in (y + 1, y + 2, y + 3):
                c = p.get(x, yy)
                if c and c.startswith("night") and dith(x, yy, 0.55 - 0.15 * (yy - y - 1)):
                    p.set(x, yy, "sodium1" if yy == y + 1 else "sodium0")


# ---------------------------------------------------------------- props for the margins

def tire_stack(p, x, y, n=3, w=22, lit=False):
    """n tyres lying flat, stacked; (x, y) is the bottom-left."""
    for i in range(n):
        top = y - (i + 1) * 6
        m = ellipse_mask(x + w / 2 - 0.5 + (i % 2), top + 3, w / 2, 3)
        shade_mask(p, m, "ink2", lit="night1" if not lit else "sodium0", shade="ink1")
        for xx in range(x + 6 + (i % 2), x + w - 6 + (i % 2)):
            p.set(xx, top + 2, "ink1")


def drum(p, x, y, w=12, h=16, base="rust0", lit="rust1"):
    m = rect_mask(x, y - h, w, h)
    shade_mask(p, m, base, lit=lit, shade="ink1")
    for yy in (y - h + 4, y - 5):
        p.hline(x, x + w, yy, "ink1")
    p.hline(x + 2, x + w - 2, y - h, "ink2")


def crate(p, x, y, w=16, h=12, base="card0", lit="card1"):
    m = rect_mask(x, y - h, w, h)
    shade_mask(p, m, base, lit=lit, shade="ink2")
    for yy in range(y - h + 4, y, 4):
        p.hline(x, x + w, yy, "ink2")
    p.line(x + 1, y - 2, x + w - 2, y - h + 1, "ink2")


def cone(p, x, y, h=12):
    """A traffic cone, (x, y) bottom centre; dim (it's out of the light)."""
    pts = set()
    for j in range(h):
        half = 1 + j * 4 // h
        for i in range(-half, half + 1):
            pts.add((x + i, y - h + j))
    shade_mask(p, pts, "rust1", lit="rust2", shade="rust0")
    p.hline(x - 1 - (h // 2) * 4 // h, x + 2 + (h // 2) * 4 // h, y - h // 2, "fur2")
    p.hline(x - 5, x + 6, y, "ink1")


def cart(p, x, y, flip=False):
    """A shopping cart on its side-ish, in steel silhouette; (x, y) bottom-left."""
    rows = [
        "#..............",
        ".#.............",
        "..###########..",
        "..#s.s.s.s.s#..",
        "..#.s.s.s.s.s#.",
        "..#s.s.s.s.s.#.",
        "...#.s.s.s.s#..",
        "...##########..",
        "...#.......#...",
        "..###.....###..",
        "..#S#.....#S#..",
        "...#.......#...",
    ]
    stamp(p, x, y - len(rows), rows, {"#": "ink0", "s": "steel0", "S": "steel1"}, flip=flip)


def gull_sitting(p, x, y, flip=False):
    """A tiny gull sitting on something, (x, y) its feet."""
    rows = [".##.", "#bb#", "bbbby", ".ff."]
    stamp(p, x - 2, y - 4, rows, {"#": "ink0", "b": "bone", "y": "yellow", "f": "steel1"}, flip=flip)


def puddle(p, x, y, w, h=3, star=True):
    m = ellipse_mask(x, y, w / 2, h / 2)
    for (xx, yy) in m:
        p.set(xx, yy, "night1")
    for (xx, yy) in m:
        if (xx, yy - 1) not in m:
            p.set(xx, yy, "night2")
        if (xx, yy + 1) not in m and dith(xx, yy, 0.5):
            p.set(xx, yy, "ink2")
    if star:
        p.set(round(x + w / 5), round(y), "bone")


def ruts(p, y, x0=X0, x1=X1, c="dirt0", amp=1.4, phase=0.0, skip_stage=True):
    for x in range(x0, x1):
        yy = y + round(amp * math.sin(x * 0.03 + phase))
        if skip_stage and on_stage(x, yy):
            continue
        if p.get(x, yy) in ("ink1", "dirt0", "dirt1"):
            p.set(x, yy, c)
