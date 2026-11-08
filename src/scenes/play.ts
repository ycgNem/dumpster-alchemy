// Playing a night: pointer and keys become game actions, the simulation steps, every event
// goes to fx and audio, and the render modules draw the result. Also here: the Clock Out button
// (once the quota is in), the lot's hover tooltips, night 1's prompts, and the quick night
// banner when a night starts straight from Retry or the Swap Meet.
import { isMuted, playEvent, setIntensity, setMusic, setMuted } from '../audio';
import { ruleOf } from '../data/nights';
import { TUNING } from '../data/tuning';
import { touchUi } from '../engine/input';
import { W, backstop } from '../engine/screen';
import { NO_TARGET, cancelDrag, drop, dropKind, pickUp, type DropKind, type Target } from '../game/actions';
import { clickDumpster } from '../game/dumpster';
import { canClockOut, clockOut } from '../game/shift';
import { createState, type GameState } from '../game/state';
import { step } from '../game/step';
import { drawBoard, drawFlights, drawHeld, drawReveals } from '../render/board';
import { drawCursor, setCursorHint } from '../render/cursor';
import { drawFx, drawFxTop, drawStinkEdge, fxEvent, hitstop, resetFx, shake, updateFx } from '../render/fx';
import { STREAK_PLATE, drawFeverPulse, drawStreakMeter, overStreak, streakTip } from '../render/momentum';
import { outlineRect } from '../render/greybox';
import { drawEnd, drawHud, drawHudTip, hudTipAt } from '../render/hud';
import { CLOCK_OUT, COMPACTOR, DUMPSTER, inRect, setOrderSlots, targetAt } from '../render/layout';
import { Buttons, bigText, drawPanel, drawTooltipAt, fmt, menuPointing, type Btn } from '../render/menus';
import { drawOrders, drawWantTip, wantAt } from '../render/orders';
import { drawHeldPerks, runEvent } from '../render/run';
import { drawPossum, possumEvent, resetPossum, updatePossum } from '../render/possum';
import { drawBackdrop, drawCompactor, drawDumpster, drawTruck } from '../render/props';
import { tickArt } from '../render/sprites';
import { drawText, textWidth, wrapText } from '../render/text';
import { drawTwistLot, drawTwistSky, resetTwists, updateTwists } from '../render/twists';
import { alchemyEvent, alchemyFrozen, drawAlchemy, drawAlchemyTop, resetAlchemy } from '../render/alchemy';
import { aimY, makeView, tidyView, viewEvent, type View } from '../render/view';
import { Hints } from './hints';
import { PauseMenu, drawMuteButton, drawPauseButton, muteButtonHit, pauseButtonHit } from './pause';
import type { Scene, SceneHost } from './scene';

type Track = 'night' | 'report';

/** Seconds the quick night banner stays up when a night starts without the night card. */
const INTRO_SEC = 2.8;
/** Seconds the pointer rests on the Dumpster, Crusher or jar before its tooltip shows. */
const TIP_DELAY = 0.6;

export class PlayScene implements Scene {
  state: GameState;
  view: View;
  paused = false;
  /** Dev: a bot that plays for you (window.dev.auto). */
  autoplay: ((s: GameState, dt: number) => void) | null = null;
  /** The flow (src/scenes/flow.ts): told once a night is over, and on Quit to title. */
  onEnd: ((s: GameState) => void) | null = null;
  onQuit: (() => void) | null = null;
  /** Night 1's one-time prompts; the flow hands in what the save has seen. */
  hints = new Hints([], () => {});
  private readonly pauseMenu = new PauseMenu();
  private readonly clockUi = new Buttons();
  private handedOff = false;
  private readonly host: SceneHost;
  private music: Track | null = null;
  /** Show the quick night banner (the night card was skipped). */
  private intro = false;
  private tipKey: string | null = null;
  private tipT = 0;
  /** Touch: a tooltip shown by a tap (the night's rule, the jar), and its seconds left. */
  private tapTip: string | null = null;
  private tapTipT = 0;

  constructor(host: SceneHost, seed = Date.now() % 1_000_000) {
    this.host = host;
    this.state = createState({ seed });
    this.view = makeView();
  }

  /** Start the night over (same seed unless one is given). */
  restart(seed = Date.now() % 1_000_000): void {
    this.state = createState({ seed, discovered: this.state.discovered, recipes: this.state.discoveredRecipes });
    this.view = makeView();
    this.paused = false;
    resetFx();
    resetPossum(this.state);
    resetTwists();
    resetAlchemy();
  }

  /** Play this night (built by src/game/run.ts startNight). `intro`: no night card came first. */
  load(s: GameState, intro = false): void {
    this.state = s;
    this.view = makeView();
    this.paused = false;
    this.handedOff = false;
    this.music = null;
    this.intro = intro;
    this.tipKey = null;
    this.clockUi.reset();
    // (Focus lost on a menu screen doesn't pause the night that starts after it.)
    this.host.input.focusLost = false;
    setOrderSlots(s.orders.length);
    resetFx();
    resetPossum(s);
    resetTwists();
    resetAlchemy();
    this.hints.night();
  }

  audioReady(): void {
    this.music = null;
  }

  /** The Clock Out button, sliding down into place once the quota is in. */
  private clockButtons(): Btn[] {
    const s = this.state;
    if (!canClockOut(s) || this.paused) return [];
    const k = Math.min(1, (this.view.t - this.view.quotaAt) / 0.3);
    const drop = Math.round((1 - k) * (1 - k) * -16);
    return [
      {
        id: 'clockout',
        // What you'd take home right now (the overtime at x1).
        label: `Clock Out ${fmt(s.purse)}`,
        icon: 'icon_clock',
        r: { ...CLOCK_OUT, y: CLOCK_OUT.y + drop },
        keys: ['KeyC'],
        tip: `Clock out now${touchUi() ? '' : ' (C)'} and bank ${fmt(s.purse)}, overtime at x1. Stay till 6 AM and the overtime pays twice. But if the Stink shuts you down first, the Possum takes all of it.`,
      },
    ];
  }

  update(dt: number): void {
    const { input } = this.host;
    const s = this.state;
    const v = this.view;
    v.t += dt;
    v.px = input.x;
    v.py = input.y;
    v.touch = input.pointerType === 'touch';
    tickArt(v.t);

    if (input.hit('KeyM') || muteButtonHit(input)) setMuted(!isMuted());
    if ((input.hit('KeyP') || input.hit('Escape') || pauseButtonHit(input)) && s.status === 'playing') {
      this.paused = !this.paused;
      if (this.paused) this.pauseMenu.open();
    }
    // Looked away (another window, another tab, another app): the night waits under the pause menu.
    if (input.focusLost) {
      input.focusLost = false;
      if (s.status === 'playing' && !this.paused) {
        this.paused = true;
        this.pauseMenu.open(true);
      }
    }

    if (s.status !== 'playing') {
      // With the flow hooked up, the night report takes over after a beat.
      if (this.onEnd) {
        if (!this.handedOff && v.t - v.endedAt > 0.9) {
          this.handedOff = true;
          this.onEnd(s);
        }
      } else if (input.pressed && v.t - v.endedAt > 1.2) this.restart();
    } else if (this.paused) {
      const act = this.pauseMenu.update(input, dt);
      if (act) this.paused = false;
      if (act === 'quit') this.onQuit?.();
    } else {
      const btns = this.clockButtons();
      const id = btns.length > 0 && !s.drag ? this.clockUi.update(input, btns) : null;
      if (id === 'clockout') clockOut(s);
      else this.handleInput();
      // Hitstop (fx.ts): a big moment freezes the lot for a few frames. Render-side only: the
      // headless sim never stops.
      if (!hitstop(dt)) {
        this.autoplay?.(s, dt);
        step(s, dt);
      }
      this.hints.update(s, dt);
    }
    this.flush();
    updateFx(dt, this.state, this.view);
    updatePossum(this.state, dt);
    updateTwists(this.state, dt);
    tidyView(v);

    // Hover tooltips on the lot (and the recipe on a wanted item): after a short rest, never
    // while holding a piece.
    const live = this.state.status === 'playing' && !this.paused && !this.state.drag;
    const key = live && !v.touch ? (hudTipAt(this.state, v.px, v.py) ?? wantAt(this.state, v.px, v.py) ?? (overStreak(v.px, v.py) ? 'streak' : null)) : null;
    // A finger can't hover: tapping the night's name or the jar shows theirs for a few seconds.
    if (live && v.touch && input.pressed) {
      const k = hudTipAt(this.state, input.pressX, input.pressY);
      if (k === 'night' || k === 'stink') {
        this.tapTip = k;
        this.tapTipT = 3;
      }
    }
    this.tapTipT = Math.max(0, this.tapTipT - dt);
    // (A click starts the wait over, so hammering the Dumpster doesn't bring its tip up.)
    if (key !== this.tipKey || input.pressed) {
      this.tipKey = key;
      this.tipT = 0;
    } else this.tipT += dt;

    const want: Track = this.state.status === 'playing' ? 'night' : 'report';
    if (want !== this.music) {
      setMusic(want);
      this.music = want;
    }
    setIntensity(Math.max(this.state.stink / TUNING.stink.max, this.state.board.fillRatio() * 0.8));
  }

  /** Hand this step's events to the view, fx and sound, then clear them. */
  flush(): void {
    const s = this.state;
    for (const e of s.events) {
      viewEvent(this.view, s, e);
      fxEvent(s, e);
      alchemyEvent(s, e, this.view);
      possumEvent(s, e);
      runEvent(s, e);
      this.hints.event(s, e);
      playEvent(e);
    }
    s.events.length = 0;
  }

  private handleInput(): void {
    const { input } = this.host;
    const s = this.state;
    if (input.hit('Space')) clickDumpster(s);
    if (input.pressed) {
      const t = targetAt(input.pressX, input.pressY);
      if (t.kind === 'cell') pickUp(s, t.c, t.r, input.x, input.y);
      else if (inRect(DUMPSTER, input.pressX, input.pressY)) clickDumpster(s);
    }
    if (s.drag) {
      s.drag.x = input.x;
      s.drag.y = input.y;
      // On touch the piece floats above the finger: it drops where it's drawn (or under the
      // finger, if that's the only one of the two that works).
      if (input.released) drop(s, this.aim(input.x, input.y));
      else if (!input.down) cancelDrag(s);
    }
  }

  /**
   * The drop target for a pointer at (x, y) while holding a piece. A mouse aims with the paw. A
   * finger aims with the floating piece, but the cell under the finger wins when only it does
   * something (a merge, a delivery, the Crusher), or when the floating piece is over nothing
   * it can drop on: let go on a match, and it merges there.
   */
  private aim(x: number, y: number): Target {
    const s = this.state;
    const v = this.view;
    const lifted = targetAt(x, aimY(v, y));
    if (!s.drag || !v.touch) return lifted;
    const d = s.drag;
    const under = targetAt(x, y);
    const a = dropKind(s, d.c, d.r, lifted);
    const b = dropKind(s, d.c, d.r, under);
    const strong = (k: DropKind): boolean => k === 'merge' || k === 'egg' || k === 'deliver' || k === 'compact';
    if (strong(a)) return lifted;
    if (strong(b)) return under;
    if (a !== 'bad') return lifted;
    return b !== 'bad' ? under : lifted;
  }

  private hover(): { t: Target; kind: DropKind } {
    const s = this.state;
    const v = this.view;
    const t = v.px < 0 ? NO_TARGET : s.drag ? this.aim(v.px, v.py) : targetAt(v.px, v.py);
    const kind = s.drag ? dropKind(s, s.drag.c, s.drag.r, t) : 'bad';
    return { t, kind };
  }

  draw(g: CanvasRenderingContext2D): void {
    const s = this.state;
    const v = this.view;
    // A first brew holds the frame for a beat (src/render/alchemy.ts; render only).
    if (alchemyFrozen(g, v)) return;
    const input = this.host.input;
    const { t, kind } = this.hover();
    const sh = shake();
    // A shaken frame would leave last frame's pixels along one edge (the whole buffer: the
    // backdrop is shaken with the stage, margins and all, so no seam opens between them).
    if (sh.x !== 0 || sh.y !== 0) backstop(g);
    g.save();
    g.translate(sh.x, sh.y);
    drawBackdrop(g, v, s.scene);
    drawTwistSky(g, s, v);
    drawPossum(g, s, v, 'back');
    drawTruck(g, s, v);
    drawPossum(g, s, v, 'front');
    drawBoard(g, s, v, t);
    drawDumpster(g, s, v);
    drawCompactor(g, s, v, t, kind);
    drawOrders(g, s, v, t);
    drawFeverPulse(g, s, v);
    drawStinkEdge(g, s, v);
    drawHud(g, s, v, isMuted());
    drawStreakMeter(g, s, v);
    drawTwistLot(g, s, v);
    drawFlights(g, s);
    drawFx(g, s, v);
    drawReveals(g, s, v);
    drawAlchemy(g, s, v, t, kind);
    g.restore();

    const btns = this.clockButtons();
    if (btns.length > 0) {
      // A pulsing ring for the first few seconds, so it gets noticed.
      const b = btns[0];
      if (b && v.t - v.quotaAt < 4 && Math.sin(v.t * 9) > 0) outlineRect(g, { x: b.r.x - 3, y: b.r.y - 3, w: b.r.w + 6, h: b.r.h + 6 }, 'toxic3');
      this.clockUi.draw(g, input, btns);
    }
    this.hints.draw(g, s, v);
    if (this.intro) this.drawIntro(g);
    drawFxTop(g);
    if (s.status === 'playing') drawHeldPerks(g, s, v);
    if (s.status === 'playing') {
      drawPauseButton(g, input, this.paused);
      drawMuteButton(g, input, isMuted());
    }
    if (this.paused) this.pauseMenu.draw(g, input);
    if (s.status !== 'playing' && !this.onEnd) drawEnd(g, s, v);
    if (this.tipKey && this.tipT > TIP_DELAY && !this.paused) {
      if (this.tipKey.startsWith('want:')) drawWantTip(g, s, this.tipKey, v.t);
      else if (this.tipKey === 'streak') drawTooltipAt(g, streakTip(), STREAK_PLATE, 'below', 230);
      else drawHudTip(g, s, this.tipKey);
    } else if (this.tapTip && this.tapTipT > 0 && !this.paused && s.status === 'playing') drawHudTip(g, s, this.tapTip);
    // The paw: grabbing while you hold a piece (drawn under the piece, so you can see what you've
    // got), pointing at the Dumpster, the Crusher and the Clock Out button.
    if (s.drag) setCursorHint('grab');
    else if (!this.paused && s.status === 'playing' && (inRect(DUMPSTER, v.px, v.py) || inRect(COMPACTOR, v.px, v.py) || (btns.length > 0 && menuPointing()))) {
      setCursorHint('point');
    }
    drawCursor(g, input);
    drawHeld(g, s, v, kind, t);
    if (!this.paused) drawAlchemyTop(g, s, v, t, kind);
  }

  /** The night card in brief, dropping in over the lane for a moment (Retry, the Swap Meet). */
  private drawIntro(g: CanvasRenderingContext2D): void {
    const s = this.state;
    const t = this.view.t;
    if (t > INTRO_SEC) {
      this.intro = false;
      return;
    }
    const def = ruleOf(s);
    const k = t < 0.25 ? t / 0.25 : t > INTRO_SEC - 0.25 ? (INTRO_SEC - t) / 0.25 : 1;
    const head = s.goal === 'endless' ? 'ENDLESS' : s.label;
    const goal = s.goal === 'king' ? 'GOAL: build THE TRASH KING' : s.goal === 'endless' ? 'SCORE: Shinies before the Stink wins' : `QUOTA: ${fmt(s.quota)} Shinies by 6 AM`;
    // The night's rule is the thing to remember: "TONIGHT" in red, the rule beside it.
    // (A clear gap after "TONIGHT", whatever the font's widths.)
    const ruleX = 14 + textWidth('TONIGHT') + 7;
    const rule = wrapText(def.rule, Math.min(240, 306 - ruleX)).slice(0, 2);
    const h = 66 + rule.length * 10;
    const r = { x: W / 2 - 160, y: Math.round(26 - (1 - k) * (1 - k) * (h + 20)), w: 320, h };
    drawPanel(g, r);
    bigText(g, `${head}: ${def.name.toUpperCase()}`, W / 2, r.y + 8, 2, { color: 'ink0', align: 'center' });
    drawText(g, 'TONIGHT', r.x + 14, r.y + 36, { color: 'red' });
    rule.forEach((l, i) => drawText(g, l, r.x + ruleX, r.y + 36 + i * 10, { color: 'ink0' }));
    drawText(g, goal, W / 2, r.y + h - 18, { color: 'rust1', align: 'center' });
  }
}
