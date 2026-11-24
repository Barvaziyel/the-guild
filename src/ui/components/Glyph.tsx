import { GLYPHS, type Chip, type GlyphName } from '../glyphs.ts';

const SUPPLIES = new Set<GlyphName>(['scrap', 'rations', 'meds', 'ammo', 'tech', 'gas']);

/** A small line picture (3.6.0), in the text's color. */
export function Glyph({ name, className }: { name: GlyphName; className?: string }) {
  return (
    <svg className={`glyph${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d={GLYPHS[name]} />
    </svg>
  );
}

/** What something does, as pictures with a word or a number each, instead of a sentence. */
export function Chips({ chips, className }: { chips: readonly Chip[]; className?: string }) {
  if (chips.length === 0) return null;
  return (
    <span className={`tags${className ? ` ${className}` : ''}`}>
      {chips.map((c, i) => (
        // A tap says what it means (3.7.1): `data-tip` is read by `TagTips` in App.
        <span key={i} className={`tag${c.tone ? ` is-${c.tone}` : ''}${c.label ? ' has-tip' : ''}`} aria-label={c.label ?? c.text} {...(c.label ? { 'data-tip': c.label } : {})}>
          <Glyph name={c.glyph} className={SUPPLIES.has(c.glyph) ? `res-${c.glyph}` : undefined} />
          <span aria-hidden={c.label ? 'true' : undefined}>{c.text}</span>
        </span>
      ))}
    </span>
  );
}
