// The 640 x 360 stage, drawn into an offscreen buffer that takes the window's shape, then blown
// up to fill the visible canvas. Nothing is ever smoothed. (docs/V2.md, pillar 4.)
//
// - The stage (W x H) is always fully visible and centred in the buffer.
// - The buffer grows in one dimension to match the window: a wider window gets extra width, a
//   taller one (16:10, 4:3) extra height. No bars, nothing cropped.
// - It's drawn at the fit scale, nearest-neighbour. Fractional scales give a little pixel
//   unevenness; that beats bars.
// - Scenes draw in stage coordinates: main.ts translates to the stage before `scene.draw`, so
//   anything drawn outside 0..W x 0..H lands in the margins. `viewRect()` is the whole visible
//   buffer in stage coordinates: every full-screen fill (dims, fades, vignettes, bands) uses it.
// - The pointer maps to stage coordinates too (`toLogical`), exactly as before.
// - On a phone held upright the game won't fit at any useful size, so a "turn your phone" card is
//   drawn instead (main.ts pauses the scene while it's up).
import { PAL } from '../data/palette';

/** The stage: the layout every scene is built on. */
export const W = 640;
export const H = 360;
/** The portrait card's logical size (a phone held upright). */
export const PW = 180;
export const PH = 320;
/** The stage's horizon rows: the sky ends and the truck lane starts, the lane ends and the dirt starts. */
const SKY_END = 56;
const LANE_END = 104;
/** A sanity cap on the buffer (logical px either way). Past it, present() fills with sky and dirt. */
const MAX_BUF = 4096;

/** The visible buffer in stage coordinates (the stage's top-left is 0,0 inside it). */
let view = { x: 0, y: 0, w: W, h: H };

/**
 * The whole visible buffer in stage coordinates: x and y are zero or negative (the left and top
 * margins), w and h at least W and H. Use it for anything that should cover the screen.
 */
export function viewRect(): { x: number; y: number; w: number; h: number } {
  return { ...view };
}

/**
 * The backstop under every scene: sky above the lane, the lane, dirt below, across the whole
 * buffer. It's what shows past a backdrop's edges (windows wider than about 2.6:1).
 */
export function backstop(g: CanvasRenderingContext2D): void {
  const v = view;
  g.fillStyle = PAL.night0;
  g.fillRect(v.x, v.y, v.w, SKY_END - v.y);
  g.fillStyle = PAL.dirt1;
  g.fillRect(v.x, SKY_END, v.w, LANE_END - SKY_END);
  g.fillStyle = PAL.ink1;
  g.fillRect(v.x, LANE_END, v.w, v.y + v.h - LANE_END);
}

export class Screen {
  readonly view: HTMLCanvasElement;
  readonly buf: HTMLCanvasElement;
  /** Draw the game here. main.ts translates it to the stage (see `stageX`, `stageY`). */
  readonly g: CanvasRenderingContext2D;
  /** The "turn your phone" card's buffer (PW x PH). */
  readonly pbuf: HTMLCanvasElement;
  readonly pg: CanvasRenderingContext2D;
  /** Device pixels per logical pixel (the fit; fractional). */
  scale = 1;
  /** A phone held upright: main.ts draws the rotate card instead of the game. */
  portrait = false;
  /** Where the stage's top-left sits in the buffer (logical px). */
  stageX = 0;
  stageY = 0;
  private readonly vg: CanvasRenderingContext2D;
  /** The buffer's (or the card's) top-left and drawn size on the visible canvas, device px. */
  private ox = 0;
  private oy = 0;
  private dw = W;
  private dh = H;
  /** Device px per logical px, each way (they differ by a hair after rounding). */
  private kx = 1;
  private ky = 1;
  /** The window this fit was made for, to catch a change no event told us about. */
  private fitFor = '';

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
    const refit = (): void => this.fit();
    window.addEventListener('resize', refit);
    window.addEventListener('orientationchange', refit);
    document.addEventListener('fullscreenchange', refit);
    document.addEventListener('webkitfullscreenchange', refit);
    this.fit();
  }

  /** Size the visible canvas to the window at device resolution, then size the buffer to match. */
  fit(): void {
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, window.innerWidth);
    const ch = Math.max(1, window.innerHeight);
    this.fitFor = `${cw}x${ch}@${dpr}`;
    const vw = Math.max(1, Math.floor(cw * dpr));
    const vh = Math.max(1, Math.floor(ch * dpr));
    this.view.width = vw;
    this.view.height = vh;
    this.view.style.width = `${cw}px`;
    this.view.style.height = `${ch}px`;
    this.vg.imageSmoothingEnabled = false; // resizing a canvas resets its context
    this.portrait = isPhone() && ch > cw;

    if (this.portrait) {
      // The rotate card: fit, centred, the night sky around it (present()).
      const s = Math.min(vw / PW, vh / PH);
      this.place(vw, vh, PW, PH, s);
      return;
    }
    // The buffer: the stage plus margins in one direction, in the window's shape.
    let bw = W;
    let bh = H;
    let s: number;
    if (vw / vh >= W / H) {
      s = vh / H;
      bw = Math.min(MAX_BUF, Math.ceil(vw / s - 1e-6));
    } else {
      s = vw / W;
      bh = Math.min(MAX_BUF, Math.ceil(vh / s - 1e-6));
    }
    if (bw === MAX_BUF || bh === MAX_BUF) s = Math.min(vw / bw, vh / bh);
    if (this.buf.width !== bw || this.buf.height !== bh) {
      this.buf.width = bw;
      this.buf.height = bh;
      this.g.imageSmoothingEnabled = false;
    }
    this.stageX = Math.floor((bw - W) / 2);
    this.stageY = Math.floor((bh - H) / 2);
    view = { x: -this.stageX, y: -this.stageY, w: bw, h: bh };
    this.place(vw, vh, bw, bh, s);
  }

  /** Centre a lw x lh logical image at scale s on the vw x vh canvas. */
  private place(vw: number, vh: number, lw: number, lh: number, s: number): void {
    this.dw = Math.max(1, Math.round(lw * s));
    this.dh = Math.max(1, Math.round(lh * s));
    // The pointer maps through the size actually drawn, so a fractional scale stays exact.
    this.kx = this.dw / lw;
    this.ky = this.dh / lh;
    this.scale = this.kx;
    this.ox = Math.floor((vw - this.dw) / 2);
    this.oy = Math.floor((vh - this.dh) / 2);
  }

  /**
   * Refit if the window changed without an event telling us (some zooms, some fullscreen exits).
   * main.ts calls it before drawing a frame, so a resize never clears a frame already drawn.
   */
  ensureFit(): void {
    if (this.fitFor !== `${Math.max(1, window.innerWidth)}x${Math.max(1, window.innerHeight)}@${window.devicePixelRatio || 1}`) this.fit();
  }

  /** Copy the buffer (or the portrait card) to the visible canvas. */
  present(): void {
    const vg = this.vg;
    vg.imageSmoothingEnabled = false;
    const vw = this.view.width;
    const vh = this.view.height;
    const covered = this.ox <= 0 && this.oy <= 0 && this.ox + this.dw >= vw && this.oy + this.dh >= vh;
    if (this.portrait) {
      // The rotate card's night sky runs to the edges.
      vg.fillStyle = PAL.night0;
      vg.fillRect(0, 0, vw, vh);
    } else if (!covered) {
      // Only past the sanity cap: sky above the stage's lane, dirt below. Never ink bars.
      const horizon = Math.round(this.oy + (this.stageY + SKY_END) * this.ky);
      vg.fillStyle = PAL.night0;
      vg.fillRect(0, 0, vw, horizon);
      vg.fillStyle = PAL.ink1;
      vg.fillRect(0, horizon, vw, vh - horizon);
    }
    vg.drawImage(this.portrait ? this.pbuf : this.buf, this.ox, this.oy, this.dw, this.dh);
  }

  /** Client (CSS) coordinates to stage coordinates (logical px; the stage's top-left is 0,0). */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const dpr = window.devicePixelRatio || 1;
    const r = this.view.getBoundingClientRect();
    return {
      x: ((clientX - r.left) * dpr - this.ox) / this.kx - this.stageX,
      y: ((clientY - r.top) * dpr - this.oy) / this.ky - this.stageY,
    };
  }
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
