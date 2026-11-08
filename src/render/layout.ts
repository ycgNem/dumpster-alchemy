// Where everything sits on the 640 x 360 screen (docs/DESIGN.md, STYLE.md "Sizes").
//
//   0..56     sky (night label, clock)
//   56..104   the truck lane
//   112..336  orders (left) | the 9 x 7 board (middle) | Dumpster, Stink, Compactor (right)
import { TUNING } from '../data/tuning';
import type { Target } from '../game/actions';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const CELL = 32;

export const SKY: Rect = { x: 0, y: 0, w: 640, h: 56 };
export const TRUCK_LANE: Rect = { x: 0, y: 56, w: 640, h: 48 };

export const BOARD: Rect = {
  x: 176,
  y: 112,
  w: TUNING.board.cols * CELL,
  h: TUNING.board.rows * CELL,
};

export const ORDERS: Rect = { x: 8, y: 112, w: 160, h: 224 };

/** The i-th raccoon order card, top to bottom. */
export function orderSlot(i: number): Rect {
  // Four slots (the Swap Meet's Extra Raccoon) get shorter cards (src/render/orders.ts).
  if (orderSlots >= 4) return { x: ORDERS.x, y: ORDERS.y + i * 57, w: ORDERS.w, h: 53 };
  return { x: ORDERS.x, y: ORDERS.y + i * 76, w: ORDERS.w, h: 68 };
}

let orderSlots: number = TUNING.orders.slots;

/** How many order cards tonight has (3, or 4 with the Extra Raccoon). The play scene sets it. */
export function setOrderSlots(n: number): void {
  orderSlots = n;
}

export function orderSlotCount(): number {
  return orderSlots;
}

export const RIGHT: Rect = { x: 472, y: 112, w: 160, h: 224 };
export const DUMPSTER: Rect = { x: 528, y: 112, w: 48, h: 48 };
export const LID_PIPS: Rect = { x: 520, y: 162, w: 64, h: 8 };
export const STINK: Rect = { x: 480, y: 176, w: 24, h: 104 };
export const SHINIES: Rect = { x: 512, y: 184, w: 112, h: 32 };
export const COMPACTOR: Rect = { x: 528, y: 288, w: 48, h: 48 };

/** The truck's anchor (bottom centre) when it's parked to dump; its cab faces right. */
export const TRUCK_STOP = { x: BOARD.x + BOARD.w / 2 + 26, y: TRUCK_LANE.y + TRUCK_LANE.h - 3 };
/** Where the truck enters and leaves (its anchor x, past the right edge). */
export const TRUCK_OFF_X = 640 + 64;
/** Where junk leaves the truck bed, relative to the truck's anchor. */
export const TRUCK_BED = { dx: -26, dy: -34 };
/** The truck countdown, at the left end of the lane. */
export const TRUCK_TIMER: Rect = { x: 6, y: 62, w: 128, h: 36 };
/** Where junk leaves the Dumpster (and where angry raccoons kick it from). */
export const DUMPSTER_MOUTH = { x: DUMPSTER.x + 24, y: DUMPSTER.y + 12 };
/** The strip under everything: the control hints (first discoveries get the speech bubble, fx.ts). */
export const FOOTER: Rect = { x: 0, y: 340, w: 640, h: 20 };
/** The truck timer, the refill timer and the compactor cooldown sit here, under the Shinies. */
export const RIGHT_INFO: Rect = { x: 512, y: 222, w: 120, h: 60 };
/** The Clock Out button, under the quota bar once the quota is met (src/scenes/play.ts). */
export const CLOCK_OUT: Rect = { x: 512, y: 210, w: 112, h: 20 };

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

/** The board cell under a logical point, or null. */
export function cellAt(x: number, y: number): [number, number] | null {
  if (!inRect(BOARD, x, y)) return null;
  return [Math.floor((x - BOARD.x) / CELL), Math.floor((y - BOARD.y) / CELL)];
}

export function cellRect(c: number, r: number): Rect {
  return { x: BOARD.x + c * CELL, y: BOARD.y + r * CELL, w: CELL, h: CELL };
}

/** What's under a logical point, as a drop target (cells, order cards, the Compactor). */
export function targetAt(x: number, y: number): Target {
  const cell = cellAt(x, y);
  if (cell) return { kind: 'cell', c: cell[0], r: cell[1] };
  for (let i = 0; i < orderSlots; i++) {
    if (inRect(orderSlot(i), x, y)) return { kind: 'order', slot: i };
  }
  // The Compactor is a forgiving target: a few pixels of slop around it.
  if (inRect({ x: COMPACTOR.x - 6, y: COMPACTOR.y - 6, w: COMPACTOR.w + 12, h: COMPACTOR.h + 12 }, x, y)) {
    return { kind: 'compactor' };
  }
  return { kind: 'none' };
}
