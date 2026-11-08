"""king_portrait: the Trash King for the finale (96 x 96, 2 frames: frame 2 the crown shimmers).
Critic P2-14: The End used a 3x nearest upscale of the 28 px item; this is a real portrait that
matches it: a chubby raccoon on a stained-mattress throne, a hubcap crown with gold points, a
red cape and a plunger sceptre. Majestic and ridiculous. Used by build.py.

Inputs (never edited), art-src/dl/:
  cast_king_portrait_v1.png   create_image_pixen 96 x 96 (a raccoon king on a gold throne)
  cast_king_portrait_v2.png   edit_image_pixen of v1: mattress throne, hubcap, plunger, cape
The palette map keeps the greys on the fur ramp (the draft's dark greys sit near grime), and
the hubcap, which the edit stood up on its edge like a wheel, is redrawn as a crown: a tilted
silver disc with five gold points.
"""
from possum import *  # noqa: F401,F403

KW = KH = 96
GREYS = ["fur0", "fur1", "fur2", "fur3", "fur4", "bone", "white"]


def king_cls(x, y, hsv_, p):
    h, s, v = hsv_
    if v < 0.09:
        return "ink0"
    if (h < 20 or h > 340) and s > 0.5:                       # the cape and the plunger cup
        return "rust0" if v < 0.44 else "rust1" if v < 0.6 else "rust2" if v < 0.77 else "red"
    if 180 <= h <= 240 and s > 0.12:                          # ticking stripes
        return "steel2" if v < 0.78 else "steel3"
    if 15 <= h <= 50 and s > 0.75 and v > 0.75:               # gold
        return "sodium2" if v < 0.9 else "yellow"
    if 10 <= h <= 50 and s > 0.42:                            # stains, the sceptre's stick
        return "sodium0" if v < 0.45 else "card1" if v < 0.53 else "card2" if v < 0.62 else "card3"
    if s < 0.32:
        return pick(GREYS, p)
    return classify_generic()(x, y, hsv_, p)


def raw():
    return map_draft(load(DL / "cast_king_portrait_v2.png"), king_cls)


def redraw_crown(n):
    """Clear the edge-on hubcap, mend the mattress and the forehead behind it, then put a
    proper hubcap crown on: five gold points standing behind a tilted silver disc (slots, hub)."""
    for (x, y), v in list(n.items()):
        if 37 <= x <= 59 and y <= 28:
            if y <= 9:
                del n[(x, y)]
            elif y == 10:
                n[(x, y)] = "ink0"                                  # the mattress's top edge
            elif y <= 19:
                n[(x, y)] = "steel3" if x in (42, 49, 56) else ("bone" if y > 11 else "white")
            elif 41 <= x <= 55 and y >= 21:                         # the forehead behind the crown
                n[(x, y)] = "fur1" if 47 <= x <= 49 else "fur3" if x <= 43 and y <= 24 else "fur2"
    cx, cy, rx, ry = 48.0, 20.5, 12.4, 4.9
    # gold points first, so the disc's rim sits in front of their feet
    for px_, h_ in ((38, 5), (43, 7), (48, 9), (53, 7), (58, 5)):
        top = 18 - h_
        pts = set()
        for k in range(h_ + 1):
            half = 0 if k < 2 else 1
            for x in range(px_ - half, px_ + half + 1):
                pts.add((x, top + k))
        for (x, y) in pts:
            for d in ((1, 0), (-1, 0), (0, -1), (0, 1)):
                q = (x + d[0], y + d[1])
                if q not in pts:
                    n[q] = "ink0"
        for (x, y) in pts:
            n[(x, y)] = "sodium3" if x < px_ else "yellow" if x == px_ else "sodium2"
        n[(px_, top)] = "white" if px_ == 48 else "sodium3"         # the tips catch the light
    disc = ellipse_mask(cx, cy, rx, ry)
    de = edge(disc)
    for (x, y) in disc:
        if (x, y) in de:
            n[(x, y)] = "ink0"
            continue
        dx, dy = x - cx, y - cy
        r = (dx / rx) ** 2 + (dy / ry) ** 2
        if r > 0.6:                                                 # the rim, lit top-left
            c = "white" if dy < -1.5 and dx < 2 else "steel3" if dy < 0.5 else "steel1" if dy > 2 else "steel2"
        elif r < 0.1:
            c = "steel3"                                            # the hub
        else:
            c = "steel2" if dx < 2 and dy < 1.5 else "steel1"
        n[(x, y)] = c
    n[(48, 21)] = "ink1"; n[(47, 20)] = "white"; n[(49, 21)] = "steel1"   # hub nut + glint
    for sx, sy in ((41, 20), (41, 21), (55, 20), (55, 21), (44, 23), (52, 23), (45, 18), (51, 18)):
        n[(sx, sy)] = "steel0"                                      # the slots
    for x in range(40, 57):                                         # a shadow on the forehead
        if n.get((x, 26)) in ("fur2", "fur3", "fur1") and n.get((x, 25)) == "ink0":
            n[(x, 26)] = "fur1"


def king_frames():
    n = raw()
    redraw_crown(n)
    n = clean_outline(drop_orphans(n, keep=("white", "sodium3", "yellow")), dark=("ink0", "ink1", "fur0"))
    a = {k: v for k, v in n.items() if 0 <= k[0] < KW and 0 <= k[1] < KH}
    # frame 2: the shimmer: glints run along the crown's points and rim, the plunger handle shines
    b = dict(a)
    for p in ((43, 13), (53, 13), (48, 12), (40, 17), (56, 18), (52, 16)):
        if b.get(p) not in (None, "ink0"):
            b[p] = "white"
    for p in ((48, 9), (43, 11), (53, 11)):
        if b.get(p) not in (None, "ink0"):
            b[p] = "sodium2"                                       # the tips dim while the rim flashes
    for p in ((33, 8), (63, 9), (32, 9), (34, 9), (33, 10), (62, 10), (64, 10), (63, 11)):
        if p not in b:
            b[p] = "sodium3" if p in ((33, 9), (63, 10)) else "sodium2"
    b[(33, 9)] = "white"; b[(63, 10)] = "white"
    return a, b
