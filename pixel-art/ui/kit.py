"""Shared helpers for the hand-art families (board, ui, fx, font).

    from kit import C, new, frames_of, Atlas, nine_slice, review_sheet

- C('ink0')            -> '#1a1422' (palette.ts via pal.py)
- new(w, h, frames=1)  -> a pixelstudio Sprite locked to the game palette
- Atlas('board')       -> shelf-packs sprites, writes public/art/<family>.png + .json
- nine_slice(img, sl, w, h) tiles a 9-slice the way the game does (middles tiled, never scaled)
- review_sheet(...)    -> art-src/review/<family>.png, 4x on the night background

Run the build scripts with `py -3 build.py` from their own folder.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'pixel-art'))
_local = ROOT / '.claude/skills/pixel-art-studio/scripts'
sys.path.insert(0, str(_local if _local.exists() else Path.home() / '.claude/skills/pixel-art-studio/scripts'))

from PIL import Image, ImageDraw  # noqa: E402
from pal import PAL, rgb, RAMP, ALL_RGB  # noqa: E402,F401
from pixelstudio import Sprite  # noqa: E402

OUT = ROOT / 'public' / 'art'
REVIEW = ROOT / 'art-src' / 'review'
GAME_PAL = ['#' + h for h in PAL.values()]


def C(name: str) -> str:
    return '#' + PAL[name]


def RGBA(name: str) -> tuple[int, int, int, int]:
    return (*rgb(name), 255)


def new(w: int, h: int, frames: int = 1) -> Sprite:
    s = Sprite(w, h, palette=GAME_PAL)
    for _ in range(frames - 1):
        s.add_frame(copy=False)
    s.frame(1)
    return s


def frames_of(s: Sprite) -> list[Image.Image]:
    return [s.composite(i) for i in range(1, s.n_frames + 1)]


def bitmap(rows: list[str], key: dict[str, str]) -> Image.Image:
    """A sprite from a list of strings; each char maps to a palette name ('.' = clear)."""
    h, w = len(rows), max(len(r) for r in rows)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in key and key[ch]:
                im.putpixel((x, y), RGBA(key[ch]))
    return im


def stamp(s: Sprite, rows: list[str], key: dict[str, str], ox: int = 0, oy: int = 0) -> None:
    """Draw a char-map onto the current frame of a Sprite."""
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in key and key[ch]:
                s.px(ox + x, oy + y, C(key[ch]))


def ell(cx: float, cy: float, rx: float, ry: float) -> set[tuple[int, int]]:
    """Pixels inside an ellipse with a float centre (cx=8 on a 16 canvas = centred, even width)."""
    out = set()
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if dx * dx + dy * dy <= 1.0:
                out.add((x, y))
    return out


def put(s: Sprite, pts, name: str, only=None) -> None:
    for x, y in pts:
        s.px(x, y, C(name), only=only)


def keyline(s: Sprite, name: str = 'ink0', diagonals: bool = False) -> None:
    s.outline(C(name), where='outside', diagonals=diagonals)


# ---------------------------------------------------------------- atlas


class Atlas:
    def __init__(self, family: str, max_w: int = 256, pad: int = 2):
        self.family = family
        self.max_w = max_w
        self.pad = pad
        self.entries: list[tuple[str, list[Image.Image], dict]] = []

    def add(self, name: str, src, fps: int = 0, **meta) -> None:
        frames = frames_of(src) if isinstance(src, Sprite) else list(src if isinstance(src, list) else [src])
        w, h = frames[0].size
        for f in frames:
            assert f.size == (w, h), f'{name}: frames differ in size'
        self.entries.append((name, frames, {'fps': fps, **meta}))

    def get(self, name: str) -> list[Image.Image]:
        for n, frames, _ in self.entries:
            if n == name:
                return frames
        raise KeyError(name)

    def meta(self, name: str) -> dict:
        for n, _, m in self.entries:
            if n == name:
                return m
        raise KeyError(name)

    def pack(self) -> tuple[Image.Image, dict]:
        # Shelf packing, tallest first; stable on name so the output is deterministic.
        order = sorted(self.entries, key=lambda e: (-e[1][0].height, -e[1][0].width * len(e[1]), e[0]))
        x = y = shelf_h = 0
        placed = {}
        width = 0
        for name, frames, meta in order:
            w, h = frames[0].size
            strip_w = w * len(frames)
            if x and x + strip_w > self.max_w:
                x, y, shelf_h = 0, y + shelf_h + self.pad, 0
            placed[name] = (x, y)
            x += strip_w + self.pad
            shelf_h = max(shelf_h, h)
            width = max(width, x - self.pad)
        height = y + shelf_h
        sheet = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        sprites = {}
        for name, frames, meta in self.entries:
            px, py = placed[name]
            w, h = frames[0].size
            for i, f in enumerate(frames):
                sheet.paste(f, (px + i * w, py))
            entry = {'x': px, 'y': py, 'w': w, 'h': h, 'frames': len(frames), 'fps': meta.get('fps', 0)}
            for k, v in meta.items():
                if k != 'fps':
                    entry[k] = v
            sprites[name] = entry
        return sheet, {'sprites': sprites}

    def save(self) -> tuple[Image.Image, dict]:
        OUT.mkdir(parents=True, exist_ok=True)
        sheet, data = self.pack()
        sheet.save(OUT / f'{self.family}.png')
        (OUT / f'{self.family}.json').write_text(_dump(data), encoding='utf-8')
        print(f'wrote public/art/{self.family}.png ({sheet.width}x{sheet.height}) + .json, '
              f'{len(data["sprites"])} sprites')
        return sheet, data


def _dump(data: dict) -> str:
    """JSON with one sprite per line: readable diffs, small file."""
    if 'sprites' in data and len(data) == 1:
        lines = [f'    {json.dumps(k)}: {json.dumps(v, separators=(", ", ": "))}' for k, v in data['sprites'].items()]
        return '{\n  "sprites": {\n' + ',\n'.join(lines) + '\n  }\n}\n'
    return json.dumps(data, indent=2) + '\n'


# ---------------------------------------------------------------- 9-slice


def nine_slice(img: Image.Image, sl, w: int, h: int) -> Image.Image:
    """Draw a 9-slice at w x h the way the game does: corners fixed, edges and centre tiled
    (the last tile clipped), never scaled."""
    l, t, r, b = sl
    W, H = img.size
    mw, mh = W - l - r, H - t - b
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))

    def tile(box, dst):
        sx0, sy0, sx1, sy1 = box
        dx0, dy0, dx1, dy1 = dst
        part = img.crop(box)
        pw, ph = sx1 - sx0, sy1 - sy0
        if pw <= 0 or ph <= 0:
            return
        yy = dy0
        while yy < dy1:
            xx = dx0
            while xx < dx1:
                cw, ch = min(pw, dx1 - xx), min(ph, dy1 - yy)
                out.paste(part.crop((0, 0, cw, ch)), (xx, yy))
                xx += pw
            yy += ph

    tile((0, 0, l, t), (0, 0, l, t))
    tile((W - r, 0, W, t), (w - r, 0, w, t))
    tile((0, H - b, l, H), (0, h - b, l, h))
    tile((W - r, H - b, W, H), (w - r, h - b, w, h))
    tile((l, 0, l + mw, t), (l, 0, w - r, t))
    tile((l, H - b, l + mw, H), (l, h - b, w - r, h))
    tile((0, t, l, t + mh), (0, t, l, h - b))
    tile((W - r, t, W, t + mh), (w - r, t, w, h - b))
    tile((l, t, l + mw, t + mh), (l, t, w - r, h - b))
    return out


# ---------------------------------------------------------------- review sheets

BG = RGBA('night0')
LABEL = RGBA('night3')


def up(im: Image.Image, s: int) -> Image.Image:
    return im.resize((im.width * s, im.height * s), Image.NEAREST)


def review_sheet(family: str, blocks: list[tuple[str, Image.Image]], scale: int = 4,
                 width: int = 1400, bg=BG) -> Path:
    """blocks = [(label, image at 1x)], laid out in rows at `scale`, each with a label above."""
    REVIEW.mkdir(parents=True, exist_ok=True)
    gap = 16
    rows: list[list[tuple[str, Image.Image]]] = [[]]
    x = gap
    for label, im in blocks:
        big = up(im, scale)
        if x + big.width + gap > width and rows[-1]:
            rows.append([])
            x = gap
        rows[-1].append((label, big))
        x += big.width + gap
    height = gap
    for row in rows:
        height += max(b.height for _, b in row) + 14 + gap
    sheet = Image.new('RGBA', (width, height), bg)
    d = ImageDraw.Draw(sheet)
    y = gap
    for row in rows:
        x = gap
        rh = max(b.height for _, b in row)
        for label, big in row:
            d.text((x, y), label, fill=LABEL)
            sheet.alpha_composite(big, (x, y + 14))
            x += big.width + gap
        y += rh + 14 + gap
    path = REVIEW / f'{family}.png'
    sheet.save(path)
    print(f'wrote {path.relative_to(ROOT)}')
    return path


def strip(frames: list[Image.Image], gap: int = 2, bg=None) -> Image.Image:
    w, h = frames[0].size
    out = Image.new('RGBA', (w * len(frames) + gap * (len(frames) - 1), h), bg or (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.alpha_composite(f, (i * (w + gap), 0))
    return out


def on(bg_name: str, im: Image.Image, pad: int = 2) -> Image.Image:
    """Composite a sprite on a flat palette colour (to judge it against a background)."""
    out = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), RGBA(bg_name))
    out.alpha_composite(im, (pad, pad))
    return out
