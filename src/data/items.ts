// Both merge chains and the specials (docs/DESIGN.md has the tables).
import { TUNING } from './tuning';

/** `brew`: recipe results (two DIFFERENT things dropped on each other; src/data/recipes.ts). */
export type Chain = 'junk' | 'gull' | 'special' | 'brew';

// [id, name, quip, short]: `short` is what a raccoon calls it in a line ("Can I have a {item}?").
const JUNK = [
  ['cap', 'Bottle Cap', 'A start.', 'bottle cap'],
  ['can', 'Crushed Can', 'Somebody stepped on this. Good.', 'can'],
  ['takeout', 'Takeout Box', "There's a fork in it. Still.", 'takeout box'],
  ['bag', 'Leaky Trash Bag', "Don't squeeze it.", 'trash bag'],
  ['boot', 'One Boot', "Where's the other one? Don't ask.", 'boot'],
  ['toaster', 'Busted Toaster', 'Makes toast. Also sparks.', 'toaster'],
  ['tire', 'Bald Tire', 'Smells like a highway.', 'tire'],
  ['cart', 'Shopping Cart', 'One wheel has opinions.', 'shopping cart'],
  ['mattress', 'Stained Mattress', "We don't talk about the stain.", 'mattress'],
  ['fridge', 'Fridge (door hanging)', 'Something in the crisper is alive.', 'fridge'],
  ['car', 'Dead Car', "Runs great. Doesn't run.", 'car'],
  ['king', 'The Trash King', 'All hail. Do not touch the crown.', 'King'],
] as const;

const GULL = [
  ['gull', 'Seagull', 'It looked at you. It knows.', 'seagull'],
  ['fatgull', 'Fat Gull', 'Ate a whole sandwich. Wrapper too.', 'fat gull'],
  ['gullgang', 'Gull Gang', 'Three of them. All screaming.', 'gull gang'],
  ['gullboss', 'Gull Boss', 'Stole a bag of chips. Runs the lot now.', 'gull boss'],
  ['gullgod', 'The Gull God', 'It has seen every french fry ever dropped.', 'Gull God'],
] as const;

const SPECIAL = [
  ['golden_egg', 'Golden Egg', 'Drop it on junk to raise it two tiers.', 'golden egg'],
  ['bin_juice', 'Bin Juice', 'Merges with anything. Do not drink.', 'bin juice'],
] as const;

/**
 * Recipe results (docs/V2.md "Alchemy"; the recipes themselves are in src/data/recipes.ts). The
 * last number is a treasure's value as a point on the junk curve (`junkValue` of that tier, so it
 * scales with the economy); 0 for a tool (tools are priced by use, not sold).
 */
const BREW = [
  ['chime', 'Hobo Wind Chime', 'Clinks in the breeze. Sells like a dream.', 'wind chime', 3.5],
  ['stew', 'Mystery Stew', "Don't ask what the meat is. It's can.", 'stew', 0],
  ['bagbomb', 'Bag Bomb', "It's ticking. Bags don't tick.", 'bag bomb', 0],
  ['burrito', 'Garbage Burrito', 'A meal, in a meal, in a bag.', 'burrito', 5.3],
  ['piggyboot', 'Piggy Boot', 'Shake it. It jingles. It also squelches.', 'piggy boot', 6],
  ['bootcoffee', 'Boot Coffee', 'Brewed in a boot. Wakes the dead and the truck driver.', 'boot coffee', 0],
  ['elecsoup', 'Electric Soup', 'Hums. Glows. Do not lick.', 'electric soup', 0],
  ['magnet', 'Junk Magnet', 'Pulls junk to junk. Also forks. Also teeth.', 'junk magnet', 0],
  ['forkgull', 'Gull With A Fork', 'Finally, some table manners.', 'fork gull', 0],
  ['chum', 'Chum Bucket', 'Every gull in the county can smell it.', 'chum bucket', 0],
  ['tirefire', 'Tire Fire', 'Smells like a highway on fire. Because it is.', 'tire fire', 0],
  ['blanket', 'Electric Blanket', 'Toasty. Sparky. Smells of nothing, somehow.', 'electric blanket', 0],
  ['leftovers', 'Leftovers', 'Somehow there is always more.', 'leftovers', 0],
  ['truckshoe', 'Monster Truck Shoe', 'One small step for a raccoon. One giant tread.', 'monster truck shoe', 8],
  ['rotisserie', 'Rotisserie Gull', 'It spins. It sizzles. It is still screaming.', 'rotisserie gull', 7.4],
  ['gokart', 'Go-Kart', "Lil' Pete has dreamed of this.", 'go-kart', 9.4],
  ['getaway', 'Getaway Cart', 'The Gull Boss rides shotgun. Floor it.', 'getaway cart', 9.3],
  ['shopbed', 'Shopping Bed', 'Sleep anywhere. Roll everywhere.', 'shopping bed', 10.2],
  ['panicroom', 'Panic Room', 'Mattress walls. A milk supply. Nobody gets in.', 'panic room', 11.2],
  ['icecream', 'Ice Cream Truck', 'It plays a song. Nobody knows which.', 'ice cream truck', 12.4],
] as const;

/** Shinies paid for each gull tier when a raccoon orders one (the God never stays). */
const GULL_VALUE = [20, 60, 150, 400, 0] as const;

export type ItemId =
  | (typeof JUNK)[number][0]
  | (typeof GULL)[number][0]
  | (typeof SPECIAL)[number][0]
  | (typeof BREW)[number][0];

export interface ItemDef {
  id: ItemId;
  chain: Chain;
  /** 1-based within its chain; 0 for specials. */
  tier: number;
  name: string;
  quip: string;
  /** Lower-case, for raccoon lines: "Can I have a toaster?" */
  short: string;
  /** Shinies when delivered to an order. */
  value: number;
  /** What two of these merge into; null for a chain's top tier and the specials. */
  next: ItemId | null;
}

/**
 * base * growth^(tier - 1), as a price-tag number: whole under 100, else two significant figures,
 * then x TUNING.value.scale (v2: everything x10, so a cap is 20).
 */
function junkValue(tier: number): number {
  const v = TUNING.value.base * TUNING.value.growth ** (tier - 1);
  if (v < 100) return Math.max(1, Math.round(v)) * TUNING.value.scale;
  const step = 10 ** (Math.floor(Math.log10(v)) - 1);
  return Math.round(v / step) * step * TUNING.value.scale;
}

function build(): Record<ItemId, ItemDef> {
  const out = {} as Record<ItemId, ItemDef>;
  JUNK.forEach(([id, name, quip, short], i) => {
    out[id] = { id, chain: 'junk', tier: i + 1, name, quip, short, value: junkValue(i + 1), next: JUNK[i + 1]?.[0] ?? null };
  });
  GULL.forEach(([id, name, quip, short], i) => {
    out[id] = { id, chain: 'gull', tier: i + 1, name, quip, short, value: GULL_VALUE[i] * TUNING.value.scale, next: GULL[i + 1]?.[0] ?? null };
  });
  for (const [id, name, quip, short] of SPECIAL) {
    out[id] = { id, chain: 'special', tier: 0, name, quip, short, value: 0, next: null };
  }
  // Brews never merge (next: null); a treasure's value is a point on the junk curve, a tool's 0.
  for (const [id, name, quip, short, at] of BREW) {
    out[id] = { id, chain: 'brew', tier: 0, name, quip, short, value: at > 0 ? junkValue(at) : 0, next: null };
  }
  return out;
}

export const ITEMS: Record<ItemId, ItemDef> = build();

export const JUNK_CHAIN: readonly ItemId[] = JUNK.map(([id]) => id);
export const GULL_CHAIN: readonly ItemId[] = GULL.map(([id]) => id);
/** Every recipe result, in the Recipe Book's order (src/data/recipes.ts has the recipes). */
export const BREW_ITEMS: readonly ItemId[] = BREW.map(([id]) => id);

/** The junk item at a 1-based tier. */
export function junkAt(tier: number): ItemId {
  const id = JUNK_CHAIN[Math.max(1, Math.min(JUNK_CHAIN.length, tier)) - 1];
  if (id === undefined) throw new Error(`no junk at tier ${tier}`);
  return id;
}
