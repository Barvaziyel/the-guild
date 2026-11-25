/**
 * Fights that need thought (§7.4, 3.8.0): shots lined up a round ahead, patchers,
 * firebugs, hollows that grab, and the shove (or pin down) anyone can use on them.
 * Fights are played with a stand-in for the player, which sees each round as the
 * fight screen does and gives the orders.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createItem } from '../gear.ts';
import { Rng } from '../rng.ts';
import { T0, openGame, testPlan } from '../test-utils.ts';
import type { GameState, RoundOrders } from '../types.ts';
import type { FightAct, FightView } from './command.ts';
import { simulateRun } from './sim.ts';

type Commander = (v: FightView) => RoundOrders;

/** Everyone takes cover: nothing the crew does changes what the enemies meant. */
function hunker(v: FightView): RoundOrders {
  return { moves: Object.fromEntries(v.crew.filter((m) => m.moves.some((c) => c.move === 'cover')).map((m) => [m.id, { move: 'cover' as const }])) };
}

/**
 * Led runs at `place`, each fight under `commander`, until `want` has seen enough.
 * Returns every round's view, in order, with the acts it led to.
 */
function rounds(place: string, seed: string, commander: Commander, want: (views: FightView[]) => boolean, setup?: (s: GameState) => void): FightView[] {
  const all: FightView[] = [];
  for (let i = 0; i < 400 && !want(all); i++) {
    const state = openGame(`${seed}-${i % 7}`);
    setup?.(state);
    state.rng = new Rng(`${seed}-${i}`).getState();
    const seen: FightView[][] = [];
    const run = simulateRun(state, { ...testPlan(state, place, { job: 'scavenge', meds: 2, ammo: 30 }), lead: true }, `${seed}-${i}`, T0, {
      commander: (v) => {
        // A round no later than the last one is a new fight.
        if (seen.length === 0 || v.round <= seen.at(-1)!.at(-1)!.round) seen.push([]);
        seen.at(-1)!.push(v);
        return commander(v);
      },
    });
    // Each fight's end after its rounds, for the acts of its last round: the first end left against the same enemies.
    const ends = (run.ends ?? []).filter((e): e is FightView => e !== undefined);
    const kinds = (v: FightView): string => v.enemies.map((e) => e.kind).join();
    for (const fight of seen) {
      all.push(...fight);
      const k = ends.findIndex((e) => kinds(e) === kinds(fight[0]!));
      if (k >= 0) all.push(...ends.splice(k, 1));
    }
  }
  return all;
}

/** How many times something happened in a round played, over all the rounds seen. */
function times(views: FightView[], what: (a: FightAct) => boolean): number {
  return views.reduce((n, _v, k) => n + playedFrom(views, k).filter(what).length, 0);
}

/** The acts of the round played from `view` (the next view of the same fight has them). */
function playedFrom(views: FightView[], k: number): FightAct[] {
  const view = views[k]!;
  const next = views[k + 1];
  if (!next || next.acts.length < view.acts.length) return [];
  return next.acts.slice(view.acts.length).filter((a) => a.round === view.round);
}

const gunners = (s: GameState): void => {
  for (const p of s.survivors) p.equipment.weapon = createItem(s, 'hunting_rifle');
};

describe('fights that need thought (3.8.0)', () => {
  test('a shot lined up one round is taken the next, at the same one, for twice the damage', () => {
    const views = rounds('radio_station', 'lined', hunker, (v) => v.filter((x) => x.enemies.some((e) => e.intent?.kind === 'shot')).length >= 4);
    let checked = 0;
    views.forEach((v, k) => {
      for (const e of v.enemies) {
        if (e.intent?.kind !== 'aim' || e.state !== 'up') continue;
        const next = views[k + 1];
        if (!next || next.round !== v.round + 1 || next.over) continue;
        const now = next.enemies[e.index]!;
        if (now.state !== 'up' || now.stunned) continue;
        assert.equal(now.intent?.kind, 'shot', `${e.name} takes the shot it lined up`);
        assert.equal(now.intent?.at, e.intent.at, 'at the same one');
        const shot = playedFrom(views, k + 1).find((a) => a.by === e.index && (a.kind === 'hit' || a.kind === 'miss'));
        if (shot?.kind === 'hit') assert.ok(shot.amount! >= e.damage * 2 - 1, `twice its damage: ${shot.amount}`);
        checked++;
      }
    });
    assert.ok(checked >= 3, `checked ${checked}`);
  });

  test('a pin down spoils a lined-up shot, and the others hit what it pinned more easily', () => {
    /** Pin anything lining up a shot; the rest cover. */
    const pin = (v: FightView): RoundOrders => {
      const orders = hunker(v);
      const aimer = v.enemies.find((e) => e.state === 'up' && (e.intent?.kind === 'aim' || e.intent?.kind === 'shot'));
      const by = aimer && v.crew.find((m) => m.moves.find((c) => c.move === 'shove')?.targets.includes(aimer.index));
      if (aimer && by) orders.moves[by.id] = { move: 'shove', target: aimer.index };
      return orders;
    };
    const views = rounds('radio_station', 'pin', pin, (v) => times(v, (a) => a.kind === 'shove' && a.ok === true) >= 6, gunners);
    let spoiled = 0;
    views.forEach((v, k) => {
      const landed = playedFrom(views, k).filter((a) => a.kind === 'shove' && a.ok);
      for (const a of landed) {
        const e = v.enemies[a.at as number]!;
        // Its lined-up shot never comes: no shot at anyone from it this round, and no 'shot' next round.
        assert.ok(!playedFrom(views, k).some((x) => x.by === e.index && (x.kind === 'hit' || x.kind === 'miss')), `${e.name} loses its move`);
        const next = views[k + 1];
        if (next && next.round === v.round + 1 && !next.over) assert.notEqual(next.enemies[e.index]!.intent?.kind, 'shot');
        spoiled++;
      }
    });
    assert.ok(spoiled >= 3, `spoiled ${spoiled}`);
    // Shoves go before everyone else's moves in a round.
    for (let k = 0; k < views.length; k++) {
      const acts = playedFrom(views, k).filter((a) => typeof a.by === 'string');
      const first = acts.findIndex((a) => a.kind !== 'shove');
      if (first >= 0) assert.ok(!acts.slice(first).some((a) => a.kind === 'shove'), 'shoves come first');
    }
  });

  test('a patcher mends the worst hurt of its own', () => {
    /** Everyone hits anything but a patcher, so its own get hurt and it has work. */
    const spare = (v: FightView): RoundOrders => {
      const orders = hunker(v);
      for (const m of v.crew) {
        const hit = m.moves.find((c) => c.move === 'attack');
        const target = hit && v.enemies.find((e) => e.state === 'up' && !e.mends && hit.targets.includes(e.index));
        if (target) orders.moves[m.id] = { move: 'attack', target: target.index };
      }
      return orders;
    };
    const views = rounds('radio_station', 'mend', spare, (v) => times(v, (a) => a.kind === 'mend') >= 3);
    let mended = 0;
    views.forEach((v, k) => {
      for (const e of v.enemies) {
        if (e.intent?.kind !== 'mend' || e.state !== 'up') continue;
        assert.equal(e.mends, 6, 'it says how much');
        const ally = v.enemies[e.intent.ally!]!;
        assert.ok(ally.hp <= ally.maxHp * 0.75, 'one hurt to 3/4 or less');
        const act = playedFrom(views, k).find((a) => a.by === e.index && a.kind === 'mend');
        if (act) {
          assert.equal(act.at, ally.index);
          mended++;
        }
      }
    });
    assert.ok(mended >= 2, `mended ${mended}`);
  });

  test('a firebomb burns everyone in the rank it was thrown at; cover halves it; the back is safe', () => {
    /** Everyone stands in front, the first sent back and the second in cover. */
    const spread = (v: FightView): RoundOrders => {
      const crew = v.crew.filter((m) => m.moves.length > 0);
      const orders: RoundOrders = { moves: {}, ranks: {} };
      crew.forEach((m, i) => {
        orders.ranks![m.id] = i === 0 ? 'back' : 'front';
        if (i === 1) orders.moves[m.id] = { move: 'cover' };
      });
      return orders;
    };
    const views = rounds('radio_station', 'bomb', spread, (v) => times(v, (a) => a.kind === 'burn') >= 4);
    let burned = 0;
    views.forEach((v, k) => {
      const bug = v.enemies.find((e) => e.state === 'up' && e.intent?.kind === 'throw' && e.intent.rank === 'front');
      if (!bug) return;
      const acts = playedFrom(views, k);
      if (!acts.some((a) => a.by === bug.index && a.kind === 'throw')) return;
      const crew = v.crew.filter((m) => m.moves.length > 0);
      const back = crew[0];
      for (const a of acts.filter((x) => x.by === bug.index && x.kind === 'burn')) {
        assert.notEqual(a.at, back?.id, 'the one sent back is out of it');
        if (a.at === crew[1]?.id) assert.ok(a.amount! <= Math.max(1, Math.floor(bug.burn! / 2)), 'cover halves it');
        burned++;
      }
    });
    assert.ok(burned >= 2, `burned ${burned}`);
  });

  test('a firebug pinned down drops its firebomb at its own feet', () => {
    const pinBugs = (v: FightView): RoundOrders => {
      const orders = hunker(v);
      for (const m of v.crew) {
        const bug = v.enemies.find((e) => e.state === 'up' && e.intent?.kind === 'throw' && m.moves.find((c) => c.move === 'shove')?.targets.includes(e.index));
        if (bug) orders.moves[m.id] = { move: 'shove', target: bug.index };
      }
      return orders;
    };
    const views = rounds('radio_station', 'drop', pinBugs, (v) => times(v, (a) => a.kind === 'burn' && typeof a.at === 'number') >= 2, gunners);
    let dropped = 0;
    views.forEach((v, k) => {
      for (const a of playedFrom(views, k).filter((x) => x.kind === 'shove' && x.ok)) {
        const e = v.enemies[a.at as number]!;
        if (e.intent?.kind !== 'throw') continue;
        const acts = playedFrom(views, k);
        assert.ok(acts.some((x) => x.kind === 'burn' && x.at === e.index), 'it burns itself');
        assert.ok(!acts.some((x) => x.kind === 'throw' && x.by === e.index), 'and throws nothing');
        dropped++;
      }
    });
    assert.ok(dropped >= 1);
  });

  test('a hollow that grabs holds on: the one held can only break free; a shove gets them out, a plain hit doesn’t', () => {
    const views = rounds('old_metro', 'grab', (v) => {
      // The held try to get free; the rest hit whatever holds someone, and in even rounds the first of them shoves it.
      const orders = hunker(v);
      const holder = v.enemies.find((e) => e.state === 'up' && e.holding);
      let shoved = v.round % 2 === 1;
      for (const m of v.crew) {
        if (m.moves.some((c) => c.move === 'break_free')) {
          orders.moves[m.id] = { move: 'break_free' };
          continue;
        }
        const reach = (id: string): boolean => holder !== undefined && m.moves.find((c) => c.move === id)?.targets.includes(holder.index) === true;
        if (!shoved && reach('shove')) {
          orders.moves[m.id] = { move: 'shove', target: holder!.index };
          shoved = true;
        } else if (reach('attack')) orders.moves[m.id] = { move: 'attack', target: holder!.index };
      }
      return orders;
    }, (v) => v.filter((x) => x.crew.some((m) => m.heldBy !== undefined)).length >= 6);
    let held = 0;
    for (const v of views) {
      for (const m of v.crew) {
        if (m.heldBy === undefined || v.over) continue;
        assert.deepEqual(m.moves.map((c) => c.move), ['break_free']);
        const holder = v.enemies[m.heldBy]!;
        assert.equal(holder.holding, m.id);
        assert.equal(holder.intent?.kind, 'hold');
        held++;
      }
    }
    assert.ok(held >= 3);
    // Shoved, it lets go; a plain hit that leaves it standing, it doesn't.
    let freed = 0;
    let kept = 0;
    views.forEach((v, k) => {
      for (const e of v.enemies.filter((x) => x.holding && x.state === 'up')) {
        const acts = playedFrom(views, k);
        const shove = acts.find((a) => a.kind === 'shove' && a.ok && a.at === e.index);
        const free = acts.some((a) => a.kind === 'free' && a.ok && a.by === e.holding);
        if (shove) {
          assert.ok(free, 'a shove gets them out');
          freed++;
        } else if (!free && acts.some((a) => a.at === e.index && a.kind === 'hit' && !a.stun)) {
          const next = views[k + 1];
          if (next && next.round === v.round + 1 && next.enemies[e.index]!.state === 'up') assert.equal(next.enemies[e.index]!.holding, e.holding, 'a plain hit doesn’t');
          kept++;
        }
      }
    });
    assert.ok(freed >= 1 && kept >= 1, `freed ${freed}, kept ${kept}`);
  });

  test('caught off guard, they show nothing the first round, since they do nothing', () => {
    const views = rounds('maple_street', 'caught', hunker, (v) => v.filter((x) => x.caught).length >= 2);
    const caught = views.filter((v) => v.caught);
    assert.ok(caught.length >= 2);
    for (const v of caught) {
      assert.equal(v.round, 1);
      assert.ok(v.enemies.every((e) => e.intent === undefined));
    }
  });

  test('reading the fight pays: a commander who answers what they do keeps more people up than one who piles on', () => {
    type Choice = FightView['crew'][number]['moves'][number];
    const has = (m: FightView['crew'][number], id: string): Choice | undefined => m.moves.find((c) => c.move === id);
    /** Everyone hits the same one, the weakest most of them can reach; finish what's down, patch who's down. */
    const pileOn = (v: FightView): RoundOrders => {
      const up = v.enemies.filter((e) => e.state === 'up');
      const reach = (i: number): number => v.crew.filter((m) => has(m, 'attack')?.targets.includes(i)).length;
      const pick = [...up].sort((a, b) => reach(b.index) - reach(a.index) || a.hp - b.hp)[0];
      const down = v.crew.find((o) => o.state === 'down');
      const moves: RoundOrders['moves'] = {};
      for (const m of v.crew) {
        const finish = has(m, 'finish');
        const attack = has(m, 'attack');
        if (finish) moves[m.id] = { move: 'finish', target: finish.targets[0]! };
        else if (down && has(m, 'patch')?.targets.includes(down.id)) moves[m.id] = { move: 'patch', target: down.id };
        else if (attack && pick && attack.targets.includes(pick.index)) moves[m.id] = { move: 'attack', target: pick.index };
        else if (attack) moves[m.id] = { move: 'attack', target: attack.targets[0]! };
      }
      return { moves };
    };
    /** The same, but first: shove or pin what's winding something up or holds a friend, and duck what would drop someone. */
    const reads = (v: FightView): RoundOrders => {
      const orders = pileOn(v);
      const up = v.enemies.filter((e) => e.state === 'up' && !e.stunned && e.intent);
      const used = new Set<string>();
      for (const m of v.crew) if (has(m, 'break_free')) orders.moves[m.id] = { move: 'break_free' };
      for (const e of up.filter((x) => ['hold', 'throw', 'shot', 'heavy', 'mend', 'grab'].includes(x.intent!.kind))) {
        const by = v.crew.filter((m) => !used.has(m.id) && has(m, 'shove')?.targets.includes(e.index)).sort((a, b) => a.hp - b.hp)[0];
        if (!by) continue;
        orders.moves[by.id] = { move: 'shove', target: e.index };
        used.add(by.id);
      }
      for (const m of v.crew) {
        if (used.has(m.id) || !has(m, 'attack')) continue;
        const coming = up.filter((e) => e.intent!.at === m.id && e.intent!.kind !== 'aim').reduce((n, e) => n + e.damage * (e.intent!.kind === 'heavy' || e.intent!.kind === 'shot' ? 2 : 1), 0);
        if (coming >= m.hp && has(m, 'cover')) orders.moves[m.id] = { move: 'cover' };
      }
      return orders;
    };
    const tally = { pile: 0, read: 0 };
    let fights = 0;
    for (const place of ['radio_station', 'old_metro', 'st_judes', 'red_hand_camp']) {
      for (let i = 0; i < 200; i++) {
        const state = openGame(`pays-${i % 9}`);
        state.rng = new Rng(`pays-${place}-${i}`).getState();
        const plan = { ...testPlan(state, place, { job: 'scavenge', meds: 2, ammo: 12 }), lead: true };
        for (const [who, commander] of [['pile', pileOn], ['read', reads]] as const) {
          const run = simulateRun(state, plan, `pays-${place}-${i}`, T0, { commander });
          for (const end of run.ends ?? []) {
            if (!end) continue;
            if (who === 'pile') fights++;
            tally[who] += end.crew.filter((m) => m.state === 'down' || m.state === 'dead').length;
          }
        }
      }
    }
    // Measured with a fuller reader (3.8.0): about a fifth fewer down at the end of a fight.
    assert.ok(fights > 400, `${fights} fights`);
    assert.ok(tally.read < tally.pile * 0.9, `down at the end: ${tally.read} reading the fight, ${tally.pile} piling on`);
  });
});
