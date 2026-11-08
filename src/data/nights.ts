// The run's nights (docs/V2.md, "The run"): ten nights in three acts across the County Dump.
//
//   Act 1  Lot 9            night 1 First Shift, nights 2-3 (forks), night 4 THE INSPECTION (boss)
//   Act 2  The Marina       nights 5-6 (forks), night 7 GULL GOD RAID (boss)
//   Act 3  Mount Trashmore  nights 8-9 (forks), night 10 SPRING CLEANING (the King, boss)
//
// Each night has one real rule (`RuleDef`: a name, a line, its `Mods`). A fork night's rule comes
// from its act's pool; the run's map (src/game/run.ts) deals two forks per step from the run seed,
// each with a reward tag. The quota is the ante (TUNING.run.quota) x the rule's quotaMul (x the
// elite tag). How a night's mods combine: the act's base, then the rule's (keys ending in `Mul`
// multiply, everything else replaces), then the Contraband (src/game/perks.ts).
import type { Goal, Mods, SceneId } from '../game/state';
import { TUNING } from './tuning';

export type RuleId =
  | 'first'
  | 'garbage'
  | 'potluck'
  | 'gulls'
  | 'heat'
  | 'rush'
  | 'moon'
  | 'bulk'
  | 'rave'
  | 'inspection'
  | 'raid'
  | 'spring';

/** What a fork night gives for passing it (the map shows it as a tag on the node). */
export type RewardTag = 'loot' | 'shop' | 'juice' | 'elite';

export interface RuleDef {
  id: RuleId;
  name: string;
  /** The night card's one-liner. */
  tease: string;
  /** The night's one real rule change, one short line (the night card, the map and the HUD show it). */
  rule: string;
  /** One or two short lines for the night card: what's new or different tonight. */
  news: readonly string[];
  mods: Partial<Mods>;
  /** The night's quota x this (Bulk Pickup's bigger junk pays more, so it asks more). */
  quotaMul: number;
  goal: Goal;
  boss: boolean;
}

// Truck tier odds (weights for junk tiers 1, 2, 3, ...).
const BULK = [0.25, 0.3, 0.25, 0.15, 0.05] as const;
/**
 * Spring Cleaning: the big stuff, tiers 2-8 (v2's 3.5-minute night needs about twice the junk per
 * load of the old 6-minute one to add up to a King). Balance pass: a bit heavier and fewer pieces
 * (load x0.7), so a slow player isn't buried in ripening junk.
 */
const SPRING = [0, 0.03, 0.09, 0.22, 0.3, 0.2, 0.11, 0.05] as const;

function rule(id: RuleId, d: Omit<RuleDef, 'id' | 'quotaMul' | 'goal' | 'boss'> & Partial<RuleDef>): RuleDef {
  return { id, quotaMul: 1, goal: 'quota', boss: false, ...d };
}

export const RULES: Record<RuleId, RuleDef> = {
  first: rule('first', {
    name: 'First Shift',
    tease: 'Welcome to Lot 9. Mind the smell.',
    rule: 'Training night: a gentle truck, and no gulls.',
    news: ['Merge two of a kind. Feed the raccoons.', 'Junk left sitting goes smelly. Keep it moving.'],
    mods: { truckIntervalMul: 0.95, truckLoadMul: 0.9, patienceMul: 1.25, gullChanceMul: 0, ripenMul: 1.4, stinkGainMul: 0.6 },
  }),
  garbage: rule('garbage', {
    name: 'Garbage Day',
    tease: 'Two trucks on the route tonight.',
    rule: 'Two trucks: half the load, twice as often.',
    news: ['Two trucks take turns: smaller loads, more often.', 'Lot filling up? The Crusher eats anything.'],
    mods: { trucks: 2, truckIntervalMul: 1.05, truckLoadMul: 0.5, patienceMul: 1.1 },
    quotaMul: 0.9,
  }),
  potluck: rule('potluck', {
    name: 'Potluck',
    tease: 'Everybody brings a dish. Nobody brings a good one.',
    rule: 'Brewed treasures pay x1.5.',
    news: ['Drop two DIFFERENT things together to brew. A treasure fills any order.', 'Grandma left a recipe on the night card.'],
    mods: { brewPayMul: 1.5 },
    quotaMul: 0.95,
  }),
  gulls: rule('gulls', {
    name: 'Seagull Season',
    tease: 'They followed the truck in. All of them.',
    rule: 'Gulls everywhere, and gull orders pay x2.',
    news: ['Three times the seagulls, and raccoons want them.', 'Merge gulls up for a fat payday, or crush them.'],
    mods: { gullChanceMul: 3, gullPayMul: 2, gullOrderMul: 2.5 },
    quotaMul: 1.05,
  }),
  heat: rule('heat', {
    name: 'Heat Wave',
    tease: 'It is 90 degrees at midnight. Everything is ripe.',
    rule: 'Junk goes smelly almost twice as fast.',
    news: ['Anything left sitting turns in half the time.', 'Merge, deliver or crush before the flies find it.'],
    mods: { ripenMul: 0.6 },
    quotaMul: 1.0,
  }),
  rush: rule('rush', {
    name: 'Rush Hour',
    tease: 'Everybody has somewhere to be.',
    rule: 'Raccoons have half the patience, and pay x1.5.',
    news: ['Orders run out twice as fast.', 'Fill them quick and they pay half again.'],
    mods: { patienceMul: 0.5, orderPayMul: 1.5 },
    quotaMul: 1.2,
  }),
  moon: rule('moon', {
    name: 'Full Moon',
    tease: 'Everybody is a little weird tonight.',
    rule: 'Any merge may skip a tier. Gulls are about.',
    news: ['One merge in ten jumps two tiers.', 'Nearly twice the seagulls.'],
    mods: { skipChance: 0.1, gullChanceMul: 1.75 },
    quotaMul: 0.85,
  }),
  bulk: rule('bulk', {
    name: 'Bulk Pickup',
    tease: 'Somebody cleaned out a garage.',
    rule: 'Big junk, and the Crusher pays x3 for scrap.',
    news: ['The truck brings heavier junk, and more of it.', 'The Crusher pays for everything tonight, three times over.'],
    mods: { truckTierOdds: BULK, truckLoadMul: 0.9, compactorPayMul: 3 },
    quotaMul: 1.1,
  }),
  rave: rule('rave', {
    name: 'Rave Night',
    tease: 'Somebody brought a boombox. The raccoons are LOSING it.',
    rule: 'The streak fills twice as fast.',
    news: ['Every merge and delivery heats the streak twice as fast.', 'Fill it up for a RACCOON RAVE: triple pay.'],
    mods: { streakGainMul: 2 },
    quotaMul: 1.1,
  }),
  inspection: rule('inspection', {
    name: 'The Inspection',
    tease: 'Inspector Possum is watching. Closely.',
    rule: 'Shut down at Stink 75. Every hour the Possum condemns a cell.',
    news: ['Keep the lot clean: 75 Stink is the limit tonight.', 'Each hour a cell is taped off. Nothing lands there.'],
    mods: { stinkMax: 75, condemnPerHour: 1, truckIntervalMul: 1.1, truckLoadMul: 1 / 1.1 },
    quotaMul: 0.8,
    boss: true,
  }),
  raid: rule('raid', {
    name: 'Gull God Raid',
    tease: 'Something huge is circling the pier.',
    rule: 'Each hour the Gull God steals your best junk. Feed it a gull to stop it.',
    news: ['Hand a raccoon a gull, or crush one, between raids to keep the God fed.', 'Gulls galore tonight. They pay x1.5.'],
    mods: { gullChanceMul: 3, gullOrderMul: 3, gullPayMul: 1.5, raid: true },
    quotaMul: 0.8,
    boss: true,
  }),
  spring: rule('spring', {
    name: 'Spring Cleaning',
    tease: 'The whole county is throwing out the big stuff.',
    rule: 'Build the Trash King by 6 AM. The lot reeks.',
    news: ['The truck brings the BIG junk, and it turns fast.', 'Raccoons want small stuff and pay in bigger junk, not Shinies.'],
    mods: { truckTierOdds: SPRING, truckIntervalMul: 1.15, truckLoadMul: 0.7, patienceMul: 1.4, ripenMul: 0.6, stinkGainMul: 1.45, stinkDecayMul: 0.35, jackpotTiers: null },
    goal: 'king',
    boss: true,
  }),
};

export interface ActDef {
  act: number;
  name: string;
  scene: SceneId;
  /** Night numbers in this act, in order; the last is the boss. */
  nights: readonly number[];
  /** The rules its fork nights are dealt from. */
  pool: readonly RuleId[];
  boss: RuleId;
  /** Every night in the act starts from these (a rule's own mods go on top). */
  base: Partial<Mods>;
}

export const ACTS: readonly ActDef[] = [
  {
    act: 1,
    name: 'Lot 9',
    scene: 'lot9',
    nights: [1, 2, 3, 4],
    pool: ['garbage', 'potluck', 'rave', 'heat'],
    boss: 'inspection',
    // Balance pass: a fuller lot (the truck at full pace, loads +10%) that ripens slower (x1.6),
    // so there's plenty to merge without burying a newer player.
    base: { jackpotTiers: [5, 6], truckIntervalMul: 1.0, truckLoadMul: 1.1, ripenMul: 1.6 },
  },
  {
    act: 2,
    name: 'The Marina',
    scene: 'marina',
    nights: [5, 6, 7],
    pool: ['gulls', 'rush', 'garbage', 'potluck', 'moon'],
    boss: 'raid',
    base: { jackpotTiers: [6, 7], truckTierOdds: [0.5, 0.33, 0.17], truckIntervalMul: 1.08 },
  },
  {
    act: 3,
    name: 'Mount Trashmore',
    scene: 'trashmore',
    nights: [8, 9, 10],
    pool: ['bulk', 'moon', 'heat', 'rush', 'rave'],
    boss: 'spring',
    base: { jackpotTiers: [7, 8], truckTierOdds: [0.45, 0.35, 0.15, 0.05] },
  },
];

/** Nights in a run. */
export const NIGHT_COUNT = 10;
/** Every rule a fork (or the Daily Dump) can deal. */
export const FORK_RULES: readonly RuleId[] = ['garbage', 'potluck', 'gulls', 'heat', 'rush', 'moon', 'bulk', 'rave'];

export function actOf(night: number): ActDef {
  return ACTS.find((a) => a.nights.includes(night)) ?? (ACTS[ACTS.length - 1] as ActDef);
}

/** Night 1 is always the First Shift and the last night of each act is its boss; the rest fork. */
export function isFork(night: number): boolean {
  const a = actOf(night);
  return night !== 1 && night !== a.nights[a.nights.length - 1];
}

export const REWARDS: Record<RewardTag, { name: string; blurb: string }> = {
  loot: { name: 'LOOT', blurb: 'Pass it for an extra Contraband pick.' },
  shop: { name: 'SALE', blurb: 'The Swap Meet after it is 25% off.' },
  juice: { name: 'JUICE', blurb: 'A free Bin Juice waits in the Dumpster.' },
  elite: { name: 'ELITE', blurb: 'Quota +40%, but the loot is rare.' },
};

/** One night as it's played: the rule, the reward tag, the quota, where it is. */
export interface NightDef extends Omit<RuleDef, 'mods'> {
  night: number;
  act: number;
  scene: SceneId;
  tag: RewardTag | null;
  /** Shinies needed by 6 AM (0 when the goal isn't the quota). */
  quota: number;
  /** The act's base and the rule's mods (no Contraband yet). */
  mods: Partial<Mods>;
  /** What the HUD calls it ("NIGHT 3"). */
  label: string;
}

/** A quota as a price tag: to the 100, or to the 500 from 10,000. */
function nice(q: number): number {
  const step = q >= 10000 ? 500 : 100;
  return Math.max(step, Math.round(q / step) * step);
}

/** The quota for a night: the ante x the rule x the elite tag. */
export function quotaFor(night: number, r: RuleDef, tag: RewardTag | null, slot = night): number {
  if (r.goal !== 'quota') return 0;
  const R = TUNING.run;
  const base = R.quota[Math.max(0, Math.min(R.quota.length - 1, slot - 1))] ?? 0;
  return nice(base * r.quotaMul * (tag === 'elite' ? R.eliteQuotaMul : 1));
}

/** Keys of a rule's mods that multiply the act's base instead of replacing it. */
function multiplies(k: string): boolean {
  return k.endsWith('Mul');
}

/** The act's base mods with the rule's on top. */
function combine(base: Partial<Mods>, top: Partial<Mods>): Partial<Mods> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(top)) {
    if (v === undefined) continue;
    const b = out[k];
    out[k] = multiplies(k) && typeof v === 'number' && typeof b === 'number' ? b * v : v;
  }
  return out as Partial<Mods>;
}

/** Build a night: night `night` of the run, with this rule and reward tag. */
export function makeNight(night: number, id: RuleId, tag: RewardTag | null): NightDef {
  const r = RULES[id];
  const a = actOf(night);
  return {
    ...r,
    night,
    act: a.act,
    scene: a.scene,
    tag,
    quota: quotaFor(night, r, tag),
    mods: combine(a.base, r.mods),
    label: `NIGHT ${night}`,
  };
}

/** A rule by id (anything unknown is the First Shift). */
export function ruleDef(id: string): RuleDef {
  return (RULES as Record<string, RuleDef | undefined>)[id] ?? RULES.first;
}

/** Tonight's rule, from a GameState (the HUD's night plate and tooltip). */
export function ruleOf(s: { rule: string }): RuleDef {
  return ruleDef(s.rule);
}

/**
 * A night with no run behind it (dev tools, the single-night sim): the first fork's rule of its
 * act's pool, or the boss.
 */
export function nightDef(n: number): NightDef {
  const night = Math.max(1, Math.min(NIGHT_COUNT, Math.floor(n)));
  const a = actOf(night);
  const id: RuleId = night === 1 ? 'first' : isFork(night) ? (a.pool[a.nights.indexOf(night) - (a.act === 1 ? 1 : 0)] ?? a.pool[0] ?? 'garbage') : a.boss;
  return makeNight(night, id, null);
}

/** The ten nights with no run behind them (each fork's first pick): the single-night sim's table. */
export const NIGHTS: readonly NightDef[] = Array.from({ length: NIGHT_COUNT }, (_, i) => nightDef(i + 1));
