// Momentum (docs/V2.md pillar 2): cascades, the Stench Streak, the Raccoon Rave (Fever), and
// night 1's "something fell off the truck". Deterministic and time-stepped (updateCombo), so the
// headless sim sees all of it. Numbers in TUNING.combo.
//
// - **Cascades.** After a merge, if the new piece sits next to an identical idle piece (orthogonal;
//   diagonal too with mods.cascadeDiagonal), the two merge again after a beat (cascadeSec), into
//   the newer piece's cell. Then the result checks its own neighbours, and so on. Each link is a
//   real merge (actions.ts `mergeInto`): stats, the Almanac, Full Moon skips, gull chances. Never
//   grabbed: a piece in your hand or in the air, the top of a chain, anything outside the junk and
//   gull chains (brews, tools, the Golden Egg, Bin Juice).
// - **The Stench Streak** is a heat meter, 0 to 1. Merges, cascade links, brews and deliveries add
//   heat and hold it for the window (windowSec + mods.streakWindowBonus); after that it cools.
//   Its steps multiply delivery pay (`streakMul`) from x1 up to mods.streakMaxMul.
// - **Fever.** Full heat starts the Raccoon Rave: feverSec of deliveries at feverMul (at least one
//   over the streak's top), free Dumpster clicks (dumpster.ts), and party music and lights. Then
//   the meter starts again from empty.
// - **Something fell off the truck.** Night 1, from about 3:30 AM: the next truck to dump loses a
//   Bald Tire off the back, a guaranteed big moment.
//
// Merges come in through onMerged (actions.ts calls it for every merge). Deliveries and brews are
// read off this step's events (`deliver`, and the alchemy agent's `brew`), so nobody else has to
// call in; `bumpStreak` is there for anything that wants to feed the streak by hand.
import { ITEMS, type ItemId } from '../data/items';
import { TUNING } from '../data/tuning';
import { mergeInto } from './actions';
import type { GameEvent } from './events';
import { launch } from './spawn';
import { inFlight, type GameState } from './state';

const C = TUNING.combo;

/** A merge result waiting out its beat before it looks for a twin. */
interface Pending {
  uid: number;
  c: number;
  r: number;
  /** Seconds left in the beat. */
  t: number;
  /** The chain so far (the player's merge is 1). */
  links: number;
}

export interface ComboState {
  pending: Pending[];
  /** The Stench Streak, 0 to 1 (1 starts the Fever). */
  heat: number;
  /** Seconds before the heat starts to cool. */
  hold: number;
  /** The pay step reached (0: x1). */
  step: number;
  /** Seconds of Raccoon Rave left (0: none), and how long this one is. */
  fever: number;
  feverLen: number;
  /** The last event already read off `s.events` (that list is cleared after every step). */
  last: GameEvent | null;
  /** Tonight: cascade links, the longest chain, Fevers, and Shinies the streak and Fever added. */
  links: number;
  longest: number;
  fevers: number;
  bonus: number;
  /** The multiplier the last delivery was paid at (fx puts it on the payout). */
  paidMul: number;
  /** Night 1's tire: not tonight, waiting for 3:30, waiting for the next dump, or done. */
  fell: 'off' | 'waiting' | 'armed' | 'done';
  /** The truck's dump count when the tire was armed (it goes off the next one). */
  fellDumps: number;
}

/** This night's momentum (made on first use). */
export function combo(s: GameState): ComboState {
  if (!s.combo) {
    s.combo = {
      pending: [],
      heat: 0,
      hold: 0,
      step: 0,
      fever: 0,
      feverLen: C.feverSec,
      last: null,
      links: 0,
      longest: 1,
      fevers: 0,
      bonus: 0,
      paidMul: 1,
      fell: s.night === 1 && s.goal === 'quota' ? 'waiting' : 'off',
      fellDumps: 0,
    };
  }
  return s.combo;
}

// ------------------------------------------------------------------------------ cascades

/** Can this piece take part in a cascade at all? Junk and gulls below the top of their chain. */
export function cascades(id: ItemId): boolean {
  const d = ITEMS[id];
  if (!d || d.next === null) return false;
  const chain: string = d.chain;
  return chain === 'junk' || chain === 'gull';
}

const ORTHO: readonly (readonly [number, number])[] = [[0, -1], [-1, 0], [1, 0], [0, 1]];
const DIAG: readonly (readonly [number, number])[] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

/** A piece nobody is touching: on the board, landed, not in the player's hand. */
function idle(s: GameState, uid: number): boolean {
  return s.drag?.uid !== uid && !inFlight(s, uid);
}

/**
 * The twin the piece at (c, r) would cascade with right now (the oldest one next to it), or null.
 * The renderer uses it to lean the two together during the beat.
 */
export function cascadePartner(s: GameState, c: number, r: number): { c: number; r: number } | null {
  const p = s.board.get(c, r);
  if (!p || !cascades(p.id) || !idle(s, p.uid)) return null;
  const dirs = s.mods.cascadeDiagonal ? [...ORTHO, ...DIAG] : ORTHO;
  let best: { c: number; r: number; born: number } | null = null;
  for (const [dc, dr] of dirs) {
    const q = s.board.get(c + dc, r + dr);
    if (!q || q.id !== p.id || !idle(s, q.uid)) continue;
    if (!best || q.born < best.born) best = { c: c + dc, r: r + dr, born: q.born };
  }
  return best ? { c: best.c, r: best.r } : null;
}

/** Merge results still waiting out their beat (the renderer leans the pairs together). */
export function pendingCascades(s: GameState): readonly { c: number; r: number; t: number; links: number }[] {
  return s.combo?.pending ?? [];
}

/** A merge just made `made` at (c, r): feed the streak, queue a cascade check. `links`: the chain so far. */
export function onMerged(s: GameState, made: ItemId, c: number, r: number, links = 1): void {
  const cs = combo(s);
  const d = ITEMS[made];
  addHeat(s, C.heat.merge + C.heat.perTier * Math.max(0, (d?.tier ?? 1) - 1) + (links > 1 ? C.heat.cascade : 0));
  const p = s.board.get(c, r);
  if (p && p.id === made && cascades(made)) cs.pending.push({ uid: p.uid, c, r, t: C.cascadeSec, links });
}

function updateCascades(s: GameState, cs: ComboState, dt: number): void {
  if (cs.pending.length === 0) return;
  const due: Pending[] = [];
  cs.pending = cs.pending.filter((q) => {
    q.t -= dt;
    if (q.t > 0) return true;
    due.push(q);
    return false;
  });
  for (const q of due) {
    if (s.status !== 'playing') return;
    // Still there, still the same piece, nobody holding it?
    const p = s.board.get(q.c, q.r);
    if (!p || p.uid !== q.uid || !idle(s, p.uid)) continue;
    const twin = cascadePartner(s, q.c, q.r);
    if (!twin) continue;
    const links = q.links + 1;
    // Into the newer piece's cell (this one). mergeInto calls onMerged, which queues the next link.
    const made = mergeInto(s, twin.c, twin.r, q.c, q.r, links);
    if (!made) continue;
    cs.links++;
    cs.longest = Math.max(cs.longest, links);
    s.events.push({ type: 'cascade', links, id: made, c: q.c, r: q.r, fc: twin.c, fr: twin.r });
  }
}

// ------------------------------------------------------------------------------ the streak

function streakWindow(s: GameState): number {
  return C.windowSec + s.mods.streakWindowBonus;
}

/** Which pay step this much heat reaches (0: none). */
function stepOf(heat: number): number {
  let k = 0;
  for (const [at] of C.steps) if (heat >= at - 1e-9) k++;
  return k;
}

/** Delivery pay multiplier at a pay step. */
function stepMul(s: GameState, step: number): number {
  if (step <= 0) return 1;
  const share = C.steps[Math.min(step, C.steps.length) - 1]?.[1] ?? 1;
  return Math.round((1 + (s.mods.streakMaxMul - 1) * share) * 100) / 100;
}

/** Delivery pay during the Raccoon Rave: feverMul, and always at least one over the streak's top. */
export function feverMul(s: GameState): number {
  return Math.max(C.feverMul, s.mods.streakMaxMul + 1);
}

/** Feed the streak (anything that should keep it going; merges and deliveries already do). */
export function bumpStreak(s: GameState, heat: number = C.heat.merge): void {
  addHeat(s, heat);
}

function addHeat(s: GameState, x: number): void {
  const cs = combo(s);
  if (cs.fever > 0 || s.status !== 'playing') return;
  cs.hold = streakWindow(s);
  // Tonight's first Rave comes easier (a quiet night still gets one); Rave Night doubles it all.
  const boost = cs.fevers === 0 ? C.firstFeverMul : 1;
  cs.heat = Math.min(1, cs.heat + x * boost * (s.mods.streakGainMul ?? 1));
  const step = stepOf(cs.heat);
  if (step > cs.step) s.events.push({ type: 'streak', step, mul: stepMul(s, step) });
  cs.step = step;
  if (cs.heat >= 1) startFever(s, cs);
}

function startFever(s: GameState, cs: ComboState): void {
  cs.fever = C.feverSec;
  cs.feverLen = C.feverSec;
  cs.heat = 1;
  cs.fevers++;
  s.events.push({ type: 'feverStart', mul: feverMul(s), sec: C.feverSec });
}

function updateStreak(s: GameState, cs: ComboState, dt: number): void {
  if (cs.fever > 0) {
    cs.fever -= dt;
    if (cs.fever <= 0) {
      cs.fever = 0;
      cs.heat = 0;
      cs.hold = 0;
      cs.step = 0;
      s.events.push({ type: 'feverEnd' });
    }
    return;
  }
  if (cs.hold > 0) {
    cs.hold -= dt;
    return;
  }
  if (cs.heat <= 0) return;
  cs.heat = Math.max(0, cs.heat - C.coolPerSec * dt);
  const step = stepOf(cs.heat);
  // Cooled right off: a little fizzle (the meter says the rest).
  if (step === 0 && cs.step > 0) s.events.push({ type: 'streak', step: 0, mul: 1 });
  cs.step = step;
}

/** Deliveries and brews (alchemy.ts's `brew` event) pushed since the last step feed the streak. */
function readEvents(s: GameState, cs: ComboState): void {
  const from = cs.last ? s.events.lastIndexOf(cs.last) + 1 : 0;
  for (let i = from; i < s.events.length; i++) {
    const e = s.events[i];
    if (!e) continue;
    if (e.type === 'deliver') addHeat(s, C.heat.deliver + (e.complete ? C.heat.complete : 0));
    else if (e.type === 'brew') addHeat(s, C.heat.brew);
  }
}

/** What deliveries pay times right now: the streak's step, or the Raccoon Rave. */
export function streakMul(s: GameState): number {
  const cs = s.combo;
  if (!cs) return 1;
  if (cs.fever > 0) return feverMul(s);
  return stepMul(s, cs.step);
}

/** A delivery's pay with the streak (or the Rave) on top; the extra is counted for the balance sim. */
export function payStreak(s: GameState, base: number): number {
  const cs = combo(s);
  cs.paidMul = streakMul(s);
  const out = Math.round(base * cs.paidMul);
  if (out > base) cs.bonus += out - base;
  return out;
}

/** The multiplier the last delivery was paid at (1 with no streak). */
export function lastPayMul(s: GameState): number {
  return s.combo?.paidMul ?? 1;
}

/** Is the Raccoon Rave on? (Dumpster clicks are free while it is.) */
export function feverOn(s: GameState): boolean {
  return (s.combo?.fever ?? 0) > 0;
}

/** For the HUD: the heat (0-1), the pay step and multiplier, and the Rave's share left (0 when off). */
export function streakView(s: GameState): { heat: number; step: number; mul: number; fever: number; hold: number } {
  const cs = s.combo;
  if (!cs) return { heat: 0, step: 0, mul: 1, fever: 0, hold: 0 };
  return { heat: cs.heat, step: cs.step, mul: streakMul(s), fever: cs.fever > 0 ? cs.fever / cs.feverLen : 0, hold: cs.hold / streakWindow(s) };
}

// ------------------------------------------------------------------------------ the tire

const TIRE: ItemId = 'tire';

function updateFellOff(s: GameState, cs: ComboState): void {
  if (cs.fell === 'off' || cs.fell === 'done') return;
  const k = s.truck;
  if (cs.fell === 'waiting') {
    if (s.time < C.fellOffHour * TUNING.shift.secondsPerHour) return;
    cs.fell = 'armed';
    cs.fellDumps = k.dumps;
    return;
  }
  // Armed: the next dump, once its load is out, loses a tire off the back.
  if (k.dumps <= cs.fellDumps || k.load.length > 0 || (k.phase !== 'dump' && k.phase !== 'leave')) return;
  if (s.board.empties().length === 0) {
    // No room: it hangs on till a dump with room (it's guaranteed, so it never overflows).
    cs.fellDumps = k.dumps;
    return;
  }
  if (!launch(s, TIRE, 'truck', C.fellOffFlightSec, k.which)) return;
  const f = s.flights[s.flights.length - 1];
  cs.fell = 'done';
  if (f) s.events.push({ type: 'fellOff', id: TIRE, c: f.c, r: f.r });
}

// ------------------------------------------------------------------------------ the step

/** Advance cascades, the streak and Fever (and night 1's tire). */
export function updateCombo(s: GameState, dt: number): void {
  const cs = combo(s);
  readEvents(s, cs);
  updateCascades(s, cs, dt);
  updateStreak(s, cs, dt);
  updateFellOff(s, cs);
  cs.last = s.events[s.events.length - 1] ?? null;
}
