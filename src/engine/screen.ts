// A 640 x 360 logical screen drawn into an offscreen buffer, then blown up and letterboxed on the
// visible canvas. Nothing is ever smoothed.
//
// The scale (STYLE.md, "Rules"): a whole number when it fills at least WHOLE_FILL of the window,
// else the larger "fit" scale, drawn nearest-neighbour. A 1366 x 657 laptop window would get 1x
// whole (a quarter of the window); it gets ~1.8x fit instead, with a little pixel unevenness.
// On a phone held upright the game won't fit at any useful size, so a "turn your phone" card is
// drawn instead (main.ts pauses the scene while it's up).
import { PAL } from '../data/palette';

export const W = 640;
export const H = 360;
/** The portrait card's logical size (a phone held upright). */
export const PW = 180;
export const PH = 320;
/** Keep a whole-number scale when it fills at least this much of the fit scale. */
const WHOLE_FILL = 0.85;

export class Screen {
  readonly view: HTMLCanvasElement;
  readonly buf: HTMLCanvasElement;
  /** Draw the game here, in logical pixels. */
  readonly g: CanvasRenderingContext2D;
  /** The "turn your phone" card's buffer (PW x PH). */
  readonly pbuf: HTMLCanvasElement;
  readonly pg: CanvasRenderingContext2D;
  /** Device pixels per logical pixel (whole or fractional, see the top of the file). */
  scale = 1;
  /** A phone held upright: main.ts draws the rotate card instead of the game. */
  portrait = false;
  private readonly vg: CanvasRenderingContext2D;
  private ox = 0;
  private oy = 0;
  private dw = W;
  private dh = H;

  constructor(view: HTMLCanvasElement) {
    this.view = view;
    this.buf = document.createElement('canvas');
    this.buf.width = W;
    this.buf.height = H;
    this.g = context(this.buf);
    this.g.imageSmoothingEnabled = false;
    this.pbuf = document.createElement('canvas');
    this.pbuf.width = PW;
    this.pbuf.height = PH;
    this.pg = context(this.pbuf);
    this.pg.imageSmoothingEnabled = false;
    this.vg = context(view);
    window.addEventListener('resize', () => this.fit());
    window.addEventListener('orientationchange', () => this.fit());
    this.fit();
  }

  /** Size the visible canvas to the window at device resolution and pick the scale. */
  fit(): void {
    const dpr = window.devicePixelRatio || 1;
    const vw = Math.floor(window.innerWidth * dpr);
    const vh = Math.floor(window.innerHeight * dpr);
    this.view.width = vw;
    this.view.height = vh;
    this.view.style.width = `${window.innerWidth}px`;
    this.view.style.height = `${window.innerHeight}px`;
    this.vg.imageSmoothingEnabled = false; // resizing a canvas resets its context
    this.portrait = isPhone() && window.innerHeight > window.innerWidth;
    const [lw, lh] = this.portrait ? [PW, PH] : [W, H];
    this.scale = pickScale(vw / lw, vh / lh);
    this.dw = Math.round(lw * this.scale);
    this.dh = Math.round(lh * this.scale);
    // The pointer maps through the size actually drawn, so a fractional scale stays exact.
    this.scale = this.dw / lw;
    this.ox = Math.floor((vw - this.dw) / 2);
    this.oy = Math.floor((vh - this.dh) / 2);
  }

  /** Copy the buffer (or the portrait card) to the visible canvas. */
  present(): void {
    this.vg.imageSmoothingEnabled = false;
    // The rotate card's night sky runs to the edges; the game is letterboxed in ink.
    this.vg.fillStyle = this.portrait ? PAL.night0 : PAL.ink0;
    this.vg.fillRect(0, 0, this.view.width, this.view.height);
    this.vg.drawImage(this.portrait ? this.pbuf : this.buf, this.ox, this.oy, this.dw, this.dh);
  }

  /** Client (CSS) coordinates to logical pixels. */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const dpr = window.devicePixelRatio || 1;
    const r = this.view.getBoundingClientRect();
    return {
      x: ((clientX - r.left) * dpr - this.ox) / this.scale,
      y: ((clientY - r.top) * dpr - this.oy) / this.scale,
    };
  }
}

/** A whole number if it fills enough of the fit, else the fit itself (never below 1/4). */
export function pickScale(fx: number, fy: number): number {
  const fit = Math.max(0.25, Math.min(fx, fy));
  const whole = Math.floor(fit);
  return whole >= 1 && whole >= fit * WHOLE_FILL ? whole : fit;
}

/** A touch-first device with a small screen: a phone, or a small tablet. */
function isPhone(): boolean {
  const touch = (navigator.maxTouchPoints ?? 0) > 0 || window.matchMedia?.('(pointer: coarse)').matches === true;
  return touch && Math.min(window.innerWidth, window.innerHeight) < 600;
}

function context(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D is not available');
  return g;
}
