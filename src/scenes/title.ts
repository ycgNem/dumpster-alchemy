// The title: Lot 9 at night, the logo on its cardboard sign, the regulars hanging around, and
// Continue (a run between nights) / New Run / Daily Dump / Trash Almanac / Sound, plus the screen
// agent's fullscreen button in the top-right corner.
import { isMuted, playRun, setMuted } from '../audio';
import { NIGHT_COUNT } from '../data/nights';
import { RACCOONS } from '../data/raccoons';
import { TUNING } from '../data/tuning';
import { H, W } from '../engine/screen';
import { dateKey } from '../game/meta';
import { currentNight, dailyNumber } from '../game/run';
import { copyText } from './share';
import type { ItemId } from '../data/items';
import { drawItem } from '../render/board';
import { drawFullscreenButton } from '../render/fullscreen';
import { fillRect, placeholderRaccoon } from '../render/greybox';
import { bigText, buttonColumn, drawAt, drawPanel, drawPaper, fmt, menuBackdrop, type Btn } from '../render/menus';
import { drawSprite, sprite } from '../render/sprites';
import { drawText, textWidth } from '../render/text';
import { MenuScene, type Music } from './menu';

export class TitleScene extends MenuScene {
  protected readonly music: Music = 'title';
  /** New Run over a saved run asks twice; this is when the first press was. */
  private armed = -9;
  /** When the Daily's share card was last copied (the button says so for a moment). */
  private copiedAt = -9;

  protected buttons(): Btn[] {
    const run = this.flow.run;
    const sure = this.t - this.armed < 3;
    const list: [string, string, Partial<Btn>?][] = [];
    if (run) list.push(['continue', 'Continue', { keys: ['Enter', 'Space'], icon: 'icon_play' }]);
    list.push([
      'new',
      sure ? 'Sure? Start over' : 'New Run',
      { keys: run ? [] : ['Enter', 'Space'], icon: run ? undefined : 'icon_play', tip: run && !sure ? 'Starts a new run from night 1. Your saved run is lost.' : undefined },
    ]);
    const now = new Date();
    const n = dailyNumber(now);
    const played = this.flow.dailyPlayed(now);
    const score = this.flow.meta.daily[dateKey(now)] ?? 0;
    const label = played ? (this.t - this.copiedAt < 1.5 ? 'Copied!' : `Daily #${n}: ${fmt(score)}`) : `Daily Dump #${n}`;
    list.push([
      'daily',
      label,
      {
        icon: 'icon_star',
        keys: ['KeyD'],
        tip: played ? 'One try a day. Click to copy your share card. A new one tomorrow.' : "Today's seeded night: a random rule, two Contraband, one try.",
      },
    ]);
    list.push(['almanac', 'Trash Almanac', { icon: 'icon_book', keys: ['KeyA'] }]);
    list.push(['sound', isMuted() ? 'Sound: OFF' : 'Sound: ON', { icon: isMuted() ? 'icon_mute' : 'icon_sound', keys: ['KeyM'] }]);
    return buttonColumn(list, W / 2, 162, 156, 20, 4);
  }

  protected press(id: string): void {
    const run = this.flow.run;
    switch (id) {
      case 'continue':
        this.flow.resume();
        break;
      case 'daily':
        if (!this.flow.dailyPlayed()) this.flow.startDaily();
        else if (this.flow.meta.lastShare) {
          copyText(this.flow.meta.lastShare);
          this.copiedAt = this.t;
          playRun('copy');
        }
        break;
      case 'new':
        if (run && this.t - this.armed >= 3) {
          this.armed = this.t;
          return;
        }
        this.flow.newGame();
        break;
      case 'almanac':
        this.flow.almanac(() => this.flow.title());
        break;
      case 'sound':
        setMuted(!isMuted());
        this.flow.save();
        break;
    }
  }

  protected paint(g: CanvasRenderingContext2D): void {
    menuBackdrop(g, this.t, 0.15);
    drawFullscreenButton(g, this.input, { x: W - 22, y: 3, w: 18, h: 18 });
    this.drawHeap(g);
    this.drawCrew(g);
    this.drawLogo(g);

    // Where the saved run is at, on a scrap of paper between the sign and the buttons.
    const run = this.flow.run;
    if (run) {
      const n = currentNight(run);
      const where = `Night ${run.night} of ${NIGHT_COUNT}: ${n.name}`;
      const text = `${where} · ${run.strikes} strike${run.strikes === 1 ? '' : 's'} · bank ${fmt(run.bank)}`;
      const r = { x: Math.round(W / 2 - (textWidth(text) + 16) / 2), y: 137, w: textWidth(text) + 16, h: 18 };
      drawPaper(g, r);
      drawText(g, text, W / 2, r.y + 4, { color: 'ink0', align: 'center' });
    }
    // The tagline (or the storage warning), bright, on an ink plate so the heap doesn't eat it.
    const blocked = !this.flow.saved;
    const tag = blocked ? "Can't save here (storage is blocked). Progress lasts until you close the tab." : 'drag junk onto junk · feed the raccoons · keep the stink down';
    const tw = textWidth(tag) + 12;
    fillRect(g, { x: Math.round(W / 2 - tw / 2), y: H - 16, w: tw, h: 14 }, 'ink0');
    drawText(g, tag, W / 2, H - 14, { color: blocked ? 'rust3' : 'sodium3', align: 'center' });
  }

  /**
   * Under the sign: tonight's pile of junk (biggest at the bottom, a gull on top, keeping an eye
   * on things) and the Dumpster beside it, bobbing now and then as something shifts inside.
   */
  private drawHeap(g: CanvasRenderingContext2D): void {
    // The mound itself, a dark hump the junk sits in.
    const cx = 318;
    const half = 122;
    for (let x = cx - half; x <= cx + half; x += 2) {
      const k = (x - cx) / half;
      const h = Math.round(66 * (1 - k * k) + Math.sin(x * 0.7) * 2);
      if (h <= 0) continue;
      fillRect(g, { x, y: 346 - h, w: 2, h }, 'ink1');
      fillRect(g, { x, y: 346 - h, w: 2, h: 1 }, 'dirt0');
    }
    const rows: { y: number; x0: number; ids: ItemId[] }[] = [
      { y: 346, x0: 214, ids: ['tire', 'mattress', 'bag', 'boot', 'fridge', 'cart', 'can', 'toaster', 'bag', 'tire', 'boot'] },
      { y: 328, x0: 232, ids: ['boot', 'takeout', 'cart', 'car', 'bag', 'tire', 'takeout', 'can', 'toaster'] },
      { y: 310, x0: 254, ids: ['toaster', 'bag', 'mattress', 'takeout', 'boot', 'cap', 'can'] },
      { y: 292, x0: 284, ids: ['can', 'takeout', 'bag', 'cap'] },
    ];
    rows.forEach((row, j) =>
      row.ids.forEach((id, i) => {
        const x = row.x0 + i * 21 + ((i * 7 + j * 3) % 5) - 2;
        drawItem(g, id, x, row.y + ((i + j) % 2), { phase: i + j * 3, flip: (i + j) % 3 === 0 });
      }),
    );
    // The Dumpster beside it, rattling now and then, a seagull on the lid glancing about.
    const rattle = this.t % 5.3 > 5.05 ? Math.round(Math.sin(this.t * 50)) : 0;
    if (!drawSprite(g, rattle ? 'dumpster_rattle' : 'dumpster_closed', 452 + rattle, 344)) drawSprite(g, 'dumpster_closed', 452, 344);
    drawItem(g, 'gull', 458 + rattle, 312, { flip: Math.sin(this.t * 0.8) > 0 });
  }

  private drawLogo(g: CanvasRenderingContext2D): void {
    const bob = Math.round(Math.sin(this.t * 1.6) * 1.5);
    const logo = sprite('logo');
    if (logo && drawAt(g, 'logo', Math.round(W / 2 - logo.w / 2), 30 + bob)) return;
    // The greybox sign: cardboard, tape, marker.
    const r = { x: W / 2 - 132, y: 26 + bob, w: 264, h: 104 };
    drawPanel(g, r);
    bigText(g, 'DUMPSTER', W / 2, r.y + 12, 4, { color: 'ink0', align: 'center' });
    bigText(g, 'ALCHEMY', W / 2, r.y + 56, 3, { color: 'rust1', align: 'center' });
    drawText(g, 'the night shift at Lot 9', W / 2, r.y + 88, { color: 'ink1', align: 'center' });
  }

  /** The four regulars loitering at the bottom of the screen, blinking now and then. */
  private drawCrew(g: CanvasRenderingContext2D): void {
    const spots = [92, 152, 488, 548];
    RACCOONS.forEach((r, i) => {
      const x = spots[i] ?? 0;
      const y = 338;
      const period = TUNING.feel.blinkEverySec + i * 0.6;
      const blink = (this.t + i * 1.1) % period < TUNING.feel.blinkSec;
      const flip = i < 2;
      if (!drawSprite(g, `raccoon_${r.id}_idle`, x, y, { frame: blink ? 1 : 0, flip })) {
        placeholderRaccoon(g, r.id, 'idle', blink, x, y);
      }
    });
    // The Inspector, keeping an eye on things from the far left.
    drawSprite(g, 'possum_idle', 30, 338, { frame: Math.sin(this.t * 0.7) > 0.95 ? 1 : 0, flip: true });
  }
}
