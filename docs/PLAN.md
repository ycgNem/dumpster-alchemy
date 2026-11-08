# Dumpster Alchemy — Build plan

Milestones in order. Each one ends playable. Tick them off here as they land.

## M0 — Scaffold ✅ (2026-11-07)

- TypeScript (strict) + Vite + Canvas 2D, no engine.
- 640 × 360 logical screen, whole-number scaling, letterboxed.
- Layout greybox: the truck lane, the 9 × 7 board, the orders column, the right column.
- Data files for the plan: `src/data/items.ts`, `raccoons.ts`, `tuning.ts`, `palette.ts`.

## M1 — The merge loop (greybox) ✅ (2026-11-07)

- Board model: place, move, swap, merge, empties, full.
- Pointer drag with a ghost item that follows the cursor; drop targets highlight.
- The Dumpster: click to spawn, lid charges, refill.
- The Truck: timer, drive in, dump items in arcs, drive off.
- Placeholder items: coloured squares with their tier number.
- **Done when:** you can sit and merge up to tier 8 and it already feels okay.

**M1 as built.** One `GameState` (`src/game/state.ts`); systems are plain functions over it in
`src/game/` (`actions` pick up / drop / `dropKind`, `dumpster`, `truck`, `spawn` with flights and
overflow, `step`). Junk in the air already owns its cell, so nothing else lands there, but can't
be grabbed until it lands. The truck backs in from the right (art: cab faces right), tips its
load over the first 70% of the dump; the load range and interval slide from midnight to 6 AM
(`TUNING.truck.loadStart/loadEnd`). Drag and drop with mouse or touch: ghost under the pointer,
merge partners and the hovered target light up (`cell_target`, `cell_hover`, `cell_bad`), invalid
drops snap back, swaps slide. Renderers in `src/render/` (`board`, `props`, `orders`, `hud`,
`sprites`, `text`, `view`, an empty `fx` for M5); every sprite falls back to `greybox.ts`.
`main.ts` runs one `Scene` (`src/scenes/`). Dev builds get `window.dev` (`src/dev/devtools.ts`).

## M2 — Key art (PixelLab, cap 50 generations) ✅ (2026-11-07: 40 used, balance 855.9)

- See `docs/ART_PLAN.md`. A style anchor first (one item and one raccoon), the user approves it,
  then the rest uses it as the reference.
- Every PixelLab draft is finished by hand in `pixel-art/` scripts (outline, palette snap,
  shadows, animation frames).
- **Done when:** both chains, the four raccoons, the Inspector, the truck, the Dumpster and the
  backdrop are in the game.

## M3 — Pressure ✅ (2026-11-07)

- Orders: raccoons arrive, patience, delivery by drag, payouts, storming off.
- Stink: overflow, decay, the meter, Inspector Possum's shutdown.
- The shift clock (12 to 6 AM), the quota, win and lose.
- The Compactor.
- **Done when:** a whole night can be won or lost.

**M3 as built.** Orders (`src/game/orders.ts`): three slots, raccoons arrive at 3/12/24 s then
4-9 s after one leaves, never two of the same at once; 1-2 wants from `best-2..best` (+ their
`tierBias`, 20% stretch, capped at best+1, never the King); each item pays value × payMul as it's
delivered, the last one adds 0.2 × seconds of patience left. Angry: +8 Stink and 3 kicked junk.
Stink (`stink.ts`), the clock and the verdict (`shift.ts`), the Compactor (in `actions.ts`).
Night-1 quota is `TUNING.shift.quotaNight1` until M6's night table. End overlay: Inspector
Possum's verdict, click to replay. `npm run sim` (`src/dev/sim.ts`, `bot.ts`): the greedy bot at
four speeds. Tuned for night 1: truck every 16 s → 6 s, 3-5 items → 6-11, quota 1250. Over 100
nights the 1 s/action bot wins 95% (quota met ~5:00 AM), 1.3 s 89%, 1.6 s 41% (drowns in stink).

## M4 — Seagulls ✅ (2026-11-07)

- Gull spawns on merge, hopping, eating, the Gang's shuffle, the Boss's pecking.
- The Gull God, the Golden Egg.

**M4 as built.** `src/game/gulls.ts`. A junk merge rolls `chancePerMerge × mods.gullChanceMul`
(`afterMerge`, called from `actions.ts`); the Seagull swoops in as a flight (`FlightFrom` `'gull'`)
onto a random empty cell, or onto random loose junk and eats it. Each gull keeps a timer in
`state.gullTimers` (by uid, × 1 ± `jitter`), paused while it's held or flying: G1/G2 pick one of
the 8 neighbours and move into it if empty, eat-and-move if it's junk ≤ `eatsUpToG1/G2`, else
stay; the Gang shuffles its 8 neighbours (not flying or held pieces); the Boss pecks
`bossPeckShinies` (never below 0). The God never sits on the board: on creation it pushes
`gullGod` and a Golden Egg drops into its cell as an `'egg'` flight (`eggDropSec`, with a
`spawn` from `'egg'`). Egg on junk below the King is a new drop kind, `'egg'` (+`goldenEggTiers`,
capped); anywhere else it moves or swaps. Orders: once a gull has shown up tonight, an order
wants one at `orderChance` (Gary `orderChanceGary`, always a Fat Gull, "Don't ask."). Events gained
optional fields only (`gullScream.moves`, `gullPeck.c/r`, `egg.first`, `gullArrive.first`,
`spawn.first`), because the audio switch is exhaustive. Stats: `gulls`, `gullEats`, `pecked`,
`eggs`. The bot cracks eggs over its best junk, crushes a lone Seagull when ≤ 12 cells are free,
and merges gull pairs a little ahead of junk of the same tier.

Balance (200 nights each, gulls off → on): 1.0 s bot 98% → 95.5%, 1.3 s 85% → 85.5%, 1.6 s 40.5%
→ 40.5%. No tuning needed for night 1: ~9 gulls a night, 2.5 eats (mostly caps), 2.2 gull orders
(0.4 storm off), a Boss in a third of nights, no God. At ×3 (Seagull Season) the bot sees about
one God and Egg a night and still wins 98%; the 1.6 s bot drops to 27%.

## M5 — Juice and sound ✅ (2026-11-07)

- Squash and stretch, stink puffs, shake, marker popups, flies, idle wobble.
- WebAudio synth: squelch (pitched by tier), clank, truck beeps, screech, chitter, cash.

**M5 as built.** All event-driven, nothing in `src/game/`. `fx.ts`: one pool of 320 particles
(sprite or plain square; puffs and pops run their frames once over their life, everything blinks
out instead of fading), a small `after()` scheduler, Shinies flying card → purse on delivery and
purse → Boss on a peck, the Gull God rising in a flickering sodium beam, a banner queue
(first discoveries in a `speech` bubble with the item hopping; hours on a `paper` note, only the
latest), and the end slam ("QUOTA MET!" / "SHUT DOWN!" at 3x on an ink band) that the overlay
waits for (`END_SLAM_SEC`, `view.endedAt` now includes it). Ambient: flies circle junk tier ≥ 6
(1-3 by tier) and the jar past the warning, leaky bags drip, toasters spark. The Stink creeps in
from the edges past 70 as an ordered-dither vignette (7 cached steps, deepest in the corners,
under the HUD so the numbers stay readable). `popups.ts`: bitmap text with an ink0 keyline in a
cached canvas, whole-number scale only (pops one size up, damped bounce, drifts, blinks out);
words by tier and situation. `shake.ts`: kicks in whole pixels, capped at 5. `view.ts`: squash
is whole pixels (2-4 px by tier), gull hops and Gang shuffles slide with an arc, eaten junk stays
drawn until the gull lands on it. `board.ts`: gulls swoop in from the nearer side, glance left and
right (flip, never rotate), the egg waits in the sky then drops. `props.ts`: the `backdrop` with
the streetlight flickering in ragged, irregular bursts (~3% of the time), the truck rattles 1 px
on the tip frame (plus dust and grit from fx). `cursor.ts`: the paw (`setCursorHint` +
`drawCursor`, any scene; the system cursor comes back on its own if nobody draws the paw, and
always for touch). Touch: the held piece floats `touchLiftPx` (28) up and drops on the cell under
it, not under the finger. Music intensity follows `max(stink, fill × 0.8)`.

## M6 — The ten nights ✅ (2026-11-07)

- Night table (quota, truck interval, truck load, gull chance per night).
- The Swap Meet, upgrades and Bin Juice.
- Title, night card, night report, the Trash Almanac, pause.
- Save to `localStorage`. Endless after night 10.

**M6 as built.** Flow (`src/scenes/flow.ts`): Title → Night card → Play → Night report → Swap
Meet → Night card …; a lost night's report offers Retry; night 10 won → The End → Endless. The
game starts on the title (`?play` in dev clocks straight into the saved night). Menu scenes share
`menu.ts` (clock, buttons, music, fade in, the M5 paw via `setCursorHint`/`drawCursor`); widgets
are in `src/render/menus.ts` (9-slice `button`/`button_down` with a 1 px label nudge, hover ring,
keys, tooltips; panel, paper, clipboard + clip, price tag, speech, stamps with a slam, big text at
whole-number scale, silhouettes drawn from the sprite). Scenes: `title`, `nightcard` (quota or
goal, news, Bin Juice waiting, try count, owned gear), `report` (clipboard over the frozen lot,
`possum_dead`/`possum_shutdown`, two stat columns, new finds, what was banked, stamp at 0.9 s,
buttons at 1.2 s), `swapmeet` (6 upgrade columns + Bin Juice + Grandma Mange at the stall),
`almanac` (3 shelves, 19 items, close-up at 2x), `theend`, `pause` (P / Esc / the corner button;
Resume, Sound, Quit to title asks twice). Play hooks (`play.ts`): `load(state)`, `onEnd` (the
report takes over 0.9 s after `view.endedAt`), `onQuit`.

Data: `src/data/nights.ts` (ten nights + `ENDLESS`; a night's `Mul` mods multiply the
upgrades', the rest replace), `src/data/upgrades.ts` (levels → `Mods`, prices, Bin Juice 400,
max 3). Run (`src/game/run.ts`, headless): bank, levels, Bin Juice, `discovered`, best tier,
`crowned`, Endless best, stats. `startNight` builds the state (Bin Juice flies out of the
Dumpster); `finishNight` banks and moves on. **A lost night** keeps half its Shinies (floor), the
night stays, the next try gets a new seed, and the Swap Meet is open before retrying; Bin Juice is
used up by any finished night (quitting mid-night keeps it and banks nothing). Save
(`src/game/save.ts`): `{ v: 1, run, settings: { muted } }` under `dumpster-alchemy/save`, every
access guarded, untrusted fields clamped; `main.ts` hands in a `localStorage` adapter or a memory
one (the title says when it can't save). Mute is saved however it's toggled.

Contract changes: `Mods.stinkGainMul` (all Stink gains); `GameState.goal` (`'quota' | 'king' |
'endless'`, `NewNight.goal`); `shift.ts` wins a King night the moment `bestTier` hits 12, and
Endless has no 6 AM (clock goes on into PM); `truck.ts` Endless ramp (interval × 0.88 per hour
past 6 AM, floor 0.33); `stink.ts` the Air Freshener's extra (`stinkDecayMul − 1`) also works on a
full lot (no change without it); `layout.ts` `setOrderSlots`/`orderSlotCount` (4 slots → 53 px
cards, `orders.ts` drops the name and shows one line); HUD shows `KING: tier n/12` or `SCORE`, the
night label moved right of the pause button. `installDev(flow, update, render, endStep)`; new
`dev.night(n)`, `bank(n)`, `go(...)`, `click(x, y)`, `wipe()`, `run`, `scene`.

| Night | Name | Quota | Twist (mods) |
|---|---|---|---|
| 1 | First Shift | 700 | truck ×1.2 slower, loads ×0.8, patience ×1.25 |
| 2 | Garbage Day | 900 | truck ×1.1, loads ×0.9, patience ×1.1 |
| 3 | Takeout Tuesday | 1,100 | fewer, bigger loads (×1.25 interval, ×1.3 load), more tier 3 |
| 4 | Seagull Season | 1,250 | gulls ×3 |
| 5 | Heat Wave | 1,400 | Stink gains ×1.5, decay ×0.5, patience ×0.9 |
| 6 | Rush Hour | 1,600 | truck ×0.85 interval |
| 7 | Full Moon | 1,700 | patience ×0.85, gulls ×2, some tier 4 |
| 8 | Bulk Pickup | 2,200 | tiers 1-4 (30/35/25/10), loads ×1.15 |
| 9 | The Inspection | 2,300 | truck ×0.9, load ×1.05, patience ×0.85, gulls ×1.5, Stink ×1.1, bulk odds |
| 10 | Spring Cleaning | build the King | tiers 2-7 (5/15/30/27/15/8), truck ×1.15, load ×0.85, patience ×1.4 |
| 11+ | Endless: No Closing Time | score | truck ×0.9, some tier 4; never ends, ramps past 6 AM |

| Upgrade | Levels (price) | Effect |
|---|---|---|
| Bigger Lid | 400 / 900 / 1,800 | 8 / 10 / 12 lid charges |
| Greased Hinges | 450 / 1,000 / 2,000 | refill 4 / 3.2 / 2.5 s |
| Extra Raccoon | 2,000 | 4 order slots |
| Industrial Compactor | 350 / 900 / 1,800 | cooldown 6 / 4 / 2.5 s, pays 1 / 2 / 3 per tier |
| Air Freshener | 300 / 750 / 1,500 | Stink fades ×1.75 / ×2.75 / ×4 (the extra works on a full lot) |
| Plastic Owl | 300 / 700 / 1,400 | gulls ×0.6 / ×0.35 / ×0.15 |
| Bin Juice | 400 each, carry 3 | lands on the lot next night |

`npm run sim -- campaign [runs] [secondsPerAction]` (`src/dev/campaign.ts`): plays nights 1-10
in order, shops greedily (cheapest affordable upgrade until broke; Bin Juice before night 10),
retries losses (6 in a row = stuck), night 10 with `src/dev/builder.ts` (keeps junk ≥ tier 5 for
the King, feeds orders small stuff, merges the highest pair), then one Endless shift. 40 runs:

| Night | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1.0 s bot, first-try win | 100% | 100% | 100% | 100% | 93% | 98% | 80% | 85% | 73% | 100% |
| 1.3 s bot, first-try win | 100% | 100% | 100% | 95% | 75% | 40% | 29% | 36% | 31% | 100% |
| Bank at start (1.0 s) | 0 | 188 | 344 | 445 | 474 | 651 | 855 | 822 | 1,155 | 532 |
| Levels owned (1.0 s, of 16) | 0 | 3.6 | 6.0 | 8.0 | 9.7 | 10.9 | 12.0 | 13.2 | 14.5 | 15.8 |

1.0 s: crowned 40/40 in 10.9 nights; Endless score ~2,440. 1.3 s: crowned 27/40 in 15.9 nights
(stuck at 6-9 in 13 runs; Rush Hour and Bulk Pickup lose to Stink, Full Moon and The Inspection to
the quota). Night 10: the builder builds the King by a median 5:05 AM (earliest ~4:20) whatever
its speed (it's limited by what the truck brings, ~2,000 cap-equivalents by then); a human has
about an hour of slack and must not hand big junk to the raccoons. Bin Juice or a Golden Egg on a
Dead Car / Fridge is a shortcut.

## M7 — Polish and playtest ✅ (2026-11-07: two critic passes, 5 → 6.5/10, then a final fix wave)

- A critic pass (a playtest subagent plays and reviews), then act on its notes.
- Balance by measuring: a headless bot plays a night and logs the stink and Shinies curves.
- Ship only when the user says so.

**M7 balance as built** (the balance and systems agent; `docs/CRITIC.md` P0-1, P1-1/2/3/8, P2-5/8/13/15/17/19).

- *The night.* Quota nights fire `quotaMet` once (`shift.ts` `checkQuota`) and the quota stays met
  (a Gull Boss peck can't undo it). `canClockOut`/`clockOut` end it as a win; staying to 6 AM pays
  `stats.overtimeBonus` = 25% of the purse past the quota (`TUNING.shift.overtimeShare`); a Stink-out
  after the quota is a pass with no bonus. `s.endReason` replaces `lostReason` (`clockout`, `shift`,
  `stinkAfterQuota`, `king` win; `stink`, `quota` lose; `endless`), and `NightResult` carries
  `endReason` and `quotaMetAt`. The bot clocks out once the quota is in and the Stink reaches 80.
- *Truck.* 6 AM pace 5-9 items every 7 s (was 6-11 every 6 s); first dump at 0:06 (was 0:10). Each
  load is rolled one dump ahead (`truck.next`, `nextTruckLoad`; `src/game/loads.ts`). Night mods:
  Takeout Tuesday ×1.2 interval / ×1.1 load (was 1.25/1.3), Heat Wave load ×1.1, Rush Hour 0.85,
  Full Moon patience 0.9 and gulls ×1.75, Bulk Pickup load ×1.2, The Inspection 0.9/1.15 with gulls ×1.25.
- *Stink.* 5 per overflow item (was 12); creeps 0.3/s above 75% full rising to 1.5/s on a full lot;
  fades 0.25/s under 70% and ×3 under 50%; `stinkWarn` still at 75. Causes in `stats.stinkFrom`.
- *Value.* 1.5 × 2.4^(tier−1), whole under 100, else two significant figures: 2, 4, 9, 21, 50, 120,
  290, 690, 1,700, 4,000, 9,500, 23,000. The patience bonus is 50% of the order's value × patience
  left (was 0.2/s flat). One jackpot a night (`Order.jackpot`): from 1:20-2:30 AM once the best junk
  is within two tiers, it wants best+1 (tier 7-8), waits 150 s, pays its value plus the bonus, and
  leaves quietly if unfilled. Pete orders one item; lines fill `{item}` with `ItemDef.short`.
- *Night 10.* Orders ask tier 5 at most and pay no Shinies: a filled order kicks a gift one tier
  above its best item onto the lot (`deliver.gift`, a `spawn` from `'kick'`; `stats.gifts`). The
  order-feeding bot at 1.3 s crowns the King by a median 4:43 AM, the builder by 4:34 (5:03 at 1.8 s).
- *Swap Meet.* Lid 700/1,900/4,600, Hinges 800/2,100/5,200, Extra Raccoon 4,000 (the 4th slot is now
  for big spenders: best..best+1, ×1.5 patience, ×1.25 pay; plain small orders there cost income),
  Industrial Crusher 900/2,500/6,500, Air Freshener 800/2,200/5,500 (now also Stink gains ×0.85/0.7/0.55),
  Plastic Owl 800/2,100/5,200 (gulls ×0.75/0.55/0.35, and they eat junk only up to tier 2/1/0), Bin
  Juice 800. Gulls got meaner (G1 eats up to tier 3, G2 up to 5, the Boss pecks 2). Bigger Lid and
  Greased Hinges barely move the bot's numbers (it's action-limited); they're comfort buys.
- *Endless.* Reaches the 6 AM pace at 7:30 AM, then ×0.9 interval and +0.75 items per load every
  hour; every hour pays a `milestone` (40 × the hour) and a jackpot comes every 2 minutes.
- *Data.* "Fridge (door hanging)", "Industrial Crusher", Inspector lines without a bare "..." (plus
  `stinkAfterQuota` and `clockout` lines), shorter jackpot lines, night news updated.

First-try win rate by night, `npm run sim -- campaign 20 {1.0,1.3,1.8}` (night 10 is the builder):

| Bot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Crowned | Stuck | Nights | Levels at 10 | Endless ends |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.0 s before | 100% | 100% | 100% | 100% | 90% | 100% | 80% | 85% | 65% | 100% | 20/20 | 0 | 11.2 | 15.8/16 | 6:57 AM |
| 1.0 s after | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 20/20 | 0 | 10.0 | 12.3/16 | 9:52 AM |
| 1.3 s before | 100% | 100% | 100% | 95% | 80% | 35% | 39% | 35% | 44% | 100% | 15/20 | 5 | 15.5 | 15.9/16 | |
| 1.3 s after | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 20/20 | 0 | 10.0 | 11.4/16 | 8:54 AM |
| 1.8 s before | 100% | 100% | 5% | 0% | 0% | - | - | - | - | - | 0/20 | 20 (night 3 ×16) | - | - | - |
| 1.8 s after | 100% | 85% | 85% | 75% | 100% | 70% | 70% | 85% | 60% | 100% | 20/20 | 0 | 12.3 | 10.9/16 | 7:49 AM |

At 40 runs the 1.8 s bot reads 93/83/90/75/90/73/68/60/65/100%, 40/40 crowned, none stuck; the
1.3 s bot needs a retry about once every five runs (10.2 nights per run). The 1.8 s bot meets the quota around 5:20 AM, the 1.0 s
bot around 4:20 (then stays for overtime, about +250). Stink peaks stay low at 1.0-1.3 s and
reach 25-70 on nights 5-9 at 1.8 s.

**M7 UX as built** (the UX and presentation agent; `docs/CRITIC.md` P1-1/2/4/5/6/7/8, P2-2/3/4/5/6/7/8/9/11/12/14/18/20/21).
Screenshots in `art-src/review/m7/`.

- *Scale* (`src/engine/screen.ts`, STYLE.md "Rules"). Whole number when it fills ≥ 85% of the fit
  scale, else the fit scale itself, nearest-neighbour; the pointer maps through the drawn size, so
  clicks land at any scale (1366 × 657 is ~1.8x, 1024 × 768 1.6x, 1280 × 720 2x). A touch device
  under 600 px held upright gets a "turn your phone" card (`src/render/rotate.ts`, its own 180 × 320
  buffer) and the scene isn't stepped while it's up.
- *The held piece* (`board.ts` `drawHeld`, `play.ts`). Drawn after the paw (the paw peeks out under
  it), lifted 12 px on mouse / 16 px on touch (`TUNING.feel`), with a shadow on the cell it would
  land in. Over an order card it slides to the card's right edge (eased offset), never over the
  wanted icon. Touch aims with the floating piece, but the cell under the finger wins when only it
  merges / delivers / crushes, or when the piece is over nothing valid. Cells with junk inbound get
  a stronger landing shadow and a bouncing down-arrow.
- *HUD* (`hud.ts`). "NIGHT n · NAME" on an ink plate; the truck timer on an ink plate (the possum
  walks in behind it) with "next 9 · room 4" from `nextTruckLoad` (yellow/red with "!" when the load
  won't fit) and the bar on the real `interval(s)`; the jar labelled STINK with a red notch at 75;
  lid charges and refill on one line; the footer in `steel3` with a keyline (quips only in the NEW!
  bubble). Hover tooltips (0.6 s, anchored, reset by clicks) on the Dumpster, Crusher and jar. The
  King night's bar is 12 segments with the best item's (short) name. Endless past 6 AM: red clock and bar, "OVERTIME".
- *Quota and Clock Out.* `quotaMet` slams "QUOTA MET!" with a subline (`fx.ts`, a mid-night slam)
  and drops a real `button` 9-slice "Clock Out" (icon, hover ring, press, `cursor_point`, key C,
  tooltip) under the quota bar with "or stay for +25%"; the play scene owns its clicks and calls
  `clockOut`. End slams per `endReason`: CLOCKED OUT!, OVERTIME! (+bonus) / QUOTA MET!, WHIFF!
  ("Possum caught a whiff, but you made quota."), SHUT DOWN!, SHORT! / NO KING!, ALL HAIL!, CLOSING TIME!.
- *Inspector Possum* (`src/render/possum.ts`). Walks in along the lane (`possum_walk`) past Stink 75
  and stands left of the board with a "!" (leaves under 65); marches in for a shutdown and holds
  `possum_shutdown`; hurries in and keels over (`possum_dead`) on a win; reads the clipboard then
  faints on a whiff; paces the fence all night on The Inspection.
- *Twists* (`src/render/twists.ts`, `twistOf`). Gulls wheel in the sky (Seagull Season); Heat Wave
  shimmers the backdrop in strips under a warm dithered haze, puts flies on small junk and makes the
  jar sweat and puddle; a moon (Full Moon) and storm-offs howl "AWOOO!"; a second truck honks past
  every ~17 s (Rush Hour); a BULK sign on the truck; bunting and a SPRING CLEANING banner.
- *Night 1 prompts* (`src/scenes/hints.ts`, `settings.hintsSeen` in the save, per player): paw on
  the Dumpster from 0:01 ("click for junk!") until clicked; over the first order "drag it onto the
  raccoon!" with the wanted piece ringed (or "Wants a X. Merge two of a kind to make it." until one
  exists); "Lot filling up? Drag junk into the Crusher." the first time the lot passes 60%.
  `dev.wipe()` forgets them too.
- *Orders.* Prices carry a 7 px coin (4 digits fit; 10,000+ reads "13k"); the King night shows a
  GIFT tag and "GIFT!" (never "+0"); jackpots get a gold frame, a JACKPOT tag, sparkles and a
  JACKPOT! popup, and leave quietly ("oh well.", GAVE UP); big spenders say "BIG SPENDER!" with a BIG tag.
- *Popups* (`popups.ts` `clamp`). Junk words stay on the board, payouts pop above the card, NO
  ROOM! goes by the truck in the lane, IT REEKS! / EMPTY! / KRSSH stay in the right column, clear of
  the Crusher label.
- *The crowning.* The board freezes, the screen dims, a sodium beam comes down and `king_portrait`
  rises from the King's cell with confetti and the regulars cheering, then "ALL HAIL!" (no merge
  popup); `CROWN_SEC` 2.4 s. The End uses `king_portrait` at 1x.
- *Reports* (`report.ts`). A headline and detail line for every `endReason` (clock-out time,
  overtime bonus, the whiff, the Stink's biggest source from `stats.stinkFrom` with what to do, how
  short), the possum's `clockout` / `stinkAfterQuota` lines, new finds as icons plus "+N more", the
  title kept clear of the possum (ENDLESS REPORT).
- *Menus.* Swap Meet: bright owned pips, "refill 5s → 4s" rows from the real `Mods` (labels move up
  into the heading when a row won't fit), maxed ones show their numbers, coin on tags, tooltips
  anchored over the column's top / above Bin Juice (the subline hides while one is up), "Crusher"
  on screen. Title: a heap of junk and the Dumpster (a gull on the lid) under the sign, the run note
  between sign and buttons, the tagline in sodium on an ink plate. Retry and the Swap Meet's "Night
  n" clock straight in, with a 2.8 s night banner dropping over the lane instead of the card.

**M7 wave 4 UX** (the UX agent; `docs/CRITIC2.md` N-P1-3 presentation, N-P2-1/2/3/4/5/7/8/9/10/11/12/13/14/15/16, N-P1-5's bank line).
Screenshots in `art-src/review/m7b/`.

- *Smelly junk* (`fx.ts` `drawSmelly`). Pieces where `isSmelly` gets two wavy green-brown stink
  lines rising off the top of the item (its real height, measured once from the sprite), a slow
  `fx_puff` now and then, and 1-3 flies by tier. Flies now mean only "this stinks": fresh tier-6+
  junk and Heat Wave's small junk lost their decorative flies. A piece past 75% `ripeness` gets one
  faint wisp as a warning; the `ripen` event puffs and now and then says "RIPE!" / "pee-yew".
- *The jar* (`hud.ts`). Drawn 0-100 with the warn notch at `stinkWarnAt` and, under a lower
  `stinkLimit` (The Inspection), a thick red limit line, the glass above it hatched off and the
  limit's number in it. A red up-arrow (two when fast, > 0.6/s) or green down-arrow beside the
  number from `smellRate`. Shakes for 0.7 s on `stinkWarn`; reads the limit (not 99) once the Stink
  has ended the night. Tooltip explains smelly junk. Possum walks on at `stinkWarnAt` (50 on night 9).
- *Scrap orders* (`orders.ts` `scrapWants`). A SCRAP corner tag; each kind once in its box with a
  big "x3" in the room above the cap or can, ticking down per delivery and a tick when that kind is
  done; one price for what's left. Works in both layouts.
- *Order cards.* Price tags show the live pay (each item's share of `orderValue`, so they tick down
  with the patience bar) with a green up-arrow while the bonus is above 25%; tags sit lower on the
  box. Four-slot cards: always the name on the top line with one price for the order beside it,
  slim corner tags (JACKPOT/BIG/SCRAP) tucked inside the 4 px gap. Night pay rules get a yellow
  "PAY x1.5" / "PAY x2" sticker (gull orders on Seagull Season); on four-slot cards it sits on the
  portrait's corner. Hover a wanted item (mouse) for its recipe: "Two Takeout Boxes make it: [box] +
  [box] = [bag]".
- *Clock Out stakes.* The button reads "Clock Out 1,625" (what you'd bank now). Under it: "OVERTIME
  +151" / "doubles at 6 AM" / "lost if shut down!" (blinking red once the Stink passes the warning);
  the LID text line steps aside while it's up (the pips still count). Slams: CLOCKED OUT! (+N
  overtime at x1), OVERTIME x2!, WHIFF! ("the Possum takes the overtime: -N"). Report lines for each.
- *The night's rule.* Night card: a hazard-tape strip with TONIGHT at 2x and the rule beside it, then
  up to two notes (retry, Bin Juice, news) that fit. The quick start banner leads with the rule.
  HUD: hover the night's name (or tap it on touch) for "TONIGHT: ...". Feedback: Garbage Day's second
  truck comes in from the left, mirrored, to its own stop (junk tips from its bed), and the truck
  plate follows `dueTruck` with "x2" and a bar per truck; Full Moon "+2 TIERS!" on a skipped merge;
  Bulk Pickup "CRUSHER PAYS x3" and "+N x3!" with coins to the purse on each crush (any paying
  Crusher shows its pay); The Inspection's jar limit; SHUT DOWN's subline says the real limit.
- *Hints* (`hints.ts`). Bubbles never sit on the board: the order hint goes in the truck lane (tail
  only to the top card), the target card gets a ring and a yellow arrow in the gutter, and the text
  names the raccoon ("Drag it onto Linda!"). Nothing shows while you hold a piece someone wants
  (N-P2-2). With nothing wanted on the lot it shows the recipe in pictures. The Crusher hint sits
  above the Crusher, right of the jar ("Merge pairs, or drag junk into the Crusher."), and goes when
  the lot drops under 50%. New one-time `gull` hint (any night, the first gull to land): ring on the
  gull, "Seagull! It eats small junk. Crush it, or merge two." in the lane above its column.
- *Touch* (`engine/input.ts` `touchUi`/`tapWord`: the last pointer, or a coarse pointer before any).
  "tap for junk!", "tap the card to clock in", a touch footer without key hints, "tap Resume to carry
  on", no "(C)" in the Clock Out tip. The HUD's sound icon is now a button (pause and sound in the
  top corners, for everyone).
- *Auto-pause.* `blur` or the tab going hidden opens the pause menu ("You looked away. The lot
  waited.") during play only; a drag in progress goes home. Focus lost on a menu doesn't carry over.
- *Popups.* IT REEKS! is a small word just above the jar (the jar shakes). Payouts pop right of the
  truck plate and below it. The crush pay popup stays short.
- *Report.* No more blink: the report doesn't fade in from black (`MenuScene.fade`), the lot stays lit
  and only the clipboard slides up (canvas brightness 200 -> 200 -> 212 ... across the hand-off).
  "- Inspector Possum" under a one-line quote. King night: "Gifts from the raccoons: N", not
  "Banked +0"; the night card says raccoons pay in junk.
- *Crowning.* The order column empties (the regulars leave the counter) and they cheer in a row in
  front of the board either side of the beam, clear of the HUD.
- *Possum.* The first time he's on the lot each night he wears an "INSPECTOR POSSUM" name tag for
  4.5 s (over him in the lane, kept right of the truck plate; under him on the fence).
- *Swap Meet.* Every tag you can't afford: a padlock where the coin goes and the price in red (Bin
  Juice too). Rows: "gain 0% -> -15%", gulls "up to 3 -> up to 2".

Known gaps: the possum sprite itself still reads as a white rat (only the name tag fixes it); short
landscape phones still draw at 1x (the lane strip isn't hidden); a reload mid-night still restarts
it (N-P2-17, out of scope).

**M7 wave 4 systems** (the systems agent; `docs/CRITIC2.md` N-P1-1…6, N-P2-6, N-P2-14).

- *Contract surface* (ARCHITECTURE "Wave 4", as specified): `Piece.born` (`makePiece(id, born = 0)`;
  every call site passes `s.time`), `isSmelly(s, p)`, `smellRate(s)` (the **net** Stink per second
  from the lot: smell + crowding minus the fade; 0 rather than negative on an empty jar),
  `s.overtimeEarned`, `Order.scrap`, `NightDef.rule`. Extras: `Order.payMul` and `itemPay(o, id)` (a
  tag's price), `ripeness(s, p)` 0..1, `smellGain(s)`, `stinkLimit(s)` / `stinkWarnAt(s)` (75/50 on
  The Inspection), `s.truck2` + `Truck.which` + `trucks(s)` / `dueTruck(s)` (Garbage Day; junk from
  truck 2 flies with `Flight.slot` 1), `crushPay(s, id)`, `tierWeights(s)`, `scrapChance(s)`,
  `UpgradeDef.shines`, `retryEase(run)`, `earn(s, n)` (every payout; past the quota it's overtime).
  Stats: `stinkFrom.smelly`, `overtimeLost`, `skips`, `scraps`. Events: `ripen` (once per piece; a
  quiet wet sag in `sfx.ts`), `merge.skipped?`, `orderArrive.scrap?`. New `Mods`: `ripenMul`,
  `stinkMax`, `orderPayMul`, `orderTiers`, `scrapOrders`, `gullPayMul`, `gullOrderMul`, `skipChance`,
  `compactorPayMul`, `trucks`, `jackpotTiers`.
- *Orders follow the lot* (`orders.ts` `tierWeights`). Each tier on the board weighs its count (up
  to 3), a pair weighs 0.7 toward what it merges into, one tier over the top of the lot 0.6; wants
  already promised (and the order's own first want) don't count; tierBias is extra draws (keep the
  biggest). Big spenders: top of the lot or one up. **Scrap orders**: 3-5 tier 1-2 pieces mixed like
  the lot's small junk, x2 value each, x1.4 patience, 12% + 3% per small piece past 4 (max 55%), one
  at a time, never Pete. Night 1's first order is a can. Gull values 20/60/150/400 (were 5/15/40/100).
- *The Stink* (`stink.ts`). Junk ripens after 30 s (tier 1), 1.5 s less per tier, min 18 s, x the
  night's `ripenMul`; each smelly piece adds 0.035/s + 0.008/s per tier (capped at tier 7). Crowding
  0.2→1/s above 75% full (was 0.3→1.5); fade 0.2/s under 70% full (was 0.25, x3 under 50%). Truck:
  every 10 s → 7 s (was 16 → 7), loads 4-7 → 5-7 (was 3-5 → 5-9), so a 1.8 s player falls behind
  around 2-3 AM instead of 5. The bots merge smelly pairs first, deliver the oldest piece, and crush
  the least useful smelly piece when the Stink is past 40% of the limit and rising.
- *Clock Out* (`shift.ts`). Overtime x2 at 6 AM (`overtimeShare` 1), x1 on a clock-out, all of it lost
  on a Stink-out after the quota (purse back to the quota-met purse; a Gull Boss peck after the quota
  comes out of the overtime first). The bots clock out when the Stink passes 75% of the limit or would
  pass 95% within 25 s at the current `smellRate` (they never lose it); a bot that never clocks out
  loses it on 10-35% of tries on nights 4-7 and 9 (`campaign … stay`).
- *Jackpot.* Tiers by night (`jackpotTiers`: 5-6 on nights 1-2, 6-7 on 4-5, 7-8 from 6 and in
  Endless, none on Takeout Tuesday or the King night), arrives 1:00-4:10 AM (was 1:20-2:30), pays at
  most 28% of the quota. Measured: 2-19% of the quota on average; the longest stretch with no income
  is 11-24 s (median) on every night.
- *Rules* (`nights.ts`): see DESIGN's night table. Quotas 1,100 / 1,400 / 2,300 / 2,050 / 1,950 /
  2,625 / 2,550 / 4,150 / 2,350 (no longer monotonic: each fits its rule). Spring Cleaning: tiers 2-7
  x0.75 load, ripen x0.45, gains x1.6, fade x0.35; gifts three times in four (`king.giftChance`); a
  lost try leaves 1-3 free Bin Juice and cuts the next try's gains 10% (min 60%) so no run sticks.
- *Swap Meet.* Prices up about 55%: Lid 1,100/3,000/7,500, Hinges 1,200/3,300/8,000, Extra Raccoon
  6,000, Crusher 1,300/3,600/9,000, Freshener 1,200/3,400/8,500, Owl 1,100/3,100/8,000, Bin Juice
  1,000. `shines`: Lid 3; Hinges 3, 6; Raccoon 6, 8; Crusher 8, 2; Freshener 5, 9, 10; Owl 4, 7. The
  campaign shopper buys a level of what shines tonight first, then cheapest-first, then retry juice.
  On night 10 the Freshener decides it: the 1.3 s order-feeding bot with no upgrades crowns 15%,
  with Freshener 2 100%.
- *Sim.* `campaign` prints jackpot share of the quota, the longest income gap, Stink average and
  the smelly share, overtime lost, scrap orders, and the Stink's share of losses; `probe` replays
  each first try without a quota to show the purse it could reach (how the quotas were set); `stay`
  never clocks out. `sim N secs nX stay lvLHRCFO` gives half-hourly Stink / fill / smelly / purse.

First-try win rate by night, `npm run sim -- campaign 20 {1.0,1.3,1.8}` (night 10 = builder bot):

| Bot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Crowned | Stuck | Nights | Levels at 10 | Stink share of losses |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.0 s before | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 20/20 | 0 | 10.0 | 12.3/16 | - |
| 1.0 s after | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 20/20 | 0 | 10.0 | 12.3/16 | - |
| 1.3 s before | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 20/20 | 0 | 10.0 | 11.4/16 | - |
| 1.3 s after | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 95% | 100% | 100% | 20/20 | 0 | 10.1 | 11.2/16 | 0% |
| 1.8 s before | 100% | 85% | 85% | 75% | 100% | 70% | 70% | 85% | 60% | 100% | 20/20 | 0 | 12.3 | 10.9/16 | 4% |
| 1.8 s after | 100% | 100% | 80% | 80% | 75% | 85% | 50% | 60% | 70% | 85% | 20/20 | 0 | 12.8 | 9.9/16 | 19% |
| 1.8 s after, 60 runs | 98% | 100% | 88% | 78% | 75% | 77% | 72% | 75% | 63% | 75% | 60/60 | 0 | 12.8 | 10.0/16 | 25% |

Average peak Stink at 1.8 s, nights 1-10: before 8/8/8/7/25/25/8/28/71/3, after (60 runs)
3/11/11/55/54/46/40/8/44/71. The plain order-feeding bot at 1.3 s still crowns night 10 every
time (`greedy10`): it out-merges the truck and owns Freshener 2+, so the reek never reaches it.
1.3 s retries are rare (about one per eight runs, Rush Hour or Bulk Pickup): above about 0.75
actions a second a player keeps up with the truck all night, so the Stink only bites slower hands.
Endless now ends around 6:00 AM at 1.8 s (was 7:49), 9:30 at 1.3 s, 10:50 at 1.0 s.
