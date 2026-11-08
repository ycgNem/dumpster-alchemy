// The ten nights (docs/DESIGN.md, "A night"), then Endless. Each night has a quota, a name, a
// one-line tease for the night card, its one real rule (`rule`, implemented as `Mods`), and what's
// new tonight.
//
// How a night's mods combine with the Swap Meet's (src/game/run.ts): keys ending in `Mul`
// multiply whatever the upgrades set (so Spring Cleaning's Stink gain still stacks with the Air
// Freshener), every other key replaces. Tuned with `npm run sim -- campaign` (1.8 s per action is
// the average player: ~95% first try on nights 1-2 sloping to ~60% on night 9; docs/PLAN.md, M7).
import type { Goal, Mods } from '../game/state';

export interface NightDef {
  /** 1-10; Endless is NIGHTS.length + 1. */
  night: number;
  name: string;
  /** The night card's one-liner. */
  tease: string;
  /** Shinies needed by 6 AM (0 when the goal isn't the quota). */
  quota: number;
  goal: Goal;
  /** The night's one real rule change, one short line (the night card and the HUD show it). */
  rule: string;
  /** One or two short lines for the night card: what's new or different tonight. */
  news: readonly string[];
  mods: Partial<Mods>;
}

// Truck tier odds (weights for junk tiers 1, 2, 3, ...).
const BULK = [0.25, 0.3, 0.25, 0.15, 0.05] as const;
/** Spring Cleaning: the big stuff, tiers 3-7. A normal night only adds up to about a quarter of a King. */
const SPRING = [0, 0.05, 0.15, 0.3, 0.27, 0.15, 0.08] as const;

export const NIGHTS: readonly NightDef[] = [
  {
    night: 1,
    name: 'First Shift',
    tease: 'Welcome to Lot 9. Mind the smell.',
    quota: 1100,
    goal: 'quota',
    rule: 'Training night: a gentle truck, and no gulls.',
    news: ['Merge two of a kind. Feed the raccoons.', 'Junk left sitting goes smelly. Keep it moving.'],
    mods: { truckIntervalMul: 1.2, truckLoadMul: 0.8, patienceMul: 1.25, gullChanceMul: 0, jackpotTiers: [5, 6] },
  },
  {
    night: 2,
    name: 'Garbage Day',
    tease: 'Two trucks on the route tonight.',
    quota: 1400,
    goal: 'quota',
    rule: 'Two trucks: half the load, twice as often.',
    news: ['Two trucks take turns: smaller loads, more often.', 'Lot filling up? The Crusher eats anything.'],
    mods: { trucks: 2, truckIntervalMul: 1.05, truckLoadMul: 0.5, patienceMul: 1.1, jackpotTiers: [5, 6] },
  },
  {
    night: 3,
    name: 'Takeout Tuesday',
    tease: 'Everybody wants leftovers.',
    quota: 2300,
    goal: 'quota',
    rule: 'Raccoons only want takeout boxes and bags, and pay x1.5.',
    news: ['Orders: takeout boxes and trash bags only, at half again the price.', 'Nobody wants caps or cans tonight. Merge them up.'],
    mods: {
      orderTiers: [3, 4],
      orderPayMul: 1.5,
      scrapOrders: false,
      gullOrderMul: 0,
      jackpotTiers: null,
      truckIntervalMul: 1.05,
      truckTierOdds: [0.5, 0.33, 0.17],
    },
  },
  {
    night: 4,
    name: 'Seagull Season',
    tease: 'They followed the truck in. All of them.',
    quota: 2050,
    goal: 'quota',
    rule: 'Gulls everywhere, and gull orders pay x2.',
    news: ['Three times the seagulls, and raccoons want them.', 'Merge gulls up for a fat payday, or crush them.'],
    mods: { gullChanceMul: 3, gullPayMul: 2, gullOrderMul: 2.5, truckTierOdds: [0.55, 0.32, 0.13], jackpotTiers: [6, 7] },
  },
  {
    night: 5,
    name: 'Heat Wave',
    tease: 'It is 90 degrees at midnight. Everything is ripe.',
    quota: 1950,
    goal: 'quota',
    rule: 'Junk goes smelly twice as fast.',
    news: ['Anything left sitting turns in half the time.', 'Merge, deliver or crush before the flies find it.'],
    mods: { ripenMul: 0.6, truckTierOdds: [0.45, 0.35, 0.2], jackpotTiers: [6, 7] },
  },
  {
    night: 6,
    name: 'Rush Hour',
    tease: 'Everybody has somewhere to be.',
    quota: 2625,
    goal: 'quota',
    rule: 'Raccoons have half the patience, and pay x1.5.',
    news: ['Orders run out twice as fast.', 'Fill them quick and they pay half again.'],
    mods: { patienceMul: 0.5, orderPayMul: 1.5, truckTierOdds: [0.5, 0.33, 0.17], jackpotTiers: [7, 8] },
  },
  {
    night: 7,
    name: 'Full Moon',
    tease: 'Everybody is a little weird tonight.',
    quota: 2550,
    goal: 'quota',
    rule: 'Any merge may skip a tier. Gulls are about.',
    news: ['One merge in ten jumps two tiers.', 'Nearly twice the seagulls.'],
    mods: { skipChance: 0.1, gullChanceMul: 1.75, truckTierOdds: [0.45, 0.35, 0.15, 0.05], jackpotTiers: [7, 8] },
  },
  {
    night: 8,
    name: 'Bulk Pickup',
    tease: 'Somebody cleaned out a garage.',
    quota: 4150,
    goal: 'quota',
    rule: 'Big junk, and the Crusher pays x3 for scrap.',
    news: ['The truck brings heavier junk, and more of it.', 'The Crusher pays for everything tonight, three times over.'],
    mods: { truckTierOdds: BULK, truckLoadMul: 0.9, compactorPayMul: 3, jackpotTiers: [7, 8] },
  },
  {
    night: 9,
    name: 'The Inspection',
    tease: 'Inspector Possum is watching. Closely.',
    quota: 2350,
    goal: 'quota',
    rule: 'The Possum shuts you down at Stink 75, not 100.',
    news: ['Keep the lot clean: 75 Stink is the limit tonight.', 'Pass this and Spring Cleaning is next.'],
    mods: { stinkMax: 75, truckIntervalMul: 0.97, truckTierOdds: [0.45, 0.33, 0.17, 0.05], jackpotTiers: [7, 8] },
  },
  {
    night: 10,
    name: 'Spring Cleaning',
    tease: 'The whole county is throwing out the big stuff.',
    quota: 0,
    goal: 'king',
    rule: 'Build the Trash King by 6 AM. The lot reeks.',
    news: ['The truck brings the BIG junk, and it turns fast.', 'Raccoons want small stuff and pay in bigger junk, not Shinies.'],
    mods: { truckTierOdds: SPRING, truckIntervalMul: 1.15, truckLoadMul: 0.75, patienceMul: 1.4, ripenMul: 0.45, stinkGainMul: 1.6, stinkDecayMul: 0.35, jackpotTiers: null },
  },
];

/** After night 10: one long shift, the truck never lets up, for a high score. */
export const ENDLESS: NightDef = {
  night: NIGHTS.length + 1,
  name: 'No Closing Time',
  tease: 'No 6 AM. No mercy. How much can you haul?',
  quota: 0,
  goal: 'endless',
  rule: 'No 6 AM. The truck never lets up.',
  news: ['The night never ends. The truck builds up slowly, then never lets up.', 'Every hour you last pays a bonus. Beat your best.'],
  mods: { truckIntervalMul: 0.9, truckTierOdds: [0.5, 0.32, 0.15, 0.03], jackpotTiers: [7, 8] },
};

/** The night to play for a night number (anything past 10 is Endless). */
export function nightDef(n: number): NightDef {
  return NIGHTS[n - 1] ?? ENDLESS;
}
