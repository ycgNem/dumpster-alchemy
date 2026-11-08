// The sounds of momentum and alchemy (docs/V2.md pillars 1 and 2): cascade pops climbing in pitch,
// the streak's fly-buzz ticks, the Raccoon Rave's air horn (and its wind-down), night 1's tire
// screeching off the truck and crashing down, the brew's bubbling and reveal fanfare (bigger the
// first time), and every tool: zap, magnet, bomb splat, fire whoosh, blanket hum, the fork gull's
// chomping, the stew's slurp, the coffee (and the truck stalling), the chum frenzy, the copier. Same recipe shape as sfx.ts: plain
// functions over an `Out`, so they play live or render in the audio lab.
import type { GameEvent } from '../game/events';
import { TUNING } from '../data/tuning';
import { type Out, RATIOS, biquad, clamp, later, lfo, metal, mtof, noise, rand, rr, semi, shaper, tone } from './synth';
import { chitter, flap, gullCall, kazoo } from './voices';

/** A sound for an event: the same shape as sfx.ts's `Sound` (kept local to avoid an import loop). */
export interface MomentumSound {
  key: string;
  pan: number;
  play: (o: Out) => number;
}

function colPan(c: number): number {
  return clamp((c - 4) / 4, -1, 1) * 0.55;
}

// ------------------------------------------------------------------------------ cascades

/** Major-pentatonic steps: each cascade link pops a note higher. */
const LADDER = [0, 4, 7, 12, 16, 19, 24, 28, 31];

/** A bubbly "bloop" on the ladder: higher every link, with a glassy ding and, from the third, a glint run. */
function cascadePop(o: Out, links: number): number {
  const step = LADDER[clamp(links - 2, 0, LADDER.length - 1)] ?? 0;
  const f = mtof(67 + step);
  let end = Math.max(
    tone(o, { type: 'triangle', f: f * 0.5, f2: f * 1.5, glide: 0.06, a: 0.002, d: 0.14, v: 0.3 }),
    tone(o, { dt: 0.04, f: f * 2, a: 0.001, d: 0.25, v: 0.14 }),
    tone(o, { dt: 0.04, f: f * 3.01, a: 0.001, d: 0.12, v: 0.05 }),
    noise(o, { f: 2400, f2: 900, glide: 0.06, q: 2, d: 0.06, v: 0.12 }),
  );
  if (links >= 3) {
    for (let i = 0; i < Math.min(5, links); i++) {
      end = Math.max(end, tone(o, { dt: 0.07 + i * 0.04, type: i % 2 ? 'triangle' : 'sine', f: f * 2 * semi(LADDER[i] ?? 0), d: 0.12, v: 0.06 }));
    }
  }
  return end;
}

// ------------------------------------------------------------------------------ the streak

/** The swarm gets louder: a tick and a fly-buzz blip, higher each step. Step 0: it fizzles out. */
function streakTick(o: Out, step: number): number {
  if (step <= 0) {
    return Math.max(
      tone(o, { type: 'sawtooth', f: 260, f2: 120, glide: 0.3, a: 0.01, d: 0.3, v: 0.05, vib: [22, 90] }),
      noise(o, { ft: 'highpass', f: 3000, d: 0.01, v: 0.08 }),
    );
  }
  const f = [0, 190, 250, 330][clamp(step, 1, 3)] ?? 330;
  const bp = biquad(o.ctx, 'bandpass', f * 3, 1.5);
  bp.connect(o.dest);
  let end = Math.max(
    noise(o, { ft: 'highpass', f: 4500, a: 0.0005, d: 0.012, v: 0.25 }),
    tone(o, { type: 'sawtooth', f, f2: f * 1.25, glide: 0.14, a: 0.01, hold: 0.06, d: 0.1, v: 0.22, vib: [26, 120], dest: bp }),
  );
  // A little rising ding per step.
  for (let i = 0; i < step; i++) end = Math.max(end, tone(o, { dt: 0.05 + i * 0.05, f: mtof(84 + i * 4), d: 0.1, v: 0.07 }));
  return end;
}

// ------------------------------------------------------------------------------ the Rave

/** An air horn: three fat detuned saws through a honk filter. */
function airHorn(o: Out, dt: number, dur: number, v: number): number {
  const { ctx } = o;
  const bp = biquad(ctx, 'bandpass', 1100, 1.2);
  const drv = shaper(ctx, 3);
  bp.connect(drv).connect(o.dest);
  let end = 0;
  for (const [m, det] of [[70, -8], [70, 9], [77, 4]] as const) {
    end = Math.max(end, tone(o, { dt, type: 'sawtooth', f: mtof(m) * 0.93, f2: mtof(m), glide: 0.05, detune: det, a: 0.01, hold: dur, d: 0.08, v: v * 0.3, dest: bp }));
  }
  return end;
}

/** RACCOON RAVE: a riser, BWAA BWAAAA on the air horn, a kick, and somebody whooping. */
function feverStart(o: Out): number {
  return Math.max(
    noise(o, { ft: 'bandpass', f: 400, f2: 6000, glide: 0.35, q: 2, a: 0.3, d: 0.05, v: 0.12 }),
    airHorn(o, 0.35, 0.12, 0.9),
    airHorn(o, 0.55, 0.5, 1),
    tone(o, { dt: 0.35, f: 120, f2: 40, glide: 0.12, d: 0.25, v: 0.6 }),
    tone(o, { dt: 0.55, f: 120, f2: 40, glide: 0.12, d: 0.25, v: 0.6 }),
    noise(o, { dt: 0.55, ft: 'highpass', f: 5000, q: 0.5, d: 0.9, v: 0.12 }),
    0.75 + chitter(later(o, 0.75), 'pete', 'happy'),
  );
}

/** Rave's over: the record drags to a stop. */
function feverEnd(o: Out): number {
  return Math.max(
    noise(o, { f: 1800, f2: 200, glide: 0.4, q: 3, a: 0.01, d: 0.4, v: 0.18 }),
    tone(o, { type: 'sawtooth', f: 220, f2: 55, glide: 0.5, a: 0.01, d: 0.5, v: 0.08 }),
    tone(o, { dt: 0.05, type: 'triangle', f: 440, f2: 110, glide: 0.45, d: 0.45, v: 0.1 }),
  );
}

// ------------------------------------------------------------------------------ the tire

/** Tires screech, a "boing" off the tailgate, then the crash when it lands (after its flight). */
function fellOff(o: Out): number {
  const { ctx } = o;
  const land = TUNING.combo.fellOffFlightSec;
  // The screech: a narrow band of noise, wobbling.
  const bp = biquad(ctx, 'bandpass', 2600, 9);
  lfo(ctx, bp.frequency, 13, 260, o.t, o.t + 0.6);
  bp.connect(o.dest);
  noise({ ...o, dest: bp }, { ft: 'highpass', f: 800, a: 0.02, hold: 0.35, d: 0.2, v: 0.5 });
  let end = Math.max(
    0.6,
    // boing off the tailgate
    tone(o, { dt: 0.25, f: 140, f2: 95, glide: 0.12, d: 0.16, v: 0.45 }),
    tone(o, { dt: 0.27, type: 'triangle', f: 300, f2: 520, glide: 0.2, d: 0.25, v: 0.12, vib: [18, 120] }),
    // the whistle down
    tone(o, { dt: 0.4, f: 1800, f2: 500, glide: land - 0.4, d: land - 0.4, v: 0.06 }),
  );
  // CRASH: a big rubber thud, dirt everywhere, the clatter of everything it hit.
  end = Math.max(
    end,
    noise(o, { dt: land, kind: 'brown', ft: 'lowpass', f: 1500, f2: 200, glide: 0.3, d: 0.45, v: 0.6, drive: 6 }),
    tone(o, { dt: land, f: 110, f2: 32, glide: 0.25, d: 0.5, v: 0.7 }),
    tone(o, { dt: land + 0.18, f: 150, f2: 92, glide: 0.12, d: 0.14, v: 0.35 }),
    tone(o, { dt: land + 0.34, f: 140, f2: 100, glide: 0.08, d: 0.1, v: 0.2 }),
  );
  for (let i = 0; i < 5; i++) {
    end = Math.max(end, metal(o, { dt: land + 0.03 + i * rr(0.04, 0.09), f: rr(600, 1600), ratios: RATIOS.can, d: 0.1, v: 0.08 }));
  }
  return end;
}

// ------------------------------------------------------------------------------ brews

/** A cauldron burble: a run of little bubbles rising. */
function bubbles(o: Out, n: number, v: number): number {
  let end = noise(o, { ft: 'lowpass', f: 700, a: 0.05, d: 0.3, v: 0.12 });
  for (let i = 0; i < n; i++) {
    const f = rr(300, 900) * (1 + i / n);
    end = Math.max(end, tone(o, { dt: i * rr(0.025, 0.05), f, f2: f * 1.8, glide: 0.03, d: 0.04, v }));
  }
  return end;
}

/** A brew: bubbling, then a toy-glock fanfare up to the result (a bigger "ta-da" the first time). */
function brew(o: Out, first: boolean, treasure: boolean): number {
  let end = bubbles(o, first ? 14 : 9, 0.14);
  const base = treasure ? 72 : 67;
  const run = [0, 4, 7, 12];
  run.forEach((st, i) => {
    end = Math.max(end, tone(later(o, 0.3), { dt: i * 0.07, type: 'triangle', f: mtof(base + st), d: i === run.length - 1 ? 0.5 : 0.14, v: 0.13 }));
    end = Math.max(end, tone(later(o, 0.3), { dt: i * 0.07, f: mtof(base + st + 12), d: 0.15, v: 0.04 }));
  });
  if (first) {
    end = Math.max(
      end,
      0.6 + kazoo(later(o, 0.6), [{ dt: 0, dur: 0.1, m: base }, { dt: 0.12, dur: 0.5, m: base + 7 }], 0.18),
      noise(o, { dt: 0.6, ft: 'highpass', f: 5000, q: 0.5, d: 0.8, v: 0.1 }),
    );
  }
  return end;
}

// ------------------------------------------------------------------------------ tools

/** Electric Soup: a buzzing zap down the spectrum, crackling. */
function zap(o: Out): number {
  const lp = biquad(o.ctx, 'lowpass', 5000, 2);
  lp.connect(o.dest);
  let end = Math.max(
    tone(o, { type: 'square', f: 2200, f2: 160, glide: 0.25, a: 0.002, d: 0.3, v: 0.16, vib: [60, 400], dest: lp }),
    tone(o, { type: 'sawtooth', f: 120, a: 0.002, hold: 0.15, d: 0.1, v: 0.1, vib: [50, 60], dest: lp }),
  );
  for (let i = 0; i < 8; i++) end = Math.max(end, noise(o, { dt: rand() * 0.3, ft: 'highpass', f: 3500, a: 0.0005, d: 0.008, v: 0.3 }));
  return end;
}

/** The Junk Magnet: a rising "vwoom" with a wobble, then a clank as it all slams together. */
function magnet(o: Out): number {
  return Math.max(
    tone(o, { f: 90, f2: 360, glide: 0.45, a: 0.05, d: 0.45, v: 0.3, vib: [11, 70] }),
    tone(o, { type: 'triangle', f: 180, f2: 720, glide: 0.45, a: 0.05, d: 0.45, v: 0.08, vib: [11, 70] }),
    metal(o, { dt: 0.5, f: 330, ratios: RATIOS.plate, d: 0.45, v: 0.3, bright: 0.7, click: 0.5 }),
    tone(o, { dt: 0.5, f: 120, f2: 45, glide: 0.1, d: 0.2, v: 0.4 }),
  );
}

/** The Bag Bomb: a wet, heavy SPLAT and the rain of bits after it. */
function bombSplat(o: Out): number {
  let end = Math.max(
    noise(o, { kind: 'brown', ft: 'lowpass', f: 1600, f2: 250, glide: 0.25, a: 0.002, d: 0.4, v: 0.7, drive: 5 }),
    tone(o, { f: 90, f2: 30, glide: 0.3, d: 0.45, v: 0.7 }),
    noise(o, { f: 1400, f2: 280, glide: 0.2, q: 1.5, a: 0.002, d: 0.3, v: 0.4 }),
  );
  for (let i = 0; i < 7; i++) {
    const f = rr(400, 1000);
    end = Math.max(end, tone(o, { dt: 0.25 + i * rr(0.05, 0.1), f, f2: f * 0.55, d: 0.05, v: 0.1 }));
  }
  return end;
}

/** The Tire Fire: a whoosh catching, and a crackle that keeps going. */
function fireWhoosh(o: Out): number {
  let end = Math.max(
    noise(o, { f: 250, f2: 2800, glide: 0.35, q: 1.2, a: 0.08, d: 0.5, v: 0.4 }),
    noise(o, { kind: 'brown', ft: 'lowpass', f: 500, a: 0.1, hold: 0.4, d: 0.5, v: 0.4 }),
  );
  for (let i = 0; i < 14; i++) end = Math.max(end, noise(o, { dt: 0.2 + rand() * 0.9, f: rr(1500, 4000), q: 3, a: 0.0005, d: 0.01, v: rr(0.15, 0.35) }));
  return end;
}

/** The Electric Blanket: a warm mains hum swelling up, and a soft fwump as it settles. */
function blanketHum(o: Out): number {
  const lp = biquad(o.ctx, 'lowpass', 900, 0.8);
  lp.connect(o.dest);
  return Math.max(
    tone(o, { type: 'sawtooth', f: 60, a: 0.25, hold: 0.5, d: 0.4, v: 0.18, dest: lp }),
    tone(o, { type: 'sawtooth', f: 120.5, a: 0.25, hold: 0.5, d: 0.4, v: 0.08, dest: lp }),
    tone(o, { f: 180, a: 0.3, hold: 0.4, d: 0.4, v: 0.08, vib: [4, 15] }),
    noise(o, { kind: 'brown', ft: 'lowpass', f: 400, a: 0.02, d: 0.25, v: 0.35 }),
  );
}

/** A slurp (Stew, Boot Coffee): a wobbling sweep through a wet filter. */
function slurp(o: Out): number {
  return Math.max(
    noise(o, { ft: 'bandpass', f: 600, f2: 2200, glide: 0.35, q: 6, a: 0.02, d: 0.35, v: 0.3 }),
    tone(o, { f: 300, f2: 700, glide: 0.3, d: 0.3, v: 0.08, vib: [14, 200] }),
    tone(o, { dt: 0.38, f: 900, f2: 1500, glide: 0.04, d: 0.05, v: 0.12 }),
  );
}

/** Boot Coffee: a long slurp, a caffeinated "ahh", and the truck's engine sputtering out. */
function coffee(o: Out): number {
  return Math.max(
    slurp(o),
    tone(o, { dt: 0.45, type: 'triangle', f: 520, f2: 760, glide: 0.12, d: 0.2, v: 0.12, vib: [9, 60] }),
    // the stall: a few dying chugs
    ...[0.6, 0.78, 0.98, 1.24].map((dt, i) => tone(o, { dt, type: 'sawtooth', f: 70 - i * 8, f2: 40, glide: 0.08, d: 0.1, v: 0.18 - i * 0.03 })),
    noise(o, { dt: 1.3, f: 900, q: 0.8, a: 0.001, d: 0.08, v: 0.25, drive: 4 }),
  );
}

/** The Chum Bucket: a wet slop, then every gull on the lot losing its mind. */
function chum(o: Out): number {
  let end = Math.max(
    noise(o, { kind: 'brown', ft: 'lowpass', f: 900, f2: 250, glide: 0.2, d: 0.3, v: 0.45 }),
    tone(o, { f: 200, f2: 70, glide: 0.15, d: 0.2, v: 0.35 }),
  );
  for (let i = 0; i < 4; i++) {
    end = Math.max(end, flap(o, 0.15 + i * 0.07, 0.2), gullCall(o, { dt: 0.2 + i * 0.09, f: 1200 * semi(i * 2), dur: 0.3, v: 0.16, rasp: 0.6 }));
  }
  return end;
}

/** Gull With A Fork: it dives in and eats everything: crunch, crunch, gulp, burp. */
function forkGull(o: Out): number {
  let end = Math.max(flap(o, 0, 0.3), gullCall(o, { dt: 0.05, f: 1500, dur: 0.22, v: 0.25, rasp: 0.4 }));
  for (let i = 0; i < 4; i++) {
    end = Math.max(end, noise(o, { dt: 0.3 + i * 0.12, f: rr(1400, 2400), q: 1.2, d: 0.05, v: 0.22, drive: 4 }), metal(o, { dt: 0.3 + i * 0.12, f: rr(2000, 2600), ratios: RATIOS.tin, d: 0.05, v: 0.06 }));
  }
  return Math.max(
    end,
    tone(o, { dt: 0.82, f: 420, f2: 120, glide: 0.1, d: 0.12, v: 0.3 }),
    tone(o, { dt: 1.0, type: 'sawtooth', f: 110, f2: 80, glide: 0.25, d: 0.28, v: 0.12, vib: [22, 80] }),
  );
}

/** Leftovers: a copier's whirr across the page, then a ding as the copy pops out. */
function copier(o: Out): number {
  const bp = biquad(o.ctx, 'bandpass', 1200, 2);
  bp.connect(o.dest);
  return Math.max(
    tone(o, { type: 'sawtooth', f: 180, f2: 240, glide: 0.4, a: 0.03, hold: 0.3, d: 0.1, v: 0.12, dest: bp }),
    noise(o, { f: 3000, f2: 5000, glide: 0.4, q: 2, a: 0.03, hold: 0.3, d: 0.1, v: 0.08 }),
    tone(o, { dt: 0.45, f: mtof(88), d: 0.35, v: 0.12 }),
    tone(o, { dt: 0.45, f: mtof(100), d: 0.2, v: 0.04 }),
    tone(o, { dt: 0.42, f: 300, f2: 900, glide: 0.06, d: 0.08, v: 0.2 }),
  );
}

function toolSound(e: Extract<GameEvent, { type: 'toolUsed' }>): MomentumSound {
  const pan = colPan(e.c);
  const id: string = e.id;
  switch (id) {
    case 'elecsoup':
      return { key: 'tool.zap', pan, play: zap };
    case 'magnet':
      return { key: 'tool.magnet', pan, play: magnet };
    case 'bagbomb':
      return { key: 'tool.bomb', pan, play: bombSplat };
    case 'tirefire':
      return { key: 'tool.fire', pan, play: fireWhoosh };
    case 'blanket':
      return { key: 'tool.blanket', pan, play: blanketHum };
    case 'stew':
      return { key: 'tool.stew', pan: -0.6, play: slurp };
    case 'bootcoffee':
      return { key: 'tool.coffee', pan: 0, play: coffee };
    case 'forkgull':
      return { key: 'tool.fork', pan, play: forkGull };
    case 'chum':
      return { key: 'tool.chum', pan, play: chum };
    case 'leftovers':
      return { key: 'tool.copy', pan, play: copier };
    default:
      // Anything new: a pop and a sparkle.
      return {
        key: 'tool',
        pan,
        play: (o) => Math.max(tone(o, { f: 300, f2: 900, glide: 0.06, d: 0.08, v: 0.25 }), tone(o, { dt: 0.06, f: mtof(88), d: 0.25, v: 0.08 })),
      };
  }
}

// ------------------------------------------------------------------------------ the table

/** The sound for a momentum, brew or tool event, or null if it isn't one of those. */
export function momentumSound(e: GameEvent): MomentumSound | null {
  switch (e.type) {
    case 'cascade':
      return { key: 'cascade', pan: colPan(e.c), play: (o) => cascadePop(o, e.links) };
    case 'streak':
      return { key: 'streak', pan: 0, play: (o) => streakTick(o, e.step) };
    case 'feverStart':
      return { key: 'feverStart', pan: 0, play: feverStart };
    case 'feverEnd':
      return { key: 'feverEnd', pan: 0, play: feverEnd };
    case 'fellOff':
      return { key: 'fellOff', pan: colPan(e.c), play: fellOff };
    case 'brew':
      return { key: e.first ? 'brew.first' : 'brew', pan: colPan(e.c), play: (o) => brew(o, e.first, e.kind === 'treasure') };
    case 'toolUsed':
      return toolSound(e);
    default:
      return null;
  }
}
