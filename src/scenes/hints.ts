// One-time prompts, remembered in the save's settings (`hintsSeen`), so each shows once per
// player, not once per run (docs/CRITIC.md P1-4, docs/CRITIC2.md N-P2-1..5):
//
//   dumpster  night 1, from 0:01 until the first Dumpster click: a bouncing paw, "click for junk"
//   order     night 1, over the first order: "drag it onto Gary!" with the piece ringed, or a
//             recipe ("[box] + [box] = [bag]") until one exists
//   crusher   night 1, the first time the lot is more than 60% full: merge pairs or crush
//   gull      any night, the first time a seagull lands: what it does and what to do about it
//
// Bubbles never sit on the board: they go in the margins (the truck lane, the right column) and
// point at what they're about, with a ring on the piece itself. The scene asks `update` each
// step, `event` for each game event, and `draw` each frame; nothing here changes the game.
import { ITEMS, type ItemId } from '../data/items';
import { tapWord } from '../engine/input';
import type { GameEvent } from '../game/events';
import { raccoonDef, wants } from '../game/orders';
import type { GameState } from '../game/state';
import { inFlight } from '../game/state';
import { cellFoot, drawItem } from '../render/board';
import { fillRect, outlineRect } from '../render/greybox';
import { BOARD, COMPACTOR, DUMPSTER, orderSlot, type Rect } from '../render/layout';
import { madeFrom } from '../render/orders';
import { drawNine, drawSprite } from '../render/sprites';
import { drawText, textWidth, wrapText } from '../render/text';
import type { View } from '../render/view';

export type HintId = 'dumpster' | 'order' | 'crusher' | 'gull';
export const HINT_IDS: readonly HintId[] = ['dumpster', 'order', 'crusher', 'gull'];

const CRUSHER_FILL = 0.6;
/** The Crusher hint goes once the lot is back under this, or after CRUSHER_MAX_SEC. */
const CRUSHER_CLEAR = 0.5;
const CRUSHER_MAX_SEC = 12;
/** The gull intro stays up this long (or until that gull is gone). */
const GULL_SEC = 7;

/** The truck lane's free stretch between the truck timer plate and where the truck parks. */
const LANE_X0 = 134;
const LANE_X1 = 470;

export class Hints {
  private readonly seen: Set<string>;
  private readonly onSeen: (id: HintId) => void;
  /** Seconds each hint has been up tonight. */
  private readonly up = new Map<HintId, number>();
  /** The seagull the gull intro is about (its uid), once one has landed. */
  private gullUid: number | null = null;

  constructor(seen: Iterable<string>, onSeen: (id: HintId) => void) {
    this.seen = new Set(seen);
    this.onSeen = onSeen;
  }

  /** Forget what's been shown (dev.wipe). */
  reset(): void {
    this.seen.clear();
    this.up.clear();
    this.gullUid = null;
  }

  /** A new night: the timers start over (what's been seen stays seen). */
  night(): void {
    this.up.clear();
    this.gullUid = null;
  }

  private mark(id: HintId): void {
    if (this.seen.has(id)) return;
    this.seen.add(id);
    this.up.delete(id);
    this.onSeen(id);
  }

  /** The first seagull ever to land on the lot gets the intro. */
  event(s: GameState, e: GameEvent): void {
    if (e.type !== 'gullArrive' || this.seen.has('gull') || this.gullUid !== null) return;
    const p = s.board.get(e.c, e.r);
    if (p) this.gullUid = p.uid;
  }

  private on(s: GameState, id: HintId): boolean {
    if (this.seen.has(id) || s.status !== 'playing') return false;
    if (id === 'gull') return this.gullUid !== null;
    if (s.night !== 1 || s.goal !== 'quota') return false;
    switch (id) {
      case 'dumpster':
        return s.time >= 1;
      case 'order':
        return s.orders.some((o) => o?.mood === 'waiting');
      case 'crusher':
        return this.up.has('crusher') || s.board.fillRatio() > CRUSHER_FILL;
    }
  }

  update(s: GameState, dt: number): void {
    // Done when the player has done the thing.
    if (s.stats.dumpsterClicks > 0) this.mark('dumpster');
    if (s.stats.itemsDelivered > 0) this.mark('order');
    if (s.stats.compacted > 0 && this.up.has('crusher')) this.mark('crusher');
    for (const id of HINT_IDS) {
      if (!this.on(s, id)) continue;
      const t = (this.up.get(id) ?? 0) + dt;
      this.up.set(id, t);
      if (id === 'crusher' && (t > CRUSHER_MAX_SEC || (t > 2 && s.board.fillRatio() < CRUSHER_CLEAR))) this.mark('crusher');
      if (id === 'gull' && (t > GULL_SEC || (t > 1.5 && !gullCell(s, this.gullUid)))) this.mark('gull');
    }
  }

  draw(g: CanvasRenderingContext2D, s: GameState, v: View): void {
    if (s.status !== 'playing') return;
    const gull = this.on(s, 'gull') && this.drawGull(g, s, v);
    if (this.on(s, 'dumpster')) this.drawDumpster(g, v);
    if (this.on(s, 'order')) this.drawOrder(g, s, v, gull);
    if (this.on(s, 'crusher')) this.drawCrusher(g, v);
  }

  private drawDumpster(g: CanvasRenderingContext2D, v: View): void {
    const t = this.up.get('dumpster') ?? 0;
    // A paw tapping the lid.
    const tap = Math.abs(Math.sin(v.t * 5)) * 5;
    const px = DUMPSTER.x + 30;
    const py = DUMPSTER.y + 14 - Math.round(tap);
    if (!drawSprite(g, 'cursor_point', px, py)) {
      fillRect(g, { x: px - 3, y: py, w: 7, h: 9 }, 'ink0');
      fillRect(g, { x: px - 2, y: py + 1, w: 5, h: 7 }, 'bone');
    }
    // Above the Dumpster, in the lane.
    const lines = [`${tapWord()} for junk!`];
    const w = boxW(lines);
    const box = { x: DUMPSTER.x + 24 - Math.round(w / 2), y: DUMPSTER.y - 26, w, h: boxH(lines) };
    bubble(g, box, { x: DUMPSTER.x + 24, y: DUMPSTER.y - 2 }, v.t, t, (r) => textLines(g, lines, r));
  }

  private drawOrder(g: CanvasRenderingContext2D, s: GameState, v: View, quiet: boolean): void {
    const t = this.up.get('order') ?? 0;
    // Holding something a raccoon wants: the card lights up by itself, nothing to add.
    const held = s.drag ? s.board.get(s.drag.c, s.drag.r) : null;
    if (held && s.orders.some((_, i) => wants(s, i, held.id))) return;
    // The first waiting raccoon, and a piece on the lot it wants, if there is one.
    let slot = -1;
    let at: [number, number] | null = null;
    for (let i = 0; i < s.orders.length && !at; i++) {
      const o = s.orders[i];
      if (!o || o.mood !== 'waiting') continue;
      if (slot < 0) slot = i;
      for (const { p, c, r } of s.board.pieces()) {
        if (inFlight(s, p.uid) || p.uid === s.drag?.uid) continue;
        if (o.wants.some((w, k) => w === p.id && !o.got[k])) {
          slot = i;
          at = [c, r];
          break;
        }
      }
    }
    const o = s.orders[slot];
    if (slot < 0 || !o) return;
    const card = orderSlot(slot);
    const who = raccoonDef(o.raccoon).name.split(' ').pop() ?? 'them';
    const pulse = Math.sin(v.t * 8) > 0;
    if (at) {
      // Ring the piece they want, and point at the raccoon.
      const f = cellFoot(at[0], at[1]);
      outlineRect(g, { x: f.x - 17, y: f.y - 32, w: 34, h: 34 }, pulse ? 'yellow' : 'sodium3', 2);
    } else if (t < 2.5) return;
    // Who it's for: a ring round the card and an arrow in the gutter, pointing at it.
    outlineRect(g, { x: card.x - 2, y: card.y - 2, w: card.w + 4, h: card.h + 4 }, pulse ? 'yellow' : 'sodium3');
    gutterArrow(g, card.x + card.w + 1, card.y + Math.round(card.h / 2), v.t);
    if (quiet) return;
    // The tail points down at the top card only: to a lower one it would cross the cards above
    // (that one's marked by the ring, the arrow and its name in the bubble).
    const tail = slot === 0 ? { x: card.x + card.w - 14, y: card.y - 2 } : null;
    if (at) {
      const lines = [`Drag it onto ${who}!`];
      bubble(g, laneBox(boxW(lines), boxH(lines), card.x + card.w - 14), tail, v.t, t, (r) => textLines(g, lines, r));
      return;
    }
    // Nothing they want on the lot yet: how to make it, as a picture.
    const want = o.wants.find((_, k) => !o.got[k]) ?? o.wants[0] ?? 'cap';
    const from = madeFrom(want);
    const head = from ? `Make ${who} a ${ITEMS[want].name}:` : `${who} wants a ${ITEMS[want].name}.`;
    const w = Math.max(textWidth(head), 118) + 14;
    const h = from ? 50 : boxH([head]);
    bubble(g, laneBox(w, h, card.x + card.w - 14), tail, v.t, t - 2.5, (r) => {
      drawText(g, head, r.x + 7, r.y + 4, { color: 'ink0' });
      if (from) recipe(g, from, want, r.x + 7, r.y + 46, v.t);
    });
  }

  private drawCrusher(g: CanvasRenderingContext2D, v: View): void {
    const t = this.up.get('crusher') ?? 0;
    // Above the Crusher, right of the jar (over the lid line, which it's about anyway).
    const lines = wrapText('Lot filling up? Merge pairs, or drag junk into the Crusher.', 104);
    const w = boxW(lines);
    const h = boxH(lines);
    const box = { x: 634 - w, y: COMPACTOR.y - 8 - h, w, h };
    bubble(g, box, { x: COMPACTOR.x + 24, y: COMPACTOR.y + 4 }, v.t, t, (r) => textLines(g, lines, r));
  }

  /** The first seagull: ringed where it sits, the bubble in the lane above its column. */
  private drawGull(g: CanvasRenderingContext2D, s: GameState, v: View): boolean {
    const t = this.up.get('gull') ?? 0;
    const at = gullCell(s, this.gullUid);
    if (!at || t < 0.9) return false;
    const f = cellFoot(at[0], at[1]);
    const pulse = Math.sin(v.t * 8) > 0;
    outlineRect(g, { x: f.x - 17, y: f.y - 32, w: 34, h: 34 }, pulse ? 'white' : 'sodium3', 2);
    const lines = wrapText('Seagull! It eats small junk. Crush it, or merge two.', 150);
    bubble(g, laneBox(boxW(lines), boxH(lines), f.x), { x: f.x, y: BOARD.y - 3 }, v.t, t - 0.9, (r) => textLines(g, lines, r));
    return true;
  }
}

/** Where a seagull is now (it hops), or null once it's gone (eaten, merged, crushed). */
function gullCell(s: GameState, uid: number | null): [number, number] | null {
  if (uid === null) return null;
  for (const { p, c, r } of s.board.pieces()) if (p.uid === uid) return [c, r];
  return null;
}

/** "[a] + [a] = [b]" in items, feet on y. */
function recipe(g: CanvasRenderingContext2D, a: ItemId, b: ItemId, x: number, y: number, t: number): void {
  const hop = Math.floor(t * 3) % 3;
  drawItem(g, a, x + 16, y - (hop === 0 ? 1 : 0), { phase: 0 });
  drawText(g, '+', x + 36, y - 20, { color: 'ink0' });
  drawItem(g, a, x + 56, y - (hop === 1 ? 1 : 0), { phase: 1 });
  drawText(g, '=', x + 76, y - 20, { color: 'rust1' });
  drawItem(g, b, x + 98, y - (hop === 2 ? 1 : 0), { phase: 2 });
}

function boxW(lines: readonly string[]): number {
  return Math.max(...lines.map((l) => textWidth(l))) + 14;
}

function boxH(lines: readonly string[]): number {
  return lines.length * 10 + 9;
}

function textLines(g: CanvasRenderingContext2D, lines: readonly string[], r: Rect): void {
  lines.forEach((l, i) => drawText(g, l, r.x + 7, r.y + 4 + i * 10, { color: 'ink0' }));
}

/** A box in the truck lane (clear of the timer plate), as near above x as it fits. */
function laneBox(w: number, h: number, x: number): Rect {
  const bx = Math.max(LANE_X0, Math.min(LANE_X1 - w, Math.round(x - w / 2)));
  return { x: bx, y: 101 - h, w, h };
}

/** A small arrow in the gap between the orders and the board, pointing left at a card. */
function gutterArrow(g: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const nudge = Math.floor(t * 6) % 2;
  const ax = x + 1 + nudge;
  for (let i = 0; i < 4; i++) {
    fillRect(g, { x: ax + i - 1, y: y - i - 1, w: 3, h: i * 2 + 3 }, 'ink0');
  }
  for (let i = 0; i < 4; i++) fillRect(g, { x: ax + i, y: y - i, w: 1, h: i * 2 + 1 }, 'yellow');
}

/**
 * A speech-paper hint in `box`, with its tail running to (tx, ty) from the nearest edge. Bobs
 * a pixel toward what it points at, and drops in over its first 0.2 s.
 */
function bubble(g: CanvasRenderingContext2D, box: Rect, tip: { x: number; y: number } | null, t: number, age: number, content: (r: Rect) => void): void {
  if (age < 0) return;
  const below = tip !== null && tip.y >= box.y + box.h;
  const above = tip !== null && tip.y < box.y;
  const dir: 'down' | 'up' | 'left' | 'right' = !tip || below ? 'down' : above ? 'up' : tip.x < box.x ? 'left' : 'right';
  const bob = Math.round(Math.sin(t * 5) * 1.5);
  const pop = age < 0.2 ? Math.round((1 - age / 0.2) * 6) : 0;
  const r = { ...box };
  if (dir === 'down') r.y += bob - pop;
  else if (dir === 'up') r.y -= bob - pop;
  else if (dir === 'left') r.x -= bob - pop;
  else r.x += bob - pop;
  r.x = Math.max(2, Math.min(638 - r.w, r.x));
  fillRect(g, { x: r.x + 2, y: r.y + 2, w: r.w, h: r.h }, 'ink0');
  if (!drawNine(g, 'speech', r)) {
    fillRect(g, r, 'bone');
    outlineRect(g, r, 'ink0');
  }
  outlineRect(g, { x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }, 'sodium3');
  // The tail: a stepped wedge from the edge toward the point, as long as it needs to be.
  if (!tip) {
    // (No tail.)
  } else if (dir === 'down' || dir === 'up') {
    const cx = Math.max(r.x + 7, Math.min(r.x + r.w - 7, tip.x));
    const y0 = dir === 'down' ? r.y + r.h : r.y - 1;
    const len = Math.max(4, Math.abs(tip.y - y0));
    const step = dir === 'down' ? 1 : -1;
    for (let i = 0; i < len; i++) {
      const k = Math.max(0, Math.round(4 * (1 - i / len)));
      // Leans toward the point when the bubble couldn't sit right over it.
      const x = Math.round(cx + ((tip.x - cx) * i) / len);
      fillRect(g, { x: x - k - 1, y: y0 + i * step, w: k * 2 + 3, h: 1 }, 'ink0');
      if (k > 0) fillRect(g, { x: x - k + 1, y: y0 + i * step - step, w: k * 2 - 1, h: 1 }, 'bone');
    }
  } else {
    const cy = Math.max(r.y + 5, Math.min(r.y + r.h - 5, tip.y));
    const x0 = dir === 'left' ? r.x - 1 : r.x + r.w;
    const step = dir === 'left' ? -1 : 1;
    for (let i = 0; i < 5; i++) {
      const k = 5 - i;
      fillRect(g, { x: x0 + i * step, y: cy - k - 1, w: 1, h: k * 2 + 2 }, 'ink0');
      fillRect(g, { x: x0 + i * step - step, y: cy - k + 1, w: 1, h: Math.max(1, k * 2 - 2) }, 'bone');
    }
  }
  content(r);
}
