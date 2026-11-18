/**
 * Haven's gate before the last fight (§9.12), played on the stage as a short
 * scene: the gate shut, a door banging open in the wall, the one who went
 * east running out to warn the guild, the shot from the wall, the Vultures
 * pulling up behind, and the gate opening on Haven's own. Each frame is a
 * still with a line from the run's log under it; the fight's own stage takes
 * over once it's done.
 */
import { HAVEN_JOURNEY, type FightView, type GameState, type LedFight, type Run, type Survivor } from '../engine/index.ts';
import type { FigureLook, StageExtra, StageFighter, StageModel } from '../scene/index.ts';
import { stageModel } from './battle-view.ts';
import { figureLook } from './yard-view.ts';

export interface SceneFrame {
  model: StageModel;
  /** The line from the log this frame shows. */
  caption: string;
  /** How long it stays before the next. */
  ms: number;
}

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

/** Long enough to read the line: a moment, and a bit more for each word. */
export function readingTime(text: string): number {
  return Math.round(1400 + text.split(/\s+/).length * 260);
}

/** The one who went east (§9.11), at Haven now: they're the one who runs out. */
function dreamer(state: GameState): Survivor | undefined {
  const d = state.haven?.dreamer;
  return d && d.gone !== undefined ? state.departed.find((s) => s.id === d.id) : undefined;
}

/**
 * The scene before the fight at Haven's north gate, or undefined for any
 * other fight. `view` is the fight as it would stand for the first round's
 * orders; `fight` is the stop on the run, whose beat before holds the lines.
 */
export function gateScene(state: GameState, run: Run, fight: LedFight, view: FightView): SceneFrame[] | undefined {
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
  const shut = (extras: StageExtra[], more: Partial<StageModel> = {}): StageModel => ({ ...base, place: 'haven_gate_shut', crew: guildOnly, enemies: [], targets: [], extras, scene: true, ...more });

  const who = dreamer(state);
  const look: FigureLook = who ? { ...figureLook(who), ...GOWN, hurt: true } : STRANGER;
  const { armor: _armor, hat: _hat, ...bare } = look;
  const runner: StageFighter = { key: 'x:runner', side: 'crew', label: who?.firstName ?? 'Stranger', title: who?.firstName ?? 'A stranger', hp: 1, maxHp: 1, state: 'up', look: bare };
  const at = (x: number, y: number, scale: number, more: Partial<StageExtra> = {}): StageExtra => ({ fighter: runner, x, y, scale, facing: -1, ...more });
  const fallen = at(204, 212, 1, { lying: true });

  const frames: SceneFrame[] = [
    { model: shut([at(250, 166, 0.7)]), caption: runnerLines[0]!, ms: readingTime(runnerLines[0]!) },
    { model: shut([at(232, 184, 0.85, { running: true })]), caption: runnerLines[1]!, ms: 1800 },
    { model: shut([at(214, 198, 0.95, { running: true })]), caption: runnerLines[1]!, ms: Math.max(1600, readingTime(runnerLines[1]!) - 1800) },
    // The shot comes from the marksman's post on the wall.
    { model: shut([at(206, 206, 1, { hit: true })], { shot: { x: 40, y: 47, to: { x: 206, y: 170 } } }), caption: runnerLines[2]!, ms: 1100 },
    { model: shut([fallen]), caption: runnerLines[2]!, ms: readingTime(runnerLines[2]!) },
  ];
  if (vulturesLine) frames.push({ model: { ...shut([fallen]), crew: base.crew }, caption: vulturesLine, ms: readingTime(vulturesLine) });
  frames.push({ model: { ...base, extras: [fallen], targets: [], scene: true }, caption: openLine, ms: readingTime(openLine) });
  return frames;
}
