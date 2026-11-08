# Dumpster Alchemy — Design

A janky, loud, slightly gross merge game. You run the night shift at the **County Dump** for a crew
of raccoons: Lot 9, then The Marina, then Mount Trashmore. The garbage truck keeps dumping junk on
your patch of dirt. Merge two of the same junk into better junk, brew two *different* things into
something stranger, feed the raccoons' orders, and keep the stink down until 6 AM. At the top of
the pile sits the **Trash King**.

**On purpose, it's shitty.** It never looks broken, but it is crude, wobbly, wet and over the top.
Every merge squelches, items jiggle, flies circle the good stuff, and the UI is cardboard and duct
tape. Juice comes before polish.

This file describes the game **as built** (v2, 2026-11-08). The exact numbers live in `src/data/`
(`tuning.ts`, `items.ts`, `recipes.ts`, `nights.ts`, `contraband.ts`, `raccoons.ts`). The v2 plan
and each pillar's "As built" notes are in `docs/V2.md`; the player-facing list is `CHANGELOG.md`.

## The loop in one breath

The truck dumps junk → you drag pairs together to merge them up (park twins side by side and they
**cascade**) → drop two different things together to **brew** a tool or a treasure → hand the
raccoons what they want for **Shinies**, fast, so the **Stench Streak** builds to a **Raccoon
Rave** → junk left sitting goes **smelly** and the **Stink** climbs → meet the quota, then bet on
overtime → take a free **Contraband**, shop the **Swap Meet**, pick a fork on the **county map** →
next night. Three strikes and you're **FIRED**; crown the King on night 10 and the run is won.

## The board

- A **9 × 7 grid** of 32 px cells: packed dirt under a sodium streetlight.
- **Drag** an item onto:
  - the **same item**: they merge into the next tier, in the target cell;
  - a **different item**: they brew if the pair is a **recipe** (below), otherwise they swap;
  - an **empty cell**: it moves; a **raccoon's order**: it's delivered, if they want it;
  - the **Crusher**: it's destroyed (8 s cooldown; pays only on Bulk Pickup or with the upgrade).
- Merges are **two-of-a-kind**; the top tier of a chain can't merge. Junk still in the air owns
  its landing cell (a shadow shows it). Cells the Possum condemns are taped off for the night.

## The Junk chain (12 tiers)

| Tier | Item | Value | Quip on first discovery |
|---|---|---|---|
| 1 | Bottle Cap | 20 | "A start." |
| 2 | Crushed Can | 40 | "Somebody stepped on this. Good." |
| 3 | Takeout Box | 90 | "There's a fork in it. Still." |
| 4 | Leaky Trash Bag | 210 | "Don't squeeze it." |
| 5 | One Boot | 500 | "Where's the other one? Don't ask." |
| 6 | Busted Toaster | 1,200 | "Makes toast. Also sparks." |
| 7 | Bald Tire | 2,900 | "Smells like a highway." |
| 8 | Shopping Cart | 6,900 | "One wheel has opinions." |
| 9 | Stained Mattress | 17,000 | "We don't talk about the stain." |
| 10 | Fridge (door hanging) | 40,000 | "Something in the crisper is alive." |
| 11 | Dead Car | 95,000 | "Runs great. Doesn't run." |
| 12 | **The Trash King** | 230,000 | A raccoon on a mattress throne, hubcap crown. The end of the pile. |

Value grows **about 2.4× per tier** (`1.5 × 2.4^(tier-1)`, rounded like a price tag, ×10 by
`value.scale`), so one big piece beats the small pieces that made it: the reason to hold junk back.

## Seagulls: the side chain

Any junk merge has a small chance (**4%**, times the rule's and the Contraband's multipliers; none
on the First Shift) to attract a **Seagull**, which swoops onto a random empty cell (or eats
whatever it lands on). Gulls don't go smelly.

| Tier | Gull | What it does on the board | Order pay |
|---|---|---|---|
| G1 | Seagull | Hops to a neighbouring cell every ~6 s; eats junk up to tier 3 | 200 |
| G2 | Fat Gull | Hops every ~8 s; eats up to tier 5 | 600 |
| G3 | Gull Gang | Stays put; screams every ~10 s and shuffles its 8 neighbours | 1,500 |
| G4 | Gull Boss | Wears a stolen chip bag; pecks 20 Shinies out of your purse every ~4 s | 4,000 |
| G5 | **The Gull God** | Rises off the board in a beam and drops a **Golden Egg** | – |

Crush the gulls, or merge them up for the Egg (drop it on any junk: **two tiers** up). Once a gull
has shown up, 6% of orders want one (Gary 15%, always a Fat Gull. Don't ask.). Gulls brew too.

## Alchemy

Drop a piece on a **different** piece. If the pair is a recipe (either way round), they **brew**:
both go, and the result lands in the target's cell. Any other pair swaps.

- **The hover.** Over a recipe partner the held piece bubbles a **"?"**; over a pair you've brewed
  before, it previews the result. A first brew freezes the board and slams **"NEW RECIPE!"**.
- **Tools** are one use: drop them on their target. They never merge, swap or sell.
- **Treasures** fill **any** raccoon's whole order at that order's rate (the streak too; not the
  scrap x2), each worth about 2x its ingredients. Brews never go smelly; gulls won't eat them.
- **Finding them.** The Almanac's **Recipe Book** (20 riddles, kept across runs); from night 2 a
  raccoon may share a riddle (14% of arrivals), and Grandma Mange teaches the first.

| # | Ingredients → Result | Kind | What it does (value for treasures) |
|---|---|---|---|
| 1 | cap + can → Hobo Wind Chime | treasure | 130 |
| 2 | can + takeout → Mystery Stew | tool | on an order card: patience refills, the order pays x2 |
| 3 | cap + bag → Bag Bomb | tool | on junk: the 3×3 bursts; each piece pays its value (or Crusher pay x3) |
| 4 | takeout + bag → Garbage Burrito | treasure | 650 |
| 5 | cap + boot → Piggy Boot | treasure | 1,200 |
| 6 | can + boot → Boot Coffee | tool | anywhere: the truck stalls 20 s, every raccoon's patience refills |
| 7 | bag + toaster → Electric Soup | tool | on junk: every junk piece in the 3×3 goes up a tier (never into the King) |
| 8 | can + toaster → Junk Magnet | tool | on a piece: every one like it flies over and they merge as far as they go |
| 9 | gull + takeout → Gull With A Fork | tool | anywhere: eats every cap and can on the lot, paying x3 each |
| 10 | fat gull + bag → Chum Bucket | tool | anywhere: every gull on the lot goes up a tier |
| 11 | tire + takeout → Tire Fire | tool | on junk: its row burns, each piece paying x2; +6 Stink |
| 12 | mattress + toaster → Electric Blanket | tool | anywhere: all smelly junk goes fresh, Stink −25 |
| 13 | fridge + takeout → Leftovers | tool | on a piece: a copy lands in the nearest empty cell |
| 14 | boot + tire → Monster Truck Shoe | treasure | 6,900 |
| 15 | fat gull + toaster → Rotisserie Gull | treasure | 4,100 |
| 16 | cart + tire → Go-Kart | treasure | 23,000 (Lil' Pete's dream) |
| 17 | gull boss + cart → Getaway Cart | treasure | 21,000 |
| 18 | mattress + cart → Shopping Bed | treasure | 47,000 |
| 19 | mattress + fridge → Panic Room | treasure | 110,000 |
| 20 | car + fridge → Ice Cream Truck | treasure | 320,000 (the jackpot of jackpots) |

## Momentum

- **Cascades.** A merge's result next to an identical idle piece (orthogonally) merges again 0.18 s
  later, into the newer cell, and so on (junk and gulls). Each link is a real merge; "COMBO x2 /
  x3…" climbs in colour and pitch. Chain Gang adds diagonals. So park pairs next to each other.
- **The Stench Streak**: a heat meter, 0 to 1, a fly swarm under the night bar. A merge adds 0.037
  (+0.003 per tier), a cascade link 0.06, a delivery 0.038 (+0.025 if it completes the order), a
  brew 0.1 (x2.5 until tonight's first Rave). It holds 1.6 s after each, then cools 0.3/s. Pay
  steps at 0.25 / 0.5 / 0.75 heat: **x1.25 / x1.5 / x2** (Streaker: x1.75 / x2.5 / x4).
- **The Raccoon Rave.** Full heat starts 8 s of deliveries at **x3** (one above the streak's top:
  x5 with Streaker), free Dumpster clicks, the night song at 1.33x with a rave layer, dancing
  raccoons and light beams. About 1.4 a night at an action every 1.8 s, 3 at 1.3 s.

## Where junk comes from

- **The Dumpster** (right column). Click it (or Space) to spit out junk: tier 1 (70%), 2 (25%),
  3 (5%). 6 lid charges, one back every 5 s. Bin Juice and bought tools fly out of it at midnight.
- **The Truck**. First dump at 0:06, then every 10 s down to 7 s, with loads growing from 4-7 to
  5-7 items: gentle until 1 AM, then ramping to full pace by 6 AM. Tiers 1/2/3 at 60/30/10%,
  before the act and the rule. The HUD shows the countdown and **"next load vs room"**.
- **Night 1, 3 AM**: "SOMETHING FELL OFF THE TRUCK!" A guaranteed Bald Tire bounces onto the lot.
- **Angry raccoons** kick the Dumpster over: 3 junk onto the board (and 8 Stink).

## Raccoons and orders

Three order slots down the left side. A raccoon wants 1-2 items with a **patience bar** (60-90 s,
by raccoon and rule). Each item pays its value times the order's pay (the raccoon, the kind of
order, the rule, the Contraband) times the streak; finishing early adds up to **50% of the
order's value**. The regulars: **Gary** (hard hat, wants it NOW: patience x0.75), **Linda**
(cat-eye glasses, asks a tier higher, pays x1.4), **Lil' Pete** (tiny, one huge thing two tiers
up, patient), **Grandma Mange** (shawl, patient, pays x1.6). Their lines name what they want.

- **Orders follow the lot**: each tier on the board weighs its count, a pair weighs toward what it
  would merge into, and one tier above your best is the stretch. Regular orders start at tier 2.
- **Scrap orders**: 3-5 caps and cans, x2 per piece, 1.4x patience; likelier the more small junk
  is on the lot (12%, +3% per small piece past four, at most 55%).
- **Night 1's first order** is a Crushed Can. **Out of patience**, a raccoon storms off angry.
- **The Jackpot**: once a night, between 1:00 and about 4:15 AM (once your best junk is within two
  tiers), a raccoon wants one tier above your best, within the act's range (5-6 at Lot 9, 6-7 at
  the Marina, 7-8 at Mount Trashmore; none on Spring Cleaning). It waits 110 s and never pays more
  than **28% of the quota**.
- **Big Spender** (a 4th slot, with Big Spender's Card): the top of your lot or one above, 1.5x
  patience, 1.25x pay.

## Stink and losing

- **Stink** runs 0 to 100: a sludge jar with flies, and an arrow for which way it's heading.
- **Junk ripens.** A piece left unmerged goes **smelly** after 30 s (a cap), 1.5 s sooner per
  tier, never under 18 s, times the act and rule (Lot 9 x1.6 slower; Heat Wave x0.6). Each smelly
  piece adds 0.035 Stink/s, +0.008 per tier above 1 (to tier 7). **Merging, brewing, delivering
  or crushing** clears it; moving doesn't.
- A crowded lot adds 0.2/s at 75% full, up to 1/s when full; each truck item that can't land adds
  **5**; a raccoon storming off adds **8**. It fades 0.2/s while the lot is under 70% full.
- At **25 under the limit** Inspector Possum walks on as a warning. At the limit (**100**; 75 on
  The Inspection; −10 with Overtime Junkie) he shuts the night down. After the quota it's still a
  pass, but the overtime is lost. The report says what raised the Stink.

## A night (a "shift")

- 12:00 AM to 6:00 AM, **35 s per hour**, so about 3½ minutes a night.
- Each night has a **Shinies quota** and **one rule**. Meet the quota and "QUOTA MET!" slams in
  with a **Clock Out** button. Everything earned after it is **overtime**, and it's a bet:
  - **Clock Out** (C): bank everything now, overtime at x1.
  - **Stay till 6 AM**: the overtime is paid **twice** (x3 with Overtime Junkie).
  - **The Stink maxes out first**: still a pass, but the Possum confiscates the overtime.
- **Miss the quota** (or get shut down before it): a **strike**; keep half and retry the night.

## The run

A run is **10 nights in three acts** across the County Dump. Each act has its own backdrop, a base
twist on every night in it, a pool of fork rules, and a **boss** night at the end.

| Act | Nights | Every night there | Fork pool | Boss |
|---|---|---|---|---|
| 1 **Lot 9** | 1 First Shift, 2-3 forks, 4 boss | loads x1.1, junk ripens x1.6 slower, jackpot 5-6 | Garbage Day, Potluck, Rave Night, Heat Wave | The Inspection |
| 2 **The Marina** | 5-6 forks, 7 boss | truck x1.08 slower, tiers 50/33/17%, jackpot 6-7 | Seagull Season, Rush Hour, Garbage Day, Potluck, Full Moon | Gull God Raid |
| 3 **Mount Trashmore** | 8-9 forks, 10 boss | truck brings tier 4s (45/35/15/5%), jackpot 7-8 | Bulk Pickup, Full Moon, Heat Wave, Rush Hour, Rave Night | Spring Cleaning |

**Quotas**: `TUNING.run.quota` times the rule's multiplier (forks x0.85-1.2; the bosses' x0.8 is
in below), x1.4 on ELITE, rounded to the 100 (to the 500 from 10,000):

| Night | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Quota | 6,000 | 7,000 | 11,500 | 18,500 (boss) | 26,000 | 31,000 | 37,500 (boss) | 43,000 | 45,000 | the King |

**The map** (between nights): the county from above, a dotted road of bottle-cap nodes, the crew's
beat-up truck for "you are here", the bosses ahead. Before each fork night you **pick one of two**
nodes, dealt by the run seed with different rules from the act's pool and different **reward
tags**: **LOOT** (an extra Contraband pick after it), **SALE** (the Swap Meet after it is 25% off),
**JUICE** (a free Bin Juice in the Dumpster) or **ELITE** (quota +40%, but the loot is rare).

**The rule pool** (`src/data/nights.ts`; "Quota" is the rule's multiplier):

| Rule | What changes | Quota |
|---|---|---|
| First Shift (night 1) | truck interval x0.95, loads x0.9, patience x1.25, **no gulls**, ripening x1.4 slower, Stink gains x0.6; one-time hints | x1 |
| Garbage Day | **two trucks**: half the load, twice as often | x0.9 |
| Potluck | brewed treasures pay **x1.5**; the night card shows a recipe you haven't found | x0.95 |
| Rave Night | the streak heats **twice as fast** | x1.1 |
| Heat Wave | junk goes smelly much faster (ripening x0.6) | x1 |
| Seagull Season | three times the gulls; gull orders 2.5x as often, paying **x2** | x1.05 |
| Rush Hour | raccoons have **half the patience** and pay **x1.5** | x1.2 |
| Full Moon | every merge has a **10% chance to skip a tier**; 1.75x the gulls | x0.85 |
| Bulk Pickup | big junk (tiers 1-5) and the **Crusher pays x3** (30 a tier without the upgrade) | x1.1 |

**The bosses:**

- **The Inspection** (night 4): shut down at **Stink 75** (warned at 50), and each hour on the
  hour the Possum **condemns a random empty cell**: nothing lands, moves or hops there.
- **Gull God Raid** (night 7): gulls x3, gull orders 3x as often at x1.5. Each hour on the hour
  the Gull God **steals your best junk**, unless you've handed a raccoon a gull or crushed one
  since the last raid. The sky shows him circling: "FED / HUNGRY · swoops in Ns".
- **Spring Cleaning** (night 10): **build the Trash King** by 6 AM. The truck brings tiers 2-8
  (mostly 4-6) in smaller loads, and it reeks: ripening x0.6, Stink gains x1.45, fading x0.35.
  Raccoons want small stuff (tier 5 at most), are patient (x1.4) and pay in junk: three times in
  four, a filled order kicks a piece one tier above its best onto the lot. No jackpot. Each retry
  gets a Bin Juice per failed try (up to 3) and 10% less Stink gain per try (down to 60%).
  Crowning the King (a ceremony on a sodium beam) wins the run.

**Balance** (final 60-run campaigns, 2026-11-08): runs won 97% at an action every 1.3 s, 63% at
1.8 s, 18% at 2.5 s (reaching night 6.4). Night 1 passes 92% even at 3.0 s. At 1.8 s act 1's lot runs
20-24% full and the King night passes 68% of tries. Slow players lose to the quota, not the Stink.

## Contraband

Rule-benders, Balatro-joker style. **5 slots** a run (Lil' Pete: 4). After every passed night you
get a **free pick of 1 of 3** (two picks after LOOT; common/uncommon/rare at 60/30/10, or 0/55/45
after ELITE); with the slots full, a new one replaces one you hold, or you skip. Seven start
locked, so the first run's pool is 18. The old Swap Meet upgrades live on in this list.

| Contraband | Rarity | Effect |
|---|---|---|
| Compost Heap | uncommon | a merge with a smelly piece goes up **two** tiers |
| Raccoon Mafia | common | caps and cans pay x3 in orders; gulls come twice as often |
| Hot Sauce | uncommon | making a Toaster zaps a junk neighbour up a tier |
| Pyramid Scheme | common | each scrap order tonight pays 10% more than the last |
| Possum Bribe | rare | forgives one shutdown (Stink drops to 50), then it's gone |
| Double Bagger | common | the Dumpster spits two per click; 2 fewer lid charges |
| Gull Whisperer | common | gulls never eat junk; gull orders pay x2 |
| Overtime Junkie | uncommon | overtime pays x3 at 6 AM; Stink limit −10 |
| Chain Gang | rare | cascades also go diagonal |
| Streaker | uncommon | streak window +1 s; the streak tops out at x4 |
| Alchemist's Apron | rare | every brew makes two |
| Sticky Fingers | common | each delivery has a 20% chance to pay double |
| Industrial Crusher | common | no Crusher cooldown; it pays 30 a tier |
| Air Freshener | common | Stink gains −35%; it fades twice as fast |
| Plastic Owl | common | 60% fewer gulls; they won't eat past a can |
| Big Spender's Card | uncommon | a 4th order slot, for Big Spenders |
| Midnight Snack | common | deliveries before 1 AM pay x2 |
| Golden Goose | rare | Gull Gang + Gull Gang lays the Golden Egg |
| Fly Farm | uncommon | each smelly piece earns 3 a second; Stink gains +25% |
| Clearance Card | common | Swap Meet prices −25%, rerolls half price |
| Recycling Bin | common | crushing a piece gives back a lid charge |
| Junk Mail | uncommon | the truck never brings bottle caps |
| Rat Race | uncommon | raccoons have half the patience and pay x1.75 |
| Grandma's Recipe Card | common | each night, one recipe you haven't found is revealed |
| Bigger Lid | common | +4 lid charges, refilling 30% faster |

## The Swap Meet (the shop)

After the loot and before the map (or before a retry, if you like). It spends the run's **bank**:
a passed night banks its purse, a failed one half. An average run ends with about 425k unspent.

- **The stall**: three Contraband (one of each rarity where it can), **Bin Juice** (a wildcard
  that merges with anything) and one random **brewed tool**; carry up to 3 of each. They fly out
  of the Dumpster at the next midnight; whatever's still on the lot at 6 AM is gone.
- **Prices**: Contraband 12,000 / 18,000 / 26,000 by rarity, Bin Juice 4,000, a tool 4,500, all
  times the act's ante (x1 / x1.7 / x2.4). SALE and the Clearance Card take 25% off each.
- **Reroll** the three Contraband for 2,000, then 2,000 more each time this visit (Clearance:
  half). **Sell** a Contraband for half its price at this act's ante.

## Strikes

- **3 strikes a run** (Possum write-ups), and they never heal. A failed night is a strike: SHUT
  DOWN on the report, half the Shinies kept, and a **retry** of that night on a fresh deal. The
  third is **FIRED**: a card with the run's stats, its Contraband, its unlocks, and New Run.
- The run saves between nights at its stage (loot, shop, map, card), offers included, so a reload
  never rerolls them. Quitting mid-night loses that night's Shinies.

## Foremen and milestones

A **Foreman** runs your shift, picked at the start of a run once a second one is open: **Gary**
(the Bigger Lid), **Linda** (Big Spender's Card and the Clearance Card), **Grandma Mange** (the
Recipe Card and the Air Freshener), **Lil' Pete** (a random rare Contraband, but only 4 slots).

**Milestones** are reached once, ever, and open things up for every run after:

| Milestone | How | Unlocks |
|---|---|---|
| Passed Inspection | beat The Inspection | Chain Gang, Foreman Linda |
| Golden | lay a Golden Egg | Gull Whisperer |
| Pink Slip | get fired | Possum Bribe |
| Daily Grind | finish a Daily Dump | Streaker |
| Home Cook | find 5 recipes | Alchemist's Apron, Foreman Grandma Mange |
| Gull Tamer | beat the Gull God Raid | Overtime Junkie |
| Kingmaker | crown the Trash King | Fly Farm, Foreman Lil' Pete |

Also kept across runs (save v2): the Almanac, the Recipe Book, records, Daily scores, settings. A
v1 save keeps its Almanac, best tier, a crowned King (as Kingmaker) and settings, then starts fresh.

## The Daily Dump

From the title: **one seeded night a day**, the same for everyone on the same local date (#1 is
2026-11-01), with no server.

- A random fork rule, **2 random Contraband** from all 25 (locked ones too), a random district,
  at night 3's difficulty (11,500 times the rule's multiplier).
- **One try**: it counts as played when it starts. The score is the night's Shinies.
- **Copy Card** (on the report; the title's Daily button copies it again) puts a Wordle-style
  line on the clipboard (Shinies, best junk, brews, peak Stink):
  `Dumpster Alchemy Daily #12 · 🦝 48,120 · 👑 Fridge · 🧪 3 recipes · 🤢 63`

## Screens

Title (Continue, New Run, Daily Dump #N, Trash Almanac, fullscreen) → **Foreman** pick → **Night
card** (the night, district, rule, quota, reward tag, what's new; BOSS NIGHT in red) → **Play** (P
or Esc pauses) → **Night report** (the Possum's clipboard, PASSED or SHUT DOWN, the cause, the
bank, any strike) → **Loot** → **Swap Meet** → **Map** (Head Out drives the truck to the node)
→ the next night card.

A failed night goes report → Retry (or the Swap Meet first); the third strike goes to **FIRED**;
night 10 won goes to the crowning and the run-won card. **The Trash Almanac**: Junk and Recipes.

**The window.** The 640 × 360 stage sits fit-scaled in a buffer that takes the window's shape
(wide windows get more width, 16:10 and 4:3 more height): no bars, nothing cropped. Each
district's backdrop is a 960 × 640 panorama, so the margins carry on the scenery.

## Feel ("the shitty juice")

- Every merge: a squash-and-stretch pop above the paw, a stink puff, a wet squelch pitched up per
  tier, and a shake that grows with tier (up to 6 px; **Reduce shake** in pause). Hitstop on
  tier-6+ merges, long cascades, brews and bombs. Splats stain the dirt all night.
- Items idle-wobble. Flies orbit anything tier 6 and up. Bags drip. Marker popups: "GROSS!",
  "NASTY", "COMBO x3!", "NEW RECIPE!", "+244 x1.25", "NO ROOM!".
- Raccoons chitter in gibberish, hug the good stuff, sniff the rest, and dance in the Rave. Coins
  spray on jackpots and treasures. The possum walks on at the warning, marches in for a shutdown,
  and keels over when you pass. The night music adds layers as the Stink rises.
- Every brew, tool, perk, boss and strike has a sound; FIRED is a sagging trombone, a won run a
  kazoo march. All of it is synthesised with WebAudio: no audio files.

## Controls

Mouse or touch: drag to move, merge, brew or deliver (the piece floats above the paw or finger),
click the Dumpster. Keys: **Space** Dumpster, **C** clock out, **P** / **Esc** pause, **M** mute,
**F** fullscreen (where the browser allows it). Held upright, a phone asks you to turn it.

## Out of scope

Energy timers, ads, real money, a meta-town, more than one board, online anything (the Daily is
seeded on the device; no leaderboard), saving mid-night (a reload restarts the night). Deferred:
two-cell big junk, gulls stealing from under the paw. **Endless** is cut from the flow (the Daily
and runs replace it; its code paths remain in the systems).
