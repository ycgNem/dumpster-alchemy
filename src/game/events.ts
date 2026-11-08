// Everything that happens in the game, as events. Systems push them onto `state.events`; the
// effects (src/render/fx.ts) and the sound (src/audio/) read them once per frame, then the list
// is cleared. Systems never call fx or audio directly, so each side can change on its own.
//
// Cells are board coordinates (c = column 0-8, r = row 0-6). Adding a variant is fine; renaming
// or removing one breaks the fx and audio switch statements, so grep for it first.
import type { Chain, ItemId } from '../data/items';

export type GameEvent =
  // Junk arriving
  | { type: 'spawn'; id: ItemId; c: number; r: number; from: 'dumpster' | 'truck' | 'kick' | 'egg'; first?: boolean }
  | { type: 'land'; id: ItemId; c: number; r: number }
  | { type: 'dumpsterClick'; ok: boolean }
  | { type: 'truckArrive' }
  | { type: 'truckDump'; count: number }
  | { type: 'truckLeave' }
  | { type: 'overflow'; id: ItemId }
  // The player's hands
  | { type: 'pickup'; id: ItemId; c: number; r: number }
  | { type: 'move'; id: ItemId; c: number; r: number }
  | { type: 'swap'; c: number; r: number; c2: number; r2: number }
  | { type: 'invalid'; c: number; r: number }
  // `skipped`: a Full Moon merge that jumped a tier (`to` is two up from `from`).
  | { type: 'merge'; from: ItemId; to: ItemId; chain: Chain; tier: number; c: number; r: number; first: boolean; skipped?: boolean }
  | { type: 'compact'; id: ItemId }
  // Raccoons
  // `jackpot`: the night's big order. `gift`: on the King night a filled order pays in junk
  // instead of Shinies (it flies out of that slot as a `spawn` from 'kick').
  // `scrap`: the bulk small-junk order (several tier 1-2 pieces).
  | { type: 'orderArrive'; slot: number; raccoon: string; jackpot?: boolean; scrap?: boolean }
  | { type: 'deliver'; slot: number; id: ItemId; complete: boolean; shinies: number; jackpot?: boolean; gift?: ItemId }
  // `jackpot` true: the jackpot raccoon gave up and left quietly (no kick, no Stink).
  | { type: 'orderAngry'; slot: number; raccoon: string; jackpot?: boolean }
  // Stink. `ripen`: a piece sat unmerged long enough to go smelly (once per piece; it now adds
  // Stink every second until it's merged, delivered or crushed).
  | { type: 'stinkWarn' }
  | { type: 'ripen'; id: ItemId; c: number; r: number }
  // Gulls
  | { type: 'gullArrive'; c: number; r: number; first?: boolean }
  | { type: 'gullHop'; c: number; r: number; toC: number; toR: number }
  | { type: 'gullEat'; id: ItemId; c: number; r: number }
  // `moves`: the neighbours the Gang shuffled, so the renderer can slide them.
  | { type: 'gullScream'; c: number; r: number; moves?: GullMove[] }
  | { type: 'gullPeck'; shinies: number; c?: number; r?: number }
  | { type: 'gullGod'; c: number; r: number }
  | { type: 'egg'; c: number; r: number; from: ItemId; to: ItemId; first?: boolean }
  // The night. `quotaMet`: once, when the purse first reaches the quota (Clock Out opens).
  // `milestone`: Endless pays a bonus on every hour mark.
  | { type: 'hour'; hour: number }
  | { type: 'quotaMet' }
  | { type: 'milestone'; hour: number; bonus: number }
  | { type: 'nightWon' }
  | { type: 'nightLost' }
  // Menus
  | { type: 'uiClick' }
  | { type: 'buy'; upgrade: string };

export type GameEventType = GameEvent['type'];

/** A piece pushed from one cell to another by something other than the player. */
export interface GullMove {
  c: number;
  r: number;
  toC: number;
  toR: number;
}
