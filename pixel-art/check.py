"""Check the built atlases in public/art/ against the art contract (docs/ARCHITECTURE.md).

    python pixel-art/check.py              # every family that exists
    python pixel-art/check.py board ui     # only these families

For each family whose JSON exists:
  - every pixel of the PNG is fully transparent or opaque and on the palette (pal.py)
  - every sprite's frames (or every font glyph) fit inside the PNG; 9-slice borders fit
  - sizes and frame counts match the contract table where it fixes them
  - names from the contract table that are missing
Exit code 1 if anything is wrong. Works with or without Pillow (falls back to a tiny PNG reader).
"""
from __future__ import annotations

import json
import re
import struct
import sys
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ART = ROOT / 'public' / 'art'
sys.path.insert(0, str(HERE))
from pal import PAL  # noqa: E402

PALETTE = {tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)): n for n, h in PAL.items()}


# ---------------------------------------------------------------- PNG loading

def load_rgba(path: Path):
    """-> (w, h, rows) where rows[y][x] = (r, g, b, a)."""
    try:
        from PIL import Image
        im = Image.open(path).convert('RGBA')
        w, h = im.size
        b = im.tobytes()
        return w, h, [[tuple(b[(y * w + x) * 4:(y * w + x) * 4 + 4]) for x in range(w)] for y in range(h)]
    except ImportError:
        return _png_rgba(path.read_bytes())


def _png_rgba(data: bytes):
    assert data[:8] == b'\x89PNG\r\n\x1a\n', 'not a PNG'
    pos, idat, plte, trns = 8, b'', None, None
    while pos < len(data):
        n, kind = struct.unpack('>I4s', data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        pos += 12 + n
        if kind == b'IHDR':
            w, h, depth, ctype, _, _, interlace = struct.unpack('>IIBBBBB', body)
        elif kind == b'PLTE':
            plte = [tuple(body[i:i + 3]) for i in range(0, len(body), 3)]
        elif kind == b'tRNS':
            trns = body
        elif kind == b'IDAT':
            idat += body
        elif kind == b'IEND':
            break
    if depth != 8 or interlace:
        raise SystemExit(f'check.py: needs Pillow for this PNG (depth {depth}, interlace {interlace}); '
                         'run it with `py -3` or `python3`')
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ctype]
    raw = zlib.decompress(idat)
    stride = w * ch
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(h):
        f = raw[i]
        line = bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - ch] if x >= ch else 0
            b = prev[x]
            c = prev[x - ch] if x >= ch else 0
            if f == 1:
                line[x] = (line[x] + a) & 255
            elif f == 2:
                line[x] = (line[x] + b) & 255
            elif f == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        prev = line
        row = []
        for x in range(w):
            px = line[x * ch:(x + 1) * ch]
            if ctype == 6:
                row.append(tuple(px))
            elif ctype == 2:
                row.append((*px, 255))
            elif ctype == 3:
                k = px[0]
                al = trns[k] if trns and k < len(trns) else 255
                row.append((*plte[k], al))
            elif ctype == 0:
                row.append((px[0], px[0], px[0], 255))
            else:
                row.append((px[0], px[0], px[0], px[1]))
        rows.append(row)
    return w, h, rows


# ---------------------------------------------------------------- the contract table

def item_ids() -> list[str]:
    src = (ROOT / 'src' / 'data' / 'items.ts').read_text(encoding='utf-8')
    ids = []
    for block in ('JUNK', 'GULL', 'SPECIAL'):
        m = re.search(r'const ' + block + r' = \[(.*?)\] as const', src, re.S)
        if m:
            ids += re.findall(r"\[\s*'(\w+)'", m.group(1))
    return ids


def raccoon_ids() -> list[str]:
    p = ROOT / 'src' / 'data' / 'raccoons.ts'
    if p.exists():
        ids = re.findall(r"id:\s*'(\w+)'", p.read_text(encoding='utf-8'))
        if ids:
            return ids
    return ['gary', 'linda', 'pete', 'mange']


def contract() -> dict[str, dict[str, tuple]]:
    """family -> {name: (w, h, frames)}; None = not fixed; frames may be a (lo, hi) range;
    w/h may be ('<=', n)."""
    T = {}
    T['items'] = {f'item_{i}': (32, 32, (1, 2)) for i in item_ids()}
    cast = {}
    for r in raccoon_ids():
        cast[f'raccoon_{r}_idle'] = (48, 48, 2)
        cast[f'raccoon_{r}_happy'] = (48, 48, (1, 2))
        cast[f'raccoon_{r}_angry'] = (48, 48, (1, 2))
    cast.update({'possum_idle': (48, 48, 2), 'possum_dead': (48, 48, 1), 'possum_shutdown': (48, 48, 1),
                 'possum_walk': (32, 32, 4), 'king_portrait': (96, 96, 2)})   # M7 (wave 3)
    T['cast'] = cast
    T['props'] = {
        'truck_drive': (112, 64, 2), 'truck_dump': (112, 64, 3),
        'dumpster_closed': (48, 48, 1), 'dumpster_open': (48, 48, 1), 'dumpster_rattle': (48, 48, 2),
        'compactor_idle': (48, 48, 1), 'compactor_crush': (48, 48, 3),
    }
    # v2: one wide panorama per scene (960 x 640, the stage at 160,140), 2 frames (the streetlight flicker)
    T['backdrop'] = {**{f'backdrop_{s}': (960, 640, (1, 2)) for s in ('lot9', 'marina', 'trashmore')},
                     'moon': (32, 32, 1), 'gull_fly': (16, 16, 2)}   # M7 sky
    T['logo'] = {'logo': (('<=', 240), ('<=', 96), 1)}
    T['board'] = {
        'cell_a': (32, 32, 1), 'cell_b': (32, 32, 1),
        'cell_hover': (32, 32, 1), 'cell_target': (32, 32, 1), 'cell_bad': (32, 32, 1),
        'board_frame': (None, None, 1),
    }
    T['ui'] = {
        'panel': (None, None, 1), 'paper': (None, None, 1),
        'button': (None, None, 1), 'button_down': (None, None, 1),
        'tape_h': (None, None, 1), 'tape_v': (None, None, 1),
        'jar': (24, 104, 1), 'jar_flies': (24, 16, 2),
        **{f'icon_{n}': (16, 16, 1) for n in ('shiny', 'stink', 'clock', 'lid', 'truck', 'mute', 'sound')},
        'jar_glare': (24, 104, 1),
        'pip_lid_full': (8, 6, 1), 'pip_lid_empty': (8, 6, 1),
        'cursor_open': (16, 16, 1), 'cursor_grab': (16, 16, 1), 'cursor_point': (16, 16, 1),
        'speech': (None, None, 1), 'speech_tail': (8, 6, 1),
        'clipboard': (None, None, 1), 'clipboard_clip': (None, None, 1),
        'stamp_passed': (None, None, 1), 'stamp_shutdown': (None, None, 1),
        'price_tag': (None, None, 1),
        **{f'up_{n}': (24, 24, 1) for n in ('lid', 'hinges', 'raccoon', 'compactor', 'freshener', 'owl')},
        **{f'icon_{n}': (16, 16, 1) for n in ('pause', 'play', 'book', 'star', 'lock', 'check', 'cross')},
    }
    T['fx'] = {
        'fx_puff': (16, 16, 6), 'fx_fly': (4, 4, 2), 'fx_spark': (8, 8, 4),
        'fx_pop': (32, 32, 4), 'fx_feather': (8, 8, 2), 'fx_drip': (4, 6, 3),
    }
    # v2 (art agent): recipe results, Contraband stickers, the county map
    T['recipes'] = {f'item_{i}': (32, 32, (1, 2)) for i in brew_ids()}
    T['contraband'] = {f'perk_{i}': (24, 24, 1) for i in contraband_ids()}
    T['map'] = {
        'map_bg': (960, 640, 1), 'map_node_boss': (32, 32, 1),
        **{f'map_node_{n}': (24, 24, 1) for n in ('night', 'done', 'locked')},
        'map_you': (32, 24, (1, 2)),
        **{f'map_tag_{n}': (14, 14, 1) for n in ('loot', 'shop', 'juice', 'elite')},
    }
    return T


def brew_ids() -> list[str]:
    m = re.search(r'const BREW = \[(.*?)\] as const', (ROOT / 'src' / 'data' / 'items.ts').read_text(encoding='utf-8'), re.S)
    return re.findall(r"\[\s*'(\w+)'", m.group(1)) if m else []


def contraband_ids() -> list[str]:
    p = ROOT / 'src' / 'data' / 'contraband.ts'
    if not p.exists():
        return []
    chunks = re.split(r"\bid:\s*'", p.read_text(encoding='utf-8'))[1:]
    return [re.match(r'(\w+)', c).group(1) for c in chunks if re.search(r'\brarity:', c.split("id:")[0])]


NINE_SLICE = {'board_frame', 'panel', 'paper', 'button', 'button_down', 'speech', 'clipboard', 'price_tag'}
FONT_CHARS = ('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
              '.,!?:;\'"-+/()%&*#$@·')


# ---------------------------------------------------------------- checks

def fits(want, got):
    if want is None:
        return True
    if isinstance(want, tuple) and want and want[0] == '<=':
        return got <= want[1]
    if isinstance(want, tuple):
        return want[0] <= got <= want[1]
    return got == want


def owner(sprites: dict, x: int, y: int) -> str:
    for n, e in sprites.items():
        fw = e['w'] * e.get('frames', 1)
        if e['x'] <= x < e['x'] + fw and e['y'] <= y < e['y'] + e['h']:
            return n
    return '?'


def check_family(fam: str, table: dict) -> tuple[list[str], list[str]]:
    errors, notes = [], []
    meta = json.loads((ART / f'{fam}.json').read_text(encoding='utf-8'))
    png = ART / f'{fam}.png'
    if not png.exists():
        return [f'{png.name} is missing'], notes
    W, H, rows = load_rgba(png)

    # every pixel: transparent, or opaque and on the palette
    is_font = 'glyphs' in meta
    boxes = meta.get('glyphs') if is_font else meta.get('sprites', {})
    off, semi = {}, {}
    for y in range(H):
        for x, (r, g, b, a) in enumerate(rows[y]):
            if a == 0:
                continue
            if a != 255:
                semi.setdefault(owner(boxes, x, y) if not is_font else 'font', []).append((x, y, a))
            elif (r, g, b) not in PALETTE:
                off.setdefault(owner(boxes, x, y) if not is_font else 'font', []).append(
                    (x, y, '#%02x%02x%02x' % (r, g, b)))
    for n, lst in off.items():
        errors.append(f'{n}: {len(lst)} px off the palette, e.g. {lst[:3]}')
    for n, lst in semi.items():
        errors.append(f'{n}: {len(lst)} semi-transparent px, e.g. {lst[:3]}')

    if is_font:
        for k in ('lineHeight', 'cap', 'spacing', 'space'):
            if k not in meta:
                errors.append(f'font: "{k}" missing')
        for ch, e in meta['glyphs'].items():
            if e['x'] < 0 or e['y'] < 0 or e['x'] + e['w'] > W or e['y'] + e['h'] > H:
                errors.append(f'glyph {ch!r}: box {e} falls outside the {W}x{H} PNG')
        missing = [c for c in FONT_CHARS if c not in meta['glyphs']]
        if missing:
            errors.append('missing glyphs: ' + ''.join(missing))
        digits = {meta['glyphs'][d]['w'] for d in '0123456789' if d in meta['glyphs']}
        if len(digits) > 1:
            errors.append(f'figures are not tabular: widths {sorted(digits)}')
        notes.append(f'{len(meta["glyphs"])} glyphs, {W}x{H}')
        return errors, notes

    sprites = meta.get('sprites', {})
    for n, e in sprites.items():
        fr = e.get('frames', 1)
        if fr < 1 or e['w'] < 1 or e['h'] < 1:
            errors.append(f'{n}: bad size/frames {e}')
            continue
        if e['x'] < 0 or e['y'] < 0 or e['x'] + e['w'] * fr > W or e['y'] + e['h'] > H:
            errors.append(f'{n}: {fr} frame(s) of {e["w"]}x{e["h"]} at ({e["x"]},{e["y"]}) '
                          f'fall outside the {W}x{H} PNG')
        if n in table:
            tw, th, tf = table[n]
            if not (fits(tw, e['w']) and fits(th, e['h'])):
                errors.append(f'{n}: is {e["w"]}x{e["h"]}, the contract says {tw}x{th}')
            if not fits(tf, fr):
                errors.append(f'{n}: has {fr} frame(s), the contract says {tf}')
        if n in NINE_SLICE or 'slice' in e:
            sl = e.get('slice')
            if not sl or len(sl) != 4:
                errors.append(f'{n}: 9-slice needs "slice": [left, top, right, bottom]')
            elif sl[0] + sl[2] >= e['w'] or sl[1] + sl[3] >= e['h']:
                errors.append(f'{n}: slice {sl} leaves no middle in {e["w"]}x{e["h"]}')
        if n.startswith('cursor_'):
            an = e.get('anchor')
            if not an or not (0 <= an[0] < e['w'] and 0 <= an[1] < e['h']):
                errors.append(f'{n}: needs an "anchor" (the hotspot) inside the sprite')
        if 'inner' in e:
            ix, iy, iw, ih = e['inner']
            if ix < 0 or iy < 0 or ix + iw > e['w'] or iy + ih > e['h']:
                errors.append(f'{n}: inner {e["inner"]} falls outside the sprite')
    missing = [n for n in table if n not in sprites]
    if missing:
        errors.append(f'missing {len(missing)} name(s) from the contract: {", ".join(missing)}')
    notes.append(f'{len(sprites)} sprites, {W}x{H}')
    return errors, notes


def main(argv: list[str]) -> int:
    T = contract()
    fams = [f for f in list(T) + ['font_marker'] if (ART / f'{f}.json').exists()]
    if argv:
        unknown = [a for a in argv if a not in T and a != 'font_marker']
        if unknown:
            print(f'unknown family: {", ".join(unknown)}')
            return 2
        fams = [f for f in fams if f in argv]
        for a in argv:
            if not (ART / f'{a}.json').exists():
                print(f'{a}: public/art/{a}.json does not exist yet')
    if not fams:
        print('no families to check in public/art/')
        return 0
    bad = 0
    for fam in fams:
        errors, notes = check_family(fam, T.get(fam, {}))
        status = 'OK' if not errors else f'{len(errors)} problem(s)'
        print(f'{fam:12s} {status:14s} {"; ".join(notes)}')
        for e in errors:
            print(f'    - {e}')
        bad += bool(errors)
    print('all good' if not bad else f'{bad} famil{"y" if bad == 1 else "ies"} with problems')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
