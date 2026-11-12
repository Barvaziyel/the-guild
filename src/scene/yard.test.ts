import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BUILDING_IDS, PROJECT_IDS, type BuildingId, type ProjectId } from '../engine/types.ts';
import { GATE_SPOTS, IDLE_SPOTS, POST_SPOTS, PROJECT_SPOTS, REST_SPOTS } from './layout.ts';
import { dayPhase, type FigureLook, type YardModel, type YardPerson } from './model.ts';
import { spotFor, yardSvg } from './yard.ts';

const look: FigureLook = { skin: '#d6a981', skinShade: '#b98a62', hair: '#4a3527', hairDark: '#33231a', longHair: true, bald: false, cloth: '#5f7f78', accent: '#a8603f', armor: 'riot_gear', hat: 'goggles', hurt: true };

function model(change?: (m: YardModel) => void): YardModel {
  const buildings = Object.fromEntries(BUILDING_IDS.map((id) => [id, 1])) as Record<BuildingId, number>;
  const people: YardPerson[] = [];
  let n = 0;
  const add = (place: YardPerson['place']): void => {
    n += 1;
    people.push({ id: `s${n}`, look, place, go: `#/s/s${n}`, label: `Person ${n} & "friend" <x>` });
  };
  for (const id of BUILDING_IDS) POST_SPOTS[id].forEach((_, slot) => add({ kind: 'post', building: id, slot }));
  IDLE_SPOTS.forEach((_, slot) => add({ kind: 'idle', slot }));
  REST_SPOTS.infirmary.forEach((_, slot) => add({ kind: 'resting', slot, infirmary: true }));
  GATE_SPOTS.forEach((_, slot) => add({ kind: 'gate', slot }));
  for (const id of PROJECT_IDS) PROJECT_SPOTS[id].forEach((_, slot) => add({ kind: 'project', project: id, slot }));
  const projects = Object.fromEntries(PROJECT_IDS.map((id) => [id, { done: 1, working: true }])) as Record<ProjectId, { done: number; working: boolean }>;
  const m: YardModel = {
    buildings,
    projects,
    people,
    trader: true,
    vehicles: ['motorcycle', 'car', 'pickup', 'van'].map((defId, i) => ({ id: `v${i}`, defId, broken: i === 2, label: defId })),
    animals: [
      { id: 'a1', kind: 'dog', keeperId: 's1', label: 'Rust, the dog.' },
      { id: 'a2', kind: 'cat', label: 'Smudge, the cat.' },
      { id: 'a3', kind: 'goat', label: 'Clover, the goat.' },
      { id: 'a4', kind: 'crow', label: 'Jinx, the crow.' },
    ],
    phase: 'day',
  };
  change?.(m);
  return m;
}

/** Every tag that opens also closes, no attribute twice, no broken numbers. */
function assertWellFormed(svg: string): void {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, closing, name, attrs, selfClosing] = m;
    const names = [...attrs!.matchAll(/\s([a-zA-Z:-]+)="/g)].map((a) => a[1]);
    assert.equal(new Set(names).size, names.length, `attribute twice in <${name}${attrs}>`);
    if (selfClosing) continue;
    if (closing) assert.equal(stack.pop(), name, `unexpected </${name}>`);
    else stack.push(name!);
  }
  assert.deepEqual(stack, []);
  assert.ok(!/NaN|undefined|Infinity/.test(svg), 'no broken numbers');
}

describe('the yard drawing', () => {
  test('a full yard, at every level and every hour, is well-formed', () => {
    for (const level of [0, 1, 2, 3]) {
      for (const phase of ['dawn', 'day', 'dusk', 'night'] as const) {
        const svg = yardSvg(model((m) => {
          for (const id of BUILDING_IDS) m.buildings[id] = level;
          m.phase = phase;
        }));
        assertWellFormed(svg);
        assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"'));
      }
    }
  });

  test('every project draws at every stage, and the Wall takes the fence\u2019s place', () => {
    for (const done of [0, 1, 2, 3]) {
      for (const working of [false, true]) {
        for (const phase of ['day', 'night'] as const) {
          const svg = yardSvg(model((m) => {
            for (const id of PROJECT_IDS) m.projects[id] = { done, working: working && done < 3 };
            m.phase = phase;
          }));
          assertWellFormed(svg);
          for (const id of PROJECT_IDS) {
            if (id === 'the_wall') continue;
            assert.equal(svg.includes(`data-key="p:${id}"`), done > 0 || (working && done < 3), `${id} at ${done}${working ? ', working' : ''}`);
          }
        }
      }
    }
    const chain = (done: number): number =>
      [...yardSvg(model((m) => (m.projects.the_wall = { done, working: false }))).matchAll(/width="([\d.]+)" height="24" fill="url\(#yard-chain\)"/g)].reduce((a, m) => a + Number(m[1]), 0);
    assert.ok(chain(0) > chain(1) && chain(1) > chain(2) && chain(3) === 0, `the chain-link goes as the wall goes up: ${[0, 1, 2, 3].map(chain)}`);
  });

  test('every building, person, vehicle, the gate and the trader can be tapped', () => {
    const m = model();
    const svg = yardSvg(m);
    for (const id of BUILDING_IDS) assert.ok(svg.includes(`data-key="b:${id}" data-go="#/b/${id}"`), id);
    for (const p of m.people) assert.equal(svg.split(`data-key="s:${p.id}"`).length, 2, `${p.id} drawn once`);
    for (const v of m.vehicles) assert.ok(svg.includes(`data-key="v:${v.id}" data-go="#/vehicles"`));
    assert.ok(svg.includes('data-key="gate" data-go="#/recruits"'));
    assert.ok(svg.includes('data-key="trader"'));
    for (const a of m.animals) assert.equal(svg.split(`data-key="a:${a.id}"`).length, 2, `${a.id} drawn once`);
    assert.ok(svg.includes('Person 1 &amp; &quot;friend&quot; &lt;x&gt;'), 'labels are escaped');
  });

  test('the dog keeps by its keeper, or waits by the gate while they are away', () => {
    const at = (svg: string): string => svg.split('data-key="a:a1"')[1]!.slice(0, 400);
    const home = at(yardSvg(model()));
    const away = at(yardSvg(model((m) => (m.animals[0]!.keeperId = 'nobody'))));
    assert.notEqual(home, away);
  });

  test('every place the model can name has a spot', () => {
    for (const p of model().people) assert.ok(spotFor(p), JSON.stringify(p.place));
    assert.equal(spotFor({ id: 'x', look, place: { kind: 'idle', slot: IDLE_SPOTS.length }, go: '', label: '' }), undefined);
  });

  test('lights come on at dusk and stay on through the night', () => {
    assert.ok(!yardSvg(model()).includes('yard-lights'));
    assert.ok(yardSvg(model((m) => (m.phase = 'dusk'))).includes('yard-lights'));
    assert.ok(yardSvg(model((m) => (m.phase = 'night'))).includes('yard-shade'));
    assert.equal(dayPhase(6), 'dawn');
    assert.equal(dayPhase(13), 'day');
    assert.equal(dayPhase(19), 'dusk');
    assert.equal(dayPhase(23), 'night');
    assert.equal(dayPhase(3), 'night');
  });

  test('an empty yard still draws the Depot', () => {
    const svg = yardSvg(model((m) => {
      m.people = [];
      m.vehicles = [];
      m.trader = false;
    }));
    assertWellFormed(svg);
    assert.ok(svg.includes('Depot'));
    assert.ok(!svg.includes('data-key="trader"'));
  });
});
