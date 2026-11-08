// Procedural, looping, lo-fi music. Three songs on a swung 16th-note grid with a little timing
// slop, scheduled just ahead of the audio clock (a lookahead scheduler: a 25 ms timer queues
// every note due in the next 150 ms at an exact audio time). The tape wobble and dull top end
// live on the music bus (engine.ts), so every note comes out detuned and warbly for free.
//
// `night` is built in layers whose gains follow the intensity (stink / board fill):
//   0.00  sneaky plucks, a soft kick and a dark pad
//   0.08+ hats
//   0.28+ the bassline
//   0.45+ a backbeat (snare, extra kicks, shaker)
//   0.62+ a nervous tremolo organ
//   0.86+ panic: an arpeggio an octave up and crashes
// and the tempo climbs from 96 to 112 BPM over the top half.
//
// The Raccoon Rave (src/game/combo.ts Fever) kicks the night into double-time: the tempo jumps by
// a third (to ~128-150 BPM) and a rave layer comes in on top: four on the floor, offbeat open hats,
// claps, saw stabs on the chord and a snare roll into every other bar.
import { type Out, biquad, gainNode, lfo, mtof, noise, noiseBuffer, rand, rr, smoothstep, tone } from './synth';

export type TrackId = 'title' | 'night' | 'report';

interface Chord {
  /** Bass note (MIDI). */
  bass: number;
  /** A close voicing around middle C (MIDI). */
  notes: readonly number[];
  minor: boolean;
}

const ch = (bass: number, notes: readonly number[], minor = false): Chord => ({ bass, notes, minor });

const CHORDS: Record<string, Chord> = {
  // title: a 12-bar blues in A
  A7: ch(45, [61, 67, 71]),
  D7: ch(50, [60, 64, 66]),
  E7: ch(52, [56, 62, 66]),
  // night: D minor, sneaking around
  Dm: ch(38, [62, 65, 69], true),
  Gm: ch(43, [62, 67, 70], true),
  A7b: ch(45, [61, 64, 67]),
  Bb7: ch(46, [62, 65, 68]),
  // report: a sleepy I-vi-ii-V in C
  Cmaj7: ch(48, [64, 67, 71]),
  Am7: ch(45, [60, 64, 67], true),
  Dm7: ch(50, [60, 65, 69], true),
  G7: ch(43, [59, 65, 69]),
};

interface Step {
  /** Length of one 16th, seconds. */
  sd: number;
  /** 0-15 within the bar. */
  s: number;
  bar: number;
  chord: Chord;
  next: Chord;
  x: number;
  /** The Raccoon Rave is on (songs with a rave layer play it). */
  fever: boolean;
}

/** The Rave's tempo jump (the drums go double-time on top of it). */
const FEVER_TEMPO = 1.33;

interface Song {
  bpm(x: number): number;
  /** How late the off-16ths land, as a fraction of a 16th. */
  swing: number;
  bars: readonly string[];
  /** Each layer's gain at intensity x. */
  layers(x: number): number[];
  /** Vinyl crackle level. */
  crackle: number;
  /** Output level, to balance the songs against each other. */
  gain: number;
  /** Plays one step; L[i] is layer i at the step's time, on[i] whether that layer is audible. */
  play(L: readonly Out[], st: Step, on: readonly boolean[]): void;
  /** Has a Raccoon Rave layer (the night): it's the extra Out after the song's own layers. */
  rave?: boolean;
}

// ------------------------------------------------------------------------------ instruments

function kick(o: Out, v: number): void {
  tone(o, { f: 115, f2: 44, glide: 0.11, a: 0.002, d: 0.24, v: 0.6 * v });
  tone(o, { type: 'triangle', f: 600, f2: 120, glide: 0.02, a: 0.001, d: 0.02, v: 0.2 * v });
}

function snare(o: Out, v: number): void {
  noise(o, { f: 2000, q: 0.9, a: 0.001, d: 0.13, v: 0.32 * v });
  tone(o, { type: 'triangle', f: 210, f2: 150, glide: 0.06, d: 0.07, v: 0.35 * v });
}

function hat(o: Out, v: number, open = false): void {
  noise(o, { f: 6000, q: 0.8, a: 0.001, d: open ? 0.16 : 0.04, v: 0.45 * v });
}

function shaker(o: Out, v: number): void {
  noise(o, { f: 4500, q: 1.2, a: 0.012, d: 0.045, v: 0.12 * v });
}

function crash(o: Out, v: number): void {
  noise(o, { ft: 'highpass', f: 3500, q: 0.5, a: 0.002, d: 1.3, v: 0.12 * v });
}

/** A cheap drum-machine clap: three quick noise slaps and a tail. */
function clap(o: Out, v: number): void {
  for (let i = 0; i < 3; i++) noise(o, { dt: i * 0.011, f: 1300, q: 1.1, a: 0.001, d: 0.012, v: 0.3 * v });
  noise(o, { dt: 0.033, f: 1200, q: 0.9, a: 0.001, d: 0.12, v: 0.25 * v });
}

/** A rave stab: detuned saws through a filter that snaps shut. */
function stab(o: Out, ms: readonly number[], v: number): void {
  const lp = biquad(o.ctx, 'lowpass', 3200, 4);
  lp.frequency.setValueAtTime(3200, o.t);
  lp.frequency.exponentialRampToValueAtTime(500, o.t + 0.12);
  lp.connect(o.dest);
  for (const m of ms) {
    for (const det of [-14, 12]) tone(o, { type: 'sawtooth', f: mtof(m), detune: det, a: 0.003, d: 0.13, v: 0.05 * v, dest: lp });
  }
}

/** The Raccoon Rave on top of the night: four on the floor, offbeat hats, claps, stabs, a roll. */
function raveLayer(o: Out, { s, bar, chord }: Step): void {
  if (s % 4 === 0) kick(o, 1);
  if (s % 4 === 2) hat(o, 0.6, true);
  else hat(o, 0.22);
  if (s === 4 || s === 12) clap(o, 0.9);
  if (s === 0 || s === 3 || s === 6 || s === 10) stab(o, chord.notes.map((n) => n + 12), s === 0 ? 1 : 0.7);
  if (bar % 2 === 1 && s >= 12) snare(o, 0.25 + (s - 12) * 0.12);
}

/** Round bass: a triangle through a closing filter, plus a sine for weight. */
function bass(o: Out, m: number, len: number, v: number): void {
  const f = mtof(m);
  const lp = biquad(o.ctx, 'lowpass', 1100, 1.5);
  lp.frequency.setValueAtTime(1100, o.t);
  lp.frequency.exponentialRampToValueAtTime(380, o.t + len);
  lp.connect(o.dest);
  tone(o, { type: 'triangle', f, a: 0.006, hold: len * 0.5, d: len * 0.5 + 0.08, v: 0.3 * v, dest: lp });
  tone(o, { f, a: 0.006, hold: len * 0.5, d: len * 0.5 + 0.08, v: 0.2 * v });
}

/** A detuned electric piano: sine body and a short bright tine an octave up. */
function keys(o: Out, ms: readonly number[], len: number, v: number): void {
  for (const m of ms) {
    const f = mtof(m) * (1 + rr(-0.003, 0.003));
    tone(o, { f, a: 0.008, hold: len * 0.3, d: len * 0.8 + 0.3, v: 0.13 * v });
    tone(o, { type: 'triangle', f: f * 2.006, a: 0.003, d: 0.25, v: 0.04 * v });
  }
}

function pluck(o: Out, m: number, v: number, d = 0.18): void {
  tone(o, { type: 'triangle', f: mtof(m), a: 0.002, d, v: 0.24 * v });
}

/** Two detuned saws behind a dark filter, swelling in. */
function pad(o: Out, ms: readonly number[], len: number, v: number): void {
  const lp = biquad(o.ctx, 'lowpass', 600, 0.5);
  lp.connect(o.dest);
  for (const m of ms) {
    for (const det of [-9, 8]) {
      tone(o, { type: 'sawtooth', f: mtof(m), detune: det + rr(-3, 3), a: 0.5, hold: Math.max(0, len - 0.5), d: 0.8, v: 0.045 * v, dest: lp });
    }
  }
}

/** A cheap combo organ with a fast, nervous tremolo. */
function organ(o: Out, ms: readonly number[], len: number, v: number, tremHz: number): void {
  const { ctx } = o;
  const lp = biquad(ctx, 'lowpass', 2000, 0.8);
  const trem = gainNode(ctx, 0.6);
  lfo(ctx, trem.gain, tremHz, 0.4, o.t, o.t + len + 0.1);
  lp.connect(trem).connect(o.dest);
  for (const m of ms) {
    tone(o, { type: 'square', f: mtof(m), detune: rr(-12, 12), a: 0.01, hold: Math.max(0, len - 0.06), d: 0.06, v: 0.045 * v, dest: lp });
    tone(o, { f: mtof(m + 12), a: 0.01, hold: Math.max(0, len - 0.06), d: 0.06, v: 0.035 * v, dest: lp });
  }
}

/** A mouth-harp-ish lead for the title's licks. */
function harp(o: Out, m: number, len: number, v: number, bendFrom = 0): void {
  const bp = biquad(o.ctx, 'bandpass', 1300, 0.9);
  bp.connect(o.dest);
  const f = mtof(m);
  tone(o, {
    type: 'square',
    f: bendFrom ? mtof(m + bendFrom) : f,
    f2: f,
    glide: 0.08,
    a: 0.02,
    hold: len * 0.6,
    d: len * 0.4 + 0.05,
    v: 0.1 * v,
    vib: [5.5, 18],
    dest: bp,
  });
}

// ------------------------------------------------------------------------------ the songs

type Pat = readonly (readonly [step: number, semis: number, len: number, vel: number])[];

/** title: a lazy junkyard boogie in A. */
const TITLE_BASS: Pat = [
  [0, 0, 3, 1],
  [3, 0, 1, 0.55],
  [6, 7, 2, 0.8],
  [8, 9, 2, 0.8],
  [10, 10, 2, 0.85],
  [12, 9, 2, 0.75],
  [14, 7, 2, 0.7],
];
/** A blues lick per four bars: bar index → [step, midi, len, bend-from]. */
const TITLE_LICKS: Record<number, readonly (readonly [number, number, number, number])[]> = {
  3: [
    [6, 72, 2, 0],
    [8, 74, 2, 0],
    [10, 75, 2, -1],
    [12, 76, 4, -2],
  ],
  7: [
    [6, 79, 2, 0],
    [8, 76, 2, 0],
    [10, 74, 2, 0],
    [12, 72, 2, 0],
    [14, 69, 2, -1],
  ],
  11: [
    [4, 76, 2, 0],
    [6, 75, 2, 0],
    [8, 74, 2, 0],
    [10, 73, 2, 0],
    [12, 71, 4, -1],
  ],
};

const TITLE: Song = {
  bpm: () => 74,
  swing: 0.3,
  bars: ['A7', 'A7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'E7'],
  layers: () => [1],
  crackle: 0.12,
  gain: 0.35,
  play(L, { sd, s, bar, chord }) {
    const o = L[0];
    if (s === 0) kick(o, 1);
    if (s === 7 && rand() < 0.5) kick(o, 0.4);
    if (s === 10) kick(o, 0.8);
    if (s === 4 || s === 12) snare(o, s === 12 ? 0.85 : 0.75);
    if (s % 2 === 0) hat(o, s % 4 === 0 ? 0.55 : 0.4);
    else if (rand() < 0.3) hat(o, 0.18);
    for (const [st, semis, len, vel] of TITLE_BASS) if (st === s) bass(o, chord.bass + semis, len * sd, vel);
    if (s === 2) keys(o, chord.notes, 4 * sd, 0.8);
    if (s === 10) keys(o, chord.notes, 5 * sd, 0.65);
    for (const [st, m, len, bend] of TITLE_LICKS[bar] ?? []) if (st === s) harp(o, m, len * sd, 0.9, bend);
  },
};

/** night: the sneaky plucks, by step: [step, semis above the chord (or 'T' for its third), vel]. */
const SNEAK: readonly (readonly [number, number | 'T', number])[] = [
  [0, 0, 1],
  [3, 7, 0.7],
  [6, 'T', 0.8],
  [8, 12, 0.55],
  [10, 7, 0.7],
  [11, 6, 0.45],
  [12, 5, 0.6],
  [14, 'T', 0.5],
];
/** night bass: 'N' walks a semitone into the next chord. */
const NIGHT_BASS: readonly (readonly [number, number | 'N', number, number])[] = [
  [0, 0, 2, 1],
  [3, 0, 1, 0.6],
  [6, 12, 1, 0.7],
  [8, 0, 2, 0.9],
  [11, 7, 1, 0.7],
  [14, 'N', 1, 0.75],
];

const NIGHT: Song = {
  bpm: (x) => 96 + 16 * smoothstep(0.5, 1, x),
  swing: 0.18,
  bars: ['Dm', 'Dm', 'Gm', 'A7b', 'Dm', 'Dm', 'Bb7', 'A7b'],
  layers: (x) => [
    1,
    smoothstep(0.08, 0.28, x),
    smoothstep(0.28, 0.48, x),
    smoothstep(0.45, 0.65, x),
    smoothstep(0.62, 0.82, x),
    smoothstep(0.86, 0.98, x),
  ],
  crackle: 0.06,
  gain: 0.6,
  rave: true,
  play(L, st, on) {
    const { sd, s, bar, chord, next, x } = st;
    const [base, hats, bassL, beat, org, panic, rave] = L;
    // The Raccoon Rave: the party layer on top of everything else.
    if (st.fever && rave) raveLayer(rave, st);
    const third = chord.minor ? 3 : 4;
    // 0: the sneak
    if (s === 0) {
      kick(base, 0.75);
      pad(base, chord.notes.map((n) => n - 12), 16 * sd, 1);
    }
    if (s === 8) kick(base, 0.55);
    for (const [st, semis, vel] of SNEAK) {
      if (st === s) pluck(base, chord.bass + 24 + (semis === 'T' ? third : semis), vel);
    }
    // 1: hats
    if (on[1]) {
      if (s % 2 === 0) hat(hats, s % 4 === 0 ? 0.6 : 0.45);
      else if (x > 0.55) hat(hats, 0.25);
      if (s === 14 && bar % 2 === 1) hat(hats, 0.4, true);
    }
    // 2: bass
    if (on[2]) {
      for (const [st, semis, len, vel] of NIGHT_BASS) {
        if (st !== s) continue;
        const m = semis === 'N' ? next.bass - 1 + (next.bass === chord.bass ? 8 : 0) : chord.bass + semis;
        bass(bassL, m + 12, len * sd, vel * 0.6);
      }
    }
    // 3: backbeat
    if (on[3]) {
      if (s === 4 || s === 12) snare(beat, 0.8);
      if (s === 10) kick(beat, 0.45);
      if (s === 14 && rand() < 0.5) kick(beat, 0.25);
      if (s % 2 === 1) shaker(beat, x > 0.7 ? 1 : 0.6);
    }
    // 4: the nervous organ, its top note leaning a semitone sharp on the second half
    if (on[4] && (s === 0 || s === 8)) {
      const ms = chord.notes.map((n, i) => (s === 8 && i === chord.notes.length - 1 ? n + 1 : n));
      organ(org, ms, 8 * sd, 1, 7 + 6 * x);
    }
    // 5: panic
    if (on[5]) {
      const ms = chord.notes;
      pluck(panic, ms[s % ms.length] + 12 + (s % 6 >= 3 ? 12 : 0), 0.8, 0.08);
      if (s === 0 && bar % 4 === 0) crash(panic, 1);
    }
  },
};

const REPORT: Song = {
  bpm: () => 68,
  swing: 0.22,
  bars: ['Cmaj7', 'Am7', 'Dm7', 'G7'],
  layers: () => [1],
  crackle: 0.12,
  gain: 0.4,
  play(L, { sd, s, bar, chord, next }) {
    const o = L[0];
    if (s === 0) keys(o, chord.notes, 7 * sd, 0.85);
    if (s === 8) keys(o, chord.notes, 6 * sd, 0.6);
    if (s === 0) bass(o, chord.bass, 6 * sd, 0.85);
    if (s === 10) bass(o, chord.bass + 7, 2 * sd, 0.6);
    if (s === 14) bass(o, next.bass - 1, 2 * sd, 0.5);
    if (s === 0) kick(o, 0.5);
    if (s === 10) kick(o, 0.35);
    if (s === 4 || s === 12) snare(o, 0.3);
    if (s % 2 === 0) shaker(o, 0.7);
    // a music-box doodle every other bar
    if (bar % 2 === 1 && (s === 4 || s === 8 || s === 12)) {
      const m = chord.notes[(s / 4 - 1) % chord.notes.length] + 12;
      tone(o, { f: mtof(m), d: 0.5, v: 0.05 });
      tone(o, { f: mtof(m) * 3.01, d: 0.12, v: 0.015 });
    }
  },
};

const SONGS: Record<TrackId, Song> = { title: TITLE, night: NIGHT, report: REPORT };

// ------------------------------------------------------------------------------ playback

/** One song playing into `dest`, with its own fade and layer gains. */
export class Track {
  readonly out: GainNode;
  stopAt = Infinity;
  private readonly song: Song;
  private readonly layerGains: GainNode[];
  /** The Raccoon Rave layer (silent unless the song has one and the Rave is on). */
  private readonly raveGain: GainNode;
  private fever = false;
  private readonly lastOn: number[];
  private readonly crackle: AudioBufferSourceNode | null = null;
  private step = 0;
  private bar = 0;
  private next: number;
  private x: number;

  constructor(
    private readonly ctx: BaseAudioContext,
    dest: AudioNode,
    readonly id: TrackId,
    start: number,
    x: number,
    fadeIn: number,
  ) {
    this.song = SONGS[id];
    this.x = x;
    this.next = start;
    this.out = gainNode(ctx, fadeIn > 0 ? 0 : this.song.gain);
    if (fadeIn > 0) {
      this.out.gain.setValueAtTime(0, start);
      this.out.gain.linearRampToValueAtTime(this.song.gain, start + fadeIn);
    }
    this.out.connect(dest);
    const targets = this.song.layers(x);
    this.layerGains = targets.map((v) => {
      const g = gainNode(ctx, v);
      g.connect(this.out);
      return g;
    });
    this.lastOn = targets.map((v) => (v > 0.01 ? start : -Infinity));
    this.raveGain = gainNode(ctx, 0);
    this.raveGain.connect(this.out);
    if (this.song.crackle > 0) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, 'crackle');
      src.loop = true;
      src.connect(gainNode(ctx, this.song.crackle)).connect(this.out);
      src.start(start);
      this.crackle = src;
    }
  }

  /** Silences every layer but one (the lab uses this to measure layers on their own). */
  solo(layer: number): void {
    this.layerGains.forEach((g, i) => {
      if (i !== layer) g.gain.value = 0;
    });
  }

  /** The Raccoon Rave on or off: the rave layer swells in (or cuts) and the tempo jumps. */
  setFever(on: boolean, now: number): void {
    if (on === this.fever) return;
    this.fever = on && this.song.rave === true;
    this.raveGain.gain.setTargetAtTime(this.fever ? 1 : 0, now, this.fever ? 0.03 : 0.15);
  }

  setIntensity(x: number, now: number): void {
    if (Math.abs(x - this.x) < 0.004) return;
    this.x = x;
    this.song.layers(x).forEach((v, i) => this.layerGains[i].gain.setTargetAtTime(v, now, 0.5));
  }

  /** Queues every step that starts before `until`. When silent, keeps time without making notes. */
  schedule(until: number, silent: boolean): void {
    const song = this.song;
    while (this.next < until) {
      const sd = 60 / (song.bpm(this.x) * (this.fever ? FEVER_TEMPO : 1)) / 4;
      const t = Math.max(0, this.next + (this.step % 2 === 1 ? song.swing * sd : 0) + (rand() - 0.5) * 0.008);
      if (!silent) {
        const on = song.layers(this.x).map((v, i) => {
          if (v > 0.01) this.lastOn[i] = t;
          return t - this.lastOn[i] < 2.5;
        });
        const L = [...this.layerGains, this.raveGain].map((g) => ({ ctx: this.ctx, dest: g, t }));
        const step: Step = {
          sd,
          s: this.step,
          bar: this.bar,
          chord: CHORDS[song.bars[this.bar]],
          next: CHORDS[song.bars[(this.bar + 1) % song.bars.length]],
          x: this.x,
          fever: this.fever,
        };
        song.play(L, step, on);
      }
      this.next += sd;
      if (++this.step === 16) {
        this.step = 0;
        this.bar = (this.bar + 1) % song.bars.length;
      }
    }
  }

  /** After a stall (a hidden tab), carry on from now instead of bursting the missed notes. */
  resync(now: number): void {
    if (this.next < now) this.next = now + 0.03;
  }

  fadeOut(now: number, sec: number): void {
    const g = this.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + sec);
    this.stopAt = now + sec + 0.1;
  }

  dispose(): void {
    try {
      this.crackle?.stop();
    } catch {
      // never started
    }
    this.out.disconnect();
  }
}

/** The live player: one current song, crossfades, and the scheduler timer. */
export class MusicPlayer {
  muted = false;
  private tracks: Track[] = [];
  private current: TrackId | null = null;
  private x = 0;
  private fever = false;
  private timer: number | undefined;

  constructor(
    private readonly ctx: AudioContext,
    private readonly dest: AudioNode,
  ) {}

  set(id: TrackId | null): void {
    if (id === this.current) return;
    this.current = id;
    const now = this.ctx.currentTime;
    for (const tr of this.tracks) if (tr.stopAt === Infinity) tr.fadeOut(now, 1.6);
    if (id) {
      const tr = new Track(this.ctx, this.dest, id, now + 0.06, this.x, 1.2);
      tr.setFever(this.fever, now);
      this.tracks.push(tr);
    }
    if (this.timer === undefined) this.timer = window.setInterval(this.tick, 25);
    this.tick();
  }

  /** The Raccoon Rave (src/game/combo.ts): double-time and the rave layer on the night song. */
  setFever(on: boolean): void {
    this.fever = on;
    const now = this.ctx.currentTime;
    for (const tr of this.tracks) if (tr.stopAt === Infinity) tr.setFever(on, now);
  }

  setIntensity(x: number): void {
    this.x = x;
    const now = this.ctx.currentTime;
    for (const tr of this.tracks) tr.setIntensity(x, now);
  }

  private readonly tick = (): void => {
    const now = this.ctx.currentTime;
    // Hidden tabs only get a timer tick about once a second, so look further ahead there.
    const ahead = typeof document !== 'undefined' && document.hidden ? 1.2 : 0.15;
    this.tracks = this.tracks.filter((tr) => {
      if (now < tr.stopAt) return true;
      tr.dispose();
      return false;
    });
    for (const tr of this.tracks) {
      tr.resync(now);
      tr.schedule(now + ahead, this.muted);
    }
    if (this.tracks.length === 0 && this.timer !== undefined) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }
  };
}

/** Renders `seconds` of a song into `dest` in one go (for the lab's offline measurements). */
export function renderSong(ctx: BaseAudioContext, dest: AudioNode, id: TrackId, x: number, seconds: number, solo?: number, fever = false): void {
  const tr = new Track(ctx, dest, id, 0.05, x, 0);
  if (solo !== undefined) tr.solo(solo);
  if (fever) tr.setFever(true, 0);
  tr.schedule(seconds, false);
}
