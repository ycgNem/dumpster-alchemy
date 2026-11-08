# Dumpster Alchemy — Style

**The look in one line:** a landfill at night under one orange sodium streetlight. The junk is
chunky, saturated and lit warm. The night around it is cool violet. The UI is cardboard, marker
and duct tape.

## Rules

- **Junk is the bright thing.** The board (dirt, ruts) is low-chroma and mid-dark. The backdrop
  (fence, heaps, sky) is cool and dim. Items, raccoons and gulls carry the saturated colour.
- **Light**: the streetlight, warm, from the **top-left**. Shadows lean violet, lights lean
  yellow (hue-shifted ramps).
- **Outline**: a 1 px outline in `ink0` (violet-black) on every item, character and prop.
  Selective outlining is fine where a lit edge meets the ground.
- **Every pixel snaps to the palette** (`src/data/palette.ts` is the source of truth;
  `pixel-art/pal.py` reads it). No semi-transparent pixels in sprites; fades are done by code.
- **Gross, not grim.** Stains, drips and flies, yes. Nothing that reads as real filth or gore.
  Raccoons are cute, a bit greedy, and deeply serious about trash.
- **Silhouette first.** At 1x you must tell every tier apart by shape alone. Colour is the second
  cue, the tier number never shows in final art.
- Integer zoom inside the game (sprites, text and popups only ever scale by whole numbers);
  `imageSmoothingEnabled = false` everywhere.
- **Screen scale** (`src/engine/screen.ts`, v2): the 640 × 360 stage sits centred in a buffer
  that takes the window's shape (wider windows get more width, 16:10 and 4:3 more height), blown
  up by the fractional fit scale, nearest-neighbour. No bars, nothing cropped; a little pixel
  unevenness is accepted. The margins show more of the scene (the backdrops are wide panoramas)
  and full-screen fills cover the whole buffer (`viewRect()`). A phone held upright shows a
  "turn your phone" card instead.

## Sizes

| Thing | Size | Notes |
|---|---|---|
| Screen | 640 × 360 logical stage | fit scale in a window-shaped buffer, no bars (see Rules) |
| Board cell | 32 × 32 | 9 × 7 cells = 288 × 224 |
| Items (junk, gulls, eggs) | 32 × 32 canvas, ~28 × 28 drawn | room for the wobble and the outline |
| Raccoon portraits | 48 × 48 | 2 frames: idle and blink; plus happy and angry |
| Inspector Possum | 48 × 48 | plus a "playing dead" frame |
| The Truck | 112 × 64 | wheels and the reverse light animate |
| The Dumpster | 48 × 48 | lid closed, open, rattling |
| UI icons | 16 × 16 | Shinies, stink, clock, lid charge |
| Backdrop | 960 × 640 panorama, stage at 160,140 | one per scene (Lot 9, the Marina, Mount Trashmore); parallax not needed |

## Palette (first pass, 2026-11-07)

Named ramps in `src/data/palette.ts`, dark to light:

| Ramp | Use |
|---|---|
| `ink0-2` | outlines, the darkest night, shadows under items |
| `night0-3` | the sky, the fence, far heaps |
| `sodium0-3` | the streetlight's pool, lit edges, the Truck's lamps |
| `dirt0-3` | the board, ruts, mud |
| `grime0-3` | garbage bags, mould, stink puffs |
| `rust0-3` | cans, the Dumpster, the car, the cart's rust |
| `steel0-3` | cans, the toaster, the fridge, the cart |
| `fur0-4` | raccoons, the possum (`fur4` for muzzles and brows; `fur0` sits close to `ink1`, use either) |
| `card0-3` | cardboard UI, the takeout box |
| `toxic0-3` | Bin Juice, the Golden Egg's glow, rare and special |
| `bone`, `white` | paper, gull feathers, tape, text |
| `red`, `yellow`, `blue`, `pink` | danger, hazard stripes and gull beaks, the night's accents, raccoon noses |
| `hivis` | safety orange: Gary's vest, traffic cones, the truck's stripes |

The anchor (`item_cart`, `raccoon_gary_idle`, review sheet `art-src/review/anchor.png`) was
approved on 2026-11-07 and is the bar for everything else. What it taught:

- Garbage bags start from `grime2`; `grime1` is too dark to pop.
- The `ink0` outline nearly vanishes on `night0`: anything seen against the sky (the logo,
  flying gulls) gets a sodium rim on its top-left.
- PixelLab drafts: prompt the **shape only**, at the drawn size, low detail. Light and mood
  words turn sprites into dark blobs; the light is added by hand in the finishing script.

## UI

- **Cardboard** panels (`card1` face, `card3` lit top-left edge, `card0` shade) held on with
  **duct tape** strips (`steel3` with a `bone` sheen).
- Text in a **marker** style (a bitmap font drawn for the game), dark ink on cardboard or bone,
  light text only with an ink outline.
- Meters are crude: Stink is a jar filling with green-brown sludge, with flies.
- Numbers are tabular.

## Tools

PixelLab for the key drafts within the cap (`docs/ART_PLAN.md`), the **pixel-art-studio** skill
for everything else and for finishing every draft (`pixel-art/<slug>/*.py`, never a hand-edited
PNG). Never SpriteCook.
