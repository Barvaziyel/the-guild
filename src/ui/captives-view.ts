/**
 * Captives on screen (§9.8): the panel on the Roster for people a raid left
 * behind, held at the Depot, and what can be done with each.
 */
import { CAPTIVE_JOIN_CHANCE, captiveProblem, questionChance, questioner, type GameState, type Survivor } from '../engine/index.ts';

export interface CaptiveRow {
  id: string;
  name: string;
  person: Survivor;
  /** "Left behind by raiders on day 12." */
  from: string;
  /** "Question him: Gray leans on him, about 40% he talks." */
  question: string;
  questionProblem?: string;
  /** "Ask him to join: about 25% he says yes." */
  recruit: string;
  recruitProblem?: string;
}

/** The people held at the Depot, newest first. */
export function captiveRows(state: GameState): CaptiveRow[] {
  return [...state.captives].reverse().map((c) => {
    const p = c.person;
    const him = p.pronouns === 'she' ? 'her' : 'him';
    const he = p.pronouns === 'she' ? 'she' : 'he';
    const who = questioner(state);
    const questionProblem = captiveProblem(state, p.id, 'question');
    const recruitProblem = captiveProblem(state, p.id, 'recruit');
    return {
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      person: p,
      from: `Left behind by ${c.from === 'vultures' ? 'the Vultures' : 'raiders'} on day ${c.since}.`,
      question: who ? `Question ${him}: ${who.firstName} leans on ${him}, about ${Math.round(questionChance(state) * 100)}% ${he} tells of a cache.` : `Question ${him}.`,
      ...(questionProblem ? { questionProblem } : {}),
      recruit: `Ask ${him} to join: about ${Math.round(CAPTIVE_JOIN_CHANCE * 100)}% ${he} says yes.`,
      ...(recruitProblem ? { recruitProblem } : {}),
    };
  });
}

/** The panel's one-line help. */
export const CAPTIVES_HELP = 'Held at the Depot. They eat a little, might slip out one night, and their own may come back for them.';
