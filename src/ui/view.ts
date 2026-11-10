/**
 * Turns engine state into what the screens show: labels, groupings and the
 * small sentences around them. No React here, so it can be tested in Node.
 */
import {
  RESOURCE_IDS,
  STAT_IDS,
  STAT_MAX,
  STRESS_HIGH,
  armorValue,
  carryCapacity,
  effectiveStat,
  getEnemyTypeName,
  getOrigin,
  getTrait,
  itemDef,
  itemName,
  labelName,
  maxHp,
  practiceNeeded,
  pronounForms,
  qualityMod,
  relationshipsOf,
  statName,
  stressGainMultiplier,
  visibleTraits,
  weaponDamage,
  type GameState,
  type ItemInstance,
  type RelationshipFlag,
  type RelationshipLabel,
  type ResourceId,
  type Slot,
  type StatId,
  type Survivor,
  type TraitInstance,
  type TraitKind,
} from '../engine/index.ts';

export const capitalize = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

// ---------------------------------------------------------------- status

export type StatusTone = 'ready' | 'away' | 'hurt' | 'strained' | 'dead';

export interface StatusView {
  label: string;
  tone: StatusTone;
}

/** The one line that says whether a survivor can go out. Pass today's day to date healing wounds. */
export function survivorStatus(s: Survivor, day?: number): StatusView {
  if (s.status === 'dead') return { label: s.diedDay ? `Died on day ${s.diedDay}` : 'Dead', tone: 'dead' };
  if (s.status === 'left') return { label: 'Left the guild', tone: 'dead' };
  if (s.status === 'away') return { label: 'Out on a run', tone: 'away' };
  const blocking = s.traits.find((t) => getTrait(t.id).blocksRuns);
  if (blocking) {
    const name = capitalize(getTrait(blocking.id).name.toLowerCase());
    const heals = blocking.expiresDay !== undefined && (day === undefined || blocking.expiresDay > day);
    return { label: heals ? `${name}, heals on day ${blocking.expiresDay}` : name, tone: 'hurt' };
  }
  if (s.stress >= STRESS_HIGH) return { label: 'Close to breaking', tone: 'strained' };
  return { label: 'Ready', tone: 'ready' };
}

// ---------------------------------------------------------------- identity

/** "Caravan Kid, 27" */
export function originLine(s: Survivor): string {
  return `${getOrigin(s.origin).name}, ${s.age}`;
}

const PRONOUN_LABEL = { he: 'he/him', she: 'she/her', they: 'they/them' } as const;
export function pronounLabel(s: Survivor): string {
  return PRONOUN_LABEL[s.pronouns];
}

/** Days from joining to death (or to `day` for the living), counting both ends. */
export function daysSurvived(s: Survivor, day: number): number {
  return Math.max(1, (s.diedDay ?? day) - s.joinedDay + 1);
}

// ---------------------------------------------------------------- stats

export interface StatRow {
  id: StatId;
  name: string;
  /** What checks use: base plus traits and gear. */
  value: number;
  base: number;
  /** value - base */
  mod: number;
  practice: number;
  /** Practice for the next point of the base stat; 0 when maxed. */
  needed: number;
  maxed: boolean;
}

export function statRows(s: Survivor): StatRow[] {
  return STAT_IDS.map((id) => {
    const base = s.stats[id];
    const value = effectiveStat(s, id);
    const maxed = base >= STAT_MAX;
    return {
      id,
      name: statName(id),
      value,
      base,
      mod: value - base,
      practice: maxed ? 0 : s.practice[id],
      needed: maxed ? 0 : practiceNeeded(base),
      maxed,
    };
  });
}

export interface DerivedView {
  maxHp: number;
  carry: number;
  /** Percent of incoming stress shrugged off (Nerve and traits). Negative means extra stress. */
  stressResist: number;
}

export function derived(s: Survivor): DerivedView {
  return {
    maxHp: maxHp(s),
    carry: carryCapacity(s),
    stressResist: Math.round((1 - stressGainMultiplier(s)) * 100),
  };
}

// ---------------------------------------------------------------- traits

export const TRAIT_KIND_ORDER: readonly TraitKind[] = ['condition', 'personality', 'earned', 'stress', 'scar'];
export const TRAIT_KIND_NAMES: Record<TraitKind, string> = {
  personality: 'Personality',
  earned: 'Earned',
  stress: 'Stress',
  scar: 'Scars',
  condition: 'Right now',
};

export interface TraitView {
  id: string;
  name: string;
  kind: TraitKind;
  description: string;
  /** How and when it was gained: "Day 12: Ten runs and still breathing." */
  gained: string;
  /** Conditions: when it wears off. */
  expires?: string;
}

export function traitName(t: TraitInstance): string {
  const name = getTrait(t.id).name;
  return t.target ? `${name} (${capitalize(getEnemyTypeName(t.target))})` : name;
}

export function traitView(t: TraitInstance): TraitView {
  const def = getTrait(t.id);
  const source = t.source ? `: ${capitalize(t.source)}.` : '';
  return {
    id: t.id,
    name: traitName(t),
    kind: def.kind,
    description: def.description,
    gained: `Day ${t.gainedDay}${source}`,
    ...(t.expiresDay !== undefined ? { expires: `Wears off on day ${t.expiresDay}.` } : {}),
  };
}

export interface TraitGroup {
  kind: TraitKind;
  name: string;
  traits: TraitView[];
}

/** Visible traits by kind, conditions first. Hidden traits never appear. */
export function traitGroups(s: Survivor): TraitGroup[] {
  const visible = visibleTraits(s).map(traitView);
  return TRAIT_KIND_ORDER.map((kind) => ({ kind, name: TRAIT_KIND_NAMES[kind], traits: visible.filter((t) => t.kind === kind) })).filter(
    (g) => g.traits.length > 0,
  );
}

export function hiddenTraitCount(s: Survivor): number {
  return s.traits.length - visibleTraits(s).length;
}

/** The few trait names that best sum someone up on a roster card: earned and scars first, then personality. */
export function headlineTraits(s: Survivor, max = 3): string[] {
  const rank: Record<TraitKind, number> = { earned: 0, scar: 1, stress: 2, personality: 3, condition: 9 };
  return visibleTraits(s)
    .filter((t) => getTrait(t.id).kind !== 'condition')
    .sort((a, b) => rank[getTrait(a.id).kind] - rank[getTrait(b.id).kind])
    .slice(0, max)
    .map(traitName);
}

// ---------------------------------------------------------------- relationships

export interface BondView {
  other: Survivor;
  score: number;
  label: RelationshipLabel;
  labelName: string;
  /** Sentences about special ties: "Owes Mara a life." */
  ties: string[];
}

export function flagText(flag: RelationshipFlag, self: Survivor, other: Survivor): string | undefined {
  switch (flag.kind) {
    case 'owesLife':
      return flag.debtor === self.id
        ? `Owes ${other.firstName} a life.`
        : `${other.firstName} owes ${pronounForms(self.pronouns).them} a life.`;
    case 'mentor':
      return flag.mentor === self.id ? `Mentor to ${other.firstName}.` : `Learning from ${other.firstName}.`;
    case 'partners':
      return 'Partners.';
  }
}

export function bonds(state: GameState, s: Survivor): BondView[] {
  return relationshipsOf(state, s.id).map((r) => ({
    other: r.other,
    score: r.score,
    label: r.label,
    labelName: labelName(r.label),
    ties: r.flags.map((f) => flagText(f, s, r.other)).filter((t): t is string => t !== undefined),
  }));
}

// ---------------------------------------------------------------- chronicle

const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** A life in numbers, skipping what never happened: ["12 runs", "7 kills", "downed twice"]. */
export function lifeSummary(s: Survivor): string[] {
  const c = s.counters;
  const out: string[] = [count(c.runs, 'run')];
  if (c.combats) out.push(count(c.combats, 'fight'));
  if (c.kills) out.push(count(c.kills, 'kill'));
  if (c.timesDowned) out.push(c.timesDowned === 1 ? 'downed once' : c.timesDowned === 2 ? 'downed twice' : `downed ${c.timesDowned} times`);
  if (c.nearDeaths) out.push(c.nearDeaths === 1 ? 'one brush with death' : `${c.nearDeaths} brushes with death`);
  if (c.alliesSaved) out.push(`${count(c.alliesSaved, 'ally', 'allies')} saved`);
  if (c.alliesLost) out.push(`${count(c.alliesLost, 'friend')} lost`);
  if (c.scavenges) out.push(count(c.scavenges, 'good find'));
  return out;
}

export interface ChronicleDay {
  day: number;
  entries: string[];
}

/** Chronicle entries grouped by day, oldest first, so it reads as a life story. */
export function chronicleByDay(s: Survivor): ChronicleDay[] {
  const out: ChronicleDay[] = [];
  for (const e of s.chronicle) {
    const last = out[out.length - 1];
    if (last && last.day === e.day) last.entries.push(e.text);
    else out.push({ day: e.day, entries: [e.text] });
  }
  return out;
}

// ---------------------------------------------------------------- gear

export const SLOT_NAMES: Record<Slot, string> = { weapon: 'Weapon', armor: 'Armor', tool: 'Tool', trinket: 'Trinket' };

/** The numbers that matter for an item, in a few words: "5 damage, uses ammo". */
export function itemStats(item: ItemInstance): string {
  const def = itemDef(item);
  const parts: string[] = [];
  if (def.slot === 'weapon') {
    parts.push(`${weaponDamage(item)} damage`);
    parts.push(def.weaponType === 'ranged' ? 'ranged' : 'melee');
    const toHit = (def.toHit ?? 0) + qualityMod(item);
    if (toHit !== 0) parts.push(`${toHit > 0 ? '+' : ''}${toHit} to hit`);
    if (def.usesAmmo) parts.push('uses ammo');
  } else if (def.slot === 'armor') {
    parts.push(`armor ${armorValue(item)}`);
  }
  return parts.join(', ');
}

export interface ItemView {
  uid: string;
  name: string;
  stats: string;
  description: string;
  cherished: boolean;
}

export function itemView(item: ItemInstance): ItemView {
  return {
    uid: item.uid,
    name: itemName(item),
    stats: itemStats(item),
    description: itemDef(item).description,
    cherished: item.cherishedBy !== undefined,
  };
}

/** Stash items that fit a slot, best quality first. */
export function stashFor(state: GameState, slot: Slot): ItemInstance[] {
  return state.stash.filter((i) => itemDef(i).slot === slot).sort((a, b) => qualityMod(b) - qualityMod(a) || itemName(a).localeCompare(itemName(b)));
}

// ---------------------------------------------------------------- resources

export const RESOURCE_NAMES: Record<ResourceId, string> = { scrap: 'Scrap', rations: 'Rations', meds: 'Meds', ammo: 'Ammo', tech: 'Tech' };

export function resourceList(state: GameState): { id: ResourceId; name: string; amount: number }[] {
  return RESOURCE_IDS.map((id) => ({ id, name: RESOURCE_NAMES[id], amount: state.resources[id] }));
}

// ---------------------------------------------------------------- roster

/** Living survivors: ready first, then hurt, then away; by name within each. */
export function rosterOrder(state: GameState): Survivor[] {
  const rank: Record<StatusTone, number> = { ready: 0, strained: 1, hurt: 2, away: 3, dead: 4 };
  return [...state.survivors].sort(
    (a, b) => rank[survivorStatus(a).tone] - rank[survivorStatus(b).tone] || a.firstName.localeCompare(b.firstName),
  );
}

/** The Memorial Wall, most recent loss first. */
export function memorialOrder(state: GameState): Survivor[] {
  return [...state.memorial].sort((a, b) => (b.diedDay ?? 0) - (a.diedDay ?? 0));
}

export function findAnySurvivor(state: GameState, id: string): Survivor | undefined {
  return state.survivors.find((s) => s.id === id) ?? state.memorial.find((s) => s.id === id);
}
