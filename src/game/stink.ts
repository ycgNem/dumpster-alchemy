// Stink: the lot itself is the pressure, all night. Junk ripens: a piece left unmerged for a
// while (shorter for bigger junk, twice as fast in a Heat Wave) goes smelly and adds Stink every
// second until it's merged (a merge makes a fresh piece), delivered or crushed. A crowded lot
// adds a little more, junk with no room to land and raccoons storming off add a lump. The Stink
// fades while the lot has room; the Air Freshener cuts every gain and speeds the fade. At the
// night's limit (100; 75 on The Inspection) Inspector Possum shuts the night down (after the
// quota it's still a pass, but the overtime is lost: see shift.ts).
import { ITEMS } from '../data/items';
import { TUNING } from '../data/tuning';
import type { Piece } from './board';
import { forgiveShutdown } from './perks';
import { stinkOut } from './shift';
import type { GameState } from './state';

export type StinkCause = 'overflow' | 'angry' | 'crowding' | 'smelly';

/** The Stink at which the Possum shuts the lot (100; The Inspection: 75). Draw the jar against this. */
export function stinkLimit(s: GameState): number {
  return s.mods.stinkMax;
}

/** The Stink at which the Possum walks on as a warning (25 under the limit: 75, or 50 on The Inspection). */
export function stinkWarnAt(s: GameState): number {
  const t = TUNING.stink;
  return s.mods.stinkMax - (t.max - t.warnAt);
}

/** Seconds an unmerged piece of this junk takes to go smelly tonight (Infinity: it never does). */
export function ripenSec(s: GameState, id: Piece['id']): number {
  const d = ITEMS[id];
  if (d.chain !== 'junk') return Infinity;
  const t = TUNING.stink;
  return Math.max(t.ripenMinSec, t.ripenSec - t.ripenPerTierSec * (d.tier - 1)) * s.mods.ripenMul;
}

/** Old enough to stink: draw fumes and flies on it. Only junk ripens (not gulls, eggs or Bin Juice). */
export function isSmelly(s: GameState, p: Piece): boolean {
  return s.time - p.born >= ripenSec(s, p.id);
}

/** How ripe a piece is, 0 (fresh) to 1 (smelly), for a renderer that wants to warn early. */
export function ripeness(s: GameState, p: Piece): number {
  const r = ripenSec(s, p.id);
  return r === Infinity ? 0 : Math.max(0, Math.min(1, (s.time - p.born) / r));
}

/** Stink per second one smelly piece adds (before the night's and the Freshener's gain mul). */
function smellOf(id: Piece['id']): number {
  const t = TUNING.stink;
  return t.smellPerSec + t.smellPerTier * (Math.min(ITEMS[id].tier, t.smellTierCap) - 1);
}

/** Add Stink (scaled by stinkGainMul) and note where it came from. */
export function addStink(s: GameState, n: number, cause?: StinkCause): void {
  const gain = n > 0 ? n * s.mods.stinkGainMul : n;
  const before = s.stink;
  s.stink = Math.max(0, Math.min(stinkLimit(s), s.stink + gain));
  if (cause && s.stink > before) s.stats.stinkFrom[cause] += s.stink - before;
  checkStink(s);
}

/** Stink per second right now from a crowded lot (0 under the creep line), before the gain mul. */
export function crowdingPerSec(fill: number): number {
  const t = TUNING.stink;
  if (fill <= t.creepAboveFill) return 0;
  const k = Math.min(1, (fill - t.creepAboveFill) / (1 - t.creepAboveFill));
  return t.creepPerSec + (t.creepPerSecFull - t.creepPerSec) * k;
}

/** Stink fade per second right now (0 on a crowded lot, unless the Air Freshener is in). */
export function decayPerSec(s: GameState, fill: number): number {
  const t = TUNING.stink;
  // The Air Freshener's extra (stinkDecayMul above 1) keeps working when the lot is full too.
  const mul = fill < t.decayBelowFill ? s.mods.stinkDecayMul : Math.max(0, s.mods.stinkDecayMul - 1);
  const fast = fill < t.fastDecayBelowFill ? t.fastDecayMul : 1;
  return t.decayPerSec * mul * fast;
}

/** Stink per second the smelly junk adds right now (after the gain mul). */
export function smellyPerSec(s: GameState): number {
  let n = 0;
  for (const { p } of s.board.pieces()) if (isSmelly(s, p)) n += smellOf(p.id);
  return n * s.mods.stinkGainMul;
}

/** Every per-second Stink gain right now: smelly junk plus a crowded lot (after the gain mul). */
export function smellGain(s: GameState): number {
  return smellyPerSec(s) + crowdingPerSec(s.board.fillRatio()) * s.mods.stinkGainMul;
}

/**
 * Stink per second the lot adds right now, net of the fade (for the HUD's arrow): above 0 it's
 * rising, below 0 it's falling, 0 when nothing moves (an empty jar never "falls"). Overflows and
 * storm-offs come in lumps and aren't counted.
 */
export function smellRate(s: GameState): number {
  const fill = s.board.fillRatio();
  const net = smellGain(s) - decayPerSec(s, fill);
  return s.stink <= 0 && net < 0 ? 0 : net;
}

export function updateStink(s: GameState, dt: number): void {
  const fill = s.board.fillRatio();
  // Smelly junk: each piece ripens once (a `ripen` event), then stinks every second.
  let smell = 0;
  const alive = new Set<number>();
  for (const { p, c, r } of s.board.pieces()) {
    if (!isSmelly(s, p)) continue;
    alive.add(p.uid);
    smell += smellOf(p.id);
    if (!s.ripe.has(p.uid)) {
      s.ripe.add(p.uid);
      s.events.push({ type: 'ripen', id: p.id, c, r });
    }
  }
  for (const uid of s.ripe) if (!alive.has(uid)) s.ripe.delete(uid);
  if (smell > 0) addStink(s, smell * dt, 'smelly');
  const creep = crowdingPerSec(fill);
  if (creep > 0) addStink(s, creep * dt, 'crowding');
  const fade = decayPerSec(s, fill);
  if (fade > 0) s.stink = Math.max(0, s.stink - fade * dt);
  checkStink(s);
}

function checkStink(s: GameState): void {
  const t = TUNING.stink;
  const warn = stinkWarnAt(s);
  s.stats.peakStink = Math.max(s.stats.peakStink, s.stink);
  if (!s.stinkWarned && s.stink >= warn) {
    s.stinkWarned = true;
    s.events.push({ type: 'stinkWarn' });
  } else if (s.stinkWarned && s.stink < warn - (t.warnAt - t.warnRearm)) {
    s.stinkWarned = false;
  }
  // (The Possum Bribe forgives one shutdown: src/game/perks.ts.)
  if (s.stink >= stinkLimit(s) && s.status === 'playing' && !forgiveShutdown(s)) stinkOut(s);
}
