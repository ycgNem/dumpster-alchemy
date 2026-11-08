// The whole simulation of one night, as plain data. Systems in src/game/ are functions over this
// (no DOM, no canvas, no audio), so the headless bot (`npm run sim`) runs the same game.
import { ITEMS, JUNK_CHAIN, type ItemId } from '../data/items';
import { TUNING } from '../data/tuning';
import { Rng } from '../engine/rng';
import { Board, type Piece } from './board';
import type { ComboState } from './combo';
import type { GameEvent } from './events';
import { rollJackpotAt, rollTruckLoad } from './loads';

/** Where a piece flying onto the board came from (the renderer picks the start point). */
export type Source = 'dumpster' | 'truck' | 'kick' | 'egg';
/** A flight comes from a Source, or it's a seagull swooping in (src/game/gulls.ts). */
export type FlightFrom = Source | 'gull';

/** A piece in the air. It already owns its cell on the board, but can't be touched yet. */
export interface Flight {
  uid: number;
  c: number;
  r: number;
  from: FlightFrom;
  /** Seconds in the air so far, and in total. */
  t: number;
  dur: number;
  /** Which order slot kicked it (for 'kick'), which truck tipped it (for 'truck': 0, or 1 for Garbage Day's second), else 0. */
  slot: number;
}

export type TruckPhase = 'away' | 'arrive' | 'dump' | 'leave';

export interface Truck {
  phase: TruckPhase;
  /** Seconds until the next dump (keeps counting through every phase). */
  timer: number;
  /** Seconds spent in the current phase. */
  t: number;
  /** Items still to tip out during this dump, in order. */
  load: ItemId[];
  /** How many items this dump started with. */
  loadSize: number;
  dumps: number;
  /** The next dump, rolled ahead of time so the HUD can say "next load: 9" (`nextTruckLoad`). */
  next: ItemId[];
  /** 0 for the regular truck, 1 for Garbage Day's second truck (`s.truck2`). */
  which: number;
}

export type Mood = 'waiting' | 'happy' | 'angry';

export interface Order {
  /** A RaccoonDef id from src/data/raccoons.ts. */
  raccoon: string;
  wants: ItemId[];
  got: boolean[];
  patience: number;
  patienceMax: number;
  mood: Mood;
  /** Seconds since the raccoon arrived, or since its mood changed. */
  t: number;
  /** What the raccoon is saying right now. */
  line: string;
  /** Shinies paid out on this order so far. */
  paid: number;
  /** The night's big order: tier 7+, a long timer, big pay; leaves quietly if it isn't filled. */
  jackpot: boolean;
  /** A big spender in the Extra Raccoon's slot: one big item, more patience, better pay. */
  big: boolean;
  /**
   * The bulk small-junk order: wants several tier 1-2 pieces (3-5, at most two kinds, biggest
   * first in `wants`), with more patience, at a fair rate per piece. One at a time.
   */
  scrap: boolean;
  /**
   * What each item pays is `ITEMS[id].value * payMul` (rounded), before the patience bonus: the
   * raccoon's taste, big spender, scrap, jackpot and tonight's rule all folded in. Use
   * `itemPay(o, id)` (orders.ts) for a price tag.
   */
  payMul: number;
  /** Alchemy: a Mystery Stew was poured on this order (patience refilled, pay x2; once per order). */
  stewed?: boolean;
  /** Alchemy: the recipe (its result id) whose riddle this raccoon is sharing, if any. */
  riddle?: ItemId;
}

export interface Drag {
  uid: number;
  /** The cell it was picked up from (the piece stays there until it's dropped). */
  c: number;
  r: number;
  /** The pointer, in logical screen pixels (for the renderer only). */
  x: number;
  y: number;
}

export interface NightStats {
  earned: number;
  ordersFilled: number;
  ordersAngry: number;
  itemsDelivered: number;
  overflows: number;
  peakStink: number;
  merges: number;
  compacted: number;
  dumpsterClicks: number;
  truckItems: number;
  /** Seagulls that flew in, junk they ate, Shinies the Gull Boss pecked, Golden Eggs laid. */
  gulls: number;
  gullEats: number;
  pecked: number;
  eggs: number;
  /** Shinies paid for staying on the clock past the quota until 6 AM (0 if none): overtime x2. */
  overtimeBonus: number;
  /** Overtime confiscated by the Possum: the Stink maxed after the quota (0 if none). */
  overtimeLost: number;
  /**
   * Where tonight's Stink came from (before decay): junk with no room, storm-offs, a crowded lot,
   * and smelly junk (pieces left unmerged too long).
   */
  stinkFrom: { overflow: number; angry: number; crowding: number; smelly: number };
  /** Full Moon merges that skipped a tier; scrap orders filled. */
  skips: number;
  scraps: number;
  /** Jackpot orders filled tonight, and junk gifted back by King-night raccoons. */
  jackpots: number;
  gifts: number;
  /**
   * Alchemy (src/game/alchemy.ts): recipes brewed, of them brewed for the first time ever, tools
   * used, treasures handed to raccoons and the Shinies they paid.
   */
  brews: number;
  newRecipes: number;
  toolsUsed: number;
  treasures: number;
  treasureShinies: number;
}

export type Status = 'playing' | 'won' | 'lost';

/**
 * Why the night ended. Wins: `clockout` (the player clocked out after the quota), `shift` (made
 * it to 6 AM with the quota, overtime paid), `stinkAfterQuota` (the Stink maxed after the quota:
 * still a pass, no overtime), `king` (the Trash King built). Losses: `stink` (before the quota),
 * `quota` (6 AM came first; on a King night, no King by 6 AM). `endless`: an Endless shift is over.
 */
export type EndReason = 'clockout' | 'shift' | 'stinkAfterQuota' | 'stink' | 'quota' | 'king' | 'endless';

/**
 * What changes from night to night: the Swap Meet's upgrades and the night's difficulty
 * (docs/ARCHITECTURE.md, "Mods"). Systems read these instead of the TUNING numbers they
 * replace. `defaultMods()` is a night with no upgrades at night-1 difficulty.
 */
export interface Mods {
  // Swap Meet upgrades
  dumpsterCharges: number;
  dumpsterRefillSec: number;
  orderSlots: number;
  compactorCooldownSec: number;
  /** Shinies the Crusher pays per junk tier crushed (0: it pays nothing). The code calls it the compactor. */
  compactorPayPerTier: number;
  stinkDecayMul: number;
  /** Multiplies TUNING.gulls.chancePerMerge (the Plastic Owl lowers it; nights raise it). */
  gullChanceMul: number;
  /** The highest junk tier any gull dares eat (the Plastic Owl scares them off the good stuff). */
  gullEatMax: number;
  // The night's difficulty (src/data/nights.ts)
  truckIntervalMul: number;
  truckLoadMul: number;
  /** Weights for junk tiers 1, 2, 3... per truck item (night 10 brings the big stuff). */
  truckTierOdds: readonly number[];
  patienceMul: number;
  /** Multiplies every Stink gain (the Air Freshener lowers it; Spring Cleaning raises it). */
  stinkGainMul: number;
  // Each night's one rule (src/data/nights.ts `rule`)
  /** Multiplies how long junk takes to go smelly (Heat Wave 0.5: twice as fast). */
  ripenMul: number;
  /** The Stink at which the Possum shuts the lot down (The Inspection: 75). */
  stinkMax: number;
  /** Every order pays this much more (Takeout Tuesday, Rush Hour: 1.5). */
  orderPayMul: number;
  /** Raccoons only order junk tiers in [min, max] tonight (Takeout Tuesday: 3-4), or null. */
  orderTiers: readonly [number, number] | null;
  /** Scrap orders (several tier 1-2 pieces) come tonight. */
  scrapOrders: boolean;
  /** Gull orders pay this much more, and come this much more often (Seagull Season). */
  gullPayMul: number;
  gullOrderMul: number;
  /** Chance a merge skips a tier and makes the one after (Full Moon: 0.1). */
  skipChance: number;
  /** Multiplies the Crusher's scrap pay; above 1 it pays 1 per tier even without the upgrade (Bulk Pickup). */
  compactorPayMul: number;
  /** 2 on Garbage Day: a second truck, out of step with the first (both use truckLoadMul). */
  trucks: number;
  /** The tiers tonight's jackpot may ask for, [min, max], or null for no jackpot. */
  jackpotTiers: readonly [number, number] | null;
  // v2 cross-system perks (docs/V2.md "Contracts"): the run's Contraband sets these, each system reads its own.
  /** Chain Gang: cascades also merge diagonal neighbours (src/game/combo.ts). */
  cascadeDiagonal: boolean;
  /** Streaker: seconds added to the streak window (src/game/combo.ts). */
  streakWindowBonus: number;
  /** The highest streak pay multiplier (src/game/combo.ts; Streaker raises it). */
  streakMaxMul: number;
  /** Multiplies the heat every merge, brew and delivery adds to the streak (Rave Night: 2). */
  streakGainMul: number;
  /** Alchemist's Apron: every brew makes two (src/game/alchemy.ts). */
  brewTwins: boolean;
  // v2 run: Contraband and the bosses (src/data/contraband.ts, src/game/perks.ts; the run agent's).
  /** Compost Heap: a merge with a smelly piece skips a tier. */
  smellySkip: boolean;
  /** Raccoon Mafia: caps and cans (junk tiers 1-2) pay this much more in orders. */
  smallPayMul: number;
  /** Hot Sauce: making a Toaster zaps a junk neighbour up a tier. */
  hotSauce: boolean;
  /** Pyramid Scheme: each scrap order filled tonight makes the next pay this share more (compounding). */
  scrapPayStep: number;
  /** Possum Bribe: the next shutdown is forgiven (the Stink drops back instead). */
  bribe: boolean;
  /** Double Bagger: pieces the Dumpster spits per click. */
  dumpsterPerClick: number;
  /** Overtime at 6 AM is paid again this many times (1: x2 in all; Overtime Junkie 2: x3). */
  overtimeShare: number;
  /** Sticky Fingers: chance a delivery pays double. */
  doublePayChance: number;
  /** Midnight Snack: deliveries before 1 AM pay this much more. */
  earlyPayMul: number;
  /** Golden Goose: two Gull Gangs make the Gull God (and its Golden Egg). */
  gooseEgg: boolean;
  /** Fly Farm: Shinies each smelly piece earns per second. */
  smellyPayPerSec: number;
  /** Recycling Bin: crushing a piece gives back a Dumpster charge. */
  crushRefill: boolean;
  /** Potluck: brewed results (src/data/recipes.ts) pay this much more in orders. */
  brewPayMul: number;
  /** The Inspection (boss): cells the Possum condemns each hour (no junk can land there). */
  condemnPerHour: number;
  /** Gull God Raid (boss): each hour the God steals your best junk unless a gull was handed in or crushed. */
  raid: boolean;
}

/**
 * What the run's hooks keep during one night (src/game/perks.ts): Contraband counters and the
 * bosses' state. Condemned cells live on the board (`Board.block`).
 */
export interface PerkState {
  /** The Possum Bribe forgave a shutdown tonight (the run then spends it). */
  bribed: boolean;
  /** Fly Farm: Shinies earned but not paid yet (under 1). */
  flyCash: number;
  /** The last hour the hourly boss twists ran for. */
  hour: number;
  /** Gull God Raid: a gull was handed to a raccoon or crushed since the last raid. */
  fed: boolean;
  /** Gull God Raid: pieces the God stole tonight; The Inspection: cells condemned. */
  stolen: number;
  condemned: number;
}

/** Which backdrop the lot is drawn in: each act of a run is somewhere else (docs/V2.md). */
export type SceneId = 'lot9' | 'marina' | 'trashmore';

/** What wins the night: the Shinies quota, building the Trash King (night 10), or nothing (Endless). */
export type Goal = 'quota' | 'king' | 'endless';

export function defaultMods(): Mods {
  return {
    dumpsterCharges: TUNING.dumpster.charges,
    dumpsterRefillSec: TUNING.dumpster.refillSec,
    orderSlots: TUNING.orders.slots,
    compactorCooldownSec: TUNING.compactor.cooldownSec,
    compactorPayPerTier: 0,
    stinkDecayMul: 1,
    gullChanceMul: 1,
    gullEatMax: JUNK_CHAIN.length,
    truckIntervalMul: 1,
    truckLoadMul: 1,
    truckTierOdds: TUNING.truck.tierOdds,
    patienceMul: 1,
    stinkGainMul: 1,
    ripenMul: 1,
    stinkMax: TUNING.stink.max,
    orderPayMul: 1,
    orderTiers: null,
    scrapOrders: true,
    gullPayMul: 1,
    gullOrderMul: 1,
    skipChance: 0,
    compactorPayMul: 1,
    trucks: 1,
    jackpotTiers: TUNING.jackpot.tiers,
    cascadeDiagonal: false,
    streakWindowBonus: 0,
    streakMaxMul: 2,
    streakGainMul: 1,
    brewTwins: false,
    smellySkip: false,
    smallPayMul: 1,
    hotSauce: false,
    scrapPayStep: 0,
    bribe: false,
    dumpsterPerClick: 1,
    overtimeShare: TUNING.shift.overtimeShare,
    doublePayChance: 0,
    earlyPayMul: 1,
    gooseEgg: false,
    smellyPayPerSec: 0,
    crushRefill: false,
    brewPayMul: 1,
    condemnPerHour: 0,
    raid: false,
  };
}

export interface GameState {
  night: number;
  /** Where tonight is (the act's backdrop). */
  scene: SceneId;
  /** Tonight's rule, an id in src/data/nights.ts RULES ('first', 'garbage', ..., 'inspection', 'raid', 'spring'). */
  rule: string;
  /** What the HUD calls tonight: "NIGHT 3", "DAILY #12". */
  label: string;
  /** The run's Contraband counters and boss state for tonight (src/game/perks.ts). */
  perk: PerkState;
  seed: number;
  /** Upgrades and the night's difficulty; read-only during a night. */
  mods: Mods;
  rng: Rng;
  board: Board;
  /** Seconds since midnight. */
  time: number;
  /** Whole hours past midnight (0 = 12 AM ... 6 = 6 AM, the end). */
  hour: number;
  dumpster: { charges: number; max: number; refill: number };
  truck: Truck;
  /** Garbage Day's second truck (`mods.trucks` 2), else null. `dueTruck(s)` is whichever dumps next. */
  truck2: Truck | null;
  orders: (Order | null)[];
  /** Seconds until a raccoon walks up to each empty slot. */
  orderGap: number[];
  stink: number;
  stinkWarned: boolean;
  /** Shinies earned tonight, and the night's target. */
  purse: number;
  quota: number;
  /**
   * Shinies earned after the quota was met (already in the purse). Reach 6 AM and they're paid
   * again (x2 in all); clock out and they bank at x1; let the Stink max out and the Possum takes
   * them all back.
   */
  overtimeEarned: number;
  /** Orders that have walked up tonight (night 1's first one is always a can). */
  ordersMade: number;
  /** Uids of junk that has gone smelly (for the one `ripen` event each); stink.ts keeps it. */
  ripe: Set<number>;
  /** What wins tonight (src/data/nights.ts): the quota, the Trash King, or Endless (no 6 AM). */
  goal: Goal;
  /** Highest junk tier seen on the board tonight. */
  bestTier: number;
  /** Every item ever seen (carry it between nights; the Almanac reads it in M6). */
  discovered: Set<ItemId>;
  /**
   * Alchemy: every recipe ever brewed, by its result id (src/data/recipes.ts). Seeded from the
   * save (`NewNight.recipes`); the run carries it on as `Run.recipes`.
   */
  discoveredRecipes: Set<ItemId>;
  compactor: { cooldown: number };
  drag: Drag | null;
  flights: Flight[];
  /** Gull uid -> seconds until its next hop, scream or peck (src/game/gulls.ts). */
  gullTimers: Map<number, number>;
  /** Pushed by systems, read by fx and audio once per step, then cleared. */
  events: GameEvent[];
  status: Status;
  /** Seconds after midnight the purse first reached the quota (quota nights), else null. */
  quotaMetAt: number | null;
  /** Why the night ended; null while it's still on. */
  endReason: EndReason | null;
  /** When tonight's jackpot raccoon may walk up (seconds after midnight); null once it has. */
  jackpotAt: number | null;
  stats: NightStats;
  /** Cascades, the Stench Streak and Fever (src/game/combo.ts makes it on first use). */
  combo?: ComboState;
}

export interface NewNight {
  seed: number;
  night?: number;
  quota?: number;
  goal?: Goal;
  discovered?: Iterable<ItemId>;
  /** Recipes brewed before (their result ids): the Recipe Book's discoveries. */
  recipes?: Iterable<ItemId>;
  mods?: Partial<Mods>;
  /** The act's backdrop (default Lot 9). */
  scene?: SceneId;
  /** Tonight's rule id (src/data/nights.ts RULES) and the HUD's label for the night. */
  rule?: string;
  label?: string;
}

export function createState(o: NewNight): GameState {
  const { cols, rows } = TUNING.board;
  const mods: Mods = { ...defaultMods(), ...o.mods };
  const slots = mods.orderSlots;
  const s: GameState = {
    night: o.night ?? 1,
    scene: o.scene ?? 'lot9',
    rule: o.rule ?? 'first',
    label: o.label ?? (o.goal === 'endless' ? 'ENDLESS' : `NIGHT ${o.night ?? 1}`),
    perk: { bribed: false, flyCash: 0, hour: 0, fed: false, stolen: 0, condemned: 0 },
    seed: o.seed,
    mods,
    rng: new Rng(o.seed),
    board: new Board(cols, rows),
    time: 0,
    hour: 0,
    dumpster: { charges: mods.dumpsterCharges, max: mods.dumpsterCharges, refill: 0 },
    truck: newTruck(0, TUNING.truck.firstDumpSec),
    truck2: null,
    orders: Array.from({ length: slots }, () => null),
    orderGap: Array.from({ length: slots }, (_, i) => TUNING.orders.firstArriveSec[i] ?? 30),
    stink: 0,
    stinkWarned: false,
    purse: 0,
    quota: o.quota ?? TUNING.shift.quotaNight1,
    overtimeEarned: 0,
    ordersMade: 0,
    ripe: new Set(),
    goal: o.goal ?? 'quota',
    bestTier: 0,
    discovered: new Set(o.discovered ?? []),
    discoveredRecipes: new Set(o.recipes ?? []),
    compactor: { cooldown: 0 },
    drag: null,
    flights: [],
    gullTimers: new Map(),
    events: [],
    status: 'playing',
    quotaMetAt: null,
    endReason: null,
    jackpotAt: null,
    stats: {
      earned: 0,
      ordersFilled: 0,
      ordersAngry: 0,
      itemsDelivered: 0,
      overflows: 0,
      peakStink: 0,
      merges: 0,
      compacted: 0,
      dumpsterClicks: 0,
      truckItems: 0,
      gulls: 0,
      gullEats: 0,
      pecked: 0,
      eggs: 0,
      overtimeBonus: 0,
      overtimeLost: 0,
      stinkFrom: { overflow: 0, angry: 0, crowding: 0, smelly: 0 },
      skips: 0,
      scraps: 0,
      jackpots: 0,
      gifts: 0,
      brews: 0,
      newRecipes: 0,
      toolsUsed: 0,
      treasures: 0,
      treasureShinies: 0,
    },
  };
  // The first load is rolled now, so the HUD can show it before the truck arrives.
  s.truck.next = rollTruckLoad(s, TUNING.truck.firstDumpSec);
  if (mods.trucks > 1) {
    // Garbage Day: the second truck runs half a gap behind the first.
    const t2 = TUNING.truck.firstDumpSec + TUNING.truck.intervalSec * mods.truckIntervalMul * TUNING.truck.secondTruckLag;
    s.truck2 = newTruck(1, t2);
    s.truck2.next = rollTruckLoad(s, t2);
  }
  s.jackpotAt = rollJackpotAt(s);
  return s;
}

function newTruck(which: number, firstDump: number): Truck {
  return { phase: 'away', timer: firstDump, t: 0, load: [], loadSize: 0, dumps: 0, next: [], which };
}

/** Seconds in a whole night. */
export function nightLength(): number {
  return TUNING.shift.secondsPerHour * TUNING.shift.hours;
}

/** How far through the night we are, 0 at midnight to 1 at 6 AM. */
export function nightProgress(s: GameState): number {
  return Math.min(1, s.time / nightLength());
}

export function inFlight(s: GameState, uid: number): boolean {
  return s.flights.some((f) => f.uid === uid);
}

/** A piece the player (or the bot) may pick up: on the board, landed, and the night still on. */
export function grabbable(s: GameState, c: number, r: number): Piece | null {
  if (s.status !== 'playing') return null;
  const p = s.board.get(c, r);
  if (!p || inFlight(s, p.uid)) return null;
  return p;
}

/** Remember an item as seen: raises the best tier, fills the Almanac. Returns true if new. */
export function noteItem(s: GameState, id: ItemId): boolean {
  const d = ITEMS[id];
  if (d.chain === 'junk') s.bestTier = Math.max(s.bestTier, d.tier);
  if (s.discovered.has(id)) return false;
  s.discovered.add(id);
  return true;
}
