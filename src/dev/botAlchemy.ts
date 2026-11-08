// The bot's alchemy (src/dev/bot.ts calls `alchemyMove` once a turn, after handing in what's
// wanted), so `npm run sim` sees what recipes do to the economy. Simple and greedy, like the bot:
//
// 1. A treasure goes to the raccoon it pays best against (what that order would pay anyway), at
//    once if the lot is tight or someone is about to storm off.
// 2. Tools go where they do the most: the Blanket at high Stink, Electric Soup on a crowded 3x3,
//    the Bag Bomb on a carpet of smelly small junk, the Magnet on the biggest pile of one thing,
//    the Fork on caps and cans, the Stew on the richest order, and so on.
// 3. Brew when both ingredients are idle (nothing to merge with, nobody wants them): treasures
//    while an order is waiting, tools when they'd have something to do.
import { ITEMS, type ItemId } from '../data/items';
import { RECIPES, isTool, isTreasure } from '../data/recipes';
import { act, type Target } from '../game/actions';
import { toolPlan, treasureValue, type ToolPlan } from '../game/alchemy';
import { orderValue } from '../game/orders';
import { inFlight, type GameState } from '../game/state';
import { isSmelly, stinkLimit } from '../game/stink';

interface Spot {
  id: ItemId;
  c: number;
  r: number;
}

/** On the King night only these get brewed (they raise junk). */
const KING_TOOLS: readonly ItemId[] = ['elecsoup', 'magnet', 'leftovers'];

/**
 * Switch the bot's alchemy off (a sim compares the economy with and without it), and how many
 * seconds a lone piece sits before the bot calls it idle (brewing material).
 */
export const ALCHEMY_BOT = { on: true, idleSec: 0 };

/** One alchemy action if there's a good one: returns true if it acted. */
export function alchemyMove(s: GameState, wanted: ReadonlySet<ItemId>): boolean {
  if (!ALCHEMY_BOT.on) return false;
  const spots: Spot[] = s.board
    .pieces()
    .filter(({ p }) => !inFlight(s, p.uid))
    .map(({ p, c, r }) => ({ id: p.id, c, r }));
  return giveTreasure(s, spots) || useTools(s, spots) || brewSomething(s, spots, wanted);
}

// ---- 1. Treasures ----

function giveTreasure(s: GameState, spots: readonly Spot[]): boolean {
  const empty = s.board.empties().length;
  for (const t of spots.filter((p) => isTreasure(p.id))) {
    let best: { slot: number; score: number; urgent: boolean } | null = null;
    s.orders.forEach((o, slot) => {
      if (!o || o.mood !== 'waiting') return;
      const urgent = o.patience / o.patienceMax < 0.25 && !o.jackpot;
      // What it pays, against what this order would pay filled the normal way.
      const score = s.goal === 'king' ? 1 : treasureValue(s, slot, t.id) - orderValue(s, slot) * (o.jackpot ? 1.5 : 1) + (urgent ? orderValue(s, slot) : 0);
      if (!best || score > best.score) best = { slot, score, urgent };
    });
    const pick = best as { slot: number; score: number; urgent: boolean } | null;
    if (pick && (pick.score >= 0 || pick.urgent || empty <= 3)) return act(s, t.c, t.r, { kind: 'order', slot: pick.slot }) === 'deliver';
  }
  return false;
}

// ---- 2. Tools ----

/** Every useful target for the tool at (c, r), each with its plan. */
function plans(s: GameState, tool: Spot): { t: Target; plan: ToolPlan }[] {
  const out: { t: Target; plan: ToolPlan }[] = [];
  if (tool.id === 'stew') {
    s.orders.forEach((_, slot) => {
      const t: Target = { kind: 'order', slot };
      const plan = toolPlan(s, tool.c, tool.r, t);
      if (plan) out.push({ t, plan });
    });
    return out;
  }
  for (const { c, r } of s.board.pieces()) {
    const t: Target = { kind: 'cell', c, r };
    const plan = toolPlan(s, tool.c, tool.r, t);
    if (plan) out.push({ t, plan });
    // Lot-wide tools do the same thing wherever they're dropped: one target is enough.
    if (plan && plan.aim === 'lot') break;
  }
  return out;
}

/** How much a plan is worth doing now (0 or less: wait). */
function worth(s: GameState, tool: ItemId, plan: ToolPlan, crowded: boolean): number {
  const stinkShare = s.stink / stinkLimit(s);
  const smellyHits = plan.hits.filter(([c, r]) => {
    const p = s.board.get(c, r);
    return p ? isSmelly(s, p) : false;
  }).length;
  const n = plan.hits.length;
  switch (tool) {
    case 'blanket':
      return stinkShare >= 0.45 || smellyHits >= 6 ? 10 + n : 0;
    case 'bootcoffee': {
      const low = s.orders.some((o) => o && o.mood === 'waiting' && o.patience / o.patienceMax < 0.2);
      return low || (crowded && s.truck.timer < 4) ? 5 : 0;
    }
    case 'stew': {
      const slot = plan.slot ?? -1;
      // The richest order (once there's one worth doubling).
      const best = Math.max(...s.orders.map((_, i) => orderValue(s, i)));
      return slot >= 0 && orderValue(s, slot) >= best && best >= ITEMS.bag.value ? 3 : 0;
    }
    case 'bagbomb':
      return smellyHits >= 3 || n >= 6 || (crowded && n >= 3) ? n + smellyHits : 0;
    case 'elecsoup':
      return n >= 4 || (crowded && n >= 2) ? n : 0;
    case 'magnet':
      return n >= 3 || (crowded && n >= 2) ? n : 0;
    case 'forkgull':
      return n >= 5 || (crowded && n >= 2) ? n : 0;
    case 'chum':
      return n >= 2 ? n : 0;
    case 'tirefire':
      return (n >= 5 || (crowded && n >= 3)) && stinkShare < 0.6 ? n : 0;
    case 'leftovers': {
      // Copy the most valuable thing on the lot.
      const p = s.board.get(plan.c, plan.r);
      return p ? ITEMS[p.id].value : 0;
    }
  }
  return 0;
}

function useTools(s: GameState, spots: readonly Spot[]): boolean {
  const crowded = s.board.empties().length <= 6;
  let best: { tool: Spot; t: Target; score: number } | null = null;
  for (const tool of spots.filter((p) => isTool(p.id))) {
    for (const { t, plan } of plans(s, tool)) {
      const score = worth(s, tool.id, plan, crowded);
      if (score > 0 && (!best || score > best.score)) best = { tool, t, score };
    }
  }
  const pick = best as { tool: Spot; t: Target; score: number } | null;
  return pick ? act(s, pick.tool.c, pick.tool.r, pick.t) === 'tool' : false;
}

// ---- 3. Brewing ----

/** Would this tool have something to do on the lot as it is? */
function toolWanted(s: GameState, spots: readonly Spot[], id: ItemId): boolean {
  const n = (ids: readonly ItemId[]): number => spots.filter((p) => ids.includes(p.id)).length;
  switch (id) {
    case 'stew':
      return s.orders.some((o) => o?.mood === 'waiting');
    case 'bagbomb':
    case 'forkgull':
      return n(['cap', 'can']) >= 5;
    case 'chum':
      return n(['gull', 'fatgull', 'gullgang', 'gullboss']) >= 2;
    case 'tirefire':
      return s.board.fillRatio() > 0.6;
    default:
      return true;
  }
}

function brewSomething(s: GameState, spots: readonly Spot[], wanted: ReadonlySet<ItemId>): boolean {
  const counts = new Map<ItemId, number>();
  for (const p of spots) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
  // The top of the lot (and whatever builds tonight's jackpot) is kept for merging, unless it's
  // already gone smelly waiting for a partner.
  let top = 0;
  for (const p of spots) if (ITEMS[p.id].chain === 'junk') top = Math.max(top, ITEMS[p.id].tier);
  const jackpot = s.orders.find((o) => o?.jackpot && o.mood === 'waiting');
  const jackpotTier = jackpot ? Math.max(...jackpot.wants.map((id) => ITEMS[id].tier)) : 99;
  const keep = Math.min(top - 1, jackpotTier - 3);
  // Idle: nothing to merge with, nobody's asking for it, and it's sat there a while (a partner
  // often lands with the next truck).
  const idle = (p: Spot): boolean => {
    const piece = s.board.get(p.c, p.r);
    if (counts.get(p.id) !== 1 || wanted.has(p.id) || !piece || s.time - piece.born < ALCHEMY_BOT.idleSec) return false;
    const d = ITEMS[p.id];
    return d.chain !== 'junk' || d.tier < Math.max(3, keep) || isSmelly(s, piece);
  };
  const ordersWaiting = s.orders.some((o) => o?.mood === 'waiting');
  const tools = spots.filter((p) => isTool(p.id)).length;
  // The King night is for building: only the tools that help build get brewed.
  const king = s.goal === 'king';
  let best: { a: Spot; b: Spot; score: number } | null = null;
  for (const rec of RECIPES) {
    if (king && !KING_TOOLS.includes(rec.id)) continue;
    const a = spots.find((p) => p.id === rec.a && idle(p));
    const b = spots.find((p) => p.id === rec.b && idle(p));
    if (!a || !b) continue;
    if (rec.kind === 'treasure' && !ordersWaiting) continue;
    // Don't hoard tools.
    if (rec.kind === 'tool' && (tools >= 2 || !toolWanted(s, spots, rec.id))) continue;
    const score = rec.kind === 'treasure' ? ITEMS[rec.id].value : 1;
    if (!best || score > best.score) best = { a, b, score };
  }
  const pick = best as { a: Spot; b: Spot; score: number } | null;
  return pick ? act(s, pick.a.c, pick.a.r, { kind: 'cell', c: pick.b.c, r: pick.b.r }) === 'brew' : false;
}
