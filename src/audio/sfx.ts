// The sound of every GameEvent. `eventSound(e)` says which sound an event makes: a key (for the
// level table and the rate limiter), a stereo pan from the board column, and a recipe. Recipes
// are plain functions over an `Out`, so they play live (index.ts) or render offline (lab.ts).
import type { GameEvent } from '../game/events';
import { ITEMS, JUNK_CHAIN, type ItemId } from '../data/items';
import {
  type Out,
  RATIOS,
  biquad,
  clamp,
  echo,
  gainNode,
  later,
  lfo,
  metal,
  mtof,
  noise,
  rand,
  ri,
  rr,
  semi,
  shaper,
  tone,
} from './synth';
import { chitter, choir, crowdUgh, flap, gullCall, kazoo, trombone } from './voices';
// Cascades, the streak, the Rave, the tire, brews and tools (anything else new: no sound).
import { momentumSound } from './momentum';
// The run's Contraband and boss events (src/audio/run.ts).
import { runEventSound } from './run';

export interface Sound {
  /** Groups sounds for the level table and the rate limiter. */
  key: string;
  /** -1 (left) to 1 (right). */
  pan: number;
  /** Plays into o.dest from o.t; returns how long it rings, in seconds. */
  play: (o: Out) => number;
}

// ------------------------------------------------------------------------------ levels

/**
 * Per-sound trims, set by measuring every sound in the audio lab (audio-lab.html) so they sit
 * at roughly even loudness after the master chain.
 */
const LEVEL: Record<string, number> = {
  truckArrive: 0.45,
  truckLeave: 0.45,
  overflow: 0.55,
  nightWon: 0.75,
  nightLost: 0.45,
  invalid: 0.7,
  stinkWarn: 1.4,
  ripen: 0.6,
  'dumpster.stuck': 1.3,
  truckDump: 0.8,
  gullPeck: 1.3,
  // Momentum (momentum.ts): the Rave's air horn is a big moment, but not three merges loud.
  feverStart: 0.6,
  // The run (run.ts): the long kazoo and trombone tunes measure loud; the pin and the perk pip soft.
  'run.fired': 0.55,
  'run.runWon': 0.6,
  'run.spring': 0.7,
  'run.fork': 1.6,
  perk: 1.7,
};

export function levelOf(key: string): number {
  return LEVEL[key] ?? 1;
}

/** Starts a sound on its own trimmed, panned voice into `o.dest`. */
export function startSound(o: Out, s: Sound): { gain: GainNode; out: AudioNode; end: number } {
  const g = gainNode(o.ctx, levelOf(s.key));
  const p = o.ctx.createStereoPanner();
  p.pan.value = clamp(s.pan, -1, 1);
  g.connect(p).connect(o.dest);
  const dur = s.play({ ctx: o.ctx, dest: g, t: o.t });
  return { gain: g, out: p, end: o.t + dur };
}

// ------------------------------------------------------------------------------ memory

/** Which raccoon stands at which order slot (deliveries only carry the slot). */
const slotRaccoon = new Map<number, string>();
/** Where the piece flying to each cell came from (a `land` only carries the cell). */
const cellFrom = new Map<number, Extract<GameEvent, { type: 'spawn' }>['from']>();

/** Keeps what later events need to know. Call for every event, even while muted. */
export function remember(e: GameEvent): void {
  if (e.type === 'orderArrive') slotRaccoon.set(e.slot, e.raccoon);
  else if (e.type === 'spawn') cellFrom.set(e.c * 16 + e.r, e.from);
}

/** How hard a flying piece lands: off the truck is heaviest, a dumpster pop the lightest. */
const LAND_WEIGHT = { truck: 1.15, kick: 0.95, egg: 1, dumpster: 0.8 } as const;

// ------------------------------------------------------------------------------ materials

type Material =
  | 'tink'
  | 'tin'
  | 'paper'
  | 'wet'
  | 'leather'
  | 'clank'
  | 'rubber'
  | 'rattle'
  | 'soft'
  | 'hollow'
  | 'crunch'
  | 'royal'
  | 'feather'
  | 'gold'
  | 'slosh';

/** What each item is made of (anything new, like brewed recipes, falls back to `MATERIAL_OF`). */
const MATERIAL: Partial<Record<ItemId, Material>> = {
  cap: 'tink',
  can: 'tin',
  takeout: 'paper',
  bag: 'wet',
  boot: 'leather',
  toaster: 'clank',
  tire: 'rubber',
  cart: 'rattle',
  mattress: 'soft',
  fridge: 'hollow',
  car: 'crunch',
  king: 'royal',
  gull: 'feather',
  fatgull: 'feather',
  gullgang: 'feather',
  gullboss: 'feather',
  gullgod: 'feather',
  golden_egg: 'gold',
  bin_juice: 'slosh',
};

/** How heavy an item sounds, 0 (a bottle cap) to 1 (the Trash King). */
function weightOf(id: ItemId): number {
  const d = ITEMS[id];
  if (d.chain === 'junk') return (d.tier - 1) / 11;
  if (d.chain === 'gull') return 0.15 + d.tier * 0.08;
  return 0.25;
}

/** The low "thud" under anything hitting the dirt; heavier junk is lower and longer. */
function thud(o: Out, k: number, w: number): number {
  return tone(o, {
    f: 170 - 95 * k,
    f2: 38 + 12 * (1 - k),
    glide: 0.07 + 0.1 * k,
    a: 0.002,
    d: 0.08 + 0.2 * k,
    v: (0.3 + 0.35 * k) * w,
  });
}

/** What an item sounds like: its own material, or one guessed from its chain. */
function materialOf(id: ItemId): Material {
  const m = MATERIAL[id];
  if (m) return m;
  const chain = ITEMS[id]?.chain as string | undefined;
  return chain === 'gull' ? 'feather' : chain === 'junk' ? 'clank' : 'slosh';
}

/** An item hitting the ground: a thud plus what it's made of. `w` scales how hard it lands. */
function impact(o: Out, id: ItemId, w: number): number {
  return Math.max(thud(o, weightOf(id), w), material(o, materialOf(id), w));
}

function material(o: Out, m: Material, w: number): number {
  switch (m) {
    case 'tink':
      return Math.max(
        metal(o, { f: rr(2300, 2700), ratios: RATIOS.tin, d: 0.12, v: 0.3 * w, click: 0.4 }),
        metal(o, { dt: 0.075, f: rr(2300, 2700), ratios: RATIOS.tin, d: 0.07, v: 0.12 * w }),
      );
    case 'tin':
      return Math.max(
        metal(o, { f: rr(700, 850), ratios: RATIOS.can, d: 0.16, v: 0.3 * w, bright: 0.7, click: 0.3 }),
        noise(o, { f: 2400, q: 1.2, d: 0.05, v: 0.12 * w, drive: 3 }),
      );
    case 'paper':
      return Math.max(
        noise(o, { f: 1500, q: 0.8, a: 0.004, d: 0.06, v: 0.3 * w }),
        noise(o, { dt: 0.045, f: 950, q: 0.9, a: 0.004, d: 0.07, v: 0.22 * w }),
      );
    case 'wet':
      return Math.max(
        noise(o, { ft: 'lowpass', f: 2600, f2: 280, glide: 0.12, q: 5, a: 0.003, d: 0.15, v: 0.3 * w }),
        tone(o, { f: 380, f2: 110, glide: 0.09, d: 0.1, v: 0.3 * w }),
        tone(o, { dt: 0.07, f: 650, f2: 1150, glide: 0.04, d: 0.04, v: 0.1 * w }),
      );
    case 'leather':
      return Math.max(
        noise(o, { ft: 'lowpass', f: 700, a: 0.003, d: 0.06, v: 0.3 * w }),
        tone(o, { f: 125, f2: 60, glide: 0.1, d: 0.12, v: 0.3 * w }),
      );
    case 'clank':
      return Math.max(
        metal(o, { f: rr(410, 450), ratios: RATIOS.plate, d: 0.28, v: 0.26 * w, click: 0.4 }),
        // the toaster's spring goes "sproing"
        tone(o, { dt: 0.02, type: 'triangle', f: 380, f2: 760, glide: 0.18, d: 0.22, v: 0.08 * w, vib: [28, 80] }),
      );
    case 'rubber':
      return Math.max(
        tone(o, { f: 150, f2: 92, glide: 0.12, d: 0.14, v: 0.4 * w }),
        tone(o, { dt: 0.16, f: 140, f2: 100, glide: 0.08, d: 0.1, v: 0.2 * w }),
        noise(o, { ft: 'lowpass', f: 400, d: 0.05, v: 0.15 * w }),
      );
    case 'rattle': {
      let end = 0;
      [0, 0.03, 0.055, 0.09, 0.13].forEach((dt, i) => {
        end = Math.max(end, metal(o, { dt, f: rr(900, 1500), ratios: RATIOS.can, d: 0.06, v: 0.14 * w * (1 - i * 0.12) }));
      });
      // one wheel has opinions
      return Math.max(end, tone(o, { dt: 0.05, f: 1900, f2: 2300, d: 0.09, v: 0.05 * w }));
    }
    case 'soft':
      return Math.max(
        noise(o, { kind: 'brown', ft: 'lowpass', f: 350, a: 0.01, d: 0.28, v: 0.7 * w }),
        metal(o, { dt: 0.03, f: 310, ratios: RATIOS.bar, d: 0.35, v: 0.06 * w, bright: 0.3 }),
        tone(o, { dt: 0.05, f: 300, f2: 340, d: 0.25, v: 0.03 * w, vib: [9, 60] }),
      );
    case 'hollow':
      return Math.max(
        metal(o, { f: 120, ratios: RATIOS.plate, d: 0.7, v: 0.3 * w, bright: 0.7 }),
        noise(o, { ft: 'lowpass', f: 900, d: 0.08, v: 0.3 * w }),
        metal(o, { dt: 0.06, f: 1700, ratios: RATIOS.tin, d: 0.08, v: 0.08 * w }),
        metal(o, { dt: 0.11, f: 1850, ratios: RATIOS.tin, d: 0.08, v: 0.06 * w }),
      );
    case 'crunch': {
      let end = Math.max(
        noise(o, { kind: 'brown', ft: 'lowpass', f: 1000, d: 0.35, v: 0.4 * w, drive: 6 }),
        metal(o, { f: 180, ratios: RATIOS.plate, d: 0.5, v: 0.2 * w }),
        tone(o, { f: 70, f2: 35, glide: 0.3, d: 0.4, v: 0.4 * w }),
      );
      for (let i = 0; i < 4; i++) {
        end = Math.max(end, metal(o, { dt: 0.05 + i * rr(0.04, 0.08), f: rr(3000, 5000), ratios: RATIOS.tin, d: 0.08, v: 0.05 * w }));
      }
      return end;
    }
    case 'royal':
      return Math.max(
        material(o, 'crunch', w * 0.5),
        metal(o, { dt: 0.05, f: mtof(72), ratios: RATIOS.bell, d: 1.0, v: 0.07 * w }),
        metal(o, { dt: 0.05, f: mtof(76), ratios: RATIOS.bell, d: 1.0, v: 0.055 * w }),
        metal(o, { dt: 0.05, f: mtof(79), ratios: RATIOS.bell, d: 1.0, v: 0.055 * w }),
      );
    case 'feather':
      return Math.max(flap(o, 0, 0.3 * w), flap(o, 0.07, 0.22 * w), tone(o, { dt: 0.02, f: 900, f2: 700, d: 0.04, v: 0.04 * w }));
    case 'gold':
      return Math.max(
        metal(o, { f: mtof(91), ratios: RATIOS.bell, d: 0.6, v: 0.16 * w, bright: 0.5 }),
        sparkle(later(o, 0.03), 4, 0.04 * w),
      );
    case 'slosh': {
      let end = noise(o, { ft: 'lowpass', f: 900, a: 0.01, d: 0.12, v: 0.2 * w });
      for (let i = 0; i < 4; i++) {
        const f = rr(300, 700);
        end = Math.max(end, tone(o, { dt: i * rr(0.03, 0.05), f, f2: f * 1.6, glide: 0.04, d: 0.05, v: 0.15 * w }));
      }
      return end;
    }
  }
}

/** Little rising pentatonic glints. */
function sparkle(o: Out, n: number, v: number): number {
  const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  let end = 0;
  for (let i = 0; i < n; i++) {
    const m = 84 + scale[Math.min(scale.length - 1, i)];
    end = Math.max(end, tone(o, { dt: i * 0.045, f: mtof(m), d: 0.14, v, type: i % 2 ? 'triangle' : 'sine' }));
  }
  return end;
}

/** A classic two-step coin. */
function coin(o: Out, dt: number, v: number, pitch = 1): number {
  const lp = biquad(o.ctx, 'lowpass', 5000, 0.7);
  lp.connect(o.dest);
  tone(o, { dt, type: 'square', f: 988 * pitch, a: 0.001, hold: 0.05, d: 0.01, v, dest: lp });
  return tone(o, { dt: dt + 0.055, type: 'square', f: 1319 * pitch, a: 0.001, hold: 0.04, d: 0.2, v, dest: lp });
}

// ------------------------------------------------------------------------------ merges

/** The wet squelch of two things becoming one: higher and heavier per tier. */
function squelch(o: Out, tier: number): number {
  const k = (tier - 1) / 11;
  const f = 170 * semi((tier - 1) * 1.6);
  let end = Math.max(
    // the squish: a resonant sweep through noise
    noise(o, { f: f * 9, f2: f * 2.2, glide: 0.11, q: 3, a: 0.004, d: 0.12 + 0.06 * k, v: 0.32 }),
    // the blorp
    tone(o, { f: f * 1.9, f2: f * 0.75, glide: 0.08, a: 0.003, d: 0.09 + 0.05 * k, v: 0.4 }),
    // the pop
    tone(o, { dt: 0.055, type: 'triangle', f: f * 1.3, f2: f * 3.2, glide: 0.045, a: 0.002, d: 0.05, v: 0.26 }),
    // the weight
    tone(o, { f: 130, f2: 42, glide: 0.1 + 0.1 * k, d: 0.1 + 0.3 * k, v: 0.15 + 0.35 * k }),
  );
  // bubbles
  const n = 1 + Math.round(k * 4);
  for (let i = 0; i < n; i++) {
    const bf = rr(700, 1400) * (1 + k * 0.3);
    end = Math.max(end, tone(o, { dt: 0.06 + rand() * 0.14 + i * 0.02, f: bf, f2: bf * 1.6, glide: 0.03, d: 0.035, v: 0.09 }));
  }
  // junk tier 9 and up lands with a crunchy thud
  if (tier >= 9) {
    const c = (tier - 8) / 4;
    end = Math.max(
      end,
      noise(o, { kind: 'brown', ft: 'lowpass', f: 1400, f2: 300, d: 0.3 + 0.2 * c, v: 0.22 + 0.12 * c, drive: 7 }),
      metal(o, { f: 160 - 20 * c, ratios: RATIOS.plate, d: 0.35 + 0.3 * c, v: 0.13 + 0.08 * c, bright: 0.5 }),
      tone(o, { f: 85, f2: 32, glide: 0.25, d: 0.35 + 0.2 * c, v: 0.28 + 0.1 * c }),
    );
  }
  return end;
}

/** "New thing!": a cheap toy glockenspiel running up. */
function jingle(o: Out): number {
  const notes = [79, 83, 86, 91];
  let end = 0;
  notes.forEach((m, i) => {
    const f = mtof(m);
    const last = i === notes.length - 1;
    end = Math.max(
      end,
      tone(o, { dt: i * 0.075, type: 'triangle', f, d: last ? 0.4 : 0.12, v: 0.13, vib: last ? [6, 25] : undefined }),
      tone(o, { dt: i * 0.075, type: 'triangle', f, detune: 18, d: last ? 0.4 : 0.12, v: 0.07 }),
      tone(o, { dt: i * 0.075, f: f * 2, d: 0.2, v: 0.05 }),
    );
  });
  return end;
}

/** All hail: the Trash King gets a crash and a kazoo "ta-daaa". */
function coronation(o: Out): number {
  return Math.max(
    noise(o, { ft: 'highpass', f: 4500, q: 0.5, a: 0.002, d: 1.4, v: 0.1 }),
    kazoo(later(o, 0.05), [{ dt: 0, dur: 0.12, m: 67 }, { dt: 0.14, dur: 0.9, m: 72 }], 0.16) + 0.05,
    kazoo(later(o, 0.05), [{ dt: 0, dur: 0.12, m: 64 }, { dt: 0.14, dur: 0.9, m: 67 }], 0.1) + 0.05,
  );
}

function mergeSound(e: Extract<GameEvent, { type: 'merge' }>): Sound {
  const def = ITEMS[e.to];
  const tier = def.chain === 'special' ? e.tier : def.tier;
  const pan = colPan(e.c);
  if (def.chain === 'gull') {
    return {
      key: 'merge.gull',
      pan,
      play: (o) => {
        let end = Math.max(flap(o, 0, 0.3), flap(o, 0.06, 0.25));
        const calls = Math.min(3, Math.max(1, tier - 1));
        for (let i = 0; i < calls; i++) {
          end = Math.max(
            end,
            gullCall(o, { dt: 0.03 + i * 0.09, f: (1500 - tier * 110) * semi(i * 3), dur: 0.22 + tier * 0.04, v: 0.3, rasp: 0.3 + tier * 0.1 }),
          );
        }
        if (e.first) end = Math.max(end, 0.15 + jingle(later(o, 0.15)));
        return end;
      },
    };
  }
  return {
    key: tier >= 9 ? 'merge.big' : 'merge',
    pan,
    play: (o) => {
      let end = def.chain === 'special' ? material(o, 'slosh', 1) : squelch(o, clamp(tier, 1, 12));
      if (e.to === 'king') end = Math.max(end, 0.1 + coronation(later(o, 0.1)));
      if (e.first) end = Math.max(end, 0.13 + jingle(later(o, 0.13)));
      return end;
    },
  };
}

// ------------------------------------------------------------------------------ the truck

/** A wheezing diesel: two beating saws through a low filter, chugging. */
function engine(o: Out, mode: 'arrive' | 'leave'): number {
  const { ctx } = o;
  const t = o.t;
  const dur = mode === 'arrive' ? 2.9 : 2.2;
  const end = t + dur;
  const lp = biquad(ctx, 'lowpass', 220, 3);
  const drv = shaper(ctx, 2);
  const chug = gainNode(ctx, 0.65);
  const g = gainNode(ctx, 0);
  lp.connect(drv).connect(chug).connect(g).connect(o.dest);
  const chugLfo = lfo(ctx, chug.gain, 9, 0.35, t, end, 'square');
  const oscs = [
    ['sawtooth', 41, 0.5],
    ['sawtooth', 42.3, 0.5],
    ['square', 82, 0.25],
  ] as const;
  for (const [type, f, v] of oscs) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (mode === 'leave') {
      // rev it, then pull away
      osc.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.45);
      osc.frequency.exponentialRampToValueAtTime(f * 1.35, end);
    } else {
      osc.frequency.setValueAtTime(f * 1.15, t);
      osc.frequency.exponentialRampToValueAtTime(f, t + 1.2);
    }
    osc.connect(gainNode(ctx, v)).connect(lp);
    osc.start(t);
    osc.stop(end + 0.01);
  }
  if (mode === 'arrive') {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.6);
    g.gain.setValueAtTime(0.55, t + 2.0);
    g.gain.linearRampToValueAtTime(0, end);
    lp.frequency.setValueAtTime(140, t);
    lp.frequency.linearRampToValueAtTime(300, t + 0.6);
  } else {
    chugLfo.gain.setValueAtTime(0.35, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.6, t + 0.1);
    g.gain.setValueAtTime(0.6, t + 0.5);
    g.gain.linearRampToValueAtTime(0, end);
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.linearRampToValueAtTime(520, t + 0.45);
    lp.frequency.linearRampToValueAtTime(130, end);
  }
  noise(o, { kind: 'brown', ft: 'lowpass', f: 220, a: 0.4, hold: dur - 1.0, d: 0.6, v: 0.35 });
  return dur;
}

function truckArrive(o: Out): number {
  const { ctx } = o;
  const bp = biquad(ctx, 'bandpass', 1050, 1.6);
  bp.connect(o.dest);
  let end = engine(o, 'arrive');
  for (let i = 0; i < 3; i++) {
    // beep, beep, beep (slightly wobbly, it's an old truck)
    end = Math.max(
      end,
      tone(o, { dt: 0.55 + i * 0.6, type: 'square', f: 1040 * semi(rr(-0.15, 0.15)), a: 0.006, hold: 0.3, d: 0.04, v: 0.12, dest: bp }),
    );
  }
  return end;
}

function truckDump(o: Out, count: number): number {
  const lp = biquad(o.ctx, 'lowpass', 900, 1);
  lp.connect(o.dest);
  // the bed tipping up on old hydraulics
  let end = Math.max(
    tone(o, { type: 'sawtooth', f: 160, f2: 330, glide: 0.6, a: 0.05, hold: 0.35, d: 0.2, v: 0.12, dest: lp }),
    noise(o, { ft: 'highpass', f: 4000, a: 0.05, d: 0.3, v: 0.1 }),
    // the load lets go
    noise(o, { dt: 0.3, kind: 'brown', ft: 'lowpass', f: 1200, a: 0.01, d: 0.5, v: 0.5 }),
    noise(o, { dt: 0.3, f: 2500, q: 0.8, d: 0.35, v: 0.12 }),
    tone(o, { dt: 0.3, f: 90, f2: 35, glide: 0.3, d: 0.35, v: 0.45 }),
  );
  // a tumble of everything inside
  const hits = clamp(count * 2, 3, 10);
  for (let i = 0; i < hits; i++) {
    const id = JUNK_CHAIN[ri(0, 5)];
    end = Math.max(end, impact(later(o, 0.32 + (i / hits) * 0.8 + rand() * 0.06), id, rr(0.4, 0.7)) + 1.2);
  }
  return end;
}

function truckLeave(o: Out): number {
  return Math.max(
    engine(o, 'leave'),
    // the backfire
    noise(o, { dt: 0.85, f: 800, q: 0.7, a: 0.001, d: 0.12, v: 0.4, drive: 4 }),
    tone(o, { dt: 0.85, f: 95, f2: 40, glide: 0.1, d: 0.15, v: 0.5 }),
  );
}

// ------------------------------------------------------------------------------ the rest

function flies(o: Out): number {
  const { ctx } = o;
  let end = 0;
  for (let i = 0; i < 5; i++) {
    const t = o.t + i * 0.09 + rand() * 0.05;
    const dur = 1.7 - i * 0.06;
    const fin = t + dur;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = rr(170, 260);
    lfo(ctx, osc.detune, rr(2.5, 7), rr(150, 300), t, fin);
    const bp = biquad(ctx, 'bandpass', rr(500, 900), 1.2);
    const pan = ctx.createStereoPanner();
    lfo(ctx, pan.pan, rr(0.4, 1.2), 0.8, t, fin);
    const g = gainNode(ctx, 0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.45);
    g.gain.setValueAtTime(0.09, fin - 0.5);
    g.gain.linearRampToValueAtTime(0, fin);
    osc.connect(bp).connect(g).connect(pan).connect(o.dest);
    osc.start(t);
    osc.stop(fin + 0.01);
    end = Math.max(end, fin - o.t);
  }
  return end;
}

function compactor(o: Out, id: ItemId): number {
  const lp = biquad(o.ctx, 'lowpass', 650, 1.5);
  lp.connect(o.dest);
  let end = Math.max(
    // pneumatic "pssh", then the motor grinding up
    noise(o, { ft: 'highpass', f: 3000, a: 0.005, d: 0.25, v: 0.16 }),
    tone(o, { type: 'sawtooth', f: 85, f2: 180, glide: 0.6, a: 0.05, hold: 0.45, d: 0.15, v: 0.2, dest: lp }),
  );
  // the crunch: a rattle of tiny breaking bits
  const k = weightOf(id);
  const grains = 10 + Math.round(k * 8);
  for (let i = 0; i < grains; i++) {
    end = Math.max(end, noise(o, { dt: 0.15 + rand() * 0.55, f: rr(600, 3200), q: 2, a: 0.001, d: rr(0.01, 0.03), v: rr(0.15, 0.35), drive: 4 }));
  }
  // bottoming out, then the release hiss
  return Math.max(
    end,
    tone(o, { dt: 0.75, f: 95, f2: 38, glide: 0.15, d: 0.22, v: 0.5 }),
    metal(o, { dt: 0.75, f: 220, ratios: RATIOS.plate, d: 0.3, v: 0.16 }),
    noise(o, { dt: 0.88, ft: 'highpass', f: 2500, a: 0.02, d: 0.35, v: 0.1 }),
  );
}

function splat(o: Out): number {
  let end = Math.max(
    noise(o, { f: 1400, f2: 280, glide: 0.2, q: 1.5, a: 0.002, d: 0.25, v: 0.4 }),
    tone(o, { f: 240, f2: 55, glide: 0.18, d: 0.2, v: 0.45 }),
  );
  for (let i = 0; i < 3; i++) {
    const f = rr(500, 900);
    end = Math.max(end, tone(o, { dt: 0.22 + i * rr(0.08, 0.14), f, f2: f * 0.6, d: 0.04, v: 0.08 }));
  }
  return end;
}

function clockChime(o: Out, hour: number): number {
  // a plastic clock clearing its throat
  let end = 0;
  for (let i = 0; i < 4; i++) end = Math.max(end, noise(o, { dt: i * 0.045, ft: 'highpass', f: 4000, d: 0.01, v: 0.1 }));
  end = Math.max(
    end,
    metal(o, { dt: 0.22, f: 880 * semi(0.15), ratios: RATIOS.tin, d: 0.7, v: 0.22, bright: 0.45 }),
    metal(o, { dt: 0.62, f: 698 * semi(-0.2), ratios: RATIOS.tin, d: 0.9, v: 0.22, bright: 0.45 }),
  );
  const dings = clamp(Math.round(hour), 0, 6);
  for (let i = 0; i < dings; i++) {
    end = Math.max(end, metal(o, { dt: 1.1 + i * 0.17, f: 1760 * semi(rr(-0.2, 0.2)), ratios: RATIOS.tin, d: 0.18, v: 0.1 }));
  }
  return end;
}

function gullGod(o: Out): number {
  const { ctx } = o;
  const dur = 2.3;
  const wet = echo(ctx, o.dest, 0.19, 0.35, 0.45, o.t + dur);
  const w = later(o, 0, wet);
  let end = Math.max(
    choir(w, [60, 64, 67, 72, 76], dur, 0.12),
    flap(w, 0, 0.35),
    flap(w, 0.08, 0.35),
    flap(w, 0.16, 0.3),
  );
  [1, 1.26, 1.5].forEach((r, i) => {
    end = Math.max(end, gullCall(w, { dt: 0.25 + i * 0.12, f: 1150 * r, dur: 0.9, v: 0.16, rasp: 0.8, fall: 1.1 }));
  });
  end = Math.max(end, sparkle(later(w, 1.2), 10, 0.035));
  return end + 0.8;
}

function deliverSound(e: Extract<GameEvent, { type: 'deliver' }>): Sound {
  return {
    key: e.complete ? 'deliver.complete' : 'deliver',
    pan: -0.6,
    play: (o) => {
      const n = clamp(Math.round(Math.log2(Math.max(1, e.shinies))), 1, 5) + (e.complete ? 3 : 0);
      let end = 0;
      for (let i = 0; i < n; i++) end = Math.max(end, coin(o, i * 0.07, 0.07, semi(i % 2 ? 2 : 0)));
      if (ITEMS[e.id].chain === 'gull') end = Math.max(end, gullCall(o, { f: 1300, dur: 0.25, v: 0.2 }));
      if (e.complete) {
        end = Math.max(end, metal(o, { dt: n * 0.07, f: 2093, ratios: RATIOS.bell, d: 0.7, v: 0.12 }));
        const who = slotRaccoon.get(e.slot);
        if (who) end = Math.max(end, 0.25 + chitter(later(o, 0.25), who, 'happy'));
      }
      return end;
    },
  };
}

function colPan(c: number): number {
  return clamp((c - 4) / 4, -1, 1) * 0.55;
}

// ------------------------------------------------------------------------------ the table

export function eventSound(e: GameEvent): Sound | null {
  switch (e.type) {
    case 'merge':
      return mergeSound(e);

    // A spawn is the launch (every piece then flies and `land`s, which is the impact).
    case 'spawn': {
      const pan = colPan(e.c);
      switch (e.from) {
        case 'truck':
          // tossed off the back of the truck
          return { key: 'spawn.toss', pan, play: (o) => noise(o, { f: 500, f2: 1600, q: 1.5, a: 0.04, d: 0.08, v: 0.22 }) };
        case 'kick':
          // booted out of the dumpster
          return {
            key: 'spawn.kick',
            pan,
            play: (o) =>
              Math.max(
                noise(o, { f: 600, f2: 1800, q: 1.5, a: 0.03, d: 0.08, v: 0.2 }),
                metal(o, { f: rr(170, 190), ratios: RATIOS.plate, d: 0.15, v: 0.14, bright: 0.5 }),
              ),
          };
        case 'egg':
          // falling from the sky, whistling
          return { key: 'spawn.egg', pan, play: (o) => tone(o, { f: 2000, f2: 600, glide: 0.4, d: 0.42, v: 0.14, vib: [7, 20] }) };
        case 'dumpster':
          // "thwup!" out of the lid
          return {
            key: 'spawn',
            pan,
            play: (o) =>
              Math.max(
                tone(o, { f: 240, f2: 560, glide: 0.05, a: 0.003, d: 0.06, v: 0.26 }),
                noise(o, { f: 900, f2: 1800, q: 1.2, a: 0.004, d: 0.05, v: 0.14 }),
              ),
          };
      }
      return null;
    }

    case 'land': {
      const from = cellFrom.get(e.c * 16 + e.r);
      const w = from ? LAND_WEIGHT[from] : 0.9;
      return { key: 'land', pan: colPan(e.c), play: (o) => impact(o, e.id, w) };
    }

    case 'dumpsterClick':
      if (e.ok) {
        return {
          key: 'dumpster',
          pan: 0.75,
          play: (o) => {
            const bp = biquad(o.ctx, 'bandpass', 1500, 4);
            bp.connect(o.dest);
            return Math.max(
              // the hinge creaks, then the lid clangs
              tone(o, { type: 'sawtooth', f: 260, f2: 340, glide: 0.12, a: 0.02, d: 0.1, v: 0.2, vib: [30, 120], dest: bp }),
              metal(o, { dt: 0.08, f: 175, ratios: RATIOS.plate, d: 0.45, v: 0.32, bright: 0.65, click: 0.5 }),
              noise(o, { dt: 0.08, kind: 'brown', ft: 'lowpass', f: 600, d: 0.1, v: 0.4 }),
              tone(o, { dt: 0.08, f: 110, f2: 50, d: 0.12, v: 0.3 }),
            );
          },
        };
      }
      return {
        key: 'dumpster.stuck',
        pan: 0.75,
        play: (o) => {
          let end = noise(o, { ft: 'lowpass', f: 500, d: 0.06, v: 0.35 });
          [0, 0.05, 0.11, 0.16, 0.24].forEach((dt, i) => {
            end = Math.max(end, metal(o, { dt, f: rr(260, 340), ratios: RATIOS.plate, d: 0.07, v: 0.24 * (1 - i * 0.13), bright: 0.5 }));
          });
          return end;
        },
      };

    case 'truckArrive':
      return { key: 'truckArrive', pan: 0, play: truckArrive };
    case 'truckDump':
      return { key: 'truckDump', pan: 0, play: (o) => truckDump(o, e.count) };
    case 'truckLeave':
      return { key: 'truckLeave', pan: 0, play: truckLeave };

    case 'overflow':
      return { key: 'overflow', pan: 0, play: (o) => Math.max(splat(o), 0.1 + crowdUgh(later(o, 0.1))) };

    case 'pickup': {
      const def = ITEMS[e.id];
      if (def.chain === 'gull') {
        return { key: 'pickup', pan: colPan(e.c), play: (o) => gullCall(o, { f: 1600, dur: 0.12, v: 0.2, rasp: 0.2, fall: 1.1 }) };
      }
      const k = weightOf(e.id);
      return {
        key: 'pickup',
        pan: colPan(e.c),
        play: (o) =>
          Math.max(
            tone(o, { f: 330 / (1 + k), f2: 660 / (1 + k), glide: 0.05, a: 0.003, d: 0.06, v: 0.28 }),
            noise(o, { f: 2500, q: 1.5, d: 0.015, v: 0.12 }),
          ),
      };
    }

    case 'move':
      return {
        key: 'move',
        pan: colPan(e.c),
        play: (o) => Math.max(tone(o, { f: 260, f2: 140, glide: 0.05, d: 0.06, v: 0.15 }), impact(o, e.id, 0.45)),
      };

    case 'swap':
      return {
        key: 'swap',
        pan: colPan((e.c + e.c2) / 2),
        play: (o) =>
          Math.max(
            noise(o, { f: 500, f2: 1800, glide: 0.07, q: 1.5, a: 0.02, d: 0.06, v: 0.22 }),
            noise(o, { dt: 0.08, f: 1800, f2: 500, glide: 0.07, q: 1.5, a: 0.02, d: 0.06, v: 0.22 }),
            tone(o, { f: 440, f2: 520, d: 0.05, v: 0.12 }),
            tone(o, { dt: 0.08, f: 520, f2: 440, d: 0.05, v: 0.12 }),
          ),
      };

    case 'invalid':
      return {
        key: 'invalid',
        pan: colPan(e.c),
        play: (o) => {
          // "nuh-uh": a deflated two-note buzz
          const lp = biquad(o.ctx, 'lowpass', 1300, 1);
          lp.connect(o.dest);
          let end = 0;
          for (const det of [0, 22]) {
            end = Math.max(
              end,
              tone(o, { type: 'square', f: 233, f2: 226, detune: det, a: 0.005, hold: 0.06, d: 0.05, v: 0.1, dest: lp }),
              tone(o, { dt: 0.14, type: 'square', f: 175, f2: 158, detune: det, a: 0.005, hold: 0.12, d: 0.1, v: 0.1, vib: [11, 35], dest: lp }),
            );
          }
          return end;
        },
      };

    case 'compact':
      return { key: 'compact', pan: -0.4, play: (o) => compactor(o, e.id) };

    case 'orderArrive':
      return {
        key: 'orderArrive',
        pan: -0.6,
        play: (o) => Math.max(noise(o, { f: 900, f2: 1600, q: 1, a: 0.02, d: 0.08, v: 0.12 }), 0.08 + chitter(later(o, 0.08), e.raccoon, 'arrive')),
      };

    case 'deliver':
      return deliverSound(e);

    case 'orderAngry':
      return {
        key: 'orderAngry',
        pan: -0.6,
        play: (o) => {
          const d = chitter(o, e.raccoon, 'angry');
          return Math.max(d, d + tone(later(o, d), { f: 110, f2: 45, glide: 0.12, d: 0.15, v: 0.4 }));
        },
      };

    case 'stinkWarn':
      return { key: 'stinkWarn', pan: 0, play: flies };

    // junk going off: a soft, wet sag
    case 'ripen':
      return {
        key: 'ripen',
        pan: colPan(e.c),
        play: (o) => Math.max(tone(o, { f: 150, f2: 80, glide: 0.14, d: 0.14, v: 0.12 }), noise(o, { f: 700, f2: 300, glide: 0.12, q: 1.5, d: 0.1, v: 0.06 })),
      };

    case 'gullArrive':
      return {
        key: 'gullArrive',
        pan: colPan(e.c),
        play: (o) =>
          Math.max(
            flap(o, 0, 0.3),
            flap(o, 0.08, 0.3),
            flap(o, 0.16, 0.25),
            flap(o, 0.24, 0.2),
            gullCall(o, { dt: 0.2, f: 1300, dur: 0.28, v: 0.3, rasp: 0.4 }),
            gullCall(o, { dt: 0.52, f: 1500, dur: 0.32, v: 0.3, rasp: 0.5 }),
          ),
      };

    case 'gullHop':
      return {
        key: 'gullHop',
        pan: colPan(e.toC),
        play: (o) => Math.max(flap(o, 0, 0.3), flap(o, 0.07, 0.25), tone(o, { dt: 0.16, f: 700, f2: 400, d: 0.03, v: 0.15 })),
      };

    case 'gullEat':
      return {
        key: 'gullEat',
        pan: colPan(e.c),
        play: (o) =>
          Math.max(
            noise(o, { f: 1800, q: 1.2, d: 0.06, v: 0.25, drive: 4 }),
            impact(o, e.id, 0.3),
            // gulp... gulp
            tone(o, { dt: 0.1, f: 450, f2: 120, glide: 0.1, d: 0.12, v: 0.35 }),
            noise(o, { dt: 0.1, f: 1800, q: 1.5, d: 0.015, v: 0.15 }),
            tone(o, { dt: 0.24, f: 380, f2: 130, glide: 0.08, d: 0.1, v: 0.3 }),
            noise(o, { dt: 0.24, f: 1800, q: 1.5, d: 0.015, v: 0.15 }),
          ),
      };

    case 'gullScream':
      return {
        key: 'gullScream',
        pan: colPan(e.c),
        play: (o) => {
          // the Gull Gang: three throats, no manners
          let end = 0;
          [1100, 1350, 1700].forEach((f, i) => {
            for (let k = 0; k < 2; k++) {
              end = Math.max(end, gullCall(o, { dt: i * 0.07 + k * 0.42 + rand() * 0.04, f: f * semi(rr(-1, 1)), dur: 0.4, v: 0.18, rasp: 0.85 }));
            }
          });
          return end;
        },
      };

    case 'gullPeck':
      return {
        key: 'gullPeck',
        pan: 0.4,
        play: (o) => {
          let end = 0;
          for (let i = 0; i < 3; i++) {
            end = Math.max(
              end,
              tone(o, { dt: i * 0.08, f: 1300, f2: 900, d: 0.025, v: 0.25 }),
              noise(o, { dt: i * 0.08, ft: 'highpass', f: 2500, d: 0.01, v: 0.18 }),
            );
          }
          // a coin goes missing; the gull is smug about it
          return Math.max(end, coin(o, 0.26, 0.06, semi(-5)), gullCall(o, { dt: 0.45, f: 1100, dur: 0.16, v: 0.18, rasp: 0.3 }));
        },
      };

    case 'gullGod':
      return { key: 'gullGod', pan: colPan(e.c), play: gullGod };

    case 'egg':
      return {
        key: 'egg',
        pan: colPan(e.c),
        play: (o) =>
          Math.max(
            noise(o, { f: 800, f2: 6000, glide: 0.35, q: 2, a: 0.2, d: 0.15, v: 0.12 }),
            sparkle(o, 7, 0.06),
            metal(o, { dt: 0.3, f: mtof(88), ratios: RATIOS.bell, d: 1.0, v: 0.2 }),
            metal(o, { dt: 0.3, f: mtof(76), ratios: RATIOS.bell, d: 1.2, v: 0.12 }),
          ),
      };

    case 'hour':
      return { key: 'hour', pan: 0.3, play: (o) => clockChime(o, e.hour) };

    // The quota is in the bag: the first bars of the win kazoo, and a ka-ching.
    case 'quotaMet':
      return {
        key: 'quotaMet',
        pan: 0,
        play: (o) =>
          Math.max(
            kazoo(o, [{ dt: 0, dur: 0.12, m: 67 }, { dt: 0.14, dur: 0.12, m: 71 }, { dt: 0.28, dur: 0.45, m: 74 }], 0.3),
            metal(o, { dt: 0.28, f: 2093, ratios: [1, 1.5, 2.0, 2.7], d: 0.8, v: 0.2, bright: 0.8 }),
          ),
      };

    // Endless: another hour survived pays out (the hour chime and a couple of coins).
    case 'milestone':
      return { key: 'milestone', pan: 0.3, play: (o) => Math.max(clockChime(o, e.hour), coin(o, 0.3, 0.2), coin(o, 0.42, 0.18, 1.2)) };

    case 'nightWon':
      return {
        key: 'nightWon',
        pan: 0,
        play: (o) => {
          const tune = [
            { dt: 0, dur: 0.13, m: 67 },
            { dt: 0.15, dur: 0.13, m: 67 },
            { dt: 0.3, dur: 0.13, m: 67 },
            { dt: 0.45, dur: 0.55, m: 72 },
            { dt: 1.05, dur: 0.15, m: 69 },
            { dt: 1.22, dur: 0.15, m: 71 },
            { dt: 1.39, dur: 0.8, m: 72 },
          ];
          const harmony = [
            { dt: 0.45, dur: 0.55, m: 64 },
            { dt: 1.39, dur: 0.8, m: 67 },
          ];
          return Math.max(
            kazoo(o, tune, 0.32),
            kazoo(o, harmony, 0.2),
            tone(o, { dt: 0.45, f: 120, f2: 45, glide: 0.1, d: 0.2, v: 0.4 }),
            tone(o, { dt: 1.39, f: 120, f2: 45, glide: 0.1, d: 0.2, v: 0.4 }),
            noise(o, { dt: 1.39, ft: 'highpass', f: 5000, q: 0.5, d: 1.0, v: 0.14 }),
          );
        },
      };

    case 'nightLost':
      return {
        key: 'nightLost',
        pan: 0,
        play: (o) =>
          trombone(
            o,
            [
              { dt: 0, dur: 0.36, m: 58 },
              { dt: 0.4, dur: 0.36, m: 57 },
              { dt: 0.8, dur: 0.36, m: 56 },
              { dt: 1.2, dur: 1.3, m: 55 },
            ],
            0.3,
          ),
      };

    case 'uiClick':
      return uiSound('click');

    case 'buy':
      return {
        key: 'buy',
        pan: 0,
        play: (o) => {
          // ka-...
          let end = Math.max(
            noise(o, { f: 500, q: 1, d: 0.045, v: 0.35 }),
            tone(o, { f: 160, f2: 90, d: 0.06, v: 0.3 }),
            noise(o, { ft: 'highpass', f: 3000, d: 0.01, v: 0.2 }),
            // ...CHING
            metal(o, { dt: 0.08, f: 2093, ratios: [1, 1.5, 2.0, 2.7], d: 0.8, v: 0.22, bright: 0.8 }),
          );
          for (let i = 0; i < 5; i++) {
            end = Math.max(end, metal(o, { dt: 0.12 + i * rr(0.05, 0.08), f: rr(3200, 4800), ratios: RATIOS.tin, d: 0.05, v: 0.06 }));
          }
          return end;
        },
      };

    default:
      return momentumSound(e) ?? runEventSound(e);
  }
}

export function uiSound(kind: 'hover' | 'click' | 'back'): Sound {
  switch (kind) {
    case 'hover':
      return {
        key: 'ui.hover',
        pan: 0,
        play: (o) => Math.max(tone(o, { f: 1500, f2: 1800, d: 0.02, v: 0.06 }), noise(o, { ft: 'highpass', f: 5000, d: 0.01, v: 0.06 })),
      };
    case 'click':
      // a finger on cardboard
      return {
        key: 'ui.click',
        pan: 0,
        play: (o) => Math.max(noise(o, { f: 1100, q: 1.2, d: 0.035, v: 0.35 }), tone(o, { f: 240, f2: 150, d: 0.045, v: 0.3 })),
      };
    case 'back':
      return {
        key: 'ui.back',
        pan: 0,
        play: (o) => Math.max(tone(o, { type: 'triangle', f: 520, f2: 300, d: 0.08, v: 0.22 }), noise(o, { f: 1100, q: 1.2, d: 0.03, v: 0.25 })),
      };
  }
}
