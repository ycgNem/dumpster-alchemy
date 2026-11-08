// Things with mouths: the raccoons' gibberish, a disgusted crowd, gulls, a kazoo, a sad trombone
// and the Gull God's choir. Speech is a buzzy source through three bandpass "formants" that slide
// between vowels, plus a noise tick for consonants. One oscillator per utterance keeps it cheap.
import {
  type Out,
  biquad,
  chance,
  clampF,
  gainNode,
  later,
  lfo,
  mtof,
  noise,
  noiseBuffer,
  pick,
  rand,
  ri,
  rr,
  semi,
  shaper,
} from './synth';

const VOWELS = {
  a: [800, 1200, 2700],
  e: [480, 1850, 2600],
  i: [300, 2250, 3000],
  o: [480, 820, 2600],
  u: [340, 760, 2400],
  uh: [620, 1180, 2400],
  ae: [680, 1700, 2450],
} as const;
export type Vowel = keyof typeof VOWELS;
const VOWEL_LIST: readonly Vowel[] = ['a', 'e', 'i', 'o', 'u', 'uh', 'ae'];

export interface Syllable {
  dt: number;
  dur: number;
  /** Pitch at the start and end of the syllable. */
  f0: number;
  f1: number;
  /** Vowel at the start and end (a diphthong when they differ). */
  v1: Vowel;
  v2: Vowel;
  amp: number;
  /** Consonant tick at the onset, 0 for none. */
  cons: number;
}

export interface Timbre {
  wave: OscillatorType;
  /** Formant multiplier: >1 is a smaller head. */
  shift: number;
  /** [rate Hz, depth cents]. */
  vib?: readonly [number, number];
  /** Saturation on the source: growl. */
  grit?: number;
  /** [rate Hz, depth 0..1] amplitude wobble. */
  trem?: readonly [number, number];
  /** Formant sharpness. */
  q?: number;
}

/** One continuous voice saying a run of syllables. Returns its length. */
export function speak(o: Out, syls: readonly Syllable[], tb: Timbre, level: number): number {
  const { ctx } = o;
  if (syls.length === 0) return 0;
  const t0 = o.t;
  const lastSyl = syls[syls.length - 1];
  const end = t0 + lastSyl.dt + lastSyl.dur + 0.02;

  const src = ctx.createOscillator();
  src.type = tb.wave;
  for (const s of syls) {
    const t = t0 + s.dt;
    src.frequency.setValueAtTime(clampF(ctx, s.f0), t);
    src.frequency.exponentialRampToValueAtTime(clampF(ctx, s.f1), t + s.dur);
  }
  if (tb.vib) lfo(ctx, src.detune, tb.vib[0], tb.vib[1], t0, end);

  let head: AudioNode = src;
  if (tb.grit) head = head.connect(shaper(ctx, 1 + tb.grit * 6));

  const sum = gainNode(ctx, 1.25);
  const q = tb.q ?? 6;
  const weights = [1, 0.6, 0.25];
  const bank = weights.map((w, k) => {
    const b = biquad(ctx, 'bandpass', 1000, q * (1 + k * 0.3));
    head.connect(b).connect(gainNode(ctx, w)).connect(sum);
    return b;
  });
  // A little of the raw source so the pitch reads.
  head.connect(biquad(ctx, 'lowpass', 900, 0.7)).connect(gainNode(ctx, 0.12)).connect(sum);

  for (const s of syls) {
    const t = t0 + s.dt;
    const A = VOWELS[s.v1];
    const B = VOWELS[s.v2];
    bank.forEach((b, k) => {
      b.frequency.setValueAtTime(clampF(ctx, A[k] * tb.shift), t);
      b.frequency.linearRampToValueAtTime(clampF(ctx, B[k] * tb.shift), t + s.dur);
    });
  }

  const amp = gainNode(ctx, 0);
  for (const s of syls) {
    const t = t0 + s.dt;
    const atk = Math.min(0.015, s.dur * 0.25);
    const pk = s.amp * level;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(pk, t + atk);
    amp.gain.linearRampToValueAtTime(pk * 0.75, t + s.dur * 0.75);
    amp.gain.linearRampToValueAtTime(0, t + s.dur);
  }
  sum.connect(amp);
  let tail: AudioNode = amp;
  if (tb.trem) {
    const tg = gainNode(ctx, 1 - tb.trem[1] / 2);
    lfo(ctx, tg.gain, tb.trem[0], tb.trem[1] / 2, t0, end);
    tail = tail.connect(tg);
  }
  tail.connect(o.dest);

  if (syls.some((s) => s.cons > 0)) {
    const ns = ctx.createBufferSource();
    ns.buffer = noiseBuffer(ctx, 'white');
    ns.loop = true;
    const bp = biquad(ctx, 'bandpass', 3600 * Math.sqrt(tb.shift), 1.4);
    const cg = gainNode(ctx, 0);
    for (const s of syls) {
      if (s.cons <= 0) continue;
      const t = t0 + s.dt;
      cg.gain.setValueAtTime(0, t);
      cg.gain.linearRampToValueAtTime(s.cons * level * 1.6, t + 0.003);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
      cg.gain.setValueAtTime(0, t + 0.03);
    }
    ns.connect(bp).connect(cg).connect(o.dest);
    ns.start(t0, rand());
    ns.stop(end);
  }

  src.start(t0);
  src.stop(end + 0.01);
  return end - o.t;
}

// ------------------------------------------------------------------------------ raccoons

interface RaccoonVoice {
  pitch: number;
  /** Random pitch spread between syllables, semitones. */
  spread: number;
  syl: readonly [number, number];
  gap: readonly [number, number];
  /** Pitch slide inside a syllable, semitones (min, max). */
  glide: readonly [number, number];
  timbre: Timbre;
  level: number;
  cons: number;
}

const RACCOON_VOICES: Record<string, RaccoonVoice> = {
  // Gruff and low, clipped, in a hurry.
  gary: {
    pitch: 118,
    spread: 3,
    syl: [0.06, 0.1],
    gap: [0.012, 0.03],
    glide: [-2, 1],
    timbre: { wave: 'sawtooth', shift: 0.92, grit: 0.55, q: 5 },
    level: 0.8,
    cons: 0.5,
  },
  // Posh and warbly: long sing-song syllables with a wide vibrato.
  linda: {
    pitch: 300,
    spread: 7,
    syl: [0.11, 0.17],
    gap: [0.03, 0.05],
    glide: [-4, 5],
    timbre: { wave: 'sawtooth', shift: 1.15, vib: [6.5, 45], q: 6 },
    level: 0.65,
    cons: 0.25,
  },
  // Squeaky: tiny head, high, quick, every syllable swoops up.
  pete: {
    pitch: 560,
    spread: 5,
    syl: [0.045, 0.075],
    gap: [0.012, 0.025],
    glide: [1, 6],
    timbre: { wave: 'square', shift: 1.6, q: 4 },
    level: 0.33,
    cons: 0.3,
  },
  // Slow and wobbly: a deep slow vibrato, a tremolo, a little creak, drooping pitch.
  mange: {
    pitch: 210,
    spread: 4,
    syl: [0.15, 0.24],
    gap: [0.05, 0.08],
    glide: [-3, 1],
    timbre: { wave: 'sawtooth', shift: 1.05, vib: [4.3, 75], trem: [6.5, 0.5], grit: 0.15, q: 5 },
    level: 0.75,
    cons: 0.2,
  },
};

export type Mood = 'arrive' | 'happy' | 'angry';

/** A raccoon chittering gibberish in its own voice. */
export function chitter(o: Out, raccoon: string, mood: Mood): number {
  const rv = RACCOON_VOICES[raccoon] ?? RACCOON_VOICES.gary;
  const n = mood === 'arrive' ? ri(4, 5) : mood === 'happy' ? ri(5, 6) : ri(6, 7);
  const pitchMul = mood === 'happy' ? semi(3) : mood === 'angry' ? semi(-2) : 1;
  const speed = mood === 'angry' ? 0.8 : mood === 'happy' ? 0.92 : 1;
  const syls: Syllable[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    let dur = rr(rv.syl[0], rv.syl[1]) * speed;
    const contour = mood === 'angry' ? -i * 0.6 : mood === 'happy' ? i * 0.5 : 0;
    const f0 = rv.pitch * pitchMul * semi(rr(-rv.spread, rv.spread) * 0.5 + contour);
    let g = rr(rv.glide[0], rv.glide[1]);
    if (last) {
      dur *= 1.8;
      g = mood === 'arrive' ? 5 : mood === 'happy' ? 7 : -6;
    }
    syls.push({
      dt: t,
      dur,
      f0,
      f1: f0 * semi(g),
      v1: pick(VOWEL_LIST),
      v2: pick(VOWEL_LIST),
      amp: (mood === 'angry' ? 1.15 : 1) * rr(0.8, 1),
      cons: chance(0.6) ? rv.cons : 0,
    });
    t += dur + rr(rv.gap[0], rv.gap[1]) * speed;
  }
  const tb: Timbre = mood === 'angry' ? { ...rv.timbre, grit: (rv.timbre.grit ?? 0) + 0.45 } : rv.timbre;
  return speak(o, syls, tb, rv.level);
}

/** Four people at once going "ugh". */
export function crowdUgh(o: Out): number {
  let end = 0;
  [165, 128, 196, 108].forEach((p, i) => {
    const off = i * 0.035 + rand() * 0.02;
    const dur = rr(0.28, 0.42);
    const syl: Syllable = { dt: 0, dur, f0: p, f1: p * 0.72, v1: 'uh', v2: pick(['u', 'o'] as const), amp: 1, cons: 0 };
    end = Math.max(end, off + speak(later(o, off), [syl], { wave: 'sawtooth', shift: 1, q: 5, grit: 0.2 }, 0.55));
  });
  return end;
}

/** A sustained "aaah" choir on the given notes. */
export function choir(o: Out, notes: readonly number[], dur: number, level: number): number {
  let end = 0;
  notes.forEach((m, i) => {
    const f = mtof(m) * semi(rr(-0.1, 0.1));
    const syl: Syllable = { dt: 0, dur, f0: f * semi(-1), f1: f, v1: 'a', v2: 'o', amp: 1, cons: 0 };
    const off = i * 0.03;
    end = Math.max(
      end,
      off + speak(later(o, off), [syl], { wave: 'sawtooth', shift: 1.1, vib: [5 + rand(), 30], q: 7 }, level),
    );
  });
  return end;
}

// ------------------------------------------------------------------------------ gulls

export interface GullOpts {
  f: number;
  dur: number;
  v: number;
  /** 0..1: how ragged the scream is. */
  rasp?: number;
  dt?: number;
  /** Where the call ends relative to f (default 0.6, a falling "kyow"). */
  fall?: number;
}

/** One gull call: a rising-then-falling "kee-yow" with a ragged throat. */
export function gullCall(o: Out, p: GullOpts): number {
  const { ctx } = o;
  const t = o.t + (p.dt ?? 0);
  const rasp = p.rasp ?? 0.4;
  const end = t + p.dur;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(p.f * 0.72, t);
  osc.frequency.exponentialRampToValueAtTime(p.f * 1.2, t + p.dur * 0.22);
  osc.frequency.exponentialRampToValueAtTime(p.f * (p.fall ?? 0.6), end);
  lfo(ctx, osc.detune, rr(26, 38), 40 + 120 * rasp, t, end, 'triangle');
  const drv = shaper(ctx, 1.5 + 4 * rasp);
  const hp = biquad(ctx, 'highpass', 650, 0.7);
  const b1 = biquad(ctx, 'bandpass', 2000, 2.2);
  const b2 = biquad(ctx, 'bandpass', 3300, 3.5);
  const sum = gainNode(ctx, 0.6);
  osc.connect(drv).connect(hp);
  hp.connect(b1).connect(sum);
  hp.connect(b2).connect(gainNode(ctx, 0.6)).connect(sum);
  hp.connect(gainNode(ctx, 0.12)).connect(sum);
  const g = gainNode(ctx, 0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(p.v, t + 0.018);
  g.gain.setValueAtTime(p.v, t + p.dur * 0.55);
  g.gain.linearRampToValueAtTime(0, end);
  sum.connect(g).connect(o.dest);
  osc.start(t);
  osc.stop(end + 0.01);
  return end - o.t;
}

/** A wing flap: a soft "fwup" of air. */
export function flap(o: Out, dt: number, v: number): number {
  return noise(o, { dt, ft: 'bandpass', f: 700, f2: 450, q: 0.8, a: 0.018, d: 0.06, v });
}

// ------------------------------------------------------------------------------ horns

export interface Note {
  dt: number;
  dur: number;
  m: number;
  v?: number;
}

function lastEnd(notes: readonly Note[]): number {
  return notes.reduce((e, n) => Math.max(e, n.dt + n.dur), 0);
}

/** A cheap party kazoo: two buzzing saws, a scoop into every note, a nasal formant. */
export function kazoo(o: Out, notes: readonly Note[], level: number): number {
  const { ctx } = o;
  const t0 = o.t;
  const end = t0 + lastEnd(notes) + 0.02;
  const mix = gainNode(ctx, 0.5);
  const oscs = [-7, 13].map((det) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.detune.value = det;
    osc.connect(mix);
    lfo(ctx, osc.detune, 5.6, 22, t0, end);
    return osc;
  });
  for (const n of notes) {
    const f = mtof(n.m);
    const t = t0 + n.dt;
    for (const osc of oscs) {
      osc.frequency.setValueAtTime(f * semi(-0.7), t);
      osc.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    }
  }
  const drv = shaper(ctx, 3);
  const sum = gainNode(ctx, 1.5);
  mix.connect(drv);
  drv.connect(biquad(ctx, 'bandpass', 1050, 2.2)).connect(sum);
  drv.connect(biquad(ctx, 'bandpass', 2600, 3)).connect(gainNode(ctx, 0.6)).connect(sum);
  const amp = gainNode(ctx, 0);
  for (const n of notes) {
    const t = t0 + n.dt;
    const pk = level * (n.v ?? 1);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(pk, t + 0.02);
    amp.gain.linearRampToValueAtTime(pk * 0.75, t + n.dur * 0.85);
    amp.gain.linearRampToValueAtTime(0, t + n.dur);
  }
  sum.connect(amp).connect(o.dest);
  for (const osc of oscs) {
    osc.start(t0);
    osc.stop(end + 0.01);
  }
  return end - o.t;
}

/** A sad trombone: sliding between notes, the filter "wah"s open on each, the last one wobbles. */
export function trombone(o: Out, notes: readonly Note[], level: number): number {
  const { ctx } = o;
  const t0 = o.t;
  const end = t0 + lastEnd(notes) + 0.02;
  const lp = biquad(ctx, 'lowpass', 400, 2.5);
  const oscs = [0, 9].map((det) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.detune.value = det;
    osc.connect(lp);
    return osc;
  });
  let prev = mtof(notes[0].m) * semi(-1.5);
  notes.forEach((n, i) => {
    const t = t0 + n.dt;
    const f = mtof(n.m);
    for (const osc of oscs) {
      osc.frequency.setValueAtTime(prev, t);
      osc.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    }
    prev = f;
    lp.frequency.setValueAtTime(320, t);
    lp.frequency.linearRampToValueAtTime(1500, t + 0.09);
    lp.frequency.linearRampToValueAtTime(650, t + n.dur);
    if (i === notes.length - 1) {
      // The last note droops and wobbles harder and harder.
      for (const osc of oscs) {
        const vg = lfo(ctx, osc.detune, 5, 0, t, end);
        vg.gain.setValueAtTime(0, t + 0.15);
        vg.gain.linearRampToValueAtTime(55, t + n.dur * 0.8);
      }
      lfo(ctx, lp.frequency, 5, 380, t + 0.15, end);
    }
  });
  const drv = shaper(ctx, 1.6);
  const amp = gainNode(ctx, 0);
  for (const n of notes) {
    const t = t0 + n.dt;
    const pk = level * (n.v ?? 1);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(pk, t + 0.035);
    amp.gain.linearRampToValueAtTime(pk * 0.7, t + n.dur - 0.05);
    amp.gain.linearRampToValueAtTime(0, t + n.dur);
  }
  lp.connect(drv).connect(amp).connect(o.dest);
  for (const osc of oscs) {
    osc.start(t0);
    osc.stop(end + 0.01);
  }
  return end - o.t;
}
