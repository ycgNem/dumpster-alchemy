"""Shared helpers for the v2 art families (recipes, contraband, map). Import with:

    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "recipes"))
    from v2kit import *

On top of pixel-art/anchor/kit.py (palette, names-maps, outline, finished strips) it adds:
  - names-map drawing: bmp (string bitmaps), rect, line, ell, poly, recolor, erase
  - base(name): a finished key-art sprite as a names-map, to build recipes from the junk
  - tool_cue / treasure_glint: the shared "this one does something" bubble and the treasure glint
  - pack_family(): shelf-packs finished frames into public/art/<family>.png + .json
  - review_v2(): 1x and 3x review sheets on the dirt, in art-src/review/v2/
A names-map is {(x, y): palette name}. Every pixel is a palette name, so every pixel snaps.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "anchor"))
from kit import *  # noqa: E402,F401,F403
from kit import ROOT, RGB, ART, frames_of, image_to_names, names_to_image, FONT  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

REVIEW_V2 = ROOT / "art-src" / "review" / "v2"

# one character per palette name, for string bitmaps
KEY = {
    "#": "ink0", "K": "ink1", "k": "ink2",
    "n": "night0", "N": "night1", "m": "night2", "M": "night3",
    "O": "sodium0", "o": "sodium1", "s": "sodium2", "S": "sodium3",
    "e": "dirt0", "E": "dirt1", "f": "dirt2", "F": "dirt3",
    "g": "grime0", "G": "grime1", "j": "grime2", "J": "grime3",
    "x": "rust0", "Q": "rust1", "q": "rust2", "r": "rust3",
    "L": "steel0", "l": "steel1", "t": "steel2", "T": "steel3",
    "0": "fur0", "1": "fur1", "2": "fur2", "3": "fur3", "4": "fur4",
    "c": "card0", "C": "card1", "d": "card2", "D": "card3",
    "u": "toxic0", "U": "toxic1", "v": "toxic2", "V": "toxic3",
    "b": "bone", "w": "white", "R": "red", "Y": "yellow", "B": "blue", "p": "pink", "h": "hivis",
}


# ---------------------------------------------------------------- names-map drawing

def bmp(n, x0, y0, rows, key=KEY, clear="."):
    """Stamp a string bitmap; '.' (or ' ') leaves the pixel, '_' erases it."""
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in (clear, " "):
                continue
            if ch == "_":
                n.pop((x0 + x, y0 + y), None)
            else:
                n[(x0 + x, y0 + y)] = key[ch]
    return n


def rect(n, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if c is None:
                n.pop((x, y), None)
            else:
                n[(x, y)] = c


def line(n, x0, y0, x1, y1, c):
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        n[(x0, y0)] = c
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def ell(n, cx, cy, rx, ry, c, only=None):
    """Filled ellipse centred on (cx, cy) (half-pixel centres allowed)."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x - cx) / max(rx, 0.01)) ** 2 + ((y - cy) / max(ry, 0.01)) ** 2 <= 1.0:
                if only is None or n.get((x, y)) in only:
                    n[(x, y)] = c


def poly(n, pts, c):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, y0 = min(xs), min(ys)
    m = Image.new("L", (max(xs) - x0 + 1, max(ys) - y0 + 1), 0)
    ImageDraw.Draw(m).polygon([(x - x0, y - y0) for x, y in pts], fill=255)
    px = m.load()
    for y in range(m.height):
        for x in range(m.width):
            if px[x, y]:
                n[(x + x0, y + y0)] = c


def recolor(n, mapping, pred=None):
    for k, v in list(n.items()):
        if v in mapping and (pred is None or pred(*k)):
            n[k] = mapping[v]


def erase(n, pred):
    for k in [k for k in n if pred(*k)]:
        del n[k]


def shift(n, dx, dy):
    return {(x + dx, y + dy): v for (x, y), v in n.items()}


def bbox(n):
    xs = [x for x, _ in n]
    ys = [y for _, y in n]
    return min(xs), min(ys), max(xs), max(ys)


def base(name, frame=0):
    """A finished key-art sprite (pixel-art/<slug>/out/final) as a names-map."""
    fr = frames_of(name)
    if not fr:
        raise SystemExit(f"{name}: build the key art first (pixel-art/junk, gulls, anchor)")
    return image_to_names(fr[frame])


def clip(n, w, h):
    return {k: v for k, v in n.items() if 0 <= k[0] < w and 0 <= k[1] < h}


def lit_rim(n, mapping):
    """The streetlight rim: the first pixel in from an ink0 top or left edge steps up a shade."""
    for (x, y), v in list(n.items()):
        if v == "ink0":
            continue
        if n.get((x - 1, y)) == "ink0" or n.get((x, y - 1)) == "ink0":
            if v in mapping:
                n[(x, y)] = mapping[v]


# ---------------------------------------------------------------- the shared cues

TOOL_BUBBLE = [
    ".###.",
    "#VvU#",
    "#vvU#",
    "#UUu#",
    ".###.",
]
TOOL_SMALL = [
    ".#.",
    "#V#",
    ".#.",
]


def tool_cue(n, frame, x=25, y=1):
    """Tools: a little green brew bubble at the top-right that bobs (frame 0/1), with a tiny one
    rising beside it. The same spot on every tool, so players learn 'this one does something'."""
    out = dict(n)
    if frame == 0:
        bmp(out, x + 1, y + 1, TOOL_BUBBLE)
        bmp(out, x - 2, y + 5, TOOL_SMALL)
    else:
        bmp(out, x + 1, y, TOOL_BUBBLE)
        bmp(out, x - 1, y + 3, TOOL_SMALL)
    return out


GLINT_SMALL = [".S.", "SwS", ".S."]
GLINT_BIG = ["..S..", "..S..", "SSwSS", "..S..", "..S.."]


def treasure_glint(n, frame, cx, cy):
    """Treasures: a sodium glint on the top-left (where the streetlight hits): small, then a
    full four-point star."""
    out = dict(n)
    if frame == 0:
        bmp(out, cx - 1, cy - 1, GLINT_SMALL)
    else:
        bmp(out, cx - 2, cy - 2, GLINT_BIG)
    return out


# ---------------------------------------------------------------- atlases

def to_image(f, w, h):
    return f if isinstance(f, Image.Image) else names_to_image(f, w, h)


def pack_family(family, entries, maxw=640):
    """entries: list of (name, [frames], meta) where frames are names-maps or images (all w x h)
    and meta holds w, h, fps, anchor (+ anything extra). Shelf-packs in the given order."""
    strips = []
    for name, frames, meta in entries:
        w, h = meta["w"], meta["h"]
        im = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
        for i, f in enumerate(frames):
            im.alpha_composite(to_image(f, w, h), (i * w, 0))
        strips.append((name, im, meta, len(frames)))
    maxw = max([maxw] + [s[1].width for s in strips])
    placed, x, y, rowh = {}, 0, 0, 0
    for name, im, _, _ in strips:
        if x + im.width > maxw:
            x, y, rowh = 0, y + rowh, 0
        placed[name] = (x, y)
        x += im.width
        rowh = max(rowh, im.height)
    W = max(placed[n][0] + im.width for n, im, _, _ in strips)
    H = max(placed[n][1] + im.height for n, im, _, _ in strips)
    sheet = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out = {"sprites": {}}
    for name, im, meta, nf in strips:
        px, py = placed[name]
        sheet.alpha_composite(im, (px, py))
        e = {"x": px, "y": py, "w": meta["w"], "h": meta["h"], "frames": nf, "fps": meta.get("fps", 0),
             "anchor": meta.get("anchor", [meta["w"] // 2, meta["h"] - 1])}
        for k, v in meta.items():
            if k not in e:
                e[k] = v
        out["sprites"][name] = e
    ART.mkdir(parents=True, exist_ok=True)
    sheet.save(ART / f"{family}.png")
    (ART / f"{family}.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8")
    print(f"atlas -> public/art/{family}.png ({W}x{H}), {len(strips)} sprites")
    return sheet, out


def dirt_bg(w, h, ox=0, oy=0):
    """The board's two dirt cells, checkered every 32 px."""
    im = Image.new("RGBA", (w, h), RGB["dirt1"] + (255,))
    d = ImageDraw.Draw(im)
    for cy in range(-1, h // 32 + 2):
        for cx in range(-1, w // 32 + 2):
            col = RGB["dirt1"] if (cx + cy) % 2 == 0 else RGB["dirt2"]
            x0, y0 = ox % 32 + cx * 32 - 32, oy % 32 + cy * 32 - 32
            d.rectangle([x0, y0, x0 + 31, y0 + 31], fill=col)
    return im


def review_v2(path, rows, scale=3, title=None, cols=None, label_w=None, bg="dirt"):
    """rows: list of (label, [frame images]). Each frame at `scale` on the dirt, then the same at
    1x, so the sheet shows both sizes. Writes art-src/review/v2/<path>."""
    pad, lab = 6, 12
    fw = max(f.width for _, fr in rows for f in fr)
    fh = max(f.height for _, fr in rows for f in fr)
    nf = max(len(fr) for _, fr in rows)
    cols = cols or 1
    cellw = nf * (fw * scale + 4) + 8 + nf * (fw + 2) + pad
    cellh = lab + fh * scale + pad
    nrows = (len(rows) + cols - 1) // cols
    W = pad + cols * cellw
    H = (lab + 4 if title else 0) + pad + nrows * cellh
    sheet = Image.new("RGBA", (W, H), (34, 30, 40, 255))
    d = ImageDraw.Draw(sheet)
    top = pad
    if title:
        d.text((pad, 3), title, fill=(240, 230, 200), font=FONT)
        top += lab + 4
    for i, (label, frames) in enumerate(rows):
        cx = pad + (i % cols) * cellw
        cy = top + (i // cols) * cellh
        d.text((cx, cy), label, fill=(230, 220, 200), font=FONT)
        x = cx
        for f in frames:
            b = dirt_bg(f.width, f.height) if bg == "dirt" else Image.new("RGBA", f.size, RGB[bg] + (255,))
            b.alpha_composite(f)
            sheet.alpha_composite(b.resize((f.width * scale, f.height * scale), Image.NEAREST), (x, cy + lab))
            x += f.width * scale + 4
        x += 8
        for f in frames:
            b = dirt_bg(f.width, f.height) if bg == "dirt" else Image.new("RGBA", f.size, RGB[bg] + (255,))
            b.alpha_composite(f)
            sheet.alpha_composite(b, (x, cy + lab + fh * scale - f.height))
            x += f.width + 2
    REVIEW_V2.mkdir(parents=True, exist_ok=True)
    out = REVIEW_V2 / path
    sheet.save(out)
    print(f"review -> {out.relative_to(ROOT)}")
    return out
