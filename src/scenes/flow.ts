// The game between scenes: holds the run, the meta (what lasts across runs) and the settings,
// saves them, and moves from screen to screen (docs/V2.md, "The run"):
//
//   Title -> (Foreman) -> Night card -> Play -> Report -> Loot -> Swap Meet -> Map -> Night card ...
//                                                 |-> a strike: Retry (or the Swap Meet first)
//                                                 |-> the third strike: FIRED (the run-over card)
//                                                 |-> night 10 won: the crowning -> the run-over card
//   Title -> Daily Dump -> Night card -> Play -> Report (Copy the share card) -> Title
//   Title -> Trash Almanac;  Play -> Pause -> Quit to title
import { isMuted, setMuted } from '../audio';
import type { ForemanId } from '../data/contraband';
import { afterNight, dateKey, foremenOpen, type Meta } from '../game/meta';
import { finishNight, leaveMap, leaveShop, newDailyRun, newRun, startNight, type NightResult, type Run } from '../game/run';
import { loadSave, wipeSave, writeSave, type KV, type SaveData } from '../game/save';
import type { GameState } from '../game/state';
import { setHeldPerks } from '../render/run';
import { AlmanacScene } from './almanac';
import { Hints } from './hints';
import { LootScene } from './loot';
import { MapScene } from './map';
import { NightCardScene } from './nightcard';
import type { PlayScene } from './play';
import { ReportScene } from './report';
import type { Scene, SceneHost } from './scene';
import { SwapMeetScene } from './swapmeet';
import { RunOverScene, TheEndScene } from './theend';
import { TitleScene } from './title';

export class Flow {
  readonly host: SceneHost;
  readonly play: PlayScene;
  private readonly kv: KV;
  data: SaveData;
  /** Did the last write reach storage? (The title says so when it didn't.) */
  saved = true;
  scene: Scene | null = null;
  /** Today's Daily Dump while it's being played (never saved as the run). */
  daily: Run | null = null;
  /** A run that just ended (FIRED or won), for its end card; the save no longer holds it. */
  ended: Run | null = null;

  constructor(host: SceneHost, play: PlayScene, kv: KV) {
    this.host = host;
    this.play = play;
    this.kv = kv;
    this.data = loadSave(kv);
    setMuted(this.data.settings.muted);
    play.onEnd = (s) => this.nightOver(s);
    play.onQuit = () => this.title();
    // Night 1's prompts show once per player: what's been seen lives in the save's settings.
    play.hints = new Hints(this.data.settings.hintsSeen, (id) => {
      if (!this.data.settings.hintsSeen.includes(id)) this.data.settings.hintsSeen.push(id);
      this.save();
    });
  }

  /** The saved run in progress (between nights), or null. */
  get run(): Run | null {
    return this.data.run;
  }

  get meta(): Meta {
    return this.data.meta;
  }

  /** The run tonight belongs to: the Daily Dump while one's on, else the saved run. */
  active(): Run {
    return this.daily ?? this.ensureRun();
  }

  /** The run, starting one if there isn't any (dev helpers use this). */
  ensureRun(): Run {
    if (!this.data.run) this.data.run = newRun(Date.now() % 1_000_000_007, this.meta, this.meta.foreman);
    return this.data.run;
  }

  save(): void {
    this.data.settings.muted = isMuted();
    this.saved = writeSave(this.kv, this.data);
  }

  /** Once per frame: keep the mute setting saved however it was changed (M, the menus). */
  tick(): void {
    if (this.data.settings.muted !== isMuted()) this.save();
  }

  go(s: Scene): void {
    this.scene = s;
    this.host.go(s);
  }

  // ---- Starting things ----

  title(): void {
    this.daily = null;
    this.go(new TitleScene(this));
  }

  /** New Run: pick a Foreman first when more than one is open. */
  newGame(): void {
    if (foremenOpen(this.meta).length > 1) this.go(new LootScene(this, this.ensureRunStub(), 'foreman'));
    else this.startRun('gary');
  }

  /** A throwaway run for the Foreman pick to draw against (nothing is saved until one is picked). */
  private ensureRunStub(): Run {
    return newRun(0, this.meta, this.meta.foreman);
  }

  startRun(foreman: ForemanId): void {
    this.daily = null;
    this.ended = null;
    this.meta.foreman = foreman;
    this.meta.runs++;
    this.data.run = newRun(Date.now() % 1_000_000_007, this.meta, foreman);
    this.save();
    this.nightCard();
  }

  /** Continue: wherever the saved run stopped between nights. */
  resume(): void {
    const run = this.data.run;
    if (!run) return this.newGame();
    this.daily = null;
    switch (run.stage) {
      case 'loot':
        return this.loot();
      case 'shop':
        return this.swapMeet();
      case 'map':
        return this.map();
      default:
        return this.nightCard();
    }
  }

  /** Today's Daily Dump has been played (one try a day). */
  dailyPlayed(d = new Date()): boolean {
    return dateKey(d) in this.meta.daily;
  }

  /** Start today's Daily Dump (one try: it counts as played the moment it starts). */
  startDaily(): void {
    const now = new Date();
    if (this.dailyPlayed(now)) return;
    this.daily = newDailyRun(now, this.meta);
    this.meta.daily[dateKey(now)] = 0;
    this.save();
    this.go(new NightCardScene(this, this.daily));
  }

  // ---- The screens of a run ----

  nightCard(): void {
    const run = this.active();
    run.stage = 'card';
    this.go(new NightCardScene(this, run));
  }

  /**
   * Clock in: build tonight from the run and play it. `quick`: straight from Retry or the Swap
   * Meet, without the night card (a short banner at the start of play stands in for it).
   */
  clockIn(quick = false): void {
    const run = this.active();
    setHeldPerks(run.slots);
    this.play.load(startNight(run), quick);
    this.go(this.play);
  }

  private nightOver(s: GameState): void {
    const run = this.active();
    const res = finishNight(run, s);
    afterNight(this.meta, run, res);
    if (run.daily > 0) {
      const key = dateKey(new Date());
      this.meta.daily[key] = Math.max(this.meta.daily[key] ?? 0, s.purse);
    }
    if (run.over && run.daily === 0) {
      this.ended = run;
      this.data.run = null;
    }
    this.save();
    this.go(new ReportScene(this, run, res));
  }

  /** After the report: on to whatever comes next for that result. */
  afterReport(res: NightResult): void {
    const run = this.daily ?? this.ended ?? this.data.run;
    if (!run) return this.title();
    if (run.daily > 0) return this.title();
    if (res.crowned) return this.theEnd();
    if (run.over === 'fired') return this.runOver();
    if (res.won) return this.loot();
    this.clockIn(true);
  }

  loot(): void {
    const run = this.ensureRun();
    if (run.loot <= 0) return this.swapMeet();
    run.stage = 'loot';
    this.go(new LootScene(this, run, 'loot'));
  }

  swapMeet(): void {
    const run = this.ensureRun();
    run.stage = 'shop';
    this.save();
    this.go(new SwapMeetScene(this, run));
  }

  /** Done at the Swap Meet: the map (or, after a strike, back to the night card). */
  leaveSwapMeet(): void {
    const run = this.ensureRun();
    leaveShop(run);
    this.save();
    if (run.stage === 'map') this.map();
    else this.nightCard();
  }

  map(): void {
    const run = this.ensureRun();
    run.stage = 'map';
    this.save();
    this.go(new MapScene(this, run));
  }

  /** The fork's picked: the night card. */
  leaveMapScene(): void {
    const run = this.ensureRun();
    leaveMap(run);
    this.save();
    this.nightCard();
  }

  almanac(back: () => void): void {
    // The Almanac reads `discovered` and `recipes`: everything ever, from the meta.
    const base = this.daily ?? this.data.run ?? this.ended ?? newRun(0, this.meta);
    const view: Run = { ...base, discovered: [...new Set([...this.meta.discovered, ...base.discovered])], recipes: [...new Set([...this.meta.recipes, ...base.recipes])] };
    this.go(new AlmanacScene(this, view, back));
  }

  /** The crowning (night 10 won), then the run's end card. */
  theEnd(): void {
    this.go(new TheEndScene(this, this.ended ?? this.ensureRun()));
  }

  /** The run's end card: FIRED, or the win. */
  runOver(): void {
    const run = this.ended ?? this.data.run;
    if (!run) return this.title();
    this.go(new RunOverScene(this, run));
  }

  /** Forget the save (dev). */
  wipe(): void {
    this.data = { ...this.data, run: null };
    this.data.settings.hintsSeen = [];
    this.data.meta = loadSave({ get: () => null, set: () => {}, remove: () => {} }).meta;
    this.play.hints.reset();
    this.daily = null;
    this.ended = null;
    wipeSave(this.kv);
  }
}
