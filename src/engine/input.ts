// Pointer (mouse and touch) in logical pixels, plus key presses. `pressed`, `released` and the
// keys hit are edges: they hold for exactly one update step, then endStep() clears them.
// Also: whether to talk touch ("tap", no key hints), and whether the window just lost focus.
import type { Screen } from './screen';

/** The last pointer's type, or null before any pointer has been seen. */
let lastPointer: string | null = null;

/**
 * Talk touch: the last pointer was a finger, or (before any pointer at all) the device's main
 * pointer is coarse. Hints then say "tap" and key hints (SPACE, P, M) stay hidden.
 */
export function touchUi(): boolean {
  if (lastPointer !== null) return lastPointer === 'touch';
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(pointer: coarse)').matches === true;
}

/** "click" or "tap", for whoever's holding it. */
export function tapWord(): string {
  return touchUi() ? 'tap' : 'click';
}

export class Input {
  /** Set when the window loses focus or the tab is hidden; the play scene pauses and clears it. */
  focusLost = false;
  x = -1;
  y = -1;
  /** Where the last press started (a press and its release can land in the same step). */
  pressX = -1;
  pressY = -1;
  down = false;
  pressed = false;
  released = false;
  /** The last pointer's PointerEvent.pointerType: 'mouse', 'pen' or 'touch'. */
  pointerType = 'mouse';
  private readonly keysHit = new Set<string>();
  private readonly screen: Screen;

  constructor(screen: Screen) {
    this.screen = screen;
    const v = screen.view;
    v.addEventListener('pointerdown', (e) => {
      this.move(e);
      this.pressX = this.x;
      this.pressY = this.y;
      this.down = true;
      this.pressed = true;
      try {
        v.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic pointers (tests, tools) can't be captured; dragging still works.
      }
    });
    v.addEventListener('pointermove', (e) => this.move(e));
    v.addEventListener('pointerup', (e) => {
      this.move(e);
      this.down = false;
      this.released = true;
    });
    v.addEventListener('pointercancel', () => {
      this.down = false;
      this.released = true;
    });
    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.keysHit.add(e.code);
    });
    // Switching apps or tabs mid-night shouldn't lose the night: the play scene pauses.
    const lost = (): void => {
      this.focusLost = true;
      // A drag can't finish while we're away (the held piece goes back home).
      this.down = false;
    };
    window.addEventListener('blur', lost);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') lost();
    });
  }

  /** True on the step a key (a KeyboardEvent.code, e.g. 'Space') went down. */
  hit(code: string): boolean {
    return this.keysHit.has(code);
  }

  endStep(): void {
    this.pressed = false;
    this.released = false;
    this.keysHit.clear();
  }

  private move(e: PointerEvent): void {
    if (e.pointerType) {
      this.pointerType = e.pointerType;
      lastPointer = e.pointerType;
    }
    const p = this.screen.toLogical(e.clientX, e.clientY);
    this.x = p.x;
    this.y = p.y;
  }
}
