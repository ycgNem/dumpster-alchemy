# Dumpster Alchemy — Architecture and contracts

Several agents build this game at once. These contracts let them work without touching each
other's files. Change a contract only by editing this file first.

## Who owns what

| Area | Folders | Owner |
|---|---|---|
| Game code | `src/` except `src/audio/` | the code agent of the current milestone |
| Sound | `src/audio/` | the audio agent |
| Key art (PixelLab drafts, finished) | `pixel-art/{anchor,junk,gulls,cast,props,backdrop,logo}/`, `art-src/`, `public/art/{items,cast,props,backdrop,logo}.*` | the key-art agent |
| Hand-drawn art | `pixel-art/{board,ui,font,fx}/`, `public/art/{board,ui,fx}.*`, `public/art/font_marker.*` | the hand-art agent |
| Docs | `docs/`, `STYLE.md`, `CLAUDE.md` | the director (main session); agents append to their own section of `docs/PLAN.md` |

Nobody edits another owner's files. If you need something from another area, write it in your
report and the director passes it on.

### Wave 2 (M4-M5 and M6 at the same time)

| Agent | Owns (may create and rewrite) | May touch with small `Edit`s only |
|---|---|---|
| Gulls + juice (M4, M5) | `src/game/gulls.ts`, `src/render/fx.ts`, `view.ts`, `board.ts`, `props.ts`, new `src/render/popups.ts`, `cursor.ts`, `shake.ts` | `src/game/state.ts`, `step.ts`, `actions.ts`, `orders.ts`, `src/scenes/play.ts`, `src/dev/bot.ts`, `src/render/layout.ts`, `hud.ts` |
| Nights + menus (M6) | `src/scenes/*` except `play.ts`, new `src/data/nights.ts`, `upgrades.ts`, `src/game/run.ts`, `save.ts`, new `src/render/menus.ts`, `src/main.ts`, `src/render/orders.ts` | `src/scenes/play.ts`, `src/render/layout.ts`, `hud.ts`, `src/dev/sim.ts`, `bot.ts`, `devtools.ts`, `src/game/state.ts`, `truck.ts`, `dumpster.ts`, `stink.ts`, `shift.ts`, `spawn.ts`, `src/style.css` |

Shared files: use `Edit` (never `Write` over them), re-read when they changed, keep each edit
small and self-contained. If `npm run typecheck` fails only in the other agent's files, wait and
retry; don't fix their files.

## Code shape

- `src/engine/` — screen, loop, input, RNG. Stable.
- `src/data/` — palette, items, raccoons, tuning, and later nights and upgrades. Numbers live here.
- `src/game/` — the simulation. **No DOM, no canvas, no audio** in here, so a headless bot can
  run a whole night in Node (`npm run sim`). Systems are functions over one `GameState`
  (`src/game/state.ts`) and an `Rng`; they push `GameEvent`s (`src/game/events.ts`).
- `src/render/` — drawing only; reads the state, never changes game rules.
  `sprites.ts` loads the atlases below and **falls back to the greybox placeholder** for any
  sprite that isn't there yet, so code never waits on art.
- `src/audio/` — reads `GameEvent`s and plays synthesised sound (WebAudio, no files).
- `src/scenes/` — title, night card, play, report, Swap Meet, Almanac, pause (M6).
- `src/main.ts` — boots the screen, the loop and the current scene.

### Mods (upgrades and night difficulty)

`GameState.mods` (`Mods` in `src/game/state.ts`) is everything that changes from night to
night: the Swap Meet's upgrades (Dumpster charges and refill, order slots, Compactor cooldown
and pay, stink decay, gull chance) and the night's difficulty (truck interval and load,
patience). `createState({ mods })` takes a partial; `defaultMods()` is night 1 with no
upgrades. The systems already read them (dumpster, truck, orders, stink, the Compactor); the
gull system reads `gullChanceMul`. M6 builds the mods from the night table and the upgrades.
M6 added `stinkGainMul` (Heat Wave), and `GameState.goal` (`'quota' | 'king' | 'endless'`):
a King night is won the moment the King is made, and Endless has no 6 AM.

### The run (M6)

`src/scenes/flow.ts` runs Title → Night card → Play → Report → Swap Meet → Night card (a lost
night's report adds Retry; night 10 won → The End → Endless). `src/game/run.ts` is the run
between nights (bank, upgrade levels, Bin Juice, discovered items, bests); `save.ts` stores it
through an adapter (`localStorage`, or memory when storage is blocked). Nights are in
`src/data/nights.ts`, upgrades in `src/data/upgrades.ts`. `npm run sim -- campaign [runs]
[secondsPerAction]` plays nights 1-10 with a buying bot (`src/dev/campaign.ts`, the night-10
builder bot in `src/dev/builder.ts`). In dev, `?play` jumps into a night.

### Events

`src/game/events.ts` is the contract between the simulation and everything that reacts to it
(effects, sound, popups). Systems push; `fx` and `audio` consume once per frame; then the list
is cleared. Add variants freely, never rename one without grepping.

### Audio API (src/audio/index.ts)

```ts
export function initAudio(): void;               // call on the first user gesture
export function playEvent(e: GameEvent): void;   // one sound per event (or none)
export function playUi(kind: 'hover' | 'click' | 'back'): void;
export function setMuted(m: boolean): void;
export function isMuted(): boolean;
export function setMusic(track: 'title' | 'night' | 'report' | null): void;
export function setIntensity(x: number): void;   // 0..1, e.g. stink / board fill; music reacts
```

## Wave 3: the critic fixes (M7, `docs/CRITIC.md`)

| Agent | Owns | May touch with small `Edit`s only |
|---|---|---|
| Balance + systems | `src/game/*`, `src/data/*` (except tuning's `feel` block), `src/dev/*` | `src/audio/sfx.ts` (cases for new events), `src/game/events.ts` |
| UX + presentation | `src/render/*`, `src/scenes/*`, `src/engine/*`, `src/main.ts`, `src/style.css` | `src/game/run.ts`, `save.ts` (hint flags only), `src/data/tuning.ts` `feel` block |
| Art | `pixel-art/*`, `art-src/*`, `public/art/*` | — |

**The surface the balance agent adds first** (types and stubs within its first steps, then the
real logic), so the UX agent can draw against it:

```ts
// src/game/shift.ts
canClockOut(s: GameState): boolean   // quota goal, quota met, still playing
clockOut(s: GameState): void         // ends the night now as a win
// src/game/truck.ts
nextTruckLoad(s: GameState): number  // the size of the next dump (rolled ahead of time)
// src/game/state.ts
s.quotaMetAt: number | null          // seconds after midnight the quota was first met
s.endReason: 'clockout' | 'shift' | 'stinkAfterQuota' | 'stink' | 'quota' | 'king' | 'endless' | null
s.stats.overtimeBonus: number        // the bonus paid for staying past the quota (0 if none)
s.stats.stinkFrom: { overflow: number; angry: number; crowding: number }
Order.jackpot: boolean               // the night's big order (tier 7+, long timer, big pay)
// src/game/events.ts
{ type: 'quotaMet' }                 // fired once, when the purse first reaches the quota
```

New sprites from the art agent (code falls back to greybox until they land): `possum_walk`
(32 × 32, 4 frames, side view facing right, clipboard), `king_portrait` (96 × 96, 2 frames),
`moon` (32 × 32), `gull_fly` (16 × 16, 2 frames, a gull flying in the sky).

## Wave 4: the second critic's fixes (`docs/CRITIC2.md`)

Same ownership as Wave 3: **systems** owns `src/game/*`, `src/data/*`, `src/dev/*` (small
`Edit`s to `src/audio/sfx.ts` for new events); **UX** owns `src/render/*`, `src/scenes/*`,
`src/engine/*`, `src/main.ts`, `src/style.css` (small `Edit`s to `run.ts`/`save.ts` for hint
flags and the `feel` block of `tuning.ts`). No art agent this wave (UX draws new effects in code
or composes existing sprites).

**The surface the systems agent adds first** (typed and compiling, logic after):

```ts
// src/game/board.ts
Piece.born: number                       // s.time it landed or was made (a merge makes a new piece)
// src/game/stink.ts
isSmelly(s: GameState, p: Piece): boolean // old enough to stink: draw fumes and flies on it
smellRate(s: GameState): number           // Stink per second the lot adds right now (for the HUD)
// src/game/state.ts
s.overtimeEarned: number                 // Shinies earned after the quota was met
// src/game/state.ts (Order)
Order.scrap: boolean                     // the bulk small-junk order: wants several tier 1-2 pieces
// src/data/nights.ts (NightDef)
rule: string                             // the night's one real rule change, one short line
```

As built, `smellRate(s)` is the **net** rate (smell and crowding minus the fade), so the HUD
arrow points both ways. Wave 4 also added: `ripeness`, `stinkLimit`/`stinkWarnAt` (night 9 is
75/50), `itemPay`/`orderValue`/`crushPay`/`earn`, a second truck (`s.truck2`, `trucks`,
`dueTruck`), `retryEase(run)` (night-10 retries reek less), `UpgradeDef.shines` (the Swap Meet's
"TONIGHT!" sticker), the `ripen` event, and the mods `ripenMul`, `stinkMax`, `orderPayMul`,
`orderTiers`, `scrapOrders`, `gullPayMul`, `gullOrderMul`, `skipChance`, `compactorPayMul`,
`trucks`, `jackpotTiers`. Two formulas are mirrored in render code (the jar's warn/rearm line,
the pay sticker's `orderPayMul × gullPayMul`): change them in both places.

All art the game loads lives in `public/art/`. Each **family** is one PNG atlas plus one JSON
file with the same name:

```
public/art/items.png + items.json       both chains, Golden Egg, Bin Juice     (key-art agent)
public/art/cast.png + cast.json         raccoons, Inspector Possum             (key-art agent)
public/art/props.png + props.json       truck, Dumpster, Compactor             (key-art agent)
public/art/backdrop.png + backdrop.json Lot 9 at night                         (key-art agent)
public/art/logo.png + logo.json         the title sign                         (key-art agent)
public/art/board.png + board.json       dirt cells, ruts, highlights           (hand-art agent)
public/art/ui.png + ui.json             cardboard, tape, jar, buttons, icons   (hand-art agent)
public/art/fx.png + fx.json             puffs, flies, sparks, pops, feathers   (hand-art agent)
public/art/font_marker.png + .json      the marker bitmap font                 (hand-art agent)
```

Family JSON (every size in logical pixels, 1x):

```json
{
  "sprites": {
    "item_cap": { "x": 0, "y": 0, "w": 32, "h": 32, "frames": 2, "fps": 3, "anchor": [16, 31] }
  }
}
```

- Frames sit **left to right** from `x, y`, each `w × h`, no gaps.
- `anchor` is the point that sits on the cell's foot (default: bottom centre `[w/2, h-1]`).
- `fps` 0 means a still or frames chosen by code.

### Sprite names the code looks for

| Name | Size | Frames |
|---|---|---|
| `item_<ItemId>` for every id in `src/data/items.ts` | 32 × 32 | 1-2 idle (code adds the wobble) |
| `raccoon_<id>_idle` (`gary`, `linda`, `pete`, `mange`) | 48 × 48 | 2: idle, blink |
| `raccoon_<id>_happy`, `raccoon_<id>_angry` | 48 × 48 | 1-2 |
| `possum_idle`, `possum_dead`, `possum_shutdown` | 48 × 48 | 2, 1, 1 |
| `truck_drive` | 112 × 64 | 2: wheels turn |
| `truck_dump` | 112 × 64 | 3: bed lowered, half, up |
| `dumpster_closed`, `dumpster_open`, `dumpster_rattle` | 48 × 48 | 1, 1, 2 |
| `compactor_idle`, `compactor_crush` | 48 × 48 | 1, 3 |
| `backdrop` | 640 × 360 | 1-2 (the streetlight may flicker) |
| `logo` | ≤ 240 × 96 | 1 |
| `cell_a`, `cell_b` | 32 × 32 | 1 (two dirt variants) |
| `cell_hover`, `cell_target`, `cell_bad` | 32 × 32 | 1 (overlays) |
| `board_frame` | 9-slice, see below | — |
| `panel` (cardboard), `paper` (bone note), `button`, `button_down` | 9-slice | — |
| `tape_h`, `tape_v` | ~20 × 8, 8 × 20 | 1 |
| `jar` (the Stink meter), `jar_flies` | 24 × 104, 24 × 16 | 1, 2 |
| `icon_shiny`, `icon_stink`, `icon_clock`, `icon_lid`, `icon_truck`, `icon_mute`, `icon_sound` | 16 × 16 | 1 |
| `fx_puff` | 16 × 16 | 6 |
| `fx_fly` | 4 × 4 | 2 |
| `fx_spark` | 8 × 8 | 4 |
| `fx_pop` | 32 × 32 | 4 |
| `fx_feather` | 8 × 8 | 2 |
| `fx_drip` | 4 × 6 | 3 |
| `jar_glare` | 24 × 104 | 1 (glass shine drawn over the sludge) |
| `pip_lid_full`, `pip_lid_empty` | 8 × 6 | 1 |
| `cursor_open`, `cursor_grab`, `cursor_point` (raccoon paw; `anchor` is the hotspot) | 16 × 16 | 1 |
| `speech` (9-slice bubble), `speech_tail` | 9-slice, 8 × 6 | — , 1 |
| `clipboard` (9-slice, the night report), `clipboard_clip` | 9-slice, ~40 × 16 | — , 1 |
| `stamp_passed`, `stamp_shutdown` (red rubber stamps) | ~96 × 40 | 1 |
| `price_tag` (9-slice paper tag on a string, the Swap Meet) | 9-slice | — |
| `up_lid`, `up_hinges`, `up_raccoon`, `up_compactor`, `up_freshener`, `up_owl` (upgrade icons) | 24 × 24 | 1 |
| `icon_pause`, `icon_play`, `icon_book`, `icon_star`, `icon_lock`, `icon_check`, `icon_cross` | 16 × 16 | 1 |

**9-slice**: the entry also has `"slice": [left, top, right, bottom]` borders; the code
stretches the middle by tiling, never by scaling.

### The font

`public/art/font_marker.json`:

```json
{ "lineHeight": 11, "cap": 7, "spacing": 1, "space": 4,
  "glyphs": { "A": { "x": 0, "y": 0, "w": 6, "h": 11 }, "...": {} } }
```

Glyphs are drawn in one ink colour (`ink0`) on transparent; the code tints by drawing through a
coloured offscreen copy. At least `A-Z a-z 0-9 .,!?:;'"-+/()%&*#$@` and `·`. Until it exists the
code uses `bold 9px monospace`.

## Checks every agent runs before reporting

- `npm run typecheck` and `npm run build` pass.
- Art: `python3 pixel-art/check.py` (palette snap, no semi-transparent pixels, contract sizes;
  `--strict` also fails on missing names). On this machine `python` has no Pillow; use `python3`.
- Visual: look at it. Code agents take a screenshot of the running game
  (`http://localhost:5179`); art agents Read their preview and contact-sheet PNGs.
