// Contraband (docs/V2.md, "The run"): rule-benders you draft between nights, Balatro-joker style.
// A run holds up to five (`TUNING.run.slots`). Most of them change tonight's `Mods` (`apply`, run
// in order after the night's own rule); a few hook events in the systems (src/game/perks.ts says
// which and where). The ids are fixed: the art agent draws a 24 x 24 `perk_<id>` icon for each.
//
// The six old Swap Meet upgrades live on here: the Bigger Lid (Lid and Hinges), Big Spender's Card
// (the Extra Raccoon), the Industrial Crusher, the Air Freshener and the Plastic Owl.
//
// Some start locked: a milestone (src/game/meta.ts) puts them in the pool for every run after.
import type { Mods } from '../game/state';
import { TUNING } from './tuning';

export type ContrabandId =
  | 'compost'
  | 'mafia'
  | 'hotsauce'
  | 'pyramid'
  | 'bribe'
  | 'doublebag'
  | 'whisperer'
  | 'junkie'
  | 'chaingang'
  | 'streaker'
  | 'apron'
  | 'sticky'
  | 'crusherpro'
  | 'freshener'
  | 'owl'
  | 'spender'
  | 'snack'
  | 'goose'
  | 'flyfarm'
  | 'clearance'
  | 'recycler'
  | 'junkmail'
  | 'ratrace'
  | 'recipecard'
  | 'biglid';

export type Rarity = 'common' | 'uncommon' | 'rare';

/** What unlocks things for every run after: a milestone reached once (src/game/meta.ts). */
export type MilestoneId = 'boss1' | 'boss2' | 'king' | 'recipes5' | 'egg' | 'fired' | 'daily';

export interface ContrabandDef {
  id: ContrabandId;
  name: string;
  /** What it does, in one short line (loot cards, price tags, tooltips). */
  blurb: string;
  rarity: Rarity;
  /** Null: in the pool from the first run. Otherwise this milestone puts it in. */
  unlock: MilestoneId | null;
  /** Tonight's mods with this in a slot (after the night's own rule). */
  apply?(m: Mods): void;
}

const P = TUNING.perks;

export const CONTRABAND: readonly ContrabandDef[] = [
  {
    id: 'compost',
    name: 'Compost Heap',
    blurb: 'Smelly junk merges up TWO tiers.',
    rarity: 'uncommon',
    unlock: null,
    apply: (m) => void (m.smellySkip = true),
  },
  {
    id: 'mafia',
    name: 'Raccoon Mafia',
    blurb: 'Caps and cans pay x3. Gulls come twice as often.',
    rarity: 'common',
    unlock: null,
    apply(m) {
      m.smallPayMul *= P.mafiaPayMul;
      m.gullChanceMul *= P.mafiaGullMul;
    },
  },
  {
    id: 'hotsauce',
    name: 'Hot Sauce',
    blurb: 'Making a Toaster zaps a junk neighbour up a tier.',
    rarity: 'uncommon',
    unlock: null,
    apply: (m) => void (m.hotSauce = true),
  },
  {
    id: 'pyramid',
    name: 'Pyramid Scheme',
    blurb: 'Each scrap order pays 10% more than the last.',
    rarity: 'common',
    unlock: null,
    apply: (m) => void (m.scrapPayStep += P.pyramidStep),
  },
  {
    id: 'bribe',
    name: 'Possum Bribe',
    blurb: 'Forgives one shutdown (the Stink drops to 50). Then gone.',
    rarity: 'rare',
    unlock: 'fired',
    apply: (m) => void (m.bribe = true),
  },
  {
    id: 'doublebag',
    name: 'Double Bagger',
    blurb: 'The Dumpster spits two per click. 2 fewer lid charges.',
    rarity: 'common',
    unlock: null,
    apply(m) {
      m.dumpsterPerClick = 2;
      m.dumpsterCharges = Math.max(1, m.dumpsterCharges - 2);
    },
  },
  {
    id: 'whisperer',
    name: 'Gull Whisperer',
    blurb: 'Gulls never eat your junk. Gull orders pay x2.',
    rarity: 'common',
    unlock: 'egg',
    apply(m) {
      m.gullEatMax = 0;
      m.gullPayMul *= 2;
    },
  },
  {
    id: 'junkie',
    name: 'Overtime Junkie',
    blurb: 'Overtime pays x3 at 6 AM. Stink limit -10.',
    rarity: 'uncommon',
    unlock: 'boss2',
    apply(m) {
      m.overtimeShare = 2;
      m.stinkMax -= 10;
    },
  },
  {
    id: 'chaingang',
    name: 'Chain Gang',
    blurb: 'Cascades also go diagonal.',
    rarity: 'rare',
    unlock: 'boss1',
    apply: (m) => void (m.cascadeDiagonal = true),
  },
  {
    id: 'streaker',
    name: 'Streaker',
    blurb: 'Streak window +1s, and the streak tops out at x4.',
    rarity: 'uncommon',
    unlock: 'daily',
    apply(m) {
      m.streakWindowBonus += 1;
      m.streakMaxMul = Math.max(m.streakMaxMul, 4);
    },
  },
  {
    id: 'apron',
    name: "Alchemist's Apron",
    blurb: 'Every brew makes two.',
    rarity: 'rare',
    unlock: 'recipes5',
    apply: (m) => void (m.brewTwins = true),
  },
  {
    id: 'sticky',
    name: 'Sticky Fingers',
    blurb: 'Each delivery has a 20% chance to pay double.',
    rarity: 'common',
    unlock: null,
    apply: (m) => void (m.doublePayChance = Math.min(1, m.doublePayChance + P.stickyChance)),
  },
  {
    id: 'crusherpro',
    name: 'Industrial Crusher',
    blurb: `No Crusher cooldown, and it pays ${P.crusherPerTier} a tier.`,
    rarity: 'common',
    unlock: null,
    apply(m) {
      m.compactorCooldownSec = 0;
      m.compactorPayPerTier = Math.max(m.compactorPayPerTier, P.crusherPerTier);
    },
  },
  {
    id: 'freshener',
    name: 'Air Freshener',
    blurb: 'Stink gains -35%, and it fades twice as fast.',
    rarity: 'common',
    unlock: null,
    apply(m) {
      m.stinkGainMul *= 0.65;
      m.stinkDecayMul *= 2;
    },
  },
  {
    id: 'owl',
    name: 'Plastic Owl',
    blurb: "60% fewer gulls. They won't eat past a can.",
    rarity: 'common',
    unlock: null,
    apply(m) {
      m.gullChanceMul *= 0.4;
      m.gullEatMax = Math.min(m.gullEatMax, 2);
    },
  },
  {
    id: 'spender',
    name: "Big Spender's Card",
    blurb: 'A 4th raccoon: a Big Spender who pays extra.',
    rarity: 'uncommon',
    unlock: null,
    apply: (m) => void (m.orderSlots = Math.max(m.orderSlots, 4)),
  },
  {
    id: 'snack',
    name: 'Midnight Snack',
    blurb: 'Deliveries before 1 AM pay x2.',
    rarity: 'common',
    unlock: null,
    apply: (m) => void (m.earlyPayMul *= 2),
  },
  {
    id: 'goose',
    name: 'Golden Goose',
    blurb: 'Gull Gang + Gull Gang lays the Golden Egg.',
    rarity: 'rare',
    unlock: null,
    apply: (m) => void (m.gooseEgg = true),
  },
  {
    id: 'flyfarm',
    name: 'Fly Farm',
    blurb: `Each smelly piece earns ${P.flyPayPerSec} a second. Stink gains +25%.`,
    rarity: 'uncommon',
    unlock: 'king',
    apply(m) {
      m.smellyPayPerSec += P.flyPayPerSec;
      m.stinkGainMul *= 1.25;
    },
  },
  {
    id: 'clearance',
    name: 'Clearance Card',
    blurb: 'Swap Meet prices -25%, and rerolls are half price.',
    rarity: 'common',
    unlock: null,
  },
  {
    id: 'recycler',
    name: 'Recycling Bin',
    blurb: 'Crushing a piece gives back a Dumpster charge.',
    rarity: 'common',
    unlock: null,
    apply: (m) => void (m.crushRefill = true),
  },
  {
    id: 'junkmail',
    name: 'Junk Mail',
    blurb: 'The truck never brings bottle caps.',
    rarity: 'uncommon',
    unlock: null,
    apply(m) {
      const odds = [...m.truckTierOdds];
      if (odds.length > 1) odds[0] = 0;
      m.truckTierOdds = odds;
    },
  },
  {
    id: 'ratrace',
    name: 'Rat Race',
    blurb: 'Raccoons have half the patience, and pay x1.75.',
    rarity: 'uncommon',
    unlock: null,
    apply(m) {
      m.patienceMul *= 0.5;
      m.orderPayMul *= 1.75;
    },
  },
  {
    id: 'recipecard',
    name: "Grandma's Recipe Card",
    blurb: "Each night, one recipe you haven't found is revealed.",
    rarity: 'common',
    unlock: null,
  },
  {
    id: 'biglid',
    name: 'Bigger Lid',
    blurb: '+4 Dumpster charges, and they refill 30% faster.',
    rarity: 'common',
    unlock: null,
    apply(m) {
      m.dumpsterCharges += 4;
      m.dumpsterRefillSec *= 0.7;
    },
  },
];

const BY_ID = new Map(CONTRABAND.map((c) => [c.id, c]));

export function contrabandDef(id: ContrabandId): ContrabandDef {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`no contraband ${id}`);
  return d;
}

export function isContraband(id: unknown): id is ContrabandId {
  return typeof id === 'string' && BY_ID.has(id as ContrabandId);
}

/** The milestones, in the order the title and the FIRED card list them. */
export const MILESTONES: readonly { id: MilestoneId; name: string; how: string }[] = [
  { id: 'boss1', name: 'Passed Inspection', how: 'Beat The Inspection' },
  { id: 'egg', name: 'Golden', how: 'Lay a Golden Egg' },
  { id: 'fired', name: 'Pink Slip', how: 'Get fired' },
  { id: 'daily', name: 'Daily Grind', how: 'Finish a Daily Dump' },
  { id: 'recipes5', name: 'Home Cook', how: 'Find 5 recipes' },
  { id: 'boss2', name: 'Gull Tamer', how: 'Beat the Gull God Raid' },
  { id: 'king', name: 'Kingmaker', how: 'Crown the Trash King' },
];

export type ForemanId = 'gary' | 'linda' | 'mange' | 'pete';

/** Who runs your shift: picked at the start of a run (3-4 of them, unlocked by milestones). */
export interface ForemanDef {
  id: ForemanId;
  name: string;
  blurb: string;
  /** The raccoon drawn on the card. */
  raccoon: string;
  unlock: MilestoneId | null;
  /** Contraband you start with ('rare' picks a random rare one). */
  start: readonly (ContrabandId | 'rare')[];
  /** Contraband slots this run (the usual is TUNING.run.slots). */
  slots?: number;
}

export const FOREMEN: readonly ForemanDef[] = [
  { id: 'gary', name: 'Gary', raccoon: 'gary', blurb: 'Wants it NOW. Starts with the Bigger Lid.', unlock: null, start: ['biglid'] },
  {
    id: 'linda',
    name: 'Linda',
    raccoon: 'linda',
    blurb: "Only the finest, at the finest prices. Starts with Big Spender's Card and the Clearance Card.",
    unlock: 'boss1',
    start: ['spender', 'clearance'],
  },
  {
    id: 'mange',
    name: 'Grandma Mange',
    raccoon: 'mange',
    blurb: "Knows a recipe or two. Starts with Grandma's Recipe Card and the Air Freshener.",
    unlock: 'recipes5',
    start: ['recipecard', 'freshener'],
  },
  {
    id: 'pete',
    name: "Lil' Pete",
    raccoon: 'pete',
    blurb: 'Dreams big. Starts with a random rare Contraband, but only 4 slots.',
    unlock: 'king',
    start: ['rare'],
    slots: 4,
  },
];

export function foremanDef(id: ForemanId): ForemanDef {
  return FOREMEN.find((f) => f.id === id) ?? (FOREMEN[0] as ForemanDef);
}
