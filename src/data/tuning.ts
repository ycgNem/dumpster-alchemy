// Every game number lives here (docs/DESIGN.md explains what each one is for).
// Tune here, not in the systems. `npm run sim` plays nights headless with a bot to check them.

export const TUNING = {
  board: { cols: 9, rows: 7 },

  dumpster: {
    charges: 6,
    refillSec: 5,
    /** Chance of junk tier 1, 2, 3 per click. */
    tierOdds: [0.7, 0.25, 0.05],
    /** Seconds a piece spends in the air from the Dumpster to its cell. */
    flightSec: 0.35,
  },

  truck: {
    firstDumpSec: 6,
    /**
     * Seconds between dumps at midnight; shrinks to intervalMinSec by 6 AM. The 6 AM pace (about
     * one item a second before the night's mods) is capped near what a person can clear; it was
     * 6-11 items every 6 s before M7, which no human could keep up with.
     */
    intervalSec: 10,
    intervalMinSec: 7,
    /** Items per dump: a [min, max] range at midnight, sliding to the second range by 6 AM. */
    loadStart: [4, 7],
    loadEnd: [5, 7],
    /** Chance of junk tier 1, 2, 3 per item the truck drops. */
    tierOdds: [0.6, 0.3, 0.1],
    driveInSec: 2.2,
    dumpSec: 1.2,
    driveOffSec: 1.6,
    /** Seconds each item spends arcing from the truck bed to its cell. */
    flightSec: 0.7,
    /** Garbage Day's second truck runs this share of a gap behind the first. */
    secondTruckLag: 0.5,
  },

  orders: {
    slots: 3,
    /** When each slot's first raccoon walks up, in seconds after midnight. */
    firstArriveSec: [3, 12, 24],
    /** Seconds an empty slot waits for the next raccoon. */
    gapMinSec: 4,
    gapMaxSec: 9,
    patienceMinSec: 60,
    patienceMaxSec: 90,
    /** Chance an order wants two items instead of one. */
    twoItemChance: 0.3,
    /** A two-item order gets this much more patience. */
    twoItemPatienceMul: 1.4,
    /** With nothing on the lot yet, orders ask for tiers minTier..startReach. */
    startReach: 3,
    /** Regular orders never ask for less than this (caps go to scrap orders). */
    minTier: 2,
    /**
     * Orders follow the lot (src/game/orders.ts `tierWeights`): each tier you hold weighs its
     * count (up to `heldCap`), a pair weighs `pairWeight` for the tier it merges into, and one
     * tier above the top of the lot weighs `stretchWeight`. A raccoon's tierBias is extra draws
     * (it keeps the biggest). Wants already promised to other orders don't count.
     */
    board: { heldCap: 3, pairWeight: 0.7, stretchWeight: 0.6 },
    /** Night 1's first order: one of these (a can: make it from two caps, or click for one). */
    firstOrder: 'can',
    /**
     * The scrap order: someone wants several tier 1-2 pieces, so small junk always has
     * somewhere to go. Chance per arrival rises with the small junk on the lot. Never two at once.
     */
    scrap: {
      chance: 0.12,
      /** Extra chance per tier 1-2 piece on the lot above `freeSmall`... */
      perSmall: 0.03,
      freeSmall: 4,
      maxChance: 0.55,
      /** How many pieces it wants (at most two kinds), its pay per piece (x value) and patience. */
      minPieces: 3,
      maxPieces: 5,
      payMul: 2,
      patienceMul: 1.4,
      maxTier: 2,
    },
    /** Junk an angry raccoon kicks out of the Dumpster. */
    angryKickJunk: 3,
    /** Seconds a kicked piece is in the air. */
    kickFlightSec: 0.5,
    /** Filling an order with all its patience left adds this share of its value (less as it runs down). */
    patienceBonus: 0.5,
    /** Seconds a happy or angry raccoon hangs around before the slot frees up. */
    leaveSec: 1.6,
    /**
     * The Extra Raccoon's slot (the 4th) is for big spenders: one item from the best tier up to
     * one above, more patience, better pay. (Small orders there would only split up the junk.)
     */
    bigSpender: { fromSlot: 3, patienceMul: 1.5, payMul: 1.25 },
  },

  stink: {
    max: 100,
    perOverflowItem: 5,
    perAngryRaccoon: 8,
    /**
     * Junk ripens: a piece left unmerged this long goes smelly (shorter for bigger junk, never
     * under ripenMinSec; the night's ripenMul scales it). A merge makes a fresh piece.
     */
    ripenSec: 30,
    ripenPerTierSec: 1.5,
    ripenMinSec: 18,
    /** Each smelly piece adds this much Stink per second, plus smellPerTier for each tier above 1 (up to smellTierCap). */
    smellPerSec: 0.035,
    smellPerTier: 0.008,
    smellTierCap: 7,
    decayPerSec: 0.2,
    /** Stink only decays while less than this fraction of the board is filled... */
    decayBelowFill: 0.7,
    /** ...and decays this many times faster while under this fraction. */
    fastDecayBelowFill: 0.4,
    fastDecayMul: 1,
    /** A crowded lot stinks too (gently): Stink creeps up while the board is fuller than this... */
    creepAboveFill: 0.75,
    /** ...by this much per second at that fill, rising to creepPerSecFull on a full board. */
    creepPerSec: 0.2,
    creepPerSecFull: 1.0,
    /** The stinkWarn event fires when Stink climbs past this... */
    warnAt: 75,
    /** ...and can fire again once it has dropped below this. */
    warnRearm: 65,
  },

  gulls: {
    chancePerMerge: 0.04,
    hopSecG1: 6,
    hopSecG2: 8,
    gangScreamSec: 10,
    bossPeckSec: 4,
    /** Highest junk tier each hopping gull will eat. */
    eatsUpToG1: 3,
    eatsUpToG2: 5,
    goldenEggTiers: 2,
    /** Every hop, scream or peck waits its time x (1 ± jitter). */
    jitter: 0.25,
    /** Shinies the Gull Boss pecks out of the purse each time (never below 0). */
    bossPeckShinies: 2,
    /** Seconds a new gull swoops in for; seconds the Golden Egg takes to come down after the God. */
    arriveSec: 0.9,
    eggDropSec: 1.7,
    /** Once a gull has shown up tonight: chance a new order wants one (Gary always a Fat Gull). */
    orderChance: 0.06,
    orderChanceGary: 0.15,
    /** Chance anyone but Gary asks for a Fat Gull rather than a Seagull. */
    orderFatChance: 0.25,
  },

  compactor: { cooldownSec: 8 },

  shift: {
    secondsPerHour: 60,
    hours: 6,
    nights: 10,
    /** Shinies needed by 6 AM on night 1 (M6 moves quotas into a night table). */
    quotaNight1: 1250,
    /**
     * Overtime: reach 6 AM after the quota and everything earned past it is paid again by this
     * share (1: x2 in all). Clock out: x1. The Stink maxes after the quota: the overtime is lost.
     */
    overtimeShare: 1,
  },

  /** Each night's one big order (src/game/orders.ts): a long timer, good pay, a bonus not a must. */
  jackpot: {
    /** The jackpot raccoon walks up at a random time in this window (seconds after midnight)... */
    earliestSec: 60,
    latestSec: 250,
    /** ...once the best junk tonight is at least this far below what it asks for. */
    reachBelow: 2,
    /** It asks for one tier above the best tonight, within the night's `jackpotTiers` (this by default). */
    tiers: [6, 7] as readonly [number, number],
    patienceSec: 150,
    /** Pays value x this (on top of the raccoon's payMul and the patience bonus)... */
    payMul: 1,
    /** ...but never more than this share of the night's quota in all. */
    maxQuotaShare: 0.28,
  },

  /** Night 10 (the King): orders stay small and each filled one kicks back junk for the build. */
  king: {
    maxOrderTier: 5,
    /** A filled order pays no Shinies; it kicks junk this many tiers above its best item onto the lot... */
    giftTiers: 1,
    /** ...this often (the rest of the time the raccoon just leaves happy). */
    giftChance: 0.75,
    /** Each failed try at the King night cuts its Stink gains by this much (down to retryEaseMin). */
    retryEasePerTry: 0.1,
    retryEaseMin: 0.6,
  },

  /** Endless (src/data/nights.ts ENDLESS): a gentler ramp that keeps going, and hourly milestones. */
  endless: {
    /** The truck reaches its 6 AM pace after this many nights' worth of time (1.25: at 7:30 AM)... */
    rampStretch: 1.25,
    /** ...then every hour after that it comes this much sooner (down to minIntervalMul)... */
    perHourMul: 0.9,
    minIntervalMul: 0.5,
    /** ...and brings this many more items per load. */
    loadPerHour: 0.75,
    /** Every hour on the clock pays this many Shinies x the hour (1 AM: 1x, 7 AM: 7x...). */
    milestonePerHour: 40,
    /** A jackpot raccoon comes this often (after the first). */
    jackpotEverySec: 120,
  },

  /** Junk value in Shinies: base * growth^(tier - 1), whole numbers under 100, else 2 significant figures. */
  value: { base: 1.5, growth: 2.4 },

  /** How things move on screen (render only; no game rules here). */
  feel: {
    /** Pixels a piece bobs while idle. */
    wobblePx: 1,
    /** Seconds a landing squash lasts (merges and eggs: 1.5x). Its size is whole pixels (view.ts). */
    squashSec: 0.22,
    /** Peak height of each kind of arc, in pixels above the straight line. */
    arcPxTruck: 56,
    arcPxDumpster: 30,
    arcPxKick: 44,
    /** The dragged piece floats this far above the pointer (the paw peeks out under it). */
    dragLiftPx: 12,
    /** On touch it floats this far up instead, just clear of the finger. */
    touchLiftPx: 16,
    /** Seconds a dropped piece takes to snap back, or to slide over in a swap. */
    slideSec: 0.12,
    orderSlideSec: 0.3,
    /** Seconds between raccoon blinks (roughly), and how long a blink lasts. */
    blinkEverySec: 3.5,
    blinkSec: 0.14,
  },
} as const;
