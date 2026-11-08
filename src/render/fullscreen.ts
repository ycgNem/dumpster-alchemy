// The little fullscreen button (an 18 x 18 cardboard button with four corner brackets: out to go
// fullscreen, in to come back). Hidden where the page can't go fullscreen (iPhone Safari). The
// toggle itself happens in the pointer handler (src/engine/fullscreen.ts): drawing the button
// registers where it is for this frame.
import { canFullscreen, fullscreenHotspot, isFullscreen } from '../engine/fullscreen';
import type { Input } from '../engine/input';
import { setCursorHint } from './cursor';
import { fillRect } from './greybox';
import { inRect, type Rect } from './layout';
import { drawButton } from './menus';

/** Corner brackets inside the 16 x 16 icon square, as [x, y, w, h]: pointing out (enter). */
const ENTER: readonly (readonly [number, number, number, number])[] = [
  [2, 2, 5, 2], [2, 2, 2, 5],
  [9, 2, 5, 2], [12, 2, 2, 5],
  [2, 12, 5, 2], [2, 9, 2, 5],
  [9, 12, 5, 2], [12, 9, 2, 5],
];
/** ...and pointing in (leave). */
const LEAVE: readonly (readonly [number, number, number, number])[] = [
  [2, 5, 5, 2], [5, 2, 2, 5],
  [9, 5, 5, 2], [9, 2, 2, 5],
  [2, 9, 5, 2], [5, 9, 2, 5],
  [9, 9, 5, 2], [9, 9, 2, 5],
];

/** A fullscreen button at r (stage coordinates; keep it on the stage). F does the same anywhere. */
export function drawFullscreenButton(g: CanvasRenderingContext2D, input: Input, r: Rect): void {
  if (!canFullscreen()) return;
  fullscreenHotspot(r);
  const over = inRect(r, input.x, input.y);
  const down = over && input.down;
  if (over) setCursorHint('point');
  drawButton(g, r, '', down ? 'down' : over ? 'hover' : 'idle');
  const x = r.x + Math.floor((r.w - 16) / 2);
  const y = r.y + Math.floor((r.h - 16) / 2) + (down ? 1 : 0);
  for (const [bx, by, bw, bh] of isFullscreen() ? LEAVE : ENTER) fillRect(g, { x: x + bx, y: y + by, w: bw, h: bh }, 'ink0');
}
