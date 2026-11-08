// Pause, for the play scene: the little pause button in the corner of the HUD and the overlay
// with Resume, Sound and Quit to title. P or Escape toggles it (play.ts), M mutes anywhere.
import { isMuted, playUi, setMuted } from '../audio';
import { H, W } from '../engine/screen';
import { touchUi, type Input } from '../engine/input';
import { setCursorHint } from '../render/cursor';
import { drawFullscreenButton } from '../render/fullscreen';
import { inRect, type Rect } from '../render/layout';
import { reduceShake, setReduceShake } from '../render/shake';
import { Buttons, bigText, buttonColumn, dim, drawButton, drawIcon, drawPaper, menuPointing, type Btn } from '../render/menus';
import { drawText } from '../render/text';

/** The pause button, top-left of the HUD (the night label sits just right of it). */
export const PAUSE_BTN: Rect = { x: 4, y: 3, w: 18, h: 18 };
/** The sound button, top-right of the HUD (the clock sits just left of it). */
export const MUTE_BTN: Rect = { x: W - 22, y: 3, w: 18, h: 18 };

const PANEL: Rect = { x: W / 2 - 100, y: H / 2 - 90, w: 200, h: 180 };

export type PauseAction = 'resume' | 'quit' | null;

export class PauseMenu {
  private readonly ui = new Buttons();
  private t = 0;
  private armed = -9;
  /** Paused by itself (the window lost focus, the tab was hidden), not by the player. */
  private auto = false;

  open(auto = false): void {
    this.t = 0;
    this.armed = -9;
    this.auto = auto;
    this.ui.reset();
  }

  private buttons(): Btn[] {
    const sure = this.t - this.armed < 3;
    return buttonColumn(
      [
        ['resume', 'Resume', { icon: 'icon_play', keys: ['Enter'] }],
        ['sound', isMuted() ? 'Sound: OFF' : 'Sound: ON', { icon: isMuted() ? 'icon_mute' : 'icon_sound' }],
        // Reduce shake (src/render/shake.ts): the big moments shake a third as hard, 2 px at most.
        ['shake', reduceShake() ? 'Shake: LOW' : 'Shake: FULL', { tip: 'Big moments shake the screen. LOW keeps it to a nudge.' }],
        ['quit', sure ? 'Sure? Quit' : 'Quit to Title', { keys: ['KeyQ'], sound: 'back', tip: sure ? undefined : "Tonight's Shinies are lost. The night stays." }],
      ],
      W / 2,
      PANEL.y + 46,
      140,
      22,
      6,
    );
  }

  update(input: Input, dt: number): PauseAction {
    this.t += dt;
    const id = this.t > 0.1 ? this.ui.update(input, this.buttons()) : null;
    if (id === 'resume') return 'resume';
    if (id === 'sound') setMuted(!isMuted());
    if (id === 'shake') setReduceShake(!reduceShake());
    if (id === 'quit') {
      if (this.t - this.armed < 3) return 'quit';
      this.armed = this.t;
    }
    return null;
  }

  draw(g: CanvasRenderingContext2D, input: Input): void {
    dim(g, 0.6);
    drawPaper(g, PANEL);
    drawFullscreenButton(g, input, { x: PANEL.x + PANEL.w - 24, y: PANEL.y + 6, w: 18, h: 18 });
    bigText(g, 'PAUSED', W / 2, PANEL.y + (this.auto ? 6 : 12), 2, { color: 'ink0', align: 'center' });
    if (this.auto) drawText(g, 'You looked away. The lot waited.', W / 2, PANEL.y + 31, { color: 'rust1', align: 'center' });
    this.ui.draw(g, input, this.buttons());
    if (menuPointing()) setCursorHint('point');
    drawText(g, touchUi() ? 'tap Resume to carry on' : 'P or Esc to carry on', W / 2, PANEL.y + PANEL.h - 16, { color: 'ink1', align: 'center' });
  }
}

/** Was the sound button pressed this step? (Plays the click.) */
export function muteButtonHit(input: Input): boolean {
  if (input.pressed && inRect(MUTE_BTN, input.pressX, input.pressY)) {
    playUi('click');
    return true;
  }
  return false;
}

/** The small sound button in the HUD: tap it (or M) to mute. */
export function drawMuteButton(g: CanvasRenderingContext2D, input: Input, muted: boolean): void {
  const over = inRect(MUTE_BTN, input.x, input.y);
  const down = over && input.down;
  if (over) setCursorHint('point');
  drawButton(g, MUTE_BTN, '', down ? 'down' : over ? 'hover' : 'idle');
  drawIcon(g, muted ? 'icon_mute' : 'icon_sound', MUTE_BTN.x + 1, MUTE_BTN.y + 1 + (down ? 1 : 0), muted ? 'red' : 'steel2');
}

/** Was the pause button pressed this step? (Plays the click.) */
export function pauseButtonHit(input: Input): boolean {
  if (input.pressed && inRect(PAUSE_BTN, input.pressX, input.pressY)) {
    playUi('click');
    return true;
  }
  return false;
}

export function overPauseButton(input: Input): boolean {
  return inRect(PAUSE_BTN, input.x, input.y);
}

/** The small pause button in the HUD. */
export function drawPauseButton(g: CanvasRenderingContext2D, input: Input, paused: boolean): void {
  const over = overPauseButton(input);
  const down = over && input.down;
  if (over) setCursorHint('point');
  drawButton(g, PAUSE_BTN, '', down ? 'down' : over ? 'hover' : 'idle');
  drawIcon(g, paused ? 'icon_play' : 'icon_pause', PAUSE_BTN.x + 1, PAUSE_BTN.y + 1 + (down ? 1 : 0), 'bone');
}
