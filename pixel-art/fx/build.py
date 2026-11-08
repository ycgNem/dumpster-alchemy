"""FX family: stink puff, fly, spark, the merge pop, a gull feather, a drip.

    cd pixel-art/fx && py -3 build.py

-> public/art/fx.png + fx.json, art-src/review/fx.png (+ fx_anim.gif to watch the loops)
"""
import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'ui'))
from kit import C, RGBA, new, Atlas, review_sheet, strip, on, ell, put, keyline, REVIEW, up  # noqa: E402
from PIL import Image  # noqa: E402


def outline_with(s, name):
    s.outline(C(name), where='outside')


# ------------------------------------------------------------------ stink puff (16 x 16, 6)
#
# Lobes of grime, lit top-left (grime3), shading to brown (dirt2) bottom-right, keyed in grime0.

PUFF = [
    # (lobes [(cx, cy, r)], holes [(cx, cy, r)])
    ([(8, 10, 2.2)], []),
    ([(7, 9.5, 3.0), (10, 10.5, 2.4)], []),
    ([(5.5, 9.5, 3.0), (9, 7.5, 3.6), (11.5, 10.5, 3.0), (8, 11.5, 2.6)], []),
    ([(5, 8.5, 3.0), (9, 6.0, 3.6), (12, 9.5, 3.0), (7.5, 11, 2.4)], [(8.5, 9.0, 2.0)]),
    ([(4, 7.5, 2.4), (9.5, 4.5, 2.6), (12.5, 9.0, 2.2), (6.5, 12.0, 1.6)], []),
    'wisps',
]

WISPS = [(3, 5), (4, 5), (4, 4), (10, 2), (11, 2), (11, 3), (12, 2), (13, 8), (13, 7)]


def lobes(spec, dx=0.0, dy=0.0, k=1.0):
    pts = set()
    for (cx, cy, r) in spec:
        if r * k >= 0.8:
            pts |= ell(cx + dx, cy + dy, r * k, r * k)
    return {(x, y) for (x, y) in pts if 1 <= x <= 14 and 1 <= y <= 14}


def build_puff():
    s = new(16, 16, frames=6)
    for f, item in enumerate(PUFF, start=1):
        spec, holes = (item, []) if item == 'wisps' else item
        s.frame(f)
        if spec == 'wisps':
            put(s, WISPS, 'grime2')
            put(s, [(4, 4), (11, 2)], 'grime3')
            outline_with(s, 'grime0')
            continue
        body = lobes(spec)
        for h in holes:
            body -= ell(h[0], h[1], h[2], h[2])
        put(s, body, 'dirt2')
        mid = lobes(spec, -0.6, -0.6, 0.85) & body
        put(s, mid, 'grime2')
        lit = lobes(spec, -1.2, -1.2, 0.55) & body
        put(s, lit, 'grime3')
        outline_with(s, 'grime0')
    s.frame(1)
    return s


# ------------------------------------------------------------------ fly (4 x 4, 2)

def build_fly():
    s = new(4, 4, frames=2)
    for f in (1, 2):
        s.frame(f)
        put(s, [(1, 2), (2, 2), (1, 3)], 'ink0')
        put(s, [(2, 3)], 'toxic1')
        if f == 1:
            put(s, [(0, 1), (3, 1)], 'bone')
        else:
            put(s, [(0, 2), (3, 2)], 'steel3')
    s.frame(1)
    return s


# ------------------------------------------------------------------ spark (8 x 8, 4)

SPARK = [
    ['........',
     '........',
     '...y....',
     '..yWy...',
     '...y....',
     '........',
     '........',
     '........'],
    ['...s....',
     '...y....',
     '.s.y.s..',
     'syyWyys.',
     '...y....',
     '.s.y.s..',
     '...s....',
     '........'],
    ['...s....',
     '........',
     '.d...d..',
     's..y..s.',
     '........',
     '.d...d..',
     '...s....',
     '........'],
    ['...D....',
     'd.....d.',
     '........',
     'D.....D.',
     '........',
     '........',
     'd.....d.',
     '...D....'],
]


def build_spark():
    s = new(8, 8, frames=4)
    key = {'W': 'white', 'y': 'yellow', 's': 'sodium3', 'd': 'sodium2', 'D': 'sodium1'}
    for f, rows in enumerate(SPARK, start=1):
        s.frame(f)
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in key:
                    s.px(x, y, C(key[ch]))
    s.frame(1)
    return s


# ------------------------------------------------------------------ merge pop (32 x 32, 4)
#
# A crude yellow splat: a lumpy blob, a splash ring with spikes, the ring breaking into fat
# droplets, then the last drops and a couple of drips. Keyed in ink0, lit top-left.

CX, CY = 15.5, 15.5


def splat_shape(r, spikes, spike_len, seed, hole=0.0):
    rng = random.Random(seed)
    pts = ell(CX, CY, r, r)
    for i in range(spikes):
        a = (i + rng.random() * 0.5) / spikes * math.tau
        L = spike_len * (0.35 + rng.random() * 1.0)
        # a tapering spike with a round droplet at its end
        for t in range(int(L * 4)):
            d = r + t / 4
            w = max(0.6, 1.6 * (1 - t / (L * 4)))
            pts |= ell(CX + math.cos(a) * d, CY + math.sin(a) * d, w, w)
        tip = r + L + 1.0
        pts |= ell(CX + math.cos(a) * tip, CY + math.sin(a) * tip, 1.5, 1.5)
    if hole:
        pts -= ell(CX, CY, hole, hole)
    return {(x, y) for (x, y) in pts if 1 <= x <= 30 and 1 <= y <= 30}


def droplets(n, rad, size, seed, jitter=1.5):
    rng = random.Random(seed)
    pts = set()
    for i in range(n):
        a = (i + rng.random() * 0.6) / n * math.tau
        d = rad + rng.random() * jitter
        sz = size * (0.7 + rng.random() * 0.5)
        pts |= ell(CX + math.cos(a) * d, CY + math.sin(a) * d * 0.95, sz, sz)
    return {(x, y) for (x, y) in pts if 1 <= x <= 30 and 1 <= y <= 30}


def shade_splat(s, pts):
    """Fill a splat: yellow body, sodium2 shade on the bottom-right, sodium3 rim top-left,
    white glints on the top-left of each blob."""
    put(s, pts, 'yellow')
    for (x, y) in pts:
        if (x + 1, y) not in pts or (x, y + 1) not in pts:
            s.px(x, y, C('sodium2'))
        elif (x - 1, y) not in pts or (x, y - 1) not in pts:
            s.px(x, y, C('sodium3'))
    for (x, y) in pts:
        if ((x - 1, y) not in pts and (x, y - 1) not in pts and (x + 1, y) in pts
                and (x, y + 1) in pts and (x + 1, y + 1) in pts):
            s.px(x + 1, y + 1, C('white'))


def build_pop():
    s = new(32, 32, frames=4)
    # 1: the lumpy blob
    s.frame(1)
    p1 = splat_shape(5.0, 6, 2.0, 3)
    shade_splat(s, p1)
    put(s, ell(CX - 1.5, CY - 1.5, 2.2, 2.0) & p1, 'white')
    keyline(s)
    # 2: the splash ring, spikes out, centre punched through
    s.frame(2)
    p2 = splat_shape(7.5, 6, 5.0, 4, hole=3.6)
    p2 |= droplets(4, 14.0, 1.1, 5, jitter=1.0)
    p2 -= ell(CX + 1.5, CY + 0.5, 3.4, 3.0)
    shade_splat(s, p2)
    keyline(s)
    # 3: the ring breaks into fat droplets
    s.frame(3)
    p3 = droplets(9, 11.0, 2.2, 11, jitter=2.0)
    shade_splat(s, p3)
    keyline(s)
    # 4: last little drops, two drips sliding down
    s.frame(4)
    p4 = droplets(7, 13.5, 1.2, 17, jitter=1.5)
    p4 |= {(9, 22), (9, 23), (9, 24), (22, 21), (22, 22)}
    p4 = {(x, y) for (x, y) in p4 if 1 <= x <= 30 and 1 <= y <= 30}
    put(s, p4, 'sodium3')
    put(s, [(x, y) for (x, y) in p4 if (x, y + 1) not in p4], 'sodium2')
    keyline(s)
    s.frame(1)
    return s


# ------------------------------------------------------------------ gull feather (8 x 8, 2)

FEATHER = [
    ['....ooo.',
     '...owwwo',
     '..owwbwo',
     '..owbgo.',
     '.owbgbo.',
     '.obgoo..',
     '.oGo....',
     'oGo.....'],
    ['.ooo....',
     'owwwo...',
     'owbwwo..',
     '.ogbwo..',
     '.obgbwo.',
     '..oogbo.',
     '....oGo.',
     '.....oGo'],
]


def build_feather():
    s = new(8, 8, frames=2)
    key = {'o': 'ink0', 'w': 'white', 'b': 'bone', 'g': 'fur3', 'G': 'fur2'}
    for f, rows in enumerate(FEATHER, start=1):
        s.frame(f)
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in key:
                    s.px(x, y, C(key[ch]))
    s.frame(1)
    return s


# ------------------------------------------------------------------ drip (4 x 6, 3)

DRIP = [
    ['oGgo',
     'oGgo',
     '.oo.',
     '....',
     '....',
     '....'],
    ['oGgo',
     'oGgo',
     'oGgo',
     '.oGo',
     '..o.',
     '....'],
    ['oGgo',
     '.oo.',
     '.oo.',
     'oGgo',
     'oGGo',
     '.oo.'],
]


def build_drip():
    s = new(4, 6, frames=3)
    key = {'o': 'grime0', 'G': 'grime2', 'g': 'grime3'}
    for f, rows in enumerate(DRIP, start=1):
        s.frame(f)
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in key:
                    s.px(x, y, C(key[ch]))
    s.frame(1)
    return s


# ------------------------------------------------------------------ atlas

atlas = Atlas('fx', max_w=256)
atlas.add('fx_puff', build_puff(), fps=10, anchor=[8, 8])
atlas.add('fx_fly', build_fly(), fps=12, anchor=[2, 2])
atlas.add('fx_spark', build_spark(), fps=14, anchor=[3, 3])
atlas.add('fx_pop', build_pop(), fps=14, anchor=[16, 16])
atlas.add('fx_feather', build_feather(), fps=3, anchor=[4, 4])
atlas.add('fx_drip', build_drip(), fps=6, anchor=[2, 0])
sheet, data = atlas.save()

names = ['fx_puff', 'fx_fly', 'fx_spark', 'fx_pop', 'fx_feather', 'fx_drip']
blocks = []
for n in names:
    blocks.append((n, strip(atlas.get(n))))
for bgname in ('dirt2', 'dirt1', 'card1'):
    blocks.append((f'puff + pop on {bgname}',
                   on(bgname, strip(atlas.get('fx_puff') + atlas.get('fx_spark')
                                    + atlas.get('fx_drip') + atlas.get('fx_feather'), gap=3), 3)))
    blocks.append((f'pop on {bgname}', on(bgname, strip(atlas.get('fx_pop'), gap=3), 3)))
review_sheet('fx', blocks, scale=4, width=1500)

# an animated GIF of each effect looping on the board colour, to watch timing
frames = []
for t in range(12):
    im = Image.new('RGBA', (32 * 6, 36), RGBA('dirt1'))
    for i, n in enumerate(names):
        fr = atlas.get(n)
        f = fr[t % len(fr)]
        im.alpha_composite(f, (i * 32 + (32 - f.width) // 2, (36 - f.height) // 2))
    frames.append(up(im, 4).convert('RGB'))
frames[0].save(REVIEW / 'fx_anim.gif', save_all=True, append_images=frames[1:], duration=90, loop=0)
print('wrote art-src/review/fx_anim.gif')
