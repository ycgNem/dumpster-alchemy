"""Mount Trashmore at night: a HUGE mountain of junk that fills the sky. It rises from behind the
fence across the whole panorama, leaves the top of the stage between the HUD's night bar and its
clock, and peaks in the top margin, where the King's tiny red throne sits on the summit with a
sodium beam standing straight up out of it, and gulls wheel round the top.

The mountain's body is two PixelLab drafts of piled junk (#P1 bags, tyres, fridges, a car; #P2
mattresses, fridges, washers, tyres, chairs; art-src/prompts.md), shrunk by a whole number (2 and 3,
an outline-keeping block pick) and tiled in patches, then remapped by value into the cool night
ramps so it sits back like everything on the horizon. Bits of junk poke out of the ridge line so
its silhouette reads as trash, not rock. Where the HUD's text sits (the night label, the night bar
and streak meter, the clock) the mountain is pressed darker and loses its colour hints, so the
text stays readable; near the summit the throne's light warms it.

In front: the near heaps (with a bulldozer), the low sagging fence with the MT TRASHMORE sign, and
the same cobra-head streetlight, lane and calm dark ground as Lot 9. In the margins: bags, tyres,
fridges, ruts and puddles on the ground.
"""
import math
import random
import sys
from pathlib import Path

from pano import (SKY_H, X0, X1, Pano, cobra_lamp, dirt_lane, dith, drum, ellipse_mask, far_gull, fence,
                  ground, heap_line, lamp_cone, light_pool, puddle, rect_mask, rim_lines, ruts, shade_mask,
                  sky, stamp, text3, text3_width, tire_stack, verge_weeds)

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pixel-art" / "anchor"))
from kit import hsv, load, lum  # noqa: E402

PEAK_X, PEAK_Y = 492, -40          # the summit: in the HUD's gap (night bar | clock), up in the top margin

# The ridge line, stage coords (x, y), left to right: a long left flank from the far-left margin,
# a shorter, steeper right one. Smoothed, then roughened with lumps of junk.
PROFILE = [(-170, 42), (-90, 39), (0, 33), (80, 26), (160, 17), (230, 7), (290, -3), (340, -12),
           (390, -21), (430, -29), (462, -36), (480, -39), (492, -40), (506, -39), (526, -35), (560, -27),
           (600, -15), (640, -3), (690, 9), (750, 20), (810, 30)]

# Where the HUD's text sits on the stage (x0, y0, x1, y1): the night label and held Contraband,
# the night bar and streak meter, the clock. The mountain goes dark and plain under these.
HUD = [(0, 0, 150, 20, 1.0), (4, 20, 142, 50, 0.6), (204, 0, 452, 40, 1.0), (532, 0, 640, 22, 1.0)]


def _smooth(x):
    pts = PROFILE
    if x <= pts[0][0]:
        return pts[0][1]
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        if ax <= x <= bx:
            t = (x - ax) / (bx - ax)
            t = t * t * (3 - 2 * t)
            return ay + (by - ay) * t
    return pts[-1][1]


def _lumps(x):
    """Heaps on the slope: overlapping humps, a few px high, hashed per 23 px so they don't repeat."""
    v = 0.0
    for period, amp, seed in ((23, 2.2, 3), (41, 3.0, 7), (13, 1.0, 11)):
        k = math.floor(x / period)
        for kk in (k - 1, k, k + 1):
            r = random.Random(kk * 1009 + seed)
            cx = kk * period + r.random() * period
            w = period * (0.5 + r.random() * 0.6)
            h = amp * (0.4 + r.random())
            d = (x - cx) / w
            if abs(d) < 1:
                v = max(v, h * (1 - d * d))
    return v


def mountain_top(x):
    if abs(x - PEAK_X) <= 6:                      # a flat-ish top for the throne
        return PEAK_Y + abs(x - PEAK_X) // 4
    return round(_smooth(x) - _lumps(x) + 0.8 * math.sin(x * 0.53 + 1.0))


def near_top(x):
    """The near heaps' outline (Lot 9's kind of heap, lower), in front of the mountain's foot."""
    return heap_line(x, 5, 57, 9)


# ---------------------------------------------------------------- the drafts as textures

def texture(path, k):
    """A draft shrunk by k: each k x k block becomes (lum, hue, sat) of its middle pixel by value,
    or None (an outline) when a third of it is near-black, so the junk keeps its outlines."""
    im = load(path)
    px = im.load()
    out = []
    for by in range(0, im.height - k + 1, k):
        row = []
        for bx in range(0, im.width - k + 1, k):
            cells = [px[bx + i, by + j] for j in range(k) for i in range(k)]
            vals = sorted(((lum(c), c) for c in cells), key=lambda t: t[0])
            dark = sum(1 for v, _ in vals if v < 0.09)
            if dark * 3 >= len(vals):
                row.append(None)
                continue
            light = [t for t in vals if t[0] >= 0.09]
            l, c = light[len(light) // 2]
            h, s, _ = hsv(c)
            row.append((l, h, s))
        out.append(row)
    return out


def hud_weight(x, y):
    """0..1: how much HUD text sits over (x, y) (1 inside a box, fading over 10 px outside)."""
    w = 0.0
    for x0, y0, x1, y1, k in HUD:
        dx = max(x0 - x, 0, x - x1)
        dy = max(y0 - y, 0, y - y1)
        d = math.hypot(dx, dy)
        if d < 10:
            w = max(w, k * (1 - d / 10))
    return w


def patch(x, y):
    """Low-frequency field choosing the appliance draft (> 0) over the bags draft."""
    return (math.sin(x * 0.021 + y * 0.013) + math.sin(x * 0.0083 - y * 0.031 + 2.1) + 0.6 * math.sin(x * 0.047 + 4.0)) / 2.6


def junk_name(t, hud, warm):
    """A texture sample -> a palette name: the night ramps by value, with hints of what it is."""
    if t is None:
        return "ink0" if hud > 0.5 else "ink1"
    l, h, s = t
    l *= 1 - 0.42 * hud
    plain = hud > 0.45
    if l < 0.16:
        return "ink1"
    if not plain and s > 0.28 and 70 < h < 170 and l < 0.5:
        return "grime0" if l < 0.36 else "grime1" if warm > 0.3 else "grime0"
    if not plain and s > 0.3 and (h < 45 or h > 330) and l < 0.6:
        return "rust1" if warm > 0.2 and l >= 0.42 else "rust0"
    if l < 0.27:
        return "ink2"
    if l < 0.42:
        return "night0" if plain else "night1"
    if l < 0.62:
        return "night1"
    if l < 0.8 or plain:
        return "night2"
    return "night3"


def mountain(p):
    bags = texture(ROOT / "art-src" / "dl" / "backdrop_trashmore_heap_v2.png", 3)
    kit = texture(ROOT / "art-src" / "dl" / "backdrop_trashmore_heap_v3.png", 4)
    tex = [(bags, 31, 5), (kit, 140, 47)]
    for x in range(X0, X1):
        top = mountain_top(x)
        for y in range(top, SKY_H):
            which = 1 if patch(x, y) > 0.28 else 0
            tx, ou, ov = tex[which]
            th, tw = len(tx), len(tx[0])
            tile = (x + ou) // tw
            t = tx[(y + ov + tile * 57) % th][(x + ou) % tw]
            hud = hud_weight(x, y)
            # the throne's light: faces near the summit go warm, in rings
            d = math.hypot(x - PEAK_X, (y - PEAK_Y) * 1.4)
            warm = max(0.0, 1 - d / 56)
            n = junk_name(t, hud, warm)
            if warm > 0 and n in ("night1", "night2", "night3", "rust1", "grime1"):
                if n in ("night2", "night3") and warm > 0.6:
                    n = "sodium1" if dith(x, y, warm) else "sodium0"
                elif warm > 0.7 or dith(x, y, (warm - 0.15) * 1.3):
                    n = "sodium0"
            p.set(x, y, n)
    ridge(p)


def ridge(p):
    """The ridge line: a cool rim where the sky meets it (warm near the summit), an outline under it."""
    for x in range(X0, X1):
        top = mountain_top(x)
        d = abs(x - PEAK_X)
        if d < 12:
            c = "sodium2"
        elif d < 34:
            c = "sodium1"
        elif d < 80 and dith(x, top, 1.3 - d / 80):
            c = "sodium0"
        else:
            c = "night2" if hud_weight(x, top) < 0.5 else "night1"
        p.set(x, top, c)


# ---------------------------------------------------------------- junk poking out of the ridge

POKES = {
    "fridge": ["#####", "#nNn#", "#nNn#", "#nnn#", "#####", "#nNn#", "#nnn#", "#nnn#"],
    "tire": [".###.", "#nNn#", "#n.n#", "#n.n#", "#nnn#", ".###."],
    "mattress": ["...........##", "........##nN#", ".....##nnNnn#", "..##nnNnnnn##", "##nnnnnn##...", "#nn###......."],
    "bag": ["..#..", ".#n#.", "#nNn#", "#nnn#", ".###."],
    "chair": ["#....", "#....", "#....", "####.", "#..#.", "#..#."],
    "cart": ["#.........", ".########.", ".#n.n.n.#.", ".#.n.n.n#.", "..######..", "..#....#.."],
    "sofa": ["##.......##", "#n#######n#", "#nnnnnnnnn#", "###########"],
}


def pokes(p):
    """Bits of junk sticking up out of the ridge: the silhouette reads as trash, not rock."""
    spots = [(-150, "tire"), (-118, "bag"), (-84, "fridge"), (-52, "mattress"), (-14, "chair"),
             (18, "tire"), (44, "bag"), (150, "fridge"), (182, "tire"), (212, "mattress"),
             (262, "cart"), (296, "bag"), (334, "fridge"), (366, "tire"), (398, "chair"),
             (424, "mattress"), (458, "bag"), (548, "tire"), (566, "fridge"), (598, "mattress"),
             (636, "sofa"), (668, "bag"), (700, "fridge"), (728, "tire"), (760, "mattress"), (788, "bag")]
    for x, kind in spots:
        rows = POKES[kind]
        w = max(len(r) for r in rows)
        top = min(mountain_top(x + i) for i in range(w))
        y = top - len(rows) + 2
        hud = max(hud_weight(x + i, y + j) for i in range(0, w, 2) for j in range(0, len(rows), 2))
        warm = max(0.0, 1 - math.hypot(x - PEAK_X, (y - PEAK_Y) * 1.4) / 70)
        body = "sodium0" if warm > 0.3 else ("night1" if hud > 0.5 else "night2")
        lit = "sodium1" if warm > 0.3 else ("night1" if hud > 0.5 else "night3")
        stamp(p, x, y, rows, {"#": "ink1", "n": body, "N": lit})


# ---------------------------------------------------------------- the summit

def throne(p, flicker):
    """The King's tiny throne on the summit: a red velvet armchair with gold trim and a hubcap
    crown waiting on the seat, lit from below by the beam."""
    rows = [
        "....y.y.y....",
        "....yyyyy....",
        "..#########..",
        "..#RrRrRrR#..",
        "..#rRrRrRr#..",
        "..#RrRrRrR#..",
        "###rRrRrRr###",
        "#RR#######RR#",
        "#Rr#yyyyy#rR#",
        "#RRRRRRRRRRR#",
        "#############",
        ".#.........#.",
    ]
    x, y = PEAK_X - 6, PEAK_Y - 11
    stamp(p, x, y, rows, {"#": "ink0", "R": "red", "r": "rust2", "y": "sodium3" if not flicker else "yellow"})
    p.set(x + 4, y + 3, "white")


def beam(p):
    """The sodium beam: straight up out of the throne, widening, fading with height."""
    base = PEAK_Y - 12
    for y in range(-140, base):
        up = base - y
        half = 2.5 + up * 0.11
        fade = max(0.25, 1 - up / 220)
        for x in range(math.floor(PEAK_X - half - 1), math.ceil(PEAK_X + half + 2)):
            c = p.get(x, y)
            if c not in ("night0", "night1", "night2", "night3", "bone"):
                continue
            k = abs(x - PEAK_X) / half
            if k > 1:
                continue
            if k < 0.25 and dith(x, y, 0.75 * fade):
                p.set(x, y, "sodium2" if up < 40 else "sodium1")
            elif k < 0.6 and dith(x, y, 0.45 * fade):
                p.set(x, y, "sodium1")
            elif dith(x, y, 0.22 * fade):
                p.set(x, y, "sodium0")
    # the glow round the throne, in the air
    for (x, y) in ellipse_mask(PEAK_X, PEAK_Y - 6, 20, 14):
        if p.get(x, y) in ("night0", "night1") and dith(x, y, 0.45 * (1 - math.hypot(x - PEAK_X, (y - PEAK_Y + 6) * 1.3) / 22)):
            p.set(x, y, "sodium0")


GULLS = [(-58, -22, 1), (-30, -40, 0), (24, -50, 1), (60, -34, 0), (-80, -58, 0), (96, -64, 1), (-14, -78, 0),
         (40, -86, 0), (-46, 30, 0), (14, 44, 1), (52, 26, 0), (-110, -30, 0), (130, -20, 0)]
BIG_GULL = ["#.....#", ".#...#.", ".bb.bb.", "...#..."]


def gulls(p):
    """Gulls wheeling round the summit: most up in the margin, a few low enough for a 16:9 window.
    Bone against the mountain, night3 against the sky; the nearer ones a size up."""
    for gx, gy, big in GULLS:
        x, y = PEAK_X + gx, PEAK_Y + gy
        on_hill = y >= mountain_top(x) - 1
        c = "bone" if on_hill else "night3"
        if big:
            stamp(p, x - 3, y - 1, BIG_GULL, {"#": c, "b": "bone" if on_hill else "night2"})
        else:
            far_gull(p, x, y, c)


# ---------------------------------------------------------------- the foreground

def bulldozer(p, x, y):
    """A dozer parked up a heap, (x, y) its tracks' bottom-left; a dim silhouette, a dead lamp."""
    rows = [
        "........####.......",
        "........#nn#.......",
        "....##########.....",
        "....#nnnnnnnnN#....",
        "##..#nnnnnnnnnN###.",
        "#N#.##############.",
        "#N##kKkKkKkKkKkKk#.",
        "#N#.#kkkkkkkkkkkk#.",
        "##...############..",
    ]
    stamp(p, x, y - len(rows), rows, {"#": "ink0", "n": "night1", "N": "night2", "k": "ink1", "K": "ink2"})
    p.set(x + 9, y - 8, "sodium0")


def sign(p, x, y, text):
    w = text3_width(text) + 6
    m = rect_mask(x, y, w, 9)
    shade_mask(p, m, "card0", lit="card1", shade="ink2")
    text3(p, x + 3, y + 2, text, "ink1")
    p.vline(x + 3, y - 3, y, "steel0")
    p.vline(x + w - 4, y - 3, y, "steel0")


def bag(p, x, y, c=("grime0", "grime1")):
    m = ellipse_mask(x, y - 5, 6, 5)
    shade_mask(p, m, c[0], lit=c[1], shade="ink1")
    p.set(x, y - 11, "ink0"); p.set(x - 1, y - 11, "ink0"); p.set(x, y - 10, c[1])


def fridge_down(p, x, y):
    m = rect_mask(x, y - 9, 26, 9)
    shade_mask(p, m, "steel0", lit="steel1", shade="ink2")
    p.vline(x + 9, y - 8, y, "ink2")
    p.hline(x + 2, x + 7, y - 4, "steel1")


def near_heaps(p):
    """The near heaps along the fence: the bags draft at 2x (nearer, so bigger junk), in the dark
    ink values, with a dim rim on top; and a bulldozer parked up one."""
    bags = texture(ROOT / "art-src" / "dl" / "backdrop_trashmore_heap_v2.png", 2)
    th, tw = len(bags), len(bags[0])
    for x in range(X0, X1):
        top = near_top(x)
        for y in range(top, SKY_H):
            t = bags[(y + 23 + ((x + 300) // tw) * 41) % th][(x + 300) % tw]
            if t is None:
                n = "ink0"
            else:
                l = t[0]
                n = "ink1" if l < 0.3 else "ink2" if l < 0.6 else "night1"
            p.set(x, y, n)
        p.set(x, top, "night1")
    bulldozer(p, 214, near_top(223) + 2)


def build(flicker=False):
    p = Pano()
    rnd = random.Random(29)
    glow = 0.55 if flicker else 1.0

    sky(p, rnd, seed=129, avoid=((PEAK_X, -70, 40),))
    lamp_cone(p, glow)                  # (the haze under the lamp, before the mountain hides most of it)
    mountain(p)
    pokes(p)
    beam(p)
    throne(p, flicker)
    gulls(p)
    near_heaps(p)

    # a low fence, sagging (the sign goes on it after the lamp's rim light)
    fence(p, posts_from=40, gap=96, top=42, mesh_from=42)

    dirt_lane(p, rnd, seed=329)
    verge_weeds(p, rnd, seed=429)
    ground(p, rnd, seed=529)
    light_pool(p, glow)
    rim_lines(p, [near_top], glow)
    sign(p, 112, 44, "MT TRASHMORE")
    cobra_lamp(p, flicker)

    # the margins on the ground: heaps of bags and tyres, a fridge, ruts, puddles
    for (bx, by) in ((-30, 170), (-44, 176), (-20, 180), (-110, 240), (-96, 246), (680, 200), (694, 206), (760, 300)):
        bag(p, bx, by)
    bag(p, -60, 320, ("rust0", "rust1"))
    tire_stack(p, -150, 200, n=2)
    tire_stack(p, 720, 260, n=3)
    fridge_down(p, 652, 340)
    fridge_down(p, -86, 360)
    drum(p, 748, 168)
    for k, y in enumerate((380, 396, 412)):
        ruts(p, y, phase=k * 0.9 + 0.2)
    puddle(p, 120, 440, 30)
    puddle(p, 480, 420, 22)
    puddle(p, -100, 470, 26)
    for (x, y) in ((260, 430), (380, 470), (600, 410), (-40, 420), (700, 450)):
        p.set(x, y, "rust1"); p.set(x + 1, y, "rust0")
    return p.image()


if __name__ == "__main__":
    # A quick look: the sky band of the panorama at 2x, and the stage at 1x (python3 trashmore.py).
    from kit import Image
    out = ROOT / "art-src" / "review" / "v2" / "polish"
    out.mkdir(parents=True, exist_ok=True)
    a = build(False)
    a.crop((0, 0, 960, 140 + 120)).resize((1920, 520), Image.NEAREST).save(out / "trashmore_wip_sky_2x.png")
    a.crop((160, 140, 800, 500)).resize((1280, 720), Image.NEAREST).save(out / "trashmore_wip_stage_2x.png")
    print("wip -> art-src/review/v2/polish/trashmore_wip_*.png")
