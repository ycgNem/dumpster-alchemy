// The Daily Dump's share card: a Wordle-style line for the clipboard (no server), e.g.
//   Dumpster Alchemy Daily #12 · 🦝 48,120 · 👑 Fridge · 🧪 3 recipes · 🤢 63
// Day numbers count from TUNING.run.dailyEpoch (src/game/run.ts dailyNumber).
import { ITEMS, junkAt } from '../data/items';
import type { NightResult } from '../game/run';
import { fmt } from '../render/menus';

/** The share line for a finished Daily Dump. */
export function shareCard(res: NightResult): string {
  const best = res.bestTier > 0 ? ITEMS[junkAt(res.bestTier)].short : 'nothing';
  const crown = best.charAt(0).toUpperCase() + best.slice(1);
  const brews = res.stats.brews;
  return [
    `Dumpster Alchemy Daily #${res.daily}`,
    `🦝 ${fmt(res.purse)}`,
    `👑 ${crown}`,
    `🧪 ${brews} recipe${brews === 1 ? '' : 's'}`,
    `🤢 ${Math.round(res.stats.peakStink)}`,
  ].join(' · ');
}

/** The same card in words the marker font can draw (no emoji), for the report to show. */
export function sharePreview(res: NightResult): string {
  return shareCard(res)
    .replace('Dumpster Alchemy ', '')
    .replace('🦝 ', '')
    .replace('👑 ', 'best: ')
    .replace('🧪 ', '')
    .replace('🤢 ', 'stink ');
}

/** Put text on the clipboard: the Clipboard API, else the old textarea trick. Best effort. */
export function copyText(text: string): void {
  const fallback = (): void => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    } catch {
      // nothing more to try
    }
  };
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(fallback);
      return;
    }
  } catch {
    // fall through
  }
  fallback();
}
