// Alchemy on screen (docs/V2.md "Alchemy"): what a drop would brew while you hover (a bubbling "?"
// for a recipe you've never made, the result and "BREW" for one you have), what a tool would hit
// (the 3x3, the row, the lot, the pieces), "TREASURE!" on an order card, the first-time reveal
// (a short freeze, the result popping up above the paw, "NEW RECIPE!"), each tool's burst, the
// riddle a raccoon shares, Grandma Mange's first tip, and the greybox flasks and crates the brews
// are drawn as until the `recipes` atlas lands.
//
// Reads the state and the events, never changes the game. play.ts calls: alchemyEvent per event,
// drawAlchemy over the lot (under the held piece), drawAlchemyTop last, alchemyFrozen first.
// Pixel rules: whole pixels, no rotation, things blink out instead of fading.
import { ITEMS, type ItemId } from '../data/items';
import type { PalName } from '../data/palette';
import { ALCHEMY, recipeOf, isTool, isTreasure, type ToolAim } from '../data/recipes';
import type { DropKind, Target } from '../game/actions';
import { brewResult, knownRecipe, toolPlan, treasureValue, type ToolPlan } from '../game/alchemy';
import type { GameEvent } from '../game/events';
import { raccoonDef } from '../game/orders';
import { inFlight, type GameState } from '../game/state';
import { cellFoot, drawItem } from './board';
import { fillRect, outlineRect, placeholderRaccoon } from './greybox';
import { BOARD, CELL, FOOTER, STINK, TRUCK_LANE, TRUCK_TIMER, cellRect, orderSlot, type Rect } from './layout';
import { bigText, drawItemBig } from './menus';
import { popup } from './popups';
import { drawSprite } from './sprites';
import { drawText, textWidth, wrapText } from './text';
import type { View } from './view';

// ------------------------------------------------------------------------------ the greybox

/** Each brew's stand-in: a body colour, the letters on it, light or dark ink. */
const GREY: Partial<Record<ItemId, [PalName, string, PalName]>> = {
  chime: ['steel3', 'CHM', 'ink0'],
  stew: ['card2', 'STW', 'ink0'],
  bagbomb: ['grime1', 'BMB', 'bone'],
  burrito: ['sodium2', 'BUR', 'ink0'],
  piggyboot: ['pink', 'PIG', 'ink0'],
  bootcoffee: ['card0', 'COF', 'bone'],
  elecsoup: ['toxic2', 'ZAP', 'ink0'],
  magnet: ['red', 'MAG', 'bone'],
  forkgull: ['white', 'FRK', 'ink0'],
  chum: ['rust1', 'CHM', 'bone'],
  tirefire: ['hivis', 'FIR', 'ink0'],
  blanket: ['blue', 'BLK', 'ink0'],
  leftovers: ['bone', 'LFT', 'ink0'],
  truckshoe: ['fur2', 'MTS', 'ink0'],
  rotisserie: ['sodium3', 'ROT', 'ink0'],
  gokart: ['rust2', 'GOK', 'bone'],
  getaway: ['steel2', 'GET', 'ink0'],
  shopbed: ['card3', 'BED', 'ink0'],
  panicroom: ['white', 'PNC', 'ink0'],
  icecream: ['pink', 'ICE', 'ink0'],
};

/**
 * A brew without its sprite yet: tools are a corked flask, treasures a gold-trimmed crate, each
 * in its own colour with 2-3 letters. Foot at (fx, fy) like every item; sx, sy squash it.
 */
export function placeholderBrew(g: CanvasRenderingContext2D, id: ItemId, fx: number, fy: number, sx = 1, sy = 1): void {
  const [body, letters, ink] = GREY[id] ?? ['toxic2', '???', 'ink0'];
  const w = Math.round(24 * sx);
  const h = Math.round(24 * sy);
  const x = Math.round(fx - w / 2);
  const y = Math.round(fy - 2 - h);
  if (isTool(id)) {
    // The flask: a neck with a cork, a fat body.
    const nw = Math.max(4, Math.round(w * 0.34));
    const nx = Math.round(fx - nw / 2);
    const neck = Math.round(h * 0.3);
    fillRect(g, { x: nx - 1, y: y - 1, w: nw + 2, h: neck + 2 }, 'ink0');
    fillRect(g, { x: nx, y, w: nw, h: neck }, 'steel3');
    fillRect(g, { x: nx, y: y - 3, w: nw, h: 3 }, 'card0');
    const by = y + neck;
    const bh = h - neck;
    fillRect(g, { x: x + 1, y: by - 1, w: w - 2, h: bh + 2 }, 'ink0');
    fillRect(g, { x, y: by + 1, w, h: bh - 2 }, 'ink0');
    fillRect(g, { x: x + 2, y: by, w: w - 4, h: bh }, body);
    fillRect(g, { x: x + 1, y: by + 2, w: w - 2, h: bh - 4 }, body);
    fillRect(g, { x: x + 3, y: by + 1, w: 2, h: Math.max(1, bh - 5) }, 'white');
    drawText(g, letters, fx, by + Math.round(bh / 2) - 5, { color: ink, align: 'center' });
  } else {
    // The crate: gold trim, a twinkle.
    fillRect(g, { x: x - 1, y: y - 1, w: w + 2, h: h + 2 }, 'ink0');
    fillRect(g, { x, y, w, h }, 'yellow');
    fillRect(g, { x: x + 2, y: y + 2, w: w - 4, h: h - 4 }, body);
    fillRect(g, { x: x + w - 5, y: y + 1, w: 1, h: 3 }, 'white');
    fillRect(g, { x: x + w - 6, y: y + 2, w: 3, h: 1 }, 'white');
    drawText(g, letters, fx, y + Math.round(h / 2) - 5, { color: ink, align: 'center' });
  }
}

// ------------------------------------------------------------------------------ live bits

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grav: number;
  age: number;
  life: number;
  size: number;
  colour: PalName;
}

/** A piece drawn flying from one spot to another (the Magnet's pull, Leftovers' copy, the Fork's meal). */
interface Ghost {
  id: ItemId;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t0: number;
  dur: number;
  arc: number;
  /** Blink out when it arrives (eaten) instead of sitting on the target. */
  vanish: boolean;
}

/** A timed effect over the lot. */
interface Burst {
  kind: 'flash' | 'fire' | 'zap' | 'wave' | 'sweep';
  t0: number;
  dur: number;
  cells: [number, number][];
  /** The middle (zap) or the row (fire). */
  c: number;
  r: number;
}

interface Reveal {
  id: ItemId;
  c: number;
  r: number;
  t0: number;
}

const parts: Part[] = [];
const ghosts: Ghost[] = [];
const bursts: Burst[] = [];
let reveal: Reveal | null = null;
let lastT = 0;
/** The render-only freeze for a first brew: a snapshot of the frame shown until `freezeUntil`. */
let freezeReq = false;
let freezeUntil = -1;
let snap: HTMLCanvasElement | null = null;

const FREEZE_SEC = 0.16;
const REVEAL_SEC = 2.8;
/** Seconds a raccoon's riddle stays up in the footer after they walk up. */
const RIDDLE_SEC = 9;

export function resetAlchemy(): void {
  parts.length = 0;
  ghosts.length = 0;
  bursts.length = 0;
  reveal = null;
  freezeReq = false;
  freezeUntil = -1;
  lastT = 0;
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

function mid(c: number, r: number): { x: number; y: number } {
  const f = cellFoot(c, r);
  return { x: f.x, y: f.y - 14 };
}

function burst(x: number, y: number, n: number, colours: readonly PalName[], speed: number, grav = 120, life = 0.6): void {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const v = rand(speed * 0.3, speed);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.4, grav, age: 0, life: rand(life * 0.6, life), size: Math.random() < 0.3 ? 2 : 1, colour: colours[i % colours.length] ?? 'white' });
  }
  if (parts.length > 260) parts.splice(0, parts.length - 260);
}

/** Bubbles rising off a brew: the cauldron look. */
function bubbles(x: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) {
    parts.push({ x: x + rand(-10, 10), y: y + rand(-4, 6), vx: rand(-8, 8), vy: rand(-40, -18), grav: -10, age: 0, life: rand(0.5, 1.1), size: Math.random() < 0.4 ? 2 : 1, colour: i % 3 === 0 ? 'toxic3' : i % 3 === 1 ? 'toxic2' : 'toxic1' });
  }
}

// ------------------------------------------------------------------------------ events

export function alchemyEvent(s: GameState, e: GameEvent, v: View): void {
  switch (e.type) {
    case 'brew': {
      const m = mid(e.c, e.r);
      bubbles(m.x, m.y, e.first ? 22 : 10);
      burst(m.x, m.y, e.first ? 18 : 8, ['toxic3', 'toxic2', 'bone', 'yellow'], 90);
      if (e.first) {
        reveal = { id: e.to, c: e.c, r: e.r, t0: v.t };
        freezeReq = true;
      } else {
        popup(`${ITEMS[e.to].name.toUpperCase()}!`, m.x, m.y - 16, { color: e.kind === 'treasure' ? 'yellow' : 'toxic3', clamp: BOARD });
      }
      if (e.twin) {
        const t = mid(e.twin.c, e.twin.r);
        bubbles(t.x, t.y, 10);
        popup('TWINS!', t.x, t.y - 16, { color: 'pink', clamp: BOARD, delay: 0.2 });
      }
      break;
    }
    case 'toolUsed':
      toolFx(s, e, v);
      break;
    case 'deliver':
      if (isTreasure(e.id)) {
        const card = orderSlot(e.slot);
        popup('TREASURE!', card.x + 80, card.y + 20, { color: 'yellow', big: true, clamp: { x: 0, y: 101, w: 174, h: 239 }, life: 1.4 });
      }
      break;
    default:
      break;
  }
}

function toolFx(s: GameState, e: Extract<GameEvent, { type: 'toolUsed' }>, v: View): void {
  const t = v.t;
  const at = mid(e.c, e.r);
  const cells = e.cells.map((x): [number, number] => [x.c, x.r]);
  switch (e.id) {
    case 'bagbomb': {
      bursts.push({ kind: 'flash', t0: t, dur: 0.18, cells: around(s, e.c, e.r), c: e.c, r: e.r });
      for (const x of e.cells) {
        const m = mid(x.c, x.r);
        burst(m.x, m.y, 12, ['grime1', 'grime2', 'toxic1', 'rust1', 'card1', 'dirt3'], 120, 220, 0.8);
      }
      popup('BOOM!', at.x, at.y - 20, { color: 'hivis', big: true, clamp: BOARD, life: 1.2 });
      if (e.shinies) popup(`+${e.shinies}`, at.x, at.y + 4, { color: 'yellow', clamp: BOARD, delay: 0.15 });
      break;
    }
    case 'tirefire': {
      const row: [number, number][] = [];
      for (let c = 0; c < s.board.cols; c++) row.push([c, e.r]);
      bursts.push({ kind: 'fire', t0: t, dur: 1.3, cells: row, c: e.c, r: e.r });
      popup('TIRE FIRE!', at.x, at.y - 20, { color: 'hivis', big: true, clamp: BOARD, life: 1.3 });
      if (e.shinies) popup(`+${e.shinies}`, at.x, at.y + 2, { color: 'yellow', clamp: BOARD, delay: 0.2 });
      popup(`+${ALCHEMY.fire.stink}`, STINK.x + 12, STINK.y - 8, { color: 'toxic2', delay: 0.3 });
      break;
    }
    case 'elecsoup':
      bursts.push({ kind: 'zap', t0: t, dur: 0.55, cells, c: e.c, r: e.r });
      for (const [c, r] of cells) {
        const m = mid(c, r);
        burst(m.x, m.y, 6, ['yellow', 'white', 'toxic3'], 70, 40, 0.4);
      }
      popup('ZAP! +1 TIER', at.x, at.y - 20, { color: 'yellow', big: true, clamp: BOARD });
      break;
    case 'magnet':
      for (const m of e.moves ?? []) {
        const from = e.made?.find((x) => x.c === m.toC && x.r === m.toR)?.from ?? e.cells[0]?.id ?? 'cap';
        const a = cellFoot(m.c, m.r);
        const b = cellFoot(m.toC, m.toR);
        ghosts.push({ id: from, x0: a.x, y0: a.y, x1: b.x, y1: b.y, t0: t, dur: 0.28, arc: 6, vanish: true });
      }
      popup('MAGNET!', at.x, at.y - 22, { color: 'red', big: true, clamp: BOARD });
      break;
    case 'forkgull': {
      bursts.push({ kind: 'sweep', t0: t, dur: 0.9, cells, c: e.c, r: e.r });
      for (const x of e.cells) {
        const f = cellFoot(x.c, x.r);
        // Each meal sits until the gull's sweep reaches its column, then blinks out.
        const k = (f.x - BOARD.x) / BOARD.w;
        ghosts.push({ id: x.id, x0: f.x, y0: f.y, x1: f.x, y1: f.y, t0: t, dur: 0.05 + k * 0.85, arc: 0, vanish: true });
      }
      popup('CHOMP!', at.x, at.y - 20, { color: 'white', big: true, clamp: BOARD });
      if (e.shinies) popup(`+${e.shinies}`, at.x, at.y + 2, { color: 'yellow', clamp: BOARD, delay: 0.5 });
      break;
    }
    case 'chum':
      for (const [c, r] of cells) {
        const m = mid(c, r);
        burst(m.x, m.y, 10, ['rust2', 'rust3', 'pink', 'white'], 70, 160, 0.6);
      }
      popup('CHUM!', at.x, at.y - 20, { color: 'rust3', big: true, clamp: BOARD });
      break;
    case 'blanket':
      bursts.push({ kind: 'wave', t0: t, dur: 0.6, cells, c: e.c, r: e.r });
      popup('FRESH!', at.x, at.y - 20, { color: 'blue', big: true, clamp: BOARD });
      if (e.stink) popup(`${Math.round(e.stink)}`, STINK.x + 12, STINK.y - 8, { color: 'blue', big: true, delay: 0.2 });
      break;
    case 'bootcoffee':
      for (let i = 0; i < 3; i++) bubbles(at.x + (i - 1) * 6, at.y, 4);
      popup('TRUCK STALLED!', TRUCK_TIMER.x + TRUCK_TIMER.w / 2 + 40, TRUCK_LANE.y + 18, { color: 'sodium3', big: true, clamp: TRUCK_LANE, life: 1.6 });
      popup('PATIENCE!', 88, 128, { color: 'toxic3', clamp: { x: 0, y: 101, w: 174, h: 239 }, delay: 0.2 });
      break;
    case 'leftovers':
      for (const m of e.made ?? []) {
        const a = cellFoot(e.c, e.r);
        const b = cellFoot(m.c, m.r);
        ghosts.push({ id: m.to, x0: a.x, y0: a.y, x1: b.x, y1: b.y, t0: t, dur: 0.35, arc: 18, vanish: true });
        popup('COPY!', b.x, b.y - 30, { color: 'bone', clamp: BOARD, delay: 0.3 });
      }
      break;
    case 'stew':
      if (e.slot !== undefined) {
        const card = orderSlot(e.slot);
        for (let i = 0; i < 4; i++) bubbles(card.x + 40 + i * 24, card.y + 40, 4);
        popup('STEWED! PAY x2', card.x + 80, card.y + 10, { color: 'toxic3', big: true, clamp: { x: 0, y: 101, w: 174, h: 239 } });
      }
      break;
    default:
      break;
  }
}

/** The 3x3 around a cell, clipped to the lot. */
function around(s: GameState, c: number, r: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (s.board.inside(c + dc, r + dr)) out.push([c + dc, r + dr]);
  return out;
}

// ------------------------------------------------------------------------------ the freeze

/** A first brew holds the frame for a beat (render only). Call first in draw: true means done. */
export function alchemyFrozen(g: CanvasRenderingContext2D, v: View): boolean {
  if (!snap || v.t >= freezeUntil) return false;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(snap, 0, 0);
  g.restore();
  return true;
}

function capture(g: CanvasRenderingContext2D, v: View): void {
  if (!freezeReq) return;
  freezeReq = false;
  if (typeof document === 'undefined') return;
  const src = g.canvas;
  if (!snap || snap.width !== src.width || snap.height !== src.height) {
    snap = document.createElement('canvas');
    snap.width = src.width;
    snap.height = src.height;
  }
  const sg = snap.getContext('2d');
  if (!sg) return;
  sg.clearRect(0, 0, snap.width, snap.height);
  sg.drawImage(src as CanvasImageSource, 0, 0);
  freezeUntil = v.t + FREEZE_SEC;
  // The reveal starts once the frame lets go.
  if (reveal) reveal.t0 = v.t + FREEZE_SEC;
}

// ------------------------------------------------------------------------------ drawing

function tick(v: View): number {
  const dt = Math.max(0, Math.min(0.1, v.t - lastT));
  lastT = v.t;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (!p) continue;
    p.age += dt;
    if (p.age >= p.life) {
      parts.splice(i, 1);
      continue;
    }
    p.vy += p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  return dt;
}

/** The held piece, if it's on the board. */
function heldPiece(s: GameState): { id: ItemId; c: number; r: number } | null {
  const d = s.drag;
  const p = d ? s.board.get(d.c, d.r) : null;
  return d && p ? { id: p.id, c: d.c, r: d.r } : null;
}

/** Over the lot, under the held piece: tool zones, recipe partners, effects, the riddle. */
export function drawAlchemy(g: CanvasRenderingContext2D, s: GameState, v: View, hover: Target, _kind: DropKind): void {
  const dt = tick(v);
  // Fire keeps flaming for its whole run.
  for (const b of bursts) if (b.kind === 'fire' && v.t - b.t0 < b.dur * 0.8) for (const [c, r] of b.cells) if (Math.random() < dt * 14) {
    const m = mid(c, r);
    parts.push({ x: m.x + rand(-12, 12), y: m.y + 10, vx: rand(-6, 6), vy: rand(-60, -30), grav: -20, age: 0, life: rand(0.3, 0.7), size: Math.random() < 0.5 ? 2 : 1, colour: Math.random() < 0.4 ? 'hivis' : Math.random() < 0.5 ? 'yellow' : 'rust2' });
  }
  drawBursts(g, s, v);
  drawGhosts(g, v);
  for (const p of parts) fillRect(g, { x: Math.round(p.x), y: Math.round(p.y), w: p.size, h: p.size }, p.colour);

  const held = heldPiece(s);
  if (held && s.status === 'playing') {
    if (isTool(held.id)) drawToolZone(g, s, v, held, hover);
    else partnerMarks(g, s, v, held);
  }
  drawRiddles(g, s, v);
}

function drawBursts(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    if (!b) continue;
    const k = (v.t - b.t0) / b.dur;
    if (k >= 1) {
      bursts.splice(i, 1);
      continue;
    }
    if (k < 0) continue;
    switch (b.kind) {
      case 'flash':
        // Two frames of white, then a yellow ring that blinks out.
        for (const [c, r] of b.cells) {
          const rc = cellRect(c, r);
          if (k < 0.35) fillRect(g, rc, k < 0.18 ? 'white' : 'yellow');
          else outlineRect(g, rc, 'hivis', 2);
        }
        break;
      case 'fire':
        for (const [c, r] of b.cells) {
          const rc = cellRect(c, r);
          if (Math.floor(v.t * 20 + c) % 2 === 0) outlineRect(g, { x: rc.x + 2, y: rc.y + 2, w: rc.w - 4, h: rc.h - 4 }, k < 0.5 ? 'hivis' : 'rust2');
        }
        break;
      case 'zap': {
        const a = mid(b.c, b.r);
        if (Math.floor(v.t * 30) % 2 === 0) {
          for (const [c, r] of b.cells) {
            const m = mid(c, r);
            jag(g, a.x, a.y, m.x, m.y, 'yellow');
          }
        }
        for (const [c, r] of b.cells) outlineRect(g, cellRect(c, r), 'yellow');
        break;
      }
      case 'wave': {
        // A warm band sweeping down the lot.
        const y = BOARD.y + Math.round(k * BOARD.h);
        fillRect(g, { x: BOARD.x, y, w: BOARD.w, h: 2 }, 'sodium3');
        fillRect(g, { x: BOARD.x, y: y - 4, w: BOARD.w, h: 1 }, 'yellow');
        for (const [c, r] of b.cells) if (cellRect(c, r).y < y) outlineRect(g, cellRect(c, r), 'blue');
        break;
      }
      case 'sweep': {
        // The Gull With A Fork flies across the lot at the height it was dropped.
        const x = BOARD.x - 20 + Math.round(k * (BOARD.w + 40));
        const y = cellFoot(b.c, b.r).y - 6 - Math.round(Math.sin(k * Math.PI * 3) * 4);
        drawItem(g, 'forkgull', x, y, { phase: 0 });
        break;
      }
    }
  }
  void s;
}

/** A crooked lightning line from (x0, y0) to (x1, y1), in 1 px steps. */
function jag(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: PalName): void {
  const n = 5;
  let px = x0;
  let py = y0;
  for (let i = 1; i <= n; i++) {
    const tx = x0 + ((x1 - x0) * i) / n + (i < n ? rand(-4, 4) : 0);
    const ty = y0 + ((y1 - y0) * i) / n + (i < n ? rand(-4, 4) : 0);
    const steps = Math.max(Math.abs(tx - px), Math.abs(ty - py), 1);
    for (let k = 0; k <= steps; k++) fillRect(g, { x: Math.round(px + ((tx - px) * k) / steps), y: Math.round(py + ((ty - py) * k) / steps), w: 1, h: 1 }, c);
    px = tx;
    py = ty;
  }
}

function drawGhosts(g: CanvasRenderingContext2D, v: View): void {
  for (let i = ghosts.length - 1; i >= 0; i--) {
    const gh = ghosts[i];
    if (!gh) continue;
    const k = (v.t - gh.t0) / gh.dur;
    if (k >= 1) {
      ghosts.splice(i, 1);
      continue;
    }
    if (k < 0) continue;
    const e = k * k;
    const x = Math.round(gh.x0 + (gh.x1 - gh.x0) * e);
    const y = Math.round(gh.y0 + (gh.y1 - gh.y0) * e - Math.sin(k * Math.PI) * gh.arc);
    drawItem(g, gh.id, x, y, { phase: 0 });
  }
}

/** A tool in hand: the zone it would hit on the hovered target, and the pieces it would change. */
function drawToolZone(g: CanvasRenderingContext2D, s: GameState, v: View, held: { id: ItemId; c: number; r: number }, hover: Target): void {
  const plan = toolPlan(s, held.c, held.r, hover);
  if (!plan) return;
  const pulse = Math.sin(v.t * 9) > 0;
  const hot: PalName = held.id === 'bagbomb' || held.id === 'tirefire' ? 'hivis' : held.id === 'blanket' ? 'blue' : 'toxic3';
  if (plan.aim === 'area' || plan.aim === 'row') {
    const box = bounds(plan.zone);
    outlineRect(g, { x: box.x - 2, y: box.y - 2, w: box.w + 4, h: box.h + 4 }, 'ink0', 1);
    outlineRect(g, { x: box.x - 1, y: box.y - 1, w: box.w + 2, h: box.h + 2 }, pulse ? hot : 'bone', 2);
  } else if (plan.aim === 'lot') {
    outlineRect(g, { x: BOARD.x - 2, y: BOARD.y - 2, w: BOARD.w + 4, h: BOARD.h + 4 }, pulse ? hot : 'bone', 2);
  }
  for (const [c, r] of plan.hits) {
    const rc = cellRect(c, r);
    outlineRect(g, { x: rc.x + 1, y: rc.y + 1, w: rc.w - 2, h: rc.h - 2 }, pulse ? hot : 'yellow');
  }
  // The Magnet: an arrow of dots from every pull to the target.
  if (held.id === 'magnet') {
    const b = mid(plan.c, plan.r);
    for (const [c, r] of plan.hits.slice(1)) {
      const a = mid(c, r);
      const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 6));
      for (let i = 1; i < n; i++) {
        if ((i + Math.floor(v.t * 10)) % 3 !== 0) continue;
        fillRect(g, { x: Math.round(a.x + ((b.x - a.x) * i) / n), y: Math.round(a.y + ((b.y - a.y) * i) / n), w: 2, h: 2 }, 'red');
      }
    }
  }
  // Leftovers: where the copy will land.
  if (held.id === 'leftovers') {
    const spot = nearestFree(s, plan.c, plan.r, held);
    if (spot) {
      const f = cellFoot(spot[0], spot[1]);
      drawItem(g, s.board.get(plan.c, plan.r)?.id ?? 'cap', f.x, f.y, { alpha: pulse ? 0.55 : 0.35 });
    }
  }
}

/** Leftovers' landing cell, as alchemy.ts will pick it (the tool's own cell counts as free). */
function nearestFree(s: GameState, c: number, r: number, held: { c: number; r: number }): [number, number] | null {
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let rr = 0; rr < s.board.rows; rr++) {
    for (let cc = 0; cc < s.board.cols; cc++) {
      if (s.board.get(cc, rr) && !(cc === held.c && rr === held.r)) continue;
      const d = Math.max(Math.abs(cc - c), Math.abs(rr - r)) * 100 + Math.abs(cc - c) + Math.abs(rr - r);
      if (d < bestD) {
        bestD = d;
        best = [cc, rr];
      }
    }
  }
  return best;
}

function bounds(cells: readonly [number, number][]): Rect {
  const xs = cells.map(([c]) => c);
  const ys = cells.map(([, r]) => r);
  const c0 = Math.min(...xs);
  const r0 = Math.min(...ys);
  const c1 = Math.max(...xs);
  const r1 = Math.max(...ys);
  return { x: BOARD.x + c0 * CELL, y: BOARD.y + r0 * CELL, w: (c1 - c0 + 1) * CELL, h: (r1 - r0 + 1) * CELL };
}

/** Known recipe partners of the held piece get a little bubbling flask in their corner. */
function partnerMarks(g: CanvasRenderingContext2D, s: GameState, v: View, held: { id: ItemId; c: number; r: number }): void {
  for (const { p, c, r } of s.board.pieces()) {
    if ((c === held.c && r === held.r) || inFlight(s, p.uid)) continue;
    const to = brewResult(held.id, p.id);
    if (!to || !knownRecipe(s, to)) continue;
    const rc = cellRect(c, r);
    flaskGlyph(g, rc.x + rc.w - 9, rc.y + 1, v.t + c);
  }
}

/** A 7 x 9 flask with a bubble popping out of it. */
function flaskGlyph(g: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  fillRect(g, { x: x + 1, y: y + 1, w: 5, h: 8 }, 'ink0');
  fillRect(g, { x, y: y + 4, w: 7, h: 5 }, 'ink0');
  fillRect(g, { x: x + 2, y: y + 2, w: 3, h: 2 }, 'steel3');
  fillRect(g, { x: x + 1, y: y + 4, w: 5, h: 4 }, 'toxic2');
  fillRect(g, { x: x + 2, y: y + 5, w: 1, h: 2 }, 'toxic3');
  if (Math.floor(t * 4) % 3 === 0) fillRect(g, { x: x + 4, y: y - 1, w: 1, h: 1 }, 'toxic3');
}

// ------------------------------------------------------------------------------ the riddle drip

/** A raccoon sharing a riddle: their line in the footer strip for a while, and a "?" on their card. */
function drawRiddles(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  if (s.status !== 'playing') return;
  for (let slot = 0; slot < s.orders.length; slot++) {
    const o = s.orders[slot];
    if (!o || !o.riddle || o.mood !== 'waiting') continue;
    const rec = recipeOf(o.riddle);
    if (!rec || s.discoveredRecipes.has(rec.id)) continue;
    const card = orderSlot(slot);
    // The "?" scroll on the card, between the wanted box and the edge.
    const bob = Math.floor(v.t * 3 + slot) % 2;
    const qx = card.x + card.w - 18;
    const qy = card.y + 24 - bob;
    fillRect(g, { x: qx - 1, y: qy - 1, w: 13, h: 14 }, 'ink0');
    fillRect(g, { x: qx, y: qy, w: 11, h: 12 }, 'toxic3');
    drawText(g, '?', qx + 6, qy + 1, { color: 'ink0', align: 'center' });
    if (o.t > RIDDLE_SEC) continue;
    const def = raccoonDef(o.raccoon);
    const lead = def.riddle?.[(o.riddle.length + slot) % Math.max(1, def.riddle.length)] ?? 'Psst.';
    const text = `${def.name.toUpperCase()}: ${lead} "${rec.riddle}"`;
    const r: Rect = { x: FOOTER.x + 4, y: FOOTER.y + 2, w: FOOTER.w - 8, h: 16 };
    // Slides up over the footer, blinks out at the end.
    const k = Math.min(1, o.t / 0.25);
    if (o.t > RIDDLE_SEC - 0.4 && Math.floor(v.t * 12) % 2 === 0) continue;
    const y = r.y + Math.round((1 - k) * 18);
    fillRect(g, { x: r.x + 1, y: y + 1, w: r.w, h: r.h }, 'ink0');
    fillRect(g, { x: r.x, y, w: r.w, h: r.h }, 'bone');
    outlineRect(g, { x: r.x, y, w: r.w, h: r.h }, 'toxic1');
    flaskGlyph(g, r.x + 4, y + 4, v.t);
    const fit = textWidth(text) > r.w - 22 ? `${lead} "${rec.riddle}"` : text;
    drawText(g, fit, r.x + 16, y + 3, { color: 'ink0' });
    break;
  }
}

// ------------------------------------------------------------------------------ over everything

/** Over the held piece: the hover bubbles and labels, "TREASURE!", the reveal. Then the freeze's snapshot. */
export function drawAlchemyTop(g: CanvasRenderingContext2D, s: GameState, v: View, hover: Target, kind: DropKind): void {
  const held = heldPiece(s);
  if (held && s.status === 'playing') {
    if (kind === 'brew' && hover.kind === 'cell') brewBubble(g, s, v, held, hover.c, hover.r);
    if (isTool(held.id)) toolHint(g, s, v, held, hover, kind);
    else if (isTreasure(held.id)) treasureHint(g, s, v, held.id, hover);
  }
  drawReveal(g, s, v);
  capture(g, v);
}

/** A speech-paper box with an ink keyline and drop shadow. */
function paperBox(g: CanvasRenderingContext2D, r: Rect, edge: PalName = 'ink0'): void {
  fillRect(g, { x: r.x + 2, y: r.y + 2, w: r.w, h: r.h }, 'ink0');
  fillRect(g, r, 'bone');
  outlineRect(g, r, edge);
}

/** The bubble over a recipe partner: "?" for a recipe never brewed, the result and BREW for a known one. */
function brewBubble(g: CanvasRenderingContext2D, s: GameState, v: View, held: { id: ItemId }, c: number, r: number): void {
  const q = s.board.get(c, r);
  const to = q ? brewResult(held.id, q.id) : null;
  if (!to) return;
  const rc = cellRect(c, r);
  const bob = Math.round(Math.sin(v.t * 6) * 1.5);
  const known = knownRecipe(s, to);
  // Up and to the right of the cell, clear of the piece in your paw.
  const w = known ? 64 : 30;
  const h = known ? 46 : 30;
  const box = { x: Math.min(BOARD.x + BOARD.w + 40 - w, rc.x + 22), y: Math.max(2, rc.y - h - 6 + bob), w, h };
  paperBox(g, box, 'toxic1');
  // The tail, down-left toward the cell.
  for (let i = 0; i < 5; i++) fillRect(g, { x: box.x + 6 - i, y: box.y + box.h + i, w: Math.max(1, 5 - i), h: 1 }, i === 0 ? 'bone' : 'ink0');
  if (known) {
    drawText(g, 'BREW', box.x + box.w / 2, box.y + 2, { color: 'toxic0', align: 'center' });
    drawItem(g, to, box.x + box.w / 2, box.y + box.h - 2, { phase: 0 });
  } else {
    // The bubbling "?": it fizzes.
    bigText(g, '?', box.x + box.w / 2, box.y + 4, 2, { color: 'toxic1', outline: 'ink0', align: 'center' });
    for (let i = 0; i < 3; i++) {
      const k = (v.t * 1.6 + i / 3) % 1;
      fillRect(g, { x: box.x + 6 + i * 8, y: Math.round(box.y + box.h - 4 - k * 22), w: k < 0.5 ? 2 : 1, h: k < 0.5 ? 2 : 1 }, 'toxic2');
    }
  }
}

const AIM_HINT: Record<ToolAim, string> = {
  area: 'drop on junk',
  row: 'drop on junk',
  lot: 'drop on anything',
  piece: 'drop on a piece',
  order: 'drop on a raccoon',
};

/** A tool in hand: its name and what it does over the lane; the plan's label by the target. */
function toolHint(g: CanvasRenderingContext2D, s: GameState, v: View, held: { id: ItemId; c: number; r: number }, hover: Target, kind: DropKind): void {
  const rec = recipeOf(held.id);
  if (!rec) return;
  laneBanner(g, `${ITEMS[held.id].name.toUpperCase()}: ${rec.effect}`, 'toxic1');
  const plan: ToolPlan | null = kind === 'tool' ? toolPlan(s, held.c, held.r, hover) : null;
  if (!plan) {
    // Over a piece it does nothing to: say what it wants.
    if (kind === 'bad' && hover.kind !== 'none' && hover.kind !== 'compactor') {
      const at = hover.kind === 'cell' ? cellRect(hover.c, hover.r) : orderSlot(hover.slot);
      tag(g, `NOPE: ${AIM_HINT[rec.aim ?? 'piece']}`, at.x + at.w / 2, at.y - 2, 'rust1');
    }
    return;
  }
  if (plan.aim === 'order' && plan.slot !== undefined) {
    const card = orderSlot(plan.slot);
    outlineRect(g, { x: card.x - 3, y: card.y - 3, w: card.w + 6, h: card.h + 6 }, Math.sin(v.t * 9) > 0 ? 'toxic3' : 'bone', 2);
    // Right of the tool itself (drawHeld puts it just past the card's edge), clear of the banner.
    const w = textWidth(plan.label) + 8;
    tag(g, plan.label, card.x + card.w + 38 + w / 2, card.y + 16, 'toxic0');
    return;
  }
  const box = plan.aim === 'lot' ? BOARD : bounds(plan.zone.length > 0 ? plan.zone : [[plan.c, plan.r]]);
  tag(g, plan.label, box.x + box.w / 2, box.y - 3, plan.aim === 'lot' ? 'ink0' : 'toxic0');
}

/** A treasure in hand: the banner, and on an order card what it would pay. */
function treasureHint(g: CanvasRenderingContext2D, s: GameState, v: View, id: ItemId, hover: Target): void {
  laneBanner(g, `${ITEMS[id].name.toUpperCase()}: TREASURE. Drop it on any raccoon.`, 'sodium1');
  if (hover.kind !== 'order') return;
  const o = s.orders[hover.slot];
  if (!o || o.mood !== 'waiting') return;
  const card = orderSlot(hover.slot);
  const pay = treasureValue(s, hover.slot, id);
  const lines = ['TREASURE!', 'Takes the whole order', s.goal === 'king' ? 'for a gift' : `+${pay} Shinies`];
  const w = Math.max(...lines.map((l) => textWidth(l))) + 12;
  // Right of the treasure itself (drawHeld puts it just past the card's edge).
  const r = { x: card.x + card.w + 38, y: card.y + 4, w, h: 36 };
  paperBox(g, r, Math.sin(v.t * 9) > 0 ? 'yellow' : 'sodium2');
  // Tail pointing left at the card.
  for (let i = 0; i < 4; i++) fillRect(g, { x: r.x - 1 - i, y: r.y + 12 - (3 - i), w: 1, h: (3 - i) * 2 + 1 }, i === 0 ? 'bone' : 'ink0');
  drawText(g, lines[0] ?? '', r.x + 6, r.y + 2, { color: 'rust1' });
  drawText(g, lines[1] ?? '', r.x + 6, r.y + 12, { color: 'ink0' });
  drawText(g, lines[2] ?? '', r.x + 6, r.y + 22, { color: 'toxic0' });
}

/** One line across the bottom of the lane, over the board's top edge: what the thing in hand does. */
function laneBanner(g: CanvasRenderingContext2D, text: string, edge: PalName): void {
  // (Narrow enough to stay clear of the truck plate on the left.)
  const lines = wrapText(text, 320).slice(0, 3);
  const w = Math.max(...lines.map((l) => textWidth(l))) + 12;
  const h = lines.length * 10 + 4;
  const r = { x: Math.round(BOARD.x + BOARD.w / 2 - w / 2), y: BOARD.y - h - 4, w, h };
  paperBox(g, r, edge);
  lines.forEach((l, i) => drawText(g, l, r.x + 6, r.y + 2 + i * 10, { color: 'ink0' }));
}

/** A small label centred on x with its bottom at y (kept on screen). */
function tag(g: CanvasRenderingContext2D, text: string, x: number, y: number, ink: PalName): void {
  const w = textWidth(text) + 8;
  const r = { x: Math.max(2, Math.min(638 - w, Math.round(x - w / 2))), y: Math.max(2, y - 12), w, h: 12 };
  paperBox(g, r);
  drawText(g, text, r.x + 4, r.y + 1, { color: ink });
}

/** The first brew of a recipe: the result pops up above the paw, then "NEW RECIPE!" and its name. */
function drawReveal(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  const rv = reveal;
  if (!rv) return;
  const t = v.t - rv.t0;
  if (t > REVEAL_SEC) {
    reveal = null;
    return;
  }
  if (t < 0) return;
  const foot = cellFoot(rv.c, rv.r);
  // Up 40 px with an overshoot, a hover, then back down into its cell.
  const up = t < 0.3 ? 1 - (1 - t / 0.3) ** 3 * 1 : t < 1.8 ? 1 : Math.max(0, 1 - (t - 1.8) / 0.4);
  const over = t < 0.3 ? Math.sin((t / 0.3) * Math.PI) * 6 : 0;
  const y = Math.round(foot.y - (40 * up + over) + (t > 0.3 && t < 1.8 ? Math.sin(t * 5) * 1.5 : 0));
  if (t < 2.2) {
    const scale = t < 1.8 ? 2 : 1;
    // A ring of light behind it.
    if (t < 1.8 && Math.floor(t * 10) % 2 === 0) {
      outlineRect(g, { x: foot.x - 34, y: y - 66, w: 68, h: 68 }, 'toxic3');
    }
    drawItemBig(g, rv.id, foot.x, y, scale, 0);
  }
  // The slam: a paper strip over the lane.
  const rec = recipeOf(rv.id);
  const d = ITEMS[rv.id];
  const slide = t < 0.15 ? (1 - t / 0.15) * -40 : t > REVEAL_SEC - 0.25 ? ((t - (REVEAL_SEC - 0.25)) / 0.25) * -50 : 0;
  const r = { x: BOARD.x + 8, y: Math.round(TRUCK_LANE.y + 2 + slide), w: BOARD.w - 16, h: 48 };
  paperBox(g, r, 'toxic1');
  const big = t < 0.12 ? 3 : 2;
  bigText(g, 'NEW RECIPE!', r.x + r.w / 2, r.y + 3 - (big === 3 ? 4 : 0), big, { color: 'toxic1', outline: 'ink0', align: 'center' });
  drawText(g, d.name.toUpperCase(), r.x + r.w / 2, r.y + 26, { color: 'ink0', align: 'center' });
  const what = !rec ? '' : rec.kind === 'treasure' ? `TREASURE: any raccoon takes it. Worth ${d.value}.` : `TOOL: ${AIM_HINT[rec.aim ?? 'piece']}.`;
  drawText(g, what, r.x + r.w / 2, r.y + 36, { color: rec?.kind === 'treasure' ? 'rust1' : 'toxic0', align: 'center' });
  // The two that made it, at the strip's ends.
  if (rec) {
    drawItem(g, rec.a, r.x + 20, r.y + r.h - 4, { phase: 0 });
    drawItem(g, rec.b, r.x + r.w - 20, r.y + r.h - 4, { phase: 1 });
  }
  void s;
}

// ------------------------------------------------------------------------------ Grandma's tip

/**
 * Grandma Mange's first recipe (src/scenes/hints.ts 'recipe'): from night 2, the first time a
 * can and a takeout box sit on the lot together and the Stew has never been brewed.
 */
export function mangeTipOn(s: GameState): boolean {
  if (s.night < 2 || s.goal === 'king' || s.discoveredRecipes.has('stew')) return false;
  return tipPieces(s) !== null;
}

/** Done once the Stew is brewed, or after a good long look. */
export function mangeTipDone(s: GameState, upSec: number): boolean {
  return s.discoveredRecipes.has('stew') || upSec > 14;
}

function tipPieces(s: GameState): { can: [number, number]; box: [number, number] } | null {
  let can: [number, number] | null = null;
  let box: [number, number] | null = null;
  for (const { p, c, r } of s.board.pieces()) {
    if (inFlight(s, p.uid)) continue;
    if (p.id === 'can' && !can) can = [c, r];
    if (p.id === 'takeout' && !box) box = [c, r];
  }
  return can && box ? { can, box } : null;
}

export function drawMangeTip(g: CanvasRenderingContext2D, s: GameState, v: View, upSec: number): void {
  const at = tipPieces(s);
  if (!at) return;
  const pulse = Math.sin(v.t * 8) > 0;
  for (const [c, r] of [at.can, at.box]) {
    const f = cellFoot(c, r);
    outlineRect(g, { x: f.x - 17, y: f.y - 32, w: 34, h: 34 }, pulse ? 'toxic3' : 'sodium3', 2);
  }
  // Grandma in the lane, over the takeout's column, with her line.
  const line = 'Try the can in the takeout, dear.';
  const w = textWidth(line) + 60;
  const fx = cellFoot(at.box[0], at.box[1]).x;
  const r = { x: Math.max(140, Math.min(466 - w, Math.round(fx - w / 2))), y: TRUCK_LANE.y + 4 - (upSec < 0.2 ? Math.round((1 - upSec / 0.2) * 6) : 0), w, h: 40 };
  paperBox(g, r, 'sodium3');
  // Her portrait, peeking in on the left of the note.
  g.save();
  g.beginPath();
  g.rect(r.x + 1, r.y + 1, 44, r.h - 2);
  g.clip();
  if (!drawSprite(g, 'raccoon_mange_idle', r.x + 22, r.y + 50)) placeholderRaccoon(g, 'mange', 'idle', false, r.x + 22, r.y + 50);
  g.restore();
  drawText(g, 'GRANDMA MANGE', r.x + 50, r.y + 6, { color: 'rust1' });
  drawText(g, line, r.x + 50, r.y + 20, { color: 'ink0' });
  // A tail down toward the takeout.
  const tx = Math.max(r.x + 50, Math.min(r.x + r.w - 8, fx));
  for (let i = 0; i < 6; i++) fillRect(g, { x: tx - (5 - i), y: r.y + r.h + i, w: (5 - i) * 2 + 1, h: 1 }, i === 0 ? 'bone' : 'ink0');
}

