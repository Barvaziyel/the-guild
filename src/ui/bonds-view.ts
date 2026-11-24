/**
 * What getting on does, as pictures (3.6.0). A player "just sends the top 4 without considering
 * relationships", and "it's not clear what effects the relationships have" (Aviel's playtest): so
 * the Bonds tab shows what each tie does, and the crew picker shows who gets on with whoever is
 * already picked. The numbers are the game's own. Plain TypeScript, tested in Node.
 */
import {
  BONDED_CHECK_BONUS,
  BONDED_RELIEF,
  BONDED_STRESS_MULT,
  FEUD_FIGHT_CHANCE,
  PARTNER_DOWN_STRESS,
  PARTNER_RELIEF,
  PARTNER_WOUND_BONUS,
  STRESS_RIVAL_PER_BEAT,
  WOUND_BONDED_BONUS,
  arePartners,
  crewCohesion,
  crewConflicts,
  relationshipLabel,
  type GameState,
  type RelationshipLabel,
} from '../engine/index.ts';
import type { Chip, GlyphName } from './glyphs.ts';

/** A tie as a picture: two hearts for bonded, one for friends, a bolt for rivals, a flag for a feud; a ring for partners. */
export function bondGlyph(label: RelationshipLabel, partners = false): GlyphName | undefined {
  if (partners) return 'ring';
  switch (label) {
    case 'bonded':
      return 'hearts';
    case 'friend':
      return 'heart';
    case 'rival':
      return 'bolt';
    case 'feud':
      return 'war';
    case 'neutral':
      return undefined;
  }
}

/** Good ties are good for the guild; rivals and feuds aren't. */
export function bondTone(label: RelationshipLabel, partners = false): 'good' | 'bad' | undefined {
  if (partners || label === 'bonded' || label === 'friend') return 'good';
  if (label === 'rival' || label === 'feud') return 'bad';
  return undefined;
}

/** What a tie does, on a run together and at home. Neutral does nothing. */
export function bondChips(label: RelationshipLabel, partners = false): Chip[] {
  const calmer = BONDED_RELIEF + (partners ? PARTNER_RELIEF : 0);
  const wounds = WOUND_BONDED_BONUS + (partners ? PARTNER_WOUND_BONUS : 0);
  switch (label) {
    case 'bonded':
      return [
        { glyph: 'dice', text: `+${BONDED_CHECK_BONUS} rolls`, tone: 'good', label: `On a run together: plus ${BONDED_CHECK_BONUS} to every roll` },
        { glyph: 'stress', text: `−${Math.round((1 - BONDED_STRESS_MULT) * 100)}%`, tone: 'good', label: `On a run together: ${Math.round((1 - BONDED_STRESS_MULT) * 100)}% less stress` },
        { glyph: 'shield', text: `+${wounds}`, tone: 'good', label: 'On a run together: wounds are less likely to be serious' },
        { glyph: 'home', text: `−${calmer}`, tone: 'good', label: `At home together: ${calmer} less stress a day` },
        ...(partners ? [{ glyph: 'stress' as const, text: `+${PARTNER_DOWN_STRESS}`, tone: 'bad' as const, label: `Seeing the other go down: ${PARTNER_DOWN_STRESS} more stress` }] : []),
        { glyph: 'tear', text: partners ? 'hard' : 'grief', tone: 'bad', label: partners ? 'Losing the other hits hard' : 'Grieves if the other is lost' },
      ];
    case 'friend':
      return [
        { glyph: 'dice', text: 'rolls +', tone: 'good', label: 'Lifts the rolls the whole crew makes together' },
        { glyph: 'tear', text: 'grief', tone: 'bad', label: 'Grieves if the other is lost' },
      ];
    case 'neutral':
      return [];
    case 'rival':
      return [
        { glyph: 'dice', text: 'rolls −', tone: 'bad', label: 'Drags down the rolls the whole crew makes together' },
        { glyph: 'stress', text: `+${STRESS_RIVAL_PER_BEAT}`, tone: 'bad', label: `On a run together: ${STRESS_RIVAL_PER_BEAT} more stress at every stretch` },
        { glyph: 'bolt', text: 'quarrels', tone: 'bad', label: 'Quarrels on the road' },
      ];
    case 'feud':
      return [
        { glyph: 'dice', text: 'rolls −', tone: 'bad', label: 'Drags down the rolls the whole crew makes together' },
        { glyph: 'stress', text: `+${STRESS_RIVAL_PER_BEAT}`, tone: 'bad', label: `On a run together: ${STRESS_RIVAL_PER_BEAT} more stress at every stretch` },
        { glyph: 'swords', text: `${Math.round(FEUD_FIGHT_CHANCE * 100)}%`, tone: 'bad', label: `At home: a ${Math.round(FEUD_FIGHT_CHANCE * 100)}% chance a day they come to blows` },
      ];
  }
}

/** What the pictures on the Bonds tab mean, once, at the bottom. */
export const BOND_KEY: readonly { glyph: GlyphName; text: string }[] = [
  { glyph: 'dice', text: 'Rolls on a run' },
  { glyph: 'stress', text: 'Stress on a run' },
  { glyph: 'shield', text: 'Wounds on a run' },
  { glyph: 'home', text: 'Stress a day at home' },
  { glyph: 'tear', text: 'If one is lost' },
];

/**
 * In the crew picker: how this survivor gets on with each of those already picked, skipping the
 * neutral. "♥♥ Mara", "⚡ Vic".
 */
export function pairChips(state: GameState, id: string, crew: readonly string[]): Chip[] {
  const out: Chip[] = [];
  for (const other of crew) {
    if (other === id) continue;
    const label = relationshipLabel(state, id, other);
    const partners = arePartners(state, id, other);
    const glyph = bondGlyph(label, partners);
    if (!glyph) continue;
    const name = state.survivors.find((s) => s.id === other)?.firstName ?? '';
    const tone = bondTone(label, partners);
    out.push({ glyph, text: name, ...(tone ? { tone } : {}), label: `${partners ? 'Partners' : label === 'friend' ? 'Friends' : label === 'bonded' ? 'Bonded' : label === 'rival' ? 'Rivals' : 'Feuding'} with ${name}` });
  }
  return out;
}

/**
 * The picked crew as a whole: how well they get on (the bonus or penalty on the rolls they make
 * together, §7.3) and, if any of them are rivals, the stress it costs.
 */
export function crewChips(state: GameState, crew: readonly string[]): Chip[] {
  if (crew.length < 2) return [];
  const together = crewCohesion(state, crew);
  const out: Chip[] = [
    {
      glyph: 'dice',
      text: `${together > 0 ? `+${together}` : together < 0 ? `−${-together}` : '±0'} together`,
      ...(together > 0 ? { tone: 'good' as const } : together < 0 ? { tone: 'bad' as const } : {}),
      label: `How well they get on: ${together > 0 ? 'plus ' : together < 0 ? 'minus ' : ''}${Math.abs(together)} on the rolls they make together, like spotting trouble`,
    },
  ];
  const bonded = crew.some((a, i) => crew.slice(i + 1).some((b) => relationshipLabel(state, a, b) === 'bonded'));
  if (bonded) out.push({ glyph: 'hearts', text: `+${BONDED_CHECK_BONUS}`, tone: 'good', label: `Bonded pairs: plus ${BONDED_CHECK_BONUS} to every roll each makes` });
  if (crewConflicts(state, crew).length > 0) out.push({ glyph: 'stress', text: `+${STRESS_RIVAL_PER_BEAT}`, tone: 'bad', label: `Rivals: ${STRESS_RIVAL_PER_BEAT} more stress at every stretch` });
  return out;
}
