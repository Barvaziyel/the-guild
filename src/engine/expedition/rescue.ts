/**
 * The rescue beat (§10.1): getting to whoever called for help, and getting
 * them out. What it takes depends on their trouble: lifting a wall (Brawn),
 * keeping them alive (Wits and meds), a fight, or finding them at all (Wits).
 * Whether they make it home is settled with the rest of the run in `sim.ts`.
 */
import { addChronicle } from '../chronicle.ts';
import { DC, RESCUE_LOST_STRESS, RESCUE_STASH } from '../constants.ts';
import { maxHp } from '../stats.ts';
import { fill, fullName } from '../text.ts';
import type { RescueNews, RunOutcome } from '../types.ts';
import { addLoot, pickResource, resolveFight } from './beats.ts';
import { buildEncounter, describeGroup } from './combat.ts';
import { alive, bestBy, check, hurt, say, simBonus, simDay, standing, startBeat, stress, type Member, type Sim } from './context.ts';

/** Getting a crew's attention: "the crew" or the one person out there. */
function crewWord(sim: Sim): string {
  return sim.members.length === 1 ? sim.members[0]!.s.firstName : 'the crew';
}

function saved(sim: Sim, by: Member, share: number): void {
  const r = sim.rescue!;
  r.outcome = 'saved';
  r.by = by.s.id;
  r.person.hp = Math.max(1, Math.round(maxHp(r.person) * share));
  say(sim, fill(`${r.person.firstName} is out, and alive. {They} can walk, just about.`, r.person), { tone: 'good' });
  // Whatever they had put by comes home too, whether or not there's a bed for them.
  const res = pickResource(sim);
  const amount = sim.rng.int(RESCUE_STASH[0], RESCUE_STASH[1]) + sim.loc.danger;
  addLoot(sim, res, amount);
  say(sim, fill(`On the way out, {they} shows them where {they} hid {their} stash: ${amount} ${res}.`, r.person), { tone: 'good' });
}

function lostThem(sim: Sim, text: string): void {
  sim.rescue!.outcome = 'lost';
  say(sim, text, { tone: 'bad' });
  for (const m of standing(sim)) stress(sim, m, RESCUE_LOST_STRESS, `losing ${sim.rescue!.person.firstName}`);
}

/** Finding the person who called, and getting them out. */
export function rescueBeat(sim: Sim): void {
  const r = sim.rescue!;
  const p = r.person;
  const first = p.firstName;
  const crew = standing(sim);
  // Harder than an ordinary check, and harder the more dangerous the place.
  const dc = DC.normal + 1 + sim.loc.danger;
  const solo = sim.members.length === 1;

  switch (r.trouble) {
    case 'trapped': {
      startBeat(sim, 'rescue', 'Under the Rubble');
      say(sim, fill(`${first} is where the voice said: pinned under a slab of fallen wall, grey with dust. {They} can still talk.`, p));
      const lifter = bestBy(crew, (m) => simBonus(sim, m, 'brawn', ['rescue']))!;
      const lift = check(sim, lifter, 'brawn', dc, ['rescue'], { crew: true });
      if (lift.success) {
        say(sim, solo ? `${lifter.s.firstName} gets a shoulder under the slab and heaves until it moves.` : `They get their shoulders under the slab and lift. ${lifter.s.firstName} drags ${first} clear.`, { check: lift.info, tone: 'good' });
        saved(sim, lifter, 0.6);
      } else if (lift.margin > -4) {
        say(sim, `The slab slips back once and catches ${lifter.s.firstName}'s hand, but the second time it holds.`, { check: lift.info });
        hurt(sim, lifter, sim.rng.int(2, 4), `a falling slab at ${sim.loc.name}`);
        saved(sim, lifter, 0.4);
      } else {
        say(sim, 'The slab shifts the wrong way.', { check: lift.info, tone: 'bad' });
        lostThem(sim, `The rest of the wall comes down. ${first} goes quiet, and doesn't answer again.`);
      }
      return;
    }
    case 'hurt': {
      startBeat(sim, 'rescue', 'Bleeding Out');
      say(sim, fill(`${first} is behind a barricade of shelving, pale, with a wound {they} has been holding shut for a day.`, p));
      const medic = bestBy(crew, (m) => simBonus(sim, m, 'wits', ['medicine']))!;
      const care = check(sim, medic, 'wits', dc, ['medicine']);
      if (care.success) {
        say(sim, `${medic.s.firstName} cleans it, stitches it and binds it tight.`, { check: care.info, tone: 'good' });
        saved(sim, medic, 0.5);
      } else if (sim.meds > 0 && sim.rng.chance(0.6)) {
        sim.meds -= 1;
        say(sim, `${medic.s.firstName} can't close it properly. Only the meds ${solo ? 'that came along' : 'the crew brought'} keep ${first} breathing.`, { check: care.info });
        saved(sim, medic, 0.3);
      } else {
        if (sim.meds > 0) sim.meds -= 1;
        say(sim, `${medic.s.firstName} does what can be done with nothing to do it with.`, { check: care.info, tone: 'bad' });
        lostThem(sim, `It isn't enough. ${first} dies before ${solo ? medic.s.firstName : 'they'} can move ${fill('{them}', p)}.`);
      }
      return;
    }
    case 'cornered': {
      startBeat(sim, 'rescue', 'Cornered');
      const enemies = buildEncounter(sim);
      say(sim, `${first} is up on a roof with ${describeGroup(enemies)} circling below. They hear ${crewWord(sim)} coming.`);
      const wasTurning = sim.turnBack;
      resolveFight(sim, enemies, { ambushed: false, drop: false });
      const up = standing(sim);
      if (up.length === 0 || sim.routed) {
        lostThem(sim, `Nobody is left standing to reach ${first}.`);
      } else if (sim.turnBack && !wasTurning) {
        lostThem(sim, `Pulling back means leaving ${first} on that roof. ${solo ? 'There is no other way.' : 'Nobody says it out loud.'}`);
      } else if (sim.rng.chance(0.08 + 0.04 * sim.loc.danger)) {
        lostThem(sim, `By the time the last of them falls, it's too late: one of them got to ${first} first.`);
      } else {
        saved(sim, sim.rng.pick(up), 0.7);
      }
      return;
    }
    case 'lost': {
      startBeat(sim, 'rescue', 'Somewhere Out There');
      say(sim, fill(`The voice gave a landmark or two, and then it stopped. Somewhere around here, ${first} is waiting.`, p));
      const tracker = bestBy(crew, (m) => simBonus(sim, m, 'wits', ['scout']))!;
      const look = check(sim, tracker, 'wits', dc, ['scout'], { crew: true });
      if (look.success) {
        say(sim, `${tracker.s.firstName} finds a boot print, then another, then ${first} asleep under a bridge.`, { check: look.info, tone: 'good' });
        saved(sim, tracker, 0.6);
        return;
      }
      say(sim, `Nothing. ${solo ? `${tracker.s.firstName} keeps looking` : 'They spread out and keep looking'} as the light goes.`, { check: look.info, tone: 'bad' });
      for (const m of standing(sim)) stress(sim, m, 4, 'a long search');
      const again = check(sim, tracker, 'wits', dc, ['scout'], { crew: true });
      if (again.success) {
        say(sim, `A whistle in the dark. ${tracker.s.firstName} follows it to ${first}.`, { check: again.info, tone: 'good' });
        saved(sim, tracker, 0.5);
      } else {
        sim.rescue!.outcome = 'missed';
        say(sim, `Dark, and no sign of ${first}. There's nothing for it but to give up.`, { check: again.info, tone: 'bad' });
      }
      return;
    }
  }
}

/**
 * How the rescue ended once the run is over: someone saved but not brought
 * home was lost on the way. Writes the crew's Chronicle lines and returns the
 * news for the Depot.
 */
export function rescueNews(sim: Sim, outcome: RunOutcome): RescueNews | undefined {
  const r = sim.rescue;
  if (!r) return undefined;
  let result = r.outcome ?? 'missed';
  if (result === 'saved' && (outcome === 'routed' || outcome === 'lost')) {
    result = 'lost';
    if (outcome === 'routed') say(sim, `In the rout, ${r.person.firstName} was left behind.`, { tone: 'bad' });
  }
  const day = simDay(sim);
  const name = fullName(r.person);
  const place = sim.loc.name;
  if (result === 'saved') {
    const by = sim.members.find((m) => m.s.id === r.by && !m.dead);
    if (by) addChronicle(by.s, day, `Brought ${name} out of ${place} alive.`, ['rescue', r.person.id]);
  } else {
    const line = result === 'missed' ? `Searched ${place} for ${name}, and never found ${fill('{them}', r.person)}.` : `Couldn't save ${name} at ${place}.`;
    for (const m of alive(sim)) addChronicle(m.s, day, line, ['rescue']);
  }
  return { person: r.person, outcome: result, ...(result === 'saved' && r.by ? { by: r.by } : {}) };
}
