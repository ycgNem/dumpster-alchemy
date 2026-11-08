// The regulars who place orders, and the Inspector (docs/DESIGN.md, "Raccoons and orders").
// In a line, "{item}" becomes the short name of the (biggest) thing the raccoon wants, filled in
// when the order is made (src/game/orders.ts), so Pete never asks for a car while wanting a toaster.

export interface RaccoonDef {
  id: string;
  name: string;
  /** For the artist: what makes them readable at 48 x 48. */
  look: string;
  /** Multiplies the order's patience. */
  patienceMul: number;
  /** Multiplies the order's payout. */
  payMul: number;
  /** Added to the tier they ask for (Linda asks high, Gary asks what's around). */
  tierBias: number;
  /** Most items one order asks for (Pete only ever wants one big thing). */
  maxWants: number;
  /** `jackpot`: what they say when they're the night's big order. */
  lines: { arrive: string[]; happy: string[]; angry: string[]; jackpot: string[] };
}

export const RACCOONS: readonly RaccoonDef[] = [
  {
    id: 'gary',
    name: 'Gary',
    look: 'stocky, yellow hard hat, hi-vis vest, scowl',
    patienceMul: 0.75,
    payMul: 1,
    tierBias: 0,
    maxWants: 2,
    lines: {
      arrive: ['Need it NOW.', 'Clock is ticking, pal.', 'Chop chop.', 'One {item}. Now.'],
      happy: ['Finally.', "That'll do.", 'Hm. Good.'],
      angry: ['FORGET IT.', "I'm telling Linda.", 'Unbelievable.'],
      jackpot: ['Big job: one {item}.', 'Boss wants a {item}. Pronto.'],
    },
  },
  {
    id: 'linda',
    name: 'Linda',
    look: 'slim, cat-eye glasses on a chain, pearl necklace made of bottle caps',
    patienceMul: 1,
    payMul: 1.4,
    tierBias: 1,
    maxWants: 2,
    lines: {
      arrive: ['Only the finest refuse, dear.', 'Something with character.', 'Surprise me. Tastefully.'],
      happy: ['Exquisite.', 'Oh, it reeks. Perfect.', 'You have an eye.'],
      angry: ['How common.', 'I have never been so insulted.', 'Ugh. Peasant trash.'],
      jackpot: ['A {item}, darling. I pay well.', 'For the gala: one {item}.'],
    },
  },
  {
    id: 'pete',
    name: "Lil' Pete",
    look: 'tiny, oversized backwards cap, huge eyes, holding a bottle cap like a shield',
    patienceMul: 1.4,
    payMul: 1,
    tierBias: 2,
    maxWants: 1,
    lines: {
      arrive: ['I want the BIG one.', 'Can I have a {item}?', 'A {item}! A {item}!'],
      happy: ['WHOA.', "It's HUGE.", 'Best day ever.'],
      angry: ['*sniff*', "I'm telling my mom.", 'You said BIG.'],
      jackpot: ['I saved up for a {item}!', 'A {item}! A REAL one!'],
    },
  },
  {
    id: 'mange',
    name: 'Grandma Mange',
    look: 'hunched, knitted shawl, missing patch of fur, tiny reading glasses, a cane',
    patienceMul: 1.2,
    payMul: 1.6,
    tierBias: 0,
    maxWants: 2,
    lines: {
      arrive: ['Take your time, sweetie.', "Back in my day we ate the bag.", 'Ooh, what have you got?'],
      happy: ['Here, have a little extra.', 'Such a good junk.', 'You remind me of my late husband.'],
      angry: ['Well. I never.', "I'm too old for this.", 'Your mother would be ashamed.'],
      jackpot: ['A {item} for Grandpa, sweetie.', 'Grandma needs a {item}.'],
    },
  },
];

export const INSPECTOR = {
  name: 'Inspector Possum',
  look: 'grey possum in a hazmat suit, hood DOWN: white pointed face, pink snout, bare pink ears, pink rat tail; clipboard, tiny badge',
  lines: {
    shutdown: ['This lot is a health hazard.', 'Shut it down. All of it.', "I've seen enough."],
    passed: ['*plays dead*', '*keels over, satisfied*', '*plays dead. Very convincingly.*', '*faints onto the clipboard*'],
    /** The Stink maxed after the quota was met: a pass, barely. */
    stinkAfterQuota: ['*gags* ...Fine. You made quota.', '*holds nose, stamps it anyway*'],
    /** The player clocked out early. */
    clockout: ['*plays dead until you leave*', 'Early night? *keels over*'],
  },
} as const;
