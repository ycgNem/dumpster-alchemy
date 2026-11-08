"""Shared finishing kit for the key-art build scripts (anchor, junk, gulls, cast, props,
backdrop, logo). Import from a build script with:

    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'anchor'))
    from kit import *

What it does:
  - the palette (from src/data/palette.ts via pal.py) as names -> hex, and pixelstudio Sprites
    locked to it
  - draft mapping: a draft pixel -> a palette name, chosen inside a ramp by value
  - cut a draft out of a sheet, fit it into a canvas, clean the 1 px ink0 outline
  - final strips: each finished sprite is saved as pixel-art/<slug>/out/final/<name>.png
    (frames left to right) + <name>.json; pack(family) gathers every key-art slug's strips
    for that family into public/art/<family>.png + .json
"""
import colorsys
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "pixel-art"))
_local = ROOT / ".claude/skills/pixel-art-studio/scripts"
sys.path.insert(0, str(_local if _local.exists() else Path.home() / ".claude/skills/pixel-art-studio/scripts"))

from PIL import Image, ImageDraw, ImageFont  # noqa: E402
from pal import PAL, RAMP, rgb  # noqa: E402
from pixelstudio import Sprite  # noqa: E402

PALETTE = ["#" + h for h in PAL.values()]
C = {name: "#" + h for name, h in PAL.items()}
RGB = {name: rgb(name) for name in PAL}
NAME_OF = {v: k for k, v in RGB.items()}
DL = ROOT / "art-src" / "dl"
ART = ROOT / "public" / "art"
REVIEW = ROOT / "art-src" / "review"
KEYART_SLUGS = ["anchor", "junk", "gulls", "cast", "props", "backdrop", "logo"]
FONT = ImageFont.load_default()


def new_sprite(w, h):
    return Sprite(w, h, palette=PALETTE)


def hsv(p):
    h, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in p[:3]))
    return h * 360, s, v


def lum(c):
    r, g, b = c[:3]
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255


def pick(names, p):
    """The name in `names` nearest to pixel p (RGB distance, value weighted a bit)."""
    best, bd = None, 1e9
    for n in names:
        q = RGB[n]
        d = sum((a - b) ** 2 for a, b in zip(p[:3], q)) + 2 * ((lum(p) - lum(q)) * 255) ** 2
        if d < bd:
            best, bd = n, d
    return best


def by_value(names, v, cuts=None):
    """Choose from names (dark -> light) by the draft value v in 0..1. cuts: v thresholds."""
    if cuts is None:
        ls = [lum(RGB[n]) for n in names]
        cuts = [(a + b) / 2 for a, b in zip(ls, ls[1:])]
    for n, c in zip(names, cuts):
        if v < c:
            return n
    return names[-1]


# ---------------------------------------------------------------- drafts

def load(path):
    return Image.open(path).convert("RGBA")


def components(im, min_px=20):
    """Bounding boxes (x0, y0, x1, y1 exclusive) of the separate sprites in a sheet,
    left to right. 8-connected on alpha."""
    w, h = im.size
    a = im.load()
    seen = set()
    boxes = []
    for y in range(h):
        for x in range(w):
            if a[x, y][3] >= 128 and (x, y) not in seen:
                stack = [(x, y)]
                seen.add((x, y))
                xs, ys = [], []
                while stack:
                    cx, cy = stack.pop()
                    xs.append(cx); ys.append(cy)
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and a[nx, ny][3] >= 128:
                                seen.add((nx, ny))
                                stack.append((nx, ny))
                if len(xs) >= min_px:
                    boxes.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1, len(xs)))
    boxes.sort(key=lambda b: b[0])
    return boxes


def sheet_cells(im, n):
    """Split a sheet into n equal-width cells and return each cell's cropped content."""
    w, h = im.size
    out = []
    for i in range(n):
        cell = im.crop((i * w // n, 0, (i + 1) * w // n, h))
        bb = cell.getbbox()
        out.append(cell.crop(bb) if bb else cell)
    return out


def crop_alpha(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def harden(im):
    """Binary alpha."""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 128 else (0, 0, 0, 0)
    return im


def map_draft(im, classify):
    """{(x, y): name} for every opaque pixel; classify(x, y, (h, s, v), (r, g, b)) -> name."""
    out = {}
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3] >= 128:
                out[(x, y)] = classify(x, y, hsv(p), p[:3])
    return out


def names_to_image(names, w, h, ox=0, oy=0):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    for (x, y), n in names.items():
        X, Y = x + ox, y + oy
        if 0 <= X < w and 0 <= Y < h and n:
            px[X, Y] = RGB[n] + (255,)
    return im


def image_to_names(im):
    px = im.load()
    out = {}
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3] >= 128:
                out[(x, y)] = NAME_OF.get(p[:3]) or pick(PAL.keys(), p)
    return out


def fit(names, w, h, anchor="bottom", margin=1, dx=0, dy=0):
    """Place a names-map in a w x h canvas: bottom-centred (items) or centred."""
    if not names:
        return {}
    xs = [x for x, _ in names]
    ys = [y for _, y in names]
    bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
    ox = (w - bw) // 2 - min(xs) + dx
    if anchor == "bottom":
        oy = h - margin - bh - min(ys) + dy
    else:
        oy = (h - bh) // 2 - min(ys) + dy
    return {(x + ox, y + oy): n for (x, y), n in names.items()}


def clean_outline(names, ink="ink0", dark=("ink0", "ink1", "fur0")):
    """The 1 px ink0 rule: every edge pixel (touches transparency 4-way) that is dark becomes
    ink0, and any lit edge gets an outside ink0 pixel. Interior near-black stays."""
    out = dict(names)
    for (x, y), n in names.items():
        edge = any((x + dx, y + dy) not in names for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge and n in dark:
            out[(x, y)] = ink
    # outside outline wherever a non-ink edge pixel has no ink neighbour outward
    add = {}
    for (x, y), n in out.items():
        if n == ink:
            continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in out:
                add[q] = ink
    out.update(add)
    return out


def drop_orphans(names, keep=("white", "sodium3", "toxic3")):
    """Remove single pixels that touch nothing 4-way (despeckle), except glints."""
    out = dict(names)
    for (x, y), n in names.items():
        if n in keep:
            continue
        if not any((x + dx, y + dy) in names for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            del out[(x, y)]
    return out


def shift_names(names, dx, dy):
    return {(x + dx, y + dy): n for (x, y), n in names.items()}


def flip_names(names, w):
    return {(w - 1 - x, y): n for (x, y), n in names.items()}


def step(names, region, mapping):
    """Recolour pixels inside region (a predicate on (x, y)) through mapping {old: new}."""
    for k, n in list(names.items()):
        if region(*k) and n in mapping:
            names[k] = mapping[n]


def setpx(names, pts, n):
    for p in pts:
        if n is None:
            names.pop(tuple(p), None)
        else:
            names[tuple(p)] = n


# ---------------------------------------------------------------- frames, strips, atlases

def strip(frames, w, h):
    """frames: list of names-maps or RGBA images -> one RGBA strip, left to right."""
    im = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        fi = f if isinstance(f, Image.Image) else names_to_image(f, w, h)
        im.alpha_composite(fi, (i * w, 0))
    return im


def save_final(slug, name, frames, w, h, fps=0, anchor=None, extra=None):
    """Save a finished sprite as a strip + meta for pack()."""
    d = ROOT / "pixel-art" / slug / "out" / "final"
    d.mkdir(parents=True, exist_ok=True)
    im = strip(frames, w, h)
    im.save(d / f"{name}.png")
    meta = {"w": w, "h": h, "frames": len(frames), "fps": fps,
            "anchor": anchor if anchor is not None else [w // 2, h - 1]}
    if extra:
        meta.update(extra)
    (d / f"{name}.json").write_text(json.dumps(meta) + "\n", encoding="utf-8")
    return im


FAMILY_OF = {"item_": "items", "raccoon_": "cast", "possum_": "cast", "king_": "cast", "truck_": "props",
             "dumpster_": "props", "compactor_": "props", "backdrop": "backdrop", "moon": "backdrop",
             "gull_fly": "backdrop", "logo": "logo"}


def family_of(name):
    for k, f in FAMILY_OF.items():
        if name.startswith(k):
            return f
    raise ValueError(name)


def pack(family, order=None):
    """Gather every finished strip of a family from all key-art slugs into one atlas.
    Shelf packing: strips sorted by height, placed left to right in rows up to 640 px."""
    strips = {}
    for slug in KEYART_SLUGS:
        d = ROOT / "pixel-art" / slug / "out" / "final"
        if not d.exists():
            continue
        for js in sorted(d.glob("*.json")):
            name = js.stem
            if family_of(name) != family:
                continue
            strips[name] = (Image.open(js.with_suffix(".png")).convert("RGBA"),
                            json.loads(js.read_text(encoding="utf-8")))
    if not strips:
        return
    names = order or sorted(strips, key=lambda n: (-strips[n][0].height, n))
    names = [n for n in names if n in strips] + [n for n in strips if n not in (order or [])]
    names = list(dict.fromkeys(names))
    maxw = max(640, max(s[0].width for s in strips.values()))
    placed, x, y, rowh = {}, 0, 0, 0
    for n in names:
        im = strips[n][0]
        if x + im.width > maxw:
            x, y, rowh = 0, y + rowh, 0
        placed[n] = (x, y)
        x += im.width
        rowh = max(rowh, im.height)
    W = max(px + strips[n][0].width for n, (px, py) in placed.items())
    H = max(py + strips[n][0].height for n, (px, py) in placed.items())
    sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    meta = {"sprites": {}}
    for n in names:
        im, m = strips[n]
        px_, py_ = placed[n]
        sheet.alpha_composite(im, (px_, py_))
        entry = {"x": px_, "y": py_, "w": m["w"], "h": m["h"], "frames": m["frames"],
                 "fps": m["fps"], "anchor": m["anchor"]}
        for k, v in m.items():
            if k not in entry:
                entry[k] = v
        meta["sprites"][n] = entry
    ART.mkdir(parents=True, exist_ok=True)
    sheet.save(ART / f"{family}.png")
    (ART / f"{family}.json").write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")
    print(f"atlas -> public/art/{family}.png ({W}x{H}), {len(names)} sprites")


def load_final(name):
    """(strip image, meta) of a finished sprite from any key-art slug."""
    for slug in KEYART_SLUGS:
        js = ROOT / "pixel-art" / slug / "out" / "final" / f"{name}.json"
        if js.exists():
            return Image.open(js.with_suffix(".png")).convert("RGBA"), json.loads(js.read_text(encoding="utf-8"))
    return None, None


# ---------------------------------------------------------------- review sheets

def board_bg(w, h, ox=0, oy=0):
    im = Image.new("RGBA", (w, h), RGB["dirt1"] + (255,))
    d = ImageDraw.Draw(im)
    for cy in range(-1, h // 32 + 2):
        for cx in range(-1, w // 32 + 2):
            col = RGB["dirt1"] if (cx + cy) % 2 == 0 else RGB["dirt2"]
            x0, y0 = ox % 32 + cx * 32 - 32, oy % 32 + cy * 32 - 32
            d.rectangle([x0, y0, x0 + 31, y0 + 31], fill=col)
    return im


def review(path, rows, scale=4, title=None, bgs=("dirt", "night"), small=True):
    """rows: list of (label, [frame images]) — each frame on dirt and on night at `scale`,
    plus a 1x copy at the row end. Writes art-src/review/<path>."""
    pad, lab = 8, 14
    cellw = max(max(f.width for f in fr) for _, fr in rows)
    cellh = max(max(f.height for f in fr) for _, fr in rows)
    nf = max(len(fr) for _, fr in rows)
    cw, ch = (cellw + 4) * scale, (cellh + 4) * scale
    W = pad + len(bgs) * (nf * (cw + 4) + pad) + (nf * (cellw + 6) + 2 * cellw + 20 if small else 0)
    H = (lab + 6 if title else 0) + pad + len(rows) * (ch + lab + pad)
    sheet = Image.new("RGBA", (W, H), (34, 30, 40, 255))
    d = ImageDraw.Draw(sheet)
    y = pad
    if title:
        d.text((pad, 4), title, fill=(240, 230, 200), font=FONT)
        y += lab + 6
    for label, frames in rows:
        d.text((pad, y), label, fill=(230, 220, 200), font=FONT)
        x = pad
        for bg in bgs:
            for f in frames:
                pw, ph = cellw + 4, cellh + 4
                base = board_bg(pw, ph, 2, 2 + (cellh - 32 if cellh >= 32 else 0)) if bg == "dirt" else \
                    Image.new("RGBA", (pw, ph), RGB["night0"] + (255,))
                base.alpha_composite(f, ((pw - f.width) // 2, ph - 2 - f.height))
                sheet.alpha_composite(base.resize((pw * scale, ph * scale), Image.NEAREST), (x, y + lab))
                x += pw * scale + 4
            x += pad
        if small:
            for bg in bgs:
                for f in frames:
                    base = board_bg(f.width, f.height) if bg == "dirt" else Image.new("RGBA", f.size, RGB["night0"] + (255,))
                    base.alpha_composite(f)
                    sheet.alpha_composite(base, (x, y + lab))
                    x += f.width + 2
                x += 6
        y += ch + lab + pad
    REVIEW.mkdir(parents=True, exist_ok=True)
    out = REVIEW / path
    sheet.save(out)
    print(f"review -> {out.relative_to(ROOT)}")
    return out


def frames_of(name):
    im, m = load_final(name)
    if im is None:
        return []
    return [im.crop((i * m["w"], 0, (i + 1) * m["w"], m["h"])) for i in range(m["frames"])]


# ---------------------------------------------------------------- generic material mapping

FURS = ["ink1", "fur1", "fur2", "fur3", "fur4", "bone", "white"]
STEELS = ["ink1", "steel0", "steel1", "steel2", "steel3", "white"]


def classify_generic(greys=FURS, overrides=None, snap_d2=500, avoid=("dirt0", "dirt1", "dirt2", "dirt3", "fur0")):
    """A classify(x, y, hsv, rgb) for map_draft: picks inside a hue family so a colour never
    jumps material. overrides: list of (predicate(x, y, h, s, v), candidates)."""
    def f(x, y, hsv_, p):
        h, s, v = hsv_
        for pred, cands in (overrides or []):
            if pred(x, y, h, s, v):
                return cands if isinstance(cands, str) else pick(cands, p)
        if v < 0.08:
            return "ink0"
        near = min((n for n in PAL if n not in avoid), key=lambda n: sum((a_ - b_) ** 2 for a_, b_ in zip(p, RGB[n])))
        if sum((a_ - b_) ** 2 for a_, b_ in zip(p, RGB[near])) < snap_d2:
            return near
        if v < 0.24:
            return pick(["ink0", "ink1", "ink2"], p)
        if s < 0.13:
            return by_value(greys, v)
        if h >= 330 or h < 15:
            if s < 0.55 and v > 0.7:
                return "pink"
            return pick(["rust0", "rust1", "rust2", "red", "pink"], p)
        if h < 45:
            return pick(["rust1", "rust2", "rust3", "card0", "card1", "card2", "card3", "sodium1", "sodium2", "hivis", "bone"], p)
        if h < 70:
            return pick(["sodium1", "sodium2", "yellow", "sodium3", "card2", "grime3", "bone"], p)
        if h < 170:
            return pick(["grime0", "grime1", "grime2", "grime3", "toxic0", "toxic1", "toxic2", "toxic3"], p)
        if h < 260:
            return pick(["night0", "night1", "night2", "night3", "steel0", "steel1", "steel2", "steel3", "blue"], p)
        return pick(["ink2", "night1", "night2", "night3", "pink", "rust1"], p)
    return f


def grid_text(names, x0=0, y0=0, x1=48, y1=48):
    """Compact text dump of a names-map for planning hand edits."""
    ab = {"ink0": "#", "ink1": "K", "ink2": "k", "fur0": "0", "fur1": "1", "fur2": "2", "fur3": "3", "fur4": "4",
          "bone": "b", "white": "w", "pink": "p", "red": "R", "yellow": "Y", "sodium3": "S", "sodium2": "s",
          "sodium1": "o", "sodium0": "O", "rust3": "r", "rust2": "q", "rust1": "Q", "rust0": "x", "steel3": "T",
          "steel2": "t", "steel1": "l", "steel0": "L", "night0": "n", "night1": "N", "night2": "m", "night3": "M",
          "card0": "c", "card1": "C", "card2": "d", "card3": "D", "hivis": "h", "blue": "B", "grime0": "g",
          "grime1": "G", "grime2": "j", "grime3": "J", "toxic0": "t", "toxic1": "u", "toxic2": "U", "toxic3": "v",
          "dirt0": "e", "dirt1": "E", "dirt2": "f", "dirt3": "F"}
    out = ["    " + "".join(str(x % 10) for x in range(x0, x1))]
    for y in range(y0, y1):
        out.append("%2d  " % y + "".join(ab.get(names.get((x, y)), ".") for x in range(x0, x1)))
    return "\n".join(out)
