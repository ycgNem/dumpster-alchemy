// Both merge chains and the specials (docs/DESIGN.md has the tables).
import { TUNING } from './tuning';

export type Chain = 'junk' | 'gull' | 'special';

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

/** Shinies paid for each gull tier when a raccoon orders one (the God never stays). */
const GULL_VALUE = [20, 60, 150, 400, 0] as const;

export type ItemId =
  | (typeof JUNK)[number][0]
  | (typeof GULL)[number][0]
  | (typeof SPECIAL)[number][0];

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

/** base * growth^(tier - 1), as a price-tag number: whole under 100, else two significant figures. */
function junkValue(tier: number): number {
  const v = TUNING.value.base * TUNING.value.growth ** (tier - 1);
  if (v < 100) return Math.max(1, Math.round(v));
  const step = 10 ** (Math.floor(Math.log10(v)) - 1);
  return Math.round(v / step) * step;
}

function build(): Record<ItemId, ItemDef> {
  const out = {} as Record<ItemId, ItemDef>;
  JUNK.forEach(([id, name, quip, short], i) => {
    out[id] = { id, chain: 'junk', tier: i + 1, name, quip, short, value: junkValue(i + 1), next: JUNK[i + 1]?.[0] ?? null };
  });
  GULL.forEach(([id, name, quip, short], i) => {
    out[id] = { id, chain: 'gull', tier: i + 1, name, quip, short, value: GULL_VALUE[i], next: GULL[i + 1]?.[0] ?? null };
  });
  for (const [id, name, quip, short] of SPECIAL) {
    out[id] = { id, chain: 'special', tier: 0, name, quip, short, value: 0, next: null };
  }
  return out;
}

export const ITEMS: Record<ItemId, ItemDef> = build();

export const JUNK_CHAIN: readonly ItemId[] = JUNK.map(([id]) => id);
export const GULL_CHAIN: readonly ItemId[] = GULL.map(([id]) => id);

/** The junk item at a 1-based tier. */
export function junkAt(tier: number): ItemId {
  const id = JUNK_CHAIN[Math.max(1, Math.min(JUNK_CHAIN.length, tier)) - 1];
  if (id === undefined) throw new Error(`no junk at tier ${tier}`);
  return id;
}
