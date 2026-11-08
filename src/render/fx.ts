// The shitty juice (docs/DESIGN.md, "Feel"): everything here reacts to GameEvents or to what's on
// the board, and never changes the game. Pooled particles (puffs, sparks, feathers, drips, dust,
// debris), Shinies flying to the purse, the Gull God's ascension, the first-discovery and hour
// banners, the end-of-night slam, flies on the good junk and the Stink creeping in at the edges.
// Pixel rules: whole-pixel positions, no rotation, no fading alpha on sprites (things blink out).
import { ITEMS, type ItemId } from '../data/items';
import { PAL, type PalName } from '../data/palette';
import { TUNING } from '../data/tuning';
import { H, W } from '../engine/screen';
import type { GameEvent } from '../game/events';
import { inFlight, type GameState } from '../game/state';
import { isSmelly, ripeness, stinkLimit, stinkWarnAt } from '../game/stink';
import { cellFoot, drawItem, EGG_FALL } from './board';
import { fillRect, itemColour, paper } from './greybox';
import { BOARD, COMPACTOR, DUMPSTER, DUMPSTER_MOUTH, SHINIES, STINK, TRUCK_BED, TRUCK_LANE, TRUCK_STOP, orderSlot, type Rect } from './layout';
import { drawPopups, popup, resetPopups, textCanvas, updatePopups } from './popups';
import { addShake, resetShake, shakeOffset, updateShake } from './shake';
import { drawNine, drawSprite, has, sprite } from './sprites';
import { drawText, textWidth, wrapText } from './text';
import { RACCOONS } from '../data/raccoons';
import { placeholderRaccoon } from './greybox';
import { drawItemBig } from './menus';
import { truckBed, truckStop } from './props';
import { trucks } from '../game/truck';
import { crushPay } from '../game/actions';
import { twistOf } from './twists';
import { CROWN_SEC, END_SLAM_SEC, type View } from './view';

const GULLS = TUNING.gulls;

// ------------------------------------------------------------------------------ helpers

const rand = (a: number, b: number): number => a + Math.random() * (b - a);
function pick<T>(list: readonly T[]): T {
  const v = list[Math.floor(Math.random() * list.length)];
  if (v === undefined) throw new Error('pick from an empty list');
  return v;
}
/** The middle of a cell's item (the foot is its bottom centre). */
function mid(c: number, r: number): { x: number; y: number } {
  const f = cellFoot(c, r);
  return { x: f.x, y: f.y - 14 };
}
const cellKey = (c: number, r: number): number => c * 16 + r;

// Where popups may go: words about junk stay on the board, payouts in the orders column, truck
// trouble in the lane, Stink and Dumpster words in the right column.  Nothing spills over a frame.
const ON_BOARD: Rect = BOARD;
// (From just under the truck timer plate, so a payout over the first card never sits on it.)
const ORDERS_COL: Rect = { x: 0, y: 101, w: 174, h: 239 };
const RIGHT_COL: Rect = { x: 466, y: 104, w: 174, h: 236 };
/** Just above the Stink jar: its words stay small and stay there (never across the column). */
const OVER_JAR: Rect = { x: STINK.x - 14, y: STINK.y - 22, w: 54, h: 22 };

// ------------------------------------------------------------------------------ particles

interface Particle {
  alive: boolean;
  /** A sprite name, or '' for a plain square of `colour`. */
  name: string;
  colour: PalName;
  size: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Gravity (px/s²) and air drag (fraction of speed lost per second). */
  grav: number;
  drag: number;
  /** Side-to-side flutter in px (feathers). */
  sway: number;
  age: number;
  life: number;
  delay: number;
  /** Frames run once over the particle's life (puffs, pops) or loop on the sprite's own fps. */
  byLife: boolean;
  phase: number;
}

const MAX_PARTICLES = 320;
const pool: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
  alive: false,
  name: '',
  colour: 'ink0',
  size: 1,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  grav: 0,
  drag: 0,
  sway: 0,
  age: 0,
  life: 1,
  delay: 0,
  byLife: true,
  phase: 0,
}));
let next = 0;

type Spawn = Partial<Omit<Particle, 'alive' | 'age'>> & { x: number; y: number };

/** Take a particle from the pool (the oldest one goes when it's full). */
function emit(o: Spawn): void {
  const p = pool[next];
  next = (next + 1) % MAX_PARTICLES;
  if (!p) return;
  p.alive = true;
  p.name = o.name ?? '';
  p.colour = o.colour ?? 'ink0';
  p.size = o.size ?? 1;
  p.x = o.x;
  p.y = o.y;
  p.vx = o.vx ?? 0;
  p.vy = o.vy ?? 0;
  p.grav = o.grav ?? 0;
  p.drag = o.drag ?? 0;
  p.sway = o.sway ?? 0;
  p.age = 0;
  p.life = o.life ?? 0.5;
  p.delay = o.delay ?? 0;
  p.byLife = o.byLife ?? true;
  p.phase = o.phase ?? Math.random();
}

/** Green-brown stink puffs drifting out of a point. */
function puffs(x: number, y: number, n: number, spread = 14, delay = 0): void {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.4, 0.4);
    const sp = rand(spread * 0.6, spread * 1.4);
    emit({ name: 'fx_puff', colour: 'grime2', size: 4, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 10, drag: 2.2, grav: -14, life: rand(0.5, 0.75), delay });
  }
}

function feathers(x: number, y: number, n: number, delay = 0): void {
  for (let i = 0; i < n; i++) {
    emit({ name: 'fx_feather', colour: 'white', size: 2, x: x + rand(-6, 6), y: y + rand(-6, 4), vx: rand(-34, 34), vy: rand(-46, -16), grav: 46, drag: 2.6, sway: rand(2, 4), life: rand(0.8, 1.3), byLife: false, delay });
  }
}

function sparks(x: number, y: number, n: number, speed = 60, delay = 0): void {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(speed * 0.5, speed);
    emit({ name: 'fx_spark', colour: 'yellow', size: 2, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, grav: 110, drag: 1.5, life: rand(0.25, 0.45), delay });
  }
}

/** Square bits flying off and falling (dirt, chewed junk, a splat). */
function debris(x: number, y: number, n: number, colours: readonly PalName[], speed = 70, delay = 0, up = 50): void {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(speed * 0.3, speed);
    emit({ colour: pick(colours), size: Math.random() < 0.3 ? 2 : 1, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - up, grav: 240, drag: 0.8, life: rand(0.35, 0.6), delay });
  }
}

/** Low dust clouds rolling sideways (the truck, landings). */
function dust(x: number, y: number, n: number, width = 10, delay = 0): void {
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    emit({ colour: pick(['dirt3', 'fur2', 'fur3', 'dirt3'] as const), size: pick([2, 3, 3, 4]), x: x + rand(-width, width), y: y + rand(-2, 1), vx: side * rand(10, 34), vy: rand(-14, -4), grav: -4, drag: 2.4, life: rand(0.35, 0.65), delay });
  }
}

function pop(x: number, y: number, delay = 0): void {
  emit({ name: 'fx_pop', colour: 'white', size: 6, x, y, life: 0.28, delay });
}

// ------------------------------------------------------------------------------ the rest of the state

/** Shinies flying along a curve (to the purse on delivery, out of it when the Boss pecks). */
interface Coin {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  delay: number;
}
const coins: Coin[] = [];

/** The Gull God, rising out of its cell in a beam. */
interface God {
  x: number;
  y: number;
  t: number;
  emitT: number;
}
const gods: God[] = [];
/** Seconds the God takes to rise off the top of the screen (the egg falls after). */
const GOD_RISE = GULLS.eggDropSec * (1 - EGG_FALL);

interface Banner {
  kind: 'new' | 'hour';
  id: ItemId | null;
  title: string;
  lines: string[];
  t: number;
  life: number;
}
const banners: Banner[] = [];

/**
 * A slam: big marker words on an ink band. The end of the night ("QUOTA MET!", "SHUT DOWN!"...)
 * and the mid-night "QUOTA MET!" when the quota first comes in (`mid`: shorter, smaller thump).
 * `t` starts below 0 when it waits for something (the King's crowning).
 */
interface Slam {
  text: string;
  sub: string;
  colour: PalName;
  band: PalName;
  t: number;
  life: number;
  y: number;
  mid: boolean;
}
let slam: Slam | null = null;
let slamLanded = false;

/** The King's crowning (night 10): where he was made, and seconds since. */
let crown: { x: number; y: number; t: number } | null = null;
let crownCell: { x: number; y: number } | null = null;

function startSlam(o: Partial<Slam> & { text: string }): void {
  slamLanded = false;
  slam = { sub: '', colour: 'toxic3', band: 'toxic0', t: 0, life: END_SLAM_SEC, y: H / 2, mid: false, ...o };
}

/** The end-of-night slam for each way a night can end. */
function endSlam(s: GameState): void {
  const st = s.stats;
  switch (s.endReason) {
    case 'clockout':
      startSlam({
        text: 'CLOCKED OUT!',
        sub: s.overtimeEarned > 0 ? `Quota in the bag, plus +${s.overtimeEarned} overtime at x1.` : 'Quota in the bag. Lot 9 lives another night.',
      });
      break;
    case 'shift':
      if (st.overtimeBonus > 0) startSlam({ text: 'OVERTIME x2!', sub: `6 AM: the overtime pays twice. +${st.overtimeBonus} more Shinies!`, colour: 'yellow', band: 'sodium1' });
      else startSlam({ text: 'QUOTA MET!', sub: 'Made it to 6 AM.' });
      break;
    case 'stinkAfterQuota':
      startSlam({
        text: 'WHIFF!',
        sub: st.overtimeLost > 0 ? `You made quota, but the Possum takes the overtime: -${st.overtimeLost}` : 'Possum caught a whiff, but you made quota.',
        colour: 'yellow',
        band: 'sodium1',
      });
      break;
    case 'king':
      // Waits for the crowning to play first.
      startSlam({ text: 'ALL HAIL!', sub: 'THE TRASH KING IS CROWNED', colour: 'yellow', band: 'sodium1', t: -CROWN_SEC, y: 300 });
      break;
    case 'endless':
      startSlam({ text: 'CLOSING TIME!', sub: 'The Stink always wins in the end.', colour: 'red', band: 'rust0' });
      break;
    case 'quota':
      if (s.goal === 'king') startSlam({ text: 'NO KING!', sub: 'No King by 6 AM.', colour: 'red', band: 'rust0' });
      else startSlam({ text: 'SHORT!', sub: 'Short of the quota at 6 AM.', colour: 'red', band: 'rust0' });
      break;
    default:
      startSlam({ text: 'SHUT DOWN!', sub: `The Stink hit ${stinkLimit(s)}.`, colour: 'red', band: 'rust0' });
      break;
  }
}

/** Little jobs for later (a chomp when the gull actually lands on the junk). */
const later: { t: number; run: () => void }[] = [];
function after(sec: number, run: () => void): void {
  if (later.length < 64) later.push({ t: sec, run });
}

/** Where each cell's last piece came from, so a landing knows how hard to kick up dust. */
const landFrom = new Map<number, string>();
/** When a popup of a kind last went up (so a dozen overflows don't make a dozen "NO ROOM!"s). */
const lastWord = new Map<string, number>();
let clock = 0;

function say(key: string, gap: number): boolean {
  const t = lastWord.get(key) ?? -99;
  if (clock - t < gap) return false;
  lastWord.set(key, clock);
  return true;
}

// ------------------------------------------------------------------------------ words

const WORDS = {
  low: ['GROSS!', 'ew.', 'EW!', 'yuck', 'squish', 'gross'],
  mid: ['NASTY', 'NASTY!', 'RANK!', 'FILTHY', 'crusty!'],
  high: ['BEAUTIFUL', 'GORGEOUS', 'MAGNIFICENT', 'oh my...'],
  king: ['ALL HAIL!'],
  gull: ['oh no', 'OH NO', 'why', 'more gull'],
  eat: ['CHOMP', 'oh no', 'hey!', 'GULP'],
  angry: ['UGH!', 'HMPH!', 'RUDE'],
  howl: ['AWOOO!', 'AROOOO!', 'AWOOOOO!'],
  crush: ['CRUNCH', 'KRSSH', 'crunch'],
  ripe: ['RIPE!', 'pee-yew', 'P.U.', 'ew, ripe'],
} as const;

function mergeWord(chain: string, tier: number): { text: string; colour: PalName; big: boolean } {
  if (chain === 'gull') return { text: pick(WORDS.gull), colour: 'white', big: tier >= 3 };
  if (tier >= 12) return { text: pick(WORDS.king), colour: 'yellow', big: true };
  if (tier >= 9) return { text: pick(WORDS.high), colour: 'sodium3', big: true };
  if (tier >= 5) return { text: pick(WORDS.mid), colour: 'toxic2', big: false };
  return { text: pick(WORDS.low), colour: 'grime3', big: false };
}

// ------------------------------------------------------------------------------ events

export function fxEvent(s: GameState, e: GameEvent): void {
  switch (e.type) {
    case 'merge': {
      const m = mid(e.c, e.r);
      pop(m.x, m.y);
      if (e.chain === 'gull') feathers(m.x, m.y, 3 + e.tier);
      else puffs(m.x, m.y + 4, Math.min(6, 2 + Math.floor(e.tier / 3)), 10 + e.tier);
      if (e.chain === 'junk' && e.tier >= 6) sparks(m.x, m.y, Math.floor(e.tier / 2), 50);
      addShake(Math.min(3, 0.6 + e.tier * 0.22), 0.18 + e.tier * 0.012);
      // The God gets its own word (gullGod, below), so it can rise clear of it; the King gets
      // his crowning and the "ALL HAIL!" slam instead.
      const w = mergeWord(e.chain, e.tier);
      if (e.skipped) {
        // Full Moon: the merge jumped a tier.
        sparks(m.x, m.y, 14, 80);
        addShake(2, 0.3);
        popup('+2 TIERS!', m.x, m.y - 14, { color: 'yellow', big: true, clamp: ON_BOARD, life: 1.4 });
      } else if (e.to !== 'gullgod' && e.to !== 'king') popup(w.text, m.x, m.y - 12, { color: w.colour, big: w.big, clamp: ON_BOARD });
      if (e.first) discovery(e.to);
      if (e.to === 'king') {
        sparks(m.x, m.y, 24, 110);
        addShake(4, 0.6);
        crownCell = { x: m.x, y: m.y + 14 };
      }
      break;
    }
    case 'egg': {
      const m = mid(e.c, e.r);
      pop(m.x, m.y);
      sparks(m.x, m.y, 14, 90);
      sparks(m.x, m.y, 8, 50, 0.12);
      addShake(2.5, 0.35);
      popup('+2 TIERS!', m.x, m.y - 14, { color: 'yellow', big: true, clamp: ON_BOARD });
      if (e.first) discovery(e.to);
      if (e.to === 'king') crownCell = { x: m.x, y: m.y + 14 };
      break;
    }
    case 'spawn':
      landFrom.set(cellKey(e.c, e.r), e.from);
      if (e.from === 'truck') {
        // Junk flying out of the bed: a little cough of dust at the tailgate (whichever truck).
        const fl = s.flights.find((f) => f.c === e.c && f.r === e.r && f.from === 'truck');
        const bed = truckBed(fl?.slot ?? 0);
        dust(bed.x, bed.y + 4, 2, 6);
      } else if (e.from === 'dumpster') {
        puffs(DUMPSTER_MOUTH.x, DUMPSTER_MOUTH.y + 4, 1, 8);
      } else if (e.from === 'egg' && e.first) {
        // Its banner waits for the God's to finish.
        after(2.4, () => discovery('golden_egg'));
      }
      break;
    case 'land': {
      const from = landFrom.get(cellKey(e.c, e.r));
      landFrom.delete(cellKey(e.c, e.r));
      const f = cellFoot(e.c, e.r);
      if (from === 'gull') {
        feathers(f.x, f.y - 16, 3);
      } else if (from === 'egg') {
        dust(f.x, f.y - 1, 6, 10);
        sparks(f.x, f.y - 12, 10, 70);
        addShake(2, 0.25);
        popup('PLOP', f.x, f.y - 30, { color: 'yellow', clamp: ON_BOARD });
      } else if (from === 'truck' || from === 'kick') {
        dust(f.x, f.y - 1, 3, 8);
      } else {
        dust(f.x, f.y - 1, 1, 6);
      }
      break;
    }
    case 'truckDump': {
      // Whichever truck just started tipping (Garbage Day has two).
      const k = trucks(s).filter((t) => t.phase === 'dump').sort((a, b) => a.t - b.t)[0];
      const which = k?.which ?? 0;
      const st = truckStop(which);
      const back = which === 1 ? 1 : -1;
      const bed = truckBed(which);
      // The bed slams up: a cloud off the back wheels, then grit pouring off the tailgate.
      dust(st.x + back * 30, st.y - 3, 16, 26);
      dust(st.x + back * 40, st.y - 8, 8, 10, 0.1);
      dust(bed.x, bed.y + 6, 8, 10, 0.2);
      debris(bed.x, bed.y + 4, 8, ['dirt3', 'fur3', 'grime2'], 50, 0.25, 20);
      addShake(1.5, 0.3);
      break;
    }
    case 'truckArrive': {
      const k = trucks(s).filter((t) => t.phase === 'arrive').sort((a, b) => a.t - b.t)[0];
      const which = k?.which ?? 0;
      const st = truckStop(which);
      dust(st.x + (which === 1 ? -40 : 40), st.y - 2, 4, 16, 1.6);
      break;
    }
    case 'overflow': {
      // A splat on the board's edge, nearest the junk's way in (the top, the truck side).
      const side = Math.random();
      const x = side < 0.7 ? BOARD.x + rand(8, BOARD.w - 8) : side < 0.85 ? BOARD.x - 2 : BOARD.x + BOARD.w + 1;
      const y = side < 0.7 ? BOARD.y - 2 : BOARD.y + rand(8, 80);
      debris(x, y, 14, ['grime1', 'grime2', 'toxic1', 'rust1', 'dirt2'], 80, 0, 30);
      puffs(x, y, 2, 10);
      addShake(2, 0.25);
      // The word goes by the truck (it's the truck's load with nowhere to land), not on the board.
      if (say('noroom', 0.5)) popup('NO ROOM!', TRUCK_STOP.x + TRUCK_BED.dx - 40, TRUCK_LANE.y + 16, { color: 'red', big: true, clamp: TRUCK_LANE, rise: 4 });
      break;
    }
    case 'dumpsterClick':
      if (e.ok) {
        puffs(DUMPSTER_MOUTH.x, DUMPSTER_MOUTH.y + 2, 2, 8);
      } else if (say('lid', 0.8)) {
        const word = s.dumpster.charges <= 0 ? 'EMPTY!' : 'NO ROOM!';
        popup(word, DUMPSTER.x + 24, DUMPSTER.y + 4, { color: 'red', clamp: RIGHT_COL });
      }
      break;
    case 'compact': {
      const x = COMPACTOR.x + 24;
      const y = COMPACTOR.y + 20;
      after(0.15, () => {
        debris(x, y, 12, [itemColour(e.id), 'steel2', 'ink2'], 60, 0, 40);
        puffs(x, y + 6, 2, 10);
        addShake(1.5, 0.2);
        // Over the Crusher itself, clear of its label above.
        popup(pick(WORDS.crush), x, y + 6, { color: 'bone', rise: 6, clamp: RIGHT_COL });
        // When it pays for scrap (the Industrial Crusher, Bulk Pickup x3): the money, to the purse.
        const pay = crushPay(s, e.id);
        if (pay > 0) {
          const mul = s.mods.compactorPayMul;
          popup(mul > 1 ? `+${pay} x${mul}!` : `+${pay}`, x, y - 12, { color: 'yellow', clamp: RIGHT_COL, delay: 0.1, life: 1.2 });
          const n = Math.max(1, Math.min(6, Math.round(pay / 4)));
          for (let i = 0; i < n; i++) coins.push({ x0: x + rand(-6, 6), y0: y, x1: SHINIES.x + 8, y1: SHINIES.y + 8, t: 0, dur: rand(0.45, 0.6), delay: i * 0.05 });
        }
      });
      break;
    }
    case 'deliver': {
      const card = orderSlot(e.slot);
      const x0 = card.x + 74;
      const y0 = card.y + 38;
      if (e.shinies > 0) {
        const n = Math.max(2, Math.min(e.jackpot ? 24 : 10, Math.round(e.shinies / 8)));
        for (let i = 0; i < n; i++) {
          coins.push({ x0: x0 + rand(-6, 6), y0: y0 + rand(-6, 6), x1: SHINIES.x + 8, y1: SHINIES.y + 8, t: 0, dur: rand(0.5, 0.7), delay: i * 0.05 });
        }
        if (coins.length > 40) coins.splice(0, coins.length - 40);
        // The payout pops above the card, clear of the raccoon's line (and right of the truck plate).
        popup(`+${e.shinies}`, card.x + card.w - 16, card.y - (e.complete ? 12 : 6), { color: 'yellow', big: e.complete, clamp: ORDERS_COL });
      } else if (e.gift) {
        popup('GIFT!', x0, card.y - 12, { color: 'toxic3', big: true, clamp: ORDERS_COL });
      }
      if (e.complete) sparks(x0, y0, e.jackpot ? 24 : 8, e.jackpot ? 90 : 60);
      if (e.complete && e.jackpot) {
        addShake(2.5, 0.4);
        popup('JACKPOT!', card.x + card.w - 50, card.y - 26, { color: 'yellow', big: true, clamp: ORDERS_COL, delay: 0.25, life: 1.5, rise: 4 });
      }
      break;
    }
    case 'orderArrive':
      if (e.jackpot) {
        const card = orderSlot(e.slot);
        sparks(card.x + 80, card.y + 30, 16, 80, 0.3);
        popup('JACKPOT!', card.x + card.w - 50, card.y - 12, { color: 'yellow', big: true, clamp: ORDERS_COL, delay: 0.3, life: 1.6, rise: 4 });
      }
      break;
    case 'quotaMet':
      if (s.status === 'playing') {
        startSlam({ text: 'QUOTA MET!', sub: 'Clock Out now, or stay: overtime pays x2 at 6 AM.', life: 1.5, mid: true });
        sparks(SHINIES.x + 50, SHINIES.y + 20, 16, 80);
      }
      break;
    case 'milestone': {
      const h = e.hour;
      popup(`${h % 12 || 12} ${h % 24 < 12 ? 'AM' : 'PM'}! +${e.bonus}`, SHINIES.x + 50, SHINIES.y - 6, { color: 'yellow', big: true, clamp: RIGHT_COL, life: 1.6 });
      for (let i = 0; i < 6; i++) coins.push({ x0: W / 2 + rand(-30, 30), y0: 34, x1: SHINIES.x + 8, y1: SHINIES.y + 8, t: 0, dur: rand(0.6, 0.8), delay: i * 0.06 });
      break;
    }
    case 'orderAngry': {
      const card = orderSlot(e.slot);
      const x = card.x + 28;
      const y = card.y + 14;
      if (e.jackpot) {
        // The jackpot raccoon just shrugs and leaves: no stink, no kick, no fuss.
        popup('oh well.', x, card.y - 2, { color: 'bone', clamp: ORDERS_COL });
        break;
      }
      puffs(x, y, 4, 14);
      debris(x, y, 6, ['red', 'rust2'], 50);
      addShake(1.5, 0.25);
      // Full Moon: they don't grumble, they howl.
      const howl = twistOf(s) === 'moon';
      const word = e.jackpot ? 'oh well.' : howl ? pick(WORDS.howl) : pick(WORDS.angry);
      popup(word, x, card.y - 2, { color: e.jackpot ? 'bone' : howl ? 'yellow' : 'red', big: howl, clamp: ORDERS_COL });
      break;
    }
    case 'ripen': {
      // A piece just went smelly: a puff off it, and now and then a word.
      const m = mid(e.c, e.r);
      puffs(m.x, m.y - 6, 2, 8);
      if (say('ripen', 4)) popup(pick(WORDS.ripe), m.x, m.y - 14, { color: 'grime3', clamp: ON_BOARD });
      break;
    }
    case 'stinkWarn':
      // A small word over the jar (the jar itself shakes, hud.ts), never across the column.
      popup('IT REEKS!', STINK.x + 12, STINK.y - 12, { color: 'toxic2', clamp: OVER_JAR, life: 1.6, rise: 4 });
      puffs(STINK.x + 12, STINK.y, 4, 12);
      addShake(1, 0.2);
      break;
    case 'gullArrive': {
      const m = mid(e.c, e.r);
      popup(pick(['oh no', 'SQUAWK', 'a gull.']), m.x, m.y - 12, { color: 'white', delay: GULLS.arriveSec * 0.8, clamp: ON_BOARD });
      landFrom.set(cellKey(e.c, e.r), 'gull');
      break;
    }
    case 'gullHop': {
      const f = cellFoot(e.c, e.r);
      feathers(f.x, f.y - 10, 1);
      dust(f.x, f.y - 1, 1, 4);
      break;
    }
    case 'gullEat': {
      // It chomps when it gets there: the hop takes a moment, the swoop-in longer.
      const arriving = s.flights.some((fl) => fl.from === 'gull' && fl.c === e.c && fl.r === e.r && fl.t === 0);
      const wait = arriving ? GULLS.arriveSec * 0.9 : 0.22;
      const m = mid(e.c, e.r);
      const colour = itemColour(e.id);
      after(wait, () => {
        debris(m.x, m.y, 10, [colour, colour, 'ink1'], 60);
        feathers(m.x, m.y, 2);
        addShake(1, 0.15);
        if (say('eat', 0.4)) popup(pick(WORDS.eat), m.x, m.y - 12, { color: 'white', clamp: ON_BOARD });
      });
      break;
    }
    case 'gullScream': {
      const m = mid(e.c, e.r);
      feathers(m.x, m.y, 8);
      for (const mv of e.moves ?? []) dust(cellFoot(mv.c, mv.r).x, cellFoot(mv.c, mv.r).y - 1, 1, 6);
      addShake(1.5, 0.3);
      popup(pick(['SKRAAA!', 'SCREEE!', 'AAAAA!']), m.x, m.y - 22, { color: 'white', clamp: ON_BOARD });
      break;
    }
    case 'gullPeck': {
      const m = e.c !== undefined && e.r !== undefined ? mid(e.c, e.r) : { x: BOARD.x + BOARD.w / 2, y: BOARD.y };
      popup(`-${e.shinies}`, m.x, m.y - 14, { color: 'red', clamp: ON_BOARD });
      coins.push({ x0: SHINIES.x + 8, y0: SHINIES.y + 8, x1: m.x, y1: m.y, t: 0, dur: 0.45, delay: 0 });
      feathers(m.x, m.y, 1);
      break;
    }
    case 'gullGod': {
      const f = cellFoot(e.c, e.r);
      gods.push({ x: f.x, y: f.y, t: 0, emitT: 0 });
      if (gods.length > 3) gods.shift();
      pop(f.x, f.y - 14);
      feathers(f.x, f.y - 14, 12);
      sparks(f.x, f.y - 14, 12, 80);
      addShake(3, 0.5);
      popup('HOLY GULL!', f.x, f.y + 12, { color: 'yellow', big: true, delay: 0.1, life: 1.6, rise: 4, clamp: ON_BOARD });
      break;
    }
    case 'hour':
      if (s.status === 'playing') {
        const h = e.hour;
        // Only the latest hour matters: drop any hour still waiting its turn.
        dropBanners((b, i) => b.kind === 'hour' && (i > 0 || b.t === 0));
        banners.push({ kind: 'hour', id: null, title: `${h % 12 || 12} ${h % 24 < 12 ? 'AM' : 'PM'}`, lines: [], t: 0, life: 1.5 });
      }
      break;
    case 'nightWon':
    case 'nightLost':
      dropBanners((b) => b.kind === 'hour' || b.kind === 'new');
      if (s.endReason === 'king') crown = { ...(crownCell ?? { x: BOARD.x + BOARD.w / 2, y: BOARD.y + BOARD.h / 2 }), t: 0 };
      endSlam(s);
      break;
    default:
      break;
  }
}

function dropBanners(f: (b: Banner, i: number) => boolean): void {
  for (let i = banners.length - 1; i >= 0; i--) {
    const b = banners[i];
    if (b && f(b, i)) banners.splice(i, 1);
  }
}

function discovery(id: ItemId): void {
  const d = ITEMS[id];
  banners.push({ kind: 'new', id, title: d.name, lines: wrapText(d.quip, 190).slice(0, 2), t: 0, life: 3.2 });
  if (banners.length > 5) banners.splice(1, 1);
  addShake(1, 0.2);
}

// ------------------------------------------------------------------------------ update

export function updateFx(dt: number, s?: GameState, v?: View): void {
  clock += dt;
  updateShake(dt);
  updatePopups(dt);

  for (let i = later.length - 1; i >= 0; i--) {
    const j = later[i];
    if (!j) continue;
    j.t -= dt;
    if (j.t <= 0) {
      later.splice(i, 1);
      j.run();
    }
  }

  for (const p of pool) {
    if (!p.alive) continue;
    if (p.delay > 0) {
      p.delay -= dt;
      continue;
    }
    p.age += dt;
    if (p.age >= p.life) {
      p.alive = false;
      continue;
    }
    const k = Math.max(0, 1 - p.drag * dt);
    p.vx *= k;
    p.vy = p.vy * k + p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    if (!c) continue;
    if (c.delay > 0) {
      c.delay -= dt;
      continue;
    }
    c.t += dt;
    if (c.t >= c.dur) {
      coins.splice(i, 1);
      emit({ name: 'fx_spark', colour: 'yellow', size: 2, x: c.x1, y: c.y1, life: 0.2 });
    }
  }

  for (let i = gods.length - 1; i >= 0; i--) {
    const g = gods[i];
    if (!g) continue;
    g.t += dt;
    g.emitT -= dt;
    if (g.emitT <= 0 && g.t < GOD_RISE) {
      g.emitT = 0.06;
      const y = godY(g);
      feathers(g.x, y - 10, 1);
      sparks(g.x + rand(-8, 8), y - 6, 1, 40);
    }
    if (g.t > GOD_RISE + 0.3) gods.splice(i, 1);
  }

  for (let i = banners.length - 1; i >= 0; i--) {
    const b = banners[i];
    // Only the front banner runs its clock; the rest wait their turn.
    if (!b || i > 0) continue;
    b.t += dt;
    if (b.t >= b.life) banners.shift();
  }

  if (slam) slam.t += dt;
  if (crown) {
    crown.t += dt;
    // Confetti while the King goes up.
    if (crown.t < CROWN_SEC + 1 && Math.random() < dt * 30) {
      emit({ colour: pick(CONFETTI), size: 2, x: rand(0, W), y: -4, vx: rand(-20, 20), vy: rand(30, 70), grav: 30, drag: 0.6, sway: rand(1, 3), life: rand(1.6, 2.4), byLife: false });
    }
  }
  if (s && v) ambient(s, v, dt);
}

/** Leaky bags drip, toasters spark, smelly junk puffs. */
function ambient(s: GameState, v: View, dt: number): void {
  if (s.status !== 'playing') return;
  const held = s.drag?.uid ?? -1;
  for (const { p, c, r } of s.board.pieces()) {
    if (p.uid === held || inFlight(s, p.uid) || v.slides.has(p.uid)) continue;
    if (Math.random() < dt / 1.6 && isSmelly(s, p)) {
      // A slow green-brown puff drifting up off the top of it.
      const f = cellFoot(c, r);
      emit({ name: 'fx_puff', colour: 'grime2', size: 3, x: f.x + rand(-5, 5), y: f.y - itemHeight(p.id) - 2, vx: rand(-4, 4), vy: -14, drag: 0.6, grav: -4, life: rand(0.9, 1.2) });
    }
    if (p.id === 'bag' && Math.random() < dt / 0.9) {
      const f = cellFoot(c, r);
      emit({ name: 'fx_drip', colour: 'grime2', size: 2, x: f.x + rand(-7, 7), y: f.y - 5, vy: 8, grav: 70, life: 0.45 });
    } else if (p.id === 'toaster' && Math.random() < dt / 2) {
      const f = cellFoot(c, r);
      sparks(f.x + rand(-6, 6), f.y - 22, 2, 45);
    }
  }
}

// ------------------------------------------------------------------------------ draw

function drawParticle(g: CanvasRenderingContext2D, p: Particle): void {
  // Blink out over the last fifth instead of fading.
  if (p.age > p.life * 0.8 && Math.floor(p.age * 30) % 2 === 1) return;
  const x = Math.round(p.x + (p.sway ? Math.sin(p.age * 7 + p.phase * 6) * p.sway : 0));
  const y = Math.round(p.y);
  if (p.name && has(p.name)) {
    // Puffs and pops run their frames once over their life; feathers and drips loop.
    const n = sprite(p.name)?.frames ?? 1;
    const frame = p.byLife ? Math.min(n - 1, Math.floor((p.age / p.life) * n)) : undefined;
    drawSprite(g, p.name, x, y, frame === undefined ? { phase: p.phase } : { frame });
    return;
  }
  const sz = p.name ? Math.max(1, Math.round(p.size * (1 - (p.age / p.life) * 0.5))) : p.size;
  fillRect(g, { x: x - Math.floor(sz / 2), y: y - Math.floor(sz / 2), w: sz, h: sz }, p.colour);
}

function godY(g: God): number {
  const p = Math.min(1, g.t / GOD_RISE);
  return g.y - (g.y + 48) * p * p;
}

function drawGod(g: CanvasRenderingContext2D, god: God): void {
  const p = god.t / GOD_RISE;
  // The beam: wide in the middle of the rise, flickering a pixel either way.
  const w = Math.round(2 + 16 * Math.sin(Math.min(1, p) * Math.PI));
  if (w > 1 && p < 1.2) {
    const jig = Math.floor(god.t * 40) % 2 === 0 ? 0 : 1;
    const top = 0;
    const h = god.y - top;
    const x = Math.round(god.x - w / 2) + jig;
    fillRect(g, { x, y: top, w, h }, 'sodium2');
    if (w > 4) fillRect(g, { x: x + 2, y: top, w: w - 4, h }, 'yellow');
    if (w > 8) fillRect(g, { x: x + 4, y: top, w: w - 8, h }, 'sodium3');
    if (w > 12) fillRect(g, { x: x + 6, y: top, w: w - 12, h }, 'white');
    // A glow pool where it stood.
    fillRect(g, { x: x - 4, y: god.y - 2, w: w + 8, h: 3 }, 'sodium3');
  }
  if (p >= 1) return;
  const y = Math.round(godY(god));
  const x = Math.round(god.x + Math.sin(god.t * 22) * 2);
  // Flapping like mad: it faces one way then the other.
  drawItem(g, 'gullgod', x, y, { flip: Math.floor(god.t * 10) % 2 === 1, phase: 0 });
}

function drawCoin(g: CanvasRenderingContext2D, c: Coin): void {
  if (c.delay > 0) return;
  const k = c.t / c.dur;
  const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
  const cx = (c.x0 + c.x1) / 2;
  const cy = Math.min(c.y0, c.y1) - 50;
  const u = 1 - e;
  const x = Math.round(u * u * c.x0 + 2 * u * e * cx + e * e * c.x1);
  const y = Math.round(u * u * c.y0 + 2 * u * e * cy + e * e * c.y1);
  if (!drawSprite(g, 'icon_shiny', x, y + 7)) {
    fillRect(g, { x: x - 3, y: y - 3, w: 6, h: 6 }, 'ink0');
    fillRect(g, { x: x - 2, y: y - 2, w: 4, h: 4 }, 'yellow');
  }
}

/**
 * Smelly junk (left unmerged too long, src/game/stink.ts `isSmelly`): green-brown fumes rising
 * off the top of it (wavy lines here, puffs from `ambient`) and a fly or two, so you can see what
 * to clear. Flies mean "this stinks" and nothing else (fresh junk, however good, has none). A
 * piece about to turn gets one faint wisp.
 */
function drawSmelly(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  if (s.status !== 'playing' && s.endReason === 'king') return;
  const held = s.drag?.uid ?? -1;
  for (const { p, c, r } of s.board.pieces()) {
    const d = ITEMS[p.id];
    if (d.chain !== 'junk' || p.uid === held || inFlight(s, p.uid) || v.slides.has(p.uid)) continue;
    const f = cellFoot(c, r);
    const top = f.y - itemHeight(p.id);
    if (isSmelly(s, p)) {
      fumes(g, f.x - 4, top - 1, v.t + p.uid * 0.37, 11, true);
      fumes(g, f.x + 5, top, v.t * 1.2 + p.uid * 0.71 + 1.3, 9, true);
      const n = d.tier >= 9 ? 3 : d.tier >= 5 ? 2 : 1;
      // They circle the top of the thing, mostly above it where the dirt shows them up.
      for (let i = 0; i < n; i++) fly(g, f.x, top - 4, v.t * (2.6 + i * 0.9) + p.uid * 1.3 + i * 2.1, 9 + i * 3, 3 + i, p.uid + i);
    } else if (ripeness(s, p) > 0.75 && s.status === 'playing') {
      fumes(g, f.x, top, v.t * 0.8 + p.uid * 0.37, 6, false);
    }
  }
}

/** How tall an item is drawn (its opaque rows, from the foot up), measured once from the sprite. */
const heights = new Map<string, number>();
function itemHeight(id: ItemId): number {
  const hit = heights.get(id);
  if (hit !== undefined) return hit;
  const d = sprite(`item_${id}`);
  const fallback = 8 + ITEMS[id].tier * 2;
  if (!d || typeof document === 'undefined') return fallback;
  const c = document.createElement('canvas');
  c.width = d.w;
  c.height = d.h;
  const cg = c.getContext('2d');
  if (!cg) return fallback;
  cg.drawImage(d.img, d.x, d.y, d.w, d.h, 0, 0, d.w, d.h);
  const px = cg.getImageData(0, 0, d.w, d.h).data;
  let top = d.h;
  for (let y = 0; y < d.h && top === d.h; y++) for (let x = 0; x < d.w; x++) if ((px[(y * d.w + x) * 4 + 3] ?? 0) > 0) top = y;
  const h = Math.max(4, d.ay + 1 - top);
  heights.set(id, h);
  return h;
}

/**
 * One wavy stink line rising from (x, y): 2 px segments that climb and sway, with an ink keyline
 * so they read on the dirt. `strong`: grime3 with toxic tips; else a thin grime2 wisp.
 */
function fumes(g: CanvasRenderingContext2D, x: number, y: number, t: number, h: number, strong: boolean): void {
  const scroll = Math.floor(t * 12);
  for (let i = 0; i < h; i++) {
    // Segments 5 px long with 3 px gaps, scrolling up.
    const k = (i + scroll) % 8;
    if (k >= 5) continue;
    const sway = Math.round(Math.sin((i + t * 9) / 2.6) * (1 + (1.5 * i) / h));
    const px = x + sway;
    const py = y - i;
    if (strong) {
      fillRect(g, { x: px - 1, y: py, w: 4, h: 1 }, 'ink0');
      fillRect(g, { x: px, y: py, w: 2, h: 1 }, k === 4 ? 'toxic2' : k === 0 ? 'grime2' : 'grime3');
    } else if (k % 2 === 0) {
      fillRect(g, { x: px, y: py, w: 1, h: 1 }, 'grime3');
    }
  }
}

function fly(g: CanvasRenderingContext2D, cx: number, cy: number, a: number, rx: number, ry: number, seed: number): void {
  const x = Math.round(cx + Math.cos(a) * rx + Math.sin(a * 5.3 + seed) * 1.5);
  const y = Math.round(cy + Math.sin(a * 1.7) * ry + Math.cos(a * 4.1 + seed) * 1.5);
  if (!drawSprite(g, 'fx_fly', x, y, { phase: seed * 0.13 })) fillRect(g, { x, y, w: 2, h: 1 }, 'ink0');
}

/** The world layer: particles, coins, the God, flies, popups. Drawn inside the screen shake. */
export function drawFx(g: CanvasRenderingContext2D, s?: GameState, v?: View): void {
  if (s && v) {
    drawSmelly(g, s, v);
    // More flies round the jar as the Stink climbs past the warning.
    const over = s.stink - stinkWarnAt(s);
    if (over > 0) {
      const n = 2 + Math.round(over / 5);
      for (let i = 0; i < n; i++) fly(g, STINK.x + 12, STINK.y + 20 + (i % 3) * 18, v.t * (3 + i * 0.37) + i * 1.9, 16 + (i % 4) * 2, 10 + (i % 3) * 3, i);
    }
  }
  for (const god of gods) drawGod(g, god);
  for (const p of pool) if (p.alive && p.delay <= 0) drawParticle(g, p);
  for (const c of coins) drawCoin(g, c);
  drawPopups(g);
}

/**
 * The Stink creeping in from the screen edges (deepest in the corners), dithered, in steps.
 * Draw it under the HUD so the numbers stay readable.
 */
export function drawStinkEdge(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  const warn = stinkWarnAt(s);
  if (s.stink <= warn - 5) return;
  const k = (s.stink - (warn - 5)) / (stinkLimit(s) - (warn - 5));
  // It breathes a step in and out as well as growing.
  const level = Math.max(1, Math.min(LEVELS, Math.round(k * (LEVELS - 1)) + 1 + (Math.sin(v.t * 2.3) > 0.6 ? 1 : 0)));
  const img = vignette(level);
  if (img) g.drawImage(img, 0, 0);
}

const LEVELS = 7;
const vignettes = new Map<number, HTMLCanvasElement | null>();
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function vignette(level: number): HTMLCanvasElement | null {
  const hit = vignettes.get(level);
  if (hit !== undefined) return hit;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) {
    vignettes.set(level, null);
    return null;
  }
  const img = g.createImageData(W, H);
  const band = 8 + level * 7;
  const hex = (n: PalName): [number, number, number] => {
    const v = parseInt(PAL[n].slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };
  const dark = hex('grime1');
  const mid = hex('toxic0');
  const speck = hex('toxic1');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = Math.min(x, W - 1 - x) + 1;
      // Thinner along the top and bottom, where the HUD text lives.
      const dy = Math.min(y, H - 1 - y) * 2.2 + 1;
      // A harmonic mean of the two edge distances: thin along the edges, deep in the corners.
      const d = (2 * dx * dy) / (dx + dy);
      const dens = (1 - d / band) * 0.9;
      if (dens <= 0) continue;
      const th = ((BAYER[(y % 4) * 4 + (x % 4)] ?? 0) + 0.5) / 16;
      if (dens <= th) continue;
      const i = (y * W + x) * 4;
      const col = (x * 7 + y * 13) % 53 === 0 ? speck : dens > 0.55 ? dark : mid;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  vignettes.set(level, c);
  return c;
}

/** The screen layer, outside the shake: banners, the King's crowning and the slams. */
export function drawFxTop(g: CanvasRenderingContext2D): void {
  const b = banners[0];
  if (b) drawBanner(g, b);
  if (crown) drawCrown(g, crown);
  if (slam) drawSlam(g, slam);
}

const CONFETTI: readonly PalName[] = ['sodium3', 'yellow', 'toxic2', 'pink', 'blue', 'bone', 'rust3', 'red'];
const CHEERS = ['YAY!', 'WOO!', 'HAIL!', 'YES!'] as const;

/**
 * The King is made: the board freezes (the night is already won), the screen dims, a sodium beam
 * comes down, the King rises into it from where he was built, the regulars pop up cheering, and
 * confetti falls. Then the "ALL HAIL!" slam (it waits CROWN_SEC).
 */
function drawCrown(g: CanvasRenderingContext2D, c: { x: number; y: number; t: number }): void {
  const t = c.t;
  const a = g.globalAlpha;
  g.globalAlpha = Math.min(0.62, t * 2);
  g.fillStyle = PAL.ink0;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = a;

  // The King rises from his cell to the middle of the beam.
  const rise = Math.min(1, t / 0.9);
  const e = 1 - (1 - rise) * (1 - rise);
  const fx = Math.round(c.x + (W / 2 - c.x) * e);
  const fy = Math.round(c.y + (196 - c.y) * e - Math.sin(rise * Math.PI) * 30);
  const bob = rise >= 1 ? Math.round(Math.sin(t * 3) * 2) : 0;

  // The beam, widening in, flickering a pixel.
  const bw = Math.round(Math.min(1, t / 0.35) * 70);
  if (bw > 2) {
    const jig = Math.floor(t * 30) % 2;
    const x = Math.round(W / 2 - bw / 2) + jig;
    const h = 204;
    const layer = (inset: number, col: PalName): void => {
      if (bw - inset * 2 > 0) fillRect(g, { x: x + inset, y: 0, w: bw - inset * 2, h }, col);
    };
    layer(0, 'sodium1');
    layer(5, 'sodium2');
    layer(12, 'yellow');
    layer(20, 'sodium3');
    layer(28, 'white');
    // A glow pool on the floor of it.
    fillRect(g, { x: x - 10, y: h - 3, w: bw + 20, h: 5 }, 'sodium3');
    fillRect(g, { x: x - 4, y: h - 1, w: bw + 8, h: 2 }, 'white');
  }

  // The King himself: the 96 px portrait, or the 28 px item at 3x until it's drawn.
  if (!drawSprite(g, 'king_portrait', fx, fy + bob, { frame: Math.floor(t * 2) % 2 })) drawItemBig(g, 'king', fx, fy + bob, 3, t);

  // The regulars leave the counter (orders.ts empties it) and line up in front of the board,
  // either side of the beam, cheering: clear of the HUD and the order column.
  if (t > 0.6) {
    const up = Math.min(1, (t - 0.6) / 0.25);
    const spots = [206, 258, 382, 434];
    RACCOONS.forEach((r, i) => {
      const x = spots[i] ?? 0;
      const hop = Math.round(Math.abs(Math.sin(t * 7 + i * 1.3)) * -7);
      const y = Math.round(266 + (1 - up) * 70) + hop;
      const flip = i >= 2;
      if (!drawSprite(g, `raccoon_${r.id}_happy`, x, y, { flip }) && !drawSprite(g, `raccoon_${r.id}_idle`, x, y, { flip })) {
        placeholderRaccoon(g, r.id, 'happy', false, x, y);
      }
      if (Math.floor(t * 3 + i) % 3 === 0) {
        const img = textCanvas(CHEERS[i] ?? 'YAY!', 'yellow');
        g.drawImage(img, Math.round(x - img.width / 2), y - 58);
      }
    });
  }
}

function bannerY(b: Banner, h: number, rest: number): number {
  const inT = 0.22;
  const outT = 0.2;
  if (b.t < inT) {
    const p = b.t / inT;
    // Drops in and overshoots a couple of pixels.
    return Math.round(-h + (rest + h) * (1 - (1 - p) * (1 - p)) + Math.sin(p * Math.PI) * 3);
  }
  const left = b.life - b.t;
  if (left < outT) return Math.round(rest - (rest + h + 2) * (1 - left / outT));
  return rest;
}

function drawBanner(g: CanvasRenderingContext2D, b: Banner): void {
  if (b.kind === 'hour') {
    const img = textCanvas(b.title, 'ink0', null);
    const w = img.width * 2 + 14;
    const h = img.height * 2 + 6;
    const r = { x: Math.round(W / 2 - w / 2), y: bannerY(b, h, 20), w, h };
    if (!drawNine(g, 'paper', r)) paper(g, r);
    g.drawImage(img, 0, 0, img.width, img.height, r.x + 7, r.y + 3, img.width * 2, img.height * 2);
    return;
  }
  const head = 'NEW!';
  const tw = Math.max(textWidth(head) + 4 + textWidth(b.title), ...b.lines.map((l) => textWidth(l)));
  const w = Math.min(300, tw + 52);
  const h = 14 + Math.max(24, b.lines.length * 11 + 12);
  const r = { x: Math.round(W / 2 - w / 2), y: bannerY(b, h + 6, 16), w, h };
  if (!drawNine(g, 'speech', r) && !drawNine(g, 'paper', r)) paper(g, r);
  drawSprite(g, 'speech_tail', r.x + 18 + 4, r.y + r.h - 2 + 1);
  if (b.id) {
    // The new thing itself, hopping.
    const hop = Math.abs(Math.sin(b.t * 9)) * (b.t < 1.2 ? 3 : 0);
    drawItem(g, b.id, r.x + 24, Math.round(r.y + h - 3 - hop), { phase: 0 });
  }
  const tx = r.x + 44;
  drawText(g, head, tx, r.y + 4, { color: 'red' });
  drawText(g, b.title, tx + textWidth(head) + 4, r.y + 4, { color: 'ink0' });
  b.lines.forEach((line, i) => drawText(g, line, tx, r.y + 16 + i * 11, { color: 'ink1' }));
}

function drawSlam(g: CanvasRenderingContext2D, sl: Slam): void {
  const t = sl.t;
  if (t < 0) return;
  // The end slam blinks off as the report comes up; the mid-night one goes and the night goes on.
  if (t > sl.life + 0.25) {
    if (sl.mid) slam = null;
    return;
  }
  const land = 0.14;
  // Comes down huge, lands at 3x with a thump.
  const scale = t < land ? 6 - Math.floor((t / land) * 3) : 3;
  const cy = sl.y;
  if (t >= land && !slamLanded) {
    slamLanded = true;
    addShake(sl.mid ? 3 : 5, sl.mid ? 0.3 : 0.5);
    dust(W / 2 - 100, cy + 18, 10, 60);
    dust(W / 2 + 100, cy + 18, 10, 60);
  }
  if (t > sl.life - 0.1 && Math.floor(t * 24) % 2 === 1) return;
  const img = textCanvas(sl.text, sl.colour);
  const w = img.width * scale;
  const h = img.height * scale;
  const sub = sl.sub && t >= land ? textCanvas(sl.sub, 'bone') : null;
  if (t >= land) {
    const band = { x: 0, y: Math.round(cy - h / 2 - 8), w: W, h: h + 16 + (sub ? 10 : 0) };
    fillRect(g, band, 'ink0');
    fillRect(g, { x: 0, y: band.y + 2, w: W, h: 2 }, sl.band);
    fillRect(g, { x: 0, y: band.y + band.h - 4, w: W, h: 2 }, sl.band);
    if (sub) g.drawImage(sub, Math.round(W / 2 - sub.width / 2), Math.round(cy + h / 2 - 2));
  }
  g.drawImage(img, 0, 0, img.width, img.height, Math.round(W / 2 - w / 2), Math.round(cy - h / 2), w, h);
}

/** Screen shake offset in whole pixels. */
export function shake(): { x: number; y: number } {
  return shakeOffset();
}

export function resetFx(): void {
  for (const p of pool) p.alive = false;
  coins.length = 0;
  gods.length = 0;
  banners.length = 0;
  later.length = 0;
  landFrom.clear();
  lastWord.clear();
  slam = null;
  slamLanded = false;
  crown = null;
  crownCell = null;
  resetPopups();
  resetShake();
}
