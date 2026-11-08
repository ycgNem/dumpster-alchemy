// The board: dirt cells, the pieces (idle wobble, a squash when they land), drop highlights
// while dragging, junk arcing in from the truck and the Dumpster, and the piece in your hand.
import { ITEMS, type ItemId } from '../data/items';
import { PAL, type PalName } from '../data/palette';
import { TUNING } from '../data/tuning';
import { viewRect } from '../engine/screen';
import { dropKind, type DropKind, type Target } from '../game/actions';
import { mergeResult } from '../game/board';
import { eggResult } from '../game/gulls';
import { cascadePartner, pendingCascades } from '../game/combo';
import { inFlight, type Flight, type GameState } from '../game/state';
import { fillRect, outlineRect, placeholderCell, placeholderItem } from './greybox';
import { BOARD, CELL, DUMPSTER_MOUTH, cellRect, orderSlot, type Rect } from './layout';
import { truckBed } from './props';
import { drawNine, drawSprite, sprite } from './sprites';
import { drawItemBig } from './menus';
import { liftPx, slideAt, type Decal, type View } from './view';

const F = TUNING.feel;

export interface ItemDraw {
  sx?: number;
  sy?: number;
  phase?: number;
  alpha?: number;
  /** Mirror it (gulls glance left and right; never rotated). */
  flip?: boolean;
}

/** Draw an item with its foot (bottom centre of its 32 x 32 cell) at (fx, fy). */
export function drawItem(g: CanvasRenderingContext2D, id: ItemId, fx: number, fy: number, o: ItemDraw = {}): void {
  const opts = { sx: o.sx ?? 1, sy: o.sy ?? 1, phase: o.phase ?? 0, alpha: o.alpha ?? 1, flip: o.flip ?? false };
  if (drawSprite(g, `item_${id}`, fx, fy, opts)) return;
  const a = g.globalAlpha;
  g.globalAlpha = a * opts.alpha;
  placeholderItem(g, id, fx, fy, opts.sx, opts.sy);
  g.globalAlpha = a;
}

/** The foot point of a cell: where an item's anchor sits. */
export function cellFoot(c: number, r: number): { x: number; y: number } {
  return { x: BOARD.x + c * CELL + CELL / 2, y: BOARD.y + r * CELL + CELL - 1 };
}

/**
 * Squash and stretch in whole pixels (a 32 px sprite drawn 2-4 px wider and shorter, then
 * taller), so the pixels stay chunky: never a smooth scale, never a rotation.
 */
function squashOf(v: View, uid: number): [number, number] {
  const sq = v.squash.get(uid);
  if (!sq) return [1, 1];
  const dur = F.squashSec * (sq.px >= 3 ? 1.5 : 1);
  const p = (v.t - sq.t) / dur;
  if (p < 0 || p >= 1) return [1, 1];
  const a = Math.round(Math.sin(p * Math.PI * 2) * (1 - p) * sq.px * 1.6);
  return [(CELL + a) / CELL, (CELL - a) / CELL];
}

/** Gulls look around: each one faces left or right for a few seconds at a time. */
function facing(v: View, id: ItemId, uid: number): boolean {
  return ITEMS[id].chain === 'gull' && Math.sin(v.t * 0.7 + uid * 2.3) > 0;
}

function wobble(v: View, uid: number): number {
  return Math.sin(v.t * 2.4 + uid * 1.7) > 0.35 ? -F.wobblePx : 0;
}

/** A cell overlay: the hand-drawn one if it exists, else an outline in a matching colour. */
function overlay(g: CanvasRenderingContext2D, name: string, r: Rect, fallback: keyof typeof PAL, alpha = 1): void {
  const a = g.globalAlpha;
  g.globalAlpha = a * alpha;
  if (!drawSprite(g, name, r.x + CELL / 2, r.y + CELL - 1)) {
    outlineRect(g, r, fallback);
    outlineRect(g, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, fallback);
  }
  g.globalAlpha = a;
}

export function drawBoard(g: CanvasRenderingContext2D, s: GameState, v: View, hover: Target): void {
  // The frame, if it's been drawn: its borders sit just outside the cells.
  const frame = sprite('board_frame');
  if (frame?.slice) {
    const [l, t, r, b] = frame.slice;
    drawNine(g, 'board_frame', { x: BOARD.x - l, y: BOARD.y - t, w: BOARD.w + l + r, h: BOARD.h + t + b });
  } else {
    fillRect(g, { x: BOARD.x - 3, y: BOARD.y - 3, w: BOARD.w + 6, h: BOARD.h + 6 }, 'ink0');
    outlineRect(g, { x: BOARD.x - 2, y: BOARD.y - 2, w: BOARD.w + 4, h: BOARD.h + 4 }, 'dirt0');
  }

  for (let r = 0; r < s.board.rows; r++) {
    for (let c = 0; c < s.board.cols; c++) {
      const rect = cellRect(c, r);
      const odd = (c + r) % 2 === 1;
      const foot = cellFoot(c, r);
      if (!drawSprite(g, odd ? 'cell_b' : 'cell_a', foot.x, foot.y)) placeholderCell(g, rect, odd);
    }
  }

  // Tonight's splats soak into the dirt, under everything else.
  drawDecals(g, v);

  drawHighlights(g, s, v, hover);

  // Shadows where flying junk is about to land, so you can see it coming, and a little arrow on
  // the cell: it's taken, nothing can be dropped there until it lands.
  for (const f of s.flights) {
    const p = Math.min(1, f.t / f.dur);
    const foot = cellFoot(f.c, f.r);
    const a = g.globalAlpha;
    g.globalAlpha = 0.3 + 0.4 * p;
    fillRect(g, { x: foot.x - 9 - Math.round(p * 3), y: foot.y - 4, w: 18 + Math.round(p * 6), h: 3 }, 'ink0');
    fillRect(g, { x: foot.x - 6 - Math.round(p * 2), y: foot.y - 5, w: 12 + Math.round(p * 4), h: 5 }, 'ink0');
    g.globalAlpha = a;
    if (f.from !== 'gull' && f.from !== 'egg' && p < 0.8) inboundArrow(g, f.c, f.r, v.t);
  }

  // Junk a gull has eaten but not reached yet (under the gull, which lands on top of it).
  v.ghosts = v.ghosts.filter((gh) => gh.until > v.t);
  for (const gh of v.ghosts) {
    const foot = cellFoot(gh.c, gh.r);
    drawItem(g, gh.id, foot.x, foot.y);
  }

  const held = s.drag?.uid ?? -1;
  const lean = cascadeLean(s, v);
  for (const { p, c, r } of s.board.pieces()) {
    if (inFlight(s, p.uid)) continue;
    const foot = cellFoot(c, r);
    if (p.uid === held) {
      // Where it will snap back to.
      drawItem(g, p.id, foot.x, foot.y, { alpha: 0.3 });
      continue;
    }
    if (revealing(v, p.uid)) {
      // Up above the paw (drawReveals): just its shadow down here.
      shadow(g, foot.x, foot.y, 0.4);
      continue;
    }
    const slide = slideAt(v, p.uid, foot);
    if (slide) {
      drawItem(g, p.id, slide.x, slide.y, { phase: p.uid * 0.37, flip: slide.x > foot.x });
      continue;
    }
    const [sx, sy] = squashOf(v, p.uid);
    const ln = lean.get(p.uid);
    drawItem(g, p.id, foot.x + (ln?.x ?? 0), foot.y + wobble(v, p.uid) + (ln?.y ?? 0), { sx, sy, phase: p.uid * 0.37, flip: facing(v, p.id, p.uid) });
  }
  // Cascade partners sliding over into the cell they just merged into.
  for (const sl of v.cascadeSlides) {
    const k = (v.t - sl.t) / CASCADE_SLIDE_SEC;
    if (k < 0 || k >= 1) continue;
    const e = k * k;
    drawItem(g, sl.id, Math.round(sl.from.x + (sl.to.x - sl.from.x) * e), Math.round(sl.from.y + (sl.to.y - sl.from.y) * e), { sx: 1.0625, sy: 0.9375 });
  }
}

// ------------------------------------------------------------------------------ momentum

/** Seconds a cascade partner takes to slide into its twin's cell. */
const CASCADE_SLIDE_SEC = 0.09;

/**
 * During a cascade's beat (src/game/combo.ts) the twins tug toward each other and jitter, so you
 * see what's about to happen: the partner leans up to 4 px in, the new piece 2 px.
 */
function cascadeLean(s: GameState, v: View): Map<number, { x: number; y: number }> {
  const out = new Map<number, { x: number; y: number }>();
  for (const q of pendingCascades(s)) {
    const twin = cascadePartner(s, q.c, q.r);
    const p = s.board.get(q.c, q.r);
    const t = twin ? s.board.get(twin.c, twin.r) : null;
    if (!twin || !p || !t) continue;
    const k = Math.max(0, Math.min(1, 1 - q.t / TUNING.combo.cascadeSec));
    const dx = Math.sign(q.c - twin.c);
    const dy = Math.sign(q.r - twin.r);
    const jig = Math.floor(v.t * 40) % 2;
    out.set(t.uid, { x: dx * Math.round(1 + k * 3), y: dy * Math.round(1 + k * 3) - jig });
    out.set(p.uid, { x: -dx * Math.round(k * 2), y: -dy * Math.round(k * 2) - (1 - jig) });
  }
  return out;
}

/** A soft ink shadow on the dirt under (x, y). */
function shadow(g: CanvasRenderingContext2D, x: number, y: number, alpha: number): void {
  const a = g.globalAlpha;
  g.globalAlpha = a * alpha;
  fillRect(g, { x: x - 10, y: y - 4, w: 20, h: 3 }, 'ink0');
  fillRect(g, { x: x - 7, y: y - 5, w: 14, h: 5 }, 'ink0');
  g.globalAlpha = a;
}

/** Seconds a reveal takes to pop up, and to come back down into its cell. */
const REVEAL_UP = 0.07;
const REVEAL_DOWN = 0.12;
/** How high the 2x result floats above its cell's foot (clear of the paw's hotspot). */
const REVEAL_LIFT = 22;

function revealing(v: View, uid: number): boolean {
  const rv = v.reveals.get(uid);
  return rv !== undefined && v.t - rv.t < REVEAL_UP + rv.hold + REVEAL_DOWN;
}

/**
 * Fresh merge, cascade and brew results: each pops up 2x above its cell (above the paw, so it's
 * never hidden under the cursor at its own reveal), hangs there a beat, then drops back into its
 * cell with a squash. Drawn over the board, the flights and the particles.
 */
export function drawReveals(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  const held = s.drag?.uid ?? -1;
  for (const { p, c, r } of s.board.pieces()) {
    const rv = v.reveals.get(p.uid);
    if (!rv) continue;
    if (p.uid === held || inFlight(s, p.uid)) {
      v.reveals.delete(p.uid);
      continue;
    }
    const e = v.t - rv.t;
    const end = REVEAL_UP + rv.hold + REVEAL_DOWN;
    const foot = cellFoot(c, r);
    if (e >= end) {
      // Back in its cell: a good hard squash on the landing.
      v.reveals.delete(p.uid);
      v.squash.set(p.uid, { t: v.t, px: 3 });
      continue;
    }
    let lift: number;
    let big: boolean;
    if (e < REVEAL_UP) {
      const k = e / REVEAL_UP;
      lift = REVEAL_LIFT * (1 - (1 - k) * (1 - k));
      big = k > 0.5;
    } else if (e < REVEAL_UP + rv.hold) {
      // A little bob while it shows off.
      lift = REVEAL_LIFT + Math.round(Math.sin((e - REVEAL_UP) * 18) * 1.5);
      big = true;
    } else {
      const k = (e - REVEAL_UP - rv.hold) / REVEAL_DOWN;
      lift = REVEAL_LIFT * (1 - k * k);
      big = k < 0.45;
    }
    const y = Math.round(foot.y - lift);
    if (big) {
      // A burst of rays behind it while it's up there.
      const d = ITEMS[p.id];
      if (e >= REVEAL_UP && e < REVEAL_UP + rv.hold) rays(g, foot.x, y - 30, e, d.tier >= 6 || (d.chain as string) === 'brew');
      drawItemBig(g, p.id, foot.x, y, 2, p.uid * 0.37);
    } else drawItem(g, p.id, foot.x, y, { phase: p.uid * 0.37 });
  }
}

/** Short rays flicking round a revealed piece (more, and gold, for the good stuff). */
function rays(g: CanvasRenderingContext2D, x: number, y: number, t: number, gold: boolean): void {
  const n = gold ? 8 : 4;
  const spin = Math.floor(t * 12) % 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (spin ? Math.PI / n : 0);
    const r0 = 30;
    const r1 = gold ? 40 : 36;
    for (let d = r0; d < r1; d += 2) {
      fillRect(g, { x: Math.round(x + Math.cos(a) * d), y: Math.round(y + Math.sin(a) * d * 0.8), w: 2, h: 2 }, gold ? (d % 4 === 0 ? 'yellow' : 'sodium3') : 'bone');
    }
  }
}

// ------------------------------------------------------------------------------ splats

/** Stain colours by what made it: [core, rim, specks]. */
const STAIN: Record<string, readonly [PalName, PalName, PalName]> = {
  bag: ['grime1', 'grime0', 'toxic1'],
  boot: ['dirt0', 'ink2', 'dirt2'],
  toaster: ['ink1', 'rust0', 'sodium1'],
  tire: ['ink1', 'ink0', 'dirt0'],
  cart: ['rust1', 'rust0', 'steel1'],
  mattress: ['sodium0', 'card0', 'sodium1'],
  fridge: ['toxic0', 'grime0', 'blue'],
  car: ['ink0', 'ink1', 'blue'],
  king: ['sodium0', 'rust0', 'yellow'],
  gullgang: ['bone', 'fur3', 'grime3'],
  gullboss: ['white', 'bone', 'grime3'],
  gullgod: ['white', 'bone', 'yellow'],
  crater: ['dirt0', 'ink1', 'dirt2'],
  bomb: ['grime1', 'grime0', 'toxic2'],
  scorch: ['ink0', 'ink1', 'rust2'],
  brew: ['toxic0', 'grime0', 'toxic2'],
};
const STAIN_DEFAULT: readonly [PalName, PalName, PalName] = ['grime1', 'dirt0', 'grime2'];

const decalCache = new WeakMap<Decal, HTMLCanvasElement | null>();

/** A seeded random in [0, 1) for a decal's shape (the same splat every frame). */
function seeded(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = Math.imul(x ^ (x >>> 15), x | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Draws a splat once: a few overlapping blobs, a dithered rim, droplets, a wet glint. */
function decalCanvas(d: Decal): HTMLCanvasElement | null {
  const hit = decalCache.get(d);
  if (hit !== undefined) return hit;
  if (typeof document === 'undefined') return null;
  const pad = 6;
  const c = document.createElement('canvas');
  c.width = d.w + pad * 2;
  c.height = d.h + pad * 2;
  const g = c.getContext('2d');
  if (!g) {
    decalCache.set(d, null);
    return null;
  }
  const rnd = seeded(d.seed);
  const [core, rim, speck] = STAIN[d.kind] ?? STAIN_DEFAULT;
  const cx = c.width / 2;
  const cy = c.height / 2;
  const blobs = Array.from({ length: 3 + Math.floor(rnd() * 3) }, (_, i) => ({
    x: i === 0 ? 0 : (rnd() - 0.5) * d.w * 0.55,
    y: i === 0 ? 0 : (rnd() - 0.5) * d.h * 0.45,
    rx: d.w * (i === 0 ? 0.42 : 0.18 + rnd() * 0.2),
    ry: d.h * (i === 0 ? 0.42 : 0.22 + rnd() * 0.2),
  }));
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      let v = -1;
      for (const b of blobs) {
        const dx = (x + 0.5 - cx - b.x) / b.rx;
        const dy = (y + 0.5 - cy - b.y) / b.ry;
        v = Math.max(v, 1 - dx * dx - dy * dy);
      }
      if (v <= -0.35) continue;
      const th = ((BAYER4[(y % 4) * 4 + (x % 4)] ?? 0) + 0.5) / 16;
      let col: PalName | null = null;
      if (v > 0.18) col = core;
      else if (v > 0) col = rim;
      else if (-v / 0.35 < th * 0.6) col = rim;
      if (col) fillRect(g, { x, y, w: 1, h: 1 }, col);
    }
  }
  // Droplets flung round it, and a wet glint on top.
  const drops = 3 + Math.floor(rnd() * 5);
  for (let i = 0; i < drops; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.55 + rnd() * 0.45;
    const x = Math.round(cx + Math.cos(a) * (d.w / 2 + 2) * r);
    const y = Math.round(cy + Math.sin(a) * (d.h / 2 + 2) * r);
    fillRect(g, { x, y, w: rnd() < 0.4 ? 2 : 1, h: 1 }, rnd() < 0.5 ? speck : core);
  }
  if (core !== 'white' && core !== 'bone') {
    fillRect(g, { x: Math.round(cx - d.w * 0.18), y: Math.round(cy - d.h * 0.2), w: 2, h: 1 }, speck);
    fillRect(g, { x: Math.round(cx - d.w * 0.18) + 3, y: Math.round(cy - d.h * 0.2), w: 1, h: 1 }, 'bone');
  }
  decalCache.set(d, c);
  return c;
}

/** Tonight's splats, clipped to the board. */
function drawDecals(g: CanvasRenderingContext2D, v: View): void {
  if (v.decals.length === 0) return;
  g.save();
  g.beginPath();
  g.rect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);
  g.clip();
  for (const d of v.decals) {
    const img = decalCanvas(d);
    if (img) g.drawImage(img, Math.round(d.x - img.width / 2), Math.round(d.y - img.height / 2));
  }
  g.restore();
}

function drawHighlights(g: CanvasRenderingContext2D, s: GameState, v: View, hover: Target): void {
  const d = s.drag;
  const pulse = 0.55 + 0.45 * Math.sin(v.t * 8);
  if (!d) {
    if (hover.kind === 'cell' && s.status === 'playing') {
      const p = s.board.get(hover.c, hover.r);
      if (p && !inFlight(s, p.uid)) overlay(g, 'cell_hover', cellRect(hover.c, hover.r), 'sodium3', 0.8);
    }
    return;
  }
  const held = s.board.get(d.c, d.r);
  if (!held) return;
  // Every piece it would merge with.
  for (const { p, c, r } of s.board.pieces()) {
    if (p.uid === held.uid || inFlight(s, p.uid)) continue;
    const egg = held.id === 'golden_egg' && eggResult(p.id);
    if (mergeResult(held.id, p.id) || egg) overlay(g, 'cell_target', cellRect(c, r), 'toxic2', 0.35 + 0.35 * pulse);
  }
  if (hover.kind !== 'cell') return;
  const kind = dropKind(s, d.c, d.r, hover);
  const rect = cellRect(hover.c, hover.r);
  if (kind === 'merge' || kind === 'egg') overlay(g, 'cell_target', rect, 'toxic3');
  else if (kind === 'bad') overlay(g, 'cell_bad', rect, 'red');
  else if (kind !== 'home') overlay(g, 'cell_hover', rect, 'sodium3');
}

/** Where a flight starts, on screen. */
function flightStart(f: Flight): { x: number; y: number } {
  // (Garbage Day's second truck tips from its own bed: `slot` 1.)
  if (f.from === 'truck') return truckBed(f.slot);
  // Gulls come in off the sky, from whichever side is nearer.
  // (From past the visible edge, margins and all: src/engine/screen.ts.)
  const v = viewRect();
  if (f.from === 'gull') return { x: f.c < 4 ? Math.min(-24, v.x - 16) : Math.max(664, v.x + v.w + 16), y: 14 + (f.uid % 3) * 10 };
  if (f.from === 'egg') return { x: cellFoot(f.c, f.r).x, y: Math.min(-24, v.y - 16) };
  return { x: DUMPSTER_MOUTH.x, y: DUMPSTER_MOUTH.y + 16 };
}

/** The Golden Egg waits in the sky while the Gull God ascends, then drops for this last part. */
export const EGG_FALL = 0.4;

/** Junk in the air, drawn over everything on the board. */
export function drawFlights(g: CanvasRenderingContext2D, s: GameState): void {
  for (const f of s.flights) {
    const p = s.board.get(f.c, f.r);
    if (!p || p.uid !== f.uid) continue;
    const k = Math.min(1, f.t / f.dur);
    const a = flightStart(f);
    const b = cellFoot(f.c, f.r);
    if (f.from === 'gull') {
      // A swoop: dives early, glides in flat, decelerating.
      const e = 1 - (1 - k) * (1 - k);
      const x = a.x + (b.x - a.x) * e;
      const y = a.y + (b.y - a.y) * e + Math.sin(e * Math.PI) * 26;
      drawItem(g, p.id, Math.round(x), Math.round(y), { phase: p.uid * 0.37, flip: b.x < a.x });
      continue;
    }
    if (f.from === 'egg') {
      const q = (k - (1 - EGG_FALL)) / EGG_FALL;
      if (q < 0) continue;
      drawItem(g, p.id, b.x, Math.round(b.y - (b.y - a.y) * (1 - q * q)), { sx: 0.875, sy: 1.125 });
      continue;
    }
    const arc = f.from === 'truck' ? F.arcPxTruck : f.from === 'kick' ? F.arcPxKick : F.arcPxDumpster;
    const x = a.x + (b.x - a.x) * k;
    const y = a.y + (b.y - a.y) * k - Math.sin(k * Math.PI) * arc;
    // A slight stretch along the fall, more at the start.
    const st = 1 + 0.12 * (1 - k);
    drawItem(g, p.id, x, y, { sx: 2 - st, sy: st, phase: p.uid * 0.37 });
  }
}

/**
 * The piece in your hand, drawn over the paw (play.ts draws the paw first): lifted clear of the
 * pointer, with a drop shadow on the cell it would land in. Offered to a raccoon, it moves to the
 * card's right edge so it never sits on the "wanted" icon.
 */
export function drawHeld(g: CanvasRenderingContext2D, s: GameState, v: View, kind: DropKind, aim: Target): void {
  const d = s.drag;
  if (!d) return;
  const p = s.board.get(d.c, d.r);
  if (!p) return;
  const lift = liftPx(v);
  // Where its foot wants to be, relative to the pointer.
  let ox = 0;
  let oy = 15 - lift;
  if (aim.kind === 'order') {
    const card = orderSlot(aim.slot);
    ox = card.x + card.w + 18 - d.x;
    oy = Math.max(card.y + 31, Math.min(card.y + card.h - 1, d.y + oy)) - d.y;
  }
  // Ease the offset (not the position), so it tracks the pointer exactly but slides on a jump.
  const ho = v.heldOff;
  if (!ho || ho.uid !== p.uid) v.heldOff = { uid: p.uid, x: ox, y: oy };
  else {
    ho.x += (ox - ho.x) * 0.45;
    ho.y += (oy - ho.y) * 0.45;
    if (Math.abs(ox - ho.x) < 0.5) ho.x = ox;
    if (Math.abs(oy - ho.y) < 0.5) ho.y = oy;
  }
  const off = v.heldOff ?? { x: ox, y: oy };
  const x = Math.round(d.x + off.x);
  const y = Math.round(d.y + off.y);

  // The shadow: on the cell it would land in, else under the piece.
  const a = g.globalAlpha;
  g.globalAlpha = kind === 'bad' ? 0.25 : 0.45;
  if (aim.kind === 'cell') {
    const f = cellFoot(aim.c, aim.r);
    fillRect(g, { x: f.x - 10, y: f.y - 5, w: 20, h: 3 }, 'ink0');
    fillRect(g, { x: f.x - 7, y: f.y - 6, w: 14, h: 5 }, 'ink0');
  } else if (aim.kind !== 'order') {
    fillRect(g, { x: x - 9, y: y + 4, w: 18, h: 3 }, 'ink0');
  }
  g.globalAlpha = a;
  drawItem(g, p.id, x, y, { phase: p.uid * 0.37, alpha: kind === 'bad' ? 0.75 : 1 });
}

/** A little bouncing down-arrow over a cell with junk on its way in (it can't take a drop yet). */
function inboundArrow(g: CanvasRenderingContext2D, c: number, r: number, t: number): void {
  const f = cellFoot(c, r);
  const bob = Math.floor(t * 6) % 2;
  const x = f.x - 3;
  const y = f.y - 20 + bob;
  const rows: [number, number][] = [[0, 7], [1, 5], [2, 3], [3, 1]];
  for (const [dy, w] of rows) fillRect(g, { x: x + (7 - w) / 2 - 1, y: y + dy - 1, w: w + 2, h: 3 }, 'ink0');
  fillRect(g, { x: x + 2, y: y - 4, w: 3, h: 4 }, 'ink0');
  fillRect(g, { x: x + 3, y: y - 3, w: 1, h: 3 }, 'sodium3');
  for (const [dy, w] of rows) fillRect(g, { x: x + (7 - w) / 2, y: y + dy, w, h: 1 }, 'sodium3');
}
