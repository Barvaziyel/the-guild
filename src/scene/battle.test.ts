import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ENEMIES } from '../engine/content/enemies.ts';
import { LOCATIONS } from '../engine/content/locations.ts';
import { BACKDROP_PLACES, DRAWN_ENEMIES, STAGE_W, labelLines, stageSlots, stageSvg, type StageFighter, type StageModel } from './battle.ts';
import type { FigureLook } from './model.ts';

const look: FigureLook = { skin: '#d6a981', skinShade: '#b98a62', hair: '#4a3527', hairDark: '#33231a', longHair: true, bald: false, cloth: '#5f7f78', accent: '#a8603f', armor: 'riot_gear', hat: 'goggles', hurt: true };
const WEAPONS = [undefined, 'pipe', 'machete', 'sledge', 'shock_baton', 'pipe_pistol', 'hunting_rifle', 'crossbow', 'scattergun'];

function crew(n: number, change: (f: StageFighter, i: number) => Partial<StageFighter> = () => ({})): StageFighter[] {
  return Array.from({ length: n }, (_, i) => {
    const f: StageFighter = { key: `c:s${i}`, side: 'crew', label: `Person "${i}" & <x>`, title: `Person ${i}`, hp: 8, maxHp: 12, state: 'up', look, ...(WEAPONS[i % WEAPONS.length] ? { weapon: WEAPONS[i % WEAPONS.length]! } : {}) };
    return { ...f, ...change(f, i) };
  });
}

function foes(kinds: readonly string[]): StageFighter[] {
  return kinds.map((kind, i) => {
    const def = ENEMIES.find((e) => e.id === kind)!;
    return { key: `e:${i}`, side: 'enemy', label: def.name, title: def.name, hp: 3, maxHp: def.hp, state: 'up', kind, type: def.type, seed: `x${i}`, vulture: kind.startsWith('vulture_'), nemesis: i === 0 };
  });
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

describe('the battle stage', () => {
  test('every enemy in the game has a drawing, and every place a backdrop', () => {
    for (const e of ENEMIES) assert.ok(DRAWN_ENEMIES.includes(e.id), `${e.id} needs a drawing in src/scene/fighters.ts`);
    for (const l of LOCATIONS) assert.ok(BACKDROP_PLACES.includes(l.id), `${l.id} needs a backdrop in src/scene/backdrops.ts`);
  });

  test('every place, every enemy, every weapon, standing and fallen, draws well-formed', () => {
    const kinds = ENEMIES.map((e) => e.id);
    for (const [p, place] of LOCATIONS.entries()) {
      for (let k = 0; k < kinds.length; k += 3) {
        const model: StageModel = {
          place: place.id,
          crew: crew(3 + (p % 3), (_, i) => (i === 1 ? { state: 'down', hp: 0 } : i === 2 ? { aimed: true } : {})),
          enemies: foes(kinds.slice(k, k + 3)).map((f, i) => (i === 2 ? { ...f, state: 'dead', hp: 0 } : i === 1 ? { ...f, stunned: true } : f)),
          giving: 'c:s0',
          targets: ['e:0', 'e:1'],
          picked: 'e:1',
        };
        const svg = stageSvg(model);
        assertWellFormed(svg);
        assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250"'));
        assert.ok(svg.includes('&amp; &lt;x&gt;') && !svg.includes('<x>'), 'labels are escaped');
      }
    }
  });

  test('a round being played: lunges, shots, misses, heals, people running off', () => {
    const base: StageModel = { place: 'rail_yard', crew: crew(3), enemies: foes(['raider_scav', 'raider_gunner', 'scrap_drone']), targets: [] };
    const effects: StageModel['effect'][] = [
      { by: 'c:s0', at: 'e:1', motion: 'shoot', reaction: 'hit', pop: '-6', tone: 'hit' },
      { by: 'e:0', at: 'c:s1', motion: 'lunge', reaction: 'miss', pop: 'Miss', tone: 'miss' },
      { by: 'c:s2', at: 'c:s1', motion: 'act', reaction: 'heal', pop: '+4', tone: 'heal' },
      { by: 'e:2', motion: 'none', reaction: 'none', pop: 'Breaks!', tone: 'hit', leaving: ['e:2'] },
    ];
    for (const effect of effects) {
      const svg = stageSvg({ ...base, effect: effect!, enemies: base.enemies.map((f) => (effect!.leaving?.includes(f.key) ? { ...f, state: 'fled' } : f)) });
      assertWellFormed(svg);
      assert.ok(svg.includes(`>${effect!.pop}</text>`), effect!.pop);
    }
    const shot = stageSvg({ ...base, effect: effects[0]! });
    assert.ok(shot.includes('bt-tracer') && shot.includes('bt-flash') && shot.includes('bt-hit') && shot.includes('bt-recoil'));
    // Someone who ran off isn't drawn, unless they're running off right now.
    const gone = stageSvg({ ...base, enemies: base.enemies.map((f, i) => (i === 2 ? { ...f, state: 'fled' } : f)) });
    assert.ok(!gone.includes('data-key="e:2"'));
  });

  test('crowds fit on the stage: up to eight a side, nobody off the edge', () => {
    for (let n = 1; n <= 8; n++) {
      for (const side of ['crew', 'enemy'] as const) {
        const slots = stageSlots(n, side);
        assert.equal(slots.length, n);
        for (const s of slots) assert.ok(s.x - 22 * s.scale >= 0 && s.x + 22 * s.scale <= STAGE_W, `${side} ${n}: ${s.x}`);
        for (const s of slots) assert.ok(side === 'crew' ? s.x < STAGE_W / 2 : s.x > STAGE_W / 2, 'each side keeps to its half');
      }
    }
    assertWellFormed(stageSvg({ place: 'checkpoint_bravo', crew: crew(8), enemies: foes(['raider_scav', 'raider_scav', 'raider_gunner', 'raider_brute', 'rad_hound', 'hollow']), targets: [] }));
  });

  test('a job shows in the top left beside their nerve: a pip for each turn of work, then how it ended (2.5.0)', () => {
    const base = { place: 'kessler_farm', crew: crew(3), enemies: foes(['raider_scav', 'raider_scav']), targets: [], nerve: 70 };
    const open = stageSvg({ ...base, job: { title: 'Grab their stash', progress: 1, needed: 2, state: 'open' } });
    assertWellFormed(open);
    assert.match(open, /aria-label="Grab their stash, 1 of 2"/);
    assert.equal((open.match(/<circle cx="[\d.]+" cy="13.5"/g) ?? []).length, 2);
    const lost = stageSvg({ ...base, job: { title: 'Grab their stash', progress: 1, needed: 2, state: 'lost' } });
    assert.match(lost, /Grab their stash: lost/);
    // It fits left of the nerve meter.
    const w = Number(/<g class="bt-job"[^>]*><rect x="6" y="5" width="(\d+)"/.exec(open)![1]);
    assert.ok(6 + w < STAGE_W - 120, `width ${w}`);
  });

  test('long names break onto two lines; a number stays with its name', () => {
    assert.deepEqual(labelLines('Gunner', 52), ['Gunner']);
    assert.deepEqual(labelLines('Glowing Hollow', 52), ['Glowing', 'Hollow']);
    assert.deepEqual(labelLines('Scrapbot Sentry', 52), ['Scrapbot', 'Sentry']);
    assert.deepEqual(labelLines('Rad-hound 2', 52), ['Rad-hound 2']);
    assert.equal(labelLines('Unpronounceable', 30)[0]!.endsWith('…'), true);
  });
});
