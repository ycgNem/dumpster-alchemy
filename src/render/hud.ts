// The HUD: the night (with its name, on an ink plate) and the clock on top; Shinies against the
// quota and the Clock Out button once it's met; the Stink jar (labelled); the truck timer with
// the next load against the room left; lid charges and the Crusher's label; the footer; hover
// tooltips for the Dumpster, the Crusher and the jar; and the pause and end-of-night overlays.
import { ITEMS, JUNK_CHAIN, junkAt } from '../data/items';
import { nightDef } from '../data/nights';
import { PAL, type PalName } from '../data/palette';
import { INSPECTOR } from '../data/raccoons';
import { TUNING } from '../data/tuning';
import { touchUi } from '../engine/input';
import { H, W } from '../engine/screen';
import { nextCharge } from '../game/dumpster';
import { clockText } from '../game/shift';
import { nightLength, nightProgress, type GameState } from '../game/state';
import { dueTruck, interval, nextTruckLoad, trucks } from '../game/truck';
import { smellRate, stinkLimit, stinkWarnAt } from '../game/stink';
import { crushPay } from '../game/actions';
import { fillRect, outlineRect, paper, placeholderJar, placeholderPossum } from './greybox';
import { CLOCK_OUT, COMPACTOR, DUMPSTER, FOOTER, LID_PIPS, RIGHT_INFO, SHINIES, STINK, TRUCK_TIMER, inRect, type Rect } from './layout';
import { drawTooltipAt, fmt } from './menus';
import { drawNine, drawSprite, sprite } from './sprites';
import { drawText, textWidth, wrapText } from './text';
import type { View } from './view';

const T = TUNING;

/** A 16 x 16 icon with its top-left at (x, y), or a little coloured square. */
function icon(g: CanvasRenderingContext2D, name: string, x: number, y: number, fallback: PalName): void {
  if (drawSprite(g, name, x + 8, y + 15)) return;
  fillRect(g, { x: x + 3, y: y + 3, w: 10, h: 10 }, 'ink0');
  fillRect(g, { x: x + 4, y: y + 4, w: 8, h: 8 }, fallback);
}

function bar(g: CanvasRenderingContext2D, r: Rect, p: number, c: PalName): void {
  fillRect(g, r, 'ink0');
  fillRect(g, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, 'ink2');
  fillRect(g, { x: r.x + 1, y: r.y + 1, w: Math.round((r.w - 2) * Math.max(0, Math.min(1, p))), h: r.h - 2 }, c);
}

function mmss(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A little 7 x 7 Shiny for price tags and small print (icon_shiny is 16 px): top-left at x, y. */
export function coinGlyph(g: CanvasRenderingContext2D, x: number, y: number): void {
  const rows = ['..###..', '.#yyy#.', '#ywyys#', '#yyyys#', '#yyyss#', '.#sss#.', '..###..'];
  const col = { '#': 'ink0', y: 'yellow', w: 'white', s: 'sodium2' } as const;
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = row[i] as keyof typeof col | '.';
      if (c !== '.') fillRect(g, { x: x + i, y: y + j, w: 1, h: 1 }, col[c]);
    }
  });
}

export function drawHud(g: CanvasRenderingContext2D, s: GameState, v: View, muted: boolean): void {
  drawTop(g, s, v, muted);
  drawTruckTimer(g, s, v);
  drawShinies(g, s, v);
  drawStink(g, s, v);
  drawPips(g, s);
  drawRightInfo(g, s);
  drawFooter(g);
}

/** Top: the night and its name on an ink plate (the streetlight never runs through it), the clock. */
function drawTop(g: CanvasRenderingContext2D, s: GameState, v: View, muted: boolean): void {
  const endless = s.goal === 'endless';
  const def = nightDef(s.night);
  const head = endless ? 'ENDLESS' : `NIGHT ${s.night}`;
  const name = def.name.toUpperCase();
  // (x 26: the pause button sits left of it, src/scenes/pause.ts)
  const x = 26;
  const w = textWidth(head) + 10 + textWidth(name);
  fillRect(g, { x: x - 3, y: 3, w: w + 7, h: 16 }, 'ink0');
  fillRect(g, { x: x - 3, y: 18, w: w + 7, h: 1 }, 'night1');
  drawText(g, head, x, 6, { color: 'sodium3' });
  drawText(g, '·', x + textWidth(head) + 3, 6, { color: 'night3' });
  drawText(g, name, x + textWidth(head) + 10, 6, { color: 'bone' });

  // The clock: red once Endless runs past 6 AM.
  const clock = clockText(s);
  const late = endless && s.time >= nightLength();
  const flash = late && Math.sin(v.t * 6) > 0.2;
  icon(g, 'icon_clock', W - 46 - textWidth(clock), 3, 'sodium2');
  drawText(g, clock, W - 26, 6, { color: late ? (flash ? 'red' : 'rust3') : 'sodium3', align: 'right', outline: 'ink0' });
  icon(g, muted ? 'icon_mute' : 'icon_sound', W - 21, 3, muted ? 'red' : 'steel2');
  const nb = { x: 232, y: 8, w: 176, h: 6 };
  bar(g, nb, nightProgress(s), late ? 'red' : 'night3');
  for (let h = 1; h < T.shift.hours; h++) fillRect(g, { x: nb.x + Math.round((nb.w * h) / T.shift.hours), y: nb.y, w: 1, h: nb.h }, 'ink0');
  drawText(g, '12', nb.x - 4, nb.y - 2, { color: 'night3', align: 'right', outline: 'ink0' });
  drawText(g, endless ? (late ? 'OVERTIME' : '6 AM') : '6 AM', nb.x + nb.w + 4, nb.y - 2, { color: late ? 'red' : 'night3', outline: 'ink0' });
}

function drawTruckTimer(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  const r = TRUCK_TIMER;
  // An ink plate under it all, like the night's name: the lane (and the possum walking in
  // along it) never runs through the numbers.
  const plate = { x: r.x - 2, y: r.y + 1, w: 124, h: 37 };
  fillRect(g, plate, 'ink0');
  fillRect(g, { x: plate.x, y: plate.y + plate.h - 1, w: plate.w, h: 1 }, 'night1');
  icon(g, 'icon_truck', r.x + 2, r.y + 4, 'rust2');
  // Garbage Day has two trucks: this plate follows whichever dumps next, and says there are two.
  const all = trucks(s);
  const k = dueTruck(s);
  if (all.length > 1) drawText(g, 'x2', r.x + 10, r.y + 20, { color: 'yellow', align: 'center', outline: 'ink0' });
  let text: string;
  let colour: PalName = 'bone';
  if (k.phase === 'arrive') {
    text = Math.sin(v.t * 10) > 0 ? 'BEEP BEEP' : '';
    colour = 'yellow';
  } else if (k.phase === 'dump') {
    text = 'INCOMING!';
    colour = 'sodium3';
  } else {
    text = `TRUCK ${mmss(k.timer)}`;
    if (k.timer < 5) colour = Math.sin(v.t * 8) > 0 ? 'yellow' : 'bone';
  }
  if (text) drawText(g, text, r.x + 22, r.y + 6, { color: colour, outline: 'ink0' });
  // The countdown as a bar, full right after a dump.
  const span = Math.max(1, k.dumps === 0 && k.which === 0 ? T.truck.firstDumpSec : interval(s));
  const fill = (t: typeof k): number => (t.phase === 'away' || t.phase === 'leave' ? Math.min(1, t.timer / span) : 0);
  if (all.length > 1) {
    // One thin bar per truck, the one due next on top.
    const other = all.find((t) => t !== k) ?? k;
    bar(g, { x: r.x + 22, y: r.y + 17, w: 72, h: 4 }, fill(k), 'rust3');
    bar(g, { x: r.x + 22, y: r.y + 21, w: 72, h: 3 }, fill(other), 'rust1');
  } else bar(g, { x: r.x + 22, y: r.y + 18, w: 72, h: 4 }, fill(k), 'rust3');
  // What's coming against where it can go: "next 9 · room 4", in warning colours when it won't fit.
  const load = nextTruckLoad(s);
  const room = s.board.empties().length;
  const short = load > room;
  const hot = short && Math.sin(v.t * 9) > 0;
  const x = r.x + 22;
  const y = r.y + 25;
  const a = `next ${load}`;
  const b = `room ${room}`;
  drawText(g, a, x, y, { color: short ? (hot ? 'red' : 'yellow') : 'bone', outline: 'ink0' });
  drawText(g, '·', x + textWidth(a) + 3, y, { color: 'steel2', outline: 'ink0' });
  drawText(g, b, x + textWidth(a) + 10, y, { color: short ? (hot ? 'red' : 'yellow') : room <= 6 ? 'yellow' : 'toxic3', outline: 'ink0' });
  if (short) drawText(g, '!', x + textWidth(a) + 12 + textWidth(b), y, { color: 'red', outline: 'ink0' });
}

function drawShinies(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  const r = SHINIES;
  icon(g, 'icon_shiny', r.x, r.y, 'yellow');
  drawText(g, String(s.purse), r.x + 20, r.y + 4, { color: 'sodium3', outline: 'ink0' });
  if (s.goal === 'king') {
    // Night 10 is about the King: the bar is his progress, the best tier against 12.
    const top = JUNK_CHAIN.length;
    const b = { x: r.x, y: r.y + 18, w: r.w - 4, h: 7 };
    fillRect(g, b, 'ink0');
    const seg = (b.w - 1) / top;
    for (let i = 0; i < top; i++) {
      const sx = Math.round(b.x + 1 + i * seg);
      const sw = Math.round(b.x + 1 + (i + 1) * seg) - sx - 1;
      const done = i < s.bestTier;
      fillRect(g, { x: sx, y: b.y + 1, w: sw, h: b.h - 2 }, done ? (i === top - 1 ? 'yellow' : 'toxic2') : i === top - 1 ? 'sodium0' : 'ink2');
    }
    // The best so far, short enough for the column ("Fridge (door hanging)" -> "Fridge").
    let best = s.bestTier > 0 ? ITEMS[junkAt(s.bestTier)].name : '-';
    if (textWidth(best) > r.w - 8) best = best.split(/[(,]/)[0]?.trim() ?? best;
    drawText(g, `KING ${s.bestTier}/${top}`, r.x, r.y + 28, { color: 'toxic3', outline: 'ink0' });
    drawText(g, best, r.x + r.w - 4, r.y + 39, { color: 'bone', align: 'right', outline: 'ink0' });
    return;
  }
  if (s.goal === 'endless') {
    drawText(g, 'SCORE', r.x + r.w - 4, r.y + 4, { color: 'toxic2', align: 'right', outline: 'ink0' });
    return;
  }
  drawText(g, `/ ${s.quota}`, r.x + 24 + textWidth(String(s.purse)), r.y + 4, { color: 'sodium1', outline: 'ink0' });
  const met = s.quotaMetAt !== null;
  bar(g, { x: r.x, y: r.y + 18, w: r.w - 4, h: 6 }, s.purse / s.quota, met ? 'toxic2' : 'sodium2');
  if (met && s.status === 'playing') {
    // The Clock Out button itself is drawn by the play scene (it owns the clicks; its label says
    // what you'd take home now). This is the bet: the overtime, doubled at 6 AM or lost to the Stink.
    const cx = CLOCK_OUT.x + CLOCK_OUT.w / 2;
    const y = CLOCK_OUT.y + CLOCK_OUT.h + 3;
    drawText(g, `OVERTIME +${fmt(s.overtimeEarned)}`, cx, y, { color: 'yellow', align: 'center', outline: 'ink0' });
    drawText(g, T.shift.overtimeShare === 1 ? 'doubles at 6 AM' : `x${1 + T.shift.overtimeShare} at 6 AM`, cx, y + 10, { color: 'toxic3', align: 'center', outline: 'ink0' });
    const danger = s.stink >= stinkWarnAt(s);
    drawText(g, 'lost if shut down!', cx, y + 20, {
      color: danger ? (Math.sin(v.t * 9) > 0 ? 'red' : 'yellow') : 'rust3',
      align: 'center',
      outline: 'ink0',
    });
  } else if (met) {
    drawText(g, 'QUOTA MET', r.x + r.w - 4, r.y + 28, { color: 'toxic2', align: 'right', outline: 'ink0' });
  }
}

/** Did the Stink end the night? (The jar then reads full: the slam says "The Stink hit 100".) */
function stinkedOut(s: GameState): boolean {
  const r = s.endReason;
  return s.status !== 'playing' && (r === 'stink' || r === 'stinkAfterQuota' || r === 'endless');
}

/**
 * The Stink jar: sludge from 0 to 100, a red notch at the warning (where the Possum walks on), and
 * on a night with a lower limit (The Inspection: 75) a thick red line there with the glass above
 * it hatched off. A small arrow by the number says which way it's heading, from `smellRate`.
 */
function drawStink(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  const r = STINK;
  const limit = stinkLimit(s);
  const warn = stinkWarnAt(s);
  // It shakes for a moment when it passes the warning.
  const reek = v.t - v.reekAt < 0.7 ? Math.round(Math.sin(v.t * 55) * 1.5) : 0;
  const fx = r.x + r.w / 2 + reek;
  const fy = r.y + r.h - 1;
  const stink = stinkedOut(s) ? limit : s.stink;
  const p = stink / T.stink.max;
  const q = stink / limit;
  const jar = sprite('jar');
  // The sludge goes in the jar's inner rect, or just inside the placeholder.
  const inner = jar?.inner
    ? { x: fx - jar.ax + jar.inner[0], y: fy - jar.ay + jar.inner[1], w: jar.inner[2], h: jar.inner[3] }
    : { x: r.x + 2 + reek, y: r.y + 2, w: r.w - 4, h: r.h - 4 };
  if (!drawSprite(g, 'jar', fx, fy)) fillRect(g, { ...r, x: r.x + reek }, 'ink1');
  const yAt = (n: number): number => Math.round(inner.y + inner.h * (1 - n / T.stink.max));
  // Past tonight's limit the jar is out of bounds: hatch it off.
  if (limit < T.stink.max) {
    const top = inner.y;
    const bottom = yAt(limit);
    for (let y = top; y < bottom; y++) {
      for (let x = inner.x; x < inner.x + inner.w; x++) if ((x + y) % 4 === 0) fillRect(g, { x, y, w: 1, h: 1 }, 'rust1');
    }
  }
  const h = Math.round(inner.h * p);
  if (h > 0) {
    const top = inner.y + inner.h - h;
    const c: PalName = q < 0.5 ? 'grime2' : q < 0.75 ? 'grime3' : 'toxic1';
    fillRect(g, { x: inner.x, y: top, w: inner.w, h }, c);
    fillRect(g, { x: inner.x, y: top, w: inner.w, h: 1 }, q < 0.75 ? 'grime3' : 'toxic2');
    // A couple of bubbles rising through it.
    for (let i = 0; i < 3; i++) {
      const by = inner.y + inner.h - (((v.t * (6 + i * 3) + i * 17) % Math.max(1, h)) | 0) - 2;
      if (by > top) fillRect(g, { x: inner.x + 3 + i * 5, y: by, w: 2, h: 2 }, 'grime1');
    }
  }
  // The warning line, a notch on the glass.
  const wy = yAt(warn);
  fillRect(g, { x: inner.x - 1, y: wy, w: 3, h: 1 }, 'red');
  fillRect(g, { x: inner.x + inner.w - 2, y: wy, w: 3, h: 1 }, 'red');
  if (!drawSprite(g, 'jar_glare', fx, fy)) placeholderJar(g, { ...r, x: r.x + reek });
  if (limit < T.stink.max) {
    // Tonight's limit: a thick red line right across, and the number on a tab beside the jar.
    const ly = yAt(limit);
    fillRect(g, { x: inner.x - 3, y: ly - 1, w: inner.w + 6, h: 3 }, 'ink0');
    fillRect(g, { x: inner.x - 2, y: ly, w: inner.w + 4, h: 1 }, 'red');
    // The number sits in the hatched-off glass above the line.
    drawText(g, String(limit), inner.x + inner.w / 2, Math.max(inner.y, ly - 12), { color: 'white', align: 'center', outline: 'red' });
  }
  // jar_flies (24 x 16, anchor bottom centre) sits right on top of the jar.
  if (q > 0.4 && !drawSprite(g, 'jar_flies', fx, r.y - 1)) {
    for (let i = 0; i < 3; i++) {
      fillRect(g, { x: fx + Math.round(Math.sin(v.t * 5 + i * 2) * 9), y: r.y - 8 + Math.round(Math.cos(v.t * 7 + i) * 4), w: 2, h: 2 }, 'ink0');
    }
  }
  if (s.stinkWarned && Math.sin(v.t * 10) > 0) outlineRect(g, { x: r.x - 3 + reek, y: r.y - 3, w: r.w + 6, h: r.h + 6 }, 'red');
  // The label, so nobody has to guess what the jar is.
  const hot = stink >= warn;
  const cx = r.x + r.w / 2;
  drawText(g, 'STINK', cx, r.y + r.h + 3, { color: hot ? 'red' : 'toxic3', align: 'center', outline: 'ink0' });
  const num = String(Math.floor(stink));
  drawText(g, num, cx, r.y + r.h + 14, { color: hot ? 'red' : 'grime3', align: 'center', outline: 'ink0' });
  if (s.status === 'playing') trend(g, smellRate(s), cx + Math.ceil(textWidth(num) / 2) + 3, r.y + r.h + 16, v.t);
}

/**
 * Which way the Stink is heading: a red up-arrow while the lot adds more than it fades (two when
 * it's climbing fast), a green down-arrow while it's clearing, nothing when it's still.
 */
function trend(g: CanvasRenderingContext2D, rate: number, x: number, y: number, t: number): void {
  if (Math.abs(rate) < 0.05) return;
  const up = rate > 0;
  const fast = Math.abs(rate) > 0.6;
  const c: PalName = up ? (fast && Math.sin(t * 10) > 0 ? 'yellow' : 'red') : 'toxic2';
  const arrow = (ax: number): void => {
    // A 7 x 7 arrow (head and stem) with an ink keyline.
    const head = [1, 3, 5, 7];
    const rows = up ? [...head, 3, 3, 3] : [3, 3, 3, ...head.reverse()];
    rows.forEach((w, j) => fillRect(g, { x: ax + 3 - (w >> 1) - 1, y: y + j - 1, w: w + 2, h: 3 }, 'ink0'));
    rows.forEach((w, j) => fillRect(g, { x: ax + 3 - (w >> 1), y: y + j, w, h: 1 }, c));
  };
  arrow(x);
  if (fast) arrow(x + 8);
}

function drawPips(g: CanvasRenderingContext2D, s: GameState): void {
  const d = s.dumpster;
  const r = LID_PIPS;
  const w = 8;
  const gap = 2;
  const x0 = Math.round(r.x + (r.w - (d.max * (w + gap) - gap)) / 2);
  const refill = 1 - nextCharge(s) / s.mods.dumpsterRefillSec;
  for (let i = 0; i < d.max; i++) {
    const pip = { x: x0 + i * (w + gap), y: r.y, w, h: 6 };
    const full = i < d.charges;
    if (!drawSprite(g, full ? 'pip_lid_full' : 'pip_lid_empty', pip.x + w / 2, pip.y + 5)) {
      fillRect(g, pip, 'ink0');
      if (full) fillRect(g, { x: pip.x + 1, y: pip.y + 1, w: w - 2, h: 4 }, 'sodium2');
    }
    if (i === d.charges) fillRect(g, { x: pip.x + 1, y: pip.y + 1, w: Math.round((w - 2) * refill), h: 4 }, 'sodium0');
  }
}

function drawRightInfo(g: CanvasRenderingContext2D, s: GameState): void {
  const r = RIGHT_INFO;
  const d = s.dumpster;
  // (While the Clock Out note is up it takes this line: the pips under the Dumpster still count.)
  const y = r.y + 26;
  if (!(s.quotaMetAt !== null && s.status === 'playing' && s.goal === 'quota')) {
    icon(g, 'icon_lid', r.x, y - 4, 'sodium2');
    const lid = `LID ${d.charges}/${d.max}`;
    drawText(g, lid, r.x + 20, y, { color: d.charges ? 'bone' : 'red', outline: 'ink0' });
    if (d.charges < d.max) drawText(g, `+1 in ${Math.ceil(nextCharge(s))}s`, r.x + 26 + textWidth(lid), y, { color: 'steel3', outline: 'ink0' });
  }
  drawText(g, 'CRUSHER', r.x + 20, r.y + 50, { color: s.compactor.cooldown > 0 ? 'steel2' : 'bone', outline: 'ink0' });
  // When it pays (the Industrial Crusher, Bulk Pickup's x3): what a cap is worth in it.
  const pay = crushPay(s, 'can');
  if (pay > 0) {
    const tag = s.mods.compactorPayMul > 1 ? `PAYS x${s.mods.compactorPayMul}` : `pays ${pay / 2}/tier`;
    drawText(g, tag, r.x + 24 + textWidth('CRUSHER'), r.y + 50, { color: 'yellow', outline: 'ink0' });
  }
}

/**
 * The controls, readable: steel2 with an ink keyline (the quips live in the speech bubble). On
 * touch there are no keys to mention: pause and sound are the buttons in the top corners.
 */
function drawFooter(g: CanvasRenderingContext2D): void {
  const r = FOOTER;
  const text = touchUi()
    ? 'drag junk onto junk to merge  ·  drag it onto a raccoon to sell  ·  tap the Dumpster for junk'
    : 'drag junk onto junk to merge  ·  drag it onto a raccoon to sell  ·  SPACE dump  ·  P pause  ·  M mute';
  drawText(g, text, r.x + r.w / 2, r.y + 5, {
    color: 'steel3',
    align: 'center',
    outline: 'ink0',
  });
}

// ---------------------------------------------------------------------------------------------
// Hover tooltips for the things on the lot that aren't obvious.

/** The night's name plate at the top left (it's as wide as the name). */
function nightPlate(s: GameState): Rect {
  const head = s.goal === 'endless' ? 'ENDLESS' : `NIGHT ${s.night}`;
  const w = textWidth(head) + 10 + textWidth(nightDef(s.night).name.toUpperCase());
  return { x: 23, y: 3, w: w + 7, h: 16 };
}

const TIPS: { r: Rect | ((s: GameState) => Rect); key: string; text: (s: GameState) => string; side: 'above' | 'left' | 'below' }[] = [
  {
    // The night's one rule, on the night's name.
    r: nightPlate,
    key: 'night',
    side: 'below',
    text: (s) => `TONIGHT: ${nightDef(s.night).rule}`,
  },
  {
    r: DUMPSTER,
    key: 'dumpster',
    side: 'above',
    text: (s) => `THE DUMPSTER. Click it (or SPACE) for a piece of junk. Uses a lid charge; they refill every ${Math.round(s.mods.dumpsterRefillSec * 10) / 10}s.`,
  },
  {
    r: COMPACTOR,
    key: 'crusher',
    side: 'left',
    text: (s) => `THE CRUSHER. Drag junk in here to get rid of it. Needs ${Math.round(s.mods.compactorCooldownSec * 10) / 10}s to cool down between crushes.`,
  },
  {
    r: { x: STINK.x - 4, y: STINK.y - 4, w: STINK.w + 8, h: STINK.h + 30 },
    key: 'stink',
    side: 'left',
    text: (s) =>
      `STINK. Junk left sitting goes smelly (fumes and flies) and stinks until you merge, sell or crush it. The truck with nowhere to dump and raccoons storming off add more. At ${stinkLimit(s)} Inspector Possum shuts you down.`,
  },
];

const tipRect = (t: (typeof TIPS)[number], s: GameState): Rect => (typeof t.r === 'function' ? t.r(s) : t.r);

/** Which tooltip the pointer is over (or null), so the scene can time the hover. */
export function hudTipAt(s: GameState, x: number, y: number): string | null {
  return TIPS.find((t) => inRect(tipRect(t, s), x, y))?.key ?? null;
}

export function drawHudTip(g: CanvasRenderingContext2D, s: GameState, key: string): void {
  const tip = TIPS.find((t) => t.key === key);
  if (tip) drawTooltipAt(g, tip.text(s), tipRect(tip, s), tip.side, key === 'night' ? 240 : 170);
}

// ---------------------------------------------------------------------------------------------

function dim(g: CanvasRenderingContext2D, a: number): void {
  g.globalAlpha = a;
  g.fillStyle = PAL.ink0;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
}

export function drawPause(g: CanvasRenderingContext2D): void {
  dim(g, 0.6);
  const r = { x: W / 2 - 80, y: H / 2 - 24, w: 160, h: 44 };
  if (!drawNine(g, 'paper', r)) paper(g, r);
  drawText(g, 'PAUSED', W / 2, r.y + 9, { color: 'ink0', align: 'center' });
  drawText(g, 'P or click to carry on', W / 2, r.y + 25, { color: 'ink1', align: 'center' });
}

/** The end of the night without the flow (a bare play scene): Inspector Possum's verdict. */
export function drawEnd(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  // endedAt waits for the end slam (fx.ts), so it can be a moment in the future.
  const k = Math.max(0, Math.min(1, (v.t - v.endedAt) / 0.5));
  dim(g, 0.65 * k);
  if (k < 1) return;
  const won = s.status === 'won';
  const r = { x: W / 2 - 150, y: 64, w: 300, h: 220 };
  if (!drawNine(g, 'clipboard', r) && !drawNine(g, 'paper', r)) paper(g, r);
  drawSprite(g, 'clipboard_clip', W / 2, r.y + 6);
  drawText(g, won ? `NIGHT ${s.night}: PASSED` : 'SHUT DOWN', W / 2, r.y + 10, { color: won ? 'toxic0' : 'rust1', align: 'center' });

  const pose = won ? 'dead' : 'shutdown';
  const fx = r.x + 40;
  const fy = r.y + 78;
  if (!drawSprite(g, `possum_${pose}`, fx, fy) && !drawSprite(g, 'possum_idle', fx, fy)) placeholderPossum(g, pose, fx, fy);
  const lines = won ? INSPECTOR.lines.passed : INSPECTOR.lines.shutdown;
  const said = lines[s.seed % lines.length] ?? '';
  drawText(g, INSPECTOR.name.toUpperCase(), r.x + 76, r.y + 32, { color: 'ink1' });
  wrapText(`"${said}"`, 200).forEach((line, i) => drawText(g, line, r.x + 76, r.y + 44 + i * 10, { color: 'ink0' }));
  const why = won ? 'Quota met. Lot 9 lives another night.' : s.endReason === 'stink' ? 'The Stink hit 100.' : 'Short of the quota at 6 AM.';
  wrapText(why, r.w - 90).forEach((line, i) => drawText(g, line, r.x + 76, r.y + 66 + i * 10, { color: won ? 'toxic0' : 'rust1' }));

  const best = s.bestTier > 0 ? ITEMS[junkAt(s.bestTier)].name : '-';
  const st = s.stats;
  const rows: [string, string][] = [
    ['Shinies', `${s.purse} / ${s.quota}`],
    ['Orders filled', String(st.ordersFilled)],
    ['Stormed off', String(st.ordersAngry)],
    ['Best junk', `${best} (${s.bestTier})`],
    ['Merges', String(st.merges)],
    ['Peak stink', String(Math.round(st.peakStink))],
    ['Overflowed', String(st.overflows)],
  ];
  rows.forEach(([a, b], i) => {
    const y = r.y + 92 + i * 13;
    drawText(g, a, r.x + 30, y, { color: 'ink1' });
    drawText(g, b, r.x + r.w - 30, y, { color: 'ink0', align: 'right' });
  });
  if (v.t - v.endedAt > 0.8) drawSprite(g, won ? 'stamp_passed' : 'stamp_shutdown', r.x + r.w - 62, r.y + 82);
  if (v.t - v.endedAt > 1.2 && Math.sin(v.t * 4) > -0.6) {
    drawText(g, won ? 'click to play the night again' : 'click to try again', W / 2, r.y + r.h - 18, { color: 'ink1', align: 'center' });
  }
}
