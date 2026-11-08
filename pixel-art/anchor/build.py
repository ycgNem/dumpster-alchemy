"""Style anchor: the Shopping Cart (item_cart, junk tier 8) and Gary (raccoon_gary_idle).

Run from anywhere:  python3 pixel-art/anchor/build.py

Inputs (never edited):
  art-src/dl/anchor_cart_pixen_v4.png   layout reference for the cart (handle top-left,
                                        trapezoid basket, two wheels); the cart is redrawn here
  art-src/dl/anchor_gary_pixen_v1.png   Gary's draft; mapped onto the palette by material,
                                        then relit and fixed by hand below

Outputs:
  public/art/items.png + items.json     item_cart (2 frames: the bent wheel twitches)
  public/art/cast.png  + cast.json      raccoon_gary_idle (2 frames: idle, blink)
  art-src/review/anchor.png             review sheet: 6x on board dirt and on night0, plus 1x/2x
  pixel-art/anchor/out/                 working previews (not loaded by the game)
"""
import colorsys
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE.parent))  # pal.py
sys.path.insert(0, str(HERE))  # kit.py
_local = ROOT / ".claude/skills/pixel-art-studio/scripts"
sys.path.insert(0, str(_local if _local.exists() else Path.home() / ".claude/skills/pixel-art-studio/scripts"))

from PIL import Image, ImageDraw, ImageFont  # noqa: E402
from pal import PAL, rgb  # noqa: E402
from pixelstudio import Sprite  # noqa: E402
from kit import save_final, pack  # noqa: E402

PALETTE = ["#" + h for h in PAL.values()]
C = {name: "#" + h for name, h in PAL.items()}  # C['ink0'] -> '#1a1422'

DL = ROOT / "art-src" / "dl"
OUT = HERE / "out"
ART = ROOT / "public" / "art"
REVIEW = ROOT / "art-src" / "review"


def new_sprite(w, h):
    return Sprite(w, h, palette=PALETTE)


# --------------------------------------------------------------------------------------------
# The Shopping Cart, 32 x 32. Side view, handle at the back (left), basket a trapezoid that
# narrows toward the floor at the front, a lower rack, two casters. The front caster is bent
# and sticks out sideways ("one wheel has opinions"); frame 2 twitches it.
# Light: the sodium streetlight, top-left. Shadows lean violet (ink2 inside the basket).
# --------------------------------------------------------------------------------------------

TOP, BOT = 9, 18             # basket top rail row, bottom rail row
BACK = 8                     # basket back post column (runs on down to the back wheel)
FRONT_TOP, FRONT_BOT = 28, 25  # front edge x at the top rail and at the bottom rail
RACK = 24                    # lower rack row
FRONT_LEG = 23               # where the front leg meets the rack


def front_x(y):
    """x of the slanted front edge at row y."""
    t = (y - TOP) / (BOT - TOP)
    return round(FRONT_TOP + (FRONT_BOT - FRONT_TOP) * t)


# The bag's silhouette, rows of (y, x0, x1): bulges over the rail, sits in the back of the basket.
BAG = [
    (4, 13, 16), (5, 12, 17), (6, 11, 19), (7, 10, 20), (8, 10, 21),
    (9, 9, 22), (10, 9, 22), (11, 9, 22), (12, 9, 21), (13, 9, 21), (14, 9, 20),
    (15, 9, 20), (16, 9, 19), (17, 9, 18),
]

# Front caster, bent: nearly edge-on and tilted. Frame 2 flips it the other way.
BENT_WHEEL = {
    0: [(23, 26), (24, 26), (24, 27), (25, 27), (24, 28), (25, 28), (25, 29), (26, 29)],
    1: [(22, 26), (23, 26), (21, 27), (22, 27), (21, 28), (22, 28), (20, 29), (21, 29)],
}
BENT_HUB = {0: (24, 27), 1: (22, 27)}


def draw_cart(s, twitch=0):
    # --- basket interior: the far side, in violet shadow
    for y in range(TOP + 1, BOT):
        for x in range(BACK + 1, front_x(y)):
            s.px(x, y, C["ink2"])

    # --- the trash bag (grime ramp), lit from the top-left
    for y, x0, x1 in BAG:
        for x in range(x0, x1 + 1):
            s.px(x, y, C["grime2"])
    for y, x0, x1 in BAG:
        for x in range(x0, x1 + 1):
            if y <= 9 and x <= x0 + 2:
                s.px(x, y, C["grime3"])          # lit flank
            if x >= x1 - 1 and y >= 6:
                s.px(x, y, C["grime1"])          # shade flank
            if x == x1 and y >= 8:
                s.px(x, y, C["grime0"])
    for x, y in [(13, 3), (16, 3), (14, 4), (15, 4)]:   # the knot: two ears and a neck
        s.px(x, y, C["grime1"])
    s.px(13, 3, C["grime2"])
    for x, y in [(12, 6), (13, 6), (11, 7)]:            # plastic sheen, warm-lit
        s.px(x, y, C["sodium3"])
    s.px(12, 7, C["grime3"])
    for x, y in [(17, 5), (17, 6), (18, 7), (18, 8)]:   # a fold
        s.px(x, y, C["grime1"])

    # --- near-side wires over the bag and the interior (upper half catches more light)
    for wx in (11, 14, 17, 20, 23):
        for y in range(TOP + 1, BOT):
            if BACK < wx < front_x(y):
                s.px(wx, y, C["steel2"] if y < 14 else C["steel1"])
    for x in range(BACK + 1, front_x(14)):
        s.px(x, 14, C["steel2"] if x < 17 else C["steel1"])

    # --- rails and posts
    for x in range(BACK, FRONT_TOP + 1):       # top rail, 2 px: lit top, darker under
        s.px(x, TOP, C["steel3"])
        s.px(x, TOP + 1, C["steel2"] if x < 20 else C["steel1"])
    for y in range(TOP, RACK + 1):             # back post, straight down to the rack
        s.px(BACK, y, C["steel3"] if y < 14 else C["steel2"])
    for y in range(TOP, BOT + 1):              # front edge (shadow side)
        s.px(front_x(y), y, C["steel1"])
    for x in range(BACK, FRONT_BOT + 1):       # bottom rail
        s.px(x, BOT, C["steel1"])
    # the streetlight's warm glint along the lit end of the top rail
    for x, c in [(BACK, "sodium3"), (BACK + 1, "sodium3"), (BACK + 2, "bone"), (BACK + 3, "bone"), (BACK + 4, "bone")]:
        s.px(x, TOP, C[c])

    # --- rust: clusters, not specks
    for x, y, c in [(12, BOT, "rust2"), (13, BOT, "rust3"), (14, BOT, "rust1"),
                    (21, TOP + 1, "rust2"), (22, TOP + 1, "rust3"), (23, TOP + 1, "rust2"),
                    (front_x(12), 12, "rust2"), (front_x(13), 13, "rust1"), (front_x(14), 14, "rust2"),
                    (BACK, 20, "rust2"), (BACK, 21, "rust1")]:
        s.px(x, y, C[c])

    # --- the handle: rod up-left from the back post to a red plastic grip
    s.line(BACK - 1, TOP - 1, 6, 7, C["steel2"])
    grip = [(4, 3), (5, 3), (6, 3), (3, 4), (4, 4), (5, 4), (6, 4), (3, 5), (4, 5), (5, 5), (6, 5), (4, 6), (5, 6)]
    for x, y in grip:
        s.px(x, y, C["red"])
    s.px(4, 3, C["pink"]); s.px(3, 4, C["pink"]); s.px(5, 3, C["pink"])   # lit plastic
    s.px(6, 5, C["rust1"]); s.px(5, 6, C["rust1"]); s.px(6, 4, C["rust2"])  # shade

    # --- under the basket: slanted front leg, lower rack
    s.line(FRONT_BOT, BOT, FRONT_LEG, RACK, C["steel1"])
    for x in range(BACK, FRONT_LEG + 1):
        s.px(x, RACK, C["steel1"])
    s.px(16, RACK, C["rust2"]); s.px(17, RACK, C["rust1"])

    # --- back caster: a proper round wheel
    s.px(BACK + 1, RACK + 1, C["steel1"])               # fork
    for x, y in [(9, 26), (10, 26), (8, 27), (9, 27), (10, 27), (11, 27),
                 (8, 28), (9, 28), (10, 28), (11, 28), (9, 29), (10, 29)]:
        s.px(x, y, C["ink1"])
    s.px(9, 27, C["steel3"]); s.px(10, 27, C["steel1"]); s.px(9, 28, C["steel1"])  # hub

    # --- the front caster, bent
    s.px(FRONT_LEG, RACK + 1, C["steel1"])              # fork
    for x, y in BENT_WHEEL[twitch]:
        s.px(x, y, C["ink1"])
    s.px(*BENT_HUB[twitch], C["steel2"])

    s.outline(C["ink0"], where="outside")


def build_cart():
    s = new_sprite(32, 32)
    draw_cart(s, twitch=0)
    s.add_frame(copy=False)
    draw_cart(s, twitch=1)
    s.set_duration(500)
    return s


# --------------------------------------------------------------------------------------------
# Gary, 48 x 48 bust. The draft is mapped onto the palette by material (hat, vest, stripes,
# fur, blush), then relit from the top-left and fixed by hand.
# --------------------------------------------------------------------------------------------

def _hsv(p):
    h, s_, v = colorsys.rgb_to_hsv(*(c / 255 for c in p[:3]))
    return h * 360, s_, v


def gary_material(x, y, p):
    """Palette name for one draft pixel, by where it is and what colour it is."""
    h, sat, v = _hsv(p)
    if v < 0.06:
        return "ink0"
    warm = sat > 0.35 and (h < 50 or h > 340)
    if warm and 23 <= y <= 30 and (h < 11 or h > 340) and sat < 0.65:
        return "pink"                                   # blush
    if y <= 19 and 0.2 < sat < 0.7 and 25 <= h <= 50 and v > 0.9:
        return "sodium3"                                # the hat's cream highlight
    if warm and y <= 19:                                # the hard hat
        if h >= 33:
            return "yellow"
        if h >= 22:
            return "sodium2"
        return "sodium1"
    if warm:                                            # the vest (the head shades its shoulders)
        if v >= 0.9:
            return "hivis"
        if v >= 0.7:
            return "rust3"
        return "rust2"
    stripe_zone = y >= 34 and (11 <= x <= 17 or 31 <= x <= 37 or (y >= 44 and 11 <= x <= 37))
    if stripe_zone and v >= 0.4:                         # reflective tape
        if sat > 0.1:
            return "steel1" if v < 0.52 else "steel2"   # the tape's darker border
        if v >= 0.9:
            return "white"
        if v >= 0.62:
            return "steel3"
        return "steel2"
    # fur (and the mask, the nose, the shirt). fur0 sits within 10 of ink1, so the darks
    # all go to ink1: the violet-leaning shadow.
    if v < 0.245:
        return "ink1"
    if v < 0.395:
        return "fur1"
    if v < 0.59:
        return "fur2"
    if v < 0.78:
        return "fur3"
    if v < 0.88:
        return "fur4"
    if v < 0.95:
        return "bone"
    return "white"


def gary_base():
    src = Image.open(DL / "anchor_gary_pixen_v1.png").convert("RGBA")
    names = {}
    for y in range(src.height):
        for x in range(src.width):
            p = src.getpixel((x, y))
            if p[3] >= 128:
                names[(x, y)] = gary_material(x, y, p)
    return names


FUR_UP = {"ink1": "fur1", "fur1": "fur2", "fur2": "fur3", "fur3": "fur4", "fur4": "bone"}
FUR_DOWN = {"fur1": "ink1", "fur2": "fur1", "fur3": "fur2", "fur4": "fur3", "bone": "fur4", "white": "bone"}


def _set(n, pts, name):
    for pt in pts:
        n[pt] = name


def gary_edits(n, blink=False):
    """Hand fixes on the mapped draft. n: {(x, y): palette name}. Face centre is x = 23.5,
    so a feature at x mirrors to 47 - x."""
    # --- the hat: highlight pulled to the lit (left) side, the right side in shade
    for y in range(1, 8):
        for x in (25, 26, 27, 28):
            if n.get((x, y)) == "sodium3":
                n[(x, y)] = "yellow"
    for y in range(3, 8):                               # right panel's streak: lit -> plain
        if n.get((30, y)) == "sodium3":
            n[(30, y)] = "yellow"
    for y in range(5, 13):                              # right panel's outer third -> shade
        for x in range(32, 36):
            if n.get((x, y)) == "yellow":
                n[(x, y)] = "sodium2"
    for y in range(6, 10):                              # left panel: a lit streak
        if n.get((15, y)) == "yellow":
            n[(15, y)] = "sodium3"
    for x in range(26, 31):                             # brim highlight fades to the right
        if n.get((x, 15)) == "sodium3":
            n[(x, 15)] = "yellow"
    _set(n, [(36, 13), (37, 13)], "sodium2")            # right brim tip in shade
    _set(n, [(35, 14), (36, 14)], "sodium1")

    # --- the scowl: brows slant down toward the nose
    _set(n, [(13, 19), (14, 19), (15, 19), (16, 19)], "bone")      # left brow, outer (high)
    _set(n, [(17, 20), (18, 20), (19, 20), (20, 20)], "fur4")      # left brow, inner (low)
    _set(n, [(17, 19), (18, 19), (19, 19), (20, 19), (21, 19)], "fur3")  # furrowed forehead
    _set(n, [(21, 20)], "fur2")
    _set(n, [(31, 19), (32, 19), (33, 19), (34, 19)], "fur4")      # right brow, mirrored
    _set(n, [(27, 20), (28, 20), (29, 20), (30, 20)], "fur3")      # (in light shade)
    _set(n, [(26, 19), (27, 19), (28, 19), (29, 19), (30, 19)], "fur2")
    _set(n, [(26, 20)], "fur2")
    _set(n, [(13, 20), (14, 20), (15, 20), (16, 20)], "ink1")      # mask under the outer brow
    _set(n, [(31, 20), (32, 20), (33, 20), (34, 20)], "ink1")

    # --- the eyes: lids cut the inner top corner (angry), pupils with a top-left glint
    _set(n, [(x, 21) for x in range(14, 20)] + [(x, 21) for x in range(28, 34)], "ink0")
    _set(n, [(x, 24) for x in range(14, 20)] + [(x, 24) for x in range(28, 34)], "ink0")
    if blink:
        # shut tight, still cross: a lid line under the brow's slant
        _set(n, [(x, y) for x in range(15, 19) for y in (22, 23)], "ink1")
        _set(n, [(x, y) for x in range(29, 33) for y in (22, 23)], "ink1")
        _set(n, [(15, 22), (16, 22), (17, 23), (18, 23)], "fur2")
        _set(n, [(32, 22), (31, 22), (30, 23), (29, 23)], "fur2")
    else:
        # left eye: x 15-18
        _set(n, [(15, 22), (15, 23), (18, 23)], "bone")
        _set(n, [(17, 22), (18, 22), (16, 23), (17, 23)], "ink0")
        _set(n, [(16, 22)], "white")
        # right eye: x 29-32 (pupil glint stays top-left: the light is not mirrored)
        _set(n, [(32, 22), (32, 23), (29, 23)], "bone")
        _set(n, [(29, 22), (31, 22), (30, 23), (31, 23)], "ink0")
        _set(n, [(30, 22)], "white")

    # --- the light: a lit rim down the left of the face and arm, the right rim in shade
    for y in range(18, 47):
        row = [x for x in range(48) if (x, y) in n and n[(x, y)] != "ink0"]
        if not row:
            continue
        xl, xr = row[0], row[-1]
        if n[(xl, y)] in FUR_UP:
            n[(xl, y)] = FUR_UP[n[(xl, y)]]
        if n[(xr, y)] in FUR_DOWN and xr > 30:
            n[(xr, y)] = FUR_DOWN[n[(xr, y)]]
    for (x, y), name in list(n.items()):                # right ear one step darker
        if x >= 37 and 6 <= y <= 16 and name in FUR_DOWN:
            n[(x, y)] = FUR_DOWN[name]

    # --- the vest: the lit panel catches the streetlight; right-side tape glints dimmer
    _set(n, [(17, 37), (17, 38), (18, 38), (17, 39)], "sodium2")
    for (x, y), name in list(n.items()):
        if x >= 24 and y >= 37 and name == "white":
            n[(x, y)] = "steel3"


def build_gary():
    s = new_sprite(48, 48)
    for frame, blink in ((1, False), (2, True)):
        if frame == 2:
            s.add_frame(copy=False)
        n = gary_base()
        gary_edits(n, blink=blink)
        for (x, y), name in n.items():
            s.px(x, y, C[name])
    return s


# --------------------------------------------------------------------------------------------
# Atlases, review sheet
# --------------------------------------------------------------------------------------------

def write_atlas(name, entries):
    """entries: list of (sprite_name, Sprite, fps, anchor). Frames left to right, one row each."""
    width = max(sp.w * sp.n_frames for _, sp, _, _ in entries)
    height = sum(sp.h for _, sp, _, _ in entries)
    sheet = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    meta = {"sprites": {}}
    y = 0
    for sname, sp, fps, anchor in entries:
        for i in range(sp.n_frames):
            sheet.alpha_composite(sp.composite(i + 1), (i * sp.w, y))
        meta["sprites"][sname] = {"x": 0, "y": y, "w": sp.w, "h": sp.h, "frames": sp.n_frames,
                                  "fps": fps, "anchor": anchor}
        y += sp.h
    ART.mkdir(parents=True, exist_ok=True)
    sheet.save(ART / f"{name}.png")
    (ART / f"{name}.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"atlas -> public/art/{name}.png ({width}x{height}) + {name}.json")


def _panel(sprite_im, size, offset, bg):
    """A size x size logical panel: bg 'dirt' (dirt1/dirt2 board checker, 32 px cells
    aligned to the sprite's cell) or 'night' (night0), sprite pasted at offset."""
    im = Image.new("RGBA", (size, size), rgb("night0") + (255,))
    if bg == "dirt":
        d = ImageDraw.Draw(im)
        ox, oy = offset[0] % 32, offset[1] % 32
        for cy in range(-1, size // 32 + 2):
            for cx in range(-1, size // 32 + 2):
                col = rgb("dirt1") if (cx + cy) % 2 == 0 else rgb("dirt2")
                x0, y0 = ox + cx * 32 - 32, oy + cy * 32 - 32
                d.rectangle([x0, y0, x0 + 31, y0 + 31], fill=col)
    im.alpha_composite(sprite_im, offset)
    return im


def review_sheet(cart, gary, path):
    font = ImageFont.load_default()
    S = 6
    frames = [("item_cart f1", cart.composite(1), (16, 16)),
              ("item_cart f2", cart.composite(2), (16, 16)),
              ("raccoon_gary_idle f1", gary.composite(1), (8, 8)),
              ("raccoon_gary_idle f2 (blink)", gary.composite(2), (8, 8))]
    P = 64
    gap, lab = 12, 18
    small_w = 300
    W = gap + len(frames) * (P * S + gap) + small_w
    H = gap + 2 * (lab + P * S + gap)
    sheet = Image.new("RGBA", (W, H), (34, 30, 40, 255))
    d = ImageDraw.Draw(sheet)
    for row, bg in enumerate(("dirt", "night")):
        y0 = gap + row * (lab + P * S + gap)
        for i, (label, im, off) in enumerate(frames):
            x0 = gap + i * (P * S + gap)
            d.text((x0, y0 + 3), f"{label} on {'dirt1/dirt2' if bg == 'dirt' else 'night0'}  6x",
                   fill=(230, 220, 200), font=font)
            pan = _panel(im, P, off, bg).resize((P * S, P * S), Image.NEAREST)
            sheet.alpha_composite(pan, (x0, y0 + lab))
        # 1x and 2x: a strip of board (3 x 2 cells) with three carts, Gary beside it
        xs = gap + len(frames) * (P * S + gap)
        for k, sc in enumerate((1, 2)):
            strip = Image.new("RGBA", (96 + 56, 64), rgb("night0") + (255,))
            if bg == "dirt":
                dd = ImageDraw.Draw(strip)
                for cx in range(3):
                    for cy in range(2):
                        col = rgb("dirt1") if (cx + cy) % 2 == 0 else rgb("dirt2")
                        dd.rectangle([cx * 32, cy * 32, cx * 32 + 31, cy * 32 + 31], fill=col)
            for cx, cy in ((0, 0), (2, 0), (1, 1)):
                strip.alpha_composite(cart.composite(1 + cx % 2), (cx * 32, cy * 32))
            strip.alpha_composite(gary.composite(1), (100, 8))
            strip = strip.resize((strip.width * sc, strip.height * sc), Image.NEAREST)
            ys = y0 + lab + k * 100
            d.text((xs, ys - 14), f"{sc}x", fill=(230, 220, 200), font=font)
            sheet.alpha_composite(strip, (xs, ys))
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)
    print(f"review -> {path.relative_to(ROOT)}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cart = build_cart()
    cart.preview(str(OUT / "cart_preview.png"), scale=12, bg=C["dirt1"])
    cart.save_silhouette(str(OUT / "cart_silhouette.png"), scale=8)
    cart.stats()
    gary = build_gary()
    gary.preview(str(OUT / "gary_preview.png"), scale=8, bg=C["dirt1"])
    gary.save_silhouette(str(OUT / "gary_silhouette.png"), scale=6)
    gary.stats()

    save_final("anchor", "item_cart", [cart.composite(1), cart.composite(2)], 32, 32, fps=2, anchor=[16, 31])
    save_final("anchor", "raccoon_gary_idle", [gary.composite(1), gary.composite(2)], 48, 48, fps=0, anchor=[24, 47])
    gary.save_png(str(OUT / "gary_idle_1x.png"), frame=1)   # the base the other raccoons are edited from
    pack("items")
    pack("cast")
    review_sheet(cart, gary, REVIEW / "anchor.png")


if __name__ == "__main__":
    main()
