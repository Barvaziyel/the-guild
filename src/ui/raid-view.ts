/**
 * Raids at the gate on screen (§9.8): the card on the Depot, the notices when
 * raiders are seen and when they arrive, the times the app wakes for them, and
 * where a tapped notice opens.
 */
import { RAID_WAIT, canDefend, getLocation, openRaid, raidAgainst, raidAtGate, raidSeen, raidersName, type GameState } from '../engine/index.ts';
import { formatDuration, type PlannedNotice } from './runs-view.ts';
import { clockTime } from './time.ts';

export interface RaidCardView {
  kind: 'seen' | 'gate';
  title: string;
  /** Who's coming, at the gate. */
  against?: string;
  lines: string[];
  /** How long they'll wait, or how long is left under command. */
  wait?: string;
  inCommand: boolean;
}

function sentence(text: string): string {
  return text ? `${text[0]!.toUpperCase()}${text.slice(1)}.` : text;
}

function names(list: readonly string[]): string {
  if (list.length <= 1) return list[0] ?? 'nobody';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** The raid card on the Depot: raiders seen on the road, or at the gate. Undefined with neither. */
export function raidCard(state: GameState, now: number): RaidCardView | undefined {
  const seen = raidSeen(state, now);
  if (seen) {
    const { name } = raidersName(state, seen);
    const coming = name.replace(/,$/, '');
    const home = state.survivors.filter(canDefend).map((s) => s.firstName);
    const lines = [`Seen from the Watchtower. At the gate around ${clockTime(seen.arrive)}.`, home.length > 0 ? `Home to hold it now: ${names(home)}.` : 'Nobody is home to hold it.'];
    // Crews out: back in time to defend, or not.
    for (const r of state.runs) {
      const crew = r.result.crew.filter((s) => r.plan.crew.includes(s.id)).map((s) => s.firstName);
      const place = getLocation(r.plan.locationId).name;
      lines.push(r.returnAt <= seen.arrive ? `${names(crew)}, back from ${place} at ${clockTime(r.returnAt)}, will be in time.` : `${names(crew)}, back from ${place} at ${clockTime(r.returnAt)}, won’t be.`);
    }
    lines.push('Whoever is home and fit when they arrive holds the gate. A crew back after that stays out of it.');
    return { kind: 'seen', title: `${coming} on the road`, lines, inCommand: false };
  }
  const raid = raidAtGate(state);
  if (!raid) return undefined;
  const { name } = raidersName(state, raid);
  const defenders = state.survivors.filter((s) => raid.defenders!.includes(s.id) && canDefend(s)).map((s) => s.firstName);
  const left = Math.max(0, raid.until - now);
  const inCommand = raid.took !== undefined;
  return {
    kind: 'gate',
    title: `${name.replace(/,$/, '')} at the gate`,
    against: sentence(raidAgainst(state, raid)),
    lines: [defenders.length > 0 ? `Here to hold it: ${names(defenders)}.` : 'Nobody is here to hold it.'],
    wait: inCommand
      ? `You’re in command. ${formatDuration(left)} left to finish it.`
      : `They’ll wait ${formatDuration(left)} more for your orders. After that, whoever is home fights them on their own.`,
    inCommand,
  };
}

/** A raid that needs the player now: at the gate. For the "!" on the Depot tab. */
export function raidAlert(state: GameState): boolean {
  return raidAtGate(state) !== undefined;
}

/** Notices: when the Watchtower sees them, and when they reach the gate. */
export function raidNotices(state: GameState): PlannedNotice[] {
  const raid = openRaid(state);
  if (!raid) return [];
  const { name } = raidersName(state, raid);
  const who = name.replace(/,$/, '');
  const out: PlannedNotice[] = [];
  if (raid.seen !== undefined && raid.defenders === undefined) {
    out.push({ id: `raid-seen-${raid.id}`, at: raid.seen, title: `${who} on the road`, body: `Seen from the Watchtower. At the gate around ${clockTime(raid.arrive)}.` });
  }
  if (raid.took === undefined) {
    out.push({ id: `raid-${raid.id}`, at: raid.arrive, title: `${who} at the gate`, body: `They’ll wait ${formatDuration(RAID_WAIT)} for your orders. After that, whoever is home fights them on their own.` });
  }
  return out;
}

/** Changes when a raid is planned, arrives, is taken up or ends, so notices are planned again. */
export function raidNoticeKey(state: GameState): string {
  const raid = state.depot.raid;
  return raid ? `${raid.id}:${raid.seen ?? ''}:${raid.defenders ? 'gate' : ''}:${raid.took ?? ''}:${raid.ended ?? ''}` : '';
}

/** When the app should wake for a raid: when it's seen, when it arrives, and when the wait runs out. */
export function raidWakeTimes(state: GameState, now: number): number[] {
  const raid = openRaid(state);
  if (!raid) return [];
  return [raid.seen, raid.arrive, raid.until].filter((t): t is number => t !== undefined && t > now);
}
