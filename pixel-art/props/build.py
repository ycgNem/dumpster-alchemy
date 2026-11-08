"""Props: truck_drive (2), truck_dump (3), dumpster_closed / _open / _rattle (2),
compactor_idle (1) / _crush (3). Run: python3 pixel-art/props/build.py

Inputs (never edited): art-src/dl/props_truck_v1.png, props_dumpster_v1.png. The compactor is
drawn by hand (the draft was too narrow to use).

Truck: 112 x 64, cab faces right, anchor bottom centre [56, 63]. The game parks the anchor at
TRUCK_STOP and throws junk from anchor + TRUCK_BED (-26, -34) = sprite (30, 29): the rear hopper.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "anchor"))
from kit import *  # noqa: E402,F403

SLUG = "props"
TW, TH = 112, 64
BED = (30, 29)          # sprite point where junk leaves (TRUCK_BED from the anchor)


# ---------------------------------------------------------------- the truck

def truck_base():
    over = [(lambda x, y, h, s, v: 10 <= h < 45 and s > 0.45, ["hivis", "sodium2", "sodium3"]),     # lamps, stripe
            (lambda x, y, h, s, v: (h < 10 or h > 340) and s > 0.45, ["red", "rust2"]),               # tail lamps
            (lambda x, y, h, s, v: 160 <= h < 220 and s > 0.15, ["night2", "night3", "blue", "steel3"]),  # glass
            (lambda x, y, h, s, v: x >= 72 and s < 0.13 and v > 0.7, ["steel3", "bone", "white"])]   # white cab
    n = map_draft(load(DL / "props_truck_v1.png"), classify_generic(greys=STEELS, overrides=over))
    # drop the two tall hydraulic arms over the cab-back: headroom for the tipping bed
    for (x, y) in list(n):
        if 56 <= x <= 81 and y < 11:
            del n[(x, y)]
    n = shift_names(n, 0, 6)
    # a hivis band along the body (the truck's stripes), over steel only
    for x in range(16, 71):
        for y in (46, 47):
            if n.get((x, y), "").startswith("steel"):
                n[(x, y)] = "hivis" if y == 46 else "rust3"
    # a sodium headlight up front and the cab's lit top-left edge
    return clean_outline(n)


WHEELS = [(45, 57), (81, 57)]


def hubs(n, turn):
    for cx, cy in WHEELS:
        for dx in range(-2, 3):
            for dy in range(-2, 3):
                if dx * dx + dy * dy <= 5:
                    n[(cx + dx, cy + dy)] = "steel2"
        spokes = [(-2, 0), (2, 0), (0, -2), (0, 2)] if turn == 0 else [(-1, -1), (1, 1), (1, -1), (-1, 1)]
        for dx, dy in spokes:
            n[(cx + dx, cy + dy)] = "steel0"
        n[(cx, cy)] = "steel3"
        n[(cx - 1, cy - 2 if turn == 0 else cy - 1)] = "steel3" if turn == 0 else n[(cx - 1, cy - 1)]


def truck_tipped(base, k):
    """The body (everything left of the cab, above the chassis) sheared up around its
    rear-bottom corner: the front lifts k px per px. A ram fills the gap."""
    body = {p: v for p, v in base.items() if p[0] < 72 and p[1] < 52}
    rest = {p: v for p, v in base.items() if p not in body}
    out = dict(rest)
    for (x, y), v in body.items():
        out[(x, y - round(k * max(0, x - 12)))] = v
    # the hydraulic ram under the lifted front
    lift = round(k * (68 - 12))
    for y in range(52 - lift, 53):
        out[(64, y)] = "steel3"; out[(65, y)] = "steel1"
    return clean_outline(out)


def truck():
    base = truck_base()
    drive = []
    for turn in (0, 1):
        f = dict(base)
        hubs(f, turn)
        drive.append(f)
    dump = []
    for k in (0.0, 0.08, 0.16):
        f = truck_tipped(base, k) if k else dict(base)
        hubs(f, 0)
        if k >= 0.16:
            # the rear hatch swings open: a dark mouth where the junk comes out
            for y in range(BED[1] - 2, BED[1] + 6):
                for x in range(13, 17):
                    if f.get((x, y)) not in (None, "ink0"):
                        f[(x, y)] = "ink1"
        dump.append(f)
    return drive, dump


# ---------------------------------------------------------------- the Dumpster (rust body, dark plastic lid)

def dumpster_parts():
    im = shift_img = load(DL / "props_dumpster_v1.png")
    def cls(x, y, hsv_, p):
        h, s, v = hsv_
        if v < 0.1:
            return "ink0"
        if 70 <= h < 170 and s > 0.2:
            return "grime2" if v > 0.4 else "grime1"          # mould spots
        if y <= 10:                                           # the lid: dark plastic
            return by_value(["ink1", "ink2", "night1", "night2", "night3"], v, [0.2, 0.3, 0.42, 0.6])
        return by_value(["rust0", "rust1", "rust2", "rust3", "sodium2"], v, [0.2, 0.36, 0.55, 0.78])
    n = shift_names(map_draft(im, cls), 0, 3)
    lid = {k: v for k, v in n.items() if k[1] <= 13}
    body = {k: v for k, v in n.items() if k[1] > 13}
    for (x, y), v in list(body.items()):                      # the streetlight on the rim's lit end
        if y in (16, 17) and x < 22 and v in ("rust3", "rust2"):
            body[(x, y)] = "sodium2" if y == 16 else "rust3"
    return lid, body


def dumpster():
    lid, body = dumpster_parts()
    closed = clean_outline({**body, **lid})
    # open: the lid stands up behind the rim; a dark mouth with a stink glow
    opened = dict(body)
    for y in range(0, 14):                                # the lid swung back: its underside,
        t_ = y / 13                                       # narrower at the far (top) edge
        x0, x1 = round(12 - 5 * t_), round(35 + 5 * t_)
        for x in range(x0, x1 + 1):
            edge = x in (x0, x1) or y == 0
            opened[(x, y)] = "ink0" if edge else ("ink2" if y > 9 else "night1")
        if 2 <= y <= 11:
            for rx in (round(18 - 2 * t_), round(29 + 2 * t_)):
                opened[(rx, y)] = "night2"                # ribs
    for x in range(13, 24):
        opened[(x, 1)] = "night3"                         # lit top edge of the raised lid
    for x in range(6, 42):
        for y in (14, 15):
            if (x, y) in opened:
                opened[(x, y)] = "ink0" if y == 14 else "ink1"
    for p in [(18, 15), (19, 15), (29, 15)]:
        opened[p] = "toxic2"
    opened = clean_outline(opened)
    # rattle: the lid ajar, a gap of glow, tilted differently on each frame
    rattle = []
    for tilt in (0, 1):
        f = dict(body)
        for (x, y), v in lid.items():
            dy = -2 if (x < 24) == (tilt == 0) else -1
            f[(x, y + dy)] = v
        for x in range(6, 42):
            gy = 13 if (x < 24) == (tilt == 0) else 13
            if (x, gy) not in lid or True:
                if (x, gy) in f and f[(x, gy)] in ("ink0",) or (x, gy) not in f:
                    f[(x, gy)] = "ink1"
        for p in [(14, 13), (15, 13), (30, 13)]:
            f[p] = "toxic3" if tilt == 0 else "toxic2"
        rattle.append(clean_outline(f))
    return [closed], [opened], rattle


# ---------------------------------------------------------------- the Compactor (by hand)

def compactor_frame(plate_y, squish=0):
    s = new_sprite(48, 48)
    # the chamber: a steel box with a hazard-striped lip
    s.rect(5, 30, 42, 46, C["steel1"])
    s.rect(5, 30, 42, 31, C["steel2"])
    s.rect(8, 33, 39, 44, C["ink2"])                   # the open mouth, in violet shadow
    for x in range(5, 43):                             # hazard stripes on the lip
        s.px(x, 30, C["yellow"] if (x // 3) % 2 == 0 else C["ink1"])
        s.px(x, 31, C["yellow"] if ((x + 1) // 3) % 2 == 0 else C["ink1"])
    for y in range(32, 47):
        s.px(5, y, C["steel2"])
    s.rect(42, 31, 42, 46, C["steel0"])
    s.rect(8, 9, 39, 29, C["steel0"])                  # back panel, so it reads as one machine
    for x in (12, 35):
        s.rect(x, 10, x, 29, C["ink2"])                # guide rails
    # the frame: two columns and a top beam
    for x0 in (3, 40):
        s.rect(x0, 5, x0 + 4, 46, C["steel1"])
        s.rect(x0, 5, x0, 46, C["steel2"])
    s.rect(3, 5, 4, 46, C["steel2"])
    s.rect(3, 3, 44, 9, C["steel1"])
    s.rect(3, 3, 44, 4, C["steel2"])
    s.rect(3, 3, 20, 3, C["steel3"])                   # lit top edge
    s.px(3, 3, C["sodium3"]); s.px(4, 3, C["sodium3"])
    for x in (8, 20, 28, 39):                          # rivets
        s.px(x, 6, C["steel3"])
    # the warning lamp
    s.rect(22, 0, 25, 2, C["red"])
    s.px(22, 0, C["pink"])
    # the piston and the press plate
    s.rect(22, 10, 25, plate_y - 1, C["steel3"])
    s.rect(25, 10, 25, plate_y - 1, C["steel1"])
    s.rect(9, plate_y, 38, plate_y + 5, C["rust2"])
    s.rect(9, plate_y, 38, plate_y, C["rust3"])
    s.rect(9, plate_y + 5, 38, plate_y + 5, C["rust1"])
    for x in range(11, 37, 4):
        s.px(x, plate_y + 2, C["rust1"])               # bolt row
    s.px(10, plate_y + 1, C["sodium3"])
    if squish:
        # junk squeezed out at the sides of the plate
        for x, y, c in [(8, plate_y + 6, "grime2"), (39, plate_y + 6, "rust3"), (7, plate_y + 5, "toxic2"),
                        (40, plate_y + 5, "grime3"), (9, plate_y + 7, "card2")]:
            s.px(x, y, C[c])
    s.outline(C["ink0"], where="outside")
    return image_to_names(s.composite(1))


def compactor():
    idle = [compactor_frame(12)]
    crush = [compactor_frame(19), compactor_frame(26, squish=1), compactor_frame(19)]
    return idle, crush


def main():
    drive, dump = truck()
    save_final(SLUG, "truck_drive", drive, TW, TH, fps=8, anchor=[56, 63])
    save_final(SLUG, "truck_dump", dump, TW, TH, fps=0, anchor=[56, 63])
    closed, opened, rattle = dumpster()
    save_final(SLUG, "dumpster_closed", closed, 48, 48, anchor=[24, 47])
    save_final(SLUG, "dumpster_open", opened, 48, 48, anchor=[24, 47])
    save_final(SLUG, "dumpster_rattle", rattle, 48, 48, fps=10, anchor=[24, 47])
    idle, crush = compactor()
    save_final(SLUG, "compactor_idle", idle, 48, 48, anchor=[24, 47])
    save_final(SLUG, "compactor_crush", crush, 48, 48, fps=0, anchor=[24, 47])
    pack("props")
    rows = [(n, frames_of(n)) for n in ("truck_drive", "truck_dump")]
    # mark the bed point on a copy so the review shows where junk leaves
    marked = []
    for f in frames_of("truck_dump"):
        g = f.copy()
        g.putpixel(BED, RGB["toxic3"] + (255,))
        marked.append(g)
    rows.append(("truck_dump with TRUCK_BED marked (toxic px)", marked))
    review("props_truck.png", rows, scale=3, title="truck: dirt + night0 at 3x, 1x at right")
    rows = [(n, frames_of(n)) for n in ("dumpster_closed", "dumpster_open", "dumpster_rattle", "compactor_idle", "compactor_crush")]
    review("props.png", rows, scale=4, title="Dumpster + Compactor: dirt + night0 at 4x, 1x at right")


if __name__ == "__main__":
    main()
