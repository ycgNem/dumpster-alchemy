// "Turn your phone": drawn instead of the game on a phone held upright (src/engine/screen.ts).
// A little phone tips over to landscape, a raccoon waits underneath. The night is paused while
// it's up (main.ts doesn't step the scene).
import { PH, PW } from '../engine/screen';
import { fillRect, outlineRect, placeholderRaccoon } from './greybox';
import { drawNine, drawSprite } from './sprites';
import { drawText, wrapText } from './text';

export function drawRotateCard(g: CanvasRenderingContext2D, t: number): void {
  fillRect(g, { x: 0, y: 0, w: PW, h: PH }, 'night0');
  for (let i = 0; i < 24; i++) fillRect(g, { x: (i * 53) % PW, y: (i * 37) % 120, w: 1, h: 1 }, i % 5 === 0 ? 'night3' : 'night2');

  // The phone: upright for a beat, then lying on its side, over and over.
  const cycle = t % 2.4;
  const side = cycle > 1.1 && cycle < 2.2;
  const cx = PW / 2;
  const cy = 108;
  const [w, h] = side ? [64, 36] : [36, 64];
  const r = { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
  fillRect(g, { x: r.x + 2, y: r.y + 2, w, h }, 'ink0');
  fillRect(g, r, 'steel1');
  outlineRect(g, r, 'ink0');
  const screen = { x: r.x + 4, y: r.y + 4, w: w - 8, h: h - 8 };
  fillRect(g, screen, side ? 'dirt1' : 'night1');
  if (side) {
    // A tiny board on the landscape screen.
    for (let i = 0; i < 4; i++) fillRect(g, { x: screen.x + 10 + i * 9, y: screen.y + 6, w: 7, h: 7 }, i % 2 ? 'dirt2' : 'dirt3');
    fillRect(g, { x: screen.x + 14, y: screen.y + 16, w: 6, h: 5 }, 'red');
  }
  // A curved arrow while it's upright.
  if (!side) {
    const a = { x: cx + 26, y: cy - 22 };
    for (let i = 0; i < 6; i++) fillRect(g, { x: a.x + Math.round(Math.sin(i / 5) * 8), y: a.y + i * 4, w: 2, h: 2 }, 'sodium3');
    fillRect(g, { x: a.x + 3, y: a.y + 22, w: 6, h: 2 }, 'sodium3');
    fillRect(g, { x: a.x + 7, y: a.y + 18, w: 2, h: 6 }, 'sodium3');
  }

  // The words on a scrap of paper.
  const note = { x: 16, y: 166, w: PW - 32, h: 70 };
  if (!drawNine(g, 'paper', note)) {
    fillRect(g, { x: note.x + 2, y: note.y + 2, w: note.w, h: note.h }, 'ink0');
    fillRect(g, note, 'bone');
  }
  drawText(g, 'TURN YOUR PHONE', PW / 2, note.y + 8, { color: 'ink0', align: 'center' });
  wrapText('Lot 9 is a sideways kind of place. The night waits for you.', note.w - 16).forEach((l, i) =>
    drawText(g, l, PW / 2, note.y + 24 + i * 10, { color: 'ink1', align: 'center' }),
  );

  // Gary, unimpressed.
  const blink = t % 3.3 < 0.14;
  if (!drawSprite(g, 'raccoon_gary_idle', PW / 2, PH - 14, { frame: blink ? 1 : 0 })) placeholderRaccoon(g, 'gary', 'idle', blink, PW / 2, PH - 14);
}
