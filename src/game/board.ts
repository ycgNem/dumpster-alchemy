// The 9 x 7 grid of junk. Pure data: no drawing, no input (M1 adds the systems around it).
import { ITEMS, type ItemId } from '../data/items';

export interface Piece {
  /** Stable per piece, so effects and tweens can follow it. */
  uid: number;
  id: ItemId;
  /**
   * `s.time` when it landed or was made. A merge makes a new piece, so merging resets it; moves
   * and swaps don't. Junk that sits unmerged long enough goes smelly (src/game/stink.ts `isSmelly`).
   */
  born: number;
}

let nextUid = 1;

/** A new piece, born at `born` (pass `s.time`; 0 for pieces made outside a night). */
export function makePiece(id: ItemId, born = 0): Piece {
  return { uid: nextUid++, id, born };
}

/** What dropping `a` onto `b` merges into, or null if they don't merge. */
export function mergeResult(a: ItemId, b: ItemId): ItemId | null {
  if (a === 'bin_juice' && ITEMS[b].next) return ITEMS[b].next;
  if (b === 'bin_juice' && ITEMS[a].next) return ITEMS[a].next;
  if (a !== b) return null;
  return ITEMS[a].next;
}

export class Board {
  readonly cols: number;
  readonly rows: number;
  private readonly cells: (Piece | null)[];

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    this.cells = Array.from({ length: cols * rows }, () => null);
  }

  inside(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  get(c: number, r: number): Piece | null {
    return this.inside(c, r) ? (this.cells[r * this.cols + c] ?? null) : null;
  }

  set(c: number, r: number, p: Piece | null): void {
    if (!this.inside(c, r)) throw new Error(`cell ${c},${r} is off the board`);
    this.cells[r * this.cols + c] = p;
  }

  /** Every empty cell as [col, row]. */
  empties(): [number, number][] {
    const out: [number, number][] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) if (!this.get(c, r)) out.push([c, r]);
    }
    return out;
  }

  /** Every piece with its cell, row by row. */
  pieces(): { p: Piece; c: number; r: number }[] {
    const out: { p: Piece; c: number; r: number }[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const p = this.get(c, r);
        if (p) out.push({ p, c, r });
      }
    }
    return out;
  }

  /** The cell holding the piece with this uid, or null. */
  find(uid: number): [number, number] | null {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) if (this.get(c, r)?.uid === uid) return [c, r];
    }
    return null;
  }

  clear(): void {
    this.cells.fill(null);
  }

  fillRatio(): number {
    return 1 - this.empties().length / (this.cols * this.rows);
  }

  isFull(): boolean {
    return this.empties().length === 0;
  }
}
