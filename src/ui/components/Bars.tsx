import { STRESS_HIGH, STRESS_MAX, maxHp, type Survivor } from '../../engine/index.ts';

interface MeterProps {
  label: string;
  value: number;
  max: number;
  /** Text after the label, e.g. "14 / 18". */
  reading: string;
  kind: 'hp' | 'stress' | 'practice';
  /** Draw a tick at this value (the stress danger line). */
  mark?: number;
}

export function Meter({ label, value, max, reading, kind, mark }: MeterProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  let level = '';
  if (kind === 'hp') level = pct <= 25 ? 'low' : pct <= 50 ? 'mid' : '';
  if (kind === 'stress' && mark !== undefined && value >= mark) level = 'high';
  return (
    <span className={`meter meter-${kind} ${level}`}>
      <span className="meter-text">
        <span className="meter-label">{label}</span>
        <span className="meter-reading">{reading}</span>
      </span>
      <span className="meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <span className="meter-fill" style={{ width: `${pct}%` }} />
        {mark !== undefined && <span className="meter-mark" style={{ left: `${(mark / max) * 100}%` }} />}
      </span>
    </span>
  );
}

/** HP and stress, side by side. */
export function Vitals({ survivor }: { survivor: Survivor }) {
  const hpMax = maxHp(survivor);
  return (
    <span className="vitals">
      <Meter label="HP" value={survivor.hp} max={hpMax} reading={`${survivor.hp} / ${hpMax}`} kind="hp" />
      <Meter label="Stress" value={survivor.stress} max={STRESS_MAX} reading={String(survivor.stress)} kind="stress" mark={STRESS_HIGH} />
    </span>
  );
}

/** A relationship score from -100 to +100, drawn out from the middle. */
export function BondBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.abs(score)) / 2;
  return (
    <span className="bond-track" aria-hidden="true">
      <span className={`bond-fill ${score < 0 ? 'cold' : 'warm'}`} style={score < 0 ? { right: '50%', width: `${pct}%` } : { left: '50%', width: `${pct}%` }} />
      <span className="bond-mid" />
    </span>
  );
}
