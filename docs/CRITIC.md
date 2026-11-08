# Dumpster Alchemy — Critic pass (M7)

Played 2026-11-07 on the dev server (`localhost:5179`) at 1280×720 (2x), 1366×657, 1024×768 and a
375×812 phone. Night 1 was played by hand with real drags. Later nights were reached with `dev.*`
helpers and the built-in bot at "human" speeds (1.3-1.8 s per action). I ran
`npm run sim -- campaign 20 {1.0, 1.3, 1.8}`. Screenshots are in `art-src/review/critic/`: numbered
shots are full screens at 2x, and `c*` files are close-up crops. I couldn't judge the audio because the pane
was muted and hidden.

## Verdict

**Fun: 5 / 10.** The game looks and feels like one coherent thing. The raccoons are charming, the
UI is cardboard-and-tape, The End screen pays off, and I found no crashes, console errors or stuck
states in any edge case I tried. The loop underneath works against it, though. Night 1 is an
empty board you wait on, and after the quota is met at about 2:50 AM you have three minutes with
nothing at stake. Merging high earns nothing, because value is exactly linear and the patience
bonus rewards handing in small junk fast. The Stink sits at 0, then one truck dump takes it from 0
to 96. From night 3 the last hour is a flood that an average player physically can't clear, and
you can meet the quota at 4:40 AM and still be shut down at 5:50. Everything pretty is in place.
The pacing, economy and teaching need one more pass before a stranger would play past night 3.

## Findings, ranked

### P0: broken or blocking

**P0-1. An average-speed player hits a wall at Night 3 (Takeout Tuesday).**
- *Seen:* in `npm run sim -- campaign 20 1.8` (one action every 1.8 s, which is a normal human pace
  once you count scanning the board), **0/20 runs are crowned and 16/20 are stuck on night 3**:
  5% win it first try, it takes 26.5 tries per clear, and 101 of the losses are to Stink. The other
  4 runs stall on night 5. At 1.3 s, 5/20 runs stall on nights 6-9. Nights 1-2 are trivial at every
  speed (100%, purse about 1.7x the quota), so the curve is flat and then a cliff.
- *Why:* the truck ramps linearly to a 6 s interval with loads of 6-11 by 6 AM (×1.3 load on night
  3), so it brings about 1-1.5 items/s. A merge removes one item, so at 1.8 s per action you clear
  about 0.55/s. The board must fill in the last hour. In my traced night-3 run it went from 13 to
  63 cells between 5:00 and 5:50 AM (see P1-1 and P1-2).
- *Repro:* `npm run sim -- campaign 20 1.8`. In the browser: `dev.night(3); dev.go('play');
  dev.auto(true, 1.8)`, then step to the end.
- *Fix:* cap the late-night arrival rate at what a human can clear (for example `loadEnd` [5, 8] and
  `intervalMinSec` 8 in `src/data/tuning.ts`), soften night 3's `truckLoadMul` (1.3 → 1.1), and
  rebalance with the campaign sim at 1.8 s per action as the "average player" target (aim for
  ≥ 70% first-try on nights 1-5).

### P1: confusing, unfun or ugly enough to quit

**P1-1. Meeting the quota doesn't secure the night, and early nights go dead after it.**
- *Seen:* on night 3 at 1.8 s per action, the quota was met at 4:40 AM (1,168 / 1,100), then the
  Stink hit 100 at 5:50. The report shows `1,259 / 1,100` in red, "SHUT DOWN", "Night 3 stays",
  and half the Shinies kept, while the HUD behind it still says QUOTA MET
  (`45_night3_quota_met_then_shutdown_slam.png`, `46_report_quota_met_but_lost.png`). On night 1
  the reverse happens: the quota is met at 2:54 AM (`14_quota_met.png`) and the remaining 3+ minutes
  have no stakes.
- *Also:* crossing the quota mid-night only turns the bar green and adds small "QUOTA MET" text. No
  event fires (there is no `quotaMet` event in `src/game/events.ts`) and nothing celebrates it.
- *Fix:* when the quota is met, slam "QUOTA MET!" and show a **Clock Out** button. Clocking out wins
  the night now. Staying until 6 AM earns an overtime bonus (for example +25% on Shinies past the
  quota) but risks it. A Stink-out after the quota should still count as a pass, at a smaller
  bonus. This fixes both the unfair loss and the dead time (`src/game/shift.ts`, `src/render/hud.ts`).

**P1-2. Stink is a cliff, not a meter.**
- *Seen:* on a full board one late truck takes the Stink **from 0 to 96 in 0.8 s** (8 items × 12,
  `TUNING.stink.perOverflowItem`). With `dev.night(6); dev.go('play'); dev.state.time=290;
  dev.fill(); dev.stink(0)` the next dump (at 4:59 AM) takes it to 96, and the night is lost
  6 s later. Through a normal night the jar sits
  at 0 (peak 8% on nights 1-2), so it teaches nothing until it kills you. Decay is 0.25/s, and only
  under 70% fill, so in practice Stink never goes back down. An idle player on night 2 loses at
  2:54 AM with no build-up.
- *Fix:* lower `perOverflowItem` to about 5, add a slow creep while the board is over about 80%
  full, and decay faster when it's under 50%. Put "next load: 9 / 4 free" on the truck timer, and
  flash the cells the truck will miss. Let the Inspector walk on at 75 as the warning
  (`src/game/stink.ts`, `src/render/hud.ts`).

**P1-3. Merging high earns nothing, so there's no reason to hold pieces back.**
- *Seen:* `TUNING.value` is `{ base: 2, growth: 2 }`, so a boot is worth exactly 16 caps, and the
  patience bonus (0.2 Shinies/s left) is worth more than a small item's value. A can delivered
  with 60 s left pays 4 + 12. The best strategy is to hand in small stuff fast. Building a Toaster
  or above is pure risk, so the satisfying part of a merge game (the big pile-up) is never asked for.
  The orders you see are mostly one boot (`43_four_orders.png`: three of four raccoons want a
  single boot), plus Lil' Pete's "2 × Toaster", which a normal player can't fill in time on nights
  3-4, so he storms off and adds Stink.
- *Fix:* raise `growth` to about 2.3-2.5 (a boot is then worth about 20-26 caps), scale the patience
  bonus by the item's value instead of a flat amount per second, and give each night one "jackpot"
  order for tier 7+ with a long timer. Pete's two-item huge orders should be one item
  (`src/data/tuning.ts`, `src/game/orders.ts`).

**P1-4. The first minute teaches almost nothing.**
- *Seen:* there is no tutorial or hint system (`grep` finds none). Night 1 opens on an empty board,
  and the first junk arrives with the truck at 0:10 unless you guess that the Dumpster is
  clickable. Nothing says so except a grey "SPACE = dump", and the Dumpster has no idle cue
  (`03_night1_start.png`). The Stink jar has no label and the Crusher has no "drag junk here". None
  of the jar, Crusher or Dumpster has a hover tooltip (`c07_no_tooltips_jar_crusher.png`). The only
  control hint, the footer "drag junk onto junk to merge · feed the raccoons · P pause · M mute", is
  `ink2` on `ink0`, about **1.4:1 contrast**, which is effectively invisible
  (`c09_footer_hint_contrast.png`). The first raccoon (at 0:03) asked for a Takeout Box while I only
  had caps and cans. Its tag reads "13", which looks like a quantity or a tier, but it's the
  price, and the delivery actually paid +50 (`c05_order_price_tag_13.png`). The loss report says
  "The Stink hit 100." but never says why (truck overflow).
- *Fix:* three one-time prompts on night 1: a bouncing paw on the Dumpster at 0:01 ("click for
  junk"); "drag it onto the raccoon" over the first order; and "Lot filling up? Drag junk into the
  Crusher" the first time fill passes 60%. Also label the jar STINK, put a coin icon on price tags,
  draw the footer in `steel2` or brighter, and give the shutdown report one line of cause ("The
  truck had nowhere to dump 8 items (+12 Stink each). Merge or crush to keep room.")
  (`src/render/hud.ts`, `src/render/orders.ts`, `src/scenes/report.ts`).

**P1-5. You can't see the piece you're dragging (mouse).**
- *Seen:* the grab paw is drawn on top of the held item at the same spot, so a held Bottle Cap
  shows as a sliver of red under the paw (`c01_held_piece_under_paw.png`,
  `23_drag_wrong_order.png`). Over an order card the held item also lands exactly on the card's
  "wanted" icon. `dragLiftPx` is 4, so the item barely lifts.
- *Fix:* hide the paw while dragging, or draw the held item after the cursor and lift it about
  12 px. Consider drawing it one pixel-scale larger with a drop shadow (`src/render/board.ts`
  `drawHeld`, `src/render/cursor.ts`).

**P1-6. Whole-number scaling makes the game tiny on common screens.**
- *Seen:* a 1366×768 laptop (inner 1366×657) draws at **1x**: 640×360 in the middle, about 25% of
  the window (`72_laptop_1366x657_whole_window.png`). The same happens at 1024×768. A portrait phone
  (375×812) gets a 320×180 CSS-pixel strip with 16 px cells and huge empty bands, and no "rotate
  your phone" prompt (`73_phone_portrait_whole_window.png`).
- *Fix:* allow fractional scales ≥ 1 in 0.5 steps (or any scale) with nearest-neighbour, accepting
  a little pixel unevenness, or pick the larger of whole-number and "fit" with
  `image-rendering: pixelated`. In portrait, show a rotate prompt (`src/engine/screen.ts`, `fit()`).

**P1-7. The night twists are invisible, so nights feel the same.**
- *Seen:* every twist is a numeric `Mods` tweak (`src/data/nights.ts`). In play, Seagull Season,
  Heat Wave, Full Moon and The Inspection look and sound like night 1. The HUD says only
  "NIGHT 4", with no name. Seagull Season gave 7 gulls in 3.5 minutes and 3 eaten caps: it reads
  as noise, not a theme (`68_seagull_season.png`).
- *Fix:* one visible signature per night. Heat Wave: shimmer plus extra flies, and the jar sweats.
  Full Moon: a moon in the backdrop, and raccoons howl when they storm off. Rush Hour: a second
  truck honking in the lane. The Inspection: the possum pacing the fence with his clipboard. Bulk
  Pickup: a different truck. Put the night name next to "NIGHT n" on the HUD
  (`src/render/props.ts`, `src/render/hud.ts`).

**P1-8. Night 10: the obvious play fails, and the crowning moment on the board is small.**
- *Seen:* the night card does say "Save your best junk for the King. Feed raccoons the small
  stuff." (`47_night10_card.png`). But raccoons still order from `best-2..best+bias`, so Linda and
  Pete ask for Mattresses and Fridges, which are exactly the King's ingredients. The order-feeding
  bot at 1.3 s never built the King (best: Fridge) and earned 9,359 Shinies that night, which are
  worthless. The builder bot needs about 5:05 AM, so a disciplined human has about an hour of
  slack, and a casual one fails. When the King is made, the board shows "ALL HAIL!" twice (popup and
  slam) over a 28 px sprite (`49_king_a.png`, `51_king_c.png`). The End scene itself lands well
  (`57_the_end_c.png`).
- *Fix:* on a King night, cap order tiers at 5 and have raccoons pay in junk or Golden Eggs instead
  of Shinies. Show the King's progress in the now-unused Shinies bar (tier / 12). On crowning, zoom
  the King to 3x on a sodium beam for a beat before the slam.

### P2: polish

| # | Finding | Where / repro | Suggested fix |
|---|---|---|---|
| P2-1 | **Inspector Possum reads as a panda.** White hood up, round black ears, dark eye patches, grey face. The spec says the hood is *down* (`src/data/raccoons.ts` `INSPECTOR.look`). | `c02_possum_reads_as_panda.png`, `c03_possum_dead_report.png` | Hood down, white pointed face, pink snout, bare pink ears, a visible pink rat tail. Those are what read as possum. |
| P2-2 | **Inspector Possum never comes onto the lot.** A shutdown is a red "SHUT DOWN!" slam, and a win is a band. He only appears as a small sprite on the report. | `35_shutdown_a.png`, `37_shutdown_c.png` | Walk him in from the left for the slam, with his clipboard up, or have him keel over on the board when you win. |
| P2-3 | The streetlight pole and lamp run through the "NIGHT 1" label, which reads as "NIGHT 1 —". | `c04_streetlight_through_night_label.png` | Move the lamp right in `backdrop`, or give the label an ink plate. |
| P2-4 | Popups cover the board and cards. "IT REEKS!" covers the cart, mattress and lid pips. "+50" covers the raccoon's thank-you line. "+2 TIERS!" spills past the board frame. "KRSSH" covers the CRUSHER label. | `c12_popups_cover_board.png`, `c14_plus50_covers_speech.png`, `c13_plus2_tiers_spills_frame.png` | Clamp popups inside the board rect. Put Stink and "NO ROOM" warnings over the jar and truck, and payouts above the card. |
| P2-5 | The report's "New in the Almanac" list is cut mid-word ("…Fat Gull, One"; "Door Hanging, Busted") by `.slice(0, 2)`. "Fridge, Door Hanging" contains a comma, so it reads as two items. | `c10_almanac_list_truncated.png`, `src/scenes/report.ts:103` | Show icons instead of names, or "+3 more". Rename it "Fridge (door hanging)". |
| P2-6 | The Endless report title "ENDLESS SHIFT REPORT" runs into the possum sprite. | `c11_endless_title_overlaps_possum.png` | Draw the title at 1x, or move the possum down. |
| P2-7 | The same quip is shown twice: the "NEW!" speech bubble *and* the footer line, at the same time. | `05_takeout.png`, `65_gullgod_b.png` | Keep the bubble, and leave the footer for hints. |
| P2-8 | The name changes between screens: "CRUSHER" on the board and night card, "INDUSTRIAL COMPACTOR" at the Swap Meet, "Compactor" in the docs. | `21_swapmeet.png` | Pick one name. Crusher is funnier. |
| P2-9 | A price tag "2048" is wider than its slot and overlaps the slot edge, and prices have no coin icon. | `33_full_board_overflow.png` (Gary) | Coin glyph plus a smaller font for 4 digits. |
| P2-10 | Tier 1-2 junk is tiny: the cap is about 8×5 px at 1x. The dirt tiles have red and white specks the same size and red as a bottle cap. | `c06_all_tiers_at_1x_x2.png`, `03_night1_start.png` | Take the red out of the dirt specks and give caps and cans a 1 px light rim. The checkerboard contrast could also come down a step. |
| P2-11 | Touch: the piece floats `touchLiftPx` 28 (almost a full cell) above the finger. Lifting your finger *on* the target drops it into the cell above. I tested this: a cap released on a cap landed one row up. | `src/data/tuning.ts:128` | Lift by about 16 px, or snap the drop to the cell the finger is over when the lifted cell isn't a valid target. |
| P2-12 | Swap Meet: owned-level pips are dark orange on dark brown, hard to tell from empty ones. The hover tooltip covers the Bin Juice header. The upgrades don't show your current value ("refill every 4s", but from what?). | `22_swapmeet_bought.png` | Use bright pips and "5s → 4s" text. Anchor the tooltip above the item. |
| P2-13 | The Swap Meet is barely a choice. The greedy sim owns 15.8 of 16 levels by night 10, and a lost night still banks half, so everything gets bought eventually. Air Freshener and Plastic Owl do nothing on nights 1-3. | campaign sim | Make the levels mutually exclusive or seasonal, or a bit pricier, or add a "pick 1 of 3" deal each night. |
| P2-14 | The King on The End is a nearest-neighbour 3x upscale of the 28 px item, so its pixels are a different size from everything else, and its face is a muddle at that size. | `c08_king_upscaled_face.png` | Draw a dedicated 64-96 px King portrait for the finale. |
| P2-15 | Endless is a normal 6-minute night followed by about 90 s of drowning. The 1.0 s bot went from 11 to 63 cells and died at 6:57 AM, and the score is mostly set by the calm part. | `60/61_endless*` | Ramp from midnight more gently and make a long run something to aim for (milestones, a new gull every hour). |
| P2-16 | A mid-night reload or tab crash loses the whole night with no warning. Expected, but harsh on phones. | reload during play | Save the night state every hour mark. |
| P2-17 | Lil' Pete's lines ("Can I have a car?") don't match his order (a toaster). It's funny once, and confusing for a new player. | `16_storm_off.png` | Use generic lines for Pete, or lines with "{item}" filled in. |
| P2-18 | Dropping on an empty-looking cell that has junk inbound shows the red "bad" box with no reason. | `drop_on_air` repro: drag onto a cell during a truck dump | Draw the landing shadow more strongly, or show a small down-arrow on reserved cells. |
| P2-19 | The report's "..." line for the possum reads as a placeholder. | `19_report.png` | Use "*plays dead*" every time, or more lines. |
| P2-20 | The title screen is very empty in the middle and bottom, with no junk. The tagline is dim blue-grey. | `01_title.png` | Pile some junk and the Dumpster under the sign, and brighten the tagline. |
| P2-21 | The Swap Meet's "▶ Night n" and the report's "Retry" go back to the night card, not into play, so it takes two clicks to play again. | flow | Let them clock straight in. |

### Things that worked (briefly)
Every edge case I threw at it behaved, and there were no console errors at any point:
- **Truck and airborne junk:** dragging during a truck dump works, and dropping onto a cell with junk still in the air is rejected with a red box and a snap-back.
- **Drag cancels:** pausing mid-drag cancels the drag cleanly on resume, as does the night ending mid-drag.
- **Drop targets:** a wrong order gets a red outline and a snap-back. A Compactor on cooldown gets a red outline with a "2s" countdown.
- **Golden Egg and Bin Juice:** Egg on a can → bag, Egg on a Fridge → King, and Bin Juice on a Seagull → Fat Gull. Swaps with specials are fine.
- **Full board:** a Dumpster click uses no charge and adds no Stink.
- **Flow and saves:** Retry, Continue after reload, and the "Sure? Start over" guard all work, and Space dumps.
- **Layout:** resizing mid-drag is fine, and the four order slots lay out cleanly.

Drag feedback (green merge brackets, the orange Crusher outline, the yellow card ring) is clear. The
Gull God beam, The End scene and the raccoon cast are highlights.

### Performance
Update plus render at 2x is fine:
- **Empty board:** about 1.1 ms per frame on average.
- **Worst case:** with a full board of tier 6-11 junk, five gulls of every tier and Stink 88 (vignette and jar flies), I measured 2.9 ms on average, 12 ms at p95 and 28 ms at worst.
- **Caveat on the spikes:** 10-30 ms spikes also showed up on an empty board, while the pane was
  hidden and another tab was open on the same origin. I'd put them down to the environment or GC,
  not the game, but they're worth re-checking in a visible tab with the Performance panel.
- **Heap:** about 9 MB.

## The 5 changes that would make it most fun

1. **Reshape the night.** Add a Clock Out button when the quota is met, with an overtime bonus if
   you stay. A Stink-out after the quota still counts as a pass. Cap the 4-6 AM truck at a rate a
   human can clear, and smooth night 3. *(P1-1, P0-1)*
2. **Make Stink something you manage, not a trapdoor.** Lower the per-item overflow, add a creep
   from fill and faster decay, show "next load vs free cells" on the truck timer, and have the
   Inspector walk on at 75. *(P1-2, P2-2)*
3. **Make big junk worth building.** Set value growth to about 2.4, scale the patience bonus to the
   item's value, and add one jackpot order per night for tier 7+. On night 10, raccoons stop asking
   for the King's parts. *(P1-3, P1-8)*
4. **Teach night 1 in context.** Add the three one-time prompts (Dumpster, first order, Crusher),
   label the jar, put a coin on prices, make the footer readable and say why you lost.
   *(P1-4)*
5. **Make every drag and every night readable.** Lift the held piece above a hidden paw, allow
   fractional scaling (and a rotate prompt on phones), give each night a visible signature, and
   redraw the possum as a possum. *(P1-5, P1-6, P1-7, P2-1)*
