// Putting new junk on the board: pick an empty cell, put the piece there (so nothing else takes
// the cell) and send it flying. No room at all: it's an overflow and it stinks.
import type { ItemId } from '../data/items';
import { TUNING } from '../data/tuning';
import { makePiece } from './board';
import { noteItem, type Flight, type GameState, type Source } from './state';
import { addStink } from './stink';

/**
 * Launch `id` from `from` to a random empty cell. Returns false if it overflowed. `slot`: the
 * order slot that kicked it ('kick'), or which truck tipped it ('truck': 0, or 1 for the second).
 */
export function launch(s: GameState, id: ItemId, from: Source, dur: number, slot = 0): boolean {
  const empties = s.board.empties();
  if (empties.length === 0) {
    overflow(s, id);
    return false;
  }
  const [c, r] = s.rng.pick(empties);
  const p = makePiece(id, s.time);
  s.board.set(c, r, p);
  s.flights.push({ uid: p.uid, c, r, from, t: 0, dur, slot });
  noteItem(s, id);
  s.events.push({ type: 'spawn', id, c, r, from });
  return true;
}

export function overflow(s: GameState, id: ItemId): void {
  s.stats.overflows++;
  s.events.push({ type: 'overflow', id });
  addStink(s, TUNING.stink.perOverflowItem, 'overflow');
}

/** Advance every piece in the air; the ones that arrive push a `land` event. */
export function updateFlights(s: GameState, dt: number): void {
  if (s.flights.length === 0) return;
  const still: Flight[] = [];
  for (const f of s.flights) {
    f.t += dt;
    if (f.t < f.dur) {
      still.push(f);
      continue;
    }
    const p = s.board.get(f.c, f.r);
    if (p && p.uid === f.uid) s.events.push({ type: 'land', id: p.id, c: f.c, r: f.r });
  }
  s.flights = still;
}
