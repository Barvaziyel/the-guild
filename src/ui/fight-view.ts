/**
 * Fights the player commands (§7.13): the planner's switch, the card when a
 * crew stops at a fight, the fight screen's labels and orders, notices, and
 * the report's line.
 */
import {
  CLEAN_FIGHT_LOOT,
  CLEAN_FIGHT_RELIEF,
  HEAVY_HIT_MULT,
  LEAD_WAIT,
  LINED_UP_MULT,
  ledFightNow,
  ledFightPlace,
  waitsForWord,
  type FightMemberView,
  type FightView,
  type GameState,
  type LedFight,
  type LogLine,
  type MoveId,
  type MoveOrder,
  type Rank,
  type RoundOrders,
  type Run,
  type RunPlan,
  type RunReport,
  type Survivor,
} from '../engine/index.ts';
import { formatDuration, type Choice, type PlannedNotice } from './runs-view.ts';
import { callSpeech } from './call-lines.ts';
import type { Chip } from './glyphs.ts';
import { clockTime } from './time.ts';

/** The planner's choice of when a crew calls home (3.10.0): when it matters (the default), at every fight, or never. */
export type LeadMode = 'matters' | 'every' | 'never';

export function leadMode(plan: RunPlan): LeadMode {
  return plan.lead === 'matters' ? 'matters' : plan.lead ? 'every' : 'never';
}

export function withLead(plan: RunPlan, mode: LeadMode): RunPlan {
  const { lead: _drop, ...rest } = plan;
  return mode === 'never' ? rest : { ...rest, lead: mode === 'matters' ? 'matters' : true };
}

/** What each choice does, for the planner. Any crew can be led (Aviel, 2.2.0: it shouldn't wait for a Radio Tower). */
export function leadChoices(): Choice<LeadMode>[] {
  const wait = formatDuration(LEAD_WAIT);
  return [
    {
      id: 'matters',
      name: 'When it matters',
      short: 'When needed',
      description: `They call home for a named foe, or a fight they'd lose someone in, and wait up to ${wait} for your orders. The rest they fight on their own.`,
      chips: [
        { glyph: 'down', text: 'calls', label: "They call home for a fight they'd lose someone in, or a named foe. The rest they fight on their own." },
        { glyph: 'clock', text: wait, label: `They wait up to ${wait} for your orders` },
      ],
    },
    {
      id: 'every',
      name: 'Every fight',
      short: 'Always',
      description: `They call home at every fight and wait up to ${wait} for your orders.`,
      chips: [
        { glyph: 'swords', text: 'calls', label: 'They call home at every fight' },
        { glyph: 'clock', text: wait, label: `They wait up to ${wait} for your orders` },
      ],
    },
    { id: 'never', name: 'Never', description: 'They fight every fight on their own.', chips: [{ glyph: 'swords', text: 'alone', label: 'They fight every fight on their own' }] },
  ];
}

function crewName(run: Run, id: string): string {
  return run.result.crew.find((s) => s.id === id)?.firstName ?? 'They';
}

/** "4 more minutes", "one more minute". */
function minutesLeft(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / 60_000));
  return m === 1 ? 'one more minute' : `${m} more minutes`;
}

export interface FightCardView {
  runId: string;
  place: string;
  /** "three Raider Scavs". */
  against: string;
  callerName: string;
  /** The real survivor, for the portrait. */
  caller: Survivor | undefined;
  /** In command now, rather than waiting for the player. */
  inCommand: boolean;
  /** Why they called (3.10.0): in trouble (a crew that calls when it matters), or someone would die of it. Missing at every fight. */
  urgency?: 'trouble' | 'grave';
  /** "Kai will hold 24 more minutes for your orders. After that, they fight on their own." Read out; the card shows `chips`. */
  wait: string;
  /** What the card shows instead of words (3.10.0): what's at stake, and how long they hold. */
  chips: Chip[];
  /** By the caller's portrait: "Kai is on the radio: they're about to fight, and wait for your orders." */
  line: string;
}

/** A crew at a fight, waiting for the player or under command. */
export function fightCard(state: GameState, run: Run, now: number): FightCardView | undefined {
  const f = ledFightNow(run, now);
  if (!f) return undefined;
  const name = crewName(run, f.by);
  const solo = run.plan.crew.length === 1;
  const rest = solo ? `${name} fights on alone` : 'they fight on their own';
  // On the road east they wait as long as it takes (§9.12).
  const wait = waitsForWord(run)
    ? f.took !== undefined
      ? 'You’re in command. They wait for each round’s orders, as long as it takes.'
      : `${name} has called a halt. They wait for your word, as long as it takes.`
    : f.took !== undefined
      ? `You're in command. ${minutesLeft(f.until - now).replace(/^./, (c) => c.toUpperCase())} to finish it; after that, ${rest}.`
      : `${name} will hold ${minutesLeft(f.until - now)} for your orders. After that, ${rest}.`;
  return {
    runId: run.id,
    place: ledFightPlace(run, f),
    against: f.against,
    callerName: name,
    caller: state.survivors.find((s) => s.id === f.by),
    inCommand: f.took !== undefined,
    ...(f.grave ? { urgency: 'grave' as const } : run.plan.lead === 'matters' ? { urgency: 'trouble' as const } : {}),
    // On the road east nobody is at the Depot to radio: they've stopped on the road (§9.12).
    line: waitsForWord(run)
      ? f.took !== undefined
        ? 'The guild waits on the road for your next orders.'
        : `${name} has called a halt: they're about to fight, and wait for your word.`
      : f.took !== undefined
        ? `${name}'s crew is waiting for your next orders.`
        : callLine(state, run, f, name),
    wait,
    chips: [...stakeChips(f, run), ...(waitsForWord(run) ? [] : [{ glyph: 'clock' as const, text: formatDuration(Math.max(60_000, f.until - now)), tone: 'bad' as const, label: wait }])],
  };
}

/**
 * What the crew says when they call (3.10.0). A crew that calls when it matters is in trouble, or worse:
 * left alone, someone would die. One that calls at every fight is just about to fight.
 */
function callLine(state: GameState, run: Run, f: LedFight, name: string): string {
  const stakes = f.grave ? 'grave' : run.plan.lead === 'matters' ? 'trouble' : 'contact';
  return `${name}, on the radio: ${callSpeech(run, f, stakes, state.survivors.find((s) => s.id === f.by))}`;
}

/** What's at stake, as a picture (3.10.0): left alone, someone would go down, or die. Nothing for a crew that calls at every fight. */
function stakeChips(f: LedFight, run: Run): Chip[] {
  if (f.grave) return [{ glyph: 'skull', text: 'if alone', tone: 'bad', label: 'Left to fight it alone, someone would die' }];
  if (run.plan.lead === 'matters') return [{ glyph: 'down', text: 'if alone', tone: 'bad', label: 'Left to fight it alone, someone would go down' }];
  return [];
}

/** Where the battle stage is for a run's fight: its spot on the road east (§9.12), or the run's place. */
export function stagePlace(run: Run, view?: FightView): string {
  return view?.site ?? run.plan.locationId;
}

/** Every crew at a fight right now, the first to call first. */
export function fightCards(state: GameState, now: number): FightCardView[] {
  return state.runs
    .map((r) => fightCard(state, r, now))
    .filter((c): c is FightCardView => c !== undefined)
    .sort((a, b) => a.runId.localeCompare(b.runId));
}

/** A crew at a fight: the Runs tab gets a mark. */
export function anyoneFighting(state: GameState, now: number): boolean {
  return state.runs.some((r) => ledFightNow(r, now) !== undefined);
}

/** When the app should look again: a fight starting, or its time running out. */
export function fightWakeTimes(state: GameState, now: number): number[] {
  const out: number[] = [];
  // On the road east nothing runs out (§9.12): only the fight starting wakes the app.
  for (const r of state.runs) for (const f of r.lead?.fights ?? []) if (f.ended === undefined) for (const t of waitsForWord(r) ? [f.at] : [f.at, f.until]) if (t > now) out.push(t);
  return out;
}

/** A notice for each fight still to come or waiting. Planned as the run stands, so it moves when the run does. */
export function fightNotices(state: GameState): PlannedNotice[] {
  const out: PlannedNotice[] = [];
  for (const r of state.runs) {
    r.lead?.fights.forEach((f: LedFight, k: number) => {
      if (f.ended !== undefined || f.took !== undefined) return;
      const name = crewName(r, f.by);
      out.push({
        id: `fight-${r.id}-${k}`,
        at: f.at,
        ...(waitsForWord(r) ? {} : { until: f.until }),
        title: f.grave ? `${name} needs you now` : r.plan.lead === 'matters' ? `${name}'s crew is in trouble` : `${name} is in a fight`,
        body: `At ${ledFightPlace(r, f)}, against ${f.against}. ${f.grave ? (r.plan.crew.length === 1 ? `${name} isn't coming back from this one without you. ` : "Someone isn't coming back from this one without you. ") : ''}${waitsForWord(r) ? 'They wait for your word.' : `They'll wait for your orders until ${clockTime(f.until)}.`}`,
      });
    });
  }
  return out;
}

/** Changes when a fight moves, starts or ends, so notices are planned again. */
export function fightNoticeKey(state: GameState): string {
  return state.runs.map((r) => (r.lead ? r.lead.fights.map((f) => `${r.id}:${f.at}:${f.took ?? ''}:${f.ended ?? ''}`).join(';') : '')).join(',');
}

/** The run a tapped fight notice is about ("fight-r12-0" → "r12"). */
export function fightNoticeRun(id: string): string | undefined {
  const m = /^fight-(.+)-\d+$/.exec(id);
  return m ? m[1] : undefined;
}

/** The report's line about leading the fights. */
export function leadReportLine(report: RunReport): string | undefined {
  const lead = report.lead;
  if (!lead || lead.fights === 0) return undefined;
  const fights = lead.fights === 1 ? 'the fight' : `${lead.fights} fights`;
  if (lead.commanded === 0) return lead.fights === 1 ? 'Nobody took command of the fight; they fought it on their own.' : `Nobody took command of the ${fights}; they fought them on their own.`;
  if (lead.commanded === lead.fights) return lead.fights === 1 ? 'You led the fight over the radio.' : `You led all ${fights} over the radio.`;
  return `You led ${lead.commanded} of the ${fights} over the radio.`;
}

// ---------------------------------------------------------------- the fight screen

/** One person's pick on the fight screen: a move and, when it needs one, a target. Missing: they fight on their own. */
export type Picks = Record<string, MoveOrder>;

/** "Shoot Raider Scav 2", "Patch up Mara", "Take cover", "On their own". */
export function pickLabel(view: FightView, member: FightMemberView, pick: MoveOrder | undefined): string {
  if (!pick) return 'On their own';
  const choice = member.moves.find((c) => c.move === pick.move);
  const name = choice?.name ?? pick.move;
  if (pick.target === undefined) return name;
  return `${name} ${targetName(view, pick.target)}`;
}

/** An enemy's name or an ally's, from an order's target. */
export function targetName(view: FightView, target: number | string): string {
  if (typeof target === 'number') return view.enemies[target]?.name ?? 'them';
  const ally = view.crew.find((m) => m.id === target);
  return ally ? ally.name : 'them';
}

/** Whether a move needs a target picked next. */
export function needsTarget(member: FightMemberView, move: MoveId): boolean {
  const c = member.moves.find((x) => x.move === move);
  return c !== undefined && c.target !== 'none';
}

/** Picks that still fit the fight as it stands (a target may have died since); the rest are dropped. */
export function livePicks(view: FightView, picks: Picks): Picks {
  const out: Picks = {};
  let job = false;
  for (const [id, pick] of Object.entries(picks)) {
    const m = view.crew.find((c) => c.id === id);
    const choice = m?.moves.find((c) => c.move === pick.move);
    if (!choice) continue;
    if (choice.target !== 'none' && (pick.target === undefined || !choice.targets.includes(pick.target))) continue;
    // One on the job a round: anyone after the first is left to fight on their own.
    if (pick.move === 'job') {
      if (job) continue;
      job = true;
    }
    out[id] = pick;
  }
  return out;
}

/** Who else has the fight's job this round, by name, if anyone: then it isn't `who`'s to take (one at a time). */
export function jobTakenBy(view: FightView, picks: Picks, who: string): string | undefined {
  const other = Object.entries(picks).find(([id, p]) => id !== who && p.move === 'job');
  return other ? view.crew.find((c) => c.id === other[0])?.name : undefined;
}

/** Where the player has put people this round, by survivor id (2.3.0). */
export type Ranks = Record<string, Rank>;

/**
 * The fight as the orders being given would have it: everyone the player moved
 * stands where they were put, with what they can do from there. Every other
 * label and pick works from this.
 */
export function withRanks(view: FightView, ranks: Ranks): FightView {
  if (Object.keys(ranks).length === 0) return view;
  return {
    ...view,
    crew: view.crew.map((m) => {
      const rank = ranks[m.id];
      return rank && rank !== m.rank && m.moves.length > 0 && !m.perch ? { ...m, rank, moves: m.byRank[rank] } : m;
    }),
  };
}

/** The orders the screen sends: picks that still fit (with `view` already showing the ranks picked), and who moved. */
export function roundOrders(view: FightView, picks: Picks, pullOut: boolean, ranks: Ranks = {}, before: FightView = view): RoundOrders {
  const moved: Ranks = {};
  for (const m of view.crew) {
    const was = before.crew.find((o) => o.id === m.id)?.rank;
    if (ranks[m.id] && ranks[m.id] !== was && !m.perch) moved[m.id] = ranks[m.id]!;
  }
  return { moves: livePicks(view, picks), ...(Object.keys(moved).length > 0 ? { ranks: moved } : {}), ...(pullOut ? { pullOut: true } : {}) };
}

/** What standing in front or at the back means for this person, in a line (2.3.0). */
export function rankHelp(m: FightMemberView, rank: Rank): string {
  const shoots = m.byRank.back.some((c) => c.move === 'attack' && c.name === 'Shoot');
  if (rank === 'front') return shoots ? 'In front: in reach of every blow, and can shoot anything.' : 'In front: can reach their front rank, and in reach of every blow.';
  return shoots ? 'At the back: blows can’t reach them while anyone stands in front. They can still shoot anything.' : 'At the back: blows can’t reach them while anyone stands in front, but they can’t reach anything to hit.';
}

/**
 * Whether an enemy can still reach who it meant to go for, with the crew where
 * the player has put them (2.3.0): a blow can't reach the back while anyone of
 * the crew stands in front. When it can't, it turns to someone who is.
 */
export function canStillReach(view: FightView, e: FightView['enemies'][number], id: string): boolean {
  if (e.rank !== 'front') return true;
  const target = view.crew.find((m) => m.id === id);
  if (!target || target.rank === 'front' || target.perch) return true;
  return !view.crew.some((m) => m.state === 'up' && !m.perch && m.rank === 'front');
}

/**
 * What's coming at one of the crew this round, before armor (3.8.0): blows and shots at them, and a firebomb
 * at the rank they stand in (`fire`); whether it all could put them down; and whether a shot is being lined
 * up at them for next round (`next`). Blows that can't reach them where they stand now don't count.
 */
export interface Incoming {
  amount: number;
  drop: boolean;
  fire: boolean;
  next: boolean;
}

export function incoming(view: FightView, id: string): Incoming {
  const m = view.crew.find((x) => x.id === id);
  const out: Incoming = { amount: 0, drop: false, fire: false, next: false };
  if (!m || m.state !== 'up' || m.perch) return out;
  for (const e of view.enemies) {
    const it = e.intent;
    if (e.state !== 'up' || e.stunned || !it) continue;
    if (it.kind === 'throw') {
      if (it.rank === m.rank) {
        out.amount += e.burn ?? 0;
        out.fire = true;
      }
      continue;
    }
    if (it.kind === 'aim') {
      if (it.at === id) out.next = true;
      continue;
    }
    const big = it.kind === 'heavy' ? HEAVY_HIT_MULT : it.kind === 'shot' ? LINED_UP_MULT : 1;
    if (it.at === id && it.kind !== 'run' && it.kind !== 'mend' && canStillReach(view, e, id)) out.amount += e.damage * big;
    if (it.also === id && canStillReach(view, e, id)) out.amount += e.damage;
  }
  out.drop = out.amount > 0 && out.amount >= m.hp;
  return out;
}

/** "Brute: a big hit at Silas (up to 10).", one line for each enemy still in it: what they mean to do this round (2.3.0). */
export function theirMoves(view: FightView): string[] {
  const out: string[] = [];
  for (const e of view.enemies) {
    if (e.state === 'down') {
      out.push(`${e.name}: on the ground. It gets back up at the end of the round unless someone finishes it.`);
      continue;
    }
    if (e.state !== 'up') continue;
    const who = view.crew.find((m) => m.id === e.intent?.at)?.name;
    // How much its pack helps it this round: +1 for each other one going for the same person, up to +2.
    const pack = e.pack && e.intent?.at ? Math.min(2, view.enemies.filter((o) => o !== e && o.pack && o.state === 'up' && !o.stunned && o.intent?.kind !== 'run' && o.intent?.at === e.intent?.at).length) : 0;
    const shoots = e.rank !== 'front';
    let what: string;
    const it = e.intent;
    const ally = it?.ally !== undefined ? view.enemies[it.ally]?.name : undefined;
    if (e.stunned) what = 'stunned, and loses its turn';
    else if (it?.kind === 'run') what = 'looking for a way out: it runs at the end of the round';
    // 3.8.0: what a shove or a pin down spoils.
    else if (it?.kind === 'aim' && who) what = `lining up a shot at ${who} for next round (up to ${e.damage * LINED_UP_MULT})`;
    else if (it?.kind === 'shot' && who) what = `taking the shot it lined up at ${who} (up to ${e.damage * LINED_UP_MULT})`;
    else if (it?.kind === 'mend' && ally) what = `patching up ${ally} (+${e.mends ?? 0})`;
    else if (it?.kind === 'throw') what = `throwing a firebomb at ${it.rank === 'back' ? 'the back' : 'the front'} (${e.burn ?? 0} each, half in cover)`;
    else if (it?.kind === 'grab' && who) what = `grabbing for ${who}`;
    else if (it?.kind === 'hold' && who) what = `has ${who} in its grip (${e.damage} a round, no miss)`;
    else if (who && e.intent?.at && !canStillReach(view, e, e.intent.at)) what = `${e.intent.kind === 'heavy' ? 'winding up a big hit' : 'going'} for ${who}, who is out of reach at the back now: it turns to someone in front`;
    else if (e.intent?.kind === 'heavy' && who) what = `${shoots ? 'taking careful aim at' : 'winding up a big hit at'} ${who} (up to ${e.damage * 2})`;
    else if (who && pack > 0) what = `going for ${who} with the pack (+${pack} to hit)`;
    else if (who) what = `${shoots ? 'shooting at' : 'going for'} ${who}`;
    else what = 'can’t reach anyone';
    // A second blow at someone else (the Shepherd, §9.12).
    const also = !e.stunned && e.intent?.kind !== 'run' && e.intent?.also && canStillReach(view, e, e.intent.also) ? view.crew.find((m) => m.id === e.intent!.also)?.name : undefined;
    if (also && who) what += also === who ? ', twice' : `, and a second blow at ${also}`;
    out.push(`${e.name}: ${what}.`);
  }
  return out;
}

/**
 * One line for each kind of enemy in the fight that needs a particular answer
 * (2.4.0): what it does and what works on it. Shown once per kind.
 */
export function whatTheyAre(view: FightView): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of view.enemies) {
    if (e.state === 'dead' || e.state === 'fled' || e.state === 'waiting' || seen.has(e.kind)) continue;
    seen.add(e.kind);
    const kind = kindName(e);
    if (e.armor >= 2) out.push(`${kind}: armored, so ${e.armor} comes off every hit. Smash goes through armor, a called shot doubles the damage first, and big guns hit hardest.`);
    if (e.rises) out.push(`${kind}: drops, then gets back up a round later with half its strength, unless someone finishes it on the ground.`);
    if (e.pack) out.push(`${kind}: hunts as a pack. They all go for the same one of you and hit easier together: move that person back, guard them, or spray the pack.`);
    if (e.rank === 'air') out.push(`${kind}: flies. Only shots reach it, and one good one brings it down.`);
    else if (e.rank === 'back') out.push(`${kind}: shoots from the back. Blades can't reach it while anyone stands in front of it.`);
    if (e.twice) out.push(`${kind}: strikes twice a round, the second blow at someone else when it can reach two of you.`);
    if (e.heavy) out.push(`${kind}: winds up big hits now and then, for twice the damage. Watch for it and get out of the way.`);
    if (e.leader) out.push(`${kind}: leads them. If it falls, the rest lose heart.`);
    // 3.8.0: the answer to each is a shove or a pin down.
    if (e.aims) out.push(`${kind}: lines up a shot a round ahead, for twice the damage. Pin it down or shove it to spoil it, or get the one it's after into cover.`);
    if (e.mends) out.push(`${kind}: patches up the others. Get to it first, or pin it down.`);
    if (e.throws) out.push(`${kind}: throws firebombs at a rank of you. Spread out, take cover, or pin it down and it drops one at its own feet.`);
    if (e.grabs) out.push(`${kind}: grabs one of you and holds on, biting every round. A shove gets them out; hitting it doesn't.`);
  }
  return out;
}

/** "Raider Scav 2" → "Raider Scav", like a glossary entry; a named one keeps its name. */
function kindName(e: FightView['enemies'][number]): string {
  return e.named ? e.name : e.name.replace(/ \d+$/, '');
}

/** The job a fight came with, for its panel on the fight screen (2.5.0). */
export interface JobPanel {
  title: string;
  /** How it stands, in a line or two. */
  lines: string[];
  progress: number;
  needed: number;
  state: 'open' | 'done' | 'lost';
}

/**
 * The fight's job (2.5.0): what it is, how far along, how long is left, and
 * who is on it this round with the orders picked so far.
 */
export function jobPanel(view: FightView, picks: Picks = {}): JobPanel | undefined {
  const g = view.goal;
  if (!g) return undefined;
  const base = { title: g.title, progress: g.progress, needed: g.needed, state: g.state };
  if (g.state === 'done') return { ...base, lines: [g.doneLine] };
  if (g.state === 'lost') return { ...base, lines: [g.lostLine] };
  const lines = [g.intro];
  const door = view.enemies.filter((e) => e.state === 'waiting').length;
  if (door > 0) lines.push(`${door === 1 ? 'One more' : `${numberWord(door)} more`} behind the door. Each round nobody holds it, one comes through.`);
  if (g.deadline !== undefined) {
    const left = g.deadline - view.round + 1;
    lines.push(left <= 1 ? `It has to be done this round, or it’s lost.` : `It has to be done by the end of round ${g.deadline}: this round and ${left === 2 ? 'the next' : `${left - 1} more`}.`);
  }
  // One at a time: whoever has it this round.
  const on = view.crew.find((m) => picks[m.id]?.move === 'job');
  lines.push(on ? `${on.name} is on it this round.` : `Give someone ${g.move}, or one of those left to fight on their own may take it.`);
  return { ...base, lines };
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];
const numberWord = (n: number): string => (NUMBER_WORDS[n] ?? String(n)).replace(/^\w/, (c) => c.toUpperCase());

/** Their nerve, in words (2.3.0): how close they are to breaking, or that they won't. */
export function nerveLine(view: FightView): string {
  if (view.nerve === undefined) return 'They won’t break: this lot fights to the end.';
  const n = view.nerve;
  const how = n >= 75 ? 'holding' : n >= 40 ? 'shaken' : n > 0 ? 'close to breaking' : 'broken';
  return `Their nerve: ${n} of 100, ${how}. Kills, big hits and dropping their leader wear it down; each of yours that goes down gives them heart.`;
}

/** How a commanded fight ended: the lines after what the player saw, or its last few when that's unknown. */
export function fightEnd(lines: readonly LogLine[], shown: number): LogLine[] {
  const after = shown > 0 ? lines.slice(shown) : [];
  return after.length > 0 ? after : lines.slice(-4);
}

/**
 * Where the stage plays a commanded fight's end from: the fight as the player
 * last saw it, if that was this fight and the end came after it. Undefined
 * otherwise, and the stage just shows the end.
 */
export function endFrom(seen: FightView | undefined, end: FightView | undefined): FightView | undefined {
  return seen && end && seen.enemies.length === end.enemies.length && seen.acts.length <= end.acts.length ? seen : undefined;
}

/** The lines under a fight's end: in step with the stage while it plays the last round (`told`), all of them once it's done. */
export function endLines(lines: readonly LogLine[], before: FightView | undefined, told: number | undefined): LogLine[] {
  const shown = before?.lines.length ?? 0;
  return told === undefined ? fightEnd(lines, shown) : lines.slice(shown, told);
}

/** What a clean fight (3.10.0, nobody down) brought, under its end. */
export function cleanChips(view: FightView | undefined): Chip[] {
  if (!view?.clean) return [];
  return [
    { glyph: 'crate', text: `×${CLEAN_FIGHT_LOOT}`, tone: 'good', label: `Time to go through the bodies properly: ${CLEAN_FIGHT_LOOT} times what they carried` },
    { glyph: 'stress', text: `−${CLEAN_FIGHT_RELIEF}`, tone: 'good', label: `Steadier for it: ${CLEAN_FIGHT_RELIEF} stress off each of them` },
  ];
}

/** "18 of 24": a bar's share, 0 to 1. */
export function hpShare(hp: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
}

/** How someone is doing, in words. */
export function memberState(m: FightMemberView): string {
  if (m.state === 'dead') return 'Dead';
  if (m.state === 'down') return 'Down';
  if (m.state === 'fled') return 'Ran';
  return `${m.hp} of ${m.maxHp} HP`;
}


// ---------------------------------------------------------------- the fight on one screen (2.6.0)

/** The line over the stage: "Round 2 of 6 · 27 min left · 2 meds, 12 ammo in the packs." No time on the road east, where they wait as long as it takes (§9.12). */
export function fightStatus(view: FightView, until: number | undefined, now: number, stores: string): string {
  const meds = view.meds === 1 ? '1 med' : `${view.meds} meds`;
  const left = until === undefined ? '' : ` · ${formatDuration(Math.max(60_000, until - now))} left`;
  return `Round ${view.round} of ${view.maxRounds}${left} · ${meds}, ${view.ammo} ammo ${stores}`;
}

/** One of the crew in the strip under the stage: who, how they are, and what they've been told. */
export interface CrewChip {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  /** Can be given orders this round (standing, not out of it). */
  canAct: boolean;
  /** Their orders ("Shoot Hollow 1", "On their own"), "Shoot: who?" while a target is still to pick, or how they are ("Down"). */
  label: string;
  /** No orders: they fight on their own. */
  own: boolean;
  /** A move picked, its target not yet. */
  pending: boolean;
}

export function crewChips(view: FightView, picks: Picks): CrewChip[] {
  const current = livePicks(view, picks);
  return view.crew.map((m) => {
    const canAct = m.moves.length > 0;
    const raw = picks[m.id];
    const choice = raw ? m.moves.find((c) => c.move === raw.move) : undefined;
    const pending = canAct && choice !== undefined && current[m.id] === undefined;
    const holder = m.heldBy !== undefined ? view.enemies[m.heldBy]?.name : undefined;
    const label = !canAct ? (m.state === 'up' ? 'Can’t act' : memberState(m)) : pending ? `${choice!.name}: who?` : holder && !current[m.id] ? `Held by ${holder}` : pickLabel(view, m, current[m.id]);
    return { id: m.id, name: m.name, hp: m.hp, maxHp: m.maxHp, canAct, label, own: canAct && !current[m.id] && !pending, pending };
  });
}

/**
 * What the lines under the stage show: the latest of what the last round
 * brought, or of the fight so far. In the first round a job the fight came
 * with leads (its first line is said before the fight's own); with nothing
 * said yet, what to do.
 */
export function tickerLines(view: FightView, lastRound: readonly LogLine[], count = 2): LogLine[] {
  if (lastRound.length > 0) return lastRound.slice(-count);
  const intro = view.goal?.state === 'open' && view.round === 1 ? view.goal.intro : undefined;
  const tail = view.lines.slice(-count);
  if (intro !== undefined && !tail.some((l) => l.text === intro)) return [{ text: intro, tone: 'bad' }, ...view.lines.slice(-(count - 1))];
  return tail.length > 0 ? tail : [{ text: `Round ${view.round}: give each of them a move, or leave them to it.` }];
}

/**
 * The line under the open person's moves: what their move does, whom to tap
 * for a target, where they stand if they were just moved, or that they can't
 * reach anything from there.
 */
/** Over the targets of a move that needs one: who it can go at. */
export function targetPrompt(choice: { target: string }): string {
  return choice.target === 'ally' ? 'Which of the crew? Here or on the stage.' : 'At whom? Here or on the stage.';
}

export function orderHint(view: FightView, m: FightMemberView, picks: Picks, moved: boolean): string {
  const raw = picks[m.id];
  const choice = raw ? m.moves.find((c) => c.move === raw.move) : undefined;
  // What a move does comes first, even before it has a target (3.7.1; Aviel: picking Called shot asked
  // "who?" before he could see what it meant). The targets come in under the moves.
  if (choice) return choice.detail;
  // In a hollow's grip (3.8.0): where they stand isn't theirs to choose.
  const holder = m.heldBy !== undefined ? view.enemies[m.heldBy]?.name : undefined;
  if (holder) return `In ${holder}'s grip. Break free, or have someone shove it off.`;
  if (moved) return rankHelp(m, m.rank);
  if (!m.moves.some((c) => c.target === 'enemy' && c.targets.length > 0)) return `${m.name} can’t reach any of them from ${m.rank === 'back' ? 'the back' : 'here'}. Pick a move, or move them.`;
  return `Tap an enemy for ${m.name} to go after, or pick a move.`;
}
