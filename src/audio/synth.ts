// Shared WebAudio building blocks for the sound effects, voices and music.
//
// Every recipe takes an `Out` (a context, a destination node and a start time on that context's
// clock) and returns how long it rings, so the same code plays live through the game's
// AudioContext or renders into an OfflineAudioContext for the audio lab's measurements.

export interface Out {
  ctx: BaseAudioContext;
  dest: AudioNode;
  /** Start time in seconds on ctx's clock. */
  t: number;
}

/** `o` moved `dt` seconds later, optionally into another node. */
export function later(o: Out, dt: number, dest: AudioNode = o.dest): Out {
  return { ctx: o.ctx, dest, t: o.t + dt };
}

// ------------------------------------------------------------------------------ randomness

let seed = (Math.random() * 4294967296) >>> 0;

/** Reseeds the sound randomness (the lab does this so every render is repeatable). */
export function seedRandom(s: number): void {
  seed = s >>> 0;
}

/** mulberry32: a uniform float in [0, 1). */
export function rand(): number {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let x = seed;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

export const rr = (a: number, b: number): number => a + (b - a) * rand();
export const ri = (a: number, b: number): number => Math.floor(rr(a, b + 1));
export const chance = (p: number): boolean => rand() < p;
export function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(rand() * xs.length) % xs.length];
}

// ------------------------------------------------------------------------------ maths

export const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
export const semi = (n: number): number => 2 ** (n / 12);
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
export function smoothstep(a: number, b: number, x: number): number {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
}
/** A frequency kept inside what a node on this context can do. */
export const clampF = (ctx: BaseAudioContext, f: number): number => clamp(f, 10, ctx.sampleRate * 0.45);

// ------------------------------------------------------------------------------ buffers, curves

export type NoiseKind = 'white' | 'brown' | 'crackle';
const noiseCache = new WeakMap<BaseAudioContext, Map<NoiseKind, AudioBuffer>>();

/** A looping noise buffer, built once per context. */
export function noiseBuffer(ctx: BaseAudioContext, kind: NoiseKind): AudioBuffer {
  let byKind = noiseCache.get(ctx);
  if (!byKind) {
    byKind = new Map();
    noiseCache.set(ctx, byKind);
  }
  let buf = byKind.get(kind);
  if (!buf) {
    const len = Math.floor(ctx.sampleRate * (kind === 'crackle' ? 3 : 2));
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    fillNoise(buf.getChannelData(0), kind);
    byKind.set(kind, buf);
  }
  return buf;
}

function fillNoise(d: Float32Array, kind: NoiseKind): void {
  // A fixed LCG, separate from rand(), so building a buffer never shifts a sound's random rolls.
  let s = 0x2545f491;
  const white = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
  const n = d.length;
  const fade = Math.min(2048, n >> 2);
  const raw = new Float32Array(n + fade);
  if (kind === 'white') {
    for (let i = 0; i < raw.length; i++) raw[i] = white();
  } else if (kind === 'brown') {
    let last = 0;
    for (let i = 0; i < raw.length; i++) {
      last = (last + 0.02 * white()) / 1.02;
      raw[i] = last * 3.5;
    }
  } else {
    // Worn vinyl: a soft hiss with sparse ticks.
    let hiss = 0;
    let pop = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = white();
      hiss += (w - hiss) * 0.3;
      if (Math.abs(w) > 0.99984) pop = white() * 0.9;
      pop *= -0.62;
      raw[i] = hiss * 0.05 + pop;
    }
  }
  // Crossfade the tail into the head so the loop has no seam.
  for (let i = 0; i < n; i++) d[i] = raw[i];
  for (let i = 0; i < fade; i++) {
    const u = i / fade;
    d[i] = raw[i] * u + raw[n + i] * (1 - u);
  }
}

const driveCurves = new Map<number, Float32Array<ArrayBuffer>>();

/** tanh saturation normalised to ±1; `k` is the drive (1 = warm, 8 = fuzz). */
export function driveCurve(k: number): Float32Array<ArrayBuffer> {
  const key = Math.round(k * 20);
  let c = driveCurves.get(key);
  if (!c) {
    const kk = key / 20;
    c = new Float32Array(1024);
    const norm = Math.tanh(kk);
    for (let i = 0; i < c.length; i++) {
      const x = (i / (c.length - 1)) * 2 - 1;
      c[i] = Math.tanh(kk * x) / norm;
    }
    driveCurves.set(key, c);
  }
  return c;
}

// ------------------------------------------------------------------------------ nodes

export function gainNode(ctx: BaseAudioContext, v = 1): GainNode {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

export function biquad(ctx: BaseAudioContext, type: BiquadFilterType, f: number, q = 0.707): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = clampF(ctx, f);
  b.Q.value = q;
  return b;
}

export function shaper(ctx: BaseAudioContext, k: number): WaveShaperNode {
  const w = ctx.createWaveShaper();
  w.curve = driveCurve(k);
  return w;
}

/** An oscillator added onto `param` (vibrato, tremolo, wah) from t until end. */
export function lfo(
  ctx: BaseAudioContext,
  param: AudioParam,
  rate: number,
  depth: number,
  t: number,
  end: number,
  type: OscillatorType = 'sine',
): GainNode {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = rate;
  const g = gainNode(ctx, depth);
  osc.connect(g).connect(param);
  osc.start(t);
  osc.stop(end + 0.05);
  return g;
}

/** Silence → `peak` over `a`, held for `hold`, then an exponential fall over `d`. Returns the end. */
export function env(p: AudioParam, t: number, peak: number, a: number, hold: number, d: number): number {
  const pk = Math.max(peak, 0.0002);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(pk, t + a);
  if (hold > 0) p.setValueAtTime(pk, t + a + hold);
  const end = t + a + hold + d;
  p.exponentialRampToValueAtTime(0.0001, end);
  p.setValueAtTime(0, end + 0.002);
  return end;
}

// ------------------------------------------------------------------------------ voices

export interface ToneOpts {
  type?: OscillatorType;
  f: number;
  /** Glide target (exponential), reached after `glide` seconds (default: the whole note). */
  f2?: number;
  glide?: number;
  /** Delay from o.t. */
  dt?: number;
  a?: number;
  hold?: number;
  d: number;
  v: number;
  detune?: number;
  /** Vibrato: [rate Hz, depth cents]. */
  vib?: readonly [number, number];
  dest?: AudioNode;
}

/** One oscillator note with an attack-hold-decay envelope. */
export function tone(o: Out, p: ToneOpts): number {
  const { ctx } = o;
  const t = o.t + (p.dt ?? 0);
  const a = p.a ?? 0.004;
  const hold = p.hold ?? 0;
  const osc = ctx.createOscillator();
  osc.type = p.type ?? 'sine';
  osc.frequency.setValueAtTime(clampF(ctx, p.f), t);
  if (p.f2 !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(clampF(ctx, p.f2), t + (p.glide ?? a + hold + p.d));
  }
  if (p.detune) osc.detune.value = p.detune;
  const g = gainNode(ctx, 0);
  const end = env(g.gain, t, p.v, a, hold, p.d);
  osc.connect(g).connect(p.dest ?? o.dest);
  if (p.vib) lfo(ctx, osc.detune, p.vib[0], p.vib[1], t, end);
  osc.start(t);
  osc.stop(end + 0.01);
  return end - o.t;
}

export interface NoiseOpts {
  kind?: NoiseKind;
  ft?: BiquadFilterType;
  f: number;
  f2?: number;
  glide?: number;
  q?: number;
  dt?: number;
  a?: number;
  hold?: number;
  d: number;
  v: number;
  /** Saturation after the filter (crunch). */
  drive?: number;
  dest?: AudioNode;
}

/**
 * Gain that brings white noise through this filter back to roughly full-band loudness, so a
 * narrow band at `v` sits about as loud as a tone at `v`.
 */
function bandComp(ctx: BaseAudioContext, ft: BiquadFilterType, f: number, q: number): number {
  const nyq = ctx.sampleRate / 2;
  let frac = 1;
  if (ft === 'bandpass') frac = f / Math.max(q, 0.1) / nyq;
  else if (ft === 'lowpass') frac = f / nyq;
  else if (ft === 'highpass') frac = 1 - f / nyq;
  return Math.min(6, 1 / Math.sqrt(clamp(frac, 0.0001, 1))) * 0.8;
}

/** A filtered noise burst. */
export function noise(o: Out, p: NoiseOpts): number {
  const { ctx } = o;
  const t = o.t + (p.dt ?? 0);
  const a = p.a ?? 0.002;
  const hold = p.hold ?? 0;
  const kind = p.kind ?? 'white';
  const ft = p.ft ?? 'bandpass';
  const q = p.q ?? 1;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, kind);
  src.loop = true;
  const flt = biquad(ctx, ft, p.f, q);
  if (p.f2 !== undefined) {
    flt.frequency.setValueAtTime(clampF(ctx, p.f), t);
    flt.frequency.exponentialRampToValueAtTime(clampF(ctx, p.f2), t + (p.glide ?? a + hold + p.d));
  }
  const comp = kind === 'white' ? bandComp(ctx, ft, Math.sqrt(p.f * (p.f2 ?? p.f)), q) : 1;
  const g = gainNode(ctx, 0);
  let head: AudioNode = src.connect(flt);
  let level = p.v * comp;
  if (p.drive) {
    head = head.connect(gainNode(ctx, comp)).connect(shaper(ctx, p.drive));
    level = p.v * 0.6;
  }
  const end = env(g.gain, t, level, a, hold, p.d);
  head.connect(g).connect(p.dest ?? o.dest);
  src.start(t, rand() * 1.8);
  src.stop(end + 0.01);
  return end - o.t;
}

/** Partial ratios for struck things. */
export const RATIOS = {
  can: [1, 1.59, 2.14, 2.83, 3.71],
  plate: [1, 1.47, 1.98, 2.56, 3.13, 3.89],
  bar: [1, 2.756, 5.404, 8.933],
  bell: [1, 2, 2.42, 3.01, 4.2, 5.43],
  tin: [1, 2.32, 3.93, 5.12],
} as const;

export interface MetalOpts {
  f: number;
  ratios?: readonly number[];
  d: number;
  v: number;
  dt?: number;
  /** 0 = dull (only the fundamental), 1 = every partial as loud as the first. */
  bright?: number;
  /** A strike click on top, relative to v. */
  click?: number;
  dest?: AudioNode;
}

/** A struck metal object: inharmonic sine partials, the high ones dying first. */
export function metal(o: Out, p: MetalOpts): number {
  const ratios = p.ratios ?? RATIOS.can;
  const bright = p.bright ?? 0.6;
  const ws = ratios.map((_r, i) => (i === 0 ? 1 : bright ** (i * 0.6)));
  const norm = Math.sqrt(ws.reduce((s, w) => s + w * w, 0));
  let end = 0;
  ratios.forEach((r, i) => {
    const f = p.f * r * (1 + (rand() - 0.5) * 0.012);
    if (f > o.ctx.sampleRate * 0.45) return;
    end = Math.max(
      end,
      tone(o, { f, dt: p.dt, a: 0.001, d: p.d / (1 + i * 0.45), v: (p.v * ws[i]) / norm, dest: p.dest }),
    );
  });
  if (p.click) {
    end = Math.max(end, noise(o, { ft: 'highpass', f: 3000, dt: p.dt, a: 0.0005, d: 0.012, v: p.v * p.click, dest: p.dest }));
  }
  return end;
}

/** A feedback echo into `dest`; returns its input. The feedback is cut at `end` so the loop dies. */
export function echo(ctx: BaseAudioContext, dest: AudioNode, time: number, fb: number, wet: number, end: number): GainNode {
  const input = gainNode(ctx, 1);
  const dl = ctx.createDelay(1);
  dl.delayTime.value = time;
  const lp = biquad(ctx, 'lowpass', 2800, 0.5);
  const fbg = gainNode(ctx, fb);
  const wg = gainNode(ctx, wet);
  input.connect(dest);
  input.connect(dl);
  dl.connect(lp);
  lp.connect(fbg);
  fbg.connect(dl);
  lp.connect(wg);
  wg.connect(dest);
  fbg.gain.setValueAtTime(fb, end);
  fbg.gain.linearRampToValueAtTime(0, end + 0.3);
  return input;
}
