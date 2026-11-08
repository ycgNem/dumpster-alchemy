// The recipe table (docs/V2.md "Alchemy"): drop one thing on a DIFFERENT thing and, if the pair
// is here, they brew. Recipes are symmetric (A on B = B on A). The results are items in the
// 'brew' chain (src/data/items.ts holds their names, quips and treasure values):
//
//   tools      used once, by dropping them on their target (a cell, a piece, anything on the lot,
//              or an order card); dropped on dirt they just move
//   treasures  any raccoon takes one as their WHOLE order, paying its value at their rate
//
// Brews never merge, never go smelly and gulls won't eat them. The game rules are in
// src/game/alchemy.ts; the numbers the tools use are in ALCHEMY below.
import { ITEMS, type ItemId } from './items';

export type BrewKind = 'tool' | 'treasure';

/**
 * Where a tool goes: 'area' (a piece, and the 3x3 around it), 'row' (a piece, and its whole row),
 * 'lot' (any piece on the lot: it works on the whole lot), 'piece' (one piece), 'order' (a card).
 */
export type ToolAim = 'area' | 'row' | 'lot' | 'piece' | 'order';

export interface RecipeDef {
  /** The result: an item in the 'brew' chain. Its place in RECIPES is its number in the Book. */
  id: ItemId;
  /** The two ingredients (either one can be the one dropped). */
  a: ItemId;
  b: ItemId;
  kind: BrewKind;
  /** Tools: what to drop it on. Null for treasures (they go to any order). */
  aim: ToolAim | null;
  /** The Recipe Book's hint for an undiscovered slot (fixed in docs/V2.md). */
  riddle: string;
  /** What a tool does, one short line (the Book, the hover). Treasures say it from their value. */
  effect: string;
}

/** The numbers the tools and the riddle drip use (src/game/alchemy.ts). Tune here. */
export const ALCHEMY = {
  /** Mystery Stew: the order's pay is multiplied by this (once per order). */
  stewPayMul: 2,
  /** Bag Bomb: each junk piece in the 3x3 pays max(Crusher pay x crushMul, its value x valueMul). */
  bomb: { crushMul: 3, valueMul: 1 },
  /** Tire Fire: the same for its row, plus a puff of Stink. */
  fire: { crushMul: 2, valueMul: 2, stink: 6 },
  /** Boot Coffee: seconds added to every truck's countdown. */
  coffeeStallSec: 20,
  /** Gull With A Fork: each cap and can it eats pays its value times this. */
  forkValueMul: 3,
  forkEats: ['cap', 'can'] as readonly ItemId[],
  /** Electric Blanket: the Stink drops by this much. */
  blanketStinkDrop: 25,
  /** A treasure delivered to a scrap order doesn't get the scrap order's x2 (that's for caps). */
  treasureIgnoresScrapMul: true,
  /**
   * The riddle drip: a raccoon walking up may share the riddle of a recipe you haven't brewed
   * whose ingredients you've both seen. This chance per arrival, one riddle on the counter at a time.
   */
  riddleChance: 0.14,
} as const;

/** [result, a, b, kind, aim, riddle, effect] in the Book's order (docs/V2.md). */
const TABLE: readonly [ItemId, ItemId, ItemId, BrewKind, ToolAim | null, string, string][] = [
  ['chime', 'cap', 'can', 'treasure', null, 'Two things that clink.', ''],
  ['stew', 'can', 'takeout', 'tool', 'order', 'Something you drink from, something you eat from.',
    'Drop on a raccoon: their patience refills and the order pays x2.'],
  ['bagbomb', 'cap', 'bag', 'tool', 'area', 'Something sharp, something about to burst.',
    'Drop on junk: the 3x3 around it bursts, and every junk in it pays out.'],
  ['burrito', 'takeout', 'bag', 'treasure', null, 'Wrap a meal in a meal.', ''],
  ['piggyboot', 'cap', 'boot', 'treasure', null, 'A boot full of change.', ''],
  ['bootcoffee', 'can', 'boot', 'tool', 'lot', 'Something you drink from, something you walk in.',
    "Drop on anything: the truck stalls 20 s and every raccoon's patience refills."],
  ['elecsoup', 'bag', 'toaster', 'tool', 'area', 'Something that leaks, something that sparks.',
    'Drop on junk: every junk piece in the 3x3 goes up one tier (never into the King).'],
  ['magnet', 'can', 'toaster', 'tool', 'piece', 'Something metal, something electric.',
    'Drop on a piece: every one like it flies over, and they merge as far as they go.'],
  ['forkgull', 'gull', 'takeout', 'tool', 'lot', 'A bird, and its dinner.',
    'Drop on anything: it eats every cap and can on the lot, paying x3 each.'],
  ['chum', 'fatgull', 'bag', 'tool', 'lot', 'A fat bird, and a bag of something wet.',
    'Drop on anything: every gull on the lot goes up one tier.'],
  ['tirefire', 'tire', 'takeout', 'tool', 'row', 'Something that rolls, something greasy.',
    'Drop on junk: its whole row burns for x2 pay each. +6 Stink.'],
  ['blanket', 'mattress', 'toaster', 'tool', 'lot', 'Somewhere to sleep, something that heats.',
    'Drop on anything: all smelly junk goes fresh and the Stink drops 25.'],
  ['leftovers', 'fridge', 'takeout', 'tool', 'piece', 'Something cold, and what you put in it.',
    'Drop on a piece: a copy of it lands in the nearest empty cell.'],
  ['truckshoe', 'boot', 'tire', 'treasure', null, 'One for walking, one for rolling.', ''],
  ['rotisserie', 'fatgull', 'toaster', 'treasure', null, 'A fat bird, a hot box.', ''],
  ['gokart', 'cart', 'tire', 'treasure', null, 'It already has wheels. Give it a better one.', ''],
  ['getaway', 'gullboss', 'cart', 'treasure', null, 'The boss needs a ride.', ''],
  ['shopbed', 'mattress', 'cart', 'treasure', null, 'Sleep on the go.', ''],
  ['panicroom', 'mattress', 'fridge', 'treasure', null, 'Somewhere to sleep, somewhere to hide the milk.', ''],
  ['icecream', 'car', 'fridge', 'treasure', null, "Something that drives, something that's cold.", ''],
];

export const RECIPES: readonly RecipeDef[] = TABLE.map(([id, a, b, kind, aim, riddle, effect]) => ({
  id,
  a,
  b,
  kind,
  aim,
  riddle,
  effect: kind === 'treasure' ? `Treasure: any raccoon takes it as their whole order. Worth ${ITEMS[id].value}.` : effect,
}));

const pairKey = (a: ItemId, b: ItemId): string => (a < b ? `${a}+${b}` : `${b}+${a}`);
const BY_PAIR = new Map<string, RecipeDef>(RECIPES.map((r) => [pairKey(r.a, r.b), r]));
const BY_RESULT = new Map<ItemId, RecipeDef>(RECIPES.map((r) => [r.id, r]));

/** The recipe two different things make, or null (a pair of the same thing never brews). */
export function recipeFor(a: ItemId, b: ItemId): RecipeDef | null {
  if (a === b) return null;
  return BY_PAIR.get(pairKey(a, b)) ?? null;
}

/** The recipe that makes this result, or null if it isn't a brew. */
export function recipeOf(id: ItemId): RecipeDef | null {
  return BY_RESULT.get(id) ?? null;
}

/** A brewed tool: used on a target, never merged, swapped or sold. */
export function isTool(id: ItemId): boolean {
  return BY_RESULT.get(id)?.kind === 'tool';
}

/** A brewed treasure: any order takes it as the whole order. */
export function isTreasure(id: ItemId): boolean {
  return BY_RESULT.get(id)?.kind === 'treasure';
}

/** How a treasure compares with selling its two ingredients (the design asks for about 1.5-2.5x). */
export function treasureRatio(r: RecipeDef): number {
  const parts = ITEMS[r.a].value + ITEMS[r.b].value;
  return parts > 0 ? ITEMS[r.id].value / parts : 0;
}
