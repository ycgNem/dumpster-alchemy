// The Dumpster: click it to spit junk onto a random empty cell. Lid charges refill over time.
import { junkAt } from '../data/items';
import { TUNING } from '../data/tuning';
import { feverOn } from './combo';
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
  // The Raccoon Rave (src/game/combo.ts): clicks cost no charge.
  const free = feverOn(s);
  const ok = (d.charges > 0 || free) && s.board.empties().length > 0;
  s.events.push({ type: 'dumpsterClick', ok });
  if (!ok) return false;
  if (!free) d.charges--;
  s.stats.dumpsterClicks++;
  // (Double Bagger: two per click.)
  for (let i = 0; i < Math.max(1, s.mods.dumpsterPerClick); i++) {
    const tier = s.rng.weighted(TUNING.dumpster.tierOdds) + 1;
    launch(s, junkAt(tier), 'dumpster', TUNING.dumpster.flightSec + i * 0.12);
  }
  return true;
}

/** Seconds until the next lid charge, or 0 when full. */
export function nextCharge(s: GameState): number {
  const d = s.dumpster;
  return d.charges >= d.max ? 0 : s.mods.dumpsterRefillSec - d.refill;
}
