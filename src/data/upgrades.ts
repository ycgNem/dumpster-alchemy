// The Swap Meet (docs/DESIGN.md): upgrades with levels and prices, and Bin Juice, a consumable.
// Each upgrade maps its level to `Mods` (src/game/state.ts); the night's own mods go on top
// (src/data/nights.ts). Prices are in Shinies from the bank. Tuned with `npm run sim -- campaign`.
import { defaultMods, type Mods } from '../game/state';

export type UpgradeId = 'lid' | 'hinges' | 'raccoon' | 'compactor' | 'freshener' | 'owl';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** The 24 x 24 icon in ui.json. */
  icon: string;
  /** What it's for, in one line (the tooltip). */
  blurb: string;
  /** Price of level 1, 2, ... (its length is the max level). */
  prices: readonly number[];
  /** What each level does, short enough for a price tag. */
  effects: readonly string[];
  /** The nights whose rule this upgrade clearly helps with (the Swap Meet can point it out before them). */
  shines: readonly number[];
  /** Set the mods for this level (0 = not bought, leaves them alone). */
  apply(level: number, m: Mods): void;
}

const BASE = defaultMods();

function at<T>(list: readonly T[], level: number, fallback: T): T {
  return level <= 0 ? fallback : (list[Math.min(level, list.length) - 1] ?? fallback);
}

const LID_CHARGES = [8, 10, 12] as const;
const HINGE_SEC = [4, 3.2, 2.5] as const;
const CRUSH_SEC = [6, 4, 2.5] as const;
const CRUSH_PAY = [1, 2, 3] as const;
const FRESH_MUL = [1.75, 2.75, 4] as const;
/** The Air Freshener also takes the edge off every Stink gain (overflow, storm-offs, crowding). */
const FRESH_GAIN = [0.85, 0.7, 0.55] as const;
const OWL_MUL = [0.75, 0.55, 0.35] as const;
/** ...and the gulls that still come only dare eat junk up to this tier (0: nothing). */
const OWL_EAT = [2, 1, 0] as const;

export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'lid',
    name: 'Bigger Lid',
    icon: 'up_lid',
    blurb: 'More Dumpster charges before the lid runs dry.',
    prices: [1100, 3000, 7500],
    effects: ['8 lid charges', '10 lid charges', '12 lid charges'],
    shines: [3],
    apply(level, m) {
      m.dumpsterCharges = at(LID_CHARGES, level, BASE.dumpsterCharges);
    },
  },
  {
    id: 'hinges',
    name: 'Greased Hinges',
    icon: 'up_hinges',
    blurb: 'The Dumpster lid refills faster.',
    prices: [1200, 3300, 8000],
    effects: ['refill every 4s', 'refill every 3.2s', 'refill every 2.5s'],
    shines: [3, 6],
    apply(level, m) {
      m.dumpsterRefillSec = at(HINGE_SEC, level, BASE.dumpsterRefillSec);
    },
  },
  {
    id: 'raccoon',
    name: 'Extra Raccoon',
    icon: 'up_raccoon',
    blurb: 'A fourth order slot, for big spenders: they want your best junk and pay extra for it.',
    prices: [6000],
    effects: ['4th slot: big spenders'],
    shines: [6, 8],
    apply(level, m) {
      m.orderSlots = level > 0 ? 4 : BASE.orderSlots;
    },
  },
  {
    id: 'compactor',
    name: 'Industrial Crusher',
    icon: 'up_compactor',
    blurb: 'The Crusher cools down faster, and pays for scrap.',
    prices: [1300, 3600, 9000],
    effects: ['6s cooldown, 1/tier', '4s cooldown, 2/tier', '2.5s cooldown, 3/tier'],
    shines: [8, 2],
    apply(level, m) {
      m.compactorCooldownSec = at(CRUSH_SEC, level, BASE.compactorCooldownSec);
      m.compactorPayPerTier = at(CRUSH_PAY, level, BASE.compactorPayPerTier);
    },
  },
  {
    id: 'freshener',
    name: 'Air Freshener',
    icon: 'up_freshener',
    blurb: 'Pine-scented. Stink builds slower and fades faster, even when the lot is full.',
    prices: [1200, 3400, 8500],
    effects: ['stink -15%, fades x1.75', 'stink -30%, fades x2.75', 'stink -45%, fades x4'],
    shines: [5, 9, 10],
    apply(level, m) {
      m.stinkDecayMul = at(FRESH_MUL, level, BASE.stinkDecayMul);
      m.stinkGainMul = at(FRESH_GAIN, level, BASE.stinkGainMul);
    },
  },
  {
    id: 'owl',
    name: 'Plastic Owl',
    icon: 'up_owl',
    blurb: 'Gulls hate it. Fewer drop in, and they leave your good junk alone.',
    prices: [1100, 3100, 8000],
    effects: ['25% fewer gulls, eat caps & cans only', '45% fewer gulls, eat caps only', '65% fewer gulls, eat nothing'],
    shines: [4, 7],
    apply(level, m) {
      m.gullChanceMul = at(OWL_MUL, level, BASE.gullChanceMul);
      m.gullEatMax = at(OWL_EAT, level, BASE.gullEatMax);
    },
  },
];

/** Bin Juice: a wildcard that merges with anything. Bought ones land on the board next night. */
export const BIN_JUICE = {
  name: 'Bin Juice',
  blurb: 'Merges with anything. Lands on the lot at the start of the next night.',
  price: 1000,
  /** Most you can carry into one night. */
  max: 3,
} as const;

export function upgradeDef(id: UpgradeId): UpgradeDef {
  const d = UPGRADES.find((u) => u.id === id);
  if (!d) throw new Error(`no upgrade ${id}`);
  return d;
}

export type Levels = Record<UpgradeId, number>;

export function noLevels(): Levels {
  return { lid: 0, hinges: 0, raccoon: 0, compactor: 0, freshener: 0, owl: 0 };
}

/** The mods for a set of upgrade levels, on top of a night-1 baseline. */
export function upgradeMods(levels: Levels): Mods {
  const m = defaultMods();
  for (const u of UPGRADES) u.apply(levels[u.id], m);
  return m;
}
