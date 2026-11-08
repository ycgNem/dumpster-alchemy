// The game's palette: the one source of truth. pixel-art/pal.py reads this file with a regex,
// so keep every colour as `name: '#rrggbb',` on its own line.
// Ramps run dark to light; shadows lean violet, lights lean yellow (STYLE.md).

export const PAL = {
  ink0: '#1a1422',
  ink1: '#2a2033',
  ink2: '#3d2f45',

  night0: '#161a2e',
  night1: '#232c4a',
  night2: '#36466a',
  night3: '#56698e',

  sodium0: '#6b3a1f',
  sodium1: '#b8612a',
  sodium2: '#e8973a',
  sodium3: '#ffd27a',

  dirt0: '#2e2621',
  dirt1: '#463a30',
  dirt2: '#5f5042',
  dirt3: '#7c6a57',

  grime0: '#28301f',
  grime1: '#435034',
  grime2: '#69784a',
  grime3: '#9ba566',

  rust0: '#3f1c1c',
  rust1: '#6e2b26',
  rust2: '#a2432f',
  rust3: '#d0703f',

  steel0: '#3b4150',
  steel1: '#5c6577',
  steel2: '#8792a2',
  steel3: '#c3cbd4',

  fur0: '#2f2a2e',
  fur1: '#4f494c',
  fur2: '#7a7272',
  fur3: '#b2a9a1',
  fur4: '#d4cabc',

  card0: '#5a3d24',
  card1: '#8a6238',
  card2: '#b88d55',
  card3: '#dcb97e',

  toxic0: '#1f5a2a',
  toxic1: '#3da83a',
  toxic2: '#8ee04a',
  toxic3: '#e4ff7a',

  bone: '#efe6d2',
  white: '#fffaf0',
  red: '#d83a3a',
  yellow: '#f2c230',
  blue: '#4fa3d9',
  pink: '#e8798f',
  hivis: '#f26f2a',
} as const;

export type PalName = keyof typeof PAL;

export const RAMP = {
  ink: ['ink0', 'ink1', 'ink2'],
  night: ['night0', 'night1', 'night2', 'night3'],
  sodium: ['sodium0', 'sodium1', 'sodium2', 'sodium3'],
  dirt: ['dirt0', 'dirt1', 'dirt2', 'dirt3'],
  grime: ['grime0', 'grime1', 'grime2', 'grime3'],
  rust: ['rust0', 'rust1', 'rust2', 'rust3'],
  steel: ['steel0', 'steel1', 'steel2', 'steel3'],
  fur: ['fur0', 'fur1', 'fur2', 'fur3', 'fur4'],
  card: ['card0', 'card1', 'card2', 'card3'],
  toxic: ['toxic0', 'toxic1', 'toxic2', 'toxic3'],
} as const satisfies Record<string, readonly PalName[]>;
