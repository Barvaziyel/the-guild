import type { CheckInfo, Pronouns, ResourceId, Survivor } from './types.ts';

/** An amount of a resource in prose: "1 ration", "5 rations", "1 med", "4 scrap". */
export function amountOf(res: ResourceId, n: number): string {
  return n === 1 && (res === 'rations' || res === 'meds') ? `1 ${res.slice(0, -1)}` : `${n} ${res}`;
}

interface PronounForms {
  they: string;
  them: string;
  their: string;
  theirs: string;
  themself: string;
  is: string;
  was: string;
  has: string;
  does: string;
}

const PRONOUNS: Record<Pronouns, PronounForms> = {
  he: { they: 'he', them: 'him', their: 'his', theirs: 'his', themself: 'himself', is: 'is', was: 'was', has: 'has', does: 'does' },
  she: { they: 'she', them: 'her', their: 'her', theirs: 'hers', themself: 'herself', is: 'is', was: 'was', has: 'has', does: 'does' },
};

export function pronounForms(p: Pronouns): PronounForms {
  return PRONOUNS[p];
}

const capitalize = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/**
 * Fill a text template for one survivor.
 *
 * Placeholders: {first} {last} {name} {they} {them} {their} {theirs} {themself}
 * {is} {was} {has} {does}. Capitalized variants ({They}, {Their}, ...) are supported.
 */
export function fill(template: string, s: Survivor): string {
  const forms = PRONOUNS[s.pronouns];
  const values: Record<string, string> = {
    first: s.firstName,
    last: s.lastName,
    name: displayName(s),
    ...forms,
  };
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const lower = key.toLowerCase();
    const value = values[key] ?? values[lower];
    if (value === undefined) return match;
    return key[0] === key[0]!.toUpperCase() && key !== lower ? capitalize(value) : value;
  });
}

/**
 * Fill a template that mentions several survivors by role, e.g.
 * fillRoles('{a.first} hauls {b.first} out of the rubble.', { a, b }).
 * Each role supports the same keys as fill(): {a.they}, {b.Their}, ...
 */
export function fillRoles(template: string, roles: Record<string, Survivor>): string {
  return template.replace(/\{(\w+)\.(\w+)\}/g, (match, role: string, key: string) => {
    const s = roles[role];
    if (!s) return match;
    return fill(`{${key}}`, s);
  });
}

export function fullName(s: Survivor): string {
  return `${s.firstName} ${s.lastName}`;
}

/** "Dex" or 'Dex "Two-Shot"' if a nickname was earned. */
export function displayName(s: Survivor): string {
  return s.nickname ? `${s.firstName} "${s.nickname}"` : s.firstName;
}

/** A check as shown in the run log: "Wits 6+5 vs 10 \u2714". */
export function checkText(check: CheckInfo): string {
  const stat = check.stat.charAt(0).toUpperCase() + check.stat.slice(1);
  const bonus = check.bonus < 0 ? `(${check.bonus})` : String(check.bonus);
  return `${stat} ${bonus}+${check.roll} vs ${check.dc} ${check.success ? '\u2714' : '\u2718'}${check.rerolled ? ' (rerolled)' : ''}`;
}
