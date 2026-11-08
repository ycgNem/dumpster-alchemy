// The raccoon-paw cursor: `cursor_open`, `cursor_grab` while holding a piece, `cursor_point` over
// something clickable. The system cursor is hidden on the canvas only while a paw is drawn, and
// never for touch (a finger has no cursor). Any scene can use it:
//
//   setCursorHint('point');            // this frame, the pointer is over a button
//   drawCursor(g, host.input);         // last thing drawn each frame
//
// The hint lasts one frame (drawCursor clears it). If nobody draws the paw for a moment (a scene
// that doesn't call it), the system cursor comes back by itself.
import { NO_POINTER } from '../engine/input';
import { drawSprite, has } from './sprites';

export type CursorHint = 'point' | 'grab' | null;

/** What drawCursor needs from the input (src/engine/input.ts). */
export interface CursorInput {
  x: number;
  y: number;
  pointerType: string;
}

let hint: CursorHint = null;
let lastDrawn = 0;
let hidden = false;
let inside = true;
let watching = false;

function canvas(): HTMLCanvasElement | null {
  const el = document.getElementById('view');
  return el instanceof HTMLCanvasElement ? el : null;
}

function showSystem(show: boolean): void {
  if (hidden === !show) return;
  const c = canvas();
  if (!c) return;
  c.style.cursor = show ? '' : 'none';
  hidden = !show;
}

/** Start watching once: the pointer leaving the canvas, and scenes that stop drawing the paw. */
function watch(): void {
  if (watching) return;
  watching = true;
  const c = canvas();
  c?.addEventListener('pointerleave', () => {
    inside = false;
  });
  c?.addEventListener('pointerenter', () => {
    inside = true;
  });
  window.setInterval(() => {
    if (hidden && performance.now() - lastDrawn > 200) showSystem(true);
  }, 250);
}

/** Point or grab for this frame (a scene calls it each frame it's over something clickable). */
export function setCursorHint(h: CursorHint): void {
  hint = h;
}

/** Draw the paw at the pointer (logical pixels). Call it last, after everything else. */
export function drawCursor(g: CanvasRenderingContext2D, input: CursorInput): void {
  if (typeof document === 'undefined') return;
  watch();
  const name = hint === 'grab' ? 'cursor_grab' : hint === 'point' ? 'cursor_point' : 'cursor_open';
  hint = null;
  const paw = input.pointerType !== 'touch' && has(name);
  lastDrawn = performance.now();
  showSystem(!paw);
  // (The pointer can be in the margins, at negative stage coordinates; NO_POINTER is "not yet".)
  if (paw && inside && input.x > NO_POINTER) drawSprite(g, name, Math.round(input.x), Math.round(input.y));
}
