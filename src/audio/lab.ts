// The audio lab (audio-lab.html, dev only): a button for every sound and song, an intensity
// slider, and "Measure": every sound rendered offline through the real master chain, with its
// length, peak and loudness checked against the median merge. Results also land on
// window.__audioLab for scripts.
import type { GameEvent } from '../game/events';
import { JUNK_CHAIN, type ItemId } from '../data/items';
import { RACCOONS } from '../data/raccoons';
import { initAudio, isMuted, playEvent, playUi, setIntensity, setMusic, setMuted } from './index';
import { MIX, buildChain } from './engine';
import { renderSong, type TrackId } from './music';
import { eventSound, remember, startSound, uiSound, type Sound } from './sfx';
import { seedRandom } from './synth';

type UiKind = 'hover' | 'click' | 'back';

interface Case {
  group: string;
  label: string;
  ev?: GameEvent;
  /** Several events at once (the stress test). */
  evs?: GameEvent[];
  ui?: UiKind;
  /** [song, intensity, solo layer]. */
  song?: readonly [TrackId, number, number?];
  /** Part of the loudness reference (plain junk merges). */
  ref?: boolean;
  /** Meant to be soft (hover ticks, music beds). */
  quietOk?: boolean;
  /** Excluded from the loudness rule (music, the stress test). */
  noLoudness?: boolean;
  secs?: number;
  setup?: () => void;
}

const cases: Case[] = [];
const add = (group: string, label: string, ev: GameEvent, extra: Partial<Case> = {}): void => {
  cases.push({ group, label, ev, ...extra });
};

// merges
JUNK_CHAIN.slice(1).forEach((id, i) => {
  add('merge', `t${i + 2} ${id}`, { type: 'merge', from: JUNK_CHAIN[i], to: id, chain: 'junk', tier: i + 2, c: 4, r: 3, first: false }, { ref: true });
});
add('merge', 't4 bag, first!', { type: 'merge', from: 'takeout', to: 'bag', chain: 'junk', tier: 4, c: 4, r: 3, first: true });
add('merge', 't12 KING, first!', { type: 'merge', from: 'car', to: 'king', chain: 'junk', tier: 12, c: 4, r: 3, first: true }, { secs: 3 });
const gulls: ItemId[] = ['gull', 'fatgull', 'gullgang', 'gullboss', 'gullgod'];
gulls.slice(1).forEach((id, i) => {
  add('merge', `gull g${i + 2} ${id}`, { type: 'merge', from: gulls[i], to: id, chain: 'gull', tier: i + 2, c: 2, r: 3, first: false });
});

// arriving junk
add('spawn', 'dumpster cap', { type: 'spawn', id: 'cap', c: 8, r: 3, from: 'dumpster' });
add('spawn', 'dumpster takeout', { type: 'spawn', id: 'takeout', c: 8, r: 3, from: 'dumpster' });
add('spawn', 'truck toss', { type: 'spawn', id: 'can', c: 3, r: 0, from: 'truck' });
add('spawn', 'kick boot', { type: 'spawn', id: 'boot', c: 7, r: 2, from: 'kick' });
add('spawn', 'egg drop', { type: 'spawn', id: 'golden_egg', c: 5, r: 2, from: 'egg' });
const landIds: ItemId[] = [...JUNK_CHAIN, 'gull', 'golden_egg', 'bin_juice'];
for (const id of landIds) add('land', id, { type: 'land', id, c: 4, r: 3 });
// the weight a landing gets from where the piece was launched
const from = (src: 'dumpster' | 'truck' | 'kick' | 'egg', id: ItemId) => (): void => remember({ type: 'spawn', id, c: 6, r: 1, from: src });
add('land', 'cap from dumpster', { type: 'land', id: 'cap', c: 6, r: 1 }, { setup: from('dumpster', 'cap') });
add('land', 'takeout off truck', { type: 'land', id: 'takeout', c: 6, r: 1 }, { setup: from('truck', 'takeout') });
add('land', 'egg from the sky', { type: 'land', id: 'golden_egg', c: 6, r: 1 }, { setup: from('egg', 'golden_egg') });

// hands
add('hands', 'pickup cap', { type: 'pickup', id: 'cap', c: 4, r: 3 });
add('hands', 'pickup fridge', { type: 'pickup', id: 'fridge', c: 4, r: 3 });
add('hands', 'pickup gull', { type: 'pickup', id: 'gull', c: 4, r: 3 });
add('hands', 'move can', { type: 'move', id: 'can', c: 4, r: 3 });
add('hands', 'move mattress', { type: 'move', id: 'mattress', c: 4, r: 3 });
add('hands', 'swap', { type: 'swap', c: 3, r: 3, c2: 4, r2: 3 });
add('hands', 'invalid', { type: 'invalid', c: 4, r: 3 });
add('hands', 'compact cap', { type: 'compact', id: 'cap' });
add('hands', 'compact car', { type: 'compact', id: 'car' });

// dumpster and truck
add('lot', 'dumpster ok', { type: 'dumpsterClick', ok: true });
add('lot', 'dumpster stuck', { type: 'dumpsterClick', ok: false });
add('lot', 'truckArrive', { type: 'truckArrive' });
add('lot', 'truckDump 2', { type: 'truckDump', count: 2 });
add('lot', 'truckDump 5', { type: 'truckDump', count: 5 });
add('lot', 'truckLeave', { type: 'truckLeave' });
add('lot', 'overflow', { type: 'overflow', id: 'bag' });
add('lot', 'stinkWarn', { type: 'stinkWarn' });

// raccoons
for (const r of RACCOONS) {
  const arrive = (): void => remember({ type: 'orderArrive', slot: 0, raccoon: r.id });
  add('raccoons', `${r.id} arrive`, { type: 'orderArrive', slot: 0, raccoon: r.id });
  add('raccoons', `${r.id} complete`, { type: 'deliver', slot: 0, id: 'boot', complete: true, shinies: 40 }, { setup: arrive });
  add('raccoons', `${r.id} angry`, { type: 'orderAngry', slot: 0, raccoon: r.id });
}
add('raccoons', 'deliver part', { type: 'deliver', slot: 1, id: 'can', complete: false, shinies: 6 });
add('raccoons', 'deliver gull', { type: 'deliver', slot: 1, id: 'fatgull', complete: false, shinies: 15 });

// gulls
add('gulls', 'gullArrive', { type: 'gullArrive', c: 2, r: 2 });
add('gulls', 'gullHop', { type: 'gullHop', c: 2, r: 2, toC: 3, toR: 2 });
add('gulls', 'gullEat', { type: 'gullEat', id: 'can', c: 3, r: 2 });
add('gulls', 'gullScream', { type: 'gullScream', c: 5, r: 4 });
add('gulls', 'gullPeck', { type: 'gullPeck', shinies: 1 });
add('gulls', 'gullGod', { type: 'gullGod', c: 4, r: 3 });
add('gulls', 'egg', { type: 'egg', c: 4, r: 3, from: 'boot', to: 'tire' });

// the night and menus
add('night', 'hour 1', { type: 'hour', hour: 1 });
add('night', 'hour 6', { type: 'hour', hour: 6 });
add('night', 'nightWon', { type: 'nightWon' });
add('night', 'nightLost', { type: 'nightLost' });
add('menu', 'uiClick', { type: 'uiClick' });
add('menu', 'buy', { type: 'buy', upgrade: 'lid' });
for (const ui of ['hover', 'click', 'back'] as const) cases.push({ group: 'menu', label: `ui ${ui}`, ui, quietOk: ui === 'hover' });

// music (rendered, not part of the loudness rule)
const songs: [TrackId, number][] = [
  ['title', 0],
  ['night', 0],
  ['night', 0.3],
  ['night', 0.55],
  ['night', 0.75],
  ['night', 1],
  ['report', 0],
];
for (const s of songs) cases.push({ group: 'music', label: `${s[0]} @${s[1]}`, song: s, secs: 12, quietOk: true, noLoudness: true });
['base', 'hats', 'bass', 'beat', 'organ', 'panic'].forEach((name, i) => {
  cases.push({ group: 'layers', label: `night solo ${name}`, song: ['night', 1, i], secs: 12, quietOk: true, noLoudness: true });
});

// everything at once
cases.push({
  group: 'stress',
  label: 'pile-up',
  noLoudness: true,
  secs: 4,
  evs: [
    ...[6, 8, 9, 10, 11, 12].map(
      (t): GameEvent => ({ type: 'merge', from: JUNK_CHAIN[t - 2], to: JUNK_CHAIN[t - 1], chain: 'junk', tier: t, c: t % 9, r: 3, first: t === 12 }),
    ),
    { type: 'truckDump', count: 5 },
    { type: 'gullGod', c: 4, r: 3 },
    { type: 'overflow', id: 'bag' },
    { type: 'nightWon' },
    { type: 'gullScream', c: 2, r: 2 },
  ],
});

// ------------------------------------------------------------------------------ measuring

interface Result {
  group: string;
  label: string;
  dur: number;
  peak: number;
  rawPeak: number;
  rms: number;
  st: number;
  /** Zero-crossing brightness, Hz. */
  zcr: number;
  /** Autocorrelation pitch of the loudest 50 ms, Hz (0 = unpitched). */
  f0: number;
  ratio: number;
  status: 'ok' | 'quiet' | 'SILENT' | 'CLIP' | 'LOUD';
  ms: number;
  env: number[];
}

const SR = 44100;

function soundsOf(c: Case): Sound[] {
  if (c.ui) return [uiSound(c.ui)];
  const evs = c.evs ?? (c.ev ? [c.ev] : []);
  return evs.map((e) => eventSound(e)).filter((s): s is Sound => s !== null);
}

/** Renders a case; `raw` skips the master chain (to see how hard the limiter works). */
async function render(c: Case, idx: number, raw: boolean): Promise<AudioBuffer> {
  const secs = c.secs ?? 4;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * secs), SR);
  seedRandom(1000 + idx);
  c.setup?.();
  let sfx: AudioNode;
  let music: AudioNode;
  if (raw) {
    const g = ctx.createGain();
    g.gain.value = MIX.sfx;
    g.connect(ctx.destination);
    sfx = g;
    music = g;
  } else {
    const chain = buildChain(ctx);
    sfx = chain.sfx;
    music = chain.music;
  }
  if (c.song) renderSong(ctx, music, c.song[0], c.song[1], secs - 0.3, c.song[2]);
  for (const s of soundsOf(c)) startSound({ ctx, dest: sfx, t: 0.05 }, s);
  return ctx.startRendering();
}

function stats(buf: AudioBuffer): Omit<Result, 'group' | 'label' | 'rawPeak' | 'ratio' | 'status' | 'ms'> {
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const n = L.length;
  const thr = 0.00316; // -50 dBFS
  let peak = 0;
  let first = -1;
  let last = -1;
  for (let i = 0; i < n; i++) {
    const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (a > peak) peak = a;
    if (a > thr) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return { dur: 0, peak, rms: 0, st: 0, zcr: 0, f0: 0, env: [] };
  let sum = 0;
  for (let i = first; i <= last; i++) sum += L[i] * L[i] + R[i] * R[i];
  const rms = Math.sqrt(sum / (2 * (last - first + 1)));
  // loudest 50 ms window
  const win = Math.round(0.05 * buf.sampleRate);
  const hop = Math.round(0.01 * buf.sampleRate);
  let st = 0;
  let loudAt = first;
  for (let s = first; s + win <= Math.max(last, first + win); s += hop) {
    let ws = 0;
    for (let i = s; i < s + win && i < n; i++) ws += L[i] * L[i] + R[i] * R[i];
    const r = Math.sqrt(ws / (2 * win));
    if (r > st) {
      st = r;
      loudAt = s;
    }
  }
  // brightness: zero crossings of the mono mix over the active part
  let crossings = 0;
  for (let i = first + 1; i <= last; i++) if ((L[i] + R[i] >= 0) !== (L[i - 1] + R[i - 1] >= 0)) crossings++;
  const zcr = (crossings / 2) * (buf.sampleRate / Math.max(1, last - first));
  const f0 = pitchOf(L, R, loudAt, win, buf.sampleRate);
  // a coarse envelope for the little waveform
  const env: number[] = [];
  const cols = 120;
  const span = Math.max(1, Math.ceil(n / cols));
  for (let c = 0; c < cols; c++) {
    let m = 0;
    for (let i = c * span; i < Math.min(n, (c + 1) * span); i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i]));
    env.push(m);
  }
  return { dur: (last - first + 1) / buf.sampleRate, peak, rms, st, zcr, f0, env };
}

/** Normalised autocorrelation pitch of a window, 60-1200 Hz; 0 when nothing periodic stands out. */
function pitchOf(L: Float32Array, R: Float32Array, at: number, win: number, sr: number): number {
  const n = Math.min(win * 2, L.length - at);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = L[at + i] + R[at + i];
  const minLag = Math.floor(sr / 1200);
  const maxLag = Math.min(Math.floor(sr / 60), n >> 1);
  let best = 0;
  let bestLag = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let num = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i + lag < n; i++) {
      num += x[i] * x[i + lag];
      e1 += x[i] * x[i];
      e2 += x[i + lag] * x[i + lag];
    }
    const c = num / Math.sqrt(e1 * e2 + 1e-12);
    if (c > best + 0.01) {
      best = c;
      bestLag = lag;
    }
  }
  return best > 0.6 && bestLag > minLag ? sr / bestLag : 0;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

interface LabGlobal {
  running: boolean;
  done: boolean;
  results: Result[];
  medianMerge: { rms: number; st: number };
  failures: Result[];
  warnings: Result[];
  totalMs: number;
}
const api = { initAudio, playEvent, playUi, setMusic, setIntensity, setMuted, isMuted };
declare global {
  interface Window {
    __audioLab?: LabGlobal;
    /** The page's own instance of the public API, for console poking. */
    __audio?: typeof api;
  }
}
window.__audio = api;

async function measureAll(onProgress: (i: number) => void): Promise<LabGlobal> {
  const lab: LabGlobal = { running: true, done: false, results: [], medianMerge: { rms: 0, st: 0 }, failures: [], warnings: [], totalMs: 0 };
  window.__audioLab = lab;
  const t0 = performance.now();
  const partial: Result[] = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const s0 = performance.now();
    const buf = await render(c, i, false);
    const ms = performance.now() - s0;
    const raw = c.song ? null : await render(c, i, true);
    const st = stats(buf);
    partial.push({ group: c.group, label: c.label, ...st, rawPeak: raw ? stats(raw).peak : NaN, ratio: 0, status: 'ok', ms });
    onProgress(i + 1);
  }
  const refs = partial.filter((_r, i) => cases[i].ref);
  const medRms = median(refs.map((r) => r.rms));
  const medSt = median(refs.map((r) => r.st));
  partial.forEach((r, i) => {
    const c = cases[i];
    r.ratio = medRms > 0 ? r.rms / medRms : 0;
    if (r.peak < 0.02 || r.rms < 0.003) r.status = 'SILENT';
    else if (r.peak >= 0.95) r.status = 'CLIP';
    else if (!c.noLoudness && (r.rms > 2 * medRms || r.st > 2 * medSt)) r.status = 'LOUD';
    else if (!c.quietOk && r.rms < 0.4 * medRms && r.st < 0.4 * medSt) r.status = 'quiet';
  });
  lab.results = partial;
  lab.medianMerge = { rms: medRms, st: medSt };
  lab.failures = partial.filter((r) => r.status === 'SILENT' || r.status === 'CLIP' || r.status === 'LOUD');
  lab.warnings = partial.filter((r) => r.status === 'quiet');
  lab.totalMs = performance.now() - t0;
  lab.running = false;
  lab.done = true;
  return lab;
}

// ------------------------------------------------------------------------------ the page

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const k of kids) e.append(k);
  return e;
}

const app = document.getElementById('app');
if (!app) throw new Error('#app missing');

app.append(
  el('h1', {}, 'Dumpster Alchemy · audio lab'),
  el('p', {}, 'Every sound is synthesised. Click anything to hear it (the first click starts the audio). "Measure" renders everything offline through the master chain.'),
);

// music controls
const musicBox = el('section');
const trackBtns = new Map<string, HTMLButtonElement>();
const setTrackUi = (id: string): void => trackBtns.forEach((b, k) => b.classList.toggle('on', k === id));
const musicRow = el('div', { className: 'row' }, el('span', { className: 'group' }, 'music'));
for (const id of ['title', 'night', 'report'] as const) {
  const b = el('button', { textContent: id });
  b.onclick = () => {
    initAudio();
    setMusic(id);
    setTrackUi(id);
  };
  trackBtns.set(id, b);
  musicRow.append(b);
}
const stopBtn = el('button', { textContent: 'stop' });
stopBtn.onclick = () => {
  setMusic(null);
  setTrackUi('');
};
musicRow.append(stopBtn);
const slider = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '0' });
const sliderVal = el('span', {}, '0.00');
slider.oninput = () => {
  const x = Number(slider.value);
  sliderVal.textContent = x.toFixed(2);
  setIntensity(x);
};
const muteBtn = el('button', { textContent: 'mute' });
muteBtn.onclick = () => {
  setMuted(!isMuted());
  muteBtn.classList.toggle('on', isMuted());
};
musicBox.append(
  musicRow,
  el('div', { className: 'row' }, el('span', { className: 'group' }, 'intensity'), slider, sliderVal, muteBtn),
  el('p', {}, 'night layers: 0 plucks+pad+kick · 0.08 hats · 0.28 bass · 0.45 backbeat · 0.62 nervous organ · 0.86 panic; tempo 96→112 above 0.5'),
);
app.append(musicBox);

// sound buttons
const sfxBox = el('section');
const groups = new Map<string, HTMLDivElement>();
cases.forEach((c) => {
  if (c.song) return;
  let row = groups.get(c.group);
  if (!row) {
    row = el('div', { className: 'row' }, el('span', { className: 'group' }, c.group));
    groups.set(c.group, row);
    sfxBox.append(row);
  }
  const b = el('button', { textContent: c.label });
  b.onclick = () => {
    initAudio();
    c.setup?.();
    if (c.ui) playUi(c.ui);
    for (const e of c.evs ?? (c.ev ? [c.ev] : [])) playEvent(e);
  };
  row.append(b);
});
app.append(sfxBox);

// measurements
const measureBox = el('section');
const measureBtn = el('button', { textContent: 'Measure everything' });
const status = el('span', { id: 'status' });
const summary = el('p');
const tableWrap = el('div', { className: 'scroll' });
measureBox.append(el('div', { className: 'row' }, measureBtn, status), summary, tableWrap);
app.append(measureBox);

function fmt(x: number, d = 3): string {
  return Number.isFinite(x) ? x.toFixed(d) : '–';
}

function drawEnv(env: number[]): HTMLCanvasElement {
  const cv = el('canvas', { className: 'wave', width: 120, height: 22 });
  const g = cv.getContext('2d');
  if (g) {
    g.fillStyle = '#c8a46a';
    env.forEach((m, i) => {
      const h = Math.max(1, Math.round(m * 22));
      g.fillRect(i, 11 - h / 2, 1, h);
    });
  }
  return cv;
}

function showResults(lab: LabGlobal): void {
  const head = el('tr');
  for (const h of ['group', 'sound', 'dur s', 'peak', 'raw peak', 'rms', 'loudest 50ms', '× median merge', 'bright Hz', 'pitch Hz', 'status', 'render ms', 'shape']) head.append(el('th', {}, h));
  const table = el('table', {}, head);
  for (const r of lab.results) {
    const cls = r.status === 'ok' ? 'ok' : r.status === 'quiet' ? 'warn' : 'bad';
    const tr = el('tr');
    tr.append(
      el('td', {}, r.group),
      el('td', {}, r.label),
      el('td', { className: 'num' }, fmt(r.dur, 2)),
      el('td', { className: 'num' }, fmt(r.peak)),
      el('td', { className: 'num' }, fmt(r.rawPeak)),
      el('td', { className: 'num' }, fmt(r.rms, 4)),
      el('td', { className: 'num' }, fmt(r.st, 4)),
      el('td', { className: 'num' }, fmt(r.ratio, 2)),
      el('td', { className: 'num' }, fmt(r.zcr, 0)),
      el('td', { className: 'num' }, r.f0 ? fmt(r.f0, 0) : '–'),
      el('td', { className: cls }, r.status),
      el('td', { className: 'num' }, fmt(r.ms, 0)),
    );
    const td = el('td');
    td.append(drawEnv(r.env));
    tr.append(td);
    table.append(tr);
  }
  tableWrap.replaceChildren(table);
  summary.textContent =
    `${lab.results.length} renders in ${(lab.totalMs / 1000).toFixed(1)} s · median merge rms ${fmt(lab.medianMerge.rms, 4)}, ` +
    `loudest-50ms ${fmt(lab.medianMerge.st, 4)} · ${lab.failures.length} failing, ${lab.warnings.length} quiet`;
}

async function runMeasure(): Promise<void> {
  if (window.__audioLab?.running) return;
  measureBtn.disabled = true;
  const lab = await measureAll((i) => {
    status.textContent = `rendering ${i}/${cases.length}…`;
  });
  status.textContent = lab.failures.length ? `${lab.failures.length} FAILING` : 'all pass';
  showResults(lab);
  measureBtn.disabled = false;
}

measureBtn.onclick = () => void runMeasure();
if (new URLSearchParams(location.search).has('measure')) void runMeasure();
