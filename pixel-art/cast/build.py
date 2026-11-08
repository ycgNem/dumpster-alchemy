"""The cast: raccoon_<id>_{idle,happy,angry} for linda, pete, mange (+ gary's happy/angry),
Inspector Possum (possum_idle, possum_dead, possum_shutdown, possum_walk) and the finale's
king_portrait. Run: python3 pixel-art/cast/build.py

Inputs (never edited), art-src/dl/:
  cast_<id>_v1.png       edit_image_pixen of the finished Gary into each character
  cast_moods_*.png       group edits (happy / angry) of the finished idles, cut apart here
  cast_possum2_*.png     the M7 possum redesign (possum.py, possum_dead.py, possum_walk.py)
  cast_king_portrait_*   the finale portrait (king.py)
  cast_possum_v1.png etc. the first possum (read as a panda, critic P2-1): no longer used
Gary's idle comes from pixel-art/anchor (the style anchor).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "anchor"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from kit import *  # noqa: E402,F403
import possum  # noqa: E402
import possum_dead  # noqa: E402
import possum_walk  # noqa: E402
import king  # noqa: E402

SLUG = "cast"
OUT = Path(__file__).resolve().parent / "out"

# eye boxes (x0, y0, x1, y1 inclusive), the mask colour behind them, the lid row for the blink
CHARS = {
    "linda": dict(src="cast_linda_v1", eyes=[(15, 16, 19, 18), (28, 16, 32, 18)], mask="ink2", lid=18),
    "pete": dict(src="cast_pete_v1", eyes=[(16, 20, 21, 25), (27, 20, 32, 25)], mask="ink1", lid=23),
    "mange": dict(src="cast_mange_v1", eyes=[(17, 16, 20, 18), (27, 16, 30, 18)], mask="ink1", lid=17),
}


def base(cid):
    m = map_draft(load(DL / f"{CHARS[cid]['src']}.png"), classify_generic())
    return clean_outline(drop_orphans(m), dark=("ink0", "ink1"))


def linda_extras(n):
    """Cat-eye glasses (red frames, upswept outer corners) on a gold bead chain."""
    frame = []
    for x0, x1, flick in ((15, 19, -1), (28, 32, 1)):
        frame += [(x, 15) for x in range(x0, x1 + 1)]                 # top bar
        frame += [(x, 19) for x in range(x0 + 1, x1)]                 # lower rim
        out_x = x0 - 1 if flick < 0 else x1 + 1
        in_x = x1 + 1 if flick < 0 else x0 - 1
        frame += [(out_x, 15), (out_x, 16), (out_x, 17), (out_x, 18)]
        frame += [(in_x, 16), (in_x, 17), (in_x, 18)]
        frame += [(out_x + flick, 14), (out_x + flick, 15)]          # the cat-eye flick
    frame += [(21, 16), (22, 16), (25, 16), (26, 16), (23, 17), (24, 17)]  # bridge over the nose
    setpx(n, frame, "red")
    setpx(n, [(15, 15), (16, 15), (28, 15), (29, 15)], "pink")       # lit top-left of each frame
    setpx(n, [(16, 16), (29, 16)], "white")                          # lens glints
    for p in [(13, 20), (12, 22), (12, 24), (13, 26), (14, 28), (34, 20), (35, 22), (35, 24), (34, 26), (33, 28)]:
        if p in n:
            n[p] = "yellow"                                          # the bead chain


def blink(n, cid):
    c = CHARS[cid]
    for x0, y0, x1, y1 in c["eyes"]:
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                if (x, y) in n and n[(x, y)] not in ("red", "pink", "yellow"):
                    n[(x, y)] = c["mask"]
        setpx(n, [(x, c["lid"]) for x in range(x0 + 1, x1)], "fur3")


def idle_frames(cid):
    n = base(cid)
    if cid == "linda":
        linda_extras(n)
    b = dict(n)
    blink(b, cid)
    if cid == "linda":
        linda_extras(b)
        for x0, y0, x1, y1 in CHARS[cid]["eyes"]:
            setpx(b, [(x0 + 1, 16)], None if False else b.get((x0 + 1, 16)))
    return n, b


MOOD_ORDER = ["gary", "linda", "pete", "mange"]      # left to right in the group strips


def mood(kind, cid):
    """One raccoon cut out of a group mood edit (happy / angry), mapped and cleaned."""
    im = load(DL / f"cast_moods_{kind}_v1.png")
    i = MOOD_ORDER.index(cid)
    cell = im.crop((i * 48, 0, (i + 1) * 48, 48))
    n = map_draft(cell, classify_generic())
    if cid == "mange":
        # the edit lost her glasses and bald patch (happy) and gave her a bowler hat (angry):
        # the head top comes back from her idle
        idle = base("mange")
        for (x, y) in [k for k in n if k[1] <= 13]:
            del n[(x, y)]
        for (x, y), v in idle.items():
            if y <= 13:
                n[(x, y)] = v
    n = clean_outline(drop_orphans(n), dark=("ink0", "ink1"))
    if cid == "linda" and kind == "happy":
        linda_extras(n)
    return n


def possum_pose(file):
    n = map_draft(crop_alpha(load(DL / file)), classify_generic())
    return fit(clean_outline(drop_orphans(n), dark=("ink0", "ink1")), 48, 48, "bottom", margin=1)


def possum_dead_joke(n):
    """Playing dead, properly: X eyes, tongue out, two stubby legs straight up."""
    for ex, ey in ((14, 27), (14, 35)):                       # X eyes (the head lies sideways)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                n[(ex + dx, ey + dy)] = "ink0" if abs(dx) == abs(dy) else "fur2"
    setpx(n, [(19, 34), (19, 35), (20, 35), (20, 36)], "pink")  # the tongue
    setpx(n, [(21, 36)], "ink0"); setpx(n, [(18, 34), (18, 35), (19, 36), (20, 37), (21, 35)], "ink0")
    for lx in (26, 33):                                        # legs up in the air
        for y in range(21, 26):
            setpx(n, [(lx, y), (lx + 1, y)], "white" if lx == 26 else "bone")
        setpx(n, [(lx, 20), (lx + 1, 20)], "fur2")             # little paws
        setpx(n, [(lx - 1, y) for y in range(20, 26)] + [(lx + 2, y) for y in range(20, 26)], "ink0")
        setpx(n, [(lx, 19), (lx + 1, 19)], "ink0")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = [("raccoon_gary_idle", frames_of("raccoon_gary_idle"))]
    for cid in ("linda", "pete", "mange"):
        f1, f2 = idle_frames(cid)
        name = f"raccoon_{cid}_idle"
        im = save_final(SLUG, name, [f1, f2], 48, 48, fps=0, anchor=[24, 47])
        names_to_image(f1, 48, 48).save(OUT / f"{cid}_idle_1x.png")
        rows.append((name, [im.crop((0, 0, 48, 48)), im.crop((48, 0, 96, 48))]))
    for cid in MOOD_ORDER:
        frames = []
        for kind in ("happy", "angry"):
            n = mood(kind, cid)
            im = save_final(SLUG, f"raccoon_{cid}_{kind}", [n], 48, 48, fps=0, anchor=[24, 47])
            frames.append(im)
        rows.append((f"raccoon_{cid}_happy / _angry", frames))
    # Inspector Possum, M7 redesign (critic P2-1)
    p_idle = possum.possum_idle_frames()
    im = save_final(SLUG, "possum_idle", p_idle, 48, 48, fps=0, anchor=[24, 47])
    names_to_image(p_idle[0], 48, 48).save(OUT / "possum_idle_1x.png")
    rows.append(("possum_idle", [im.crop((0, 0, 48, 48)), im.crop((48, 0, 96, 48))]))
    rows.append(("possum_dead / possum_shutdown", [
        save_final(SLUG, "possum_dead", [possum_dead.possum_dead()], 48, 48, anchor=[24, 47]),
        save_final(SLUG, "possum_shutdown", [possum.possum_shutdown()], 48, 48, anchor=[24, 47])]))
    save_final(SLUG, "possum_walk", possum_walk.possum_walk_frames(), 32, 32, fps=8, anchor=[16, 31])
    save_final(SLUG, "king_portrait", list(king.king_frames()), 96, 96, fps=2, anchor=[48, 95])
    pack("cast")
    review("cast.png", rows, scale=3, title="cast: dirt + night0 at 3x, 1x at right")


if __name__ == "__main__":
    main()
