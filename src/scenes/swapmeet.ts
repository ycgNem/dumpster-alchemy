// The Swap Meet, now the run's shop: three Contraband on price tags (a common, an uncommon and a
// rare), two consumables for the next night (Bin Juice, and a brewed tool once the recipes exist),
// a reroll whose price climbs, and your slots, where a Contraband sells for half. Grandma Mange
// minds the stall. The shop reward tag (and the Clearance Card) take money off.
import { playEvent, playRun, playUi } from '../audio';
import { contrabandDef } from '../data/contraband';
import { ITEMS } from '../data/items';
import { TUNING } from '../data/tuning';
import { W } from '../engine/screen';
import { buy, canBuy, currentNight, itemPrice, openShop, reroll, rerollPrice, sell, sellPrice, type Run, type ShopItem } from '../game/run';
import { drawItem } from '../render/board';
import { coinGlyph } from '../render/hud';
import { fillRect, outlineRect, placeholderRaccoon } from '../render/greybox';
import { inRect, type Rect } from '../render/layout';
import {
  bigText,
  buttonRow,
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
import { drawPerkBig, drawSlots, perkTip, RARITY_COLOR, RARITY_INK, slotRects } from '../render/run';
import { drawSprite } from '../render/sprites';
import { drawText, textWidth, wrapText } from '../render/text';
import type { Flow } from './flow';
import { MenuScene, type Music } from './menu';
import { actOf } from '../data/nights';

const PANEL = { x: 12, y: 10, w: 616, h: 282 };

function stall(i: number): Rect {
  return { x: 26 + i * 124, y: 50, w: 118, h: 156 };
}

function shelf(k: number): Rect {
  return { x: 402, y: 50 + k * 80, w: 128, h: 74 };
}

const SLOTS_X = 104;
const SLOTS_Y = 224;

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

const LINES = {
  idle: ['Everything must go, sweetie.', 'All genuine contraband. Mostly.', 'No refunds. No questions.', "Don't tell the Possum where you got it."],
  buy: ['Pleasure doing business.', 'Ooh, good choice.', "You won't regret it. Probably."],
  broke: ['Come back with Shinies, dear.', "That's more than you've got.", 'No credit. Not even for you.'],
  full: ['Your pockets are full, dear. Sell me something.', 'No room. Sell one first.'],
  sold: ['Sold. Take something else.', "That one's gone, sweetie."],
  max: ["You can't carry more than that.", 'Three is plenty, dear.'],
  sell: ['I can find a home for that.', 'Half price. Fair is fair.'],
  reroll: ['Let me look in the back...', 'Fresh off the truck.'],
};

export class SwapMeetScene extends MenuScene {
  protected readonly music: Music = 'report';
  private readonly run: Run;
  /** What the pointer is over: 's0'-'s2' (stalls), 'c0'/'c1' (consumables), 'p0'... (your slots). */
  private over: string | null = null;
  private pressedOn: string | null = null;
  private flash = new Map<string, { t: number; ok: boolean }>();
  private line = LINES.idle[0] ?? '';
  private lineAt = 0;
  /** A slot armed to sell (a second click sells it). */
  private selling = -1;

  constructor(flow: Flow, run: Run) {
    super(flow);
    this.run = run;
    openShop(run, flow.meta);
    this.line = LINES.idle[run.night % LINES.idle.length] ?? '';
  }

  private perks(): ShopItem[] {
    return (this.run.shop?.items ?? []).filter((it) => it.kind === 'perk');
  }

  private consumables(): ShopItem[] {
    return (this.run.shop?.items ?? []).filter((it) => it.kind !== 'perk');
  }

  protected buttons(): Btn[] {
    const run = this.run;
    const retry = run.tries > 0;
    const price = rerollPrice(run);
    return buttonRow(
      [
        ['next', retry ? `Retry Night ${run.night}` : 'To the Map', { keys: ['Enter', 'Space'], icon: 'icon_play' }],
        ['reroll', `Reroll ${fmt(price)}`, { keys: ['KeyR'], disabled: run.bank < price, tip: 'New Contraband on the stall. Costs more each time.' }],
        ['title', 'Title', { keys: ['Escape'], sound: 'back' }],
      ],
      W / 2,
      304,
      132,
      22,
    );
  }

  protected press(id: string): void {
    if (id === 'next') {
      if (this.run.tries > 0) {
        this.flow.leaveSwapMeet();
        return;
      }
      this.flow.leaveSwapMeet();
    } else if (id === 'reroll') {
      if (reroll(this.run, this.flow.meta)) {
        playRun('reroll');
        this.say(LINES.reroll);
        this.flow.save();
      } else this.say(LINES.broke);
    } else this.flow.title();
  }

  private slots(): Rect[] {
    return slotRects(this.run.maxSlots, SLOTS_X, SLOTS_Y);
  }

  private hitAt(x: number, y: number): string | null {
    for (let i = 0; i < this.perks().length; i++) if (inRect(stall(i), x, y)) return `s${i}`;
    for (let k = 0; k < this.consumables().length; k++) if (inRect(shelf(k), x, y)) return `c${k}`;
    const sr = this.slots();
    for (let i = 0; i < sr.length; i++) {
      const r = sr[i];
      if (r && inRect(r, x, y) && this.run.slots[i]) return `p${i}`;
    }
    return null;
  }

  protected step(): void {
    const { input } = this;
    const over = this.hitAt(input.x, input.y);
    if (over && over !== this.over) playUi('hover');
    this.over = over;
    setMenuPointing(menuPointing() || over !== null);
    if (input.pressed) this.pressedOn = this.hitAt(input.pressX, input.pressY);
    if (input.released) {
      const id = this.hitAt(input.x, input.y);
      if (id && id === this.pressedOn) this.click(id);
      else if (!id) this.selling = -1;
      this.pressedOn = null;
    }
  }

  private click(id: string): void {
    const k = Number(id.slice(1));
    if (id.startsWith('p')) {
      if (this.selling !== k) {
        this.selling = k;
        playUi('click');
        return;
      }
      const name = this.run.slots[k];
      const pay = sell(this.run, k);
      this.selling = -1;
      if (pay > 0 && name) {
        playRun('sell');
        this.flash.set(id, { t: this.t, ok: true });
        this.say(LINES.sell);
        this.flow.save();
      }
      return;
    }
    this.selling = -1;
    const it = id.startsWith('s') ? this.perks()[k] : this.consumables()[k];
    if (!it) return;
    const res = buy(this.run, it);
    this.flash.set(id, { t: this.t, ok: res === 'ok' });
    if (res === 'ok') {
      if (it.kind === 'perk') playRun('buy');
      else playEvent({ type: 'buy', upgrade: it.kind });
      this.flow.save();
      this.say(LINES.buy);
    } else {
      playUi('back');
      this.say(LINES[res]);
    }
  }

  private say(lines: readonly string[]): void {
    this.line = lines[Math.floor(this.t * 7) % lines.length] ?? '';
    this.lineAt = this.t;
  }

  protected paint(g: CanvasRenderingContext2D): void {
    const run = this.run;
    const n = currentNight(run);
    menuBackdrop(g, this.t, 0.5, actOf(Math.max(1, run.night - (run.tries > 0 ? 0 : 1))).scene);
    drawPanel(g, PANEL);

    bigText(g, 'SWAP MEET', PANEL.x + 16, PANEL.y + 8, 2, { color: 'ink0' });
    const next = run.tries > 0 ? `Then: retry Night ${run.night}, ${n.name}` : `Then: the map, and Night ${run.night}`;
    drawText(g, next, PANEL.x + 16, PANEL.y + 30, { color: 'ink1' });
    const sale = run.shop?.sale ?? 0;
    const clearance = run.slots.includes('clearance');
    if (sale > 0 || clearance) {
      const tag = sale > 0 && clearance ? 'SALE + CLEARANCE!' : sale > 0 ? `SALE! ${Math.round(sale * 100)}% OFF` : 'CLEARANCE CARD: 25% OFF';
      const tw = textWidth(tag) + 10;
      const tx = PANEL.x + 150;
      fillRect(g, { x: tx, y: PANEL.y + 10, w: tw, h: 14 }, 'ink0');
      fillRect(g, { x: tx + 1, y: PANEL.y + 11, w: tw - 2, h: 12 }, Math.sin(this.t * 6) > 0 ? 'red' : 'rust1');
      drawText(g, tag, tx + 5, PANEL.y + 12, { color: 'bone' });
    }

    // The bank, top right.
    const bank = fmt(run.bank);
    const bx = PANEL.x + PANEL.w - 20 - textWidth(bank) * 2;
    drawIcon(g, 'icon_shiny', bx - 20, PANEL.y + 11, 'yellow');
    bigText(g, bank, bx, PANEL.y + 8, 2, { color: 'ink0' });
    drawText(g, 'BANK', bx - 2, PANEL.y + 30, { color: 'ink1' });

    this.perks().forEach((it, i) => this.drawStall(g, it, i));
    if (this.perks().length === 0) drawText(g, "Grandma's out of stock. You've got it all.", 200, 120, { color: 'ink1', align: 'center' });
    this.consumables().forEach((it, k) => this.drawShelf(g, it, k));

    // Your slots: click one to sell it.
    drawText(g, 'YOUR SLOTS', PANEL.x + 14, SLOTS_Y + 4, { color: 'ink0' });
    drawText(g, 'click to sell', PANEL.x + 14, SLOTS_Y + 14, { color: 'ink1' });
    const hot = this.selling >= 0 ? this.selling : this.over?.startsWith('p') ? Number(this.over.slice(1)) : -1;
    drawSlots(g, run.slots, run.maxSlots, SLOTS_X, SLOTS_Y, hot, this.selling >= 0 ? 'red' : 'sodium3');
    const after = SLOTS_X + run.maxSlots * 32 + 6;
    if (this.selling >= 0) {
      const id = run.slots[this.selling];
      if (id) {
        drawText(g, `Sell ${contrabandDef(id).name} for ${fmt(sellPrice(run, id))}?`, after, SLOTS_Y + 4, { color: 'rust1' });
        drawText(g, 'Click it again to sell.', after, SLOTS_Y + 14, { color: 'ink1' });
      }
    } else {
      const juice = run.binJuice;
      const tools = run.tools.length;
      drawText(g, `Next night: Bin Juice x${juice}${tools > 0 ? `, ${tools} tool${tools === 1 ? '' : 's'}` : ''}`, after, SLOTS_Y + 9, { color: 'ink1' });
    }
    this.drawKeeper(g);
  }

  protected paintOver(g: CanvasRenderingContext2D): void {
    const o = this.over;
    if (!o) return;
    const k = Number(o.slice(1));
    if (o.startsWith('p')) {
      const id = this.run.slots[k];
      const r = this.slots()[k];
      if (id && r && this.selling < 0) drawTooltipAt(g, `${perkTip(id)} Sells for ${fmt(sellPrice(this.run, id))}.`, r, 'above', 280);
    } else if (o.startsWith('c')) {
      const it = this.consumables()[k];
      if (!it) return;
      const text = it.kind === 'juice' ? 'BIN JUICE: merges with anything. Lands on the lot when the next night starts. Carry up to 3.' : it.kind === 'tool' ? `${ITEMS[it.id].name.toUpperCase()}: a brewed tool. ${ITEMS[it.id].quip} Lands on the lot next night.` : '';
      // To the right, in the gap over Grandma: on the left it would cover the stall's cards.
      // (Centred on the whole shelf column, so it clears Grandma's speech bubble below.)
      const col = { ...shelf(k), y: shelf(0).y, h: shelf(1).y + shelf(1).h - shelf(0).y };
      if (text) drawTooltipAt(g, text, col, 'right', 84);
    }
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

  private drawStall(g: CanvasRenderingContext2D, it: ShopItem, i: number): void {
    if (it.kind !== 'perk') return;
    const run = this.run;
    const d = contrabandDef(it.id);
    const id = `s${i}`;
    const { dx, dy } = this.jolt(id);
    const base = stall(i);
    const r = { ...base, x: base.x + dx, y: base.y + dy };
    const cx = r.x + r.w / 2;
    if (this.over === id && !it.sold) outlineRect(g, { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, 'sodium3');
    drawPaper(g, r);
    fillRect(g, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: 3 }, RARITY_COLOR[d.rarity]);
    if (it.sold) {
      bigText(g, 'SOLD', cx, r.y + 60, 2, { color: 'rust1', align: 'center' });
      drawText(g, d.name, cx, r.y + 90, { color: 'ink1', align: 'center' });
      return;
    }
    fillRect(g, { x: cx - 27, y: r.y + 10, w: 54, h: 52 }, 'card0');
    drawPerkBig(g, it.id, cx - 24, r.y + 12, 2);
    wrapText(d.name.toUpperCase(), r.w - 8)
      .slice(0, 2)
      .forEach((l, k) => drawText(g, l, cx, r.y + 66 + k * 10, { color: 'ink0', align: 'center' }));
    drawText(g, d.rarity.toUpperCase(), cx, r.y + 87, { color: RARITY_INK[d.rarity], align: 'center' });
    wrapText(d.blurb, r.w - 10)
      .slice(0, 3)
      .forEach((l, k) => drawText(g, l, cx, r.y + 99 + k * 9, { color: 'ink1', align: 'center' }));
    this.priceTag(g, { x: cx - 32, y: r.y + r.h - 28, w: 64, h: 26 }, itemPrice(run, it), canBuy(run, it));
  }

  private drawShelf(g: CanvasRenderingContext2D, it: ShopItem, k: number): void {
    const run = this.run;
    const id = `c${k}`;
    const { dx, dy } = this.jolt(id);
    const base = shelf(k);
    const r = { ...base, x: base.x + dx, y: base.y + dy };
    if (this.over === id && !it.sold) outlineRect(g, { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, 'sodium3');
    drawPaper(g, r);
    const item = it.kind === 'juice' ? 'bin_juice' : it.kind === 'tool' ? it.id : null;
    if (!item) return;
    drawItem(g, item, r.x + 22, r.y + 40, { phase: this.t + k });
    const name = it.kind === 'juice' ? 'BIN JUICE' : ITEMS[item].name.toUpperCase();
    wrapText(name, r.w - 44)
      .slice(0, 2)
      .forEach((l, i) => drawText(g, l, r.x + 42, r.y + 6 + i * 10, { color: 'ink0' }));
    const have = it.kind === 'juice' ? `x${run.binJuice} / ${TUNING.run.juiceMax}` : 'a brewed tool';
    drawText(g, have, r.x + 42, r.y + 28, { color: 'ink1' });
    if (it.sold) {
      drawText(g, 'SOLD', r.x + r.w - 40, r.y + 50, { color: 'rust1' });
      return;
    }
    this.priceTag(g, { x: r.x + r.w - 68, y: r.y + 42, w: 64, h: 26 }, itemPrice(run, it), canBuy(run, it));
  }

  private priceTag(g: CanvasRenderingContext2D, tag: Rect, price: number, why: ReturnType<typeof canBuy>): void {
    drawPriceTag(g, tag);
    if (why === 'max') {
      drawText(g, 'FULL', tag.x + 20, tag.y + 10, { color: 'ink0' });
      return;
    }
    const afford = why === 'ok' || why === 'full';
    if (afford) coinGlyph(g, tag.x + 9, tag.y + 12);
    else lockGlyph(g, tag.x + 10, tag.y + 12);
    drawText(g, fmt(price), tag.x + 19, tag.y + 10, { color: afford ? 'ink0' : 'rust1' });
  }

  /** Grandma Mange minds the stall. */
  private drawKeeper(g: CanvasRenderingContext2D): void {
    const fx = PANEL.x + PANEL.w - 34;
    const fy = PANEL.y + PANEL.h - 6;
    const blink = this.t % 3.7 < 0.14;
    const happy = this.t - this.lineAt < 1.2 && [...this.flash.values()].some((f) => f.ok && this.t - f.t < 1.2);
    const hop = happy ? -Math.round(Math.abs(Math.sin((this.t - this.lineAt) * 10)) * 2) : 0;
    const ok =
      (happy && drawSprite(g, 'raccoon_mange_happy', fx, fy + hop)) ||
      drawSprite(g, 'raccoon_mange_idle', fx, fy + hop, { frame: blink ? 1 : 0, flip: true });
    if (!ok) placeholderRaccoon(g, 'mange', happy ? 'happy' : 'idle', blink, fx, fy + hop);
    const w = textWidth(this.line) + 16;
    drawSpeech(g, this.line, Math.max(PANEL.x + 8, fx - 24 - w + 30), fy - 78, fx - 30);
  }
}
