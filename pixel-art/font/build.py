"""font_marker: a chunky chisel-marker bitmap face, cap height 7, line height 11.

    cd pixel-art/font && py -3 build.py

-> public/art/font_marker.png + .json, art-src/review/font_marker.png (contact sheet),
   art-src/review/font_testcard_1x.png and _4x.png (the test card on cardboard).

How it is drawn: a chisel Sharpie held at an angle, so down-strokes are 2 px and cross-strokes
1 px. Corners are rounded where the pen would turn, a few strokes end in a little flick, and
crossbars sit where a hand puts them (not all on one row). Every glyph keeps the baseline.

Cell layout (every glyph is `h` = 11 tall):
    rows 0-1   headroom (empty)
    rows 2-8   cap height 7; x-height 5 (rows 4-8); ascenders from row 2
    rows 9-10  descenders (g j p q y , ; Q and the bottom of ( ) )
The baseline is the bottom of row 8, i.e. y + 9.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'ui'))
from kit import RGBA, OUT, REVIEW, nine_slice, up  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

LINE_H, CAP, TOP, SPACING, SPACE = 11, 7, 2, 1, 4

# Each glyph: rows from the cap top (row 0 = cell row 2). 7 rows = cap box; rows 7-8 descend.
G = {}
G_TOP = {}   # glyphs that start one row above the cap line (overshoots, tilted bars)


def g(ch, *rows):
    top = 0
    if rows[0].startswith('^'):
        top, rows = -1, (rows[0][1:],) + rows[1:]
    w = max(len(r) for r in rows)
    G[ch] = [r.ljust(w, '.') for r in rows]
    G_TOP[ch] = top


# ---------------------------------------------------------------- capitals
g('A', '..##..', '.####.', '##..##', '##..##', '######', '##..##', '##..##')
g('B', '#####.', '##..##', '##..##', '#####.', '##..##', '##..##', '#####.')
g('C', '.####.', '##..##', '##....', '##....', '##....', '##..##', '.####.')
g('D', '####..', '##.##.', '##..##', '##..##', '##..##', '##.##.', '####..')
g('E', '######', '##....', '##....', '####..', '##....', '##....', '######')
g('F', '######', '##....', '##....', '#####.', '##....', '##....', '##....')
g('G', '.####.', '##..##', '##....', '##.###', '##..##', '##..##', '.#####')
g('H', '##..##', '##..##', '##..##', '######', '##..##', '##..##', '##..##')
g('I', '####', '.##.', '.##.', '.##.', '.##.', '.##.', '####')
g('J', '..####', '....##', '....##', '....##', '##..##', '##..##', '.####.')
g('K', '##..##', '##.##.', '####..', '###...', '####..', '##.##.', '##..##')
g('L', '##...', '##...', '##...', '##...', '##...', '##...', '#####')
g('M', '##...##', '###.###', '#######', '##.#.##', '##...##', '##...##', '##...##')
g('N', '##..##', '###.##', '######', '##.###', '##..##', '##..##', '##..##')
g('O', '.#####.', '##...##', '##...##', '##...##', '##...##', '##...##', '.#####.')
g('P', '#####.', '##..##', '##..##', '#####.', '##....', '##....', '##....')
g('Q', '.#####.', '##...##', '##...##', '##...##', '##...##', '##..##.', '.###.##', '......#')
g('R', '#####.', '##..##', '##..##', '#####.', '##.##.', '##..##', '##..##')
g('S', '.####.', '##..##', '##....', '.####.', '....##', '##..##', '.####.')
g('T', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..')
g('U', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.')
g('V', '##..##', '##..##', '##..##', '##..##', '.####.', '.####.', '..##..')
g('W', '##...##', '##...##', '##.#.##', '##.#.##', '#######', '###.###', '##...##')
g('X', '##..##', '##..##', '.####.', '..##..', '.####.', '##..##', '##..##')
g('Y', '##..##', '##..##', '##..##', '.####.', '..##..', '..##..', '..##..')
g('Z', '######', '....##', '...##.', '..##..', '.##...', '##....', '######')

# ---------------------------------------------------------------- lower case (x-height 5)
g('a', '......', '......', '.####.', '....##', '.#####', '##..##', '.#####')
g('b', '##....', '##....', '#####.', '##..##', '##..##', '##..##', '#####.')
g('c', '.....', '.....', '.####', '##...', '##...', '##...', '.####')
g('d', '....##', '....##', '.#####', '##..##', '##..##', '##..##', '.#####')
g('e', '......', '......', '.####.', '##..##', '######', '##....', '.####.')
g('f', '..###', '.##..', '####.', '.##..', '.##..', '.##..', '.##..')
g('g', '......', '......', '.#####', '##..##', '##..##', '##..##', '.#####', '....##', '.####.')
g('h', '##....', '##....', '#####.', '##..##', '##..##', '##..##', '##..##')
g('i', '##', '..', '##', '##', '##', '##', '##')
g('j', '..##', '....', '..##', '..##', '..##', '..##', '..##', '..##', '###.')
g('k', '##...', '##...', '##.##', '####.', '###..', '####.', '##.##')
g('l', '##.', '##.', '##.', '##.', '##.', '##.', '.##')
g('m', '.......', '.......', '######.', '##.#.##', '##.#.##', '##.#.##', '##.#.##')
g('n', '......', '......', '#####.', '##..##', '##..##', '##..##', '##..##')
g('o', '......', '......', '.####.', '##..##', '##..##', '##..##', '.####.')
g('p', '......', '......', '#####.', '##..##', '##..##', '##..##', '#####.', '##....', '##....')
g('q', '......', '......', '.#####', '##..##', '##..##', '##..##', '.#####', '....##', '....##')
g('r', '.....', '.....', '##.##', '####.', '##...', '##...', '##...')
g('s', '.....', '.....', '.####', '##...', '.###.', '...##', '####.')
g('t', '.##.', '.##.', '####', '.##.', '.##.', '.##.', '..##')
g('u', '......', '......', '##..##', '##..##', '##..##', '##..##', '.#####')
g('v', '......', '......', '##..##', '##..##', '##..##', '.####.', '..##..')
g('w', '.......', '.......', '##...##', '##.#.##', '##.#.##', '##.#.##', '.##.##.')
g('x', '......', '......', '##..##', '.####.', '..##..', '.####.', '##..##')
g('y', '......', '......', '##..##', '##..##', '##..##', '##..##', '.#####', '....##', '.####.')
g('z', '......', '......', '######', '...##.', '..##..', '.##...', '######')

# ---------------------------------------------------------------- figures (tabular: all 6 wide)
g('0', '.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.')
g('1', '..##..', '.###..', '..##..', '..##..', '..##..', '..##..', '.####.')
g('2', '.####.', '##..##', '....##', '..###.', '.##...', '##....', '######')
g('3', '#####.', '....##', '....##', '..###.', '....##', '....##', '#####.')
g('4', '...##.', '..###.', '.####.', '##.##.', '######', '...##.', '...##.')
g('5', '######', '##....', '#####.', '....##', '....##', '##..##', '.####.')
g('6', '.####.', '##....', '##....', '#####.', '##..##', '##..##', '.####.')
g('7', '######', '....##', '...##.', '..##..', '..##..', '.##...', '.##...')
g('8', '.####.', '##..##', '##..##', '.####.', '##..##', '##..##', '.####.')
g('9', '.####.', '##..##', '##..##', '.#####', '....##', '....##', '.####.')

# ---------------------------------------------------------------- punctuation and signs
g('.', '..', '..', '..', '..', '..', '##', '##')
g(',', '..', '..', '..', '..', '..', '##', '##', '#.')
g('!', '##', '##', '##', '##', '..', '##', '##')
g('?', '.####.', '##..##', '...##.', '..##..', '......', '..##..', '..##..')
g(':', '..', '..', '##', '##', '..', '##', '##')
g(';', '..', '..', '##', '##', '..', '##', '##', '#.')
g("'", '##', '##', '#.')
g('"', '##.##', '##.##', '#..#.')
g('-', '....', '....', '....', '####')
g('+', '......', '..##..', '..##..', '######', '..##..', '..##..')
g('/', '...##', '...##', '..##.', '..##.', '.##..', '.##..', '##...')
g('(', '.##', '##.', '##.', '##.', '##.', '##.', '##.', '.##')
g(')', '##.', '.##', '.##', '.##', '.##', '.##', '.##', '##.')
g('%', '##..##', '##.##.', '...##.', '..##..', '.##...', '.##.##', '##..##')
g('&', '.###...', '##.##..', '##.##..', '.###.##', '##.###.', '##..##.', '.###.##')
g('*', '.....', '..#..', '#.#.#', '.###.', '#.#.#', '..#..')
g('#', '.#..#.', '######', '.#..#.', '.#..#.', '.#..#.', '######', '.#..#.')
g('$', '..##..', '.#####', '##.#..', '.####.', '..#.##', '#####.', '..##..')
g('@', '.#####.', '##...##', '##.####', '##.##.#', '##.####', '##.....', '.#####.')
g('·', '..', '..', '..', '##', '##')
g('=', '.....', '.....', '#####', '.....', '#####')
g('<', '...##', '..##.', '.##..', '##...', '.##..', '..##.', '...##')
g('>', '##...', '.##..', '..##.', '...##', '..##.', '.##..', '##...')
g('_', '.....', '.....', '.....', '.....', '.....', '.....', '.....', '#####')

# ---------------------------------------------------------------- the hand
# A marker never lands the same way twice. A few letters overshoot the cap line or start their
# bar with a blob of ink in the headroom; the baseline never moves, so words stay level.
g('A', '^..##..', '.####.', '##..##', '##..##', '##..##', '######', '##..##', '##..##')
g('T', '^##....', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..')
g('Z', '^##....', '######', '....##', '...##.', '..##..', '.##...', '##....', '######')
g('S', '^.....#', '.####.', '##..##', '##....', '.####.', '....##', '##..##', '.####.')
g('!', '^##', '##', '##', '##', '##', '..', '##', '##')
g('d', '^....##', '....##', '....##', '.#####', '##..##', '##..##', '##..##', '.#####')
g('k', '^##...', '##...', '##...', '##.##', '####.', '###..', '####.', '##.##')
g('f', '^...##', '..##.', '.##..', '####.', '.##..', '.##..', '.##..', '.##..')

REQUIRED = ('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
            '.,!?:;\'"-+/()%&*#$@·')


def glyph_img(ch, color='ink0'):
    rows = G[ch]
    w = len(rows[0])
    im = Image.new('RGBA', (w, LINE_H), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            if c == '#':
                im.putpixel((x, TOP + G_TOP[ch] + y), RGBA(color))
    return im


def build():
    order = sorted(G, key=lambda c: (REQUIRED.find(c) if c in REQUIRED else 999, c))
    max_w = 128
    x = y = 0
    placed = {}
    for ch in order:
        w = len(G[ch][0])
        if x + w > max_w:
            x, y = 0, y + LINE_H
        placed[ch] = (x, y, w)
        x += w + 1
    sheet = Image.new('RGBA', (max_w, y + LINE_H), (0, 0, 0, 0))
    glyphs = {}
    for ch, (gx, gy, w) in placed.items():
        sheet.alpha_composite(glyph_img(ch), (gx, gy))
        glyphs[ch] = {'x': gx, 'y': gy, 'w': w, 'h': LINE_H}
    data = {'lineHeight': LINE_H, 'cap': CAP, 'spacing': SPACING, 'space': SPACE,
            'top': TOP, 'baseline': TOP + CAP, 'xHeight': 5, 'ink': 'ink0', 'glyphs': glyphs}
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / 'font_marker.png')
    lines = [f'    {json.dumps(k, ensure_ascii=False)}: {json.dumps(v)}' for k, v in glyphs.items()]
    head = {k: v for k, v in data.items() if k != 'glyphs'}
    txt = '{\n' + ''.join(f'  {json.dumps(k)}: {json.dumps(v)},\n' for k, v in head.items())
    txt += '  "glyphs": {\n' + ',\n'.join(lines) + '\n  }\n}\n'
    (OUT / 'font_marker.json').write_text(txt, encoding='utf-8')
    print(f'wrote public/art/font_marker.png ({sheet.width}x{sheet.height}) + .json, {len(glyphs)} glyphs')
    missing = [c for c in REQUIRED if c not in G]
    assert not missing, missing
    widths = {len(G[d][0]) for d in '0123456789'}
    assert widths == {6}, widths
    return sheet, data


# ---------------------------------------------------------------- a renderer like the game's

def text_width(s):
    w = 0
    for ch in s:
        w += SPACE if ch == ' ' else len(G[ch][0]) + SPACING
    return max(0, w - SPACING)


def draw_text(im, s, x, y, color='ink0', outline=None):
    """Draw like the code will: glyph by glyph, advance w + spacing, a space advances `space`.
    outline= draws an ink keyline first (light text on dark or busy backgrounds)."""
    if outline:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)):
            draw_text(im, s, x + dx, y + dy, outline)
    cx = x
    for ch in s:
        if ch == ' ':
            cx += SPACE
            continue
        im.alpha_composite(glyph_img(ch, color), (cx, y))
        cx += len(G[ch][0]) + SPACING


def panel_img(w, h):
    ui = Image.open(OUT / 'ui.png').convert('RGBA')
    meta = json.loads((OUT / 'ui.json').read_text())['sprites']
    p = meta['panel']
    src = ui.crop((p['x'], p['y'], p['x'] + p['w'], p['y'] + p['h']))
    return nine_slice(src, p['slice'], w, h)


def paper_img(w, h):
    ui = Image.open(OUT / 'ui.png').convert('RGBA')
    meta = json.loads((OUT / 'ui.json').read_text())['sprites']
    p = meta['paper']
    src = ui.crop((p['x'], p['y'], p['x'] + p['w'], p['y'] + p['h']))
    return nine_slice(src, p['slice'], w, h)


def test_card():
    W, H = 300, 210
    im = Image.new('RGBA', (W, H), RGBA('night0'))
    im.alpha_composite(panel_img(W - 8, 150), (4, 4))
    y = 10
    for line in ('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz',
                 '0123456789 .,!?:;\'"-+/()%&*#$@·', 'GROSS!  Night 3 · Quota 400',
                 'Shinies 1,240   +12 STINK   x2',
                 "Don't squeeze it. Where's the other one?",
                 'The quick brown raccoon jumps over 9 lazy',
                 'possums (all playing dead) & 100% gulls.'):
        draw_text(im, line, 12, y, 'ink0')
        y += LINE_H + 1
    # colour tests on cardboard: secondary ink, danger, a bone note
    draw_text(im, 'ink1: wants 2 cans', 12, y, 'ink1')
    draw_text(im, 'rust1: 0:12 LEFT', 150, y, 'rust1')
    y += LINE_H + 1
    im.alpha_composite(paper_img(130, 44), (6, 160))
    draw_text(im, 'ORDER #3', 14, 166, 'ink0')
    draw_text(im, 'Gary wants:', 14, 178, 'ink1')
    draw_text(im, '2x Takeout Box', 14, 190, 'rust1')
    # light text on the night: only with an ink keyline
    draw_text(im, 'NIGHT 1  12:00 AM', 146, 168, 'sodium3', outline='ink0')
    draw_text(im, 'Shinies 0 / 150', 146, 182, 'bone', outline='ink0')
    draw_text(im, '+40!', 250, 182, 'toxic2', outline='ink0')
    draw_text(im, 'NO ROOM!', 146, 196, 'red', outline='ink0')
    return im


def contact_sheet(sheet):
    # the atlas at 4x on the night bg, glyph cells hinted; plus each glyph on bone at 6x
    s4 = up(Image.alpha_composite(Image.new('RGBA', sheet.size, RGBA('bone')), sheet), 4)
    pad = 16
    lines = [REQUIRED[:26], REQUIRED[26:52], REQUIRED[52:62] + ' ' + REQUIRED[62:], '=<>_']
    rows = []
    for ln in lines:
        im = Image.new('RGBA', (text_width(ln) + 8, LINE_H + 4), RGBA('card1'))
        draw_text(im, ln, 4, 2)
        rows.append(up(im, 6))
    W = max(s4.width, max(r.width for r in rows)) + pad * 2
    H = s4.height + sum(r.height + pad for r in rows) + pad * 3
    out = Image.new('RGBA', (W, H), RGBA('night0'))
    out.alpha_composite(s4, (pad, pad))
    y = s4.height + pad * 2
    for r in rows:
        out.alpha_composite(r, (pad, y))
        y += r.height + pad
    # baseline / cap guides on the first row of the 6x set
    d = ImageDraw.Draw(out)
    y0 = s4.height + pad * 2
    for row, c in ((TOP, 'toxic2'), (TOP + CAP, 'red')):
        yy = y0 + (row + 2) * 6
        d.line([(pad, yy), (pad + 40, yy)], fill=RGBA(c), width=1)
    return out


if __name__ == '__main__':
    sheet, data = build()
    REVIEW.mkdir(parents=True, exist_ok=True)
    contact_sheet(sheet).save(REVIEW / 'font_marker.png')
    tc = test_card()
    tc.save(REVIEW / 'font_testcard_1x.png')
    up(tc, 4).save(REVIEW / 'font_testcard_4x.png')
    print('wrote art-src/review/font_marker.png, font_testcard_1x.png, font_testcard_4x.png')
