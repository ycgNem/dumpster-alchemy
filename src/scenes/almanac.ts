// The Trash Almanac, in two tabs:
// - **Junk**: every item in the game on three shelves. Found ones show their sprite, name and
//   quip; the rest are silhouettes (drawn by code from the sprite) and "???".
// - **Recipes** (the Recipe Book, docs/V2.md "Alchemy"): the 20 recipes. A recipe never brewed
//   shows "??? + ???" and its riddle; an ingredient you've found shows its icon as a nudge (both
//   do when Grandma's Recipe Card revealed it). A brewed one shows the ingredients, the result,
//   its name and what it does. Discoveries persist across runs.
import { BREW_ITEMS, GULL_CHAIN, ITEMS, JUNK_CHAIN, type ItemId } from '../data/items';
import { RECIPES, type RecipeDef } from '../data/recipes';
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
import { drawText, textWidth, wrapText } from '../render/text';
import type { Flow } from './flow';
import { MenuScene, type Music } from './menu';

const PANEL = { x: 12, y: 10, w: 616, h: 282 };
const SPECIALS: readonly ItemId[] = ['golden_egg', 'bin_juice'];
const CELL = 44;
const STEP = 48;

type Tab = 'items' | 'recipes';

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

// The Recipe Book: 5 x 4 cards, then the picked one's page below.
const BOOK_COLS = 5;
const CARD_W = 112;
const CARD_H = 38;
const CARD_GAP = 4;
const BOOK_X = Math.round(W / 2 - (BOOK_COLS * CARD_W + (BOOK_COLS - 1) * CARD_GAP) / 2);
const BOOK_Y = 46;

interface Card {
  rec: RecipeDef;
  n: number;
  r: Rect;
}

const CARDS: Card[] = RECIPES.map((rec, i) => ({
  rec,
  n: i + 1,
  r: { x: BOOK_X + (i % BOOK_COLS) * (CARD_W + CARD_GAP), y: BOOK_Y + Math.floor(i / BOOK_COLS) * (CARD_H + CARD_GAP), w: CARD_W, h: CARD_H },
}));

const TAB_W = 70;

export class AlmanacScene extends MenuScene {
  protected readonly music: Music = 'title';
  private readonly known: Set<ItemId>;
  /** Recipes brewed (result ids), and ones whose ingredients the Recipe Card revealed. */
  private readonly brewed: Set<ItemId>;
  private readonly revealed: Set<ItemId>;
  private readonly back: () => void;
  private picked: ItemId;
  private pickedRecipe: ItemId;
  private tab: Tab = 'items';

  constructor(flow: Flow, run: Run | null, back: () => void, tab: Tab = 'items') {
    super(flow);
    this.known = new Set(run?.discovered ?? []);
    this.brewed = new Set((run?.recipes ?? []).filter((id) => BREW_ITEMS.includes(id)));
    this.revealed = new Set(run?.revealed ?? []);
    this.back = back;
    this.tab = tab;
    this.picked = SLOTS.find((s) => this.known.has(s.id))?.id ?? 'cap';
    this.pickedRecipe = CARDS.find((c) => this.brewed.has(c.rec.id))?.rec.id ?? CARDS[0]?.rec.id ?? 'chime';
  }

  protected buttons(): Btn[] {
    const tx = PANEL.x + PANEL.w - 14 - TAB_W * 2 - 4;
    const ty = PANEL.y + 8;
    // Each tab is a button; the one you're on is greyed (it's where you are).
    const tabs: Btn[] = [
      { id: 'tab_items', label: 'Junk', r: { x: tx, y: ty, w: TAB_W, h: 18 }, disabled: this.tab === 'items', keys: ['KeyJ'] },
      { id: 'tab_recipes', label: 'Recipes', r: { x: tx + TAB_W + 4, y: ty, w: TAB_W, h: 18 }, disabled: this.tab === 'recipes', keys: ['KeyR'] },
      { id: 'tab_flip', label: '', r: { x: -100, y: -100, w: 1, h: 1 }, keys: ['Tab', 'ArrowRight', 'ArrowLeft'], sound: 'click' },
    ];
    return [...tabs, ...buttonRow([['back', 'Back', { keys: ['Escape', 'Enter', 'Backspace'], sound: 'back' }]], W / 2, 304, 112, 22)];
  }

  protected press(id: string): void {
    if (id === 'tab_items') this.tab = 'items';
    else if (id === 'tab_recipes') this.tab = 'recipes';
    else if (id === 'tab_flip') this.tab = this.tab === 'items' ? 'recipes' : 'items';
    else this.back();
  }

  protected step(): void {
    const { input } = this;
    if (this.tab === 'items') {
      const hit = SLOTS.find((s) => inRect(s.r, input.x, input.y));
      setMenuPointing(menuPointing() || hit !== undefined);
      if (hit) this.picked = hit.id;
      return;
    }
    const card = CARDS.find((c) => inRect(c.r, input.x, input.y));
    setMenuPointing(menuPointing() || card !== undefined);
    if (card) this.pickedRecipe = card.rec.id;
  }

  protected paint(g: CanvasRenderingContext2D): void {
    menuBackdrop(g, this.t, 0.55);
    drawPanel(g, PANEL);
    if (this.tab === 'recipes') {
      this.paintBook(g);
      return;
    }
    bigText(g, 'TRASH ALMANAC', PANEL.x + 16, PANEL.y + 10, 2, { color: 'ink0' });
    const found = SLOTS.filter((s) => this.known.has(s.id)).length;
    drawText(g, `Found ${found} / ${SLOTS.length}`, PANEL.x + 16 + textWidth('TRASH ALMANAC') * 2 + 12, PANEL.y + 16, { color: 'ink1' });

    drawText(g, 'JUNK', 30, 48, { color: 'ink1' });
    drawText(g, 'GULLS', 30, 112, { color: 'ink1' });
    drawText(g, 'SPECIALS', 318, 112, { color: 'ink1' });
    // A nudge toward the other tab.
    drawText(g, `RECIPES: ${this.brewed.size} / ${CARDS.length} brewed (R)`, 610, 112, { color: 'toxic0', align: 'right' });
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

  // ---- The Recipe Book ----

  /** Show this ingredient's icon on an undiscovered recipe? (Found in the Almanac, or revealed.) */
  private shows(rec: RecipeDef, id: ItemId): boolean {
    return this.brewed.has(rec.id) || this.revealed.has(rec.id) || this.known.has(id);
  }

  private paintBook(g: CanvasRenderingContext2D): void {
    bigText(g, 'RECIPE BOOK', PANEL.x + 16, PANEL.y + 10, 2, { color: 'ink0' });
    drawText(g, `${this.brewed.size} / ${CARDS.length} recipes`, PANEL.x + 16 + textWidth('RECIPE BOOK') * 2 + 12, PANEL.y + 16, { color: 'ink1' });
    for (const c of CARDS) this.drawCard(g, c);
    this.drawPage(g);
  }

  private drawCard(g: CanvasRenderingContext2D, card: Card): void {
    const { r, rec } = card;
    const brewed = this.brewed.has(rec.id);
    const picked = this.pickedRecipe === rec.id;
    fillRect(g, { x: r.x + 1, y: r.y + 1, w: r.w, h: r.h }, 'ink0');
    fillRect(g, r, brewed ? 'card0' : 'ink1');
    if (picked) outlineRect(g, { x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }, 'sodium3', 2);
    drawText(g, String(card.n), r.x + 3, r.y + 1, { color: brewed ? 'card3' : 'ink2' });
    const fy = r.y + r.h - 3;
    this.ingredient(g, rec, rec.a, r.x + 20, fy);
    drawText(g, '+', r.x + 37, r.y + 14, { color: brewed ? 'bone' : 'night3' });
    this.ingredient(g, rec, rec.b, r.x + 54, fy);
    drawText(g, '=', r.x + 71, r.y + 14, { color: brewed ? 'toxic3' : 'night3' });
    if (brewed) drawItem(g, rec.id, r.x + 92, fy, { phase: card.n * 0.4 });
    else {
      drawSilhouette(g, rec.id, r.x + 92, fy, 'night1');
      drawText(g, '?', r.x + 92, r.y + 14, { color: 'toxic2', align: 'center' });
    }
    // Tools and treasures: a little corner mark once you know which it is.
    if (brewed) fillRect(g, { x: r.x + r.w - 5, y: r.y + 2, w: 3, h: 3 }, rec.kind === 'treasure' ? 'yellow' : 'toxic2');
  }

  /** One ingredient on a card: its icon if you've found it, else "???". */
  private ingredient(g: CanvasRenderingContext2D, rec: RecipeDef, id: ItemId, fx: number, fy: number): void {
    if (this.shows(rec, id)) {
      drawItem(g, id, fx, fy, { phase: fx * 0.1 });
      return;
    }
    drawText(g, '???', fx, fy - 20, { color: 'night3', align: 'center' });
  }

  private drawPage(g: CanvasRenderingContext2D): void {
    const card = CARDS.find((c) => c.rec.id === this.pickedRecipe) ?? CARDS[0];
    if (!card) return;
    const { rec } = card;
    const brewed = this.brewed.has(rec.id);
    const r = { x: 30, y: 218, w: 580, h: 68 };
    drawPaper(g, r);
    // "[a] + [b] = [result]" at full size on the left.
    fillRect(g, { x: r.x + 6, y: r.y + 8, w: 134, h: 52 }, brewed ? 'card1' : 'card0');
    const fy = r.y + 52;
    const icon = (id: ItemId, x: number): void => {
      if (this.shows(rec, id)) drawItem(g, id, x, fy, { phase: x * 0.1 });
      else drawText(g, '???', x, fy - 20, { color: 'card3', align: 'center' });
    };
    icon(rec.a, r.x + 24);
    drawText(g, '+', r.x + 43, fy - 20, { color: 'ink0' });
    icon(rec.b, r.x + 62);
    drawText(g, '=', r.x + 81, fy - 20, { color: 'ink0' });
    if (brewed) drawItem(g, rec.id, r.x + 112, fy, { phase: this.t });
    else {
      drawSilhouette(g, rec.id, r.x + 112, fy, 'ink1');
      drawText(g, '?', r.x + 112, fy - 20, { color: 'toxic3', align: 'center' });
    }

    const x = r.x + 150;
    const wrapW = r.w - 160;
    if (!brewed) {
      bigText(g, `#${card.n}  ???`, x, r.y + 6, 2, { color: 'ink0' });
      drawText(g, `"${rec.riddle}"`, x, r.y + 30, { color: 'rust1' });
      const a = this.shows(rec, rec.a);
      const b = this.shows(rec, rec.b);
      const nudge = this.revealed.has(rec.id)
        ? `Grandma's Recipe Card says: ${ITEMS[rec.a].name} + ${ITEMS[rec.b].name}.`
        : a && b
          ? "You've found both of these. Drop one on the other."
          : a || b
            ? "You've found one of these. The other's out there."
            : 'Not found yet. Keep digging.';
      drawText(g, nudge, x, r.y + 44, { color: 'ink1' });
      return;
    }
    const d = ITEMS[rec.id];
    bigText(g, d.name.toUpperCase(), x, r.y + 6, 2, { color: 'ink0' });
    const kind = rec.kind === 'treasure' ? 'TREASURE' : 'TOOL';
    drawText(g, kind, r.x + r.w - 8, r.y + 10, { color: rec.kind === 'treasure' ? 'rust1' : 'toxic0', align: 'right' });
    wrapText(rec.effect, wrapW)
      .slice(0, 2)
      .forEach((l, i) => drawText(g, l, x, r.y + 30 + i * 10, { color: 'ink0' }));
    drawText(g, `"${rec.riddle}"`, x, r.y + 52, { color: 'ink1' });
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
  if (d.chain === 'brew') return 'Brewed: see the Recipe Book';
  return id === 'golden_egg' ? 'Special · from the Gull God' : 'Special · from the Swap Meet';
}
