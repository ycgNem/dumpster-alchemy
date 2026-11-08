// What the renderer remembers between frames that isn't game state: its clock, the pointer,
// when each piece last landed (for the squash), when the Dumpster last opened, and so on.
// It learns these from the events, like fx and audio do.
import type { ItemId } from '../data/items';
import { TUNING } from '../data/tuning';
import type { GameEvent } from '../game/events';
import type { GameState } from '../game/state';
import { BOARD, CELL } from './layout';

/** Seconds the "QUOTA MET" / "SHUT DOWN" slam (fx.ts) plays before the end overlay fades in. */
export const END_SLAM_SEC = 1.1;
/** Seconds the King's crowning plays (fx.ts) before his "ALL HAIL!" slam. */
export const CROWN_SEC = 2.4;

export interface Slide {
  /** Where it starts, when (render time), how long it takes, how high it hops on the way. */
  x: number;
  y: number;
  t: number;
  dur: number;
  arc: number;
}

export interface View {
  /** Seconds of render time (runs while paused, so things keep breathing). */
  t: number;
  /** The pointer, in logical pixels. */
  px: number;
  py: number;
  /** The last pointer was a finger: lift held pieces clear of it. */
  touch: boolean;
  /** uid -> when it landed (render time) and how hard it squashes, in pixels. */
  squash: Map<number, { t: number; px: number }>;
  /** uid -> where a piece is sliding home from (a snap-back, a swap, a gull hop, a shuffle). */
  slides: Map<number, Slide>;
  dumpsterOpen: number;
  dumpsterRattle: number;
  compactAt: number;
  /** Pieces a gull has eaten, still drawn in their cell until the gull gets there. */
  ghosts: { id: ItemId; c: number; r: number; until: number }[];
  /** When the end overlay starts (render time): the night ended, plus the slam. */
  endedAt: number;
  /** The held piece's offset from the pointer, eased when it jumps beside an order card. */
  heldOff: { uid: number; x: number; y: number } | null;
  /** When the quota came in tonight (render time), for the Clock Out button's entrance. */
  quotaAt: number;
  /** When the Stink last passed the warning (render time): the jar shakes for a moment. */
  reekAt: number;
  /** When the night ended (render time, before the slam), or -1 while it's on. */
  overAt: number;
}

export function makeView(): View {
  return {
    t: 0,
    px: -1,
    py: -1,
    touch: false,
    squash: new Map(),
    slides: new Map(),
    dumpsterOpen: -9,
    dumpsterRattle: -9,
    compactAt: -9,
    ghosts: [],
    endedAt: -1,
    heldOff: null,
    quotaAt: -9,
    reekAt: -9,
    overAt: -1,
  };
}

/** How far a held piece floats above the pointer (more for a finger). */
export function liftPx(v: View): number {
  return v.touch ? TUNING.feel.touchLiftPx : TUNING.feel.dragLiftPx;
}

/**
 * Where the drop aims, given the pointer. A mouse aims with the paw's hotspot (the piece floats
 * just above it); a finger aims with the middle of the floating piece, and play.ts falls back to
 * the cell under the finger when that isn't a valid target.
 */
export function aimY(v: View, y: number): number {
  return v.touch ? y + 1 - liftPx(v) : y;
}

export function viewEvent(v: View, s: GameState, e: GameEvent): void {
  const land = (c: number, r: number, px = 2): void => {
    const p = s.board.get(c, r);
    if (p) v.squash.set(p.uid, { t: v.t, px });
  };
  const slide = (toC: number, toR: number, from: { x: number; y: number }, dur: number, arc: number): void => {
    const p = s.board.get(toC, toR);
    if (p) v.slides.set(p.uid, { ...from, t: v.t, dur, arc });
  };
  switch (e.type) {
    case 'land':
      land(e.c, e.r, 2);
      break;
    case 'move':
      land(e.c, e.r, 1);
      break;
    case 'merge':
      // A proper pop: the bigger the tier, the harder it squashes (still only a few pixels).
      land(e.c, e.r, Math.min(4, 2 + Math.floor(e.tier / 4)));
      break;
    case 'egg':
      land(e.c, e.r, 4);
      break;
    case 'swap': {
      land(e.c2, e.r2, 1);
      // The piece that was in the way slides over to where the held one came from.
      slide(e.c, e.r, foot(e.c2, e.r2), TUNING.feel.slideSec, 0);
      break;
    }
    case 'invalid': {
      // Snap back from wherever it was let go.
      if (v.px >= 0) slide(e.c, e.r, { x: v.px, y: v.py + 15 - liftPx(v) }, TUNING.feel.slideSec, 0);
      break;
    }
    case 'gullEat': {
      // The junk stays put until the gull lands on it: a hop is quick, a swoop in takes longer.
      const swoop = s.flights.some((f) => f.from === 'gull' && f.c === e.c && f.r === e.r && f.t === 0);
      v.ghosts.push({ id: e.id, c: e.c, r: e.r, until: v.t + (swoop ? TUNING.gulls.arriveSec * 0.9 : 0.22) });
      if (v.ghosts.length > 8) v.ghosts.shift();
      break;
    }
    case 'gullHop':
      slide(e.toC, e.toR, foot(e.c, e.r), 0.26, 9);
      break;
    case 'gullScream':
      for (const m of e.moves ?? []) slide(m.toC, m.toR, foot(m.c, m.r), 0.22, 5);
      break;
    case 'dumpsterClick':
      if (e.ok) v.dumpsterOpen = v.t;
      else v.dumpsterRattle = v.t;
      break;
    case 'compact':
      v.compactAt = v.t;
      break;
    case 'nightWon':
    case 'nightLost':
      v.overAt = v.t;
      v.endedAt = v.t + END_SLAM_SEC + (s.endReason === 'king' ? CROWN_SEC : 0);
      break;
    case 'stinkWarn':
      v.reekAt = v.t;
      break;
    case 'quotaMet':
      v.quotaAt = v.t;
      break;
    default:
      break;
  }
}

function foot(c: number, r: number): { x: number; y: number } {
  return { x: BOARD.x + c * CELL + CELL / 2, y: BOARD.y + r * CELL + CELL - 1 };
}

/** Where a sliding piece is drawn now (eased from its start to its cell's foot), or null. */
export function slideAt(v: View, uid: number, to: { x: number; y: number }): { x: number; y: number } | null {
  const sl = v.slides.get(uid);
  if (!sl) return null;
  const p = (v.t - sl.t) / sl.dur;
  if (p >= 1 || p < 0) {
    v.slides.delete(uid);
    return null;
  }
  const k = sl.arc > 0 ? p : 1 - (1 - p) * (1 - p);
  return {
    x: Math.round(sl.x + (to.x - sl.x) * k),
    y: Math.round(sl.y + (to.y - sl.y) * k - Math.sin(p * Math.PI) * sl.arc),
  };
}

/** Forget squash entries that finished long ago. */
export function tidyView(v: View): void {
  if (v.squash.size < 64) return;
  for (const [uid, sq] of v.squash) if (v.t - sq.t > 2) v.squash.delete(uid);
}
