"""The scene backdrops (docs/V2.md, pillar 4): Lot 9, the Marina and Mount Trashmore.
Run: python3 pixel-art/backdrop/build.py

Each is a 960 x 640 panorama, 2 frames (frame 2: the streetlight flickers dim), anchored at
(160, 140) = the stage's top-left, so the game draws it at stage (0, 0) and its middle 640 x 360
lands on the stage while the rest fills the margins. 960 x 640 covers a 2.67:1 window at 360
high and a 1:1 window at 640 wide (the brief asks for 4:3 up to 2.4:1; past the panorama the game
paints a sky / lane / dirt backstop). The shared drawing kit is pano.py; the scenes are
lot9.py, marina.py and trashmore.py; the moon and the flying gull are sky.py.

Sprites (family `backdrop`, public/art/backdrop.png): backdrop_lot9, backdrop_marina,
backdrop_trashmore, moon, gull_fly. The old 640 x 360 `backdrop` is retired (Lot 9 replaces it;
src/render/backdrop.ts still falls back to it if an old atlas is loaded).
Review sheet: art-src/review/v2/backdrops.png.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "anchor"))
sys.path.insert(0, str(HERE))
from kit import REVIEW, Image, ImageDraw, FONT, frames_of, pack, review, save_final  # noqa: E402

import lot9  # noqa: E402
import marina  # noqa: E402
import pano  # noqa: E402
import sky  # noqa: E402
import trashmore  # noqa: E402

SLUG = "backdrop"
SCENES = {"lot9": lot9, "marina": marina, "trashmore": trashmore}
# Windows to mark on the review sheet: (label, buffer w, buffer h) at the stage's height or width.
WINDOWS = [("16:9", 640, 360), ("1920x945", 732, 360), ("2.4:1", 864, 360), ("16:10", 640, 400), ("4:3", 640, 480)]
MARK = {"16:9": (255, 0, 255), "1920x945": (0, 255, 255), "2.4:1": (255, 255, 0), "16:10": (0, 255, 0), "4:3": (255, 128, 0)}


def main():
    built = {}
    for name, mod in SCENES.items():
        frames = [mod.build(False), mod.build(True)]
        built[name] = frames
        save_final(SLUG, f"backdrop_{name}", frames, pano.PW, pano.PH, fps=0, anchor=[pano.OX, pano.OY])
        print(f"backdrop_{name}: {pano.PW}x{pano.PH} x2")
    old = HERE / "out" / "final"
    for ext in ("png", "json"):
        (old / f"backdrop.{ext}").unlink(missing_ok=True)       # retired: Lot 9 replaces it
    save_final(SLUG, "moon", [sky.moon()], 32, 32, fps=0, anchor=[16, 31])
    save_final(SLUG, "gull_fly", sky.gull_frames(), 16, 16, fps=6, anchor=[8, 15])
    pack("backdrop")
    (REVIEW / "m7").mkdir(parents=True, exist_ok=True)
    review("m7/sky.png", [("moon", frames_of("moon")), ("gull_fly (6 fps)", frames_of("gull_fly"))],
           scale=6, title="sky: moon + gull_fly on dirt and night0 at 6x, 1x at right", bgs=("night", "dirt"))
    review_sheet(built)


def review_sheet(built):
    """Per scene: the whole panorama at 1x with the windows marked (what each shape of window
    shows), and the lamp corner of both frames at 2x."""
    pad, lab = 10, 14
    crop = (pano.OX - 20, pano.OY - 20, pano.OX + 300, pano.OY + 130)    # the lamp corner
    cw, ch = (crop[2] - crop[0]) * 2, (crop[3] - crop[1]) * 2
    W = pad + pano.PW + pad + cw + pad
    H = pad + lab + len(built) * (pano.PH + lab + pad) + 20
    sheet = Image.new("RGBA", (W, H), (34, 30, 40, 255))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 4), "backdrops: 960x640 panoramas, stage (magenta) at 160,140; windows marked; right: frame 0 / frame 1 lamp corner at 2x",
           fill=(240, 230, 200), font=FONT)
    y = pad + lab
    for name, (a, b) in built.items():
        d.text((pad, y), f"backdrop_{name}", fill=(230, 220, 200), font=FONT)
        y += lab
        big = a.copy()
        bd = ImageDraw.Draw(big)
        for label, bw, bh in WINDOWS:
            x0 = pano.OX - (bw - 640) // 2
            y0 = pano.OY - (bh - 360) // 2
            bd.rectangle([x0, y0, x0 + bw - 1, y0 + bh - 1], outline=MARK[label] + (255,))
        sheet.alpha_composite(big, (pad, y))
        za = a.crop(crop).resize((cw, ch), Image.NEAREST)
        zb = b.crop(crop).resize((cw, ch), Image.NEAREST)
        sheet.alpha_composite(za, (pad + pano.PW + pad, y))
        if 2 * ch + 4 <= pano.PH:
            sheet.alpha_composite(zb, (pad + pano.PW + pad, y + ch + 4))
        y += pano.PH + pad
    x = pad
    for label, _, _ in WINDOWS:
        d.rectangle([x, y, x + 10, y + 8], fill=MARK[label] + (255,))
        d.text((x + 14, y - 2), label, fill=(230, 220, 200), font=FONT)
        x += 90
    out = REVIEW / "v2"
    out.mkdir(parents=True, exist_ok=True)
    sheet.save(out / "backdrops.png")
    for name, (a, _) in built.items():
        a.crop((pano.OX, pano.OY, pano.OX + 640, pano.OY + 360)).resize((1280, 720), Image.NEAREST).save(out / f"backdrop_{name}_stage_2x.png")
    print("review -> art-src/review/v2/backdrops.png (+ backdrop_<scene>_stage_2x.png)")


if __name__ == "__main__":
    main()
