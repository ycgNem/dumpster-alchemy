// Headless balance: the bot plays N nights in Node and prints what happened.
//   npm run sim                 40 tries at night 1 at four bot speeds (the 1.0 s "steady" bot in detail)
//   npm run sim -- 100          100 tries each
//   npm run sim -- 40 0.8       40 tries, one bot that acts every 0.8 s, in detail
//   npm run sim -- 40 1.8 n5    night 5 (no upgrades) instead of night 1
//   npm run sim -- campaign     the ten nights in order with shopping and retries (src/dev/campaign.ts)
import { nightDef } from '../data/nights';
import { noLevels, type Levels } from '../data/upgrades';
import { nightMods } from '../game/run';
import { step } from '../game/step';
import { createState, type GameState } from '../game/state';
import { Bot, BOT_DEFAULT, type BotOpts } from './bot';
import { runCampaign } from './campaign';

const argv = (globalThis as { process?: { argv: string[] } }).process?.argv.slice(2) ?? [];
const nightArg = argv.find((a) => /^n\d+$/.test(a));
/** `stay`: the bot never clocks out (it always bets on the overtime). `lv<lid><hinges><raccoon><crusher><freshener><owl>`: upgrade levels, e.g. lv000110. */
const stay = argv.includes('stay');
const lvArg = argv.find((a) => /^lv\d{6}$/.test(a));
const nums = argv.filter((a) => a !== nightArg && a !== 'stay' && a !== lvArg);
const nights = Number(nums[0] ?? 40) || 40;
const only = nums[1] ? Number(nums[1]) : null;
const night = nightDef(nightArg ? Number(nightArg.slice(1)) : 1);

const DT = 1 / 60;

interface Run {
  s: GameState;
  /** Seconds after midnight the quota was reached, or null. */
  metAt: number | null;
  /** Average and highest board fill, 0..1. */
  fillAvg: number;
  fillMax: number;
  /** Stink, fill and purse at each half hour (0:30 ... 6:00), while the night was still on. */
  curve: { stink: number; fill: number; purse: number; smelly: number }[];
}

function levels(): Levels {
  const lv = noLevels();
  if (!lvArg) return lv;
  const ids = ['lid', 'hinges', 'raccoon', 'compactor', 'freshener', 'owl'] as const;
  ids.forEach((id, i) => (lv[id] = Number(lvArg[2 + i] ?? 0)));
  return lv;
}

function playNight(seed: number, bot: Bot): Run {
  const s = createState({ seed, night: night.night, quota: night.quota, goal: night.goal, mods: nightMods(levels(), night) });
  let metAt: number | null = null;
  let sum = 0;
  let n = 0;
  let max = 0;
  const curve: Run['curve'] = [];
  while (s.status === 'playing') {
    bot.update(s, DT);
    step(s, DT);
    s.events.length = 0;
    if (metAt === null && s.quotaMetAt !== null) metAt = s.quotaMetAt;
    const f = s.board.fillRatio();
    sum += f;
    n++;
    max = Math.max(max, f);
    if (s.time >= (curve.length + 1) * 30) curve.push({ stink: s.stink, fill: f, purse: s.purse, smelly: s.ripe.size });
  }
  return { s, metAt, fillAvg: sum / Math.max(1, n), fillMax: max, curve };
}

function clock(sec: number): string {
  const mins = Math.floor(sec);
  const h = Math.floor(mins / 60);
  return `${h === 0 ? 12 : h}:${String(mins % 60).padStart(2, '0')}`;
}

function pad(v: string | number, n: number): string {
  return String(v).padStart(n);
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function runProfile(label: string, o: BotOpts, verbose: boolean): void {
  console.log(`\n== ${label}: one action every ${o.thinkSec}s, ${nights} tries at night ${night.night} (${night.name}), quota ${night.quota} ==`);
  if (verbose) {
    console.log(
      ' seed  result            shinies  met at  filled angry  best  peak stink  overflows  fill avg/max  merges clicks crushed',
    );
  }
  const runs: Run[] = [];
  for (let i = 1; i <= nights; i++) {
    const run = playNight(i * 7919, new Bot(o));
    runs.push(run);
    if (!verbose) continue;
    const { s, metAt } = run;
    const st = s.stats;
    const result =
      s.status === 'won' ? `WON (${s.endReason})` : s.endReason === 'stink' ? `lost: stink ${clock(s.time)}` : 'lost: quota';
    console.log(
      `${pad(i, 5)}  ${result.padEnd(17)}${pad(`${s.purse}/${s.quota}`, 9)}  ${pad(metAt === null ? '-' : clock(metAt), 6)}` +
        `  ${pad(st.ordersFilled, 6)} ${pad(st.ordersAngry, 5)}  ${pad(s.bestTier, 4)}  ${pad(Math.round(st.peakStink), 10)}` +
        `  ${pad(st.overflows, 9)}  ${pad(`${pct(run.fillAvg)}/${pct(run.fillMax)}`, 12)}  ${pad(st.merges, 6)} ${pad(st.dumpsterClicks, 6)} ${pad(st.compacted, 7)}`,
    );
  }
  const n = runs.length;
  const avg = (f: (r: Run) => number): number => runs.reduce((a, r) => a + f(r), 0) / n;
  const won = runs.filter((r) => r.s.status === 'won').length;
  const byStink = runs.filter((r) => r.s.endReason === 'stink').length;
  const byQuota = runs.filter((r) => r.s.endReason === 'quota').length;
  const met = runs.filter((r) => r.metAt !== null).map((r) => r.metAt ?? 0).sort((a, b) => a - b);
  const medianMet = met.length > 0 ? clock(met[Math.floor(met.length / 2)] ?? 0) : '-';
  console.log(
    `  WON ${won}/${n} (${pct(won / n)})  lost to stink ${byStink}, quota ${byQuota}` +
      `  | shinies ${Math.round(avg((r) => r.s.purse))}, quota met ${medianMet} (median)` +
      `  | filled ${avg((r) => r.s.stats.ordersFilled).toFixed(1)} angry ${avg((r) => r.s.stats.ordersAngry).toFixed(1)}` +
      `  best tier ${avg((r) => r.s.bestTier).toFixed(1)}  peak stink ${Math.round(avg((r) => r.s.stats.peakStink))}` +
      `  overflows ${avg((r) => r.s.stats.overflows).toFixed(1)}  fill ${pct(avg((r) => r.fillAvg))} avg, ${pct(avg((r) => r.fillMax))} max`,
  );
  // The shape of the night: each half hour, averaged over the tries still playing then.
  const at = (k: number, f: (x: Run['curve'][number]) => number): string => {
    const xs = runs.map((r) => r.curve[k]).filter((x): x is Run['curve'][number] => x !== undefined);
    return xs.length ? String(Math.round(xs.reduce((a, x) => a + f(x), 0) / xs.length)) : '-';
  };
  const ks = Array.from({ length: 12 }, (_, k) => k);
  console.log(`  by half hour   ${ks.map((k) => pad(clock((k + 1) * 30), 5)).join(' ')}`);
  console.log(`  stink          ${ks.map((k) => pad(at(k, (x) => x.stink), 5)).join(' ')}`);
  console.log(`  fill %         ${ks.map((k) => pad(at(k, (x) => x.fill * 100), 5)).join(' ')}`);
  console.log(`  smelly pieces  ${ks.map((k) => pad(at(k, (x) => x.smelly), 5)).join(' ')}`);
  console.log(`  purse          ${ks.map((k) => pad(at(k, (x) => x.purse), 5)).join(' ')}`);
  const smelly = avg((r) => r.s.stats.stinkFrom.smelly);
  const gained = avg((r) => { const f = r.s.stats.stinkFrom; return f.overflow + f.angry + f.crowding + f.smelly; });
  console.log(`  stink gained ${Math.round(gained)} (smelly ${pct(gained ? smelly / gained : 0)}), scraps ${avg((r) => r.s.stats.scraps).toFixed(1)}, jackpots ${avg((r) => r.s.stats.jackpots).toFixed(2)}, OT lost in ${runs.filter((r) => r.s.stats.overtimeLost > 0).length}`);
}

if (argv[0] === 'campaign') {
  runCampaign(argv.slice(1));
} else if (only !== null) {
  runProfile('custom bot', { ...BOT_DEFAULT, thinkSec: only, ...(stay ? { clockOutAt: 2, clockOutAhead: 2 } : {}) }, true);
} else {
  runProfile('quick bot', { ...BOT_DEFAULT, thinkSec: 0.6 }, false);
  runProfile('steady bot', BOT_DEFAULT, true);
  runProfile('slow bot', { ...BOT_DEFAULT, thinkSec: 1.3 }, false);
  runProfile('sleepy bot', { ...BOT_DEFAULT, thinkSec: 1.6 }, false);
}
