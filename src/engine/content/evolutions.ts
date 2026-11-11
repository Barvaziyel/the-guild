import type { LifeCounters } from '../types.ts';

/** Things that happened to a survivor during one run. Rules can require them. */
export interface RunTally {
  combats: number;
  fled: number;
  downed: number;
  rads: number;
  rangedKills: number;
  meleeKills: number;
  scavenges: number;
  nemesisKills: number;
}

export type NumericCounter = {
  [K in keyof LifeCounters]: LifeCounters[K] extends number ? K : never;
}[keyof LifeCounters];

/**
 * How experience turns into traits. Checked after every run ('run') or every
 * day spent at the Depot ('depotDay'). Add rules here instead of writing code.
 */
export interface EvolutionRule {
  id: string;
  /** Trait gained. Skipped if the survivor already has it. */
  gain: string;
  /** Trait the survivor must have. */
  requires?: string;
  /** Trait removed when this rule fires (usually the same as `requires`). */
  removes?: string;
  when: 'run' | 'depotDay';
  /** Lifetime counters that must be at least this high. */
  counters?: Partial<Record<NumericCounter, number>>;
  /** The run must have included this (tally > 0). */
  needs?: keyof RunTally;
  /** The run must not have included this. */
  forbids?: keyof RunTally;
  /** depotDay only: a Bonded friend must also be at the Depot. */
  needsBondedAtDepot?: boolean;
  /** Chance each time the conditions are met. */
  chance: number;
  /** Shown in the Chronicle: "Became Steady: <source>." */
  source: string;
}

export const EVOLUTIONS: readonly EvolutionRule[] = [
  {
    id: 'coward_to_steady',
    gain: 'steady',
    requires: 'cowardly',
    removes: 'cowardly',
    when: 'run',
    counters: { combats: 5 },
    needs: 'combats',
    forbids: 'fled',
    chance: 0.25,
    source: 'stood and fought when running would have been easier',
  },
  {
    id: 'veteran',
    gain: 'veteran',
    when: 'run',
    counters: { runs: 10 },
    chance: 1,
    source: 'ten runs and still breathing',
  },
  {
    id: 'rad_hardened',
    gain: 'rad_hardened',
    when: 'run',
    counters: { rads: 150 },
    needs: 'rads',
    chance: 0.5,
    source: 'soaked up enough radiation to stop noticing it',
  },
  {
    id: 'tough_as_nails',
    gain: 'tough_as_nails',
    when: 'run',
    counters: { timesDowned: 3 },
    needs: 'downed',
    chance: 0.3,
    source: 'got knocked down one more time and got back up',
  },
  {
    id: 'dead_eye',
    gain: 'dead_eye',
    when: 'run',
    counters: { rangedKills: 15 },
    needs: 'rangedKills',
    chance: 1,
    source: 'fifteen kills at range',
  },
  {
    id: 'scav',
    gain: 'scav',
    when: 'run',
    counters: { scavenges: 20 },
    needs: 'scavenges',
    chance: 1,
    source: 'learned where the good stuff hides',
  },
  {
    id: 'haunted_to_hardened',
    gain: 'hardened',
    requires: 'haunted',
    removes: 'haunted',
    when: 'depotDay',
    needsBondedAtDepot: true,
    chance: 0.05,
    source: 'a friend helped carry it',
  },
];
