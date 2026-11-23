/**
 * What the game sounds like (3.1.0): which music and ambience go with the
 * screen and the hour, which effects a change to the game or an act in a
 * fight makes, and when the phone gives a short buzz. Plain TypeScript, so it
 * can be tested; `audio.ts` plays it.
 */
import { openRaid, raidAtGate, raidSeen, type FightAct, type FightView, type GameState } from '../engine/index.ts';
import { dayPhase } from '../scene/model.ts';
import { anyoneFighting } from './fight-view.ts';
import { anyoneCalling } from './radio-view.ts';
import type { Route } from './route.ts';
import type { AmbienceId, MusicId, SoundId } from './sounds.ts';

/** One effect to play: how loud (0–1), left to right (−1–1), a little faster or slower, and when (seconds from now). */
export interface Cue {
  id: SoundId;
  gain?: number;
  pan?: number;
  rate?: number;
  delay?: number;
}

/** A short buzz of the phone: a light one for a hit taken, a heavy one when someone goes down. */
export type Buzz = 'light' | 'heavy';

/** How loud each layer is, 0–1, before the player's own volumes. */
export type AmbienceMix = Record<AmbienceId, number>;

// ---------------------------------------------------------------- music and ambience

/** The music for a screen at an hour of the phone's day. */
export function musicFor(route: Route, state: GameState, hour: number): MusicId {
  if (route.screen === 'fight') return 'fight';
  if (route.screen === 'raid' && openRaid(state)) return 'fight';
  // The road east, and Haven's notebook: its own unsettling tune.
  if (state.haven?.road || route.screen === 'haven') return 'haven';
  const phase = dayPhase(hour);
  return phase === 'night' || phase === 'dusk' ? 'night' : 'depot';
}

const SILENT: AmbienceMix = { wind: 0, fire: 0, crickets: 0, birds: 0 };

/**
 * The sounds of the yard under the music, by the hour: wind always, the fire
 * (nearer on the yard itself), birds by day and crickets at night. Fights have
 * their music alone; with everyone on the road east the Depot has only wind.
 */
export function ambienceFor(route: Route, state: GameState, hour: number): AmbienceMix {
  if (route.screen === 'fight' || (route.screen === 'raid' && openRaid(state))) return SILENT;
  if (state.haven?.road) return { ...SILENT, wind: 0.8 };
  const phase = dayPhase(hour);
  const yard = route.screen === 'depot' && route.tab === undefined;
  const fire = (yard ? 0.75 : 0.4) * (phase === 'night' ? 1.2 : 1);
  switch (phase) {
    case 'dawn':
      return { wind: 0.45, fire, birds: 0.9, crickets: 0.2 };
    case 'day':
      return { wind: 0.6, fire, birds: 0.6, crickets: 0 };
    case 'dusk':
      return { wind: 0.5, fire, birds: 0.25, crickets: 0.55 };
    case 'night':
      return { wind: 0.4, fire, birds: 0, crickets: 0.85 };
  }
}

// ---------------------------------------------------------------- the game changing

/**
 * The effects a change to the game makes, loudest news first, at most two:
 * someone dying, a raid ending without a fight, a crew home or setting out, someone new,
 * something built or made, a trade, a find for Haven, a decision to make.
 * A different guild (a new game, an import) makes no sound.
 */
export function stateCues(before: GameState, after: GameState): Cue[] {
  if (before.seed !== after.seed || before.createdAt !== after.createdAt) return [];
  const out: Cue[] = [];
  if (after.memorial.length > before.memorial.length) out.push({ id: 'death' });
  const ended = after.depot.raid?.end;
  if (ended && !before.depot.raid?.end && after.depot.raid?.ended !== undefined) {
    if (ended === 'paid') out.push({ id: 'trade' });
    else if (ended === 'stared') out.push({ id: 'stare' });
  }
  if (after.reports.length > before.reports.length) out.push({ id: 'home' });
  const sent = after.runs.filter((r) => !before.runs.some((b) => b.id === r.id));
  if (sent.length > 0) out.push({ id: sent.some((r) => (r.plan.vehicles ?? []).length > 0) ? 'engine' : 'send' });
  const newcomers = after.survivors.filter((s) => !before.survivors.some((b) => b.id === s.id) && !before.children.some((c) => c.id === s.id));
  const back = new Set(after.reports.filter((r) => !before.reports.some((b) => b.id === r.id)).flatMap((r) => r.plan.crew));
  if (newcomers.some((s) => !back.has(s.id))) out.push({ id: 'recruit' });
  if ((after.haven?.found.length ?? 0) > (before.haven?.found.length ?? 0)) out.push({ id: 'clue' });
  if (built(before, after)) out.push({ id: 'build' });
  if (after.story && before.story && after.story.step > before.story.step) out.push({ id: 'reward' });
  if (after.corners.last && after.corners.last !== before.corners.last && after.corners.searched.length > before.corners.searched.length) out.push({ id: 'loot' });
  // A trade (supplies or gear); sending the trader on changes nothing to hear.
  if (after.depot.offers.length < before.depot.offers.length && (spent(before, after) || gained(before, after))) out.push({ id: 'trade' });
  else if (after.stash.length !== before.stash.length && (spent(before, after) || gained(before, after)) && sent.length === 0 && after.reports.length === before.reports.length) out.push({ id: 'craft' });
  if (after.dilemmas.active && after.dilemmas.active.day !== before.dilemmas.active?.day) out.push({ id: 'decision' });
  return out.slice(0, 2).map((c, i) => (i === 0 ? c : { ...c, delay: 0.35, gain: 0.7 }));
}

function built(before: GameState, after: GameState): boolean {
  for (const [id, level] of Object.entries(after.buildings)) if (level > (before.buildings[id as keyof typeof before.buildings] ?? 0)) return true;
  for (const [id, p] of Object.entries(after.projects)) if (p && p.done > (before.projects[id as keyof typeof before.projects]?.done ?? 0)) return true;
  return false;
}

function spent(before: GameState, after: GameState): boolean {
  return Object.entries(after.resources).some(([k, v]) => v < before.resources[k as keyof typeof before.resources]);
}

function gained(before: GameState, after: GameState): boolean {
  return Object.entries(after.resources).some(([k, v]) => v > before.resources[k as keyof typeof before.resources]);
}

/** What needs the player right now, as far as sound goes: a crew on the radio or in a fight, raiders seen or at the gate. */
export interface Alerts {
  radio: boolean;
  /** 0 no raid, 1 raiders seen on the road, 2 at the gate. */
  raid: 0 | 1 | 2;
}

export function alertsAt(state: GameState, now: number): Alerts {
  return {
    radio: anyoneCalling(state, now) || anyoneFighting(state, now),
    raid: raidAtGate(state) ? 2 : raidSeen(state, now) ? 1 : 0,
  };
}

/** The effect when something starts to need the player with the game open: a call coming in, raiders seen, then at the gate. */
export function alertCues(before: Alerts, after: Alerts): Cue[] {
  const out: Cue[] = [];
  if (after.raid > before.raid) out.push({ id: 'alarm', gain: after.raid === 1 ? 0.6 : 1 });
  if (after.radio && !before.radio) out.push({ id: 'radio' });
  return out;
}

// ---------------------------------------------------------------- fights

const CREW_PAN = -0.35;
const ENEMY_PAN = 0.35;

/** A gun's report, by the weapon. */
const SHOTS: Record<string, SoundId> = {
  pipe_pistol: 'pistol',
  hunting_rifle: 'rifle',
  scattergun: 'shotgun',
  crossbow: 'crossbow',
};

/** A blow's swing and what it sounds like when it lands, by the weapon. */
const BLOWS: Record<string, { swing: SoundId; land: SoundId }> = {
  pipe: { swing: 'swing', land: 'blunt' },
  sledge: { swing: 'swing', land: 'blunt' },
  machete: { swing: 'swing2', land: 'blade' },
  shock_baton: { swing: 'swing2', land: 'zap' },
};

/** Enemies that shoot with something other than a pistol, and those that bite, groan or whirr. */
const ENEMY_SHOTS: Record<string, SoundId> = {
  raider_gunner: 'rifle',
  vulture_shot: 'rifle',
  haven_marksman: 'rifle',
  scrap_drone: 'laser',
  scrapbot_sentry: 'laser',
};

/** What a blow from this enemy sounds like, swinging and landing. */
function enemyBlow(view: FightView, index: number): { swing: SoundId; land: SoundId } {
  const e = view.enemies[index];
  if (!e) return { swing: 'swing', land: 'blunt' };
  if (e.type === 'feral') return { swing: 'snarl', land: 'bite' };
  if (e.type === 'hollow' || e.kind === 'the_shepherd') return { swing: 'groan', land: 'blunt' };
  if (e.type === 'scrapbot') return { swing: 'servo', land: 'blunt' };
  if (e.kind === 'haven_orderly' || e.kind === 'raider_scav' || e.kind === 'vulture_scav') return { swing: 'swing2', land: 'blade' };
  return { swing: 'swing', land: 'blunt' };
}

/** The sound of one act on the battle stage, and a buzz when it hurts one of the guild badly. */
export function actCues(state: GameState, view: FightView, act: FightAct): { cues: Cue[]; buzz?: Buzz } {
  const byCrew = typeof act.by === 'string';
  const pan = byCrew ? CREW_PAN : ENEMY_PAN;
  const at = (id: SoundId, delay = 0, gain = 1): Cue => ({ id, pan: byCrew ? ENEMY_PAN : CREW_PAN, delay, gain });
  const own = (id: SoundId, delay = 0, gain = 1): Cue => ({ id, pan, delay, gain });
  switch (act.kind) {
    case 'hit':
    case 'kill':
    case 'miss':
    case 'finish': {
      const cues: Cue[] = [];
      const landed = act.kind !== 'miss';
      if (act.by === 'dog') {
        cues.push(own('bark'));
        if (landed) cues.push(at('bite', 0.2));
      } else if (act.shot) {
        cues.push(own(shotSound(state, view, act.by)));
        cues.push(landed ? at('hurt', 0.12, 0.6) : at('ricochet', 0.1, 0.7));
      } else {
        const blow = byCrew ? crewBlow(state, act.by as string) : enemyBlow(view, act.by as number);
        cues.push(own(blow.swing, 0, 0.8));
        if (landed) cues.push(at(blow.land, 0.12));
      }
      if (act.kind === 'kill' || act.kind === 'finish' || act.down) cues.push(at(fallSound(view, act), 0.35));
      const onCrew = typeof act.at === 'string';
      const buzz: Buzz | undefined = onCrew && landed ? (act.down ? 'heavy' : (act.amount ?? 0) >= 4 ? 'light' : undefined) : undefined;
      return buzz ? { cues, buzz } : { cues };
    }
    case 'heal':
    case 'revive':
      return { cues: [own('heal')] };
    case 'talk':
      return { cues: [own(act.ok ? 'stare' : 'nope')] };
    case 'cover':
    case 'aim':
    case 'guard':
    case 'spot':
    case 'draw_fire':
      return { cues: [own('shuffle')] };
    case 'flee':
    case 'break':
    case 'escape':
    case 'withdraw':
      return { cues: [own('run')] };
    case 'rise':
      return { cues: [own('groan')] };
    case 'arrive':
      return { cues: [own('door')] };
    case 'job':
      return { cues: [own('work')] };
    case 'reel':
      return { cues: [] };
  }
}

function crewBlow(state: GameState, id: string): { swing: SoundId; land: SoundId } {
  const weapon = state.survivors.find((s) => s.id === id)?.equipment.weapon?.defId;
  return (weapon ? BLOWS[weapon] : undefined) ?? { swing: 'swing2', land: 'punch' };
}

function shotSound(state: GameState, view: FightView, by: number | string): SoundId {
  if (typeof by === 'number') {
    const kind = view.enemies[by]?.kind ?? '';
    return ENEMY_SHOTS[kind] ?? 'pistol2';
  }
  const m = view.crew.find((c) => c.id === by);
  // A Vulture beside the guild, or a lookout up on the tower: a rifle.
  if (m?.ally || m?.perch) return 'rifle';
  const weapon = state.survivors.find((s) => s.id === by)?.equipment.weapon?.defId;
  return (weapon ? SHOTS[weapon] : undefined) ?? 'pistol';
}

function fallSound(view: FightView, act: FightAct): SoundId {
  if (typeof act.at === 'number') {
    const e = view.enemies[act.at];
    if (e?.type === 'scrapbot') return 'door';
  }
  return 'fall';
}

/** The sound of a fight ending, by how. */
export function endCue(end: NonNullable<FightView['over']>): Cue | undefined {
  switch (end) {
    case 'won':
      return { id: 'victory' };
    case 'routed':
      return { id: 'defeat' };
    case 'withdrew':
      return { id: 'run' };
    case 'stalemate':
      return undefined;
  }
}

// ---------------------------------------------------------------- taps

/** What a tap on an element sounds like: the tab bar turns a page, anything else that can be pressed clicks. */
export function tapCue(el: { closest(selector: string): unknown } | null): Cue | undefined {
  if (!el) return undefined;
  if (el.closest('.tab')) return { id: 'tab', gain: 0.7 };
  if (el.closest('button, a[href], [role="button"], [role="switch"], summary, input[type="checkbox"], input[type="radio"]')) return { id: 'tap', gain: 0.6 };
  return undefined;
}

// ---------------------------------------------------------------- volumes

/** The player's volumes (0–1) as gains: a slider's middle sounds like half as loud. */
export function gainOf(volume: number): number {
  const v = Math.min(1, Math.max(0, volume));
  return v * v;
}
