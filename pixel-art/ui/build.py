"""UI family: cardboard panel, bone paper note, buttons, duct tape, the Stink jar, icons.

    cd pixel-art/ui && py -3 build.py

-> public/art/ui.png + ui.json, art-src/review/ui.png
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from kit import (C, RGBA, new, Atlas, nine_slice, review_sheet, strip, on, ell, put,  # noqa: E402
                 keyline, REVIEW, up)
from PIL import Image  # noqa: E402

KEY = {
    'o': 'ink0', 'i': 'ink1', 'j': 'ink2',
    '0': 'card0', '1': 'card1', '2': 'card2', '3': 'card3',
    'b': 'bone', 'w': 'white', 'g': 'fur3', 'G': 'fur2',
    'S': 'steel3', 's': 'steel2', 'T': 'steel1', 't': 'steel0',
}


def paint(s, rows, ox=0, oy=0, key=KEY):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == ' ':
                continue          # leave what is there
            if ch == '.':
                s.px(ox + x, oy + y, None)
            else:
                s.px(ox + x, oy + y, C(key[ch]))


# ------------------------------------------------------------------ panel (cardboard 9-slice)
#
# 24 x 24, borders 8. Middles are flat (they tile), all the tears live in the corners.

def build_panel():
    W = H = 24
    s = new(W, H)
    for y in range(H):
        for x in range(W):
            c = 'card1'
            if y == 1 or x == 1:
                c = 'card3'
            elif y == 2 or x == 2:
                c = 'card2'
            if y in (21, 22) and x >= 2:
                # the cut edge of corrugated board: flute crests zig-zag along the depth band
                c = 'card1' if (y == 21 and x % 4 == 1) or (y == 22 and x % 4 == 3) else 'card0'
            if x == 22 and y >= 2:
                c = 'card0'
            if x in (0, W - 1) or y in (0, H - 1):
                c = 'ink0'
            s.px(x, y, C(c))
    # top-left: rounded
    paint(s, ['.ooooooo',
              'o3333333',
              'o3222222'], 0, 0)
    # top-right: the tip torn off, the torn edge shows the fluting
    paint(s, ['oooo....',
              '3333o...',
              '22223fo.',
              '111113do',
              '1111113o',
              '1111110o',
              '1111110o',
              '1111110o'], 16, 0, key={**KEY, 'd': 'card0', 'f': 'card2'})
    # bottom-left: the top liner peeled back, corrugated flutes underneath
    paint(s, ['o3111111',
              'o3111111',
              'o3w33311',
              'o3FfFf31',
              'o3FfFfF1',
              'o2      ',
              'o2      ',
              '.ooooooo'], 0, 16, key={**KEY, 'F': 'card2', 'f': 'card0', 'w': 'card3'})
    # bottom-right: a crushed, rounded corner
    paint(s, ['      0o',
              '      0o',
              '      0o',
              '      0o',
              '     0o.',
              '     o..',
              '    o...',
              'oooo....'], 16, 16)
    return s


# ------------------------------------------------------------------ paper (bone note 9-slice)

def build_paper():
    W = H = 24
    top = {x: 1 for x in range(9, 13)}
    bot = {x: 1 for x in range(13, 17)}
    lef = {y: 1 for y in range(10, 14)}
    rig = {y: 1 for y in range(7, 10)}

    def inside(x, y):
        return (0 <= x < W and 0 <= y < H and y >= top.get(x, 0) and y <= H - 1 - bot.get(x, 0)
                and x >= lef.get(y, 0) and x <= W - 1 - rig.get(y, 0))

    s = new(W, H)
    for y in range(H):
        for x in range(W):
            if not inside(x, y):
                continue
            n = [inside(x + dx, y + dy) for dx, dy in ((0, -1), (-1, 0), (0, 1), (1, 0))]
            if not all(n):
                c = 'ink0'
            elif not inside(x, y - 2) or not inside(x - 2, y):
                c = 'white'
            elif not inside(x, y + 2) or not inside(x + 2, y):
                c = 'fur3'
            else:
                c = 'bone'
            s.px(x, y, C(c))
    # creases in the corners (never in the middles, so text stays clean)
    put(s, [(3, 4), (4, 4), (5, 3)], 'fur3')
    put(s, [(2, 19), (3, 18), (4, 18)], 'fur3')
    put(s, [(19, 20), (20, 19), (20, 18)], 'white')
    # dog-ear: the top-right corner folded over
    paint(s, ['oo....',
              'woo...',
              'bogo..',
              'boggo.',
              'booooo',
              'bbbbgo'], 18, 0)
    s.px(0, 0, None)
    s.px(W - 1, H - 1, None)
    s.px(0, H - 1, None)
    return s


# ------------------------------------------------------------------ buttons (9-slice, 24 x 16)
#
# Up: face rows 2..12, two rows of depth. Down: the whole face 1 px lower, one row of depth.
# Same footprint and same slice so the code can swap them; nudge the label 1 px down when pressed.

def build_button(down=False):
    W, H = 24, 16
    s = new(W, H)
    top = 1 if down else 0
    depth = 1 if down else 2
    face_bot = H - 2 - depth          # last face row
    for y in range(top, H):
        for x in range(W):
            if x in (0, W - 1) or y in (top, H - 1):
                c = 'ink0'
            elif y > face_bot:
                # corrugated cut edge, like the panel's
                c = 'card1' if (y - face_bot) % 2 == 1 and x % 4 == 1 or (y - face_bot) % 2 == 0 and x % 4 == 3 else 'card0'
            elif y == top + 1 or x == 1:
                c = 'card3'
            elif y == face_bot or x == W - 2:
                c = 'card1'
            else:
                c = 'card2'
            s.px(x, y, C(c))
    for (x, y) in ((0, top), (W - 1, top), (0, H - 1), (W - 1, H - 1)):
        s.px(x, y, None)
    # the depth band keeps an ink edge on the sides; corners of the face are rounded
    s.px(1, top + 1, C('card3'))
    return s


# ------------------------------------------------------------------ duct tape

def build_tape_h():
    """Flat silver duct tape: a bone sheen, lengthwise threads, both ends torn ragged."""
    rows = ['..oooooooooooooo.o..',
            '.oSSSBBBBSSSBBBSSoSo',
            'oSSSSSSSSSSSSSSSSSSo',
            '.oSsSSsSSSSsSSSsSSSo',
            'oSSSSSSSSSSSSSSSSSo.',
            '.osSsssSsssSsssSsSso',
            'oSssssssssssssssssso',
            '.o.oooooooooooooooo.']
    s = new(20, 8)
    paint(s, rows, key={**KEY, 'B': 'bone'})
    return s


def build_tape_v():
    # the same strip turned so its sheen faces the light (left)
    h = build_tape_h().composite(1).rotate(90, expand=True)
    s = new(8, 20)
    for y in range(20):
        for x in range(8):
            p = h.getpixel((x, y))
            if p[3]:
                s.px(x, y, p)
    return s


# ------------------------------------------------------------------ the Stink jar (24 x 104)
#
# Lid rows 0..8, glass neck 9..12, shoulders 13..16, body 17..98, thick glass base 99..103.
# The sludge goes in INNER (x, y, w, h); draw the jar first, then the sludge clipped to INNER,
# then optionally `jar_glare` on top so the glass shine sits over the sludge.

JW, JH = 24, 104
INNER = [3, 17, 18, 81]   # x 3..20, y 17..97


def jar_mask():
    m = set()
    # lid
    for y in range(1, 8):
        for x in range(2, 22):
            m.add((x, y))
    # neck
    for y in range(8, 13):
        for x in range(3, 21):
            m.add((x, y))
    # shoulders: widen 3 -> 1 over four rows
    for y, x0 in ((13, 2), (14, 1), (15, 1), (16, 1)):
        for x in range(x0, JW - x0):
            m.add((x, y))
    for y in range(17, 102):
        for x in range(1, 23):
            m.add((x, y))
    # rounded base
    for x in range(2, 22):
        m.add((x, 102))
    m.discard((1, 101))
    m.discard((22, 101))
    return m


def build_jar(glare_only=False):
    s = new(JW, JH)
    m = jar_mask()
    if glare_only:
        glare(s)
        return s
    for (x, y) in m:
        s.px(x, y, C('ink1'))
    # --- lid: dull steel, knurled, a rust bloom and a dent
    for y in range(1, 8):
        for x in range(2, 22):
            c = 'steel2'
            if y == 1:
                c = 'steel3'
            elif y == 7:
                c = 'steel0'
            elif y == 6:
                c = 'steel1'
            elif x % 2 == 1 and 3 <= y <= 5:
                c = 'steel1'
            if x == 2 and y < 7:
                c = 'steel3'
            if x == 21 and y < 7:
                c = 'steel1'
            s.px(x, y, C(c))
    put(s, [(15, 3), (16, 4), (17, 3), (16, 3)], 'rust2')
    put(s, [(17, 4), (15, 4), (18, 5)], 'rust1')
    put(s, [(16, 2)], 'rust3')
    put(s, [(7, 1), (8, 1)], 'steel1')     # a dent in the rim
    put(s, [(7, 2)], 'steel3')
    # --- neck: glass threads
    for y in range(8, 13):
        for x in range(3, 21):
            c = 'ink1'
            if x == 3:
                c = 'steel3'
            elif x == 4:
                c = 'night2'
            elif x == 20:
                c = 'steel1'
            elif x == 19:
                c = 'night1'
            s.px(x, y, C(c))
    for y in (9, 11):
        for x in range(4, 20):
            s.px(x, y, C('night2' if x > 5 else 'steel2'))
    # --- shoulders and body walls
    for y in range(13, 103):
        row = sorted(x for (x, yy) in m if yy == y)
        if not row:
            continue
        x0, x1 = row[0], row[-1]
        s.px(x0, y, C('steel3'))
        if x1 - x0 > 4:
            s.px(x0 + 1, y, C('night2'))
            s.px(x1, y, C('steel1'))
            s.px(x1 - 1, y, C('night1'))
    # shoulder glass catches the light
    put(s, [(4, 13), (5, 13), (6, 13), (3, 14), (4, 14), (2, 15)], 'steel3')
    put(s, [(7, 13), (8, 13)], 'steel2')
    put(s, [(18, 13), (19, 13), (20, 14), (21, 15)], 'steel1')
    # --- thick glass base
    for y in range(98, 103):
        for x in range(2, 22):
            if (x, y) in m:
                s.px(x, y, C('night2' if y in (98, 101) else 'night3'))
    put(s, [(x, 99) for x in range(3, 9)], 'steel2')
    put(s, [(x, 100) for x in range(15, 21)], 'night2')
    # --- inside: an empty, dark jar with a faint far-wall reflection
    put(s, [(18, y) for y in range(22, 92) if y % 9 not in (0, 1)], 'night0')
    glare(s)
    # --- level ticks on the right wall (quarters of INNER), the top one red
    ix, iy, iw, ih = INNER
    for k in (1, 2, 3):
        y = iy + round(ih * k / 4)
        put(s, [(20, y), (21, y)], 'bone')
    put(s, [(20, iy + 6), (21, iy + 6)], 'red')
    keyline(s)
    return s


def glare(s):
    # the long shine on the left of the glass, broken in two, plus a fleck on the right
    put(s, [(5, y) for y in range(22, 44)], 'steel3')
    put(s, [(6, y) for y in range(24, 38)], 'white')
    put(s, [(5, y) for y in range(50, 58)], 'steel2')
    put(s, [(5, y) for y in range(62, 64)], 'steel2')
    put(s, [(18, 85), (18, 86), (17, 88)], 'steel2')


# ------------------------------------------------------------------ flies over the lid (24 x 16, 2)

def fly(s, x, y, wings_up):
    """A blowfly, 4 x 3: two bone wings that flick, a dark 2 x 2 body with a green glint."""
    put(s, [(x + 1, y + 1), (x + 2, y + 1), (x + 1, y + 2)], 'ink0')
    put(s, [(x + 2, y + 2)], 'toxic1')
    if wings_up:
        put(s, [(x, y), (x + 3, y)], 'bone')
    else:
        put(s, [(x, y + 1), (x + 3, y + 1)], 'steel3')


def build_jar_flies():
    s = new(24, 16, frames=2)
    flies = [((3, 7), (5, 5)), ((13, 2), (10, 4)), ((18, 9), (19, 7))]
    for f in (1, 2):
        s.frame(f)
        for i, (a, b) in enumerate(flies):
            x, y = a if f == 1 else b
            fly(s, x, y, wings_up=(f + i) % 2 == 0)
    s.frame(1)
    return s


# ------------------------------------------------------------------ icons (16 x 16)

def icon_shiny():
    """The currency: a gold bottle cap tipped toward you, crimped skirt, one sparkle."""
    s = new(16, 16)
    cx = 7.5
    top = ell(cx, 7.0, 6.6, 4.6)
    bottom = ell(cx, 9.0, 6.6, 4.6)
    skirt = set(bottom) | {(x, y) for (x, y) in top if y >= 7}
    for (x, y) in skirt:
        s.px(x, y, C('sodium2' if x % 2 else 'sodium1'))
    lows = {}
    for (x, y) in skirt:
        lows[x] = max(lows.get(x, -1), y)
    for x, y in lows.items():
        if x % 2 == 0 and 1 < x < 14:
            s.px(x, y + 1, C('sodium1'))
    put(s, top, 'yellow')
    put(s, [(x, y) for (x, y) in top if (x - 1, y) not in top or (x, y - 1) not in top], 'sodium3')
    put(s, [(x, y) for (x, y) in top if (x + 1, y) not in top or (x, y + 1) not in top], 'sodium2')
    # the dished middle of the cap, and its cork ring
    dish = ell(cx + 0.5, 7.5, 4.0, 2.6)
    put(s, dish, 'sodium2')
    put(s, [(x, y) for (x, y) in dish if (x, y - 1) not in dish or (x - 1, y) not in dish], 'sodium1')
    put(s, [(4, 4), (5, 4), (3, 5), (6, 3)], 'white')
    keyline(s)
    put(s, [(14, 0), (13, 1), (15, 1), (14, 2)], 'white')
    put(s, [(14, 1)], 'yellow')
    return s


def icon_stink():
    """A puffy green-brown stink cloud with three wavy stink lines."""
    s = new(16, 16)
    cloud = (ell(4.5, 10.5, 3.0, 3.0) | ell(8.5, 9.0, 3.4, 3.4) | ell(12.0, 10.5, 2.8, 2.8)
             | {(x, y) for x in range(2, 15) for y in range(10, 14)})
    cloud = {(x, y) for (x, y) in cloud if 1 <= x <= 14 and y <= 13}
    cloud -= {(2, 13), (14, 13)}
    put(s, cloud, 'grime1')
    lit = ell(4.0, 10.0, 2.6, 2.4) | ell(8.0, 8.5, 3.0, 2.8) | ell(11.5, 10.0, 2.2, 2.2)
    put(s, [p for p in lit if p in cloud], 'grime2')
    put(s, [(x, y) for (x, y) in cloud if (x, y - 1) not in cloud and x < 12], 'grime3')
    put(s, [(10, 12), (11, 12), (12, 12), (5, 12)], 'grime0')
    put(s, [(6, 10), (7, 11)], 'grime1')
    for x0, y0, h in ((3, 1, 5), (8, 0, 5), (12, 1, 5)):
        offs = [0, 1, 1, 0, 0, 1]
        put(s, [(x0 + offs[i], y0 + i) for i in range(h)], 'grime3')
    keyline(s)
    return s


def icon_clock():
    """An alarm clock: two bells, a rust-red rim, bone face, ink hands."""
    s = new(16, 16)
    body = ell(8, 9, 6.4, 6.0)
    body = {(x, y) for (x, y) in body if y <= 14}
    # bells
    for bx in (3, 12):
        put(s, ell(bx + 0.5, 3.0, 2.2, 1.9), 'steel2')
        put(s, [(bx - 1, 2), (bx, 2), (bx - 1, 3)], 'steel3')
    put(s, [(7, 1), (8, 1)], 'steel1')
    put(s, body, 'rust2')
    put(s, [(x, y) for (x, y) in body if (x - 1, y) not in body or (x, y - 1) not in body], 'rust3')
    put(s, [(x, y) for (x, y) in body if (x + 1, y) not in body or (x, y + 1) not in body], 'rust1')
    face = ell(8, 9, 4.6, 4.3)
    put(s, face, 'bone')
    put(s, [(x, y) for (x, y) in face if (x, y + 1) not in face or (x + 1, y) not in face], 'fur3')
    put(s, [(5, 7), (6, 6)], 'white')
    # hands: hour up, minute right; a red centre pin
    put(s, [(7, 6), (7, 7), (7, 8)], 'ink0')
    put(s, [(8, 9), (9, 9), (10, 9)], 'ink0')
    put(s, [(7, 9)], 'red')
    # feet
    put(s, [(3, 15), (12, 15)], 'ink0')
    keyline(s)
    s.px(3, 15, C('ink0'))
    s.px(12, 15, C('ink0'))
    return s


def icon_lid():
    """The Dumpster, side on: rust bin with a sloped front, black plastic lid propped open,
    two eyes in the gap, casters."""
    s = new(16, 16)
    body = set()
    for y in range(8, 14):
        x0 = 1 + (y - 8) // 2          # the sloped front
        for x in range(x0, 15):
            body.add((x, y))
    for (x, y) in body:
        c = 'rust2'
        if y == 8 or (x - 1, y) not in body:
            c = 'rust3'
        elif x >= 13 or y == 13:
            c = 'rust1'
        s.px(x, y, C(c))
    # the fork sleeve along the side
    put(s, [(x, 10) for x in range(3, 14)], 'rust0')
    put(s, [(x, 11) for x in range(3, 14)], 'rust1')
    put(s, [(3, 10), (3, 11)], 'rust3')
    # the dark gap under the lid, two eyes looking out
    for y in range(5, 8):
        for x in range(8 - y, 15):
            s.px(x, y, C('ink0'))
    put(s, [(6, 7), (8, 7)], 'sodium3')
    # lid: a slab from the hinge (back, right) up to the front (left)
    lid = []
    for x in range(1, 16):
        y = 6 - round((15 - x) * 0.33)
        lid += [(x, y), (x, y - 1)]
    tops = {}
    for (x, y) in lid:
        tops[x] = min(tops.get(x, 99), y)
    put(s, [p for p in lid if p[1] == tops[p[0]]], 'steel1')
    put(s, [p for p in lid if p[1] != tops[p[0]]], 'steel0')
    put(s, [(2, 1), (3, 1), (4, 2)], 'steel2')
    put(s, [(14, 6), (15, 6)], 'steel2')   # hinge
    # casters
    put(s, [(3, 14), (4, 14), (12, 14), (13, 14)], 'steel1')
    keyline(s)
    put(s, [(3, 15), (13, 15)], 'ink0')
    return s


def icon_truck():
    """A rear-loader garbage truck, side on: green hopper, grey cab, a sodium headlamp."""
    s = new(16, 16)
    for y in range(2, 11):
        for x in range(1, 10):
            c = 'grime2'
            if y == 2:
                c = 'grime3'
            elif x == 1:
                c = 'grime3'
            elif y == 10:
                c = 'grime1'
            elif x in (4, 7) and 3 < y < 10:
                c = 'grime1'
            s.px(x, y, C(c))
    # junk poking out of the hopper
    put(s, [(2, 1), (3, 1), (3, 0)], 'steel3')
    put(s, [(5, 1), (6, 1)], 'card2')
    # cab
    for y in range(5, 11):
        for x in range(10, 15):
            s.px(x, y, C('steel2'))
    put(s, [(x, 5) for x in range(10, 14)], 'steel3')
    put(s, [(12, 6), (13, 6), (12, 7), (13, 7)], 'blue')
    put(s, [(12, 6)], 'white')
    put(s, [(10, y) for y in range(6, 11)], 'steel1')
    put(s, [(14, 9)], 'sodium3')
    put(s, [(14, 10)], 'steel1')
    s.px(14, 5, None)
    put(s, [(x, 11) for x in range(1, 15)], 'ink1')
    for wx in (4, 11):
        put(s, ell(wx + 0.5, 12.5, 2.2, 2.2), 'ink1')
        put(s, [(wx, 12)], 'steel2')
    keyline(s)
    return s


def speaker(s):
    for y in range(6, 11):
        for x in range(2, 5):
            s.px(x, y, C('steel2'))
    put(s, [(2, y) for y in range(6, 11)], 'steel3')
    for i, x in enumerate(range(5, 9)):
        for y in range(5 - i, 12 + i):
            s.px(x, y, C('steel3' if i < 3 else 'steel2'))
    put(s, [(5, y) for y in range(6, 11)], 'steel2')
    put(s, [(8, y) for y in range(3, 14)], 'steel1')


def icon_sound():
    s = new(16, 16)
    speaker(s)
    put(s, [(10, 7), (11, 8), (10, 9)], 'bone')
    put(s, [(11, 5), (12, 6), (13, 7), (13, 8), (13, 9), (12, 10), (11, 11)], 'bone')
    keyline(s)
    return s


def icon_mute():
    s = new(16, 16)
    speaker(s)
    put(s, [(10, 6), (11, 7), (12, 8), (13, 9), (14, 10), (14, 6), (13, 7), (11, 9), (10, 10)], 'red')
    keyline(s)
    return s


# ------------------------------------------------------------------ atlas

atlas = Atlas('ui', max_w=256)
PANEL, PAPER = build_panel(), build_paper()
BTN, BTN_DOWN = build_button(), build_button(down=True)
JAR, GLARE, FLIES = build_jar(), build_jar(glare_only=True), build_jar_flies()

atlas.add('panel', PANEL, slice=[8, 8, 8, 8])
atlas.add('paper', PAPER, slice=[6, 6, 6, 6])
atlas.add('button', BTN, slice=[4, 4, 4, 4])
atlas.add('button_down', BTN_DOWN, slice=[4, 4, 4, 4])
atlas.add('tape_h', build_tape_h())
atlas.add('tape_v', build_tape_v())
atlas.add('jar', JAR, inner=INNER, anchor=[12, 103])
atlas.add('jar_glare', GLARE, inner=INNER, anchor=[12, 103])
atlas.add('jar_flies', FLIES, fps=8, anchor=[12, 15])
ICONS = {
    'icon_shiny': icon_shiny(), 'icon_stink': icon_stink(), 'icon_clock': icon_clock(),
    'icon_lid': icon_lid(), 'icon_truck': icon_truck(), 'icon_mute': icon_mute(),
    'icon_sound': icon_sound(),
}
for name, sp in ICONS.items():
    atlas.add(name, sp)
import menus  # noqa: E402

MENU = {}
for name, (fn, meta) in menus.ALL.items():
    MENU[name] = fn()
    atlas.add(name, MENU[name], **meta)
sheet, data = atlas.save()


# ------------------------------------------------------------------ review

def jar_demo(level):
    """The jar as the game draws it: jar, sludge in INNER, glare, flies above."""
    im = Image.new('RGBA', (JW, JH + 14), (0, 0, 0, 0))
    im.alpha_composite(atlas.get('jar')[0], (0, 14))
    ix, iy, iw, ih = INNER
    h = round(ih * level)
    for y in range(iy + ih - h, iy + ih):
        for x in range(ix, ix + iw):
            c = 'grime2'
            if y == iy + ih - h:
                c = 'grime3'
            elif (x + y) % 7 == 0:
                c = 'grime1'
            im.putpixel((x, y + 14), RGBA(c))
    im.alpha_composite(atlas.get('jar_glare')[0], (0, 14))
    im.alpha_composite(atlas.get('jar_flies')[0], (0, 0))
    return im


def mock_card():
    """An order card mock-up: panel 160 x 68, tape, a paper note, a button."""
    im = Image.new('RGBA', (176, 84), RGBA('ink1'))
    im.alpha_composite(nine_slice(atlas.get('panel')[0], [8] * 4, 160, 68), (8, 8))
    im.alpha_composite(nine_slice(atlas.get('paper')[0], [6] * 4, 72, 36), (90, 16))
    im.alpha_composite(nine_slice(atlas.get('button')[0], [4] * 4, 40, 16), (14, 54))
    im.alpha_composite(nine_slice(atlas.get('button_down')[0], [4] * 4, 40, 16), (110, 54))
    im.alpha_composite(atlas.get('tape_h')[0], (78, 4))
    im.alpha_composite(atlas.get('tape_v')[0], (4, 30))
    for i, n in enumerate(ICONS):
        im.alpha_composite(atlas.get(n)[0], (14 + (i % 4) * 18, 14 + (i // 4) * 19))
    return im


blocks = [
    ('panel', atlas.get('panel')[0]),
    ('paper', atlas.get('paper')[0]),
    ('button', atlas.get('button')[0]),
    ('button_down', atlas.get('button_down')[0]),
    ('tape_h', atlas.get('tape_h')[0]),
    ('tape_v', atlas.get('tape_v')[0]),
    ('jar', atlas.get('jar')[0]),
    ('jar_glare', atlas.get('jar_glare')[0]),
    ('jar_flies x2', strip(atlas.get('jar_flies'))),
    ('jar 0 / 40 / 85 %', strip([jar_demo(0.0), jar_demo(0.4), jar_demo(0.85)], gap=6)),
]
for n in ICONS:
    blocks.append((n, atlas.get(n)[0]))
blocks.append(('icons on card1', on('card1', strip([atlas.get(n)[0] for n in ICONS]), 3)))
blocks.append(('icons on ink1', on('ink1', strip([atlas.get(n)[0] for n in ICONS]), 3)))
blocks.append(('panel 160x68 + paper + buttons + tape', mock_card()))
review_sheet('ui', blocks, scale=4, width=1600)
mock = mock_card()
up(mock, 1).save(REVIEW / 'ui_card_1x.png')


# ------------------------------------------------------------------ review: batch 2 (menus)

import importlib.util  # noqa: E402

_spec = importlib.util.spec_from_file_location('font_build', Path(__file__).resolve().parents[1] / 'font' / 'build.py')
font = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(font)


def sl(name, w, h):
    return nine_slice(atlas.get(name)[0], atlas.meta(name)['slice'], w, h)


def speech_mock():
    line = "Two cans. NOW. Please."
    w = font.text_width(line) + 16
    im = Image.new('RGBA', (w + 24, 52), RGBA('night0'))
    im.alpha_composite(sl('speech', w, 23), (12, 4))
    im.alpha_composite(atlas.get('speech_tail')[0], (22, 4 + 23 - 2))
    font.draw_text(im, line, 20, 9, 'ink0')
    im.alpha_composite(atlas.get('cursor_point')[0], (w - 10, 32))
    return im


def report_mock():
    im = Image.new('RGBA', (180, 150), RGBA('ink1'))
    im.alpha_composite(sl('clipboard', 150, 132), (14, 12))
    im.alpha_composite(atlas.get('clipboard_clip')[0], (14 + 55, 12 - 7))
    y = 26
    for line, col in (('NIGHT 3 REPORT', 'ink0'), ('Shinies    1,240', 'ink0'), ('Quota        400', 'ink0'),
                      ('Stink peak   71%', 'rust1'), ('Gulls eaten    3', 'ink1')):
        font.draw_text(im, line, 30, y, col)
        y += 12
    im.alpha_composite(atlas.get('stamp_passed')[0], (52, 84))
    return im


def shop_mock():
    im = Image.new('RGBA', (300, 112), RGBA('ink1'))
    im.alpha_composite(sl('panel', 292, 104), (4, 4))
    ups = ['up_lid', 'up_hinges', 'up_raccoon', 'up_compactor', 'up_freshener', 'up_owl']
    prices = ['120', '80', '300', '250', '60', '150']
    for i, (n, pr) in enumerate(zip(ups, prices)):
        x = 14 + i * 46
        im.alpha_composite(atlas.get(n)[0], (x + 6, 14))
        im.alpha_composite(sl('price_tag', 40, 24), (x - 2, 42))
        font.draw_text(im, pr, x + 10, 50, 'ink0')
    font.draw_text(im, 'SWAP MEET', 14, 76, 'ink0')
    icons = ['icon_pause', 'icon_play', 'icon_book', 'icon_star', 'icon_lock', 'icon_check', 'icon_cross']
    for i, n in enumerate(icons):
        im.alpha_composite(atlas.get(n)[0], (84 + i * 17, 74))
    for i in range(6):
        im.alpha_composite(atlas.get('pip_lid_full' if i < 4 else 'pip_lid_empty')[0], (14 + i * 10, 92))
    im.alpha_composite(atlas.get('stamp_shutdown')[0], (200, 70))
    return im


def cursor_test():
    names = ['cursor_open', 'cursor_grab', 'cursor_point']
    im = Image.new('RGBA', (3 * 24, 4 * 22), (0, 0, 0, 0))
    for r, bg in enumerate(('night0', 'dirt2', 'dirt1', 'card1')):
        im.paste(Image.new('RGBA', (72, 22), RGBA(bg)), (0, r * 22))
        for c, n in enumerate(names):
            im.alpha_composite(atlas.get(n)[0], (c * 24 + 4, r * 22 + 3))
            ax, ay = atlas.meta(n)['anchor']
            if r == 0:
                im.putpixel((c * 24 + 4 + ax, r * 22 + 3 + ay), RGBA('red'))
    return im


mblocks = [(n, atlas.get(n)[0]) for n in menus.ALL]
mblocks += [
    ('cursors on night / dirt2 / dirt1 / card1 (red dot = hotspot, top row)', cursor_test()),
    ('pips on ink1 and card1', strip([on('ink1', strip([atlas.get('pip_lid_full')[0], atlas.get('pip_lid_empty')[0]]), 2),
                                      on('card1', strip([atlas.get('pip_lid_full')[0], atlas.get('pip_lid_empty')[0]]), 2)])),
    ('upgrades on card1', on('card1', strip([atlas.get(n)[0] for n in menus.ALL if n.startswith('up_')], gap=4), 3)),
    ('icons on card1 / ink1', strip([on('card1', strip([atlas.get(n)[0] for n in menus.ALL if n.startswith('icon_')], gap=3), 2),
                                     on('ink1', strip([atlas.get(n)[0] for n in menus.ALL if n.startswith('icon_')], gap=3), 2)], gap=4)),
    ('speech 132x28 + tail + text', speech_mock()),
    ('night report: clipboard 150x132 + clip + stamp', report_mock()),
    ('Swap Meet: panel, price tags 40x24, upgrades, icons, pips, stamp', shop_mock()),
]
review_sheet('ui_menus', mblocks, scale=3, width=1700)
for nm, fn in (('ui_menus_report_1x.png', report_mock), ('ui_menus_shop_1x.png', shop_mock),
               ('ui_menus_speech_1x.png', speech_mock)):
    fn().save(REVIEW / nm)
