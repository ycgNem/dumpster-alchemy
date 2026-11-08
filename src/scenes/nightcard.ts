// The night card: "Night 3", its name, the tease, the quota (or the goal), what's new tonight.
// Click the card (or Clock In) to start the shift.
import { BIN_JUICE, UPGRADES } from '../data/upgrades';
import { nightDef } from '../data/nights';
import { tapWord } from '../engine/input';
import { W } from '../engine/screen';
import { LOST_KEEP, isEndless, retryEase, type Run } from '../game/run';
import { drawItem } from '../render/board';
import type { PalName } from '../data/palette';
import { fillRect, outlineRect } from '../render/greybox';
import { inRect, type Rect } from '../render/layout';
import { bigText, buttonRow, drawAt, drawIcon, drawPanel, drawPaper, fmt, menuBackdrop, menuPointing, setMenuPointing, type Btn } from '../render/menus';
import { drawText, textWidth, wrapText } from '../render/text';
import type { Flow } from './flow';
import { MenuScene, type Music } from './menu';

const CARD = { x: 130, y: 34, w: 380, h: 254 };

export class NightCardScene extends MenuScene {
  protected readonly music: Music = 'title';
  private readonly run: Run;

  constructor(flow: Flow, run: Run) {
    super(flow);
    this.run = run;
  }

  protected buttons(): Btn[] {
    return buttonRow(
      [
        ['go', 'Clock In', { keys: ['Enter', 'Space'], icon: 'icon_play' }],
        ['swap', 'Swap Meet', { keys: ['KeyS'], tip: `Spend the bank (${fmt(this.run.bank)} Shinies) before you start.` }],
        ['back', 'Title', { keys: ['Escape'], sound: 'back' }],
      ],
      W / 2,
      300,
      112,
      22,
    );
  }

  protected press(id: string): void {
    if (id === 'go') this.flow.clockIn();
    else if (id === 'swap') this.flow.swapMeet();
    else this.flow.title();
  }

  protected step(): void {
    const { input } = this;
    // The whole card is a button too.
    const over = inRect(CARD, input.x, input.y);
    setMenuPointing(menuPointing() || over);
    if (this.t > 0.3 && input.released && inRect(CARD, input.x, input.y) && inRect(CARD, input.pressX, input.pressY)) {
      this.flow.clockIn();
    }
  }

  protected paint(g: CanvasRenderingContext2D): void {
    menuBackdrop(g, this.t, 0.55);
    const run = this.run;
    const n = nightDef(run.night);
    const endless = isEndless(run);
    // The card drops in from above with a little bounce.
    const k = Math.min(1, this.t / 0.35);
    const drop = Math.round((1 - k) * (1 - k) * -60 + Math.sin(Math.min(1, this.t / 0.5) * Math.PI) * 3);
    const r = { ...CARD, y: CARD.y + drop };
    drawPanel(g, r);
    const cx = r.x + r.w / 2;

    bigText(g, endless ? 'ENDLESS' : `NIGHT ${n.night}`, cx, r.y + 12, 3, { color: 'ink0', align: 'center' });
    bigText(g, n.name.toUpperCase(), cx, r.y + 48, 2, { color: 'rust1', align: 'center' });
    wrapText(n.tease, r.w - 40).forEach((l, i) => drawText(g, l, cx, r.y + 74 + i * 10, { color: 'ink1', align: 'center' }));

    // The goal, on a strip of paper.
    const strip = { x: r.x + 24, y: r.y + 96, w: r.w - 48, h: 30 };
    drawPaper(g, strip);
    if (n.goal === 'king') {
      drawItem(g, 'king', strip.x + 22, strip.y + 30);
      drawText(g, 'GOAL: build THE TRASH KING by 6 AM', strip.x + 42, strip.y + 6, { color: 'ink0' });
      drawText(g, 'Raccoons pay in junk tonight, for the build.', strip.x + 42, strip.y + 16, { color: 'ink1' });
    } else if (endless) {
      drawIcon(g, 'icon_star', strip.x + 10, strip.y + 7, 'yellow');
      drawText(g, `SCORE = Shinies before the Stink wins`, strip.x + 32, strip.y + 6, { color: 'ink0' });
      drawText(g, `Best so far: ${fmt(run.endlessBest)}`, strip.x + 32, strip.y + 16, { color: 'ink1' });
    } else {
      drawIcon(g, 'icon_shiny', strip.x + 10, strip.y + 7, 'yellow');
      bigText(g, fmt(n.quota), strip.x + 32, strip.y + 5, 2, { color: 'ink0' });
      drawText(g, 'Shinies by 6 AM', strip.x + 40 + textWidth(fmt(n.quota)) * 2, strip.y + 10, { color: 'ink1' });
    }

    // The night's one rule, big, on a strip of hazard tape: "TONIGHT" and what's different.
    const band = { x: r.x + 24, y: r.y + 132, w: r.w - 48, h: 34 };
    const lx = band.x + 8 + textWidth('TONIGHT') * 2 + 10;
    const rule = wrapText(n.rule, band.x + band.w - 8 - lx).slice(0, 2);
    hazardStrip(g, band);
    bigText(g, 'TONIGHT', band.x + 8, band.y + 6, 2, { color: 'red' });
    rule.forEach((l, i) => drawText(g, l, lx, band.y + (rule.length > 1 ? 7 : 12) + i * 10, { color: 'ink0' }));

    // Then, as room allows: a retry's note, Bin Juice waiting, what else is new.
    const notes: [string, PalName][] = [];
    if (run.tries > 0 && !endless) notes.push([`Try #${run.tries + 1}. Last time you kept ${Math.round(LOST_KEEP * 100)}% of the Shinies.`, 'rust1']);
    if (retryEase(run) < 1) notes.unshift(['The crew aired the lot out: it reeks a little less this try.', 'toxic0']);
    if (run.binJuice > 0) notes.push([`${BIN_JUICE.name} x${run.binJuice} waiting in the Dumpster.`, 'toxic0']);
    for (const line of n.news) notes.push([line, 'ink1']);
    notes
      .filter(([l]) => textWidth(l) <= r.w - 48)
      .slice(0, 2)
      .forEach(([l, c], i) => drawText(g, l, cx, r.y + 172 + i * 10, { color: c, align: 'center' }));

    this.drawGear(g, r.x + 24, r.y + 203, r.w - 48);

    if (this.t > 0.5 && Math.sin(this.t * 4) > -0.5) {
      drawText(g, `${tapWord()} the card to clock in`, cx, r.y + r.h - 16, { color: 'ink1', align: 'center' });
    }
  }

  /** What the Swap Meet has sold you so far: each upgrade's icon with its level. */
  private drawGear(g: CanvasRenderingContext2D, x: number, y: number, w: number): void {
    const owned = UPGRADES.filter((u) => this.run.levels[u.id] > 0);
    fillRect(g, { x, y: y - 4, w, h: 1 }, 'card0');
    if (owned.length === 0) {
      drawText(g, 'No gear yet. The Swap Meet takes Shinies.', x, y + 6, { color: 'ink1' });
      return;
    }
    drawText(g, 'GEAR', x, y + 8, { color: 'ink0' });
    owned.forEach((u, i) => {
      const gx = x + 34 + i * 50;
      if (!drawAt(g, u.icon, gx, y)) fillRect(g, { x: gx + 2, y: y + 2, w: 20, h: 20 }, 'steel2');
      drawText(g, `x${this.run.levels[u.id]}`, gx + 26, y + 8, { color: 'ink0' });
    });
  }
}

/** A strip of bone paper edged with yellow-and-ink hazard tape (the night's rule sits on it). */
function hazardStrip(g: CanvasRenderingContext2D, r: Rect): void {
  fillRect(g, { x: r.x + 2, y: r.y + 2, w: r.w, h: r.h }, 'ink0');
  fillRect(g, r, 'bone');
  for (const y of [r.y, r.y + r.h - 4]) {
    fillRect(g, { x: r.x, y, w: r.w, h: 4 }, 'yellow');
    for (let x = 0; x < r.w; x += 8) {
      for (let k = 0; k < 4; k++) fillRect(g, { x: r.x + ((x + k) % r.w), y: y + k, w: 3, h: 1 }, 'ink0');
    }
  }
  outlineRect(g, r, 'ink0');
}
