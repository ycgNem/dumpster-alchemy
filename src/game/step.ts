// One fixed simulation step. The order matters a little: things land, then the sources run,
// then Stink and the clock judge the result.
import { updateCombo } from './combo';
import { updateDumpster } from './dumpster';
import { updateGulls } from './gulls';
import { updateOrders } from './orders';
import { updatePerks } from './perks';
import { updateShift } from './shift';
import { updateFlights } from './spawn';
import type { GameState } from './state';
import { updateStink } from './stink';
import { updateTruck } from './truck';

export function step(s: GameState, dt: number): void {
  if (s.status !== 'playing') return;
  updateFlights(s, dt);
  updateDumpster(s, dt);
  updateTruck(s, dt);
  updateOrders(s, dt);
  updateGulls(s, dt);
  updateCombo(s, dt);
  updatePerks(s, dt);
  s.compactor.cooldown = Math.max(0, s.compactor.cooldown - dt);
  updateStink(s, dt);
  updateShift(s, dt);
}
