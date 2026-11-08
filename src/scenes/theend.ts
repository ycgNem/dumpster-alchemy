// After night 10: the Trash King is crowned. A spotlight, the King blown up big, junk confetti,
// the regulars hopping, then Endless unlocks.
import { RACCOONS } from '../data/raccoons';
import { H, W } from '../engine/screen';
import type { Run } from '../game/run';
import { PAL, type PalName } from '../data/palette';
import { fillRect, placeholderRaccoon } from '../render/greybox';
import { bigText, buttonRow, drawItemBig, drawPaper, fmt, menuBackdrop, type Btn } from '../render/menus';
import { drawSprite } from '../render/sprites';
import { drawText, textWidth } from '../render/text';
import type { Flow } from './flow';
import { MenuScene, type Music } from './menu';

const CONFETTI: readonly PalName[] = ['sodium3', 'yellow', 'toxic2', 'pink', 'blue', 'bone', 'rust3', 'steel3'];

export class TheEndScene extends MenuScene {
  protected readonly music: Music = 'title';
  private readonly run: Run;

  constructor(flow: Flow, run: Run) {
    super(flow);
    this.run = run;
  }

  protected buttons(): Btn[] {
    if (this.t < 2.2) return [];
    return buttonRow(
      [
        ['endless', 'Endless Shift', { keys: ['Enter', 'Space'], icon: 'icon_play' }],
        ['title', 'Title', { keys: ['Escape'], sound: 'back' }],
      ],
      W / 2,
      318,
      132,
      22,
    );
  }

  protected press(id: string): void {
    if (id === 'endless') this.flow.nightCard();
    else this.flow.title();
  }

  protected paint(g: CanvasRenderingContext2D): void {
    menuBackdrop(g, this.t, 0.6);
    const t = this.t;

    // The spotlight.
    const a = g.globalAlpha;
    g.globalAlpha = 0.18 + 0.04 * Math.sin(t * 3);
    g.fillStyle = PAL.sodium3;
    g.beginPath();
    g.moveTo(W / 2 - 14, 0);
    g.lineTo(W / 2 + 14, 0);
    g.lineTo(W / 2 + 110, 262);
    g.lineTo(W / 2 - 110, 262);
    g.closePath();
    g.fill();
    g.globalAlpha = a;

    // Junk confetti.
    for (let i = 0; i < 70; i++) {
      const speed = 30 + ((i * 37) % 50);
      const x = (i * 97 + Math.sin(t * 2 + i) * 8) % W;
      const y = ((t * speed + i * 53) % (H + 20)) - 10;
      fillRect(g, { x, y, w: 2 + (i % 2), h: 2 }, CONFETTI[i % CONFETTI.length] ?? 'bone');
    }

    // The King, rising into place, then bouncing.
    const rise = Math.min(1, t / 1.2);
    const bounce = rise >= 1 ? Math.round(Math.abs(Math.sin(t * 3)) * -4) : 0;
    const ky = 262 + Math.round((1 - rise) * (1 - rise) * 160) + bounce;
    fillRect(g, { x: W / 2 - 60, y: 258, w: 120, h: 6 }, 'ink0');
    // The 96 px portrait at 1x (the same pixel size as everything else), or the item blown up
    // until it's drawn.
    if (!drawSprite(g, 'king_portrait', W / 2, ky, { frame: Math.floor(t * 2) % 2 })) drawItemBig(g, 'king', W / 2, ky, 3, t);

    // The regulars cheering.
    const spots = [120, 190, 450, 520];
    RACCOONS.forEach((r, i) => {
      const x = spots[i] ?? 0;
      const hop = Math.round(Math.abs(Math.sin(t * 6 + i)) * -6);
      const flip = i >= 2;
      if (!drawSprite(g, `raccoon_${r.id}_happy`, x, 300 + hop, { flip }) && !drawSprite(g, `raccoon_${r.id}_idle`, x, 300 + hop, { flip })) {
        placeholderRaccoon(g, r.id, 'happy', false, x, 300 + hop);
      }
    });
    drawSprite(g, 'possum_dead', 320, 304);

    bigText(g, 'THE TRASH KING', W / 2, 14, 3, { color: 'sodium3', outline: 'ink0', align: 'center' });
    bigText(g, 'IS CROWNED', W / 2, 50, 2, { color: 'sodium3', outline: 'ink0', align: 'center' });
    drawText(g, 'Lot 9 is officially the stinkiest landfill in the county.', W / 2, 78, { color: 'bone', align: 'center', outline: 'ink0' });

    if (t > 2.2) {
      const st = this.run.stats;
      const line = `${st.nightsWon} night${st.nightsWon === 1 ? '' : 's'} passed · ${fmt(st.earned)} Shinies earned · ${fmt(st.merges)} merges`;
      const w = textWidth(line) + 20;
      drawPaper(g, { x: Math.round(W / 2 - w / 2), y: 92, w, h: 18 });
      drawText(g, line, W / 2, 96, { color: 'ink0', align: 'center' });
      if (Math.sin(t * 5) > -0.4) drawText(g, 'ENDLESS SHIFT UNLOCKED', W / 2, 344, { color: 'toxic3', align: 'center', outline: 'ink0' });
    }
  }
}
