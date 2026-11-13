/**
 * The battle stage (§7.13): a fight under command drawn as a side view, the
 * crew on the left facing the enemies on the right, over a backdrop of the
 * place. Plain data in (`StageModel`, built by `src/ui/battle-view.ts`), one
 * SVG out. Each step of a round is drawn afresh with the act it shows (who
 * lunges or fires, who is hit, the number that pops up), and CSS animates it.
 */
import { BACKDROP_PLACES, HORIZON, STAGE_H, STAGE_W, backdropSvg } from './backdrops.ts';
import { BONE, INK, circle, ellipse, escapeAttr, line, pathEl, poly, rect } from './draw.ts';
import { DRAWN_ENEMIES, crewBody, enemyBody, enemyHeight, enemyMuzzle, muzzle, personSvg } from './fighters.ts';
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
  state: 'up' | 'down' | 'dead' | 'fled';
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
}

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

/** Where everyone on one side stands: one rank for up to three, two ranks for more, smaller as they crowd. */
export function stageSlots(n: number, side: 'crew' | 'enemy'): Slot[] {
  const front = n <= 3 ? n : Math.ceil(n / 2);
  const scale = n <= 3 ? 1.45 : n <= 5 ? 1.25 : n <= 6 ? 1.12 : 0.98;
  const gap = stageGap(n);
  const out: Slot[] = [];
  for (let i = 0; i < front; i++) out.push({ x: 150 - i * gap, y: 222, scale, rank: 0 });
  for (let j = 0; j < n - front; j++) out.push({ x: 150 - gap / 2 - j * gap, y: 194, scale: scale * 0.9, rank: 1 });
  return side === 'crew' ? out : out.map((s) => ({ ...s, x: STAGE_W - s.x }));
}

const n1 = (v: number): string => String(Math.round(v * 10) / 10);

/** The drawing of one fighter facing right, before it's turned around or laid down. */
function body(f: StageFighter): { svg: string; scale: number; height: number; muzzle: [number, number] } {
  if (f.side === 'crew' && f.look) {
    const b = crewBody(f.look, f.weapon);
    return { svg: personSvg(b), scale: 1, height: 64, muzzle: muzzle(b.held) };
  }
  const e = enemyBody(f.kind ?? '', f.type ?? 'raider', f.seed ?? f.key);
  return { svg: e.svg, scale: e.scale, height: enemyHeight(f.kind ?? ''), muzzle: enemyMuzzle(f.kind ?? '', e.held) };
}

/** A fighter at its spot: turned to face the other side, laid down when out of it. */
function placed(f: StageFighter, slot: Slot, effect: StageEffect | undefined): string {
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
  let inner = `<g transform="scale(${n1(facing * s)} ${n1(s)})">${lying}</g>`;
  // A flash at the muzzle when they fire.
  if (effect?.by === f.key && effect.motion === 'shoot') {
    const [mx, my] = b.muzzle;
    inner += `<g class="bt-flash">${poly(starPoints(mx * facing * s, my * s, 7 * s, 3 * s), '#f7d36b', `stroke="#ee9a45" stroke-width="1.2"`)}</g>`;
  }
  return `<g transform="translate(${n1(slot.x)} ${n1(slot.y)})"><g class="${classes.filter(Boolean).join(' ')}">${inner}</g></g>`;
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

/** The bar and marks over someone's head, and their name: under the feet in front, over the bar behind. */
function overhead(f: StageFighter, slot: Slot, height: number, room: number, model: StageModel): string {
  if (f.state === 'fled') return '';
  const lying = f.state === 'down' || f.state === 'dead';
  const top = slot.y - (lying ? 24 : height * slot.scale + 8);
  const w = 30 * Math.max(0.85, Math.min(1.1, slot.scale));
  const x = slot.x - w / 2;
  let out = '';
  if (f.state !== 'dead') {
    const share = f.maxHp > 0 ? Math.max(0, Math.min(1, f.hp / f.maxHp)) : 0;
    const color = share > 0.5 ? '#9cc27f' : share > 0.25 ? '#e0b13a' : '#d9614a';
    out += rect(x, top, w, 5, '#1d1915', `stroke="${BONE}" stroke-width="0.8"`);
    if (share > 0) out += `<rect x="${n1(x + 0.8)}" y="${n1(top + 0.8)}" width="${n1((w - 1.6) * share)}" height="3.4" fill="${color}" class="bt-bar"/>`;
  }
  const lines = labelLines(f.label, room);
  const lw = Math.max(...lines.map(labelWidth));
  const lx = Math.max(lw / 2 + 4, Math.min(STAGE_W - lw / 2 - 4, slot.x));
  // In front, under the feet (a second line under the first); behind, over the bar (the first line over the second).
  const ly = slot.rank === 0 ? slot.y + 14 : top - 4 - (lines.length - 1) * 10;
  const cls = `bt-label${f.nemesis ? ' is-nemesis' : ''}${lying ? ' is-out' : ''}`;
  lines.forEach((text, k) => {
    out += `<text x="${n1(lx)}" y="${n1(ly + k * 10)}" class="${cls}" text-anchor="middle">${escapeAttr(text)}</text>`;
  });
  // Marks by the name: a Vulture's feather, a nemesis's red notch.
  const mx = lx - lw / 2 - 5;
  if (f.vulture) out += poly([[mx - 2, ly + 1], [mx + 2, ly - 10], [mx + 3, ly - 1]], '#1d1b1a', `stroke="${BONE}" stroke-width="0.7"`);
  if (f.nemesis) out += circle(mx, ly - 3.5, 3.2, '#b5432f', `stroke="${BONE}" stroke-width="0.8"`);
  if (f.stunned && f.state === 'up') {
    for (const k of [-1, 0, 1]) out += poly(starPoints(slot.x + k * 8, top - 7 + Math.abs(k) * 2, 3, 1.3), '#f7d36b', `stroke="${INK}" stroke-width="0.6"`);
  }
  if (f.aimed && f.state === 'up') {
    const cx = x + w + 7;
    const cy = top + 2.5;
    out += circle(cx, cy, 4, 'none', `stroke="${BONE}" stroke-width="1"`) + line(cx - 6, cy, cx + 6, cy, 0.9, BONE) + line(cx, cy - 6, cx, cy + 6, 0.9, BONE);
  }
  // The picked target gets a marker over it.
  const above = slot.rank === 0 ? top - 4 : top - 16;
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
  if (e.reaction === 'heal' && to) {
    for (const k of [-8, 0, 8]) out += `<g class="bt-sparkle" style="animation-delay:${(k + 8) * 0.03}s">${pathEl(`M ${n1(to.slot.x + k)} ${n1(to.slot.y - 30 - Math.abs(k))} m -3 0 h 6 m -3 -3 v 6`, 'none', 'stroke="#9cc27f" stroke-width="2" stroke-linecap="round"')}</g>`;
  }
  return out;
}

/** The whole stage for one moment of the fight. */
export function stageSvg(model: StageModel): string {
  const crewSlots = stageSlots(model.crew.length, 'crew');
  const enemySlots = stageSlots(model.enemies.length, 'enemy');
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
  let figures = '';
  for (const { f, slot } of order) {
    if (f.state === 'fled' && !model.effect?.leaving?.includes(f.key)) continue;
    const label = `${f.title}${model.targets.includes(f.key) ? '. Tap to target' : ''}`;
    const hit = `<rect x="${n1(slot.x - 24 * slot.scale)}" y="${n1(slot.y - 74 * slot.scale)}" width="${n1(48 * slot.scale)}" height="${n1(80 * slot.scale)}" fill="#000" fill-opacity="0"/>`;
    figures += `<g class="bt-tap" data-key="${escapeAttr(f.key)}" role="button" tabindex="0" aria-label="${escapeAttr(label)}">${ring(f, slot, model)}${placed(f, slot, model.effect)}${hit}</g>`;
  }
  let marks = '';
  for (const { f, slot } of all) {
    const b = body(f);
    const room = stageGap(f.side === 'crew' ? model.crew.length : model.enemies.length) - 4;
    marks += overhead(f, slot, b.height * b.scale, room, model);
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STAGE_W} ${STAGE_H}" class="battle" role="group" aria-label="The fight">` +
    backdropSvg(model.place) +
    `<rect x="0" y="${HORIZON}" width="${STAGE_W}" height="${STAGE_H - HORIZON}" fill="#1d1915" opacity="0.08"/>` +
    figures +
    marks +
    effectLayer(model, spots) +
    '</svg>'
  );
}
