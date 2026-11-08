import './style.css';
import { initAudio } from './audio';
import { Input } from './engine/input';
import { startLoop } from './engine/loop';
import { Screen } from './engine/screen';
import { memoryKV, type KV } from './game/save';
import { drawRotateCard } from './render/rotate';
import { loadArt } from './render/sprites';
import { Flow } from './scenes/flow';
import { PlayScene } from './scenes/play';
import type { Scene, SceneHost } from './scenes/scene';

const view = document.getElementById('view');
if (!(view instanceof HTMLCanvasElement)) throw new Error('#view canvas is missing');

const screen = new Screen(view);
const input = new Input(screen);

/**
 * The save's storage: localStorage when the browser allows it, else memory (private windows,
 * blocked site data). Every call is guarded; src/game/save.ts guards them again.
 */
function browserKV(): KV {
  try {
    const ls = window.localStorage;
    const probe = 'dumpster-alchemy/probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      get: (k) => ls.getItem(k),
      set: (k, v) => ls.setItem(k, v),
      remove: (k) => ls.removeItem(k),
    };
  } catch {
    return memoryKV();
  }
}

let scene: Scene | null = null;
const host: SceneHost = {
  input,
  go(next) {
    scene = next;
    next.enter?.();
  },
};
const play = new PlayScene(host);
const flow = new Flow(host, play, browserKV());
// Dev: `?play` skips the menus and clocks straight into the saved run's night.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('play')) flow.clockIn();
else flow.title();

// Browsers only let sound start after a gesture. initAudio is cheap and also resumes a context
// the browser suspended (a tab switch, a phone locking), so call it on every gesture.
let unlocked = false;
function gesture(): void {
  initAudio();
  if (unlocked) return;
  unlocked = true;
  scene?.audioReady?.();
}
window.addEventListener('pointerdown', gesture, { capture: true });
window.addEventListener('keydown', gesture, { capture: true });

// Art loads in the background; until it lands everything draws as greybox.
void loadArt().then((msg) => console.info(msg));

/** Seconds of wall time, for the "turn your phone" card. */
let clock = 0;

function render(): void {
  // A phone held upright gets the rotate card; the scene waits (it isn't stepped either).
  if (screen.portrait) drawRotateCard(screen.pg, clock);
  else scene?.draw(screen.g);
  screen.present();
}

function update(dt: number): void {
  clock += dt;
  if (!screen.portrait) scene?.update(dt);
  flow.tick();
}

if (import.meta.env.DEV) {
  void import('./dev/devtools').then((m) => m.installDev(flow, update, render, () => input.endStep()));
}

startLoop((dt) => {
  update(dt);
  input.endStep();
}, render);
