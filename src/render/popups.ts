// Marker-scrawl popups: "GROSS!", "+26", "NO ROOM!", "-1". Bitmap font with an ink0 keyline,
// drawn once into a little canvas and then blown up by whole numbers only. They pop in with a
// bounce, drift up, and blink out (no fading alpha on pixel art).
import type { PalName } from '../data/palette';
import { W } from '../engine/screen';
import type { Rect } from './layout';
import { drawText, lineHeight, textWidth } from './text';

export interface PopupOpts {
  color?: PalName;
  /** Drawn at 2x (after a 3x pop) instead of 1x (after a 2x pop). */
  big?: boolean;
  /** Seconds before it appears. */
  delay?: number;
  /** Seconds it lives once it's up. */
  life?: number;
  /** Pixels it drifts up over its life. */
  rise?: number;
  /** Keep the whole popup inside this rect (the board, the orders column, the truck lane). */
  clamp?: Rect;
}

interface Popup {
  img: HTMLCanvasElement;
  x: number;
  y: number;
  big: boolean;
  age: number;
  delay: number;
  life: number;
  rise: number;
  clamp: Rect | null;
}

const MAX = 16;
const live: Popup[] = [];
const cache = new Map<string, HTMLCanvasElement>();

/** The text (with an ink0 keyline unless `outline` is null) at 1x, in a canvas just big enough. */
export function textCanvas(text: string, color: PalName, outline: PalName | null = 'ink0'): HTMLCanvasElement {
  const key = `${color}|${outline ?? ''}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size > 64) cache.clear();
  const c = document.createElement('canvas');
  c.width = textWidth(text) + 2;
  c.height = lineHeight() + 2;
  const g = c.getContext('2d');
  if (g) {
    g.imageSmoothingEnabled = false;
    drawText(g, text, 1, 1, outline ? { color, outline } : { color });
  }
  cache.set(key, c);
  return c;
}

/** A popup centred on x with its middle at y (logical pixels). */
export function popup(text: string, x: number, y: number, o: PopupOpts = {}): void {
  if (typeof document === 'undefined') return;
  if (live.length >= MAX) live.shift();
  live.push({
    img: textCanvas(text, o.color ?? 'bone'),
    x,
    y,
    big: o.big ?? false,
    age: 0,
    delay: o.delay ?? 0,
    life: o.life ?? (o.big ? 1.3 : 0.95),
    rise: o.rise ?? (o.big ? 10 : 14),
    clamp: o.clamp ?? null,
  });
}

export function updatePopups(dt: number): void {
  for (let i = live.length - 1; i >= 0; i--) {
    const p = live[i];
    if (!p) continue;
    if (p.delay > 0) {
      p.delay -= dt;
      continue;
    }
    p.age += dt;
    if (p.age >= p.life) live.splice(i, 1);
  }
}

export function drawPopups(g: CanvasRenderingContext2D): void {
  for (const p of live) {
    if (p.delay > 0) continue;
    const k = p.age / p.life;
    // Blink out over the last quarter.
    if (k > 0.75 && Math.floor(p.age * 24) % 2 === 1) continue;
    // Pops in one size up for a few frames, then sits at its size.
    const scale = (p.big ? 2 : 1) + (p.age < 0.07 ? 1 : 0);
    // A damped bounce on the way in, then a steady drift up.
    const bounce = 5 * Math.exp(-p.age * 14) * Math.cos(p.age * 30);
    const w = p.img.width * scale;
    const h = p.img.height * scale;
    const cx = Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, p.x));
    let x = Math.round(cx - w / 2);
    let y = Math.round(p.y - h / 2 + bounce - p.rise * k);
    const c = p.clamp;
    if (c) {
      x = Math.max(c.x, Math.min(c.x + c.w - w, x));
      y = Math.max(c.y, Math.min(c.y + c.h - h, y));
    }
    g.drawImage(p.img, 0, 0, p.img.width, p.img.height, x, y, w, h);
  }
}

export function resetPopups(): void {
  live.length = 0;
}
