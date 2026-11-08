// The Dumpster: click it to spit junk onto a random empty cell. Lid charges refill over time.
import { junkAt } from '../data/items';
import { TUNING } from '../data/tuning';
import { launch } from './spawn';
import type { GameState } from './state';

export function updateDumpster(s: GameState, dt: number): void {
  const d = s.dumpster;
  if (d.charges >= d.max) {
    d.refill = 0;
    return;
  }
  d.refill += dt;
  if (d.refill >= s.mods.dumpsterRefillSec) {
    d.refill -= s.mods.dumpsterRefillSec;
    d.charges++;
  }
}

/** Returns true if junk came out. Empty lid or a full board: the lid just rattles. */
export function clickDumpster(s: GameState): boolean {
  if (s.status !== 'playing') return false;
  const d = s.dumpster;
  const ok = d.charges > 0 && s.board.empties().length > 0;
  s.events.push({ type: 'dumpsterClick', ok });
  if (!ok) return false;
  d.charges--;
  s.stats.dumpsterClicks++;
  const tier = s.rng.weighted(TUNING.dumpster.tierOdds) + 1;
  launch(s, junkAt(tier), 'dumpster', TUNING.dumpster.flightSec);
  return true;
}

/** Seconds until the next lid charge, or 0 when full. */
export function nextCharge(s: GameState): number {
  const d = s.dumpster;
  return d.charges >= d.max ? 0 : s.mods.dumpsterRefillSec - d.refill;
}
