// Inspector Possum on the lot. He walks in along the truck lane when the Stink passes the warning
// (75) and stands at the edge of the board with his clipboard; he leaves when it drops back. At a
// shutdown he marches in for the slam; on a win he keels over (plays dead). On The Inspection he
// paces the fence all night. Drawing only: he never changes the game.
//
// Sprites: `possum_walk` (32 x 32, 4 frames, side view facing right) while he walks, else
// `possum_idle` hopping; `possum_idle`, `possum_shutdown`, `possum_dead` (48 x 48) when he stops.
// The first time he walks on each night he wears a name tag ("INSPECTOR POSSUM"): at 32 px, a
// white-faced possum in a suit could be anybody (docs/CRITIC2.md N-P2-15).
import { TUNING } from '../data/tuning';
import type { GameEvent } from '../game/events';
import type { GameState } from '../game/state';
import { stinkWarnAt } from '../game/stink';
import { fillRect, outlineRect, placeholderPossum } from './greybox';
import { TRUCK_LANE, TRUCK_TIMER } from './layout';
import { drawSprite, has } from './sprites';
import { drawText, textWidth } from './text';
import { twistOf } from './twists';
import type { View } from './view';

type Mode = 'off' | 'in' | 'stand' | 'out' | 'march' | 'verdict' | 'flop' | 'pace';

/** Foot positions: the bottom of the truck lane, or the foot of the fence (The Inspection). */
const LANE_Y = TRUCK_LANE.y + TRUCK_LANE.h - 2;
const FENCE_Y = 55;
const OFF_X = -30;
/** Where he stands to warn you: left of the board's top corner, clear of the truck. */
const STAND_X = 156;
/** Where he stops to shut you down. */
const MARCH_X = 236;
const WALK = 46;
const RUSH = 170;
const PACE = 22;
const PACE_MIN = 214;
const PACE_MAX = 452;

const P = {
  mode: 'off' as Mode,
  x: OFF_X,
  dir: 1,
  /** Seconds in this mode. */
  t: 0,
  /** Distance walked (for the walk frames). */
  walked: 0,
  /** Where he's headed. */
  to: STAND_X,
  speed: WALK,
  /** After the verdict pose: keel over anyway (a pass after the quota). */
  thenFlop: false,
  /** The Inspection: pausing at the end of a lap. */
  rest: 0,
  /** Seconds his name tag has left (and whether he's worn it tonight). */
  tag: 0,
  introduced: false,
};

/** Seconds the name tag stays up. */
const TAG_SEC = 4.5;

/** The first time he's on the lot tonight, he wears his name tag. */
function introduce(): void {
  if (P.introduced) return;
  P.introduced = true;
  P.tag = TAG_SEC;
}

export function resetPossum(s?: GameState): void {
  const fence = s ? twistOf(s) === 'inspection' : false;
  P.mode = fence ? 'pace' : 'off';
  P.x = fence ? PACE_MIN + 40 : OFF_X;
  P.dir = 1;
  P.t = 0;
  P.walked = 0;
  P.to = STAND_X;
  P.speed = WALK;
  P.thenFlop = false;
  P.rest = 0;
  P.tag = 0;
  P.introduced = false;
}

function go(mode: Mode, to: number, speed: number): void {
  if (mode !== 'off' && mode !== 'out') introduce();
  P.mode = mode;
  P.to = to;
  P.speed = speed;
  P.t = 0;
}

/** The end of the night: march in to shut it down, or keel over at a win. */
export function possumEvent(s: GameState, e: GameEvent): void {
  if (e.type !== 'nightWon' && e.type !== 'nightLost') return;
  const r = s.endReason;
  if (r === 'stink' || r === 'quota' || r === 'endless' || r === 'stinkAfterQuota') {
    // He comes for the slam either way; a Stink-out after the quota is still a pass, so he
    // reads his clipboard, then faints.
    P.thenFlop = r === 'stinkAfterQuota';
    go('march', MARCH_X, RUSH);
    return;
  }
  // A win: he flops where he stands, or hurries in to flop.
  if (P.mode === 'off' || P.mode === 'out' || P.x < 40) go('march', STAND_X, RUSH);
  else go('flop', P.x, 0);
  P.thenFlop = true;
}

export function updatePossum(s: GameState, dt: number): void {
  P.t += dt;
  // The warning line is 25 under tonight's limit (75, or 50 on The Inspection).
  const warnAt = stinkWarnAt(s);
  const rearm = warnAt - (TUNING.stink.warnAt - TUNING.stink.warnRearm);
  const fence = twistOf(s) === 'inspection';
  if (P.mode === 'pace' && s.time > 1.5) introduce();
  P.tag = Math.max(0, P.tag - dt);
  if (s.status === 'playing') {
    if (s.stink >= warnAt && (P.mode === 'off' || P.mode === 'out' || P.mode === 'pace')) go('in', fence ? Math.max(PACE_MIN, Math.min(PACE_MAX, P.x)) : STAND_X, WALK * 1.5);
    else if (s.stink < rearm && (P.mode === 'in' || P.mode === 'stand')) {
      if (fence) go('pace', P.x, PACE);
      else go('out', OFF_X, WALK);
    }
  }
  switch (P.mode) {
    case 'in':
    case 'out':
    case 'march':
      if (walkTo(P.to, P.speed, dt)) {
        if (P.mode === 'in') go('stand', P.x, 0);
        else if (P.mode === 'out') go('off', OFF_X, 0);
        else go(P.thenFlop && s.endReason !== 'stinkAfterQuota' ? 'flop' : 'verdict', P.x, 0);
      }
      break;
    case 'verdict':
      if (P.thenFlop && P.t > 0.8) go('flop', P.x, 0);
      break;
    case 'pace':
      if (P.rest > 0) {
        P.rest -= dt;
        break;
      }
      if (walkTo(P.dir > 0 ? PACE_MAX : PACE_MIN, PACE, dt)) {
        P.dir = -P.dir;
        P.rest = 1.2;
      }
      break;
    default:
      break;
  }
}

/** Step toward x; true when he's there. */
function walkTo(x: number, speed: number, dt: number): boolean {
  const d = x - P.x;
  if (Math.abs(d) < 0.5) {
    P.x = x;
    return true;
  }
  P.dir = d > 0 ? 1 : -1;
  const step = Math.min(Math.abs(d), speed * dt);
  P.x += P.dir * step;
  P.walked += step;
  return false;
}

function walking(): boolean {
  return P.mode === 'in' || P.mode === 'out' || P.mode === 'march' || (P.mode === 'pace' && P.rest <= 0);
}

/**
 * Draw him. `layer` 'back' is the fence (behind the truck), 'front' the lane (in front of it).
 */
export function drawPossum(g: CanvasRenderingContext2D, s: GameState, v: View, layer: 'back' | 'front'): void {
  if (P.mode === 'off') return;
  const fence = twistOf(s) === 'inspection';
  if ((layer === 'back') !== fence) return;
  const fy = fence ? FENCE_Y : LANE_Y;
  const x = Math.round(P.x);
  const flip = P.dir < 0;
  // The name tag: above him in the lane, below him on the fence (there's only sky above).
  if (P.tag > 0) nameTag(g, x, fence ? fy + 3 : fy - (walking() ? 44 : 60), v.t, fence ? 2 : TRUCK_TIMER.x + 126);
  if (walking()) {
    const frame = Math.floor(P.walked / 6) % 4;
    if (has('possum_walk')) {
      drawSprite(g, 'possum_walk', x, fy, { frame, flip });
    } else {
      const hop = frame % 2;
      if (!drawSprite(g, 'possum_idle', x, fy - hop, { frame: 0, flip })) placeholderPossum(g, 'idle', x, fy - hop);
    }
    return;
  }
  if (P.mode === 'flop') {
    // A little bounce as he hits the dirt.
    const bounce = P.t < 0.25 ? -Math.round(Math.sin((P.t / 0.25) * Math.PI) * 3) : 0;
    if (!drawSprite(g, 'possum_dead', x, fy + bounce, { flip })) placeholderPossum(g, 'dead', x, fy + bounce);
    return;
  }
  if (P.mode === 'verdict') {
    if (!drawSprite(g, 'possum_shutdown', x, fy, { flip: false }) && !drawSprite(g, 'possum_idle', x, fy)) placeholderPossum(g, 'shutdown', x, fy);
    return;
  }
  // Standing, clipboard up: the warning. A red "!" over his head.
  const blink = v.t % 3.1 < 0.15;
  if (!drawSprite(g, 'possum_idle', x, fy, { frame: blink ? 1 : 0, flip: false })) placeholderPossum(g, 'idle', x, fy);
  if (P.mode === 'stand' && P.tag <= 0 && Math.sin(v.t * 8) > -0.2) {
    const by = fy - 54;
    fillRect(g, { x: x - 5, y: by - 1, w: 11, h: 15 }, 'ink0');
    fillRect(g, { x: x - 4, y: by, w: 9, h: 13 }, 'bone');
    drawText(g, '!', x, by + 1, { color: 'red', align: 'center' });
  }
}

/** "INSPECTOR POSSUM" on a paper tag hung on a string, top centre at (x, y); blinks out at the end. */
function nameTag(g: CanvasRenderingContext2D, x: number, y: number, t: number, minX: number): void {
  if (P.tag < 0.4 && Math.floor(t * 20) % 2 === 1) return;
  const text = 'INSPECTOR POSSUM';
  const w = textWidth(text) + 10;
  // (In the lane it keeps right of the truck timer's plate, which is drawn over him.)
  const r = { x: Math.max(minX, Math.min(638 - w, Math.round(x - w / 2))), y, w, h: 13 };
  // A bob as it swings.
  r.y += Math.round(Math.sin(t * 4) * 1);
  fillRect(g, { x: r.x + 2, y: r.y + 2, w: r.w, h: r.h }, 'ink0');
  fillRect(g, r, 'bone');
  outlineRect(g, r, 'ink0');
  fillRect(g, { x: r.x + 1, y: r.y + 1, w: 3, h: r.h - 2 }, 'red');
  drawText(g, text, r.x + 7, r.y + 1, { color: 'ink0' });
}

/** Is he on the lot as the warning right now? (The tooltip and the hints can mention him.) */
export function possumWarning(): boolean {
  return P.mode === 'stand' || P.mode === 'in';
}
