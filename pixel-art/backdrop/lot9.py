"""Lot 9 at night, widened: the v1 backdrop (its stage part keeps the old look pixel for pixel
where it can), with the sky, the heaps, the fence and the lane carried out sideways, more stars
above, the dirt carried down, and a few dim things in the margins: a billboard and a water tower
on the horizon, tyres, a drum, a cone and a cart on the ground, ruts and a puddle below.
"""
import math
import random

from pano import (LAMP, SKY_H, SW, X0, X1, Pano, cart, cobra_lamp, cone, dirt_lane, dith, drum,
                  far_gull, fence, ground, heap_line, lamp_cone, light_pool, puddle, rim_lines,
                  ruts, shade_mask, rect_mask, sky, text3, tire_stack, verge_weeds)


def far_heaps(x):
    return heap_line(x, 1, 46, 18)


def near_heaps(x):
    return heap_line(x, 2, 55, 14)


def water_tower(p, x, top):
    """A far water tower behind the heaps (right margin): night1 with a night2 left edge."""
    for leg in (x + 2, x + 7, x + 13, x + 18):
        p.vline(leg, top + 12, SKY_H, "night1")
    for y in range(top + 16, SKY_H, 7):
        p.line(x + 2, y, x + 18, y + 4, "night1")
    tank = rect_mask(x, top + 3, 21, 10)
    tank |= {(xx, top + 2) for xx in range(x + 2, x + 19)} | {(xx, top + 1) for xx in range(x + 6, x + 15)}
    for (xx, yy) in tank:
        p.set(xx, yy, "night2" if xx < x + 3 or yy == top + 1 else "night1")
    p.hline(x - 1, x + 22, top + 12, "night2")
    p.set(x + 10, top, "night2")
    p.set(x + 10, top - 1, "red")                     # the aircraft light


def billboard(p, x, y):
    """A sagging billboard behind the fence (left margin): LOT 9 / COUNTY DUMP."""
    for post in (x + 8, x + 44):
        p.vline(post, y + 16, SKY_H, "ink2")
        p.vline(post + 1, y + 16, SKY_H, "night1")
    board = rect_mask(x, y, 54, 17)
    shade_mask(p, board, "night1", lit="night2", shade="ink2", outline="ink1")
    text3(p, x + 5, y + 3, "LOT 9", "night3")
    text3(p, x + 5, y + 10, "COUNTY DUMP", "night2")
    for k in range(5):                                # a torn corner
        p.set(x + 53 - k, y + 16 - k // 2, "night0")


def build(flicker=False):
    p = Pano()
    rnd = random.Random(9)                            # the v1 sequence, for the stage part
    lx, ly = LAMP
    glow = 0.55 if flicker else 1.0

    # --- the sky and its stars
    sky(p, rnd, seed=109)
    for gx, gy in ((300, 14), (311, 11), (452, 19), (-90, -40), (-80, -44), (700, -70)):
        far_gull(p, gx, gy)

    # --- on the horizon, behind the heaps: the billboard and the water tower (margins)
    billboard(p, -132, 6)
    water_tower(p, 708, 6)

    # --- far heaps, then near heaps with junk on top
    far = {x: far_heaps(x) for x in range(X0, X1)}
    near = {x: near_heaps(x) for x in range(X0, X1)}
    for x in range(X0, X1):
        for y in range(far[x], SKY_H):
            p.set(x, y, "night1" if y > far[x] else "night2")
        for y in range(near[x], SKY_H):
            p.set(x, y, "ink2" if y > near[x] else "night1")
    r2 = random.Random(209)
    for x in range(X0, X1):                           # junk texture on the near heaps
        rr = rnd if 0 <= x < SW else r2
        for y in range(near[x] + 2, SKY_H):
            if rr.random() < 0.05:
                p.set(x, y, "night1")

    def ring(cx, cy, r, c):
        for a in range(0, 360, 8):
            p.set(round(cx + r * math.cos(math.radians(a))), round(cy + r * math.sin(math.radians(a))), c)
    for cx in (140, 380, 560, -64, 676, 772):         # tyres
        cy = near[cx] - 3
        ring(cx, cy, 4, "ink2"); ring(cx, cy, 3, "ink2")
        p.set(cx - 1, cy - 4, "night2"); p.set(cx - 3, cy - 3, "night2")
    for fx in (250, 505, -118, 740):                  # fridges
        top = near[fx] - 9
        for y in range(top, near[fx] + 1):
            for x in range(fx, fx + 6):
                p.set(x, y, "ink2")
        for y in range(top, near[fx]):
            p.set(fx, y, "night2")
    for cx in (430, -30):                             # a cart on its side
        for x in range(cx, cx + 10):
            p.set(x, near[cx] - 6, "ink2"); p.set(x, near[cx] - 2, "ink2")
        for x in range(cx, cx + 11, 3):
            for y in range(near[cx] - 6, near[cx] - 1):
                p.set(x, y, "ink2")
    for sx, ln in ((200, 7), (330, 5), (600, 8), (-150, 6), (-96, 7), (650, 6), (788, 5)):   # sticks, pipes
        for k in range(ln):
            p.set(sx + k // 2, near[sx] - k, "ink2")

    # --- the chain-link fence
    fence(p)

    # --- the lane, the weeds on its verge
    dirt_lane(p, rnd, seed=309)
    verge_weeds(p, rnd, seed=409)

    # --- the ground below, margins and all
    ground(p, rnd, seed=509)

    # --- the streetlight's pool, its cone through the air, the warm rim on the heaps
    light_pool(p, glow)
    lamp_cone(p, glow)
    rim_lines(p, [far_heaps, near_heaps], glow)

    # --- the streetlight
    cobra_lamp(p, flicker)

    # --- the margins on the ground: dim junk, ruts, a puddle
    tire_stack(p, -40, 196, n=3)
    tire_stack(p, -36, 202, n=1)
    drum(p, -96, 262)
    drum(p, -84, 268, base="steel0", lit="steel1")
    cone(p, -122, 156)
    cart(p, 660, 214)
    tire_stack(p, 702, 300, n=2)
    drum(p, 752, 180, base="grime0", lit="grime1")
    cone(p, 676, 330)
    for k, y in enumerate((382, 398)):
        ruts(p, y, phase=k * 1.7)
        ruts(p, y + 1, phase=k * 1.7, c="ink1")
    puddle(p, -70, 420, 26)
    puddle(p, 720, 446, 18)
    puddle(p, 300, 470, 34)
    for (x, y) in ((140, 430), (520, 412), (-130, 380), (770, 470)):     # bottle caps, a can
        p.set(x, y, "rust1"); p.set(x + 1, y, "rust0")
    for x in range(588, 594):                                            # a flattened can
        p.set(x, 452, "steel0")
    p.set(588, 451, "steel1")
    return p.image()
