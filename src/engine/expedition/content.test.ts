import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ENEMIES, EVOLUTIONS, LOCATIONS, findEnemy, findLocation, findTrait } from '../content/index.ts';
import { COMBAT_INTROS, HAZARD_TEXT } from '../content/flavor.ts';
import { RESOURCE_IDS } from '../types.ts';

describe('expedition content integrity', () => {
  test('ids are unique', () => {
    for (const list of [ENEMIES, LOCATIONS, EVOLUTIONS] as const) {
      const ids = list.map((x) => x.id);
      assert.equal(new Set(ids).size, ids.length);
    }
  });

  test('enemies have sane numbers and intro text for their type', () => {
    for (const e of ENEMIES) {
      assert.ok(e.hp > 0 && e.damage > 0 && e.threat > 0, e.id);
      assert.ok(COMBAT_INTROS[e.type].length > 0, e.id);
      for (const range of Object.values(e.loot)) assert.ok(range[0] <= range[1], e.id);
    }
  });

  test('locations reference real enemies, hazards and neighbours', () => {
    for (const loc of LOCATIONS) {
      assert.ok(loc.danger >= 1 && loc.danger <= 5, loc.id);
      assert.ok(loc.radiation >= 0 && loc.radiation <= 3, loc.id);
      assert.ok(loc.encounters.length > 0 && loc.sights.length > 0 && loc.hazards.length > 0, loc.id);
      for (const enc of loc.encounters) {
        assert.ok(enc.weight > 0 && enc.enemies.length > 0, loc.id);
        for (const id of enc.enemies) assert.ok(findEnemy(id), `${loc.id} -> enemy ${id}`);
      }
      for (const hazard of loc.hazards) {
        assert.ok(HAZARD_TEXT[hazard], `${loc.id} -> hazard ${hazard}`);
        if (hazard === 'radiation') assert.ok(loc.radiation > 0, `${loc.id} has a radiation hazard but no radiation`);
      }
      for (const id of loc.leadsTo) assert.ok(findLocation(id), `${loc.id} -> ${id}`);
      assert.ok(RESOURCE_IDS.some((r) => loc.loot[r] > 0), `${loc.id} has loot`);
    }
  });

  test('every location can be reached from the starting ones', () => {
    const reached = new Set(LOCATIONS.filter((l) => l.startKnown).map((l) => l.id));
    assert.ok(reached.size >= 3, 'at least three starting locations');
    let grew = true;
    while (grew) {
      grew = false;
      for (const loc of LOCATIONS) {
        if (!reached.has(loc.id)) continue;
        for (const next of loc.leadsTo) {
          if (!reached.has(next)) {
            reached.add(next);
            grew = true;
          }
        }
      }
    }
    assert.deepEqual(LOCATIONS.filter((l) => !reached.has(l.id)).map((l) => l.id), []);
  });

  test('evolution rules reference real traits', () => {
    for (const rule of EVOLUTIONS) {
      assert.ok(findTrait(rule.gain), `${rule.id} gain`);
      if (rule.requires) assert.ok(findTrait(rule.requires), `${rule.id} requires`);
      if (rule.removes) assert.ok(findTrait(rule.removes), `${rule.id} removes`);
      assert.ok(rule.chance > 0 && rule.chance <= 1, rule.id);
    }
  });
});
