// Momentum on screen (src/game/combo.ts): the Stench Streak's fly-swarm meter in the sky under
// the night bar, and the Raccoon Rave's gentle party lights over the lot. (Cascades, reveals and
// splats are on the board, board.ts; the slams and words are in fx.ts.)
import { PAL, type PalName } from '../data/palette';
import { TUNING } from '../data/tuning';
import { viewRect } from '../engine/screen';
import { streakView } from '../game/combo';
import type { GameState } from '../game/state';
import { fillRect } from './greybox';
import { bigText } from './menus';
import { drawSprite } from './sprites';
import { drawText } from './text';
import type { View } from './view';

/** The meter's plate: centred under the night bar, clear of the night's name and the clock. */
export const STREAK_PLATE = { x: 222, y: 19, w: 196, h: 17 };
const BAR = { x: STREAK_PLATE.x + 52, y: STREAK_PLATE.y + 5, w: 100, h: 7 };

/** Rave colours, cycled gently (never a hard strobe). */
const RAVE: readonly PalName[] = ['pink', 'blue', 'toxic2', 'yellow'];

/** When the multiplier last went up (render time), for its bounce. */
let bumpAt = -9;
let lastStep = 0;

function fly(g: CanvasRenderingContext2D, x: number, y: number, phase: number): void {
  if (!drawSprite(g, 'fx_fly', x, y + 2, { phase })) fillRect(g, { x, y, w: 2, h: 1 }, 'ink0');
}

/**
 * The Stench Streak: an ink plate with "STREAK", a bar of sludge that fills with heat (notches at
 * each pay step) with flies swarming over the full part, a thin line under it for the window
 * that's left, and the pay multiplier. In the Rave the bar is a scrolling party stripe running
 * down, and the multiplier bounces.
 */
export function drawStreakMeter(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  const st = streakView(s);
  if (st.step > lastStep) bumpAt = v.t;
  lastStep = st.step;
  const P = STREAK_PLATE;
  const rave = st.fever > 0;
  fillRect(g, P, 'ink0');
  fillRect(g, { x: P.x, y: P.y + P.h - 1, w: P.w, h: 1 }, rave ? RAVE[Math.floor(v.t * 2) % RAVE.length] ?? 'pink' : 'night1');

  // The label (and a fly or two even when it's cold, so it reads as the stink meter).
  const label = rave ? 'RAVE!' : 'STREAK';
  const lc: PalName = rave ? (RAVE[Math.floor(v.t * 4) % RAVE.length] ?? 'pink') : st.heat > 0 ? 'toxic3' : 'steel2';
  drawText(g, label, P.x + 5, P.y + 3, { color: lc });

  // The bar.
  fillRect(g, BAR, 'ink1');
  if (rave) {
    const w = Math.round(BAR.w * st.fever);
    const scroll = Math.floor(v.t * 24);
    for (let x = 0; x < w; x++) {
      const k = Math.floor((x + scroll) / 6) % RAVE.length;
      fillRect(g, { x: BAR.x + x, y: BAR.y + 1, w: 1, h: BAR.h - 2 }, RAVE[k] ?? 'pink');
    }
  } else {
    const w = Math.round(BAR.w * st.heat);
    const hot = st.step >= 3;
    if (w > 0) {
      fillRect(g, { x: BAR.x, y: BAR.y + 1, w, h: BAR.h - 2 }, st.step >= 2 ? 'toxic1' : 'grime2');
      fillRect(g, { x: BAR.x, y: BAR.y + 1, w, h: 1 }, hot ? 'toxic3' : st.step >= 2 ? 'toxic2' : 'grime3');
      // Bubbles in the sludge.
      for (let i = 0; i < 3; i++) {
        const bx = Math.floor((v.t * (9 + i * 5) + i * 31) % Math.max(1, w));
        fillRect(g, { x: BAR.x + bx, y: BAR.y + 3 + (i % 2), w: 1, h: 1 }, 'grime1');
      }
    }
    // The notches where the pay steps up.
    for (const [at] of TUNING.combo.steps) {
      const nx = BAR.x + Math.round(BAR.w * at);
      fillRect(g, { x: nx, y: BAR.y - 1, w: 1, h: BAR.h + 2 }, st.heat >= at ? 'yellow' : 'ink2');
    }
    // The window left before it cools: a thin line under the bar.
    if (st.heat > 0) {
      const hw = Math.round(BAR.w * Math.max(0, Math.min(1, st.hold)));
      if (hw > 0) fillRect(g, { x: BAR.x, y: BAR.y + BAR.h + 1, w: hw, h: 1 }, 'sodium2');
      else if (Math.floor(v.t * 6) % 2 === 0) fillRect(g, { x: BAR.x, y: BAR.y + BAR.h + 1, w: 3, h: 1 }, 'red');
    }
  }

  // The swarm: more flies the hotter it is, buzzing over the full part (and spilling out in the Rave).
  const full = rave ? 1 : st.heat;
  const n = 1 + Math.round(full * 9) + (rave ? 4 : 0);
  for (let i = 0; i < n; i++) {
    const a = v.t * (3.1 + (i % 4) * 0.7) + i * 2.3;
    const span = Math.max(6, BAR.w * full);
    const x = Math.round(BAR.x + ((i * 37) % 97) / 97 * span + Math.sin(a) * 4);
    const y = Math.round(BAR.y + 2 + Math.cos(a * 1.3) * (rave ? 7 : 4));
    fly(g, x, y, i * 0.31);
  }

  // The multiplier: bounces when it goes up, big and colourful in the Rave.
  const mul = st.mul;
  const text = `x${Math.round(mul * 100) / 100}`;
  const mx = P.x + P.w - 5;
  const bump = v.t - bumpAt < 0.35 ? Math.round(Math.sin((v.t - bumpAt) * 18) * -2) : 0;
  if (rave) {
    const hop = Math.round(Math.abs(Math.sin(v.t * 8)) * -3);
    bigText(g, text, mx + 2, P.y - 4 + hop, 2, { color: RAVE[Math.floor(v.t * 4 + 1) % RAVE.length] ?? 'yellow', outline: 'ink0', align: 'right' });
  } else {
    const c: PalName = st.step >= 3 ? 'toxic3' : st.step === 2 ? 'yellow' : st.step === 1 ? 'sodium3' : 'steel2';
    drawText(g, text, mx, P.y + 3 + bump, { color: c, align: 'right' });
  }
}

/** The pointer is over the streak meter (for its tooltip). */
export function overStreak(x: number, y: number): boolean {
  const P = STREAK_PLATE;
  return x >= P.x && y >= P.y && x < P.x + P.w && y < P.y + P.h;
}

/** What the streak meter is, for the hover tooltip. */
export function streakTip(): string {
  const C = TUNING.combo;
  return `STENCH STREAK. Merges, combos and sales keep the flies coming: the streak holds ${C.windowSec}s after each, then cools. It multiplies what raccoons pay. Fill it and the RACCOON RAVE starts: ${C.feverSec}s of x${C.feverMul} pay and free Dumpster clicks.`;
}

/**
 * The Rave's party lights: a slow wash of colour over the whole screen, changing colour on the
 * dim of each swell (no hard strobe), and two soft beams sweeping down from the sky.
 */
export function drawFeverPulse(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  const st = streakView(s);
  if (st.fever <= 0) return;
  // Fade in over the first half second, out over the last.
  const left = st.fever * TUNING.combo.feverSec;
  const into = TUNING.combo.feverSec - left;
  const edge = Math.min(1, into / 0.5, left / 0.6);
  const beat = 0.94;
  const k = (v.t % beat) / beat;
  const swell = 0.5 - 0.5 * Math.cos(k * Math.PI * 2);
  const colour = RAVE[Math.floor(v.t / beat) % RAVE.length] ?? 'pink';
  const r = viewRect();
  const a = g.globalAlpha;
  g.globalAlpha = a * edge * (0.03 + 0.07 * swell);
  g.fillStyle = PAL[colour];
  g.fillRect(r.x, r.y, r.w, r.h);
  // Two beams from the top corners, swinging slowly.
  const beams: [number, PalName, number][] = [
    [80, 'pink', 0],
    [560, 'blue', Math.PI],
  ];
  for (const [x0, c, ph] of beams) {
    const sway = Math.sin(v.t * 0.9 + ph) * 160;
    g.globalAlpha = a * edge * 0.09;
    g.fillStyle = PAL[c];
    g.beginPath();
    g.moveTo(x0 - 6, -2);
    g.lineTo(x0 + 6, -2);
    g.lineTo(x0 + sway + 50, 340);
    g.lineTo(x0 + sway - 50, 340);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = a;
}
