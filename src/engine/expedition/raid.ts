/**
 * A raid on the Depot fought out (§9.8): those who were home and fit when the
 * raiders came, against the raiders at the gate. It's played like a fight on a
 * run, from the defenders as they stood when it began; under command it's
 * played again with the orders so far, like a led run's fight (§7.13).
 */
import { ENCOUNTER_BASE, ENCOUNTER_CREW_MULT, ENCOUNTER_PER_DANGER, MAX_ENEMIES, RAID_BUDGET_MULT, RAID_DANGER, RAID_FULL_FENCE, RAID_WOUND_BONUS } from '../constants.ts';
import { getEnemy, type LocationDef } from '../content/index.ts';
import { Rng } from '../rng.ts';
import type { DepotRaid, GameState, Survivor, VultureMember } from '../types.ts';
import { fight, newEnemy, type CombatEnd, type Enemy } from './combat.ts';
import { FightPause, type FightView } from './command.ts';
import type { FightPlan, Sim } from './context.ts';
import { newMember } from './sim.ts';
import { namedEnemy, settle } from './vultures.ts';
import { resolveWounds } from './wounds.ts';
import { vultureBand } from '../vultures.ts';
import { takenNames } from './stories.ts';
import { animalOf } from '../animals.ts';
import { workingLevel } from '../depot/buildings.ts';
import { wallDefense } from '../projects.ts';

/** The Depot as a place to fight in. */
export const DEPOT_SITE: LocationDef = {
  id: 'depot',
  name: 'the Depot',
  biome: 'Home',
  description: 'The guild’s rail depot.',
  danger: RAID_DANGER,
  radiation: 0,
  durationMin: 0,
  encounters: [],
  loot: { scrap: 0, rations: 0, meds: 0, ammo: 0, tech: 0, gas: 0 },
  gearChance: 0,
  hazards: [],
  leadsTo: [],
  sights: [],
};

const RAIDER_KINDS = ['raider_scav', 'raider_gunner', 'raider_brute'] as const;
const VULTURE_KINDS = ['vulture_scav', 'vulture_shot'] as const;

/**
 * Who comes, bought like a fight at a place of RAID_DANGER, a little bigger,
 * for a fence of at least three: fewer at home doesn't mean fewer raiders.
 * The Vultures bring one of their named people, and come stronger as they grow.
 */
export function raidEnemies(state: GameState, raid: DepotRaid, defenders: number): string[] {
  const rng = new Rng(`raid-enemies:${raid.seed}`);
  const fence = Math.max(defenders, RAID_FULL_FENCE);
  const mult = ENCOUNTER_CREW_MULT[Math.min(fence, ENCOUNTER_CREW_MULT.length) - 1] ?? 1;
  let budget = (ENCOUNTER_BASE + RAID_DANGER * ENCOUNTER_PER_DANGER) * mult * RAID_BUDGET_MULT;
  const out: string[] = [];
  let kinds: readonly string[] = RAIDER_KINDS;
  if (raid.by === 'vultures') {
    budget *= 0.8 + state.vultures.strength / 200;
    kinds = VULTURE_KINDS;
    if (raid.leadId) {
      out.push('vulture_lieutenant');
      budget -= getEnemy('vulture_lieutenant').threat;
    }
  }
  while (out.length < MAX_ENEMIES) {
    const affordable = kinds.filter((id) => getEnemy(id).threat <= budget);
    if (affordable.length === 0) break;
    const id = rng.pick(affordable);
    out.push(id);
    budget -= getEnemy(id).threat;
  }
  if (out.length === 0) out.push(kinds[0]!);
  return out;
}

/** What a raid fight came to. */
export interface RaidFight {
  end: CombatEnd;
  sim: Sim;
  enemies: Enemy[];
  /** The fight as it ended, under command (for the screen after it). */
  view?: FightView;
}

/** The named Vulture at the head of a raid, as the guild knows them now. */
function raidLeader(state: GameState, raid: DepotRaid): VultureMember | undefined {
  return raid.leadId ? state.vultures.people.find((m) => m.person.id === raid.leadId) : undefined;
}

/**
 * Play the raid's fight from `raid.start`. `plan`: the player's part, if they
 * took command; a live plan out of orders throws a FightPause with the fight
 * as it stands. Never changes `state`.
 */
export function playRaid(state: GameState, raid: DepotRaid, plan: FightPlan | undefined): RaidFight {
  const shell = structuredClone(raid.start!);
  const perch = new Set(raid.perch ?? []);
  const crew = shell.survivors;
  const dog = animalOf(shell, 'dog');
  const leader = raidLeader(state, raid);
  const sim: Sim = {
    state: shell,
    rng: new Rng(`raid:${raid.seed}`),
    plan: { locationId: DEPOT_SITE.id, crew: crew.map((s) => s.id), job: 'scout', meds: raid.meds ?? 0, ammo: raid.ammo ?? 0, approach: 'balanced', retreat: 'downed' },
    loc: DEPOT_SITE,
    members: crew.map((s: Survivor) => {
      const m = newMember(s);
      if (perch.has(s.id)) m.perch = true;
      m.woundBonus = RAID_WOUND_BONUS;
      return m;
    }),
    departAt: raid.arrive,
    offset: 0,
    beats: [],
    loot: { scrap: 0, rations: 0, meds: 0, ammo: 0, tech: 0, gas: 0 },
    items: [],
    meds: raid.meds ?? 0,
    ammo: raid.ammo ?? 0,
    // Nobody dies at the gate: the Infirmary is right there.
    mercy: true,
    hadCombat: false,
    turnBack: false,
    routed: false,
    discovered: [],
    deaths: [],
    beatCounts: {},
    events: [],
    exploreBonus: 0,
    nemeses: [],
    nemesisNews: {},
    nemesisMet: true,
    takenNames: new Set(takenNames(state)),
    rides: [],
    foundVehicles: [],
    animals: [],
    found: [],
    thin: 1,
    delay: 0,
    radio: false,
    lead: { plans: [plan], stops: [], ends: [], home: true },
    gate: {
      tower: workingLevel(shell, 'watchtower'),
      wall: wallDefense(shell) > 0,
      ...(dog ? { dog: dog.name } : {}),
    },
    ...(raid.by === 'vultures'
      ? {
          vultures: {
            band: vultureBand(state),
            standing: state.vultures.standing,
            strength: state.vultures.strength,
            met: true,
            news: { standing: 0, strength: 0, met: [], killed: [], captured: [], history: [] },
          },
        }
      : {}),
  };
  const enemies = (raid.enemies ?? []).map((id, i) =>
    i === 0 && id === 'vulture_lieutenant' && leader ? namedEnemy(sim, structuredClone(leader)) : newEnemy(getEnemy(id), RAID_DANGER),
  );
  // Seen coming from the Watchtower, the defenders are ready and strike first.
  const result = fight(sim, enemies, { ambushed: false, drop: raid.seen !== undefined });
  if (sim.vultures) settle(sim, sim.vultures, enemies, result.end, leader ? structuredClone(leader) : undefined);
  resolveWounds(sim);
  const view = sim.lead!.ends[0];
  return { end: result.end, sim, enemies, ...(view ? { view } : {}) };
}

/** The raid fight as it stands for the next round's orders, or undefined if it's over (or nobody's in command). */
export function raidPause(state: GameState, raid: DepotRaid, plan: FightPlan): FightView | undefined {
  try {
    playRaid(state, raid, plan);
  } catch (e) {
    if (e instanceof FightPause) return e.view;
    throw e;
  }
  return undefined;
}
