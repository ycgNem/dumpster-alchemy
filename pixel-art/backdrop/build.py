"""The backdrop: Lot 9 at night, 640 x 360, 2 frames (frame 2: the streetlight flickers dim).
Run: python3 pixel-art/backdrop/build.py

Drawn by hand (procedurally) around src/render/layout.ts:
  y 0-56    sky, far trash heaps, the chain-link fence with barbed wire on top
  y 56-104  the truck lane: a rutted dirt road
  y 104-360 the ground under the orders, the board and the right column: calm and dark
One sodium streetlight on the top-left casts a warm pool down and toward the board.
(The PixelLab strip art-src/dl/backdrop_strip_v1.png was too dark and noisy to use.)
"""
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "anchor"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from kit import *  # noqa: E402,F403

SLUG = "backdrop"
W, H = 640, 360
SKY_H, LANE_Y0, LANE_Y1 = 56, 56, 104
LAMP = (78, 9)                 # the bulb
POLE_X = 56
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def dith(x, y, t):
    """True on a fraction t (0..1) of pixels, ordered."""
    return BAYER[y % 4][x % 4] < t * 16


def heap_line(x, seed, base, amp):
    r = random.Random(seed)
    phases = [r.random() * 6.28 for _ in range(4)]
    v = base
    for k, (f, a) in enumerate(((0.011, 1.0), (0.027, 0.55), (0.061, 0.3), (0.13, 0.15))):
        v -= amp * a * (0.5 + 0.5 * math.sin(x * f + phases[k]))
    return round(v)


def build(flicker=False):
    px = [["night0"] * W for _ in range(H)]
    rnd = random.Random(9)
    lx, ly = LAMP
    glow = 0.55 if flicker else 1.0

    # --- sky: night0 at the top easing to night1 at the horizon, stars
    for y in range(SKY_H):
        for x in range(W):
            t = y / SKY_H
            px[y][x] = "night1" if dith(x, y, max(0, t - 0.25) * 1.3) else "night0"
    for _ in range(140):
        x, y = rnd.randrange(W), rnd.randrange(2, 34)
        if math.hypot(x - lx, y - ly) > 70:
            px[y][x] = "bone" if rnd.random() < 0.25 else "night3"
    for gx, gy in ((300, 14), (311, 11), (452, 19)):        # far gulls
        for dx, dy in ((-2, -1), (-1, 0), (0, 1), (1, 0), (2, -1)):
            px[gy + dy][gx + dx] = "night3"

    # --- far heaps (lighter, hazier), then near heaps (darker) with junk on top
    far = [heap_line(x, 1, 46, 18) for x in range(W)]
    near = [heap_line(x, 2, 55, 14) for x in range(W)]
    for x in range(W):
        for y in range(far[x], SKY_H):
            px[y][x] = "night1" if y > far[x] else "night2"
        for y in range(near[x], SKY_H):
            px[y][x] = "ink2" if y > near[x] else "night1"
    for x in range(W):                                        # junk texture on the near heaps
        for y in range(near[x] + 2, SKY_H):
            if rnd.random() < 0.05:
                px[y][x] = "night1"
    # junk silhouettes on the near heaps: tires, a fridge, a cart, sticks
    def ring(cx, cy, r, c):
        for a in range(0, 360, 8):
            px[round(cy + r * math.sin(math.radians(a)))][round(cx + r * math.cos(math.radians(a)))] = c
    for cx in (140, 380, 560):
        cy = near[cx] - 3
        ring(cx, cy, 4, "ink2"); ring(cx, cy, 3, "ink2")
        px[cy - 4][cx - 1] = "night2"; px[cy - 3][cx - 3] = "night2"     # rim on the top-left
    for fx in (250, 505):                                     # fridges
        top = near[fx] - 9
        for y in range(top, near[fx] + 1):
            for x in range(fx, fx + 6):
                px[y][x] = "ink2"
        for y in range(top, near[fx]):
            px[y][fx] = "night2"
    cx = 430                                                  # a cart on its side
    for x in range(cx, cx + 10):
        px[near[cx] - 6][x] = "ink2"; px[near[cx] - 2][x] = "ink2"
    for x in range(cx, cx + 11, 3):
        for y in range(near[cx] - 6, near[cx] - 1):
            px[y][x] = "ink2"
    for sx, ln in ((200, 7), (330, 5), (600, 8)):              # sticks and pipes
        for k in range(ln):
            px[near[sx] - k][sx + k // 2] = "ink2"

    # --- the chain-link fence: posts, top rail, barbed wire, a faint diamond mesh
    posts = list(range(24, W, 88))
    for y in range(20, SKY_H):
        for x in range(W):
            if ((x + y) % 7 == 0 or (x - y) % 7 == 0) and y > 22:
                if px[y][x] in ("night0", "night1"):
                    px[y][x] = "night2" if dith(x, y, 0.5) else px[y][x]
                elif px[y][x] in ("night2", "night3"):
                    px[y][x] = "night1"
    for x in range(W):
        px[22][x] = "steel0"
        zig = 18 + (x // 2) % 3
        if x % 2 == 0:
            px[zig][x] = "steel0"
        if x % 9 == 0:
            px[19][x] = "steel1"                               # barbs
    for p in posts:
        for y in range(16, SKY_H):
            px[y][p] = "night3"; px[y][p + 1] = "steel0"; px[y][p + 2] = "ink2"
        px[15][p] = "ink2"; px[15][p + 1] = "ink2"

    # --- the lane: a rutted dirt road
    for y in range(LANE_Y0, LANE_Y1):
        for x in range(W):
            c = "dirt1"
            if y < LANE_Y0 + 3:
                c = "dirt0" if (y == LANE_Y0 or dith(x, y, 0.5)) else "dirt1"     # the verge
            elif y >= LANE_Y1 - 3:
                c = "dirt0" if (y == LANE_Y1 - 1 or dith(x, y, 0.5)) else "dirt1"
            for ry in (70, 92):                                                    # ruts
                wob = ry + round(1.2 * math.sin(x * 0.045 + ry))
                if y in (wob, wob + 1):
                    c = "dirt0"
                elif y == wob - 1:
                    c = "dirt2" if dith(x, y, 0.35) else c
            px[y][x] = c
    for _ in range(900):
        x, y = rnd.randrange(W), rnd.randrange(LANE_Y0 + 3, LANE_Y1 - 3)
        if px[y][x] == "dirt1":
            px[y][x] = "dirt2" if rnd.random() < 0.7 else "dirt3"
    for gx in range(0, W, 23):                                                     # weeds on the verge
        h = rnd.randrange(2, 5)
        for k in range(h):
            px[LANE_Y0 + 2 - k][gx + (k % 2)] = "grime1"

    # --- the ground below: dark, calm, darker away from the light
    for y in range(LANE_Y1, H):
        for x in range(W):
            d = math.hypot((x - 120) / 1.6, (y - 110) * 1.0)
            t = min(1.0, d / 380)
            px[y][x] = "ink1" if dith(x, y, t) else "dirt0"
    for _ in range(700):
        x, y = rnd.randrange(W), rnd.randrange(LANE_Y1, H)
        if px[y][x] == "dirt0":
            px[y][x] = "dirt1"

    # --- the streetlight's warm pool: down and toward the board
    for y in range(LANE_Y0, H):
        for x in range(W):
            d = math.hypot((x - 150) / 2.4, (y - 88) / 1.0) / glow
            if d < 70:
                t = 1 - d / 70
                c = px[y][x]
                if c == "dirt1":
                    px[y][x] = "dirt3" if (t > 0.7 and dith(x, y, t - 0.5)) else ("dirt2" if dith(x, y, t * 1.2) else c)
                elif c in ("dirt0", "ink1"):
                    if y < LANE_Y1:
                        px[y][x] = "sodium0" if (t > 0.6 and dith(x, y, t - 0.45)) else ("dirt1" if dith(x, y, t) else c)
                    else:
                        px[y][x] = "dirt1" if dith(x, y, t * 0.9) else c
                elif c == "dirt2" and t > 0.6:
                    px[y][x] = "dirt3"
    # the cone through the air: a faint sodium dither under the lamp
    for y in range(ly + 3, LANE_Y0):
        half = (y - ly) * 0.9
        for x in range(round(lx - half), round(lx + half * 1.3)):
            if 0 <= x < W and px[y][x] in ("night0", "night1"):
                t = 0.1 * glow * (1 - (y - ly) / LANE_Y0)
                if dith(x, y, t):
                    px[y][x] = "sodium0"
    # heap and fence tops near the lamp catch the warm light (the sodium rim)
    for x in range(W):
        if abs(x - lx) < 120:
            for line, c in ((far, "sodium0"), (near, "sodium0")):
                y = line[x]
                if 0 < y < SKY_H and dith(x, y, (1 - abs(x - lx) / 120) * glow * 0.8):
                    px[y][x] = c

    # --- the streetlight itself: a cobra-head lamp on a steel pole
    for y in range(7, LANE_Y0 + 2):
        px[y][POLE_X - 2] = "ink0"; px[y][POLE_X - 1] = "steel2"; px[y][POLE_X] = "steel1"
        px[y][POLE_X + 1] = "steel0"; px[y][POLE_X + 2] = "ink0"
    for y in range(LANE_Y0 - 3, LANE_Y0 + 3):                                      # the foot
        for x in range(POLE_X - 4, POLE_X + 5):
            px[y][x] = "ink0" if (y == LANE_Y0 + 2 or x in (POLE_X - 4, POLE_X + 4)) else "steel0"
    for x in range(POLE_X - 2, lx - 4):                                            # the arm
        px[5][x] = "ink0"; px[6][x] = "steel2"; px[7][x] = "steel0"; px[8][x] = "ink0"
    for x in range(lx - 8, lx + 9):                                                # the head
        px[6][x] = "ink0"
        px[7][x] = "steel1" if x < lx + 6 else "steel0"
        px[8][x] = "steel0"
        px[9][x] = "ink0"
    px[6][lx - 9] = "ink0"; px[7][lx - 9] = "ink0"; px[8][lx - 9] = "ink0"
    px[7][lx + 9] = "ink0"; px[8][lx + 9] = "ink0"
    bulb = "sodium3" if not flicker else "sodium2"
    for x in range(lx - 6, lx + 7):
        px[10][x] = bulb if abs(x - lx) < 6 else "ink0"
    for x in range(lx - 2, lx + 2):
        px[10][x] = "white" if not flicker else "sodium3"
    for x in range(lx - 5, lx + 6):
        px[11][x] = "sodium2" if not flicker else "sodium1"
    if not flicker:                                                                 # the halo
        for x in range(lx - 9, lx + 10):
            for y in (11, 12, 13):
                if px[y][x].startswith("night") and dith(x, y, 0.55 - 0.15 * (y - 11)):
                    px[y][x] = "sodium1" if y == 11 else "sodium0"

    im = Image.new("RGBA", (W, H))
    im.putdata([RGB[c] + (255,) for row in px for c in row])
    return im


def main():
    a, b = build(False), build(True)
    save_final(SLUG, "backdrop", [a, b], W, H, fps=0, anchor=[0, 0])
    # the sky sprites (moon, flying gull) live in the same atlas, so the loader needs no change
    import sky
    save_final(SLUG, "moon", [sky.moon()], 32, 32, fps=0, anchor=[16, 31])
    save_final(SLUG, "gull_fly", sky.gull_frames(), 16, 16, fps=6, anchor=[8, 15])
    pack("backdrop")
    (REVIEW / "m7").mkdir(parents=True, exist_ok=True)
    review("m7/sky.png", [("moon", frames_of("moon")), ("gull_fly (6 fps)", frames_of("gull_fly"))],
           scale=6, title="sky: moon + gull_fly on dirt and night0 at 6x, 1x at right", bgs=("night", "dirt"))
    # review: the frame at 2x, with the layout's rectangles outlined (where things go on top)
    sheet = Image.new("RGBA", (W * 2, H * 2 + H + 8), (34, 30, 40, 255))
    big = a.resize((W * 2, H * 2), Image.NEAREST)
    d = ImageDraw.Draw(big)
    for (x, y, w, h) in ((176, 112, 288, 224), (8, 112, 160, 224), (472, 112, 160, 224)):
        d.rectangle([x * 2, y * 2, (x + w) * 2 - 1, (y + h) * 2 - 1], outline=(255, 0, 255, 255))
    d.line([(0, 56 * 2), (W * 2, 56 * 2)], fill=(255, 0, 255, 255))
    d.line([(0, 104 * 2), (W * 2, 104 * 2)], fill=(255, 0, 255, 255))
    sheet.alpha_composite(big, (0, 0))
    sheet.alpha_composite(a, (0, H * 2 + 8))
    sheet.alpha_composite(b, (W, H * 2 + 8))
    REVIEW.mkdir(parents=True, exist_ok=True)
    sheet.save(REVIEW / "backdrop.png")
    a.crop((0, 0, 320, 120)).resize((960, 360), Image.NEAREST).save(REVIEW / "backdrop_lamp_3x.png")
    print("review -> art-src/review/backdrop.png, backdrop_lamp_3x.png")


if __name__ == "__main__":
    main()
