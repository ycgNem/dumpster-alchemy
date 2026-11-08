"""Board family: dirt cells, the hover / target / bad overlays, and the pallet-plank frame.

    cd pixel-art/board && py -3 build.py

-> public/art/board.png + board.json, art-src/review/board.png
"""
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'ui'))
from kit import C, RGBA, new, Atlas, nine_slice, review_sheet, up, on  # noqa: E402
from PIL import Image  # noqa: E402

N = 32


# ------------------------------------------------------------------ dirt cells
#
# Built as a grid of palette names so the clumps, pebbles and ruts can be layered and checked
# before they turn into pixels. Both cells share the same rut rows at their left/right edges so a
# rut that crosses an edge carries on into the neighbour.

def grid(fill):
    return [[fill] * N for _ in range(N)]


def blob(g, cx, cy, rx, ry, c, rng, rough=0.35, only=None):
    """A lumpy clump (wraps around the cell so it tiles with itself)."""
    for y in range(cy - ry - 1, cy + ry + 2):
        for x in range(cx - rx - 1, cx + rx + 2):
            dx, dy = (x - cx) / max(rx, 0.5), (y - cy) / max(ry, 0.5)
            d = dx * dx + dy * dy
            if d <= 1.0 + (rng.random() - 0.5) * rough:
                X, Y = x % N, y % N
                if only is None or g[Y][X] in only:
                    g[Y][X] = c


def pebble(g, x, y, kind):
    """Small stones lit from the top-left: lit px, body, a dirt0 shadow tucked bottom-right."""
    shapes = {
        'big': ['ab.', 'bbs', '.ss'],
        'flat': ['abb', 'sss'],
        'tiny': ['as'],
        'dot': ['a', 's'],
        'round': ['.ab.', 'abbs', '.ss.'],
    }
    # M7 (critic P2-10): stones in dirt tones, so nothing on the ground is cap-sized and bright
    key = {'a': 'dirt3', 'b': 'fur1', 's': 'dirt0'}
    for j, row in enumerate(shapes[kind]):
        for i, ch in enumerate(row):
            if ch != '.':
                g[(y + j) % N][(x + i) % N] = key[ch]


def rut(g, pts, deep='dirt0', lip='dirt3', gaps=()):
    """A tyre-rut hint: a dirt0 groove whose far (lower) wall catches the light.
    pts = [(x, y)] one per column; gaps = x ranges left out (ruts are broken, not drawn)."""
    for x, y in pts:
        if any(a <= x <= b for a, b in gaps):
            continue
        g[y % N][x % N] = deep
        g[(y + 1) % N][x % N] = lip


def wave(x0, x1, y0, amp_pts):
    """Column -> y for a gently wandering line."""
    out = []
    for x in range(x0, x1 + 1):
        dy = 0
        for (xa, d) in amp_pts:
            if x >= xa:
                dy = d
        out.append((x, y0 + dy))
    return out


def cell(base, clumps, dark, light, seed, extra):
    rng = random.Random(seed)
    g = grid(base)
    for (cx, cy, rx, ry, c) in clumps:
        blob(g, cx, cy, rx, ry, c, rng)
    # fine grit: a few light and dark specks, never in tight noise
    for _ in range(10):
        x, y = rng.randrange(N), rng.randrange(N)
        if g[y][x] == base:
            g[y][x] = dark
    for _ in range(6):
        x, y = rng.randrange(N), rng.randrange(N)
        if g[y][x] == base:
            g[y][x] = light
    extra(g)
    return g


def to_img(g):
    im = Image.new('RGBA', (N, N))
    for y in range(N):
        for x in range(N):
            im.putpixel((x, y), RGBA(g[y][x]))
    return im


# Ruts are short, broken segments that stay off the cell edges, so the checker never shows a
# rut stopping dead at a seam. Only cell_b has the glint (every other cell, never a sprinkle).

def pebble_dark(g, x, y, kind):
    pebble(g, x, y, kind)
    for j in range(4):
        for i in range(4):
            Y, X = (y + j) % N, (x + i) % N
            if g[Y][X] == 'dirt3':
                g[Y][X] = 'dirt2'
            elif g[Y][X] == 'fur1':
                g[Y][X] = 'fur0'


def extras_a(g):
    rut(g, wave(3, 21, 6, [(9, 1), (16, 0)]), deep='dirt1', lip='dirt3', gaps=[(12, 13)])
    for x in (6, 15):
        g[7][x] = 'dirt0'
    pebble(g, 24, 13, 'big')
    pebble(g, 5, 24, 'flat')
    pebble(g, 28, 27, 'dot')
    # a lighter, packed scuff (hand-placed so it never reads as a plus sign)
    for (x, y) in ((17, 12), (18, 12), (15, 13), (16, 13), (17, 13), (14, 14)):
        g[y][x] = 'dirt3'


def extras_b(g):
    rut(g, wave(9, 28, 21, [(14, 1), (22, 2)]), deep='dirt0', lip='dirt2', gaps=[(17, 18)])
    for x, y in ((9, 10), (10, 11), (11, 11), (12, 12)):
        g[y][x] = 'dirt0'
    pebble_dark(g, 4, 4, 'round')
    pebble_dark(g, 23, 8, 'tiny')
    pebble_dark(g, 4, 27, 'flat')
    # (M7: the rusted bottle cap that sat here is gone: it read as a real cap at 1x)
    for (x, y, c) in ((27, 13, 'dirt0'), (28, 13, 'dirt0'), (27, 14, 'dirt0'), (28, 14, 'dirt0'),
                      (29, 14, 'dirt0'), (26, 13, 'dirt2'), (27, 12, 'dirt2')):
        g[y][x] = c                                     # a dull clod in its place


# M7 (critic P2-10): the checker is one step calmer: cell_a carries more dirt1 clumps and
# cell_b more dirt2 (one of its dirt0 clumps became dirt2), so the two means sit closer.
CELL_A = cell(
    'dirt2',
    [(5, 12, 4, 3, 'dirt1'), (21, 3, 5, 2, 'dirt1'), (27, 21, 3, 4, 'dirt1'),
     (12, 22, 3, 2, 'dirt1'), (17, 16, 3, 2, 'dirt1'), (3, 29, 3, 2, 'dirt1'), (23, 9, 2, 2, 'dirt1')],
    'dirt1', 'dirt3', 11, extras_a)

CELL_B = cell(
    'dirt1',
    [(25, 4, 4, 3, 'dirt2'), (6, 27, 5, 2, 'dirt2'), (18, 25, 3, 2, 'dirt0'),
     (13, 6, 3, 2, 'dirt2'), (30, 18, 2, 3, 'dirt2'), (20, 14, 3, 2, 'dirt2'), (4, 16, 3, 2, 'dirt2')],
    'dirt0', 'dirt2', 23, extras_b)


# ------------------------------------------------------------------ overlays

def bracket_overlay(arm, body, lit, shade, dashed=None, dash_c=None, ticks=None):
    """Four corner brackets (2 px stroke, ink0 keyline), lit on each stroke's top/left row."""
    s = new(N, N)
    mask = set()
    for (sx, sy) in ((0, 0), (1, 0), (0, 1), (1, 1)):
        for i in range(arm):
            for t in range(2):
                # horizontal arm
                x = 1 + i if sx == 0 else N - 2 - i
                y = 1 + t if sy == 0 else N - 3 + t
                mask.add((x, y, 'h', t))
                # vertical arm
                x2 = 1 + t if sx == 0 else N - 3 + t
                y2 = 1 + i if sy == 0 else N - 2 - i
                mask.add((x2, y2, 'v', t))
    pts = {}
    for (x, y, d, t) in mask:
        c = lit if t == 0 else shade
        # where the arms overlap at the corner, the lit colour wins
        if (x, y) in pts and pts[(x, y)] == lit:
            continue
        pts[(x, y)] = c
    if dashed:
        # a dashed line along each side between the brackets
        for i in range(arm + 2, N - arm - 2):
            if (i // dashed[0]) % 2 == 0:
                for (x, y) in ((i, 1), (i, N - 2), (1, i), (N - 2, i)):
                    pts[(x, y)] = dash_c
    if ticks:
        for (x, y) in ticks:
            pts[(x, y)] = lit
    # ink keyline around everything
    for (x, y) in list(pts):
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                q = (x + dx, y + dy)
                if q not in pts and 0 <= q[0] < N and 0 <= q[1] < N:
                    s.px(q[0], q[1], C('ink0'))
    for (x, y), c in pts.items():
        s.px(x, y, C(c))
    return s


HOVER = bracket_overlay(7, 'sodium2', 'sodium3', 'sodium1')
TARGET = bracket_overlay(10, 'toxic2', 'toxic3', 'toxic1', dashed=(2,), dash_c='toxic2')
BAD = bracket_overlay(7, 'red', 'red', 'rust1', dashed=(2,), dash_c='rust2')


# ------------------------------------------------------------------ the frame (9-slice)
#
# 112 x 128, borders 8 on every side. Middles are 96 (top/bottom) and 112 (sides) long, so on the
# 288 x 224 board they tile exactly (3 and 2 times) and the plank seams fall off the cell grid.
# Each middle tile starts with a seam, and every corner is its own rusty steel plate, so any
# board size still looks nailed together.

FW, FH, B = 112, 128, 8

GREY = {'lit': 'fur3', 'body': 'fur2', 'grain': 'fur1', 'shade': 'fur1', 'knot': 'fur0'}
TAN = {'lit': 'card2', 'body': 'card1', 'grain': 'card0', 'shade': 'card0', 'knot': 'dirt0'}
OLD = {'lit': 'dirt3', 'body': 'dirt2', 'grain': 'dirt1', 'shade': 'dirt1', 'knot': 'dirt0'}


def plank_h(s, x0, x1, y0, wood, seed, nails=True):
    """A horizontal plank face 6 px tall at rows y0..y0+5, from x0 to x1 (inclusive),
    with a seam (ink0) at x0 drawn by the caller."""
    rng = random.Random(seed)
    for x in range(x0, x1 + 1):
        s.px(x, y0, C(wood['lit']))
        for y in range(y0 + 1, y0 + 5):
            s.px(x, y, C(wood['body']))
        s.px(x, y0 + 5, C(wood['shade']))
    # broken grain lines
    for row in (y0 + 2, y0 + 3):
        x = x0 + rng.randrange(2, 6)
        while x < x1 - 1:
            run = rng.randrange(3, 9)
            for i in range(run):
                if x + i <= x1 - 1:
                    s.px(x + i, row, C(wood['grain']))
            x += run + rng.randrange(4, 10)
            row = row  # same row, broken
    # a knot
    kx = x0 + (x1 - x0) // 2 + rng.randrange(-4, 5)
    s.px(kx, y0 + 2, C(wood['knot']))
    s.px(kx + 1, y0 + 2, C(wood['grain']))
    s.px(kx, y0 + 3, C(wood['grain']))
    if nails:
        for nx in (x0 + 2, x1 - 2):
            for ny in (y0 + 1, y0 + 4):
                s.px(nx, ny, C('steel3'))
                s.px(nx + 1, ny, C('ink1'))


def plank_v(s, x0, y0, y1, wood, seed, nails=True):
    """A vertical plank face 6 px wide at columns x0..x0+5, rows y0..y1."""
    rng = random.Random(seed)
    for y in range(y0, y1 + 1):
        s.px(x0, y, C(wood['lit']))
        for x in range(x0 + 1, x0 + 5):
            s.px(x, y, C(wood['body']))
        s.px(x0 + 5, y, C(wood['shade']))
    for col in (x0 + 2, x0 + 3):
        y = y0 + rng.randrange(2, 6)
        while y < y1 - 1:
            run = rng.randrange(3, 9)
            for i in range(run):
                if y + i <= y1 - 1:
                    s.px(col, y + i, C(wood['grain']))
            y += run + rng.randrange(4, 10)
    ky = y0 + (y1 - y0) // 2 + rng.randrange(-4, 5)
    s.px(x0 + 2, ky, C(wood['knot']))
    s.px(x0 + 2, ky + 1, C(wood['grain']))
    s.px(x0 + 3, ky, C(wood['grain']))
    if nails:
        for ny in (y0 + 2, y1 - 2):
            for nx in (x0 + 1, x0 + 4):
                s.px(nx, ny, C('steel3'))
                s.px(nx, ny + 1, C('ink1'))


def corner_plate(s, ox, oy, left_line, top_line):
    """An 8 x 8 rusty steel corner plate with one rivet."""
    for y in range(8):
        for x in range(8):
            s.px(ox + x, oy + y, C('rust1'))
    for i in range(8):
        s.px(ox + i, oy + 1, C('rust2'))
        s.px(ox + 1, oy + i, C('rust2'))
        s.px(ox + i, oy + 7, C('rust0'))
        s.px(ox + 7, oy + i, C('rust0'))
    s.px(ox + 1, oy + 1, C('rust3'))
    s.px(ox + 2, oy + 1, C('rust3'))
    s.px(ox + 1, oy + 2, C('rust3'))
    # rivet
    s.px(ox + 3, oy + 3, C('steel3'))
    s.px(ox + 4, oy + 3, C('steel2'))
    s.px(ox + 3, oy + 4, C('steel2'))
    s.px(ox + 4, oy + 4, C('ink1'))
    # a rust bloom
    s.px(ox + 5, oy + 5, C('rust3'))
    s.px(ox + 6, oy + 2, C('sodium1'))
    # outer keylines (top and outer side always; inner sides only when asked)
    for i in range(8):
        if top_line:
            s.px(ox + i, oy, C('ink0'))
        if left_line:
            s.px(ox, oy + i, C('ink0'))


def build_frame():
    s = new(FW, FH)
    ink = C('ink0')
    # top band: outline row 0, face rows 1..6, inner keyline row 7
    for (y0, seams, woods, seed) in ((0, (0, 37, 66), (GREY, TAN, GREY), 5),
                                     (FH - B, (0, 45, 70), (OLD, GREY, TAN), 9)):
        for i, sx in enumerate(seams):
            ex = (seams[i + 1] - 1) if i + 1 < len(seams) else 95
            plank_h(s, B + sx + 1, B + ex, y0 + 1, woods[i], seed + i)
            for y in range(y0, y0 + B):
                s.px(B + sx, y, ink)
        for x in range(B, FW - B):
            s.px(x, y0, ink)
            s.px(x, y0 + B - 1, ink)
    for (x0, seams, woods, seed) in ((0, (0, 40, 77), (TAN, GREY, OLD), 13),
                                     (FW - B, (0, 52, 86), (GREY, OLD, GREY), 17)):
        for i, sy in enumerate(seams):
            ey = (seams[i + 1] - 1) if i + 1 < len(seams) else 111
            plank_v(s, x0 + 1, B + sy + 1, B + ey, woods[i], seed + i)
            for x in range(x0, x0 + B):
                s.px(x, B + sy, ink)
        for y in range(B, FH - B):
            s.px(x0, y, ink)
            s.px(x0 + B - 1, y, ink)
    # corners: plates. Inner edges keyed where the neighbouring middle has no seam of its own.
    corner_plate(s, 0, 0, left_line=True, top_line=True)
    corner_plate(s, FW - B, 0, left_line=True, top_line=True)
    corner_plate(s, 0, FH - B, left_line=True, top_line=True)
    corner_plate(s, FW - B, FH - B, left_line=True, top_line=True)
    # outer keyline on the right and bottom of the right/bottom corner plates
    for i in range(B):
        s.px(FW - 1, i, ink)
        s.px(FW - 1, FH - B + i, ink)
        s.px(i, FH - 1, ink)
        s.px(FW - B + i, FH - 1, ink)
    return s


FRAME = build_frame()


# ------------------------------------------------------------------ atlas + review

atlas = Atlas('board')
atlas.add('cell_a', to_img(CELL_A), anchor=[16, 31])
atlas.add('cell_b', to_img(CELL_B), anchor=[16, 31])
atlas.add('cell_hover', HOVER)
atlas.add('cell_target', TARGET)
atlas.add('cell_bad', BAD)
atlas.add('board_frame', FRAME, slice=[B, B, B, B])
sheet, data = atlas.save()


def board_preview(items=True):
    """The 9 x 7 board as the game will draw it: frame, checker, a few stand-in items,
    one hover and one target overlay."""
    ca, cb = atlas.get('cell_a')[0], atlas.get('cell_b')[0]
    W, H = 288 + 16 + 16, 224 + 16 + 16
    im = Image.new('RGBA', (W, H), RGBA('ink1'))
    ox, oy = 16, 16
    im.alpha_composite(nine_slice(atlas.get('board_frame')[0], [B] * 4, 288 + 16, 224 + 16), (ox - 8, oy - 8))
    for r in range(7):
        for c in range(9):
            im.alpha_composite(ca if (c + r) % 2 == 0 else cb, (ox + c * 32, oy + r * 32))
    if items:
        # stand-ins: outlined junk-coloured lumps, like the real items (ink0 outline, saturated)
        stand = [('steel3', 'steel1'), ('rust2', 'rust0'), ('card2', 'card0'), ('grime2', 'grime0'),
                 ('yellow', 'sodium1'), ('white', 'fur2'), ('blue', 'night2'), ('pink', 'rust1')]
        cells = [(1, 1), (2, 1), (4, 2), (6, 3), (3, 4), (7, 5), (0, 6), (5, 0)]
        for k, (c, r) in enumerate(cells):
            body, shade = stand[k % len(stand)]
            s = new(32, 32)
            s.ellipse(5, 6, 26, 28, C(body))
            s.ellipse(12, 14, 27, 29, C(shade), only='opaque')
            s.ellipse(5, 6, 22, 24, C(body), only='opaque')
            s.outline(C('ink0'))
            im.alpha_composite(s.composite(1), (ox + c * 32, oy + r * 32))
        im.alpha_composite(atlas.get('cell_hover')[0], (ox + 2 * 32, oy + 1 * 32))
        im.alpha_composite(atlas.get('cell_target')[0], (ox + 5 * 32, oy + 2 * 32))
        im.alpha_composite(atlas.get('cell_bad')[0], (ox + 8 * 32, oy + 6 * 32))
    return im


blocks = [
    ('cell_a', atlas.get('cell_a')[0]),
    ('cell_b', atlas.get('cell_b')[0]),
    ('cell_hover (on a)', Image.alpha_composite(atlas.get('cell_a')[0], atlas.get('cell_hover')[0])),
    ('cell_target (on b)', Image.alpha_composite(atlas.get('cell_b')[0], atlas.get('cell_target')[0])),
    ('cell_bad (on a)', Image.alpha_composite(atlas.get('cell_a')[0], atlas.get('cell_bad')[0])),
    ('hover', on('night0', atlas.get('cell_hover')[0], 0)),
    ('target', on('night0', atlas.get('cell_target')[0], 0)),
    ('bad', on('night0', atlas.get('cell_bad')[0], 0)),
    ('board_frame (source)', atlas.get('board_frame')[0]),
]
review_sheet('board', blocks, scale=4, width=1500)

# the whole board at 1x and 3x (separate file so the contact sheet stays readable)
bp = board_preview()
from kit import REVIEW  # noqa: E402
bp.save(REVIEW / 'board_1x.png')
up(bp, 3).save(REVIEW / 'board_3x.png')
print('wrote art-src/review/board_1x.png, board_3x.png')
