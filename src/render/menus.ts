// The menu kit: cardboard buttons (9-slice `button` / `button_down`, the label nudged down a
// pixel while pressed), cardboard panels, paper notes, the clipboard, price tags, speech bubbles,
// tooltips, rubber stamps, big text, and item silhouettes for the Almanac. Every sprite falls
// back to a greybox stand-in. Mouse and touch: a button clicks when it's pressed and released
// over the same button; keys can press it too.
import { playUi } from '../audio';
import type { ItemId } from '../data/items';
import { PAL, type PalName } from '../data/palette';
import { H, W, viewRect } from '../engine/screen';
import type { Input } from '../engine/input';
import type { SceneId } from '../game/state';
import { paintBackdrop } from './backdrop';
import { drawItem } from './board';
import { cardboard, fillRect, outlineRect, paper, placeholderBackdrop } from './greybox';
import { inRect, type Rect } from './layout';
import { drawNine, drawSprite, has, sprite, type DrawOpts } from './sprites';
import { drawText, lineHeight, textWidth, wrapText, type TextOpts } from './text';

// ---------------------------------------------------------------------------------------------
// Buttons

export interface Btn {
  id: string;
  r: Rect;
  label: string;
  /** A 16 x 16 icon left of the label. */
  icon?: string;
  disabled?: boolean;
  /** KeyboardEvent.code values that press it. */
  keys?: readonly string[];
  /** Shown in a tooltip while hovered. */
  tip?: string;
  /** The sound of pressing it ('none' when the scene plays its own). */
  sound?: 'click' | 'back' | 'none';
}

/** Is any menu pointing at something clickable right now? (The cursor shows the pointing paw.) */
let pointing = false;

export function menuPointing(): boolean {
  return pointing;
}

/** Scenes with their own clickable things (Swap Meet tags, Almanac cells) report them here. */
export function setMenuPointing(on: boolean): void {
  pointing = on;
}

/** One set of buttons: tracks hover and press, returns clicks. Keep one per scene. */
export class Buttons {
  hover: string | null = null;
  private held: string | null = null;

  /** Run once per update. Returns the id of the button clicked this step, or null. */
  update(input: Input, list: readonly Btn[]): string | null {
    const at = (x: number, y: number): Btn | undefined => list.find((b) => inRect(b.r, x, y));
    const over = at(input.x, input.y);
    const hov = over && !over.disabled ? over.id : null;
    if (hov && hov !== this.hover) playUi('hover');
    this.hover = hov;
    pointing = hov !== null;

    let clicked: Btn | null = null;
    if (input.pressed) {
      const b = at(input.pressX, input.pressY);
      this.held = b ? b.id : null;
      if (b?.disabled) playUi('back');
    }
    if (input.released) {
      const b = at(input.x, input.y);
      if (b && b.id === this.held && !b.disabled) clicked = b;
      this.held = null;
    }
    if (!clicked) clicked = list.find((b) => !b.disabled && b.keys?.some((k) => input.hit(k))) ?? null;
    if (!clicked) return null;
    const snd = clicked.sound ?? 'click';
    if (snd !== 'none') playUi(snd);
    return clicked.id;
  }

  /** Is this button held down right now (pressed on it, pointer still over it)? */
  isDown(input: Input, b: Btn): boolean {
    return this.held === b.id && input.down && inRect(b.r, input.x, input.y);
  }

  draw(g: CanvasRenderingContext2D, input: Input, list: readonly Btn[]): void {
    for (const b of list) {
      const state: BtnState = b.disabled ? 'disabled' : this.isDown(input, b) ? 'down' : this.hover === b.id ? 'hover' : 'idle';
      drawButton(g, b.r, b.label, state, b.icon);
    }
    const tip = list.find((b) => b.id === this.hover)?.tip;
    if (tip) drawTooltip(g, tip, input.x, input.y);
  }

  reset(): void {
    this.hover = null;
    this.held = null;
  }
}

export type BtnState = 'idle' | 'hover' | 'down' | 'disabled';

export function drawButton(g: CanvasRenderingContext2D, r: Rect, label: string, state: BtnState, icon?: string): void {
  const down = state === 'down';
  const a = g.globalAlpha;
  if (state === 'disabled') g.globalAlpha = a * 0.55;
  if (state === 'hover') outlineRect(g, { x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }, 'sodium3');
  if (!drawNine(g, down ? 'button_down' : 'button', r)) {
    cardboard(g, { x: r.x, y: r.y + (down ? 1 : 0), w: r.w, h: r.h - (down ? 1 : 0) }, false);
    outlineRect(g, r, 'ink0');
  }
  const nudge = down ? 1 : 0;
  const iw = icon ? 20 : 0;
  const tw = textWidth(label);
  const x0 = Math.round(r.x + (r.w - tw - iw) / 2);
  const ty = Math.round(r.y + (r.h - lineHeight()) / 2) + nudge;
  if (icon) drawIcon(g, icon, x0, ty - 3, 'card3');
  drawText(g, label, x0 + iw, ty, { color: state === 'disabled' ? 'ink2' : 'ink0' });
  g.globalAlpha = a;
}

/** A row of buttons centred on cx, each `w` wide, `gap` apart. */
export function buttonRow(ids: [string, string, Partial<Btn>?][], cx: number, y: number, w: number, h = 20, gap = 8): Btn[] {
  const total = ids.length * w + (ids.length - 1) * gap;
  const x0 = Math.round(cx - total / 2);
  return ids.map(([id, label, extra], i) => ({ id, label, r: { x: x0 + i * (w + gap), y, w, h }, ...extra }));
}

/** A column of buttons centred on cx. */
export function buttonColumn(ids: [string, string, Partial<Btn>?][], cx: number, y: number, w: number, h = 20, gap = 6): Btn[] {
  return ids.map(([id, label, extra], i) => ({ id, label, r: { x: Math.round(cx - w / 2), y: y + i * (h + gap), w, h }, ...extra }));
}

// ---------------------------------------------------------------------------------------------
// Panels and notes

export function drawPanel(g: CanvasRenderingContext2D, r: Rect, tape = true): void {
  if (!drawNine(g, 'panel', r)) cardboard(g, r, false);
  if (tape) {
    drawTape(g, r.x + 10, r.y - 3);
    drawTape(g, r.x + r.w - 30, r.y - 3);
  }
}

export function drawPaper(g: CanvasRenderingContext2D, r: Rect): void {
  if (!drawNine(g, 'paper', r)) paper(g, r);
}

/** A strip of duct tape, top-left at (x, y). */
export function drawTape(g: CanvasRenderingContext2D, x: number, y: number, vertical = false): void {
  const name = vertical ? 'tape_v' : 'tape_h';
  const d = sprite(name);
  if (d && drawSprite(g, name, x + d.ax, y + d.ay)) return;
  fillRect(g, vertical ? { x, y, w: 7, h: 18 } : { x, y, w: 18, h: 7 }, 'steel3');
}

/** Inspector Possum's clipboard over r, with the clip on top. Returns the writing area. */
export function drawClipboard(g: CanvasRenderingContext2D, r: Rect): Rect {
  if (!drawNine(g, 'clipboard', r)) {
    fillRect(g, { x: r.x + 2, y: r.y + 2, w: r.w, h: r.h }, 'ink0');
    fillRect(g, r, 'card0');
    paper(g, { x: r.x + 6, y: r.y + 6, w: r.w - 12, h: r.h - 12 });
  }
  if (!drawSprite(g, 'clipboard_clip', r.x + r.w / 2, r.y + 8)) {
    fillRect(g, { x: r.x + r.w / 2 - 20, y: r.y - 6, w: 40, h: 12 }, 'ink0');
    fillRect(g, { x: r.x + r.w / 2 - 19, y: r.y - 5, w: 38, h: 10 }, 'steel2');
  }
  return { x: r.x + 12, y: r.y + 12, w: r.w - 24, h: r.h - 20 };
}

/** A price tag on a string over r (the string takes the top 6 px). Text goes at (x+11, y+8). */
export function drawPriceTag(g: CanvasRenderingContext2D, r: Rect): void {
  if (drawNine(g, 'price_tag', r)) return;
  fillRect(g, { x: r.x + 4, y: r.y, w: 1, h: 7 }, 'bone');
  fillRect(g, { x: r.x, y: r.y + 6, w: r.w, h: r.h - 6 }, 'ink0');
  fillRect(g, { x: r.x + 1, y: r.y + 7, w: r.w - 2, h: r.h - 8 }, 'card3');
  fillRect(g, { x: r.x + 4, y: r.y + 9, w: 2, h: 2 }, 'ink0');
}

/** A one-line speech bubble with its tail pointing down at tailX. */
export function drawSpeech(g: CanvasRenderingContext2D, text: string, x: number, y: number, tailX?: number): Rect {
  const r = { x: Math.round(x), y: Math.round(y), w: textWidth(text) + 16, h: 23 };
  if (!drawNine(g, 'speech', r)) {
    fillRect(g, { x: r.x, y: r.y, w: r.w, h: r.h }, 'ink0');
    fillRect(g, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, 'bone');
  }
  const tx = Math.max(r.x + 4, Math.min(r.x + r.w - 12, Math.round(tailX ?? r.x + 10)));
  if (!drawSprite(g, 'speech_tail', tx + 4, r.y + r.h - 1)) fillRect(g, { x: tx, y: r.y + r.h - 1, w: 4, h: 4 }, 'bone');
  drawText(g, text, r.x + 8, r.y + 5, { color: 'ink0' });
  return r;
}

/** A paper note under the pointer, kept on screen. */
export function drawTooltip(g: CanvasRenderingContext2D, text: string, px: number, py: number): void {
  const lines = wrapText(text, 170);
  const w = Math.max(...lines.map((l) => textWidth(l))) + 10;
  const h = lines.length * 10 + 6;
  let x = Math.round(px + 10);
  let y = Math.round(py + 14);
  if (x + w > W - 4) x = Math.round(px - w - 6);
  if (y + h > H - 4) y = Math.round(py - h - 6);
  const r = { x: Math.max(4, x), y: Math.max(4, y), w, h };
  fillRect(g, { x: r.x + 2, y: r.y + 2, w, h }, 'ink0');
  fillRect(g, r, 'bone');
  outlineRect(g, r, 'ink0');
  lines.forEach((l, i) => drawText(g, l, r.x + 5, r.y + 2 + i * 10, { color: 'ink0' }));
}

/**
 * A paper note anchored to a thing (not the pointer): above it, left of it or below it, kept on
 * screen. Used for the lot's tooltips and the Swap Meet's, so a tip never sits on a header.
 */
export function drawTooltipAt(g: CanvasRenderingContext2D, text: string, at: Rect, side: 'above' | 'left' | 'right' | 'below', maxW = 170): Rect {
  const lines = wrapText(text, maxW);
  const w = Math.max(...lines.map((l) => textWidth(l))) + 10;
  const h = lines.length * 10 + 6;
  let x = Math.round(at.x + at.w / 2 - w / 2);
  let y = Math.round(at.y - h - 4);
  if (side === 'left' || side === 'right') {
    x = Math.round(side === 'left' ? at.x - w - 6 : at.x + at.w + 6);
    y = Math.round(at.y + at.h / 2 - h / 2);
  } else if (side === 'below') {
    y = Math.round(at.y + at.h + 4);
  }
  const r = { x: Math.max(4, Math.min(W - w - 6, x)), y: Math.max(4, Math.min(H - h - 6, y)), w, h };
  fillRect(g, { x: r.x + 2, y: r.y + 2, w, h }, 'ink0');
  fillRect(g, r, 'bone');
  outlineRect(g, r, 'ink0');
  lines.forEach((l, i) => drawText(g, l, r.x + 5, r.y + 2 + i * 10, { color: 'ink0' }));
  return r;
}

/** A 16 x 16 icon with its top-left at (x, y), or a small coloured square. */
export function drawIcon(g: CanvasRenderingContext2D, name: string, x: number, y: number, fallback: PalName = 'sodium2'): void {
  const d = sprite(name);
  if (d && drawSprite(g, name, x + d.ax, y + d.ay)) return;
  fillRect(g, { x: x + 3, y: y + 3, w: 10, h: 10 }, 'ink0');
  fillRect(g, { x: x + 4, y: y + 4, w: 8, h: 8 }, fallback);
}

/** A sprite drawn with its top-left at (x, y) whatever its anchor; false if it isn't loaded. */
export function drawAt(g: CanvasRenderingContext2D, name: string, x: number, y: number, o: DrawOpts = {}): boolean {
  const d = sprite(name);
  return d ? drawSprite(g, name, x + d.ax, y + d.ay, o) : false;
}

/** The rubber stamp, slammed down: big for a moment, then flat. `t` is seconds since the slam. */
export function drawStamp(g: CanvasRenderingContext2D, won: boolean, cx: number, cy: number, t: number): void {
  if (t < 0) return;
  const k = t < 0.12 ? 1.5 - (t / 0.12) * 0.5 : 1;
  const name = won ? 'stamp_passed' : 'stamp_shutdown';
  if (drawSprite(g, name, cx, cy, { sx: k, sy: k })) return;
  const label = won ? 'PASSED' : 'SHUT DOWN';
  const w = Math.round((textWidth(label) * 2 + 16) * k);
  const h = Math.round(32 * k);
  const r = { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
  outlineRect(g, r, 'red', 2);
  bigText(g, label, cx, cy - 9, 2, { color: 'red', align: 'center' });
}

/** Dim the whole screen (the whole buffer, margins too) with ink. */
export function dim(g: CanvasRenderingContext2D, a: number): void {
  if (a <= 0) return;
  const old = g.globalAlpha;
  g.globalAlpha = Math.min(1, a);
  g.fillStyle = PAL.ink0;
  const v = viewRect();
  g.fillRect(v.x, v.y, v.w, v.h);
  g.globalAlpha = old;
}

/** A scene's backdrop (Lot 9 unless told otherwise) behind a menu, margins and all, dimmed a little. */
export function menuBackdrop(g: CanvasRenderingContext2D, t: number, dimBy = 0.35, scene: SceneId = 'lot9'): void {
  // The streetlight buzzes off for a blink now and then (frame 1).
  const flicker = Math.sin(t * 13) > 0.97 || (t % 7.3 > 7.1 && Math.sin(t * 40) > 0);
  if (!paintBackdrop(g, scene, flicker ? 1 : 0)) {
    placeholderBackdrop(g, t);
    const v = viewRect();
    fillRect(g, { x: v.x, y: 104, w: v.w, h: v.y + v.h - 104 }, 'dirt0');
  }
  dim(g, dimBy);
}

/** A fade in from black over the first `sec` seconds of a scene. */
export function fadeIn(g: CanvasRenderingContext2D, t: number, sec = 0.25): void {
  dim(g, 1 - t / sec);
}

// ---------------------------------------------------------------------------------------------
// Text

const big = new Map<string, HTMLCanvasElement>();

/**
 * One line of the marker font blown up by a whole number (2x for headings, 3x for the night
 * number), drawn through a cached offscreen copy so it stays crisp.
 */
export function bigText(g: CanvasRenderingContext2D, s: string, x: number, y: number, scale: number, o: TextOpts = {}): void {
  const key = `${s}|${scale}|${o.color ?? 'ink0'}|${o.outline ?? ''}|${has('item_cap') ? 1 : 0}|${textWidth('W')}`;
  let c = big.get(key);
  if (!c) {
    const pad = o.outline ? 1 : 0;
    const w = textWidth(s) + pad * 2;
    const h = lineHeight() + pad * 2;
    c = document.createElement('canvas');
    c.width = Math.max(1, w * scale);
    c.height = Math.max(1, h * scale);
    const small = document.createElement('canvas');
    small.width = Math.max(1, w);
    small.height = Math.max(1, h);
    const sg = small.getContext('2d');
    const cg = c.getContext('2d');
    if (sg && cg) {
      drawText(sg, s, pad, pad, { color: o.color, outline: o.outline });
      cg.imageSmoothingEnabled = false;
      cg.drawImage(small, 0, 0, c.width, c.height);
    }
    if (big.size > 200) big.clear();
    big.set(key, c);
  }
  const align = o.align ?? 'left';
  const left = align === 'center' ? x - c.width / 2 : align === 'right' ? x - c.width : x;
  g.drawImage(c, Math.round(left), Math.round(y));
}

/** "1,240" */
export function fmt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ---------------------------------------------------------------------------------------------
// Items

const shadows = new Map<string, HTMLCanvasElement>();

/** An item as a flat silhouette (the Almanac's undiscovered ones), foot at (fx, fy). */
export function drawSilhouette(g: CanvasRenderingContext2D, id: ItemId, fx: number, fy: number, color: PalName = 'night1', scale = 1): void {
  const key = `${id}|${color}|${has(`item_${id}`) ? 'art' : 'grey'}`;
  let c = shadows.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const cg = c.getContext('2d');
    if (cg) {
      cg.imageSmoothingEnabled = false;
      drawItem(cg, id, 16, 31, { phase: 0 });
      cg.globalCompositeOperation = 'source-in';
      cg.fillStyle = PAL[color];
      cg.fillRect(0, 0, 32, 32);
    }
    shadows.set(key, c);
  }
  g.drawImage(c, Math.round(fx - 16 * scale), Math.round(fy - 32 * scale + 1), 32 * scale, 32 * scale);
}

/** An item blown up by a whole number, foot at (fx, fy) (the Almanac's close-up, the King). */
let scratch: HTMLCanvasElement | null = null;

export function drawItemBig(g: CanvasRenderingContext2D, id: ItemId, fx: number, fy: number, scale: number, phase = 0): void {
  if (!scratch) {
    scratch = document.createElement('canvas');
    scratch.width = 32;
    scratch.height = 32;
  }
  const c = scratch;
  const cg = c.getContext('2d');
  if (!cg) return;
  cg.clearRect(0, 0, 32, 32);
  cg.imageSmoothingEnabled = false;
  drawItem(cg, id, 16, 31, { phase });
  const old = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  g.drawImage(c, Math.round(fx - 16 * scale), Math.round(fy - 32 * scale + 1), 32 * scale, 32 * scale);
  g.imageSmoothingEnabled = old;
}
