// Screen shake: a few kicks at once, each a size in pixels that dies away over its time. The
// offset is always whole pixels and small (capped), so the pixel art never smears.

interface Kick {
  px: number;
  dur: number;
  t: number;
}

/** No shake is ever bigger than this, however many pile up. */
const MAX_PX = 5;

const kicks: Kick[] = [];
let clock = 0;
let offset = { x: 0, y: 0 };

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
  amp = Math.min(MAX_PX, amp);
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
