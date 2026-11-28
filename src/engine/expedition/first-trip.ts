/**
 * A new guild's first trip (§9.10, 3.14.0): a short run whose first stretch is two hounds, the first fight
 * the player leads (it always calls home, and nobody dies of it), and then the place's best part.
 */
import { FIRST_TRIP_FOES } from '../constants.ts';
import { getEnemy } from '../content/index.ts';
import type { CrewLines } from '../content/flavor.ts';
import { resolveFight } from './beats.ts';
import { newEnemy } from './combat.ts';
import { flavor, say, startBeat, type Sim } from './context.ts';

/** How the hounds come: always two, out of cover, with no way round them. */
const HOUNDS: CrewLines = {
  crew: [
    'They’re barely in when two hounds come out from cover, low and fast, hackles up. There’s no way round them.',
    'Something shifts in the shadows ahead. Two hounds, ribs showing, and they’ve already seen the crew. There’s no way round them.',
  ],
  solo: [
    '{a.first} is barely in when two hounds come out from cover, low and fast, hackles up. There’s no way round them.',
    'Something shifts in the shadows ahead. Two hounds, ribs showing, and they’ve already seen {a.first}. There’s no way round them.',
  ],
};

export function firstFight(sim: Sim): void {
  startBeat(sim, 'combat', 'Hounds');
  say(sim, flavor(sim, HOUNDS), { tone: 'bad' });
  const enemies = FIRST_TRIP_FOES.map((id) => newEnemy(getEnemy(id), sim.loc.danger));
  resolveFight(sim, enemies, { ambushed: false, drop: false });
}
