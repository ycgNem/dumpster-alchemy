// window.dev, in dev builds only: poke the running night from the browser console.
//   dev.give('cart', 4, 3)   put an item on a cell        dev.fill()       fill every empty cell
//   dev.stink(90)            set the Stink                dev.skip(60)     fast-forward a minute
//   dev.shinies(1000)        set the purse                dev.seed(42)     restart on a seed
//   dev.win() / dev.lose()   end the night now            dev.auto(true)   let the bot play
//   dev.reloadArt()          pick up new atlases          dev.state        the live GameState
//   dev.step(2)              run the scene 2 s and draw now (for a hidden or throttled tab)
//   dev.night(4)             jump the run to night 4 (night card)   dev.bank(5000)   set the bank
//   dev.go('swap')           title|card|play|swap|almanac|end      dev.wipe()       forget the save
//   dev.click(320, 180)      press and release at a logical point  dev.run, dev.scene
//   dev.clockOut()           clock out now (quota met)             dev.next()       the truck's next load
import { ITEMS, JUNK_CHAIN, type ItemId } from '../data/items';
import { TUNING } from '../data/tuning';
import { makePiece } from '../game/board';
import { canClockOut, clockOut, endNight } from '../game/shift';
import { nextTruckLoad } from '../game/truck';
import { nightLength, noteItem, type GameState } from '../game/state';
import { step } from '../game/step';
import { addStink } from '../game/stink';
import { loadArt } from '../render/sprites';
import type { Run } from '../game/run';
import type { Flow } from '../scenes/flow';
import { Bot, BOT_DEFAULT } from './bot';

export interface DevApi {
  readonly state: GameState;
  give(id: ItemId, c: number, r: number): string;
  fill(): number;
  stink(n: number): number;
  shinies(n: number): number;
  skip(seconds: number): string;
  seed(n: number): void;
  win(): void;
  lose(): void;
  auto(on?: boolean, thinkSec?: number): boolean;
  reloadArt(): Promise<string>;
  step(seconds: number): string;
  readonly run: Run | null;
  readonly scene: string;
  night(n: number): string;
  bank(n: number): number;
  go(where: 'title' | 'card' | 'play' | 'swap' | 'almanac' | 'end'): string;
  wipe(): void;
  click(x: number, y: number): string;
  clockOut(): string;
  next(): number;
}

declare global {
  interface Window {
    dev?: DevApi;
  }
}

export function installDev(flow: Flow, update: (dt: number) => void, render: () => void, endStep: () => void): void {
  const play = flow.play;
  const api: DevApi = {
    get state() {
      return play.state;
    },
    give(id, c, r) {
      const s = play.state;
      if (!(id in ITEMS)) return `no item "${id}"`;
      if (!s.board.inside(c, r)) return `cell ${c},${r} is off the board`;
      s.board.set(c, r, makePiece(id, s.time));
      noteItem(s, id);
      return `${ITEMS[id].name} at ${c},${r}`;
    },
    fill() {
      const s = play.state;
      const empties = s.board.empties();
      for (const [c, r] of empties) {
        const id = s.rng.pick(JUNK_CHAIN.slice(0, 3));
        s.board.set(c, r, makePiece(id, s.time));
        noteItem(s, id);
      }
      return empties.length;
    },
    stink(n) {
      const s = play.state;
      s.stink = Math.max(0, n - 0.001);
      addStink(s, 0.001);
      play.flush();
      return s.stink;
    },
    shinies(n) {
      play.state.purse = n;
      return n;
    },
    skip(seconds) {
      const s = play.state;
      const dt = 1 / 60;
      for (let i = 0; i < Math.round(seconds * 60) && s.status === 'playing'; i++) {
        step(s, dt);
        s.events.length = 0; // no sound or effects for skipped time
      }
      return `${Math.floor(s.time)}s into the night, ${s.status}`;
    },
    seed(n) {
      play.restart(n);
    },
    win() {
      const s = play.state;
      if (s.goal === 'king') {
        const [c, r] = s.board.empties()[0] ?? [0, 0];
        s.board.set(c, r, makePiece('king', s.time));
        noteItem(s, 'king');
        return;
      }
      s.purse = Math.max(s.purse, s.quota);
      s.time = Math.max(s.time, nightLength() - 0.05);
    },
    lose() {
      endNight(play.state, 'stink');
      play.state.stink = TUNING.stink.max;
      play.state.stats.peakStink = TUNING.stink.max;
      play.flush();
    },
    auto(on = true, thinkSec = BOT_DEFAULT.thinkSec) {
      if (!on) {
        play.autoplay = null;
        return false;
      }
      const bot = new Bot({ ...BOT_DEFAULT, thinkSec });
      play.autoplay = (s, dt) => bot.update(s, dt);
      return true;
    },
    reloadArt() {
      return loadArt();
    },
    step(seconds) {
      for (let i = 0; i < Math.max(1, Math.round(seconds * 60)); i++) {
        update(1 / 60);
        endStep();
      }
      render();
      return `${api.scene}: ${Math.floor(play.state.time)}s into the night, ${play.state.status}`;
    },
    get run() {
      return flow.run;
    },
    get scene() {
      return flow.scene?.constructor.name ?? 'none';
    },
    night(n) {
      const run = flow.ensureRun();
      run.night = Math.max(1, Math.floor(n));
      run.tries = 0;
      flow.save();
      flow.nightCard();
      return `run at night ${run.night}`;
    },
    bank(n) {
      const run = flow.ensureRun();
      run.bank = Math.max(0, Math.floor(n));
      flow.save();
      return run.bank;
    },
    go(where) {
      flow.ensureRun();
      if (where === 'title') flow.title();
      else if (where === 'card') flow.nightCard();
      else if (where === 'play') flow.clockIn();
      else if (where === 'swap') flow.swapMeet();
      else if (where === 'almanac') flow.almanac(() => flow.title());
      else if (where === 'end') flow.theEnd();
      render();
      return api.scene;
    },
    wipe() {
      flow.wipe();
    },
    clockOut() {
      const s = play.state;
      if (!canClockOut(s)) return `can't clock out (${s.goal}, purse ${s.purse}/${s.quota}, ${s.status})`;
      clockOut(s);
      play.flush();
      return `clocked out at ${Math.floor(s.time)}s: ${s.endReason}`;
    },
    next() {
      return nextTruckLoad(play.state);
    },
    click(x, y) {
      const inp = flow.host.input;
      inp.x = x;
      inp.y = y;
      inp.pressX = x;
      inp.pressY = y;
      inp.down = true;
      inp.pressed = true;
      update(1 / 60);
      endStep();
      inp.down = false;
      inp.released = true;
      update(1 / 60);
      endStep();
      render();
      return api.scene;
    },
  };
  window.dev = api;
  console.info(
    'Dumpster Alchemy dev tools: window.dev (give, fill, stink, shinies, skip, step, seed, win, lose, auto, reloadArt, night, bank, go, wipe, click, clockOut, next, run, scene)',
  );
}
