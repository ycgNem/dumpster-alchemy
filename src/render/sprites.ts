// The sprite atlases in public/art/ (docs/ARCHITECTURE.md, "Art contract"). Every family is
// optional and so is every name in it: the draw calls return false when a sprite isn't there and
// the caller draws its greybox placeholder instead, so the game runs before the art exists and
// fills in as it lands. `loadArt()` can be called again (window.dev.reloadArt) to pick up new art.
import type { Rect } from './layout';

export interface SpriteDef {
  img: HTMLImageElement;
  x: number;
  y: number;
  w: number;
  h: number;
  frames: number;
  fps: number;
  /** The anchor: the pixel that sits on the drawing point (default: bottom centre). */
  ax: number;
  ay: number;
  /** 9-slice borders [left, top, right, bottom], or null. */
  slice: [number, number, number, number] | null;
  /** An inner rect [x, y, w, h] relative to the sprite (e.g. where the jar's sludge goes). */
  inner: [number, number, number, number] | null;
}

export interface Glyph {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FontAtlas {
  img: HTMLImageElement;
  lineHeight: number;
  cap: number;
  spacing: number;
  space: number;
  glyphs: Map<string, Glyph>;
  /** Bumped on every (re)load so tinted copies know to rebuild. */
  version: number;
}

export const FAMILIES = [
  'items', 'cast', 'props', 'backdrop', 'logo', 'board', 'ui', 'fx',
  'recipes', 'contraband', 'map', // v2 (art agent): recipe results, Contraband stickers, the county map
] as const;
export type Family = (typeof FAMILIES)[number];

const byFamily = new Map<Family, Map<string, SpriteDef>>();
let sprites = new Map<string, SpriteDef>();
let font: FontAtlas | null = null;
let fontVersion = 0;
/** Seconds, for sprites that animate on their own (fps > 0). */
let clock = 0;

export function tickArt(t: number): void {
  clock = t;
}

export function sprite(name: string): SpriteDef | null {
  return sprites.get(name) ?? null;
}

export function has(name: string): boolean {
  return sprites.has(name);
}

export function fontAtlas(): FontAtlas | null {
  return font;
}

/** Load (or reload) every family and the font. Missing or broken files are skipped quietly. */
export async function loadArt(): Promise<string> {
  const bust = `?v=${Date.now()}`;
  await Promise.all([...FAMILIES.map((f) => loadFamily(f, bust)), loadFont(bust)]);
  sprites = new Map();
  for (const f of FAMILIES) for (const [k, v] of byFamily.get(f) ?? []) sprites.set(k, v);
  const have = FAMILIES.filter((f) => (byFamily.get(f)?.size ?? 0) > 0).map((f) => `${f} ${byFamily.get(f)?.size}`);
  return `art: ${have.length ? have.join(', ') : 'none yet'}${font ? `, font ${font.glyphs.size} glyphs` : ', no font'}`;
}

function artUrl(file: string, bust: string): string {
  return `${import.meta.env.BASE_URL}art/${file}${bust}`;
}

async function fetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-cache' });
    if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function quad(v: unknown): [number, number, number, number] | null {
  if (!Array.isArray(v) || v.length !== 4) return null;
  return [num(v[0], 0), num(v[1], 0), num(v[2], 0), num(v[3], 0)];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

async function loadFamily(family: Family, bust: string): Promise<void> {
  const json = await fetchJson(artUrl(`${family}.json`, bust));
  if (!isObj(json) || !isObj(json.sprites)) {
    if (!byFamily.has(family)) byFamily.set(family, new Map());
    return;
  }
  const img = await loadImage(artUrl(`${family}.png`, bust));
  if (!img) return;
  const out = new Map<string, SpriteDef>();
  for (const [name, raw] of Object.entries(json.sprites)) {
    if (!isObj(raw)) continue;
    const w = num(raw.w, 0);
    const h = num(raw.h, 0);
    if (w <= 0 || h <= 0) continue;
    const anchor = Array.isArray(raw.anchor) ? raw.anchor : [];
    const slice = quad(raw.slice);
    const inner = quad(raw.inner);
    out.set(name, {
      img,
      x: num(raw.x, 0),
      y: num(raw.y, 0),
      w,
      h,
      frames: Math.max(1, Math.floor(num(raw.frames, 1))),
      fps: num(raw.fps, 0),
      ax: num(anchor[0], Math.floor(w / 2)),
      ay: num(anchor[1], h - 1),
      slice,
      inner,
    });
  }
  byFamily.set(family, out);
}

async function loadFont(bust: string): Promise<void> {
  const json = await fetchJson(artUrl('font_marker.json', bust));
  if (!isObj(json) || !isObj(json.glyphs)) return;
  const img = await loadImage(artUrl('font_marker.png', bust));
  if (!img) return;
  const glyphs = new Map<string, Glyph>();
  for (const [ch, raw] of Object.entries(json.glyphs)) {
    if (!isObj(raw)) continue;
    const g = { x: num(raw.x, 0), y: num(raw.y, 0), w: num(raw.w, 0), h: num(raw.h, 0) };
    if (g.w > 0 && g.h > 0) glyphs.set(ch, g);
  }
  if (glyphs.size === 0) return;
  font = {
    img,
    lineHeight: num(json.lineHeight, 11),
    cap: num(json.cap, 7),
    spacing: num(json.spacing, 1),
    space: num(json.space, 4),
    glyphs,
    version: ++fontVersion,
  };
}

export interface DrawOpts {
  /** A frame chosen by code; otherwise fps > 0 animates on the clock, else frame 0. */
  frame?: number;
  /** Offset into the animation (per-object phase), in seconds. */
  phase?: number;
  /** Scale (for squash and stretch), applied around the anchor. */
  sx?: number;
  sy?: number;
  flip?: boolean;
  alpha?: number;
}

export function frameOf(d: SpriteDef, o: DrawOpts = {}): number {
  if (o.frame !== undefined) return ((Math.floor(o.frame) % d.frames) + d.frames) % d.frames;
  if (d.fps > 0 && d.frames > 1) return Math.floor((clock + (o.phase ?? 0)) * d.fps) % d.frames;
  return 0;
}

/** Draw a sprite with its anchor on (x, y). Returns false (drawing nothing) if it isn't loaded. */
export function drawSprite(g: CanvasRenderingContext2D, name: string, x: number, y: number, o: DrawOpts = {}): boolean {
  const d = sprites.get(name);
  if (!d) return false;
  const f = frameOf(d, o);
  const w = Math.max(1, Math.round(d.w * (o.sx ?? 1)));
  const h = Math.max(1, Math.round(d.h * (o.sy ?? 1)));
  const ax = o.flip ? d.w - 1 - d.ax : d.ax;
  const dx = Math.round(x - ax * (w / d.w));
  const dy = Math.round(y - d.ay * (h / d.h));
  const a = g.globalAlpha;
  if (o.alpha !== undefined) g.globalAlpha = a * o.alpha;
  if (o.flip) {
    g.save();
    g.translate(dx + w, dy);
    g.scale(-1, 1);
    g.drawImage(d.img, d.x + f * d.w, d.y, d.w, d.h, 0, 0, w, h);
    g.restore();
  } else {
    g.drawImage(d.img, d.x + f * d.w, d.y, d.w, d.h, dx, dy, w, h);
  }
  g.globalAlpha = a;
  return true;
}

/** Draw a 9-slice sprite over `r`: corners as they are, edges and middle tiled (never scaled). */
export function drawNine(g: CanvasRenderingContext2D, name: string, r: Rect): boolean {
  const d = sprites.get(name);
  if (!d || !d.slice) return false;
  const [l, t, rr, b] = d.slice;
  const mw = d.w - l - rr;
  const mh = d.h - t - b;
  const dw = r.w - l - rr;
  const dh = r.h - t - b;
  const x2 = r.x + r.w - rr;
  const y2 = r.y + r.h - b;
  const sx2 = d.x + d.w - rr;
  const sy2 = d.y + d.h - b;
  tile(g, d.img, d.x, d.y, l, t, r.x, r.y, l, t);
  tile(g, d.img, sx2, d.y, rr, t, x2, r.y, rr, t);
  tile(g, d.img, d.x, sy2, l, b, r.x, y2, l, b);
  tile(g, d.img, sx2, sy2, rr, b, x2, y2, rr, b);
  tile(g, d.img, d.x + l, d.y, mw, t, r.x + l, r.y, dw, t);
  tile(g, d.img, d.x + l, sy2, mw, b, r.x + l, y2, dw, b);
  tile(g, d.img, d.x, d.y + t, l, mh, r.x, r.y + t, l, dh);
  tile(g, d.img, sx2, d.y + t, rr, mh, x2, r.y + t, rr, dh);
  tile(g, d.img, d.x + l, d.y + t, mw, mh, r.x + l, r.y + t, dw, dh);
  return true;
}

/** Repeat a source rect across a destination rect, cutting the last row and column short. */
function tile(
  g: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
  for (let y = 0; y < dh; y += sh) {
    const h = Math.min(sh, dh - y);
    for (let x = 0; x < dw; x += sw) {
      const w = Math.min(sw, dw - x);
      g.drawImage(img, sx, sy, w, h, dx + x, dy + y, w, h);
    }
  }
}
