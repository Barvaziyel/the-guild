/**
 * Elites on runs (§7.15, 3.12.0): seeing one for the first time, meeting one,
 * going after one, and bringing one down. Whether the guild sees or meets it
 * comes from dice of its own (`elite:` and the run's seed), so a run where
 * nothing of the kind happens rolls exactly as it would have without them.
 */
import { ELITE_MEET_CHANCE, ELITE_ROUNDS, ELITE_SEEN_AFTER, ELITE_SIGNS_CHANCE, ELITE_SIGNS_SCOUT } from '../constants.ts';
import { eliteAt, getEnemy, type EnemyDef } from '../content/index.ts';
import { addChronicle } from '../chronicle.ts';
import { createItem } from '../gear.ts';
import { exploredAt } from '../locations.ts';
import { Rng } from '../rng.ts';
import { fullName, fillRoles } from '../text.ts';
import type { EliteNews, EliteRecord, GameState, RunPlan } from '../types.ts';
import { type Enemy, newEnemy } from './combat.ts';
import { bestBy, say, simBonus, simDay, standing, startBeat, type Member, type Sim } from './context.ts';
import { lairStart, resolveFight } from './beats.ts';

/** The elite where a run goes, as the run sees it. */
export interface SimElite {
  def: EnemyDef;
  /** The guild had seen it before this run set out, or someone has since. */
  known: boolean;
  /** Fought on this run already: it turns up once a run at most. */
  met: boolean;
  /** The beat after which someone first sees it, if this run does. */
  signsAt?: number;
  news: EliteNews;
  rng: Rng;
}

/** Jobs that take a crew far enough in to cross paths with an elite. */
const ROAMING: readonly string[] = ['scavenge', 'scout', 'hunt'];

/**
 * The elite of the place a run goes to, if it's still at large and there's a
 * chance of crossing it: one the guild knows of, or, once the place's outskirts
 * are half explored, one it may see for the first time.
 */
export function eliteOnRun(state: GameState, plan: RunPlan, seed: string, beats: number): SimElite | undefined {
  if (plan.first || !ROAMING.includes(plan.job)) return undefined;
  const def = eliteAt(plan.locationId);
  if (!def) return undefined;
  const record = state.elites?.[def.id];
  if (record?.status === 'dead') return undefined;
  const known = record !== undefined;
  if (!known && exploredAt(state, plan.locationId, 1) < ELITE_SEEN_AFTER) return undefined;
  const rng = new Rng(`elite:${seed}`);
  const out: SimElite = { def, known, met: false, news: { id: def.id }, rng };
  if (!known && beats > 0 && rng.chance(ELITE_SIGNS_CHANCE * (plan.job === 'scout' ? ELITE_SIGNS_SCOUT : 1))) out.signsAt = rng.int(0, beats - 1);
  return out;
}

/** Who sees it, or is there when it turns up: the sharpest of those still standing. */
function witness(sim: Sim): Member | undefined {
  return bestBy(
    standing(sim).filter((m) => !m.ally),
    (m) => simBonus(sim, m, 'wits', []),
  );
}

/** A line of the elite's, with {a.*} filled by whoever's there. */
function line(text: string, a: Member | undefined): string {
  return a ? fillRoles(text, { a: a.s }) : text;
}

/** The first time anyone sees it: a beat of its own, and from now on the guild knows it's there. */
export function eliteSigns(sim: Sim): void {
  const elite = sim.elite;
  if (!elite || elite.known) return;
  const a = witness(sim);
  if (!a) return;
  const signs = elite.def.elite!.signs;
  startBeat(sim, 'discovery', signs.title);
  const lines = sim.members.length === 1 ? signs.lines.solo : signs.lines.crew;
  for (const [i, text] of lines.entries()) say(sim, line(text, a), i === lines.length - 1 ? { tone: 'bad' } : {});
  elite.known = true;
  elite.news.seen = a.s.id;
  addChronicle(a.s, simDay(sim), `First to see ${elite.def.name.replace(/^The /, 'the ')}, at ${sim.loc.name}.`, ['elite', elite.def.id]);
}

/** On a fight at its place, once the guild knows it's there: does it turn up this time? Its own dice. */
export function eliteJoins(sim: Sim): boolean {
  const elite = sim.elite;
  return elite !== undefined && elite.known && !elite.met && !sim.gate && elite.rng.chance(ELITE_MEET_CHANCE);
}

/**
 * The elite and whoever is with it: what the place's budget buys of its kind
 * after the elite. Those it can call in come too, waiting off the stage.
 */
export function eliteEncounter(sim: Sim, buildRest: (budget: number, type: string) => Enemy[], budget: number): Enemy[] {
  const elite = sim.elite!;
  elite.met = true;
  elite.news.fought = true;
  const def = elite.def;
  const out: Enemy[] = [newEnemy(def, sim.loc.danger), ...buildRest(Math.max(0, budget - def.threat), def.type)];
  const calls = def.calls;
  if (calls) for (let i = 0; i < calls.max; i++) out.push({ ...newEnemy(getEnemy(calls.id), sim.loc.danger), waiting: true, reserve: true });
  return out;
}

/** When it turns up in a fight: what it looks like, said before the first blow. */
export function eliteMet(sim: Sim): void {
  const a = witness(sim);
  say(sim, line(sim.elite!.def.elite!.met, a), { tone: 'bad' });
}

/**
 * Going after it (the planner's order): at the deepest point of the run they
 * find where it lives, and it's there. Not ambushed, since they came looking;
 * the one who spots it first may give them the first blow.
 */
export function eliteLair(sim: Sim, encounter: () => Enemy[]): void {
  const elite = sim.elite!;
  const lair = elite.def.elite!.lair;
  const a = witness(sim);
  startBeat(sim, 'combat', lair.title);
  const lines = sim.members.length === 1 ? lair.lines.solo : lair.lines.crew;
  for (const text of lines) say(sim, line(text, a));
  const enemies = encounter();
  eliteMet(sim);
  resolveFight(sim, enemies, { ...lairStart(sim, enemies), rounds: ELITE_ROUNDS });
}

/** Brought down: its last moment, the Chronicle, and its prize, a Relic with a name and a story. */
export function eliteKilled(sim: Sim, m: Member, e: Enemy): void {
  const elite = sim.elite;
  const def = e.def.elite;
  if (!def) return;
  const day = simDay(sim);
  if (elite) elite.news.killed = m.s.id;
  say(sim, def.killed, { tone: 'good' });
  addChronicle(m.s, day, `Brought down ${e.def.name.replace(/^The /, 'the ')} at ${sim.loc.name}.`, ['elite', e.def.id]);
  const prize = createItem(sim.state, def.prize.item, 'relic');
  prize.name = def.prize.name;
  prize.history = [{ day, text: def.prize.story }, { day, text: `Taken by ${fullName(m.s)}.` }];
  sim.items.push(prize);
  say(sim, `${m.s.firstName} takes what it leaves behind: ${def.prize.name}.`, { tone: 'good' });
}

/** Whether a run has anything to tell about the elite: a crew all lost brings nothing home but its death. */
export function eliteNewsMatters(news: EliteNews, outcome: string): boolean {
  return news.killed !== undefined || (outcome !== 'lost' && (news.seen !== undefined || news.fought === true));
}

/** What comes home of it. */
export function eliteNewsHome(news: EliteNews, outcome: string): EliteNews {
  return outcome === 'lost' ? { id: news.id, fought: true, ...(news.killed ? { killed: news.killed } : {}) } : news;
}

/**
 * A crew back with news of an elite (§7.15, 3.12.0): seen for the first time,
 * fought, or brought down. Runs overlap, so it's merged, like nemeses: one
 * already dead stays dead.
 */
export function applyEliteNews(state: GameState, news: EliteNews, day: number, names: (id: string) => string): void {
  const elites = (state.elites ??= {});
  const record = (elites[news.id] ??= { seen: day, status: 'atLarge', fights: 0 });
  if (news.fought) record.fights += 1;
  if (news.killed && record.status !== 'dead') {
    record.status = 'dead';
    record.diedDay = day;
    record.killedBy = { id: news.killed, name: names(news.killed) };
  }
}

/** What the guild knows of a place's elite (§7.15, 3.12.0): nothing yet, at large, or dead. Undefined where none lives. */
export interface EliteStatus {
  def: EnemyDef;
  state: 'unknown' | 'atLarge' | 'dead';
  record?: EliteRecord;
}

export function eliteStatus(state: GameState, placeId: string): EliteStatus | undefined {
  const def = eliteAt(placeId);
  if (!def) return undefined;
  const record = state.elites?.[def.id];
  if (!record) return { def, state: 'unknown' };
  return { def, state: record.status === 'dead' ? 'dead' : 'atLarge', record };
}

/**
 * The next elite whose first sight is still to show (4c, 3.16.0): seen by a crew that's home now, still at
 * large, in the order they were seen. One brought down before the player saw it come on has nothing to show.
 */
export function nextEliteSight(state: GameState): string | undefined {
  const shown = new Set(state.eliteSights ?? []);
  return Object.entries(state.elites ?? {})
    .filter(([id, r]) => r.status === 'atLarge' && !shown.has(id))
    .sort((a, b) => a[1].seen - b[1].seen)[0]?.[0];
}

/** Whether the player has seen an elite's first sight (4c, 3.16.0). */
export function eliteSightShown(state: GameState, id: string): boolean {
  return (state.eliteSights ?? []).includes(id);
}

/** The player has watched an elite's first sight, or skipped it (4c, 3.16.0). */
export function seenEliteSight(state: GameState, id: string): void {
  const shown = (state.eliteSights ??= []);
  if (!shown.includes(id)) shown.push(id);
}

/** Why a crew can't go after a place's elite, if it can't: it has to be known, at large, and the job one that goes looking. */
export function eliteProblem(state: GameState, plan: RunPlan): string | undefined {
  if (!plan.elite) return undefined;
  const status = eliteStatus(state, plan.locationId);
  if (!status || status.state === 'unknown') return 'Nobody has seen anything there worth going after.';
  if (status.state === 'dead') return `${status.def.name} is dead.`;
  if (!ROAMING.includes(plan.job)) return 'Only a crew out scavenging, scouting or hunting goes looking for it.';
  return undefined;
}
