// The save: the run and the settings as versioned JSON under one key. The storage itself is a
// tiny key-value adapter handed in from outside (main.ts wraps localStorage), so this file and
// run.ts stay headless. Every access is wrapped: with storage blocked or full, or a save that
// doesn't parse, the game carries on with what it has in memory.
import { ITEMS, JUNK_CHAIN, type ItemId } from '../data/items';
import { NIGHTS } from '../data/nights';
import { BIN_JUICE, UPGRADES, noLevels } from '../data/upgrades';
import { newRun, type Run } from './run';

export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const SAVE_KEY = 'dumpster-alchemy/save';
export const SAVE_VERSION = 1;

export interface Settings {
  muted: boolean;
  /** Night 1's one-time prompts already shown (src/scenes/hints.ts), per player, not per run. */
  hintsSeen: string[];
}

export interface SaveData {
  run: Run | null;
  settings: Settings;
}

export function defaultSave(): SaveData {
  return { run: null, settings: { muted: false, hintsSeen: [] } };
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
    kv.set(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, run: data.run, settings: data.settings }));
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

function readSave(raw: unknown): SaveData {
  const out = defaultSave();
  if (!isObj(raw) || raw.v !== SAVE_VERSION) return out;
  if (isObj(raw.settings)) {
    out.settings.muted = raw.settings.muted === true;
    const seen = raw.settings.hintsSeen;
    if (Array.isArray(seen)) out.settings.hintsSeen = [...new Set(seen.filter((h): h is string => typeof h === 'string' && h.length < 24))].slice(0, 16);
  }
  out.run = isObj(raw.run) ? readRun(raw.run) : null;
  return out;
}

function readRun(r: Record<string, unknown>): Run {
  const run = newRun(int(r.seed, 0, 0xffffffff, 1));
  run.night = int(r.night, 1, NIGHTS.length + 1, 1);
  run.tries = int(r.tries, 0, 1e6, 0);
  run.bank = int(r.bank, 0, 1e12, 0);
  const levels = noLevels();
  if (isObj(r.levels)) {
    for (const u of UPGRADES) levels[u.id] = int(r.levels[u.id], 0, u.prices.length, 0);
  }
  run.levels = levels;
  run.binJuice = int(r.binJuice, 0, BIN_JUICE.max, 0);
  run.discovered = Array.isArray(r.discovered)
    ? [...new Set(r.discovered.filter((id): id is ItemId => typeof id === 'string' && id in ITEMS))]
    : [];
  run.bestTier = int(r.bestTier, 0, JUNK_CHAIN.length, 0);
  run.crowned = r.crowned === true;
  run.endlessBest = int(r.endlessBest, 0, 1e12, 0);
  if (isObj(r.stats)) {
    const st = r.stats;
    run.stats = {
      nightsWon: int(st.nightsWon, 0, 1e9, 0),
      nightsLost: int(st.nightsLost, 0, 1e9, 0),
      earned: int(st.earned, 0, 1e12, 0),
      ordersFilled: int(st.ordersFilled, 0, 1e9, 0),
      merges: int(st.merges, 0, 1e9, 0),
    };
  }
  // The last report isn't needed after a reload (Continue goes to the night card).
  run.last = null;
  return run;
}
