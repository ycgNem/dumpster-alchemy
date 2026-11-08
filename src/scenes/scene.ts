// A scene is one screen of the game: title, night card, play, report, Swap Meet, Almanac, the
// end. main.ts runs exactly one at a time and hands it the shared input; src/scenes/flow.ts
// decides which comes next.
import type { Input } from '../engine/input';

export interface Scene {
  /** One fixed step (1/60 s). */
  update(dt: number): void;
  /** Draw into the 640 x 360 logical buffer. */
  draw(g: CanvasRenderingContext2D): void;
  /** Sound just unlocked (first gesture): re-send whatever music this scene wants. */
  audioReady?(): void;
  /** Called when the scene becomes the running one. */
  enter?(): void;
}

export interface SceneHost {
  input: Input;
  /** Swap the running scene. */
  go(next: Scene): void;
}
