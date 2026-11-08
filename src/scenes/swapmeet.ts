// The Swap Meet: upgrades on price tags (icon, level pips, what the next level does, the price),
// Bin Juice for tomorrow, and Grandma Mange minding the stall. Buying spends the bank.
import { playEvent, playUi } from '../audio';
import { nightDef } from '../data/nights';
import { BIN_JUICE, UPGRADES, upgradeMods, type UpgradeDef } from '../data/upgrades';
import type { PalName } from '../data/palette';
import { TUNING } from '../data/tuning';
import { W } from '../engine/screen';
import { buy, buyJuice, canBuy, canBuyJuice, isEndless, priceOf, type Run } from '../game/run';
import { drawItem } from '../render/board';
import { coinGlyph } from '../render/hud';
import { fillRect, outlineRect, placeholderRaccoon } from '../render/greybox';
import { inRect, type Rect } from '../render/layout';
import {
  bigText,
  buttonRow,
  drawAt,
  drawIcon,
  drawPanel,
  drawPaper,
  drawPriceTag,
  drawSpeech,
  drawTooltipAt,
  fmt,
  menuBackdrop,
  menuPointing,
  setMenuPointing,
  type Btn,
} from '../render/menus';
import { drawSprite } from '../render/sprites';
import { drawText, textWidth, wrapText } from '../render/text';
import type { Flow } from './flow';
import { MenuScene, type Music } from './menu';

const PANEL = { x: 12, y: 10, w: 616, h: 282 };
const COL_W = 98;
const JUICE: Rect = { x: 28, y: 214, w: 300, h: 66 };

function column(i: number): Rect {
  return { x: 26 + i * COL_W, y: 54, w: COL_W - 6, h: 150 };
}

/** One name for it on every screen: the Crusher (the data still calls it the Compactor). */
export function crusherName(text: string): string {
  return text.replace(/Compactor/g, 'Crusher').replace(/compactor/g, 'crusher');
}

/** What the next level changes, as "label from -> to" rows (from the real numbers, not prose). */
function changes(u: UpgradeDef, run: Run): [string, string, string][] {
  const now = upgradeMods(run.levels);
  const nx = upgradeMods({ ...run.levels, [u.id]: run.levels[u.id] + 1 });
  const n = (v: number): string => String(Math.round(v * 100) / 100);
  switch (u.id) {
    case 'lid':
      return [['lid', n(now.dumpsterCharges), n(nx.dumpsterCharges)]];
    case 'hinges':
      return [['refill', `${n(now.dumpsterRefillSec)}s`, `${n(nx.dumpsterRefillSec)}s`]];
    case 'raccoon':
      return [['slots', n(now.orderSlots), n(nx.orderSlots)]];
    case 'compactor':
      return [
        ['crush', `${n(now.compactorCooldownSec)}s`, `${n(nx.compactorCooldownSec)}s`],
        ['pay', n(now.compactorPayPerTier), `${n(nx.compactorPayPerTier)}/tier`],
      ];
    case 'freshener':
      return [
        ['fade', `x${n(now.stinkDecayMul)}`, `x${n(nx.stinkDecayMul)}`],
        // "gain 0% -> -15%": how much less Stink everything adds.
        ['gain', pct(now.stinkGainMul), pct(nx.stinkGainMul)],
      ];
    case 'owl': {
      // What a seagull will still eat (a hopping one eats up to tier 3 without the owl).
      const eats = (t: number): string => (t <= 0 ? 'nothing' : `up to ${Math.min(t, TUNING.gulls.eatsUpToG1)}`);
      return [
        ['gulls', `x${n(now.gullChanceMul)}`, `x${n(nx.gullChanceMul)}`],
        ['eat', eats(now.gullEatMax), eats(nx.gullEatMax)],
      ];
    }
  }
}

/** A gain multiplier as a cut: 1 -> "0%", 0.85 -> "-15%". */
function pct(mul: number): string {
  const p = Math.round((1 - mul) * 100);
  return p === 0 ? '0%' : `${p > 0 ? '-' : '+'}${Math.abs(p)}%`;
}

/** A tiny padlock (5 x 7) where the coin goes on a tag you can't afford yet. */
function lockGlyph(g: CanvasRenderingContext2D, x: number, y: number): void {
  const rows = ['.###.', '#...#', '#...#', '#####', '#sss#', '#s.s#', '#####'];
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '#') fillRect(g, { x: x + i, y: y + j, w: 1, h: 1 }, 'ink0');
      else if (c === 's') fillRect(g, { x: x + i, y: y + j, w: 1, h: 1 }, 'steel2');
    }
  });
}

const ARROW_W = 9;

function changeWidth(label: string, from: string, to: string): number {
  return (label ? textWidth(label) + 4 : 0) + textWidth(from) + 3 + ARROW_W + 3 + textWidth(to);
}

/** "refill 5s -> 4s" (or just "5s -> 4s"), centred on cx, with a drawn arrow (the font has none). */
function changeLine(g: CanvasRenderingContext2D, label: string, from: string, to: string, cx: number, y: number): void {
  const w = changeWidth(label, from, to);
  let x = Math.round(cx - w / 2);
  if (label) {
    drawText(g, label, x, y, { color: 'ink1' });
    x += textWidth(label) + 4;
  }
  drawText(g, from, x, y, { color: 'ink1' });
  x += textWidth(from) + 3;
  arrow(g, x, y + 5, 'rust1');
  x += ARROW_W + 3;
  drawText(g, to, x, y, { color: 'ink0' });
}

function arrow(g: CanvasRenderingContext2D, x: number, y: number, c: PalName): void {
  fillRect(g, { x, y, w: ARROW_W - 2, h: 1 }, c);
  fillRect(g, { x: x + ARROW_W - 4, y: y - 2, w: 1, h: 5 }, c);
  fillRect(g, { x: x + ARROW_W - 3, y: y - 1, w: 1, h: 3 }, c);
  fillRect(g, { x: x + ARROW_W - 2, y, w: 1, h: 1 }, c);
}

const LINES = {
  idle: ['Everything must go, sweetie.', 'All genuine junk. Mostly.', 'No refunds. No questions.'],
  buy: ['Pleasure doing business.', 'Ooh, good choice.', "You won't regret it. Probably."],
  broke: ['Come back with Shinies, dear.', "That's more than you've got.", 'No credit. Not even for you.'],
  maxed: ["That's as good as it gets.", 'Sold out, sweetie.'],
};

export class SwapMeetScene extends MenuScene {
  protected readonly music: Music = 'report';
  private readonly run: Run;
  /** Which tag the pointer is over: an upgrade id, 'juice', or null. */
  private over: string | null = null;
  private pressedOn: string | null = null;
  private flash = new Map<string, { t: number; ok: boolean }>();
  private line = LINES.idle[0] ?? '';
  private lineAt = 0;

  constructor(flow: Flow, run: Run) {
    super(flow);
    this.run = run;
    this.line = LINES.idle[run.night % LINES.idle.length] ?? '';
  }

  protected buttons(): Btn[] {
    const run = this.run;
    const next = isEndless(run) ? 'Endless Shift' : run.tries > 0 ? `Retry Night ${run.night}` : `Night ${run.night}`;
    return buttonRow(
      [
        ['next', next, { keys: ['Enter', 'Space'], icon: 'icon_play' }],
        ['title', 'Title', { keys: ['Escape'], sound: 'back' }],
      ],
      W / 2,
      304,
      132,
      22,
    );
  }

  protected press(id: string): void {
    if (id === 'next') this.flow.clockIn(true);
    else this.flow.title();
  }

  private tagAt(x: number, y: number): string | null {
    for (let i = 0; i < UPGRADES.length; i++) if (inRect(column(i), x, y)) return UPGRADES[i]?.id ?? null;
    return inRect(JUICE, x, y) ? 'juice' : null;
  }

  protected step(): void {
    const { input } = this;
    const over = this.tagAt(input.x, input.y);
    if (over && over !== this.over) playUi('hover');
    this.over = over;
    setMenuPointing(menuPointing() || over !== null);
    if (input.pressed) this.pressedOn = this.tagAt(input.pressX, input.pressY);
    if (input.released) {
      const id = this.tagAt(input.x, input.y);
      if (id && id === this.pressedOn) this.shop(id);
      this.pressedOn = null;
    }
  }

  private shop(id: string): void {
    const run = this.run;
    let ok: boolean;
    let maxed = false;
    if (id === 'juice') {
      maxed = run.binJuice >= BIN_JUICE.max;
      ok = canBuyJuice(run) && buyJuice(run);
    } else {
      const def = UPGRADES.find((u) => u.id === id);
      if (!def) return;
      maxed = priceOf(run, def.id) === null;
      ok = canBuy(run, def.id) && buy(run, def.id);
    }
    this.flash.set(id, { t: this.t, ok });
    if (ok) {
      playEvent({ type: 'buy', upgrade: id });
      this.flow.save();
      this.say(LINES.buy);
    } else {
      playUi('back');
      this.say(maxed ? LINES.maxed : LINES.broke);
    }
  }

  private say(lines: readonly string[]): void {
    this.line = lines[Math.floor(this.t * 7) % lines.length] ?? '';
    this.lineAt = this.t;
  }

  protected paint(g: CanvasRenderingContext2D): void {
    menuBackdrop(g, this.t, 0.5);
    const run = this.run;
    drawPanel(g, PANEL);

    bigText(g, 'SWAP MEET', PANEL.x + 16, PANEL.y + 10, 2, { color: 'ink0' });
    const n = nightDef(run.night);
    const next = isEndless(run) ? 'Up next: the Endless Shift' : `Up next: Night ${run.night}, ${n.name}`;
    // (The hover tip sits on this line while it's up.)
    const tipUp = this.over !== null && this.over !== 'juice';
    if (!tipUp) drawText(g, next, PANEL.x + 16, PANEL.y + 34, { color: 'ink1' });

    // The bank, top right.
    const bank = fmt(run.bank);
    const bx = PANEL.x + PANEL.w - 20 - textWidth(bank) * 2;
    drawIcon(g, 'icon_shiny', bx - 20, PANEL.y + 13, 'yellow');
    bigText(g, bank, bx, PANEL.y + 10, 2, { color: 'ink0' });
    if (!tipUp) drawText(g, 'BANK', bx - 2, PANEL.y + 34, { color: 'ink1' });

    UPGRADES.forEach((u, i) => this.drawUpgrade(g, u, column(i)));
    this.drawJuice(g);
    this.drawKeeper(g);
  }

  protected paintOver(g: CanvasRenderingContext2D): void {
    if (!this.over) return;
    // Anchored to the thing, not the pointer: one line just above the column (over the gap under
    // the headers), or above the Bin Juice note. Never over a header.
    if (this.over === 'juice') {
      drawTooltipAt(g, BIN_JUICE.blurb, JUICE, 'above', 400);
      return;
    }
    const i = UPGRADES.findIndex((u) => u.id === this.over);
    const u = UPGRADES[i];
    if (!u) return;
    const col = column(i);
    drawTooltipAt(g, crusherName(u.blurb), { ...col, y: col.y + 8, h: 1 }, 'above', 400);
  }

  /** A little hop when bought, a shake when it can't be. */
  private jolt(id: string): { dx: number; dy: number } {
    const f = this.flash.get(id);
    if (!f) return { dx: 0, dy: 0 };
    const e = this.t - f.t;
    if (e > 0.35) return { dx: 0, dy: 0 };
    if (f.ok) return { dx: 0, dy: -Math.round(Math.sin((e / 0.35) * Math.PI) * 4) };
    return { dx: Math.round(Math.sin(e * 60) * 2 * (1 - e / 0.35)), dy: 0 };
  }

  private drawUpgrade(g: CanvasRenderingContext2D, u: UpgradeDef, base: Rect): void {
    const run = this.run;
    const level = run.levels[u.id];
    const price = priceOf(run, u.id);
    const { dx, dy } = this.jolt(u.id);
    const r = { ...base, x: base.x + dx, y: base.y + dy };
    const cx = r.x + r.w / 2;
    if (this.over === u.id) outlineRect(g, { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, 'sodium3');

    // The icon on a dark shelf.
    fillRect(g, { x: cx - 16, y: r.y + 2, w: 32, h: 30 }, 'card0');
    if (!drawAt(g, u.icon, cx - 12, r.y + 5)) {
      fillRect(g, { x: cx - 11, y: r.y + 6, w: 22, h: 22 }, 'ink0');
      fillRect(g, { x: cx - 10, y: r.y + 7, w: 20, h: 20 }, 'steel2');
      drawText(g, u.name.slice(0, 1), cx, r.y + 11, { color: 'ink0', align: 'center' });
    }
    // A sticker slapped on the shelf when this upgrade is made for the coming night's rule.
    if (!isEndless(run) && u.shines.includes(run.night)) {
      const tag = 'TONIGHT!';
      const tw = textWidth(tag);
      const tx = Math.round(cx - tw / 2);
      const ty = r.y + 23; // over the shelf's bottom edge, clear of the bank label above
      fillRect(g, { x: tx - 3, y: ty, w: tw + 6, h: 12 }, 'ink0');
      fillRect(g, { x: tx - 2, y: ty + 1, w: tw + 4, h: 10 }, 'toxic2');
      drawText(g, tag, tx, ty, { color: 'ink0' });
    }
    wrapText(crusherName(u.name).toUpperCase(), r.w - 4)
      .slice(0, 2)
      .forEach((l, i) => drawText(g, l, cx, r.y + 36 + i * 10, { color: 'ink0', align: 'center' }));

    // Level pips: owned ones bright (sodium with a shine), the rest dark and empty.
    const max = u.prices.length;
    const pw = 12;
    const px0 = Math.round(cx - (max * pw - 2) / 2);
    for (let i = 0; i < max; i++) {
      const full = i < level;
      const x = px0 + i * pw;
      fillRect(g, { x, y: r.y + 58, w: 10, h: 8 }, 'ink0');
      fillRect(g, { x: x + 1, y: r.y + 59, w: 8, h: 6 }, full ? 'yellow' : 'card0');
      if (full) {
        fillRect(g, { x: x + 1, y: r.y + 63, w: 8, h: 2 }, 'sodium2');
        fillRect(g, { x: x + 2, y: r.y + 60, w: 2, h: 1 }, 'white');
      }
    }

    // What the next level changes, from the numbers: "refill 5s -> 4s".
    if (price === null) {
      drawText(g, 'Fully upgraded', cx, r.y + 72, { color: 'toxic0', align: 'center' });
      // What it does now, from the numbers ("crush 2.5s", "pay 3/tier").
      changes(u, run).forEach(([label, now], i) => drawText(g, `${label} ${now}`, cx, r.y + 84 + i * 11, { color: 'ink1', align: 'center' }));
    } else {
      // "refill 5s -> 4s" when it fits the column; else the labels go up in the heading
      // ("fade / build:") and the rows are just the numbers.
      const rows = changes(u, run);
      const fits = rows.every(([label, from, to]) => changeWidth(label, from, to) <= r.w);
      const head = !fits ? `${rows.map(([l]) => l).join(' / ')}:` : level === 0 ? 'Buy:' : `Level ${level} to ${level + 1}:`;
      drawText(g, head, cx, r.y + 72, { color: 'ink1', align: 'center' });
      rows.forEach(([label, from, to], i) => changeLine(g, fits ? label : '', from, to, cx, r.y + 84 + i * 11));
    }

    // The price tag.
    const tag = { x: cx - 32, y: r.y + 112, w: 64, h: 30 };
    drawPriceTag(g, tag);
    if (price === null) {
      drawIcon(g, 'icon_check', tag.x + 12, tag.y + 9, 'toxic1');
      drawText(g, 'SOLD', tag.x + 30, tag.y + 12, { color: 'ink0' });
    } else {
      // Can't afford it: the same on every tag, a padlock instead of the coin and the price in red.
      const afford = run.bank >= price;
      if (afford) coinGlyph(g, tag.x + 9, tag.y + 14);
      else lockGlyph(g, tag.x + 10, tag.y + 14);
      drawText(g, fmt(price), tag.x + 19, tag.y + 12, { color: afford ? 'ink0' : 'rust1' });
    }
  }

  private drawJuice(g: CanvasRenderingContext2D): void {
    const run = this.run;
    const { dx, dy } = this.jolt('juice');
    const r = { ...JUICE, x: JUICE.x + dx, y: JUICE.y + dy };
    if (this.over === 'juice') outlineRect(g, { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, 'sodium3');
    drawPaper(g, r);
    drawItem(g, 'bin_juice', r.x + 24, r.y + 44, { phase: this.t });
    drawText(g, 'BIN JUICE', r.x + 46, r.y + 6, { color: 'ink0' });
    drawText(g, `x${run.binJuice} / ${BIN_JUICE.max} for tomorrow`, r.x + 46 + textWidth('BIN JUICE') + 8, r.y + 6, { color: 'ink1' });
    wrapText('Merges with anything. Lands on the lot when the night starts.', 170).forEach((l, i) =>
      drawText(g, l, r.x + 46, r.y + 20 + i * 10, { color: 'ink1' }),
    );
    const tag = { x: r.x + r.w - 72, y: r.y + 26, w: 64, h: 30 };
    drawPriceTag(g, tag);
    if (run.binJuice >= BIN_JUICE.max) {
      drawText(g, 'FULL', tag.x + 16, tag.y + 12, { color: 'ink0' });
    } else {
      const afford = run.bank >= BIN_JUICE.price;
      if (afford) coinGlyph(g, tag.x + 9, tag.y + 14);
      else lockGlyph(g, tag.x + 10, tag.y + 14);
      drawText(g, fmt(BIN_JUICE.price), tag.x + 19, tag.y + 12, { color: afford ? 'ink0' : 'rust1' });
    }
  }

  /** Grandma Mange minds the stall. */
  private drawKeeper(g: CanvasRenderingContext2D): void {
    const fx = PANEL.x + PANEL.w - 40;
    const fy = PANEL.y + PANEL.h - 6;
    const blink = this.t % 3.7 < 0.14;
    const happy = this.t - this.lineAt < 1.2 && this.flash.size > 0 && [...this.flash.values()].some((f) => f.ok && this.t - f.t < 1.2);
    const hop = happy ? -Math.round(Math.abs(Math.sin((this.t - this.lineAt) * 10)) * 2) : 0;
    const ok =
      (happy && drawSprite(g, 'raccoon_mange_happy', fx, fy + hop)) ||
      drawSprite(g, 'raccoon_mange_idle', fx, fy + hop, { frame: blink ? 1 : 0, flip: true });
    if (!ok) placeholderRaccoon(g, 'mange', happy ? 'happy' : 'idle', blink, fx, fy + hop);
    const w = textWidth(this.line) + 16;
    drawSpeech(g, this.line, fx - 24 - w + 30, fy - 78, fx - 30);
  }
}
