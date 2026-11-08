// Fullscreen: the F key anywhere, and the little buttons (src/render/fullscreen.ts) on the title
// and in the pause menu. The Fullscreen API on the whole page (document.documentElement), with
// the old webkit names for Safari on older Macs and iPads. iPhone Safari has neither, so
// canFullscreen() is false there and the buttons hide.
//
// Browsers only allow fullscreen from a user gesture, so the toggle happens right in the key and
// pointer handlers, not in the game's update. A button registers its rect while it's drawn
// (fullscreenHotspot); a press and release inside it toggles. The screen refits on
// `fullscreenchange` (src/engine/screen.ts).
import type { Screen } from './screen';

interface WebkitDocument {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
}
interface WebkitElement {
  webkitRequestFullscreen?: () => void;
}

type Box = { x: number; y: number; w: number; h: number };

const doc = (): Document & WebkitDocument => document as Document & WebkitDocument;

/** Can this page go fullscreen at all? (False on iPhone Safari, and inside some iframes.) */
export function canFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const d = doc();
  return d.fullscreenEnabled === true || d.webkitFullscreenEnabled === true;
}

export function isFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const d = doc();
  return (d.fullscreenElement ?? d.webkitFullscreenElement ?? null) !== null;
}

/** Go fullscreen, or come back. Call it from a user gesture (a key or pointer handler). */
export function toggleFullscreen(): void {
  if (!canFullscreen()) return;
  const d = doc();
  try {
    if (isFullscreen()) {
      if (d.exitFullscreen) void d.exitFullscreen().catch(() => {});
      else d.webkitExitFullscreen?.();
      return;
    }
    const el = document.documentElement as HTMLElement & WebkitElement;
    if (el.requestFullscreen) void el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    else el.webkitRequestFullscreen?.();
  } catch {
    // Refused (no gesture, a policy): stay as we are.
  }
}

/** The buttons drawn this frame (stage coordinates). main.ts clears them before each frame. */
const spots: Box[] = [];

export function fullscreenHotspot(r: Box): void {
  spots.push(r);
}

export function clearFullscreenHotspots(): void {
  spots.length = 0;
}

const inBox = (r: Box, x: number, y: number): boolean => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

/** The F key, and the buttons' press-and-release. Call once. */
export function installFullscreen(screen: Screen): void {
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyF' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    toggleFullscreen();
  });
  let down: { x: number; y: number } | null = null;
  const hit = (p: { x: number; y: number }): boolean => spots.some((r) => inBox(r, p.x, p.y));
  screen.view.addEventListener('pointerdown', (e) => {
    const p = screen.toLogical(e.clientX, e.clientY);
    down = hit(p) ? p : null;
  });
  screen.view.addEventListener('pointerup', (e) => {
    const p = screen.toLogical(e.clientX, e.clientY);
    if (down && hit(p)) toggleFullscreen();
    down = null;
  });
}
