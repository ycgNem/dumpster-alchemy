// What lasts across runs (docs/V2.md "Persists across runs"): the Almanac and the Recipe Book,
// the records, the Daily Dump's scores by date, and the milestones that unlock more Contraband
// and Foremen. Headless; src/game/save.ts stores it next to the run.
import { CONTRABAND, FOREMEN, type ContrabandId, type ForemanDef, type ForemanId, type MilestoneId } from '../data/contraband';
import type { ItemId } from '../data/items';
import type { NightResult, Run } from './run';

export interface Meta {
  /** Every item ever seen (the Almanac). */
  discovered: ItemId[];
  /** Every recipe ever brewed, by result id (the Recipe Book; src/game/alchemy.ts). */
  recipes: ItemId[];
  /** The highest junk tier ever built. */
  bestTier: number;
  milestones: MilestoneId[];
  /** Runs started, Kings crowned, times fired. */
  runs: number;
  wins: number;
  fired: number;
  /** The furthest night any run reached, and the most Shinies one run earned. */
  bestNight: number;
  bestRun: number;
  /** Daily Dump scores by local date ("2026-11-08"); a played day can't be played again. */
  daily: Record<string, number>;
  /** The Foreman picked last time (the pick starts there). */
  foreman: ForemanId;
  /** The last Daily Dump's share card (the title's Daily button copies it again). */
  lastShare: string;
}

export function newMeta(): Meta {
  return {
    discovered: [],
    recipes: [],
    bestTier: 0,
    milestones: [],
    runs: 0,
    wins: 0,
    fired: 0,
    bestNight: 0,
    bestRun: 0,
    daily: {},
    foreman: 'gary',
    lastShare: '',
  };
}

export function hasMilestone(meta: Meta, id: MilestoneId | null): boolean {
  return id === null || meta.milestones.includes(id);
}

/** Contraband that can turn up in loot and the Swap Meet. */
export function contrabandPool(meta: Meta): ContrabandId[] {
  return CONTRABAND.filter((c) => hasMilestone(meta, c.unlock)).map((c) => c.id);
}

export function foremenOpen(meta: Meta): ForemanDef[] {
  return FOREMEN.filter((f) => hasMilestone(meta, f.unlock));
}

/** Reach a milestone (once ever). Returns true if it's new. */
export function award(meta: Meta, id: MilestoneId): boolean {
  if (meta.milestones.includes(id)) return false;
  meta.milestones.push(id);
  return true;
}

/** What a milestone opens up, one short line each (the FIRED card, the win card). */
export function unlockLines(id: MilestoneId): string[] {
  const out: string[] = [];
  for (const c of CONTRABAND) if (c.unlock === id) out.push(`${c.name} joins the pool`);
  for (const f of FOREMEN) if (f.unlock === id) out.push(`Foreman: ${f.name}`);
  return out;
}

/** Today's key in the local calendar: "2026-11-08". */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * After a night: carry the run's discoveries into the meta, keep the records, and reach any
 * milestones (they go on the run's list too, for its end card). Returns the new ones.
 */
export function afterNight(meta: Meta, run: Run, res: NightResult): MilestoneId[] {
  meta.discovered = [...new Set([...meta.discovered, ...run.discovered])];
  meta.recipes = [...new Set([...meta.recipes, ...run.recipes])];
  meta.bestTier = Math.max(meta.bestTier, res.bestTier);
  const got: MilestoneId[] = [];
  const hit = (id: MilestoneId): void => {
    if (award(meta, id)) got.push(id);
  };
  if (run.daily > 0) hit('daily');
  else {
    meta.bestNight = Math.max(meta.bestNight, res.won ? res.night + 1 : res.night);
    if (res.won && res.night === 4) hit('boss1');
    if (res.won && res.night === 7) hit('boss2');
    if (res.crowned) {
      hit('king');
      meta.wins++;
    }
    if (res.fired) {
      hit('fired');
      meta.fired++;
    }
    if (run.over) meta.bestRun = Math.max(meta.bestRun, run.stats.earned);
  }
  if (res.stats.eggs > 0) hit('egg');
  if (meta.recipes.length >= 5) hit('recipes5');
  for (const id of got) if (!run.earned.includes(id)) run.earned.push(id);
  return got;
}
