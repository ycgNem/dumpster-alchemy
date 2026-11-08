// The campaign sim: a bot plays the ten nights in order the way a player would. It shops the
// Swap Meet between nights (a level of whatever shines on tonight's rule first, then the cheapest
// upgrade it can afford, again and again; then one Bin Juice before a retry, as many as it can
// carry before night 10), retries lost nights, and on
// night 10 a "builder" bot takes over (or the greedy order-feeding bot, with `greedy10`). Then one
// Endless shift for a score.
//
//   npm run sim -- campaign                 20 runs each at 1.0, 1.3 and 1.8 s per action
//   npm run sim -- campaign 50 0.8          50 runs with a 0.8 s bot
//   npm run sim -- campaign 20 1.0 1.3 1.8  several speeds
//   npm run sim -- campaign 20 1.3 greedy10 night 10 played by the order-feeding bot
//   npm run sim -- campaign 20 1.8 eager    the bot clocks out the moment the quota is met
//   npm run sim -- campaign 20 1.8 stay     the bot never clocks out (always bets on overtime)
//   npm run sim -- campaign 20 1.8 probe    also print what purse each night's first try could reach
import { NIGHTS, nightDef } from '../data/nights';
import { UPGRADES } from '../data/upgrades';
import { buyJuice, canBuy, finishNight, newRun, priceOf, startNight, type Run } from '../game/run';
import type { GameState } from '../game/state';
import { step } from '../game/step';
import { Bot, BOT_DEFAULT, type BotOpts } from './bot';
import { Builder, BUILDER_DEFAULT } from './builder';

const DT = 1 / 60;
/** A run that fails one night this many times in a row is stuck (a player would give up). */
const MAX_TRIES = 6;

interface Player {
  update(s: GameState, dt: number): void;
}

interface Try {
  night: number;
  won: boolean;
  reason: GameState['endReason'];
  purse: number;
  bankBefore: number;
  levels: number;
  peakStink: number;
  bestTier: number;
  metAt: number | null;
  /** When the night ended (seconds after midnight). */
  endAt: number;
  overtime: number;
  /** Overtime confiscated by a Stink-out after the quota. */
  overtimeLost: number;
  jackpots: number;
  /** Shinies the jackpot paid, as a share of the quota. */
  jackpotShare: number;
  /** The longest stretch with no income (seconds) before the night ended. */
  flat: number;
  /** Average Stink over the night, and the share of Stink gained from smelly junk. */
  stinkAvg: number;
  smellyShare: number;
  scraps: number;
  juice: number;
  /** `probe` runs only: the most this try could have had in the purse before the night ended (no quota), and when it ended. */
  potential: number;
  potentialEnd: number;
}

interface Played {
  jackpotPay: number;
  flat: number;
  stinkAvg: number;
}

interface Campaign {
  tries: Try[];
  crowned: boolean;
  stuckAt: number | null;
  endless: number;
  endlessHours: number;
  bankEnd: number;
  levelsEnd: number;
}

export interface CampaignOpts {
  /** Night 10 with the order-feeding bot instead of the builder. */
  greedy10: boolean;
  bot: Partial<BotOpts>;
  /**
   * Before each try, replay the same night (same seed) with a bot that never clocks out and note
   * the highest purse before it ended: the purse a quota could ask for (prints quantiles).
   */
  probe: boolean;
}

/** The most the purse held during a replay of tonight that never clocks out (overtime pay left out). */
function probe(run: Run, botOpts: BotOpts): [number, number] {
  const s = startNight(run);
  const bot = new Bot({ ...botOpts, clockOutAt: 2, clockOutAhead: 2 });
  let best = 0;
  while (s.status === 'playing') {
    bot.update(s, DT);
    step(s, DT);
    s.events.length = 0;
    if (s.status === 'playing') best = Math.max(best, s.purse);
  }
  return [best, s.time];
}

function play(s: GameState, p: Player): Played {
  let jackpotPay = 0;
  let lastPay = 0;
  let flat = 0;
  let stinkSum = 0;
  let n = 0;
  while (s.status === 'playing') {
    p.update(s, DT);
    step(s, DT);
    for (const e of s.events) {
      if (e.type !== 'deliver' || e.shinies <= 0) continue;
      if (e.jackpot) jackpotPay += e.shinies;
      flat = Math.max(flat, s.time - lastPay);
      lastPay = s.time;
    }
    s.events.length = 0;
    stinkSum += s.stink;
    n++;
  }
  flat = Math.max(flat, s.time - lastPay);
  return { jackpotPay, flat, stinkAvg: stinkSum / Math.max(1, n) };
}

function levelsBought(run: Run): number {
  return UPGRADES.reduce((a, u) => a + run.levels[u.id], 0);
}

/**
 * The next level of an upgrade that shines tonight (if it's affordable); then the cheapest
 * affordable upgrade until nothing is affordable; then, before a retry, one Bin Juice if there's
 * money left (and as many as it can carry before night 10).
 */
function shop(run: Run): void {
  for (const u of UPGRADES) {
    if (u.shines.includes(run.night) && canBuy(run, u.id)) {
      run.bank -= priceOf(run, u.id) ?? 0;
      run.levels[u.id]++;
    }
  }
  for (;;) {
    const can = UPGRADES.filter((u) => canBuy(run, u.id)).sort((a, b) => (priceOf(run, a.id) ?? 0) - (priceOf(run, b.id) ?? 0));
    const u = can[0];
    if (!u) break;
    if (!canBuy(run, u.id)) break;
    run.bank -= priceOf(run, u.id) ?? 0;
    run.levels[u.id]++;
  }
  if (run.tries > 0 && run.binJuice === 0) buyJuice(run);
  if (nightDef(run.night).goal === 'king') while (buyJuice(run));
}

function campaign(seed: number, thinkSec: number, o: CampaignOpts): Campaign {
  const run = newRun(seed);
  const out: Campaign = { tries: [], crowned: false, stuckAt: null, endless: 0, endlessHours: 0, bankEnd: 0, levelsEnd: 0 };
  const botOpts: BotOpts = { ...BOT_DEFAULT, ...o.bot, thinkSec };
  while (!run.crowned) {
    if (run.tries >= MAX_TRIES) {
      out.stuckAt = run.night;
      break;
    }
    shop(run);
    const def = nightDef(run.night);
    const bankBefore = run.bank;
    const levels = levelsBought(run);
    const juice = run.binJuice;
    const [potential, potentialEnd] = o.probe && def.goal === 'quota' ? probe(run, botOpts) : [0, 0];
    const s = startNight(run);
    const p: Player = def.goal === 'king' && !o.greedy10 ? new Builder({ ...BUILDER_DEFAULT, thinkSec }) : new Bot(botOpts);
    const pl = play(s, p);
    const res = finishNight(run, s);
    const from = res.stats.stinkFrom;
    const gained = from.overflow + from.angry + from.crowding + from.smelly;
    out.tries.push({
      night: res.night,
      won: res.won,
      reason: res.endReason,
      purse: res.purse,
      bankBefore,
      levels,
      peakStink: res.stats.peakStink,
      bestTier: res.bestTier,
      metAt: s.quotaMetAt,
      endAt: s.time,
      overtime: res.stats.overtimeBonus,
      overtimeLost: res.stats.overtimeLost,
      jackpots: res.stats.jackpots,
      jackpotShare: res.quota > 0 ? pl.jackpotPay / res.quota : 0,
      flat: pl.flat,
      stinkAvg: pl.stinkAvg,
      smellyShare: gained > 0 ? from.smelly / gained : 0,
      scraps: res.stats.scraps,
      juice,
      potential,
      potentialEnd,
    });
  }
  out.crowned = run.crowned;
  out.levelsEnd = levelsBought(run);
  if (run.crowned) {
    shop(run);
    const s = startNight(run);
    play(s, new Bot(botOpts));
    out.endless = s.purse;
    out.endlessHours = s.time / 60;
    finishNight(run, s);
  }
  out.bankEnd = run.bank;
  return out;
}

function pad(v: string | number, n: number): string {
  return String(v).padStart(n);
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const v = [...xs].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)] ?? null;
}

function clock(sec: number | null): string {
  if (sec === null) return '-';
  const mins = Math.floor(sec);
  const h = Math.floor(mins / 60);
  return `${h === 0 ? 12 : h}:${String(mins % 60).padStart(2, '0')}`;
}

function profile(runs: number, thinkSec: number, o: CampaignOpts): void {
  const all: Campaign[] = [];
  for (let i = 1; i <= runs; i++) all.push(campaign(i * 7919 + Math.round(thinkSec * 1000), thinkSec, o));
  const n10 = o.greedy10 ? 'the order-feeding bot' : 'the builder bot';
  console.log(`\n== campaign: ${runs} runs, one action every ${thinkSec}s (night 10: ${n10}) ==`);
  console.log(
    ' night  name              quota  reached  1st-try  win/try  tries/clear  purse avg  bank@start  levels  stink  lost s/q  met@ (med)  end@ (med)  clockout  overtime  jackpot  best' +
      '  jp/quota  flat(med)  stink avg  smelly%  OT lost  scraps',
  );
  for (const n of NIGHTS) {
    const t = all.flatMap((c) => c.tries.filter((x) => x.night === n.night));
    const first = all.map((c) => c.tries.find((x) => x.night === n.night)).filter((x): x is Try => x !== undefined);
    const reached = first.length;
    const cleared = all.filter((c) => c.tries.some((x) => x.night === n.night && x.won)).length;
    const wins = t.filter((x) => x.won);
    const lostStink = t.filter((x) => !x.won && x.reason === 'stink').length;
    const lostQuota = t.filter((x) => !x.won && x.reason !== 'stink').length;
    const met = median(t.filter((x) => x.metAt !== null).map((x) => x.metAt ?? 0));
    const endAt = median(wins.map((x) => x.endAt));
    const clockouts = wins.filter((x) => x.reason === 'clockout').length;
    console.log(
      `${pad(n.night, 6)}  ${n.name.padEnd(16)}${pad(n.goal === 'king' ? 'KING' : n.quota, 6)}  ${pad(reached, 7)}` +
        `  ${pad(reached ? pct(first.filter((x) => x.won).length / reached) : '-', 7)}  ${pad(t.length ? pct(wins.length / t.length) : '-', 7)}` +
        `  ${pad(cleared ? (t.length / cleared).toFixed(2) : '-', 11)}  ${pad(Math.round(avg(t.map((x) => x.purse))), 9)}` +
        `  ${pad(Math.round(avg(first.map((x) => x.bankBefore))), 10)}  ${pad(avg(first.map((x) => x.levels)).toFixed(1), 6)}` +
        `  ${pad(Math.round(avg(t.map((x) => x.peakStink))), 5)}  ${pad(`${lostStink}/${lostQuota}`, 8)}` +
        `  ${pad(clock(met), 10)}  ${pad(clock(endAt), 10)}  ${pad(wins.length ? pct(clockouts / wins.length) : '-', 8)}` +
        `  ${pad(Math.round(avg(wins.map((x) => x.overtime))), 8)}  ${pad(t.length ? pct(avg(t.map((x) => x.jackpots))) : '-', 7)}` +
        `  ${pad(avg(t.map((x) => x.bestTier)).toFixed(1), 4)}` +
        `  ${pad(pct(avg(t.map((x) => x.jackpotShare))), 8)}  ${pad(Math.round(median(t.map((x) => x.flat)) ?? 0), 9)}` +
        `  ${pad(Math.round(avg(t.map((x) => x.stinkAvg))), 9)}  ${pad(pct(avg(t.map((x) => x.smellyShare))), 7)}` +
        `  ${pad(t.filter((x) => x.overtimeLost > 0).length, 7)}  ${pad(avg(t.map((x) => x.scraps)).toFixed(1), 6)}`,
    );
  }
  if (o.probe) {
    console.log('  probe: the purse each first try could reach (no quota, never clocks out): quantiles 10/25/50/75/90%, and when the Stink ended it (median)');
    for (const n of NIGHTS) {
      const xs = all.map((c) => c.tries.find((x) => x.night === n.night)?.potential).filter((x): x is number => x !== undefined && x > 0).sort((a, b) => a - b);
      if (xs.length === 0) continue;
      const q = (f: number): number => xs[Math.min(xs.length - 1, Math.floor(f * xs.length))] ?? 0;
      const ends = all.map((c) => c.tries.find((x) => x.night === n.night)?.potentialEnd ?? 0).filter((x) => x > 0);
      const early = ends.filter((x) => x < 359).length;
      console.log(
        `  ${pad(n.night, 4)}  ${n.name.padEnd(16)} ${[0.1, 0.25, 0.5, 0.75, 0.9].map((f) => pad(q(f), 6)).join(' ')}` +
          `   stinks out ${pad(pct(early / Math.max(1, ends.length)), 4)}, ends ${clock(median(ends))}`,
      );
    }
  }
  const losses = all.flatMap((c) => c.tries.filter((x) => !x.won && x.night <= 9));
  const stinkLosses = losses.filter((x) => x.reason === 'stink').length;
  console.log(`  losses nights 1-9: ${losses.length} (${losses.length ? pct(stinkLosses / losses.length) : '-'} to Stink)`);
  const crowned = all.filter((c) => c.crowned);
  const stuck = all.filter((c) => c.stuckAt !== null).map((c) => c.stuckAt);
  const stuckAt = new Map<number, number>();
  for (const k of stuck) if (k !== null) stuckAt.set(k, (stuckAt.get(k) ?? 0) + 1);
  const total = UPGRADES.reduce((a, u) => a + u.prices.length, 0);
  console.log(
    `  CROWNED ${crowned.length}/${runs} (${pct(crowned.length / runs)})` +
      `  stuck (${MAX_TRIES} tries): ${stuck.length ? [...stuckAt].map(([k, m]) => `night ${k} x${m}`).join(', ') : 'none'}` +
      `  | nights played per crowned run ${crowned.length ? avg(crowned.map((c) => c.tries.length)).toFixed(1) : '-'}` +
      `  | levels at night 10 ${avg(all.map((c) => c.tries.find((x) => x.night === 10)?.levels ?? c.levelsEnd)).toFixed(1)}/${total}` +
      `  | Endless score ${crowned.length ? Math.round(avg(crowned.map((c) => c.endless))) : '-'}` +
      ` (ends ${crowned.length ? clock(avg(crowned.map((c) => c.endlessHours * 60))) : '-'})`,
  );
}

export function runCampaign(args: string[]): void {
  const flags = new Set(args.filter((a) => /^[a-z]/i.test(a)));
  const nums = args.filter((a) => !/^[a-z]/i.test(a));
  const runs = Number(nums[0] ?? 20) || 20;
  // Any number of speeds (`campaign 20 {1.0,1.3,1.8}` in bash passes all three).
  const speeds = nums.slice(1).map(Number).filter((x) => x > 0);
  const o: CampaignOpts = {
    greedy10: flags.has('greedy10'),
    bot: flags.has('eager') ? { clockOutAt: 0 } : flags.has('stay') ? { clockOutAt: 2, clockOutAhead: 2 } : {},
    probe: flags.has('probe'),
  };
  for (const t of speeds.length > 0 ? speeds : [1.0, 1.3, 1.8]) profile(runs, t, o);
}
