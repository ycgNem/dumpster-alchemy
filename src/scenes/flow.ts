// The game between scenes: holds the run and the settings, saves them, and moves from screen
// to screen (docs/DESIGN.md, "Screens"):
//
//   Title -> Night card -> Play -> Night report -> Swap Meet -> Night card -> ...
//                                       |-> Retry (a lost night)   |-> The end (night 10)
//   Title -> Trash Almanac;  Play -> Pause -> Quit to title
import { isMuted, setMuted } from '../audio';
import { finishNight, newRun, startNight, type Run } from '../game/run';
import { loadSave, wipeSave, writeSave, type KV, type SaveData } from '../game/save';
import type { GameState } from '../game/state';
import { AlmanacScene } from './almanac';
import { Hints } from './hints';
import { NightCardScene } from './nightcard';
import type { PlayScene } from './play';
import { ReportScene } from './report';
import type { Scene, SceneHost } from './scene';
import { SwapMeetScene } from './swapmeet';
import { TheEndScene } from './theend';
import { TitleScene } from './title';

export class Flow {
  readonly host: SceneHost;
  readonly play: PlayScene;
  private readonly kv: KV;
  data: SaveData;
  /** Did the last write reach storage? (The title says so when it didn't.) */
  saved = true;
  scene: Scene | null = null;

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

  get run(): Run | null {
    return this.data.run;
  }

  /** The run, starting one if there isn't any (dev helpers use this). */
  ensureRun(): Run {
    if (!this.data.run) this.data.run = newRun(Date.now() % 1_000_000_007);
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

  // ---- The screens ----

  title(): void {
    this.go(new TitleScene(this));
  }

  newGame(): void {
    this.data.run = newRun(Date.now() % 1_000_000_007);
    this.save();
    this.nightCard();
  }

  nightCard(): void {
    this.go(new NightCardScene(this, this.ensureRun()));
  }

  /**
   * Clock in: build tonight from the run and play it. `quick`: straight from Retry or the Swap
   * Meet, without the night card (a short banner at the start of play stands in for it).
   */
  clockIn(quick = false): void {
    const run = this.ensureRun();
    this.play.load(startNight(run), quick);
    this.go(this.play);
  }

  private nightOver(s: GameState): void {
    const run = this.ensureRun();
    const result = finishNight(run, s);
    this.save();
    this.go(new ReportScene(this, run, result));
  }

  swapMeet(): void {
    this.go(new SwapMeetScene(this, this.ensureRun()));
  }

  almanac(back: () => void): void {
    this.go(new AlmanacScene(this, this.run, back));
  }

  theEnd(): void {
    this.go(new TheEndScene(this, this.ensureRun()));
  }

  /** Forget the saved run (dev). */
  wipe(): void {
    this.data.run = null;
    this.data.settings.hintsSeen = [];
    this.play.hints.reset();
    wipeSave(this.kv);
  }
}
