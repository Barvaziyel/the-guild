/**
 * Stories the simulation writes as it goes: nemeses (enemies that put
 * someone down and got away), named weapons, and nicknames. See
 * docs/DESIGN.md §15, step 11. Everything here works on the run's copies;
 * what the guild keeps is applied when the crew is back (applyNemesisNews).
 */
import { addChronicle, addGuildLog } from '../chronicle.ts';
import {
  NAMED_GEAR_KILLS,
  NAMED_GEAR_MILESTONES,
  NEMESIS_APPEAR,
  NEMESIS_ATTACK_BONUS,
  NEMESIS_CHANCE,
  NEMESIS_DEATH_RELIEF,
  NEMESIS_DEFENSE_BONUS,
  NEMESIS_FLEE_CHANCE,
  NEMESIS_FLEE_HP,
  NEMESIS_GRUDGE_BONUS,
  NEMESIS_HP_BONUS,
  NEMESIS_HP_MULT,
  NEMESIS_MAX,
  NEMESIS_MAX_GROWTH,
  STORY_MAX_LINES,
} from '../constants.ts';
import { GEAR, NEMESIS_NAMES, NICKNAMES, WEAPON_NAMES, getEnemy, getLocation, type NicknameRule } from '../content/index.ts';
import { baseItemName, createItem, itemDef, itemName } from '../gear.ts';
import { newId } from '../ids.ts';
import type { Rng } from '../rng.ts';
import { changeStress } from '../stats.ts';
import { fullName } from '../text.ts';
import { hasTrait } from '../traits.ts';
import type { GameState, ItemInstance, Nemesis, NemesisNews, StoryLine, Survivor } from '../types.ts';
import type { Enemy } from './combat.ts';
import { capitalize, dangerEdge, listNames, toughened, say, simDay, stress, withArticle, type Member, type Sim } from './context.ts';

// ---------------------------------------------------------------- names and story lines

/** Every name already in use, so a new one never repeats it. */
export function takenNames(state: GameState): Set<string> {
  const names = new Set<string>();
  const items: ItemInstance[] = [...state.stash];
  for (const s of [...state.survivors, ...state.memorial]) {
    if (s.nickname) names.add(s.nickname);
    items.push(...Object.values(s.equipment).filter((i): i is ItemInstance => i !== undefined));
  }
  for (const i of items) if (i.name) names.add(i.name);
  for (const n of state.nemeses ?? []) names.add(n.name);
  return names;
}

/** A name from the pool nobody has yet ("Widowmaker II" once the pool runs out). */
function freshName(sim: Sim, pool: readonly string[]): string {
  const free = pool.filter((n) => !sim.takenNames.has(n));
  const base = sim.rng.pick(free.length > 0 ? free : pool);
  let name = base;
  for (let n = 2; sim.takenNames.has(name); n++) name = `${base} ${'I'.repeat(Math.min(n, 3))}`;
  sim.takenNames.add(name);
  return name;
}

/** Add a line to a story, keeping where it began and the latest few. */
export function addStory(story: StoryLine[], line: StoryLine): void {
  story.push(line);
  if (story.length > STORY_MAX_LINES) story.splice(1, story.length - STORY_MAX_LINES);
}

const who = (n: Nemesis): string => (getEnemy(n.enemyId).type === 'raider' ? 'who' : 'that');

// ---------------------------------------------------------------- nemeses in a fight

function newsFor(sim: Sim, n: Nemesis): NemesisNews {
  return (sim.nemesisNews[n.id] ??= { id: n.id, downed: [], killed: [], escapes: 0, history: [] });
}

function tell(sim: Sim, n: Nemesis, text: string): void {
  const line = { day: simDay(sim), text };
  addStory(n.history, line);
  const news = newsFor(sim, n);
  if (!news.born) news.history.push(line);
}

function addIds(list: string[], ids: readonly string[]): void {
  for (const id of ids) if (!list.includes(id)) list.push(id);
}

/** The nemesis that joins this fight, if one haunts the place and the dice say so. At most one per run. */
export function nemesisJoins(sim: Sim): Nemesis | undefined {
  if (sim.nemesisMet) return undefined;
  const here = sim.nemeses.find((n) => n.status === 'atLarge' && n.locationId === sim.loc.id);
  if (!here || !sim.rng.chance(NEMESIS_APPEAR)) return undefined;
  sim.nemesisMet = true;
  return here;
}

/** The nemesis as a fighter: tougher than its kind, and worse for every life it has taken. */
export function nemesisEnemy(n: Nemesis, danger = 1): Enemy {
  const def = getEnemy(n.enemyId);
  const tough = toughened(def.hp, def.defense, danger);
  const hp = Math.round(tough.hp * NEMESIS_HP_MULT) + NEMESIS_HP_BONUS;
  const edge = dangerEdge(danger);
  return {
    def,
    hp,
    maxHp: hp,
    attack: def.attack + edge + NEMESIS_ATTACK_BONUS + Math.min(n.killed.length, NEMESIS_MAX_GROWTH),
    damage: def.damage + edge,
    defense: tough.defense + NEMESIS_DEFENSE_BONUS,
    dead: false,
    fled: false,
    downed: [],
    nemesis: n,
  };
}

/** "Old Notch", or "a Rad-hound". */
export function enemyRef(e: Enemy): string {
  return e.nemesis ? e.nemesis.name : withArticle(e.def.name);
}

/** When a nemesis turns up: say who it is, and who remembers it. */
export function announceNemesis(sim: Sim, e: Enemy): void {
  const n = e.nemesis!;
  const back = n.escapes > 1 ? 'Again.' : 'It has been a while.';
  say(sim, `It is ${n.name}, ${withArticle(e.def.name)} the guild knows by name. ${back}`, { tone: 'bad' });
  for (const m of sim.members) {
    if (m.dead || m.down || !n.downed.includes(m.s.id)) continue;
    say(sim, `${m.s.firstName} has not forgotten.`);
  }
}

/** Someone it put down before fights it a little harder. */
export function grudgeBonus(m: Member, e: Enemy): number {
  return e.nemesis?.downed.includes(m.s.id) ? NEMESIS_GRUDGE_BONUS : 0;
}

/** A badly hurt nemesis tries, once a fight, to get away. */
export function maybeNemesisEscape(sim: Sim, e: Enemy): void {
  if (!e.nemesis || e.escapeTried || e.hp > e.maxHp * NEMESIS_FLEE_HP) return;
  e.escapeTried = true;
  if (!sim.rng.chance(NEMESIS_FLEE_CHANCE)) return;
  e.fled = true;
  say(sim, `${capitalize(e.nemesis.name)} breaks off, bleeding, and is gone before anyone can follow.`, { tone: 'bad' });
}

/** A nemesis dies. It will not be back. */
export function nemesisKilled(sim: Sim, m: Member, e: Enemy, how: string): void {
  const n = e.nemesis!;
  const day = simDay(sim);
  n.status = 'dead';
  n.diedDay = day;
  n.killedBy = m.s.id;
  newsFor(sim, n).killedBy = m.s.id;
  tell(sim, n, `Killed by ${fullName(m.s)} at ${sim.loc.name}.`);
  m.tally.nemesisKills += 1;
  m.killedNemesis = n.name;
  say(sim, `${m.s.firstName} kills ${n.name} ${how}. That one will not be back.`, { tone: 'good' });
  addChronicle(m.s, day, `Killed ${n.name} at ${sim.loc.name}.`, ['nemesis', n.id]);
  for (const other of sim.members) {
    if (other === m || other.dead || !n.downed.includes(other.s.id)) continue;
    addChronicle(other.s, day, `Saw ${n.name} die at ${sim.loc.name}.`, ['nemesis', n.id]);
    stress(sim, other, -NEMESIS_DEATH_RELIEF);
  }
  const weapon = m.s.equipment.weapon;
  if (weapon?.name) addStory((weapon.history ??= []), { day, text: `Killed ${n.name} at ${sim.loc.name}, in ${fullName(m.s)}'s hands.` });

  // What it hoarded: a Relic (§7.6).
  const def = sim.rng.weightedBy(
    GEAR.filter((g) => g.slot === 'weapon' || g.slot === 'armor'),
    (g) => g.lootWeight,
  );
  const relic = createItem(sim.state, def.id, 'relic');
  sim.items.push(relic);
  say(sim, `Among what ${n.name} hoarded, ${m.s.firstName} finds something old and fine: ${itemName(relic)}.`, { tone: 'good' });
}

/** Someone a nemesis put down did not get up. */
export function nemesisKilledSomeone(sim: Sim, nemesisId: string, m: Member): void {
  const n = sim.nemeses.find((x) => x.id === nemesisId);
  if (!n) return;
  addIds(n.killed, [m.s.id]);
  addIds(newsFor(sim, n).killed, [m.s.id]);
  tell(sim, n, `Killed ${fullName(m.s)} at ${sim.loc.name}.`);
}

/**
 * After a fight: a nemesis that lived got away again, and an enemy that put
 * someone down and lived may become one.
 */
export function afterFight(sim: Sim, enemies: readonly Enemy[]): void {
  const day = simDay(sim);
  const place = sim.loc.name;

  for (const e of enemies) {
    const n = e.nemesis;
    if (!n || e.dead) continue;
    const downed = e.downed.map((m) => m.s.id);
    n.escapes += 1;
    addIds(n.downed, downed);
    const news = newsFor(sim, n);
    news.escapes += 1;
    addIds(news.downed, downed);
    tell(sim, n, downed.length > 0 ? `Put ${listNames(e.downed.map((m) => fullName(m.s)))} down at ${place}, and got away again.` : `Got away from the guild at ${place} again.`);
    for (const m of e.downed) addChronicle(m.s, day, `Put down by ${n.name} at ${place}. ${n.name} got away again.`, ['nemesis', n.id]);
  }

  const candidates = enemies.filter((e) => !e.nemesis && !e.dead && e.downed.length > 0);
  if (candidates.length === 0) return;
  if (sim.nemeses.filter((n) => n.status === 'atLarge').length >= NEMESIS_MAX) return;
  if (!sim.rng.chance(NEMESIS_CHANCE)) return;

  const e = candidates.reduce((a, b) => (b.downed.length > a.downed.length ? b : a));
  const n: Nemesis = {
    id: newId(sim.state, 'n'),
    name: freshName(sim, NEMESIS_NAMES[e.def.type]),
    enemyId: e.def.id,
    locationId: sim.loc.id,
    status: 'atLarge',
    downed: e.downed.map((m) => m.s.id),
    killed: [],
    escapes: 1,
    bornDay: day,
    history: [{ day, text: `Put ${listNames(e.downed.map((m) => fullName(m.s)))} down at ${place}, and got away.` }],
  };
  sim.nemeses.push(n);
  sim.nemesisMet = true;
  sim.nemesisNews[n.id] = { id: n.id, born: n, downed: [], killed: [], escapes: 0, history: [] };
  const kind = withArticle(e.def.name);
  say(sim, `${kind[0]!.toUpperCase()}${kind.slice(1)} ${who(n)} put ${listNames(e.downed.map((m) => m.s.firstName))} down gets away. The guild will remember. From now on, that one is ${n.name}.`, { tone: 'bad' });
  for (const m of e.downed) {
    addChronicle(m.s, day, `Put down at ${place} by ${kind} ${who(n)} got away. The guild calls it ${n.name} now.`, ['nemesis', n.id]);
    // If this proves fatal, the guild will say who did it.
    if (m.woundPending) m.woundPending = { ...m.woundPending, cause: n.name, nemesisId: n.id };
  }
}

/** What the run did to the guild's nemeses, for the result. */
export function nemesisNewsList(sim: Sim): NemesisNews[] {
  return Object.values(sim.nemesisNews);
}

// ---------------------------------------------------------------- after the run: weapons and nicknames

/** A weapon with enough kills earns a name; a named one marks its milestones. */
export function nameWeapon(sim: Sim, m: Member): void {
  const w = m.s.equipment.weapon;
  if (!w) return;
  const kills = w.kills ?? 0;
  const day = simDay(sim);
  const holder = fullName(m.s);
  if (!w.name) {
    if (kills < NAMED_GEAR_KILLS) return;
    const base = baseItemName(w);
    w.name = freshName(sim, WEAPON_NAMES[itemDef(w).weaponType === 'ranged' ? 'ranged' : 'melee']);
    const which = kills === NAMED_GEAR_KILLS ? 'its tenth kill' : `${kills} kills`;
    w.history = [{ day, text: `Named after ${which}, in ${holder}'s hands at ${sim.loc.name}.` }];
    addChronicle(m.s, day, `Carried the ${base} to ${which}. The guild calls it ${w.name} now.`, ['named-gear']);
    say(sim, `${m.s.firstName}'s ${base} has ${kills} kills now, and has earned a name: ${w.name}.`, { tone: 'good' });
    return;
  }
  for (const mark of NAMED_GEAR_MILESTONES) {
    if (m.weaponKillsAtStart < mark && kills >= mark) addStory((w.history ??= []), { day, text: `Kill number ${mark}, in ${holder}'s hands at ${sim.loc.name}.` });
  }
}

function nicknameFits(m: Member, rule: NicknameRule): boolean {
  for (const [counter, min] of Object.entries(rule.counters ?? {}) as [keyof Survivor['counters'], number][]) {
    if ((m.s.counters[counter] as number) < min) return false;
  }
  if (rule.trait && !hasTrait(m.s, rule.trait)) return false;
  if (rule.needs && !(m.tally[rule.needs] > 0)) return false;
  return true;
}

/** Someone without a nickname may earn one from what they have done. */
export function earnNickname(sim: Sim, m: Member, rules: readonly NicknameRule[] = NICKNAMES): void {
  if (m.s.nickname) return;
  for (const rule of rules) {
    if (!nicknameFits(m, rule) || !sim.rng.chance(rule.chance)) continue;
    const nick = freshName(sim, rule.names);
    m.s.nickname = nick;
    const why = rule.why.replace('{nemesis}', m.killedNemesis ?? 'a nemesis');
    addChronicle(m.s, simDay(sim), `Earned a name: "${nick}", ${why}.`, ['nickname']);
    say(sim, `Word gets around. ${m.s.firstName} is "${nick}" now.`, { tone: 'good' });
    return;
  }
}

// ---------------------------------------------------------------- back at the Depot

/**
 * Apply what a run did to the guild's nemeses. Runs can overlap, so news is
 * merged into the nemesis as it stands now; a nemesis already dead stays dead.
 */
export function applyNemesisNews(state: GameState, news: NemesisNews, crew: readonly Survivor[], day: number, rng: Rng): void {
  state.nemeses ??= [];
  if (news.born) {
    if (state.nemeses.some((n) => n.id === news.id)) return;
    const n = structuredClone(news.born);
    state.nemeses.push(n);
    const kind = withArticle(getEnemy(n.enemyId).name);
    addGuildLog(state, day, `${capitalize(n.name)}, ${kind} ${who(n)} put ${listNames(n.downed.map((id) => nameOf(state, crew, id)))} down, haunts ${getLocation(n.locationId).name} now.`, ['nemesis', n.id]);
    return;
  }
  const n = state.nemeses.find((x) => x.id === news.id);
  if (!n || n.status === 'dead') return;
  addIds(n.downed, news.downed);
  addIds(n.killed, news.killed);
  n.escapes += news.escapes;
  for (const line of news.history) addStory(n.history, line);
  if (!news.killedBy) return;

  n.status = 'dead';
  n.diedDay = day;
  n.killedBy = news.killedBy;
  const killer = nameOf(state, crew, news.killedBy);
  addGuildLog(state, day, `${killer} killed ${n.name} at ${getLocation(n.locationId).name}.`, ['nemesis', n.id]);
  // Those at home it once put down hear the news.
  for (const s of state.survivors) {
    if (!n.downed.includes(s.id) || crew.some((c) => c.id === s.id)) continue;
    addChronicle(s, day, `Heard that ${n.name} is dead. ${killer} saw to it.`, ['nemesis', n.id]);
    changeStress(s, -NEMESIS_DEATH_RELIEF, { rng, day });
  }
}

function nameOf(state: GameState, crew: readonly Survivor[], id: string): string {
  const s = crew.find((c) => c.id === id) ?? state.survivors.find((c) => c.id === id) ?? state.memorial.find((c) => c.id === id);
  return s ? fullName(s) : 'someone';
}
