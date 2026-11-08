// The run's drawing (the run agent's): Contraband icons and slot rows for the menus, and the run's
// marks on the lot during a night: The Inspection's condemned cells, the Gull God circling over
// the Gull God Raid, the held Contraband in the sky, and popups for Contraband and boss events.
// Drawing only: it reads the state and never changes it.
import { contrabandDef, type ContrabandId, type Rarity } from '../data/contraband';
import { ITEMS } from '../data/items';
import type { PalName } from '../data/palette';
import type { GameEvent } from '../game/events';
import { nextBossIn } from '../game/perks';
import type { GameState } from '../game/state';
import { cellFoot, drawItem } from './board';
import { fillRect, outlineRect } from './greybox';
import { BOARD, cellRect, inRect, orderSlot, type Rect } from './layout';
import { drawAt, drawTooltipAt } from './menus';
import { popup } from './popups';
import { drawSprite } from './sprites';
import { drawText, textWidth } from './text';
import type { View } from './view';

export const RARITY_COLOR: Record<Rarity, PalName> = { common: 'steel2', uncommon: 'toxic2', rare: 'sodium3' };
export const RARITY_INK: Record<Rarity, PalName> = { common: 'steel1', uncommon: 'toxic0', rare: 'rust1' };

/** The two-letter stand-in for an icon that isn't drawn yet. */
function initials(name: string): string {
  const words = name.replace(/['.]/g, '').split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? words[0]?.[1] ?? '')).toUpperCase();
}

/** A Contraband's 24 x 24 icon with its top-left at (x, y): `perk_<id>`, or a greybox. */
export function drawPerk(g: CanvasRenderingContext2D, id: ContrabandId, x: number, y: number): void {
  if (drawAt(g, `perk_${id}`, x, y)) return;
  const d = contrabandDef(id);
  fillRect(g, { x, y, w: 24, h: 24 }, 'ink0');
  fillRect(g, { x: x + 1, y: y + 1, w: 22, h: 22 }, RARITY_COLOR[d.rarity]);
  fillRect(g, { x: x + 1, y: y + 18, w: 22, h: 5 }, RARITY_INK[d.rarity]);
  const t = initials(d.name);
  drawText(g, t, x + 12, y + 5, { color: 'ink0', align: 'center' });
}

/** An empty slot (a dashed outline). */
function emptySlot(g: CanvasRenderingContext2D, r: Rect): void {
  for (let i = 0; i < r.w; i += 4) {
    fillRect(g, { x: r.x + i, y: r.y, w: 2, h: 1 }, 'card2');
    fillRect(g, { x: r.x + i, y: r.y + r.h - 1, w: 2, h: 1 }, 'card2');
  }
  for (let i = 0; i < r.h; i += 4) {
    fillRect(g, { x: r.x, y: r.y + i, w: 1, h: 2 }, 'card2');
    fillRect(g, { x: r.x + r.w - 1, y: r.y + i, w: 1, h: 2 }, 'card2');
  }
}

export const SLOT = 28;

/** Where each of `n` slots sits in a row starting at (x, y), `gap` apart. */
export function slotRects(n: number, x: number, y: number, gap = 4): Rect[] {
  return Array.from({ length: n }, (_, i) => ({ x: x + i * (SLOT + gap), y, w: SLOT, h: SLOT }));
}

/**
 * A row of Contraband slots: held ones drawn, the rest dashed. `hot`: a slot index to ring
 * (hovered or picked). Returns the slot rects (for hit tests).
 */
export function drawSlots(g: CanvasRenderingContext2D, slots: readonly ContrabandId[], max: number, x: number, y: number, hot = -1, ring: PalName = 'sodium3'): Rect[] {
  const rects = slotRects(max, x, y);
  rects.forEach((r, i) => {
    const id = slots[i];
    if (!id) emptySlot(g, r);
    else {
      fillRect(g, r, 'card0');
      drawPerk(g, id, r.x + 2, r.y + 2);
    }
    if (i === hot) outlineRect(g, { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, ring);
  });
  return rects;
}

/** "Name: what it does." */
export function perkTip(id: ContrabandId): string {
  const d = contrabandDef(id);
  return `${d.name.toUpperCase()} (${d.rarity}): ${d.blurb}`;
}

// ---------------------------------------------------------------------------------------------
// During a night

/** The Contraband held tonight, set by the play scene (the sky shows them, hover for the tip). */
let held: ContrabandId[] = [];

export function setHeldPerks(ids: readonly ContrabandId[]): void {
  held = [...ids];
}

/** Where tonight's Contraband sit: a row of icons in the sky, under the night's name plate. */
function heldRects(): Rect[] {
  return held.map((_, i) => ({ x: 8 + i * 26, y: 24, w: 24, h: 24 }));
}

/** Which held Contraband the pointer is over, or null. */
export function heldPerkAt(x: number, y: number): ContrabandId | null {
  const i = heldRects().findIndex((r) => inRect(r, x, y));
  return i >= 0 ? (held[i] ?? null) : null;
}

/** Tonight's Contraband in the sky, and the tip for one under the pointer. */
export function drawHeldPerks(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  const rects = heldRects();
  rects.forEach((r, i) => {
    const id = held[i];
    if (!id) return;
    const spent = id === 'bribe' && s.perk.bribed;
    const a = g.globalAlpha;
    if (spent) g.globalAlpha = a * 0.35;
    drawPerk(g, id, r.x, r.y);
    g.globalAlpha = a;
  });
  if (s.drag || s.status !== 'playing') return;
  const over = heldPerkAt(v.px, v.py);
  const i = over ? held.indexOf(over) : -1;
  const r = rects[i];
  if (over && r) drawTooltipAt(g, perkTip(over), r, 'below', 220);
}

/** The Inspection's condemned cells (taped off) and the Gull God over a raid. Over the board. */
export function drawRunLot(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  for (const [c, r] of s.board.blockedCells()) condemned(g, cellRect(c, r), v.t);
  if (s.mods.raid) gullGod(g, s, v);
}

/** Yellow-and-ink tape in an X over the cell, and a red CONDEMNED tag. */
function condemned(g: CanvasRenderingContext2D, r: Rect, t: number): void {
  fillRect(g, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, 'grime0');
  for (let i = 0; i < r.w - 4; i++) {
    const y1 = r.y + 2 + i;
    const y2 = r.y + r.h - 3 - i;
    const col: PalName = Math.floor(i / 3) % 2 === 0 ? 'yellow' : 'ink0';
    fillRect(g, { x: r.x + 2 + i, y: y1, w: 2, h: 2 }, col);
    fillRect(g, { x: r.x + 2 + i, y: y2 - 1, w: 2, h: 2 }, col);
  }
  const bob = Math.round(Math.sin(t * 2 + r.x) * 0.6);
  fillRect(g, { x: r.x + 3, y: r.y + 12 + bob, w: r.w - 6, h: 8 }, 'ink0');
  fillRect(g, { x: r.x + 4, y: r.y + 13 + bob, w: r.w - 8, h: 6 }, 'red');
  fillRect(g, { x: r.x + 6, y: r.y + 15 + bob, w: r.w - 12, h: 2 }, 'bone');
}

/** The Gull God circling the sky, and how long until it swoops (fed or hungry). */
function gullGod(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  const t = v.t;
  const left = nextBossIn(s);
  const soon = left < 6;
  // A slow loop over the lot; it drops lower as the hour comes up.
  const cx = 320 + Math.cos(t * 0.6) * 150;
  const cy = (soon ? 38 : 26) + Math.sin(t * 1.2) * 6;
  const flip = Math.sin(t * 0.6) > 0;
  // The God himself (his item sprite), with a gull or two in tow.
  drawItem(g, 'gullgod', cx, cy + 16, { phase: t, flip });
  drawSprite(g, 'gull_fly', cx + (flip ? 26 : -26), cy + 4, { frame: Math.floor(t * 6) % 2, flip });
  // The note under the clock: fed (green) or hungry (red, flashing as it comes).
  const fed = s.perk.fed;
  const secs = Number.isFinite(left) ? Math.ceil(left) : 0;
  const text = !Number.isFinite(left) ? (fed ? 'GULL GOD: FED' : 'GULL GOD: HUNGRY') : fed ? `GULL GOD FED · flies on in ${secs}s` : `GULL GOD HUNGRY · swoops in ${secs}s · feed it a gull!`;
  const w = textWidth(text) + 8;
  const x = Math.round(BOARD.x + BOARD.w / 2 - w / 2);
  const y = BOARD.y - 12;
  const flash = !fed && soon && Math.sin(t * 12) > 0;
  fillRect(g, { x, y, w, h: 11 }, flash ? 'red' : 'ink0');
  drawText(g, text, x + 4, y + 1, { color: fed ? 'toxic2' : flash ? 'bone' : 'rust3' });
}

/** The run's events as popups (src/scenes/play.ts calls it for each event). */
export function runEvent(_s: GameState, e: GameEvent): void {
  if (e.type === 'perk') {
    let x = BOARD.x + BOARD.w / 2;
    let y = BOARD.y + 20;
    if (e.c !== undefined && e.r !== undefined) {
      const f = cellFoot(e.c, e.r);
      x = f.x;
      y = f.y - 26;
    } else if (e.slot !== undefined) {
      const r = orderSlot(e.slot);
      x = r.x + r.w / 2;
      y = r.y + 6;
    }
    popup(e.text, x, y, { color: e.id === 'bribe' ? 'toxic3' : 'sodium3', big: e.id === 'bribe', clamp: e.slot !== undefined ? undefined : BOARD });
    return;
  }
  if (e.type !== 'boss') return;
  const mid = BOARD.x + BOARD.w / 2;
  if (e.what === 'condemn' && e.c !== undefined && e.r !== undefined) {
    const f = cellFoot(e.c, e.r);
    popup('CONDEMNED!', f.x, f.y - 24, { color: 'red', clamp: BOARD });
  } else if (e.what === 'raid' && e.c !== undefined && e.r !== undefined) {
    const f = cellFoot(e.c, e.r);
    const name = e.id ? ITEMS[e.id].short.toUpperCase() : 'IT';
    popup(`THE GULL GOD TOOK YOUR ${name}!`, mid, BOARD.y + 40, { color: 'rust3', big: true, life: 2 });
    popup('SNATCH!', f.x, f.y - 24, { color: 'red', clamp: BOARD });
  } else if (e.what === 'pass') {
    popup('The Gull God flies on. Fed.', mid, BOARD.y + 30, { color: 'toxic2', life: 1.6 });
  } else if (e.what === 'fed') {
    popup('GULL GOD FED!', mid, BOARD.y + 30, { color: 'toxic3' });
  }
}


let scratch: HTMLCanvasElement | null = null;

/** A Contraband icon blown up by a whole number (loot cards, the shop), top-left at (x, y). */
export function drawPerkBig(g: CanvasRenderingContext2D, id: ContrabandId, x: number, y: number, scale: number): void {
  if (typeof document === 'undefined') return;
  if (!scratch) {
    scratch = document.createElement('canvas');
    scratch.width = 24;
    scratch.height = 24;
  }
  const cg = scratch.getContext('2d');
  if (!cg) return;
  cg.clearRect(0, 0, 24, 24);
  cg.imageSmoothingEnabled = false;
  drawPerk(cg, id, 0, 0);
  const old = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  g.drawImage(scratch, Math.round(x), Math.round(y), 24 * scale, 24 * scale);
  g.imageSmoothingEnabled = old;
}
