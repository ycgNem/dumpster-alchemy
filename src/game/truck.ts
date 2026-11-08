// The Truck: a countdown, it backs in along the lane, tips its load (items that arc onto random
// empty cells), drives off. The interval shrinks and the load grows as the night goes on, up to a
// pace a person can keep up with. Each load is rolled one dump ahead (`nextTruckLoad`).
//
// Garbage Day has two trucks (`s.truck2`, `mods.trucks` 2): each keeps the usual rhythm with half
// the load, the second half a gap behind, so smaller loads come twice as often. Junk from the
// second truck flies with `Flight.slot` 1.
import { TUNING } from '../data/tuning';
import { endlessHoursPast, rollTruckLoad, truckPressure } from './loads';
import { launch } from './spawn';
import type { GameState, Truck } from './state';

/** Every truck on tonight's route (one, or two on Garbage Day). */
export function trucks(s: GameState): Truck[] {
  return s.truck2 ? [s.truck, s.truck2] : [s.truck];
}

/** Whichever truck dumps next (the HUD's countdown and "next load" follow this one). */
export function dueTruck(s: GameState): Truck {
  const b = s.truck2;
  return b && b.timer < s.truck.timer ? b : s.truck;
}

/** How many items the next dump will tip (rolled ahead of time, so it's the real number). */
export function nextTruckLoad(s: GameState): number {
  return dueTruck(s).next.length;
}

export function updateTruck(s: GameState, dt: number): void {
  for (const k of trucks(s)) updateOne(s, k, dt);
}

function updateOne(s: GameState, k: Truck, dt: number): void {
  const T = TUNING.truck;
  k.timer -= dt;
  k.t += dt;
  switch (k.phase) {
    case 'away':
      if (k.timer <= T.driveInSec) setPhase(s, k, 'arrive');
      break;
    case 'arrive':
      if (k.timer <= 0) {
        setPhase(s, k, 'dump');
        k.load = k.next;
        k.loadSize = k.load.length;
        k.dumps++;
        k.timer = interval(s);
        k.next = rollTruckLoad(s, s.time + k.timer);
        s.events.push({ type: 'truckDump', count: k.loadSize });
      }
      break;
    case 'dump': {
      // Tip the items out one after another across the first 70% of the dump.
      const gap = (T.dumpSec * 0.7) / Math.max(1, k.loadSize);
      while (k.load.length > 0 && k.t >= gap * (k.loadSize - k.load.length)) {
        const id = k.load.shift();
        if (id === undefined) break;
        s.stats.truckItems++;
        launch(s, id, 'truck', T.flightSec, k.which);
      }
      if (k.t >= T.dumpSec && k.load.length === 0) {
        setPhase(s, k, 'leave');
        s.events.push({ type: 'truckLeave' });
      }
      break;
    }
    case 'leave':
      if (k.t >= T.driveOffSec) setPhase(s, k, 'away');
      break;
  }
}

function setPhase(s: GameState, k: Truck, phase: Truck['phase']): void {
  k.phase = phase;
  k.t = 0;
  if (phase === 'arrive') s.events.push({ type: 'truckArrive' });
}

/** Seconds from this dump to the next one (per truck) at the current point in the night. */
export function interval(s: GameState): number {
  const T = TUNING.truck;
  const k = Math.min(1, truckPressure(s, s.time));
  return (T.intervalSec + (T.intervalMinSec - T.intervalSec) * k) * s.mods.truckIntervalMul * endlessRamp(s);
}

/** Endless never lets up: once it reaches the 6 AM pace the truck comes a bit sooner every hour. */
function endlessRamp(s: GameState): number {
  if (s.goal !== 'endless') return 1;
  const E = TUNING.endless;
  return Math.max(E.minIntervalMul, E.perHourMul ** endlessHoursPast(s, s.time));
}
