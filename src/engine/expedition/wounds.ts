/**
 * What happens to survivors who went down: wound rolls, scars, rescues, and
 * (rarely) death. See docs/DESIGN.md section 7.5.
 */
import { addChronicle } from '../chronicle.ts';
import {
  DEATH_SAVE_DC,
  REL_SAVED,
  SCAR_CHANCE,
  STRESS_ALLY_KILLED,
  STRESS_ROUTED,
  PARTNER_WOUND_BONUS,
  WOUND_BONDED_BONUS,
  WOUND_GRIT_MULT,
  WOUND_MORTAL_BELOW,
  WOUND_SERIOUS_BELOW,
} from '../constants.ts';
import { TRAITS } from '../content/index.ts';
import { findGearWithHook, itemDef } from '../gear.ts';
import { addFlag, adjustRelationship, arePartners } from '../relationships.ts';
import { addPractice, effectiveStat } from '../stats.ts';
import { fullName } from '../text.ts';
import { addTrait, hasTrait, sumTraitHook } from '../traits.ts';
import type { Slot } from '../types.ts';
import { bestBy, check, isBonded, say, simDay, standing, stress, type Member, type Sim } from './context.ts';
import { nemesisKilledSomeone } from './stories.ts';

type Tier = 'wounded' | 'serious' | 'mortal';

function tierFor(total: number): Tier {
  if (total < WOUND_MORTAL_BELOW) return 'mortal';
  if (total < WOUND_SERIOUS_BELOW) return 'serious';
  return 'wounded';
}

const TIER_RANK: Record<Tier, number> = { mortal: 0, serious: 1, wounded: 2 };

function giveScar(sim: Sim, m: Member, cause: string): void {
  const pool = TRAITS.filter((t) => t.kind === 'scar' && !hasTrait(m.s, t.id));
  if (pool.length === 0) return;
  const scar = sim.rng.pick(pool);
  addTrait(m.s, scar.id, { day: simDay(sim), source: `the work of ${cause} at ${sim.loc.name}`, force: true });
  say(sim, `${m.s.firstName} will carry it for life: ${scar.name}.`, { tone: 'bad' });
}

function applyWounded(sim: Sim, m: Member): void {
  addTrait(m.s, 'wounded', { day: simDay(sim), rng: sim.rng });
  m.s.hp = 1;
}

function applySerious(sim: Sim, m: Member, cause: string, scarChance: number): void {
  addTrait(m.s, 'badly_wounded', { day: simDay(sim), rng: sim.rng });
  m.s.hp = 1;
  addChronicle(m.s, simDay(sim), `Badly wounded by ${cause} at ${sim.loc.name}.`, ['wound']);
  if (sim.rng.chance(scarChance)) giveScar(sim, m, cause);
}

/** Find a Medkit the helpers can use: one of theirs, or the casualty's own. */
function findMedkit(helpers: readonly Member[], casualty: Member): { holder: Member; slot: Slot } | undefined {
  for (const holder of [...helpers, casualty]) {
    const item = findGearWithHook(holder.s, 'autoDeathSave');
    if (item) return { holder, slot: itemDef(item).slot };
  }
  return undefined;
}

function creditRescue(sim: Sim, rescuer: Member, saved: Member): void {
  const day = simDay(sim);
  rescuer.s.counters.alliesSaved += 1;
  addChronicle(rescuer.s, day, `Saved ${fullName(saved.s)}'s life at ${sim.loc.name}.`, ['rescue', saved.s.id]);
  addChronicle(saved.s, day, `Owes ${fullName(rescuer.s)} a life after ${sim.loc.name}.`, ['rescue', rescuer.s.id]);
  adjustRelationship(sim.state, rescuer.s.id, saved.s.id, REL_SAVED, { day, useTraitMult: false });
  addFlag(sim.state, rescuer.s.id, saved.s.id, { kind: 'owesLife', debtor: saved.s.id });
}

function kill(sim: Sim, m: Member, cause: string, enemyType: string | undefined, nemesisId?: string): void {
  const day = simDay(sim);
  m.dead = true;
  m.down = false;
  m.s.hp = 0;
  m.s.status = 'dead';
  m.s.diedDay = day;
  m.s.causeOfDeath = `Killed by ${cause} at ${sim.loc.name}`;
  addChronicle(m.s, day, `Died at ${sim.loc.name}, killed by ${cause}.`, ['death']);
  sim.deaths.push(enemyType ? { survivorId: m.s.id, name: fullName(m.s), cause, enemyType } : { survivorId: m.s.id, name: fullName(m.s), cause });
  say(sim, `${fullName(m.s)} is dead.`, { tone: 'bad' });
  if (nemesisId) nemesisKilledSomeone(sim, nemesisId, m);
  for (const other of sim.members) {
    if (other === m || other.dead) continue;
    other.s.counters.alliesLost += 1;
    addChronicle(other.s, day, `Was there when ${fullName(m.s)} died at ${sim.loc.name}.`, ['loss', m.s.id]);
    stress(sim, other, STRESS_ALLY_KILLED, `${m.s.firstName}'s death`);
  }
}

/** One survivor's wound roll, with help from whoever is still standing. */
function resolveOne(sim: Sim, m: Member, helpers: readonly Member[], opts: { spared?: boolean } = {}): void {
  const pending = m.woundPending;
  if (!pending) return;
  delete m.woundPending;
  const { cause, enemyType, nemesisId } = pending;
  const first = m.s.firstName;

  const own = effectiveStat(m.s, 'grit') * WOUND_GRIT_MULT + sumTraitHook(m.s, 'woundRollBonus') + (m.woundBonus ?? 0);
  let allyBonus = 0;
  for (const h of helpers) allyBonus += sumTraitHook(h.s, 'allyWoundBonus');
  const bonded = helpers.find((h) => isBonded(sim, h, m));
  if (bonded) allyBonus += WOUND_BONDED_BONUS;
  if (helpers.some((h) => arePartners(sim.state, h.s.id, m.s.id))) allyBonus += PARTNER_WOUND_BONUS;
  const medkit = helpers.length > 0 ? findMedkit(helpers, m) : undefined;

  const roll = sim.rng.d100();
  const alone = tierFor(roll + own);
  let tier = tierFor(roll + own + allyBonus);
  // In a rout someone always lives to drag the others home.
  if (tier === 'mortal' && opts.spared) tier = 'serious';
  // A brush with death teaches something.
  addPractice(m.s, 'grit', 2, simDay(sim));

  // Did the others make the difference?
  let rescuer: Member | undefined;
  if (TIER_RANK[tier] > TIER_RANK[alone] && helpers.length > 0) {
    rescuer = bonded ?? bestBy(helpers, (h) => sumTraitHook(h.s, 'allyWoundBonus'));
  }

  if (tier === 'wounded') {
    applyWounded(sim, m);
    say(sim, rescuer ? `${rescuer.s.firstName} gets to ${first} in time. ${first} is wounded but will mend.` : `${first} is wounded but will mend.`);
  } else if (tier === 'serious') {
    say(sim, rescuer ? `${rescuer.s.firstName} keeps ${first} alive. It is bad, but ${first} will live.` : `${first} is badly hurt.`, { tone: 'bad' });
    applySerious(sim, m, cause, SCAR_CHANCE);
  } else {
    m.s.counters.nearDeaths += 1;
    if (medkit && helpers.length > 0) {
      // A Medkit is an automatic save, and is used up.
      delete medkit.holder.s.equipment[medkit.slot];
      const medic = medkit.holder === m ? helpers[0]! : medkit.holder;
      rescuer = medic;
      say(sim, `${first} is dying. ${medic.s.firstName} tears open the Medkit and works fast. ${first} pulls through.`, { tone: 'good' });
      applySerious(sim, m, cause, SCAR_CHANCE);
      addTrait(m.s, 'survivor', { day: simDay(sim), source: `came back from a mortal wound at ${sim.loc.name}` });
    } else {
      const save = check(sim, m, 'grit', DEATH_SAVE_DC, ['deathSave']);
      if (save.success) {
        say(sim, `${first} is dying, and refuses to.`, { check: save.info, tone: 'good' });
        applySerious(sim, m, cause, SCAR_CHANCE);
        addTrait(m.s, 'survivor', { day: simDay(sim), source: `came back from a mortal wound at ${sim.loc.name}` });
      } else if (sim.mercy) {
        say(sim, `${first} should have died. Somehow ${first} is still breathing.`, { check: save.info, tone: 'bad' });
        applySerious(sim, m, cause, 1);
      } else {
        say(sim, `${first} is dying. There is nothing anyone can do.`, { check: save.info, tone: 'bad' });
        kill(sim, m, cause, enemyType, nemesisId);
        return;
      }
    }
  }

  if (rescuer && rescuer !== m) creditRescue(sim, rescuer, m);
}

/**
 * Resolve everyone who went down this beat. With nobody left standing there
 * is nobody to help: wound rolls are unassisted, everything the crew carried
 * is lost, and the rout itself leaves a mark. A crew of two or more always
 * has at least one member live to drag the others home.
 */
export function resolveWounds(sim: Sim): void {
  const pending = sim.members.filter((m) => m.woundPending);
  if (pending.length === 0) return;
  const helpers = standing(sim);

  if (helpers.length > 0) {
    for (const m of pending) resolveOne(sim, m, helpers);
  } else {
    const crewSize = sim.members.filter((m) => !m.dead).length;
    if (crewSize >= 2) say(sim, 'Nobody is left standing.', { tone: 'bad' });
    pending.forEach((m, i) => {
      const lastHope = crewSize >= 2 && i === pending.length - 1 && sim.members.every((o) => o === m || o.dead);
      resolveOne(sim, m, [], { spared: lastHope });
    });
    for (const m of sim.members) if (!m.dead) stress(sim, m, STRESS_ROUTED, `the rout at ${sim.loc.name}`);
    if (crewSize >= 2 && sim.members.some((m) => !m.dead) && !sim.gate) {
      say(sim, 'Hours later, those who can still move drag the others toward home.', { tone: 'bad' });
    }
  }

  if (standing(sim).length === 0) sim.routed = true;
  sim.turnBack = true;
}
