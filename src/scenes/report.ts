// The night report: Inspector Possum's clipboard over the frozen lot. Why the night ended (and,
// for a shutdown, where the Stink came from), the numbers, new Almanac finds, the verdict stamp
// (slammed down a beat after the paper is up), what went in the bank, then Swap Meet / Retry /
// Title. Night 10 won goes on to the crowning; Endless shows the score.
import { playRun } from '../audio';
import { ITEMS, junkAt } from '../data/items';
import { INSPECTOR } from '../data/raccoons';
import { TUNING } from '../data/tuning';
import { H, W } from '../engine/screen';
import { dateKey } from '../game/meta';
import { LOST_KEEP, type NightResult, type Run } from '../game/run';
import { copyText, shareCard, sharePreview } from './share';
import { drawItem } from '../render/board';
import { fillRect, placeholderPossum } from '../render/greybox';
import { bigText, buttonRow, dim, drawClipboard, drawStamp, fmt, type Btn } from '../render/menus';
import { drawSprite } from '../render/sprites';
import { drawText, textWidth, wrapText } from '../render/text';
import type { Flow } from './flow';
import { MenuScene, type Music } from './menu';

const BOARD_R = { x: 150, y: 26, w: 340, h: 276 };
const STAMP_AT = 0.9;
/** New finds shown as icons before "+N more". */
const FOUND_MAX = 7;

export class ReportScene extends MenuScene {
  protected readonly music: Music = 'report';
  /** No fade from black: the lot stays lit on the first frame and only the clipboard slides in. */
  protected override readonly fade = false;
  private readonly run: Run;
  private readonly res: NightResult;
  private copiedAt = -9;

  constructor(flow: Flow, run: Run, res: NightResult) {
    super(flow);
    this.run = run;
    this.res = res;
    if (res.daily > 0) flow.meta.lastShare = shareCard(res);
  }

  protected buttons(): Btn[] {
    if (this.t < STAMP_AT + 0.3) return [];
    const r = this.res;
    const list: [string, string, Partial<Btn>?][] = [];
    if (r.daily > 0) {
      list.push(['copy', this.t - this.copiedAt < 1.5 ? 'Copied!' : 'Copy Card', { keys: ['KeyC'], icon: 'icon_star', tip: 'Copy your share card to the clipboard.' }]);
    } else if (r.crowned) {
      list.push(['end', 'Crown Him!', { keys: ['Enter', 'Space'], icon: 'icon_star' }]);
    } else if (r.fired) {
      list.push(['fired', 'Pink Slip', { keys: ['Enter', 'Space'], icon: 'icon_cross' }]);
    } else if (r.won) {
      list.push(['loot', 'Loot!', { keys: ['Enter', 'Space'], icon: 'icon_play', tip: 'A free Contraband pick, then the Swap Meet and the map.' }]);
    } else {
      list.push(['retry', 'Retry', { keys: ['Enter', 'Space', 'KeyR'], icon: 'icon_play', tip: `Play night ${r.night} again. You kept ${Math.round(LOST_KEEP * 100)}% of tonight's Shinies.` }]);
      list.push(['swap', 'Swap Meet', { keys: ['KeyS'], tip: 'Spend the bank first, then try again.' }]);
    }
    list.push(['title', 'Title', { keys: ['Escape'], sound: 'back' }]);
    return buttonRow(list, W / 2, 312, 112, 22);
  }

  protected press(id: string): void {
    if (id === 'copy') {
      copyText(shareCard(this.res));
      this.copiedAt = this.t;
      playRun('copy');
    } else if (id === 'end') this.flow.theEnd();
    else if (id === 'fired') this.flow.runOver();
    else if (id === 'loot') this.flow.loot();
    else if (id === 'retry') this.flow.clockIn(true);
    else if (id === 'swap') this.flow.swapMeet();
    else this.flow.title();
  }

  protected step(dt: number): void {
    // A strike: the Possum's stamp comes down with a bang (a pass already had its fanfare).
    const r = this.res;
    if (this.t >= STAMP_AT && this.t - dt < STAMP_AT && !r.won && r.daily === 0 && r.goal !== 'endless') playRun('strike');
  }

  protected paint(g: CanvasRenderingContext2D): void {
    // The lot as the night left it, under the paper.
    this.flow.play.draw(g);
    dim(g, Math.min(0.7, this.t * 1.6));
    const res = this.res;
    // The clipboard slides up from below.
    const k = Math.min(1, this.t / 0.4);
    const r = { ...BOARD_R, y: BOARD_R.y + Math.round((1 - k) * (1 - k) * (H - BOARD_R.y)) };
    const a = drawClipboard(g, r);
    const x = a.x + 6;

    // Inspector Possum, top right: keeled over at a pass, clipboard up at a shutdown.
    const pose = res.won ? 'dead' : 'shutdown';
    const px = r.x + r.w - 46;
    const py = a.y + 62;
    if (!drawSprite(g, `possum_${pose}`, px, py) && !drawSprite(g, 'possum_idle', px, py)) placeholderPossum(g, pose, px, py);

    // The title, kept clear of the possum: 2x if it fits, else a shorter one.
    const room = px - 28 - x;
    let head = `${res.label} REPORT`;
    if (textWidth(head) * 2 > room) head = res.label;
    bigText(g, head, x, a.y + 4, 2, { color: 'ink0' });
    drawText(g, res.boss ? `${res.name} · BOSS` : res.name, x, a.y + 28, { color: res.boss ? 'rust1' : 'ink1' });

    const lines =
      res.endReason === 'clockout'
        ? INSPECTOR.lines.clockout
        : res.endReason === 'stinkAfterQuota'
          ? INSPECTOR.lines.stinkAfterQuota
          : res.won
            ? INSPECTOR.lines.passed
            : INSPECTOR.lines.shutdown;
    const said = `"${lines[res.seed % lines.length] ?? ''}"`;
    const quote = wrapText(said, room).slice(0, 2);
    quote.forEach((l, i) => drawText(g, l, x, a.y + 42 + i * 10, { color: 'ink0' }));
    // Who said it (at 48 px he could be anybody).
    if (quote.length < 2) drawText(g, '- Inspector Possum', x + 8, a.y + 52, { color: 'ink1' });

    // Why it ended, and a line of what it means (the cause of a shutdown, the overtime...).
    const [why, more] = verdict(res, this.flow.play.state.time, this.flow.play.state.overtimeEarned);
    const good = res.won || res.goal === 'endless';
    drawText(g, why, x, a.y + 64, { color: good ? 'toxic0' : 'rust1' });
    wrapText(more, a.w - 12)
      .slice(0, 2)
      .forEach((l, i) => drawText(g, l, x, a.y + 75 + i * 10, { color: good ? 'ink1' : 'rust0' }));

    // The numbers.
    const st = res.stats;
    const best = res.bestTier > 0 ? ITEMS[junkAt(res.bestTier)].name : '-';
    const shinies = res.goal === 'quota' ? `${fmt(res.purse)} / ${fmt(res.quota)}` : fmt(res.purse);
    const left: [string, string][] = [
      [res.goal === 'endless' ? 'Score' : 'Shinies', shinies],
      ['Orders filled', String(st.ordersFilled)],
      ['Stormed off', String(st.ordersAngry)],
      // (Alchemy: brews ride along; tonight's first brews also show under NEW.)
      st.brews > 0 ? ['Merges · brews', `${st.merges} · ${st.brews}`] : ['Merges', String(st.merges)],
    ];
    const right: [string, string][] = [
      ['Best junk', best],
      ['Peak stink', `${Math.round(st.peakStink)}%`],
      ['Overflowed', String(st.overflows)],
      ['Crushed', String(st.compacted)],
    ];
    const y0 = a.y + 98;
    left.forEach(([l, v], i) => row(g, l, v, x, x + 132, y0 + i * 12, i === 0 && !res.won && res.goal === 'quota'));
    right.forEach(([l, v], i) => row(g, l, v, x + 144, a.x + a.w - 4, y0 + i * 12, i === 1 && st.peakStink >= 75));
    let y = y0 + 4 * 12 + 2;
    if (res.found.length > 0) {
      // New finds as the things themselves (their names get long), then "+N more".
      drawText(g, 'NEW:', x, y + 12, { color: 'toxic0' });
      res.found.slice(0, FOUND_MAX).forEach((id, i) => drawItem(g, id, x + 44 + i * 30, y + 31, { phase: i }));
      if (res.found.length > FOUND_MAX) drawText(g, `+${res.found.length - FOUND_MAX} more`, x + 36 + FOUND_MAX * 30, y + 12, { color: 'toxic0' });
      y += 34;
    }

    // The bank.
    fillLine(g, x, y, a.w - 12);
    y += 5;
    // (The King night pays in junk: what the raccoons kicked back, not "Banked +0".)
    if (res.daily > 0) {
      // The Daily Dump: the score and the share card.
      const best = this.flow.meta.daily[dateKey(new Date())] ?? res.purse;
      drawText(g, `DAILY #${res.daily} SCORE: ${fmt(res.purse)}`, x, y, { color: 'ink0' });
      drawText(g, sharePreview(res), x, y + 12, { color: 'ink1' });
      drawText(g, best > res.purse ? `Today's best: ${fmt(best)}` : 'One try a day. Same dump for everyone.', x, y + 24, { color: 'ink1' });
    } else {
      const banked =
        res.goal === 'king' && res.banked === 0
          ? `Gifts from the raccoons: ${res.stats.gifts}`
          : res.won
            ? `Banked +${fmt(res.banked)}`
            : `Kept half: +${fmt(res.banked)} of ${fmt(res.purse)}`;
      drawText(g, banked, x, y, { color: 'ink0' });
      drawText(g, `Bank: ${fmt(this.run.bank)}`, x, y + 12, { color: 'ink0' });
      if (!res.won) {
        const S = TUNING.run.strikes;
        const line = res.fired ? `STRIKE ${res.strikes} of ${S}. You're FIRED.` : `STRIKE ${res.strikes} of ${S}. Night ${res.night} stays: retry or shop.`;
        drawText(g, line, x, y + 24, { color: 'rust1' });
      } else if (res.bribed) {
        drawText(g, "The Possum Bribe bought a pass. It's spent.", x, y + 24, { color: 'toxic0' });
      }
    }

    drawStamp(g, res.won, a.x + a.w - 58, a.y + a.h - 28, this.t - STAMP_AT);
  }
}

/** "4:12 AM" from seconds after midnight. */
function at(sec: number | null): string {
  if (sec === null) return '?';
  const mins = Math.floor((sec / TUNING.shift.secondsPerHour) * 60);
  const h = Math.floor(mins / 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mins % 60).padStart(2, '0')} ${Math.floor(h / 12) % 2 === 0 ? 'AM' : 'PM'}`;
}

/** The headline for each way a night can end, and a line of detail under it (`ot`: overtime earned). */
function verdict(r: NightResult, endTime: number, ot: number): [string, string] {
  const st = r.stats;
  switch (r.endReason) {
    case 'clockout':
      return [
        'Clocked out, quota in. Lot 9 lives.',
        ot > 0
          ? `Quota met at ${at(r.quotaMetAt)}, out at ${at(endTime)}. Overtime banked at x1: +${fmt(ot)}.`
          : `Quota met at ${at(r.quotaMetAt)}, clocked out at ${at(endTime)}.`,
      ];
    case 'shift':
      return st.overtimeBonus > 0
        ? ['Worked till 6 AM: overtime DOUBLED!', `Quota met at ${at(r.quotaMetAt)}. Overtime +${fmt(ot)} x2 = +${fmt(ot + st.overtimeBonus)}.`]
        : ['Quota met. Lot 9 lives another night.', ''];
    case 'stinkAfterQuota':
      return st.overtimeLost > 0
        ? ['WHIFF! The Possum took the overtime.', `Quota met at ${at(r.quotaMetAt)}, so it's a pass. But the Stink maxed out: -${fmt(st.overtimeLost)} overtime, gone.`]
        : ['Possum caught a whiff, but you made quota.', `Quota met at ${at(r.quotaMetAt)}. A pass, no overtime.`];
    case 'king':
      return ['THE TRASH KING IS CROWNED.', `Built at ${at(endTime)}. The county will never smell the same.`];
    case 'endless':
      return ['The Stink won in the end. It always does.', `You lasted till ${at(endTime)}.`];
    case 'quota':
      if (r.goal === 'king') return ['No King by 6 AM.', 'Feed the raccoons small stuff: their gifts help build him.'];
      return ['Short of the quota at 6 AM.', `${fmt(Math.max(0, r.quota - r.purse))} Shinies short. Bigger junk pays more.`];
    default:
      return ['SHUT DOWN: the Stink hit the limit.', stinkCause(r)];
  }
}

/** One line on where the Stink came from (the biggest source), and what to do about it. */
function stinkCause(r: NightResult): string {
  const st = r.stats;
  const from = st.stinkFrom;
  const smelly = 'smelly' in from ? from.smelly : 0;
  const top = Math.max(from.overflow, from.angry, from.crowding, smelly);
  if (top <= 0) return '';
  if (top === smelly) return 'Junk sat too long and went smelly. Merge, sell or crush it before the flies find it.';
  if (top === from.overflow) {
    const n = st.overflows;
    return `The truck had nowhere to dump ${n} item${n === 1 ? '' : 's'}. Merge or crush to keep room.`;
  }
  if (top === from.angry) {
    const n = st.ordersAngry;
    return `${n} raccoon${n === 1 ? '' : 's'} stormed off. Feed the ones whose bars run red.`;
  }
  return `The lot was packed too long. Keep it under ${Math.round(TUNING.stink.creepAboveFill * 100)}% full.`;
}

function row(g: CanvasRenderingContext2D, label: string, value: string, x: number, right: number, y: number, bad: boolean): void {
  drawText(g, label, x, y, { color: bad ? 'rust1' : 'ink1' });
  drawText(g, value, right, y, { color: bad ? 'rust1' : 'ink0', align: 'right' });
}

function fillLine(g: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  for (let i = 0; i < w; i += 4) fillRect(g, { x: x + i, y, w: 2, h: 1 }, 'card2');
}
