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
    /**
     * v2: the truck's pace ramps from this hour (1 AM) to its peak at rampFullHour, then holds; the
     * first hour stays gentle. (Pressure 0 -> 1 in src/game/loads.ts `truckPressure`.)
     */
    rampFromHour: 1,
    rampFullHour: 6,
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
    bossPeckShinies: 20,
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
    /** v2: about 3.5 minutes a night (docs/V2.md, "Shorter nights"). */
    secondsPerHour: 35,
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
    earliestSec: 35,
    latestSec: 150,
    /** ...once the best junk tonight is at least this far below what it asks for. */
    reachBelow: 2,
    /** It asks for one tier above the best tonight, within the night's `jackpotTiers` (this by default). */
    tiers: [6, 7] as readonly [number, number],
    patienceSec: 110,
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
    milestonePerHour: 400,
    /** A jackpot raccoon comes this often (after the first). */
    jackpotEverySec: 120,
  },

  /** Junk value in Shinies: base * growth^(tier - 1), whole numbers under 100, else 2 significant figures. */
  value: {
    base: 1.5,
    growth: 2.4,
    /** v2 "money explodes": every value, quota and price is x10 ("+60", "+1,760"). Item values are x this. */
    scale: 10,
  },

  /** Contraband numbers (src/data/contraband.ts; the run agent's). */
  perks: {
    /** Raccoon Mafia: caps and cans pay this much more in orders; gulls come this much more often. */
    mafiaPayMul: 3,
    mafiaGullMul: 2,
    /** Pyramid Scheme: each scrap order filled tonight makes the next one pay this share more (compounding). */
    pyramidStep: 0.1,
    /** Sticky Fingers: chance a delivery pays double. */
    stickyChance: 0.2,
    /** Industrial Crusher: Shinies per junk tier crushed. */
    crusherPerTier: 30,
    /** Fly Farm: Shinies each smelly piece earns per second. */
    flyPayPerSec: 3,
    /** Possum Bribe: the Stink drops to this when it forgives a shutdown. */
    bribeStinkTo: 50,
  },

  /**
   * The run (src/game/run.ts, docs/V2.md "The run"): ten nights in three acts, forks on a map,
   * Contraband, strikes. Tune the run's difficulty here: the quotas are the ante.
   */
  run: {
    /**
     * Each night's quota (index = night - 1) before its rule's quotaMul and the elite tag. Night 10
     * builds the King (no quota). Acts: Lot 9 = 1-4 (4 is The Inspection), The Marina = 5-7 (7 is
     * the Gull God Raid), Mount Trashmore = 8-10 (10 is Spring Cleaning).
     */
    quota: [6000, 7000, 11500, 23000, 26000, 31000, 47000, 43000, 45000, 0] as readonly number[],
    /** The elite reward tag: the quota x this, and its loot is rarer. */
    eliteQuotaMul: 1.4,
    /** Failed nights a run can take; the last one is FIRED. */
    strikes: 3,
    /** What a failed night keeps of its Shinies (the night is retried). */
    lostKeep: 0.5,
    /** Contraband slots (a Foreman may change it). */
    slots: 5,
    /** Cards on a loot pick, and the rarity weights (elite: the rarer table). */
    lootChoices: 3,
    lootWeights: { common: 60, uncommon: 30, rare: 10 },
    eliteWeights: { common: 0, uncommon: 55, rare: 45 },
    /** Swap Meet prices by rarity, x this per act (act 1, 2, 3). */
    price: { common: 12000, uncommon: 18000, rare: 26000 },
    priceAnte: [1, 1.7, 2.4] as readonly number[],
    /** Selling a Contraband pays this share of its price. */
    sellShare: 0.5,
    /** A reroll costs base, then step more each time (per visit). */
    rerollBase: 2000,
    rerollStep: 2000,
    /** The shop reward tag (and the Clearance Card): prices x (1 - this). */
    shopDiscount: 0.25,
    /** Consumables: Bin Juice (carry up to juiceMax into a night) and a brewed tool. */
    juicePrice: 4000,
    juiceMax: 3,
    toolPrice: 4500,
    /** Daily Dump: day #1 is this local date; it plays at this night's difficulty. */
    dailyEpoch: [2026, 11, 1] as readonly number[],
    dailyNight: 3,
  },

  /**
   * Momentum (src/game/combo.ts, docs/V2.md pillar 2): cascades, the Stench Streak and Fever.
   * The streak is a heat meter, 0 to 1: merges, cascade links, brews and deliveries add heat; it
   * holds for the window after each one, then cools. Its steps multiply delivery pay; full heat
   * starts the Raccoon Rave (Fever).
   */
  combo: {
    /** Seconds between a merge and the cascade it sets off (the visible beat). */
    cascadeSec: 0.18,
    /** Seconds the streak holds after each merge, brew or delivery (plus mods.streakWindowBonus)... */
    windowSec: 1.6,
    /** ...then it cools this much heat per second. */
    coolPerSec: 0.3,
    /** Heat each thing adds (a merge also gets perTier for each tier it makes above 1). */
    heat: { merge: 0.037, perTier: 0.003, cascade: 0.06, deliver: 0.038, complete: 0.025, brew: 0.1 },
    /**
     * The pay steps: at each heat, the share of the way from x1 to mods.streakMaxMul (x2 by default:
     * x1.25, x1.5, x2).
     */
    steps: [
      [0.25, 0.25],
      [0.5, 0.5],
      [0.75, 1],
    ] as readonly (readonly [heat: number, share: number])[],
    /** Heat counts this much more until tonight's first Rave (so a quiet night still gets one). */
    firstFeverMul: 2.5,
    /** The Raccoon Rave: seconds, delivery pay (at least one above the streak's top), Dumpster clicks free. */
    feverSec: 8,
    feverMul: 3,
    /** Night 1's big moment: at this hour (3 = 3:00 AM) the next truck loses a Bald Tire. */
    fellOffHour: 3,
    /** Seconds the tire takes to bounce from the truck to its cell. */
    fellOffFlightSec: 1.15,
  },

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
