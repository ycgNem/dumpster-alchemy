// The Truck in its lane, the Dumpster and the Compactor in the right column.
import { TUNING } from '../data/tuning';
import type { DropKind, Target } from '../game/actions';
import { viewRect } from '../engine/screen';
import type { GameState, SceneId, Truck } from '../game/state';
import { trucks } from '../game/truck';
import { paintBackdrop } from './backdrop';
import { fillRect, outlineRect, placeholderBackdrop, placeholderCompactor, placeholderDumpster, placeholderTruck } from './greybox';
import { COMPACTOR, DUMPSTER, TRUCK_BED, TRUCK_OFF_X, TRUCK_STOP, inRect } from './layout';
import { drawSprite } from './sprites';
import { drawText } from './text';
import type { View } from './view';

const easeOut = (p: number): number => 1 - (1 - p) * (1 - p);
const easeIn = (p: number): number => p * p;
const clamp01 = (p: number): number => Math.max(0, Math.min(1, p));

export interface TruckPose {
  visible: boolean;
  x: number;
  /** Bed position for the dump frames: 0 down, 1 half, 2 up. -1 while driving. */
  bed: number;
  reversing: boolean;
  /** Garbage Day's second truck comes in from the left, mirrored (cab facing left). */
  flip: boolean;
}

/** Where a truck parks to dump (its anchor), and where it comes from and goes (past the visible edge, margins too). */
export function truckStop(which: number): { x: number; y: number; off: number } {
  const v = viewRect();
  return which === 1
    ? { x: TRUCK2_STOP_X, y: TRUCK_STOP.y, off: Math.min(-64, v.x - 64) }
    : { x: TRUCK_STOP.x, y: TRUCK_STOP.y, off: Math.max(TRUCK_OFF_X, v.x + v.w + 64) };
}

/** Where junk leaves a truck's bed (the bed is behind the cab, so it's mirrored for the second). */
export function truckBed(which: number): { x: number; y: number } {
  const st = truckStop(which);
  return { x: st.x + (which === 1 ? -TRUCK_BED.dx : TRUCK_BED.dx), y: st.y + TRUCK_BED.dy };
}

/** The second truck's stop: left of the first, so they never park on each other. */
const TRUCK2_STOP_X = TRUCK_STOP.x - 120;

export function truckPose(s: GameState, k: Truck = s.truck): TruckPose {
  const T = TUNING.truck;
  const st = truckStop(k.which);
  const flip = k.which === 1;
  switch (k.phase) {
    case 'away':
      return { visible: false, x: st.off, bed: -1, reversing: false, flip };
    case 'arrive': {
      const p = clamp01(1 - k.timer / T.driveInSec);
      return { visible: true, x: st.off + (st.x - st.off) * easeOut(p), bed: -1, reversing: true, flip };
    }
    case 'dump': {
      const p = k.t / T.dumpSec;
      const bed = p < 0.12 ? 0 : p < 0.25 ? 1 : p < 0.8 ? 2 : p < 0.92 ? 1 : 0;
      return { visible: true, x: st.x, bed, reversing: false, flip };
    }
    case 'leave': {
      const p = clamp01(k.t / T.driveOffSec);
      return { visible: true, x: st.x + (st.off - st.x) * easeIn(p), bed: -1, reversing: false, flip };
    }
  }
}

/** A cheap repeatable hash of a whole number, 0..1. */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Is the streetlight dimmed right now? Every few seconds there may be a short, ragged burst of
 * flickers (a dying sodium lamp), and the gaps between bursts are uneven.
 */
export function streetlightDim(t: number): boolean {
  const slot = Math.floor(t / 2.9);
  if (hash(slot) > 0.42) return false;
  const start = slot * 2.9 + hash(slot + 0.5) * 2.2;
  const len = 0.12 + hash(slot + 0.25) * 0.4;
  if (t < start || t > start + len) return false;
  return hash(Math.floor(t * 22) + slot) > 0.4;
}

/**
 * Tonight's scene (`backdrop_<scene>`, a wide panorama that fills the margins too; frame 1 is the
 * streetlight gone dim), under everything in the play scene.
 */
export function drawBackdrop(g: CanvasRenderingContext2D, v: View, scene: SceneId = 'lot9'): void {
  if (!paintBackdrop(g, scene, streetlightDim(v.t) ? 1 : 0)) placeholderBackdrop(g, v.t);
}

export function drawTruck(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  for (const k of trucks(s)) drawOneTruck(g, s, k, v);
}

function drawOneTruck(g: CanvasRenderingContext2D, s: GameState, k: Truck, v: View): void {
  const pose = truckPose(s, k);
  if (!pose.visible) return;
  const moving = pose.bed < 0;
  // A little engine shudder while it idles at the stop; the whole body rattles on the tip.
  const tipping = pose.bed === 2;
  const y = TRUCK_STOP.y + (tipping ? Math.round(Math.sin(v.t * 47)) : !moving && Math.sin(v.t * 30) > 0.6 ? -1 : 0);
  const x = Math.round(pose.x) + (tipping ? Math.round(Math.sin(v.t * 61) * 1.4) : 0);
  const flip = pose.flip;
  const drew = moving
    ? drawSprite(g, 'truck_drive', x, y, { flip })
    : drawSprite(g, 'truck_dump', x, y, { frame: pose.bed, flip }) || drawSprite(g, 'truck_drive', x, y, { frame: 0, flip });
  if (!drew) {
    const wheel = moving ? Math.floor(v.t * 10) : 0;
    placeholderTruck(g, x, y, wheel, Math.max(0, pose.bed), pose.reversing && Math.sin(v.t * 12) > 0);
  }
}

export function drawDumpster(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  const open = v.t - v.dumpsterOpen < 0.25;
  const rattle = v.t - v.dumpsterRattle < 0.4;
  const state = open ? 'open' : rattle ? 'rattle' : 'closed';
  const hot = inRect(DUMPSTER, v.px, v.py) && !s.drag && s.status === 'playing';
  const fx = DUMPSTER.x + 24;
  const fy = DUMPSTER.y + 47;
  const shake = rattle ? Math.round(Math.sin(v.t * 60)) : 0;
  if (!drawSprite(g, `dumpster_${state}`, fx + shake, fy, { phase: 0 })) {
    if (!drawSprite(g, 'dumpster_closed', fx + shake, fy)) placeholderDumpster(g, DUMPSTER, state, v.t);
  }
  if (hot && s.dumpster.charges > 0) outlineRect(g, { x: DUMPSTER.x - 2, y: DUMPSTER.y - 2, w: 52, h: 52 }, 'sodium3');
}

export function drawCompactor(g: CanvasRenderingContext2D, s: GameState, v: View, hover: Target, kind: DropKind): void {
  const since = v.t - v.compactAt;
  const crushing = since < 0.45;
  const fx = COMPACTOR.x + 24;
  const fy = COMPACTOR.y + 47;
  const drew = crushing
    ? drawSprite(g, 'compactor_crush', fx, fy, { frame: Math.floor((since / 0.45) * 3) })
    : drawSprite(g, 'compactor_idle', fx, fy);
  if (!drew) placeholderCompactor(g, COMPACTOR, crushing ? Math.sin((since / 0.45) * Math.PI) : 0);

  const cd = s.compactor.cooldown;
  if (cd > 0) {
    // Cooling down: a dark bar draining left to right, and the seconds left.
    const a = g.globalAlpha;
    g.globalAlpha = 0.55;
    fillRect(g, { x: COMPACTOR.x + 2, y: COMPACTOR.y + 4, w: 44, h: 42 }, 'ink0');
    g.globalAlpha = a;
    const w = Math.round(40 * (cd / s.mods.compactorCooldownSec));
    fillRect(g, { x: COMPACTOR.x + 4, y: COMPACTOR.y + 40, w, h: 3 }, 'rust3');
    drawText(g, `${Math.ceil(cd)}s`, fx, COMPACTOR.y + 20, { color: 'bone', align: 'center', outline: 'ink0' });
  }
  if (s.drag) {
    const r = { x: COMPACTOR.x - 2, y: COMPACTOR.y - 2, w: 52, h: 52 };
    if (hover.kind === 'compactor') outlineRect(g, r, kind === 'compact' ? 'sodium3' : 'red', 2);
    else if (cd <= 0) outlineRect(g, r, 'sodium1');
  }
}
