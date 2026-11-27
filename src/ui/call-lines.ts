/**
 * What a crew says when it calls home for a fight (3.10.0). Dialogue, not help
 * (Aviel, 2026-11-27: "there's a difference between helper text and dialogue
 * and the storyline. Those things can keep text and keep detail, give it more
 * life"): a line for what's at stake, said in the caller's own way, and now and
 * then an aside that sounds like them. Picked from the run and the fight, so it
 * stays the same each time the card is drawn.
 */
import type { LedFight, Run, Survivor } from '../engine/index.ts';

export type CallStakes = 'grave' | 'trouble' | 'contact';

/** What's at stake, by crew or alone. */
export const STAKE_LINES: Record<CallStakes, { crew: readonly string[]; solo: readonly string[] }> = {
  grave: {
    crew: [
      'Someone isn’t coming back from this one.',
      'This is bad. Somebody dies out here if we get it wrong.',
      'We can’t take them on our own. Not all of us walk away.',
      'I’m looking at them and counting us, and it doesn’t add up.',
    ],
    solo: [
      'I’m not coming back from this one.',
      'It’s just me and too many of them. Talk me through it.',
      'If you’ve got anything, say it now.',
    ],
  },
  trouble: {
    crew: [
      'We’re in trouble.',
      'They’ve got us boxed in. We need you on this.',
      'More of them than we thought. This could go wrong fast.',
      'We’re not walking away from this clean. Not without you.',
    ],
    solo: [
      'I’m in trouble.',
      'Too many of them for one. What do I do?',
      'I can’t do this one on my own.',
    ],
  },
  contact: {
    crew: [
      'Contact ahead. Your orders?',
      'We’ve got company.',
      'Movement up ahead. How do you want it?',
    ],
    solo: [
      'Contact ahead. Your orders?',
      'Company. Just me here. How do you want it?',
    ],
  },
};

/** Asides in the caller's own voice, by a trait everyone can see. The first of theirs that has one speaks. */
export const TRAIT_ASIDES: readonly { trait: string; lines: readonly string[] }[] = [
  { trait: 'haunted', lines: ['Not again. Please, not again.', 'I keep seeing the last time.'] },
  { trait: 'jittery', lines: ['My hands won’t stop shaking.', 'Talk fast. Please.'] },
  { trait: 'paranoid', lines: ['I knew it. I said this place was wrong.', 'They knew we were coming. They must have.'] },
  { trait: 'cowardly', lines: ['I don’t like this. I really don’t like this.', 'Tell me we can still run.'] },
  { trait: 'hothead', lines: ['Say the word and we go in.', 'Let me at them.'] },
  { trait: 'brave', lines: ['We’re going in either way. Tell us how.', 'Point me at the worst of them.'] },
  { trait: 'vengeful', lines: ['I want them. All of them.'] },
  { trait: 'calm', lines: ['Steady. We’ve been in worse.', 'Easy. Breathe. Orders?'] },
  { trait: 'unshakable', lines: ['Nothing I haven’t seen.'] },
  { trait: 'cynic', lines: ['Of course. Of course it’s this.', 'Should have stayed in bed.'] },
  { trait: 'optimist', lines: ['Nothing we can’t handle. With you on the radio.', 'We’ll laugh about this later. Probably.'] },
  { trait: 'veteran', lines: ['I know how these go. Let’s do it right.'] },
  { trait: 'loyal', lines: ['Nobody gets left behind. Not today.'] },
];

/** How sure the pick is to add an aside, out of 10, when the caller has a voice for it. */
const ASIDE_IN = 6;

/** A small, steady hash: the same run and fight always give the same line. */
function hash(text: string): number {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** What the caller says, in quotes: what's at stake, and maybe an aside of their own. */
export function callSpeech(run: Run, fight: LedFight, stakes: CallStakes, caller: Survivor | undefined): string {
  const h = hash(`${run.id}:${fight.at}`);
  const pool = STAKE_LINES[stakes][run.plan.crew.length === 1 ? 'solo' : 'crew'];
  const line = pool[h % pool.length]!;
  const visible = new Set((caller?.traits ?? []).filter((t) => !t.hidden).map((t) => t.id));
  const voice = TRAIT_ASIDES.find((a) => visible.has(a.trait));
  const aside = voice && (h >>> 8) % 10 < ASIDE_IN ? voice.lines[(h >>> 12) % voice.lines.length]! : undefined;
  return aside ? `“${line} ${aside}”` : `“${line}”`;
}
