"""possum_walk: Inspector Possum walking onto the lot (32 x 32, 4 frames, side view facing right).

He walks on as the Stink warning: upright, the clipboard held up in front, the bare tail
swinging behind. M7b (critic N-P2-15): a black ear with a pink rim, a dark eye ring, a grizzled
grey crown and nape, black furred legs below the suit's shorts with pink feet, and a tail dark at
the base into pink-grey. Drawn by hand (the PixelLab draft art-src/dl/cast_possum2_walk_v1.png was a
muddle at 32 px and is only a proportion reference). Frames: contact, passing (body up 1 px),
contact (other leg), passing. Used by build.py.
"""
from possum import *  # noqa: F401,F403

WW = WH = 32


def poly_mask(pts):
    """Pixels whose centres fall inside a polygon (even-odd)."""
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    out = set()
    for y in range(int(min(ys)) - 1, int(max(ys)) + 2):
        for x in range(int(min(xs)) - 1, int(max(xs)) + 2):
            cx, cy, inside = x + 0.5, y + 0.5, False
            for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
                if (y0 > cy) != (y1 > cy) and cx < x0 + (cy - y0) * (x1 - x0) / (y1 - y0):
                    inside = not inside
            if inside:
                out.add((x, y))
    return out


def outline_over(n, mask):
    """ink0 around a part, on transparent pixels only (parts behind keep their own lines)."""
    for (x, y) in mask:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in mask and q not in n:
                n[q] = "ink0"


HEAD_W = {2: (12, 15), 3: (11, 17), 4: (10, 18), 5: (10, 20), 6: (10, 22), 7: (10, 24), 8: (10, 26),
          9: (10, 27), 10: (10, 27), 11: (11, 25), 12: (12, 21)}


def walk_head(n, dy):
    """Profile head facing right: grizzled grey crown, white face, a long cone snout with a
    pink nose, a beady eye in a dark ring, a bare black ear at the top-back."""
    head = rows_mask({y + dy: r for y, r in HEAD_W.items()})
    he = edge(head)
    for (x, y) in head:
        if (x, y) in he:
            n[(x, y)] = "ink0"
            continue
        yy = y - dy
        if x <= 12 or (x <= 15 and yy <= 5) or (x <= 13 and yy <= 7):
            lit = (x, y - 1) in he or (x - 1, y) in he and yy <= 7
            c = "fur3" if lit else ("fur1" if yy >= 10 or x == 11 and yy >= 8 else "fur2")
        elif x >= 24 and 8 <= yy <= 11:
            c = "pink"
        elif yy == 11:
            c = "fur4"
        elif yy == 10 and x <= 16:
            c = "bone"
        else:
            c = "white"
        n[(x, y)] = c
    grizzle(n, {p for p in head if n.get(p) in ("fur1", "fur2", "fur3")}, salt=41, light=34)
    setpx(n, [(25, 8 + dy)], "white")                                 # nose glint
    setpx(n, [(26, 10 + dy), (25, 11 + dy)], "rust2")
    setpx(n, [(17, 6 + dy), (17, 7 + dy), (18, 8 + dy), (19, 8 + dy), (20, 7 + dy),
              (20, 8 + dy)], "fur1")                                  # the dark eye ring
    setpx(n, [(18, 6 + dy), (18, 7 + dy), (19, 7 + dy)], "ink0")       # the beady eye
    setpx(n, [(17, 5 + dy), (18, 5 + dy)], "fur1")                    # stern brow
    setpx(n, [(22, 11 + dy)], "ink0")                                 # mouth corner
    ear = ellipse_mask(12.5, 2.6 + dy, 2.9, 3.1)                      # the near ear, over the crown
    ee = edge(ear)
    for (x, y) in ear:
        n[(x, y)] = "ink0" if (x, y) in ee else ear_colour(x, y, 12.5, 2.6 + dy, ee, tip_rows=0.5)
    return head


def walk_body(n, dy):
    """The suit: torso and the rolled hood at the neck."""
    rows = {13: (12, 18), 14: (11, 19), 15: (10, 20), 16: (10, 20), 17: (10, 20), 18: (10, 20),
            19: (10, 20), 20: (10, 20), 21: (10, 20), 22: (10, 20), 23: (11, 19), 24: (12, 18)}
    torso = rows_mask({y + dy: r for y, r in rows.items()})
    te = edge(torso)
    for (x, y) in torso:
        yy = y - dy
        n[(x, y)] = "ink0" if (x, y) in te else (
            "fur3" if x <= 11 or yy >= 23 else "bone" if x <= 13 else "white")
    collar = rows_mask({12 + dy: (12, 19), 13 + dy: (11, 20), 14 + dy: (11, 20), 15 + dy: (12, 19)})
    ce = edge(collar)
    for (x, y) in collar:
        bottom = y == 15 + dy and 13 <= x <= 18
        n[(x, y)] = "fur3" if bottom else "ink0" if (x, y) in ce else ("fur3" if y == 14 + dy or x <= 12 else "white")
    setpx(n, [(18, 16 + dy)], "yellow")                               # the tiny badge
    return torso | collar


def walk_clipboard(n, dy):
    """The clipboard held up in front of his chest, a pink paw on its edge."""
    board = rows_mask({y + dy: (20, 25) for y in range(13, 22)})
    be = edge(board)
    for (x, y) in board:
        yy = y - dy
        n[(x, y)] = "ink0" if (x, y) in be else (
            "card2" if x == 21 or yy == 14 else "card0" if x == 24 else "card1")
    setpx(n, [(22, 15 + dy), (23, 15 + dy), (22, 17 + dy), (23, 17 + dy), (22, 19 + dy)], "bone")  # the form
    setpx(n, [(22, 12 + dy), (23, 12 + dy)], "steel3")                                  # the clip
    setpx(n, [(21, 12 + dy), (24, 12 + dy), (22, 11 + dy), (23, 11 + dy)], "ink0")
    # the arm: a short sleeve forward from the shoulder, a pink paw over the board's edge
    setpx(n, [(x, 18 + dy) for x in range(15, 20)], "white")
    setpx(n, [(x, 19 + dy) for x in range(15, 20)], "fur3")
    setpx(n, [(x, 17 + dy) for x in range(16, 19)], "fur3")          # a fold, not a line, on top
    setpx(n, [(19, 17 + dy)] + [(x, 20 + dy) for x in range(16, 20)], "ink0")
    setpx(n, [(20, 18 + dy), (20, 19 + dy)], "pink")
    setpx(n, [(21, 18 + dy)], "bone")
    setpx(n, [(20, 17 + dy), (20, 20 + dy), (21, 19 + dy)], "ink0")


def walk_tail(n, dy, swing):
    """Bare tail from the lower back, sweeping left and down, the tip curling up: dark and
    furred at the base, pink-grey skin to the tip."""
    pts = [(9, 21), (8, 22), (7, 23), (6, 23), (5, 24), (4, 25), (3, 25 + swing), (2, 24 + swing),
           (2, 23 + swing)]
    top = ["fur2", "fur2", "fur3", "fur4", "fur4", "pink", "pink", "pink", "pink"]   # lit side
    under = ["ink1", "fur1", "fur1", "fur2"]                                         # shade side
    body = {}
    for i, (x, y) in enumerate(pts):
        body[(x, y + dy)] = top[i]
        if i < 4:
            body[(x, y + 1 + dy)] = under[i]
    body[(2, 23 + swing + dy)] = "rust2"
    for k, c in body.items():
        n[k] = c
    outline_over(n, set(body))


FAR_LEG = ("fur3", "fur4", "fur1", "ink2", "rust2", "pink")

# (hip x, foot x, foot lift) for the far leg, then the near leg
LEG_POSES = {0: ((12, 9, 0), (16, 19, 0)), 1: ((13, 14, 2), (15, 15, 0)),
             2: ((12, 16, 0), (15, 11, 0)), 3: ((14, 14, 0), (14, 16, 2))}


def walk_legs(n, phase, dy):
    """phase 0: near leg forward; 1: passing; 2: near leg back; 3: passing (near leg lifted)."""
    for li, (hip, foot, lift) in enumerate(LEG_POSES[phase]):
        near = li == 1
        top, bot = 24 + dy, 29 - lift
        leg = set()
        for y in range(top, bot + 1):
            t = (y - top) / max(1, bot - top)
            x = round(hip + (foot - hip) * t)
            leg |= {(x, y), (x + 1, y)}
        foot_px = {(foot, bot + 1), (foot + 1, bot + 1), (foot + 2, bot + 1)}
        part = leg | foot_px
        for (x, y) in leg:
            lit = (x - 1, y) not in leg
            if y <= top + 2:                                    # the suit's shorts
                if near:
                    n[(x, y)] = "bone" if lit else "white"
                else:
                    n[(x, y)] = "fur4" if lit else "fur3"
            elif near:                                          # black opossum legs
                n[(x, y)] = "fur2" if lit else "fur1"
            else:
                n[(x, y)] = "fur1" if lit else "ink2"
        for p in foot_px:
            n[p] = "pink" if near else "rust2"
        n[(foot, bot + 1)] = "fur4" if near else "pink"
        for (x, y) in part:
            for dx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + ddy)
                if q not in part and (q not in n or near and n[q] in FAR_LEG):
                    n[q] = "ink0"


def possum_walk_frames():
    frames = []
    for phase in range(4):
        dy = -1 if phase in (1, 3) else 0
        n = {}
        walk_tail(n, dy, 1 if phase in (1, 3) else 0)
        walk_legs(n, phase, dy)
        walk_body(n, dy)
        walk_head(n, dy)
        walk_clipboard(n, dy)
        n = shift_names(n, 1, 1)
        frames.append({k: v for k, v in n.items() if 0 <= k[0] < WW and 0 <= k[1] < WH})
    return frames
