# Dumpster Alchemy — Critic pass 3 (the "regular person" test)

Played 2026-11-07/08 on the dev server (`localhost:5179`) in a Playwright browser at 1280×720 (2x):

- **Night 1:** played from a wiped save, from the title screen to the report, with real clicks and
  drags. For the first 3 minutes I chose every move myself. After that a small script of mine made
  greedy choices (hand in whatever is wanted, else merge the highest pair, else click the Dumpster)
  and sent them as real mouse drags.
- **Nights 2-3:** about 2.5 minutes of each with real drags at about 1.7 s per action. The rest ran
  on `dev.auto(true, 1.8)`. I used the Swap Meet for real between nights.
- **Nights 4, 7 and 10, the crowning, The End and Endless:** reached with `dev.night` / `dev.go` and
  the built-in bot.
- **Balance:** `npm run sim -- campaign 20 1.8` and `campaign 20 1.3`.
- **Display:** eight window sizes at device-pixel ratio 1.
- **Screenshots:** in `art-src/review/critic3/`. Audio not judged: the browser was headless.

This pass doesn't repeat the fairness and readability findings of `CRITIC.md` and `CRITIC2.md`.
Those are fixed: nothing broke, and the hints, tooltips and scaling all did their job.

## Verdict

**For a regular player: 5.5 / 10.** It looks good and it's fair, but it doesn't make you want to
keep going.

- **One sitting:** most people play 1-2 nights, **about 7-15 minutes**. Players who like it reach
  night 3-4 (about 25 minutes).
- **All the content:** about **65-85 minutes** to crown the King (10.1 nights per run at 1.3 s, 12.8
  at 1.8 s, 6 minutes each, plus menus). Then Endless runs of 6-10 minutes. So about 1.5-2 hours for
  someone who finishes everything.
- **Coming back tomorrow:** unlikely. Nothing new is waiting, there's no daily, and the Swap Meet
  is a list of stat bumps.

**The owner's belief is right about the loop and wrong about the idea.** The skin is not bland:
- A raccoon crew, a possum inspector who plays dead, gulls that eat your junk, a Stink jar, a
  Trash King on a mattress throne.
- A player or a streamer would screenshot it and quote it.

The *mechanics* under the skin are generic: merge two of a kind and fill orders.
- **The verb has no decisions.** Position never matters, the orders ask for what you already have,
  and a greedy policy with no lookahead wins: mine carried night 1 and the openings of nights 2-3,
  and the equally simple sim bot is crowned 20/20.
- **There is no alchemy.** It's one 12-step chain plus a gull chain. Nothing ever combines with
  something *different*.
- **The novelty runs out early.** Every new thing a newcomer will see in the first 20 minutes has
  shown up by **2:40**. The funny big junk (tire, cart, mattress, fridge, car, King) is held back
  for 40-60 minutes.

So the player "sees the whole loop in two minutes" because the game *shows them* everything in two
minutes, then repeats it with modifiers for an hour. The pitch has a future. This build doesn't
show one yet.

---

## The 5-minute test (night 1, timed from clicking New Shift)

| Real time | Game time | What happened | Shot |
|---|---|---|---|
| 0:00 | | Title screen. The cast and the junk heap sell the tone at once. | `01_title` |
| 0:13 | | Night card: "1,100 Shinies by 6 AM". | `02_after_new_shift` |
| 0:27 | 12:00 | Clocked in: an empty lot, and a paw bouncing on the Dumpster. | `03_n1_start` |
| 0:33 | 12:07 | Five Dumpster clicks and the first truck: 9 small pieces on the lot; Gary wants a can. | `04_n1_first_order` |
| 0:45 | 12:19 | First delivery: **+6 Shinies** against a 1,100 quota. It feels like nothing. | `05_n1_first_merges` |
| 0:57 → 2:00 | 12:31 → 1:35 | A **NEW!** banner every ~20 s: bag, boot. **The best stretch of the night.** | `06_n1_bag` |
| 2:32 | 2:06 | Toaster, and right away a **JACKPOT** for one: +176. **The peak.** | `08_n1_toaster`, `09_n1_jackpot_paid` |
| 3:15 | 2:49 | Purse 623. **Nothing new from here on.** At a good pace the lot is nearly empty and you wait on the Dumpster. | `10_n1_t2_50` |
| 4:50 | 4:30 | At a slow pace (~3 s per action) the lot is a carpet of smelly caps, Stink 36. | `11_n1_cap_carpet_4am` |
| 5:41 | 5:15 | Quota met. At a fast pace (~0.4 s per action) the lot is empty and Overtime +138 waits for 6 AM. | `12_n1_quota_met_empty_lot` |
| 6:31 | 6:00 | Report: PASSED, best junk **Busted Toaster** (tier 6 of 12), 112 merges, 36 orders. | `14_n1_report` |

**After night 1, a newcomer:**
- **Understands everything.** Merge pairs, drag to raccoons, Dumpster, quota, smelly junk, Clock
  Out. The teaching works now.
- **Feels** charmed by the cast, pleased at the jackpot, and then **flat**. The toaster at 2:32 is
  the last surprise.
- **Wants** to know what tiers 7-12 are (the silhouettes in the Almanac, `25_almanac_after_n3`).
  That's the real hook, but the game won't pay it off for another 40+ minutes. The Swap Meet offers
  "lid 6 → 8" and "refill 5s → 4s" (`15_swapmeet_n1`), which isn't a want.

**The hook** is the climb from cap to toaster in the first 2.5 minutes, with a raccoon cheering
each new thing. **Attention drops at about 3:00**, when the climb stops at the toaster. From then on
the screen is one of two things:
- **A good player:** a mostly empty brown grid with 6-10 tiny items.
- **A slow player:** a red carpet of caps.

## Why people quit (with timestamps)

| When (real time) | Why | Evidence |
|---|---|---|
| **~3:00** | The climb stops. No new item appears for the rest of the night, and the next 3 minutes are the first 3 again. | Night 1: last new item at 2:32 (`08`). Nothing new on the report but the 6 items from the first 2.5 min (`14`). |
| **~9-10 min** (night 2, ~3 min in) | Night 2 is night 1 again: same items, best junk a toaster again. "Two trucks" means more caps, not a new way to play. **Most likely quit point.** | `18_n2_mid`, `20_n2_report`. Night 2 best tier 6. The bot sat at 1,082-1,188 of 1,400 from 4:10 to 4:56, and the jackpot met the quota at 5:01. |
| **~15-18 min** (night 3) | Takeout Tuesday narrows the game further (orders only want tiers 3-4). My 52 actions in that stretch were the same three moves over and over: merge caps, merge cans, hand in a takeout box. | `23_n3_mid`. Best tier on night 3: **4** (sim average 4.0). |
| **~25-30 min** (nights 4-5) | The players who stay this long are chasing the silhouettes. Night 7 at 5 AM still looks exactly like night 1: caps, cans and a +6 order (`28_n7_5am`). | Sim best tier on nights 4-9 averages **5.7-7.3**. The big stuff is basically night 10 only (`29_n10_mid`). |

**Two extra signs the core is a throughput task, not a decision game:**
- 24 of my first 36 actions on night 2 (67%) were hand-ins of tier 1-4 junk. On night 3 the lot held
  7-16 of 63 cells until 3:30 AM.
- How the night went depended almost entirely on actions per second. At 0.4 s per action I starved
  (empty lot, "wait wait wait"). At ~3 s I was swamped (a cap carpet, Stink 36). Nothing in between
  felt like a choice.

## Bland or not

**What's special (keep and lean on it):**
- **The cast.** Four raccoons with voices, taste and lines, plus Inspector Possum (walks on at 75,
  faints on a pass, wears a name tag). Funny, specific, made for clips.
- **The gulls.** The only thing that surprises you. They land, eat your junk (one gull ate **12
  pieces** on my night 2) and gang up, and you can farm them up to a God that lays a Golden Egg.
  It's the most alive system in the game.
- **Clock Out / overtime.** A push-your-luck bet is rare in a merge game and reads clearly on screen
  (`12`: "OVERTIME +138 / doubles at 6 AM / lost if shut down!").
- **The finale.** Night 10's big junk, the crowning beam and The End are a real payoff (`29`, `30_king_0`,
  `33_the_end_b`).

**What's generic:**
- **The verb.** Same+same on a grid, filling orders, is the Merge Mansion / Travel Town core without
  its meta layer.
- **Position never matters.** Any piece can be dragged onto any piece, anywhere. There's no spatial
  puzzle (Triple Town, 2048, Suika are all *about* where things go).
- **The orders follow the lot.** Raccoons ask for what you have, so you never plan toward a goal.
  The game hands you the answer.
- **The nights are modifiers.** The ten nights are fixed multipliers on one loop, in a fixed order,
  with a fixed shop, so every run is the same run.

**Does the name deliver? No.** "Alchemy" promises turning *different* things into something new and
surprising (Little Alchemy, Vampire Survivors' evolutions). Here:
- Two of the same make the next tier, along one chain.
- The Almanac has **19 entries** in all: 12 junk tiers, 5 gulls, 2 specials. A newcomer has 9 of
  them after night 3 (`25_almanac_after_n3`).
- There's no recipe, no experiment and no "what happens if I drop the boot on the toaster?". A
  different item just swaps places.

**Does a player feel a future?**

| | Present? |
|---|---|
| A map | No. |
| Unlocks to chase | Only Endless, after the King. |
| A mystery | Only the six silhouettes in the Almanac. It's the right instinct, and the only promise the game makes. |
| A build to plan | No. Six stat lines, all bought eventually: 9.9-11.2 of 16 levels by night 10 in the sim. |
| Endless | Also no future. It's a longer night 1 that banks Shinies into the same six stat lines (`35_endless_report`: Bank 13,881). |

**Through other eyes:**
- **Game-store browser.** The capsule screenshot that sells it is the title screen or night 10. An
  in-play screenshot from nights 1-7 reads "generic merge game, tiny red things on brown dirt"
  (`10`, `28`).
- **Streamer.** Good for one 15-minute segment: the possum, a storm-off, gulls eating the lot. But
  half of each night is quiet, a cap is about 21×15 px on a full-screen 1080p stream, and the best
  clip (the crowning) is an hour in.

## Variety and decisions

- **Do runs differ?** No. Same 10 nights, same order, same rules, same shop. The seed only changes
  the drop order.
- **Decisions during a night:**
  - *Which pair to merge:* hardly matters.
  - *Hold or hand in:* orders adapt to your lot, so you hand in.
  - *Clock Out:* the 1.3 s bot never needs to. The sim's average peak Stink at 1.3 s is **0-6 on
    every night**, so staying is always right. At 1.8 s it clocks out on 20-50% of tries on nights
    4-7 and 9.
  - *Crush or merge gulls:* the one real trade-off.
  - *Where to put things:* never matters.
- **Decisions between nights:** one stat upgrade, and the **TONIGHT!** tag picks it for you.
- **Does one strategy win?** Yes: hand in what's wanted, merge the highest pair, click the Dumpster
  when idle. My throwaway script did exactly that from 3:00 on night 1 and through the openings of
  nights 2-3, and the built-in bot finished both nights the same way. Every night passed. The sim
  bot, just as simple, is **crowned 20/20** at both 1.3 s and 1.8 s.
- **Buildcraft:** none. Nothing combines with anything, no upgrade changes a rule, and there are no
  synergies.

## Feel: loud, gross, over the top?

**Polite, with gross *labels*.** The groundwork is good:
- items wobble, flies circle, and stink lines rise off ripe junk;
- coins fly to the purse, slams land, and a raccoon reacts to every order.

But the volume never goes up:
- **Shake is small.** A merge's screen shake is capped at 3 logical px (`fx.ts:323`). A
  Fridge + Fridge → Dead Car gets a "BEAUTIFUL" popup and a few sparks (`51_merge_car_a-c`).
- **No momentum.** There's no hitstop, no combo or streak, and no chain reaction: every merge is a
  single event (no `combo` or `streak` anywhere in `src/`).
- **Big doesn't look big.** A Dead Car is a 32 px cell, the same size as a bottle cap, and on the
  drop it sits *under your paw*, so the payoff is hidden at its own reveal.
- **Small numbers.** "+6", "+9" and "+21" against quotas of 1,100-4,150. The money never explodes.
- **The gross is mostly words.** "GROSS!", "pee-yew", "IT REEKS!" over small green wavy lines. There
  is no splat, no stain left on the dirt, no raccoon sniffing or eating what you hand over.
- **A quiet screen.** The board is 28% of the screen, and for half of each night it's mostly empty
  dirt. A typical frame is dark, brown and still (`10`, `18`, `23`).

## Display

The game draws 640×360 and letterboxes it in ink. A window is only "filled" when it is exactly
16:9. A maximised browser on a 16:9 monitor is always *wider* than 16:9 (the toolbar takes height),
so the most common desktop setup always gets side bars.

| Window (CSS px, DPR 1) | Scale | Bars | Window used | Shot |
|---|---|---|---|---|
| 1920×945 (1080p browser) | 2.625 (fit) | 120 px left and right | 87.5% | `40_display_1920x945` |
| 1536×730 (1080p laptop at 125%, in CSS px) | **2** (whole; fit was 2.03) | 128 px L/R, 5 px T/B | 82% | `40_display_1536x730` |
| 1280×720 | 2 | none | 100% | `40_display_1280x720` |
| 1440×900 (16:10 MacBook) | **2** (whole; fit was 2.25) | **80 px L/R and 90 px T/B** | **71%** (worst) | `40_display_1440x900` |
| 2560×1300 | 3.61 (fit) | 124 px L/R | 90% | `40_display_2560x1300` |
| 1366×657 | 1.83 (fit) | 99 px L/R | 85.5% | `40_display_1366x657` |
| 1024×768 (4:3) | 1.6 (fit) | 96 px T/B | 75% | `40_display_1024x768` |
| 1600×1200 (4:3) | 2.5 (fit) | 150 px T/B | 75% | `40_display_1600x1200` |

- **The snap down to a whole number costs space.** `WHOLE_FILL = 0.85` in `screen.ts` makes 1440×900
  drop from a 2.25x fit (90%) to 2x (71%). At 1536×730 the snap costs only 1.4% of size, which is
  fine; the side bars there come from the aspect ratio.
- **Fractional scales look fine.** At 2.625x the fence and the font show the expected 2-vs-3-pixel
  rows, but at that size nobody will notice. The pointer maps exactly at every size I tried.
- **Ink bars look like a broken page.** The night sky and dirt end in a hard edge.
- **To fill without cropping:**
  1. Drop the whole-number snap (or raise `WHOLE_FILL` to about 0.97).
  2. Make the logical canvas **flexible**: 360 high and 640-780 wide for wide windows, 640 wide and
     360-480 high for 16:10 and 4:3. Extend the sky, fence, lane and dirt into the extra space, and
     anchor the HUD corners to the edges.

  | Window | Flexible canvas | Scale |
  |---|---|---|
  | 1920×945 | 731×360 | 2.625 |
  | 1536×730 | 757×360 | 2.03 |
  | 1440×900 | 640×400 | 2.25 |
  | 4:3 windows | 640×480 | — |

  The cheapest stop-gap is to paint the backdrop across the bars instead of ink.
- **Not checked:** real DPR 1.25 or 1.5 screens (I measured at DPR 1 only). A 1920×1080 laptop at
  125% is 1920×912 device pixels, which gets a 2.53x fit.

**Noticed in passing (P2):**
- "CRUSHER pays 1/tie" is clipped at the right edge on every night with a paying Crusher, at every
  size (`17`, `40_*`).
- The quick-start banner runs "TONIGHT" into "Two trucks" with no gap (`17_n2_start`).
- The merge result is drawn under the paw cursor right as it appears (`51_merge_car_a`).
- `favicon.ico` 404s in the console.

---

## What would make it great

Ranked by impact on "would a regular person keep playing and tell a friend". Proposals 1-4 and 7
change the game's structure.

| # | Proposal | Problem it solves | Mechanic | Cost | Risks |
|---|---|---|---|---|---|
| 1 | **Make the alchemy real: cross-recipes** | The name doesn't deliver. There is no discovery and nothing to tell a friend about. | Keep same+same tier-ups, and add 25-40 **recipes from different junk**:<br>- Toaster + Leaky Bag = **Electric Soup**<br>- Boot + Tire = **Monster Truck Shoe**<br>- Gull + Takeout = **Gull With A Fork**<br>- Mattress + Fridge = **Panic Room**<br><br>Drop A on B: if it's a recipe it fuses, with a big NEW! reveal. If not, it swaps (as now) with a "nope" wiggle and +1 Stink, so spamming isn't free. The Almanac becomes a recipe book with ??? slots and riddles ("something that sparks + something that leaks"). Raccoons order recipe items ("Linda wants something you can sleep in *and* drive"). | L (content plus ~30 sprites via `pixel-art/`) | Discoverability; payout balance; the swap fallback must stay clear. |
| 2 | **Roguelite run: draft rule-bending "Contraband"** | Every run is the same, there's no buildcraft, and the Swap Meet is a checklist. | After each night, **pick 1 of 3 random perks** that bend a rule (Balatro jokers, Luck be a Landlord symbols), with 4-5 slots so they stack and synergise:<br>- *Compost Heap:* smelly junk merges +2 tiers<br>- *Raccoon Mafia:* caps pay x3, gulls x2 as often<br>- *Hot Sauce:* a toaster ignites its neighbours +1 tier<br>- *Pyramid Scheme:* each scrap order raises the next one's pay 10%<br>- *Possum Bribe:* the first shutdown each run is forgiven<br><br>Night rules come from a pool, with a rising quota (an ante) and a boss night every 3. Keep the authored 10 nights as Story mode. | L | Balance (the sim must model perks); scope; some perks will be dull at first. |
| 3 | **Chain reactions and a Stench Streak** | No luck moments and no momentum; it feels polite. | When a merge result lands **next to** an identical piece, it auto-merges again (a cascade), with rising pitch, a bigger shake and "COMBO x3". Merges within 1.5 s of each other build a streak that multiplies pay. One drag can now set off a lucky avalanche (the Suika moment), and *where* you drop starts to matter. | M | Balance: cascades must be common but not constant; the sim needs to model them. |
| 4 | **Big junk sooner, and big junk that's *big*** | The funniest content (tiers 7-12) is gated for 40-60 min, and a Dead Car is cap-sized. | Night 1 ends with a guaranteed big moment at ~4 AM ("something fell off the truck": a Tire). Tiers 8+ take **2 cells** (cart 2×1; fridge, car and King 2×2), so big junk crowds the lot and *placement* matters. Merge reveal: an 80 ms freeze, the result pops 2x above the paw, then settles. | M (2-cell items are L) | 2-cell items touch the board, drag, truck-landing and order rules. |
| 5 | **Shorter, sharper nights (about 3.5 min)** | Each night spends 2-3 calm minutes before anything happens, which is where people quit. | 35 s per hour. The truck ramps from 1 AM, not 3, with the same peak. Ten nights become about 35 minutes, and a run of #2 becomes a 25-30 minute "one more run" unit. | S (tuning, then re-sim) | Re-tune quotas and Stink; slow players need the ramp to stay fair. |
| 6 | **Daily Dump with a share card** | Nothing brings anyone back tomorrow, and nothing is shareable. | One seeded night a day (a random rule and starting perks), one try. The end screen copies a Wordle-style card: `Dumpster Alchemy #42 · 🦝 4,812 · 👑 Fridge · 🤢 63 · 🐦 x7`. No server needed. A leaderboard can come later. | S/M | Weak until runs vary (#2); a leaderboard needs a backend and anti-cheat. |
| 7 | **A future on a map: more lots** | No map, no unlocks to chase, Endless banks into a finished shop. | Crowning the King opens **Lot 10, The Marina** (a fish chain, gulls everywhere), then the Mall Loading Dock, the Hospital Back Door (biohazard chain) and the County Fair. Each has its own 8-12-tier chain, a new raccoon, a King-equivalent and a rule set, on a hand-drawn county map with locked lots. Banked Shinies unlock lots instead of buying stats. | L | Content scope (art cap: build chains with the `pixel-art/` scripts); each lot needs a sim pass. |
| 8 | **Raccoon story arcs** | The cast is the best asset, but static: the same lines every night. | Each regular has a 3-4-night want. Lil' Pete builds a go-kart from a tire, a cart and a toaster, then rides it across the lane. Linda redecorates with a mattress and a fridge. Gary's boss shows up. Deliveries change their lines and props. Cheap writing, high charm, made for streams. | S/M | Writing time; must not slow the order flow. |
| 9 | **Juice pass: make it loud and gross** | The juice is polite and the numbers are tiny. | - Hitstop on tier 6+ merges.<br>- A **splat decal** that stains the dirt for the rest of the night (the lot remembers your shift).<br>- Shake up to 6 px on big merges.<br>- Coins burst across the screen on a jackpot.<br>- The raccoon sniffs, licks or hugs the delivered item.<br>- **All values x10** ("+60", "+1,760").<br>- Gulls steal a piece *from under the paw*. | S/M | Readability during a flood; motion sickness (add a "reduce shake" toggle). |
| 10 | **Stink as a resource, not only a fail meter** | Good players never see the Stink (sim peak 0-6 at 1.3 s), so the jar and the possum do nothing for them. | Ripe junk sells for x1.5 to Mange ("aged"). Above 50 Stink, rare customers appear (the **Fly King** orders ripe items for big pay). You can "vent" Stink into a gull swarm. It becomes a push-your-luck dial all night, not just at Clock Out. | M | Must stay readable; overlaps with Clock Out's bet. |
| 11 | **The Dumpster evolves by merging** | Lid and Hinges are spreadsheet buys. | The Dumpster is an item. Feed it parts (Bin Juice, a Golden Egg, a Dead Car) to evolve it: Dumpster → Roll-off → Garbage Truck. Each form changes what it spits (tier odds, gulls, specials). This is Merge Mansion's producer chain. | M | Fits best inside #2 or #7. |
| 12 | **Fill the window** | Ink bars on nearly every real window; 1440×900 uses 71%. | Always use the fit scale (or `WHOLE_FILL` about 0.97), plus a flexible logical canvas (640-780 × 360-480) with the backdrop extended and the HUD anchored to the edges. Stop-gap: paint the backdrop into the bars. | S (fit) / M (flexible) | Slight pixel unevenness (already accepted); layout code assumes 640×360. |

### What I'd cut

- **Bigger Lid and Greased Hinges.** Comfort buys, by `PLAN.md`'s own measurement. Replace them with
  #2's perks.
- **Takeout Tuesday as written.** It narrows a thin game further and was the most repetitive night
  I played. Make it a recipe night (#1) or drop it.
- **Caps from the truck after night 2.** Start loads at tier 2. The cap carpet is the image of the
  game's sameness.
- **The fixed 6-minute night** (see #5).
- **Endless as it is now** (a longer night 1 that banks into a finished shop). Replace it with the
  Daily (#6) or the run mode (#2).
- **The Extra Raccoon at 6,000.** A 4th slot that mostly adds more of the same orders. Fold it into
  a perk.

### If you only do three things

1. **Recipes (#1).** That's the alchemy, the discovery and the tell-a-friend moment.
2. **Cascades and big junk early (#3, #4).** The feel and the payoff, in the first 5 minutes.
3. **Perk draft with shorter nights (#2, #5).** Variety, buildcraft and "one more run".
