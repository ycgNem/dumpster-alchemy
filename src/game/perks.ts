// The run's hooks into a night: Contraband that can't be a plain `Mods` number, and the bosses'
// hourly twists. Every rule here reads `s.mods` (src/data/contraband.ts sets the mods from the
// run's slots; src/data/nights.ts sets the bosses'), so a night with none of them is untouched.
//
// Where each hook is called (each is one line in a shared file):
//   perkPay          orders.ts deliver      Mafia, Midnight Snack, Sticky Fingers, Potluck; feeds the Gull God
//   perkSkip         actions.ts mergeInto   Compost Heap, Golden Goose
//   perkAfterMerge   actions.ts mergeInto   Hot Sauce
//   perkAfterCrush   actions.ts drop        Recycling Bin; feeds the Gull God
//   forgiveShutdown  stink.ts checkStink    Possum Bribe
//   updatePerks      step.ts                Fly Farm; The Inspection's condemned cells; the Gull God Raid
// (Pyramid Scheme is in orders.ts payMulFor, Double Bagger in dumpster.ts, Overtime Junkie in
// shift.ts payOvertime: each reads its mod directly.)
//
// Headless like the rest of src/game/: the effects only push events (`perk`, `boss`).
import { contrabandDef, type ContrabandId } from '../data/contraband';
import { ITEMS, JUNK_CHAIN, junkAt, type ItemId } from '../data/items';
import { TUNING } from '../data/tuning';
import { makePiece, type Piece } from './board';
import { earn } from './shift';
import { inFlight, noteItem, type GameState, type Mods } from './state';
import { isSmelly } from './stink';

/** Put a set of Contraband onto tonight's mods (in slot order). */
export function applyContraband(m: Mods, ids: readonly ContrabandId[]): void {
  for (const id of ids) contrabandDef(id).apply?.(m);
}

/** On the board, landed, not in the player's hand. */
function loose(s: GameState, p: Piece): boolean {
  return !inFlight(s, p.uid) && s.drag?.uid !== p.uid;
}

/**
 * What a delivery pays after the Contraband's pay rules: caps and cans (Raccoon Mafia), brews
 * (Potluck), before 1 AM (Midnight Snack), a lucky double (Sticky Fingers). A gull handed in feeds
 * the Gull God.
 */
export function perkPay(s: GameState, id: ItemId, shinies: number, slot: number): number {
  const d = ITEMS[id];
  if (d.chain === 'gull' && s.mods.raid && !s.perk.fed) {
    s.perk.fed = true;
    s.events.push({ type: 'boss', what: 'fed' });
  }
  if (shinies <= 0) return shinies;
  const m = s.mods;
  let mul = 1;
  if (d.chain === 'junk' && d.tier <= 2) mul *= m.smallPayMul;
  if (d.chain === 'brew') mul *= m.brewPayMul;
  if (s.time < TUNING.shift.secondsPerHour) mul *= m.earlyPayMul;
  if (m.doublePayChance > 0 && s.rng.chance(m.doublePayChance)) {
    mul *= 2;
    s.events.push({ type: 'perk', id: 'sticky', text: 'STICKY FINGERS x2!', slot });
  }
  return mul === 1 ? shinies : Math.round(shinies * mul);
}

/** Does this merge skip a tier for a Contraband? Compost Heap: a smelly piece; Golden Goose: Gang + Gang. */
export function perkSkip(s: GameState, a: Piece, b: Piece, to: ItemId): boolean {
  const m = s.mods;
  if (m.gooseEgg && to === 'gullboss') return true;
  if (m.smellySkip && ITEMS[to].chain === 'junk' && (isSmelly(s, a) || isSmelly(s, b))) return true;
  return false;
}

const AROUND: readonly [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/** After a merge made `made` at (c, r). Hot Sauce: a fresh Toaster zaps a junk neighbour up a tier. */
export function perkAfterMerge(s: GameState, made: ItemId, c: number, r: number): void {
  if (!s.mods.hotSauce || made !== 'toaster') return;
  const near: { p: Piece; c: number; r: number }[] = [];
  for (const [dc, dr] of AROUND) {
    const p = s.board.get(c + dc, r + dr);
    if (!p || !loose(s, p)) continue;
    const d = ITEMS[p.id];
    if (d.chain === 'junk' && d.tier < JUNK_CHAIN.length - 1) near.push({ p, c: c + dc, r: r + dr });
  }
  if (near.length === 0) return;
  const hit = s.rng.pick(near);
  const to = junkAt(ITEMS[hit.p.id].tier + 1);
  s.board.set(hit.c, hit.r, makePiece(to, s.time));
  noteItem(s, to);
  s.events.push({ type: 'perk', id: 'hotsauce', text: 'ZAP!', c: hit.c, r: hit.r, item: to });
}

/** After the Crusher ate `id`. Recycling Bin: a lid charge back. A gull crushed feeds the Gull God. */
export function perkAfterCrush(s: GameState, id: ItemId): void {
  if (s.mods.crushRefill && s.dumpster.charges < s.dumpster.max) {
    s.dumpster.charges++;
    s.events.push({ type: 'perk', id: 'recycler', text: '+1 LID' });
  }
  if (ITEMS[id].chain === 'gull' && s.mods.raid && !s.perk.fed) {
    s.perk.fed = true;
    s.events.push({ type: 'boss', what: 'fed' });
  }
}

/**
 * The Stink hit the limit: the Possum Bribe forgives it once (the Stink drops back). Returns true
 * if it did, and the night goes on. The run spends the bribe afterwards (src/game/run.ts).
 */
export function forgiveShutdown(s: GameState): boolean {
  if (!s.mods.bribe || s.perk.bribed || s.goal === 'endless') return false;
  s.perk.bribed = true;
  s.stink = Math.min(s.stink, TUNING.perks.bribeStinkTo);
  s.events.push({ type: 'perk', id: 'bribe', text: 'BRIBED! The Possum looks away.' });
  return true;
}

/** Every step (step.ts): the Fly Farm's pay, and the bosses' hourly twists. */
export function updatePerks(s: GameState, dt: number): void {
  if (s.status !== 'playing') return;
  const m = s.mods;
  if (m.smellyPayPerSec > 0) {
    let n = 0;
    for (const { p } of s.board.pieces()) if (isSmelly(s, p)) n++;
    s.perk.flyCash += n * m.smellyPayPerSec * dt;
    const pay = Math.floor(s.perk.flyCash);
    if (pay > 0) {
      s.perk.flyCash -= pay;
      earn(s, pay);
    }
  }
  if (m.condemnPerHour <= 0 && !m.raid) return;
  const { secondsPerHour, hours } = TUNING.shift;
  const h = Math.min(hours - 1, Math.floor(s.time / secondsPerHour));
  while (s.perk.hour < h) {
    s.perk.hour++;
    for (let i = 0; i < m.condemnPerHour; i++) condemn(s);
    if (m.raid) raid(s);
  }
}

/** The Inspection: the Possum tapes off a random empty cell. Nothing lands or moves there again. */
function condemn(s: GameState): void {
  const empties = s.board.empties();
  if (empties.length === 0) return;
  const [c, r] = s.rng.pick(empties);
  s.board.block(c, r);
  s.perk.condemned++;
  s.events.push({ type: 'boss', what: 'condemn', c, r });
}

/** The Gull God Raid: fed since the last hour, it flies on; hungry, it takes your best junk. */
function raid(s: GameState): void {
  if (s.perk.fed) {
    s.perk.fed = false;
    s.events.push({ type: 'boss', what: 'pass' });
    return;
  }
  let best: { p: Piece; c: number; r: number } | null = null;
  for (const x of s.board.pieces()) {
    const d = ITEMS[x.p.id];
    if (d.chain !== 'junk' || !loose(s, x.p)) continue;
    if (!best || d.tier > ITEMS[best.p.id].tier) best = x;
  }
  if (!best) {
    s.events.push({ type: 'boss', what: 'pass' });
    return;
  }
  s.board.set(best.c, best.r, null);
  s.perk.stolen++;
  s.events.push({ type: 'boss', what: 'raid', c: best.c, r: best.r, id: best.p.id });
}

/** Seconds until the next hourly boss twist (Infinity when tonight has none, or it's the last hour). */
export function nextBossIn(s: GameState): number {
  if (s.mods.condemnPerHour <= 0 && !s.mods.raid) return Infinity;
  const { secondsPerHour, hours } = TUNING.shift;
  const next = (s.perk.hour + 1) * secondsPerHour;
  return s.perk.hour + 1 >= hours ? Infinity : Math.max(0, next - s.time);
}
