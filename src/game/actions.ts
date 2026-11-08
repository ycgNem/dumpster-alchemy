// The player's hands: pick a piece up, drop it somewhere. The scene turns the pointer into a
// Target with the layout; the bot builds Targets directly. Same rules either way.
import { ITEMS, type ItemId } from '../data/items';
import { makePiece, mergeResult } from './board';
import { afterMerge, eggResult, useEgg } from './gulls';
import { deliver, wants } from './orders';
import { earn } from './shift';
import { grabbable, inFlight, noteItem, type GameState } from './state';

export type Target =
  | { kind: 'cell'; c: number; r: number }
  | { kind: 'order'; slot: number }
  | { kind: 'compactor' }
  | { kind: 'none' };

/** What a drop would do. 'home' is the cell it came from (put it back, nothing happens). */
/** 'egg': a Golden Egg cracked over junk (it rises two tiers). */
export type DropKind = 'merge' | 'egg' | 'move' | 'swap' | 'deliver' | 'compact' | 'home' | 'bad';

export const NO_TARGET: Target = { kind: 'none' };

/** What dropping the piece at (c, r) on `t` would do, without doing it. */
export function dropKind(s: GameState, c: number, r: number, t: Target): DropKind {
  const p = s.board.get(c, r);
  if (!p) return 'bad';
  switch (t.kind) {
    case 'none':
      return 'bad';
    case 'compactor':
      return s.compactor.cooldown > 0 ? 'bad' : 'compact';
    case 'order':
      return wants(s, t.slot, p.id) ? 'deliver' : 'bad';
    case 'cell': {
      if (t.c === c && t.r === r) return 'home';
      if (!s.board.inside(t.c, t.r)) return 'bad';
      const q = s.board.get(t.c, t.r);
      if (!q) return 'move';
      if (inFlight(s, q.uid)) return 'bad';
      if (mergeResult(p.id, q.id)) return 'merge';
      if (p.id === 'golden_egg' && eggResult(q.id)) return 'egg';
      return p.id === q.id ? 'bad' : 'swap';
    }
  }
}

export function pickUp(s: GameState, c: number, r: number, x = 0, y = 0): boolean {
  if (s.drag) return false;
  const p = grabbable(s, c, r);
  if (!p) return false;
  s.drag = { uid: p.uid, c, r, x, y };
  s.events.push({ type: 'pickup', id: p.id, c, r });
  return true;
}

/** Drop what's held on `t`. Anything that doesn't work snaps back with an `invalid` event. */
export function drop(s: GameState, t: Target): DropKind {
  const d = s.drag;
  if (!d) return 'bad';
  s.drag = null;
  const p = s.board.get(d.c, d.r);
  if (!p || p.uid !== d.uid || s.status !== 'playing') return 'bad';
  const kind = dropKind(s, d.c, d.r, t);
  switch (kind) {
    case 'home':
      break;
    case 'bad':
      s.events.push({ type: 'invalid', c: d.c, r: d.r });
      break;
    case 'move':
      if (t.kind !== 'cell') break;
      s.board.set(d.c, d.r, null);
      s.board.set(t.c, t.r, p);
      s.events.push({ type: 'move', id: p.id, c: t.c, r: t.r });
      break;
    case 'swap': {
      if (t.kind !== 'cell') break;
      const q = s.board.get(t.c, t.r);
      s.board.set(d.c, d.r, q);
      s.board.set(t.c, t.r, p);
      s.events.push({ type: 'swap', c: d.c, r: d.r, c2: t.c, r2: t.r });
      break;
    }
    case 'merge': {
      if (t.kind !== 'cell') break;
      const q = s.board.get(t.c, t.r);
      const to = q ? mergeResult(p.id, q.id) : null;
      if (!q || !to) break;
      // Bin Juice upgrades whatever it meets; otherwise both pieces are the same id.
      const from = p.id === 'bin_juice' ? q.id : p.id;
      // Full Moon: a merge may skip a tier (never past the top of its chain).
      const skip = ITEMS[to].next;
      const skipped = skip !== null && s.mods.skipChance > 0 && s.rng.chance(s.mods.skipChance);
      const made: ItemId = skipped && skip ? skip : to;
      s.board.set(d.c, d.r, null);
      s.board.set(t.c, t.r, makePiece(made, s.time));
      if (skipped) {
        noteItem(s, to);
        s.stats.skips++;
      }
      const first = noteItem(s, made);
      const def = ITEMS[made];
      s.stats.merges++;
      s.events.push({ type: 'merge', from, to: made, chain: def.chain, tier: def.tier, c: t.c, r: t.r, first, skipped: skipped || undefined });
      afterMerge(s, made, t.c, t.r);
      break;
    }
    case 'egg':
      if (t.kind === 'cell') useEgg(s, d.c, d.r, t.c, t.r);
      break;
    case 'deliver':
      if (t.kind === 'order') deliver(s, t.slot, d.c, d.r);
      break;
    case 'compact':
      s.board.set(d.c, d.r, null);
      s.compactor.cooldown = s.mods.compactorCooldownSec;
      s.stats.compacted++;
      s.events.push({ type: 'compact', id: p.id });
      earn(s, crushPay(s, p.id));
      break;
  }
  return kind;
}

/**
 * Shinies the Crusher pays for this piece tonight: junk tier x the Industrial Crusher's pay per
 * tier, x the night's compactorPayMul (Bulk Pickup x3, and then at least 1 per tier without the upgrade).
 */
export function crushPay(s: GameState, id: ItemId): number {
  const d = ITEMS[id];
  if (d.chain !== 'junk') return 0;
  const m = s.mods;
  const perTier = m.compactorPayPerTier > 0 ? m.compactorPayPerTier : m.compactorPayMul > 1 ? 1 : 0;
  return Math.round(d.tier * perTier * m.compactorPayMul);
}

export function cancelDrag(s: GameState): void {
  const d = s.drag;
  if (!d) return;
  s.drag = null;
  s.events.push({ type: 'invalid', c: d.c, r: d.r });
}

/** Pick up and drop in one go (the bot's hands). */
export function act(s: GameState, c: number, r: number, t: Target): DropKind {
  if (!pickUp(s, c, r)) return 'bad';
  return drop(s, t);
}
