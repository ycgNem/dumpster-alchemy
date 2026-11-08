// The night clock: 12:00 AM to 6:00 AM, an `hour` event on every hour, and the verdict at 6.
// The goal decides the verdict (src/data/nights.ts): the quota on most nights; on night 10 the
// Trash King, which wins the moment he's built; Endless has no 6 AM and only ends in Stink.
//
// Quota nights: the first time the purse reaches the quota a `quotaMet` event fires and the
// night is secured. From then on every Shiny earned is overtime (`s.overtimeEarned`), and the
// player bets on it: clock out to bank it all at x1 now, or stay to 6 AM and the overtime is paid
// twice (x2). But if the Stink maxes out after the quota, it's still a pass, only the Possum
// confiscates all the overtime: the night banks what the purse held when the quota was met.
import { JUNK_CHAIN } from '../data/items';
import { TUNING } from '../data/tuning';
import type { EndReason, GameState } from './state';

export function updateShift(s: GameState, dt: number): void {
  s.time += dt;
  const { secondsPerHour, hours } = TUNING.shift;
  checkQuota(s);
  if (s.goal === 'king' && kingBuilt(s)) endNight(s, 'king');
  const last = s.goal === 'endless' ? Infinity : hours;
  const h = Math.min(last, Math.floor(s.time / secondsPerHour));
  while (s.hour < h && s.status === 'playing') {
    s.hour++;
    s.events.push({ type: 'hour', hour: s.hour });
    if (s.goal === 'endless') milestone(s);
    else if (s.hour >= hours) endNight(s, goalMet(s) ? 'shift' : 'quota');
  }
}

/**
 * Pay Shinies into the purse (orders, the Crusher, Endless milestones). Past the quota it's
 * overtime. Then checks the quota.
 */
export function earn(s: GameState, n: number): void {
  if (n <= 0) return;
  s.purse += n;
  s.stats.earned += n;
  if (s.goal === 'quota' && s.quotaMetAt !== null) s.overtimeEarned += n;
  checkQuota(s);
}

/** Fires `quotaMet` the first time the purse reaches the quota (quota nights only). */
export function checkQuota(s: GameState): void {
  if (s.goal !== 'quota' || s.quotaMetAt !== null || s.purse < s.quota || s.status !== 'playing') return;
  s.quotaMetAt = s.time;
  s.events.push({ type: 'quotaMet' });
}

/** Endless: every hour on the clock pays a growing bonus. */
function milestone(s: GameState): void {
  const bonus = TUNING.endless.milestonePerHour * s.hour;
  earn(s, bonus);
  s.events.push({ type: 'milestone', hour: s.hour, bonus });
}

/** Has the Trash King been built tonight? */
export function kingBuilt(s: GameState): boolean {
  return s.bestTier >= JUNK_CHAIN.length;
}

/** Is tonight's goal met right now? (Endless never is: it only ends one way.) Once met, a quota stays met. */
export function goalMet(s: GameState): boolean {
  if (s.goal === 'king') return kingBuilt(s);
  if (s.goal === 'endless') return false;
  return s.quotaMetAt !== null || s.purse >= s.quota;
}

/** The player may clock out: a quota night, the quota met, the night still on. */
export function canClockOut(s: GameState): boolean {
  return s.goal === 'quota' && s.status === 'playing' && goalMet(s);
}

/** Clock out: the night ends now as a win, the overtime banked at x1. Does nothing if not allowed. */
export function clockOut(s: GameState): void {
  if (canClockOut(s)) endNight(s, 'clockout');
}

/**
 * The Stink hit the top: a shutdown before the quota; after it, a pass that loses the overtime;
 * the end of Endless.
 */
export function stinkOut(s: GameState): void {
  checkQuota(s);
  if (s.goal === 'endless') endNight(s, 'endless');
  else endNight(s, goalMet(s) ? 'stinkAfterQuota' : 'stink');
}

const WINS: Record<EndReason, boolean> = {
  clockout: true,
  shift: true,
  stinkAfterQuota: true,
  king: true,
  stink: false,
  quota: false,
  endless: false,
};

/** Ends the night for a reason (which decides won or lost). Drops whatever the player was holding. */
export function endNight(s: GameState, reason: EndReason): void {
  if (s.status !== 'playing') return;
  if (reason === 'shift') payOvertime(s);
  else if (reason === 'stinkAfterQuota') loseOvertime(s);
  const won = WINS[reason];
  s.status = won ? 'won' : 'lost';
  s.endReason = reason;
  s.drag = null;
  s.events.push({ type: won ? 'nightWon' : 'nightLost' });
}

/** Made it to 6 AM past the quota: the overtime is paid again (x2 in all). */
function payOvertime(s: GameState): void {
  const bonus = Math.round(s.overtimeEarned * s.mods.overtimeShare);
  if (bonus <= 0) return;
  s.stats.overtimeBonus = bonus;
  s.purse += bonus;
  s.stats.earned += bonus;
}

/** The Stink maxed after the quota: the Possum confiscates the overtime (the purse goes back to the quota-met purse). */
function loseOvertime(s: GameState): void {
  const lost = Math.min(s.purse, s.overtimeEarned);
  if (lost <= 0) return;
  s.stats.overtimeLost = lost;
  s.purse -= lost;
  s.stats.earned -= lost;
}

/** "3:07 AM" style clock for the HUD (Endless runs on into the morning). */
export function clockText(s: GameState): string {
  const mins = Math.floor((s.time / TUNING.shift.secondsPerHour) * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${Math.floor(h / 12) % 2 === 0 ? 'AM' : 'PM'}`;
}
