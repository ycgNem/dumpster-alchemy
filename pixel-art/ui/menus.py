"""UI batch 2: lid pips, raccoon-paw cursors, speech bubble, the Inspector's clipboard, rubber
stamps, the Swap Meet price tag, upgrade icons (24 x 24) and menu icons (16 x 16).

Imported by build.py (one `ui` atlas). Every function returns a pixelstudio Sprite.
"""
import math
import random

from kit import C, new, ell, put, keyline

KEY = {
    'o': 'ink0', 'i': 'ink1', 'j': 'ink2',
    '0': 'card0', '1': 'card1', '2': 'card2', '3': 'card3',
    'b': 'bone', 'w': 'white', 'g': 'fur3', 'G': 'fur2', 'H': 'fur1', 'K': 'fur0',
    'S': 'steel3', 's': 'steel2', 'T': 'steel1', 't': 'steel0',
    'r': 'rust0', 'R': 'rust1', 'q': 'rust2', 'Q': 'rust3',
    'y': 'yellow', 'Y': 'sodium3', 'd': 'sodium2', 'D': 'sodium1',
    'p': 'pink', 'x': 'red',
    'e': 'toxic0', 'f': 'toxic1', 'F': 'toxic2', 'E': 'toxic3',
}


def paint(s, rows, ox=0, oy=0, key=KEY):
    """' ' keeps what is there, '.' clears, anything else is a palette key."""
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == ' ':
                continue
            s.px(ox + x, oy + y, None if ch == '.' else C(key[ch]))


def shade(s, pts, lit, body, dark):
    """Fill a shape lit from the top-left: lit on its top/left edge, dark on its bottom/right."""
    pts = set(pts)
    put(s, pts, body)
    put(s, [(x, y) for (x, y) in pts if (x + 1, y) not in pts or (x, y + 1) not in pts], dark)
    put(s, [(x, y) for (x, y) in pts if (x - 1, y) not in pts or (x, y - 1) not in pts], lit)


def thick(points, w=3):
    """A Bresenham polyline stamped with a w x w square."""
    out = set()
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            for i in range(w):
                for j in range(w):
                    out.add((x0 + i - w // 2, y0 + j - w // 2))
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy
    return out


def rect(x0, y0, x1, y1):
    return {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}


# ------------------------------------------------------------------ lid pips (8 x 6)

def pip(full):
    s = new(8, 6)
    if full:
        paint(s, ['...oo...',
                  '.ooQQoo.',
                  'oQQQQqqo',
                  'oqqqqqRo',
                  'oRRRRRro',
                  '.oooooo.'])
        s.px(2, 2, C('sodium3'))
    else:
        paint(s, ['...oo...',
                  '.oojjoo.',
                  'ojjjjiio',
                  'oiiiiiio',
                  'oiiiiiio',
                  '.oooooo.'])
    return s


# ------------------------------------------------------------------ raccoon-paw cursors (16 x 16)
#
# Grey paw (fur3 lit / fur2 / fur1), pink pads, ink0 keyline. Open and grab share the palm
# hotspot so swapping them never jumps; point's hotspot is its fingertip.

PAW = ('fur3', 'fur2', 'fur1')


def _finger(x, top, bottom):
    return rect(x, top, x + 1, bottom)


def cursor_open():
    s = new(16, 16)
    fingers = [(3, 4), (6, 1), (9, 1), (12, 4)]
    shape = set()
    for x, top in fingers:
        shape |= _finger(x, top, 8)
    palm = rect(3, 6, 13, 11) - {(3, 11), (13, 11)}
    thumb = rect(1, 8, 2, 10) - {(1, 10)}
    wrist = rect(6, 12, 11, 14)
    shape |= palm | thumb | wrist
    shade(s, shape, *PAW)
    # finger columns: lit left, body right; gaps between them stay clear for the ink to fill
    for x, top in fingers:
        put(s, [(x, y) for y in range(top, 7)], 'fur3')
        put(s, [(x + 1, y) for y in range(top + 1, 7)], 'fur2')
    put(s, [(x, 11) for x in range(4, 13)], 'fur1')
    put(s, [(6, 12), (7, 12)], 'fur2')
    put(s, [(x, 14) for x in range(6, 12)], 'fur1')
    # pads: a palm pad and four fingertip beans
    put(s, rect(6, 8, 10, 9) - {(6, 9), (10, 9)}, 'pink')
    put(s, [(x + 1, top + 1) for x, top in fingers], 'pink')
    keyline(s)
    return s


def cursor_grab():
    s = new(16, 16)
    fist = rect(2, 5, 13, 11) - {(2, 5), (13, 5), (2, 11), (13, 11)}
    knuckles = set()
    for x in (3, 6, 9, 12):
        knuckles |= {(x, 4), (x + 1, 4)}
    wrist = rect(6, 12, 11, 14)
    shape = fist | knuckles | wrist
    shade(s, shape, *PAW)
    # curled fingertips tucked under: a pink row of beans, finger creases between
    put(s, [(x, 9) for x in range(3, 13) if x not in (5, 8, 11)], 'pink')
    put(s, [(x, y) for x in (5, 8, 11) for y in (5, 6, 7, 8, 9)], 'fur1')
    put(s, [(x, 4) for x in (3, 6, 9, 12)], 'fur3')
    # the thumb wrapped across the front
    put(s, [(x, 10) for x in range(3, 9)], 'fur3')
    put(s, [(x, 11) for x in range(4, 9)], 'fur1')
    put(s, [(x, 14) for x in range(6, 12)], 'fur1')
    keyline(s)
    return s


def cursor_point():
    s = new(16, 16)
    index = _finger(4, 1, 8)
    fist = rect(3, 6, 13, 12) - {(13, 6), (3, 12), (13, 12)}
    knuckles = {(7, 5), (8, 5), (10, 5), (11, 5)}
    wrist = rect(6, 13, 11, 14)
    shape = index | fist | knuckles | wrist
    shade(s, shape, *PAW)
    put(s, [(4, y) for y in range(1, 7)], 'fur3')
    put(s, [(5, y) for y in range(2, 7)], 'fur2')
    put(s, [(5, 2)], 'pink')
    put(s, [(x, y) for x in (6, 9, 12) for y in (6, 7, 8)], 'fur1')
    put(s, [(7, 9), (8, 9), (10, 9), (11, 9)], 'pink')
    put(s, [(x, 11) for x in range(3, 9)], 'fur3')
    put(s, [(x, 12) for x in range(4, 9)], 'fur1')
    put(s, [(x, 14) for x in range(6, 12)], 'fur1')
    keyline(s)
    return s


# ------------------------------------------------------------------ speech bubble (9-slice)

def rounded(w, h, r):
    pts = set()
    for y in range(h):
        for x in range(w):
            cx = min(max(x, r), w - 1 - r)
            cy = min(max(y, r), h - 1 - r)
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6:
                pts.add((x, y))
    return pts


def speech():
    W = H = 16
    s = new(W, H)
    body = rounded(W, H, 4)
    inner = {(x, y) for (x, y) in body if all((x + dx, y + dy) in body for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
    put(s, body - inner, 'ink0')
    put(s, inner, 'bone')
    put(s, [(x, y) for (x, y) in inner if (x, y - 1) not in inner or (x - 1, y) not in inner], 'white')
    put(s, [(x, y) for (x, y) in inner if (x, y + 1) not in inner or (x + 1, y) not in inner], 'fur3')
    return s


def speech_tail():
    s = new(8, 6)
    paint(s, ['..bbbb..',
              '.obbbgo.',
              '.obbgo..',
              'obbgo...',
              'obgo....',
              'oo......'])
    return s


# ------------------------------------------------------------------ the Inspector's clipboard

def clipboard():
    W = H = 32
    s = new(W, H)
    board = rounded(W, H, 2)
    inner = {(x, y) for (x, y) in board if all((x + dx, y + dy) in board for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
    put(s, board - inner, 'ink0')
    put(s, inner, 'sodium0')
    put(s, [(x, y) for (x, y) in inner if (x, y - 1) not in inner or (x - 1, y) not in inner], 'card1')
    put(s, [(x, y) for (x, y) in inner if (x, y + 1) not in inner or (x + 1, y) not in inner], 'rust0')
    # the sheet, its shadow on the board, a pink margin line
    put(s, [(x, 27) for x in range(5, 29)] + [(28, y) for y in range(6, 28)], 'rust0')
    put(s, rect(4, 5, 27, 26), 'bone')
    put(s, [(x, 5) for x in range(4, 28)] + [(4, y) for y in range(5, 27)], 'white')
    put(s, [(x, 26) for x in range(5, 28)] + [(27, y) for y in range(6, 27)], 'fur3')
    put(s, [(7, y) for y in range(6, 26)], 'pink')
    return s


def clipboard_clip():
    W, H = 40, 16
    s = new(W, H)
    # the wire lever loop
    loop = set()
    for x in range(12, 28):
        loop.add((x, 1))
    for y in range(1, 6):
        loop |= {(12, y), (27, y)}
    put(s, loop, 'steel3')
    put(s, [(27, y) for y in range(2, 6)] + [(x, 1) for x in range(22, 28)], 'steel1')
    # rolled hinge bar
    bar = rect(5, 5, 34, 7)
    shade(s, bar, 'steel3', 'steel2', 'steel1')
    # the plate, slightly wider at the bottom
    plate = set()
    for y in range(8, 15):
        inset = 4 - (y - 8) // 3
        plate |= {(x, y) for x in range(inset, W - inset)}
    plate -= {(2, 14), (37, 14)}
    shade(s, plate, 'steel3', 'steel2', 'steel1')
    put(s, [(x, 9) for x in range(6, 34)], 'steel2')
    put(s, [(x, 13) for x in range(6, 34)], 'steel1')
    for rx in (8, 31):
        put(s, [(rx, 11)], 'steel3')
        put(s, [(rx + 1, 11), (rx, 12)], 'steel0')
    put(s, [(24, 10), (25, 11), (26, 10)], 'rust1')   # a little rust bloom
    put(s, [(25, 10)], 'rust2')
    keyline(s)
    return s


# ------------------------------------------------------------------ rubber stamps (96 x 40)
#
# Hand-set block letters (cap 12, 3 px stems) inside a double frame, then turned a few degrees
# with three shears (a pixel-exact rotation: no new pixel sizes), then inked unevenly.

STAMP_GLYPHS = {
    'P': ['#######.', '########', '###..###', '###..###', '###..###', '########', '#######.',
          '###.....', '###.....', '###.....', '###.....', '###.....'],
    'A': ['..####..', '.######.', '###..###', '###..###', '###..###', '###..###', '########',
          '########', '###..###', '###..###', '###..###', '###..###'],
    'S': ['.#######', '########', '###.....', '###.....', '#######.', '.#######', '.....###',
          '.....###', '.....###', '.....###', '########', '#######.'],
    'E': ['########', '########', '###.....', '###.....', '###.....', '######..', '######..',
          '###.....', '###.....', '###.....', '########', '########'],
    'D': ['######..', '#######.', '###..###', '###..###', '###..###', '###..###', '###..###',
          '###..###', '###..###', '###..###', '#######.', '######..'],
    'H': ['###..###'] * 5 + ['########'] * 2 + ['###..###'] * 5,
    'U': ['###..###'] * 10 + ['########', '.######.'],
    'T': ['#########', '#########'] + ['...###...'] * 10,
    'O': ['.######.', '########'] + ['###..###'] * 8 + ['########', '.######.'],
    'W': ['###....###'] * 5 + ['###.##.###'] * 3 + ['##########'] * 2 + ['####..####', '###....###'],
    'N': ['###...###', '####..###', '#####.###', '#########', '###.#####', '###..####']
         + ['###...###'] * 6,
}


def stamp_text_mask(text, gap):
    xs, pts = 0, set()
    for ch in text:
        if ch == ' ':
            xs += 5
            continue
        rows = STAMP_GLYPHS[ch]
        for y, row in enumerate(rows):
            for x, c in enumerate(row):
                if c == '#':
                    pts.add((xs + x, y))
        xs += len(rows[0]) + gap
    return pts, xs - gap


def rotate_shear(pts, deg, cx, cy):
    """Rotate a pixel set by three shears (Paeth): every pixel lands on exactly one pixel."""
    a = math.radians(deg)
    t, sn = math.tan(a / 2), math.sin(a)
    out = set()
    for (x, y) in pts:
        x, y = x - cx, y - cy
        x = x - round(y * t)
        y = y + round(x * sn)
        x = x - round(y * t)
        out.add((x + cx, y + cy))
    return out


def stamp(text, deg, seed, gap):
    W, H = 96, 40
    tpts, tw = stamp_text_mask(text, gap)
    pad = 6                                  # frame 2, gap 1, frame 1, gap 2
    bw, bh = tw + pad * 2, 12 + pad * 2
    ox, oy = (W - bw) // 2, (H - bh) // 2
    m = set()
    for y in range(bh):
        for x in range(bw):
            edge = min(x, y, bw - 1 - x, bh - 1 - y)
            if edge in (0, 1, 3):
                m.add((ox + x, oy + y))
    m -= {(ox, oy), (ox + bw - 1, oy), (ox, oy + bh - 1), (ox + bw - 1, oy + bh - 1)}
    m |= {(ox + pad + x, oy + pad + y) for (x, y) in tpts}
    rng = random.Random(seed)
    # a few nicks out of the outer frame only (before turning, so they stay on the frame)
    for _ in range(4):
        x0 = ox + rng.randrange(3, bw - 4)
        row = rng.choice((oy, oy + 1, oy + bh - 2, oy + bh - 1))
        for x in range(x0, x0 + rng.randrange(1, 3)):
            m.discard((x, row))
    m = rotate_shear(m, deg, W / 2, H / 2)
    # worn ink: sparse pinholes, and one corner where the stamp barely touched the paper
    worn_c = (ox + bw - 10, oy + 4) if seed % 2 else (ox + 8, oy + bh - 5)
    keep = set()
    for (x, y) in m:
        d = math.hypot(x - worn_c[0], y - worn_c[1])
        if rng.random() < 0.03:
            continue
        if d < 6 and rng.random() < 0.45 * (1 - d / 6):
            continue
        keep.add((x, y))
    # splatter beyond the frame
    for _ in range(5):
        a = rng.random() * math.tau
        r = 1.05 + rng.random() * 0.12
        x = int(W / 2 + math.cos(a) * bw / 2 * r)
        y = int(H / 2 + math.sin(a) * bh / 2 * r * 1.15)
        keep.add((x, y))
        if rng.random() < 0.5:
            keep.add((x + 1, y))
    keep = {(x, y) for (x, y) in keep if 0 <= x < W and 0 <= y < H}
    s = new(W, H)
    put(s, keep, 'red')
    # pooled ink: darker where the rubber pressed hardest (bottom edges of strokes, one side)
    for (x, y) in keep:
        if (x, y + 1) not in keep and (x, y - 1) in keep and (x, y - 2) in keep and rng.random() < 0.5:
            s.px(x, y, C('rust2'))
    return s


def stamp_passed():
    return stamp('PASSED', -4.0, 3, gap=2)


def stamp_shutdown():
    return stamp('SHUT DOWN', 3.0, 8, gap=1)


# ------------------------------------------------------------------ Swap Meet price tag (9-slice)

TAG_W, TAG_H = 32, 24


def price_tag():
    s = new(TAG_W, TAG_H)
    top, bot = 6, TAG_H - 1
    body = set()
    for y in range(top, bot + 1):
        cut = max(0, 4 - (y - top), 4 - (bot - y))
        for x in range(cut, TAG_W):
            body.add((x, y))
    body -= {(TAG_W - 1, top), (TAG_W - 1, bot)}
    hole = {(5, 10), (6, 10), (5, 11), (6, 11)}
    body -= hole
    inner = {(x, y) for (x, y) in body if all((x + dx, y + dy) in body for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
    put(s, body - inner, 'ink0')
    put(s, inner, 'card3')
    put(s, [(x, y) for (x, y) in inner if (x, y - 1) not in body or (x - 1, y) not in body], 'bone')
    put(s, [(x, y) for (x, y) in inner if (x, y + 1) not in body or (x + 1, y) not in body], 'card2')
    # a reinforcing ring around the punched hole
    put(s, [(4, 9), (7, 9), (4, 12), (7, 12)], 'card2')
    # the string: through the hole, up and out of the top-left corner, with a little knot
    string = [(5, 9), (5, 8), (4, 7), (4, 6), (3, 5), (3, 4), (2, 3), (2, 2), (3, 1), (4, 1)]
    put(s, string, 'bone')
    put(s, [(6, 9)], 'bone')
    for (x, y) in string + [(6, 9)]:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in string and q != (6, 9) and q not in hole and 0 <= q[0] < TAG_W and 0 <= q[1] < TAG_H:
                if s.get(*q) is None:
                    s.px(q[0], q[1], C('ink0'))
    return s


# ------------------------------------------------------------------ upgrade icons (24 x 24)

def up_lid():
    """Bigger Lid: a little rust Dumpster wearing an enormous black lid like a hat."""
    s = new(24, 24)
    bin_ = set()
    for y in range(15, 22):
        x0 = 6 + (y - 15) // 3
        bin_ |= {(x, y) for x in range(x0, 18)}
    shade(s, bin_, 'rust3', 'rust2', 'rust1')
    put(s, [(x, 18) for x in range(8, 17)], 'rust0')
    put(s, [(x, 19) for x in range(8, 17)], 'rust1')
    put(s, [(8, 22), (9, 22), (15, 22), (16, 22)], 'steel1')
    lid = set()
    for x in range(1, 23):
        d = abs(x - 11.5) / 11.0
        t = 8 + round(d * d * 3)
        lid |= {(x, y) for y in range(t, t + 5)}
    put(s, lid, 'steel1')
    tops = {}
    for (x, y) in lid:
        tops[x] = min(tops.get(x, 99), y)
    put(s, [(x, y) for (x, y) in lid if y == tops[x]], 'steel2')
    put(s, [(x, y) for (x, y) in lid if y == tops[x] + 4], 'steel0')
    put(s, [(x, y) for (x, y) in lid if y == tops[x] + 3 and 3 < x < 20], 'steel0')
    put(s, [(3, 9), (4, 9), (5, 8), (6, 8)], 'steel3')
    # the handle on top
    put(s, [(9, 6), (10, 5), (11, 5), (12, 5), (13, 5), (14, 6)], 'steel2')
    put(s, [(10, 5)], 'steel3')
    keyline(s)
    return s


def up_hinges():
    """Greased Hinges: a steel hinge, an oil can over it, one fat amber drop."""
    s = new(24, 24)
    leaf_l = rect(2, 11, 8, 21) - {(2, 11), (2, 21)}
    leaf_r = rect(12, 11, 18, 21) - {(18, 11), (18, 21)}
    shade(s, leaf_l, 'steel3', 'steel2', 'steel1')
    shade(s, leaf_r, 'steel3', 'steel2', 'steel1')
    barrel = rect(9, 10, 11, 22)
    put(s, barrel, 'steel2')
    put(s, [(9, y) for y in range(10, 23)], 'steel3')
    put(s, [(11, y) for y in range(10, 23)], 'steel1')
    put(s, [(x, y) for x in (9, 10, 11) for y in (14, 18)], 'steel0')
    for (hx, hy) in ((5, 14), (5, 18), (15, 14), (15, 18)):
        put(s, [(hx, hy)], 'ink1')
        put(s, [(hx - 1, hy - 1)], 'steel3')
    # a shiny wet streak of oil down the barrel
    put(s, [(10, 11), (10, 12), (10, 13), (10, 15), (10, 16)], 'sodium3')
    put(s, [(10, 17)], 'sodium2')
    # oil can: a squat rust-red can, a steel cone, a long thin spout aiming at the barrel
    body = rect(15, 5, 21, 10) - {(15, 10), (21, 10)}
    shade(s, body, 'rust3', 'rust2', 'rust1')
    put(s, [(x, 8) for x in range(16, 21)], 'yellow')
    put(s, [(16, 8)], 'sodium3')
    cone = {(16, 4), (17, 4), (18, 4), (19, 4), (20, 4), (17, 3), (18, 3), (19, 3)}
    shade(s, cone, 'steel3', 'steel2', 'steel1')
    spout = [(18, 2), (17, 2), (16, 2), (15, 3), (14, 3), (13, 4), (12, 5), (11, 6)]
    put(s, spout, 'steel2')
    put(s, [(18, 2), (16, 2), (14, 3)], 'steel3')
    put(s, [(22, 6), (22, 7), (22, 8)], 'steel1')    # handle
    keyline(s)
    # the drop, falling between spout and barrel
    put(s, [(10, 8)], 'sodium3')
    put(s, [(10, 9)], 'sodium2')
    s.px(9, 9, C('ink0'))
    s.px(11, 9, C('ink0'))
    return s


def up_raccoon():
    """Extra Raccoon: a raccoon head (mask, white brows, pink nose) and a green +."""
    s = new(24, 24)
    head = ell(11.0, 14.5, 8.6, 7.6)
    ears = set()
    for (ex, flip) in ((5, -1), (17, 1)):
        ears |= ell(ex, 7.5, 2.6, 3.0)
    shade(s, head | ears, 'fur3', 'fur2', 'fur1')
    put(s, [(4, 7), (5, 6), (17, 6), (18, 7)], 'fur0')
    put(s, [(5, 8), (17, 8)], 'pink')
    # white brows and cheeks
    put(s, [(6, 10), (7, 10), (8, 10), (14, 10), (15, 10), (16, 10)], 'bone')
    # the mask: a dark band dipping between the eyes
    mask = set()
    for x in range(3, 20):
        y0 = 11 if x not in (10, 11, 12) else 12
        mask |= {(x, y0), (x, y0 + 1), (x, y0 + 2)}
    mask &= head
    put(s, mask, 'fur0')
    # eyes: bone with ink pupils and a glint
    for ex in (7, 15):
        put(s, [(ex, 12), (ex + 1, 12), (ex, 13), (ex + 1, 13)], 'bone')
        put(s, [(ex + 1, 13)], 'ink0')
        put(s, [(ex, 12)], 'white')
    # muzzle, nose, mouth
    muzzle = ell(11.5, 17.6, 3.6, 2.6)
    put(s, muzzle & head, 'bone')
    put(s, [(10, 16), (11, 16), (12, 16)], 'pink')
    put(s, [(11, 17)], 'ink0')
    put(s, [(10, 18), (12, 18)], 'ink0')
    put(s, [(9, 19), (13, 19)], 'fur3')
    keyline(s)
    # the + badge
    plus = rect(19, 1, 20, 7) | rect(17, 3, 22, 5)
    plus = {(x, y) for (x, y) in plus if (x, y) not in {(17, 3), (22, 3), (17, 5), (22, 5)} or True}
    plus = rect(19, 1, 20, 6) | rect(17, 3, 22, 4)
    for (x, y) in plus:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                q = (x + dx, y + dy)
                if q not in plus and 0 <= q[0] < 24 and 0 <= q[1] < 24:
                    s.px(q[0], q[1], C('ink0'))
    shade(s, plus, 'toxic3', 'toxic2', 'toxic1')
    return s


def up_compactor():
    """Industrial Compactor: a hydraulic press squashing a can flat."""
    s = new(24, 24)
    cols = rect(2, 4, 4, 20) | rect(19, 4, 21, 20)
    shade(s, cols, 'steel2', 'steel1', 'steel0')
    beam = rect(1, 2, 22, 5)
    put(s, beam, 'yellow')
    for (x, y) in beam:
        if (x + y) % 4 in (0, 1):
            s.px(x, y, C('ink1'))
    put(s, [(x, 2) for x in range(1, 23)], 'sodium3')
    base = rect(1, 20, 22, 22)
    shade(s, base, 'steel1', 'steel0', 'ink1')
    shaft = rect(10, 6, 13, 10)
    put(s, shaft, 'steel3')
    put(s, [(13, y) for y in range(6, 11)], 'steel2')
    put(s, [(11, y) for y in range(6, 11)], 'white')
    plate = rect(6, 11, 17, 13)
    shade(s, plate, 'steel3', 'steel2', 'steel1')
    # the squashed can, bulging out from under the plate
    can = rect(5, 15, 18, 19) - {(5, 15), (18, 15)}
    shade(s, can, 'rust3', 'rust2', 'rust1')
    put(s, [(x, 17) for x in range(7, 17, 2)], 'steel3')
    put(s, [(x, 14) for x in range(7, 17)], 'steel2')
    keyline(s)
    # squish marks
    put(s, [(3, 15), (2, 14), (20, 15), (21, 14)], 'sodium3')
    return s


def up_freshener():
    """Air Freshener: the little pine tree that hangs off a mirror, on its string."""
    s = new(24, 24)
    string = [(12, y) for y in range(0, 5)]
    tiers = [(12, 5, 2, 9), (12, 9, 3, 13), (12, 13, 5, 18)]   # (cx, top, half-width at top, bottom)
    tree = set()
    for cx, t, hw0, b in tiers:
        for y in range(t, b + 1):
            hw = hw0 + (y - t)
            tree |= {(x, y) for x in range(cx - hw, cx + hw + 1)}
    tree |= {(x, y) for x in range(4, 21) for y in range(18, 20)}
    tree |= rect(10, 20, 13, 21)
    tree -= {(4, 19), (20, 19)}
    shade(s, tree, 'toxic2', 'toxic1', 'toxic0')
    # needle notches on each tier
    for (x, y) in ((8, 12), (16, 12), (6, 17), (18, 17), (10, 8), (14, 8)):
        s.px(x, y, C('toxic0'))
    put(s, [(11, 6), (10, 10), (9, 14), (8, 15)], 'toxic3')
    keyline(s)
    put(s, string, 'bone')
    put(s, [(11, 0), (13, 0)], 'ink0')
    # a fresh sparkle
    put(s, [(20, 4), (19, 5), (21, 5), (20, 6)], 'white')
    put(s, [(20, 5)], 'toxic3')
    return s


def up_owl():
    """Plastic Owl: a brown plastic decoy, huge yellow eyes, ear tufts, a gull feather fleeing."""
    s = new(24, 24)
    body = ell(11.5, 14.5, 7.4, 8.2)
    tufts = {(5, 5), (6, 5), (5, 6), (6, 6), (7, 6), (17, 5), (18, 5), (16, 6), (17, 6), (18, 6)}
    base = rect(6, 21, 17, 22)
    shade(s, body | tufts, 'card2', 'card1', 'card0')
    put(s, base, 'steel1')
    put(s, [(x, 21) for x in range(6, 18)], 'steel2')
    # chest: lighter, with V feather marks
    chest = ell(11.5, 17.0, 4.6, 4.4) & body
    put(s, chest, 'card2')
    for (x, y) in ((9, 16), (10, 17), (11, 16), (13, 16), (14, 17), (15, 16), (11, 19), (12, 20), (13, 19)):
        s.px(x, y, C('card0'))
    # facial discs and the big eyes
    for ex in (8.5, 14.5):
        put(s, ell(ex, 10.5, 3.0, 2.8), 'card3')
        put(s, ell(ex, 10.5, 2.0, 2.0), 'yellow')
        put(s, [(int(ex), 10), (int(ex), 11)], 'ink0')
        put(s, [(int(ex) - 1, 9)], 'white')
    put(s, [(11, 12), (12, 12), (11, 13)], 'sodium2')
    put(s, [(12, 13)], 'sodium1')
    put(s, [(7, 7), (8, 7)], 'white')        # the plastic shine
    keyline(s)
    # a gull feather drifting away in a hurry
    paint(s, ['..oo',
              '.owo',
              'owbo',
              'Go..'], 19, 1)
    return s


# ------------------------------------------------------------------ menu icons (16 x 16)

def icon_pause():
    s = new(16, 16)
    for x0 in (3, 9):
        shade(s, rect(x0, 2, x0 + 3, 13), 'white', 'bone', 'fur3')
    keyline(s)
    return s


def icon_play():
    s = new(16, 16)
    tri = set()
    for y in range(2, 14):
        d = 6 - abs(y - 7.5) + 0.5
        tri |= {(x, y) for x in range(4, 4 + round(d * 1.65) + 1)}
    shade(s, tri, 'white', 'bone', 'fur3')
    keyline(s)
    return s


def icon_book():
    """The Trash Almanac: a fat, taped-up book with a bone title label."""
    s = new(16, 16)
    pages = rect(4, 3, 13, 14)
    put(s, pages, 'bone')
    put(s, [(13, y) for y in range(4, 14)] + [(x, 13) for x in range(5, 13)], 'fur3')
    put(s, [(13, y) for y in range(5, 13, 2)], 'bone')
    cover = rect(2, 1, 12, 12)
    shade(s, cover, 'rust3', 'rust2', 'rust1')
    # duct tape on the spine
    put(s, [(2, y) for y in range(1, 13)] + [(3, y) for y in range(1, 13)], 'steel3')
    put(s, [(3, y) for y in range(2, 12, 3)], 'steel2')
    # title label with a scribble
    put(s, rect(6, 3, 10, 6), 'bone')
    put(s, [(7, 4), (8, 4), (9, 4), (7, 5), (8, 5)], 'ink1')
    # a stain
    put(s, [(9, 9), (10, 9), (10, 10)], 'rust1')
    keyline(s)
    return s


STAR = ['................',
        '.......oo.......',
        '......oyyo......',
        '......oyyo......',
        '.....oyyyyo.....',
        'ooooooyyyyoooooo',
        'oyyyyyyyyyyyyyyo',
        '.oyyyyyyyyyyyyo.',
        '..oyyyyyyyyyyo..',
        '...oyyyyyyyyo...',
        '...oyyyyyyyyo...',
        '..oyyyyooyyyyo..',
        '..oyyyo..oyyyo..',
        '.oyyyo....oyyyo.',
        '.oyyo......oyyo.',
        '.ooo........ooo.']


def icon_star():
    s = new(16, 16)
    fill = {(x, y) for y, row in enumerate(STAR) for x, c in enumerate(row) if c == 'y'}
    shade(s, fill, 'sodium3', 'yellow', 'sodium2')
    put(s, [(x, y) for y, row in enumerate(STAR) for x, c in enumerate(row) if c == 'o'], 'ink0')
    put(s, [(7, 3), (6, 6), (7, 6)], 'white')
    return s


def icon_lock():
    s = new(16, 16)
    shackle = set()
    for (x, y) in ell(8, 6.5, 4.6, 5.0):
        if y <= 7 and (x, y) not in ell(8, 6.5, 2.4, 3.0):
            shackle.add((x, y))
    put(s, shackle, 'steel2')
    put(s, [(x, y) for (x, y) in shackle if x < 7], 'steel3')
    put(s, [(x, y) for (x, y) in shackle if x > 9], 'steel1')
    body = rect(2, 7, 13, 14) - {(2, 14), (13, 14)}
    shade(s, body, 'sodium3', 'yellow', 'sodium2')
    put(s, [(x, 11) for x in range(3, 13)], 'sodium2')
    put(s, [(7, 9), (8, 9), (7, 10), (8, 10), (7, 11), (7, 12)], 'ink0')
    keyline(s)
    return s


def icon_check():
    s = new(16, 16)
    mark = thick([(3, 8), (6, 11), (12, 4)], 3)
    shade(s, mark, 'toxic3', 'toxic2', 'toxic1')
    keyline(s)
    return s


def icon_cross():
    s = new(16, 16)
    mark = thick([(4, 4), (11, 11)], 3) | thick([(11, 4), (4, 11)], 3)
    shade(s, mark, 'pink', 'red', 'rust2')
    keyline(s)
    return s


ALL = {
    'pip_lid_full': (lambda: pip(True), {}),
    'pip_lid_empty': (lambda: pip(False), {}),
    'cursor_open': (cursor_open, {'anchor': [8, 8]}),
    'cursor_grab': (cursor_grab, {'anchor': [8, 8]}),
    'cursor_point': (cursor_point, {'anchor': [4, 0]}),
    'speech': (speech, {'slice': [6, 6, 6, 6]}),
    'speech_tail': (speech_tail, {'anchor': [4, 1]}),
    'clipboard': (clipboard, {'slice': [8, 8, 8, 8]}),
    'clipboard_clip': (clipboard_clip, {'anchor': [20, 15]}),
    'stamp_passed': (stamp_passed, {'anchor': [48, 20]}),
    'stamp_shutdown': (stamp_shutdown, {'anchor': [48, 20]}),
    'price_tag': (price_tag, {'slice': [10, 13, 4, 5]}),
    'up_lid': (up_lid, {}),
    'up_hinges': (up_hinges, {}),
    'up_raccoon': (up_raccoon, {}),
    'up_compactor': (up_compactor, {}),
    'up_freshener': (up_freshener, {}),
    'up_owl': (up_owl, {}),
    'icon_pause': (icon_pause, {}),
    'icon_play': (icon_play, {}),
    'icon_book': (icon_book, {}),
    'icon_star': (icon_star, {}),
    'icon_lock': (icon_lock, {}),
    'icon_check': (icon_check, {}),
    'icon_cross': (icon_cross, {}),
}
