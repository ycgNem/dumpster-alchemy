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
  // `cascade`: this merge was a cascade link (2 for the first one; src/game/combo.ts).
  | { type: 'merge'; from: ItemId; to: ItemId; chain: Chain; tier: number; c: number; r: number; first: boolean; skipped?: boolean; cascade?: number }
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
  // Momentum (src/game/combo.ts). `cascade`: a merge result sat next to its twin and they merged
  // again on their own, the piece at (fc, fr) into (c, r), making `id`; `links` counts the chain
  // so far (the player's merge is 1, so the first cascade is 2). `streak`: the Stench Streak
  // stepped up (or, `step` 0, cooled off) to pay x`mul`. `feverStart`/`feverEnd`: the Raccoon
  // Rave. `fellOff`: night 1's Bald Tire bounces off the truck toward (c, r).
  | { type: 'cascade'; links: number; id: ItemId; c: number; r: number; fc: number; fr: number }
  | { type: 'streak'; step: number; mul: number }
  | { type: 'feverStart'; mul: number; sec: number }
  | { type: 'feverEnd' }
  | { type: 'fellOff'; id: ItemId; c: number; r: number }
  // Alchemy (src/game/alchemy.ts). `brew`: `a` (the held piece, from fc, fr) was dropped on `b`
  // at (c, r) and they brewed `to`, a tool or a treasure; `first`: never brewed before (the big
  // reveal); `twin`: the Alchemist's Apron's second copy landed there. `toolUsed`: the tool `id`
  // was used on (c, r) (or on order `slot`, the Stew). `cells`: every cell it hit. `made`: pieces
  // it changed or created (Soup, Chum, Magnet, Leftovers); `moves`: pieces it pulled (Magnet);
  // `shinies`: what it paid out (Bomb, Fire, Fork); `stink`: Stink added (Fire) or taken (Blanket).
  | { type: 'brew'; a: ItemId; b: ItemId; to: ItemId; kind: 'tool' | 'treasure'; c: number; r: number; fc: number; fr: number; first: boolean; twin?: { c: number; r: number } }
  | {
      type: 'toolUsed';
      id: ItemId;
      c: number;
      r: number;
      slot?: number;
      cells: { c: number; r: number; id: ItemId }[];
      made?: { c: number; r: number; from: ItemId; to: ItemId; first: boolean }[];
      moves?: GullMove[];
      shinies?: number;
      stink?: number;
    }
  // The run (src/game/perks.ts). `perk`: a Contraband did something (`text` is its popup; at a cell,
  // or an order slot, or nowhere in particular; `item`: what it made). `boss`: The Inspection
  // condemned a cell; the Gull God stole `id` from (c, r) ('raid'), flew on fed ('pass'), or a gull
  // handed in or crushed just fed it ('fed').
  | { type: 'perk'; id: string; text: string; c?: number; r?: number; slot?: number; item?: ItemId }
  | { type: 'boss'; what: 'condemn' | 'raid' | 'pass' | 'fed'; c?: number; r?: number; id?: ItemId }
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
