import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BUILDING_IDS, PROJECT_IDS, type BuildingId, type ProjectId } from '../engine/types.ts';
import { errandFor, errandMotion, gatePath, pathLength, tripMotion, tripSeconds } from './life.ts';
import { IDLE_SPOTS, POST_SPOTS, REST_SPOTS, W } from './layout.ts';
import type { FigureLook, YardModel, YardPerson, YardTrip } from './model.ts';
import { spotFor, yardSvg } from './yard.ts';

const look: FigureLook = { skin: '#d6a981', skinShade: '#b98a62', hair: '#4a3527', hairDark: '#33231a', longHair: false, bald: false, cloth: '#5f7f78', accent: '#a8603f', hurt: false };
const person = (id: string, place: YardPerson['place']): YardPerson => ({ id, look, place, go: `#/s/${id}`, label: id });

function model(people: YardPerson[], trips: YardTrip[] = []): YardModel {
  return {
    buildings: Object.fromEntries(BUILDING_IDS.map((id) => [id, 1])) as Record<BuildingId, number>,
    projects: Object.fromEntries(PROJECT_IDS.map((id) => [id, { done: 0, working: false }])) as Record<ProjectId, { done: number; working: boolean }>,
    people,
    trader: false,
    vehicles: [{ id: 'v1', defId: 'pickup', broken: false, label: 'Pickup' }],
    animals: [],
    phase: 'day',
    ...(trips.length > 0 ? { trips } : {}),
  };
}

describe('errands in the yard (3.2.0)', () => {
  test('some of those by the fire wander off and come back; nobody on a cot, high up, or at the gate', () => {
    const idle = IDLE_SPOTS.slice(0, 6).flatMap((_, slot) => Array.from({ length: 6 }, (_, k) => person(`idle${slot}-${k}`, { kind: 'idle', slot })));
    const going = idle.filter((p) => errandFor(p, spotFor(p)!));
    assert.ok(going.length > idle.length * 0.2 && going.length < idle.length * 0.6, `${going.length} of ${idle.length}`);
    for (let k = 0; k < 10; k++) {
      assert.equal(errandFor(person(`cot${k}`, { kind: 'resting', slot: 0, infirmary: true }), REST_SPOTS.infirmary[0]!), undefined);
      assert.equal(errandFor(person(`look${k}`, { kind: 'post', building: 'watchtower', slot: 0 }), POST_SPOTS.watchtower[0]!), undefined);
      assert.equal(errandFor(person(`gate${k}`, { kind: 'gate', slot: 0 }), { x: 152, y: 568, pose: 'stand', facing: 1 }), undefined);
    }
  });

  test('an errand stays on the ground of the yard, and fits in its cycle', () => {
    for (let k = 0; k < 60; k++) {
      const p = person(`walker${k}`, { kind: 'idle', slot: k % 6 });
      const spot = spotFor(p)!;
      const e = errandFor(p, spot);
      if (!e) continue;
      assert.deepEqual(e.path[0], { x: spot.x, y: spot.y });
      for (const pt of e.path) assert.ok(pt.x >= 0 && pt.x <= W && pt.y >= spot.y, JSON.stringify(pt));
      assert.ok(e.start + (2 * pathLength(e.path)) / e.speed + e.pause <= e.cycle);
      const m = errandMotion(p, spot, e, 1_000_000);
      assert.match(m.css, /@keyframes ye\w+-w\{/);
      assert.equal(m.items.length, 2);
    }
  });

  test('children run about more often than grown-ups stroll', () => {
    let kids = 0;
    for (let k = 0; k < 20; k++) if (errandFor(person(`kid${k}`, { kind: 'child', slot: k % 6, baby: false }), { x: 200, y: 450, pose: 'stand', facing: 1 })) kids++;
    assert.equal(kids, 20);
    assert.equal(errandFor(person('baby', { kind: 'child', slot: 0, baby: true }), { x: 200, y: 450, pose: 'sit', facing: 1 }), undefined);
  });
});

describe('through the gate (3.2.0)', () => {
  const out: YardTrip = { id: 'a', look, way: 'out', at: 10_000, order: 0 };
  test('setting out ends off the road, coming home starts on it', () => {
    assert.ok(gatePath(0, 'out').at(-1)!.x < 0);
    assert.ok(gatePath(1, 'in')[0]!.x > W);
  });

  test('a trip is drawn while it lasts, then not at all', () => {
    assert.ok(tripMotion(out, 10_000));
    assert.ok(tripMotion(out, 10_000 + tripSeconds(out) * 500));
    assert.equal(tripMotion(out, 10_000 + (tripSeconds(out) + 2) * 1000), undefined);
  });

  test('coming home, their own figure (or the vehicle) waits for them to arrive; the gate opens', () => {
    const svg = yardSvg(model([person('a', { kind: 'idle', slot: 0 })], [{ ...out, way: 'in' }, { id: 'v1', vehicle: { defId: 'pickup', id: 'v1', slot: 0 }, way: 'in', at: 10_000, order: 0 }]), 12_000);
    const classes = [...svg.matchAll(/class="(yt\w+-h)"/g)].map((m) => m[1]);
    assert.equal(classes.length, 2, 'the person and the vehicle each wait');
    assert.match(svg, /animation:yard-gate /);
    // Long after, the gate stays shut and nothing waits.
    const later = yardSvg(model([person('a', { kind: 'idle', slot: 0 })], [{ ...out, way: 'in' }]), 90_000);
    assert.doesNotMatch(later, /yard-gate \d/);
    assert.doesNotMatch(later, /class="yt/);
  });
});
