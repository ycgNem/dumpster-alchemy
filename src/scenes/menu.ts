// What every menu screen shares: its clock, its buttons, its music, the fade in.
import { setIntensity, setMusic } from '../audio';
import type { Input } from '../engine/input';
import { drawCursor, setCursorHint } from '../render/cursor';
import { Buttons, fadeIn, menuPointing, setMenuPointing, type Btn } from '../render/menus';
import { tickArt } from '../render/sprites';
import type { Flow } from './flow';
import type { Scene } from './scene';

export type Music = 'title' | 'night' | 'report' | null;

export abstract class MenuScene implements Scene {
  /** Seconds since the scene came up. */
  t = 0;
  protected readonly ui = new Buttons();
  protected readonly flow: Flow;
  protected abstract readonly music: Music;
  /** Fade in from black when the scene comes up (the report doesn't: it lies over the lot). */
  protected readonly fade: boolean = true;

  constructor(flow: Flow) {
    this.flow = flow;
  }

  get input(): Input {
    return this.flow.host.input;
  }

  enter(): void {
    this.t = 0;
    this.ui.reset();
    setMenuPointing(false);
    setMusic(this.music);
    setIntensity(0);
  }

  audioReady(): void {
    setMusic(this.music);
  }

  /** This frame's buttons (built fresh, so labels and layout can follow the state). */
  protected abstract buttons(): Btn[];

  /** A button was clicked. */
  protected abstract press(id: string): void;

  /** Anything else the scene does each step (after the buttons). */
  protected step(_dt: number): void {}

  /** Draw everything under the buttons. */
  protected abstract paint(g: CanvasRenderingContext2D): void;

  /** Draw over the buttons (tooltips of the scene's own widgets, overlays). */
  protected paintOver(_g: CanvasRenderingContext2D): void {}

  update(dt: number): void {
    this.t += dt;
    tickArt(this.t);
    // Ignore clicks for a moment so the click that opened a screen doesn't press its buttons.
    const id = this.t > 0.15 ? this.ui.update(this.input, this.buttons()) : null;
    if (id) {
      this.press(id);
      return;
    }
    this.step(dt);
  }

  draw(g: CanvasRenderingContext2D): void {
    this.paint(g);
    this.ui.draw(g, this.input, this.buttons());
    this.paintOver(g);
    if (this.fade) fadeIn(g, this.t);
    if (menuPointing()) setCursorHint('point');
    drawCursor(g, this.input);
  }
}
