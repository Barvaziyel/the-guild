/**
 * What the Depot screens show: buildings with live numbers, posts, recruits,
 * trades and the "while you were away" note. No React, so it can be tested in Node.
 */
import {
  BUILDING_IDS,
  MAX_BUILDING_LEVEL,
  RESOURCE_IDS,
  RECIPES,
  STAT_IDS,
  STAT_MAX,
  TRAINING_PRACTICE,
  WATCHTOWER_DEFENSE,
  atDepot,
  boardSize,
  buildProblem,
  buildingDef,
  buildingLevel,
  buildingName,
  bunksCap,
  costText,
  craftProblem,
  dailyUpkeep,
  effectiveStat,
  firepitRelief,
  gardenYield,
  guildUpkeep,
  getGear,
  getProject,
  getLocation,
  healRate,
  itemName,
  nextLevel,
  postBuilding,
  postProblem,
  postStat,
  postedTo,
  projectTitle,
  pronounForms,
  resting,
  statName,
  upgradeFor,
  upgradeProblem,
  workerSlots,
  workingAt,
  workingLevel,
  workshopItems,
  upkeepOf,
  RADIO_REVEAL_PER_LEVEL,
  RADIO_REVEAL_PER_WITS,
  REST_RELIEF,
  type BuildingId,
  type Candidate,
  type DepotSummary,
  type ResourceId,
  type Resources,
  type GameState,
  type ItemInstance,
  type StatId,
  type Survivor,
} from '../engine/index.ts';
import { itemStats } from './view.ts';

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------- buildings

/** One line of live numbers for a building: what it's doing right now. */
export function buildingStatus(state: GameState, id: BuildingId): string {
  const level = buildingLevel(state, id);
  if (level === 0) return 'Not built yet.';
  switch (id) {
    case 'bunks':
      return `${state.survivors.length} of ${bunksCap(state)} beds taken.`;
    case 'garden':
      return `Grows about ${oneDecimal(gardenYield(state))} rations a day. The guild at home${state.outposts.length > 0 ? ' and at the outposts' : ''} eats ${dailyUpkeep(state)}.`;
    case 'firepit':
      return `Everyone at home sheds about ${Math.round(REST_RELIEF + firepitRelief(state))} stress a day.`;
    case 'infirmary':
      return `Everyone at home heals about ${Math.round(healRate(state) * 100)}% of their health a day.`;
    case 'workshop': {
      const n = workingAt(state, id).length;
      return n === 0 ? 'Nobody is making ammo. Gear can still be made and improved.' : `${n} ${n === 1 ? 'person turns' : 'people turn'} scrap into ammo each day.`;
    }
    case 'radio_tower': {
      const wits = sum(workingAt(state, id).map((s) => effectiveStat(s, 'wits')));
      const pct = Math.round((RADIO_REVEAL_PER_LEVEL * workingLevel(state, id) + RADIO_REVEAL_PER_WITS * wits) * 100);
      return `${boardSize(state)} recruits at the gate each day. A ${pct}% chance each day of hearing about a new place.`;
    }
    case 'watchtower':
      return `Adds ${workingLevel(state, id) * WATCHTOWER_DEFENSE + workingAt(state, id).length} to holding off raiders, and halves what they take.`;
    case 'training_yard':
      return `${TRAINING_PRACTICE[level]} practice a day for each person training.`;
  }
}

export interface BuildingRow {
  id: BuildingId;
  name: string;
  level: number;
  built: boolean;
  maxed: boolean;
  description: string;
  /** What the current level does (or the first level, if unbuilt). */
  effect: string;
  status: string;
  /** What it uses up a day at this level, if anything: "Uses 1 ration a day." */
  upkeep?: string;
  /** Set when the upkeep couldn't be paid on the last day: it works a level lower. */
  unpaid?: string;
  /** Next level's effect and cost, if there is one. */
  next?: { effect: string; cost: string; problem?: string };
  workers: Survivor[];
  slots: number;
}

export function buildingRow(state: GameState, id: BuildingId): BuildingRow {
  const def = buildingDef(id);
  const level = buildingLevel(state, id);
  const next = nextLevel(state, id);
  const problem = buildProblem(state, id);
  return {
    id,
    name: buildingName(state, id),
    level,
    built: level > 0,
    maxed: level >= MAX_BUILDING_LEVEL,
    description: def.description,
    effect: (def.levels[Math.max(0, level - 1)] ?? def.levels[0]!).effect,
    status: buildingStatus(state, id),
    ...upkeepLines(state, id),
    ...(next ? { next: { effect: next.effect, cost: costText(next.cost), ...(problem ? { problem } : {}) } } : {}),
    workers: postedTo(state, id),
    slots: workerSlots(state, id),
  };
}

const ONE: Record<ResourceId, string> = { scrap: 'scrap', rations: 'ration', meds: 'med', ammo: 'ammo', tech: 'tech', gas: 'gas' };

/** "Uses 2 rations a day.", "Uses a med about every 4 days.", and whether it ran short on the last day. */
export function upkeepLines(state: GameState, id: BuildingId): { upkeep?: string; unpaid?: string } {
  const u = upkeepOf(state, id);
  if (!u) return {};
  const upkeep =
    u.amount === 1
      ? `Uses 1 ${ONE[u.res]} a day.`
      : u.amount > 1
        ? `Uses ${costText({ [u.res]: u.amount })} a day.`
        : `Uses ${u.res === 'ammo' || u.res === 'tech' ? 'some' : 'a'} ${ONE[u.res]} about every ${Math.round(1 / u.amount)} days.`;
  const lower = Math.max(0, buildingLevel(state, id) - 1);
  if (state.depot.unpaid?.includes(id)) return { upkeep, unpaid: `Ran out of ${u.res} on the last day, so it worked as level ${lower}.` };
  if (state.resources[u.res] < Math.ceil(u.amount)) return { upkeep, unpaid: `Out of ${u.res}: it works as level ${lower} on days it can't be kept going.` };
  return { upkeep };
}

export function buildingRows(state: GameState): BuildingRow[] {
  return BUILDING_IDS.map((id) => buildingRow(state, id));
}

/** A worker's line on a building screen: "Wits 5", plus why they aren't working today. */
export function workerLine(state: GameState, s: Survivor): { stat: string; away?: string } {
  const stat = !s.post ? 'wits' : 'project' in s.post ? getProject(s.post.project).workStat : postStat(s, s.post);
  const away = !atDepot(s) ? 'Out on a run.' : resting(s) ? 'Resting until healed.' : undefined;
  return { stat: `${statName(stat)} ${effectiveStat(s, stat)}`, ...(away ? { away } : {}) };
}

/** Everyone who could be posted to a building, with why not if they can't. Those resting until healed aren't offered. */
export function postCandidates(state: GameState, id: BuildingId): { survivor: Survivor; current: string; stat: string; problem?: string }[] {
  const workStat = buildingDef(id).workStat;
  return state.survivors
    .filter((s) => postBuilding(s.post) !== id && !resting(s))
    .map((s) => {
      const stat: StatId = workStat && workStat !== 'any' ? workStat : s.post && 'building' in s.post ? postStat(s, s.post) : 'wits';
      const problem = s.outpost ? `${s.firstName} lives at the outpost at ${getLocation(s.outpost).name}.` : postProblem(state, s.id, { building: id });
      return {
        survivor: s,
        current: s.outpost ? `At the outpost at ${getLocation(s.outpost).name}` : s.post ? ('project' in s.post ? `On the crew of ${projectTitle(s.post.project)}` : `Now at the ${buildingName(state, s.post.building)}`) : 'No post',
        stat: workStat === 'any' ? '' : `${statName(stat)} ${effectiveStat(s, stat)}`,
        ...(problem ? { problem } : {}),
      };
    })
    .sort((a, b) => Number(Boolean(a.survivor.post)) - Number(Boolean(b.survivor.post)) || a.survivor.firstName.localeCompare(b.survivor.firstName));
}

/** Posts a survivor could take, for the picker on their sheet. */
export function postChoices(state: GameState, s: Survivor): { id: BuildingId; name: string; problem?: string }[] {
  return BUILDING_IDS.filter((id) => buildingDef(id).workStat && buildingLevel(state, id) > 0).map((id) => {
    const problem = postBuilding(s.post) === id ? undefined : postProblem(state, s.id, { building: id });
    return { id, name: buildingName(state, id), ...(problem ? { problem } : {}) };
  });
}

/** Stats a Training Yard worker can train (not those already at the top). */
export function trainableStats(s: Survivor): StatId[] {
  return STAT_IDS.filter((id) => s.stats[id] < STAT_MAX);
}

// ---------------------------------------------------------------- workshop

export interface RecipeRow {
  gear: string;
  name: string;
  stats: string;
  cost: string;
  problem?: string;
}

export function recipeRows(state: GameState): RecipeRow[] {
  return RECIPES.map((r) => {
    const def = getGear(r.gear);
    const problem = craftProblem(state, r.gear);
    return {
      gear: r.gear,
      name: def.name,
      stats: itemStats({ uid: '', defId: r.gear, quality: 'common' }) || def.description,
      cost: costText(r.cost),
      ...(problem ? { problem } : {}),
    };
  });
}

export interface UpgradeRow {
  item: ItemInstance;
  name: string;
  /** Who carries it, if anyone. */
  holder?: string;
  to: string;
  cost: string;
  problem?: string;
}

/** Items the Workshop could improve, cheapest first. */
export function upgradeRows(state: GameState): UpgradeRow[] {
  const holders = new Map<string, string>();
  for (const s of state.survivors) for (const item of Object.values(s.equipment)) if (item) holders.set(item.uid, s.firstName);
  return workshopItems(state)
    .map((item) => ({ item, up: upgradeFor(item) }))
    .filter((x): x is { item: ItemInstance; up: NonNullable<ReturnType<typeof upgradeFor>> } => x.up !== undefined)
    .map(({ item, up }) => {
      const problem = upgradeProblem(state, item.uid);
      const holder = holders.get(item.uid);
      const after = itemName({ ...item, quality: up.to });
      return {
        item,
        name: itemName(item),
        ...(holder ? { holder } : {}),
        to: after,
        cost: costText(up.cost),
        ...(problem ? { problem } : {}),
      };
    });
}

// ---------------------------------------------------------------- recruits

export interface StatView {
  id: StatId;
  name: string;
  /** "5", or a range like "4 to 6" when the Radio Tower can't vouch for them. */
  value: string;
}

/** A candidate's stats: exact with a Radio Tower, rough ranges without. */
export function candidateStats(state: GameState, s: Survivor): StatView[] {
  const exact = buildingLevel(state, 'radio_tower') > 0;
  return STAT_IDS.map((id) => {
    const v = effectiveStat(s, id);
    return { id, name: statName(id), value: exact ? String(v) : `${Math.max(1, v - 1)} to ${v + 1}` };
  });
}

/** What shows of a candidate's character, and a hint when something doesn't. */
export function candidateTraitsLine(visible: readonly string[], hidden: boolean): string {
  if (visible.length === 0) return hidden ? 'Nothing shows yet, but there’s something you’ll find out about later.' : 'No traits to speak of.';
  return `${visible.join(', ')}.${hidden ? ' And something you’ll only find out about later.' : ''}`;
}

/** "Here today only" or "Waits at the gate until day 12". */
export function candidateWait(c: Candidate, day: number): string {
  return c.expiresDay <= day + 1 ? 'Here today only.' : `Waits at the gate until day ${c.expiresDay - 1}.`;
}

/** How long a candidate waits, and "Came on her own." first for a wanderer. */
export function candidateNote(c: Candidate, day: number): string {
  const wait = candidateWait(c, day);
  return c.wanderer ? `Came on ${pronounForms(c.survivor.pronouns).their} own. ${wait}` : wait;
}

// ---------------------------------------------------------------- while you were away

export function mergeSummaries(a: DepotSummary, b: DepotSummary): DepotSummary {
  return {
    days: a.days + b.days,
    grown: a.grown + b.grown,
    eaten: a.eaten + b.eaten,
    hungryDays: a.hungryDays + b.hungryDays,
    ammoMade: a.ammoMade + b.ammoMade,
    healed: a.healed + b.healed,
    cured: a.cured + b.cured,
    news: [...a.news, ...b.news],
    outposts: addResources(a.outposts, b.outposts),
    upkeep: addResources(a.upkeep ?? {}, b.upkeep ?? {}),
    unpaid: [...new Set([...(a.unpaid ?? []), ...(b.unpaid ?? [])])],
  };
}

function addResources(a: Partial<Resources>, b: Partial<Resources>): Partial<Resources> {
  const out: Partial<Resources> = { ...a };
  for (const r of RESOURCE_IDS) if (b[r]) out[r] = (out[r] ?? 0) + b[r]!;
  return out;
}

/** The note on the Depot screen: a few plain sentences about the days that passed. Pass the game to name buildings by their level. */
export function summaryLines(s: DepotSummary, state?: GameState): string[] {
  if (s.days === 0) return [];
  const out = [`${s.days === 1 ? 'A day' : `${s.days} days`} passed at the Depot.`];
  out.push(`The Garden grew ${s.grown} rations and the guild ate ${s.eaten}.`);
  if (s.hungryDays > 0) out.push(`The guild went hungry for ${s.hungryDays === 1 ? 'a day' : `${s.hungryDays} days`}.`);
  if (s.ammoMade > 0) out.push(`The Workshop made ${s.ammoMade} ammo.`);
  if (s.healed > 0) out.push(`Rest healed ${s.healed} health${s.cured > 0 ? `, and the Infirmary treated ${s.cured === 1 ? 'one patient' : `${s.cured} patients`}` : ''}.`);
  const sent = costText(s.outposts ?? {});
  if (sent !== 'nothing') out.push(`The outposts sent home ${sent}.`);
  const used = costText(s.upkeep ?? {});
  if (used !== 'nothing') out.push(`Keeping the buildings going used ${used}.`);
  const short = (s.unpaid ?? []).map((id) => (state ? buildingName(state, id) : buildingDef(id).name));
  if (short.length > 0) out.push(`The ${joinList(short)} ran short and worked a level lower.`);
  return out;
}

/** Depot news, newest first, without the run lines the Runs tab already shows. */
export function depotNews(state: GameState, limit = 12): { day: number; text: string }[] {
  return state.log
    .filter((e) => !e.tags?.includes('run'))
    .slice(-limit)
    .reverse()
    .map((e) => ({ day: e.day, text: e.text }));
}

export function homeCounts(state: GameState): { home: number; out: number; outposts: number; beds: number; cap: number } {
  const home = state.survivors.filter(atDepot).length;
  const outposts = state.survivors.filter((s) => s.outpost !== undefined).length;
  return { home, out: state.survivors.length - home - outposts, outposts, beds: state.survivors.length, cap: bunksCap(state) };
}

// ---------------------------------------------------------------- food

/** 4.5 stays 4.5, 5 stays 5: how the Garden's yield is shown everywhere. */
export function oneDecimal(n: number): string {
  return String(Math.round(n * 10) / 10);
}

const FOOD_FIXES = 'Hunting runs bring food home, and more gardeners or a bigger Garden grow more.';

/**
 * A warning for the Depot when the Garden can't keep up with the whole guild
 * and the stores will soon be gone (or are). Nothing when food is fine.
 */
export function foodWarning(state: GameState): string | undefined {
  const eat = guildUpkeep(state);
  const grow = gardenYield(state);
  if (grow >= eat) return undefined;
  const stored = state.resources.rations;
  if (stored <= 0) {
    return `The rations are gone. The guild eats ${eat} a day and the Garden grows about ${oneDecimal(grow)}, so people at home go hungry and can't rest. Crews can still go out, hungry. ${FOOD_FIXES}`;
  }
  const days = Math.floor(stored / (eat - grow));
  if (days > FOOD_WARNING_DAYS) return undefined;
  return `Food is running short. The guild eats ${eat} rations a day and the Garden grows about ${oneDecimal(grow)}, so what's stored lasts about ${days === 0 ? 'a day' : `${days} more ${days === 1 ? 'day' : 'days'}`}. ${FOOD_FIXES}`;
}

/** Warn this many days before the stores run out. */
export const FOOD_WARNING_DAYS = 10;

/** At the gate: a note when another person would eat more than the Garden can spare. */
export function newMouthNote(state: GameState): string | undefined {
  const eat = guildUpkeep(state);
  const grow = gardenYield(state);
  if (grow >= eat + 1) return undefined;
  return `Another person eats at least a ration a day. The guild already eats ${eat}, and the Garden grows about ${oneDecimal(grow)}.`;
}

function joinList(xs: readonly string[]): string {
  return xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}
