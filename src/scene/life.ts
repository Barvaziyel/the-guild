/**
 * The yard on the move (3.2.0): people stepping away from the fire or their
 * post for a while and coming back, crews setting out through the gate and
 * coming home, vehicles driving off and back in, and the sky and the road.
 *
 * Everything moves with CSS keyframes made here, timed by the clock the
 * drawing is made at, so a drawing made again a moment later picks up where
 * the last one was. With reduced motion, nothing here moves and everyone stays
 * where the model puts them.
 */
import { hash } from './draw.ts';
import { figureScale, walker } from './figures.ts';
import { GATE, PARKING_X, W, Y, type Spot } from './layout.ts';
import type { DayPhase, FigureLook, YardPerson, YardTrip } from './model.ts';
import { vehicle } from './vehicles.ts';

export interface Point {
  x: number;
  y: number;
}

/** Walking pace, in drawing units a second: grown-ups stroll, children run. */
export const STROLL = 20;
export const RUN = 38;
const MARCH = 26;
const DRIVE = 70;

/**
 * How long a step takes at each pace (3.4.1), so the feet keep up with the ground: a stride is about
 * 8 units. Before, everyone stepped every 0.56 s whatever their pace, and in step with each other.
 */
export function stepSeconds(speed: number): number {
  return +(8.4 / speed).toFixed(3);
}

/** Someone's own way of walking: how long a step takes, and where in the step they are at the start. */
export function gaitFor(id: string, speed: number): { step: number; phase: number } {
  const step = stepSeconds(speed);
  return { step, phase: +(((hash(`gait:${id}`) % 1000) / 1000) * step * 2).toFixed(3) };
}

/** Where people stroll to: a lane in front of each row of buildings, and spots along it. */
const LANES = [
  { from: 395, to: 440, y: 448, stops: [26, 118, 292, 376] },
  { from: 300, to: 395, y: 336, stops: [24, 150, 298] },
] as const;

/** A trip away from someone's spot and back, repeating every `cycle` seconds. */
export interface Errand {
  /** Seconds into the cycle it starts. */
  start: number;
  cycle: number;
  /** The way there; the way back is the same, reversed. */
  path: Point[];
  speed: number;
  /** Seconds spent at the far end. */
  pause: number;
}

/**
 * Whether someone wanders off now and then, and where to. About two in five
 * of those around the fire or at a post on the ground; children more often,
 * and quicker. Nobody high up, lying down, or waiting at the gate.
 */
export function errandFor(person: YardPerson, spot: Spot): Errand | undefined {
  const p = person.place;
  const child = p.kind === 'child';
  if (spot.pose === 'lie' || p.kind === 'gate' || p.kind === 'resting') return undefined;
  if (p.kind === 'post' && !['garden', 'scrapyard', 'workshop', 'firepit', 'training_yard', 'infirmary'].includes(p.building)) return undefined;
  const h = hash(`errand:${person.id}`);
  if (!child && h % 5 >= 2) return undefined;
  if (child && p.baby) return undefined;
  const lane = LANES.find((l) => spot.y >= l.from && spot.y < l.to);
  if (!lane && !child) return undefined;
  const speed = child ? RUN : STROLL;
  const laneY = child || !lane ? spot.y + 6 + ((h >>> 4) % 12) : lane.y + ((h >>> 4) % 3) * 6;
  const stops = child || !lane ? [spot.x - 46, spot.x + 46] : lane.stops.filter((x) => Math.abs(x - spot.x) >= 50);
  const stopX = stops[(h >>> 7) % stops.length]!;
  // Straight there, slanting across the ground (3.4.1). Before, they walked up or down to the lane
  // first, side-on, which looked like sliding.
  const path: Point[] = [
    { x: spot.x, y: spot.y },
    { x: Math.max(10, Math.min(W - 10, stopX)), y: laneY },
  ];
  const pause = child ? 1 + ((h >>> 11) % 3) : 3 + ((h >>> 11) % 5);
  const walk = pathLength(path) / speed;
  const busy = walk * 2 + pause;
  const cycle = Math.ceil(busy + (child ? 14 : 40) + ((h >>> 13) % 40));
  const start = (h >>> 17) % Math.max(1, Math.floor(cycle - busy));
  return { start, cycle, path, speed, pause };
}

export function pathLength(path: readonly Point[]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
  return d;
}

const pct = (t: number, total: number): string => `${+((100 * t) / total).toFixed(3)}%`;
const at = (p: Point, facing: number, scale: number): string => `transform:translate(${+p.x.toFixed(2)}px,${+p.y.toFixed(2)}px) scale(${facing * scale},${scale})`;

interface Frame {
  t: number;
  css: string;
}

/** Keyframes from a list of moments, in order. */
function keyframes(name: string, frames: Frame[], total: number): string {
  return `@keyframes ${name}{${frames.map((f) => `${pct(Math.min(total, Math.max(0, f.t)), total)}{${f.css}}`).join('')}}`;
}

/** Setting off, getting going, and slowing to a stop (3.4.1; before, everyone moved at one speed from the first step to the last). */
const EASE_IN = 'cubic-bezier(0.45,0,1,1)';
const EASE_OUT = 'cubic-bezier(0,0,0.55,1)';
const EASE_BOTH = 'cubic-bezier(0.45,0,0.55,1)';

/** Frames walking a path from `t0`, visible while moving; returns them and when it arrives. */
function walk(path: readonly Point[], t0: number, speed: number, scale: number, facing0: number): { frames: Frame[]; end: number; facing: number } {
  const frames: Frame[] = [];
  let t = t0;
  let facing = facing0;
  const legs = path.length - 1;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    if (b.x !== a.x) facing = b.x > a.x ? 1 : -1;
    const ease = legs === 1 ? EASE_BOTH : i === 1 ? EASE_IN : i === legs ? EASE_OUT : 'linear';
    frames.push({ t: t + 0.001, css: `opacity:1;${at(a, facing, scale)};animation-timing-function:${ease}` });
    t += Math.hypot(b.x - a.x, b.y - a.y) / speed;
    frames.push({ t, css: `opacity:1;${at(b, facing, scale)}` });
  }
  return { frames, end: t, facing };
}

export interface Motion {
  /** Keyframes and the rules that run them. */
  css: string;
  /** Drawn things, each with the ground line it sorts at. */
  items: { y: number; svg: string }[];
  /** A class for the person's own figure, which steps out of sight while they're away. */
  homeClass?: string;
}

/** Someone's comings and goings, as keyframes for their figure at home, a walker and a stander at the far end. */
export function errandMotion(person: YardPerson, spot: Spot, e: Errand, clock: number): Motion {
  const k = `ye${hash(person.id).toString(36)}`;
  const scale = figureScale(person.look);
  const there = e.path[e.path.length - 1]!;
  const out = walk(e.path, e.start, e.speed, scale, spot.facing);
  const leave = out.end + e.pause;
  const back = walk([...e.path].reverse(), leave, e.speed, scale, -out.facing);
  const end = back.end;
  const total = e.cycle;
  const hidden = (t: number, p: Point, f: number): Frame => ({ t, css: `opacity:0;${at(p, f, scale)}` });
  const walkerFrames = [hidden(0, spot, spot.facing), hidden(e.start, spot, spot.facing), ...out.frames, hidden(out.end + 0.001, there, out.facing), hidden(leave, there, -out.facing), ...back.frames, hidden(end + 0.001, spot, spot.facing), hidden(total, spot, spot.facing)];
  const home: Frame[] = [
    { t: 0, css: 'opacity:1' },
    { t: e.start, css: 'opacity:1' },
    { t: e.start + 0.001, css: 'opacity:0' },
    { t: end, css: 'opacity:0' },
    { t: end + 0.001, css: 'opacity:1' },
    { t: total, css: 'opacity:1' },
  ];
  const stand: Frame[] = [
    { t: 0, css: 'opacity:0' },
    { t: out.end, css: 'opacity:0' },
    { t: out.end + 0.001, css: 'opacity:1' },
    { t: leave, css: 'opacity:1' },
    { t: leave + 0.001, css: 'opacity:0' },
    { t: total, css: 'opacity:0' },
  ];
  const delay = -(((clock / 1000) + (hash(k) % 97)) % total);
  const run = (cls: string): string => `.yard .${k}-${cls}{animation:${k}-${cls} ${total}s linear ${delay.toFixed(2)}s infinite}`;
  const css = keyframes(`${k}-w`, walkerFrames, total) + keyframes(`${k}-h`, home, total) + keyframes(`${k}-s`, stand, total) + run('w') + run('h') + run('s');
  // At the far end they stand and look back the way they came.
  const facing = -out.facing;
  const standing = `<g class="${k}-s" opacity="0" pointer-events="none"><g transform="translate(${there.x} ${there.y}) scale(${facing * scale} ${scale})"><g class="yard-bob">${walkerStill(person.look)}</g></g></g>`;
  const moving = `<g class="${k}-w" opacity="0" pointer-events="none">${walker(person.look, gaitFor(person.id, e.speed))}</g>`;
  return {
    css,
    items: [
      { y: there.y + 0.3, svg: standing },
      { y: Math.max(...e.path.map((p) => p.y)) + 0.3, svg: moving },
    ],
    homeClass: `${k}-h`,
  };
}

/** Standing still at the far end: a walker whose legs don't move. */
const walkerStill = (look: FigureLook): string => `<g class="yard-still">${walker(look)}</g>`;

// ---------------------------------------------------------------- through the gate

const GATE_X = GATE.x + GATE.w / 2;
const INSIDE = Y.fence - 14;
const OUTSIDE = Y.road + 12;
const ROAD = Y.road + 30;

/** The way through the gate and along the road, for someone setting out (reversed coming home). */
export function gatePath(order: number, way: 'out' | 'in'): Point[] {
  const muster = { x: GATE_X - 30 + (order % 5) * 15, y: 466 + Math.floor(order / 5) * 8 };
  const lane = order % 2 === 0 ? -5 : 5;
  const road = way === 'out' ? { x: -24, y: ROAD + (order % 3) * 4 } : { x: W + 24, y: ROAD + (order % 3) * 4 };
  const path = [muster, { x: GATE_X + lane, y: INSIDE }, { x: GATE_X + lane, y: OUTSIDE }, road];
  return way === 'out' ? path : path.reverse();
}

/** How long a trip through the gate takes from when it starts, in seconds, with a moment to fade at the end. */
export function tripSeconds(trip: YardTrip): number {
  const moving = trip.vehicle ? pathLength(drivePath(trip)) / DRIVE : pathLength(gatePath(trip.order, trip.way)) / MARCH;
  return moving + trip.order * 0.9 + 0.6;
}

function drivePath(trip: YardTrip): Point[] {
  const park = { x: PARKING_X[trip.vehicle?.slot ?? 0] ?? GATE_X, y: Y.parking };
  if (trip.way === 'out') return [{ x: GATE_X, y: INSIDE + 4 }, { x: GATE_X, y: OUTSIDE + 6 }, { x: -70, y: ROAD + 6 }];
  return [{ x: W + 70, y: ROAD + 6 }, { x: GATE_X, y: OUTSIDE + 6 }, { x: GATE_X, y: INSIDE + 4 }, park];
}

/**
 * A crew setting out or coming home (3.2.0): out from in front of the gate,
 * through it and off along the road; or in along the road, through the gate,
 * and back to where they belong, where their own figure takes over. A vehicle
 * drives off, or drives in and parks.
 */
export function tripMotion(trip: YardTrip, clock: number): Motion | undefined {
  const k = `yt${hash(`${trip.id}:${trip.at}`).toString(36)}`;
  const elapsed = (clock - trip.at) / 1000;
  const lead = trip.order * 0.9;
  const total = tripSeconds(trip);
  if (elapsed > total + 1) return undefined;
  const scale = trip.look ? figureScale(trip.look) : 1;
  const path = trip.vehicle ? drivePath(trip) : gatePath(trip.order, trip.way);
  const first = path[0]!;
  const last = path[path.length - 1]!;
  const moving = walk(path, lead, trip.vehicle ? DRIVE : MARCH, scale, first.x < last.x ? 1 : -1);
  const start: Frame = { t: 0, css: `opacity:${trip.way === 'out' && !trip.vehicle ? 1 : 0};${at(first, moving.frames[0] ? facingOf(moving.frames[0].css) : 1, scale)}` };
  const frames = [start, { ...start, t: lead }, ...moving.frames, { t: total, css: `opacity:0;${at(last, moving.facing, scale)}` }];
  const body = trip.vehicle ? vehicle(trip.vehicle.defId, trip.vehicle.id, 0, 0, false) : walker(trip.look!, gaitFor(trip.id, MARCH), trip.pack ?? 'day', trip.way === 'in');
  const delay = (-elapsed).toFixed(2);
  let css = keyframes(`${k}-m`, frames, total) + `.yard .${k}-m{animation:${k}-m ${total.toFixed(2)}s linear ${delay}s 1 both}`;
  let homeClass: string | undefined;
  if (trip.way === 'in') {
    // Their own figure (or the parked vehicle) shows once they're back.
    css += keyframes(`${k}-h`, [{ t: 0, css: 'opacity:0' }, { t: moving.end, css: 'opacity:0' }, { t: Math.min(total, moving.end + 0.4), css: 'opacity:1' }, { t: total, css: 'opacity:1' }], total) + `.yard .${k}-h{animation:${k}-h ${total.toFixed(2)}s linear ${delay}s 1 both}`;
    homeClass = `${k}-h`;
  }
  return { css, items: [{ y: Y.fence + 1 + trip.order * 0.01, svg: `<g class="${k}-m" opacity="0" pointer-events="none">${body}</g>` }], ...(homeClass ? { homeClass } : {}) };
}

function facingOf(css: string): number {
  return /scale\(-/.test(css) ? -1 : 1;
}

// ---------------------------------------------------------------- the sky and the road

/** Birds crossing by day, a shooting star at night. */
export function skyLife(phase: DayPhase): string {
  let out = '';
  if (phase !== 'night') {
    for (let i = 0; i < 3; i++) {
      const y = 44 + i * 9 + (i % 2) * 6;
      const x = -30 - i * 14;
      out += `<g class="yard-bird" style="animation-delay:-${i * 0.7 + (phase === 'dusk' ? 9 : 0)}s"><path class="yard-wing" d="M ${x - 4} ${y - 2} Q ${x - 2} ${y - 3} ${x} ${y} Q ${x + 2} ${y - 3} ${x + 4} ${y - 2}" fill="none" stroke="#3b3a35" stroke-width="1" stroke-linecap="round"/></g>`;
    }
  } else {
    out += `<line class="yard-shooting" x1="300" y1="30" x2="318" y2="22" stroke="#efe6d2" stroke-width="1.2" stroke-linecap="round" opacity="0"/>`;
  }
  return `<g class="yard-sky-life" pointer-events="none">${out}</g>`;
}

/** Now and then a tumbleweed rolls along the road. */
export function roadLife(): string {
  const weed = `<g class="yard-weed"><g class="yard-weed-roll"><circle r="6" fill="none" stroke="#8a7550" stroke-width="0.9"/><path d="M -5 -2 Q 0 -7 5 -1 M -4 3 Q 1 -3 4 4 M -2 -5 Q 3 0 -1 5" fill="none" stroke="#8a7550" stroke-width="0.8"/></g></g>`;
  return `<g transform="translate(0 ${Y.road + 42})" pointer-events="none">${weed}</g>`;
}
