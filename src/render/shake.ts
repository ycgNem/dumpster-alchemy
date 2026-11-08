// Screen shake: a few kicks at once, each a size in pixels that dies away over its time. The
// offset is always whole pixels and capped (6 px for the biggest moments), so the pixel art never
// smears. "Reduce shake" (the pause menu) cuts every kick to a third, never past 2 px; it's
// remembered in localStorage (if storage is blocked it just lasts the session).

interface Kick {
  px: number;
  dur: number;
  t: number;
}

/** No shake is ever bigger than this, however many pile up. */
const MAX_PX = 6;
/** With Reduce shake on: every kick at this share, and never past this many pixels. */
const REDUCED_MUL = 0.35;
const REDUCED_MAX = 2;
const KEY = 'dumpster-alchemy.reduceShake';

const kicks: Kick[] = [];
let clock = 0;
let offset = { x: 0, y: 0 };
let reduced = loadReduced();

function loadReduced(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Is Reduce shake on? */
export function reduceShake(): boolean {
  return reduced;
}

/** Turn Reduce shake on or off (and remember it, if the browser lets us). */
export function setReduceShake(on: boolean): void {
  reduced = on;
  if (on) kicks.length = 0;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // storage blocked: it lasts until the page closes
  }
}

/** Shake the screen `px` pixels, fading out over `dur` seconds. */
export function addShake(px: number, dur = 0.25): void {
  if (px <= 0) return;
  if (kicks.length >= 8) kicks.shift();
  kicks.push({ px, dur, t: 0 });
}

export function updateShake(dt: number): void {
  clock += dt;
  let amp = 0;
  for (let i = kicks.length - 1; i >= 0; i--) {
    const k = kicks[i];
    if (!k) continue;
    k.t += dt;
    if (k.t >= k.dur) {
      kicks.splice(i, 1);
      continue;
    }
    const left = 1 - k.t / k.dur;
    amp = Math.max(amp, k.px * left * left);
  }
  amp = reduced ? Math.min(REDUCED_MAX, amp * REDUCED_MUL) : Math.min(MAX_PX, amp);
  // Two out-of-step wobbles, rounded: jerky on purpose.
  offset = {
    x: Math.round(amp * Math.sin(clock * 71.3) * Math.cos(clock * 17.1)),
    y: Math.round(amp * Math.sin(clock * 53.7 + 1.3)),
  };
}

export function shakeOffset(): { x: number; y: number } {
  return offset;
}

export function resetShake(): void {
  kicks.length = 0;
  offset = { x: 0, y: 0 };
}
