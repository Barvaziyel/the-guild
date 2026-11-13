/**
 * Raids at the gate on screen (§9.8): the card on the Depot, the notices when
 * raiders are seen and when they arrive, the times the app wakes for them, and
 * where a tapped notice opens.
 */
import {
  RAID_SHORE_COST,
  RAID_SHORE_COVER,
  RAID_WAIT,
  canAfford,
  canDefend,
  canTalk,
  canWork,
  costText,
  getLocation,
  ledFightNow,
  openRaid,
  radioWaiting,
  raidAgainst,
  raidAtGate,
  raidFighters,
  raidRegroup,
  raidSeen,
  raidTeam,
  RAID_BANDS,
  raidPlace,
  raidPrice,
  raidersName,
  recallPreview,
  stareOdds,
  type DepotRaid,
  type GameState,
  type Run,
} from '../engine/index.ts';
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

/** What they came for, as the card says it: on the road, or at the gate (where it may turn out not to be there). */
export function wantLine(raid: DepotRaid): string | undefined {
  const w = raid.wants;
  if (!w) return undefined;
  const road = raid.defenders === undefined;
  switch (w.what) {
    case 'vehicle':
      return w.missing ? `They came for the ${w.name}. It isn’t here, so they’ll take what they can.` : `${road ? 'They’re coming for' : 'They want'} the ${w.name}.`;
    case 'prisoner':
      return w.missing ? `They came for ${w.name}, who isn’t held here any more.` : `${road ? 'They’re coming for' : 'They want'} ${w.name} back.`;
    case 'score':
      return w.missing
        ? `They came for ${w.name}, who isn’t home.`
        : `${road ? 'They’re coming for' : 'They want'} ${w.name}, who has killed ${w.kills} of theirs. In a fight they’ll go for ${w.name}.`;
    case 'store':
      return `${road ? 'They’re coming for' : 'They want'} ${w.amount} ${w.resource}.`;
  }
}

/** "at the gate" for the Depot, "at the outpost at Maple Street" for an outpost. */
function atPlace(raid: DepotRaid): string {
  return raid.outpost ? `at ${raidPlace(raid)}` : 'at the gate';
}

/** The raid card on the Depot: raiders seen on the road, or at the gate (or an outpost). Undefined with neither. */
export function raidCard(state: GameState, now: number): RaidCardView | undefined {
  const seen = raidSeen(state, now);
  if (seen) {
    const { name } = raidersName(state, seen);
    const coming = name.replace(/,$/, '');
    const home = state.survivors.filter(canDefend).map((s) => s.firstName);
    const want = wantLine(seen);
    const lines = [
      `At the gate around ${clockTime(seen.arrive)}.`,
      want ?? RAID_BANDS[seen.by].after,
      home.length > 0 ? `Home to hold it now: ${names(home)}.` : 'Nobody is home to hold it.',
    ];
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
  const defenders = state.survivors.filter((s) => raid.defenders!.includes(s.id)).map((s) => s.firstName);
  const left = Math.max(0, raid.until - now);
  const inCommand = raid.took !== undefined;
  const there = raid.outpost ? 'there' : 'home';
  const want = wantLine(raid);
  return {
    kind: 'gate',
    title: `${name.replace(/,$/, '')} ${atPlace(raid)}`,
    against: sentence(raidAgainst(state, raid)),
    lines: [
      ...(want ? [want] : RAID_BANDS[raid.by].talk ? [] : [RAID_BANDS[raid.by].after]),
      defenders.length > 0 ? `${raid.outpost ? 'There' : 'Here'} to hold it: ${names(defenders)}.` : `Nobody is ${there} to hold it.`,
    ],
    wait: inCommand
      ? `You’re in command. ${formatDuration(left)} left to finish it.`
      : `They’ll wait ${formatDuration(left)} more for your orders. After that, whoever is ${there} fights them on their own.`,
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
    out.push({
      id: `raid-${raid.id}`,
      at: raid.arrive,
      title: `${who} ${atPlace(raid)}`,
      body: `They’ll wait ${formatDuration(RAID_WAIT)} for your orders. After that, whoever is ${raid.outpost ? 'there' : 'home'} fights them on their own.`,
    });
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

// ---------------------------------------------------------------- getting ready

/** A crew out while raiders are on the road: when they're back, and whether they can be called home in time. */
export interface RecallRow {
  runId: string;
  /** "Gray and Mo, at Maple Street". */
  who: string;
  /** "Back at 14:20, in time to hold the gate." */
  back: string;
  inTime: boolean;
  /** Called home now: "Back by 13:10, in time." */
  call?: { label: string; inTime: boolean };
  /** Why they can't be called home. */
  note?: string;
}

export interface ReadyView {
  /** "At the gate around 13:45." */
  when: string;
  /** What they're after, or what they're coming for in particular. */
  after: string;
  /** "A second band follows the first." */
  secondBand?: string;
  home: string;
  crews: RecallRow[];
  shore: { done: boolean; label: string; text: string; problem?: string };
  hide: { done: boolean; text: string; problem?: string };
}

function crewNames(r: Run): string {
  return names(r.result.crew.filter((s) => r.plan.crew.includes(s.id)).map((s) => s.firstName));
}

function recallRow(state: GameState, r: Run, arrive: number, now: number): RecallRow {
  const inTime = r.returnAt <= arrive;
  const row: RecallRow = {
    runId: r.id,
    who: `${crewNames(r)}, at ${getLocation(r.plan.locationId).name}`,
    back: r.recalled !== undefined ? `Called home. Back at ${clockTime(r.returnAt)}, ${inTime ? 'in time' : 'too late to hold the gate'}.` : `Back at ${clockTime(r.returnAt)}, ${inTime ? 'in time to hold the gate' : 'too late to hold the gate'}.`,
    inTime,
  };
  if (r.recalled !== undefined || inTime) return row;
  if (!r.home && !r.lead) {
    row.note = (state.buildings.radio_tower ?? 0) >= 1 ? 'Out of reach: they set out before there was a way to call them.' : 'No way to call them home: that takes a Radio Tower.';
    return row;
  }
  if (radioWaiting(r, now)) return { ...row, note: 'On the radio already: answer them first.' };
  if (ledFightNow(r, now)) return { ...row, note: 'In a fight right now.' };
  const call = recallPreview(state, r.id, now);
  if (!call) return { ...row, note: 'On the way home already.' };
  return { ...row, call: { label: `Back by ${clockTime(call.returnAt)}, ${call.inTime ? 'in time' : 'still too late'}.`, inTime: call.inTime } };
}

/** Raiders on the road: who's home, crews out and calling them home, shoring up the fence and hiding stores. Undefined unless they're on the road. */
export function readyView(state: GameState, now: number): ReadyView | undefined {
  const raid = raidSeen(state, now);
  if (!raid) return undefined;
  const home = state.survivors.filter(canDefend).map((s) => s.firstName);
  const hands = state.survivors.some(canWork) ? undefined : 'Nobody is home to do it.';
  return {
    when: `At the gate around ${clockTime(raid.arrive)}.`,
    after: wantLine(raid) ?? RAID_BANDS[raid.by].after,
    ...(raid.waves === 2 ? { secondBand: 'A second band follows the first.' } : {}),
    home: home.length > 0 ? `Home to hold it now: ${names(home)}.` : 'Nobody is home to hold it.',
    crews: state.runs.map((r) => recallRow(state, r, raid.arrive, now)),
    shore: {
      done: raid.shored === true,
      label: `Shore it up (${costText(RAID_SHORE_COST)})`,
      text: raid.shored ? 'The fence is shored up: raiders need more to hit the defenders behind it.' : `Raiders need ${RAID_SHORE_COVER} more to hit the defenders behind it.`,
      ...(raid.shored ? {} : hands ? { problem: hands } : !canAfford(state, RAID_SHORE_COST) ? { problem: `Not enough scrap: it takes ${costText(RAID_SHORE_COST)}.` } : {}),
    },
    hide: {
      done: raid.hidden === true,
      text: raid.hidden ? 'Half the stores are hidden. If they break in they find only the rest, and the defenders reach only half the meds and ammo.' : 'If they break in they find only half. The defenders reach only half the meds and ammo, too.',
      ...(raid.hidden || !hands ? {} : { problem: hands }),
    },
  };
}

// ---------------------------------------------------------------- at the gate

export interface GateView {
  /** Who could hold the gate, and who will. */
  team: { id: string; name: string; in: boolean }[];
  teamHint: string;
  secondBand?: string;
  /** Talking first, while nothing has been said or done: paying them (what they want, or a toll), and staring them down. */
  talk?: {
    pay?: { text: string; label: string; problem?: string };
    /** They won't be paid: "They won’t take anything for Gray." */
    refused?: string;
    stare: string;
  };
  /** A band there's no talking to. */
  mute?: string;
  /** What came of talking. */
  said?: string;
}

/** At the gate before anyone fights: who holds it, and talking first. Undefined unless they're at the gate. */
export function gateView(state: GameState, now: number): GateView | undefined {
  const raid = raidAtGate(state);
  if (!raid) return undefined;
  const team = new Set(raidTeam(state));
  const view: GateView = {
    team: raidFighters(state).map((s) => ({ id: s.id, name: s.firstName, in: team.has(s.id) })),
    teamHint: raid.waves === 2 ? 'Tap to keep someone back: they stay fresh for the second band.' : 'Tap to keep someone out of it.',
    ...(raid.waves === 2 ? { secondBand: 'A second band waits back on the road. If the gate holds, they come on.' } : {}),
    ...(RAID_BANDS[raid.by].talk ? {} : { mute: 'There’s no talking to them.' }),
  };
  if (canTalk(state, now)) {
    const price = raidPrice(state, raid);
    const odds = stareOdds(state);
    const want = raid.wants && !raid.wants.missing ? raid.wants : undefined;
    const stare = odds ? `${odds.talker.firstName} does the talking: about ${Math.round(odds.chance * 100)}% they back off. If not, they strike first.` : '';
    if (price.refused) view.talk = { refused: price.problem!, stare };
    else
      view.talk = {
        pay: {
          text: want?.what === 'vehicle' || want?.what === 'prisoner' ? `Hand over ${price.text}, and they go.` : `They want ${price.text} to go away.`,
          label: want?.what === 'vehicle' || want?.what === 'prisoner' ? 'Hand them over' : 'Pay them off',
          ...(price.problem ? { problem: price.problem } : {}),
        },
        stare,
      };
    if (want?.what === 'vehicle' && view.talk.pay) view.talk.pay.label = 'Hand it over';
  }
  const talk = raid.talk;
  if (talk?.how === 'stare' && !talk.ok) {
    const who = state.survivors.find((s) => s.id === talk.by)?.firstName ?? 'Someone';
    view.said = `${who} told them to go. They didn’t. They’ll strike first.`;
  }
  return view;
}

// ---------------------------------------------------------------- between the bands

export interface RegroupView {
  /** "Coming up the road: two Raider Scavs." */
  against: string;
  /** The patching up. */
  lines: string[];
  people: { id: string; name: string; state: string; can: boolean }[];
}

/** The first band beaten under command, the second coming: who's fit to meet it. Undefined otherwise. */
export function regroupView(state: GameState, now: number): RegroupView | undefined {
  const at = raidRegroup(state, now);
  if (!at) return undefined;
  return {
    against: `Coming up the road: ${at.against}.`,
    lines: at.lines.map((l) => l.text),
    people: at.people.map((p) => ({ id: p.id, name: p.name, state: p.down ? 'Down' : `${p.hp}/${p.maxHp} HP${p.fought ? '' : ', fresh'}`, can: !p.down })),
  };
}

// ---------------------------------------------------------------- the end

export interface RaidOverView {
  /** What happened, from the news: who came, how it went, what they left or took. */
  lines: string[];
  /** One of them left behind alive, held at the Depot. */
  captive?: { id: string; name: string };
}

/** The raid just over: its news, and a captive if one was taken. */
export function raidOver(state: GameState): RaidOverView | undefined {
  const raid = state.depot.raid;
  if (!raid || raid.ended === undefined) return undefined;
  const lines = state.log.filter((l) => l.tags?.includes(raid.id)).map((l) => l.text);
  const held = raid.spoils?.captive ? state.captives.find((c) => c.person.id === raid.spoils!.captive) : undefined;
  return { lines, ...(held ? { captive: { id: held.person.id, name: `${held.person.firstName} ${held.person.lastName}` } } : {}) };
}
