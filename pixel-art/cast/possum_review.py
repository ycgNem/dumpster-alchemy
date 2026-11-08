"""Review sheet for the M7b opossum pass (critic N-P2-15): the old possum (art-src/review/m7b/old/,
copied from the M7 build before the change) beside the new one (pixel-art/cast/out/final/),
at 4x and at 1x, on board dirt and on night0, next to Gary; then both on the real lot backdrop
(the fence and the truck lane) at 2x and 1x.

    python3 pixel-art/cast/build.py && python3 pixel-art/cast/possum_review.py

Writes art-src/review/m7b/possum2.png.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "anchor"))
from kit import *  # noqa: E402,F403

OLD = REVIEW / "m7b" / "old"
OUT = REVIEW / "m7b" / "possum2.png"
S = 4                                    # the big zoom
PAD = 8


def frames_from(path):
    im = Image.open(path).convert("RGBA")
    m = json.loads(path.with_suffix(".json").read_text(encoding="utf-8"))
    return [im.crop((i * m["w"], 0, (i + 1) * m["w"], m["h"])) for i in range(m["frames"])]


def old(name):
    return frames_from(OLD / f"{name}.png")


def new(name):
    return frames_of(name)


def tile(f, bg, scale):
    """One sprite on a backdrop 2 px bigger all round (feet 2 px off the bottom), blown up."""
    pw, ph = f.width + 4, f.height + 4
    base = board_bg(pw, ph, 2, 2 + (f.height - 32)) if bg == "dirt" else         Image.new("RGBA", (pw, ph), RGB["night0"] + (255,))
    base.alpha_composite(f, (2, 2))
    return base.resize((pw * scale, ph * scale), Image.NEAREST)


FENCE_Y, LANE_Y = 55, 102          # his foot lines in src/render/possum.ts (fence, truck lane)


def lot_scene(gary, idle, shutdown, dead, walk):
    """The top of the real backdrop (sky, fence, truck lane) with him on the fence and in the
    lane the way the game draws him (bottom-centre anchors), Gary in the lane for scale."""
    im, m = load_final("backdrop")
    scene = im.crop((0, 0, 400, 120)).convert("RGBA")
    def put(f, cx, foot):
        scene.alpha_composite(f, (cx - f.width // 2, foot - f.height + 1))
    put(idle, 30, FENCE_Y)
    put(walk[0], 80, LANE_Y)
    put(walk[2], 118, LANE_Y)
    put(idle, 170, LANE_Y)
    put(shutdown, 224, LANE_Y)
    put(dead, 282, LANE_Y)
    put(gary, 350, LANE_Y)
    return scene


def main():
    gary = frames_of("raccoon_gary_idle")[0]
    groups = [
        ("possum_idle (idle, blink)", old("possum_idle"), new("possum_idle")),
        ("possum_shutdown, possum_dead", old("possum_shutdown") + old("possum_dead"),
         new("possum_shutdown") + new("possum_dead")),
        ("possum_walk (4 frames, 8 fps)", old("possum_walk"), new("possum_walk")),
    ]
    rows = [(label, bg, o, n) for label, o, n in groups for bg in ("dirt", "night")]
    lab, gap = 14, 4

    def big_width(o, n):
        return sum((f.width + 4) * S + gap for f in [gary] + o + n) + 3 * PAD

    def small_width(o, n):
        return sum(f.width + 4 for f in [gary] + o + n) + 2 * PAD

    W = max(PAD + big_width(o, n) + small_width(o, n) + PAD for _, _, o, n in rows)
    rh = (48 + 4) * S + lab + 12 + PAD
    scenes = [(tag, lot_scene(gary, f["possum_idle"][0], f["possum_shutdown"][0], f["possum_dead"][0],
                              f["possum_walk"]))
              for tag, f in (("OLD", {k: old(k) for k in ("possum_idle", "possum_shutdown", "possum_dead",
                                                            "possum_walk")}),
                             ("NEW", {k: new(k) for k in ("possum_idle", "possum_shutdown", "possum_dead",
                                                            "possum_walk")}))]
    sw, sh = scenes[0][1].size
    W = max(W, PAD + sw * 2 + PAD + sw + PAD)
    H = 30 + len(rows) * rh + 2 * (sh * 2 + lab + PAD) + lab + PAD
    sheet = Image.new("RGBA", (W, H), (34, 30, 40, 255))
    d = ImageDraw.Draw(sheet)
    d.text((PAD, 6), "M7b Inspector Possum: OLD (M7, read as a white lab rat) | NEW (opossum: black ears, "
                     "eye rings, grizzled grey fur, black legs, dark tail base). Gary for scale. 4x, then 1x.",
           fill=(240, 230, 200), font=FONT)
    y = 30
    for label, bg, o, n in rows:
        d.text((PAD, y), f"{label} on {'board dirt' if bg == 'dirt' else 'night0'}", fill=(230, 220, 200), font=FONT)
        y0 = y + lab + 12
        bottom = y0 + (48 + 4) * S                       # every sprite stands on one line
        x = PAD
        t = tile(gary, bg, S)
        sheet.alpha_composite(t, (x, bottom - t.height))
        x += t.width + gap + PAD
        for tag, frames in (("OLD", o), ("NEW", n)):
            d.text((x + 2, y0 - 12), tag, fill=(255, 210, 122) if tag == "NEW" else (180, 170, 160), font=FONT)
            for f in frames:
                t = tile(f, bg, S)
                sheet.alpha_composite(t, (x, bottom - t.height))
                x += t.width + gap
            x += PAD
        # 1x: Gary, then old, then new, on the same backdrop, standing on one line
        x += PAD
        for i, f in enumerate([gary] + o + n):
            t = tile(f, bg, 1)
            sheet.alpha_composite(t, (x, y0 + 52 - t.height))
            x += t.width + (PAD if i in (0, len(o)) else 0)
        y += rh
    d.text((PAD, y), "on the lot (the real backdrop): on the fence, in the truck lane; 2x (about the game's "
                     "screen scale), then 1x", fill=(230, 220, 200), font=FONT)
    y += lab
    for tag, scene in scenes:
        d.text((PAD, y), tag, fill=(255, 210, 122) if tag == "NEW" else (180, 170, 160), font=FONT)
        sheet.alpha_composite(scene.resize((sw * 2, sh * 2), Image.NEAREST), (PAD, y + lab))
        sheet.alpha_composite(scene, (PAD + sw * 2 + PAD, y + lab))
        y += sh * 2 + lab + PAD
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT)
    print(f"review -> {OUT.relative_to(ROOT)} ({W}x{H})")


if __name__ == "__main__":
    main()
