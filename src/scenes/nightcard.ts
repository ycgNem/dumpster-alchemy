// The night card: "Night 3" (or the Daily Dump's number), its name, the act, the tease, the
// quota (or the goal), the night's rule on hazard tape, the reward tag, what's new tonight, the
// recipe tip, and the Contraband you're bringing. Click the card (or Clock In) to start the shift.
import { playRun } from '../audio';
import { ITEMS } from '../data/items';
import { NIGHT_COUNT, REWARDS, actOf } from '../data/nights';
import type { PalName } from '../data/palette';
import { TUNING } from '../data/tuning';
import { tapWord } from '../engine/input';
import { W } from '../engine/screen';
import { LOST_KEEP, currentNight, recipeTip, retryEase, type Run } from '../game/run';
import { drawItem } from '../render/board';
import { fillRect, outlineRect } from '../render/greybox';
import { inRect, type Rect } from '../render/layout';
import { bigText, buttonRow, drawIcon, drawPanel, drawPaper, drawTooltipAt, fmt, menuBackdrop, menuPointing, setMenuPointing, type Btn } from '../render/menus';
import { drawPerk, perkTip } from '../render/run';
import { drawText, textWidth, wrapText } from '../render/text';
import type { Flow } from './flow';
import { MenuScene, type Music } from './menu';

const CARD = { x: 130, y: 30, w: 380, h: 262 };

export class NightCardScene extends MenuScene {
  protected readonly music: Music = 'title';
  private readonly run: Run;
  private overPerk = -1;

  constructor(flow: Flow, run: Run) {
    super(flow);
    this.run = run;
  }

  protected buttons(): Btn[] {
    const run = this.run;
    const list: [string, string, Partial<Btn>?][] = [['go', 'Clock In', { keys: ['Enter', 'Space'], icon: 'icon_play' }]];
    if (!run.daily && run.tries > 0) list.push(['swap', 'Swap Meet', { keys: ['KeyS'], tip: `Spend the bank (${fmt(run.bank)} Shinies) before you try again.` }]);
    if (!run.daily && run.tries === 0 && run.night > 1) list.push(['map', 'Map', { keys: ['KeyM'], tip: 'Back to the county map (pick the other fork).' }]);
    list.push(['back', 'Title', { keys: ['Escape'], sound: 'back' }]);
    return buttonRow(list, W / 2, 302, 112, 22);
  }

  protected press(id: string): void {
    if (id === 'go') this.flow.clockIn();
    else if (id === 'swap') this.flow.swapMeet();
    else if (id === 'map') this.flow.map();
    else this.flow.title();
  }

  private perkRects(): Rect[] {
    return this.run.slots.map((_, i) => ({ x: CARD.x + 84 + i * 28, y: CARD.y + 222, w: 24, h: 24 }));
  }

  protected step(dt: number): void {
    const { input } = this;
    // A boss night announces itself as the card lands: the Possum's stamp, the God's cry, a fanfare.
    if (this.t >= 0.35 && this.t - dt < 0.35) {
      const id = currentNight(this.run).id;
      if (id === 'inspection') playRun('condemn');
      else if (id === 'raid') playRun('godCry');
      else if (id === 'spring') playRun('spring');
    }
    this.overPerk = this.perkRects().findIndex((r) => inRect(r, input.x, input.y));
    // The whole card is a button too (not the Contraband icons: they have tips).
    const over = inRect(CARD, input.x, input.y) && this.overPerk < 0;
    setMenuPointing(menuPointing() || over);
    if (this.t > 0.3 && input.released && over && inRect(CARD, input.pressX, input.pressY)) {
      this.flow.clockIn();
    }
  }

  protected paint(g: CanvasRenderingContext2D): void {
    const run = this.run;
    const n = currentNight(run);
    menuBackdrop(g, this.t, 0.55, n.scene);
    // The card drops in from above with a little bounce.
    const k = Math.min(1, this.t / 0.35);
    const drop = Math.round((1 - k) * (1 - k) * -60 + Math.sin(Math.min(1, this.t / 0.5) * Math.PI) * 3);
    const r = { ...CARD, y: CARD.y + drop };
    drawPanel(g, r);
    const cx = r.x + r.w / 2;

    // Where: the act, or the Daily Dump.
    const where = run.daily ? `DAILY DUMP #${run.daily} · ONE TRY` : `${actOf(n.night).name.toUpperCase()} · NIGHT ${n.night} OF ${NIGHT_COUNT}`;
    drawText(g, where, cx, r.y + 8, { color: 'ink1', align: 'center' });
    bigText(g, run.daily ? `DAILY #${run.daily}` : n.boss ? 'BOSS NIGHT' : `NIGHT ${n.night}`, cx, r.y + 20, 3, { color: n.boss ? 'red' : 'ink0', align: 'center' });
    bigText(g, n.name.toUpperCase(), cx, r.y + 54, 2, { color: 'rust1', align: 'center' });
    wrapText(n.tease, r.w - 40)
      .slice(0, 1)
      .forEach((l, i) => drawText(g, l, cx, r.y + 78 + i * 10, { color: 'ink1', align: 'center' }));

    // The goal, on a strip of paper (and the reward tag on its right).
    const strip = { x: r.x + 24, y: r.y + 92, w: r.w - 48, h: 30 };
    drawPaper(g, strip);
    if (n.goal === 'king') {
      drawItem(g, 'king', strip.x + 22, strip.y + 30);
      drawText(g, 'GOAL: build THE TRASH KING by 6 AM', strip.x + 42, strip.y + 6, { color: 'ink0' });
      drawText(g, 'Raccoons pay in junk tonight, for the build.', strip.x + 42, strip.y + 16, { color: 'ink1' });
    } else {
      drawIcon(g, 'icon_shiny', strip.x + 10, strip.y + 7, 'yellow');
      bigText(g, fmt(n.quota), strip.x + 32, strip.y + 5, 2, { color: 'ink0' });
      drawText(g, run.daily ? 'to pass. SCORE: every Shiny.' : 'Shinies by 6 AM', strip.x + 40 + textWidth(fmt(n.quota)) * 2, strip.y + 10, { color: 'ink1' });
    }
    if (n.tag) {
      const tag = REWARDS[n.tag].name;
      const tw = textWidth(tag) + 10;
      const tx = strip.x + strip.w - tw - 6;
      fillRect(g, { x: tx, y: strip.y + 8, w: tw, h: 14 }, 'ink0');
      fillRect(g, { x: tx + 1, y: strip.y + 9, w: tw - 2, h: 12 }, n.tag === 'elite' ? 'red' : 'toxic2');
      drawText(g, tag, tx + tw / 2, strip.y + 10, { color: 'ink0', align: 'center' });
    }

    // The night's one rule, big, on a strip of hazard tape: "TONIGHT" and what's different.
    const band = { x: r.x + 24, y: r.y + 128, w: r.w - 48, h: 34 };
    const lx = band.x + 8 + textWidth('TONIGHT') * 2 + 10;
    const rule = wrapText(n.rule, band.x + band.w - 8 - lx).slice(0, 2);
    hazardStrip(g, band);
    bigText(g, 'TONIGHT', band.x + 8, band.y + 6, 2, { color: 'red' });
    rule.forEach((l, i) => drawText(g, l, lx, band.y + (rule.length > 1 ? 7 : 12) + i * 10, { color: 'ink0' }));

    // Then, as room allows: a strike's note, the recipe tip, the reward, Bin Juice waiting, news.
    const notes: [string, PalName][] = [];
    if (run.tries > 0) notes.push([`STRIKE ${run.strikes} of ${TUNING.run.strikes}. Try #${run.tries + 1}: you kept ${Math.round(LOST_KEEP * 100)}% last time.`, 'rust1']);
    if (retryEase(run) < 1) notes.push(['The crew aired the lot out: it reeks a little less this try.', 'toxic0']);
    const tip = recipeTip(run);
    if (tip) notes.push([`Grandma's tip: ${ITEMS[tip.a].name} + ${ITEMS[tip.b].name} make something...`, 'toxic0']);
    if (n.tag) notes.push([REWARDS[n.tag].blurb, 'ink0']);
    const juice = run.binJuice + (n.tag === 'juice' ? 1 : 0);
    if (juice > 0) notes.push([`Bin Juice x${juice} waiting in the Dumpster.`, 'toxic0']);
    if (run.tools.length > 0) notes.push([`${run.tools.map((id) => ITEMS[id].name).join(', ')} in the Dumpster too.`, 'toxic0']);
    for (const line of n.news) notes.push([line, 'ink1']);
    notes
      .filter(([l]) => textWidth(l) <= r.w - 40)
      .slice(0, 4)
      .forEach(([l, c], i) => drawText(g, l, cx, r.y + 168 + i * 10, { color: c, align: 'center' }));

    this.drawGear(g, r.x + 24, r.y + 218, r.w - 48, drop);

    if (this.t > 0.5 && Math.sin(this.t * 4) > -0.5) {
      drawText(g, `${tapWord()} the card to clock in`, cx, r.y + r.h - 12, { color: 'ink1', align: 'center' });
    }
  }

  /** The Contraband you're bringing tonight. */
  private drawGear(g: CanvasRenderingContext2D, x: number, y: number, w: number, dy: number): void {
    const run = this.run;
    fillRect(g, { x, y: y - 2, w, h: 1 }, 'card0');
    if (run.slots.length === 0) {
      drawText(g, 'No Contraband yet. Pass a night to pick some.', x, y + 10, { color: 'ink1' });
      return;
    }
    drawText(g, 'BRINGING', x, y + 10, { color: 'ink0' });
    this.perkRects().forEach((r, i) => {
      const id = run.slots[i];
      if (id) drawPerk(g, id, r.x, r.y + dy);
    });
    const left = run.maxSlots - run.slots.length;
    if (left > 0) drawText(g, `+${left} free slot${left === 1 ? '' : 's'}`, x + 60 + run.slots.length * 28 + 8, y + 10, { color: 'ink1' });
  }

  protected paintOver(g: CanvasRenderingContext2D): void {
    const id = this.run.slots[this.overPerk];
    const r = this.perkRects()[this.overPerk];
    if (id && r) drawTooltipAt(g, perkTip(id), r, 'above', 260);
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
