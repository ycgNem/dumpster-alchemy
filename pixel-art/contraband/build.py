"""The 25 Contraband icons (docs/V2.md, pillar 3): public/art/contraband.png + .json, review sheet
art-src/review/v2/contraband.png. Run: python3 pixel-art/contraband/build.py

Each is a 24 x 24 sticker: an ink0 die-cut edge, a 2 px rarity rim (steel = common, blue =
uncommon, gold = rare, the rare one with a sparkle), a dark ink2 field, a peeled corner at the
bottom-right showing the bone backing, and a ~16 px icon drawn here by hand (string bitmaps, one
character per palette name, see v2kit.KEY). Icons get the 1 px ink0 outline; steam, stink and
sparkle (the `fx` layer) stay unoutlined. Anchor [12, 12]: the centre (they're UI icons).
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "recipes"))
from v2kit import *  # noqa: E402,F403

W = H = 24

RIMS = {
    "common": ("steel3", "steel2", "steel1"),
    "uncommon": ("white", "blue", "night3"),
    "rare": ("sodium3", "yellow", "sodium2"),
}

# id -> rarity, in the V2 table's order
PERKS = [
    ("compost", "uncommon"), ("mafia", "common"), ("hotsauce", "uncommon"), ("pyramid", "common"),
    ("bribe", "rare"), ("doublebag", "common"), ("whisperer", "common"), ("junkie", "uncommon"),
    ("chaingang", "rare"), ("streaker", "uncommon"), ("apron", "rare"), ("sticky", "common"),
    ("crusherpro", "common"), ("freshener", "common"), ("owl", "common"), ("spender", "uncommon"),
    ("snack", "common"), ("goose", "rare"), ("flyfarm", "uncommon"), ("clearance", "common"),
    ("recycler", "common"), ("junkmail", "uncommon"), ("ratrace", "uncommon"), ("recipecard", "common"),
    ("biglid", "common"),
]


# ---------------------------------------------------------------- the sticker

def inside(x, y, x0=0, y0=0, x1=23, y1=23, r=3):
    """Inside a rounded rect (corner radius r)."""
    if not (x0 <= x <= x1 and y0 <= y <= y1):
        return False
    for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
        if (x < x0 + r or x > x1 - r) and (y < y0 + r or y > y1 - r):
            if (abs(x - cx) == r or abs(y - cy) == r) and math.hypot(x - cx, y - cy) > r + 0.2:
                return False
            if math.hypot(x - cx, y - cy) > r + 0.5:
                return False
    return True


PEEL = 40          # x + y beyond this is peeled back


def sticker(rarity):
    lit, mid, dark = RIMS[rarity]
    n = {}
    for y in range(H):
        for x in range(W):
            if not inside(x, y) or x + y > PEEL + 1:
                continue
            edge = not all(inside(x + dx, y + dy) and x + dx + y + dy <= PEEL + 1
                           for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge:
                n[(x, y)] = "ink0"
            elif inside(x, y, 3, 3, 20, 20, 1) and x + y <= PEEL - 3:
                n[(x, y)] = "ink2"
            else:
                # the rim: lit on the top and left, shade on the bottom and right
                if y <= 2 and x <= 20 or x <= 2 and y <= 20:
                    n[(x, y)] = lit if (y == 1 or x == 1) else mid
                elif y >= 21 or x >= 21:
                    n[(x, y)] = dark if (y == 22 or x == 22) else mid
                else:
                    n[(x, y)] = mid
    # the field's inner shadow under the rim (top and left), and a little texture
    for y in range(3, 21):
        for x in range(3, 21):
            if n.get((x, y)) == "ink2" and (n.get((x - 1, y)) not in ("ink2", "ink1") or
                                            n.get((x, y - 1)) not in ("ink2", "ink1")):
                n[(x, y)] = "ink1"
    for (x, y) in ((6, 17), (16, 5), (11, 14), (18, 11), (4, 9)):
        if n.get((x, y)) == "ink2":
            n[(x, y)] = "ink1"
    # the inner line between rim and field on the peel diagonal
    for y in range(H):
        for x in range(W):
            if x + y == PEEL - 2 and n.get((x, y)) == "ink2":
                n[(x, y)] = "ink1"
    # the peeled corner: a bone flap folded back over the corner
    for y in range(H):
        for x in range(W):
            s_ = x + y
            if PEEL - 3 <= s_ <= PEEL + 1 and x >= 17 and y >= 17:
                if s_ == PEEL - 3:
                    n[(x, y)] = "ink0"
                elif s_ == PEEL + 1:
                    n[(x, y)] = "ink0"
                else:
                    n[(x, y)] = "bone" if s_ < PEEL else "fur3"
    for p in [(18, 22), (22, 18)]:
        n[p] = "ink0"
    if rarity == "rare":
        n[(1, 1)] = "white"
        n[(2, 1)] = "sodium3"; n[(1, 2)] = "sodium3"
    if rarity == "uncommon":
        n[(2, 1)] = "white"
    return n


# ---------------------------------------------------------------- the icons (16 x 16 each)

def layer(rows, x0=0, y0=0):
    return bmp({}, x0, y0, rows)


ICONS = {}


def icon(fn):
    ICONS[fn.__name__] = fn
    return fn


@icon
def compost():
    heap = layer([
        "................",
        "................",
        "................",
        "................",
        "................",
        "......FF........",
        ".....FFffF......",
        "....FfjjffEf....",
        "...FffjGjjffE...",
        "..FffjppppfjfE..",
        ".FfjfpfffpffjfE.",
        ".FfGffffjfffGfE.",
        "FffffGffffjfffEE",
        "EEfEEEEEfEEEEEEE",
    ])
    recolor(heap, {"dirt3": "card2", "dirt2": "card1", "dirt1": "card0", "grime2": "grime3", "grime1": "grime2"})
    heap[(6, 5)] = "card3"; heap[(5, 6)] = "card3"; heap[(4, 7)] = "card3"
    fx = layer([
        "....J.....J.....",
        "...J.....J......",
        "....J.....J.....",
        "...J.....J......",
    ])
    return [heap], fx


@icon
def mafia():
    hat = layer([
        "................",
        "................",
        "......NNNN......",
        "....NMMNNmmN....",
        "....NMmmNmmmN...",
        "...NMmmmmmmmmN..",
        "...NMmmmmmmmmN..",
        "...pRRRRRRRRRQ..",
        "...RRRRRRRRRRQ..",
        ".NMMmmmmmmmmmmN.",
        "NMmmmmmmmmmmmmmN",
        ".NNNNNNNNNNNNNN.",
    ])
    recolor(hat, {"night1": "fur1", "night3": "fur3", "night2": "fur2"})
    cigar = layer([
        "........DddddhS",
        "........CCCCCo.",
    ], 0, 13)
    fx = layer([".....b", "....b.", ".....b"], 9, 0)
    fx = {}
    for p in [(15, 11), (14, 10), (15, 9)]:
        fx[p] = "fur3"
    return [hat, cigar], fx


@icon
def hotsauce():
    bottle = layer([
        ".....vvU........",
        ".....VvU........",
        ".....UUu........",
        "......RQ........",
        "......RQ........",
        ".....pRRQ.......",
        "....pRRRRQ......",
        "....pRRRRQ......",
        "....bbbbbQ......",
        "....bhYhbQ......",
        "....bYhYbQ......",
        "....bbbbbQ......",
        "....pRRRRQ......",
        "....RRRRRQ......",
        ".....QQQQ.......",
    ], 0, 1)
    bolt = layer([
        "....Y",
        "...YY",
        "..YY.",
        ".YYYY",
        "...YY",
        "..YY.",
        "..Y..",
    ], 10, 3)
    return [bottle, bolt], {}


def cap4(n, x, y, gold=False):
    rows = ["pRRq", "RRRq", "qQqQ"]
    if gold:
        rows = [r.translate(str.maketrans("pRqQ", "SYso")) for r in rows]
    bmp(n, x, y, rows)


@icon
def pyramid():
    n = {}
    rect(n, 1, 3, 14, 14, None)
    # the ink between the caps, so they stay separate
    for (x0, y0, x1, y1) in ((5, 3, 10, 6), (2, 7, 13, 10), (0, 11, 15, 14)):
        rect(n, x0, y0, x1, y1, "ink1")
    cap4(n, 6, 3, gold=True)
    cap4(n, 3, 7); cap4(n, 8, 7)
    cap4(n, 1, 11); cap4(n, 6, 11); cap4(n, 11, 11)
    for (x, y) in ((5, 3), (10, 3), (5, 6), (10, 6), (2, 7), (13, 7), (0, 11), (15, 11), (2, 10), (13, 10)):
        n.pop((x, y), None)
    fx = layer(["..S..", ".SwS.", "..S.."], 6, 0)
    return [n], fx


@icon
def bribe():
    bills = layer([
        "....vvvv........",
        "...vVvvUv.vvv...",
        "...vvuvvUvVvvU..",
        "...vvvvvUvvuvU..",
    ], 0, 1)
    env = layer([
        ".bbbbbbbbbbbbbb.",
        ".b3bbbbbbbbbb3b.",
        ".bb3bbbbbbbb3bb.",
        ".bbb3bbbbbb3bbb.",
        ".bbbb3bbbb3bbbb.",
        ".bbbbb3RR3bbbbb.",
        ".bbbbbbRRbbbbbb.",
        ".b4bbbbbbbbbb4b.",
        ".44444444444444.",
    ], 0, 5)
    return [bills, env], {}


def bag_rows(dark=False):
    rows = [
        "....jj....",
        "...jJJj...",
        "....jj....",
        "...jJJjj..",
        "..jJJJjjj.",
        ".jJJjjjjjG",
        ".jJjjjjjjG",
        "jjjjjjjjjG",
        "jjjjjjjjGG",
        "jjjjjjjGGG",
        ".GGGGGGGG.",
    ]
    if dark:
        rows = [r.translate(str.maketrans("JjG", "jGg")) for r in rows]
    return rows


@icon
def doublebag():
    back = layer(bag_rows(), 6, 1)
    front = layer(bag_rows(), 0, 4)
    for (x, y), c in list(front.items()):
        if c != "grime1" and ((x - 1, y) not in front or (x, y - 1) not in front):
            front[(x, y)] = "grime3"
    front[(2, 9)] = "bone"
    return [back, front], {}


@icon
def whisperer():
    head = layer([
        ".....wwww.......",
        "....wwwwwb......",
        "...wwwwwwwb.....",
        "...wwwww#wwb....",
        "..wwwwwwwwwYYY..",
        "..wwwwwwwwYYRYY.",
        "..bwwwwwwwwYYY..",
        "..bwwwwwwwb.....",
        "..tbwwwwwwb.....",
        ".ttbbwwwwwb.....",
        ".tttbbwwwb......",
    ], 0, 5)
    heart = layer([".p.p.", "ppppp", "ppppp", ".ppp.", "..p.."], 0, 0)
    heart[(1, 1)] = "white"
    return [head, heart], {}


@icon
def junkie():
    cup = layer([
        "....wwwwwwww....",
        "...bwwwwwwwwb...",
        "...TTTTTTTTTT...",
        "....bbbbbbbb....",
        "....wbbbbbb4....",
        "....CddddddC....",
        "....ChhhhhhC....",
        "....CddddddC....",
        ".....wbbbb4.....",
        ".....wbbbb4.....",
        ".....4bbbb4.....",
        "......4444......",
    ], 0, 4)
    fx = layer([
        ".....3...3......",
        "......3...3.....",
        ".....3...3......",
    ])
    for p in [(1, 8), (2, 9), (1, 12), (14, 8), (13, 9), (14, 12)]:
        fx[p] = "sodium3"
    return [cup], fx


def ring(n, cx, cy, rx, ry, t, lit="steel3", mid="steel2", dark="steel1"):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            di = ((x - cx) / max(rx - t, 0.5)) ** 2 + ((y - cy) / max(ry - t, 0.5)) ** 2
            if d <= 1 and di > 1:
                n[(x, y)] = lit if (x - cx) + (y - cy) < -1.5 else dark if (x - cx) + (y - cy) > 1.5 else mid


@icon
def chaingang():
    a, b, c = {}, {}, {}
    ring(a, 3.5, 11.5, 3.6, 2.6, 1.6)
    ring(b, 7.5, 7.5, 2.6, 3.6, 1.6)
    ring(c, 11.5, 3.5, 3.6, 2.6, 1.6)
    d = {}
    ring(d, 13.5, 12.0, 2.4, 2.4, 2.4, "fur2", "fur1", "ink1")      # the ball
    d[(12, 11)] = "fur3"
    line(d, 6, 13, 11, 12, "steel1")
    return [d, a, c, b], {}


@icon
def streaker():
    shoe = layer([
        ".....RRRR.......",
        ".....RwwR.......",
        ".....RwwRRR.....",
        "....RRwwwwRRR...",
        "....RwwRwwwwwRR.",
        "....RRRRRRRRRRRR",
        "....bbbbbbbbbbbb",
        ".....4444444444.",
    ], 0, 6)
    shoe[(6, 7)] = "white"
    fx = {}
    for y, x0, x1 in ((7, 0, 3), (9, 1, 3), (11, 0, 3), (13, 1, 3)):
        for x in range(x0, x1 + 1):
            fx[(x, y)] = "bone"
    for p in [(12, 2), (14, 4), (10, 3)]:
        fx[p] = "ink0"                       # a fly or three keeping up
    return [shoe], fx


@icon
def apron():
    ap = layer([
        "......bb........",
        ".....bwwb.......",
        ".....bwwb.......",
        "....bwwwwb......",
        ".KK.bwwwwb.KK...",
        "....bwwwwbb.....",
        "...bwwwwwwwb....",
        "...bwwbbbbwwb...",
        "..bwwwbvvbwwb...",
        "..bwwwbbbbwww3..",
        "..bwwwwwwwww3...",
        "..3333333333....",
    ], 1, 3)
    for (x, y), c in list(ap.items()):
        if c == "white" and x % 3 == 0:
            ap[(x, y)] = "blue"
        elif c == "bone":
            ap[(x, y)] = "night3"
    straps = {}
    for p in [(5, 0), (5, 1), (6, 2), (10, 0), (10, 1), (9, 2)]:
        straps[p] = "ink1"
    fx = layer([".v.", "vVv", ".v."], 12, 0)
    fx.update(layer(["v", ], 14, 4))
    fx[(13, 3)] = "toxic3"
    return [straps, ap], fx


@icon
def sticky():
    paw = layer([
        "..33.33.33.33...",
        "..32.32.32.32...",
        "..32.32.32.32...",
        "..3222222222221.",
        "332222222222221.",
        "322222222222221.",
        ".32222222222211.",
        "..322222222221..",
        "..322222222221..",
        "...3222222221...",
        "....32222221....",
        ".....222211.....",
        ".....222211.....",
    ], 0, 0)
    coin = layer([".SYYY.", "SYYYYs", "YYwYYs", "YYYYYs", ".ssso."], 5, 4)
    goo = {(4, 13): "sodium2", (4, 14): "sodium3", (11, 13): "sodium2", (11, 14): "sodium2", (11, 15): "sodium3",
           (2, 3): "sodium2", (12, 3): "sodium3"}
    return [paw, coin], goo


@icon
def crusherpro():
    n = layer([
        "hhKKhhKKhhKKhhKK",
        "KhhKKhhKKhhKKhhK",
        "ll............ll",
        "ll.....TT.....ll",
        "ll.....Tt.....ll",
        "ll.....Tt.....ll",
        "llTTTTTTTTTTttll",
        "llttttttttttttll",
        "ll............ll",
        "ll............ll",
        "ll............ll",
        "ll..BBwBBBBm..ll",
        "ll..mmmmmmmm..ll",
        "LLLLLLLLLLLLLLLL",
    ], 0, 1)
    return [n], {}


@icon
def freshener():
    tree = layer([
        ".......v........",
        "......vVv.......",
        ".....vVvvv......",
        "......vvU.......",
        ".....vVvvU......",
        "....vVvvvvU.....",
        ".....vvvUU......",
        "....vVvvvvU.....",
        "...vVvvvvvvU....",
        "..vVvvvvvvvvU...",
        ".UUUUUUUUUUUUU..",
        "......dd........",
        "......dC........",
    ], 0, 3)
    string = {(7, 0): "ink1", (7, 1): "ink1", (7, 2): "ink1"}
    fx = {(12, 2): "white", (11, 3): "toxic3", (13, 3): "toxic3", (12, 4): "toxic3"}
    return [string, tree], fx


@icon
def owl():
    n = layer([
        "..C.........C...",
        "..CC.......CC...",
        "..CdCCCCCCCdC...",
        ".CdddddddddddC..",
        ".dbYYYbddbYYYb..",
        ".bYY#YYbbYY#YYb.",
        ".bY###YbbY###Yb.",
        ".bYY#YYbbYY#YYb.",
        ".dbYYYbdsbYYYbd.",
        ".CddddddsdddddC.",
        ".CdDdDdddDdDdC..",
        "..CdDdDdDdDdC...",
        "..CCdddddddCC...",
        "...ss.....ss....",
    ], 0, 1)
    n[(4, 6)] = "white"
    n[(10, 6)] = "white"
    return [n], {}


@icon
def spender():
    card = layer([
        "SSSSSSSSSSSSSS",
        "SYYYYYYYYYYYYs",
        "SYTTtYYYYYYYYs",
        "SYttlYYYYYYYYs",
        "SYYYYYYYYYYYYs",
        "SYoYoYoYYoYoYs",
        "SYYYYYYYYYYYYs",
        "SYooooYYYYYYYs",
        "ssssssssssssss",
    ], 1, 4)
    fx = {(13, 1): "white", (12, 2): "sodium3", (14, 2): "sodium3", (13, 3): "sodium3", (13, 0): "sodium3"}
    return [card], fx


@icon
def snack():
    n = {}
    poly(n, [(3, 6), (14, 6), (8, 15)], "yellow")
    for x in range(2, 16):
        n[(x, 5)] = "card2"
        n[(x, 6)] = "card1" if x > 12 else "card2"
    for x in range(3, 14):
        n[(x, 4)] = "card3"
    for p in [(5, 8), (6, 8), (5, 9), (10, 8), (11, 8), (10, 9), (8, 11), (9, 11), (8, 12)]:
        n[p] = "red"
    for (x, y) in list(n):
        if n[(x, y)] == "yellow" and (x + 1, y) not in n:
            n[(x, y)] = "sodium2"
    for p in [(5, 7), (4, 7)]:
        n[p] = "sodium3"
    # a bite out of the corner
    for p in [(14, 4), (15, 5), (14, 5), (13, 4), (15, 6), (14, 6)]:
        n.pop(p, None)
    moon = layer([".bbb", "bb..", "b...", "bb..", ".bbb"], 0, 0)
    fx = {(5, 1): "bone", (13, 1): "night3"}
    return [n, moon], fx


@icon
def goose():
    n = {}
    ell(n, 8.0, 8.8, 5.6, 6.8, "yellow")
    for (x, y) in list(n):
        if (x - 8) + (y - 9) > 4:
            n[(x, y)] = "sodium2"
        if (x - 8) + (y - 9) > 8:
            n[(x, y)] = "sodium1"
        if (x - 6) ** 2 + (y - 5) ** 2 < 5:
            n[(x, y)] = "sodium3"
    n[(5, 4)] = "white"; n[(6, 4)] = "white"; n[(5, 5)] = "white"
    fx = {}
    for cx, cy, big in ((14, 3, True), (1, 12, False), (14, 13, False)):
        fx[(cx, cy)] = "white" if big else "sodium3"
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            fx[(cx + dx, cy + dy)] = "sodium3"
    return [n], fx


@icon
def flyfarm():
    heap = layer([
        ".....GjjG.......",
        "...GjJjjjjG.....",
        "..GjjjGjjjjjG...",
        ".GjjJjjjjGjjjG..",
        "GGGGGGGGGGGGGGG.",
    ], 0, 11)
    fly = layer([
        "..bbb..bbb.",
        ".bwwwbbwwwb",
        ".bwwwwbwwwb",
        "..bbbKKbbb.",
        "....RKKR...",
        "...KkkkkK..",
        "...kkKkkk..",
        "...KkkkkK..",
        "....kkkk...",
    ], 2, 1)
    fx = {(1, 2): "ink0", (14, 6): "ink0", (13, 1): "ink0", (15, 9): "grime3", (14, 10): "grime3"}
    return [heap, fly], fx


@icon
def clearance():
    tag = layer([
        ".....dddddddddd",
        "....dDDDDDDDDDDd",
        "...dDDDDDDDDDDDd",
        "..dDD.DDRDDDDRDd",
        "..dDDDDDDDDRDDDd",
        "...dDDDDDDRDDDDd",
        "....dDDDDRDDDDDd",
        ".....dDDRDDDRDDd",
        "......ddddddddd.",
    ], 0, 5)
    tag[(5, 8)] = "ink1"
    string = {}
    for p in [(5, 7), (4, 6), (3, 5), (3, 4), (2, 3), (2, 2), (1, 1)]:
        string[p] = "ink1"
    return [string, tag], {}


@icon
def recycler():
    n = {}
    for y in range(16):
        for x in range(16):
            d = math.hypot(x - 7.5, y - 7.5)
            a = math.degrees(math.atan2(y - 7.5, x - 7.5)) % 360
            if 5.0 <= d <= 7.4 and not (300 <= a <= 340) and not (120 <= a <= 160):
                n[(x, y)] = "toxic2" if (x + y) < 13 else "toxic1"
    # arrowheads at the two gaps
    bmp(n, 11, 0, ["vv..", "vvvv", ".vv."])
    bmp(n, 1, 12, [".UU.", "UUUU", "..UU"])
    can = layer(MINI_CAN_SMALL, 6, 5)
    return [n, can], {}


MINI_CAN_SMALL = [
    "TTt",
    "wBm",
    "wbm",
    "BBm",
    "ttl",
]


@icon
def junkmail():
    env = layer([
        "bbbbbbbbbbbbbb",
        "b3bbbbbbbbbb3b",
        "bb3bbbbbbbb3bb",
        "bbb3bbbbbb3bbb",
        "bbbb3bbbb3bbbb",
        "bbbbb3333bbbbb",
        "bbbbbbbbbbbbbb",
        "44444444444444",
    ], 0, 2)
    no = {}
    ring(no, 11.5, 11.5, 4.4, 4.4, 1.6, "red", "red", "rust2")
    cap = layer(["pRq", "qQq"], 10, 10)
    for i in range(-2, 3):
        no[(11 + i, 11 - i)] = "red"
    return [env, cap, no], {}


@icon
def ratrace():
    wheel = {}
    ring(wheel, 8.0, 7.0, 7.0, 7.0, 1.6)
    for a in range(0, 360, 60):
        for r in range(1, 6):
            x = round(8 + r * math.cos(math.radians(a)))
            y = round(7 + r * math.sin(math.radians(a)))
            wheel[(x, y)] = "steel1"
    stand = layer(["..l.......l..", ".ll.......ll.", "LLLLLLLLLLLLL"], 2, 13)
    rat = layer([
        ".....p4..",
        "..3333334.",
        ".33333#33p",
        ".2333333..",
        "..p.p..p..",
    ], 3, 7)
    tail = {(3, 10): "pink", (2, 9): "pink", (2, 8): "pink"}
    fx = {(14, 1): "blue", (15, 2): "blue"}
    return [stand, wheel, tail, rat], fx


@icon
def recipecard():
    card = layer([
        "bbbbbbbbbbbbbb",
        "bRRRRRRRRRRRRb",
        "bbbbbbbbbbbbbb",
        "b3333333bbbbbb",
        "bbbbbbbbbbbbbb",
        "b33333333333bb",
        "bbbbbbbbbbbbbb",
        "b3333333bbbbbb",
        "bbbbbbbbbbpbpb",
        "bbbbbbbbbbpppb",
        "44444444444p44",
    ], 1, 4)
    fx = layer([".v.", "vVv", ".v."], 12, 0)
    fx[(10, 2)] = "toxic2"
    return [card], fx


@icon
def biglid():
    bin_ = layer([
        "..qqqqqqqqqqq...",
        "..rqqqqqqqqqQ...",
        "..rqQqqqqQqqQ...",
        "..rqQqqqqQqqQ...",
        "...qQqqqqQqQ....",
        "...QQQQQQQQQ....",
        "...K.......K....",
    ], 0, 9)
    lid = layer([
        "......NNNN......",
        "....NNmmmmNN....",
        "..NNmmmmmmmmNN..",
        "NNmmmmmmmmmmmmNN",
        "kkkkkkkkkkkkkkkk",
    ], 0, 3)
    lid[(4, 4)] = "night3"; lid[(5, 4)] = "night3"; lid[(3, 5)] = "night3"
    fx = layer(["..v..", "..v..", "vvVvv", "..v..", "..v.."], 11, 0)
    fx = {(x, y): ("toxic3" if (x, y) == (13, 2) else c) for (x, y), c in fx.items()}
    return [bin_, lid], fx


# ---------------------------------------------------------------- build

def draw_icon(pid):
    layers, fx = ICONS[pid]()
    out = {}
    for L in layers:
        L = clean_outline(L)
        out.update(L)
    for p, c in fx.items():
        if p not in out:
            out[p] = c
    return out


def perk(pid, rarity):
    n = sticker(rarity)
    for (x, y), c in draw_icon(pid).items():
        X, Y = x + 4, y + 4
        if inside(X, Y, 1, 1, 22, 22, 2) and X + Y <= PEEL - 3:
            n[(X, Y)] = c
    return clip(n, W, H)


def main():
    entries, rows = [], []
    for i, (pid, rarity) in enumerate(PERKS):
        f = perk(pid, rarity)
        entries.append((f"perk_{pid}", [f], {"w": W, "h": H, "fps": 0, "anchor": [12, 12], "rarity": rarity}))
        rows.append((f"{pid} ({rarity[0].upper()})", [names_to_image(f, W, H)]))
    pack_family("contraband", entries)
    review_v2("contraband.png", rows, scale=3, cols=5,
              title="contraband: 25 stickers, rim = rarity (steel common, blue uncommon, gold rare); 3x then 1x")
    # and on the cardboard, where the shop shows them
    sheet = Image.new("RGBA", (len(entries) * 26 + 4, 28), RGB["card1"] + (255,))
    for i, (_, (f,), _) in enumerate(entries):
        sheet.alpha_composite(names_to_image(f, W, H), (4 + i * 26, 2))
    big = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST)
    big.save(REVIEW_V2 / "contraband_on_card_2x.png")


if __name__ == "__main__":
    main()
