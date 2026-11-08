// The run between nights: which night is next, the bank of Shinies, the Swap Meet's upgrades and
// Bin Juice, the Almanac's discoveries, and the records. Headless like the rest of src/game/ (the
// campaign sim plays whole runs in Node); saving is src/game/save.ts.
//
// The bank: everything a night earns goes in the bank. The quota is about earning that much in
// one night; the Swap Meet spends the bank.
//
// A lost night stings but doesn't wipe the run: you keep half of what you earned (rounded down),
// the night doesn't advance, and you play it again (a fresh seed each try). You can visit the
// Swap Meet first, so the half you kept can buy the upgrade that gets you through. Bin Juice is
// used up by any finished night, won or lost; quitting a night half way keeps it. The King night
// pays no Shinies, so losing it can't buy help: instead the crew chips in Bin Juice for the next
// try (one per try so far, up to the most you can carry) and airs the lot out a bit (`retryEase`),
// so no run is stuck there for good.
import { ITEMS, JUNK_CHAIN, type ItemId } from '../data/items';
import { NIGHTS, nightDef, type NightDef } from '../data/nights';
import { BIN_JUICE, UPGRADES, noLevels, upgradeDef, upgradeMods, type Levels, type UpgradeId } from '../data/upgrades';
import { TUNING } from '../data/tuning';
import { launch } from './spawn';
import { createState, type GameState, type Mods, type NightStats } from './state';

/** What a lost night keeps of its Shinies. */
export const LOST_KEEP = 0.5;

export interface RunStats {
  nightsWon: number;
  nightsLost: number;
  /** Shinies earned over the whole run (before a loss halves them). */
  earned: number;
  ordersFilled: number;
  merges: number;
}

/** How a night went, for the report. */
export interface NightResult {
  night: number;
  name: string;
  goal: NightDef['goal'];
  won: boolean;
  /** Why it ended (state.ts EndReason): clockout, shift, stinkAfterQuota, king; stink, quota; endless. */
  endReason: GameState['endReason'];
  /** Seconds after midnight the quota was met, or null. */
  quotaMetAt: number | null;
  purse: number;
  quota: number;
  /** What went into the bank (half the purse on a loss). */
  banked: number;
  bank: number;
  bestTier: number;
  /** Items seen for the first time ever tonight. */
  found: ItemId[];
  stats: NightStats;
  /** Endless: a new best score. */
  record: boolean;
  /** Night 10 won: the Trash King is crowned (first time). */
  crowned: boolean;
  seed: number;
}

export interface Run {
  /** Base seed; each night and each try at it gets its own. */
  seed: number;
  /** The night to play next, 1-10; NIGHTS.length + 1 is Endless. */
  night: number;
  /** Tries at the current night so far (for the seed). */
  tries: number;
  bank: number;
  levels: Levels;
  /** Bin Juice bought for the next night. */
  binJuice: number;
  /** Everything ever seen, for the Almanac. */
  discovered: ItemId[];
  /** The highest junk tier ever built. */
  bestTier: number;
  /** Night 10 won: Endless is open. */
  crowned: boolean;
  endlessBest: number;
  stats: RunStats;
  /** The last finished night (the report reads it). */
  last: NightResult | null;
}

export function newRun(seed: number): Run {
  return {
    seed: seed >>> 0,
    night: 1,
    tries: 0,
    bank: 0,
    levels: noLevels(),
    binJuice: 0,
    discovered: [],
    bestTier: 0,
    crowned: false,
    endlessBest: 0,
    stats: { nightsWon: 0, nightsLost: 0, earned: 0, ordersFilled: 0, merges: 0 },
    last: null,
  };
}

export function currentNight(run: Run): NightDef {
  return nightDef(run.night);
}

export function isEndless(run: Run): boolean {
  return run.night > NIGHTS.length;
}

/** Keys of a night's mods that multiply the upgrades' value instead of replacing it. */
function multiplies(k: keyof Mods): boolean {
  return k.endsWith('Mul');
}

/** The upgrades' mods with a night's mods on top. */
export function nightMods(levels: Levels, night: NightDef): Mods {
  const m = upgradeMods(levels);
  const out: Record<string, unknown> = { ...m };
  for (const [k, v] of Object.entries(night.mods) as [keyof Mods, Mods[keyof Mods]][]) {
    if (v === undefined) continue;
    out[k] = multiplies(k) && typeof v === 'number' ? (m[k] as number) * v : v;
  }
  return out as unknown as Mods;
}

export function nightSeed(run: Run): number {
  return (run.seed + run.night * 7919 + run.tries * 104729) % 2147483647;
}

/**
 * The King night eases a little with every failed try (the crew airs the lot out between tries):
 * Stink gains x this, down to `TUNING.king.retryEaseMin`. 1 on any other night or a first try.
 */
export function retryEase(run: Run): number {
  if (currentNight(run).goal !== 'king' || run.tries <= 0) return 1;
  const K = TUNING.king;
  return Math.max(K.retryEaseMin, 1 - K.retryEasePerTry * run.tries);
}

/** Build tonight's GameState. Bought Bin Juice flies out of the Dumpster at the start. */
export function startNight(run: Run): GameState {
  const def = currentNight(run);
  const mods = nightMods(run.levels, def);
  mods.stinkGainMul *= retryEase(run);
  const s = createState({
    seed: nightSeed(run),
    night: run.night,
    quota: def.quota,
    goal: def.goal,
    mods,
    discovered: run.discovered,
  });
  for (let i = 0; i < run.binJuice; i++) launch(s, 'bin_juice', 'dumpster', TUNING.dumpster.flightSec + i * 0.15);
  return s;
}

/** Bank the night, record it, and move the run on (or not, if it was lost). */
export function finishNight(run: Run, s: GameState): NightResult {
  const def = nightDef(s.night);
  const endless = def.goal === 'endless';
  // Endless can't be "lost": it always ends in Stink, and the score is the purse.
  const won = s.status === 'won';
  const banked = won || endless ? s.purse : Math.floor(s.purse * LOST_KEEP);
  const known = new Set(run.discovered);
  const found = [...s.discovered].filter((id) => !known.has(id));
  const record = endless && s.purse > run.endlessBest;
  const crowned = def.goal === 'king' && won && !run.crowned;

  run.bank += banked;
  run.discovered = [...known, ...found].filter((id) => id in ITEMS);
  run.bestTier = Math.max(run.bestTier, s.bestTier);
  run.binJuice = 0;
  run.stats.earned += s.purse;
  run.stats.ordersFilled += s.stats.ordersFilled;
  run.stats.merges += s.stats.merges;
  if (endless) {
    run.endlessBest = Math.max(run.endlessBest, s.purse);
    run.tries++;
  } else if (won) {
    run.stats.nightsWon++;
    run.night++;
    run.tries = 0;
    if (def.goal === 'king') run.crowned = true;
  } else {
    run.stats.nightsLost++;
    run.tries++;
    if (def.goal === 'king') run.binJuice = Math.min(BIN_JUICE.max, run.tries);
  }

  const result: NightResult = {
    night: s.night,
    name: def.name,
    goal: def.goal,
    won,
    endReason: s.endReason,
    quotaMetAt: s.quotaMetAt,
    purse: s.purse,
    quota: s.quota,
    banked,
    bank: run.bank,
    bestTier: s.bestTier,
    found,
    stats: { ...s.stats },
    record,
    crowned,
    seed: s.seed,
  };
  run.last = result;
  return result;
}

/** What the next level of an upgrade costs, or null when it's maxed. */
export function priceOf(run: Run, id: UpgradeId): number | null {
  return upgradeDef(id).prices[run.levels[id]] ?? null;
}

export function canBuy(run: Run, id: UpgradeId): boolean {
  const p = priceOf(run, id);
  return p !== null && run.bank >= p;
}

/** Buy the next level. Returns false if it's maxed or the bank is short. */
export function buy(run: Run, id: UpgradeId): boolean {
  const p = priceOf(run, id);
  if (p === null || run.bank < p) return false;
  run.bank -= p;
  run.levels[id]++;
  return true;
}

export function canBuyJuice(run: Run): boolean {
  return run.binJuice < BIN_JUICE.max && run.bank >= BIN_JUICE.price;
}

export function buyJuice(run: Run): boolean {
  if (!canBuyJuice(run)) return false;
  run.bank -= BIN_JUICE.price;
  run.binJuice++;
  return true;
}

/** Every upgrade level bought, as a fraction of all there are (for the title's blurb). */
export function upgradeProgress(run: Run): number {
  const total = UPGRADES.reduce((a, u) => a + u.prices.length, 0);
  const have = UPGRADES.reduce((a, u) => a + run.levels[u.id], 0);
  return have / total;
}

/** The highest junk item ever built, or null. */
export function bestItem(run: Run): ItemId | null {
  return run.bestTier > 0 ? (JUNK_CHAIN[run.bestTier - 1] ?? null) : null;
}
