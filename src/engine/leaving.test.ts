import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { adopt, newAnimal } from './animals.ts';
import { decideDilemma, startDilemma } from './dilemmas.ts';
import { dayStart } from './depot/time.ts';
import { createItem } from './gear.ts';
import { leaveGuild } from './leaving.ts';
import { arePartners, becomePartners, relationshipLabel } from './relationships.ts';
import { Rng } from './rng.ts';
import { testGame } from './test-utils.ts';

describe('leaving the guild', () => {
  test('someone who walks out takes what they carry, leaves a partner behind, and hands on their animals', () => {
    const state = testGame('leave');
    const [a, b, c] = state.survivors;
    a!.pronouns = 'she';
    b!.pronouns = 'he';
    a!.orientation = b!.orientation = 'straight';
    becomePartners(state, a!, b!, 1);
    a!.equipment.weapon = createItem(state, 'hunting_rifle');
    a!.post = { building: 'garden' };
    const dog = adopt(state, newAnimal(state, 'dog', new Rng('d'), 1), a, 1, 'at the gate');
    const stress = b!.stress;
    leaveGuild(state, a!, 5, 'Left the guild over the feud with someone.', new Rng('l'));
    assert.ok(!state.survivors.includes(a!));
    assert.deepEqual(state.departed, [a]);
    assert.equal(a!.status, 'left');
    assert.equal(a!.leftDay, 5);
    assert.equal(a!.post, undefined);
    assert.ok(a!.equipment.weapon, 'the rifle went with her');
    assert.equal(a!.chronicle.at(-1)!.text, 'Left the guild over the feud with someone.');
    assert.match(state.log.at(-1)!.text, /left the guild, taking what she carried/);
    assert.equal(arePartners(state, a!.id, b!.id), false);
    assert.ok(b!.stress > stress, 'upset');
    assert.ok(b!.chronicle.some((x) => x.text.startsWith('Was left behind when')));
    assert.notEqual(dog.keeper, a!.id);
    assert.ok([b!.id, c!.id, state.survivors[2]!.id].includes(dog.keeper!));
  });

  test('a feud can end with someone walking out, or with them both still here', () => {
    const outcomes = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const state = testGame(`feud-${i}`);
      for (const rel of Object.values(state.relationships)) rel.score = -70;
      const d = startDilemma(state, 3, new Rng(`f${i}`), 'them_or_me')!;
      assert.equal(relationshipLabel(state, d.cast.a!, d.cast.b!), 'feud');
      decideDilemma(state, i % 4, dayStart(state, 3) + 1000);
      outcomes.add(state.departed.length > 0 ? 'left' : 'stayed');
      if (state.departed.length > 0) assert.equal(state.survivors.length, 3);
    }
    assert.deepEqual([...outcomes].sort(), ['left', 'stayed']);
  });
});
