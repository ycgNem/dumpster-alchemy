// Dumpster Alchemy proper (docs/V2.md "Alchemy"): drop one thing on a DIFFERENT thing and, if
// they're a recipe (src/data/recipes.ts), they brew. Both pieces go and the result lands where the
// held one was dropped. A pair that isn't a recipe just swaps, as before.
//
// Results are tools or treasures:
// - **Tools** are used once, by dropping them on their target. Dropped on empty dirt they move
//   like any piece; on something they don't work on, they snap back. `toolPlan` says exactly what
//   a drop would do (the renderer outlines it while you hover), and `useTool` does it.
// - **Treasures** go to any raccoon: one takes the whole order and pays its value at that order's
//   rate (orders.ts `wants`/`deliver` call `isTreasure` and `treasurePay`).
//
// Brews never merge, never ripen and gulls don't eat them (they're neither junk nor gulls). Every
// recipe ever brewed is kept in `s.discoveredRecipes` (the run saves it as `Run.recipes`): the
// Recipe Book and the hover's "?" vs result icon read it.
//
// Everything here is deterministic (`s.rng` only), headless and shared with the bot.
import { ITEMS, type ItemId } from '../data/items';
import { ALCHEMY, isTool as toolId, isTreasure, recipeFor, recipeOf, RECIPES, type RecipeDef, type ToolAim } from '../data/recipes';
import { TUNING } from '../data/tuning';
import { crushPay, mergeInto, type DropKind, type Target } from './actions';
import { makePiece, type Piece } from './board';
import type { GullMove } from './events';
import { afterMerge } from './gulls';
import { earn } from './shift';
import { inFlight, noteItem, type GameState, type Order } from './state';
import { addStink, isSmelly } from './stink';
import { trucks } from './truck';

export { isTreasure };

// ------------------------------------------------------------------------------ brewing

/** What dropping `a` on `b` brews, or null (the same thing twice never brews). */
export function brewResult(a: ItemId, b: ItemId): ItemId | null {
  return recipeFor(a, b)?.id ?? null;
}

/** True if dropping `a` on `b` would brew something (either order). */
export function brewKind(_s: GameState, a: ItemId, b: ItemId): boolean {
  return recipeFor(a, b) !== null;
}

/** Has this recipe (by its result id) ever been brewed? */
export function knownRecipe(s: GameState, result: ItemId): boolean {
  return s.discoveredRecipes.has(result);
}

/** Brew the held piece at (c, r) into the piece at (tc, tr). */
export function brew(s: GameState, c: number, r: number, tc: number, tr: number): void {
  const p = s.board.get(c, r);
  const q = s.board.get(tc, tr);
  const rec = p && q ? recipeFor(p.id, q.id) : null;
  if (!p || !q || !rec) return;
  s.board.set(c, r, null);
  s.board.set(tc, tr, makePiece(rec.id, s.time));
  const first = !s.discoveredRecipes.has(rec.id);
  s.discoveredRecipes.add(rec.id);
  noteItem(s, rec.id);
  s.stats.brews++;
  if (first) s.stats.newRecipes++;
  // The Alchemist's Apron: a second one, in the nearest empty cell (if there is one).
  let twin: { c: number; r: number } | undefined;
  if (s.mods.brewTwins) {
    const spot = nearestEmpty(s, tc, tr);
    if (spot) {
      s.board.set(spot[0], spot[1], makePiece(rec.id, s.time));
      twin = { c: spot[0], r: spot[1] };
    }
  }
  // (combo.ts reads this event to feed the Stench Streak.)
  s.events.push({ type: 'brew', a: p.id, b: q.id, to: rec.id, kind: rec.kind, c: tc, r: tr, fc: c, fr: r, first, twin });
}

/** The empty cell nearest (c, r) (by rings, then reading order), or null on a full lot. */
export function nearestEmpty(s: GameState, c: number, r: number): [number, number] | null {
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (const [ec, er] of s.board.empties()) {
    const d = Math.max(Math.abs(ec - c), Math.abs(er - r)) * 100 + Math.abs(ec - c) + Math.abs(er - r);
    if (d < bestD) {
      bestD = d;
      best = [ec, er];
    }
  }
  return best;
}

// ------------------------------------------------------------------------------ treasures

/**
 * What a treasure pays to this order before the patience bonus: its value at the order's rate
 * (the raccoon, big spender, jackpot, tonight's rule), but never the scrap order's x2.
 */
export function treasurePay(o: Order, id: ItemId): number {
  const scrap = o.scrap && ALCHEMY.treasureIgnoresScrapMul ? TUNING.orders.scrap.payMul : 1;
  return Math.round((ITEMS[id].value * o.payMul) / scrap);
}

/** What handing this treasure to the order in `slot` would pay right now, bonus included (for the hover). */
export function treasureValue(s: GameState, slot: number, id: ItemId): number {
  const o = s.orders[slot];
  if (!o || o.mood !== 'waiting' || !isTreasure(id) || s.goal === 'king') return 0;
  const base = treasurePay(o, id);
  return Math.round(base * (1 + TUNING.orders.patienceBonus * Math.max(0, o.patience / o.patienceMax)));
}

// ------------------------------------------------------------------------------ tools

/** True for brewed tools (they don't merge or swap: they're used on a target). */
export function isTool(id: ItemId): boolean {
  return toolId(id);
}

/** What a tool drop would do, worked out in full (the hover draws it, `useTool` does it). */
export interface ToolPlan {
  tool: ItemId;
  aim: ToolAim;
  /** Where it was aimed: the cell (or the order's slot for the Stew). */
  c: number;
  r: number;
  slot?: number;
  /** The cells it reaches (the 3x3, the row, the whole lot), for the outline. */
  zone: [number, number][];
  /** The cells whose piece it changes, eats, burns or pulls. */
  hits: [number, number][];
  /** Shinies it pays out (Bomb, Fire, Fork). */
  pay: number;
  /** One short line for the hover: "BOOM! 6 junk +340". */
  label: string;
}

/** On the board, landed and not in a hand: something a tool may touch. */
function loose(s: GameState, p: Piece): boolean {
  return !inFlight(s, p.uid) && s.drag?.uid !== p.uid;
}

/** Every loose piece except the one at (c, r) (the tool itself), filtered. */
function others(s: GameState, c: number, r: number, keep: (p: Piece) => boolean): { p: Piece; c: number; r: number }[] {
  return s.board.pieces().filter((x) => !(x.c === c && x.r === r) && loose(s, x.p) && keep(x.p));
}

function isJunk(id: ItemId): boolean {
  return ITEMS[id].chain === 'junk';
}

/** What one junk piece pays when a Bomb or a Fire takes it. */
export function blastPay(s: GameState, id: ItemId, how: { crushMul: number; valueMul: number }): number {
  return Math.max(Math.round(crushPay(s, id) * how.crushMul), Math.round(ITEMS[id].value * how.valueMul));
}

function allCells(s: GameState): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r < s.board.rows; r++) for (let c = 0; c < s.board.cols; c++) out.push([c, r]);
  return out;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * What dropping the tool held at (c, r) on `t` would do, or null if it does nothing there (then
 * the drop is 'bad'). Moving to empty dirt and the Crusher aren't plans: see toolDropKind.
 */
export function toolPlan(s: GameState, c: number, r: number, t: Target): ToolPlan | null {
  const tool = s.board.get(c, r);
  const rec = tool ? recipeOf(tool.id) : null;
  if (!tool || !rec || rec.kind !== 'tool' || !rec.aim) return null;
  const aim = rec.aim;
  if (aim === 'order') {
    if (t.kind !== 'order') return null;
    const o = s.orders[t.slot];
    if (!o || o.mood !== 'waiting' || o.stewed) return null;
    return { tool: tool.id, aim, c, r, slot: t.slot, zone: [], hits: [], pay: 0, label: `STEW! Patience refills, pays x${ALCHEMY.stewPayMul}` };
  }
  if (t.kind !== 'cell' || (t.c === c && t.r === r)) return null;
  const q = s.board.get(t.c, t.r);
  if (!q || !loose(s, q)) return null;
  const base = { tool: tool.id, aim, c: t.c, r: t.r, pay: 0 };
  switch (tool.id) {
    case 'bagbomb':
    case 'elecsoup': {
      const zone: [number, number][] = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (s.board.inside(t.c + dc, t.r + dr)) zone.push([t.c + dc, t.r + dr]);
      const soup = tool.id === 'elecsoup';
      // (Soup never makes the King: he has to be merged, crowning and all.)
      const rises = (id: ItemId): boolean => ITEMS[id].next !== null && ITEMS[id].next !== 'king';
      const hit = others(s, c, r, (p) => isJunk(p.id) && (!soup || rises(p.id))).filter((x) => Math.abs(x.c - t.c) <= 1 && Math.abs(x.r - t.r) <= 1);
      if (hit.length === 0) return null;
      const hits = hit.map((x): [number, number] => [x.c, x.r]);
      if (soup) return { ...base, zone, hits, label: `ZAP! ${plural(hits.length, 'piece')} +1 tier` };
      const pay = hit.reduce((a, x) => a + blastPay(s, x.p.id, ALCHEMY.bomb), 0);
      return { ...base, zone, hits, pay, label: `BOOM! ${plural(hits.length, 'piece')} +${pay}` };
    }
    case 'tirefire': {
      const zone: [number, number][] = [];
      for (let cc = 0; cc < s.board.cols; cc++) zone.push([cc, t.r]);
      const hit = others(s, c, r, (p) => isJunk(p.id)).filter((x) => x.r === t.r);
      if (hit.length === 0) return null;
      const pay = hit.reduce((a, x) => a + blastPay(s, x.p.id, ALCHEMY.fire), 0);
      return { ...base, zone, hits: hit.map((x) => [x.c, x.r]), pay, label: `FIRE! ${plural(hit.length, 'piece')} +${pay}, +${ALCHEMY.fire.stink} Stink` };
    }
    case 'bootcoffee':
      return { ...base, zone: allCells(s), hits: [], label: `Truck stalls ${ALCHEMY.coffeeStallSec}s, patience refills` };
    case 'forkgull': {
      const hit = others(s, c, r, (p) => ALCHEMY.forkEats.includes(p.id));
      if (hit.length === 0) return null;
      const pay = hit.reduce((a, x) => a + ITEMS[x.p.id].value * ALCHEMY.forkValueMul, 0);
      return { ...base, zone: allCells(s), hits: hit.map((x) => [x.c, x.r]), pay, label: `CHOMP! ${plural(hit.length, 'cap')} & cans +${pay}` };
    }
    case 'chum': {
      const hit = others(s, c, r, (p) => ITEMS[p.id].chain === 'gull' && ITEMS[p.id].next !== null);
      if (hit.length === 0) return null;
      return { ...base, zone: allCells(s), hits: hit.map((x) => [x.c, x.r]), label: `CHUM! ${plural(hit.length, 'gull')} +1 tier` };
    }
    case 'blanket': {
      const hit = others(s, c, r, (p) => isSmelly(s, p));
      if (hit.length === 0 && s.stink < 1) return null;
      return { ...base, zone: allCells(s), hits: hit.map((x) => [x.c, x.r]), label: `${hit.length} fresh, Stink -${ALCHEMY.blanketStinkDrop}` };
    }
    case 'magnet': {
      if (ITEMS[q.id].next === null || (ITEMS[q.id].chain !== 'junk' && ITEMS[q.id].chain !== 'gull')) return null;
      const same = others(s, c, r, (p) => p.id === q.id && p.uid !== q.uid);
      if (same.length === 0) return null;
      const n = same.length + 1;
      return { ...base, zone: [[t.c, t.r]], hits: [[t.c, t.r], ...same.map((x): [number, number] => [x.c, x.r])], label: `MAGNET! ${n} ${ITEMS[q.id].short}${n === 1 ? '' : 's'}` };
    }
    case 'leftovers': {
      const d = ITEMS[q.id];
      if (d.chain === 'special' || isTool(q.id) || q.id === 'gullgod') return null;
      return { ...base, zone: [[t.c, t.r]], hits: [[t.c, t.r]], label: `COPY: ${d.name}` };
    }
  }
  return null;
}

/** What dropping the tool held at (c, r) on `t` would do: 'tool', 'move', 'home', 'compact' or 'bad'. */
export function toolDropKind(s: GameState, c: number, r: number, t: Target): DropKind {
  if (!s.board.get(c, r)) return 'bad';
  switch (t.kind) {
    case 'none':
      return 'bad';
    case 'compactor':
      // Binned: a tool you don't want is just scrap (it pays nothing).
      return s.compactor.cooldown > 0 ? 'bad' : 'compact';
    case 'order':
      return toolPlan(s, c, r, t) ? 'tool' : 'bad';
    case 'cell': {
      if (t.c === c && t.r === r) return 'home';
      if (!s.board.inside(t.c, t.r)) return 'bad';
      const q = s.board.get(t.c, t.r);
      if (!q) return 'move';
      return toolPlan(s, c, r, t) ? 'tool' : 'bad';
    }
  }
}

/** Use the tool held at (c, r) on `t`. */
export function useTool(s: GameState, c: number, r: number, t: Target): void {
  const plan = toolPlan(s, c, r, t);
  const tool = s.board.get(c, r);
  if (!plan || !tool) {
    s.events.push({ type: 'invalid', c, r });
    return;
  }
  // Used up (its cell is free from here on: Leftovers may land in it).
  s.board.set(c, r, null);
  s.stats.toolsUsed++;
  const cells = plan.hits.map(([hc, hr]) => ({ c: hc, r: hr, id: s.board.get(hc, hr)?.id ?? tool.id }));
  const made: { c: number; r: number; from: ItemId; to: ItemId; first: boolean }[] = [];
  let moves: GullMove[] | undefined;
  let shinies = 0;
  let stink = 0;
  switch (tool.id) {
    case 'stew': {
      const o = plan.slot !== undefined ? s.orders[plan.slot] : null;
      if (o) {
        o.patience = o.patienceMax;
        o.payMul *= ALCHEMY.stewPayMul;
        o.stewed = true;
      }
      break;
    }
    case 'bagbomb':
    case 'tirefire': {
      const how = tool.id === 'bagbomb' ? ALCHEMY.bomb : ALCHEMY.fire;
      for (const [hc, hr] of plan.hits) {
        const p = s.board.get(hc, hr);
        if (!p) continue;
        shinies += blastPay(s, p.id, how);
        s.board.set(hc, hr, null);
      }
      if (tool.id === 'tirefire') {
        stink = ALCHEMY.fire.stink;
        addStink(s, stink);
      }
      break;
    }
    case 'forkgull':
      for (const [hc, hr] of plan.hits) {
        const p = s.board.get(hc, hr);
        if (!p) continue;
        shinies += ITEMS[p.id].value * ALCHEMY.forkValueMul;
        s.board.set(hc, hr, null);
      }
      break;
    case 'elecsoup':
    case 'chum':
      for (const [hc, hr] of plan.hits) {
        const p = s.board.get(hc, hr);
        const to = p ? ITEMS[p.id].next : null;
        if (!p || !to) continue;
        s.board.set(hc, hr, makePiece(to, s.time));
        made.push({ c: hc, r: hr, from: p.id, to, first: noteItem(s, to) });
        // A Boss fed up to a God leaves at once, dropping a Golden Egg (gulls.ts).
        if (to === 'gullgod') afterMerge(s, to, hc, hr);
      }
      break;
    case 'blanket':
      for (const [hc, hr] of plan.hits) {
        const p = s.board.get(hc, hr);
        if (p) p.born = s.time;
      }
      stink = -Math.min(s.stink, ALCHEMY.blanketStinkDrop);
      s.stink = Math.max(0, s.stink - ALCHEMY.blanketStinkDrop);
      break;
    case 'bootcoffee':
      for (const k of trucks(s)) {
        k.timer += ALCHEMY.coffeeStallSec;
        // Already backing in: it stalls off-screen and comes back later.
        if (k.phase === 'arrive') {
          k.phase = 'away';
          k.t = 0;
        }
      }
      for (const o of s.orders) if (o && o.mood === 'waiting') o.patience = o.patienceMax;
      break;
    case 'magnet':
      moves = magnetize(s, plan, made);
      break;
    case 'leftovers': {
      const q = s.board.get(plan.c, plan.r);
      const spot = nearestEmpty(s, plan.c, plan.r);
      if (q && spot) {
        s.board.set(spot[0], spot[1], makePiece(q.id, s.time));
        made.push({ c: spot[0], r: spot[1], from: q.id, to: q.id, first: noteItem(s, q.id) });
      }
      break;
    }
  }
  s.events.push({
    type: 'toolUsed',
    id: tool.id,
    c: plan.c,
    r: plan.r,
    slot: plan.slot,
    cells,
    made: made.length > 0 ? made : undefined,
    moves,
    shinies: shinies > 0 ? shinies : undefined,
    stink: stink !== 0 ? stink : undefined,
  });
  if (shinies > 0) earn(s, shinies);
}

/**
 * The Junk Magnet: every piece like the target flies to it and they merge as far as they go.
 * Each step takes the lowest tier with two of a kind and flies the farther of the two nearest the
 * target into the nearer, so the biggest result ends up on the target and an odd one out stays
 * where it was. Every step is a real merge (actions.ts
 * `mergeInto`: stats, the Almanac, Full Moon, gulls, the streak).
 */
function magnetize(s: GameState, plan: ToolPlan, made: { c: number; r: number; from: ItemId; to: ItemId; first: boolean }[]): GullMove[] {
  const moves: GullMove[] = [];
  const dist = ([c, r]: [number, number]): number => Math.abs(c - plan.c) + Math.abs(r - plan.r) + (c === plan.c && r === plan.r ? -1 : 0);
  let cells = [...plan.hits];
  for (let guard = 0; guard < 64; guard++) {
    // The lowest tier with two of a kind among what's been pulled in.
    const groups = new Map<ItemId, [number, number][]>();
    for (const cell of cells) {
      const p = s.board.get(cell[0], cell[1]);
      if (!p || !ITEMS[p.id].next) continue;
      const list = groups.get(p.id) ?? [];
      list.push(cell);
      groups.set(p.id, list);
    }
    const pairs = [...groups.entries()].filter(([, l]) => l.length >= 2).sort((a, b) => ITEMS[a[0]].tier - ITEMS[b[0]].tier);
    const pick = pairs[0];
    if (!pick) break;
    const [dst, src] = [...pick[1]].sort((a, b) => dist(a) - dist(b));
    if (!dst || !src) break;
    const from = pick[0];
    const to = mergeInto(s, src[0], src[1], dst[0], dst[1]);
    if (!to) break;
    moves.push({ c: src[0], r: src[1], toC: dst[0], toR: dst[1] });
    made.push({ c: dst[0], r: dst[1], from, to, first: false });
    cells = cells.filter((x) => !(x[0] === src[0] && x[1] === src[1]));
  }
  return moves;
}

// ------------------------------------------------------------------------------ riddles

/** Recipes not brewed yet whose two ingredients have both been seen (riddle and nudge material). */
export function hintableRecipes(s: GameState): RecipeDef[] {
  return RECIPES.filter((r) => !s.discoveredRecipes.has(r.id) && s.discovered.has(r.a) && s.discovered.has(r.b));
}

/**
 * The riddle drip (orders.ts calls it as a raccoon walks up): now and then they share the riddle
 * of a recipe you haven't brewed but whose ingredients you've seen. One riddle on the counter at
 * a time; never the jackpot raccoon, never on night 1.
 */
export function dripRiddle(s: GameState, slot: number): void {
  const o = s.orders[slot];
  // (Not on night 1: the footer's controls matter more, and there's enough to learn.)
  if (!o || o.jackpot || s.night < 2 || s.orders.some((x) => x !== o && x?.riddle && x.mood === 'waiting')) return;
  const pool = hintableRecipes(s);
  if (pool.length === 0 || !s.rng.chance(ALCHEMY.riddleChance)) return;
  o.riddle = s.rng.pick(pool).id;
}
