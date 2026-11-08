// The run (docs/V2.md "The run"): ten nights in three acts on a map with forks, the bank, the
// Contraband in your slots, consumables for the next night, and three strikes. Headless like the
// rest of src/game/ (the sim plays whole runs in Node); saving is src/game/save.ts, what lasts
// across runs is src/game/meta.ts.
//
// Between nights a run moves through stages, so Continue picks up where you left off:
//
//   night passed -> 'loot' (a free pick of 1 of 3; two with the loot tag) -> 'shop' (the Swap
//   Meet) -> 'map' (pick the next fork) -> 'card' (the night card) -> the night
//   night failed -> a strike -> 'card' (retry it, with half the Shinies kept; the Swap Meet first
//   if you like). The third strike is FIRED (`over`). Crowning the King wins the run.
//
// Everything random between nights (the map, loot, the shop) comes from the run seed and a
// counter, and the offers are kept in the run, so reloading never rerolls them.
import { CONTRABAND, contrabandDef, foremanDef, type ContrabandId, type ForemanId, type MilestoneId, type Rarity } from '../data/contraband';
import { ITEMS, JUNK_CHAIN, type ItemId } from '../data/items';
import { ACTS, FORK_RULES, NIGHT_COUNT, actOf, isFork, makeNight, type NightDef, type RewardTag, type RuleId } from '../data/nights';
import { RECIPES, type RecipeDef } from '../data/recipes';
import { TUNING } from '../data/tuning';
import { Rng } from '../engine/rng';
import { contrabandPool, type Meta } from './meta';
import { applyContraband } from './perks';
import { launch } from './spawn';
import { createState, defaultMods, type GameState, type Mods, type NightStats } from './state';

const R = TUNING.run;

/** What a lost night keeps of its Shinies. */
export const LOST_KEEP = R.lostKeep;

export interface RunStats {
  nightsWon: number;
  nightsLost: number;
  /** Shinies earned over the whole run (before a loss halves them). */
  earned: number;
  ordersFilled: number;
  merges: number;
  brews: number;
  /** The best junk tier built this run. */
  bestTier: number;
}

/** How a night went, for the report. */
export interface NightResult {
  night: number;
  name: string;
  label: string;
  goal: NightDef['goal'];
  boss: boolean;
  tag: RewardTag | null;
  won: boolean;
  /** Why it ended (state.ts EndReason): clockout, shift, stinkAfterQuota, king; stink, quota; endless. */
  endReason: GameState['endReason'];
  /** Seconds after midnight the quota was met, or null. */
  quotaMetAt: number | null;
  purse: number;
  quota: number;
  /** What went into the bank (half the purse on a loss). */
  banked: number;
  bank: number;
  bestTier: number;
  /** Items seen for the first time ever tonight. */
  found: ItemId[];
  stats: NightStats;
  /** The run's strikes after this night, and whether this one was the last (FIRED). */
  strikes: number;
  fired: boolean;
  /** Night 10 won: the Trash King is crowned and the run is won. */
  crowned: boolean;
  /** The Possum Bribe forgave a shutdown tonight (it's used up). */
  bribed: boolean;
  /** A Daily Dump: its number (0 for a run night). */
  daily: number;
  seed: number;
}

/** One stop on the map: a night with its rule and its reward tag. */
export interface MapNode {
  rule: RuleId;
  tag: RewardTag | null;
}

export type Stage = 'card' | 'loot' | 'shop' | 'map';

export type ShopItem = { kind: 'perk'; id: ContrabandId; sold: boolean } | { kind: 'juice'; sold: boolean } | { kind: 'tool'; id: ItemId; sold: boolean };

export interface Shop {
  /** Three Contraband (common, uncommon, rare) and two consumables. */
  items: ShopItem[];
  /** Rerolls bought this visit (each costs more). */
  rerolls: number;
  /** The shop tag's sale: prices x (1 - this). */
  sale: number;
}

export interface Run {
  /** Base seed; each night, each try and each offer gets its own. */
  seed: number;
  /** The night to play next (1-10). During 'loot' and 'shop' it's already the next one. */
  night: number;
  /** Tries at the current night so far (for the seed). */
  tries: number;
  strikes: number;
  bank: number;
  foreman: ForemanId;
  /** The Contraband you hold, in slot order. */
  slots: ContrabandId[];
  maxSlots: number;
  /** Bin Juice and brewed tools waiting in the Dumpster for the next night. */
  binJuice: number;
  tools: ItemId[];
  /** The map: per night (index night - 1), one node (night 1, the bosses) or two forks. */
  map: MapNode[][];
  /** The fork picked per night (index night - 1); -1 not picked yet. */
  path: number[];
  stage: Stage;
  /** Loot picks waiting, the cards on offer, and whether they came from an elite night. */
  loot: number;
  offer: ContrabandId[];
  lootElite: boolean;
  /** The Swap Meet's stall (kept so a reload doesn't reroll it), and the sale earned for it. */
  shop: Shop | null;
  sale: number;
  /** Offers rolled so far (each one's seed). */
  rolls: number;
  /** Everything ever seen and every recipe ever brewed (shared with meta; the Almanac reads them). */
  discovered: ItemId[];
  recipes: ItemId[];
  /** Recipes whose ingredients Grandma's Recipe Card (or Potluck) has revealed. */
  revealed: ItemId[];
  stats: RunStats;
  /** The last finished night (the report reads it). */
  last: NightResult | null;
  /** Milestones reached during this run (the end card lists what they unlocked). */
  earned: MilestoneId[];
  /** The run is over: fired (three strikes) or won (the King). */
  over: 'fired' | 'won' | null;
  /** A Daily Dump: its number (0 for a normal run). */
  daily: number;
  /** A Daily Dump's rule. */
  dailyRule: RuleId | null;
}

// ---------------------------------------------------------------------------------------------
// Starting a run

/** A seed for something between nights: the run seed mixed with a few numbers. */
function mix(...xs: number[]): number {
  let h = 2166136261 >>> 0;
  for (const x of xs) {
    h ^= x >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}

function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const t = a[i] as T;
    a[i] = a[j] as T;
    a[j] = t;
  }
  return a;
}

const TAGS: readonly RewardTag[] = ['loot', 'shop', 'juice', 'elite'];

/** Deal the map: each act's fork nights get two different rules from its pool, with different tags. */
export function generateMap(seed: number): MapNode[][] {
  const rng = new Rng(mix(seed, 0x6d6170));
  const map: MapNode[][] = [];
  for (const a of ACTS) {
    const rules = shuffle(rng, a.pool);
    let k = 0;
    for (const n of a.nights) {
      if (n === 1) map[n - 1] = [{ rule: 'first', tag: null }];
      else if (!isFork(n)) map[n - 1] = [{ rule: a.boss, tag: null }];
      else {
        const tags = shuffle(rng, TAGS);
        const pick = (i: number): RuleId => rules[(k + i) % rules.length] ?? 'garbage';
        map[n - 1] = [
          { rule: pick(0), tag: tags[0] ?? null },
          { rule: pick(1), tag: tags[1] ?? null },
        ];
        k += 2;
      }
    }
  }
  return map;
}

export function newRun(seed: number, meta: Meta, foreman: ForemanId = 'gary'): Run {
  const f = foremanDef(foreman);
  const run: Run = {
    seed: seed >>> 0,
    night: 1,
    tries: 0,
    strikes: 0,
    bank: 0,
    foreman: f.id,
    slots: [],
    maxSlots: f.slots ?? R.slots,
    binJuice: 0,
    tools: [],
    map: generateMap(seed),
    path: Array.from({ length: NIGHT_COUNT }, (_, i) => (i === 0 || !isFork(i + 1) ? 0 : -1)),
    stage: 'card',
    loot: 0,
    offer: [],
    lootElite: false,
    shop: null,
    sale: 0,
    rolls: 0,
    discovered: [...meta.discovered],
    recipes: [...meta.recipes],
    revealed: [],
    stats: { nightsWon: 0, nightsLost: 0, earned: 0, ordersFilled: 0, merges: 0, brews: 0, bestTier: 0 },
    last: null,
    earned: [],
    over: null,
    daily: 0,
    dailyRule: null,
  };
  // The Foreman's starting Contraband ('rare': a random rare one from the pool).
  const rng = new Rng(mix(seed, 0x666f72));
  for (const id of f.start) {
    if (id !== 'rare') {
      if (!run.slots.includes(id)) run.slots.push(id);
      continue;
    }
    const rares = contrabandPool(meta).filter((c) => contrabandDef(c).rarity === 'rare' && !run.slots.includes(c));
    if (rares.length > 0) run.slots.push(rng.pick(rares));
  }
  return run;
}

/** The Daily Dump's number for a date: day 1 is TUNING.run.dailyEpoch (local dates). */
export function dailyNumber(d: Date): number {
  const [y, m, day] = R.dailyEpoch;
  const epoch = Date.UTC(y ?? 2026, (m ?? 1) - 1, day ?? 1);
  const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((today - epoch) / 86400000) + 1;
}

/**
 * Today's Daily Dump: one seeded night (TUNING.run.dailyNight's difficulty) with a random rule and
 * two random Contraband from the whole list, one try. Everyone gets the same one on the same day.
 */
export function newDailyRun(d: Date, meta: Meta): Run {
  const n = dailyNumber(d);
  const seed = mix(0x6461696c, n);
  const run = newRun(seed, meta, 'gary');
  const rng = new Rng(mix(seed, 1));
  run.daily = n;
  run.night = R.dailyNight;
  run.dailyRule = rng.pick(FORK_RULES);
  run.slots = shuffle(rng, CONTRABAND.map((c) => c.id)).slice(0, 2);
  run.maxSlots = 2;
  return run;
}

// ---------------------------------------------------------------------------------------------
// The night ahead

/** The fork picked for this night (0 when it isn't a fork, or nothing's picked yet). */
export function pickedFork(run: Run, night = run.night): number {
  return Math.max(0, run.path[night - 1] ?? 0);
}

/** Does the map still need a fork picked for the coming night? */
export function needsPick(run: Run): boolean {
  return !run.daily && isFork(run.night) && (run.path[run.night - 1] ?? -1) < 0;
}

/** A node of the map as a full night. */
export function nodeNight(night: number, node: MapNode): NightDef {
  return makeNight(night, node.rule, node.tag);
}

/** The night to play next (its picked fork; the first one if none's picked yet). */
export function currentNight(run: Run): NightDef {
  if (run.daily && run.dailyRule) {
    const def = makeNight(run.night, run.dailyRule, null);
    // The Daily Dump plays in a random spot of the county.
    const scenes = ['lot9', 'marina', 'trashmore'] as const;
    return { ...def, scene: scenes[mix(run.seed, 7) % 3] ?? 'lot9', label: `DAILY #${run.daily}` };
  }
  const nodes = run.map[run.night - 1] ?? [{ rule: 'first', tag: null }];
  const node = nodes[pickedFork(run)] ?? nodes[0] ?? { rule: 'first' as RuleId, tag: null };
  return nodeNight(run.night, node);
}

export function pickFork(run: Run, i: number): void {
  if (!isFork(run.night)) return;
  run.path[run.night - 1] = Math.max(0, Math.min(1, i));
}

/** Tonight's mods: the night's (act and rule), then the Contraband, then the King night's retry ease. */
export function nightMods(run: Run, def: NightDef = currentNight(run)): Mods {
  const m: Mods = { ...defaultMods(), ...def.mods };
  applyContraband(m, run.slots);
  m.stinkGainMul *= retryEase(run, def);
  return m;
}

export function nightSeed(run: Run): number {
  return (run.seed + run.night * 7919 + run.tries * 104729) % 2147483647;
}

/**
 * The King night eases a little with every failed try (the crew airs the lot out between tries):
 * Stink gains x this, down to `TUNING.king.retryEaseMin`. 1 on any other night or a first try.
 */
export function retryEase(run: Run, def: NightDef = currentNight(run)): number {
  if (def.goal !== 'king' || run.tries <= 0) return 1;
  const K = TUNING.king;
  return Math.max(K.retryEaseMin, 1 - K.retryEasePerTry * run.tries);
}

/** Recipes not brewed yet (the Recipe Card's and Potluck's pick comes from these). */
function unknownRecipes(run: Run): RecipeDef[] {
  const known = new Set(run.recipes);
  return RECIPES.filter((r) => !known.has(r.id));
}

/**
 * Tonight's recipe tip (Grandma's Recipe Card, or a Potluck night), or null: one recipe you
 * haven't brewed, the same one all night (and on a retry).
 */
export function recipeTip(run: Run): RecipeDef | null {
  const def = currentNight(run);
  if (!run.slots.includes('recipecard') && def.id !== 'potluck') return null;
  const pool = unknownRecipes(run).sort((a, b) => ITEMS[a.a].tier + ITEMS[a.b].tier - (ITEMS[b.a].tier + ITEMS[b.b].tier));
  // The easier ones first: the cheapest ingredients, a little shuffled by the night.
  const easy = pool.slice(0, 6);
  if (easy.length === 0) return null;
  return easy[mix(run.seed, run.night) % easy.length] ?? null;
}

/** Build tonight's GameState. Bin Juice, tools and the juice tag's freebie fly out of the Dumpster. */
export function startNight(run: Run): GameState {
  const def = currentNight(run);
  const s = createState({
    seed: nightSeed(run),
    night: run.night,
    quota: def.quota,
    goal: def.goal,
    mods: nightMods(run, def),
    discovered: run.discovered,
    recipes: run.recipes,
    scene: def.scene,
    rule: def.id,
    label: def.label,
  });
  const tip = recipeTip(run);
  if (tip && !run.revealed.includes(tip.id)) run.revealed.push(tip.id);
  const juice = Math.min(R.juiceMax + 1, run.binJuice + (def.tag === 'juice' ? 1 : 0));
  let k = 0;
  for (let i = 0; i < juice; i++) launch(s, 'bin_juice', 'dumpster', TUNING.dumpster.flightSec + k++ * 0.15);
  for (const id of run.tools) if (id in ITEMS) launch(s, id, 'dumpster', TUNING.dumpster.flightSec + k++ * 0.15);
  return s;
}

/** Bank the night, record it, and move the run on (or not, if it was lost). */
export function finishNight(run: Run, s: GameState): NightResult {
  const def = currentNight(run);
  const won = s.status === 'won';
  const daily = run.daily > 0;
  const banked = won || daily ? s.purse : Math.floor(s.purse * LOST_KEEP);
  const known = new Set(run.discovered);
  const found = [...s.discovered].filter((id) => !known.has(id));
  const crowned = def.goal === 'king' && won;

  run.bank += banked;
  run.discovered = [...known, ...found].filter((id) => id in ITEMS);
  run.recipes = [...s.discoveredRecipes].filter((id) => id in ITEMS);
  run.binJuice = 0;
  run.tools = [];
  run.stats.earned += s.purse;
  run.stats.ordersFilled += s.stats.ordersFilled;
  run.stats.merges += s.stats.merges;
  run.stats.brews += s.stats.brews;
  run.stats.bestTier = Math.max(run.stats.bestTier, s.bestTier);
  // The Possum Bribe is used up once it's forgiven a shutdown.
  const bribed = s.perk.bribed;
  if (bribed) run.slots = run.slots.filter((id) => id !== 'bribe');

  if (daily) {
    run.over = won ? 'won' : 'fired';
  } else if (won) {
    run.stats.nightsWon++;
    if (crowned) run.over = 'won';
    else {
      run.night++;
      run.tries = 0;
      run.stage = 'loot';
      run.loot = def.tag === 'loot' ? 2 : 1;
      run.lootElite = def.tag === 'elite';
      run.offer = [];
      run.shop = null;
      run.sale = def.tag === 'shop' ? R.shopDiscount : 0;
    }
  } else {
    run.stats.nightsLost++;
    run.strikes++;
    run.tries++;
    run.shop = null;
    run.sale = 0;
    run.stage = 'card';
    if (run.strikes >= R.strikes) run.over = 'fired';
    // The King night pays nothing, so the crew chips in Bin Juice for the next try.
    if (def.goal === 'king') run.binJuice = Math.min(R.juiceMax, run.tries);
  }

  const result: NightResult = {
    night: s.night,
    name: def.name,
    label: def.label,
    goal: def.goal,
    boss: def.boss,
    tag: def.tag,
    won,
    endReason: s.endReason,
    quotaMetAt: s.quotaMetAt,
    purse: s.purse,
    quota: s.quota,
    banked,
    bank: run.bank,
    bestTier: s.bestTier,
    found,
    stats: { ...s.stats, stinkFrom: { ...s.stats.stinkFrom } },
    strikes: run.strikes,
    fired: run.over === 'fired' && !daily,
    crowned,
    bribed,
    daily: run.daily,
    seed: s.seed,
  };
  run.last = result;
  return result;
}

// ---------------------------------------------------------------------------------------------
// Loot: a free pick of 1 of 3 after every passed night

const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare'];

/** Contraband that can be offered: in the pool, not already held. */
function offerable(run: Run, meta: Meta, exclude: readonly ContrabandId[] = []): ContrabandId[] {
  return contrabandPool(meta).filter((id) => !run.slots.includes(id) && !exclude.includes(id));
}

/** `n` different Contraband drawn by rarity weights. */
function draw(rng: Rng, from: ContrabandId[], n: number, weights: Record<Rarity, number>): ContrabandId[] {
  const out: ContrabandId[] = [];
  const left = [...from];
  while (out.length < n && left.length > 0) {
    const w = left.map((id) => weights[contrabandDef(id).rarity] + 0.01);
    const i = rng.weighted(w);
    const [id] = left.splice(i, 1);
    if (id) out.push(id);
  }
  return out;
}

/** The loot cards on offer (rolled once per pick and kept). */
export function lootOffer(run: Run, meta: Meta): ContrabandId[] {
  if (run.offer.length === 0 && run.loot > 0) {
    const rng = new Rng(mix(run.seed, 0x6c6f6f74, run.rolls++));
    run.offer = draw(rng, offerable(run, meta), R.lootChoices, run.lootElite ? R.eliteWeights : R.lootWeights);
  }
  return run.offer;
}

/**
 * Take a loot card. With every slot full, `replace` names the slot it goes in (the old one is
 * dropped). Returns false if it can't go anywhere.
 */
export function takeLoot(run: Run, id: ContrabandId, replace = -1): boolean {
  if (!run.offer.includes(id)) return false;
  if (!equip(run, id, replace)) return false;
  endLootPick(run);
  return true;
}

/** Leave the loot (or the rest of it). */
export function skipLoot(run: Run): void {
  endLootPick(run);
}

function endLootPick(run: Run): void {
  run.offer = [];
  run.loot = Math.max(0, run.loot - 1);
  if (run.loot === 0) run.stage = 'shop';
}

/** Put Contraband in a slot (a free one, or over `replace`). */
function equip(run: Run, id: ContrabandId, replace = -1): boolean {
  if (run.slots.includes(id)) return false;
  if (run.slots.length < run.maxSlots) {
    run.slots.push(id);
    return true;
  }
  if (replace < 0 || replace >= run.slots.length) return false;
  run.slots[replace] = id;
  return true;
}

// ---------------------------------------------------------------------------------------------
// The Swap Meet: Contraband for sale, consumables, a reroll, selling

/** Shop prices x this: the act's ante, the sale, the Clearance Card. */
function priceMul(run: Run): number {
  const ante = R.priceAnte[actOf(Math.min(NIGHT_COUNT, run.night)).act - 1] ?? 1;
  const clearance = run.slots.includes('clearance') ? 1 - R.shopDiscount : 1;
  return ante * (1 - (run.shop?.sale ?? run.sale)) * clearance;
}

function round(n: number): number {
  return Math.max(50, Math.round(n / 50) * 50);
}

export function perkPrice(run: Run, id: ContrabandId): number {
  return round(R.price[contrabandDef(id).rarity] * priceMul(run));
}

/** What selling a held Contraband pays: half its price (before any sale). */
export function sellPrice(run: Run, id: ContrabandId): number {
  const ante = R.priceAnte[actOf(Math.min(NIGHT_COUNT, run.night)).act - 1] ?? 1;
  return round(R.price[contrabandDef(id).rarity] * ante * R.sellShare);
}

export function itemPrice(run: Run, it: ShopItem): number {
  if (it.kind === 'perk') return perkPrice(run, it.id);
  const base = it.kind === 'juice' ? R.juicePrice : R.toolPrice;
  const ante = R.priceAnte[actOf(Math.min(NIGHT_COUNT, run.night)).act - 1] ?? 1;
  return round(base * ante * (1 - (run.shop?.sale ?? run.sale)) * (run.slots.includes('clearance') ? 1 - R.shopDiscount : 1));
}

export function rerollPrice(run: Run): number {
  const n = run.shop?.rerolls ?? 0;
  const half = run.slots.includes('clearance') ? 0.5 : 1;
  return round((R.rerollBase + R.rerollStep * n) * half);
}

/** Brewed tools the shop may stock (the alchemy agent's ids; none if they aren't there). */
function shopTools(): ItemId[] {
  return RECIPES.filter((r) => r.kind === 'tool' && r.id in ITEMS).map((r) => r.id);
}

function stock(run: Run, meta: Meta): ShopItem[] {
  const rng = new Rng(mix(run.seed, 0x73686f70, run.rolls++));
  const perks: ShopItem[] = [];
  const taken: ContrabandId[] = [];
  for (const rarity of RARITIES) {
    const from = offerable(run, meta, taken).filter((id) => contrabandDef(id).rarity === rarity);
    const any = offerable(run, meta, taken);
    const pick = from.length > 0 ? rng.pick(from) : any.length > 0 ? rng.pick(any) : null;
    if (!pick) continue;
    taken.push(pick);
    perks.push({ kind: 'perk', id: pick, sold: false });
  }
  const tools = shopTools();
  const items: ShopItem[] = [...perks, { kind: 'juice', sold: false }];
  if (tools.length > 0) items.push({ kind: 'tool', id: rng.pick(tools), sold: false });
  return items;
}

/** The stall for this visit (stocked once, kept in the run). */
export function openShop(run: Run, meta: Meta): Shop {
  if (!run.shop) run.shop = { items: stock(run, meta), rerolls: 0, sale: run.sale };
  return run.shop;
}

/** Restock the three Contraband (the consumables stay). Returns false if the bank is short. */
export function reroll(run: Run, meta: Meta): boolean {
  const shop = openShop(run, meta);
  const price = rerollPrice(run);
  if (run.bank < price) return false;
  run.bank -= price;
  shop.rerolls++;
  const fresh = stock(run, meta).filter((it) => it.kind === 'perk');
  shop.items = [...fresh, ...shop.items.filter((it) => it.kind !== 'perk')];
  return true;
}

export type BuyResult = 'ok' | 'broke' | 'full' | 'sold' | 'max';

export function canBuy(run: Run, it: ShopItem): BuyResult {
  if (it.sold) return 'sold';
  if (it.kind === 'perk' && run.slots.length >= run.maxSlots) return 'full';
  if (it.kind === 'juice' && run.binJuice >= R.juiceMax) return 'max';
  if (it.kind === 'tool' && run.tools.length >= R.juiceMax) return 'max';
  return run.bank >= itemPrice(run, it) ? 'ok' : 'broke';
}

export function buy(run: Run, it: ShopItem): BuyResult {
  const why = canBuy(run, it);
  if (why !== 'ok') return why;
  run.bank -= itemPrice(run, it);
  if (it.kind === 'perk') run.slots.push(it.id);
  else if (it.kind === 'juice') run.binJuice++;
  else run.tools.push(it.id);
  // Bin Juice stays on the shelf (buy up to three); the rest are one of a kind.
  if (it.kind !== 'juice') it.sold = true;
  return 'ok';
}

/** Sell the Contraband in a slot for half its price. */
export function sell(run: Run, slot: number): number {
  const id = run.slots[slot];
  if (!id) return 0;
  const pay = sellPrice(run, id);
  run.slots.splice(slot, 1);
  run.bank += pay;
  return pay;
}

/** Done shopping: on to the map (or straight back to the night card after a loss). */
export function leaveShop(run: Run): void {
  run.shop = null;
  run.sale = 0;
  run.stage = run.tries > 0 ? 'card' : 'map';
}

/** The map's fork picked: on to the night card. */
export function leaveMap(run: Run): void {
  if (needsPick(run)) pickFork(run, 0);
  run.stage = 'card';
}

// ---------------------------------------------------------------------------------------------

/** The highest junk item this run built, or null. */
export function bestItem(run: Run): ItemId | null {
  return run.stats.bestTier > 0 ? (JUNK_CHAIN[run.stats.bestTier - 1] ?? null) : null;
}

/** Is this the act's boss night? */
export function isBoss(run: Run, night = run.night): boolean {
  const a = actOf(night);
  return night === a.nights[a.nights.length - 1];
}
