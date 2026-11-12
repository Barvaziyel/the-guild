/**
 * The yard: the whole Depot as one SVG drawing. Everything is drawn back to
 * front by where it stands, then the light of the time of day goes over it,
 * then the lights that shine through the dark.
 */
import type { AnimalKind, BuildingId, ProjectId } from '../engine/types.ts';
import { BUILDING_BASE, BUILDING_DRAWINGS, bulbs, flame, stationHouse } from './buildings.ts';
import { C, circle, hash, hit, ink, line, mix, pathEl, rect, tappable } from './draw.ts';
import { figure, trader } from './figures.ts';
import { BUILDING_AREAS, GATE, GATE_SPOTS, H, IDLE_SPOTS, PARKING_X, POST_SPOTS, PROJECT_SPOTS, REST_SPOTS, W, Y, type Spot } from './layout.ts';
import { PROJECT_BASE, PROJECT_DRAWINGS, wallRun, wallShare, type ProjectLook } from './projects.ts';
import type { DayPhase, YardModel, YardPerson } from './model.ts';
import { vehicle } from './vehicles.ts';
import { ANIMAL_SPOTS, cat, crow, dog, goat } from './animals.ts';

const SKY: Record<DayPhase, string> = { dawn: '#e6c6a2', day: '#cdd8cd', dusk: '#dca37c', night: '#2e3b4b' };
const SHADE: Record<DayPhase, { color: string; opacity: number }> = {
  dawn: { color: '#f0a868', opacity: 0.12 },
  day: { color: '#000000', opacity: 0 },
  dusk: { color: '#b4583a', opacity: 0.2 },
  night: { color: '#0f1b2c', opacity: 0.6 },
};

const BUILDING_NAMES: Record<BuildingId, string> = {
  bunks: 'Bunks',
  garden: 'Garden',
  firepit: 'Firepit',
  infirmary: 'Infirmary',
  workshop: 'Workshop',
  radio_tower: 'Radio Tower',
  watchtower: 'Watchtower',
  training_yard: 'Training Yard',
};

/** Where someone in the model stands. */
export function spotFor(person: YardPerson): Spot | undefined {
  const p = person.place;
  switch (p.kind) {
    case 'post':
      return POST_SPOTS[p.building][p.slot];
    case 'project':
      return PROJECT_SPOTS[p.project][p.slot];
    case 'idle':
      return IDLE_SPOTS[p.slot];
    case 'resting':
      return (p.infirmary ? REST_SPOTS.infirmary : REST_SPOTS.bunks)[p.slot];
    case 'gate':
      return GATE_SPOTS[p.slot];
  }
}

function sky(phase: DayPhase): string {
  let out = rect(0, 0, W, Y.skyline + 4, SKY[phase], 'stroke="none"');
  if (phase === 'night') {
    for (let i = 0; i < 26; i++) {
      const h = hash(`star${i}`);
      out += `<circle cx="${h % W}" cy="${(h >>> 9) % 120}" r="${0.6 + ((h >>> 4) % 3) * 0.3}" fill="#efe6d2" opacity="0.8"/>`;
    }
    out += circle(70, 40, 11, '#e9e4cf', 'stroke="none"') + circle(75, 37, 10, SKY.night, 'stroke="none"');
  } else {
    const sun = phase === 'day' ? [300, 42, '#f4e3b0'] : phase === 'dawn' ? [52, 118, '#f6c27a'] : [352, 116, '#f19a5a'];
    out += circle(sun[0] as number, sun[1] as number, 14, sun[2] as string, 'stroke="none"');
    const cloud = mix(SKY[phase], '#ffffff', 0.35);
    for (const [cx, cy, w] of [
      [110, 34, 30],
      [250, 24, 26],
      [190, 78, 22],
    ] as const) {
      out += `<ellipse cx="${cx}" cy="${cy}" rx="${w}" ry="${w / 4}" fill="${cloud}"/><ellipse cx="${cx + w / 3}" cy="${cy - w / 6}" rx="${w / 2}" ry="${w / 4}" fill="${cloud}"/>`;
    }
  }
  // What's left of the city on the horizon.
  const far = mix(SKY[phase], '#45504c', 0.45);
  let d = `M 0 ${Y.skyline}`;
  let x = 0;
  let i = 0;
  while (x < W) {
    const h = hash(`city${i++}`);
    const w = 14 + (h % 26);
    const top = Y.skyline - 14 - ((h >>> 6) % 34);
    const broken = (h >>> 3) % 3 === 0;
    d += ` L ${x} ${top} L ${x + w * 0.6} ${top + (broken ? 8 : 0)} L ${x + w} ${top + (broken ? 3 : 0)}`;
    x += w;
  }
  d += ` L ${W} ${Y.skyline} Z`;
  out += `<path d="${d}" fill="${far}" stroke="none"/>`;
  return out;
}

function ground(): string {
  let out = rect(0, Y.skyline, W, Y.road - Y.skyline, C.dirt, 'stroke="none"');
  for (let i = 0; i < 9; i++) {
    const h = hash(`patch${i}`);
    out += `<ellipse cx="${h % W}" cy="${Y.skyline + 40 + ((h >>> 8) % 330)}" rx="${18 + (h % 30)}" ry="${4 + (h % 5)}" fill="${C.dirtDark}" opacity="0.5"/>`;
  }
  // A worn path from the gate up into the yard.
  out += `<path d="M ${GATE.x + 6} ${Y.fence} L ${GATE.x + GATE.w - 6} ${Y.fence} L 222 440 L 202 440 Z" fill="#c8b48e" opacity="0.6"/>`;
  out += rect(0, Y.road, W, H - Y.road, C.road, 'stroke="none"');
  out += line(0, Y.road + 34, W, Y.road + 30, 1, '#8a7b60') + line(0, Y.road + 48, W, Y.road + 52, 1, '#8a7b60');
  return out;
}

function rails(): string {
  let out = '';
  for (let x = 2; x < W; x += 12) out += rect(x, Y.rails - 3, 5, 7, C.tie, 'stroke="none"');
  out += line(0, Y.rails - 1, W, Y.rails - 1, 1.6, C.rail) + line(0, Y.rails + 3, W, Y.rails + 3, 1.6, C.rail);
  return out;
}

/**
 * The chain-link fence, and the Wall where it has replaced it (§9.6): a third
 * of the fence's length a stage, from the left, skipping the gate.
 */
function fence(wall: ProjectLook): string {
  const top = Y.fence - 24;
  const length = W - GATE.w;
  const walled = wallShare(wall) * length;
  // Where the wall ends on the drawing, counting the fence on both sides of the gate.
  const end = walled <= GATE.x ? walled : walled + GATE.w;
  let out = '';
  for (const [x1, x2] of [
    [0, GATE.x],
    [GATE.x + GATE.w, W],
  ] as const) {
    const from = Math.max(x1, Math.min(x2, end));
    if (from < x2) {
      out += `<rect x="${from}" y="${top}" width="${x2 - from}" height="24" fill="url(#yard-chain)"/>` + line(from, top, x2, top, 1.2, C.fence);
      for (let x = 4; x < W; x += 24) if (x >= from && x < x2 && !(x > GATE.x - 4 && x < GATE.x + GATE.w + 4)) out += rect(x - 1.5, top - 3, 3, 27, C.fence, ink(0.7));
    }
    out += wallRun(x1, Math.min(x2, end));
  }
  return out;
}

function gate(): string {
  const top = Y.fence - 26;
  const half = GATE.w / 2;
  let body = '';
  for (const x of [GATE.x, GATE.x + half]) {
    body += `<rect x="${x + 1}" y="${top}" width="${half - 2}" height="26" fill="url(#yard-chain)" ${ink(1.2)}/>`;
    body += line(x + 1, Y.fence, x + half - 1, top, 0.9);
  }
  body += rect(GATE.x - 3, top - 6, 4, 32, C.steelDark) + rect(GATE.x + GATE.w - 1, top - 6, 4, 32, C.steelDark);
  return tappable('gate', '#/recruits', 'The gate. See who is asking to join.', hit(GATE.x - 4, top - 8, GATE.w + 8, 36) + body);
}

function cart(): string {
  const x = 318;
  const y = 574;
  const body =
    circle(x - 18, y - 8, 8, '#4a3d33') +
    circle(x - 18, y - 8, 2.5, C.steel, ink(0.8)) +
    rect(x - 38, y - 24, 52, 10, C.wood) +
    pathEl(`M ${x - 36} ${y - 24} Q ${x - 12} ${y - 52} ${x + 12} ${y - 24} Z`, C.canvas) +
    rect(x + 14, y - 22, 18, 3, C.woodDark, ink(0.8)) +
    rect(x - 34, y - 32, 10, 8, '#8a6844', ink(0.8)) +
    trader(x + 34, y);
  return tappable('trader', '#/depot', 'A trader caravan at the gate. Their offer is on the Today tab.', hit(x - 42, y - 54, 90, 56) + body);
}

/** Lights that shine through the dusk and the dark, drawn over the shade. */
function lights(model: YardModel): string {
  const { buildings: b } = model;
  const glow = (x: number, y: number, r: number): string => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#yard-glow)"/>`;
  let out = glow(211, Y.front - 30, 46);
  for (const x of [36, 64, 92, 156, 184, 212]) out += rect(x + 2, Y.back - 38, 8, 18, C.lit, 'stroke="none" opacity="0.85"');
  for (let i = 0; i < Math.max(1, Math.min(3, b.bunks)); i++) out += rect(10 + i * 64 + 7, Y.rails - 31, 6, 4, C.lit, 'stroke="none" opacity="0.85"');
  if (b.workshop >= 3) out += rect(208, 285, 8, 6, C.lit, 'stroke="none" opacity="0.85"');
  if (b.infirmary >= 3) out += rect(317, 281, 12, 8, C.lit, 'stroke="none" opacity="0.85"') + rect(371, 281, 12, 8, C.lit, 'stroke="none" opacity="0.85"');
  else if (b.infirmary >= 1) out += glow(350, Y.middle - 10, 14);
  if (b.firepit >= 3) out += glow(212, 340, 40) + bulbs();
  if (b.radio_tower >= 1) out += `<circle class="yard-blink" cx="348" cy="${80 - 14 - b.radio_tower * 12}" r="2" fill="#ff6a5a"/>`;
  return out + flame();
}

const ANIMAL_DRAWINGS: Record<AnimalKind, (x: number, y: number, facing: 1 | -1) => string> = {
  dog: (x, y, facing) => dog(x, y, facing),
  cat: (x, y) => cat(x, y),
  goat: (x, y, facing) => goat(x, y, facing),
  crow: (x, y) => crow(x, y),
};

/** Where an animal is: the dog at its keeper's side (or waiting by the gate), the rest in their places. */
function animalSpot(model: YardModel, kind: AnimalKind, keeperId?: string): { x: number; y: number; facing: 1 | -1 } {
  if (kind === 'dog') {
    const keeper = model.people.find((p) => p.id === keeperId && p.place.kind !== 'gate');
    const spot = keeper && spotFor(keeper);
    // At their feet, looking up at them.
    if (spot) return { x: spot.x + 15 * spot.facing, y: spot.y + (spot.pose === 'lie' ? 10 : 8), facing: spot.facing === 1 ? -1 : 1 };
    return { ...ANIMAL_SPOTS.dogWaiting, facing: -1 };
  }
  if (kind === 'goat') return { ...ANIMAL_SPOTS.goat, facing: 1 };
  return { ...ANIMAL_SPOTS[kind], facing: 1 };
}

/** The whole yard as an SVG document. */
export function yardSvg(model: YardModel): string {
  const items: { y: number; svg: string }[] = [];
  items.push({ y: Y.back - 2, svg: stationHouse() });
  items.push({ y: Y.rails - 1, svg: rails() });

  for (const id of Object.keys(BUILDING_DRAWINGS) as BuildingId[]) {
    const a = BUILDING_AREAS[id];
    const level = model.buildings[id] ?? 0;
    const label = level > 0 ? `${BUILDING_NAMES[id]}, level ${level}.` : `${BUILDING_NAMES[id]}: not built yet.`;
    items.push({ y: BUILDING_BASE[id], svg: tappable(`b:${id}`, `#/b/${id}`, label, hit(a.x, a.y, a.w, a.h) + BUILDING_DRAWINGS[id](level)) });
  }

  for (const p of model.people) {
    const spot = spotFor(p);
    if (!spot) continue;
    // People at a building stand in front of it, even up on a platform.
    const y = p.place.kind === 'post' ? Math.max(spot.y, BUILDING_BASE[p.place.building] + 0.5) : p.place.kind === 'project' ? Math.max(spot.y, (PROJECT_BASE[p.place.project] ?? 0) + 0.5) : spot.y;
    const tall = spot.pose === 'lie' ? 14 : 30;
    const wide = spot.pose === 'lie' ? 30 : 16;
    const body = hit(spot.x - wide / 2, spot.y - tall, wide, tall + 2) + figure(p.look, spot, p.id);
    items.push({ y, svg: tappable(`s:${p.id}`, p.go, p.label, body) });
  }

  model.vehicles.forEach((v, i) => {
    const x = PARKING_X[i]!;
    const body = hit(x - 44, Y.parking - 44, 88, 46) + vehicle(v.defId, v.id, x, Y.parking, v.broken);
    items.push({ y: Y.parking, svg: tappable(`v:${v.id}`, '#/vehicles', v.label, body) });
  });

  const projectLabels: Record<ProjectId, string> = { the_line: 'The Line', the_wall: 'The Wall', the_clinic: 'The Clinic', the_relay: 'The Relay', memorial_garden: 'The Memorial Garden' };
  for (const id of Object.keys(PROJECT_DRAWINGS) as ProjectId[]) {
    const look = model.projects[id];
    if (!look || (look.done === 0 && !look.working)) continue;
    const label = `${projectLabels[id]}: ${look.done === 3 ? 'finished' : `${look.done} of 3 stages done${look.working ? ', work under way' : ''}`}.`;
    items.push({ y: PROJECT_BASE[id]!, svg: tappable(`p:${id}`, '#/depot/projects', label, PROJECT_DRAWINGS[id]!(look)) });
  }

  for (const a of model.animals ?? []) {
    const at = animalSpot(model, a.kind, a.keeperId);
    const body = hit(at.x - 12, at.y - 22, 24, 24) + ANIMAL_DRAWINGS[a.kind](at.x, at.y, at.facing);
    items.push({ y: at.y + 0.2, svg: tappable(`a:${a.id}`, '#/depot/yard', a.label, body) });
  }

  items.push({ y: Y.fence, svg: fence(model.projects.the_wall ?? { done: 0, working: false }) + gate() });
  if (model.trader) items.push({ y: 574, svg: cart() });

  items.sort((a, b) => a.y - b.y);
  const shade = SHADE[model.phase];
  const dark = model.phase === 'night' || model.phase === 'dusk';

  const defs =
    `<pattern id="yard-chain" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M 0 0 L 6 6 M 6 0 L 0 6" stroke="${C.fence}" stroke-width="0.6"/></pattern>` +
    `<radialGradient id="yard-glow"><stop offset="0" stop-color="${C.lit}" stop-opacity="0.55"/><stop offset="1" stop-color="${C.lit}" stop-opacity="0"/></radialGradient>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="yard yard-${model.phase}" role="group" aria-label="The Depot yard">` +
    `<defs>${defs}</defs>` +
    sky(model.phase) +
    ground() +
    items.map((i) => i.svg).join('') +
    (shade.opacity > 0 ? `<rect class="yard-shade" width="${W}" height="${H}" fill="${shade.color}" opacity="${shade.opacity}" pointer-events="none"/>` : '') +
    (dark ? `<g class="yard-lights" pointer-events="none">${lights(model)}</g>` : '') +
    '</svg>'
  );
}


