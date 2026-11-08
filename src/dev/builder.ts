// The "builder" bot for night 10 (Spring Cleaning): the greedy bot hands its best junk to the
// raccoons, so it never stacks up a Trash King. This one keeps everything from `keepFrom` up for
// the King, feeds orders only small stuff, merges the highest pair first, uses Bin Juice and the
// Golden Egg on its biggest piece without a partner, and crushes the smallest junk when crowded,
// or the smallest smelly junk when the Stink runs high.
import { ITEMS, JUNK_CHAIN, type ItemId } from '../data/items';
import { act } from '../game/actions';
import { mergeResult } from '../game/board';
import { alchemyMove } from './botAlchemy';
import { clickDumpster } from '../game/dumpster';
import { eggResult } from '../game/gulls';
import { inFlight, type GameState } from '../game/state';
import { isSmelly, stinkLimit } from '../game/stink';

export interface BuilderOpts {
  thinkSec: number;
  /** Never hand junk of this tier or higher to a raccoon. */
  keepFrom: number;
  /** Crush when this few cells (or fewer) are empty. */
  compactAt: number;
  /** Click the Dumpster only while more than this many cells are empty. */
  roomToClick: number;
  /** Above this share of the Stink limit, crush the smallest smelly junk whenever the Crusher is ready. */
  crushSmellyAt: number;
}

// On the King night orders ask for tier 5 at most and pay back junk a tier up, so feeding them
// everything they ask for helps the build (keepFrom 6 never holds anything back).
export const BUILDER_DEFAULT: BuilderOpts = { thinkSec: 1.0, keepFrom: 6, compactAt: 5, roomToClick: 30, crushSmellyAt: 0.5 };

interface Spot {
  id: ItemId;
  c: number;
  r: number;
  smelly: boolean;
}

export class Builder {
  readonly o: BuilderOpts;
  private wait = 0;

  constructor(o: BuilderOpts = BUILDER_DEFAULT) {
    this.o = o;
  }

  update(s: GameState, dt: number): void {
    if (s.status !== 'playing' || s.drag) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wait = this.think(s) ? this.o.thinkSec : 0.15;
  }

  private think(s: GameState): boolean {
    // Oldest first, so "the first one" of a kind is the smelliest.
    const spots: Spot[] = s.board
      .pieces()
      .filter(({ p }) => !inFlight(s, p.uid))
      .sort((a, b) => a.p.born - b.p.born)
      .map(({ p, c, r }) => ({ id: p.id, c, r, smelly: isSmelly(s, p) }));
    const empty = s.board.empties().length;
    const tier = (id: ItemId): number => ITEMS[id].tier;
    const junk = (id: ItemId): boolean => ITEMS[id].chain === 'junk';
    const counts = new Map<ItemId, number>();
    for (const p of spots) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);

    // 1. Feed the raccoons, but only small stuff (and gulls).
    const waiting = s.orders
      .map((o, slot) => ({ o, slot }))
      .filter((x) => x.o?.mood === 'waiting')
      .sort((a, b) => (a.o?.patience ?? 0) - (b.o?.patience ?? 0));
    for (const { o, slot } of waiting) {
      if (!o) continue;
      for (let k = 0; k < o.wants.length; k++) {
        const id = o.wants[k];
        if (id === undefined || o.got[k]) continue;
        if (junk(id) && tier(id) >= this.o.keepFrom) continue;
        const spot = spots.find((p) => p.id === id);
        if (spot) return act(s, spot.c, spot.r, { kind: 'order', slot }) === 'deliver';
      }
    }

    // 1b. Alchemy (src/dev/botAlchemy.ts): on the King night only the tools that raise junk (Soup,
    //     Magnet, Leftovers) get brewed and used.
    if (alchemyMove(s, new Set())) return true;

    // 2. Merge the highest pair (junk first: that's the King).
    let best: [Spot, Spot] | null = null;
    let bestScore = -1;
    const byId = new Map<ItemId, Spot[]>();
    for (const p of spots) {
      if (!ITEMS[p.id].next) continue;
      const list = byId.get(p.id) ?? [];
      list.push(p);
      byId.set(p.id, list);
    }
    for (const list of byId.values()) {
      const [a, b] = list;
      if (!a || !b || !mergeResult(a.id, b.id)) continue;
      const score = tier(a.id) + (junk(a.id) ? 10 : 0) + (a.smelly || b.smelly ? 0.5 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = [a, b];
      }
    }
    if (best) return act(s, best[0].c, best[0].r, { kind: 'cell', c: best[1].c, r: best[1].r }) === 'merge';

    // 3. Bin Juice and the Golden Egg go on the biggest junk that has no partner, if the result
    //    finds one (else on the biggest junk at all).
    const lone = spots
      .filter((p) => junk(p.id) && tier(p.id) < JUNK_CHAIN.length)
      .sort((a, b) => tier(b.id) - tier(a.id));
    const juice = spots.find((p) => p.id === 'bin_juice');
    if (juice && lone.length > 0) {
      const target = lone.find((p) => { const to = ITEMS[p.id].next; return to !== null && (counts.get(to) ?? 0) > 0; }) ?? lone[0];
      if (target) return act(s, juice.c, juice.r, { kind: 'cell', c: target.c, r: target.r }) === 'merge';
    }
    const egg = spots.find((p) => p.id === 'golden_egg');
    if (egg) {
      const ok = lone.filter((p) => eggResult(p.id));
      const target = ok.find((p) => (counts.get(eggResult(p.id) ?? p.id) ?? 0) > 0) ?? ok[0];
      if (target) return act(s, egg.c, egg.r, { kind: 'cell', c: target.c, r: target.r }) === 'egg';
    }

    // 4. Reeking: crush the smallest smelly junk below the King's ingredients.
    if (s.stink >= stinkLimit(s) * this.o.crushSmellyAt && s.compactor.cooldown <= 0) {
      const victim = spots
        .filter((p) => p.smelly && junk(p.id) && tier(p.id) < this.o.keepFrom)
        .sort((a, b) => tier(a.id) - tier(b.id))[0];
      if (victim) return act(s, victim.c, victim.r, { kind: 'compactor' }) === 'compact';
    }

    // 5. Crowded: crush a gull, else the smallest junk.
    if (empty <= this.o.compactAt && s.compactor.cooldown <= 0) {
      const score = (p: Spot): number => (ITEMS[p.id].chain === 'gull' ? tier(p.id) - 10 : junk(p.id) ? tier(p.id) : 99);
      const victim = [...spots].sort((a, b) => score(a) - score(b))[0];
      if (victim && score(victim) < 99) return act(s, victim.c, victim.r, { kind: 'compactor' }) === 'compact';
    }

    // 6. Lots of room: small junk for the raccoons.
    if (s.dumpster.charges > 0 && empty > this.o.roomToClick) return clickDumpster(s);
    return false;
  }
}
