// Seagulls, the side chain (docs/DESIGN.md, "Seagulls"). A junk merge sometimes attracts one.
// G1 and G2 hop about and eat small junk, the Gang screams and shuffles its 8 neighbours, the Boss
// pecks Shinies out of the purse, and the Gull God flies off the moment it's made, leaving a
// Golden Egg that raises any junk two tiers. Gulls merge, get crushed and get ordered like junk.
import { ITEMS, JUNK_CHAIN, junkAt, type ItemId } from '../data/items';
import { TUNING } from '../data/tuning';
import { makePiece, type Piece } from './board';
import type { GullMove } from './events';
import { inFlight, noteItem, type GameState } from './state';

const G = TUNING.gulls;

/** The 8 cells around one. Hops pick one of these; the Gang shuffles all of them. */
const AROUND: readonly [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/** What raccoons say when they want a gull (Gary only ever wants a Fat Gull; don't ask). */
const GULL_LINES: Record<string, readonly string[]> = {
  gary: ['Fat Gull. Don\'t ask.', 'I need a FAT one. Don\'t ask.', 'Gull. Big. No questions.'],
  linda: ['A gull, dear. For a hat.', 'One seagull. Plump.'],
  pete: ['Can I have a BIRD?', 'I want a birdie!'],
  mange: ['A gull for the soup, sweetie.', 'Bring Grandma a bird.'],
};

/** A piece something else may push around or eat: on the board, landed, not in the player's hand. */
function loose(s: GameState, p: Piece): boolean {
  return !inFlight(s, p.uid) && s.drag?.uid !== p.uid;
}

/** After every merge (actions.ts): a junk merge may attract a gull; a new Gull God leaves at once. */
export function afterMerge(s: GameState, to: ItemId, c: number, r: number): void {
  if (to === 'gullgod') {
    godLeaves(s, c, r);
    return;
  }
  if (ITEMS[to].chain === 'junk' && s.rng.chance(G.chancePerMerge * s.mods.gullChanceMul)) gullArrives(s);
}

/** A Seagull swoops onto a random empty cell, or onto some junk (and eats it) if none is free. */
export function gullArrives(s: GameState): boolean {
  if (s.status !== 'playing') return false;
  const empties = s.board.empties();
  let c: number;
  let r: number;
  let eaten: ItemId | null = null;
  if (empties.length > 0) {
    [c, r] = s.rng.pick(empties);
  } else {
    const prey = s.board.pieces().filter(({ p }) => ITEMS[p.id].chain === 'junk' && ITEMS[p.id].tier <= s.mods.gullEatMax && loose(s, p));
    if (prey.length === 0) return false;
    const spot = s.rng.pick(prey);
    c = spot.c;
    r = spot.r;
    eaten = spot.p.id;
  }
  const gull = makePiece('gull', s.time);
  s.board.set(c, r, gull);
  s.flights.push({ uid: gull.uid, c, r, from: 'gull', t: 0, dur: G.arriveSec, slot: 0 });
  s.stats.gulls++;
  s.events.push({ type: 'gullArrive', c, r, first: noteItem(s, 'gull') });
  if (eaten) {
    s.stats.gullEats++;
    s.events.push({ type: 'gullEat', id: eaten, c, r });
  }
  return true;
}

/** The Gull God screeches off into the sky; a Golden Egg comes down into its cell. */
function godLeaves(s: GameState, c: number, r: number): void {
  s.events.push({ type: 'gullGod', c, r });
  const egg = makePiece('golden_egg', s.time);
  s.board.set(c, r, egg);
  s.flights.push({ uid: egg.uid, c, r, from: 'egg', t: 0, dur: G.eggDropSec, slot: 0 });
  s.stats.eggs++;
  s.events.push({ type: 'spawn', id: 'golden_egg', c, r, from: 'egg', first: noteItem(s, 'golden_egg') });
}

/** What a Golden Egg turns this piece into, or null (only junk below the King rises). */
export function eggResult(id: ItemId): ItemId | null {
  const d = ITEMS[id];
  if (d.chain !== 'junk' || d.tier >= JUNK_CHAIN.length) return null;
  return junkAt(d.tier + G.goldenEggTiers);
}

/** Crack the egg at (c, r) over the junk at (tc, tr). Returns false if that can't happen. */
export function useEgg(s: GameState, c: number, r: number, tc: number, tr: number): boolean {
  const egg = s.board.get(c, r);
  const q = s.board.get(tc, tr);
  if (!egg || egg.id !== 'golden_egg' || !q) return false;
  const to = eggResult(q.id);
  if (!to) return false;
  s.board.set(c, r, null);
  s.board.set(tc, tr, makePiece(to, s.time));
  s.events.push({ type: 'egg', c: tc, r: tr, from: q.id, to, first: noteItem(s, to) });
  return true;
}

/** Once gulls have shown up tonight, a new order sometimes wants one. Null: a normal order. */
export function gullOrder(s: GameState, raccoon: string): { want: ItemId; line: string } | null {
  if (s.stats.gulls === 0) return null;
  const gary = raccoon === 'gary';
  if (!s.rng.chance((gary ? G.orderChanceGary : G.orderChance) * s.mods.gullOrderMul)) return null;
  const want: ItemId = gary || s.rng.chance(G.orderFatChance) ? 'fatgull' : 'gull';
  return { want, line: s.rng.pick(GULL_LINES[raccoon] ?? ['A gull. Any gull.']) };
}

/** How long this gull waits before its next hop, scream or peck. */
function wait(s: GameState, id: ItemId): number {
  const base = id === 'gull' ? G.hopSecG1 : id === 'fatgull' ? G.hopSecG2 : id === 'gullgang' ? G.gangScreamSec : G.bossPeckSec;
  return base * (1 + s.rng.range(-G.jitter, G.jitter));
}

export function updateGulls(s: GameState, dt: number): void {
  const alive = new Set<number>();
  for (const { p, c, r } of s.board.pieces()) {
    // A Gang shuffle earlier in this step may have moved it: it acts next step.
    if (ITEMS[p.id].chain !== 'gull' || s.board.get(c, r) !== p) continue;
    alive.add(p.uid);
    if (!loose(s, p)) continue;
    if (p.id === 'gullgod') {
      // Only the dev tools put one down without a merge; it leaves all the same.
      godLeaves(s, c, r);
      continue;
    }
    let t = s.gullTimers.get(p.uid) ?? wait(s, p.id);
    t -= dt;
    if (t <= 0) {
      t = wait(s, p.id);
      if (p.id === 'gull') hop(s, c, r, Math.min(G.eatsUpToG1, s.mods.gullEatMax));
      else if (p.id === 'fatgull') hop(s, c, r, Math.min(G.eatsUpToG2, s.mods.gullEatMax));
      else if (p.id === 'gullgang') scream(s, c, r);
      else if (p.id === 'gullboss') peck(s, c, r);
    }
    s.gullTimers.set(p.uid, t);
  }
  for (const uid of s.gullTimers.keys()) if (!alive.has(uid)) s.gullTimers.delete(uid);
}

/** Hop to a random neighbour: an empty cell, or small junk (eaten). Anything else: stay put. */
function hop(s: GameState, c: number, r: number, eatsUpTo: number): void {
  const gull = s.board.get(c, r);
  const [dc, dr] = s.rng.pick(AROUND);
  const tc = c + dc;
  const tr = r + dr;
  if (!gull || !s.board.inside(tc, tr)) return;
  const q = s.board.get(tc, tr);
  if (q) {
    const d = ITEMS[q.id];
    if (d.chain !== 'junk' || d.tier > eatsUpTo || !loose(s, q)) return;
    s.stats.gullEats++;
    s.events.push({ type: 'gullEat', id: q.id, c: tc, r: tr });
  }
  s.board.set(c, r, null);
  s.board.set(tc, tr, gull);
  s.events.push({ type: 'gullHop', c, r, toC: tc, toR: tr });
}

/** The Gang screams and everything around it (that isn't flying or held) gets shuffled. */
function scream(s: GameState, c: number, r: number): void {
  const cells: [number, number][] = [];
  for (const [dc, dr] of AROUND) {
    const nc = c + dc;
    const nr = r + dr;
    if (!s.board.inside(nc, nr)) continue;
    const q = s.board.get(nc, nr);
    if (q && !loose(s, q)) continue;
    cells.push([nc, nr]);
  }
  const before = cells.map(([x, y]) => s.board.get(x, y));
  const after = [...before];
  for (let i = after.length - 1; i > 0; i--) {
    const j = s.rng.int(i + 1);
    const a = after[i] ?? null;
    after[i] = after[j] ?? null;
    after[j] = a;
  }
  const moves: GullMove[] = [];
  cells.forEach(([x, y], i) => {
    const p = after[i] ?? null;
    s.board.set(x, y, p);
    if (!p) return;
    const from = before.indexOf(p);
    const fc = cells[from];
    if (from !== i && fc) moves.push({ c: fc[0], r: fc[1], toC: x, toR: y });
  });
  s.events.push({ type: 'gullScream', c, r, moves });
}

/** The Boss helps itself to the purse (never below 0). */
function peck(s: GameState, c: number, r: number): void {
  const n = Math.min(s.purse, G.bossPeckShinies);
  if (n <= 0) return;
  s.purse -= n;
  // Past the quota it comes out of the overtime first.
  s.overtimeEarned = Math.max(0, s.overtimeEarned - n);
  s.stats.pecked += n;
  s.events.push({ type: 'gullPeck', shinies: n, c, r });
}
