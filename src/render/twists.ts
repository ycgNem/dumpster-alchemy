// Each night's twist, made visible (the numbers are in src/data/nights.ts; this is only the look):
//
//   Seagull Season   gulls circling in the sky
//   Heat Wave        the backdrop shimmers, the Stink jar sweats (junk turns smelly twice as fast)
//   Full Moon        a moon in the sky (raccoons howl when they storm off: fx.ts)
//   Rush Hour        a second truck honks past in the lane now and then
//   Bulk Pickup      a BULK sign on the truck
//   The Inspection   Inspector Possum paces the fence (possum.ts)
//   Spring Cleaning  bunting and a SPRING CLEANING banner
//   Endless          the clock goes red past 6 AM (hud.ts)
//
// Drawn by code with the sprites there are; `moon` and `gull_fly` are used when the art lands.
import { PAL, type PalName } from '../data/palette';
import type { GameState } from '../game/state';
import { fillRect, outlineRect, placeholderTruck } from './greybox';
import { STINK, TRUCK_LANE, TRUCK_STOP } from './layout';
import { popup } from './popups';
import { truckPose } from './props';
import { drawSprite, sprite } from './sprites';
import { drawText, textWidth } from './text';
import type { View } from './view';

export type Twist = 'gulls' | 'heat' | 'moon' | 'rush' | 'bulk' | 'inspection' | 'spring' | 'endless';

/** Which twist tonight has (nights 1-3 have none: they teach the basics). */
export function twistOf(s: GameState): Twist | null {
  if (s.goal === 'endless') return 'endless';
  switch (s.night) {
    case 4:
      return 'gulls';
    case 5:
      return 'heat';
    case 6:
      return 'rush';
    case 7:
      return 'moon';
    case 8:
      return 'bulk';
    case 9:
      return 'inspection';
    case 10:
      return 'spring';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Rush Hour: the other truck.

const rush = { x: 0, on: false, since: 0, honked: false };
const RUSH_EVERY = 17;
const RUSH_SPEED = 250;

export function resetTwists(): void {
  rush.on = false;
  rush.since = 8;
  rush.honked = false;
}

export function updateTwists(s: GameState, dt: number): void {
  if (twistOf(s) !== 'rush' || s.status !== 'playing') return;
  if (!rush.on) {
    rush.since += dt;
    // Only while our truck is away and not due for a while, so they never overlap.
    if (rush.since > RUSH_EVERY && s.truck.phase === 'away' && s.truck.timer > 6) {
      rush.on = true;
      rush.x = -70;
      rush.honked = false;
    }
    return;
  }
  rush.x += RUSH_SPEED * dt;
  if (!rush.honked && rush.x > 120) {
    rush.honked = true;
    popup('HONK HONK!', rush.x + 30, TRUCK_LANE.y + 10, { color: 'yellow', clamp: TRUCK_LANE, rise: 4 });
  }
  if (rush.x > 720) {
    rush.on = false;
    rush.since = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// Sky and backdrop (after the backdrop, before the truck).

export function drawTwistSky(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  const tw = twistOf(s);
  if (tw === 'heat') shimmer(g, v.t);
  else if (tw === 'gulls') circlingGulls(g, v.t);
  else if (tw === 'moon') moon(g, v.t);
  else if (tw === 'spring') bunting(g, v.t);
  else if (tw === 'rush' && rush.on) otherTruck(g, v);
}

/** The backdrop's sky and fence wobble sideways in thin strips, like air over hot tarmac, under a warm haze. */
function shimmer(g: CanvasRenderingContext2D, t: number): void {
  const d = sprite('backdrop');
  if (d) {
    for (let y = 16; y < 104; y += 2) {
      const off = Math.round(Math.sin(t * 3.1 + y * 0.42) * (1 + Math.sin(t * 0.9 + y * 0.07)) * 1.2);
      if (off === 0) continue;
      g.drawImage(d.img, d.x, d.y + y, d.w, 2, off, y, d.w, 2);
    }
  }
  const h = haze();
  if (h) g.drawImage(h, 0, Math.round(Math.sin(t * 1.3)));
}

let hazeImg: HTMLCanvasElement | null = null;

/** A warm ordered-dither glow rising off the heaps (thickest at the lane, thinning upward). */
function haze(): HTMLCanvasElement | null {
  if (hazeImg) return hazeImg;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 104;
  const g = c.getContext('2d');
  if (!g) return null;
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 20; y < 104; y++) {
    const dens = Math.max(0, (y - 20) / 84) * 0.42;
    for (let x = 0; x < 640; x++) {
      const th = ((bayer[(y % 4) * 4 + (x % 4)] ?? 0) + 0.5) / 16;
      if (dens <= th) continue;
      g.fillStyle = PAL[y > 70 ? 'rust0' : (x + y) % 7 === 0 ? 'sodium0' : 'rust0'];
      g.fillRect(x, y, 1, 1);
    }
  }
  hazeImg = c;
  return c;
}

/** Five gulls wheeling over the lot, out of step. */
function circlingGulls(g: CanvasRenderingContext2D, t: number): void {
  for (let i = 0; i < 5; i++) {
    const a = t * (0.55 + i * 0.07) + i * 1.3;
    const cx = 300 + i * 34;
    const x = Math.round(cx + Math.cos(a) * (40 + i * 9));
    const y = Math.round(31 + Math.sin(a) * (9 + (i % 3) * 3));
    const left = Math.sin(a) > 0; // heading left on the near half of the loop
    const flap = Math.floor(t * 6 + i) % 2;
    if (drawSprite(g, 'gull_fly', x, y + 8, { frame: flap, flip: left })) continue;
    // A white "v" with a sodium rim on top (STYLE.md: things against the sky get a rim).
    const wing = flap ? 1 : 0;
    fillRect(g, { x: x - 4, y: y - 1 + wing, w: 9, h: 3 }, 'ink0');
    fillRect(g, { x: x - 3, y: y + wing, w: 3, h: 1 }, 'white');
    fillRect(g, { x: x + 1, y: y + wing, w: 3, h: 1 }, 'white');
    fillRect(g, { x: x - 1, y: y + 1, w: 3, h: 1 }, 'white');
    fillRect(g, { x: x + (left ? -2 : 2), y: y + 1, w: 1, h: 1 }, 'yellow');
  }
}

/** A fat moon over the heaps, with a cool halo. */
function moon(g: CanvasRenderingContext2D, t: number): void {
  const cx = 482;
  const cy = 36;
  // The halo: a ring of dithered night3 pixels.
  for (let a = 0; a < 48; a++) {
    const ang = (a / 48) * Math.PI * 2;
    const r = 20 + ((a * 7) % 3);
    if ((a + Math.floor(t * 2)) % 3 === 0) continue;
    fillRect(g, { x: Math.round(cx + Math.cos(ang) * r), y: Math.round(cy + Math.sin(ang) * r), w: 1, h: 1 }, 'night3');
  }
  if (drawSprite(g, 'moon', cx, cy + 15)) return;
  const disc = (r: number, c: PalName, dx = 0, dy = 0): void => {
    for (let y = -r; y <= r; y++) {
      const w = Math.round(Math.sqrt(r * r - y * y));
      fillRect(g, { x: cx + dx - w, y: cy + dy + y, w: w * 2 + 1, h: 1 }, c);
    }
  };
  disc(14, 'ink0');
  disc(13, 'bone');
  disc(9, 'white', -3, -3);
  disc(3, 'steel3', 4, 3);
  disc(2, 'steel3', -5, 5);
  disc(2, 'steel3', 6, -6);
}

/** Bunting strung along the fence and the banner in the middle. */
function bunting(g: CanvasRenderingContext2D, t: number): void {
  const colours: PalName[] = ['red', 'yellow', 'blue', 'pink', 'toxic2', 'bone'];
  const y0 = 24;
  const sag = (x: number): number => y0 + Math.round(Math.sin(((x % 213) / 213) * Math.PI) * 8);
  for (let x = 0; x < 640; x += 2) fillRect(g, { x, y: sag(x), w: 2, h: 1 }, 'ink1');
  for (let i = 0; i < 640 / 14; i++) {
    const x = i * 14 + 3;
    const y = sag(x) + 1;
    const flutter = Math.floor(t * 4 + i) % 3 === 0 ? 1 : 0;
    const c = colours[i % colours.length] ?? 'red';
    for (let r = 0; r < 6; r++) {
      const w = 7 - r;
      fillRect(g, { x: x + Math.floor(r / 2) + flutter * (r > 3 ? 1 : 0), y: y + r, w: Math.max(1, w - Math.floor(r / 2)), h: 1 }, c);
    }
  }
  // The banner: a cloth strip hung from the string.
  const text = 'SPRING CLEANING';
  const w = textWidth(text) + 16;
  const r = { x: Math.round(320 - w / 2), y: 22, w, h: 15 };
  fillRect(g, { x: r.x + 2, y: r.y + 2, w: r.w, h: r.h }, 'ink0');
  fillRect(g, r, 'bone');
  fillRect(g, { x: r.x, y: r.y + r.h - 2, w: r.w, h: 2 }, 'pink');
  outlineRect(g, r, 'ink0');
  drawText(g, text, 320, r.y + 2, { color: 'rust1', align: 'center' });
}

/** Rush Hour: another garbage truck, on its own route, too fast. */
function otherTruck(g: CanvasRenderingContext2D, v: View): void {
  const x = Math.round(rush.x);
  const y = TRUCK_STOP.y - 3 + (Math.sin(v.t * 30) > 0.5 ? -1 : 0);
  if (!drawSprite(g, 'truck_drive', x, y)) placeholderTruck(g, x, y, Math.floor(v.t * 12), 0, false);
}

// ---------------------------------------------------------------------------------------------
// On the lot (after the truck, the board and the HUD).

export function drawTwistLot(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  const tw = twistOf(s);
  if (tw === 'bulk') bulkSign(g, s);
  // (Heat Wave's flies are the smelly junk's now, fx.ts: flies mean "clear this".)
  else if (tw === 'heat') sweat(g, v.t);
}

function bulkSign(g: CanvasRenderingContext2D, s: GameState): void {
  const pose = truckPose(s);
  if (!pose.visible) return;
  const x = Math.round(pose.x) - 44;
  const y = TRUCK_STOP.y - 62 - (pose.bed === 2 ? 4 : pose.bed === 1 ? 2 : 0);
  const text = 'BULK';
  const r = { x, y, w: textWidth(text) + 10, h: 13 };
  fillRect(g, { x: r.x + 4, y: r.y + r.h, w: 1, h: 6 }, 'ink0');
  fillRect(g, { x: r.x + r.w - 5, y: r.y + r.h, w: 1, h: 6 }, 'ink0');
  fillRect(g, { x: r.x + 1, y: r.y + 1, w: r.w, h: r.h }, 'ink0');
  fillRect(g, r, 'yellow');
  outlineRect(g, r, 'ink0');
  for (let i = 0; i < r.w; i += 6) fillRect(g, { x: r.x + i, y: r.y + r.h - 2, w: 3, h: 1 }, 'ink0');
  drawText(g, text, r.x + 5, r.y + 1, { color: 'ink0' });
}

/** The Stink jar sweating: fat beads running down the glass, a drip off each side, a puddle. */
function sweat(g: CanvasRenderingContext2D, t: number): void {
  const r = STINK;
  for (let i = 0; i < 6; i++) {
    const speed = 7 + (i % 3) * 4;
    const span = r.h - 18;
    const k = (t * speed + i * 29) % span;
    const side = i % 2 === 0;
    const x = side ? r.x - 1 : r.x + r.w - 1;
    const y = r.y + 16 + Math.round(k);
    fillRect(g, { x, y: y - 1, w: 2, h: 4 }, 'ink0');
    fillRect(g, { x, y, w: 2, h: 2 }, 'white');
    fillRect(g, { x, y: y - 3, w: 1, h: 3 }, 'blue');
  }
  // A little puddle under the jar, wobbling.
  const w = 26 + Math.round(Math.sin(t * 2) * 2);
  fillRect(g, { x: Math.round(r.x + r.w / 2 - w / 2), y: r.y + r.h, w, h: 2 }, 'blue');
  fillRect(g, { x: Math.round(r.x + r.w / 2 - w / 2) + 3, y: r.y + r.h, w: 5, h: 1 }, 'white');
}
