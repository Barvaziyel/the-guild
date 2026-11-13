/**
 * Fights the player commands (§7.13): the planner's switch, the card when a
 * crew stops at a fight, the fight screen's labels and orders, notices, and
 * the report's line.
 */
import {
  LEAD_WAIT,
  getLocation,
  ledFightNow,
  type FightMemberView,
  type FightView,
  type GameState,
  type LedFight,
  type LogLine,
  type MoveId,
  type MoveOrder,
  type RoundOrders,
  type Run,
  type RunReport,
  type Survivor,
} from '../engine/index.ts';
import { formatDuration, type PlannedNotice } from './runs-view.ts';

/** The planner's switch: whether it can be on, and what it says. */
export function leadChoice(state: GameState): { can: boolean; help: string } {
  const wait = formatDuration(LEAD_WAIT);
  if ((state.buildings.radio_tower ?? 0) < 1) return { can: false, help: 'Orders go over the radio: this needs a Radio Tower.' };
  return { can: true, help: `At every fight they call home and wait up to ${wait} for your orders, with a notice. Nobody there? They fight on their own.` };
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
  /** "Kai will hold 24 more minutes for your orders. After that, they fight on their own." */
  wait: string;
}

/** A crew at a fight, waiting for the player or under command. */
export function fightCard(state: GameState, run: Run, now: number): FightCardView | undefined {
  const f = ledFightNow(run, now);
  if (!f) return undefined;
  const name = crewName(run, f.by);
  const solo = run.plan.crew.length === 1;
  const rest = solo ? `${name} fights on alone` : 'they fight on their own';
  return {
    runId: run.id,
    place: getLocation(run.plan.locationId).name,
    against: f.against,
    callerName: name,
    caller: state.survivors.find((s) => s.id === f.by),
    inCommand: f.took !== undefined,
    wait:
      f.took !== undefined
        ? `You're in command. ${minutesLeft(f.until - now).replace(/^./, (c) => c.toUpperCase())} to finish it; after that, ${rest}.`
        : `${name} will hold ${minutesLeft(f.until - now)} for your orders. After that, ${rest}.`,
  };
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
  for (const r of state.runs) for (const f of r.lead?.fights ?? []) if (f.ended === undefined) for (const t of [f.at, f.until]) if (t > now) out.push(t);
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
        title: `${name} is in a fight`,
        body: `At ${getLocation(r.plan.locationId).name}, against ${f.against}. They'll wait ${formatDuration(LEAD_WAIT)} for your orders.`,
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
  for (const [id, pick] of Object.entries(picks)) {
    const m = view.crew.find((c) => c.id === id);
    const choice = m?.moves.find((c) => c.move === pick.move);
    if (!choice) continue;
    if (choice.target !== 'none' && (pick.target === undefined || !choice.targets.includes(pick.target))) continue;
    out[id] = pick;
  }
  return out;
}

/** The orders the screen sends. */
export function roundOrders(view: FightView, picks: Picks, pullOut: boolean): RoundOrders {
  return { moves: livePicks(view, picks), ...(pullOut ? { pullOut: true } : {}) };
}

/** How a commanded fight ended: the lines after what the player saw, or its last few when that's unknown. */
export function fightEnd(lines: readonly LogLine[], shown: number): LogLine[] {
  const after = shown > 0 ? lines.slice(shown) : [];
  return after.length > 0 ? after : lines.slice(-4);
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

