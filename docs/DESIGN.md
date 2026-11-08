# Dumpster Alchemy — Design

A janky, loud, slightly gross merge game. You run the night shift at **Lot 9**, a municipal
landfill, for a crew of raccoons. The garbage truck keeps dumping junk on your patch of dirt.
Merge two of the same junk into better junk, feed the raccoons' orders, and keep the stink down
until 6 AM. At the top of the pile sits the **Trash King**.

**On purpose, it's shitty.** It never looks broken, but it is crude, wobbly, wet and over the top.
Every merge squelches, items jiggle, flies circle the good stuff, and the UI is cardboard and duct
tape. Juice comes before polish.

This file describes the game **as built** (updated 2026-11-07 after the second critic's fixes,
M7 wave 4). The exact numbers live in `src/data/` (`tuning.ts`, `items.ts`, `nights.ts`,
`upgrades.ts`, `raccoons.ts`); the critic passes that shaped them are `docs/CRITIC.md` and
`docs/CRITIC2.md`.

## The loop in one breath

The truck dumps junk → you drag pairs together to merge them up → raccoons want what's on your
lot, so you drag it onto them for **Shinies** → bigger junk is worth much more, so you build up
when you can → junk left sitting goes **smelly** and the **Stink** climbs → meet the night's
quota, then bet on it: **Clock Out** and bank, or stay for double overtime and risk losing it →
spend Shinies at the **Swap Meet** → next night, with a new rule.

## The board

- A **9 × 7 grid** of 32 px cells: packed dirt under a sodium streetlight.
- **Drag** an item:
  - onto the **same item**: they merge into the next tier, in the target cell;
  - onto an **empty cell**: it moves;
  - onto a **different item**: they swap;
  - onto a **raccoon's order**: it's delivered, if they want it;
  - onto the **Crusher**: it's destroyed (frees space, cooldown; the Industrial Crusher upgrade
    pays a little per tier).
- Merges are **two-of-a-kind**. The top tier of a chain can't merge. Junk still in the air
  already owns its landing cell (a landing shadow shows it).

## The Junk chain (12 tiers)

| Tier | Item | Value | Quip on first discovery |
|---|---|---|---|
| 1 | Bottle Cap | 2 | "A start." |
| 2 | Crushed Can | 4 | "Somebody stepped on this. Good." |
| 3 | Takeout Box | 9 | "There's a fork in it. Still." |
| 4 | Leaky Trash Bag | 21 | "Don't squeeze it." |
| 5 | One Boot | 50 | "Where's the other one? Don't ask." |
| 6 | Busted Toaster | 120 | "Makes toast. Also sparks." |
| 7 | Bald Tire | 290 | "Smells like a highway." |
| 8 | Shopping Cart | 690 | "One wheel has opinions." |
| 9 | Stained Mattress | 1,700 | "We don't talk about the stain." |
| 10 | Fridge (door hanging) | 4,000 | "Something in the crisper is alive." |
| 11 | Dead Car | 9,500 | "Runs great. Doesn't run." |
| 12 | **The Trash King** | 23,000 | A raccoon on a mattress throne, hubcap crown. The end of the pile. |

Value grows **about 2.4× per tier** (`1.5 × 2.4^(tier-1)`, rounded like a price tag), so one big
piece beats the small pieces that made it. That's the reason to hold junk back.

## Seagulls: the side chain

Any junk merge has a small chance (**4%**, times the night's and the Plastic Owl's multipliers;
none on night 1) to attract a **Seagull**, which swoops onto a random empty cell (or eats whatever
it lands on). Gulls don't go smelly.

| Tier | Gull | What it does on the board |
|---|---|---|
| G1 | Seagull | Hops to a neighbouring cell every ~6 s; eats junk up to tier 3 if it lands on it |
| G2 | Fat Gull | Hops every ~8 s; eats up to tier 5 |
| G3 | Gull Gang | Stays put; screams every ~10 s and shuffles its 8 neighbours |
| G4 | Gull Boss | Wears a stolen chip bag; pecks 2 Shinies out of your purse every ~4 s |
| G5 | **The Gull God** | Rises off the board in a beam and drops a **Golden Egg** |

The choice: crush the gulls, or spend board space merging them up for the Egg. **Golden Egg**:
drop it on any junk to raise it **two tiers**. Once you've seen gulls, some raccoons order them
(Gary loves a Fat Gull. Don't ask.), and they pay properly: a Seagull 20, a Fat Gull 60, a Gang
150, a Boss 400 (twice that on Seagull Season).

## Where junk comes from

- **The Dumpster** (right column). Click it (or Space) to spit out junk: tier 1 (70%), 2 (25%),
  3 (5%). 6 lid charges, one back every 5 s.
- **The Truck**. First dump at 0:06, then every 10 s at midnight down to every 7 s by 6 AM, with
  loads growing from 4-7 to 5-7 items, before the night's rule. The HUD shows the countdown and
  **"next load vs room"**, so you see an overflow coming. The truck is busy enough that an average
  player (about one action every 1.8 s) falls behind from around 2-3 AM: that's when the lot
  starts to fill and smell.
- **Garbage Day** runs two trucks out of step, each with half the load.
- **Angry raccoons** kick the Dumpster over: 3 junk onto the board.

## Raccoons and orders

Three order slots down the left side (a 4th, the **Big Spender** slot, from the Swap Meet). A
raccoon wants 1-2 items with a **patience bar** (60-90 s, by raccoon and night). Drag the items onto
the card; each pays its value times the order's pay (the raccoon's taste, the kind of order,
tonight's rule) as it's handed over, and finishing early adds up to **50% of the order's value**
as a patience bonus. The price tags show the live total.

- **Orders follow the lot.** What a raccoon asks for comes from the junk on the board *now*: each
  tier you hold weighs its count, a pair weighs toward what it would merge into, and one tier above
  the top of your lot is the stretch. Junk already promised to another order doesn't count, and the
  second item of a two-item order isn't the same piece as the first. Linda and Lil' Pete lean big
  (they take the biggest of two or three draws). Regular orders start at tier 2.
- **Scrap orders.** A raccoon wants 3-5 caps and cans (at most two kinds), pays twice their value
  per piece, and waits 1.4x longer. More likely the more small junk is on the lot (12% plus 3% per
  small piece past four, at most 55%), never two at once, never Lil' Pete. So caps always have
  somewhere to go.
- **Night 1's first order** is a Crushed Can: two caps, or a lucky click.
- **Ran out of patience**: they storm off, kick the Dumpster (3 junk) and add Stink.
- **The Jackpot**: once a night, at a random time between 1:00 and about 4:10 AM (once your best
  junk is close), a raccoon wants one tier above your best, within the night's range (tiers 5-6 on
  nights 1-2, 6-7 on 4-5, 7-8 from night 6; none on Takeout Tuesday or the King night). It waits
  150 s and pays well, but never more than **28% of the night's quota**, bonus and all: a bonus, not
  the night. If you can't make it, they leave quietly.
- **Big Spender** (the 4th slot): wants the top of your lot or one above, waits 1.5x longer, pays
  1.25x.

The regulars (`src/data/raccoons.ts`): **Gary** (hard hat, wants it NOW), **Linda** (cat-eye
glasses, "only the finest refuse", pays well), **Lil' Pete** (tiny, wants huge things, patient),
**Grandma Mange** (shawl, slow, generous). Their lines name what they want ("Can I have a toaster?").

## Stink and losing

The lot itself is the pressure, all night.

- **Stink** goes from 0 to 100, shown as a sludge jar with flies on the right, with an arrow for
  which way it's heading (`smellRate`).
- **Junk ripens.** A piece left unmerged goes **smelly** after 30 s (a cap), 1.5 s sooner per tier
  up, never under 18 s, before the night's rule (Heat Wave and Spring Cleaning speed it up). Each
  smelly piece adds Stink every second: 0.035/s, plus 0.008/s per tier above 1 (up to tier 7). A
  merge makes a fresh piece, so **merging, delivering or crushing** clears the smell; moving it
  doesn't.
- A crowded lot adds a little more (from 0.2/s at 75% full to 1/s when full); each truck item that
  can't land adds **5**; a raccoon storming off adds **8**.
- It fades 0.2/s while the lot is under 70% full. The Air Freshener speeds the fade (and keeps it
  going on a full lot) and cuts every gain.
- At **75** (25 under the night's limit) Inspector Possum walks onto the lot as a warning.
- At **100** (75 on The Inspection) he shuts the night down. After the quota it's still a pass, but
  the overtime is lost (below). The report says what raised the Stink.

At an average pace (an action every 1.8 s) the Stink stays low until about 3 AM, then climbs to
peaks of roughly 40-60 on Seagull Season, Heat Wave, Rush Hour, Full Moon and The Inspection (and
about 70 on Spring Cleaning); the gentler nights stay around 10. The Crusher and the Air Freshener
visibly hold it down. About a quarter of lost nights are lost to the Stink, the rest to the quota.

## A night (a "shift")

- 12:00 AM to 6:00 AM, **one minute per hour**, so six minutes a night.
- Each night has a **Shinies quota**, set so steady orders meet it (the income is smooth: no flat
  minute waiting on the jackpot). When you meet it, "QUOTA MET!" slams in and a **Clock Out**
  button appears. From then on everything you earn is **overtime** (`overtimeEarned`), and it's a
  bet:
  - **Clock Out**: bank everything now, overtime at x1.
  - **Stay till 6 AM**: the overtime is paid **twice** (x2).
  - **The Stink maxes out first**: still a pass, but the Possum confiscates all the overtime; you
    bank what you had when the quota was met.
- Miss the quota (or get shut down before it): you keep **half** the Shinies, and retry the night.
- **10 nights**, each with **one real rule** (`src/data/nights.ts` `rule`):

| Night | Name | Quota | Rule |
|---|---|---|---|
| 1 | First Shift | 1,100 | the tutorial: a gentle truck, patient raccoons, **no gulls**; three one-time hints |
| 2 | Garbage Day | 1,400 | **two trucks**: half the load, twice as often |
| 3 | Takeout Tuesday | 2,300 | raccoons only order **takeout boxes and trash bags**, and pay **x1.5** (no scrap, gull or jackpot orders) |
| 4 | Seagull Season | 2,050 | three times the gulls; gull orders come 2.5x as often and pay **x2** |
| 5 | Heat Wave | 1,950 | junk goes **smelly** much faster (ripening x0.6) |
| 6 | Rush Hour | 2,625 | raccoons have **half the patience** and pay **x1.5** |
| 7 | Full Moon | 2,550 | every merge has a **10% chance to skip a tier** (+2); nearly twice the gulls |
| 8 | Bulk Pickup | 4,150 | big junk (tiers 1-5), and the **Crusher pays x3** for scrap (1 per tier even without the upgrade) |
| 9 | The Inspection | 2,350 | the Possum shuts you down at **Stink 75** (warns at 50) |
| 10 | Spring Cleaning | build the King | the truck brings big junk (tiers 2-7) that **reeks**: it ripens 2.2x as fast, Stink gains x1.6, it fades at a third |
| 11+ | No Closing Time | score | Endless: no 6 AM; the truck builds up slowly, then never lets up; each hour pays a bonus |

**Night 10.** Raccoons want small stuff (tier 5 at most) and pay in junk, not Shinies: a filled
order kicks a gift one tier above its best item onto the lot three times in four. Building the
King means holding big pieces while they reek, so it's a race between space, smell and the clock.
A lost try banks nothing, so the crew chips in: one Bin Juice per failed try so far (up to 3) waits
in the Dumpster, and each retry's Stink gains drop 10% (down to 60%), so no run is stuck there.

Winning night 10 crowns the King (a ceremony on a sodium beam), then **The End**, then Endless
unlocks.

## The Swap Meet (between nights)

| Upgrade | Prices by level | Effect | Shines on |
|---|---|---|---|
| Bigger Lid | 1,100 / 3,000 / 7,500 | 8 / 10 / 12 Dumpster charges | Takeout Tuesday |
| Greased Hinges | 1,200 / 3,300 / 8,000 | lid refills every 4 / 3.2 / 2.5 s | Takeout Tuesday, Rush Hour |
| Extra Raccoon | 6,000 | a 4th order slot for Big Spenders | Rush Hour, Bulk Pickup |
| Industrial Crusher | 1,300 / 3,600 / 9,000 | shorter cooldown (6 / 4 / 2.5 s); pays 1 / 2 / 3 Shinies per tier | Bulk Pickup, Garbage Day |
| Air Freshener | 1,200 / 3,400 / 8,500 | Stink gains -15 / 30 / 45%, fades x1.75 / 2.75 / 4 (even on a full lot) | Heat Wave, The Inspection, Spring Cleaning |
| Plastic Owl | 1,100 / 3,100 / 8,000 | 25 / 45 / 65% fewer gulls; they eat up to tier 2 / 1 / nothing | Seagull Season, Full Moon |
| Bin Juice (consumable) | 1,000 each, carry 3 | a wildcard that merges with anything, placed on the board next night | the King night |

Each upgrade has nights whose rule it clearly helps (`UpgradeDef.shines`), so before a night the
choice is "what does tonight need?". A good player (an action every 1.3 s) owns about 11 of the 16
levels by night 10 (69%), an average one (1.8 s) about 10 (63%), a fast one (1.0 s) about 12.

## Screens

Title (Lot 9 at night, the logo on a cardboard sign, a pile of junk) → Night card ("Night 3",
its name, quota and what's new) → Play (pause with P) → Night report (Inspector Possum's
clipboard, the PASSED or SHUT DOWN stamp, the cause) → Swap Meet → straight into the next night.
Also: **the Trash Almanac** (every item found, silhouettes for the rest), The End, Endless.

## Feel ("the shitty juice")

- Every merge: a squash-and-stretch pop, a stink puff, a wet squelch pitched up per tier, and a
  small screen shake that grows with tier.
- Items idle-wobble, each at its own phase. Flies orbit anything tier 6 and up. Bags drip.
- Marker popups: "GROSS!", "NASTY", "BEAUTIFUL", "oh no", "+50", "NO ROOM!".
- Raccoons chitter in gibberish (each has a voice). Gulls screech. The truck beeps in reverse.
  The night music adds layers as the Stink rises.
- The possum walks on at 75 Stink, marches in for a shutdown, and keels over when you pass.
- All sound is synthesised with WebAudio: no audio files.

## Controls

Mouse or touch: drag to move or merge (the piece floats above the paw or your finger), click the
Dumpster. Keys: **Space** clicks the Dumpster, **P** pauses, **M** mutes. On a phone held
upright, the game asks you to turn it.

## Out of scope

Energy timers, ads, real money, a map or meta-town, more than one board, online anything, saving
mid-night (a reload restarts the night).
