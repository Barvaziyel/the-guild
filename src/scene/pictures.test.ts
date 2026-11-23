import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BUILDING_IDS, type BeatKind } from '../engine/types.ts';
import { GEAR } from '../engine/content/gear.ts';
import { LOCATIONS } from '../engine/content/locations.ts';
import { ITEM_DRAWINGS, itemIconSvg } from './icons.ts';
import { BEAT_KINDS, BUILDING_ASPECT, beatIconSvg, buildingPictureSvg, hasPlacePicture, placePictureSvg } from './pictures.ts';

const wellFormed = (svg: string): void => {
  assert.match(svg, /^<svg [^>]*viewBox="[-\d. ]+"/);
  assert.ok(svg.endsWith('</svg>'));
  assert.doesNotMatch(svg, /NaN|undefined/);
};

describe('pictures (3.3.0)', () => {
  test('every piece of gear has an icon, at every quality', () => {
    for (const g of GEAR) {
      assert.ok(ITEM_DRAWINGS[g.id], `${g.id} needs a drawing in icons.ts`);
      for (const q of ['rusty', 'common', 'solid', 'prime', 'relic'] as const) wellFormed(itemIconSvg(g.id, q, g.name));
    }
    // An empty slot is a dashed outline.
    assert.match(itemIconSvg(undefined), /stroke-dasharray/);
  });

  test('better gear shows more stars; a relic has a gold edge', () => {
    const stars = (q: 'solid' | 'prime' | 'relic' | 'common'): number => (itemIconSvg('machete', q).match(/<polygon/g) ?? []).length;
    assert.ok(stars('common') < stars('solid') && stars('solid') < stars('prime') && stars('prime') < stars('relic'));
    assert.match(itemIconSvg('machete', 'relic'), /#c9a43e/);
  });

  test('every place in the Reach has a picture of its own', () => {
    for (const loc of LOCATIONS) {
      assert.ok(hasPlacePicture(loc.id), `${loc.id} needs a backdrop`);
      wellFormed(placePictureSvg(loc.id, loc.name));
    }
  });

  test('every building at every level, as a landscape', () => {
    for (const id of BUILDING_IDS) {
      for (let level = 0; level <= 3; level++) {
        const svg = buildingPictureSvg(id, level, id);
        wellFormed(svg);
        const [, , w, h] = svg.match(/viewBox="([^"]+)"/)![1]!.split(' ').map(Number);
        assert.ok(w! / h! >= BUILDING_ASPECT.min - 0.01 && w! / h! <= BUILDING_ASPECT.max + 0.01, `${id} ${w}x${h}`);
      }
    }
  });

  test('every kind of moment in a run has a stamp', () => {
    const kinds: BeatKind[] = ['depart', 'travel', 'scavenge', 'hazard', 'combat', 'social', 'discovery', 'rescue', 'vultures', 'return'];
    assert.deepEqual([...BEAT_KINDS].sort(), [...kinds].sort());
    for (const k of kinds) wellFormed(beatIconSvg(k));
  });
});
