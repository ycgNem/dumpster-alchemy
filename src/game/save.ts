// The save: the run in progress (between nights), what lasts across runs (the meta: Almanac,
// Recipe Book, records, unlocks, Daily scores) and the settings, as versioned JSON under one key.
// The storage itself is a tiny key-value adapter handed in from outside (main.ts wraps
// localStorage), so this file and run.ts stay headless. Every access is wrapped: with storage
// blocked or full, or a save that doesn't parse, the game carries on with what it has in memory.
//
// Versions: 1 was the fixed ten-night campaign. A v1 save keeps its Almanac (everything seen, the
// best junk, a crowned King) and its settings, and starts a fresh run. 2 is the roguelite run.
import { CONTRABAND, FOREMEN, MILESTONES, isContraband, type ContrabandId, type ForemanId, type MilestoneId } from '../data/contraband';
import { ITEMS, JUNK_CHAIN, type ItemId } from '../data/items';
import { NIGHT_COUNT, RULES, type RewardTag, type RuleId } from '../data/nights';
import { TUNING } from '../data/tuning';
import { newMeta, type Meta } from './meta';
import { generateMap, newRun, type MapNode, type Run, type Shop, type ShopItem, type Stage } from './run';

export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const SAVE_KEY = 'dumpster-alchemy/save';
export const SAVE_VERSION = 2;

export interface Settings {
  muted: boolean;
  /** Night 1's one-time prompts already shown (src/scenes/hints.ts), per player, not per run. */
  hintsSeen: string[];
}

export interface SaveData {
  /** The run in progress, or null (none yet, or it ended). */
  run: Run | null;
  meta: Meta;
  settings: Settings;
}

export function defaultSave(): SaveData {
  return { run: null, meta: newMeta(), settings: { muted: false, hintsSeen: [] } };
}

/** An in-memory store, for Node and for when the browser's storage is blocked. */
export function memoryKV(): KV {
  const m = new Map<string, string>();
  return {
    get: (k) => m.get(k) ?? null,
    set: (k, v) => void m.set(k, v),
    remove: (k) => void m.delete(k),
  };
}

export function loadSave(kv: KV): SaveData {
  let text: string | null = null;
  try {
    text = kv.get(SAVE_KEY);
  } catch {
    return defaultSave();
  }
  if (!text) return defaultSave();
  try {
    return readSave(JSON.parse(text) as unknown);
  } catch {
    return defaultSave();
  }
}

/** Returns false if the storage refused it (blocked, full); the game goes on regardless. */
export function writeSave(kv: KV, data: SaveData): boolean {
  try {
    // A Daily Dump is never saved as the run (it's one try; its score is in the meta).
    const run = data.run && data.run.daily === 0 && !data.run.over ? { ...data.run, last: null } : null;
    kv.set(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, run, meta: data.meta, settings: data.settings }));
    return true;
  } catch {
    return false;
  }
}

export function wipeSave(kv: KV): void {
  try {
    kv.remove(SAVE_KEY);
  } catch {
    // nothing to do
  }
}

// ---- Reading an untrusted save back: anything odd falls back to a sane value. ----

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function int(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : fallback;
}

function items(v: unknown): ItemId[] {
  return Array.isArray(v) ? [...new Set(v.filter((id): id is ItemId => typeof id === 'string' && id in ITEMS))] : [];
}

function perks(v: unknown, max: number): ContrabandId[] {
  return Array.isArray(v) ? [...new Set(v.filter(isContraband))].slice(0, max) : [];
}

function readSettings(raw: Record<string, unknown>, out: SaveData): void {
  if (!isObj(raw.settings)) return;
  out.settings.muted = raw.settings.muted === true;
  const seen = raw.settings.hintsSeen;
  if (Array.isArray(seen)) out.settings.hintsSeen = [...new Set(seen.filter((h): h is string => typeof h === 'string' && h.length < 24))].slice(0, 16);
}

function readSave(raw: unknown): SaveData {
  const out = defaultSave();
  if (!isObj(raw)) return out;
  readSettings(raw, out);
  if (raw.v === 1) {
    // The old campaign: keep the Almanac and the records, start a fresh run.
    if (isObj(raw.run)) {
      out.meta.discovered = items(raw.run.discovered);
      out.meta.bestTier = int(raw.run.bestTier, 0, JUNK_CHAIN.length, 0);
      if (raw.run.crowned === true) out.meta.milestones.push('king');
    }
    return out;
  }
  if (raw.v !== SAVE_VERSION) return out;
  if (isObj(raw.meta)) out.meta = readMeta(raw.meta);
  out.run = isObj(raw.run) ? readRun(raw.run, out.meta) : null;
  return out;
}

function readMeta(m: Record<string, unknown>): Meta {
  const meta = newMeta();
  meta.discovered = items(m.discovered);
  meta.recipes = items(m.recipes).filter((id) => ITEMS[id].chain === 'brew');
  meta.bestTier = int(m.bestTier, 0, JUNK_CHAIN.length, 0);
  const known = new Set<string>(MILESTONES.map((x) => x.id));
  meta.milestones = Array.isArray(m.milestones) ? [...new Set(m.milestones.filter((x): x is MilestoneId => typeof x === 'string' && known.has(x)))] : [];
  meta.runs = int(m.runs, 0, 1e9, 0);
  meta.wins = int(m.wins, 0, 1e9, 0);
  meta.fired = int(m.fired, 0, 1e9, 0);
  meta.bestNight = int(m.bestNight, 0, NIGHT_COUNT + 1, 0);
  meta.bestRun = int(m.bestRun, 0, 1e12, 0);
  if (isObj(m.daily)) {
    // Keep the most recent 90 days.
    const days = Object.entries(m.daily)
      .filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'number' && Number.isFinite(v))
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .slice(0, 90);
    for (const [k, v] of days) meta.daily[k] = int(v, 0, 1e12, 0);
  }
  const f = m.foreman;
  if (typeof f === 'string' && FOREMEN.some((x) => x.id === f)) meta.foreman = f as ForemanId;
  if (typeof m.lastShare === 'string' && m.lastShare.length < 200) meta.lastShare = m.lastShare;
  return meta;
}

const STAGES: readonly Stage[] = ['card', 'loot', 'shop', 'map'];
const TAGS: readonly RewardTag[] = ['loot', 'shop', 'juice', 'elite'];

function readMap(v: unknown, seed: number): MapNode[][] {
  const fresh = generateMap(seed);
  if (!Array.isArray(v) || v.length !== NIGHT_COUNT) return fresh;
  return fresh.map((nodes, i) => {
    const saved = v[i];
    if (!Array.isArray(saved) || saved.length !== nodes.length) return nodes;
    return nodes.map((n, k) => {
      const x: unknown = saved[k];
      if (!isObj(x) || typeof x.rule !== 'string' || !(x.rule in RULES)) return n;
      const tag = TAGS.find((t) => t === x.tag) ?? null;
      return { rule: x.rule as RuleId, tag };
    });
  });
}

function readShop(v: unknown): Shop | null {
  if (!isObj(v) || !Array.isArray(v.items)) return null;
  const list: ShopItem[] = [];
  for (const it of v.items) {
    if (!isObj(it)) continue;
    const sold = it.sold === true;
    if (it.kind === 'perk' && isContraband(it.id)) list.push({ kind: 'perk', id: it.id, sold });
    else if (it.kind === 'juice') list.push({ kind: 'juice', sold });
    else if (it.kind === 'tool' && typeof it.id === 'string' && it.id in ITEMS) list.push({ kind: 'tool', id: it.id as ItemId, sold });
  }
  const sale = typeof v.sale === 'number' && Number.isFinite(v.sale) ? Math.max(0, Math.min(0.9, v.sale)) : 0;
  return { items: list.slice(0, 8), rerolls: int(v.rerolls, 0, 99, 0), sale };
}

function readRun(r: Record<string, unknown>, meta: Meta): Run {
  const R = TUNING.run;
  const seed = int(r.seed, 0, 0xffffffff, 1);
  const foreman = FOREMEN.find((f) => f.id === r.foreman)?.id ?? 'gary';
  const run = newRun(seed, meta, foreman);
  run.night = int(r.night, 1, NIGHT_COUNT, 1);
  run.tries = int(r.tries, 0, 1e6, 0);
  run.strikes = int(r.strikes, 0, R.strikes - 1, 0);
  run.bank = int(r.bank, 0, 1e12, 0);
  run.maxSlots = int(r.maxSlots, 1, 8, run.maxSlots);
  run.slots = perks(r.slots, run.maxSlots);
  run.binJuice = int(r.binJuice, 0, R.juiceMax, 0);
  run.tools = items(r.tools).filter((id) => ITEMS[id].chain === 'brew').slice(0, R.juiceMax);
  run.map = readMap(r.map, seed);
  if (Array.isArray(r.path) && r.path.length === NIGHT_COUNT) run.path = r.path.map((x, i) => int(x, -1, (run.map[i]?.length ?? 1) - 1, run.path[i] ?? 0));
  run.stage = STAGES.find((x) => x === r.stage) ?? 'card';
  run.loot = int(r.loot, 0, 3, 0);
  run.offer = perks(r.offer, R.lootChoices);
  run.lootElite = r.lootElite === true;
  run.shop = readShop(r.shop);
  run.sale = typeof r.sale === 'number' && Number.isFinite(r.sale) ? Math.max(0, Math.min(0.9, r.sale)) : 0;
  run.rolls = int(r.rolls, 0, 1e9, 0);
  run.discovered = [...new Set([...meta.discovered, ...items(r.discovered)])];
  run.recipes = [...new Set([...meta.recipes, ...items(r.recipes)])];
  run.revealed = items(r.revealed);
  if (isObj(r.stats)) {
    const st = r.stats;
    run.stats = {
      nightsWon: int(st.nightsWon, 0, 1e9, 0),
      nightsLost: int(st.nightsLost, 0, 1e9, 0),
      earned: int(st.earned, 0, 1e12, 0),
      ordersFilled: int(st.ordersFilled, 0, 1e9, 0),
      merges: int(st.merges, 0, 1e9, 0),
      brews: int(st.brews, 0, 1e9, 0),
      bestTier: int(st.bestTier, 0, JUNK_CHAIN.length, 0),
    };
  }
  const known = new Set<string>(MILESTONES.map((x) => x.id));
  run.earned = Array.isArray(r.earned) ? r.earned.filter((x): x is MilestoneId => typeof x === 'string' && known.has(x)) : [];
  // A loot pick with nothing on offer re-rolls on the loot screen; anything else odd goes to the card.
  if (run.stage === 'loot' && run.loot === 0) run.stage = 'shop';
  // The last report isn't needed after a reload (Continue goes to the stage).
  run.last = null;
  return run;
}

/** Every Contraband id (the dev tools list them). */
export const ALL_CONTRABAND: readonly ContrabandId[] = CONTRABAND.map((c) => c.id);
