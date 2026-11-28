/**
 * The battle stage (§7.13): a fight under command drawn as a side view, the
 * crew on the left facing the enemies on the right, over a backdrop of the
 * place. Plain data in (`StageModel`, built by `src/ui/battle-view.ts`), one
 * SVG out. Each step of a round is drawn afresh with the act it shows (who
 * lunges or fires, who is hit, the number that pops up), and CSS animates it.
 */
import { BACKDROP_PLACES, HORIZON, STAGE_H, STAGE_W, TOWER_DECK, backdropSvg } from './backdrops.ts';
import { BONE, INK, circle, ellipse, escapeAttr, line, pathEl, poly, rect } from './draw.ts';
import { DRAWN_ENEMIES, crewBody, dogSvg, enemyBody, enemyHeight, enemyMuzzle, muzzle, personSvg } from './fighters.ts';
import type { FigureLook } from './model.ts';

export { BACKDROP_PLACES, DRAWN_ENEMIES, STAGE_H, STAGE_W };

export interface StageFighter {
  /** 'c:<survivor id>' or 'e:<place in the fight>': what a tap names. */
  key: string;
  side: 'crew' | 'enemy';
  /** Short, for under the bar: a first name, "Scav 2". */
  label: string;
  /** Read out: "Raider Scav 2, 4 of 7". */
  title: string;
  hp: number;
  maxHp: number;
  /** `waiting`: behind a door, not on the stage yet (2.5.0). */
  state: 'up' | 'down' | 'dead' | 'fled' | 'waiting';
  /** The crew: their colors and the weapon they carry. */
  look?: FigureLook;
  weapon?: string;
  /** Enemies: which one ('raider_gunner'), its type, and a seed that varies its looks. */
  kind?: string;
  type?: string;
  seed?: string;
  nemesis?: boolean;
  vulture?: boolean;
  stunned?: boolean;
  aimed?: boolean;
  /** A lookout on the Watchtower in a raid (§9.8): drawn up on its deck. */
  perch?: boolean;
  /** Where they stand (2.3.0): the back rank stands behind the front; flyers with the back. */
  rank?: 'front' | 'back' | 'air';
  /**
   * An enemy's move this round (2.3.0): a hit or a big hit at someone (their key), or a run for it; since 3.8.0
   * lining up a shot or taking it, mending one of its own (`ally`, its key), a firebomb, a grab, or a grip held.
   */
  intent?: { kind: IntentKind; at?: string; also?: string; ally?: string };
  /** One of the crew (3.8.0): what's coming at them this round, before armor, and whether it could put them down; a firebomb in it; a shot lined up for next round. */
  threat?: { amount: number; drop: boolean; fire: boolean; next: boolean };
  /** One of the crew in a hollow's grip (3.8.0). */
  held?: boolean;
  /** An enemy about to be patched up (3.8.0): how much. */
  mending?: number;
  /** On the ground and getting back up unless finished (a hollow, 2.4.0). */
  rising?: boolean;
  /** Heavy armor (2.4.0): a shield by the name. */
  armored?: boolean;
  /** One of a kind (3.12.0): a gold star by the name. */
  elite?: boolean;
  /** Plates still on it (3.12.0): a pip for each, by the bar. */
  plates?: number;
  /** Gone under (3.12.0): only the ripples where it went down show. */
  under?: boolean;
}

/** What an enemy means to do, as its badge shows it (2.3.0, 3.8.0). */
export type IntentKind = 'strike' | 'heavy' | 'run' | 'aim' | 'shot' | 'mend' | 'throw' | 'grab' | 'hold' | 'call' | 'sweep' | 'dive' | 'surface';

/** One act being played: who does it, to whom, and what pops up. */
export interface StageEffect {
  by: string;
  at?: string;
  /** How the one acting moves: lunging in, firing, or doing something where they stand. */
  motion: 'lunge' | 'shoot' | 'act' | 'none';
  /** How the one acted on reacts. */
  reaction: 'hit' | 'miss' | 'heal' | 'none';
  /** Above the target (or the actor, with no target): "-5", "Miss", "+8", "Down". */
  pop?: string;
  tone: 'hurt' | 'hit' | 'miss' | 'heal' | 'plain';
  /** Fighters who run off in this act. */
  leaving?: string[];
  /** A heavy blow, or someone going down: the stage shakes (3.2.0). */
  big?: boolean;
  /** What flies off whoever is hit (3.2.0): blood, sparks off a machine; dust where a shot misses. */
  splash?: 'blood' | 'sparks' | 'dust';
  /** The health of whoever was acted on, before this act (3.7.0): the bar drains from it, or fills up from it. */
  was?: number;
}

export interface StageModel {
  /** The place's id, for the backdrop. */
  place: string;
  crew: StageFighter[];
  enemies: StageFighter[];
  /** The person being given orders. */
  giving?: string;
  /** What can be tapped for the move being picked, and what was picked. */
  targets: string[];
  picked?: string;
  effect?: StageEffect;
  /** Their nerve, 0–100, when they can break (2.3.0). */
  nerve?: number;
  /** The job the fight came with (2.5.0), in the other top corner. */
  job?: StageJob;
  /** People outside the fight, placed by hand (Haven's gate, §9.12): someone running out of a door, or lying in the road. */
  extras?: StageExtra[];
  /**
   * A shot from somewhere nobody on the stage stands, such as a wall: a flash there and its line to whoever
   * it hit; held for the frame, or in a moving scene (4b) only at `at` seconds in.
   */
  shot?: { x: number; y: number; to?: { x: number; y: number }; at?: number };
  /** A moving scene (4b): fighters of the ranks coming onto the stage, from the left edge or from a point (a gate). */
  arrive?: StageArrival[];
  /** A moving scene (4b): the camera pushing in on someone and pulling back out. */
  camera?: CameraKey[];
  /** A scene before a fight rather than the fight: no names, bars or marks, and nothing to tap. */
  scene?: boolean;
}

/** Someone placed by hand on the stage, outside the ranks. */
export interface StageExtra {
  fighter: StageFighter;
  x: number;
  y: number;
  scale: number;
  facing: 1 | -1;
  /** Leaning into a run. */
  running?: boolean;
  /** Jolted, as by a hit. */
  hit?: boolean;
  /** On the ground. */
  lying?: boolean;
  /** A moving scene (4b): where they are at each moment and how they stand from then; `x`, `y` and `scale` are ignored. */
  keys?: ExtraKey[];
  /** Shot: blood flies when the hit comes, and pools under them on the ground. */
  blood?: boolean;
}

/**
 * Where the camera is at a moment of a moving scene (4b): how close, and on what: a point, or the middle of
 * some fighters of the ranks. It eases from one key to the next, and never shows past the stage's edge.
 */
export interface CameraKey {
  t: number;
  scale: number;
  x?: number;
  y?: number;
  on?: string[];
}

/** How someone placed by hand stands in a moving scene: running leans and bobs, shouting leans and shakes. */
export type ExtraPose = 'stand' | 'run' | 'shout' | 'hit' | 'lying';

/** Where someone placed by hand is at a moment of a moving scene (4b), and how they stand from then until the next. */
export interface ExtraKey {
  /** Seconds from the start of the scene. */
  t: number;
  x: number;
  y: number;
  scale: number;
  pose?: ExtraPose;
  /** Not seen yet (behind a door). */
  hidden?: boolean;
}

/** Fighters of the ranks coming on in a moving scene (4b), one after another. */
export interface StageArrival {
  keys: string[];
  /** Off the left edge, or out of a point on the backdrop at a scale (a gate). */
  from: 'left' | { x: number; y: number; scale: number };
  /** Seconds in when the first starts, and between each. */
  at: number;
  stagger: number;
  /** How long each takes to get to their place. */
  seconds: number;
}

/** A fight's job on the stage: its name and a pip for each turn of work. */
export interface StageJob {
  title: string;
  progress: number;
  needed: number;
  state: 'open' | 'done' | 'lost';
}

interface Slot {
  x: number;
  y: number;
  scale: number;
  /** 0 in front, 1 behind. */
  rank: number;
}

/** How far apart neighbors stand on a side of `n`. */
function stageGap(n: number): number {
  return n <= 3 ? 58 : n <= 5 ? 54 : n <= 6 ? 48 : 36;
}

/** How big everyone on a side of `n` is drawn. */
function stageScale(n: number): number {
  return n <= 3 ? 1.45 : n <= 5 ? 1.25 : n <= 6 ? 1.12 : 0.98;
}

/** Where everyone on one side stands: one rank for up to three, two ranks for more, smaller as they crowd. */
export function stageSlots(n: number, side: 'crew' | 'enemy'): Slot[] {
  const front = n <= 3 ? n : Math.ceil(n / 2);
  const scale = stageScale(n);
  const gap = stageGap(n);
  const out: Slot[] = [];
  for (let i = 0; i < front; i++) out.push({ x: 150 - i * gap, y: 222, scale, rank: 0 });
  for (let j = 0; j < n - front; j++) out.push({ x: 150 - gap / 2 - j * gap, y: 194, scale: scale * 0.9, rank: 1 });
  return side === 'crew' ? out : out.map((s) => ({ ...s, x: STAGE_W - s.x }));
}

/**
 * Where everyone on a side stands by their rank (2.3.0): the front rank in
 * front, the back rank (and flyers) behind it. A side all in one rank stands
 * as it always has.
 */
export function rankedSlots(fighters: readonly StageFighter[], side: 'crew' | 'enemy'): Slot[] {
  const behind = fighters.map((f) => f.rank === 'back' || f.rank === 'air');
  const nBack = behind.filter(Boolean).length;
  if (nBack === 0 || nBack === fighters.length) return stageSlots(fighters.length, side);
  const n = fighters.length;
  const scale = stageScale(n);
  const gap = stageGap(n);
  let i = 0;
  let j = 0;
  const out = behind.map((b): Slot => (b ? { x: 150 - gap / 2 - j++ * gap, y: 194, scale: scale * 0.9, rank: 1 } : { x: 150 - i++ * gap, y: 222, scale, rank: 0 }));
  return side === 'crew' ? out : out.map((s) => ({ ...s, x: STAGE_W - s.x }));
}

const n1 = (v: number): string => String(Math.round(v * 10) / 10);

/** A crosshair: a shot lined up (3.8.0). */
function crosshair(cx: number, cy: number, r: number, color: string): string {
  return circle(cx, cy, r, 'none', `stroke="${color}" stroke-width="1.2"`) + line(cx - r - 2, cy, cx + r + 2, cy, 1.1, color) + line(cx, cy - r - 2, cx, cy + r + 2, 1.1, color);
}

/** A flame: a firebomb (3.8.0). */
function flame(cx: number, cy: number, s: number, color: string): string {
  return pathEl(`M ${n1(cx)} ${n1(cy - 4.2 * s)} C ${n1(cx + 3.4 * s)} ${n1(cy - 1 * s)} ${n1(cx + 2.8 * s)} ${n1(cy + 3.4 * s)} ${n1(cx)} ${n1(cy + 3.4 * s)} C ${n1(cx - 2.8 * s)} ${n1(cy + 3.4 * s)} ${n1(cx - 3 * s)} ${n1(cy)} ${n1(cx - 1 * s)} ${n1(cy - 1.4 * s)} C ${n1(cx - 0.6 * s)} ${n1(cy)} ${n1(cx + 0.4 * s)} ${n1(cy - 1.6 * s)} ${n1(cx)} ${n1(cy - 4.2 * s)} Z`, color, 'stroke="none"');
}

/** A claw: a grab, or a grip held (3.8.0). */
function claw(cx: number, cy: number, color: string): string {
  const d = [-2.6, 0, 2.6].map((dx) => `M ${n1(cx + dx - 0.8)} ${n1(cy + 3)} Q ${n1(cx + dx - 1)} ${n1(cy - 1.4)} ${n1(cx + dx + 0.8)} ${n1(cy - 3.2)}`).join(' ');
  return pathEl(d, 'none', `stroke="${color}" stroke-width="1.5" stroke-linecap="round"`);
}

/** An enemy's move this round, as a small badge (2.3.0): a hit, a big hit, or running; or, on the ground, getting back up (2.4.0); since 3.8.0 the moves a shove or a pin down spoils. */
function intentBadge(kind: IntentKind | 'rise', cx: number, cy: number): string {
  if (kind === 'aim' || kind === 'shot') return circle(cx, cy, 6.5, kind === 'shot' ? '#b5432f' : '#1d1915', `stroke="${BONE}" stroke-width="0.9"`) + crosshair(cx, cy, 2.6, kind === 'shot' ? BONE : '#e08a5a');
  if (kind === 'mend') return circle(cx, cy, 6.5, '#1d1915', `stroke="${BONE}" stroke-width="0.9"`) + rect(cx - 1.2, cy - 3.8, 2.4, 7.6, '#9cc27f', 'stroke="none"') + rect(cx - 3.8, cy - 1.2, 7.6, 2.4, '#9cc27f', 'stroke="none"');
  if (kind === 'throw') return circle(cx, cy, 6.5, '#d0703c', `stroke="${BONE}" stroke-width="0.9"`) + flame(cx, cy, 1, BONE);
  if (kind === 'grab' || kind === 'hold') return circle(cx, cy, 6.5, kind === 'hold' ? '#b5432f' : '#1d1915', `stroke="${BONE}" stroke-width="0.9"`) + claw(cx, cy, kind === 'hold' ? BONE : '#e0b84a');
  // 3.12.0: calling more in (sound waves), a sweep at a rank (a wide arc), going under (down) and coming up (up).
  if (kind === 'call') {
    return circle(cx, cy, 6.5, '#b8892a', `stroke="${BONE}" stroke-width="0.9"`) + circle(cx - 2.2, cy, 1.2, INK, 'stroke="none"') + pathEl(`M ${n1(cx)} ${n1(cy - 2.4)} Q ${n1(cx + 1.6)} ${n1(cy)} ${n1(cx)} ${n1(cy + 2.4)} M ${n1(cx + 2)} ${n1(cy - 4)} Q ${n1(cx + 4.4)} ${n1(cy)} ${n1(cx + 2)} ${n1(cy + 4)}`, 'none', `stroke="${INK}" stroke-width="1.2" stroke-linecap="round"`);
  }
  if (kind === 'sweep') {
    return circle(cx, cy, 7, '#b5432f', `stroke="${BONE}" stroke-width="1"`) + pathEl(`M ${n1(cx + 3.6)} ${n1(cy - 3.2)} Q ${n1(cx - 4.4)} ${n1(cy)} ${n1(cx + 3.6)} ${n1(cy + 3.2)} M ${n1(cx + 3.6)} ${n1(cy + 3.2)} l -2.6 -0.2 M ${n1(cx + 3.6)} ${n1(cy + 3.2)} l -0.6 -2.4`, 'none', `stroke="${BONE}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"`);
  }
  if (kind === 'dive' || kind === 'surface') {
    const up = kind === 'surface';
    const tip = up ? cy - 3.4 : cy + 3.4;
    return (
      circle(cx, cy, up ? 7 : 6.5, up ? '#b5432f' : '#2c4a5a', `stroke="${BONE}" stroke-width="1"`) +
      pathEl(`M ${n1(cx)} ${n1(up ? cy + 3.4 : cy - 3.4)} V ${n1(tip)} M ${n1(cx - 2.8)} ${n1(up ? tip + 2.8 : tip - 2.8)} L ${n1(cx)} ${n1(tip)} L ${n1(cx + 2.8)} ${n1(up ? tip + 2.8 : tip - 2.8)}`, 'none', `stroke="${BONE}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`)
    );
  }
  if (kind === 'rise') {
    return circle(cx, cy, 6.5, '#b8892a', `stroke="${BONE}" stroke-width="1"`) + pathEl(`M ${n1(cx)} ${n1(cy + 3.4)} V ${n1(cy - 3.2)} M ${n1(cx - 2.8)} ${n1(cy - 0.6)} L ${n1(cx)} ${n1(cy - 3.4)} L ${n1(cx + 2.8)} ${n1(cy - 0.6)}`, 'none', `stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`);
  }
  if (kind === 'heavy') {
    return (
      circle(cx, cy, 7, '#b5432f', `stroke="${BONE}" stroke-width="1"`) +
      rect(cx - 1.1, cy - 4.4, 2.2, 5.4, BONE, 'stroke="none"') +
      circle(cx, cy + 3.2, 1.2, BONE, 'stroke="none"')
    );
  }
  if (kind === 'run') {
    return circle(cx, cy, 6, '#1d1915', `stroke="${BONE}" stroke-width="0.9"`) + pathEl(`M ${n1(cx - 3)} ${n1(cy)} H ${n1(cx + 3)} M ${n1(cx + 0.6)} ${n1(cy - 2.6)} L ${n1(cx + 3.2)} ${n1(cy)} L ${n1(cx + 0.6)} ${n1(cy + 2.6)}`, 'none', `stroke="${BONE}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"`);
  }
  // A hit coming at the crew: an arrowhead pointing their way.
  return circle(cx, cy, 6, '#1d1915', `stroke="${BONE}" stroke-width="0.9"`) + pathEl(`M ${n1(cx + 1.8)} ${n1(cy - 3)} L ${n1(cx - 1.8)} ${n1(cy)} L ${n1(cx + 1.8)} ${n1(cy + 3)}`, 'none', `stroke="#e08a5a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`);
}

/**
 * Over one of the crew (3.8.0; marks for each blow before): what's coming at them this round as a number,
 * red when it could put them down, with a flame for a firebomb in it, and a crosshair for a shot lined up
 * at them for next round.
 */
function threatTag(t: NonNullable<StageFighter['threat']>, cx: number, y: number): string {
  let out = '';
  const text = t.amount > 0 ? `-${t.amount}` : '';
  const w = text ? 7 + text.length * 5.4 + (t.fire ? 7 : 0) : 0;
  const total = w + (t.next ? (w ? 15 : 13) : 0);
  let x = cx - total / 2;
  if (text) {
    out += rect(x, y - 11, w, 11, t.drop ? '#b5432f' : '#1d1915', `stroke="${BONE}" stroke-width="0.8" rx="3"`);
    if (t.fire) out += flame(x + 5.5, y - 5.5, 0.85, '#f0a060');
    out += `<text x="${n1(x + (t.fire ? 7 : 0) + (w - (t.fire ? 7 : 0)) / 2)}" y="${n1(y - 2.3)}" class="bt-threat" text-anchor="middle">${text}</text>`;
    x += w + 2;
  }
  if (t.next) out += circle(x + 6, y - 5.5, 6, '#1d1915', `stroke="${BONE}" stroke-width="0.8"`) + crosshair(x + 6, y - 5.5, 2.4, '#e08a5a');
  return out;
}

/** The job the fight came with (2.5.0), in the top left: a pip for each turn of work, or how it ended. */
function jobPlate(job: StageJob): string {
  const label = job.state === 'done' ? `${job.title}: done` : job.state === 'lost' ? `${job.title}: lost` : job.title;
  const textW = Math.ceil(label.length * 5.1);
  const pips = job.state === 'open' ? job.needed : 0;
  const w = 12 + textW + (pips > 0 ? 6 + pips * 10 : 0);
  let svg = `<rect x="6" y="5" width="${w}" height="17" rx="3" fill="#1d1915" fill-opacity="0.82"/>`;
  svg += `<text x="12" y="16.5" class="bt-hp${job.state === 'lost' ? ' bt-job-lost' : ''}">${escapeAttr(label)}</text>`;
  for (let k = 0; k < pips; k++) {
    const cx = 12 + textW + 6 + k * 10 + 4;
    svg += `<circle cx="${cx}" cy="13.5" r="3.4" fill="${k < job.progress ? '#c9b98f' : '#2b2420'}" stroke="${BONE}" stroke-width="0.7"/>`;
  }
  const said = job.state === 'open' ? `${job.title}, ${Math.min(job.progress, job.needed)} of ${job.needed}` : label;
  return `<g class="bt-job" aria-label="${escapeAttr(said)}">${svg}</g>`;
}

/** The nerve of their side (2.3.0), in the top corner. */
function nerveMeter(nerve: number): string {
  const x = STAGE_W - 120;
  const share = Math.max(0, Math.min(1, nerve / 100));
  const color = share > 0.6 ? '#c9b98f' : share > 0.3 ? '#b8892a' : '#b5432f';
  return (
    `<g class="bt-nerve" aria-label="Their nerve, ${Math.round(nerve)} of 100">` +
    `<rect x="${x}" y="5" width="114" height="17" rx="3" fill="#1d1915" fill-opacity="0.82"/>` +
    `<text x="${x + 6}" y="16.5" class="bt-hp">Their nerve</text>` +
    `<rect x="${x + 62}" y="9.5" width="46" height="8" rx="2" fill="#2b2420" stroke="${BONE}" stroke-width="0.7"/>` +
    (share > 0 ? `<rect x="${x + 62.8}" y="10.3" width="${n1(44.4 * share)}" height="6.4" rx="1.4" fill="${color}"/>` : '') +
    '</g>'
  );
}

/** The drawing of one fighter facing right, before it's turned around or laid down. */
function body(f: StageFighter): { svg: string; scale: number; height: number; muzzle: [number, number] } {
  if (f.kind === 'dog') return { svg: dogSvg(), scale: 0.9, height: 34, muzzle: [24, -22] };
  if (f.side === 'crew' && f.look) {
    const b = crewBody(f.look, f.weapon);
    return { svg: personSvg(b), scale: 1, height: 64, muzzle: muzzle(b.held) };
  }
  const e = enemyBody(f.kind ?? '', f.type ?? 'raider', f.seed ?? f.key);
  return { svg: e.svg, scale: e.scale, height: enemyHeight(f.kind ?? ''), muzzle: enemyMuzzle(f.kind ?? '', e.held) };
}

/** A fighter at its spot: turned to face the other side, laid down when out of it. */
function placed(f: StageFighter, slot: Slot, effect: StageEffect | undefined): string {
  // Gone under (3.12.0): ripples where it went, nothing else.
  if (f.under && f.state === 'up') {
    const r = 18 * slot.scale;
    return `<g transform="translate(${n1(slot.x)} ${n1(slot.y)})" class="bt-under">${ellipse(0, 0, r, r * 0.22, 'none', `stroke="#8fb7c4" stroke-width="1.4" opacity="0.8"`)}${ellipse(0, 0, r * 0.6, r * 0.13, 'none', `stroke="#8fb7c4" stroke-width="1.2" opacity="0.6"`)}</g>`;
  }
  const b = body(f);
  const s = slot.scale * b.scale;
  const facing = f.side === 'crew' ? 1 : -1;
  const out = f.state === 'down' || f.state === 'dead';
  // Laid down along the ground, centered on their spot so nobody falls off the edge.
  const lying = out ? `<g transform="translate(${n1(b.height * 0.4)} -6) rotate(-90) scale(0.8)">${b.svg}</g>` : b.svg;
  const classes = ['bt-fighter', `bt-${f.side}`];
  if (f.state === 'dead') classes.push('is-dead');
  if (f.state === 'down') classes.push('is-down');
  if (effect?.by === f.key) classes.push(effect.motion === 'lunge' ? 'bt-lunge' : effect.motion === 'shoot' ? 'bt-recoil' : effect.motion === 'act' ? 'bt-act' : '');
  if (effect?.at === f.key && effect.reaction === 'hit') classes.push('bt-hit');
  if (effect?.at === f.key && effect.reaction === 'miss') classes.push('bt-dodge');
  if (effect?.at === f.key && effect.reaction === 'heal') classes.push('bt-heal');
  if (effect?.leaving?.includes(f.key)) classes.push('bt-leave');
  // Standing ones breathe; whoever was just put down falls rather than appearing on the ground (3.2.0).
  const fell = out && effect?.at === f.key && effect.reaction === 'hit';
  const pose = fell ? `<g class="bt-fall" style="--f:${facing}">${lying}</g>` : lying;
  const still = f.state === 'up' && !classes.some((c) => c.startsWith('bt-l') || c === 'bt-recoil' || c === 'bt-act' || c === 'bt-hit' || c === 'bt-dodge');
  let inner = `<g transform="scale(${n1(facing * s)} ${n1(s)})">${still ? `<g class="bt-idle" style="animation-delay:-${(hashKey(f.key) % 26) / 10}s">${pose}</g>` : pose}</g>`;
  // A flash at the muzzle when they fire, and a puff of smoke after it.
  if (effect?.by === f.key && effect.motion === 'shoot') {
    const [mx, my] = b.muzzle;
    inner += `<g class="bt-flash">${poly(starPoints(mx * facing * s, my * s, 7 * s, 3 * s), '#f7d36b', `stroke="#ee9a45" stroke-width="1.2"`)}</g>`;
    for (const k of [0, 1, 2]) inner += `<circle class="bt-puff" cx="${n1(mx * facing * s + facing * k * 3)}" cy="${n1(my * s - k * 2)}" r="${n1(3 + k)}" fill="#cfc6b4" style="animation-delay:${0.08 + k * 0.06}s;--f:${facing}"/>`;
  }
  return `<g transform="translate(${n1(slot.x)} ${n1(slot.y)})"><g class="${classes.filter(Boolean).join(' ')}">${inner}</g></g>`;
}

// ---------------------------------------------------------------- moving scenes (4b)

const pct = (t: number, total: number): string => `${n1(Math.min(100, Math.max(0, (t / total) * 100)))}%`;
const at3 = (x: number, y: number, sc: number): string => `transform:translate(${n1(x)}px,${n1(y)}px) scale(${Math.round(sc * 1000) / 1000})`;
const EASE: Record<ExtraPose, string> = { stand: 'cubic-bezier(0.45,0,0.55,1)', run: 'linear', shout: 'linear', hit: 'cubic-bezier(0.5,0,1,1)', lying: 'linear' };

/** The body's transform for a pose: every one the same list of functions, so one turns smoothly into the next. */
function poseCss(pose: ExtraPose, height: number, beat = 0): string {
  const t = (x: number, y: number, r: number, sc: number): string => `transform:translate(${n1(x)}px,${n1(y)}px) rotate(${r}deg) scale(${sc})`;
  switch (pose) {
    case 'stand':
      return t(0, beat % 2 ? -0.8 : 0, 0, 1);
    case 'run':
      return t(0, beat % 2 ? -3 : 0, 8, 1);
    case 'shout':
      return t(beat % 2 ? 1.2 : 0, beat % 2 ? -1.5 : 0, beat % 2 ? 11 : 6, 1);
    case 'hit':
      return t(2, -3, -14, 1);
    case 'lying':
      return t(height * 0.4, -6, -90, 0.8);
  }
}

/**
 * Someone placed by hand, moving (4b): their place and size along the keys, and their pose, as keyframes
 * in the drawing's own style. Running bobs a step at a time, shouting shakes, standing breathes, a hit
 * jolts them and they fall the rest of the way to the next key, with dust where they land.
 */
function movingExtraSvg(e: StageExtra, keys: ExtraKey[], total: number): { svg: string; css: string } {
  const b = body(e.fighter);
  const k = `sx${hashKey(JSON.stringify(keys) + e.fighter.key).toString(36)}`;
  // Held at the first key before it and the last after it: a keyframe list without its ends would run back to the drawing's own place.
  const ends = [{ ...keys[0]!, t: 0 }, ...keys, { ...keys[keys.length - 1]!, t: total }];
  let move = '';
  ends.forEach((key, i) => {
    const next = ends[i + 1];
    const ease = next && (next.pose === 'lying' || key.pose === 'hit') ? 'cubic-bezier(0.5,0,1,1)' : key.pose === 'run' ? 'linear' : EASE.stand;
    move += `${pct(key.t, total)}{${at3(key.x, key.y, key.scale)};opacity:${key.hidden ? 0 : 1};animation-timing-function:${ease}}`;
  });
  let pose = '';
  const steps: { t: number; css: string; ease?: string }[] = [{ t: 0, css: poseCss(keys[0]!.pose ?? 'stand', b.height) }];
  keys.forEach((key, i) => {
    const p = key.pose ?? 'stand';
    const end = keys[i + 1]?.t ?? total;
    if (p === 'hit') {
      steps.push({ t: key.t, css: poseCss('hit', b.height) });
      steps.push({ t: Math.min(end, key.t + 0.1), css: poseCss('hit', b.height), ease: 'cubic-bezier(0.55,0,1,0.45)' });
      return;
    }
    const beat = p === 'run' ? 0.13 : p === 'shout' ? 0.09 : 1.4;
    let n = 0;
    for (let t = key.t; t < end - 0.06; t += beat) steps.push({ t, css: poseCss(p, b.height, n++) });
    if (p !== 'lying') steps.push({ t: Math.max(key.t, end - 0.06), css: poseCss(p, b.height, 0) });
    else steps.push({ t: end, css: poseCss('lying', b.height) });
  });
  const last = keys[keys.length - 1]!.pose ?? 'stand';
  steps.push({ t: total, css: poseCss(last === 'hit' ? 'lying' : last, b.height) });
  for (const st of steps) pose += `${pct(st.t, total)}{${st.css}${st.ease ? `;animation-timing-function:${st.ease}` : ''}}`;
  let css = `@keyframes ${k}-m{${move}}@keyframes ${k}-p{${pose}}`;
  css += `.battle .${k}-m{animation:${k}-m ${total}s linear both}.battle .${k}-p{animation:${k}-p ${total}s linear both}`;
  const first = keys[0]!;
  const land = keys.findIndex((key, i) => key.pose === 'lying' && keys[i - 1]?.pose !== 'lying');
  const hitAt = keys.find((key) => key.pose === 'hit');
  let pool = '';
  if (e.blood && land > 0) {
    // It spreads under them once they're down.
    const l = keys[land]!;
    css += `@keyframes ${k}-pool{0%,${pct(l.t + 0.1, total)}{opacity:0;transform:scale(0.1)}${pct(l.t + 0.4, total)}{opacity:0.9}${pct(Math.min(total, l.t + 3.5), total)}{opacity:0.92;transform:scale(1)}100%{opacity:0.92;transform:scale(1)}}`;
    css += `.battle .${k}-pool{transform-box:fill-box;transform-origin:center;animation:${k}-pool ${total}s ease-out both}`;
    pool = bloodPool(l.x, l.y, b.height * l.scale, `class="${k}-pool" opacity="0"`);
  }
  let svg = pool + `<g class="${k}-m" style="${at3(first.x, first.y, first.scale)};opacity:${first.hidden ? 0 : 1}"><g class="bt-fighter bt-${e.fighter.side}"><g transform="scale(${n1(e.facing * b.scale)} ${n1(b.scale)})"><g class="${k}-p">${b.svg}</g></g></g></g>`;
  if (e.blood && hitAt) {
    // Blood flies out of their back when the shot hits, and falls.
    const cx = hitAt.x;
    const cy = hitAt.y - b.height * hitAt.scale * 0.55;
    const away = -e.facing;
    const at = hitAt.t;
    css += `@keyframes ${k}-b{0%,${pct(at, total)}{opacity:0;transform:translate(0,0)}${pct(at + 0.02, total)}{opacity:1;transform:translate(0,0)}${pct(at + 0.35, total)}{opacity:1;transform:translate(var(--dx),var(--dy))}${pct(at + 0.8, total)}{opacity:0;transform:translate(var(--dx),calc(var(--dy) + 16px))}100%{opacity:0}}`;
    css += `.battle .${k}-b{animation:${k}-b ${total}s ease-out both}`;
    for (let i = 0; i < 11; i++) {
      const angle = -0.9 + (i / 10) * 1.3;
      const dist = 10 + (i % 4) * 6;
      const dx = Math.cos(angle) * dist * away;
      const dy = Math.sin(angle) * dist;
      svg += `<circle class="${k}-b" cx="${n1(cx)}" cy="${n1(cy)}" r="${i % 3 ? 1.6 : 2.3}" fill="${BLOOD}" opacity="0" style="--dx:${n1(dx)}px;--dy:${n1(dy)}px"/>`;
    }
  }
  // Dust where they hit the ground.
  if (land > 0) {
    const l = keys[land]!;
    css += `@keyframes ${k}-d{0%,${pct(l.t - 0.05, total)}{opacity:0;transform:scale(0.3)}${pct(l.t, total)}{opacity:0.8;transform:scale(0.6)}${pct(l.t + 0.9, total)}{opacity:0;transform:scale(1.6)}100%{opacity:0;transform:scale(1.6)}}`;
    css += `.battle .${k}-d{transform-box:fill-box;transform-origin:center;animation:${k}-d ${total}s ease-out both}`;
    for (const dx of [-14, 0, 14]) svg += `<ellipse class="${k}-d" cx="${n1(l.x + dx * l.scale + b.height * 0.3 * e.facing * l.scale * -1)}" cy="${n1(l.y - 2)}" rx="${n1(9 * l.scale)}" ry="${n1(4 * l.scale)}" fill="#cbbfa6" opacity="0"/>`;
  }
  return { svg, css };
}

const BLOOD = '#8e2a20';

/** Blood on the ground under someone lying there, as long as they are. */
function bloodPool(x: number, y: number, height: number, attrs = ''): string {
  const rx = height * 0.42;
  return `<g ${attrs}><ellipse cx="${n1(x)}" cy="${n1(y - 2)}" rx="${n1(rx)}" ry="${n1(rx * 0.22)}" fill="#6e1f18"/><ellipse cx="${n1(x - rx * 0.25)}" cy="${n1(y - 2.6)}" rx="${n1(rx * 0.45)}" ry="${n1(rx * 0.09)}" fill="${BLOOD}"/></g>`;
}

/** How long a moving scene's drawing runs: to its last key, shot or arrival. */
function sceneLength(model: StageModel): number {
  let t = 0;
  for (const e of model.extras ?? []) for (const key of e.keys ?? []) t = Math.max(t, key.t);
  if (model.shot?.at !== undefined) t = Math.max(t, model.shot.at + 1);
  for (const a of model.arrive ?? []) t = Math.max(t, a.at + a.stagger * a.keys.length + a.seconds);
  for (const c of model.camera ?? []) t = Math.max(t, c.t);
  return Math.round((t + 1) * 10) / 10;
}

/** A small stable number from a fighter's key, to stagger their breathing. */
function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/** Someone placed by hand (`StageExtra`): leaning into a run, jolted by a hit, or lying in the road. */
function extraSvg(e: StageExtra): string {
  const b = body(e.fighter);
  const s = e.scale * b.scale;
  const pose = e.lying ? `<g transform="translate(${n1(b.height * 0.4)} -6) rotate(-90) scale(0.8)">${b.svg}</g>` : e.running ? `<g transform="rotate(7)">${b.svg}</g>` : b.svg;
  const classes = ['bt-fighter', `bt-${e.fighter.side}`, e.hit ? 'bt-hit' : ''].filter(Boolean).join(' ');
  return (e.blood && e.lying ? bloodPool(e.x, e.y, b.height * s, 'opacity="0.92"') : '') + `<g transform="translate(${n1(e.x)} ${n1(e.y)})"><g class="${classes}"><g transform="scale(${n1(e.facing * s)} ${n1(s)})">${pose}</g></g></g>`;
}

function starPoints(cx: number, cy: number, r: number, inner: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let k = 0; k < 10; k++) {
    const a = (Math.PI / 5) * k;
    const rr = k % 2 === 0 ? r : inner;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

/** About how wide a label is, in stage units. */
const labelWidth = (text: string): number => text.length * 5.4;

/** A label cut to fit the room between neighbors. */
export function fitLabel(text: string, room: number): string {
  const max = Math.max(4, Math.floor(room / 5.4));
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}\u2026`;
}

/** A label in one line, or two when it's too long and has words to break at: "Glowing / Hollow". */
export function labelLines(text: string, room: number): string[] {
  if (fitLabel(text, room) === text) return [text];
  const words = text.split(' ');
  // A name and its number stay together: "Rad-hound 2".
  if (words.length === 2 && /^\d+$/.test(words[1]!)) return [text];
  if (words.length < 2) return [fitLabel(text, room)];
  // The break that leaves the longer line shortest.
  let best = 1;
  for (let k = 1; k < words.length; k++) {
    const worst = Math.max(words.slice(0, k).join(' ').length, words.slice(k).join(' ').length);
    const bestWorst = Math.max(words.slice(0, best).join(' ').length, words.slice(best).join(' ').length);
    if (worst < bestWorst) best = k;
  }
  return [fitLabel(words.slice(0, best).join(' '), room), fitLabel(words.slice(best).join(' '), room)];
}

/** How tall a health bar is: room for its number. */
const HP_BAR_H = 11;

/** The number on a health bar, "9/12"; just "9" if that wouldn't fit. */
export function hpText(hp: number, maxHp: number, width: number): string {
  const both = `${hp}/${maxHp}`;
  return both.length * 5.3 <= width - 3 ? both : `${hp}`;
}

/** The bar and marks over someone's head, and their name: under the feet in front, over the bar behind. */
function overhead(f: StageFighter, slot: Slot, height: number, room: number, model: StageModel): string {
  if (f.state === 'fled') return '';
  const lying = f.state === 'down' || f.state === 'dead';
  const top = slot.y - (lying ? 30 : height * slot.scale + 14);
  // Wide enough for "24/24", narrow enough that neighbours' bars don't touch when a side crowds.
  const w = 36 * Math.max(0.85, Math.min(1.05, slot.scale / 1.25));
  const x = slot.x - w / 2;
  let out = '';
  if (f.state !== 'dead' && f.maxHp > 0) {
    const hp = Math.max(0, Math.round(f.hp));
    const share = Math.max(0, Math.min(1, hp / f.maxHp));
    const color = share > 0.5 ? '#6f9a52' : share > 0.25 ? '#b8892a' : '#b5432f';
    out += `<rect x="${n1(x)}" y="${n1(top)}" width="${n1(w)}" height="${HP_BAR_H}" rx="2" fill="#1d1915" stroke="${BONE}" stroke-width="0.8"/>`;
    if (share > 0) out += `<rect x="${n1(x + 0.9)}" y="${n1(top + 0.9)}" width="${n1((w - 1.8) * share)}" height="${HP_BAR_H - 1.8}" rx="1.4" fill="${color}" class="bt-bar"/>`;
    // The bar drains (3.7.0): what was just lost stays as a pale chunk that shrinks away, and what was healed grows in.
    const was = model.effect?.at === f.key ? model.effect.was : undefined;
    if (was !== undefined && was !== hp) {
      const wasShare = Math.max(0, Math.min(1, was / f.maxHp));
      const lo = Math.min(share, wasShare);
      const hi = Math.max(share, wasShare);
      const cls = was > hp ? 'bt-ghost' : 'bt-grow';
      out += `<rect x="${n1(x + 0.9 + (w - 1.8) * lo)}" y="${n1(top + 0.9)}" width="${n1((w - 1.8) * (hi - lo))}" height="${HP_BAR_H - 1.8}" rx="1.4" fill="${was > hp ? '#efe6d2' : '#9cc27f'}" class="${cls}"/>`;
    }
    out += `<text x="${n1(slot.x)}" y="${n1(top + 8.3)}" class="bt-hp" text-anchor="middle">${hpText(hp, f.maxHp, w)}</text>`;
  }
  const lines = labelLines(f.label, room);
  const lw = Math.max(...lines.map(labelWidth));
  const lx = Math.max(lw / 2 + 4, Math.min(STAGE_W - lw / 2 - 4, slot.x));
  // In front, under the feet (a second line under the first); behind, over the bar (the first line over the second).
  const ly = slot.rank === 0 ? slot.y + 14 : top - 4 - (lines.length - 1) * 10;
  const cls = `bt-label${f.nemesis || f.elite ? ' is-nemesis' : ''}${lying ? ' is-out' : ''}`;
  lines.forEach((text, k) => {
    out += `<text x="${n1(lx)}" y="${n1(ly + k * 10)}" class="${cls}" text-anchor="middle">${escapeAttr(text)}</text>`;
  });
  // An enemy's move this round, over its bar in front or over its name behind (2.3.0).
  const intent = f.side === 'enemy' && f.state === 'up' && !f.stunned ? f.intent : undefined;
  const badgeY = slot.rank === 0 ? top - 9 : ly - 16;
  if (intent) out += intentBadge(intent.kind, slot.x, badgeY);
  // One on the ground that gets back up unless finished, over its bar (2.4.0).
  if (f.side === 'enemy' && f.state === 'down' && f.rising) out += intentBadge('rise', slot.x, top - 9);
  // What's coming at one of the crew this round (3.8.0: as a number).
  let threatened = false;
  const t = f.side === 'crew' && f.state === 'up' ? f.threat : undefined;
  if (t && (t.amount > 0 || t.next)) {
    threatened = true;
    out += threatTag(t, slot.x, slot.rank === 0 ? top - 3 : ly - 11);
  }
  // In a hollow's grip (3.8.0): a claw by the bar.
  if (f.held && f.state === 'up') out += circle(x - 7, top + HP_BAR_H / 2, 5.5, '#b5432f', `stroke="${BONE}" stroke-width="0.8"`) + claw(x - 7, top + HP_BAR_H / 2, BONE);
  // One of theirs about to be patched up (3.8.0).
  if (f.mending && f.state === 'up') {
    const text = `+${f.mending}`;
    const w = 7 + text.length * 5.4;
    const my = slot.rank === 0 ? top - 3 : ly - 11;
    out += rect(slot.x + 9, my - 11, w, 11, '#2f4a2a', `stroke="${BONE}" stroke-width="0.8" rx="3"`) + `<text x="${n1(slot.x + 9 + w / 2)}" y="${n1(my - 2.3)}" class="bt-threat" text-anchor="middle">${text}</text>`;
  }
  // Marks by the name: a Vulture's feather, a nemesis's red notch.
  const mx = lx - lw / 2 - 5;
  if (f.vulture) out += poly([[mx - 2, ly + 1], [mx + 2, ly - 10], [mx + 3, ly - 1]], '#1d1b1a', `stroke="${BONE}" stroke-width="0.7"`);
  if (f.nemesis) out += circle(mx, ly - 3.5, 3.2, '#b5432f', `stroke="${BONE}" stroke-width="0.8"`);
  // An elite's gold star (3.12.0).
  if (f.elite) out += poly(starPoints(mx, ly - 3.5, 4.2, 1.8), '#e0b13a', `stroke="${INK}" stroke-width="0.6"`);
  // Its plates (3.12.0): a pip for each still on it, by the bar.
  if (f.plates && f.state !== 'dead') for (let k = 0; k < f.plates; k++) out += rect(x + w + 2.5 + k * 4.4, top + 1.5, 3.4, HP_BAR_H - 3, '#8d9494', `stroke="${BONE}" stroke-width="0.6"`);
  // Heavy armor: a small shield on the other side of the name (2.4.0).
  if (f.armored && f.state !== 'dead') {
    const sx = lx + lw / 2 + 5;
    out += pathEl(`M ${n1(sx - 3.2)} ${n1(ly - 8)} H ${n1(sx + 3.2)} V ${n1(ly - 4)} Q ${n1(sx + 3.2)} ${n1(ly - 0.2)} ${n1(sx)} ${n1(ly + 1)} Q ${n1(sx - 3.2)} ${n1(ly - 0.2)} ${n1(sx - 3.2)} ${n1(ly - 4)} Z`, '#8a8f8c', `stroke="${BONE}" stroke-width="0.8"`);
  }
  if (f.stunned && f.state === 'up') {
    // Over the bar in front; behind, the name is there, so over the name.
    const sy = slot.rank === 0 ? top - 7 : ly - 14;
    for (const k of [-1, 0, 1]) out += poly(starPoints(slot.x + k * 8, sy + Math.abs(k) * 2, 3, 1.3), '#f7d36b', `stroke="${INK}" stroke-width="0.6"`);
  }
  if (f.aimed && f.state === 'up') {
    const cx = x + w + 7;
    const cy = top + HP_BAR_H / 2;
    out += circle(cx, cy, 4, 'none', `stroke="${BONE}" stroke-width="1"`) + line(cx - 6, cy, cx + 6, cy, 0.9, BONE) + line(cx, cy - 6, cx, cy + 6, 0.9, BONE);
  }
  // The picked target gets a marker over it, above any badge or marks.
  const lifted = intent !== undefined || threatened || (f.state === 'down' && f.rising) ? 13 : 0;
  const above = (slot.rank === 0 ? top - 4 : ly - 12) - lifted;
  if (model.picked === f.key) out += poly([[slot.x - 6, above - 10], [slot.x + 6, above - 10], [slot.x, above - 2]], '#d0703c', `stroke="${BONE}" stroke-width="1"`);
  return out;
}

/** A ring on the ground: who is being given orders, what can be targeted, what was. */
function ring(f: StageFighter, slot: Slot, model: StageModel): string {
  if (f.state === 'fled') return '';
  const rx = 22 * slot.scale;
  const ry = 5.5 * slot.scale;
  if (model.giving === f.key) return ellipse(slot.x, slot.y, rx, ry, 'none', `stroke="${BONE}" stroke-width="2" class="bt-giving"`);
  if (model.picked === f.key) return ellipse(slot.x, slot.y, rx, ry, 'none', `stroke="#d0703c" stroke-width="2.4"`);
  if (model.targets.includes(f.key)) return ellipse(slot.x, slot.y, rx, ry, 'none', `stroke="#d0703c" stroke-width="1.6" stroke-dasharray="4 3" class="bt-target"`);
  return '';
}

/** A shot's line from the muzzle to the target, and the number over whoever it's about. */
function effectLayer(model: StageModel, spots: Map<string, { slot: Slot; height: number; muzzle: [number, number]; scale: number; side: 'crew' | 'enemy' }>): string {
  const e = model.effect;
  if (!e) return '';
  let out = '';
  const from = spots.get(e.by);
  const to = e.at ? spots.get(e.at) : undefined;
  if (e.motion === 'shoot' && from && to) {
    const facing = from.side === 'crew' ? 1 : -1;
    const x1 = from.slot.x + from.muzzle[0] * facing * from.scale;
    const y1 = from.slot.y + from.muzzle[1] * from.scale;
    const x2 = to.slot.x;
    const y2 = to.slot.y - to.height * to.slot.scale * 0.6;
    const missBy = e.reaction === 'miss' ? 14 : 0;
    out += `<line x1="${n1(x1)}" y1="${n1(y1)}" x2="${n1(x2)}" y2="${n1(y2 - missBy)}" class="bt-tracer" stroke="#f7d36b" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  const over = to ?? from;
  if (e.pop && over) {
    const y = over.slot.y - over.height * over.slot.scale - 30;
    out += `<text x="${n1(over.slot.x)}" y="${n1(y)}" class="bt-pop is-${e.tone}" text-anchor="middle">${escapeAttr(e.pop)}</text>`;
  }
  // What flies off the one hit (3.2.0): specks of blood, or sparks off a machine; a puff of dirt where a shot misses.
  if (e.splash && to) {
    const cx = to.slot.x;
    const cy = to.slot.y - to.height * to.slot.scale * (e.splash === 'dust' ? 0.05 : 0.55);
    const away = to.side === 'crew' ? -1 : 1;
    const color = e.splash === 'sparks' ? '#f7d36b' : e.splash === 'dust' ? '#b9a884' : '#8e2a20';
    const count = e.splash === 'dust' ? 4 : e.big ? 9 : 6;
    for (let i = 0; i < count; i++) {
      const angle = e.splash === 'dust' ? -Math.PI / 2 + (i - 1.5) * 0.5 : (-0.9 + (i / (count - 1)) * 1.6) * (away > 0 ? 1 : -1) + (away > 0 ? 0 : Math.PI);
      const dist = (e.splash === 'dust' ? 9 : 14) + (i % 3) * 5;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const r = e.splash === 'dust' ? 2.6 : e.splash === 'sparks' ? 1.4 : 1.9;
      out += `<circle class="bt-speck is-${e.splash}" cx="${n1(cx)}" cy="${n1(cy)}" r="${r}" fill="${color}" style="--dx:${n1(dx)}px;--dy:${n1(dy)}px;animation-delay:${e.splash === 'dust' ? 0.12 : 0.14}s"/>`;
    }
  }
  if (e.reaction === 'heal' && to) {
    for (const k of [-8, 0, 8]) out += `<g class="bt-sparkle" style="animation-delay:${(k + 8) * 0.03}s">${pathEl(`M ${n1(to.slot.x + k)} ${n1(to.slot.y - 30 - Math.abs(k))} m -3 0 h 6 m -3 -3 v 6`, 'none', 'stroke="#9cc27f" stroke-width="2" stroke-linecap="round"')}</g>`;
  }
  return out;
}

/** The whole stage for one moment of the fight. */
export function stageSvg(model: StageModel): string {
  // Lookouts stand on the Watchtower's deck; everyone else in the ranks.
  const ground = model.crew.filter((f) => !f.perch);
  const deck = model.crew.filter((f) => f.perch);
  const groundSlots = rankedSlots(ground, 'crew');
  const deckSlots = deck.map((_, k): Slot => ({ x: TOWER_DECK.x0 + 16 + k * 24, y: TOWER_DECK.y, scale: 0.9, rank: 1 }));
  const crewSlots = model.crew.map((f) => (f.perch ? deckSlots[deck.indexOf(f)]! : groundSlots[ground.indexOf(f)]!));
  const enemySlots = rankedSlots(model.enemies, 'enemy');
  // Nobody stands, or lies, half off the edge of the stage.
  const inside = (f: StageFighter, slot: Slot): Slot => {
    const b = body(f);
    const half = (f.state === 'down' || f.state === 'dead' ? b.height * 0.4 : 24) * slot.scale * b.scale + 3;
    return { ...slot, x: Math.max(half, Math.min(STAGE_W - half, slot.x)) };
  };
  const all = [
    ...model.crew.map((f, i) => ({ f, slot: inside(f, crewSlots[i]!) })),
    ...model.enemies.map((f, i) => ({ f, slot: inside(f, enemySlots[i]!) })),
  ];
  const spots = new Map<string, { slot: Slot; height: number; muzzle: [number, number]; scale: number; side: 'crew' | 'enemy' }>();
  for (const { f, slot } of all) {
    const b = body(f);
    spots.set(f.key, { slot, height: b.height * b.scale, muzzle: b.muzzle, scale: slot.scale * b.scale, side: f.side });
  }
  // Back to front; whoever acts is drawn last in their rank, so a lunge goes over the others.
  const order = [...all].sort((a, b) => a.slot.y - b.slot.y || Number(a.f.key === model.effect?.by) - Number(b.f.key === model.effect?.by));
  // Anyone placed by hand stands among the ranks by depth: further back is drawn first.
  const extras = model.extras ?? [];
  const total = sceneLength(model);
  let css = '';
  const drawExtra = (e: StageExtra): string => {
    if (!e.keys?.length) return extraSvg(e);
    const m = movingExtraSvg(e, e.keys, total);
    css += m.css;
    return m.svg;
  };
  // Further back is drawn first; someone moving goes by where they end up.
  const depth = (e: StageExtra): number => e.keys?.[e.keys.length - 1]?.y ?? e.y;
  let figures = extras.filter((e) => depth(e) < 194).map(drawExtra).join('');
  // The camera: each key's point, held inside the stage, as keyframes on the whole picture.
  let camera = '';
  if (model.camera?.length) {
    const cam = model.camera.map((c) => {
      const on = (c.on ?? []).map((key) => spots.get(key)).filter((x) => x !== undefined);
      const x = on.length ? on.reduce((t, o) => t + o.slot.x, 0) / on.length : (c.x ?? STAGE_W / 2);
      const y = on.length ? on.reduce((t, o) => t + o.slot.y - o.height * o.slot.scale * 0.5, 0) / on.length : (c.y ?? STAGE_H / 2);
      const sc = Math.max(1, c.scale);
      const tx = Math.min(0, Math.max(STAGE_W - STAGE_W * sc, STAGE_W / 2 - sc * x));
      const ty = Math.min(0, Math.max(STAGE_H - STAGE_H * sc, STAGE_H / 2 - sc * y));
      return { t: c.t, css: `transform:translate(${n1(tx)}px,${n1(ty)}px) scale(${Math.round(sc * 1000) / 1000})` };
    });
    const ends = [{ ...cam[0]!, t: 0 }, ...cam, { ...cam[cam.length - 1]!, t: total }];
    const ck = `cam${hashKey(cam.map((c) => c.t + c.css).join()).toString(36)}`;
    css += `@keyframes ${ck}{${ends.map((c) => `${pct(c.t, total)}{${c.css};animation-timing-function:cubic-bezier(0.4,0,0.2,1)}`).join('')}}.battle .${ck}{animation:${ck} ${total}s linear both}`;
    camera = ck;
  }
  const arrivals = new Map<string, { a: StageArrival; k: number }>();
  for (const a of model.arrive ?? []) a.keys.forEach((key, k) => arrivals.set(key, { a, k }));
  for (const { f, slot } of order) {
    if (f.state === 'fled' && !model.effect?.leaving?.includes(f.key)) continue;
    const label = `${f.title}${model.targets.includes(f.key) ? '. Tap to target' : ''}`;
    const hit = `<rect x="${n1(slot.x - 24 * slot.scale)}" y="${n1(slot.y - 74 * slot.scale)}" width="${n1(48 * slot.scale)}" height="${n1(80 * slot.scale)}" fill="#000" fill-opacity="0"/>`;
    let g = `<g class="bt-tap" data-key="${escapeAttr(f.key)}" role="button" tabindex="0" aria-label="${escapeAttr(label)}">${ring(f, slot, model)}${placed(f, slot, model.effect)}${hit}</g>`;
    const comes = arrivals.get(f.key);
    if (comes) {
      // Coming on: from off the left edge, or out of the gate small and far, a step at a time.
      const { a, k } = comes;
      const from = a.from === 'left' ? { x: -40, y: slot.y, scale: slot.scale } : a.from;
      const delay = a.at + k * a.stagger;
      const steps = Math.max(1, Math.round(a.seconds / 0.3));
      g = `<g class="bt-arrive" style="transform-origin:${n1(slot.x)}px ${n1(slot.y)}px;--dx:${n1(from.x - slot.x)}px;--dy:${n1(from.y - slot.y)}px;--s0:${Math.round((from.scale / slot.scale) * 100) / 100};animation-duration:${a.seconds}s;animation-delay:${n1(delay)}s"><g class="bt-arrive-step" style="transform-origin:${n1(slot.x)}px ${n1(slot.y)}px;animation-delay:${n1(delay)}s;animation-iteration-count:${steps * 2}">${g}</g></g>`;
    }
    figures += g;
  }
  figures += extras.filter((e) => depth(e) >= 194).map(drawExtra).join('');
  let marks = '';
  // A scene before the fight has no names, bars or marks over anyone.
  if (!model.scene) {
    for (const { f, slot } of all) {
      const b = body(f);
      const room = stageGap(f.side === 'crew' ? model.crew.length : model.enemies.length) - 4;
      marks += overhead(f, slot, b.height * b.scale, room, model);
    }
  }
  const sh = model.shot;
  let shot = sh
    ? (sh.to ? `<line x1="${n1(sh.x)}" y1="${n1(sh.y)}" x2="${n1(sh.to.x)}" y2="${n1(sh.to.y)}" stroke="#f7d36b" stroke-width="1.2" stroke-dasharray="6 5" opacity="0.85"/>` : '') +
      poly(starPoints(sh.x, sh.y, 9, 3.5), '#f7d36b', 'stroke="#ee9a45" stroke-width="1.2"')
    : '';
  if (sh?.at !== undefined) {
    // In a moving scene the flash is there for a moment, and the world jumps with it.
    const sk = `bt-shot${Math.round(sh.at * 100)}`;
    css += `@keyframes ${sk}{0%,${pct(sh.at, total)}{opacity:0}${pct(sh.at + 0.02, total)}{opacity:1}${pct(sh.at + 0.22, total)}{opacity:1}${pct(sh.at + 0.6, total)}{opacity:0}100%{opacity:0}}`;
    css += `.battle .${sk}{animation:${sk} ${total}s linear both}`;
    css += `@keyframes ${sk}-j{0%,${pct(sh.at, total)}{transform:none}${pct(sh.at + 0.05, total)}{transform:translate(2px,-1px)}${pct(sh.at + 0.12, total)}{transform:translate(-2px,1px)}${pct(sh.at + 0.2, total)}{transform:none}100%{transform:none}}`;
    css += `.battle .${sk}-j{animation:${sk}-j ${total}s linear both}`;
    shot = `<g class="${sk}" opacity="0">${shot}</g>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STAGE_W} ${STAGE_H}" class="battle" role="group" aria-label="${model.scene ? 'Before the fight' : 'The fight'}">` +
    (css ? `<style>${css}</style>` : '') +
    (camera ? `<g class="${camera}">` : '') +
    `<g class="${model.effect?.big ? 'bt-world bt-quake' : sh?.at !== undefined ? `bt-world bt-shot${Math.round(sh.at * 100)}-j` : 'bt-world'}">` +
    backdropSvg(model.place) +
    `<rect x="0" y="${HORIZON}" width="${STAGE_W}" height="${STAGE_H - HORIZON}" fill="#1d1915" opacity="0.08"/>` +
    figures +
    '</g>' +
    shot +
    (camera ? '</g>' : '') +
    marks +
    (model.nerve !== undefined ? nerveMeter(model.nerve) : '') +
    (model.job ? jobPlate(model.job) : '') +
    effectLayer(model, spots) +
    '</svg>'
  );
}

/** An enemy on its own, for a card (an elite's on a place, 3.12.0): standing on the ground, facing right, read out by `label`. */
export function enemyPictureSvg(kind: string, type: string, label: string): string {
  const b = body({ key: `pic:${kind}`, side: 'enemy', label, title: label, hp: 1, maxHp: 1, state: 'up', kind, type, seed: kind });
  // Big enough to see, small enough to fit: by its height, and by its width for the long ones.
  const wide: Record<string, number> = { the_snapper: 86, the_bog_king: 96, bravo_six: 72, mire_stalker: 84, old_mother: 62, rad_hound: 60, the_switchman: 66 };
  const s = Math.min(1.4, 78 / Math.max(30, b.height), 94 / (wide[kind] ?? 50));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -90 100 98" role="img" aria-label="${escapeAttr(label)}">` +
    `<rect x="-50" y="-90" width="100" height="98" fill="#2a3531"/>` +
    `<rect x="-50" y="0" width="100" height="8" fill="#3b4740"/>` +
    `<g transform="scale(${n1(s)})">${b.svg}</g>` +
    `</svg>`
  );
}
