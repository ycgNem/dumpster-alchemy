// The greybox: crude stand-ins for every sprite, drawn with rects. Each render module tries the
// real sprite first (sprites.ts) and falls back to these, so the game is whole before the art
// exists. Items are coloured squares with their tier number; the rest is cardboard and blobs.
import { ITEMS, type ItemId } from '../data/items';
import { PAL, type PalName } from '../data/palette';
import { W, viewRect } from '../engine/screen';
import { placeholderBrew } from './alchemy';
import { BOARD, TRUCK_LANE, type Rect } from './layout';
import { drawText } from './text';

const JUNK_COLOUR: readonly PalName[] = [
  'steel3', 'steel2', 'card2', 'grime2', 'fur2', 'steel1',
  'ink2', 'steel3', 'bone', 'white', 'rust2', 'yellow',
];
const GULL_COLOUR: readonly PalName[] = ['white', 'bone', 'fur3', 'fur2', 'yellow'];

export function fillRect(g: CanvasRenderingContext2D, r: Rect, c: PalName): void {
  g.fillStyle = PAL[c];
  g.fillRect(Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h));
}

export function px(g: CanvasRenderingContext2D, x: number, y: number, c: PalName): void {
  fillRect(g, { x, y, w: 1, h: 1 }, c);
}

export function outlineRect(g: CanvasRenderingContext2D, r: Rect, c: PalName, t = 1): void {
  fillRect(g, { x: r.x, y: r.y, w: r.w, h: t }, c);
  fillRect(g, { x: r.x, y: r.y + r.h - t, w: r.w, h: t }, c);
  fillRect(g, { x: r.x, y: r.y, w: t, h: r.h }, c);
  fillRect(g, { x: r.x + r.w - t, y: r.y, w: t, h: r.h }, c);
}

/** A crude cardboard panel: face, lit top-left edge, shaded bottom-right, a strip of tape. */
export function cardboard(g: CanvasRenderingContext2D, r: Rect, tape = true): void {
  fillRect(g, { x: r.x + 1, y: r.y + 1, w: r.w, h: r.h }, 'ink0');
  fillRect(g, r, 'card1');
  fillRect(g, { x: r.x, y: r.y, w: r.w, h: 1 }, 'card3');
  fillRect(g, { x: r.x, y: r.y, w: 1, h: r.h }, 'card3');
  fillRect(g, { x: r.x, y: r.y + r.h - 1, w: r.w, h: 1 }, 'card0');
  fillRect(g, { x: r.x + r.w - 1, y: r.y, w: 1, h: r.h }, 'card0');
  if (tape) fillRect(g, { x: r.x + Math.floor(r.w / 2) - 8, y: r.y - 2, w: 16, h: 5 }, 'steel3');
}

/** A bone-coloured note (paper) panel. */
export function paper(g: CanvasRenderingContext2D, r: Rect): void {
  fillRect(g, { x: r.x + 2, y: r.y + 2, w: r.w, h: r.h }, 'ink0');
  fillRect(g, r, 'bone');
  fillRect(g, { x: r.x, y: r.y + r.h - 1, w: r.w, h: 1 }, 'card2');
  fillRect(g, { x: r.x + r.w - 1, y: r.y, w: 1, h: r.h }, 'card2');
}

export function itemColour(id: ItemId): PalName {
  const d = ITEMS[id];
  if (d.chain === 'junk') return JUNK_COLOUR[d.tier - 1] ?? 'white';
  if (d.chain === 'gull') return GULL_COLOUR[d.tier - 1] ?? 'white';
  return id === 'golden_egg' ? 'yellow' : 'toxic2';
}

/**
 * A placeholder item whose foot (bottom centre of its 32 x 32 cell) is at (fx, fy), scaled
 * around the foot by sx, sy for squash and stretch.
 */
export function placeholderItem(g: CanvasRenderingContext2D, id: ItemId, fx: number, fy: number, sx = 1, sy = 1): void {
  const d = ITEMS[id];
  // Recipe results: a flask (tool) or a crate (treasure) until the `recipes` atlas lands.
  if (d.chain === 'brew') return placeholderBrew(g, id, fx, fy, sx, sy);
  const colour = itemColour(id);
  const w = Math.round(26 * sx);
  const h = Math.round(26 * sy);
  const x = Math.round(fx - w / 2);
  const y = Math.round(fy - 2 - h);
  if (d.chain === 'gull') {
    const rx = w / 2;
    const ry = h / 2;
    g.fillStyle = PAL.ink0;
    g.beginPath();
    g.ellipse(x + rx, y + ry, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = PAL[colour];
    g.beginPath();
    g.ellipse(x + rx, y + ry, rx - 1, ry - 1, 0, 0, Math.PI * 2);
    g.fill();
  } else {
    fillRect(g, { x, y, w, h }, 'ink0');
    fillRect(g, { x: x + 1, y: y + 1, w: w - 2, h: h - 2 }, colour);
    fillRect(g, { x: x + 1, y: y + 1, w: w - 2, h: 2 }, 'white');
  }
  const label = d.chain === 'gull' ? `G${d.tier}` : d.tier ? String(d.tier) : id === 'golden_egg' ? 'EGG' : 'JUICE';
  drawText(g, label, fx, y + Math.round(h / 2) - 5, { color: 'ink0', align: 'center' });
}

const RACCOON_HAT: Record<string, PalName> = { gary: 'yellow', linda: 'pink', pete: 'blue', mange: 'card2' };

/** A 48 x 48 raccoon bust with its foot at (fx, fy). */
export function placeholderRaccoon(
  g: CanvasRenderingContext2D,
  id: string,
  mood: 'idle' | 'happy' | 'angry',
  blink: boolean,
  fx: number,
  fy: number,
): void {
  const x = Math.round(fx - 24);
  const y = Math.round(fy - 47);
  const small = id === 'pete';
  const top = y + (small ? 14 : 8);
  // Ears, head, body.
  fillRect(g, { x: x + 9, y: top - 4, w: 8, h: 8 }, 'ink0');
  fillRect(g, { x: x + 31, y: top - 4, w: 8, h: 8 }, 'ink0');
  fillRect(g, { x: x + 10, y: top - 3, w: 6, h: 6 }, 'fur1');
  fillRect(g, { x: x + 32, y: top - 3, w: 6, h: 6 }, 'fur1');
  fillRect(g, { x: x + 7, y: top, w: 34, h: 26 }, 'ink0');
  fillRect(g, { x: x + 8, y: top + 1, w: 32, h: 24 }, mood === 'angry' ? 'rust3' : 'fur2');
  fillRect(g, { x: x + 4, y: top + 24, w: 40, h: y + 47 - (top + 24) + 1 }, 'ink0');
  fillRect(g, { x: x + 5, y: top + 25, w: 38, h: y + 47 - (top + 25) }, 'fur1');
  // The mask and eyes.
  fillRect(g, { x: x + 9, y: top + 8, w: 30, h: 7 }, 'ink1');
  if (blink) {
    fillRect(g, { x: x + 14, y: top + 11, w: 5, h: 1 }, 'bone');
    fillRect(g, { x: x + 29, y: top + 11, w: 5, h: 1 }, 'bone');
  } else if (mood === 'happy') {
    fillRect(g, { x: x + 14, y: top + 10, w: 5, h: 2 }, 'white');
    fillRect(g, { x: x + 29, y: top + 10, w: 5, h: 2 }, 'white');
  } else {
    fillRect(g, { x: x + 15, y: top + 9, w: 3, h: 4 }, 'white');
    fillRect(g, { x: x + 30, y: top + 9, w: 3, h: 4 }, 'white');
    if (mood === 'angry') {
      fillRect(g, { x: x + 13, y: top + 6, w: 7, h: 2 }, 'ink0');
      fillRect(g, { x: x + 28, y: top + 6, w: 7, h: 2 }, 'ink0');
    }
  }
  // Nose and mouth.
  fillRect(g, { x: x + 22, y: top + 15, w: 4, h: 3 }, 'pink');
  fillRect(g, { x: x + 20, y: top + (mood === 'happy' ? 20 : 21), w: 8, h: 1 }, 'ink0');
  // What makes each one readable.
  const hat = RACCOON_HAT[id] ?? 'steel2';
  if (id === 'gary') {
    fillRect(g, { x: x + 6, y: top - 6, w: 36, h: 7 }, 'ink0');
    fillRect(g, { x: x + 7, y: top - 5, w: 34, h: 5 }, hat);
    fillRect(g, { x: x + 4, y: top + 27, w: 40, h: 4 }, 'sodium2');
  } else if (id === 'linda') {
    outlineRect(g, { x: x + 12, y: top + 7, w: 10, h: 8 }, hat);
    outlineRect(g, { x: x + 26, y: top + 7, w: 10, h: 8 }, hat);
    for (let i = 0; i < 6; i++) px(g, x + 14 + i * 4, top + 28 + (i % 2), 'steel3');
  } else if (id === 'pete') {
    fillRect(g, { x: x + 8, y: top - 7, w: 32, h: 8 }, 'ink0');
    fillRect(g, { x: x + 9, y: top - 6, w: 30, h: 6 }, hat);
    fillRect(g, { x: x + 2, y: top - 2, w: 10, h: 3 }, hat);
  } else {
    fillRect(g, { x: x + 3, y: top + 23, w: 42, h: 8 }, hat);
    for (let i = 0; i < 10; i++) px(g, x + 5 + i * 4, top + 26, 'card0');
    outlineRect(g, { x: x + 14, y: top + 9, w: 6, h: 5 }, 'steel3');
    outlineRect(g, { x: x + 28, y: top + 9, w: 6, h: 5 }, 'steel3');
  }
}

/** Inspector Possum, 48 x 48, foot at (fx, fy). */
export function placeholderPossum(g: CanvasRenderingContext2D, pose: 'idle' | 'dead' | 'shutdown', fx: number, fy: number): void {
  const x = Math.round(fx - 24);
  const y = Math.round(fy - 47);
  fillRect(g, { x: x + 8, y: y + 8, w: 32, h: 26 }, 'ink0');
  fillRect(g, { x: x + 9, y: y + 9, w: 30, h: 24 }, 'fur3');
  fillRect(g, { x: x + 4, y: y + 32, w: 40, h: 16 }, 'ink0');
  fillRect(g, { x: x + 5, y: y + 33, w: 38, h: 14 }, 'yellow');
  fillRect(g, { x: x + 21, y: y + 22, w: 6, h: 4 }, 'pink');
  if (pose === 'dead') {
    for (const ex of [14, 29]) {
      px(g, x + ex, y + 15, 'ink0');
      px(g, x + ex + 2, y + 15, 'ink0');
      px(g, x + ex + 1, y + 16, 'ink0');
      px(g, x + ex, y + 17, 'ink0');
      px(g, x + ex + 2, y + 17, 'ink0');
    }
    fillRect(g, { x: x + 25, y: y + 27, w: 2, h: 4 }, 'pink');
  } else {
    fillRect(g, { x: x + 14, y: y + 14, w: 4, h: 4 }, 'ink0');
    fillRect(g, { x: x + 30, y: y + 14, w: 4, h: 4 }, 'ink0');
  }
  if (pose !== 'dead') {
    fillRect(g, { x: x + 30, y: y + 28, w: 14, h: 18 }, 'ink0');
    fillRect(g, { x: x + 31, y: y + 29, w: 12, h: 16 }, 'bone');
    for (let i = 0; i < 4; i++) fillRect(g, { x: x + 33, y: y + 32 + i * 3, w: 8, h: 1 }, 'steel1');
  }
}

/** The truck, 112 x 64, cab on the right, foot at (fx, fy). `bed` 0 = down .. 2 = tipped up. */
export function placeholderTruck(g: CanvasRenderingContext2D, fx: number, fy: number, wheel: number, bed: number, reverseLight: boolean): void {
  const x = Math.round(fx - 56);
  const y = Math.round(fy - 63);
  // Bed (the rear, on the left), tipping up from its back corner.
  const lift = bed * 6;
  fillRect(g, { x: x + 4, y: y + 22 - lift, w: 64, h: 28 + lift }, 'ink0');
  fillRect(g, { x: x + 5, y: y + 23 - lift, w: 62, h: 26 + lift }, 'rust2');
  fillRect(g, { x: x + 5, y: y + 23 - lift, w: 62, h: 3 }, 'rust3');
  for (let i = 0; i < 5; i++) fillRect(g, { x: x + 10 + i * 12, y: y + 28 - lift, w: 2, h: 18 + lift }, 'rust1');
  // Cab.
  fillRect(g, { x: x + 70, y: y + 18, w: 38, h: 32 }, 'ink0');
  fillRect(g, { x: x + 71, y: y + 19, w: 36, h: 30 }, 'steel2');
  fillRect(g, { x: x + 88, y: y + 22, w: 16, h: 10 }, 'night3');
  fillRect(g, { x: x + 104, y: y + 40, w: 4, h: 4 }, 'sodium3');
  // Chassis and wheels.
  fillRect(g, { x: x + 2, y: y + 48, w: 108, h: 5 }, 'ink1');
  for (const wx of [20, 50, 92]) {
    fillRect(g, { x: x + wx - 7, y: y + 49, w: 14, h: 14 }, 'ink0');
    fillRect(g, { x: x + wx - 3, y: y + 53, w: 6, h: 6 }, 'steel1');
    px(g, x + wx + (wheel % 2 ? -2 : 2), y + 56, 'steel3');
  }
  if (reverseLight) fillRect(g, { x: x + 2, y: y + 40, w: 3, h: 4 }, 'red');
}

/** The Dumpster in a 48 x 48 box. */
export function placeholderDumpster(g: CanvasRenderingContext2D, r: Rect, state: 'closed' | 'open' | 'rattle', t: number): void {
  const shake = state === 'rattle' ? Math.round(Math.sin(t * 60)) : 0;
  const x = r.x + shake;
  fillRect(g, { x: x + 3, y: r.y + 14, w: 42, h: 32 }, 'ink0');
  fillRect(g, { x: x + 4, y: r.y + 15, w: 40, h: 30 }, 'grime1');
  fillRect(g, { x: x + 4, y: r.y + 15, w: 40, h: 2 }, 'grime2');
  for (let i = 0; i < 3; i++) fillRect(g, { x: x + 12 + i * 10, y: r.y + 20, w: 2, h: 22 }, 'grime0');
  drawText(g, 'LOT 9', x + 24, r.y + 28, { color: 'grime3', align: 'center' });
  if (state === 'open') {
    fillRect(g, { x: x + 2, y: r.y + 1, w: 44, h: 5 }, 'ink0');
    fillRect(g, { x: x + 3, y: r.y + 2, w: 42, h: 3 }, 'steel1');
    fillRect(g, { x: x + 4, y: r.y + 12, w: 40, h: 3 }, 'ink1');
  } else {
    const lift = state === 'rattle' ? Math.abs(Math.round(Math.sin(t * 40) * 2)) : 0;
    fillRect(g, { x: x + 2, y: r.y + 10 - lift, w: 44, h: 6 }, 'ink0');
    fillRect(g, { x: x + 3, y: r.y + 11 - lift, w: 42, h: 4 }, 'steel1');
  }
}

/** The Compactor in a 48 x 48 box; `crush` 0..1 is how far the plate has come down. */
export function placeholderCompactor(g: CanvasRenderingContext2D, r: Rect, crush: number): void {
  fillRect(g, { x: r.x + 2, y: r.y + 4, w: 44, h: 42 }, 'ink0');
  fillRect(g, { x: r.x + 3, y: r.y + 5, w: 42, h: 40 }, 'steel1');
  fillRect(g, { x: r.x + 8, y: r.y + 14, w: 32, h: 26 }, 'ink1');
  const plate = Math.round(crush * 18);
  fillRect(g, { x: r.x + 8, y: r.y + 14, w: 32, h: 4 + plate }, 'steel2');
  for (let i = 0; i < 6; i++) fillRect(g, { x: r.x + 4 + i * 7, y: r.y + 6, w: 4, h: 5 }, i % 2 ? 'ink0' : 'yellow');
}

/** The Stink jar outline over the jar rect (the sludge is drawn by the HUD). */
export function placeholderJar(g: CanvasRenderingContext2D, r: Rect): void {
  outlineRect(g, r, 'ink0');
  outlineRect(g, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, 'steel2');
  fillRect(g, { x: r.x - 2, y: r.y - 4, w: r.w + 4, h: 5 }, 'steel1');
  fillRect(g, { x: r.x + 3, y: r.y + 4, w: 2, h: r.h - 12 }, 'steel3');
}

/** One dirt cell. */
export function placeholderCell(g: CanvasRenderingContext2D, r: Rect, odd: boolean): void {
  fillRect(g, r, odd ? 'dirt1' : 'dirt2');
  fillRect(g, { x: r.x, y: r.y + r.h - 1, w: r.w, h: 1 }, 'dirt0');
  fillRect(g, { x: r.x + r.w - 1, y: r.y, w: 1, h: r.h }, 'dirt0');
}

/** Lot 9 at night: sky, stars, the streetlight, the fence, the truck lane, the ground (margins too). */
export function placeholderBackdrop(g: CanvasRenderingContext2D, t: number): void {
  const v = viewRect();
  const x0 = v.x - (((v.x % 8) + 8) % 8);
  const x1 = v.x + v.w;
  fillRect(g, { x: v.x, y: v.y, w: v.w, h: 56 - v.y }, 'night0');
  for (let i = 0; i < 40; i++) {
    const x = (i * 97) % W;
    const y = (i * 53) % 44;
    px(g, x, y, i % 7 === 0 && Math.sin(t * 2 + i) > 0 ? 'night3' : 'night2');
  }
  // Far heaps.
  for (let i = Math.floor(v.x / 80) - 1; i < Math.ceil(x1 / 80) + 1; i++) {
    const cx = i * 80 + 20;
    const h = 8 + ((((i * 37) % 9) + 9) % 9);
    fillRect(g, { x: cx - 30, y: 56 - h, w: 60, h }, 'night1');
    fillRect(g, { x: cx - 18, y: 56 - h - 4, w: 36, h: 4 }, 'night1');
  }
  for (let x = x0; x < x1; x += 8) fillRect(g, { x, y: 40, w: 1, h: 16 }, 'night2');
  fillRect(g, { x: v.x, y: 44, w: v.w, h: 1 }, 'night2');
  // The truck lane.
  fillRect(g, { ...TRUCK_LANE, x: v.x, w: v.w }, 'dirt0');
  for (let x = x0 - 4; x < x1; x += 24) fillRect(g, { x, y: TRUCK_LANE.y + 23, w: 12, h: 2 }, 'dirt1');
  fillRect(g, { x: v.x, y: TRUCK_LANE.y + TRUCK_LANE.h - 1, w: v.w, h: 1 }, 'ink0');
  // The ground everything else sits on.
  fillRect(g, { x: v.x, y: 104, w: v.w, h: v.y + v.h - 104 }, 'ink1');
  // The streetlight, top-left of the board.
  fillRect(g, { x: BOARD.x - 14, y: 4, w: 3, h: 100 }, 'ink0');
  fillRect(g, { x: BOARD.x - 14, y: 4, w: 22, h: 3 }, 'ink0');
  fillRect(g, { x: BOARD.x + 4, y: 6, w: 8, h: 3 }, Math.sin(t * 13) > -0.97 ? 'sodium3' : 'sodium1');
}
