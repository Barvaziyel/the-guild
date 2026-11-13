/**
 * A raid on the Depot fought out (§9.8): those who were home and fit when the
 * raiders came, against the raiders at the gate. It's played like a fight on a
 * run, from the defenders as they stood when it began; under command it's
 * played again with the orders so far, like a led run's fight (§7.13).
 */
import { ENCOUNTER_BASE, ENCOUNTER_CREW_MULT, ENCOUNTER_PER_DANGER, MAX_ENEMIES, RAID_BUDGET_MULT, RAID_DANGER, RAID_FULL_FENCE, RAID_HIDDEN_SHARE, RAID_WAVE_BUDGET, RAID_WOUND_BONUS } from '../constants.ts';
import { getEnemy, type LocationDef } from '../content/index.ts';
import { Rng } from '../rng.ts';
import type { DepotRaid, GameState, Survivor, VultureMember } from '../types.ts';
import { fight, newEnemy, patchUp, type CombatEnd, type Enemy } from './combat.ts';
import { FightPause, type FightView } from './command.ts';
import { bestBy, isHurt, say, simBonus, standing, startBeat, type FightPlan, type Member, type Sim } from './context.ts';
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
 * A second band (`wave` 2) is smaller, and never has a leader.
 */
export function raidEnemies(state: GameState, raid: DepotRaid, defenders: number, wave: 1 | 2 = 1): string[] {
  const rng = new Rng(wave === 1 ? `raid-enemies:${raid.seed}` : `raid-enemies-2:${raid.seed}`);
  const fence = Math.max(defenders, RAID_FULL_FENCE);
  const mult = ENCOUNTER_CREW_MULT[Math.min(fence, ENCOUNTER_CREW_MULT.length) - 1] ?? 1;
  let budget = (ENCOUNTER_BASE + RAID_DANGER * ENCOUNTER_PER_DANGER) * mult * RAID_BUDGET_MULT * (wave === 2 ? RAID_WAVE_BUDGET : 1);
  const out: string[] = [];
  let kinds: readonly string[] = RAIDER_KINDS;
  if (raid.by === 'vultures') {
    budget *= 0.8 + state.vultures.strength / 200;
    kinds = VULTURE_KINDS;
    if (raid.leadId && wave === 1) {
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
  /** The band the fight came to: the first, or the second. */
  wave: 1 | 2;
  /** The first band is beaten and the second is coming: the player picks who holds the gate against it. */
  regroup?: boolean;
  /** The last fight as it ended, under command (for the screen after it). */
  view?: FightView;
}

/** The named Vulture at the head of a raid, as the guild knows them now. */
function raidLeader(state: GameState, raid: DepotRaid): VultureMember | undefined {
  return raid.leadId ? state.vultures.people.find((m) => m.person.id === raid.leadId) : undefined;
}

/** The meds or ammo the defenders can reach: all the Depot's, or what isn't hidden. */
export function withinReach(raid: DepotRaid, n: number | undefined): number {
  return raid.hidden ? Math.ceil((n ?? 0) * (1 - RAID_HIDDEN_SHARE)) : (n ?? 0);
}

/**
 * Play the raid's fight from `raid.start`, with the player's part as the raid
 * has it (taken command, the orders so far, who holds the gate). `live`: in
 * command and waiting on the player, a fight out of orders throws a FightPause
 * with the fight as it stands, and the first band beaten with a second coming
 * stops there (`regroup`) until the player picks who holds the gate. Never
 * changes `state`.
 */
export function playRaid(state: GameState, raid: DepotRaid, live: boolean): RaidFight {
  const shell = structuredClone(raid.start!);
  const perch = new Set(raid.perch ?? []);
  const crew = shell.survivors;
  const dog = animalOf(shell, 'dog');
  const leader = raidLeader(state, raid);
  const meds = withinReach(raid, raid.meds);
  const ammo = withinReach(raid, raid.ammo);
  const all = crew.map((s: Survivor) => {
    const m = newMember(s);
    if (perch.has(s.id)) m.perch = true;
    m.woundBonus = RAID_WOUND_BONUS;
    return m;
  });
  const first: FightPlan | undefined = raid.took !== undefined ? { rounds: raid.rounds ?? [], live, delay: 0 } : undefined;
  const second: FightPlan | undefined = raid.rounds2 !== undefined ? { rounds: raid.rounds2, live, delay: 0 } : undefined;
  const team = new Set(raid.team ?? all.map((m) => m.s.id));
  const sim: Sim = {
    state: shell,
    rng: new Rng(`raid:${raid.seed}`),
    plan: { locationId: DEPOT_SITE.id, crew: crew.map((s) => s.id), job: 'scout', meds, ammo, approach: 'balanced', retreat: 'downed' },
    loc: DEPOT_SITE,
    members: all.filter((m) => team.has(m.s.id)),
    departAt: raid.arrive,
    offset: 0,
    beats: [],
    loot: { scrap: 0, rations: 0, meds: 0, ammo: 0, tech: 0, gas: 0 },
    items: [],
    meds,
    ammo,
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
    lead: { plans: [first, second], stops: [], ends: [], home: true },
    gate: {
      tower: workingLevel(shell, 'watchtower'),
      wall: wallDefense(shell) > 0,
      ...(raid.shored ? { shored: true } : {}),
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
  // Stared at and not backing down, they strike first; seen coming from the Watchtower, the defenders do.
  const stared = raid.talk?.how === 'stare' && !raid.talk.ok;
  let result = fight(sim, enemies, { ambushed: stared, drop: !stared && raid.seen !== undefined });
  let wave: 1 | 2 = 1;
  let fought = enemies;
  const held = (end: CombatEnd): boolean => end === 'won' || end === 'stalemate';
  if (raid.waves === 2 && held(result.end)) {
    sim.members = all;
    regroup(sim);
    // In command, the player picks who holds the gate against the second band.
    if (live && first && raid.team2 === undefined) return finishPlay(sim, all, result.end, enemies, 1, true);
    wave = 2;
    const team2 = new Set(raid.team2 ?? standing(sim).map((m) => m.s.id));
    sim.members = all.filter((m) => team2.has(m.s.id) && !m.down && !m.dead);
    fought = (raid.enemies2 ?? []).map((id) => newEnemy(getEnemy(id), RAID_DANGER));
    if (sim.members.length === 0 || fought.length === 0) {
      sim.members = all;
      say(sim, 'Nobody is left to hold the gate. The second band walks in.', { tone: 'bad' });
      result = { end: 'withdrew', loot: {} };
    } else result = fight(sim, fought, { ambushed: false, drop: false });
  }
  sim.members = all;
  if (sim.vultures) settle(sim, sim.vultures, [...enemies, ...(wave === 2 ? fought : [])], result.end, leader ? structuredClone(leader) : undefined);
  resolveWounds(sim);
  return finishPlay(sim, all, result.end, fought, wave, false);
}

function finishPlay(sim: Sim, all: Member[], end: CombatEnd, enemies: Enemy[], wave: 1 | 2, regroup: boolean): RaidFight {
  sim.members = all;
  const view = sim.lead!.ends[wave - 1];
  return { end, sim, enemies, wave, ...(regroup ? { regroup } : {}), ...(view ? { view } : {}) };
}

/** Between the bands: the second comes up the road, and anyone down or badly hurt gets patched up while there are meds. */
function regroup(sim: Sim): void {
  startBeat(sim, 'combat', 'Between the bands');
  for (const m of sim.members) {
    if (sim.meds <= 0) break;
    if (m.dead || (!m.down && !isHurt(m))) continue;
    const medic = bestBy(standing(sim), (o) => simBonus(sim, o, 'wits', ['medicine']));
    if (!medic) break;
    patchUp(sim, medic, m);
  }
}

/** The raid fight as it stands for the next round's orders, or undefined if it's over, or waits for the player to pick who holds the gate (or nobody's in command). */
export function raidPause(state: GameState, raid: DepotRaid): FightView | undefined {
  try {
    playRaid(state, raid, true);
  } catch (e) {
    if (e instanceof FightPause) return e.view;
    throw e;
  }
  return undefined;
}
