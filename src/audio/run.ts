// The sounds of the run (docs/V2.md pillar 3): Contraband picked, bought, sold and rerolled; a
// map fork chosen and the truck putting along to it; the bosses (the Possum's CONDEMNED stamp,
// the Gull God's cry, its snatch and a "fed" chirp, Spring Cleaning's fanfare); a strike's stamp,
// FIRED (a wet, sagging trombone), the run won, and the Daily card copied. Same recipe shape as
// sfx.ts: plain functions over an `Out`, so they play live or render in the audio lab. All short.
import type { GameEvent } from '../game/events';
import { type Out, RATIOS, biquad, echo, later, metal, mtof, noise, rand, rr, semi, tone } from './synth';
import { crowdUgh, flap, gullCall, kazoo, trombone } from './voices';

/** A sound: the same shape as sfx.ts's `Sound` (kept local to avoid an import loop). */
export interface RunSound {
  key: string;
  pan: number;
  play: (o: Out) => number;
}

/** Scene-made run sounds (no game event behind them). */
export type RunKind =
  | 'pick'
  | 'buy'
  | 'sell'
  | 'reroll'
  | 'fork'
  | 'drive'
  | 'strike'
  | 'fired'
  | 'runWon'
  | 'copy'
  | 'spring'
  | 'condemn'
  | 'godCry';

// ------------------------------------------------------------------------------ building blocks

/** A rubber stamp: a hollow thump, a paper slap, a little ink squelch. */
function stamp(o: Out, v = 1): number {
  return Math.max(
    tone(o, { f: 150, f2: 55, glide: 0.08, a: 0.001, d: 0.14, v: 0.55 * v }),
    noise(o, { f: 1800, q: 0.7, a: 0.001, d: 0.05, v: 0.4 * v }),
    noise(o, { kind: 'brown', ft: 'lowpass', f: 700, a: 0.001, d: 0.09, v: 0.45 * v }),
    tone(o, { dt: 0.05, f: 420, f2: 260, glide: 0.05, d: 0.05, v: 0.08 * v }),
  );
}

/** A sticker peeled off its backing: a rising rip. */
function peel(o: Out, dt = 0): number {
  return noise(o, { dt, f: 1200, f2: 5000, glide: 0.12, q: 2.5, a: 0.01, d: 0.1, v: 0.22 });
}

/** A single coin clink. */
function clink(o: Out, dt: number, f: number, v: number): number {
  return metal(o, { dt, f, ratios: RATIOS.tin, d: 0.12, v, click: 0.3 });
}

// ------------------------------------------------------------------------------ the shop and loot

/** Loot: peel the sticker, "yoink!" (a slide whistle up), slap it in a slot. */
function pick(o: Out): number {
  return Math.max(
    peel(o),
    tone(o, { dt: 0.08, f: 500, f2: 1400, glide: 0.14, a: 0.01, d: 0.16, v: 0.16, vib: [9, 30] }),
    noise(o, { dt: 0.24, f: 900, q: 1, a: 0.001, d: 0.04, v: 0.3 }),
    tone(o, { dt: 0.24, f: 220, f2: 120, d: 0.06, v: 0.25 }),
  );
}

/** Bought Contraband: a sticker peel, then a short ka-ching. */
function buy(o: Out): number {
  let end = Math.max(
    peel(o),
    noise(o, { dt: 0.1, f: 500, q: 1, d: 0.04, v: 0.3 }),
    tone(o, { dt: 0.1, f: 160, f2: 90, d: 0.05, v: 0.25 }),
    metal(o, { dt: 0.16, f: 2093, ratios: [1, 1.5, 2.0, 2.7], d: 0.5, v: 0.18, bright: 0.8 }),
  );
  for (let i = 0; i < 3; i++) end = Math.max(end, clink(o, 0.2 + i * 0.06, rr(3200, 4600), 0.05));
  return end;
}

/** Sold: coins counted out onto the counter, dropping in pitch (money leaving Grandma's tin). */
function sell(o: Out): number {
  let end = noise(o, { f: 2400, f2: 900, glide: 0.08, q: 2, d: 0.07, v: 0.16 });
  [2600, 2300, 2000, 1750].forEach((f, i) => {
    end = Math.max(end, clink(o, 0.05 + i * 0.07, f * semi(rr(-0.3, 0.3)), 0.12));
  });
  return Math.max(end, tone(o, { dt: 0.33, type: 'triangle', f: mtof(76), f2: mtof(72), glide: 0.05, d: 0.18, v: 0.08 }));
}

/** Reroll: a riffle of cards and a rattle in the box. */
function reroll(o: Out): number {
  let end = 0;
  for (let i = 0; i < 9; i++) end = Math.max(end, noise(o, { dt: i * 0.028 + rand() * 0.008, f: rr(2200, 3600), q: 1.5, a: 0.001, d: 0.02, v: 0.22 }));
  return Math.max(
    end,
    noise(o, { dt: 0.28, f: 900, q: 1, a: 0.001, d: 0.05, v: 0.3 }),
    tone(o, { dt: 0.28, f: 200, f2: 120, d: 0.06, v: 0.22 }),
    tone(o, { dt: 0.34, type: 'triangle', f: mtof(79), d: 0.12, v: 0.07 }),
  );
}

// ------------------------------------------------------------------------------ the map

/** A fork chosen: a pushpin into the map, and a marker squeak circling it. */
function fork(o: Out): number {
  return Math.max(
    noise(o, { f: 3000, q: 1, a: 0.001, d: 0.015, v: 0.3 }),
    tone(o, { f: 900, f2: 300, glide: 0.03, d: 0.04, v: 0.2 }),
    tone(o, { dt: 0.06, type: 'sawtooth', f: 1300, f2: 1700, glide: 0.1, a: 0.01, d: 0.1, v: 0.04, dest: bp(o, 1800, 4) }),
  );
}

function bp(o: Out, f: number, q: number): AudioNode {
  const b = biquad(o.ctx, 'bandpass', f, q);
  b.connect(o.dest);
  return b;
}

/** The crew's truck putting along the dotted road: a little engine, two bounces, a backfire puff. */
function drive(o: Out): number {
  const lp = biquad(o.ctx, 'lowpass', 380, 2);
  lp.connect(o.dest);
  let end = 0;
  for (let i = 0; i < 9; i++) {
    end = Math.max(end, tone(o, { dt: i * 0.075, type: 'sawtooth', f: 62 + i * 2, f2: 50, glide: 0.05, a: 0.004, d: 0.06, v: 0.3, dest: lp }));
  }
  return Math.max(
    end,
    tone(o, { dt: 0.2, type: 'triangle', f: 240, f2: 420, glide: 0.08, d: 0.1, v: 0.08 }),
    tone(o, { dt: 0.45, type: 'triangle', f: 260, f2: 440, glide: 0.08, d: 0.1, v: 0.08 }),
    noise(o, { dt: 0.7, f: 700, q: 0.7, a: 0.001, d: 0.08, v: 0.25, drive: 4 }),
  );
}

// ------------------------------------------------------------------------------ the bosses

/** The Inspection: the Possum's CONDEMNED stamp, and the tape going up. */
function condemn(o: Out): number {
  return Math.max(stamp(o), noise(o, { dt: 0.12, f: 2500, f2: 4500, glide: 0.18, q: 3, a: 0.02, d: 0.12, v: 0.14 }));
}

/** The Gull God's cry: three throats in a big echoing room. */
function godCry(o: Out): number {
  const wet = echo(o.ctx, o.dest, 0.17, 0.3, 0.4, o.t + 1.4);
  const w = later(o, 0, wet);
  let end = Math.max(flap(w, 0, 0.3), flap(w, 0.08, 0.3));
  [1, 1.26, 1.5].forEach((r, i) => {
    end = Math.max(end, gullCall(w, { dt: 0.05 + i * 0.08, f: 1000 * r, dur: 0.6, v: 0.18, rasp: 0.85, fall: 1.15 }));
  });
  return end + 0.5;
}

/** The God's cry, then the snatch: a whoosh past and the piece gone (a sad little pluck). */
function raid(o: Out): number {
  return Math.max(
    godCry(o),
    noise(o, { dt: 0.55, f: 400, f2: 3000, glide: 0.2, q: 1.2, a: 0.05, d: 0.18, v: 0.3 }),
    tone(o, { dt: 0.8, type: 'triangle', f: mtof(67), f2: mtof(60), glide: 0.15, d: 0.2, v: 0.12 }),
  );
}

/** Fed: a happy chirp, up. */
function fed(o: Out): number {
  return Math.max(
    gullCall(o, { f: 1500, dur: 0.12, v: 0.2, rasp: 0.15, fall: 0.8 }),
    gullCall(o, { dt: 0.13, f: 1900, dur: 0.14, v: 0.18, rasp: 0.1, fall: 0.75 }),
    tone(o, { dt: 0.2, f: mtof(88), d: 0.2, v: 0.08 }),
  );
}

/** The God flies on, fed: wings fading away. */
function pass(o: Out): number {
  return Math.max(flap(o, 0, 0.22), flap(o, 0.12, 0.16), flap(o, 0.26, 0.1));
}

/** Spring Cleaning: a kazoo fanfare and a crash cymbal, with a broom swish. */
function spring(o: Out): number {
  const tune = [
    { dt: 0, dur: 0.1, m: 72 },
    { dt: 0.12, dur: 0.1, m: 72 },
    { dt: 0.24, dur: 0.1, m: 76 },
    { dt: 0.36, dur: 0.5, m: 79 },
  ];
  return Math.max(
    noise(o, { f: 600, f2: 3500, glide: 0.25, q: 1, a: 0.08, d: 0.15, v: 0.15 }),
    kazoo(later(o, 0.1), tune, 0.28) + 0.1,
    kazoo(later(o, 0.1), [{ dt: 0.36, dur: 0.5, m: 72 }], 0.16) + 0.1,
    noise(o, { dt: 0.46, ft: 'highpass', f: 5000, q: 0.5, d: 0.8, v: 0.12 }),
    tone(o, { dt: 0.46, f: 120, f2: 45, glide: 0.1, d: 0.2, v: 0.35 }),
  );
}

/** A Contraband did its thing: a sticker "pip" (the Bribe gets a coin and a sly whistle). */
function perkPip(o: Out, id: string): number {
  if (id === 'bribe') {
    return Math.max(clink(o, 0, 2400, 0.14), tone(o, { dt: 0.12, f: mtof(84), f2: mtof(79), glide: 0.12, a: 0.02, d: 0.2, v: 0.1, vib: [6, 25] }));
  }
  return Math.max(
    tone(o, { type: 'triangle', f: mtof(81), f2: mtof(86), glide: 0.04, d: 0.1, v: 0.12 }),
    noise(o, { f: 4000, q: 2, d: 0.02, v: 0.1 }),
  );
}

// ------------------------------------------------------------------------------ the report and the end

/** A strike: the Possum's stamp, hard, and a wet "blap" under it. */
function strike(o: Out): number {
  return Math.max(
    stamp(o, 1.2),
    tone(o, { dt: 0.08, type: 'sawtooth', f: 110, f2: 70, glide: 0.2, d: 0.22, v: 0.1, vib: [18, 40] }),
  );
}

/** FIRED: a sad trombone that sags into a wet raspberry, and the crowd going "ugh". */
function fired(o: Out): number {
  const sag = trombone(
    o,
    [
      { dt: 0, dur: 0.3, m: 55 },
      { dt: 0.34, dur: 0.3, m: 54 },
      { dt: 0.68, dur: 0.3, m: 53 },
      { dt: 1.02, dur: 1.0, m: 50 },
    ],
    0.3,
  );
  return Math.max(
    sag,
    // the raspberry: a buzzy, wobbling, falling fart of a note
    tone(o, { dt: 1.6, type: 'sawtooth', f: 95, f2: 55, glide: 0.5, a: 0.02, d: 0.5, v: 0.14, vib: [24, 60], dest: bp(o, 400, 1.5) }),
    noise(o, { dt: 1.6, kind: 'brown', ft: 'lowpass', f: 500, a: 0.02, d: 0.45, v: 0.25 }),
    2.0 + crowdUgh(later(o, 2.0)),
  );
}

/** The run won: a big kazoo march with a cymbal crash and coins raining. */
function runWon(o: Out): number {
  const tune = [
    { dt: 0, dur: 0.12, m: 67 },
    { dt: 0.14, dur: 0.12, m: 72 },
    { dt: 0.28, dur: 0.12, m: 76 },
    { dt: 0.42, dur: 0.3, m: 79 },
    { dt: 0.78, dur: 0.12, m: 76 },
    { dt: 0.92, dur: 1.0, m: 84 },
  ];
  let end = Math.max(
    kazoo(o, tune, 0.3),
    kazoo(o, [{ dt: 0.42, dur: 0.3, m: 72 }, { dt: 0.92, dur: 1.0, m: 76 }], 0.18),
    kazoo(o, [{ dt: 0.92, dur: 1.0, m: 79 }], 0.12),
    tone(o, { dt: 0.42, f: 120, f2: 40, glide: 0.12, d: 0.25, v: 0.45 }),
    tone(o, { dt: 0.92, f: 120, f2: 40, glide: 0.12, d: 0.3, v: 0.5 }),
    noise(o, { dt: 0.92, ft: 'highpass', f: 4500, q: 0.5, d: 1.3, v: 0.16 }),
  );
  for (let i = 0; i < 10; i++) end = Math.max(end, clink(o, 1.0 + i * 0.07 + rand() * 0.03, rr(2600, 4400), 0.06));
  return end;
}

/** The Daily card copied: a bright bell ding. */
function copy(o: Out): number {
  return Math.max(
    metal(o, { f: mtof(93), ratios: RATIOS.bell, d: 0.7, v: 0.16, bright: 0.6 }),
    tone(o, { f: mtof(93), d: 0.25, v: 0.06 }),
  );
}

// ------------------------------------------------------------------------------ the tables

const RECIPES: Record<RunKind, (o: Out) => number> = { pick, buy, sell, reroll, fork, drive, strike, fired, runWon, copy, spring, condemn, godCry };

/** A scene-made run sound. */
export function runSound(kind: RunKind): RunSound {
  return { key: `run.${kind}`, pan: 0, play: RECIPES[kind] };
}

/** The sound of a `perk` or `boss` event, or null for anything else. */
export function runEventSound(e: GameEvent): RunSound | null {
  if (e.type === 'perk') return { key: e.id === 'bribe' ? 'perk.bribe' : 'perk', pan: 0, play: (o) => perkPip(o, e.id) };
  if (e.type !== 'boss') return null;
  const pan = e.c !== undefined ? Math.max(-1, Math.min(1, (e.c - 4) / 4)) * 0.55 : 0;
  switch (e.what) {
    case 'condemn':
      return { key: 'boss.condemn', pan, play: condemn };
    case 'raid':
      return { key: 'boss.raid', pan, play: raid };
    case 'fed':
      return { key: 'boss.fed', pan: 0, play: fed };
    case 'pass':
      return { key: 'boss.pass', pan: 0, play: pass };
  }
}
