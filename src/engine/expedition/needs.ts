/**
 * A place's best part on a run (§7.16, 3.13.0): a scavenging crew goes for it instead of its first
 * search, and gets in if someone covers each of its needs. With nobody who does, an aggressive crew has a
 * go anyway; any other leaves it, and that stretch brings nothing.
 */
import { NEEDS, PART_HAUL, getTrait, type NeedDef, type PartDef } from '../content/index.ts';
import { NEED_CARGO, NEED_FIND, NEED_FIND_PER_DANGER, NEED_TRY_DC } from '../constants.ts';
import { coverNeed, gearCalled, type NeedCover } from '../needs.ts';
import { revealTrait } from '../traits.ts';
import { RESOURCE_IDS, type CheckInfo, type ResourceId } from '../types.ts';
import { addLoot, findGear, lootMult, lootText, pickResource, resolveFight, richFind } from './beats.ts';
import { buildEncounter, describeGroup } from './combat.ts';
import { absorbRads, bestBy, capitalize, check, flavor, fmt, hurt, practice, running, say, simBonus, simDay, standing, startBeat, stress, type Member, type Sim } from './context.ts';

/** The vehicle a load would go on: running, with room for it. */
function rideFor(sim: Sim): string | undefined {
  const ride = running(sim).find((r) => r.def.cargo >= NEED_CARGO);
  return ride ? `the ${ride.def.name}` : undefined;
}

/** Whether the crew has a vehicle running with room for a load. */
export function simCarries(sim: Sim): boolean {
  return rideFor(sim) !== undefined;
}

/** Play the part: the stretch is spent on it, whether they get in or not. */
export function partBeat(sim: Sim, part: PartDef, level: number): void {
  startBeat(sim, 'scavenge', part.title);
  say(sim, sim.rng.pick(part.sight));
  (sim.parts ??= []).push(level);
  let finder: Member | undefined;
  for (const need of part.needs) {
    const def = NEEDS[need.kind];
    const it = need.it ?? part.it;
    const vars = { it, It: capitalize(it) };
    const crew = standing(sim);
    const ride = def.vehicle ? rideFor(sim) : undefined;
    const cover = coverNeed(
      crew.map((m) => m.s),
      need.kind,
      level,
      { vehicle: ride !== undefined, hidden: true },
    );
    if (cover) {
      finder = covered(sim, def, cover, crew, { ...vars, ...(ride ? { ride } : {}) }, level);
      continue;
    }
    if (sim.plan.approach !== 'aggressive') {
      say(sim, flavor(sim, def.skip, {}, vars));
      return;
    }
    const a = bestBy(crew, (m) => simBonus(sim, m, def.stat, def.contexts))!;
    say(sim, fmt(sim.rng.pick(def.tries), { a }, vars));
    const result = check(sim, a, def.stat, NEED_TRY_DC + sim.loc.danger - 1, def.contexts);
    if (result.success) {
      say(sim, fmt(sim.rng.pick(def.won), { a }, vars), { check: result.info });
      finder = a;
      continue;
    }
    failed(sim, def, a, vars, result.info);
    return;
  }
  inside(sim, part, finder ?? bestBy(standing(sim), (m) => simBonus(sim, m, 'wits', ['scavenge']))!);
}

/** Someone covers it: say how, let a hidden trait that did it show, and give them the practice. */
function covered(sim: Sim, def: NeedDef, cover: NeedCover, crew: readonly Member[], vars: Record<string, string>, level: number): Member {
  const a = crew.find((m) => m.s.id === cover.by)!;
  const b = cover.with ? crew.find((m) => m.s.id === cover.with) : undefined;
  const lines = def.covered;
  const withTool = cover.item ? { ...vars, tool: gearCalled(cover.item) } : vars;
  switch (cover.how) {
    case 'trait':
      say(sim, fmt(sim.rng.pick(lines.trait ?? lines.stat), { a }, vars), { tone: 'good' });
      if (a.s.traits.some((t) => t.id === cover.trait && t.hidden)) {
        revealTrait(a.s, cover.trait!, simDay(sim));
        say(sim, `So that is how it is: ${a.s.firstName} is ${getTrait(cover.trait!).name}.`);
      }
      break;
    case 'gear':
      say(sim, fmt(sim.rng.pick(lines.gear ?? lines.stat), { a }, withTool), { tone: 'good' });
      break;
    case 'tool':
      say(sim, fmt(sim.rng.pick(lines.tool ?? lines.stat), { a }, withTool), { tone: 'good' });
      break;
    case 'together':
      say(sim, fmt(sim.rng.pick(lines.together ?? lines.stat), { a, b: b! }, vars), { tone: 'good' });
      break;
    case 'vehicle':
      say(sim, flavor(sim, lines.vehicle!, { a }, vars), { tone: 'good' });
      break;
    case 'stat':
      say(sim, fmt(sim.rng.pick(lines.stat), { a }, vars), { tone: 'good' });
      break;
  }
  // Doing it is practice, as a check would be.
  if (cover.how === 'stat' || cover.how === 'tool' || cover.how === 'together') {
    practice(sim, a, def.stat, NEED_TRY_DC + level - 1);
    if (b) practice(sim, b, def.stat, NEED_TRY_DC + level - 1);
  }
  return a;
}

/** A go that didn't work: what it cost, and whether something came. */
function failed(sim: Sim, def: NeedDef, a: Member, vars: Record<string, string>, info: CheckInfo): void {
  const fail = def.fail;
  let tail = '';
  if (fail.hurt) {
    const damage = sim.rng.int(fail.hurt[0], fail.hurt[1]) + (fail.danger ? sim.loc.danger : 0);
    const down = hurt(sim, a, damage, fail.cause ?? 'a bad try');
    tail = ` (-${damage} HP)${down ? ` ${a.s.firstName} is down.` : ''}`;
  }
  say(sim, `${fmt(sim.rng.pick(def.lost), { a }, vars)}${tail}`, { check: info, tone: 'bad' });
  if (fail.rads) absorbRads(a, sim.rng.int(fail.rads[0], fail.rads[1]));
  if (fail.stress) stress(sim, a, fail.stress, fail.cause ?? 'a bad try');
  if (fail.fight && standing(sim).length > 0 && sim.rng.chance(fail.fight.chance)) {
    if (fail.fight.line) say(sim, fail.fight.line, { tone: 'bad' });
    const enemies = buildEncounter(sim, fail.fight.type);
    say(sim, `${capitalize(describeGroup(enemies))}${enemies.length === 1 ? ' attacks' : ' attack'} at once.`, { tone: 'bad' });
    resolveFight(sim, enemies, { ambushed: false, drop: false });
  } else if (fail.quiet) {
    say(sim, flavor(sim, fail.quiet, { a }, vars));
  }
}

/** In: what's there, and the haul. */
function inside(sim: Sim, part: PartDef, finder: Member): void {
  say(sim, sim.rng.pick(part.inside));
  const units = (NEED_FIND + NEED_FIND_PER_DANGER * (sim.loc.danger - 1)) * (part.size ?? 1) * lootMult(finder);
  const taken: Partial<Record<ResourceId, number>> = {};
  // Half of it is what the part holds, the other half what the place gives up anyway (mostly scrap, most places).
  for (let k = 0; k < 2; k++) {
    const res = k === 0 ? sim.rng.weightedBy(RESOURCE_IDS, (r) => part.loot[r] ?? 0) : pickResource(sim);
    const n = richFind(sim, units / 2);
    addLoot(sim, res, n);
    taken[res] = (taken[res] ?? 0) + n;
  }
  say(sim, flavor(sim, PART_HAUL, { a: finder }, { loot: lootText(taken) }), { tone: 'good' });
  if (sim.rng.chance(part.gear)) findGear(sim, finder, part.gearFrom);
}
