/**
 * Walking out (1.9.0): someone leaves the guild for good, taking what they
 * carry. So far only a feud does it, through a decision at the Depot
 * (`content/dilemmas.ts`). They're kept in `state.departed` for their story.
 */
import { rehomeAnimals } from './animals.ts';
import { addChronicle, addGuildLog } from './chronicle.ts';
import { PARTNER_LEFT_STRESS } from './constants.ts';
import { arePartners, removeFlag } from './relationships.ts';
import type { Rng } from './rng.ts';
import { changeStress } from './stats.ts';
import { fullName } from './text.ts';
import type { GameState, Survivor } from './types.ts';

/** Someone leaves the guild, with what they carry. `reason` is their last Chronicle line, without a subject. */
export function leaveGuild(state: GameState, s: Survivor, day: number, reason: string, rng: Rng): void {
  const index = state.survivors.indexOf(s);
  if (index < 0) return;
  state.survivors.splice(index, 1);
  delete s.post;
  delete s.outpost;
  s.status = 'left';
  s.leftDay = day;
  s.leftReason = reason;
  addChronicle(s, day, reason, ['left']);
  state.departed.push(s);
  addGuildLog(state, day, `${fullName(s)} left the guild${carrying(s)}.`, ['left', s.id]);

  // A partner is left behind: it's over between them.
  for (const o of state.survivors) {
    if (!arePartners(state, o.id, s.id)) continue;
    removeFlag(state, o.id, s.id, 'partners');
    changeStress(o, PARTNER_LEFT_STRESS, { rng, day, source: `${s.firstName} leaving` });
    addChronicle(o, day, `Was left behind when ${fullName(s)} walked out.`, ['left', s.id]);
  }
  rehomeAnimals(state, s, day, 'left');
}

/** ", taking a Hunting Rifle and a Scrap Vest", or nothing. */
function carrying(s: Survivor): string {
  const things = Object.values(s.equipment).filter((i) => i !== undefined);
  if (things.length === 0) return '';
  return `, taking ${things.length === 1 ? 'what' : 'all that'} ${s.pronouns === 'he' ? 'he' : 'she'} carried`;
}
