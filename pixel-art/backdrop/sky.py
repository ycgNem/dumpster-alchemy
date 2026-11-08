"""Sky sprites for the backdrop atlas (critic P1-7: a night needs a visible signature):
  moon      32 x 32, 1 frame   a big full moon, warm-grey face, a sodium rim on its top-left
  gull_fly  16 x 16, 2 frames  a small gull flapping across the sky (wings up, wings down),
                               facing right, with a sodium rim on its top-left so it reads on night0
Drawn by hand, used by build.py (packed into public/art/backdrop.png beside `backdrop`).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "anchor"))
from kit import *  # noqa: E402,F403


def disc(cx, cy, rx, ry):
    out = set()
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                out.add((x, y))
    return out


def edge4(mask):
    return {(x, y) for (x, y) in mask
            if any((x + dx, y + dy) not in mask for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}


# ---------------------------------------------------------------- the moon

MARIA = [(19.5, 10.5, 4.2, 3.0), (11.0, 13.0, 3.2, 2.4), (20.5, 19.5, 5.0, 3.2), (12.5, 21.5, 2.6, 1.8)]
CRATERS = [(8.5, 8.5, 1.6), (24.5, 13.5, 1.4), (16.5, 26.0, 1.8), (6.5, 18.5, 1.2), (26.0, 22.5, 1.2)]


def moon():
    cx = cy = 15.5
    body = disc(cx, cy, 14.6, 14.6)
    e = edge4(body)
    n = {}
    for (x, y) in body:
        if (x, y) in e:
            n[(x, y)] = "ink0"
            continue
        t = ((x - cx) + (y - cy)) / 29.0                  # -0.5 top-left .. 0.5 bottom-right
        n[(x, y)] = "bone" if t < -0.28 else "fur4" if t < 0.22 else "fur3"
    for (mx, my, rx, ry) in MARIA:                         # the seas, a shade down
        for p in disc(mx, my, rx, ry):
            if p in n and n[p] != "ink0":
                n[p] = {"bone": "fur4", "fur4": "fur3", "fur3": "fur2"}[n[p]]
    for (kx, ky, r) in CRATERS:                            # craters: dark top-left wall, lit lower-right lip
        for (x, y) in disc(kx, ky, r, r):
            if n.get((x, y)) in (None, "ink0"):
                continue
            n[(x, y)] = "fur3" if n[(x, y)] in ("bone", "fur4") else "fur2"
        for p in ((round(kx + r * 0.7), round(ky + r * 0.7)), (round(kx + r), round(ky)), (round(kx), round(ky + r))):
            if n.get(p) not in (None, "ink0"):
                n[p] = "bone"
    # the sodium rim: the ring just inside the outline catches the streetlight on the top-left
    for (x, y) in body - e:
        if any((x + dx, y + dy) in e for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            d = (x - cx) + (y - cy)
            if d < -10:
                n[(x, y)] = "sodium3"
            elif d < 2:
                n[(x, y)] = "sodium2"
            elif d > 14:
                n[(x, y)] = "fur2"
    for (x, y) in body - e:                               # a second, softer ring on the brightest arc
        d = (x - cx) + (y - cy)
        if d < -16 and any((x + dx, y + dy) in e for dx in (-2, 0, 2) for dy in (-2, 0, 2)) and n[(x, y)] == "bone":
            n[(x, y)] = "sodium3"
    return n


# ---------------------------------------------------------------- the flying gull

# Char maps, facing right. w white, b bone, g steel2 (wing), G steel1 (wing shade), k ink1 (tips),
# y yellow (beak), s sodium3 / S sodium2 (the rim), # ink0, r rust3 (feet, tucked)
GULL_UP = [
    "................",
    "...#............",
    "..#k#...........",
    "..#kg#..........",
    "...#sg#.........",
    "...#sgg#........",
    "....#sgg#.......",
    "....#sggG#..##..",
    ".##..#sggG##sw#.",
    "#sS###sgGGbwwky#",
    ".#bbbbbbbbbwwb#.",
    "..##bbbbbbbbb#..",
    "....#rr#####....",
    ".....##.........",
    "................",
    "................",
]
GULL_DOWN = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "............##..",
    "...........#sw#.",
    ".###.#####.#wwky",
    "#sSS#sssswswwwb#",
    ".#bbbbgggGbbbb#.",
    "..##bggggGbbb#..",
    "....#gggGG##r#..",
    ".....#ggG#..#...",
    "......#gG#......",
    ".......#k#......",
    "........#.......",
]
GULL_KEY = {"w": "white", "b": "bone", "g": "steel2", "G": "steel1", "k": "ink1", "y": "yellow",
            "s": "sodium3", "S": "sodium2", "#": "ink0", "r": "rust3"}


def from_map(rows):
    return {(x, y): GULL_KEY[ch] for y, row in enumerate(rows) for x, ch in enumerate(row) if ch in GULL_KEY}


def gull_frames():
    return [from_map(GULL_UP), from_map(GULL_DOWN)]
