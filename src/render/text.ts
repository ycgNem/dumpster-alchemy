// Text: the `font_marker` bitmap font when it's loaded (tinted to any palette colour through an
// offscreen copy), else `bold 9px monospace`. Light text gets an ink outline (STYLE.md, "UI").
import { PAL, type PalName } from '../data/palette';
import { fontAtlas, type FontAtlas } from './sprites';

export type Align = 'left' | 'center' | 'right';

export interface TextOpts {
  color?: PalName;
  align?: Align;
  /** A 1 px keyline in this colour all round (light text on night or ground gets `ink0`). */
  outline?: PalName;
}

const FALLBACK = 'bold 9px monospace';
/** The 8 offsets of a 1 px keyline, drawn before the text itself. */
const KEYLINE = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
const FALLBACK_LINE = 10;

const tinted = new Map<PalName, HTMLCanvasElement>();
let tintedFor = 0;

function tintedFont(f: FontAtlas, color: PalName): HTMLCanvasElement {
  if (tintedFor !== f.version) {
    tinted.clear();
    tintedFor = f.version;
  }
  let c = tinted.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = f.img.width;
    c.height = f.img.height;
    const g = c.getContext('2d');
    if (g) {
      g.drawImage(f.img, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = PAL[color];
      g.fillRect(0, 0, c.width, c.height);
    }
    tinted.set(color, c);
  }
  return c;
}

function glyphFor(f: FontAtlas, ch: string): ReturnType<FontAtlas['glyphs']['get']> {
  return f.glyphs.get(ch) ?? f.glyphs.get(ch.toUpperCase()) ?? f.glyphs.get(ch.toLowerCase()) ?? f.glyphs.get('?');
}

let measure: CanvasRenderingContext2D | null = null;

export function lineHeight(): number {
  return fontAtlas()?.lineHeight ?? FALLBACK_LINE;
}

export function textWidth(s: string): number {
  const f = fontAtlas();
  if (f) {
    let w = 0;
    for (const ch of s) {
      if (ch === ' ') w += f.space;
      else w += (glyphFor(f, ch)?.w ?? f.space) + f.spacing;
    }
    return Math.max(0, w - f.spacing);
  }
  if (!measure) measure = document.createElement('canvas').getContext('2d');
  if (!measure) return s.length * 6;
  measure.font = FALLBACK;
  return Math.ceil(measure.measureText(s).width);
}

/** Draw one line of text with its top at y. */
export function drawText(g: CanvasRenderingContext2D, s: string, x: number, y: number, o: TextOpts = {}): void {
  const align = o.align ?? 'left';
  const w = textWidth(s);
  const left = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  const top = Math.round(y);
  if (o.outline) {
    for (const [ox, oy] of KEYLINE) raw(g, s, left + ox, top + oy, o.outline);
  }
  raw(g, s, left, top, o.color ?? 'ink0');
}

function raw(g: CanvasRenderingContext2D, s: string, x: number, y: number, color: PalName): void {
  const f = fontAtlas();
  if (!f) {
    g.font = FALLBACK;
    g.textBaseline = 'top';
    g.textAlign = 'left';
    g.fillStyle = PAL[color];
    g.fillText(s, x, y);
    return;
  }
  const img = tintedFont(f, color);
  let cx = x;
  for (const ch of s) {
    if (ch === ' ') {
      cx += f.space; // a space replaces glyph + spacing
      continue;
    }
    const gl = glyphFor(f, ch);
    if (!gl) {
      cx += f.space + f.spacing;
      continue;
    }
    g.drawImage(img, gl.x, gl.y, gl.w, gl.h, cx, y, gl.w, gl.h);
    cx += gl.w + f.spacing;
  }
}

/** Split text into lines no wider than maxW (words longer than a line stay whole). */
export function wrapText(s: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of s.split(/\s+/)) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next) > maxW) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}
