// Sound for Dumpster Alchemy (docs/ARCHITECTURE.md, "Audio API"). Everything is synthesised with
// WebAudio, no files: the effects are in sfx.ts and voices.ts, the songs in music.ts, the buses
// and limiter in engine.ts, the building blocks in synth.ts. These signatures are the contract.
//
// Wiring: call initAudio() from the first pointer/key gesture (it's safe to call on every one),
// playEvent() for each event once per frame, setIntensity() whenever stink / board fill changes
// (every frame is fine), setMusic() on scene changes.
import type { GameEvent } from '../game/events';
import { buildChain, type Chain } from './engine';
import { MusicPlayer, type TrackId } from './music';
import { runSound, type RunKind } from './run';
import { eventSound, remember, startSound, uiSound, type Sound } from './sfx';
import { clamp } from './synth';

let ctx: AudioContext | null = null;
let chain: Chain | null = null;
let music: MusicPlayer | null = null;
let muted = false;
let wantTrack: TrackId | null = null;
let intensity = 0;

/** Most sound voices alive at once; past this the oldest is faded out. */
const MAX_VOICES = 24;
/** At most RATE_MAX sounds of one kind start within RATE_WINDOW seconds. */
const RATE_WINDOW = 0.06;
const RATE_MAX = 3;

interface LiveVoice {
  end: number;
  gain: GainNode;
}
const live: LiveVoice[] = [];
const recent = new Map<string, number[]>();

// Dev only: a peek at the mixer for the audio lab and console poking (stripped from builds).
declare global {
  interface Window {
    __audioDebug?: () => { state: string; live: number; time: number; muted: boolean };
  }
}
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__audioDebug = () => {
    const now = ctx?.currentTime ?? 0;
    return { state: ctx?.state ?? 'none', live: live.filter((v) => v.end >= now).length, time: now, muted };
  };
}

export function initAudio(): void {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    try {
      ctx = new AudioContext({ latencyHint: 'interactive' });
    } catch {
      return;
    }
    chain = buildChain(ctx);
    chain.mute.gain.value = muted ? 0 : 1;
    music = new MusicPlayer(ctx, chain.music);
    music.muted = muted;
    music.setIntensity(intensity);
    if (wantTrack) music.set(wantTrack);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
}

function play(sound: Sound | null): void {
  if (!sound || !ctx || !chain || muted || ctx.state === 'closed') return;
  const now = ctx.currentTime;

  const times = (recent.get(sound.key) ?? []).filter((t) => now - t < RATE_WINDOW);
  if (times.length >= RATE_MAX) {
    recent.set(sound.key, times);
    return;
  }
  times.push(now);
  recent.set(sound.key, times);

  for (let i = live.length - 1; i >= 0; i--) if (live[i].end < now) live.splice(i, 1);
  while (live.length >= MAX_VOICES) {
    const old = live.shift();
    if (old) old.gain.gain.setTargetAtTime(0, now, 0.012);
  }

  const v = startSound({ ctx, dest: chain.sfx, t: now + 0.005 }, sound);
  live.push({ end: v.end, gain: v.gain });
  window.setTimeout(() => {
    v.gain.disconnect();
    v.out.disconnect();
  }, (v.end - now + 0.5) * 1000);
}

export function playEvent(e: GameEvent): void {
  remember(e);
  // The Raccoon Rave drives the music (double-time and the rave layer) even while muted.
  if (e.type === 'feverStart') music?.setFever(true);
  else if (e.type === 'feverEnd' || e.type === 'nightWon' || e.type === 'nightLost') music?.setFever(false);
  if (!ctx || muted) return;
  play(eventSound(e));
}

export function playUi(kind: 'hover' | 'click' | 'back'): void {
  if (!ctx || muted) return;
  play(uiSound(kind));
}

/** A run-flow sound a scene makes itself (Contraband picks, the map, strikes, the run's end). */
export function playRun(kind: RunKind): void {
  if (!ctx || muted) return;
  play(runSound(kind));
}

export function setMuted(m: boolean): void {
  muted = m;
  if (ctx && chain) chain.mute.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.02);
  if (music) music.muted = m;
}

export function isMuted(): boolean {
  return muted;
}

export function setMusic(track: 'title' | 'night' | 'report' | null): void {
  wantTrack = track;
  // A new scene (or a new night) starts with no Rave going.
  music?.setFever(false);
  music?.set(track);
}

export function setIntensity(x: number): void {
  intensity = clamp(Number.isFinite(x) ? x : 0, 0, 1);
  music?.setIntensity(intensity);
}
