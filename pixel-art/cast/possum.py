"""Inspector Possum, redrawn so he reads as a possum (critic P2-1), then as a Virginia opossum
rather than a white lab rat (critic N-P2-15, M7b): hood down (the hazmat suit's rolled collar at
his neck), bare BLACK ears with a pink rim at the tips, a white cone-shaped face with a long
snout and a pink nose, small dark eyes in dark eye rings, grizzled grey fur on the crown, cheeks
and neck (and spilling over the collar), a bare pink-grey tail that is dark at the base, the
clipboard and a tiny badge.

The opossum helpers (grizzle, ear_colour, tail ramps) live here and are shared by
possum_dead.py and possum_walk.py.

Used by build.py. Inputs (never edited), art-src/dl/:
  cast_possum2_fromold_v1.png   edit_image_pixen of the old possum_idle with the hood down: the
                                suit, the clipboard and the badge come from here; the head, the
                                collar and the tail are drawn below by hand
  cast_possum2_dead_v1.png      edit of the finished possum_idle, playing dead
  cast_possum2_shutdown_v1.png  edit of the finished possum_idle, clipboard up
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "anchor"))
from kit import *  # noqa: E402,F403

W = H = 48


# ---------------------------------------------------------------- shapes

def rows_mask(rows):
    """{y: (x0, x1)} -> set of (x, y)."""
    return {(x, y) for y, (a, b) in rows.items() for x in range(a, b + 1)}


def edge(mask):
    return {(x, y) for (x, y) in mask
            if any((x + dx, y + dy) not in mask for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}


def ellipse_mask(cx, cy, rx, ry):
    out = set()
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx, dy = (x - cx) / rx, (y - cy) / ry
            if dx * dx + dy * dy <= 1.0:
                out.add((x, y))
    return out


def paint(n, mask, colour, outline=True):
    """Fill mask with colour(x, y) (or a name), its own edge in ink0, over what is there."""
    e = edge(mask) if outline else set()
    for p in mask:
        n[p] = "ink0" if p in e else (colour(*p) if callable(colour) else colour)
    return e


# ---------------------------------------------------------------- opossum kit (shared)

def fur_hash(x, y, salt=0):
    """A fixed 0..99 per pixel, so the fur is the same on every build."""
    v = ((x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)) & 0xFFFFFFFF
    v ^= v >> 13
    v = (v * 0x5BD1E995) & 0xFFFFFFFF
    v ^= v >> 15
    return v % 100


UP = {"ink2": "fur1", "fur1": "fur2", "fur2": "fur3", "fur3": "fur4", "fur4": "bone"}
DOWN = {"fur2": "fur1", "fur3": "fur2", "fur4": "fur3", "bone": "fur4"}


def grizzle(n, pts, salt=0, light=30, dark=8, only=("fur1", "fur2", "fur3")):
    """Grizzled opossum fur: over plain grey shading, sprinkle pale guard-hair tips (one step up
    the fur ramp) and a few dark hairs (one step down). Two pale tips never touch, so it reads
    as scruffy fur, not as a dither."""
    tips = set()
    for (x, y) in sorted(pts, key=lambda p: (p[1], p[0])):
        c = n.get((x, y))
        if c not in only:
            continue
        h = fur_hash(x, y, salt)
        if h < light and not any((x + dx, y + dy) in tips for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            n[(x, y)] = UP[c]
            tips.add((x, y))
        elif h >= 100 - dark and c in DOWN:
            n[(x, y)] = DOWN[c]


def ear_colour(x, y, cx, cy, e, tip_rows=1.0):
    """A bare black opossum ear: ink1 skin, a thin pink rim round the tip (fur4 where the rim
    is lit), and the streetlight catching its left edge (fur1 high, ink2 lower) so the ear keeps
    its shape on night0, where the ink0 outline vanishes."""
    dx, dy = x - cx, y - cy
    top = (x, y - 1) in e
    if top and dy < -tip_rows:
        return "fur4" if dx < -1 else "pink"           # the pale rim of the tip
    if (x - 1, y) in e and dy < -tip_rows - 1:
        return "pink"                                   # the rim running down the lit side
    if (x - 1, y) in e and dy < 0:
        return "fur1"                                   # the lit edge
    if (x - 1, y) in e and dy < 2:
        return "ink2"                                   # the lit side, lower down
    return "ink1"


def outline_part(n, part, over=()):
    """ink0 around a part, on transparent pixels (and on names in `over`)."""
    for (x, y) in part:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in part and (q not in n or n[q] in over):
                n[q] = "ink0"


# ---------------------------------------------------------------- the idle head

# The head: a dome with wide cheeks, then a long cone down to the snout tip. Centre x = 23.5.
HEAD = {6: (18, 29), 7: (16, 31), 8: (14, 33), 9: (13, 34), 10: (12, 35), 11: (11, 36),
        12: (10, 37), 13: (10, 37), 14: (10, 37), 15: (10, 37), 16: (10, 37), 17: (10, 37),
        18: (10, 37), 19: (11, 36), 20: (12, 35), 21: (13, 34), 22: (15, 32), 23: (17, 30),
        24: (17, 30), 25: (18, 29), 26: (18, 29), 27: (19, 28), 28: (19, 28), 29: (20, 27),
        30: (21, 26)}
EYES = ((17, 15), (29, 15))          # top-left pixel of each 2 x 3 eye


def is_face(x, y):
    x0, x1 = HEAD[y]
    cheek = 4 if y <= 19 else 0
    peak = {9: 1, 10: 3, 11: 5, 12: 8}.get(y, 99 if y >= 13 else -1)
    return abs(x - 23.5) <= peak and x0 + cheek < x < x1 - cheek


def head_colour(x, y):
    x0, x1 = HEAD[y]
    if not is_face(x, y):                          # grey crown and cheeks (grizzled later)
        if x1 - x <= 2 or (y >= 16 and x1 - x <= 3):
            return "fur1"
        if (y <= 8 and x <= 24) or x - x0 <= 1 and y <= 14:
            return "fur3"
        return "fur2"
    # the white face, lit from the top-left; the right side of the snout turns bone, then fur4
    if y >= 20 and x >= x1 - 1:
        return "fur4"
    if x >= 26 + max(0, 21 - y) // 2 and y >= 17:
        return "bone"
    if x >= 31:
        return "bone"
    return "white"


def draw_ears(n):
    """Bare black ears, the tips rimmed pink; the far rim sits in shade."""
    for cx in (10.0, 37.0):
        cy = 8.0
        m = ellipse_mask(cx, cy, 4.9, 5.4)
        e = edge(m)
        for (x, y) in m:
            n[(x, y)] = "ink0" if (x, y) in e else ear_colour(x, y, cx, cy, e, tip_rows=2.5)


def draw_neck(n):
    m = rows_mask({y: (14, 33) for y in range(19, 31)})
    paint(n, m, lambda x, y: "fur1" if x >= 29 or y <= 22 else "fur2")
    grizzle(n, m, salt=3)


def draw_collar(n):
    """The hood, pulled down and rolled into a fat collar around the neck. Above the roll,
    where it rises up his neck, grizzled grey neck fur spills out over it."""
    rows = {26: (11, 15), 27: (10, 17), 28: (9, 20), 29: (9, 38), 30: (9, 38), 31: (9, 38),
            32: (10, 37), 33: (11, 36)}
    m = rows_mask(rows) | rows_mask({26: (32, 36), 27: (30, 37), 28: (27, 38)})

    def fur(x, y):
        # the scruffy ruff over the rising sides of the roll; its lower edge is ragged (a tuft
        # hangs over the roll's top here and there)
        hang = fur_hash(x, 0, 7) < 40 and (10 <= x <= 19 or 28 <= x <= 37)
        return y <= 28 or (y == 29 and hang)

    def col(x, y):
        if fur(x, y):
            if x <= 11 or (y <= 27 and x <= 13):
                return "fur3"                           # lit on the left
            return "fur1" if x >= 35 or (y == 29 and x >= 30) else "fur2"
        if y <= 28 or (y == 29 and (x <= 14 or x >= 33)):
            return "white" if x < 24 else "bone"
        if y == 33:
            return "fur3"
        if y == 32:
            return "fur4" if x < 30 else "fur3"
        if x in (12, 17, 31, 35) and 30 <= y <= 31:
            return "fur3"                               # folds in the roll
        return "bone" if x >= 26 else "white"
    paint(n, m, col)
    grizzle(n, {p for p in m if fur(*p)}, salt=5, light=36)


def eye_ring(ex, ey, eh, mirror):
    """Ring pixels for the left eye (top-left ex, ey, eh rows tall), and its mirror image
    (x -> mirror - x) for the right eye: the outer side, the bottom, and the snout side low
    down, so the smudge runs a little toward the snout."""
    left = [(ex - 1, ey + i) for i in range(eh)] + [(ex, ey + eh), (ex + 1, ey + eh)] + \
           [(ex + 2, ey + eh - 2), (ex + 2, ey + eh - 1), (ex + 2, ey + eh)]
    return left + [(mirror - x, y) for (x, y) in left]


def draw_eye_rings(n, ring):
    """The opossum's dark eye ring: a small fur1 smudge round each eye, never joined across
    the nose like a raccoon mask."""
    for p in ring:
        if n.get(p) in ("white", "bone", "fur4", "fur3"):
            n[p] = "fur1"


def draw_head(n, blink=False, stern=0):
    m = rows_mask(HEAD)
    paint(n, m, head_colour)
    grizzle(n, {p for p in m if not is_face(*p)}, salt=1)
    # small dark eyes (2 x 3, a glint) in dark rings, stern brows slanting in
    draw_eye_rings(n, eye_ring(EYES[0][0], EYES[0][1], 3, 47))
    for (ex, ey) in EYES:
        if blink:
            setpx(n, [(ex - 1, ey + 2), (ex, ey + 2), (ex + 1, ey + 2), (ex + 2, ey + 2)], "ink0")
            setpx(n, [(ex, ey + 1), (ex + 1, ey + 1)], "fur1")
            setpx(n, [(ex, ey), (ex + 1, ey)], "fur4")
        else:
            setpx(n, [(ex, y) for y in range(ey, ey + 3)] + [(ex + 1, y) for y in range(ey, ey + 3)], "ink0")
            setpx(n, [(ex, ey)], "white")
    lb = [(15, 12 - stern), (16, 12 - stern), (16, 13 - stern), (17, 13), (18, 13), (18, 14), (19, 14)]
    setpx(n, lb, "fur1")
    setpx(n, [(47 - x, y) for (x, y) in lb], "fur1")
    # whisker dots on the snout
    setpx(n, [(20, 24), (19, 26), (27, 24), (28, 26)], "fur3")
    # the pink nose, a glint, nostrils in shade
    setpx(n, [(x, 27) for x in range(22, 26)], "pink")
    setpx(n, [(x, 28) for x in range(20, 28)], "pink")
    setpx(n, [(x, 29) for x in range(21, 27)], "pink")
    setpx(n, [(21, 27)], "fur4")
    setpx(n, [(22, 27)], "white")
    setpx(n, [(22, 29), (25, 29)], "rust2")
    setpx(n, [(26, 28), (26, 29)], "rust3")


# ---------------------------------------------------------------- the tail

# a bare opossum tail: furred and near-black at the base, fading through grey into pink-grey
# skin (fur4 lit rim, pink core, rust2 shade at the tip)
TAIL = [  # (x, y, name): up from the hip, then an outward hook
    *[(x, y, c) for y in (45, 46, 47) for x, c in ((42, "fur2"), (43, "fur1"), (44, "ink1"))],
    *[(x, y, c) for y in (43, 44) for x, c in ((42, "fur2"), (43, "fur1"), (44, "fur1"))],
    *[(x, y, c) for y in (41, 42) for x, c in ((42, "fur3"), (43, "fur2"), (44, "fur1"))],
    *[(x, y, c) for y in (39, 40) for x, c in ((43, "fur4"), (44, "fur2"))],
    *[(x, y, c) for y in (37, 38) for x, c in ((43, "fur4"), (44, "pink"))],
    (43, 36, "fur4"), (44, 36, "pink"),
    (43, 35, "bone"), (44, 35, "pink"), (44, 34, "bone"), (45, 34, "pink"),
    (45, 33, "bone"), (46, 33, "pink"), (46, 34, "pink"), (46, 35, "rust2"), (46, 36, "rust2"),
]


def draw_tail(n, tail=TAIL):
    """A bare tail, dark and furred at the base, hooked at the tip."""
    body = {(x, y) for x, y, _ in tail}
    for (x, y) in body:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in body and 0 <= q[0] < W and 0 <= q[1] < H:
                n[q] = "ink0"
    for x, y, c in tail:
        n[(x, y)] = c


def suit_base():
    """The suit, the clipboard and the badge from the hood-down draft (rows 33 down)."""
    m = map_draft(load(DL / "cast_possum2_fromold_v1.png"), classify_generic())
    return {k: v for k, v in m.items() if k[1] >= 33}


# the paw on the clipboard: a dark furred wrist out of the sleeve, pink fingers
PAW = {"ink1": "rust1", "fur1": "rust2", "fur2": "pink", "fur3": "bone"}


def possum_idle_frames():
    frames = []
    for blink in (False, True):
        n = suit_base()
        for (x, y), v in list(n.items()):
            if 10 <= x <= 14 and 38 <= y <= 44 and v in PAW:
                n[(x, y)] = PAW[v]
        for (x, y), v in list(n.items()):               # the wrist: black opossum fur
            if 10 <= x <= 14 and 39 <= y <= 40 and v not in ("ink0",):
                n[(x, y)] = "fur2" if x == 11 and y == 39 else "fur1"
        # shoulders of the suit, under the collar
        sh = rows_mask({31: (8, 39), 32: (7, 40), 33: (7, 40), 34: (6, 41)})
        for p in sh:
            if p not in n:
                n[p] = "white" if p[0] < 24 else "bone"
        draw_ears(n)
        draw_neck(n)
        draw_collar(n)
        draw_head(n, blink=blink)
        n = shift_names(n, -2, 0)
        draw_tail(n)
        n = clean_outline(n, dark=("ink0", "ink1"))
        frames.append({k: v for k, v in n.items() if 0 <= k[0] < W and 0 <= k[1] < H})
    return frames


# ---------------------------------------------------------------- shutdown

SHUT_EARS = ((8.0, 8.0, 4), (34.0, 8.0, 37))      # ellipse centre and the last x the ear owns
SHUT_TAIL = {  # (x, y) -> name: the draft's pink tail, dark and furred at the base
    **{(x, y): c for y in (44, 45) for x, c in ((41, "fur2"), (42, "fur1"), (43, "ink1"))},
    (40, 46): "fur2", (41, 46): "fur1", (42, 46): "ink1",
    (39, 47): "fur2", (40, 47): "fur1", (41, 47): "fur1", (42, 47): "ink1",
    **{(x, y): c for y in (41, 42, 43) for x, c in ((41, "fur3"), (42, "fur2"), (43, "fur1"))},
    (42, 40): "fur4", (43, 40): "fur2",
    **{(x, y): c for y in (37, 38, 39) for x, c in ((42, "fur4"), (43, "pink"))},
}


def possum_shutdown():
    """From the edit of the finished idle (clipboard up, hard frown). The edit turned the collar
    pink and gave him a second badge: the collar goes back to white, the extra badge comes off.
    Then the opossum pass: black ears, eye rings, grizzled cheeks and neck, a dark tail base."""
    m = map_draft(load(DL / "cast_possum2_shutdown_v1.png"), classify_generic())
    for (x, y), v in list(m.items()):
        if 24 <= y <= 32 and 8 <= x <= 33 and v in ("pink", "rust1", "rust2", "red", "rust3"):
            m[(x, y)] = ("white" if x < 22 else "bone") if v == "pink" else "fur3"
        if 13 <= x <= 19 and 34 <= y <= 41 and v not in ("ink0",):
            m[(x, y)] = "white" if x != 21 else v
    m = clean_outline(drop_orphans(m), dark=("ink0", "ink1"))
    # black ears (the right one is cut off by the clipboard at x 37)
    for cx, cy, last in SHUT_EARS:
        ear = {p for p in ellipse_mask(cx, cy, 4.9, 5.4) if p[1] <= 12 and (p[0] <= last if cx > 20 else True)}
        e = {p for p in ear if m.get(p) == "ink0"} | {p for p in ear if p not in m}
        for p in ear:
            if m.get(p) in ("pink", "bone", "rust2", "rust1"):
                m[p] = ear_colour(p[0], p[1], cx, cy, e, tip_rows=2.5)
    # grizzled grey crown and cheeks, the neck between the face and the collar
    grey = {p for p, v in m.items() if v in ("fur1", "fur2", "fur3") and 6 <= p[1] <= 27 and 8 <= p[0] <= 33}
    grizzle(m, grey, salt=11)
    # the white face narrows into a snout: the outer cheeks under the eyes go grey
    for (x, y) in [(13, 19), (14, 19), (12, 20), (13, 20), (14, 20), (15, 20), (13, 21), (14, 21),
                   (15, 21), (16, 21), (15, 22), (16, 22), (17, 22), (16, 23), (17, 23), (16, 24)]:
        if m.get((x, y)) in ("white", "bone"):
            m[(x, y)] = "fur3" if (x + y) % 3 else "fur2"
    for (x, y) in [(28, 19), (29, 19), (27, 20), (28, 20), (29, 20), (30, 20), (26, 21), (27, 21),
                   (28, 21), (29, 21), (25, 22), (26, 22), (27, 22), (28, 22), (26, 23), (27, 23),
                   (26, 24), (27, 24)]:
        if m.get((x, y)) in ("white", "bone", "fur4"):
            m[(x, y)] = "fur2" if (x + y) % 3 else "fur1"
    # eye rings (the eyes are 2 x 2 at x 15-16 and 26-27, rows 16-17)
    draw_eye_rings(m, eye_ring(15, 16, 2, 42))
    # the tail: furred and dark at the base, into pink-grey skin
    for p, c in SHUT_TAIL.items():
        if p in m and m[p] != "ink0":
            m[p] = c
    return {k: v for k, v in m.items() if 0 <= k[0] < W and 0 <= k[1] < H}
