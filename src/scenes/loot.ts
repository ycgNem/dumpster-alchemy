// Picking a card: the free Contraband pick after every passed night (1 of 3, two picks on a loot
// night, rarer cards on an elite one), and the Foreman pick at the start of a run. With every
// slot full, a picked card asks which slot it goes in (the old one is tossed); or leave it.
import { playRun, playUi } from '../audio';
import { contrabandDef, FOREMEN, MILESTONES, type ContrabandId, type ForemanDef } from '../data/contraband';
import { W } from '../engine/screen';
import { hasMilestone } from '../game/meta';
import { lootOffer, skipLoot, takeLoot, type Run } from '../game/run';
import { fillRect, outlineRect, placeholderRaccoon } from '../render/greybox';
import { inRect, type Rect } from '../render/layout';
import { bigText, buttonRow, drawPanel, drawPaper, drawTooltipAt, menuBackdrop, menuPointing, setMenuPointing, type Btn } from '../render/menus';
import { drawPerk, drawPerkBig, drawSlots, perkTip, RARITY_COLOR, RARITY_INK, slotRects } from '../render/run';
import { drawSprite } from '../render/sprites';
import { drawText, textWidth, wrapText } from '../render/text';
import type { Flow } from './flow';
import { MenuScene, type Music } from './menu';
import { actOf } from '../data/nights';

const PANEL = { x: 12, y: 10, w: 616, h: 282 };

type Mode = 'loot' | 'foreman';

function cards(n: number): Rect[] {
  const w = n >= 4 ? 136 : 168;
  const gap = n >= 4 ? 10 : 18;
  const total = n * w + (n - 1) * gap;
  const x0 = Math.round(W / 2 - total / 2);
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (w + gap), y: 60, w, h: 160 }));
}

export class LootScene extends MenuScene {
  protected readonly music: Music = 'report';
  private readonly run: Run;
  private readonly mode: Mode;
  private over = -1;
  private overSlot = -1;
  private pressedOn = -1;
  /** A picked card waiting for a slot to go in (all slots full). */
  private picked: ContrabandId | null = null;
  private tookAt = -9;

  constructor(flow: Flow, run: Run, mode: Mode) {
    super(flow);
    this.run = run;
    this.mode = mode;
  }

  private offer(): ContrabandId[] {
    return lootOffer(this.run, this.flow.meta);
  }

  private foremen(): ForemanDef[] {
    return [...FOREMEN];
  }

  private count(): number {
    return this.mode === 'foreman' ? this.foremen().length : this.offer().length;
  }

  private slotsAt(): Rect[] {
    const n = this.run.maxSlots;
    const w = n * 32 - 4;
    return slotRects(n, Math.round(W / 2 - w / 2) + 40, 248);
  }

  protected buttons(): Btn[] {
    if (this.mode === 'foreman') return buttonRow([['back', 'Title', { keys: ['Escape'], sound: 'back' }]], W / 2, 304, 112, 22);
    const list: [string, string, Partial<Btn>?][] = [];
    if (this.picked) list.push(['cancel', 'Not that one', { keys: ['Escape'], sound: 'back' }]);
    else list.push(['skip', this.offer().length === 0 ? 'Swap Meet' : 'Leave it', { keys: ['Escape'], tip: 'Take nothing (or nothing more) and go on to the Swap Meet.' }]);
    return buttonRow(list, W / 2, 304, 132, 22);
  }

  protected press(id: string): void {
    if (id === 'back') return this.flow.title();
    if (id === 'cancel') {
      this.picked = null;
      return;
    }
    if (id === 'skip') {
      skipLoot(this.run);
      this.next();
    }
  }

  /** After a pick: another pick, or on to the Swap Meet. */
  private next(): void {
    this.flow.save();
    if (this.run.loot > 0) {
      this.picked = null;
      return;
    }
    this.flow.swapMeet();
  }

  protected step(): void {
    const { input } = this;
    const cs = cards(this.count());
    this.over = cs.findIndex((r) => inRect(r, input.x, input.y));
    this.overSlot = this.mode === 'loot' ? this.slotsAt().findIndex((r) => inRect(r, input.x, input.y)) : -1;
    setMenuPointing(menuPointing() || this.over >= 0 || (this.picked !== null && this.overSlot >= 0));
    if (input.pressed) this.pressedOn = cs.findIndex((r) => inRect(r, input.pressX, input.pressY));
    if (!input.released) return;
    if (this.picked && this.overSlot >= 0) {
      if (takeLoot(this.run, this.picked, this.overSlot)) {
        playRun('pick');
        this.next();
      }
      return;
    }
    if (this.over < 0 || this.over !== this.pressedOn) return;
    if (this.mode === 'foreman') {
      const f = this.foremen()[this.over];
      if (!f || !hasMilestone(this.flow.meta, f.unlock)) {
        playUi('back');
        return;
      }
      playUi('click');
      this.flow.startRun(f.id);
      return;
    }
    const id = this.offer()[this.over];
    if (!id) return;
    if (this.run.slots.length >= this.run.maxSlots) {
      this.picked = id;
      playUi('click');
      return;
    }
    if (takeLoot(this.run, id)) {
      playRun('pick');
      this.tookAt = this.t;
      this.next();
    }
  }

  protected paint(g: CanvasRenderingContext2D): void {
    const act = actOf(Math.max(1, this.run.night - 1));
    menuBackdrop(g, this.t, 0.55, act.scene);
    drawPanel(g, PANEL);
    if (this.mode === 'foreman') return this.paintForemen(g);
    const run = this.run;
    const head = this.picked ? 'SLOTS FULL' : 'CONTRABAND';
    bigText(g, head, W / 2, PANEL.y + 10, 2, { color: 'ink0', align: 'center' });
    const sub = this.picked
      ? `Click a slot to swap in ${contrabandDef(this.picked).name}. The old one is tossed.`
      : `Something fell off the truck. Take one, free.${run.loot > 1 ? ` (${run.loot} picks left)` : ''}${run.lootElite ? ' ELITE: the good stuff.' : ''}`;
    drawText(g, sub, W / 2, PANEL.y + 33, { color: this.picked ? 'rust1' : 'ink1', align: 'center' });
    const offer = this.offer();
    if (offer.length === 0) drawText(g, "Nothing left in the pool. You've got it all.", W / 2, 130, { color: 'ink1', align: 'center' });
    cards(offer.length).forEach((r, i) => {
      const id = offer[i];
      if (id) this.drawCard(g, id, r, i === this.over || id === this.picked);
    });
    // Your slots.
    const sr = this.slotsAt();
    const x0 = (sr[0]?.x ?? 0) - 6;
    drawText(g, 'YOUR SLOTS', x0, 256, { color: 'ink0', align: 'right' });
    drawSlots(g, run.slots, run.maxSlots, sr[0]?.x ?? 0, 248, this.picked ? this.overSlot : -1, 'red');
    if (this.picked && Math.sin(this.t * 8) > 0) for (const r of sr) outlineRect(g, { x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }, 'rust1');
  }

  private drawCard(g: CanvasRenderingContext2D, id: ContrabandId, r: Rect, hot: boolean): void {
    const d = contrabandDef(id);
    const lift = hot ? -3 : 0;
    const c = { ...r, y: r.y + lift };
    if (hot) outlineRect(g, { x: c.x - 2, y: c.y - 2, w: c.w + 4, h: c.h + 4 }, 'sodium3');
    drawPaper(g, c);
    fillRect(g, { x: c.x + 4, y: c.y + 4, w: c.w - 8, h: 4 }, RARITY_COLOR[d.rarity]);
    const cx = c.x + c.w / 2;
    // The icon on a dark shelf, 2x.
    fillRect(g, { x: cx - 28, y: c.y + 12, w: 56, h: 54 }, 'card0');
    drawPerkBig(g, id, cx - 24, c.y + 15, 2);
    wrapText(d.name.toUpperCase(), c.w - 12)
      .slice(0, 2)
      .forEach((l, i) => drawText(g, l, cx, c.y + 72 + i * 10, { color: 'ink0', align: 'center' }));
    drawText(g, d.rarity.toUpperCase(), cx, c.y + 94, { color: RARITY_INK[d.rarity], align: 'center' });
    wrapText(d.blurb, c.w - 14)
      .slice(0, 5)
      .forEach((l, i) => drawText(g, l, cx, c.y + 108 + i * 10, { color: 'ink1', align: 'center' }));
  }

  private paintForemen(g: CanvasRenderingContext2D): void {
    const meta = this.flow.meta;
    bigText(g, 'WHO RUNS THE SHIFT?', W / 2, PANEL.y + 10, 2, { color: 'ink0', align: 'center' });
    drawText(g, 'Pick a Foreman for this run. More turn up as you reach milestones.', W / 2, PANEL.y + 33, { color: 'ink1', align: 'center' });
    const fs = this.foremen();
    cards(fs.length).forEach((r, i) => {
      const f = fs[i];
      if (!f) return;
      const open = hasMilestone(meta, f.unlock);
      const hot = open && i === this.over;
      const c = { ...r, y: r.y + (hot ? -3 : 0) };
      if (hot) outlineRect(g, { x: c.x - 2, y: c.y - 2, w: c.w + 4, h: c.h + 4 }, 'sodium3');
      drawPaper(g, c);
      const cx = c.x + c.w / 2;
      fillRect(g, { x: c.x + 6, y: c.y + 6, w: c.w - 12, h: 52 }, 'card0');
      const a = g.globalAlpha;
      if (!open) g.globalAlpha = a * 0.3;
      if (!drawSprite(g, `raccoon_${f.raccoon}_idle`, cx, c.y + 56, { frame: (this.t + i) % 3.3 < 0.14 ? 1 : 0 })) placeholderRaccoon(g, f.raccoon, 'idle', false, cx, c.y + 56);
      g.globalAlpha = a;
      drawText(g, f.name.toUpperCase(), cx, c.y + 62, { color: 'ink0', align: 'center' });
      if (!open) {
        const how = MILESTONES.find((m) => m.id === f.unlock)?.how ?? 'Keep playing';
        drawText(g, 'LOCKED', cx, c.y + 80, { color: 'rust1', align: 'center' });
        wrapText(`${how} to hire.`, c.w - 14).forEach((l, k) => drawText(g, l, cx, c.y + 96 + k * 10, { color: 'ink1', align: 'center' }));
        return;
      }
      wrapText(f.blurb, c.w - 12)
        .slice(0, 5)
        .forEach((l, k) => drawText(g, l, cx, c.y + 76 + k * 10, { color: 'ink1', align: 'center' }));
      const starts = f.start.filter((x): x is ContrabandId => x !== 'rare');
      starts.forEach((id, k) => drawPerk(g, id, cx - (starts.length * 26) / 2 + k * 26 + 1, c.y + c.h - 30));
      if (f.start.includes('rare')) drawText(g, '? RARE ?', cx, c.y + c.h - 22, { color: 'rust1', align: 'center' });
    });
  }

  protected paintOver(g: CanvasRenderingContext2D): void {
    if (this.mode !== 'loot') return;
    const id = this.overSlot >= 0 ? this.run.slots[this.overSlot] : undefined;
    const r = this.slotsAt()[this.overSlot];
    if (id && r) drawTooltipAt(g, perkTip(id), r, 'above', 260);
    if (this.t - this.tookAt < 0.6) {
      const w = textWidth('YOINK!') * 2;
      bigText(g, 'YOINK!', W / 2 - w / 2, 120, 2, { color: 'toxic2', outline: 'ink0' });
    }
  }
}
