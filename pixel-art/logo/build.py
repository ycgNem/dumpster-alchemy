"""The title sign: DUMPSTER ALCHEMY in marker on a torn cardboard sign, 240 x 96.
Run: python3 pixel-art/logo/build.py

Drawn entirely by hand: cardboard (card ramp), duct tape on two corners (steel3 + a bone
sheen), the letters as roughened 5 x 7 glyphs at 4x (DUMPSTER in ink0, ALCHEMY in red),
a raccoon paw-print stamp, two flies. It sits against the sky, so its top-left edge carries
the sodium rim (STYLE).
"""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "anchor"))
from kit import *  # noqa: E402,F403

SLUG = "logo"
W, H = 240, 96

GLYPHS = {
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
}


def sign(n, rnd):
    # a torn cardboard rectangle, tilted a touch (top edge rises to the right)
    for x in range(6, 234):
        top = 9 - (x - 6) * 4 // 228 + rnd.choice((0, 0, 0, 1))
        bot = 88 - (x - 6) * 2 // 228 + rnd.choice((0, 0, 1, -1)) if x < 214 else 88 - (x - 214) // 2
        for y in range(top, bot + 1):
            n[(x, y)] = "card1"
    for y in range(8, 89):                       # ragged left and right edges
        for x in (5, 234):
            if rnd.random() < 0.5 and (x + (1 if x == 5 else -1), y) in n:
                n[(x, y)] = "card1"
    xs = {}
    for (x, y) in n:
        xs.setdefault(y, []).append(x)
    ys = {}
    for (x, y) in n:
        ys.setdefault(x, []).append(y)
    # light: card2 on the upper-left, card0 down the bottom-right, card3 on the lit torn edge
    for (x, y) in list(n):
        d = (x + 2 * y) / 170                       # light falls off from the top-left corner
        if d < 1 and rnd.random() < (1 - d) * 1.3:
            n[(x, y)] = "card2"
        if x > 200 and y > 70 or y > 84:
            n[(x, y)] = "card0"
    for x, col in ys.items():
        n[(x, min(col))] = "card3"
        n[(x, max(col))] = "card0"
    for y, row in xs.items():
        n[(min(row), y)] = "card3"
        n[(max(row), y)] = "card0"
    for x in range(6, 40):                       # the streetlight catches the top-left edge
        if x in ys:
            n[(x, min(ys[x]))] = "sodium3" if x < 22 else "sodium2"
    for y in range(8, 30):
        if y in xs:
            n[(min(xs[y]), y)] = "sodium3" if y < 18 else "sodium2"
    # the torn corner: corrugation showing (bottom right)
    for x in range(214, 234):
        for y in range(80, 90):
            if (x, y) in n and x + y > 300:
                n[(x, y)] = "card2" if (x + y) % 3 else "card0"
    # creases and a coffee ring
    for x in range(30, 210, 3):
        if (x, 47) in n and rnd.random() < 0.6:
            n[(x, 47)] = "card0" if n[(x, 47)] == "card1" else "card1"
    for a in range(0, 360, 12):
        import math
        p = (round(196 + 9 * math.cos(math.radians(a))), round(70 + 6 * math.sin(math.radians(a))))
        if p in n and rnd.random() < 0.8:
            n[p] = "card0"


def tape(n, x0, y0, length, slope, rnd):
    """A strip of duct tape, 7 px wide, running diagonally."""
    for k in range(length):
        x = x0 + k
        yb = y0 + round(k * slope)
        for w in range(7):
            n[(x, yb + w)] = "steel2" if w > 4 else "steel3"
        n[(x, yb + 1)] = "bone" if k % 9 not in (0, 1) else "steel3"     # the sheen
    for w in range(7):                                                     # ragged torn ends
        if rnd.random() < 0.5:
            n.pop((x0, y0 + w), None)
        if rnd.random() < 0.5:
            n.pop((x0 + length - 1, y0 + round((length - 1) * slope) + w), None)


def letters(n, text, x0, y0, ink, shade, rnd, scale=4, gap=4):
    x = x0
    for ch in text:
        g = GLYPHS[ch]
        dy = rnd.choice((-1, 0, 0, 1))
        cells = set()
        for gy, row in enumerate(g):
            for gx, bit in enumerate(row):
                if bit == "1":
                    for sx in range(scale):
                        for sy in range(scale):
                            # a slight slant: the marker leans right
                            cells.add((x + gx * scale + sx - (gy * scale + sy) // 14, y0 + dy + gy * scale + sy))
        cells |= {(cx + 1, cy) for cx, cy in cells}            # a fat marker: one px bolder
        cells |= {(cx, cy + 1) for cx, cy in cells if rnd.random() < 0.5}
        # roughen: knock off a few outer corners so strokes look drawn, not stamped
        for (px_, py_) in list(cells):
            empty = [(px_ + ddx, py_ + ddy) not in cells for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if sum(empty) >= 2 and rnd.random() < 0.3:
                cells.discard((px_, py_))
        if shade:
            for (px_, py_) in cells:                            # marker bleed: a soft shadow
                if (px_ + 1, py_ + 1) not in cells:
                    n[(px_ + 1, py_ + 1)] = shade
        for (px_, py_) in cells:
            n[(px_, py_)] = ink
        x += len(g[0]) * scale + gap


def paw(n, cx, cy):
    """A raccoon paw print (a little hand), stamped in ink1."""
    for dx in range(-3, 4):
        for dy in range(-2, 4):
            if dx * dx / 10 + dy * dy / 9 <= 1:
                n[(cx + dx, cy + dy)] = "ink1"
    for fx, fy in ((-5, -4), (-2, -6), (1, -6), (4, -5), (6, -1)):
        for ddx in (0, 1):
            for ddy in (0, 1, 2):
                n[(cx + fx + ddx, cy + fy + ddy - 1)] = "ink1"


def fly(n, x, y):
    n[(x, y)] = "ink0"; n[(x + 1, y)] = "ink0"
    n[(x, y - 1)] = "bone"; n[(x + 1, y - 1)] = "white"


def build():
    rnd = random.Random(7)
    n = {}
    sign(n, rnd)
    letters(n, "DUMPSTER", 24, 16, "ink0", None, rnd, gap=3)
    letters(n, "ALCHEMY", 36, 51, "red", "card0", rnd, gap=3)
    paw(n, 214, 60)
    tape(n, 0, 2, 26, 0.35, rnd)
    tape(n, 212, 2, 28, -0.2, rnd)
    for (x, y) in list(n):
        if not (0 <= x < W and 0 <= y < H):
            del n[(x, y)]
    n = clean_outline(n)
    fly(n, 228, 30); fly(n, 233, 24)
    for (x, y) in list(n):
        if not (0 <= x < W and 0 <= y < H):
            del n[(x, y)]
    return n


def main():
    n = build()
    im = save_final(SLUG, "logo", [n], W, H, fps=0, anchor=[W // 2, H - 1])
    pack("logo")
    bd, _ = load_final("backdrop")
    sheet = Image.new("RGBA", (W * 3 + 16, H * 3 + H + 24), (34, 30, 40, 255))
    sky = bd.crop((200, 0, 200 + W, H)) if bd else Image.new("RGBA", (W, H), RGB["night0"] + (255,))
    sky = sky.copy(); sky.alpha_composite(im)
    sheet.alpha_composite(sky.resize((W * 3, H * 3), Image.NEAREST), (8, 8))
    sheet.alpha_composite(sky, (8, H * 3 + 16))
    sheet.save(REVIEW / "logo.png")
    print("review -> art-src/review/logo.png")


if __name__ == "__main__":
    main()
