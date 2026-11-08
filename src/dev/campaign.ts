// The run sim: a bot plays whole runs the way a player would (docs/V2.md "The run"). It picks a
// random fork on the map, takes the best loot card by a simple greedy value table, shops greedily
// (the best Contraband it can afford while a slot is free, Bin Juice before a boss or a retry),
// retries strikes, and on night 10 a "builder" bot takes over (or the greedy order-feeding bot,
// with `greedy10`). Three strikes and it's FIRED; the King wins the run.
//
//   npm run sim -- campaign                     20 runs each at 1.3, 1.8 and 2.5 s per action
//   npm run sim -- campaign 50 1.8              50 runs with a 1.8 s bot
//   npm run sim -- campaign 20 1.3 1.8 2.5      several speeds
//   npm run sim -- campaign 20 1.8 greedy10     night 10 played by the order-feeding bot
//   npm run sim -- campaign 20 1.8 all          every Contraband unlocked (a veteran's pool)
//   npm run sim -- campaign 20 1.8 bare         never takes or buys Contraband (the baseline)
//   npm run sim -- campaign 20 1.8 rules        also print the first-try pass rate by rule
//   npm run sim -- campaign 20 1.8 detail       also print the lot (fill), when the quota is met, and income by hour
import { MILESTONES, type ContrabandId } from '../data/contraband';
import { NIGHT_COUNT, RULES, type RuleId } from '../data/nights';
import { TUNING } from '../data/tuning';
import { Rng } from '../engine/rng';
import { newMeta, type Meta } from '../game/meta';
import {
  buy,
  canBuy,
  currentNight,
  finishNight,
  leaveMap,
  leaveShop,
  lootOffer,
  newRun,
  openShop,
  pickFork,
  needsPick,
  skipLoot,
  startNight,
  takeLoot,
  type Run,
} from '../game/run';
import type { GameState } from '../game/state';
import { step } from '../game/step';
import { Bot, BOT_DEFAULT, type BotOpts } from './bot';
import { Builder, BUILDER_DEFAULT } from './builder';

const DT = 1 / 60;

interface Player {
  update(s: GameState, dt: number): void;
}

/** How much the bot likes each Contraband (a rough greedy value; a player would do better). */
const VALUE: Record<ContrabandId, number> = {
  bribe: 9,
  mafia: 8,
  ratrace: 7,
  sticky: 7,
  junkmail: 6,
  freshener: 5,
  pyramid: 5,
  spender: 5,
  compost: 5,
  chaingang: 5,
  streaker: 5,
  biglid: 4,
  snack: 4,
  crusherpro: 4,
  hotsauce: 4,
  whisperer: 4,
  recycler: 3,
  doublebag: 3,
  owl: 3,
  junkie: 3,
  flyfarm: 3,
  apron: 3,
  goose: 2,
  clearance: 2,
  recipecard: 1,
};

interface Try {
  night: number;
  rule: RuleId;
  first: boolean;
  won: boolean;
  reason: GameState['endReason'];
  purse: number;
  quota: number;
  peakStink: number;
  perks: number;
  /** What the night earned before 6 AM's overtime pay (what the quota is measured against). */
  pre: number;
  /** The lot: average and highest fill, 0..1. */
  fillAvg: number;
  fillMax: number;
  /** Seconds after midnight the quota was met, or null. */
  metAt: number | null;
  /** Shinies earned in each in-game hour (before the 6 AM overtime pay). */
  hourly: number[];
  /** Shinies from the jackpot and night 1's fallen tire (the bonuses). */
  bonus: number;
  /** Where the Stink came from (overflow, angry, crowding, smelly). */
  from: GameState['stats']['stinkFrom'];
}

/** What a night looked like while it played (the `detail` table). */
interface Watch {
  fillAvg: number;
  fillMax: number;
  hourly: number[];
  bonus: number;
}

interface RunOut {
  won: boolean;
  /** The night it ended on (the King's night for a win). */
  reached: number;
  strikes: number;
  tries: Try[];
  bankEnd: number;
  perksEnd: number;
}

export interface CampaignOpts {
  greedy10: boolean;
  bot: Partial<BotOpts>;
  /** Every Contraband unlocked. */
  all: boolean;
  /** No Contraband at all. */
  bare: boolean;
  rules: boolean;
  detail: boolean;
}

/** The weakest slot, for a swap-in. */
function weakest(run: Run): number {
  let k = -1;
  let v = Infinity;
  run.slots.forEach((id, i) => {
    if (VALUE[id] < v) {
      v = VALUE[id];
      k = i;
    }
  });
  return k;
}

function lootPolicy(run: Run, meta: Meta, o: CampaignOpts): void {
  while (run.stage === 'loot' && run.loot > 0) {
    const offer = lootOffer(run, meta);
    const best = [...offer].sort((a, b) => VALUE[b] - VALUE[a])[0];
    if (o.bare || !best) {
      skipLoot(run);
      continue;
    }
    if (run.slots.length < run.maxSlots) takeLoot(run, best);
    else {
      const w = weakest(run);
      const wid = run.slots[w];
      if (wid && VALUE[best] > VALUE[wid]) takeLoot(run, best, w);
      else skipLoot(run);
    }
  }
}

function shopPolicy(run: Run, meta: Meta, o: CampaignOpts): void {
  const shop = openShop(run, meta);
  if (!o.bare) {
    // The best Contraband it can afford while a slot is free.
    const perks = shop.items.filter((it) => it.kind === 'perk').sort((a, b) => (b.kind === 'perk' ? VALUE[b.id] : 0) - (a.kind === 'perk' ? VALUE[a.id] : 0));
    for (const it of perks) if (canBuy(run, it) === 'ok') buy(run, it);
  }
  // Bin Juice before a boss night or a retry (and with money to spare).
  const next = currentNight(run);
  const juice = shop.items.find((it) => it.kind === 'juice');
  if (juice && (next.boss || run.tries > 0)) while (canBuy(run, juice) === 'ok') buy(run, juice);
  leaveShop(run);
}

function playNight(s: GameState, p: Player): Watch {
  let sum = 0;
  let n = 0;
  let max = 0;
  let bonus = 0;
  const hourly: number[] = [];
  let mark = 0;
  const H = TUNING.shift.secondsPerHour;
  while (s.status === 'playing') {
    p.update(s, DT);
    step(s, DT);
    for (const e of s.events) if (e.type === 'deliver' && (e.jackpot || (s.night === 1 && e.id === 'tire'))) bonus += e.shinies;
    s.events.length = 0;
    const f = s.board.fillRatio();
    sum += f;
    n++;
    max = Math.max(max, f);
    if (s.time >= (hourly.length + 1) * H && hourly.length < TUNING.shift.hours) {
      // (The 6 AM overtime pay isn't the last hour's income.)
      const e = s.stats.earned - s.stats.overtimeBonus;
      hourly.push(e - mark);
      mark = e;
    }
  }
  return { fillAvg: sum / Math.max(1, n), fillMax: max, hourly, bonus };
}

function oneRun(seed: number, thinkSec: number, o: CampaignOpts): RunOut {
  const meta = newMeta();
  if (o.all) meta.milestones = MILESTONES.map((m) => m.id);
  const run = newRun(seed, meta, 'gary');
  if (o.bare) run.slots = [];
  const rng = new Rng(seed ^ 0x5eed);
  const botOpts: BotOpts = { ...BOT_DEFAULT, ...o.bot, thinkSec };
  const out: RunOut = { won: false, reached: 1, strikes: 0, tries: [], bankEnd: 0, perksEnd: 0 };
  let guard = 0;
  while (!run.over && guard++ < 60) {
    if (run.stage === 'loot') lootPolicy(run, meta, o);
    if (run.stage === 'shop') shopPolicy(run, meta, o);
    if (run.stage === 'map') {
      if (needsPick(run)) pickFork(run, rng.int(2));
      leaveMap(run);
    }
    // A retry goes by the Swap Meet first if there's money for Bin Juice.
    if (run.tries > 0 && run.stage === 'card' && run.bank >= TUNING.run.juicePrice && run.binJuice === 0) shopPolicy(run, meta, o);
    const def = currentNight(run);
    const s = startNight(run);
    const p: Player = def.goal === 'king' && !o.greedy10 ? new Builder({ ...BUILDER_DEFAULT, thinkSec }) : new Bot(botOpts);
    const first = run.tries === 0;
    const perks = run.slots.length;
    const w = playNight(s, p);
    const res = finishNight(run, s);
    out.tries.push({
      night: res.night,
      rule: def.id,
      first,
      won: res.won,
      reason: res.endReason,
      purse: res.purse,
      quota: res.quota,
      peakStink: res.stats.peakStink,
      perks,
      pre: res.purse - res.stats.overtimeBonus + res.stats.overtimeLost,
      fillAvg: w.fillAvg,
      fillMax: w.fillMax,
      metAt: res.quotaMetAt,
      hourly: w.hourly,
      bonus: w.bonus,
      from: { ...res.stats.stinkFrom },
    });
    out.reached = res.night;
  }
  out.won = run.over === 'won';
  out.strikes = run.strikes;
  out.bankEnd = run.bank;
  out.perksEnd = run.slots.length;
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

function quantile(xs: number[], q: number): number {
  const v = [...xs].sort((a, b) => a - b);
  return Math.round(v[Math.min(v.length - 1, Math.floor(q * v.length))] ?? 0);
}

function profile(runs: number, thinkSec: number, o: CampaignOpts): void {
  const all: RunOut[] = [];
  for (let i = 1; i <= runs; i++) all.push(oneRun(i * 7919 + Math.round(thinkSec * 1000), thinkSec, o));
  const won = all.filter((r) => r.won).length;
  const flags = [o.all ? 'all unlocked' : 'first-run pool', o.bare ? 'NO Contraband' : '', o.greedy10 ? 'night 10: order bot' : 'night 10: builder'].filter(Boolean).join(', ');
  console.log(`\n== runs: ${runs}, one action every ${thinkSec}s (${flags}) ==`);
  console.log(
    `  RUN WIN ${won}/${runs} (${pct(won / runs)})  night reached ${avg(all.map((r) => r.reached)).toFixed(1)}` +
      `  strikes ${avg(all.map((r) => r.strikes)).toFixed(2)}  fired ${all.filter((r) => !r.won).length}` +
      `  | Contraband at the end ${avg(all.map((r) => r.perksEnd)).toFixed(1)}  bank at the end ${Math.round(avg(all.map((r) => r.bankEnd)))}`,
  );
  console.log(' night  1st-try   played  win/try  quota avg  purse avg  purse/quota  peak stink  lost s/q  perks   earned by 6 AM p10/p25/p50/p75 (no overtime pay)');
  for (let n = 1; n <= NIGHT_COUNT; n++) {
    const t = all.flatMap((r) => r.tries.filter((x) => x.night === n));
    const first = t.filter((x) => x.first);
    if (t.length === 0) {
      console.log(`${pad(n, 6)}        -        0`);
      continue;
    }
    const wins = t.filter((x) => x.won).length;
    const firstWins = first.filter((x) => x.won).length;
    const ratio = avg(t.filter((x) => x.quota > 0).map((x) => x.purse / x.quota));
    const lostS = t.filter((x) => !x.won && x.reason === 'stink').length;
    const lostQ = t.filter((x) => !x.won && x.reason !== 'stink').length;
    const boss = n === 4 || n === 7 || n === 10 ? ' (boss)' : '';
    console.log(
      `${pad(n, 6)}  ${pad(first.length ? pct(firstWins / first.length) : '-', 7)}  ${pad(t.length, 7)}  ${pad(pct(wins / t.length), 7)}` +
        `  ${pad(Math.round(avg(t.map((x) => x.quota))), 9)}  ${pad(Math.round(avg(t.map((x) => x.purse))), 9)}  ${pad(ratio ? ratio.toFixed(2) : '-', 11)}` +
        `  ${pad(Math.round(avg(t.map((x) => x.peakStink))), 10)}  ${pad(`${lostS}/${lostQ}`, 8)}  ${pad(avg(t.map((x) => x.perks)).toFixed(1), 5)}` +
        `   ${[0.1, 0.25, 0.5, 0.75].map((q) => pad(quantile(t.map((x) => x.pre), q), 6)).join(' ')}${boss}`,
    );
  }
  if (o.detail) {
    const clock = (sec: number): string => {
      const mins = Math.floor((sec / TUNING.shift.secondsPerHour) * 60);
      return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
    };
    console.log(' night  fill avg  fill peak (avg/p90)  met at p25/p50/p75   earned per hour, median (12-1 ... 5-6)      bonus share  stink-outs  stink from over/angry/crowd/smelly');
    for (let n = 1; n <= NIGHT_COUNT; n++) {
      const t = all.flatMap((r) => r.tries.filter((x) => x.night === n));
      if (t.length === 0) continue;
      const met = t.map((x) => x.metAt).filter((x): x is number => x !== null);
      const metStr = met.length ? [0.25, 0.5, 0.75].map((q) => clock(quantile(met, q))).join(' ') : '-';
      const hours = Array.from({ length: TUNING.shift.hours }, (_, h) => quantile(t.map((x) => x.hourly[h] ?? 0), 0.5));
      const pre = t.filter((x) => x.pre > 0);
      const share = avg(pre.map((x) => x.bonus / x.pre));
      console.log(
        `${pad(n, 6)}  ${pad(pct(avg(t.map((x) => x.fillAvg))), 8)}  ${pad(`${pct(avg(t.map((x) => x.fillMax)))} / ${pct(quantile(t.map((x) => x.fillMax * 100), 0.9) / 100)}`, 19)}` +
          `  ${pad(metStr, 18)}   ${hours.map((h) => pad(h, 6)).join(' ')}   ${pad(pct(share), 10)}  ${pad(t.filter((x) => x.reason === 'stink').length, 10)}` +
          `  ${(['overflow', 'angry', 'crowding', 'smelly'] as const).map((k) => pad(Math.round(avg(t.map((x) => x.from[k]))), 4)).join(' ')}`,
      );
    }
  }
  if (o.rules) {
    console.log('  first-try pass rate by rule:');
    for (const id of Object.keys(RULES) as RuleId[]) {
      const first = all.flatMap((r) => r.tries.filter((x) => x.rule === id && x.first));
      if (first.length === 0) continue;
      // What it earned by 6 AM against the night's base quota (no rule, no tag): the rule's natural quotaMul.
      const rel = quantile(first.map((x) => (x.pre * 100) / Math.max(1, TUNING.run.quota[x.night - 1] ?? 1)), 0.5) / 100;
      console.log(`    ${RULES[id].name.padEnd(16)} ${pad(pct(first.filter((x) => x.won).length / first.length), 5)} of ${pad(first.length, 3)}   earned/base quota (median) ${rel.toFixed(2)}   quotaMul ${RULES[id].quotaMul}`);
    }
  }
}

export function runCampaign(args: string[]): void {
  const flags = new Set(args.filter((a) => /^[a-z]/i.test(a)));
  const nums = args.filter((a) => !/^[a-z]/i.test(a));
  const runs = Number(nums[0] ?? 20) || 20;
  const speeds = nums.slice(1).map(Number).filter((x) => x > 0);
  const o: CampaignOpts = {
    greedy10: flags.has('greedy10'),
    bot: flags.has('eager') ? { clockOutAt: 0 } : flags.has('stay') ? { clockOutAt: 2, clockOutAhead: 2 } : {},
    all: flags.has('all'),
    bare: flags.has('bare'),
    rules: flags.has('rules'),
    detail: flags.has('detail'),
  };
  for (const t of speeds.length > 0 ? speeds : [1.3, 1.8, 2.5]) profile(runs, t, o);
}
