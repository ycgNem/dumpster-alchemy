// The scene backdrops (docs/V2.md, pillar 4): `backdrop_lot9`, `backdrop_marina` and
// `backdrop_trashmore`, built by pixel-art/backdrop/build.py. Each is a wide panorama whose middle
// 640 x 360 is the stage layout (sky 0-56, the truck lane 56-104, calm dark dirt below for the
// board and the UI). Its anchor is the stage's top-left, so drawing it at (0, 0) in stage
// coordinates puts the stage part on the stage and fills the margins with more of the place.
// Two frames: the streetlight steady, and flickered dim.
import type { SceneId } from '../game/state';
import { drawSprite, sprite, type SpriteDef } from './sprites';

/** A scene's backdrop sprite: its own, else Lot 9's, else the old 640 x 360 `backdrop`; null before art. */
export function backdropSprite(scene: SceneId): { name: string; d: SpriteDef } | null {
  for (const name of [`backdrop_${scene}`, 'backdrop_lot9', 'backdrop']) {
    const d = sprite(name);
    if (d) return { name, d };
  }
  return null;
}

/** Draw a scene's backdrop on the stage origin. False if there's no backdrop art yet (draw the greybox). */
export function paintBackdrop(g: CanvasRenderingContext2D, scene: SceneId, frame: number): boolean {
  const b = backdropSprite(scene);
  return b !== null && drawSprite(g, b.name, 0, 0, { frame });
}
