// The raccoon order cards down the left: portrait, what they're saying, the junk they want
// (ticked off as it's delivered), a patience bar. They slide in when a raccoon walks up and
// out when it leaves; while you drag, the cards that want your piece light up.
import { ITEMS, type ItemId } from '../data/items';
import type { PalName } from '../data/palette';
import { TUNING } from '../data/tuning';
import { dropKind, type Target } from '../game/actions';
import { orderValue, raccoonDef, wants } from '../game/orders';
import type { GameState, Order } from '../game/state';
import { drawItem } from './board';
import { coinGlyph } from './hud';
import { cardboard, fillRect, outlineRect, paper, placeholderRaccoon } from './greybox';
import { orderSlot, orderSlotCount, setOrderSlots, type Rect } from './layout';
import { bigText } from './menus';
import { drawNine, drawSprite } from './sprites';
import { drawText, textWidth, wrapText } from './text';
import type { View } from './view';

const F = TUNING.feel;

/** The card's panel: the hand-drawn 9-slice if it exists, else greybox cardboard. */
export function panel(g: CanvasRenderingContext2D, r: Rect): void {
  if (!drawNine(g, 'panel', r)) cardboard(g, r);
}

function slideX(o: Order): number {
  const slide = F.orderSlideSec;
  if (o.mood === 'waiting') {
    const p = Math.min(1, o.t / slide);
    return -Math.round((1 - p) * (1 - p) * 176);
  }
  const left = TUNING.orders.leaveSec - o.t;
  if (left > slide) return 0;
  const p = 1 - Math.max(0, left) / slide;
  return -Math.round(p * p * 176);
}

function blinking(v: View, slot: number): boolean {
  const period = F.blinkEverySec + slot * 0.7;
  return (v.t + slot * 1.3) % period < F.blinkSec;
}

function portrait(g: CanvasRenderingContext2D, o: Order, slot: number, v: View, fx: number, fy: number): void {
  const mood = o.mood === 'waiting' ? 'idle' : o.mood;
  const blink = mood === 'idle' && blinking(v, slot);
  // Angry raccoons shake; happy ones hop.
  const dx = o.mood === 'angry' && !o.jackpot ? Math.round(Math.sin(v.t * 50) * 1.5) : 0;
  const dy = o.mood === 'happy' && o.t < 0.5 ? -Math.round(Math.abs(Math.sin(o.t * 12)) * 3) : 0;
  const idle = `raccoon_${o.raccoon}_idle`;
  const name = `raccoon_${o.raccoon}_${mood}`;
  // A missing happy or angry pose falls back to the idle one (the shake and hop still sell it).
  const ok =
    drawSprite(g, name, fx + dx, fy + dy, mood === 'idle' ? { frame: blink ? 1 : 0 } : {}) ||
    drawSprite(g, idle, fx + dx, fy + dy, { frame: blink ? 1 : 0 });
  if (!ok) placeholderRaccoon(g, o.raccoon, mood, blink, fx + dx, fy + dy);
}

function patienceColour(p: number): PalName {
  return p > 0.5 ? 'toxic1' : p > 0.25 ? 'yellow' : 'red';
}

/** "Grandma Mange" doesn't fit under a 48 px portrait; her friends call her Mange anyway. */
function shortName(name: string): string {
  const full = name.toUpperCase();
  return textWidth(full) > 54 ? (full.split(' ').pop() ?? full) : full;
}

/**
 * What each wanted item pays if the order were filled right now: its share of `orderValue`
 * (the items plus the patience bonus as it stands), so the tags tick down with the patience bar
 * and add up to what a full delivery pays.
 */
function livePrices(s: GameState, slot: number, o: Order): number[] {
  const total = orderValue(s, slot);
  const base = o.wants.map((id) => ITEMS[id].value);
  const sum = base.reduce((a, b) => a + b, 0) || 1;
  return base.map((b) => Math.round((total * b) / sum));
}

export function drawOrders(g: CanvasRenderingContext2D, s: GameState, v: View, hover: Target): void {
  const held = s.drag ? s.board.get(s.drag.c, s.drag.r) : null;
  // Keep the layout's slot count in step with tonight (the Extra Raccoon makes it 4).
  if (orderSlotCount() !== s.orders.length) setOrderSlots(s.orders.length);
  // The King is crowned: the regulars leave the counter to cheer in front of the board (fx.ts).
  const crowning = s.endReason === 'king';
  for (let slot = 0; slot < s.orders.length; slot++) {
    const base = orderSlot(slot);
    // Four cards are shorter: the name on the top line, one price for the order beside it.
    const compact = base.h < 60;
    const o = crowning ? null : s.orders[slot];
    if (!o) {
      // An empty spot on the ground where the next raccoon will stand.
      const a = g.globalAlpha;
      g.globalAlpha = 0.35;
      outlineRect(g, base, 'ink2');
      g.globalAlpha = a;
      drawText(g, '...', base.x + base.w / 2, base.y + (compact ? 20 : 28), { color: 'ink2', align: 'center' });
      continue;
    }
    const r = { ...base, x: base.x + slideX(o) };
    panel(g, r);
    if (o.jackpot) jackpotFrame(g, r, v, compact);
    else if (o.big) cornerTag(g, r, 'BIG', 'pink', 'ink0', compact);
    else if (o.scrap) cornerTag(g, r, 'SCRAP', 'steel3', 'ink0', compact);

    const def = raccoonDef(o.raccoon);
    portrait(g, o, slot, v, r.x + 28, r.y + (compact ? 50 : 52));
    // Tonight's rule pays more (Takeout Tuesday and Rush Hour x1.5, Seagull Season's gull orders
    // x2): a yellow sticker says so.
    const gullOrder = o.wants.some((id) => ITEMS[id].chain === 'gull');
    const boost = s.mods.orderPayMul * (gullOrder ? s.mods.gullPayMul : 1);
    if (boost > 1 && o.mood === 'waiting') payBoost(g, r, `${compact ? '' : 'PAY '}x${Math.round(boost * 10) / 10}`, v, compact);
    if (!compact) drawText(g, shortName(def.name), r.x + 28, r.y + 55, { color: 'ink0', align: 'center' });

    const waiting = o.mood === 'waiting';
    const prices = waiting && s.goal !== 'king' ? livePrices(s, slot, o) : [];
    // The patience bonus still in the price: a little up-arrow on the tags while it's worth having.
    const bonus = o.patience / o.patienceMax > 0.25;
    if (compact) {
      // One line: always who it is (their chatter doesn't fit), and what the order pays.
      drawText(g, shortName(def.name), r.x + 57, r.y + 1, { color: o.big && waiting ? 'rust1' : 'ink0' });
      if (waiting) {
        const left = prices.reduce((a, p, k) => a + (o.got[k] ? 0 : p), 0);
        if (s.goal === 'king') giftTag(g, r.x + r.w - 5, r.y + 2);
        else priceTag(g, left, r.x + r.w - 5, r.y + 2, bonus);
      }
    } else {
      // What they're saying, up to two lines.
      let lines = wrapText(o.line, 98).slice(0, 2);
      // The Extra Raccoon's slot: a big spender says so (one big item, better pay).
      if (o.big && waiting) lines = ['BIG SPENDER!', ...lines.slice(0, 1)];
      // Ink on cardboard only (STYLE.md): ink0 when it matters, ink1 for chatter.
      lines.forEach((line, i) => {
        const shout = o.big && waiting && i === 0;
        drawText(g, line, r.x + 57, r.y + 1 + i * 10, { color: shout ? 'rust1' : waiting ? 'ink1' : 'ink0' });
      });
    }

    // The junk they want: a scrap order as "[can] x3 [cap] x2" with one price for the lot.
    if (o.scrap) {
      scrapWants(g, s, o, r, compact, prices, bonus);
    } else o.wants.forEach((id, k) => {
      const fx = r.x + 74 + k * 36;
      const fy = r.y + (compact ? 43 : 54);
      fillRect(g, { x: fx - 16, y: fy - 31, w: 32, h: 32 }, 'card0');
      const got = o.got[k] ?? false;
      drawItem(g, id, fx, fy, { alpha: got ? 0.35 : 1, phase: k });
      if (got) drawTick(g, fx, fy - 14);
      else if (waiting && !compact) {
        // A coin on the price, so it reads as money, not a count. The King night pays in junk.
        // (Low on the box, so it hides as little of the item as it can.)
        if (s.goal === 'king') giftTag(g, fx + 16, fy - 5);
        else priceTag(g, prices[k] ?? 0, fx + 16, fy - 5, bonus);
      }
    });

    // Patience, or what happened.
    const bar = compact ? { x: r.x + 57, y: r.y + 46, w: 98, h: 5 } : { x: r.x + 57, y: r.y + 59, w: 98, h: 6 };
    if (o.mood === 'waiting') {
      const p = Math.max(0, o.patience / o.patienceMax);
      fillRect(g, bar, 'ink1');
      const flash = p < 0.25 && Math.sin(v.t * 14) > 0;
      fillRect(g, { x: bar.x + 1, y: bar.y + 1, w: Math.round((bar.w - 2) * p), h: bar.h - 2 }, flash ? 'bone' : patienceColour(p));
    } else if (o.mood === 'happy') {
      drawText(g, `+${o.paid} Shinies`, bar.x + bar.w, bar.y - 3, { color: 'ink0', align: 'right' });
    } else {
      // Danger text goes on a paper note, never straight on the cardboard. The jackpot raccoon
      // doesn't storm off: it shrugs and goes.
      note(g, o.jackpot ? 'GAVE UP' : 'STORMED OFF', bar.x, bar.y - 2);
    }

    // While dragging: who wants this piece, and what dropping here would do.
    if (held && o.mood === 'waiting') {
      const want = wants(s, slot, held.id);
      const over = hover.kind === 'order' && hover.slot === slot;
      if (over && s.drag) {
        const kind = dropKind(s, s.drag.c, s.drag.r, hover);
        outlineRect(g, { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, kind === 'deliver' ? 'toxic3' : 'red', 2);
      } else if (want) {
        const pulse = Math.sin(v.t * 8) > 0;
        outlineRect(g, { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, pulse ? 'toxic2' : 'toxic1', 2);
      }
    }
  }
}

/**
 * A scrap order (several caps and cans): each kind once, in its box, with a big "x3" for how many
 * are still wanted (ticking down as they're delivered; a tick when that kind is done), and one
 * price for what's left (in the header on a short card).
 */
function scrapWants(g: CanvasRenderingContext2D, s: GameState, o: Order, r: Rect, compact: boolean, prices: number[], bonus: boolean): void {
  const kinds: ItemId[] = [];
  for (const id of o.wants) if (!kinds.includes(id)) kinds.push(id);
  const fy = r.y + (compact ? 43 : 54);
  kinds.slice(0, 2).forEach((id, k) => {
    const fx = r.x + 74 + k * 36;
    const left = o.wants.filter((w, j) => w === id && !o.got[j]).length;
    fillRect(g, { x: fx - 16, y: fy - 31, w: 32, h: 32 }, 'card0');
    drawItem(g, id, fx, fy, { alpha: left === 0 ? 0.35 : 1, phase: k });
    // (Caps and cans sit low in the box: the count goes in the room above them.)
    if (left === 0) drawTick(g, fx, fy - 14);
    else bigText(g, `x${left}`, fx, fy - 34, 2, { color: 'bone', outline: 'ink0', align: 'center' });
  });
  if (o.mood !== 'waiting' || compact) return;
  const due = prices.reduce((a, p, k) => a + (o.got[k] ? 0 : p), 0);
  if (s.goal === 'king') giftTag(g, r.x + r.w - 5, fy - 5);
  else priceTag(g, due, r.x + r.w - 5, fy - 5, bonus);
}

/**
 * A little bone price tag (ink on paper) with a coin stuck on its left end, right edge at x.
 * `bonus`: a small green up-arrow after the coin (the patience bonus is still in the price).
 */
function priceTag(g: CanvasRenderingContext2D, price: number, x: number, y: number, bonus = false): void {
  // Four digits fit the slot; past that it's thousands ("13k").
  const text = price >= 10000 ? `${Math.round(price / 1000)}k` : String(price);
  const aw = bonus ? 5 : 0;
  const w = textWidth(text) + 7 + aw;
  fillRect(g, { x: x - w, y, w, h: 9 }, 'ink0');
  fillRect(g, { x: x - w + 1, y: y + 1, w: w - 1, h: 8 }, 'bone');
  coinGlyph(g, x - w - 3, y + 1);
  if (bonus) {
    const ax = x - w + 5;
    fillRect(g, { x: ax + 1, y: y + 2, w: 1, h: 1 }, 'toxic0');
    fillRect(g, { x: ax, y: y + 3, w: 3, h: 1 }, 'toxic0');
    fillRect(g, { x: ax + 1, y: y + 4, w: 1, h: 3 }, 'toxic0');
  }
  drawText(g, text, x - 1, y - 1, { color: 'ink0', align: 'right' });
}

/** The King night's tag: a filled order kicks back junk for the build, not Shinies. */
function giftTag(g: CanvasRenderingContext2D, x: number, y: number): void {
  const text = 'GIFT';
  const w = textWidth(text) + 9;
  fillRect(g, { x: x - w, y, w, h: 9 }, 'ink0');
  fillRect(g, { x: x - w + 1, y: y + 1, w: w - 1, h: 8 }, 'toxic3');
  // A little up-arrow: it comes back a tier bigger.
  fillRect(g, { x: x - w + 4, y: y + 2, w: 1, h: 6 }, 'ink0');
  fillRect(g, { x: x - w + 3, y: y + 3, w: 3, h: 1 }, 'ink0');
  fillRect(g, { x: x - w + 2, y: y + 4, w: 5, h: 1 }, 'ink0');
  drawText(g, text, x - 1, y - 1, { color: 'ink0', align: 'right' });
}

/**
 * A tag stuck on a card's top-left corner, clear of the name: over the gap above it (8 px with
 * three cards). Four cards have only a 4 px gap, so there it's a slimmer tag tucked inside the
 * frame, poking up no further than the gap.
 */
function cornerTag(g: CanvasRenderingContext2D, r: Rect, text: string, face: PalName, ink: PalName, compact = false): void {
  const tag = compact ? { x: r.x + 3, y: r.y - 3, w: textWidth(text) + 6, h: 9 } : { x: r.x + 4, y: r.y - 6, w: textWidth(text) + 6, h: 11 };
  fillRect(g, { x: tag.x + 1, y: tag.y + 1, w: tag.w, h: tag.h }, 'ink0');
  fillRect(g, tag, face);
  outlineRect(g, tag, 'ink0');
  drawText(g, text, tag.x + 3, tag.y - (compact ? 1 : 0), { color: ink });
}

/** A yellow sticker poking over a card's top-right corner (over the gap above it), with a wobble. */
function payBoost(g: CanvasRenderingContext2D, r: Rect, text: string, v: View, compact = false): void {
  const w = textWidth(text) + 6;
  const jig = Math.sin(v.t * 3) > 0.92 ? -1 : 0;
  // (A short card has the price up there: the sticker goes on the portrait's bottom corner.)
  const tag = compact ? { x: r.x + 3, y: r.y + r.h - 13 + jig, w, h: 11 } : { x: r.x + r.w - w - 4, y: r.y - 9 + jig, w, h: 11 };
  fillRect(g, { x: tag.x + 1, y: tag.y + 1, w: tag.w, h: tag.h }, 'ink0');
  fillRect(g, tag, 'yellow');
  outlineRect(g, tag, 'ink0');
  drawText(g, text, tag.x + 3, tag.y, { color: 'rust0' });
}

/** Tonight's jackpot raccoon: a gold frame, a "JACKPOT" tag and a little sparkle. */
function jackpotFrame(g: CanvasRenderingContext2D, r: Rect, v: View, compact = false): void {
  const pulse = Math.sin(v.t * 5) > 0;
  outlineRect(g, { x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }, 'ink0');
  outlineRect(g, { x: r.x, y: r.y, w: r.w, h: r.h }, pulse ? 'yellow' : 'sodium3');
  outlineRect(g, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, 'sodium2');
  cornerTag(g, r, 'JACKPOT', 'yellow', 'rust0', compact);
  // Sparkles: a few + shapes blinking round the frame.
  for (let i = 0; i < 3; i++) {
    const k = Math.floor(v.t * 3 + i * 1.7);
    if ((k + i) % 3 === 0) continue;
    const sx = r.x + ((k * 53 + i * 71) % (r.w - 8)) + 4;
    const sy = i % 2 === 0 ? r.y - 1 : r.y + r.h - 1;
    fillRect(g, { x: sx - 2, y: sy, w: 5, h: 1 }, 'white');
    fillRect(g, { x: sx, y: sy - 2, w: 1, h: 5 }, 'white');
  }
}

/** A scrap of paper with danger text in rust1. */
function note(g: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  const r = { x, y, w: textWidth(text) + 8, h: 11 };
  if (!drawNine(g, 'paper', { ...r, h: Math.max(r.h, 12) })) paper(g, r);
  drawText(g, text, x + 4, y, { color: 'rust1' });
}

function drawTick(g: CanvasRenderingContext2D, x: number, y: number): void {
  const pts: [number, number][] = [[-5, 0], [-4, 1], [-3, 2], [-2, 3], [-1, 2], [0, 1], [1, 0], [2, -1], [3, -2], [4, -3], [5, -4]];
  for (const [dx, dy] of pts) {
    fillRect(g, { x: x + dx - 1, y: y + dy - 1, w: 4, h: 4 }, 'ink0');
  }
  for (const [dx, dy] of pts) fillRect(g, { x: x + dx, y: y + dy, w: 2, h: 2 }, 'toxic2');
}

// ---------------------------------------------------------------------------------------------
// The recipe on a wanted item: rest the pointer on it and a note shows "[a] + [a] = [b]".

/** What two of make this (two Takeout Boxes make a Trash Bag), or null for a chain's first tier. */
export function madeFrom(id: ItemId): ItemId | null {
  for (const d of Object.values(ITEMS)) if (d.next === id) return d.id;
  return null;
}

/** "Takeout Boxes", "Boots", "Fridges": good enough for every name in the chains. */
function plural(name: string): string {
  const n = name.replace(/\s*\(.*\)$/, '').replace(/^One /, '');
  return /(s|x|sh|ch)$/.test(n) ? `${n}es` : `${n}s`;
}

/** The wanted item under the pointer, as "slot:index" (a tooltip key), or null. */
export function wantAt(s: GameState, x: number, y: number): string | null {
  for (let slot = 0; slot < s.orders.length; slot++) {
    const o = s.orders[slot];
    if (!o || o.mood !== 'waiting') continue;
    const card = orderSlot(slot);
    const fy = card.y + (card.h < 60 ? 43 : 54);
    const kinds = o.scrap ? [...new Set(o.wants)] : o.wants;
    for (let k = 0; k < kinds.length; k++) {
      const fx = card.x + 74 + k * 36;
      if (x >= fx - 16 && x < fx + 16 && y >= fy - 31 && y <= fy) return `want:${slot}:${k}`;
    }
  }
  return null;
}

/** The recipe note for a `wantAt` key, above the item's box. */
export function drawWantTip(g: CanvasRenderingContext2D, s: GameState, key: string, t: number): void {
  const [, a, b] = key.split(':');
  const slot = Number(a);
  const k = Number(b);
  const o = s.orders[slot];
  if (!o) return;
  const id = (o.scrap ? [...new Set(o.wants)] : o.wants)[k];
  if (!id) return;
  const from = madeFrom(id);
  const card = orderSlot(slot);
  const fx = card.x + 74 + k * 36;
  const name = ITEMS[id].name;
  const line = from ? `Two ${plural(ITEMS[from].name)} make it:` : ITEMS[id].chain === 'gull' ? 'Seagulls fly in on their own.' : 'The truck and the Dumpster bring these.';
  const w = Math.max(textWidth(name), textWidth(line), from ? 116 : 0) + 12;
  const h = from ? 58 : 28;
  const r = { x: Math.max(4, Math.min(636 - w, fx - 20)), y: Math.max(4, card.y + (card.h < 60 ? 12 : 23) - h - 4), w, h };
  fillRect(g, { x: r.x + 2, y: r.y + 2, w: r.w, h: r.h }, 'ink0');
  fillRect(g, r, 'bone');
  outlineRect(g, r, 'ink0');
  drawText(g, name, r.x + 6, r.y + 2, { color: 'ink0' });
  drawText(g, line, r.x + 6, r.y + 13, { color: 'ink1' });
  if (!from) return;
  const y = r.y + h - 3;
  const hop = Math.floor(t * 3) % 3;
  drawItem(g, from, r.x + 22, y - (hop === 0 ? 1 : 0), { phase: 0 });
  drawText(g, '+', r.x + 42, y - 20, { color: 'ink0' });
  drawItem(g, from, r.x + 62, y - (hop === 1 ? 1 : 0), { phase: 1 });
  drawText(g, '=', r.x + 82, y - 20, { color: 'rust1' });
  drawItem(g, id, r.x + 104, y - (hop === 2 ? 1 : 0), { phase: 2 });
}

