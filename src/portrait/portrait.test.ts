import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GEAR } from '../engine/content/index.ts';
import { generateSurvivor } from '../engine/generator.ts';
import { Rng } from '../engine/rng.ts';
import { testGame, testSurvivor } from '../engine/test-utils.ts';
import type { Survivor } from '../engine/types.ts';
import { FACES } from './face.ts';
import { HAIR_STYLES } from './hair.ts';
import { ARMOR_LOOKS, WEAPON_LOOKS } from './outfit.ts';
import { LAYERS, portraitLayers, portraitLook, portraitSvg } from './portrait.ts';

const item = (defId: string) => ({ uid: `t-${defId}`, defId, quality: 'common' as const });
const trait = (id: string, hidden = false) => (hidden ? { id, gainedDay: 1, hidden: true } : { id, gainedDay: 1 });

function person(change?: (s: Survivor) => void): Survivor {
  const s = testSurvivor('p1');
  s.appearance = { seed: 4242, skinTone: 2, hairColor: 3, hairStyle: 2, faceShape: 0, eyes: 0, brows: 0, nose: 0, mouth: 0, facialHair: 0 };
  change?.(s);
  return s;
}

/** Every tag that opens also closes, in order. */
function assertWellFormed(svg: string): void {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, closing, name, , selfClosing] = m;
    if (selfClosing) continue;
    if (closing) assert.equal(stack.pop(), name, `unexpected </${name}>`);
    else stack.push(name!);
  }
  assert.deepEqual(stack, []);
  assert.ok(!/NaN|undefined|Infinity/.test(svg), 'no broken numbers');
}

describe('portraitSvg', () => {
  test('is a well-formed 256 x 256 SVG with every layer, back to front', () => {
    const svg = portraitSvg(person());
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"'));
    assert.ok(svg.endsWith('</svg>'));
    assertWellFormed(svg);
    let at = -1;
    for (const layer of LAYERS) {
      const next = svg.indexOf(`data-layer="${layer}"`);
      assert.ok(next > at, `${layer} comes after the previous layer`);
      at = next;
    }
  });

  test('the same survivor always gets the same portrait', () => {
    assert.equal(portraitSvg(person()), portraitSvg(person()));
    assert.notEqual(portraitSvg(person()), portraitSvg(person((s) => void (s.appearance.seed = 4243))));
  });

  test('every generated survivor renders cleanly', () => {
    const state = testGame();
    const rng = new Rng('faces');
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const s = generateSurvivor(state, rng, { day: 1 });
      const svg = portraitSvg(s);
      assertWellFormed(svg);
      seen.add(svg);
    }
    assert.ok(seen.size >= 299, 'portraits are distinct');
  });

  test('every part variant renders on every face shape', () => {
    for (let face = 0; face < FACES.length; face++) {
      for (let v = 0; v < HAIR_STYLES.length; v++) {
        const s = person((p) => {
          p.pronouns = 'he';
          p.appearance = { seed: 100 + v, skinTone: v, hairColor: v, hairStyle: v, faceShape: face, eyes: v, brows: v, nose: v, mouth: v, facialHair: v };
        });
        assertWellFormed(portraitSvg(s));
      }
    }
  });

  test('options: size, no wobble, no background, memorial', () => {
    const s = person();
    assert.match(portraitSvg(s, { size: 96 }), /width="96" height="96"/);
    assert.ok(portraitSvg(s).includes('-ink)'));
    assert.ok(!portraitSvg(s, { wobble: false }).includes('-ink'));
    assert.ok(!portraitSvg(s, { background: false }).includes('data-layer="background"'));
    assert.ok(portraitSvg(s, { memorial: true }).includes('feColorMatrix'));
    for (const opts of [{ wobble: false }, { background: false }, { memorial: true }]) assertWellFormed(portraitSvg(s, opts));
  });

  test('ids are unique per survivor, so many portraits can share a page', () => {
    const idsOf = (svg: string): string[] => [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!);
    const a = idsOf(portraitSvg(person()));
    const b = idsOf(portraitSvg(person((s) => void (s.appearance.seed = 999))));
    assert.ok(a.length > 0);
    assert.equal(a.filter((id) => b.includes(id)).length, 0);
  });
});

describe('what a survivor wears and carries shows', () => {
  test('gear changes the outfit but never the face', () => {
    const bare = portraitLayers(person());
    const geared = portraitLayers(
      person((s) => {
        s.equipment = { weapon: item('hunting_rifle'), armor: item('scrap_vest'), tool: item('binoculars'), trinket: item('dog_tags') };
      }),
    );
    assert.equal(geared.head, bare.head);
    assert.equal(geared.features, bare.features);
    assert.notEqual(geared.body, bare.body);
    assert.notEqual(geared.behind, bare.behind);
  });

  test('each piece of gear with a look changes the picture', () => {
    const bare = portraitSvg(person());
    for (const g of GEAR) {
      const svg = portraitSvg(person((s) => void (s.equipment[g.slot] = item(g.id))));
      const look = portraitLook(person((s) => void (s.equipment[g.slot] = item(g.id))));
      const visible = look.armor ?? look.weapon ?? look.tool ?? look.trinket;
      if (visible) assert.notEqual(svg, bare, g.id);
      else assert.equal(svg, bare, `${g.id} has no look and changes nothing`);
    }
  });

  test('all armor and weapons in the game have a look', () => {
    for (const g of GEAR) {
      if (g.slot === 'armor') assert.ok(ARMOR_LOOKS[g.id], `armor ${g.id} needs an entry in ARMOR_LOOKS`);
      if (g.slot === 'weapon') assert.ok(WEAPON_LOOKS[g.id], `weapon ${g.id} needs an entry in WEAPON_LOOKS`);
    }
  });

  test('a hazmat suit hides the hair and adds a mask; a helmet hides the top', () => {
    const bare = portraitLayers(person((s) => void (s.appearance.hairStyle = 5)));
    assert.ok(bare.hair.length > 0 && bare['hair-back'].length > 0);
    const hazmat = portraitLayers(person((s) => { s.appearance.hairStyle = 5; s.equipment.armor = item('hazmat_suit'); }));
    assert.equal(hazmat.hair, '');
    assert.equal(hazmat['hair-back'], '');
    assert.ok(hazmat.headgear.length > 500);
    const riot = portraitLayers(person((s) => { s.appearance.hairStyle = 5; s.equipment.armor = item('riot_gear'); }));
    assert.ok(riot.hair.length > 0 && riot.hair.length < bare.hair.length, 'only the locks below the helmet');
    assert.ok(riot['hair-back'].includes('-brim'));
  });
});

describe('what a survivor has lived through shows', () => {
  const layersWith = (...ids: string[]) => portraitLayers(person((s) => void (s.traits = ids.map((id) => trait(id)))));
  const plain = portraitLayers(person());

  test('a lost eye is covered by a patch', () => {
    const l = layersWith('lost_eye');
    assert.ok(l.headgear.includes('#2f2a27'));
    assert.ok(l.features.length < plain.features.length, 'one eye and brow fewer');
  });

  test('scars and burns mark the face', () => {
    assert.ok(layersWith('scarred_face')['face-marks'].length > plain['face-marks'].length);
    assert.ok(layersWith('burn_scars')['skin-marks'].includes('#a4523c'));
  });

  test('wounds show: plasters, then a bandaged head', () => {
    assert.ok(layersWith('wounded')['face-marks'].includes('<rect'));
    const bad = layersWith('badly_wounded');
    assert.ok(bad.headgear.length > plain.headgear.length);
    // Under a helmet there is no room for a bandage, so plasters are used.
    const helmeted = portraitLayers(person((s) => { s.traits = [trait('badly_wounded')]; s.equipment.armor = item('riot_gear'); }));
    assert.ok(helmeted['face-marks'].includes('<rect'));
  });

  test('sickness, grief and haunting show on the face', () => {
    assert.ok(layersWith('rad_sickness')['skin-marks'].includes('#8aa04e'));
    assert.ok(layersWith('haunted')['skin-marks'].includes('<ellipse'));
    assert.ok(layersWith('grieving')['face-marks'].length > plain['face-marks'].length);
  });

  test('high stress shows as strain', () => {
    assert.equal(plain.strain, '');
    assert.ok(portraitLayers(person((s) => void (s.stress = 85))).strain.length > 0);
  });

  test('hidden traits never show', () => {
    const hidden = portraitLayers(person((s) => void (s.traits = [trait('haunted', true), trait('scarred_face', true)])));
    assert.deepEqual(hidden, plain);
  });

  test('age greys the hair and lines the face', () => {
    const young = portraitLook(person((s) => void (s.age = 25)));
    const old = portraitLook(person((s) => void (s.age = 66)));
    assert.equal(young.aged, false);
    assert.equal(old.aged, true);
    assert.notEqual(old.hairColor.base, young.hairColor.base);
    assert.equal(old.face, young.face, 'still the same person');
  });

  test('pronouns shape facial hair', () => {
    for (let v = 0; v < 30; v++) {
      assert.equal(portraitLook(person((s) => { s.pronouns = 'she'; s.appearance.facialHair = v; })).facialHair, 0);
    }
    const kinds = new Set<number>();
    for (let v = 0; v < 30; v++) kinds.add(portraitLook(person((s) => { s.pronouns = 'he'; s.appearance.facialHair = v; })).facialHair);
    assert.ok(kinds.size >= 6);
  });
});
