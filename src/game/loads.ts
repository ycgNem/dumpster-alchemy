// Things rolled ahead of time: the truck's next load (so the HUD can say "next load: 9" before it
// lands) and when tonight's jackpot raccoon walks up. Kept apart from truck.ts and orders.ts so
// createState can call it without an import cycle.
import { junkAt, type ItemId } from '../data/items';
import { TUNING } from '../data/tuning';
import type { GameState } from './state';

const NIGHT_SEC = TUNING.shift.secondsPerHour * TUNING.shift.hours;

/**
 * How hard the truck pushes at `time`, 0 at midnight to 1 at 6 AM. Endless ramps more gently
 * (it reaches the 6 AM pace later) and keeps going past it, slowly (see truck.ts for the cap).
 */
export function truckPressure(s: GameState, time: number): number {
  if (s.goal !== 'endless') return Math.min(1, Math.max(0, time / NIGHT_SEC));
  const E = TUNING.endless;
  return Math.max(0, time / (NIGHT_SEC * E.rampStretch));
}

/** Endless: hours since the truck reached its 6 AM pace (0 on a normal night). */
export function endlessHoursPast(s: GameState, time: number): number {
  if (s.goal !== 'endless') return 0;
  return Math.max(0, time - NIGHT_SEC * TUNING.endless.rampStretch) / TUNING.shift.secondsPerHour;
}

/** The load the truck will tip at `time`: a size from the night's ramp, junk by tier odds. */
export function rollTruckLoad(s: GameState, time: number): ItemId[] {
  const T = TUNING.truck;
  const k = Math.min(1, truckPressure(s, time));
  const lo = T.loadStart[0] + (T.loadEnd[0] - T.loadStart[0]) * k;
  const hi = T.loadStart[1] + (T.loadEnd[1] - T.loadStart[1]) * k;
  const extra = TUNING.endless.loadPerHour * endlessHoursPast(s, time);
  const n = Math.max(1, Math.round((lo + s.rng.next() * (hi - lo) + extra) * s.mods.truckLoadMul));
  return Array.from({ length: n }, () => junkAt(s.rng.weighted(s.mods.truckTierOdds) + 1));
}

/** When tonight's jackpot order may arrive (null: no jackpot tonight, e.g. the King night). */
export function rollJackpotAt(s: GameState): number | null {
  const J = TUNING.jackpot;
  if (s.goal === 'king' || !s.mods.jackpotTiers) return null;
  return J.earliestSec + s.rng.next() * (J.latestSec - J.earliestSec);
}
