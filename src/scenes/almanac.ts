// The Trash Almanac: every item in the game on three shelves. Found ones show their sprite,
// name and quip; the rest are silhouettes (drawn by code from the sprite) and "???".
import { GULL_CHAIN, ITEMS, JUNK_CHAIN, type ItemId } from '../data/items';
import { W } from '../engine/screen';
import type { Run } from '../game/run';
import { drawItem } from '../render/board';
import { fillRect, outlineRect } from '../render/greybox';
import { inRect, type Rect } from '../render/layout';
import {
  bigText,
  buttonRow,
  drawItemBig,
  drawPanel,
  drawPaper,
  drawSilhouette,
  menuBackdrop,
  menuPointing,
  setMenuPointing,
  type Btn,
} from '../render/menus';
import { drawText, wrapText } from '../render/text';
import type { Flow } from './flow';
import { MenuScene, type Music } from './menu';

const PANEL = { x: 12, y: 10, w: 616, h: 282 };
const SPECIALS: readonly ItemId[] = ['golden_egg', 'bin_juice'];
const CELL = 44;
const STEP = 48;

interface Slot {
  id: ItemId;
  r: Rect;
}

function slots(): Slot[] {
  const out: Slot[] = [];
  JUNK_CHAIN.forEach((id, i) => out.push({ id, r: { x: 30 + i * STEP, y: 60, w: CELL, h: CELL } }));
  GULL_CHAIN.forEach((id, i) => out.push({ id, r: { x: 30 + i * STEP, y: 124, w: CELL, h: CELL } }));
  SPECIALS.forEach((id, i) => out.push({ id, r: { x: 318 + i * STEP, y: 124, w: CELL, h: CELL } }));
  return out;
}

const SLOTS = slots();

export class AlmanacScene extends MenuScene {
  protected readonly music: Music = 'title';
  private readonly known: Set<ItemId>;
  private readonly back: () => void;
  private picked: ItemId;

  constructor(flow: Flow, run: Run | null, back: () => void) {
    super(flow);
    this.known = new Set(run?.discovered ?? []);
    this.back = back;
    this.picked = SLOTS.find((s) => this.known.has(s.id))?.id ?? 'cap';
  }

  protected buttons(): Btn[] {
    return buttonRow([['back', 'Back', { keys: ['Escape', 'Enter', 'Backspace'], sound: 'back' }]], W / 2, 304, 112, 22);
  }

  protected press(): void {
    this.back();
  }

  protected step(): void {
    const { input } = this;
    const hit = SLOTS.find((s) => inRect(s.r, input.x, input.y));
    setMenuPointing(menuPointing() || hit !== undefined);
    if (hit) this.picked = hit.id;
  }

  protected paint(g: CanvasRenderingContext2D): void {
    menuBackdrop(g, this.t, 0.55);
    drawPanel(g, PANEL);
    bigText(g, 'TRASH ALMANAC', PANEL.x + 16, PANEL.y + 10, 2, { color: 'ink0' });
    const found = SLOTS.filter((s) => this.known.has(s.id)).length;
    drawText(g, `Found ${found} / ${SLOTS.length}`, PANEL.x + PANEL.w - 18, PANEL.y + 16, { color: 'ink0', align: 'right' });

    drawText(g, 'JUNK', 30, 48, { color: 'ink1' });
    drawText(g, 'GULLS', 30, 112, { color: 'ink1' });
    drawText(g, 'SPECIALS', 318, 112, { color: 'ink1' });
    for (const s of SLOTS) this.drawSlot(g, s);
    this.drawDetail(g);
  }

  private drawSlot(g: CanvasRenderingContext2D, s: Slot): void {
    const { r, id } = s;
    const known = this.known.has(id);
    const picked = this.picked === id;
    fillRect(g, { x: r.x + 1, y: r.y + 1, w: r.w, h: r.h }, 'ink0');
    fillRect(g, r, known ? 'card0' : 'ink1');
    if (picked) outlineRect(g, { x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }, 'sodium3', 2);
    const fx = r.x + r.w / 2;
    const fy = r.y + r.h - 6;
    if (known) {
      drawItem(g, id, fx, fy, { phase: r.x * 0.1 });
    } else {
      drawSilhouette(g, id, fx, fy, 'night1');
      drawText(g, '?', fx, r.y + 15, { color: 'night3', align: 'center' });
    }
    const d = ITEMS[id];
    if (d.tier > 0) drawText(g, d.chain === 'gull' ? `G${d.tier}` : String(d.tier), r.x + 3, r.y + 1, { color: known ? 'card3' : 'ink2' });
  }

  private drawDetail(g: CanvasRenderingContext2D): void {
    const r = { x: 30, y: 180, w: 580, h: 102 };
    drawPaper(g, r);
    const id = this.picked;
    const d = ITEMS[id];
    const known = this.known.has(id);
    fillRect(g, { x: r.x + 10, y: r.y + 12, w: 76, h: 76 }, known ? 'card1' : 'card0');
    if (known) drawItemBig(g, id, r.x + 48, r.y + 82, 2, this.t);
    else drawSilhouette(g, id, r.x + 48, r.y + 82, 'ink1', 2);

    const x = r.x + 100;
    if (!known) {
      bigText(g, '???', x, r.y + 12, 2, { color: 'ink0' });
      drawText(g, chainLine(id, false), x, r.y + 38, { color: 'ink1' });
      drawText(g, 'Not found yet. Keep merging.', x, r.y + 54, { color: 'ink1' });
      return;
    }
    bigText(g, d.name.toUpperCase(), x, r.y + 12, 2, { color: 'ink0' });
    drawText(g, chainLine(id, true), x, r.y + 38, { color: 'ink1' });
    wrapText(`"${d.quip}"`, r.w - 116).forEach((l, i) => drawText(g, l, x, r.y + 54 + i * 10, { color: 'ink0' }));
  }
}

function chainLine(id: ItemId, known: boolean): string {
  const d = ITEMS[id];
  if (d.chain === 'junk') {
    const worth = known && d.tier < JUNK_CHAIN.length ? ` · worth ${d.value} Shinies to a raccoon` : '';
    const king = d.tier === JUNK_CHAIN.length ? ' · the top of the pile' : '';
    return `Junk, tier ${d.tier}${worth}${king}`;
  }
  if (d.chain === 'gull') return `Seagull chain, tier ${d.tier}${d.tier === GULL_CHAIN.length ? ' · drops a Golden Egg' : ''}`;
  return id === 'golden_egg' ? 'Special · from the Gull God' : 'Special · from the Swap Meet';
}
