import { letRaidFight, openRaid, stepRaid } from './depot/raids.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  SAVE_VERSION,
  VULTURES_ARRIVE_DAY,
  VULTURES_LATE_ARRIVAL,
  VULTURES_LIEUTENANTS,
  VULTURES_RETURN_STRENGTH,
  VULTURES_TURF_FINDS,
  VULTURES_WAR,
} from './constants.ts';
import { getLocation } from './content/index.ts';
import { buildOutpost } from './outposts.ts';
import { createItem } from './gear.ts';
import { maxHp } from './stats.ts';
import { acceptOffer, makeOffer, rollDepotEvents } from './depot/events.ts';
import { refreshRecruits } from './depot/recruits.ts';
import { advanceTime, dayStart } from './depot/time.ts';
import { completeRun, startRun } from './expedition/runs.ts';
import { simulateRun } from './expedition/sim.ts';
import { validatePlan } from './expedition/plan.ts';
import { locationState } from './locations.ts';
import { startCall, playRescueDay } from './rescue.ts';
import { Rng } from './rng.ts';
import { deserialize } from './save.ts';
import { T0, openGame, testPlan } from './test-utils.ts';
import type { GameState, RunPlan } from './types.ts';
import { RESOURCE_IDS } from './types.ts';
import {
  applyVultureNews,
  bandOf,
  campAt,
  campsFor,
  changeStanding,
  decidePrisoner,
  freeLieutenants,
  neighbours,
  onTurf,
  playVulturesDay,
  prisoners,
  tradeCut,
  turf,
  vultureBand,
  vultureBoss,
} from './vultures.ts';

/** A guild the Vultures have just come to. */
function arrived(seed: string): GameState {
  const state = openGame(seed);
  state.vultures.arriveDay = 1;
  playVulturesDay(state, 1, new Rng(`arrive-${seed}`));
  return state;
}

const home = (state: GameState): string => state.vultures.camps.find((c) => c.home)!.locationId;

describe('the Vultures arrive', () => {
  test('on day 40, at a danger-3 or 4 place, with a boss and three lieutenants, and the guild hears of it', () => {
    const state = openGame('arrive');
    advanceTime(state, dayStart(state, VULTURES_ARRIVE_DAY - 1) + 1);
    assert.equal(state.vultures.arrived, false);
    advanceTime(state, dayStart(state, VULTURES_ARRIVE_DAY) + 1);
    const v = state.vultures;
    assert.ok(v.arrived);
    assert.equal(v.camps.length, 1);
    const place = getLocation(home(state));
    assert.ok(place.danger >= 3 && place.danger <= 4, place.id);
    assert.ok(locationState(state, place.id).discovered, 'their camp is on the map');
    assert.equal(vultureBoss(state)!.campId, place.id);
    assert.equal(freeLieutenants(state).length, VULTURES_LIEUTENANTS);
    assert.ok(state.log.some((l) => l.text.startsWith('Word on the radio: a crew calling themselves the Vultures has set up at')));
    // Their envoy comes to the gate the next day (or as soon as nothing else is waiting).
    advanceTime(state, dayStart(state, VULTURES_ARRIVE_DAY + 20) + 1);
    assert.ok(state.dilemmas.seen.vulture_first_contact, 'their first envoy came');
  });

  test('an older save gets them a real day after updating', () => {
    const old = JSON.parse(JSON.stringify(openGame('old'))) as Record<string, unknown> & { depot: { lastDay: number } };
    old.version = 17;
    old.depot.lastDay = 90;
    delete old.vultures;
    const loaded = deserialize(JSON.stringify(old));
    assert.equal(loaded.version, SAVE_VERSION);
    assert.equal(loaded.vultures.arriveDay, 90 + VULTURES_LATE_ARRIVAL);
    assert.equal(loaded.vultures.arrived, false);
  });
});

describe('standing and strength', () => {
  test('bands, and a change of band goes in the news', () => {
    assert.deepEqual([-100, -40, -39, 9, 10, 39, 40, 100].map(bandOf), ['war', 'war', 'wary', 'wary', 'truce', 'truce', 'trade', 'trade']);
    const state = arrived('bands');
    changeStanding(state, 25, 2);
    assert.equal(vultureBand(state), 'truce');
    assert.equal(state.log.at(-1)!.text, 'The guild and the Vultures have a truce now.');
    changeStanding(state, -500, 3);
    assert.equal(state.vultures.standing, -100);
    assert.equal(state.log.at(-1)!.text, 'The Vultures are at war with the guild now.');
  });

  test('they grow, set up camps next to theirs while their strength allows, and give them up when weak', () => {
    const state = arrived('camps');
    state.vultures.strength = 80;
    assert.equal(campsFor(80), 3);
    for (let day = 2; day < 120; day++) playVulturesDay(state, day, new Rng(`c${day}`));
    const camps = state.vultures.camps;
    assert.ok(camps.length >= 2 && camps.length <= 3, `${camps.length} camps`);
    for (const c of camps.filter((x) => !x.home)) assert.ok(camps.some((o) => o !== c && neighbours(o.locationId).includes(c.locationId)), `${c.locationId} is next to another camp`);
    for (const c of camps) assert.ok(turf(state).includes(c.locationId));
    for (const id of turf(state)) assert.ok(getLocation(id).danger >= 2, `${id}: the safe places near the Depot stay the guild's`);
    state.vultures.strength = 10;
    playVulturesDay(state, 121, new Rng('weak'));
    assert.equal(state.vultures.camps.length, camps.length - 1, 'a camp is given up');
  });

  test('a lost boss is replaced at once, a lost lieutenant a while later', () => {
    const state = arrived('promote');
    vultureBoss(state)!.status = 'dead';
    playVulturesDay(state, 2, new Rng('p'));
    assert.ok(vultureBoss(state), 'a new boss');
    assert.equal(freeLieutenants(state).length, VULTURES_LIEUTENANTS - 1);
    let day = 3;
    for (; day < 40 && freeLieutenants(state).length < VULTURES_LIEUTENANTS; day++) playVulturesDay(state, day, new Rng(`p${day}`));
    assert.equal(freeLieutenants(state).length, VULTURES_LIEUTENANTS);
    assert.ok(day > 15, 'not at once');
  });

  test('driven out of their last camp, they leave the Reach, and come back later under a new boss', () => {
    const state = arrived('gone');
    const first = vultureBoss(state)!;
    applyVultureNews(state, { standing: 0, strength: 0, met: [], killed: [first.person.id], captured: [], history: [], campTaken: home(state) }, 5, new Rng('take'));
    assert.equal(state.vultures.camps.length, 0);
    assert.ok(state.vultures.returnDay! >= 25);
    assert.deepEqual(turf(state), []);
    for (let day = 6; day <= state.vultures.returnDay!; day++) playVulturesDay(state, day, new Rng(`g${day}`));
    assert.equal(state.vultures.camps.length, 1);
    assert.equal(state.vultures.strength, VULTURES_RETURN_STRENGTH);
    assert.notEqual(vultureBoss(state)!.person.id, first.person.id);
  });
});

describe('what they compete for', () => {
  test('places: finds in their turf are thinner, and crews meet them', () => {
    const loot = (vultures: boolean): number => {
      let total = 0;
      for (let i = 0; i < 200; i++) {
        const state = vultures ? arrived(`thin-${i % 4}`) : openGame(`thin-${i % 4}`);
        const place = vultures ? home(state) : 'water_plant';
        const { result } = simulateRun(state, testPlan(state, place, { approach: 'sneaky' }), `t${i}`, 0);
        total += RESOURCE_IDS.reduce((n, r) => n + result.loot[r], 0);
      }
      return total;
    };
    const state = arrived('meet');
    assert.ok(onTurf(state, home(state)));
    let met = 0;
    for (let i = 0; i < 200; i++) {
      const { beats } = simulateRun(state, testPlan(state, home(state)), `m${i}`, 0);
      if (beats.some((b) => b.kind === 'vultures')) met++;
    }
    assert.ok(met > 30 && met < 170, `met them on ${met} of 200 runs at their camp`);
    assert.equal(VULTURES_TURF_FINDS, 0.8);
    assert.ok(loot(true) < loot(false), 'thinner finds');
  });

  test('meetings follow the standing: a nod at truce, a fight at war, and the news comes home', () => {
    const tally = (standing: number, orders: Partial<RunPlan> = {}): { fights: number; standing: number; home: number } => {
      let fights = 0;
      let moved = 0;
      let turned = 0;
      for (let i = 0; i < 150; i++) {
        const state = arrived(`band-${i % 3}`);
        state.vultures.standing = standing;
        const { result, beats } = simulateRun(state, testPlan(state, home(state), orders), `b${i}`, 0);
        const beat = beats.find((b) => b.kind === 'vultures');
        if (!beat) continue;
        if (beats.some((b) => b.lines.some((l) => /Vulture/.test(l.text) && /(shot|cut|struck) by/.test(l.text)))) fights++;
        if (beats.some((b) => b.lines.some((l) => /heads for home/.test(l.text)))) turned++;
        moved += result.vultures?.standing ?? 0;
      }
      return { fights, standing: moved, home: turned };
    };
    const truce = tally(20);
    assert.equal(truce.fights, 0, 'no fights at truce');
    assert.ok(truce.standing > 0, 'nods warm them');
    // At war, unasked, an aggressive crew hits them first and a careful one turns for home (§7.12).
    const war = tally(-60, { approach: 'aggressive' });
    assert.ok(war.fights > 10, `${war.fights} fights at war`);
    assert.ok(war.standing < 0);
    const careful = tally(-60, { approach: 'balanced', retreat: 'wounded' });
    assert.equal(careful.fights, 0);
    assert.ok(careful.home > 10, `${careful.home} turned for home`);
  });

  test('hitting a camp: only where there is one; won, the camp falls and it means war', () => {
    const state = arrived('assault');
    const elsewhere = 'rail_yard';
    assert.ok(validatePlan(state, testPlan(state, elsewhere, { job: 'assault' })).includes('The Vultures have no camp here.'));
    let taken = 0;
    for (let i = 0; i < 40 && taken === 0; i++) {
      const s = arrived(`assault-${i}`);
      // A seasoned crew with good gear, against a camp at a danger-3 place.
      for (const p of s.survivors) {
        for (const k of ['grit', 'brawn', 'aim', 'wits', 'nerve'] as const) p.stats[k] = 7;
        p.hp = maxHp(p);
        p.equipment.weapon = createItem(s, 'hunting_rifle', 'solid');
        p.equipment.armor = createItem(s, 'scrap_vest', 'solid');
      }
      s.vultures.standing = 20;
      const place = 'water_plant';
      s.vultures.camps[0]!.locationId = place;
      vultureBoss(s)!.campId = place;
      const run = startRun(s, testPlan(s, place, { job: 'assault', retreat: 'never' }, 4), T0);
      assert.ok(run.beats.some((b) => b.title === 'Their camp'), 'the attack happens');
      completeRun(s, run.id, run.returnAt);
      if (!campAt(s, place) && s.vultures.camps.length === 0) {
        taken++;
        assert.ok(s.vultures.standing <= VULTURES_WAR, 'war');
        assert.ok(s.log.some((l) => /left the Reach|took the Vultures' camp/.test(l.text)));
      }
    }
    assert.ok(taken > 0, 'a strong crew takes the camp');
  });

  test('people: someone left waiting at the gate, or an unanswered call, may go to the Vultures', () => {
    let gone = 0;
    for (let i = 0; i < 40; i++) {
      const state = arrived(`gate-${i}`);
      state.depot.recruits = [{ survivor: structuredClone(state.survivors[0]!), expiresDay: 5 }];
      refreshRecruits(state, 5, new Rng(`r${i}`));
      if (state.log.some((l) => l.text.endsWith('got tired of waiting at the gate, and went to the Vultures.'))) gone++;
    }
    assert.ok(gone > 8 && gone < 32, `${gone} of 40`);
    let calls = 0;
    for (let i = 0; i < 40; i++) {
      const state = arrived(`call-${i}`);
      state.buildings.radio_tower = 1;
      const call = startCall(state, 3, new Rng(`c${i}`))!;
      playRescueDay(state, call.expiresDay, new Rng(`e${i}`));
      if (state.log.some((l) => l.text.includes('The Vultures got to'))) calls++;
    }
    assert.ok(calls > 8 && calls < 32, `${calls} of 40`);
  });

  test('traders: caravans pay less while they are strong; their own traders come to partners, and trading warms them', () => {
    const state = arrived('trade');
    state.vultures.strength = 80;
    assert.equal(tradeCut(state), 0.8);
    state.vultures.standing = 50;
    assert.equal(tradeCut(state), 1, 'no cut for partners');
    const offer = makeOffer(state, 3, new Rng('v'), { vultures: true });
    assert.ok(offer.vultures);
    state.depot.offers.push(offer);
    for (const r of RESOURCE_IDS) state.resources[r] = 500;
    acceptOffer(state, offer.id, 3);
    assert.equal(state.vultures.standing, 53);
    let theirs = 0;
    for (let i = 0; i < 400; i++) if (rollDepotEvents(state, 4, new Rng(`d${i}`)).includes('vultureTrader' as never)) theirs++;
    assert.ok(theirs > 0, 'their traders come');
  });

  test('raids: at war on the Depot and on outposts in their turf; never at truce', () => {
    const count = (standing: number): number => {
      const state = arrived('raids');
      state.vultures.standing = standing;
      let n = 0;
      for (let i = 0; i < 600; i++) {
        // One raid at a time (§9.8): each roll starts with none on the way.
        delete state.depot.raid;
        if (rollDepotEvents(state, 4, new Rng(`r${i}`)).includes('vultureRaid' as never)) n++;
      }
      return n;
    };
    assert.equal(count(20), 0);
    const war = count(-60);
    const wary = count(-10);
    assert.ok(war > wary * 2 && wary > 0, `war ${war}, wary ${wary}`);
    const state = arrived('outpost');
    state.vultures.standing = -60;
    const place = neighbours(home(state)).find((id) => !campAt(state, id))!;
    state.locations[place] = { discovered: true, explored: 100, runs: 1 };
    state.buildings.radio_tower = 1;
    state.resources.scrap = state.resources.tech = 100;
    buildOutpost(state, place, 2);
    for (let day = 3; day < 400 && state.outposts.length > 0; day++) {
      playVulturesDay(state, day, new Rng(`o${day}`));
      // Fought like the gate (§9.8), on their own.
      const raid = openRaid(state);
      if (raid) {
        assert.equal(raid.outpost, place);
        stepRaid(state, raid.arrive);
        if (openRaid(state)) letRaidFight(state, raid.arrive + 1000);
      }
    }
    assert.ok(state.log.some((l) => /^The Vultures(, led by [^,]+,)? (came for|broke into|burned) the outpost/.test(l.text)));
  });
});

describe('prisoners', () => {
  test('captured on a run, held at the Depot: let go, traded back, or asked to join', () => {
    const state = arrived('prisoners');
    const [a, b, c] = freeLieutenants(state);
    applyVultureNews(state, { standing: 0, strength: 0, met: [a!.person.id], killed: [], captured: [a!.person.id, b!.person.id, c!.person.id], history: [] }, 4, new Rng('cap'));
    assert.equal(prisoners(state).length, 3);
    const before = state.vultures.standing;
    assert.match(decidePrisoner(state, a!.person.id, 'release', dayStart(state, 5)), /was let go/);
    assert.equal(state.vultures.standing, before + 10);
    const scrap = state.resources.scrap;
    decidePrisoner(state, b!.person.id, 'ransom', dayStart(state, 5));
    assert.equal(state.resources.scrap, scrap + 20);
    assert.equal(b!.status, 'free');
    state.buildings.bunks = 3;
    decidePrisoner(state, c!.person.id, 'recruit', dayStart(state, 5));
    assert.ok(c!.status === 'joined' ? state.survivors.includes(c!.person) : c!.status === 'captured');
    assert.throws(() => decidePrisoner(state, a!.person.id, 'release', dayStart(state, 6)), /not the guild's prisoner/);
  });

  test('prisoners eat a ration a day, and now and then slip out', () => {
    const state = arrived('escape');
    const m = freeLieutenants(state)[0]!;
    m.status = 'captured';
    const rations = state.resources.rations;
    playVulturesDay(state, 2, new Rng('eat'));
    assert.equal(state.resources.rations, rations - 1);
    let day = 3;
    for (; day < 1000 && m.status === 'captured'; day++) playVulturesDay(state, day, new Rng(`e${day}`));
    assert.equal(m.status, 'free');
    assert.ok(state.log.some((l) => l.text.includes('slipped out of the Depot')));
  });
});
