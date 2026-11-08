"""possum_dead: Inspector Possum playing dead (48 x 48): flat on his back, head on the left with
the long snout pointing up, X eye, tongue out, four stiff legs in the air, the tail limp on
the ground, the clipboard dropped. Drawn by hand: the PixelLab edit
art-src/dl/cast_possum2_dead_v1.png lay him out straight with his legs pointing sideways, which
did not read as "playing dead". Used by build.py.

M7b (critic N-P2-15, "white lab rat"): a black ear with a pink rim, a dark eye-ring smudge on
the snout side of the X eye, a grizzled grey crown, black furred legs out of the suit's cuffs with pink paws, and a tail that
is dark at the base and pink-grey at the tip.
"""
from possum import *  # noqa: F401,F403

# The head is designed standing, in profile facing right (local x right = the snout, local y
# down = the chin), then turned a quarter left so the snout points up and the crown points left.
HEAD_P = {0: (3, 8), 1: (1, 10), 2: (0, 12), 3: (0, 14), 4: (0, 15), 5: (0, 16), 6: (0, 17), 7: (0, 17),
          8: (0, 16), 9: (0, 15), 10: (1, 13), 11: (3, 10)}
OX, OY = 5, 44          # where local (0, 0) lands: X = OX + y, Y = OY - x


def turn(x, y):
    return OX + y, OY - x


def head_local():
    m = rows_mask(HEAD_P)
    e = edge(m)
    out = {}
    for (x, y) in m:
        if (x, y) in e:
            c = "ink0"
        elif x <= 3 or (x <= 8 and y <= 2) or (x <= 6 and y <= 4):
            c = "fur2" if y <= 8 else "fur1"
        elif x >= 13 and 4 <= y <= 9 and x - 13 >= abs(y - 6.5) - 1.5:
            c = "pink"
        elif y >= 9:
            c = "fur4"
        elif y >= 7 and x <= 9:
            c = "bone"
        else:
            c = "white"
        out[(x, y)] = c
    out[(15, 5)] = "white"                      # nose glint
    out[(15, 8)] = "rust2"
    out[(16, 7)] = "rust2"
    return out


def draw_dead_head(n):
    # the ear first (it lies flat behind the head, on the ground side): bare and black, its tip
    # (the left end) rimmed pink, the top edge lit
    ear = ellipse_mask(5.0, 41.5, 3.2, 2.8)
    ee = edge(ear)
    for (x, y) in ear:
        if (x, y) in ee:
            c = "ink0"
        elif (x - 1, y) in ee and x <= 4:
            c = "pink"                                  # the rim of the tip
        elif (x, y - 1) in ee:
            c = "ink2"                                  # lit top edge
        else:
            c = "ink1"
        n[(x, y)] = c
    head = {}
    for (x, y), c in head_local().items():
        X, Y = turn(x, y)
        n[(X, Y)] = c
        head[(X, Y)] = c
    # lit edge of the turned head: the crown side (left) catches the streetlight
    for (X, Y), c in list(n.items()):
        if c == "fur2" and n.get((X - 1, Y)) == "ink0":
            n[(X, Y)] = "fur3"
    grizzle(n, {p for p, c in head.items() if c in ("fur1", "fur2")} | {p for p in head if n.get(p) == "fur3"},
            salt=21, light=34)
    # the X eye
    ex, ey = turn(8, 3)
    for d in (-1, 0, 1):
        n[(ex + d, ey + d)] = "ink0"
        n[(ex + d, ey - d)] = "ink0"
    for p in ((ex, ey - 1), (ex - 1, ey), (ex + 1, ey), (ex, ey + 1)):
        n[p] = "white"
    # the dark eye ring, a smudge on the snout side (up) of the X only, so the X stays clear
    for p in ((ex - 1, ey - 2), (ex, ey - 2), (ex + 1, ey - 2), (ex + 2, ey - 2)):
        if n.get(p) in ("white", "bone", "fur4"):
            n[p] = "fur1"
    # the tongue, flopped out of the side of the mouth and hanging down over the collar
    mx, my = turn(12, 10)
    tongue = {(mx + 1, my): "pink", (mx + 2, my): "pink", (mx + 1, my + 1): "pink", (mx + 2, my + 1): "rust3",
              (mx + 1, my + 2): "pink", (mx + 2, my + 2): "rust3", (mx + 1, my + 3): "pink", (mx + 2, my + 3): "rust2"}
    n.update(tongue)
    for (x, y) in list(tongue):
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + d[0], y + d[1])
            if q not in tongue and n.get(q) not in ("white", "bone", "fur4", "pink"):
                n[q] = "ink0"


BODY_ROWS = {31: (19, 36), 32: (17, 38), 33: (16, 39), 34: (16, 39), 35: (16, 40), 36: (16, 40),
             37: (16, 40), 38: (16, 40), 39: (16, 40), 40: (16, 40), 41: (16, 39), 42: (17, 39),
             43: (18, 38), 44: (20, 36)}


def draw_dead_body(n):
    m = rows_mask(BODY_ROWS)
    e = edge(m)
    for (x, y) in m:
        if (x, y) in e:
            c = "ink0"
        elif y <= 33:
            c = "white"
        elif y >= 41:
            c = "fur3"
        elif y >= 38:
            c = "fur4" if x < 36 else "fur3"
        else:
            c = "bone" if x >= 33 else "white"
        n[(x, y)] = c
    setpx(n, [(x, 35) for x in range(19, 37) if x % 3 != 0], "fur4")         # the zip along his front
    setpx(n, [(27, 32), (28, 32)], "yellow")                                 # the tiny badge
    setpx(n, [(27, 33), (28, 33)], "sodium2")
    setpx(n, [(27, 31)], "sodium3")
    # the rolled-down hood: a fat collar between head and body
    col = rows_mask({32: (15, 18), 33: (14, 19), 34: (14, 19), 35: (14, 19), 36: (14, 19), 37: (14, 19),
                     38: (14, 19), 39: (14, 19), 40: (14, 19), 41: (14, 19), 42: (15, 18)})
    ce = edge(col)
    for (x, y) in col:
        n[(x, y)] = "ink0" if (x, y) in ce else ("white" if y <= 36 else "fur3" if y >= 40 else "bone")
    setpx(n, [(16, 35), (17, 38)], "fur3")


LEGS = [(18, "far"), (22, "near"), (31, "far"), (35, "near")]      # x of each leg's left column
CUFF = 29                                                          # the suit's legs end here


def draw_legs(n):
    for x0, kind in LEGS:
        lean = -1 if x0 < 25 else 1
        top = 20 if kind == "near" else 21
        leg = set()
        for y in range(top + 2, 33):
            dx = lean if y < 25 else 0
            leg |= {(x0 + dx, y), (x0 + 1 + dx, y)}
        paw = {(x0 - 1 + lean, top), (x0 + lean, top), (x0 + 1 + lean, top), (x0 + 2 + lean, top),
               (x0 + lean, top + 1), (x0 + 1 + lean, top + 1), (x0 - 1 + lean, top + 1), (x0 + 2 + lean, top + 1)}
        part = leg | paw
        for (x, y) in part:
            for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + d[0], y + d[1])
                if q not in part and (q not in n or n[q] != "ink0" and q[1] < 31):
                    n[q] = "ink0"
        for (x, y) in leg:
            first = (x - 1, y) not in leg
            if y >= CUFF:                                   # the suit's leg, up to a cuff
                c = ("white" if first else "bone") if kind == "near" else ("fur4" if first else "fur3")
            elif kind == "near":                            # black opossum fur, lit on the left
                c = "fur2" if first else "fur1"
            else:
                c = "fur1" if first else "ink2"
            n[(x, y)] = c
        for (x, y) in leg:                                  # a pale hair or two
            if y < CUFF - 1 and (x - 1, y) not in leg and fur_hash(x, y, 31) < 30:
                n[(x, y)] = UP[n[(x, y)]]
        for (x, y) in paw:
            n[(x, y)] = "pink" if kind == "near" or y == top else "rust2"
        n[(x0 - 1 + lean, top)] = "fur4" if kind == "near" else "pink"     # lit toe


def draw_dead_tail(n):
    """Limp on the ground to the right of him, a lazy curl at the tip: dark and furred at the
    base, bare pink-grey skin to the tip."""
    pts = [(40, 41), (41, 42), (42, 43), (43, 44), (44, 44), (45, 43), (45, 42), (44, 41)]
    top = ["fur2", "fur2", "fur3", "fur4", "pink", "pink", "pink", "pink"]      # lit side
    under = ["ink1", "fur1", "fur1", "fur2"]                                  # shade side
    body = {}
    for i, p in enumerate(pts):
        body[p] = top[i]
        if i < 4:
            body[(p[0], p[1] + 1)] = under[i]
    body[(44, 41)] = "rust2"
    for k, c in body.items():
        n[k] = c
    for (x, y) in list(body):
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + d[0], y + d[1])
            if q not in body and (q not in n):
                n[q] = "ink0"


def draw_dropped_clipboard(n):
    """Fallen flat in front of him: a brown board seen at a slant, the form, the steel clip."""
    rows = {43: (25, 35), 44: (24, 35), 45: (23, 34), 46: (23, 33)}
    m = rows_mask(rows)
    e = edge(m)
    for (x, y) in m:
        n[(x, y)] = "ink0" if (x, y) in e else ("card2" if y == 44 else "card1")
    setpx(n, [(27, 45), (28, 45), (29, 45), (31, 45), (32, 45)], "bone")
    setpx(n, [(29, 44), (30, 44)], "steel3")
    setpx(n, [(29, 43), (30, 43)], "steel2")
    setpx(n, [(28, 42), (29, 42), (30, 42), (31, 42)], "ink0")


def possum_dead():
    n = {}
    draw_dead_tail(n)
    draw_legs(n)
    draw_dead_body(n)
    draw_dead_head(n)
    draw_dropped_clipboard(n)
    return {k: v for k, v in n.items() if 0 <= k[0] < W and 0 <= k[1] < H}
