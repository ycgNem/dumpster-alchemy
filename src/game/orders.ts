// Raccoon orders: a raccoon walks up to an empty slot wanting 1-2 items, waits with a patience
// bar, pays when filled, and storms off (kicking the Dumpster over and raising the Stink) when
// patience runs out.
//
// Orders soak up what's on the lot: the tiers they ask for follow the junk on the board right now
// (weighted toward tiers you hold, plus what a pair would make, plus one tier above the top as a
// stretch), not the best you've ever made. A scrap order wants several caps and cans, so small
// junk always has somewhere to go. Night 1's first order is a can.
//
// The pay is the items' value times the order's `payMul` (the raccoon, big spender, scrap,
// jackpot and tonight's rule), plus a patience bonus that scales with that value. Once a night a
// jackpot raccoon wants something big (the night sets how big) with a long timer; it pays well but
// never more than a set share of the quota, and if it isn't filled it just leaves. On the King
// night orders stay small (tier 5 at most) and pay in junk instead of Shinies: a filled order
// usually kicks a gift one tier above its best item onto the lot, for the build.
import { ITEMS, junkAt, JUNK_CHAIN, type ItemId } from '../data/items';
import { RACCOONS, type RaccoonDef } from '../data/raccoons';
import { TUNING } from '../data/tuning';
import { gullOrder } from './gulls';
import { launch } from './spawn';
import { earn } from './shift';
import type { GameState, Order } from './state';
import { addStink } from './stink';

export function raccoonDef(id: string): RaccoonDef {
  const d = RACCOONS.find((r) => r.id === id);
  if (!d) throw new Error(`no raccoon ${id}`);
  return d;
}

export function updateOrders(s: GameState, dt: number): void {
  const O = TUNING.orders;
  for (let i = 0; i < s.orders.length; i++) {
    const o = s.orders[i];
    if (!o) {
      s.orderGap[i] = (s.orderGap[i] ?? 0) - dt;
      if ((s.orderGap[i] ?? 0) <= 0) arrive(s, i);
      continue;
    }
    o.t += dt;
    if (o.mood === 'waiting') {
      o.patience -= dt;
      if (o.patience <= 0) stormOff(s, i, o);
    } else if (o.t >= O.leaveSec) {
      s.orders[i] = null;
      s.orderGap[i] = s.rng.range(O.gapMinSec, O.gapMaxSec);
    }
  }
}

/** "{item}" in a raccoon's line becomes the short name of what they want. */
function say(line: string, want: ItemId): string {
  return line.replace(/\{item\}/g, ITEMS[want].short);
}

/** What kind of order this is, for its pay. */
interface Kind {
  big?: boolean;
  scrap?: boolean;
  jackpot?: boolean;
  gull?: boolean;
}

function arrive(s: GameState, slot: number): void {
  const firstTonight = s.ordersMade === 0;
  s.ordersMade++;
  if (jackpotReady(s)) {
    jackpotArrives(s, slot);
    return;
  }
  const O = TUNING.orders;
  const def = pickRaccoon(s);
  const big = isBigSpender(slot);
  let wants: ItemId[];
  let gull: { want: ItemId; line: string } | null = null;
  let scrap = false;
  if (firstTonight && s.night === 1 && s.goal === 'quota') {
    // Night 1 starts easy: a can (two caps, or a lucky click).
    wants = [O.firstOrder];
  } else if (!big && def.maxWants > 1 && s.rng.chance(scrapChance(s))) {
    scrap = true;
    wants = scrapWants(s);
  } else {
    // Once gulls are about, sometimes they want one of those instead (always just the one).
    gull = big ? null : gullOrder(s, def.id);
    wants = [gull ? gull.want : big ? bigWant(s) : pickWant(s, def)];
    if (!gull && !big && def.maxWants > 1 && s.rng.chance(O.twoItemChance)) wants.push(pickWant(s, def, wants));
  }
  wants.sort((a, b) => ITEMS[b].tier - ITEMS[a].tier);
  let patience = s.rng.range(O.patienceMinSec, O.patienceMaxSec) * def.patienceMul * s.mods.patienceMul;
  if (scrap) patience *= O.scrap.patienceMul;
  else if (wants.length > 1) patience *= O.twoItemPatienceMul;
  if (big) patience *= O.bigSpender.patienceMul;
  const top = wants[0] ?? 'cap';
  s.orders[slot] = {
    raccoon: def.id,
    wants,
    got: wants.map(() => false),
    patience,
    patienceMax: patience,
    mood: 'waiting',
    t: 0,
    line: gull ? gull.line : say(s.rng.pick(def.lines.arrive), top),
    paid: 0,
    jackpot: false,
    big,
    scrap,
    payMul: payMulFor(s, def, { big, scrap, gull: gull !== null }),
  };
  s.events.push({ type: 'orderArrive', slot, raccoon: def.id, scrap: scrap || undefined });
}

/** Someone not already at the counter (anyone, if all four are). */
function pickRaccoon(s: GameState): RaccoonDef {
  const here = new Set(s.orders.map((o) => o?.raccoon));
  const free = RACCOONS.filter((r) => !here.has(r.id));
  return s.rng.pick(free.length > 0 ? free : RACCOONS);
}

/** An order's pay multiplier: the raccoon's taste, the kind of order, tonight's rule. */
function payMulFor(s: GameState, def: RaccoonDef, k: Kind): number {
  const O = TUNING.orders;
  let m = def.payMul * s.mods.orderPayMul;
  if (k.big) m *= O.bigSpender.payMul;
  if (k.scrap) m *= O.scrap.payMul;
  if (k.gull) m *= s.mods.gullPayMul;
  if (k.jackpot) m *= TUNING.jackpot.payMul;
  return m;
}

/** The highest junk tier an order may ask for tonight (the King night keeps them small). */
function maxOrderTier(s: GameState): number {
  return s.goal === 'king' ? TUNING.king.maxOrderTier : JUNK_CHAIN.length - 1;
}

/** The Extra Raccoon's slot: big spenders only. */
export function isBigSpender(slot: number): boolean {
  return slot >= TUNING.orders.bigSpender.fromSlot;
}

// ---- What the lot holds ----

/**
 * Junk on the lot by tier (index = tier; pieces in the air count, they're landing), less what
 * waiting orders have already asked for (and `taken`: what this order already wants).
 */
function lotTiers(s: GameState, taken: readonly ItemId[] = []): number[] {
  const n = Array.from({ length: JUNK_CHAIN.length + 2 }, () => 0);
  for (const { p } of s.board.pieces()) {
    const d = ITEMS[p.id];
    if (d.chain === 'junk') n[d.tier] = (n[d.tier] ?? 0) + 1;
  }
  for (const o of s.orders) {
    if (!o || o.mood !== 'waiting') continue;
    o.wants.forEach((id, k) => {
      const d = ITEMS[id];
      if (!o.got[k] && d.chain === 'junk') n[d.tier] = Math.max(0, (n[d.tier] ?? 0) - 1);
    });
  }
  for (const id of taken) {
    const d = ITEMS[id];
    if (d.chain === 'junk') n[d.tier] = Math.max(0, (n[d.tier] ?? 0) - 1);
  }
  return n;
}

/** The highest tier on the lot (not already promised), or 0. */
function lotTop(n: readonly number[]): number {
  for (let t = n.length - 1; t >= 1; t--) if ((n[t] ?? 0) > 0) return t;
  return 0;
}

/**
 * How likely each junk tier is for a new order (index = tier): tiers you hold weigh their count,
 * a pair weighs toward what it merges into, one tier over the top of the lot is the stretch.
 * Tonight's rule may narrow the range (Takeout Tuesday: 3-4).
 */
export function tierWeights(s: GameState, taken: readonly ItemId[] = []): number[] {
  const O = TUNING.orders;
  const B = O.board;
  const n = lotTiers(s, taken);
  const w = n.map(() => 0);
  const lo = O.minTier;
  const hi = maxOrderTier(s);
  const ok = (t: number): boolean => t >= lo && t <= hi;
  for (let t = 1; t < n.length; t++) {
    const c = n[t] ?? 0;
    if (c <= 0) continue;
    if (ok(t)) w[t] = (w[t] ?? 0) + Math.min(c, B.heldCap);
    if (c >= 2 && ok(t + 1)) w[t + 1] = (w[t + 1] ?? 0) + B.pairWeight * Math.min(Math.floor(c / 2), 2);
  }
  const top = lotTop(n);
  if (ok(top + 1)) w[top + 1] = (w[top + 1] ?? 0) + B.stretchWeight;
  if (w.every((x) => x <= 0)) for (let t = lo; t <= Math.min(O.startReach, hi); t++) w[t] = 1;
  const only = s.mods.orderTiers;
  if (only) {
    for (let t = 0; t < w.length; t++) if (t < only[0] || t > only[1]) w[t] = 0;
    if (w.every((x) => x <= 0)) for (let t = only[0]; t <= only[1]; t++) w[t] = 1;
  }
  return w;
}

/** One weighted draw that never lands on a zero weight (float rounding could otherwise). */
function drawTier(s: GameState, w: readonly number[]): number {
  const i = s.rng.weighted(w);
  if ((w[i] ?? 0) > 0) return i;
  for (let t = w.length - 1; t >= 0; t--) if ((w[t] ?? 0) > 0) return t;
  return TUNING.orders.minTier;
}

/** A tier for a raccoon: one draw from the lot's weights, the biggest of 1 + tierBias draws. */
function pickWant(s: GameState, def: RaccoonDef, taken: readonly ItemId[] = []): ItemId {
  const w = tierWeights(s, taken);
  let tier = 0;
  for (let i = 0; i <= Math.max(0, def.tierBias); i++) tier = Math.max(tier, drawTier(s, w));
  return junkAt(Math.max(1, tier));
}

/** A big spender wants the top of the lot, or one above it (within tonight's range). */
function bigWant(s: GameState): ItemId {
  const O = TUNING.orders;
  const hi = maxOrderTier(s);
  const top = Math.max(lotTop(lotTiers(s)), O.startReach);
  let tier = Math.min(top + s.rng.int(2), hi);
  const only = s.mods.orderTiers;
  if (only) tier = Math.max(only[0], Math.min(only[1], tier));
  return junkAt(Math.max(O.minTier, tier));
}

// ---- Scrap orders ----

/** Chance the next arrival is a scrap order: more with more small junk on the lot; one at a time. */
export function scrapChance(s: GameState): number {
  const S = TUNING.orders.scrap;
  if (!s.mods.scrapOrders || s.orders.some((o) => o?.scrap && o.mood === 'waiting')) return 0;
  const n = lotTiers(s);
  let small = 0;
  for (let t = 1; t <= S.maxTier; t++) small += n[t] ?? 0;
  return Math.min(S.maxChance, S.chance + S.perSmall * Math.max(0, small - S.freeSmall));
}

/** 3-5 tier 1-2 pieces, mixed like the small junk on the lot, biggest first. */
function scrapWants(s: GameState): ItemId[] {
  const S = TUNING.orders.scrap;
  const n = lotTiers(s);
  const w: number[] = [];
  for (let t = 1; t <= S.maxTier; t++) w.push((n[t] ?? 0) + 0.5);
  const count = S.minPieces + s.rng.int(S.maxPieces - S.minPieces + 1);
  return Array.from({ length: count }, () => junkAt(drawTier(s, w) + 1));
}

// ---- The jackpot ----

/** What tonight's jackpot asks for: one tier above the best so far, within the night's range. */
export function jackpotTier(s: GameState): number {
  const [lo, hi] = s.mods.jackpotTiers ?? TUNING.jackpot.tiers;
  return Math.max(lo, Math.min(hi, s.bestTier + 1));
}

/** Time for the jackpot raccoon, and the player could plausibly build what it wants. */
function jackpotReady(s: GameState): boolean {
  if (s.jackpotAt === null || s.time < s.jackpotAt || !s.mods.jackpotTiers) return false;
  if (s.orders.some((o) => o?.jackpot)) return false;
  return s.bestTier >= jackpotTier(s) - TUNING.jackpot.reachBelow;
}

function jackpotArrives(s: GameState, slot: number): void {
  const J = TUNING.jackpot;
  const def = pickRaccoon(s);
  const want = junkAt(jackpotTier(s));
  const patience = J.patienceSec * s.mods.patienceMul;
  // Endless has one every so often; a normal night has just the one.
  s.jackpotAt = s.goal === 'endless' ? s.time + TUNING.endless.jackpotEverySec : null;
  let payMul = payMulFor(s, def, { jackpot: true });
  // A bonus, not the night: never more than a share of the quota, bonus and all.
  if (s.goal === 'quota' && s.quota > 0) {
    payMul = Math.min(payMul, (s.quota * J.maxQuotaShare) / (ITEMS[want].value * (1 + TUNING.orders.patienceBonus)));
  }
  s.orders[slot] = {
    raccoon: def.id,
    wants: [want],
    got: [false],
    patience,
    patienceMax: patience,
    mood: 'waiting',
    t: 0,
    line: say(s.rng.pick(def.lines.jackpot), want),
    paid: 0,
    jackpot: true,
    big: false,
    scrap: false,
    payMul,
  };
  s.events.push({ type: 'orderArrive', slot, raccoon: def.id, jackpot: true });
}

// ---- Delivering ----

/** Can the order in `slot` take this item right now? */
export function wants(s: GameState, slot: number, id: ItemId): boolean {
  const o = s.orders[slot];
  if (!o || o.mood !== 'waiting') return false;
  return o.wants.some((w, k) => w === id && !o.got[k]);
}

/** What one item pays to this order, before the patience bonus (for price tags; 0 on the King night is up to the caller). */
export function itemPay(o: Order, id: ItemId): number {
  return Math.round(ITEMS[id].value * o.payMul);
}

/** What the order in `slot` would pay in all if it were filled right now (0 on the King night). */
export function orderValue(s: GameState, slot: number): number {
  const o = s.orders[slot];
  if (!o || s.goal === 'king') return 0;
  const items = o.wants.reduce((a, id) => a + itemPay(o, id), 0);
  return Math.round(items * (1 + TUNING.orders.patienceBonus * Math.max(0, o.patience / o.patienceMax)));
}

/** Hand the piece at c,r to the order in `slot`. Returns false if they don't want it. */
export function deliver(s: GameState, slot: number, c: number, r: number): boolean {
  const o = s.orders[slot];
  const p = s.board.get(c, r);
  if (!o || !p || o.mood !== 'waiting') return false;
  const k = o.wants.findIndex((w, j) => w === p.id && !o.got[j]);
  if (k < 0) return false;
  const def = raccoonDef(o.raccoon);
  const king = s.goal === 'king';
  s.board.set(c, r, null);
  o.got[k] = true;
  let shinies = king ? 0 : itemPay(o, p.id);
  const complete = o.got.every(Boolean);
  let gift: ItemId | undefined;
  if (complete) {
    if (!king) {
      // The bonus is a share of the whole order's value, by how much patience was left.
      const all = o.wants.reduce((a, id) => a + itemPay(o, id), 0);
      shinies += Math.round(all * TUNING.orders.patienceBonus * Math.max(0, o.patience / o.patienceMax));
    }
    o.mood = 'happy';
    o.t = 0;
    o.line = s.rng.pick(def.lines.happy);
    s.stats.ordersFilled++;
    if (o.jackpot) s.stats.jackpots++;
    if (o.scrap) s.stats.scraps++;
    if (king && s.rng.chance(TUNING.king.giftChance)) gift = giftFor(o);
  }
  o.paid += shinies;
  s.stats.itemsDelivered++;
  s.events.push({ type: 'deliver', slot, id: p.id, complete, shinies, jackpot: o.jackpot || undefined, gift });
  earn(s, shinies);
  if (gift && launch(s, gift, 'kick', TUNING.orders.kickFlightSec, slot)) s.stats.gifts++;
  return true;
}

/** King night: a filled order kicks back junk a tier above its best item (never the King). */
function giftFor(o: Order): ItemId {
  const top = Math.max(...o.wants.map((id) => ITEMS[id].tier));
  return junkAt(Math.min(JUNK_CHAIN.length - 1, top + TUNING.king.giftTiers));
}

function stormOff(s: GameState, slot: number, o: Order): void {
  const def = raccoonDef(o.raccoon);
  o.mood = 'angry';
  o.t = 0;
  o.patience = 0;
  o.line = s.rng.pick(def.lines.angry);
  // The jackpot was a bonus, not a chore: that raccoon just leaves.
  if (o.jackpot) {
    s.events.push({ type: 'orderAngry', slot, raccoon: o.raccoon, jackpot: true });
    return;
  }
  s.stats.ordersAngry++;
  s.events.push({ type: 'orderAngry', slot, raccoon: o.raccoon });
  addStink(s, TUNING.stink.perAngryRaccoon, 'angry');
  for (let i = 0; i < TUNING.orders.angryKickJunk && s.status === 'playing'; i++) {
    const tier = s.rng.weighted(TUNING.dumpster.tierOdds) + 1;
    launch(s, junkAt(tier), 'kick', TUNING.orders.kickFlightSec, slot);
  }
}
