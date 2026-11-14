/**
 * Jobs a fight can come with (§7.4, 2.5.0): hold the door, grab their stash,
 * get a stranger out, open a cage. Someone spends their turns on the job
 * instead of fighting; the kinds are data in content/goals.ts.
 *
 * Everything here rolls dice only through `sim.rng`, in the same order on
 * every replay of a led run: the job is chosen when the fight starts, before
 * the first round is asked for.
 */
import { DOOR_REINFORCEMENTS, GOAL_CHANCE, GOAL_RESCUE_JOINS, GOAL_RESCUE_MEDS } from '../constants.ts';
import { GOALS, type GoalDef } from '../content/goals.ts';
import { generateSurvivor } from '../generator.ts';
import { effectiveStat, maxHp } from '../stats.ts';
import type { ResourceId } from '../types.ts';
import { addLoot, findGear, pickResource, richFind } from './beats.ts';
import type { Enemy } from './combat.ts';
import { active, capitalize, say, simDay, type Member, type Sim } from './context.ts';

/** A fight's job as it stands. Lives only in the simulation. */
export interface FightGoal {
  def: GoalDef;
  /** Turns of work put in. */
  progress: number;
  state: 'open' | 'done' | 'lost';
  /** Someone held the door this round. */
  held: boolean;
}

/** What the fight screen shows of the job. */
export interface GoalView {
  id: string;
  title: string;
  move: string;
  intro: string;
  detail: string;
  progress: number;
  needed: number;
  deadline?: number;
  state: 'open' | 'done' | 'lost';
  /** The line when it's done, and when it's lost. */
  doneLine: string;
  lostLine: string;
}

export function goalView(goal: FightGoal): GoalView {
  return {
    id: goal.def.id,
    title: goal.def.title,
    move: goal.def.move,
    intro: goal.def.intro,
    detail: goal.def.detail,
    progress: Math.min(goal.progress, goal.def.rounds),
    needed: goal.def.rounds,
    ...(goal.def.deadline !== undefined ? { deadline: goal.def.deadline } : {}),
    state: goal.state,
    doneLine: goal.def.done,
    lostLine: goal.def.lost,
  };
}

/**
 * Whether this fight comes with a job: a quarter of fights on runs, never at
 * the gate, one that fits who they're up against. A door brings the ones that
 * would come through it: they wait off the stage (`waiting`) until they do.
 */
export function rollGoal(sim: Sim, enemies: Enemy[]): FightGoal | undefined {
  if (sim.gate || !sim.rng.chance(GOAL_CHANCE)) return undefined;
  const types = new Set<string>(enemies.map((e) => e.def.type));
  const fits = GOALS.filter((g) => g.against.some((t) => types.has(t)));
  if (fits.length === 0) return undefined;
  const def = sim.rng.weightedBy(fits, (g) => g.weight);
  if (def.reward === 'shut') {
    // More of the plainest of them, behind the door.
    const plain = enemies.filter((e) => !e.nemesis && !e.vulture && !e.def.leader);
    const like = (plain.length > 0 ? plain : enemies).reduce((a, b) => (b.def.threat < a.def.threat ? b : a));
    for (let i = 0; i < DOOR_REINFORCEMENTS; i++) {
      enemies.push({ def: like.def, hp: like.maxHp, maxHp: like.maxHp, attack: like.attack, damage: like.damage, defense: like.defense, dead: false, fled: false, downed: [], waiting: true });
    }
  }
  say(sim, def.intro, { tone: 'bad' });
  return { def, progress: 0, state: 'open', held: false };
}

/** Twice the work a turn: strong enough, sharp enough, or carrying the right tool. */
export function fastAt(m: Member, def: GoalDef): boolean {
  const { stat, min, gear } = def.fast;
  if (stat && min !== undefined && effectiveStat(m.s, stat) >= min) return true;
  const carried = Object.values(m.s.equipment).filter((x) => x !== undefined).map((x) => x!.defId);
  return gear?.some((g) => carried.includes(g)) ?? false;
}

/** One turn on the job. Returns how much work it was. */
export function workGoal(sim: Sim, m: Member, goal: FightGoal): number {
  if (goal.state !== 'open') return 0;
  const work = fastAt(m, goal.def) ? 2 : 1;
  goal.progress += work;
  if (goal.def.reward === 'shut') goal.held = true;
  const done = goal.progress >= goal.def.rounds;
  say(sim, `${goal.def.working.replace('{a}', m.s.firstName)}${done ? '' : ` (${goal.progress} of ${goal.def.rounds})`}`);
  if (done) completeGoal(sim, goal, m);
  return work;
}

/** The job done: what it gives. */
function completeGoal(sim: Sim, goal: FightGoal, by: Member): void {
  goal.state = 'done';
  say(sim, goal.def.done, { tone: 'good' });
  const d = sim.loc.danger;
  switch (goal.def.reward) {
    case 'shut':
      break;
    case 'cache': {
      // Their stash: two finds of what the place has.
      const got: string[] = [];
      for (let i = 0; i < 2; i++) {
        const res: ResourceId = pickResource(sim);
        const amount = richFind(sim, sim.rng.int(3, 6) + d - 1);
        addLoot(sim, res, amount);
        got.push(`${amount} ${res}`);
      }
      say(sim, `${capitalize(got.join(' and '))} for the packs.`, { tone: 'good' });
      break;
    }
    case 'rescue': {
      const them = sim.members.length === 1 ? by.s.firstName : 'them';
      if (!sim.rng.chance(GOAL_RESCUE_JOINS)) {
        // Half of them have somewhere to go.
        const meds = sim.rng.int(GOAL_RESCUE_MEDS[0], GOAL_RESCUE_MEDS[1]);
        addLoot(sim, 'meds', meds);
        say(sim, `The stranger has somewhere to be, and presses ${meds === 1 ? 'a med' : `${meds} meds`} on ${them} before slipping away.`, { tone: 'good' });
        break;
      }
      const person = generateSurvivor(sim.state, sim.rng, { day: simDay(sim) });
      person.hp = Math.max(1, Math.round(maxHp(person) * 0.6));
      sim.found.push({ person, by: by.s.id });
      say(sim, `${person.firstName} ${person.lastName} comes home with ${them}.`, { tone: 'good' });
      break;
    }
    case 'unlock': {
      findGear(sim, by);
      const amount = richFind(sim, sim.rng.int(2, 4) + d - 1);
      addLoot(sim, 'scrap', amount);
      say(sim, `And ${amount} scrap.`, { tone: 'good' });
      break;
    }
  }
}

/**
 * The end of a round: through a door nobody held comes another one (two at
 * most), and a job past its deadline is lost. Returns the enemies who came in.
 */
export function goalRoundEnds(sim: Sim, goal: FightGoal, round: number, enemies: Enemy[]): Enemy[] {
  const came: Enemy[] = [];
  if (goal.state === 'open' && goal.def.reward === 'shut') {
    const next = !goal.held ? enemies.find((e) => e.waiting) : undefined;
    if (next) {
      next.waiting = false;
      came.push(next);
      say(sim, goal.def.lost, { tone: 'bad' });
      // The last of them is through: nothing left to hold back.
      if (!enemies.some((e) => e.waiting)) goal.state = 'lost';
    }
  } else if (goal.state === 'open' && goal.def.deadline !== undefined && round >= goal.def.deadline) {
    goal.state = 'lost';
    say(sim, goal.def.lost, { tone: 'bad' });
  }
  goal.held = false;
  return came;
}

/** The fight is over: a win gets an open job done (nobody is in the way now); anything else loses it. */
export function settleGoal(sim: Sim, goal: FightGoal, won: boolean): void {
  if (goal.state !== 'open' || goal.def.reward === 'shut') return;
  const by = active(sim)[0] ?? sim.members[0]!;
  if (won) completeGoal(sim, goal, by);
  else {
    goal.state = 'lost';
    say(sim, goal.def.lost, { tone: 'bad' });
  }
}

/**
 * Who a crew on its own puts on the job this round, when there's someone else
 * to fight and the job can still be done in time: whoever it costs the fight
 * least, the turns they'd need times what they'd hit for (`blow`), and the
 * best at it of those. Nobody if it's done, lost, or there's no one to spare.
 */
export function goalWorker(sim: Sim, goal: FightGoal, round: number, free: readonly Member[], blow: (m: Member) => number): Member | undefined {
  if (goal.state !== 'open') return undefined;
  const crew = active(sim).filter((m) => !m.perch);
  if (crew.length < 2) return undefined;
  const able = free.filter((m) => !m.perch);
  if (able.length === 0) return undefined;
  const turns = (m: Member): number => Math.ceil((goal.def.rounds - goal.progress) / (fastAt(m, goal.def) ? 2 : 1));
  const cost = (m: Member): number => turns(m) * blow(m) - effectiveStat(m.s, goal.def.stat) / 10;
  const best = able.reduce((a, b) => (cost(b) < cost(a) ? b : a));
  if (goal.def.deadline !== undefined && turns(best) > goal.def.deadline - round + 1) return undefined;
  return best;
}
