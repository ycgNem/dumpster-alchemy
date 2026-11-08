# Dumpster Alchemy — Critic pass 2 (after the M7 fix wave)

Played 2026-11-07 on the dev server (`localhost:5179`):

- **Sizes:** 1280×720 (2x), 1366×657 (~1.8x fit), 1024×768 (1.6x), a 740×360 touch phone in
  landscape, and 375×812 and 360×740 in portrait.
- **Night 1:** played from the title with real clicks, Space and drags, from the first Dumpster click to the
  first two deliveries. The rest of the night ran on the built-in bot at 1.8 s per action while I
  sampled the state every 10-30 s. I also clicked Clock Out for real on night 2.
- **Nights 3-10, The End and Endless:** reached with `dev.night` / `dev.go` and played by the bot at
  1.3-1.8 s, with typical Swap Meet levels set by hand.
- **Edge cases:** pointer events with `pointerType: 'touch'` for touch, plus mouse drags held
  mid-drag.
- **Balance:** `npm run sim -- campaign 20 {1.8, 1.3, 1.0}`.
- **Screenshots:** canvas exports in `art-src/review/critic2/`. Numbered files are full screens at 2x and
  `c*` files are close crops. Audio not judged (the pane was hidden and muted).

## Verdict

**Fun: 6.5 / 10** (was 5). The fix wave worked. The game is now fair, readable and easy to pick
up:
- The three night-1 prompts teach the basics.
- The scale fits real laptops, touch drags feel right, and the rotate card is charming.
- The possum walks the lot, every night has a visible signature, and the crowning plus The End
  land as a real payoff.
- An average (1.8 s) player is crowned in about 12 nights instead of stalling on night 3. I saw no
  console errors and no stuck states.

What holds it at 6.5 is the middle of every night. The Stink jar sits at 0 for five of six minutes
and then ramps in the last 30 seconds. From about 4 AM every raccoon wants tier 6-8 while the
truck keeps bringing caps, so the lot carpets with junk nobody will take. The jackpot raccoon
decides whether early nights pass. Clock Out is a skip button, not a decision, because staying is
free. Night 10 is the easiest night in the game. The loop is pleasant. It isn't yet tense, and it
doesn't change from night to night.

## The first pass, finding by finding

**22 fixed · 7 partly · 1 open** (30 findings).

| ID | Status | Note |
|---|---|---|
| P0-1 Wall at night 3 | **fixed** | 1.8 s bot: crowned 20/20, no stuck runs, 12.3 nights per run. First-try rates by night: 100/85/85/75/100/70/70/85/60/100%. Not monotonic, see N-P1-6. |
| P1-1 Quota doesn't secure the night | **partly** | The mechanics are all in and correct: QUOTA MET! slam, a real Clock Out button (with key C and a tooltip), a Stink-out after the quota is a pass ("WHIFF!"), and reports name the cause. But staying is risk-free, so it isn't a choice (N-P1-3). |
| P1-2 Stink is a cliff | **partly** | No more 0 → 96 in 0.8 s, and there's "next 9 · room 4" on the truck plate and the possum at 75. But it's now flat-then-ramp: 0 until about 5:00-5:30, then 6 → 76 in 25 s on night 9 (`40_n9_t330`, `40_n9_stinkwarn`). Sim peak averages are 5-12 at 1.0-1.3 s. See N-P1-2. |
| P1-3 Merging high earns nothing | **fixed** | Value ×2.4 per tier (a tire is worth 2.3× its 64 caps), a patience bonus scaled to the order's value, and a jackpot. New side effect: orders stop taking small junk (N-P1-1). |
| P1-4 First minute teaches nothing | **fixed** | "click for junk!" paw, "drag it onto the raccoon!" with the piece ringed, the Crusher prompt, STINK label, coin on tags, a readable footer, and a shutdown cause line. Remaining gaps are in N-P2-1…5. |
| P1-5 Held piece under the paw | **fixed** | Lifted 12 px over the paw with a landing shadow, and it slides to the card's edge over orders (`71_mouse_held`, `72_mouse_held_over_card`). |
| P1-6 Whole-number scaling | **fixed** | 1366×657 draws at about 1.8x and fills the height (`62_size_1366x657`). 1024×768 is 1.6x. Text is a touch uneven but readable (`c04`). The portrait phone gets a rotate card and the night pauses under it (`78_phone_portrait_rotate_card`). |
| P1-7 Night twists invisible | **partly** | All visible now: the name on the HUD, gulls in the sky, heat shimmer, a sweating jar, the moon, the BULK sign, the possum on the fence, bunting (`39_n4…n9_signature`). Underneath, nights 1-9 still play alike (N-P1-6). |
| P1-8 Night 10 obvious play fails, small crowning | **fixed** | Orders are capped at tier 5 and pay in gift junk. The crowning (beam, portrait, the cast cheering, ALL HAIL!) is a real moment (`54_king_02`, `54_king_09`). But the night is now too easy (N-P1-5). |
| P2-1 Possum reads as a panda | **partly** | Not a panda any more. With a white cone face, pink ears and snout, a white suit and a pink tail, he reads as a **white lab rat** (`c02_possum_dead_report`, `44_n6_possum_warn_b`). |
| P2-2 Possum never on the lot | **fixed** | Walks in at 75 with a "!" next to the truck plate, marches in for a shutdown, and keels over on a pass. |
| P2-3 Streetlight through NIGHT label | **fixed** | The label is on an ink plate. |
| P2-4 Popups cover things | **partly** | Payouts sit above cards and junk words stay on the board. But "IT REEKS!" now spans the whole right column over the purse and jar (`40_n9_stinkwarn`), and "+43" sits on the truck plate (`11_n1_deliver`). |
| P2-5 Almanac list cut mid-word | **fixed** | Icons plus "+3 more" (`26_n1_report`). |
| P2-6 Endless title vs possum | **fixed** | "ENDLESS REPORT" (`60_endless_report`). |
| P2-7 Quip shown twice | **fixed** | The footer holds controls only. |
| P2-8 Crusher/Compactor names | **fixed** | "Crusher" everywhere, "Industrial Crusher" at the Swap Meet. |
| P2-9 4-digit price tags | **fixed** | "1104" and "2380" fit, with a coin. |
| P2-10 Tiny tier 1-2, red dirt specks | **fixed** | The specks are neutral and the checker contrast is down. Caps are still small (about 7×5 px at 1x) but read (`c07_all_items_board`). |
| P2-11 Touch lift drops one row up | **fixed** | Releasing on the target merges, even though the floating piece is over the empty cell above (`65_touch_held_over_target`). |
| P2-12 Swap Meet pips / values | **fixed** | Bright pips and "refill 5s → 4s" rows. Tooltips are anchored. |
| P2-13 Swap Meet barely a choice | **partly** | Pricier (700-6,500). At night 10 players own 10.9/16 levels (1.8 s) to 12.3/16 (1.0 s). Lid and Hinges barely matter, and Air Freshener does nothing while Stink is flat (N-P2-14). |
| P2-14 Upscaled King on The End | **fixed** | A dedicated portrait at 1x, and it looks great (`56_theend_6`). |
| P2-15 Endless = calm night + 90 s drowning | **partly** | Hourly milestones and a jackpot every 2 min. It still ends the same way: a cap carpet around 8-9 AM (1.3 s bot died at 8:58, `58_endless_t480`). |
| P2-16 Reload loses the night | **open** | Now declared out of scope in DESIGN. Still harsh on phones. |
| P2-17 Pete's lines don't match | **fixed** | "Can I have a tire?" |
| P2-18 Drop on inbound cell, no reason | **fixed** | A strong landing shadow and a bouncing arrow. |
| P2-19 "..." possum line | **fixed** | "*plays dead*" and friends. |
| P2-20 Empty title | **fixed** | A junk heap, the Dumpster with a gull, and the tagline on an ink plate (`01_title`). |
| P2-21 Two clicks to replay | **fixed** | Retry and the Swap Meet's "Night n" clock straight in with a drop-down banner (`30_n2_banner`). |

## New and remaining findings

No P0s. Nothing crashed, froze or threw in `read_console_messages`. Every flow worked:
- quota met → Clock Out (by mouse and by C);
- overtime;
- WHIFF, SHUT DOWN and NO KING paths;
- retry, the Swap Meet and the night card;
- the King, The End, Endless and back.

### P1: unfun or confusing enough to quit

**N-P1-1. From about 4 AM no raccoon will take small junk, so the lot carpets with caps.**
- *Seen:* Order tiers follow your best-ever tier (`pickWant` in `src/game/orders.ts`: `best-2..best` plus `tierBias`, with a stretch to `best+1`). The jackpot makes you build a tire at 1:20-2:30, and from then on every order wants tier 5-8. Meanwhile the truck still brings tiers 1-3 at its peak rate.
- *Logged order arrivals:* on nights 2, 4, 6 and 9 at 1.8 s, the 4-6 AM window was almost entirely tier 6-8 ("7", "8", "6+6", "8+8"), and not one order below tier 4.
- *Night 3, 5:45 AM:* Pete and Linda both want Shopping Carts (128 caps each) while the purse sits at 1,293 / 1,300 (`38_n3_t345`).
- *Night 9, 5:30 AM:* all four slots want carts, and the lot holds about 35 caps (`40_n9_t330`, `40_n9_t350`).
- *Knock-on effects:* unreachable orders storm off (7 on that night, +8 Stink and 3 kicked junk each), and that is what finally moves the Stink. The same carpet ends Endless (`58_endless_t480`).
- *Repro:* `dev.night(9); dev.go('play'); dev.auto(true, 1.8)`, then step to 5:30 and read `dev.state.orders`.
- *Fix:*
  - Keep a steady outlet for small junk. One slot always asks for tier 2-4, or a "bulk" order like "4 × Crushed Can" or "3 × Takeout Box" that pays a bit over value.
  - Base regular orders on what's on the lot (for example the 75th-percentile tier present), not on the best ever.
  - Drop the `best+1` stretch after 4 AM.
  - This turns the 5 AM flood into a juggling act instead of a cap carpet.

**N-P1-2. The Stink still isn't a meter you manage. It's flat for five minutes, then a 25-second ramp.**
- *Seen in my runs:* Stink is 0 for the whole of nights 1-3 except for brief +8 bumps from storm-offs, and the lot stays at 2-22% full until 5 AM (night 1 never went above 16%).
- *Sim:* the average peak is 5-12 on nights 1-9 at 1.0-1.3 s. At 1.8 s it's 7-28 on most nights and 71 on night 9. Across 20 full campaigns at 1.8 s, only 2 nights were lost to Stink (both night 9). Every other loss was the quota.
- *Night 9:* Stink 5.7 at 5:30 → 76 at 5:55 (`40_n9_stinkwarn`).
- *Consequences:*
  - The jar, the Crusher and the Air Freshener (and the Stink half of the possum) do nothing for most of the game.
  - The jar teaches nothing until it suddenly matters.
  - "Keep the Stink down" on every night card has no weight.
- *Why:* the only Stink sources are overflow, angry raccoons and crowding above 75% full. Below 70% full it fades, three times faster below 50%. A good player never crowds the lot before 5 AM.
- *Fix:* make the junk on the lot smell.
  - Each piece adds a little Stink per second by tier and age: bags drip, a fridge reeks, and anything untouched for 60 s "ripens" with a visible fly.
  - Fade only below about 40% full.
  - Stink then rises from 1 AM on a messy lot, and merging, delivering and crushing all visibly lower it.
  - Give it a mid-range cost too, for example raccoons pay 10% less above 50 ("smells off").

**N-P1-3. Clock Out has no teeth, because staying is always free.**
- *Seen:* staying past the quota risks nothing:
  - you keep every Shiny either way;
  - a Stink-out after the quota is still a pass that banks the full purse (`50_n5_whiff_report`: "Banked +1,600");
  - the only thing at risk is the 25% overtime bonus.
- *Sim:* that bonus averages +52-95 Shinies a night at 1.8 s, set against upgrade prices of 700-6,500. Bots never clock out unless the Stink is at 80 (0% on nights 1-8).
- *Night 1:* I met the quota at 4:01 with Stink 0 and an empty lot (`20_n1_quota_met`). The button only meant "skip to the report".
- *Fix:* make it a bet.
  - Overtime pays double for everything past the quota, but a Stink-out after the quota forfeits everything earned past it ("Possum confiscates the overtime").
  - The truck escalates once the quota is met ("the day crew's early").
  - Clocking out early pays a small early-bird bonus per minute left, or carries the lid charges into tomorrow.
  - Show the stake on the button: "Clock Out (+0)" / "Stay: +312 at risk".

**N-P1-4. The jackpot decides early nights, and income in between is lumpy.**
- *Night 1 (1.8 s):*
  - the purse sat at 306 from 2:14 to 3:28 AM (`19_n1_t210`: two raccoons want a tire);
  - it was at 336 at 4:00;
  - then one jackpot paid +562 and the quota was met at 4:01.
- *Night 2:* 293 → 376 between 1:20 and 3:20, then the jackpot paid +341.
- *Without the jackpot:* both nights would have failed at 1.8 s.
- *The jackpot is the same beat every night:* 1:20-2:30 AM, tier 7-8, 150 s.
- *Early orders can be steep:* night 1's first order at 0:03 was a Leaky Trash Bag (8 caps), because `startReach: 3` + Linda's bias.
- *Fix:*
  - Smooth income so the quota is reachable without the jackpot. That comes free with N-P1-1's small/bulk orders.
  - Make the jackpot a bonus on top.
  - Vary it: a gull jackpot, "5 boots", a two-item combo, or a second one after 4 AM on later nights.
  - Make night 1's first order a Crushed Can.

**N-P1-5. Night 10 is the easiest night of the game.**
- *Seen:* the plain order-feeding bot at 1.3 s crowned the King at 4:23 AM with Stink peak 0% and the lot never above 17% (`53_n10_*`, `55_king_report`). The sim builder does it by 5:03 at 1.8 s, 100% first try.
- *Why:* the truck hands you tiers 2-7, gifts push you up, and nothing pushes back.
- *Also:* the report reads "Banked +0" next to a bank of thousands, while the night card says "Every Shiny tonight goes in the bank too" (`52_n10_card`), and raccoons pay no Shinies that night.
- *Fix:*
  - Give the finale stakes: the possum is on site all night and the Stink climbs on a timer ("Inspection at 6"), so you must build the King *and* keep the lot passable.
  - Or the regular truck flood runs alongside the big-junk truck.
  - Drop the bank line, or pay a small tip per gift.

**N-P1-6. Nights 1-9 still play alike, and difficulty isn't monotonic.**
- *Seen:* each night's curve is the same:
  - jackpot at 1:20-2:30;
  - Stink 0 until 5 AM;
  - quota met 5:00-5:40 at 1.8 s;
  - flood after.
- *The twists are multipliers with a visual signature.* Seagull Season gave a few more gulls; Heat Wave was as easy as night 1 at 1.8 s (100% first try, vs 85% for Garbage Day); Rush Hour's second truck is a background prop.
- *First-try rates at 1.8 s run 100/85/85/75/100/70/70/85/60%.*
- *Fix:* one rule change per night that you feel in your hands:
  - Seagull Season: gulls replace a third of the orders and pay well;
  - Heat Wave: bags burst into 2 caps after 60 s untouched;
  - Rush Hour: a second truck dumps from the other side;
  - Full Moon: raccoons swap orders when they howl;
  - Bulk Pickup: tier 4-5 loads that fill fast;
  - The Inspection: the possum stamps a random cell every 30 s, and junk there costs Stink.
- Then order the nights by measured difficulty.

### P2: polish

| # | Finding | Repro / evidence | Suggested fix |
|---|---|---|---|
| N-P2-1 | The first-order hint says "Wants a Leaky Trash Bag. Merge two of a kind to make it." without saying **which** two, and nothing in play shows the chain. | Fresh night 1, first order a bag (`08_n1_t6`) | "Two Takeout Boxes make a Leaky Trash Bag." Better still, a hover on a wanted icon shows "= 2 × [icon]". |
| N-P2-2 | The order hint says "Wants a bag… merge two" **while you're holding the bag over that card** (the hint's scan skips the dragged piece). | `dev.wipe()`, night 1, `dev.give` the wanted item, drag it over the card (`68_touch_held_over_card`) | In `Hints.drawOrder`, if `s.drag` holds a wanted id, show nothing (the card already lights up). |
| N-P2-3 | The order hint bubble covers board rows 0-2, columns 0-4 and the junk under them for as long as the first raccoon waits (up to about 100 s). A cap at (1,0) was invisible. | `08_n1_t6` | Anchor it over the order column, or fade it to 40% after 5 s or when the pointer is near it. |
| N-P2-4 | The Crusher hint covers the bottom-right cells and the STINK number, stays 10 s after the lot empties, and teaches crushing before merging. | `75_crusher_hint`, `76_gullgod_1` | Place it above the Crusher, clear of the jar. Say "Lot filling up? Merge pairs, or drag junk into the Crusher." Drop it when the fill falls back under 50%. |
| N-P2-5 | Gulls are never introduced. The first Seagull lands at 0:08 on night 1 with only "SQUAWK" (the discovery banner fires on merges only), and soon Gary wants a "Fat Gull. Don't ask." | `09_n1_takeouts`, `17_n1_t90` | Fire a NEW! banner on the first gull's arrival: "Seagull. Eats small junk. Two make a Fat Gull, or crush it." |
| N-P2-6 | Gull orders pay pennies: a Fat Gull is 15 Shinies for two gulls and two cells, so nobody should ever fill one. | `39_n6_signature` (Gary, 15) | Raise `GULL_VALUE` (Fat Gull about 60, Gang about 150, Boss about 400), or pay in progress toward a Golden Egg. |
| N-P2-7 | The tag shows 29 but the delivery pays +43. The patience bonus is invisible until you're paid. | `06_n1_five_clicks` → `11_n1_deliver` | Show the live total (value plus current bonus) on the tag, ticking down with the patience bar. That gives the bar a meaning. |
| N-P2-8 | The report blinks to black. Its first frame is at about 40% brightness and fades in over about 0.3 s over the same frozen lot, so slam → black → report. | Sample canvas brightness after `dev.lose()`: Play 183 → Report 80 → 149 → 267 → 323 (`49_n5_whiff_slam_b` caught the black frame) | Draw the frozen lot at full brightness on frame 1 and fade or slide in only the clipboard. |
| N-P2-9 | The crowning crowd stands on the HUD. Gary cheers over Linda's card while still sitting in his own card, and Mange stands over the purse and King bar. | `54_king_02`, `54_king_09` | Empty the order column (the raccoons "leave the counter") and line the cheerers up on the board's bottom row. |
| N-P2-10 | Four-slot cards have three problems. The JACKPOT and BIG tags overlap the card above. Headers are inconsistent: one card shows its line ("Need it NOW.") and the others show names. Price tags hide the bottom third of the item icons (tire, boot). | `c06_order_cards_4slot`, `58_endless_t480`, `44_n6_possum_warn_b` | Inset the tags inside the frame, always show the name in four-slot mode, and move the tag under the icon or shrink it. |
| N-P2-11 | "IT REEKS!" covers the whole right column (Dumpster, purse, jar). | `40_n9_stinkwarn` | Draw it at 2x above the jar only, or as a shake on the jar plus a smaller word. |
| N-P2-12 | The jar reads **99** on the SHUT DOWN slam that says "The Stink hit 100". | `45_n6_shutdown_slam` | Ceil the jar label, or show 100 once `stinkOut` fires. |
| N-P2-13 | On phones, the hint says "click for junk!" and the footer says "SPACE dump · P pause · M mute". At 740×360 the game is 1 CSS px per logical px: cells are about 5 mm and caps about 7×5 px. | `64_phone_landscape_n1` | Use "tap" and a touch footer when `pointerType` is touch. On short landscape screens, consider hiding the lane strip so the board can scale about 1.2x. |
| N-P2-14 | The Swap Meet is still mostly a checklist. Air Freshener is a dead buy while Stink is flat, and Lid and Hinges are comfort buys (PLAN says so). The lock icon shows on 800 tags but not on unaffordable 1,900 / 4,000 tags or Bin Juice. "eat all → tier 2" and "build ×1 → ×0.85" are cryptic. | `28_swapmeet_bought`, `29_swapmeet_binjuice_broke` | A "pick 1 of 3" deal each night, or paired upgrades that exclude each other. Consistent lock-or-red. "Gulls eat up to tier 3 → 2", "Stink gain −15%". |
| N-P2-15 | The possum reads as a white lab rat (white cone face, pink ears, white suit). | `c02_possum_dead_report`, `44_n6_possum_warn_b`, `art-src/review/m7/possum.png` | Real opossum cues: a grizzled grey body or hood, **black ears** with pink tips, dark eye rings around a white face, black legs. Keep the pink nose and tail. |
| N-P2-16 | No auto-pause when the window loses focus or the tab is hidden. On a phone, switching apps and coming back resumes mid-truck with no warning. | `src/engine/loop.ts` only clamps dt | Open the pause menu on `visibilitychange` / `blur` during play. |
| N-P2-17 | A mid-night reload restarts the night (P2-16 from the first pass, now declared out of scope). | Reload during play | At least save at each hour mark on touch devices. |

### Performance

Fine, and the same as the first pass. Update plus render at 2x, 300-400 single-frame steps each:

| Board | Median | p95 |
|---|---|---|
| Empty | 1.6-1.7 ms | 2.7 ms |
| Full of tier 5-11 junk, every gull tier, Stink 88, Heat Wave shimmer (`61_perf_busy`) | 1.9-2.5 ms | 2.8-18 ms |

10-34 ms spikes show up just as often on an *empty* Heat Wave board as on a full one, so they come from the hidden pane or GC, not from load. The heap is about 9-10 MB. No action needed.

## The 3 changes that would add the most fun now

1. **Make the lot itself the pressure, all night.**
   - Junk on the lot smells by tier and age, so the Stink jar moves from 1 AM.
   - Keep a steady outlet for small junk: one small-stuff or bulk order slot, and order tiers based on what's on the lot rather than the best ever.
   - Every merge, delivery and crush then visibly does something about the smell, and the 5 AM flood becomes juggling instead of a cap carpet.
   - *(N-P1-1, N-P1-2, N-P1-4)*
2. **Give Clock Out teeth.** Overtime pays double, but a Stink-out after the quota forfeits it, and the truck escalates once the quota is met. Leaving early earns an early-bird bonus. Show the stake on the button. *(N-P1-3)*
3. **One rule per night you feel in your hands, and a finale with stakes.**
   - Replace the multipliers with a mechanic per night (bursting bags, gull orders, a second truck, the possum stamping cells), and order the nights by measured difficulty.
   - On night 10, the King must be built while the Inspection's Stink clock runs.
   - *(N-P1-5, N-P1-6)*
