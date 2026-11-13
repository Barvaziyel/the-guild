/**
 * The Vultures (§7.11): another scavenger guild that works the Reach. They
 * have a standing with the guild (war to trading partners), a strength that
 * grows and shrinks, camps at places in the Reach, and named people: a boss
 * and lieutenants, who can be met, fought, captured, and even won over.
 *
 * They compete for places (thinner finds and meetings in their turf), people
 * (unanswered calls and people left waiting at the gate), outposts (raids on
 * the guild's, and camps of theirs to hit) and traders (smaller swaps). Their
 * envoys come to the gate as decisions (`content/dilemmas.ts`). Runs record
 * what they did to them as `VultureNews`, applied when the crew is back.
 */
import { addGuildLog } from './chronicle.ts';
import {
  VULTURES_ARRIVE_DAY,
  VULTURES_BOSS_STRENGTH,
  VULTURES_CAMP_GAP,
  VULTURES_CAMP_HOLD,
  VULTURES_CAMP_STRENGTH,
  VULTURES_ESCAPE_CHANCE,
  VULTURES_GONE_DAYS,
  VULTURES_GROWTH,
  VULTURES_HOME_DANGER,
  VULTURES_JOIN_CHANCE,
  VULTURES_LIEUTENANTS,
  VULTURES_LIEUTENANT_STRENGTH,
  VULTURES_MAX_STRENGTH,
  VULTURES_OUTPOST_RAID,
  VULTURES_PROMOTION_DAYS,
  VULTURES_RAID_PER_STRENGTH,
  VULTURES_RANSOM,
  VULTURES_RANSOM_STANDING,
  VULTURES_RECRUIT_STANDING,
  VULTURES_RELEASE_STANDING,
  VULTURES_RETURN_STRENGTH,
  VULTURES_START_STANDING,
  VULTURES_START_STRENGTH,
  VULTURES_STRENGTH_PER_CAMP,
  VULTURES_TAKEN_STRENGTH,
  VULTURES_TAKE_CHANCE,
  VULTURES_TRADE,
  VULTURES_TRADE_CUT,
  VULTURES_TRUCE,
  VULTURES_WAR,
  YEAR_DAYS,
} from './constants.ts';
import { LOCATIONS, getLocation } from './content/index.ts';
import { atDepot, hasFreeBunk } from './depot/buildings.ts';
import { dayAt, recruit, withRng } from './game.ts';
import { generateSurvivor } from './generator.ts';
import { ensureLocationState, locationState } from './locations.ts';
import { raidOutpost } from './outposts.ts';
import { relationshipLabel } from './relationships.ts';
import type { Rng } from './rng.ts';
import { fullName } from './text.ts';
import type { GameState, StoryLine, Survivor, VultureCamp, VultureMember, VultureNews, VulturesState } from './types.ts';

export type VultureBand = 'war' | 'wary' | 'truce' | 'trade';

export const BAND_NAMES: Record<VultureBand, string> = {
  war: 'At war',
  wary: 'Wary',
  truce: 'Truce',
  trade: 'Trading partners',
};

/** A guild that hasn't met the Vultures yet. */
export function newVultures(arriveDay = VULTURES_ARRIVE_DAY): VulturesState {
  return {
    arriveDay,
    arrived: false,
    standing: VULTURES_START_STANDING,
    strength: VULTURES_START_STRENGTH,
    camps: [],
    people: [],
    nextCampDay: arriveDay,
    nextEnvoyDay: arriveDay + 1,
  };
}

// ---------------------------------------------------------------- reading

/** The band a standing falls in. */
export function bandOf(standing: number): VultureBand {
  if (standing <= VULTURES_WAR) return 'war';
  if (standing >= VULTURES_TRADE) return 'trade';
  if (standing >= VULTURES_TRUCE) return 'truce';
  return 'wary';
}

export function vultureBand(state: GameState): VultureBand {
  return bandOf(state.vultures.standing);
}

/** In the Reach now: arrived, and not driven out. */
export function vulturesActive(state: GameState): boolean {
  return state.vultures.arrived && state.vultures.camps.length > 0;
}

/** How many camps their strength holds: their home, and one more for every 35. */
export function campsFor(strength: number): number {
  return 1 + Math.floor(strength / VULTURES_STRENGTH_PER_CAMP);
}

/** Places next to this one, either way along the roads. */
export function neighbours(locationId: string): string[] {
  const out = new Set(getLocation(locationId).leadsTo);
  for (const l of LOCATIONS) if (l.leadsTo.includes(locationId)) out.add(l.id);
  return [...out];
}

/** Their turf: their camps' places and the places next to those. */
export function turf(state: GameState): string[] {
  if (!vulturesActive(state)) return [];
  const out = new Set<string>();
  for (const c of state.vultures.camps) {
    out.add(c.locationId);
    for (const n of neighbours(c.locationId)) out.add(n);
  }
  return [...out];
}

export function onTurf(state: GameState, locationId: string): boolean {
  return turf(state).includes(locationId);
}

export function campAt(state: GameState, locationId: string): VultureCamp | undefined {
  return vulturesActive(state) ? state.vultures.camps.find((c) => c.locationId === locationId) : undefined;
}

export function vultureMember(state: GameState, id: string): VultureMember | undefined {
  return state.vultures.people.find((m) => m.person.id === id);
}

/** Who holds a camp: the boss at their home, or the lieutenant posted there. */
export function campLeader(state: GameState, camp: VultureCamp): VultureMember | undefined {
  return state.vultures.people.find((m) => m.status === 'free' && m.campId === camp.locationId);
}

export function vultureBoss(state: GameState): VultureMember | undefined {
  return state.vultures.people.find((m) => m.role === 'boss' && m.status === 'free');
}

export function freeLieutenants(state: GameState): VultureMember[] {
  return state.vultures.people.filter((m) => m.role === 'lieutenant' && m.status === 'free');
}

/** The guild's prisoners. */
export function prisoners(state: GameState): VultureMember[] {
  return state.vultures.people.filter((m) => m.status === 'captured');
}

/** Caravan swaps while the Vultures cut into the trade: smaller by a quarter of their strength, in percent. */
export function tradeCut(state: GameState): number {
  if (!vulturesActive(state) || vultureBand(state) === 'trade') return 1;
  return 1 - state.vultures.strength / VULTURES_TRADE_CUT;
}

/** "Mara Voss, their boss", "Tam Reyes, a lieutenant". */
export function memberTitle(m: VultureMember): string {
  return `${fullName(m.person)}, ${m.role === 'boss' ? 'their boss' : 'a lieutenant'}`;
}

// ---------------------------------------------------------------- changing

/** Standing up or down, kept between −100 and 100. A change of band goes in the news. */
export function changeStanding(state: GameState, amount: number, day: number): void {
  const v = state.vultures;
  const before = bandOf(v.standing);
  v.standing = Math.max(-100, Math.min(100, Math.round(v.standing + amount)));
  const after = bandOf(v.standing);
  if (before === after || !v.arrived) return;
  const line: Record<VultureBand, string> = {
    war: 'The Vultures are at war with the guild now.',
    wary: 'Things with the Vultures have gone back to wary.',
    truce: 'The guild and the Vultures have a truce now.',
    trade: 'The Vultures count the guild as trading partners now.',
  };
  addGuildLog(state, day, line[after], ['vultures']);
}

export function changeStrength(state: GameState, amount: number): void {
  const v = state.vultures;
  v.strength = Math.max(0, Math.min(VULTURES_MAX_STRENGTH, v.strength + amount));
}

/** A line in a member's history. */
export function noteMember(m: VultureMember, day: number, text: string): void {
  const line: StoryLine = { day, text };
  m.history.push(line);
}

/** Someone new for the Vultures: a person made like a survivor. */
export function makeMember(state: GameState, rng: Rng, day: number, role: VultureMember['role']): VultureMember {
  const person = generateSurvivor(state, rng, { day, hiddenTraitChance: 0 });
  person.age = Math.max(person.age, role === 'boss' ? 35 : 24);
  // Born a year ago at the latest, so ages and birthdays read right if they ever join.
  person.nextBirthday = day + 1 + (person.appearance.seed % YEAR_DAYS);
  const m: VultureMember = { person, role, status: 'free', met: false, history: [] };
  state.vultures.people.push(m);
  return m;
}

/** They take someone in: an unanswered call, someone left waiting at the gate. */
export function vulturesTake(state: GameState, who: Survivor, day: number, line: string): void {
  changeStrength(state, VULTURES_TAKEN_STRENGTH);
  addGuildLog(state, day, line.replace('{name}', fullName(who)), ['vultures']);
}

/** Whether the Vultures get someone the guild let go: an unanswered call, someone left waiting. */
export function vulturesGet(state: GameState, rng: Rng): boolean {
  return vulturesActive(state) && vultureBand(state) !== 'trade' && rng.chance(VULTURES_TAKE_CHANCE);
}

// ---------------------------------------------------------------- a day in the Reach

/** Their day: arriving, growing, camps, new lieutenants, prisoners, raids on the guild's outposts. */
export function playVulturesDay(state: GameState, day: number, rng: Rng): void {
  const v = state.vultures;
  if (!v.arrived) {
    if (day >= v.arriveDay) arrive(state, day, rng);
    return;
  }
  prisonersDay(state, day, rng);
  if (v.camps.length === 0) {
    if (v.returnDay !== undefined && day >= v.returnDay) comeBack(state, day, rng);
    return;
  }
  changeStrength(state, VULTURES_GROWTH);
  campsDay(state, day, rng);
  promotionsDay(state, day, rng);
  outpostRaids(state, day, rng);
}

/** Where they set up first: a danger-3 or 4 place, not where the guild has an outpost. */
function homePlace(state: GameState, rng: Rng): string {
  const taken = new Set(state.outposts.map((o) => o.locationId));
  const options = LOCATIONS.filter((l) => l.danger >= VULTURES_HOME_DANGER[0] && l.danger <= VULTURES_HOME_DANGER[1] && !taken.has(l.id) && l.id !== 'red_hand_camp');
  return rng.pick(options.length > 0 ? options : LOCATIONS.filter((l) => l.danger >= 3)).id;
}

function arrive(state: GameState, day: number, rng: Rng): void {
  const v = state.vultures;
  v.arrived = true;
  const home = homePlace(state, rng);
  v.camps = [{ locationId: home, since: day, home: true }];
  const boss = makeMember(state, rng, day, 'boss');
  boss.campId = home;
  for (let i = 0; i < VULTURES_LIEUTENANTS; i++) makeMember(state, rng, day, 'lieutenant');
  v.nextCampDay = day + rng.int(VULTURES_CAMP_GAP[0], VULTURES_CAMP_GAP[1]);
  v.nextEnvoyDay = day + 1;
  ensureLocationState(state, home).discovered = true;
  addGuildLog(
    state,
    day,
    `Word on the radio: a crew calling themselves the Vultures has set up at ${getLocation(home).name}. They work the Reach the way the guild does, and ${fullName(boss.person)} runs them.`,
    ['vultures', home],
  );
}

/** Back after being driven out, under a new boss. */
function comeBack(state: GameState, day: number, rng: Rng): void {
  const v = state.vultures;
  const home = homePlace(state, rng);
  v.camps = [{ locationId: home, since: day, home: true }];
  v.strength = VULTURES_RETURN_STRENGTH;
  delete v.returnDay;
  const boss = makeMember(state, rng, day, 'boss');
  boss.campId = home;
  for (const m of freeLieutenants(state)) m.campId = home;
  v.nextCampDay = day + rng.int(VULTURES_CAMP_GAP[0], VULTURES_CAMP_GAP[1]);
  ensureLocationState(state, home).discovered = true;
  addGuildLog(state, day, `The Vultures are back, at ${getLocation(home).name}, under a new boss: ${fullName(boss.person)}.`, ['vultures', home]);
}

function campsDay(state: GameState, day: number, rng: Rng): void {
  const v = state.vultures;
  // Too weak to hold them all: the newest camp is given up.
  if (v.camps.length > 1 && v.strength <= VULTURES_CAMP_HOLD * (v.camps.length - 1)) {
    const lost = v.camps.filter((c) => !c.home).sort((a, b) => b.since - a.since)[0]!;
    v.camps = v.camps.filter((c) => c !== lost);
    const home = v.camps.find((c) => c.home) ?? v.camps[0]!;
    for (const m of state.vultures.people) if (m.campId === lost.locationId) m.campId = home.locationId;
    if (locationState(state, lost.locationId).discovered) addGuildLog(state, day, `The Vultures gave up their camp at ${getLocation(lost.locationId).name}.`, ['vultures', lost.locationId]);
    return;
  }
  if (v.camps.length >= campsFor(v.strength) || day < v.nextCampDay) return;
  v.nextCampDay = day + rng.int(VULTURES_CAMP_GAP[0], VULTURES_CAMP_GAP[1]);
  const held = new Set(v.camps.map((c) => c.locationId));
  const outposts = new Set(state.outposts.map((o) => o.locationId));
  const options = [...new Set(v.camps.flatMap((c) => neighbours(c.locationId)))].filter(
    (id) => !held.has(id) && !outposts.has(id) && getLocation(id).danger >= 2,
  );
  if (options.length === 0) return;
  const place = rng.pick(options);
  v.camps.push({ locationId: place, since: day });
  const lt = freeLieutenants(state).find((m) => !m.campId || m.campId === v.camps.find((c) => c.home)?.locationId);
  if (lt) lt.campId = place;
  if (locationState(state, place).discovered) {
    addGuildLog(state, day, `The Vultures set up a camp at ${getLocation(place).name}${lt ? `, with ${fullName(lt.person)} in charge` : ''}.`, ['vultures', place]);
  }
}

/** A lost boss is replaced by a lieutenant at once; lost lieutenants, after a while. */
function promotionsDay(state: GameState, day: number, rng: Rng): void {
  const v = state.vultures;
  const home = v.camps.find((c) => c.home) ?? v.camps[0]!;
  if (!vultureBoss(state)) {
    const next = freeLieutenants(state)[0] ?? makeMember(state, rng, day, 'lieutenant');
    next.role = 'boss';
    next.campId = home.locationId;
    home.home = true;
    addGuildLog(state, day, `${fullName(next.person)} runs the Vultures now.`, ['vultures']);
  }
  if (freeLieutenants(state).length >= VULTURES_LIEUTENANTS) {
    delete v.nextPromotionDay;
    return;
  }
  if (v.nextPromotionDay === undefined) {
    v.nextPromotionDay = day + rng.int(VULTURES_PROMOTION_DAYS[0], VULTURES_PROMOTION_DAYS[1]);
    return;
  }
  if (day < v.nextPromotionDay) return;
  delete v.nextPromotionDay;
  const lt = makeMember(state, rng, day, 'lieutenant');
  const empty = v.camps.find((c) => !campLeader(state, c));
  lt.campId = (empty ?? home).locationId;
}

/** Prisoners eat, and now and then slip out. */
function prisonersDay(state: GameState, day: number, rng: Rng): void {
  for (const m of prisoners(state)) {
    state.resources.rations = Math.max(0, state.resources.rations - 1);
    if (!rng.chance(VULTURES_ESCAPE_CHANCE)) continue;
    m.status = 'free';
    const home = state.vultures.camps.find((c) => c.home) ?? state.vultures.camps[0];
    if (home) m.campId = home.locationId;
    else delete m.campId;
    noteMember(m, day, 'Slipped out of the Depot in the night.');
    addGuildLog(state, day, `${fullName(m.person)} slipped out of the Depot in the night, back to the Vultures.`, ['vultures', m.person.id]);
  }
}

/** At war, or wary, they hit the guild's outposts in their turf. */
function outpostRaids(state: GameState, day: number, rng: Rng): void {
  const band = vultureBand(state);
  const chance = band === 'war' ? VULTURES_OUTPOST_RAID[0] : band === 'wary' ? VULTURES_OUTPOST_RAID[1] : 0;
  if (chance <= 0) return;
  const theirs = new Set(turf(state));
  for (const o of [...state.outposts]) {
    if (!theirs.has(o.locationId) || !rng.chance(chance)) continue;
    raidOutpost(state, o, day, rng, { name: 'The Vultures', lower: 'the Vultures', dc: Math.round(state.vultures.strength * VULTURES_RAID_PER_STRENGTH) });
  }
}

// ---------------------------------------------------------------- back from a run

/** What a run did to the Vultures. Runs overlap, so news is merged into how things stand now. */
export function applyVultureNews(state: GameState, news: VultureNews, day: number, rng: Rng): void {
  const v = state.vultures;
  for (const { id, line } of news.history) vultureMember(state, id)?.history.push(line);
  for (const id of news.met) {
    const m = vultureMember(state, id);
    if (m) m.met = true;
  }
  if (news.standing) changeStanding(state, news.standing, day);
  if (news.strength) changeStrength(state, news.strength);
  for (const id of news.killed) {
    const m = vultureMember(state, id);
    if (!m || m.status !== 'free') continue;
    m.status = 'dead';
    delete m.campId;
    changeStrength(state, m.role === 'boss' ? VULTURES_BOSS_STRENGTH : VULTURES_LIEUTENANT_STRENGTH);
  }
  for (const id of news.captured) {
    const m = vultureMember(state, id);
    if (!m || m.status !== 'free') continue;
    m.status = 'captured';
    delete m.campId;
    changeStrength(state, m.role === 'boss' ? VULTURES_BOSS_STRENGTH : VULTURES_LIEUTENANT_STRENGTH);
    addGuildLog(state, day, `${fullName(m.person)} of the Vultures is the guild's prisoner now. See the Vultures screen.`, ['vultures', m.person.id]);
  }
  if (news.campTaken) loseCamp(state, news.campTaken, day, rng);
}

/** A camp taken by the guild. Their home: they fall back, or with nowhere left, leave the Reach for a while. */
export function loseCamp(state: GameState, locationId: string, day: number, rng: Rng): void {
  const v = state.vultures;
  const camp = v.camps.find((c) => c.locationId === locationId);
  if (!camp) return;
  v.camps = v.camps.filter((c) => c !== camp);
  changeStrength(state, VULTURES_CAMP_STRENGTH);
  for (const m of v.people) if (m.campId === locationId) delete m.campId;
  const place = getLocation(locationId).name;
  if (v.camps.length === 0) {
    v.returnDay = day + rng.int(VULTURES_GONE_DAYS[0], VULTURES_GONE_DAYS[1]);
    for (const m of freeLieutenants(state)) delete m.campId;
    addGuildLog(state, day, `With ${place} taken, the Vultures have left the Reach. Nobody thinks it's for good.`, ['vultures', locationId]);
    return;
  }
  if (camp.home) v.camps[0]!.home = true;
  const home = v.camps.find((c) => c.home)!;
  for (const m of v.people) if (m.status === 'free' && !m.campId) m.campId = home.locationId;
  addGuildLog(state, day, `The guild took the Vultures' camp at ${place}.${camp.home ? ` They've fallen back to ${getLocation(home.locationId).name}.` : ''}`, ['vultures', locationId]);
}

// ---------------------------------------------------------------- prisoners

export type PrisonerAction = 'release' | 'ransom' | 'recruit';

/** Why this can't be done with this prisoner now, if it can't. */
export function prisonerProblem(state: GameState, id: string, action: PrisonerAction): string | undefined {
  const m = vultureMember(state, id);
  if (!m || m.status !== 'captured') return 'They are not the guild\'s prisoner.';
  if (action === 'ransom' && !vulturesActive(state)) return 'There is nobody to trade them back to.';
  if (action === 'recruit' && !hasFreeBunk(state)) return 'There is no bed for them.';
  return undefined;
}

/** The chance a prisoner joins when asked: better with friends at the Depot (from their time as prisoner) and a softer standing. */
export function joinChance(state: GameState, id: string): number {
  const friends = state.survivors.filter(atDepot).filter((s) => ['friend', 'bonded'].includes(relationshipLabel(state, s.id, id))).length;
  return Math.min(0.75, VULTURES_JOIN_CHANCE + 0.1 * friends + (vultureBand(state) === 'war' ? -0.1 : 0));
}

/**
 * Do something with a prisoner. Returns what happened, for the screen. Throws
 * when it can't be done.
 */
export function decidePrisoner(state: GameState, id: string, action: PrisonerAction, now: number): string {
  const problem = prisonerProblem(state, id, action);
  if (problem) throw new Error(problem);
  const day = dayAt(state, now);
  const m = vultureMember(state, id)!;
  const name = fullName(m.person);
  return withRng(state, (rng) => {
    const home = state.vultures.camps.find((c) => c.home) ?? state.vultures.camps[0];
    const goHome = (): void => {
      m.status = 'free';
      if (home) m.campId = home.locationId;
    };
    if (action === 'release') {
      goHome();
      changeStanding(state, VULTURES_RELEASE_STANDING, day);
      noteMember(m, day, 'Let go by the guild, and walked home.');
      const text = `${name} was let go, and walked back to the Vultures.`;
      addGuildLog(state, day, text, ['vultures', id]);
      return text;
    }
    if (action === 'ransom') {
      goHome();
      changeStanding(state, VULTURES_RANSOM_STANDING, day);
      for (const [r, n] of Object.entries(VULTURES_RANSOM)) state.resources[r as 'scrap' | 'tech'] += n;
      noteMember(m, day, 'Traded back to the Vultures by the guild.');
      const text = `The Vultures paid ${VULTURES_RANSOM.scrap} scrap and ${VULTURES_RANSOM.tech} tech to have ${name} back.`;
      addGuildLog(state, day, text, ['vultures', id]);
      return text;
    }
    // Asked to join.
    changeStanding(state, VULTURES_RECRUIT_STANDING, day);
    if (!rng.chance(joinChance(state, id))) {
      noteMember(m, day, 'Asked to join the guild, and said no.');
      const text = `${name} said no. The Vultures heard about the asking.`;
      addGuildLog(state, day, text, ['vultures', id]);
      return text;
    }
    m.status = 'joined';
    noteMember(m, day, 'Left the Vultures and joined the guild.');
    const s = m.person;
    s.status = 'ready';
    s.stress = Math.min(s.stress, 30);
    recruit(state, s, rng, day, 'Left the Vultures and joined the guild.');
    return `${name} joined the guild.`;
  });
}
