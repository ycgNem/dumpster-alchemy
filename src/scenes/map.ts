// The county map, between nights: the three districts left to right (Lot 9 | The Marina | Mount
// Trashmore), the road of nights with dotted paths drawn by code, the crew's truck where you are,
// and the bosses waiting ahead. After night 1 each step offers two forks: a rule from the act's
// pool and a reward tag. Hover (or tap) a night for its rule, quota and reward; pick one of the
// next two, then Head Out. Art: the `map` atlas (map_bg, map_node_*, map_you, map_tag_*), with a
// greybox until it lands.
import { playRun } from '../audio';
import { ACTS, NIGHT_COUNT, REWARDS, actOf, isFork, type NightDef, type RewardTag } from '../data/nights';
import type { PalName } from '../data/palette';
import { TUNING } from '../data/tuning';
import { H, W, viewRect } from '../engine/screen';
import { needsPick, nodeNight, pickFork, pickedFork, type Run } from '../game/run';
import { fillRect, outlineRect } from '../render/greybox';
import { inRect, type Rect } from '../render/layout';
import { bigText, buttonRow, dim, drawAt, drawIcon, drawPaper, drawTooltipAt, fmt, menuBackdrop, menuPointing, setMenuPointing, type Btn } from '../render/menus';
import { drawSlots, perkTip } from '../render/run';
import { drawSprite, sprite } from '../render/sprites';
import { drawText, textWidth, wrapText } from '../render/text';
import type { Flow } from './flow';
import { MenuScene, type Music } from './menu';

/** x of each night's column (index night - 1). */
const XS = [40, 92, 144, 196, 262, 322, 384, 450, 510, 590] as const;
const MID_Y = 166;
const FORK_DY = 40;
const NODE = 24;
/** The truck's drive to the picked node: seconds, from its length (about 0.6-1 s). */
const driveSec = (len: number): number => Math.min(1, 0.6 + len / 300);

interface Spot {
  night: number;
  fork: number;
  x: number;
  y: number;
}

/** Where every node on the map sits (centre points). */
function spots(run: Run): Spot[] {
  const out: Spot[] = [];
  for (let n = 1; n <= NIGHT_COUNT; n++) {
    const nodes = run.map[n - 1] ?? [];
    const x = XS[n - 1] ?? 0;
    if (nodes.length <= 1) out.push({ night: n, fork: 0, x, y: MID_Y });
    else nodes.forEach((_, k) => out.push({ night: n, fork: k, x, y: MID_Y + (k === 0 ? -FORK_DY : FORK_DY) }));
  }
  return out;
}

function hitRect(p: Spot): Rect {
  const big = isBossNight(p.night) ? 6 : 2;
  return { x: p.x - NODE / 2 - big, y: p.y - NODE / 2 - big, w: NODE + big * 2, h: NODE + big * 2 };
}

function isBossNight(n: number): boolean {
  const a = actOf(n);
  return n === a.nights[a.nights.length - 1];
}

const TAG_COLOR: Record<RewardTag, PalName> = { loot: 'sodium3', shop: 'toxic2', juice: 'blue', elite: 'red' };

export class MapScene extends MenuScene {
  protected readonly music: Music = 'title';
  private readonly run: Run;
  private over: Spot | null = null;
  private overSlot = -1;
  private pressedOn: Spot | null = null;
  /** The fork picked on this visit (-1: none yet). */
  private choice: number;
  private choseAt = -9;
  /** Heading out: the truck drives from (x0, y0) to (x1, y1), then the night card comes up. */
  private drive: { x0: number; y0: number; x1: number; y1: number; at: number; sec: number } | null = null;

  constructor(flow: Flow, run: Run) {
    super(flow);
    this.run = run;
    this.choice = needsPick(run) ? -1 : pickedFork(run);
  }

  protected buttons(): Btn[] {
    if (this.drive) return [];
    const ready = this.choice >= 0;
    return buttonRow(
      [
        ['go', ready ? `Head Out: Night ${this.run.night}` : 'Pick a fork', { keys: ready ? ['Enter', 'Space'] : [], icon: 'icon_play', disabled: !ready }],
        ['title', 'Title', { keys: ['Escape'], sound: 'back' }],
      ],
      W / 2,
      326,
      150,
      22,
    );
  }

  protected press(id: string): void {
    if (id === 'go') {
      if (this.choice < 0) return;
      this.headOut();
    } else this.flow.title();
  }

  /** Commit the fork: the truck drives along the dotted road to it (a click skips the drive). */
  private headOut(): void {
    if (this.drive) return;
    pickFork(this.run, this.choice);
    const from = this.truckSpot();
    const to = spots(this.run).find((s) => s.night === this.run.night && s.fork === this.choice) ?? spots(this.run).find((s) => s.night === this.run.night);
    if (!to) return this.flow.leaveMapScene();
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    this.drive = { x0: from.x, y0: from.y, x1: to.x, y1: to.y, at: this.t, sec: driveSec(len) };
    playRun('drive');
  }

  /** Is this spot one of the next night's options (clickable)? */
  private pickable(p: Spot): boolean {
    return p.night === this.run.night && isFork(p.night);
  }

  protected step(): void {
    const { input } = this;
    if (this.drive) {
      // Arrived, or skipped with a click or a key: on to the night card.
      const skip = input.pressed || ['Enter', 'Space', 'Escape'].some((k) => input.hit(k));
      if (skip || this.t - this.drive.at >= this.drive.sec + 0.15) this.flow.leaveMapScene();
      return;
    }
    const all = spots(this.run);
    this.over = all.find((p) => inRect(hitRect(p), input.x, input.y)) ?? null;
    const sr = this.slotRects();
    this.overSlot = sr.findIndex((r) => inRect(r, input.x, input.y));
    setMenuPointing(menuPointing() || (this.over !== null && this.pickable(this.over)));
    if (input.pressed) this.pressedOn = all.find((p) => inRect(hitRect(p), input.pressX, input.pressY)) ?? null;
    if (input.released) {
      const p = this.over;
      const same = p && this.pressedOn && p.night === this.pressedOn.night && p.fork === this.pressedOn.fork;
      if (p && same && this.pickable(p)) {
        if (this.choice === p.fork) {
          // A second click on the picked fork heads out.
          this.headOut();
          return;
        }
        this.choice = p.fork;
        this.choseAt = this.t;
        playRun('fork');
      }
      this.pressedOn = null;
    }
    // Keys: left/up and right/down pick a fork.
    if (isFork(this.run.night)) {
      const was = this.choice;
      if (input.hit('ArrowUp') || input.hit('ArrowLeft')) this.choice = 0;
      if (input.hit('ArrowDown') || input.hit('ArrowRight')) this.choice = 1;
      if (this.choice !== was) {
        this.choseAt = this.t;
        playRun('fork');
      }
    }
  }

  private slotRects(): Rect[] {
    return Array.from({ length: this.run.maxSlots }, (_, i) => ({ x: 16 + i * 32, y: 288, w: 28, h: 28 }));
  }

  /** The night a spot stands for. */
  private nightAt(p: Spot): NightDef | null {
    const node = this.run.map[p.night - 1]?.[p.fork];
    return node ? nodeNight(p.night, node) : null;
  }

  protected paint(g: CanvasRenderingContext2D): void {
    const run = this.run;
    this.drawGround(g);
    this.drawRoads(g);
    for (const p of spots(run)) this.drawNode(g, p);
    this.drawYou(g);

    // Top: where you are, the strikes, the bank.
    // (The bar runs margin to margin but stops at the stage's top, so map_bg's sky shows above it
    // on a tall window.)
    const vr = viewRect();
    fillRect(g, { x: vr.x, y: 0, w: vr.w, h: 24 }, 'ink0');
    bigText(g, 'THE COUNTY DUMP', 10, 4, 1, { color: 'sodium3' });
    drawText(g, `NIGHT ${run.night} OF ${NIGHT_COUNT}`, 120, 7, { color: 'bone' });
    const strikes = TUNING.run.strikes;
    drawText(g, 'STRIKES', 216, 7, { color: 'night3' });
    for (let i = 0; i < strikes; i++) {
      const x = 216 + textWidth("STRIKES") + 6 + i * 14;
      const on = i < run.strikes;
      fillRect(g, { x, y: 6, w: 11, h: 11 }, on ? 'red' : 'night1');
      if (on) {
        fillRect(g, { x: x + 2, y: 8, w: 7, h: 1 }, 'bone');
        fillRect(g, { x: x + 2, y: 14, w: 7, h: 1 }, 'bone');
      }
    }
    const bank = fmt(run.bank);
    drawIcon(g, 'icon_shiny', W - 28 - textWidth(bank), 4, 'yellow');
    drawText(g, bank, W - 8, 7, { color: 'sodium3', align: 'right' });

    // A dark strip under the buttons, so "Pick a fork" (drawn faded until you pick) stays readable
    // over the harbour's boats.
    fillRect(g, { x: vr.x, y: 323, w: vr.w, h: vr.y + vr.h - 323 }, 'ink0');
    this.drawDetail(g);
    // Your Contraband, bottom left.
    drawText(g, 'CONTRABAND', 16, 276, { color: 'bone', outline: 'ink0' });
    drawSlots(g, run.slots, run.maxSlots, 16, 288, this.overSlot);
  }

  /** The map background, or a greybox county: three districts, a river, a mountain. */
  private drawGround(g: CanvasRenderingContext2D): void {
    if (sprite('map_bg') && drawSprite(g, 'map_bg', 0, 0)) {
      dim(g, 0.15);
      return;
    }
    menuBackdrop(g, this.t, 0.75, actOf(this.run.night).scene);
    const bands: [number, number, PalName, PalName][] = [
      [0, 228, 'dirt1', 'dirt0'],
      [228, 420, 'night2', 'night1'],
      [420, W, 'grime1', 'grime0'],
    ];
    for (const [x0, x1, a, b] of bands) {
      fillRect(g, { x: x0, y: 30, w: x1 - x0, h: 240 }, a);
      for (let x = x0; x < x1; x += 6) for (let y = 34; y < 266; y += 6) if ((x * 7 + y * 13) % 5 === 0) fillRect(g, { x: x + 2, y, w: 2, h: 1 }, b);
    }
    // The Marina's water and pier; Mount Trashmore's heap.
    for (let y = 230; y < 270; y += 4) fillRect(g, { x: 232, y, w: 184, h: 2 }, (y / 4) % 2 ? 'blue' : 'night3');
    for (let i = 0; i < 18; i++) {
      const k = i / 17;
      const h = Math.round(90 * (1 - Math.abs(k - 0.5) * 2));
      fillRect(g, { x: 440 + i * 10, y: 120 - h, w: 10, h: h + 10 }, 'grime2');
    }
    for (const x of [228, 420]) for (let y = 30; y < 270; y += 6) fillRect(g, { x, y, w: 1, h: 3 }, 'ink0');
    outlineRect(g, { x: 0, y: 30, w: W, h: 240 }, 'ink0');
    // District names.
    ACTS.forEach((a, i) => {
      const cx = [114, 324, 530][i] ?? 0;
      const name = a.name.toUpperCase();
      const w = textWidth(name) + 10;
      fillRect(g, { x: Math.round(cx - w / 2), y: 34, w, h: 13 }, 'ink0');
      drawText(g, name, cx, 36, { color: a.act === actOf(this.run.night).act ? 'sodium3' : 'night3', align: 'center' });
    });
  }

  /** Dotted roads between each night and the next: walked (solid), ahead (bright dots), off the path (faint). */
  private drawRoads(g: CanvasRenderingContext2D): void {
    const run = this.run;
    const all = spots(run);
    for (let n = 1; n < NIGHT_COUNT; n++) {
      const from = all.filter((p) => p.night === n);
      const to = all.filter((p) => p.night === n + 1);
      for (const a of from) {
        for (const b of to) {
          const walked = n + 1 < run.night && a.fork === pickedFork(run, n) && b.fork === pickedFork(run, n + 1);
          const fromHere = n + 1 === run.night && a.fork === pickedFork(run, n);
          const lit = fromHere && (this.choice < 0 || this.choice === b.fork);
          const col: PalName = walked ? 'sodium2' : lit ? 'bone' : n + 1 < run.night ? 'night1' : 'night3';
          road(g, a.x, a.y, b.x, b.y, col, walked ? 1 : 2, fromHere ? this.t : 0);
        }
      }
    }
  }

  private drawNode(g: CanvasRenderingContext2D, p: Spot): void {
    const run = this.run;
    const def = this.nightAt(p);
    if (!def) return;
    const boss = isBossNight(p.night);
    const passed = p.night < run.night;
    const onPath = p.fork === pickedFork(run, p.night);
    const next = p.night === run.night;
    const picked = next && (this.choice === p.fork || !isFork(p.night));
    const off = (passed && !onPath) || (next && isFork(p.night) && this.choice >= 0 && this.choice !== p.fork);
    const hover = this.over !== null && this.over.night === p.night && this.over.fork === p.fork;
    const pulse = next && (picked || this.choice < 0) ? Math.round(Math.sin(this.t * 5) * 1.5) : 0;
    const size = (boss ? 32 : NODE) + (hover ? 2 : 0) + pulse;
    const x = Math.round(p.x - size / 2);
    const y = Math.round(p.y - size / 2);
    const a = g.globalAlpha;
    if (off) g.globalAlpha = a * 0.4;
    const name = passed && onPath ? 'map_node_done' : boss ? 'map_node_boss' : p.night > run.night + 2 && !boss ? 'map_node_locked' : 'map_node_night';
    const d = sprite(name);
    if (!(d && drawSprite(g, name, p.x - d.w / 2 + d.ax, p.y - d.h / 2 + d.ay))) {
      // Greybox: a stamped disc for a night, a skull plate for a boss.
      fillRect(g, { x: x - 1, y: y - 1, w: size + 2, h: size + 2 }, 'ink0');
      const fill: PalName = passed && onPath ? 'toxic1' : boss ? 'rust1' : next ? 'card3' : 'card1';
      fillRect(g, { x: x + 1, y: y + 1, w: size - 2, h: size - 2 }, fill);
      fillRect(g, { x: x + 1, y: y + size - 5, w: size - 2, h: 4 }, boss ? 'rust0' : 'card0');
      if (boss) {
        // Two eye holes and teeth.
        fillRect(g, { x: p.x - 7, y: p.y - 6, w: 5, h: 5 }, 'ink0');
        fillRect(g, { x: p.x + 2, y: p.y - 6, w: 5, h: 5 }, 'ink0');
        for (let i = -6; i <= 4; i += 4) fillRect(g, { x: p.x + i, y: p.y + 4, w: 2, h: 3 }, 'bone');
      } else drawText(g, String(p.night), p.x, p.y - 6, { color: 'ink0', align: 'center' });
      if (passed && onPath) drawIcon(g, 'icon_check', p.x - 8, p.y - 8, 'toxic3');
    }
    if (picked || hover) outlineRect(g, { x: x - 3, y: y - 3, w: size + 6, h: size + 6 }, picked ? 'sodium3' : 'bone');
    // The nodes you can still choose breathe: a ring swells out of them and fades.
    if (next && isFork(p.night) && this.choice < 0 && !this.drive) {
      const k = (this.t * 0.9 + p.fork * 0.5) % 1;
      const grow = Math.round(3 + k * 7);
      const ring = g.globalAlpha;
      g.globalAlpha = ring * (1 - k) * 0.9;
      outlineRect(g, { x: x - grow, y: y - grow, w: size + grow * 2, h: size + grow * 2 }, 'sodium3');
      g.globalAlpha = ring;
    }
    // The reward tag, top right.
    if (def.tag) drawTag(g, def.tag, x + size - 6, y - 8);
    g.globalAlpha = a;
    // Names: the next night's options and the bosses.
    if ((next || boss) && !off) {
      // A long boss name goes on two lines, so it stays clear of the fork nodes either side.
      const name = def.name.toUpperCase();
      const cut = name.lastIndexOf(' ');
      const lines = boss && textWidth(name) > 70 && cut > 0 ? [name.slice(0, cut), name.slice(cut + 1)] : [name];
      const w = Math.max(...lines.map((l) => textWidth(l))) + 6;
      const ly = p.y + size / 2 + 4;
      const lx = Math.min(W - 2 - w, Math.round(p.x - w / 2));
      fillRect(g, { x: lx, y: ly, w, h: 1 + lines.length * 10 }, 'ink0');
      lines.forEach((l, i) => drawText(g, l, lx + w / 2, ly + 1 + i * 10, { color: boss ? 'rust3' : 'bone', align: 'center' }));
    }
  }

  /** Where the truck is parked: on the last night you passed (or at the gate before night 1). */
  private truckSpot(): { x: number; y: number } {
    const run = this.run;
    const at = Math.max(1, run.night - 1);
    const p = spots(run).find((s) => s.night === at && s.fork === pickedFork(run, at)) ?? { x: XS[0], y: MID_Y };
    return { x: run.night === 1 ? p.x - 30 : p.x, y: p.y };
  }

  /** The crew's beat-up truck: parked and idling, or bouncing along the road to the picked node. */
  private drawYou(g: CanvasRenderingContext2D): void {
    let { x: px, y: py } = this.truckSpot();
    let bob = Math.round(Math.abs(Math.sin(this.t * 4)) * -2);
    const d = this.drive;
    if (d) {
      const k = Math.min(1, (this.t - d.at) / d.sec);
      const e = k * k * (3 - 2 * k);
      px = d.x0 + (d.x1 - d.x0) * e;
      py = d.y0 + (d.y1 - d.y0) * e;
      // Bouncing on the ruts, a hop at the start, and exhaust puffs left behind.
      bob = k < 1 ? Math.round(-Math.abs(Math.sin((this.t - d.at) * 22)) * 3 - Math.sin(k * Math.PI) * 3) : 0;
      for (let i = 0; i < 6; i++) {
        const age = ((this.t - d.at) * 8 - i) / 8;
        if (age < 0 || age > 0.5) continue;
        const kk = Math.max(0, k - age * 0.6);
        const ee = kk * kk * (3 - 2 * kk);
        const ex = Math.round(d.x0 + (d.x1 - d.x0) * ee - 18 - age * 20);
        const ey = Math.round(d.y0 + (d.y1 - d.y0) * ee - 10 - age * 18);
        const r = 1 + Math.round(age * 6);
        const a = g.globalAlpha;
        g.globalAlpha = a * (1 - age * 2);
        fillRect(g, { x: ex - r, y: ey - r, w: r * 2, h: r * 2 }, age < 0.15 ? 'steel2' : 'steel1');
        g.globalAlpha = a;
      }
    }
    const x = Math.round(px);
    const y = Math.round(py - 22 + bob);
    if (drawSprite(g, 'map_you', x, y + 14, { frame: d ? Math.floor(this.t * 10) % 2 : undefined })) return;
    fillRect(g, { x: x - 13, y: y - 1, w: 26, h: 14 }, 'ink0');
    fillRect(g, { x: x - 12, y, w: 15, h: 10 }, 'hivis');
    fillRect(g, { x: x + 3, y: y + 3, w: 8, h: 7 }, 'steel2');
    fillRect(g, { x: x + 5, y: y + 4, w: 4, h: 3 }, 'blue');
    fillRect(g, { x: x - 9, y: y + 10, w: 5, h: 4 }, 'ink0');
    fillRect(g, { x: x + 4, y: y + 10, w: 5, h: 4 }, 'ink0');
    drawText(g, 'YOU', x, y - 12, { color: 'sodium3', align: 'center', outline: 'ink0' });
  }

  /** The bottom panel: the hovered (or picked) night's rule, quota and reward. */
  private drawDetail(g: CanvasRenderingContext2D): void {
    const run = this.run;
    const show =
      this.over ??
      (this.choice >= 0 ? spots(run).find((p) => p.night === run.night && p.fork === this.choice) : null) ??
      spots(run).find((p) => p.night === run.night) ??
      null;
    const r = { x: 196, y: 274, w: 432, h: 46 };
    drawPaper(g, r);
    if (!show) return;
    const def = this.nightAt(show);
    if (!def) return;
    const boss = isBossNight(show.night);
    const head = `NIGHT ${show.night} · ${def.name.toUpperCase()}${boss ? ' · BOSS' : ''}`;
    drawText(g, head, r.x + 8, r.y + 5, { color: boss ? 'rust1' : 'ink0' });
    const goal = def.goal === 'king' ? 'GOAL: the Trash King' : `QUOTA ${fmt(def.quota)}`;
    drawText(g, goal, r.x + r.w - 8, r.y + 5, { color: 'ink0', align: 'right' });
    wrapText(def.rule, r.w - 16)
      .slice(0, 1)
      .forEach((l) => drawText(g, l, r.x + 8, r.y + 17, { color: 'ink1' }));
    if (def.tag) {
      drawTag(g, def.tag, r.x + 8, r.y + 29);
      drawText(g, REWARDS[def.tag].blurb, r.x + 30, r.y + 30, { color: 'ink0' });
    } else if (show.night === run.night && isFork(show.night) && this.choice < 0) {
      drawText(g, 'Pick one of the two forks ahead.', r.x + 8, r.y + 30, { color: 'rust1' });
    } else if (boss) {
      drawText(g, 'Every act ends with a boss night.', r.x + 8, r.y + 30, { color: 'ink1' });
    }
  }

  protected paintOver(g: CanvasRenderingContext2D): void {
    const id = this.overSlot >= 0 ? this.run.slots[this.overSlot] : undefined;
    const r = this.slotRects()[this.overSlot];
    if (id && r) drawTooltipAt(g, perkTip(id), r, 'above', 260);
    if (this.t - this.choseAt < 0.3 && this.choice >= 0) {
      const p = spots(this.run).find((s) => s.night === this.run.night && s.fork === this.choice);
      if (p) outlineRect(g, { x: p.x - 18, y: p.y - 18, w: 36, h: 36 }, 'white');
    }
    // Keep the margins tidy under the bottom bar on very tall windows.
    void H;
  }
}

/** A dotted road from (x0, y0) to (x1, y1); `t` > 0 marches the dots along. */
function road(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, c: PalName, size: number, t: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const step = 6;
  const off = t > 0 ? (t * 12) % step : 0;
  for (let d = 14 + off; d < len - 12; d += step) {
    const k = d / len;
    fillRect(g, { x: Math.round(x0 + (x1 - x0) * k), y: Math.round(y0 + (y1 - y0) * k), w: size, h: size }, c);
  }
}

/** A reward tag: `map_tag_<tag>`, or a little coloured flag with its letter. */
function drawTag(g: CanvasRenderingContext2D, tag: RewardTag, x: number, y: number): void {
  if (drawAt(g, `map_tag_${tag}`, x, y)) return;
  fillRect(g, { x, y, w: 16, h: 14 }, 'ink0');
  fillRect(g, { x: x + 1, y: y + 1, w: 14, h: 12 }, TAG_COLOR[tag]);
  drawText(g, REWARDS[tag].name.slice(0, 1), x + 8, y + 2, { color: 'ink0', align: 'center' });
}
