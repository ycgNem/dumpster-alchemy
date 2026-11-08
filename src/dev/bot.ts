// A simple greedy player for balance runs (`npm run sim`) and the in-game autoplay (dev only).
// It acts at a human-ish rate: one drag or click every `thinkSec`. Once the quota is met it
// weighs the overtime bet: it clocks out when the Stink is high, or rising fast enough to max out
// before 6 AM. It cracks Bin Juice over its best lone junk, saves the jackpot's ingredients from
// the other raccoons, and minds the smell: smelly pairs merge first, smelly pieces go to orders
// and the Crusher first.
import { ITEMS, JUNK_CHAIN, type ItemId } from '../data/items';
import { act } from '../game/actions';
import { mergeResult } from '../game/board';
import { clickDumpster } from '../game/dumpster';
import { eggResult } from '../game/gulls';
import { canClockOut, clockOut } from '../game/shift';
import { inFlight, nightLength, type GameState } from '../game/state';
import { isSmelly, smellRate, stinkLimit } from '../game/stink';

export interface BotOpts {
  /** Seconds between actions (a person playing well manages about one drag a second). */
  thinkSec: number;
  /** Only click the Dumpster while more than this many cells are empty. */
  roomToClick: number;
  /** Use the Crusher when this few cells (or fewer) are empty. */
  compactAt: number;
  /** Crush a Seagull with no partner to merge with when this few cells (or fewer) are empty. */
  crushGullAt: number;
  /** Once the quota is met, clock out when the Stink reaches this share of the limit (0: at once; over 1: never)... */
  clockOutAt: number;
  /** ...or when the Stink, rising at today's rate for `lookSec` (or till 6 AM), would pass this share. */
  clockOutAhead: number;
  lookSec: number;
  /** Merge score added for a pair that has gone smelly (a tier is 1). */
  smellWeight: number;
  /** With the Stink past this share of the limit and rising, crush the least useful smelly piece whenever the Crusher is ready. */
  crushSmellyAt: number;
  /** While a jackpot waits, don't hand junk this many tiers below what it wants (or higher) to others. */
  saveForJackpot: number;
}

export const BOT_DEFAULT: BotOpts = {
  thinkSec: 1.0,
  roomToClick: 8,
  compactAt: 4,
  crushGullAt: 12,
  clockOutAt: 0.75,
  clockOutAhead: 0.95,
  lookSec: 25,
  smellWeight: 2,
  crushSmellyAt: 0.4,
  saveForJackpot: 2,
};

interface Spot {
  id: ItemId;
  c: number;
  r: number;
  born: number;
  smelly: boolean;
}

export class Bot {
  readonly o: BotOpts;
  private wait = 0;

  constructor(o: BotOpts = BOT_DEFAULT) {
    this.o = o;
  }

  update(s: GameState, dt: number): void {
    if (s.status !== 'playing' || s.drag) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    // A real action costs a full think; looking and finding nothing to do costs a glance.
    this.wait = this.think(s) ? this.o.thinkSec : 0.15;
  }

  private think(s: GameState): boolean {
    // 0. Quota in the bag: is the overtime worth the risk? A Stink-out now loses all of it.
    if (canClockOut(s) && this.shouldClockOut(s)) {
      clockOut(s);
      return true;
    }
    // Oldest first, so "the first one" of a kind is the smelliest.
    const spots: Spot[] = s.board
      .pieces()
      .filter(({ p }) => !inFlight(s, p.uid))
      .sort((a, b) => a.p.born - b.p.born)
      .map(({ p, c, r }) => ({ id: p.id, c, r, born: p.born, smelly: isSmelly(s, p) }));
    const empty = s.board.empties().length;

    // 1. Deliver anything an order wants, the most impatient raccoon first. While a jackpot
    //    waits, junk close to what it wants is kept for it (unless that raccoon is about to blow).
    const waiting = s.orders
      .map((o, slot) => ({ o, slot }))
      .filter((x) => x.o?.mood === 'waiting')
      .sort((a, b) => (a.o?.patience ?? 0) - (b.o?.patience ?? 0));
    const jackpot = waiting.find((x) => x.o?.jackpot)?.o;
    const jackpotTier = jackpot ? Math.max(...jackpot.wants.map((id) => ITEMS[id].tier)) : 99;
    const wanted = new Set<ItemId>();
    for (const { o, slot } of waiting) {
      if (!o) continue;
      for (let k = 0; k < o.wants.length; k++) {
        const id = o.wants[k];
        if (id === undefined || o.got[k]) continue;
        wanted.add(id);
        const d = ITEMS[id];
        const save = !o.jackpot && d.chain === 'junk' && d.tier >= jackpotTier - this.o.saveForJackpot && o.patience > 8;
        if (save) continue;
        const spot = spots.find((p) => p.id === id);
        if (spot) return act(s, spot.c, spot.r, { kind: 'order', slot }) === 'deliver';
      }
    }

    // 2. A Golden Egg: crack it over the best junk (one an order wants two tiers up, if any).
    const egg = spots.find((p) => p.id === 'golden_egg');
    if (egg) {
      const eggScore = (p: Spot): number => ITEMS[p.id].tier + (wanted.has(eggResult(p.id) ?? p.id) ? 100 : 0);
      const target = spots.filter((p) => eggResult(p.id)).sort((a, b) => eggScore(b) - eggScore(a))[0];
      if (target) return act(s, egg.c, egg.r, { kind: 'cell', c: target.c, r: target.r }) === 'egg';
    }

    const counts = new Map<ItemId, number>();
    for (const p of spots) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);

    // 2b. Bin Juice: on junk whose next tier an order wants, else one whose next tier has a
    //     partner on the lot, else the biggest lone junk.
    const juice = spots.find((p) => p.id === 'bin_juice');
    if (juice) {
      const lone = spots
        .filter((p) => ITEMS[p.id].chain === 'junk' && ITEMS[p.id].tier < JUNK_CHAIN.length && counts.get(p.id) === 1)
        .sort((a, b) => ITEMS[b.id].tier - ITEMS[a.id].tier);
      const next = (p: Spot): ItemId | null => ITEMS[p.id].next;
      const target =
        lone.find((p) => { const n = next(p); return n !== null && wanted.has(n); }) ??
        lone.find((p) => { const n = next(p); return n !== null && (counts.get(n) ?? 0) > 0; }) ??
        lone[0];
      if (target) return act(s, juice.c, juice.r, { kind: 'cell', c: target.c, r: target.r }) === 'merge';
    }

    if (s.compactor.cooldown <= 0) {
      // 3. Getting crowded: a Seagull with nobody to merge with goes in the Crusher.
      const lone = spots.find((p) => p.id === 'gull' && counts.get('gull') === 1 && !wanted.has('gull'));
      if (lone && empty <= this.o.crushGullAt) return act(s, lone.c, lone.r, { kind: 'compactor' }) === 'compact';
    }

    // 3b. The Stink is climbing: the least useful smelly piece goes in the Crusher.
    if (s.compactor.cooldown <= 0 && s.stink >= stinkLimit(s) * this.o.crushSmellyAt && smellRate(s) > 0) {
      const victim = spots.filter((p) => p.smelly).sort((a, b) => junkScore(a, counts, wanted) - junkScore(b, counts, wanted))[0];
      if (victim && junkScore(victim, counts, wanted) < 20) return act(s, victim.c, victim.r, { kind: 'compactor' }) === 'compact';
    }

    // 4. Nearly full: crush the least useful piece.
    if (empty <= this.o.compactAt && s.compactor.cooldown <= 0 && spots.length > 0) {
      const victim = [...spots].sort((a, b) => junkScore(a, counts, wanted) - junkScore(b, counts, wanted))[0];
      if (victim) return act(s, victim.c, victim.r, { kind: 'compactor' }) === 'compact';
    }

    // 5. Merge: a pair whose result an order wants, else the highest pair (gulls a bit ahead of
    // junk of the same tier: fewer pests, and four Bosses' worth makes an egg).
    const byId = new Map<ItemId, Spot[]>();
    for (const p of spots) {
      if (!ITEMS[p.id].next) continue;
      const list = byId.get(p.id) ?? [];
      list.push(p);
      byId.set(p.id, list);
    }
    let best: [Spot, Spot] | null = null;
    let bestScore = -1;
    for (const list of byId.values()) {
      const [a, b] = list;
      if (!a || !b) continue;
      const to = mergeResult(a.id, b.id);
      if (!to) continue;
      // While a jackpot waits, building toward it beats everything but a merge an order wants now.
      const d = ITEMS[a.id];
      const forJackpot = d.chain === 'junk' && d.tier >= jackpotTier - 1 - this.o.saveForJackpot && d.tier < jackpotTier;
      const smell = a.smelly || b.smelly ? this.o.smellWeight : 0;
      const score = d.tier + (d.chain === 'gull' ? 0.5 : 0) + smell + (wanted.has(to) ? 100 : 0) + (forJackpot ? 150 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = [a, b];
      }
    }
    if (best) return act(s, best[0].c, best[0].r, { kind: 'cell', c: best[1].c, r: best[1].r }) === 'merge';

    // 6. Room to spare: more junk.
    if (s.dumpster.charges > 0 && empty > this.o.roomToClick) return clickDumpster(s);
    return false;
  }

  /** The overtime bet: leave when the Stink is high, or heading for the limit before 6 AM. */
  private shouldClockOut(s: GameState): boolean {
    const limit = stinkLimit(s);
    const left = Math.max(0, nightLength() - s.time);
    const ahead = s.stink + Math.max(0, smellRate(s)) * Math.min(left, this.o.lookSec);
    return s.stink >= limit * this.o.clockOutAt || ahead >= limit * this.o.clockOutAhead;
  }
}

/** Lower is more crushable: gulls, then smelly, low tier, no partner, not wanted; never an egg or juice. */
function junkScore(p: Spot, counts: Map<ItemId, number>, wanted: Set<ItemId>): number {
  const d = ITEMS[p.id];
  const base = d.chain === 'gull' ? d.tier - 3 : d.chain === 'special' ? 200 : d.tier;
  return base + (p.smelly ? -2 : 0) + ((counts.get(p.id) ?? 0) > 1 ? 20 : 0) + (wanted.has(p.id) ? 100 : 0);
}
