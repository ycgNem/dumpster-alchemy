// After night 10: the Trash King is crowned. A spotlight, the King blown up big, junk confetti,
// the regulars hopping, then the run's end card. Also here: that end card (RunOverScene), for a
// run won or FIRED (the third strike): the run's numbers, what it unlocked, and New Run.
import { playRun } from '../audio';
import { RACCOONS } from '../data/raccoons';
import { W, viewRect } from '../engine/screen';
import { ITEMS, junkAt } from '../data/items';
import { NIGHT_COUNT } from '../data/nights';
import { TUNING } from '../data/tuning';
import { unlockLines } from '../game/meta';
import { currentNight, type Run } from '../game/run';
import { drawPerk } from '../render/run';
import { PAL, type PalName } from '../data/palette';
import { fillRect, placeholderPossum, placeholderRaccoon } from '../render/greybox';
import { bigText, buttonRow, drawClipboard, drawItemBig, drawPaper, drawStamp, fmt, menuBackdrop, type Btn } from '../render/menus';
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
        ['next', 'Run Stats', { keys: ['Enter', 'Space'], icon: 'icon_play' }],
        ['title', 'Title', { keys: ['Escape'], sound: 'back' }],
      ],
      W / 2,
      318,
      132,
      22,
    );
  }

  protected press(id: string): void {
    if (id === 'next') this.flow.runOver();
    else this.flow.title();
  }

  protected step(dt: number): void {
    // The run is won: the big march as the King settles on his spot.
    if (this.t >= 1.1 && this.t - dt < 1.1) playRun('runWon');
  }

  protected paint(g: CanvasRenderingContext2D): void {
    menuBackdrop(g, this.t, 0.6, 'trashmore');
    const t = this.t;

    // The spotlight.
    const a = g.globalAlpha;
    g.globalAlpha = 0.18 + 0.04 * Math.sin(t * 3);
    g.fillStyle = PAL.sodium3;
    g.beginPath();
    const vr = viewRect(); // (from the top of the whole buffer: a tall window has a margin above the stage)
    g.moveTo(W / 2 - 14, vr.y);
    g.lineTo(W / 2 + 14, vr.y);
    g.lineTo(W / 2 + 110, 262);
    g.lineTo(W / 2 - 110, 262);
    g.closePath();
    g.fill();
    g.globalAlpha = a;

    // Junk confetti.
    for (let i = 0; i < 70; i++) {
      const speed = 30 + ((i * 37) % 50);
      const x = vr.x + ((i * 97 + Math.sin(t * 2 + i) * 8) % vr.w);
      const y = vr.y + ((t * speed + i * 53) % (vr.h + 20)) - 10;
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
    drawText(g, 'The County Dump is officially the stinkiest in the state.', W / 2, 78, { color: 'bone', align: 'center', outline: 'ink0' });

    if (t > 2.2) {
      const st = this.run.stats;
      const line = `${st.nightsWon} night${st.nightsWon === 1 ? '' : 's'} passed · ${fmt(st.earned)} Shinies earned · ${fmt(st.merges)} merges`;
      const w = textWidth(line) + 20;
      drawPaper(g, { x: Math.round(W / 2 - w / 2), y: 92, w, h: 18 });
      drawText(g, line, W / 2, 96, { color: 'ink0', align: 'center' });
      if (Math.sin(t * 5) > -0.4) drawText(g, 'THE RUN IS WON', W / 2, 344, { color: 'toxic3', align: 'center', outline: 'ink0' });
    }
  }
}

/** The run's end card: FIRED (three strikes) or the win (the King). */
export class RunOverScene extends MenuScene {
  protected readonly music: Music = 'report';
  private readonly run: Run;

  constructor(flow: Flow, run: Run) {
    super(flow);
    this.run = run;
  }

  protected buttons(): Btn[] {
    if (this.t < 0.8) return [];
    return buttonRow(
      [
        ['new', 'New Run', { keys: ['Enter', 'Space'], icon: 'icon_play' }],
        ['title', 'Title', { keys: ['Escape'], sound: 'back' }],
      ],
      W / 2,
      318,
      132,
      22,
    );
  }

  protected press(id: string): void {
    if (id === 'new') this.flow.newGame();
    else this.flow.title();
  }

  protected step(dt: number): void {
    // FIRED: the pink slip's stamp, then the sad trombone (the win already had its march).
    if (this.run.over !== 'won' && this.t >= 0.5 && this.t - dt < 0.5) playRun('fired');
  }

  protected paint(g: CanvasRenderingContext2D): void {
    const run = this.run;
    const won = run.over === 'won';
    menuBackdrop(g, this.t, 0.6, won ? 'trashmore' : 'lot9');
    const r = { x: 150, y: 20, w: 340, h: 284 };
    const a = drawClipboard(g, r);
    const x = a.x + 6;
    // The Possum, top right: keeled over for a win, pink slip up for FIRED.
    const px = r.x + r.w - 46;
    const py = a.y + 60;
    const pose = won ? 'dead' : 'shutdown';
    if (!drawSprite(g, `possum_${pose}`, px, py) && !drawSprite(g, 'possum_idle', px, py)) placeholderPossum(g, pose, px, py);
    bigText(g, won ? 'RUN WON!' : 'FIRED!', x, a.y + 4, won ? 2 : 3, { color: won ? 'toxic0' : 'red' });
    drawText(g, won ? 'The Trash King sits on his throne.' : 'Three strikes. Clean out your locker.', x, a.y + (won ? 30 : 40), { color: 'ink1' });

    const st = run.stats;
    const best = st.bestTier > 0 ? ITEMS[junkAt(st.bestTier)].name : '-';
    const rows: [string, string][] = [
      ['Nights passed', `${st.nightsWon} of ${NIGHT_COUNT}`],
      ['Reached', won ? 'the King' : `Night ${run.night}: ${currentNight(run).name}`],
      ['Shinies earned', fmt(st.earned)],
      ['Best junk', best],
      ['Orders filled', String(st.ordersFilled)],
      ['Merges / brews', `${st.merges} / ${st.brews}`],
      ['Strikes', `${run.strikes} of ${TUNING.run.strikes}`],
    ];
    const y0 = a.y + 62;
    rows.forEach(([l, v], i) => {
      drawText(g, l, x, y0 + i * 12, { color: 'ink1' });
      drawText(g, v, a.x + a.w - 60, y0 + i * 12, { color: 'ink0', align: 'right' });
    });
    // The Contraband you ended with.
    let y = y0 + rows.length * 12 + 4;
    drawText(g, 'CONTRABAND', x, y + 8, { color: 'ink0' });
    run.slots.forEach((id, i) => drawPerk(g, id, x + 82 + i * 28, y));
    if (run.slots.length === 0) drawText(g, "none", x + 82, y + 8, { color: "ink1" });
    y += 32;
    // Unlocks earned this run.
    const lines = run.earned.flatMap((m) => unlockLines(m));
    drawText(g, lines.length > 0 ? 'UNLOCKED THIS RUN' : 'No new unlocks this run.', x, y, { color: lines.length > 0 ? 'toxic0' : 'ink1' });
    lines.slice(0, 4).forEach((l, i) => drawText(g, `+ ${l}`, x + 6, y + 12 + i * 10, { color: 'ink0' }));
    if (lines.length > 4) drawText(g, `+ ${lines.length - 4} more`, x + 6, y + 52, { color: 'ink1' });
    drawStamp(g, won, a.x + a.w - 58, a.y + a.h - 26, this.t - 0.5);
  }
}
