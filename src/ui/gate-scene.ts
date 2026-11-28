/**
 * Haven's gate before the last fight (§9.12), played on the stage as a moving scene (4b): the gate shut,
 * a door banging open in the wall and the one who went east running out to warn the guild, screaming,
 * running again, the shot from the wall and the fall; the Vultures coming up behind; the great gate
 * swinging open and Haven's own walking out of it, the Shepherd last. Its lines come up under it from
 * the run's log, and it has its sound: Haven's tune turning to the truth at the scream. The camera pushes
 * in on whoever speaks, with their face over the stage (the one who went east is one of the guild's
 * own; Aviel, 2026-11-28), and she bleeds when she's shot. The fight's own stage takes over once it's done.
 */
import { HAVEN_JOURNEY, type FightView, type GameState, type LedFight, type Run, type Survivor } from '../engine/index.ts';
import type { ExtraKey, ExtraPose, FigureLook, StageExtra, StageFighter, StageModel } from '../scene/index.ts';
import { stageModel } from './battle-view.ts';
import { readingTime, type SceneFace, type SceneShot } from './scene-view.ts';
import { figureLook } from './yard-view.ts';

/** A hospital gown, whoever wears it. */
const GOWN = { cloth: '#e6e3d8', accent: '#c9d3cf' };

/** Whoever comes out of the door when nobody of the guild went east. */
const STRANGER: FigureLook = {
  skin: '#c99a73',
  skinShade: '#a97b58',
  hair: '#4a3527',
  hairDark: '#33231a',
  longHair: true,
  bald: false,
  ...GOWN,
  hurt: true,
};

/** Where the small door is, where they stop to scream, where the shot finds them, and where they lie. */
const DOOR = { x: 250, y: 158, scale: 0.42 };
const STOP = { x: 230, y: 184, scale: 0.84 };
const HIT = { x: 213, y: 199, scale: 0.95 };
const LIE = { x: 205, y: 210, scale: 1 };
/** The marksman's post on the wall, and the mouth of the great gate. */
const POST = { x: 40, y: 47 };
const GATE = { x: 200, y: 156, scale: 0.4 };

/** The one who went east (§9.11), at Haven now: they're the one who runs out. */
function dreamer(state: GameState): Survivor | undefined {
  const d = state.haven?.dreamer;
  return d && d.gone !== undefined ? state.departed.find((s) => s.id === d.id) : undefined;
}

const sec = (ms: number): number => Math.round(ms / 100) / 10;

/**
 * The runner's way through the first shot: out of the door and down the road, screaming in bursts while
 * the line is read, running again, hit, and down.
 */
function runnerKeys(scream: number, shotAt: number): ExtraKey[] {
  const k = (t: number, p: { x: number; y: number; scale: number }, pose: ExtraPose, hidden = false): ExtraKey => ({ t, ...p, pose, ...(hidden ? { hidden } : {}) });
  const keys = [k(0.45, DOOR, 'stand', true), k(0.6, { ...DOOR, y: DOOR.y + 1 }, 'run'), k(1.6, { x: 238, y: 174, scale: 0.68 }, 'run'), k(2.4, STOP, 'stand')];
  // Shouting, catching breath, shouting again, until it's time to run.
  const go = shotAt - 1.1;
  for (let t = scream, n = 0; t < go - 0.3; t += n % 2 ? 1.3 : 2.4, n++) keys.push(k(t, STOP, n % 2 ? 'stand' : 'shout'));
  keys.push(k(go, STOP, 'run'), k(shotAt, HIT, 'hit'), k(shotAt + 0.5, LIE, 'lying'));
  return keys;
}

/**
 * The scene before the fight at Haven's north gate, or undefined for any other fight. `view` is the fight
 * as it would stand for the first round's orders; `fight` is the stop on the run, whose beat before holds
 * the lines.
 */
export function gateScene(state: GameState, run: Run, fight: LedFight, view: FightView): SceneShot[] | undefined {
  if (fight.site !== 'haven_gate') return undefined;
  const lines = (run.beats[fight.fromBeat - 1]?.lines ?? []).map((l) => l.text);
  // The runner's three lines come first; what the shot does to people's nerve may follow, then the Vultures and the gate.
  const runnerLines = lines.slice(0, 3);
  const vultures = HAVEN_JOURNEY.gate.vultures.slice(0, HAVEN_JOURNEY.gate.vultures.indexOf('{'));
  const vulturesLine = lines.find((l) => l.startsWith(vultures));
  const openLine = lines.find((l) => l === HAVEN_JOURNEY.gate.open);
  if (runnerLines.length < 3 || !openLine) return undefined;
  const base = stageModel(state, { place: 'haven_gate', seed: run.id }, view, { picks: {} });

  // The guild in its ranks, the Vultures not there yet ("fled" isn't drawn), the gate shut.
  const guildOnly: StageFighter[] = base.crew.map((f) => (f.vulture ? { ...f, state: 'fled' } : f));
  const who = dreamer(state);
  const look: FigureLook = who ? { ...figureLook(who), ...GOWN, hurt: true } : STRANGER;
  const { armor: _armor, hat: _hat, ...bare } = look;
  const runner: StageFighter = { key: 'x:runner', side: 'crew', label: who?.firstName ?? 'Stranger', title: who?.firstName ?? 'A stranger', hp: 1, maxHp: 1, state: 'up', look: bare };
  const fallen: StageExtra = { fighter: runner, ...LIE, facing: -1, lying: true, blood: true };

  // 1. The door, the runner, the scream, the shot.
  const [r0, r1, r2] = runnerLines.map(readingTime) as [number, number, number];
  const scream = sec(r0);
  const shotAt = sec(r0 + r1) + 0.3;
  // In close on her while she screams, and out again before she runs, so the shot from the wall is seen.
  const go = shotAt - 1.1;
  const onHer = { scale: 1.9, x: STOP.x, y: STOP.y - 30 };
  const her: SceneFace[] = who ? [{ survivor: who, name: who.firstName, at: scream + 0.4, until: go - 0.9, tone: 'hurt', side: 'left' }] : [];
  // Screaming without words (they're on the screen), on the first burst and the third. A stranger is a woman.
  const keys = runnerKeys(scream, shotAt);
  const bursts = keys.filter((k) => k.pose === 'shout').map((k) => k.t);
  const voice = who?.pronouns === 'he' ? ('scream_m' as const) : ('scream_f' as const);
  const screams = [bursts[0], bursts[2]].filter((t) => t !== undefined).map((t, i) => ({ id: voice, delay: t + 0.05, gain: i ? 0.8 : 1, rate: i ? 0.97 : 1 }));
  const shots: SceneShot[] = [
    {
      model: {
        ...base,
        place: 'haven_gate_door',
        crew: guildOnly,
        enemies: [],
        targets: [],
        scene: true,
        extras: [{ fighter: runner, ...DOOR, facing: -1, keys, blood: true }],
        shot: { ...POST, to: { x: HIT.x, y: HIT.y - 38 }, at: shotAt - 0.03 },
        camera: [
          { t: 0, scale: 1 },
          { t: scream - 0.1, scale: 1 },
          { t: scream + 0.6, ...onHer },
          { t: go - 0.9, ...onHer },
          { t: go - 0.2, scale: 1 },
        ],
      },
      faces: her,
      lines: [
        { at: 0, text: runnerLines[0]! },
        { at: scream, text: runnerLines[1]! },
        { at: sec(r0 + r1), text: runnerLines[2]! },
      ],
      ms: r0 + r1 + r2,
      sound: {
        ambience: { wind: 0.55, fire: 0, crickets: 0, birds: 0.2 },
        // Haven's tune as they come up to it, until the scream.
        music: [
          { id: 'haven', at: 0 },
          { id: 'truth', at: scream },
        ],
        cues: [
          { id: 'gale', gain: 0.4, delay: 0 },
          { id: 'door_bang', delay: 0.45 },
          { id: 'run_gravel', gain: 0.7, delay: 0.6 },
          ...screams,
          { id: 'run_gravel', gain: 0.85, rate: 1.05, delay: shotAt - 1.1 },
          { id: 'shot_far', delay: shotAt - 0.05 },
          { id: 'body_fall', delay: shotAt + 0.45 },
        ],
      },
    },
  ];

  // 2. The Vultures, as they promised, come up behind the guild; then in close on them, and their boss says it.
  const allies = base.crew.filter((f) => f.vulture).map((f) => f.key);
  if (vulturesLine && allies.length > 0) {
    const quote = vulturesLine.indexOf('“');
    const [told, said] = quote > 0 ? [vulturesLine.slice(0, quote).trim(), vulturesLine.slice(quote)] : [vulturesLine, ''];
    const arrived = 1.3 + allies.length * 0.35 + 1.7;
    const speaks = Math.max(sec(readingTime(told)), arrived + 0.8);
    const boss = view.crew.find((m) => m.ally);
    const speaker = boss && state.vultures.people.find((p) => p.person.id === boss.id)?.person;
    const end = speaks + (said ? sec(readingTime(said)) : 0);
    shots.push({
      model: {
        ...base,
        place: 'haven_gate_shut',
        enemies: [],
        targets: [],
        scene: true,
        extras: [fallen],
        arrive: [{ keys: allies, from: 'left', at: 1.3, stagger: 0.35, seconds: 1.7 }],
        camera: [
          { t: 0, scale: 1 },
          { t: arrived - 0.4, scale: 1 },
          { t: arrived + 0.4, scale: 1.8, on: allies },
        ],
      },
      lines: said ? [{ at: 0, text: told }, { at: speaks, text: said }] : [{ at: 0, text: told }],
      ms: Math.round(end * 1000),
      faces: speaker ? [{ survivor: speaker, name: speaker.firstName, at: speaks - 0.2, until: end - 0.2, tone: 'vulture', side: 'right' }] : [],
      sound: {
        ambience: { wind: 0.5, fire: 0, crickets: 0, birds: 0 },
        cues: [
          { id: 'pull_up', delay: 0 },
          { id: 'boots', delay: 1.2 },
        ],
      },
    });
  }

  // 3. The gate swings open, and Haven's own come out of it, the Shepherd last and slowest.
  const shepherd = base.enemies.filter((e) => e.kind === 'the_shepherd').map((e) => e.key);
  const theRest = base.enemies.filter((e) => e.kind !== 'the_shepherd').map((e) => e.key);
  const out = 3.1;
  const big = out + theRest.length * 0.45 + 0.7;
  shots.push({
    model: {
      ...base,
      place: 'haven_gate_opening',
      targets: [],
      scene: true,
      extras: [fallen],
      arrive: [{ keys: theRest, from: GATE, at: out, stagger: 0.45, seconds: 2 }, ...(shepherd.length ? [{ keys: shepherd, from: GATE, at: big, stagger: 0, seconds: 3.2 }] : [])],
    },
    lines: [{ at: 0, text: openLine }],
    ms: Math.max(readingTime(openLine), (big + 4.5) * 1000),
    sound: {
      ambience: { wind: 0.45, fire: 0, crickets: 0, birds: 0 },
      cues: [
        { id: 'gate_groan', delay: 0.5 },
        { id: 'shuffle', gain: 0.8, delay: out + 0.2 },
        { id: 'shuffle', gain: 0.7, rate: 0.95, delay: out + 1.4 },
        ...(shepherd.length
          ? [
              { id: 'stomp' as const, gain: 0.7, delay: big + 0.6 },
              { id: 'stomp' as const, gain: 0.85, rate: 0.96, delay: big + 1.6 },
              { id: 'groan' as const, rate: 0.7, delay: big + 2.2 },
              { id: 'stomp' as const, rate: 0.92, delay: big + 2.7 },
            ]
          : []),
      ],
    },
  });
  return shots;
}
