/**
 * Print a freshly generated guild, to eyeball the generator.
 *   npm run sample            # random seed
 *   npm run sample -- my-seed # fixed seed
 */
import {
  STAT_IDS,
  effectiveStat,
  getOrigin,
  getTrait,
  itemName,
  labelName,
  maxHp,
  newGame,
  relationshipsOf,
  statName,
} from '../src/engine/index.ts';

const seed = process.argv[2] ?? `sample-${Date.now()}`;
const state = newGame({ seed, now: Date.now() });

console.log(`\n${state.guildName}  (seed: ${seed})\n${'='.repeat(60)}`);
for (const s of state.survivors) {
  const origin = getOrigin(s.origin);
  console.log(`\n${s.firstName} ${s.lastName} (${s.pronouns}, ${s.age}) - ${origin.name}`);
  console.log(`  "${s.backstory}"`);
  console.log(
    '  ' + STAT_IDS.map((st) => `${statName(st)} ${effectiveStat(s, st)}`).join('  ') + `   HP ${s.hp}/${maxHp(s)}  Stress ${s.stress}`,
  );
  const traits = s.traits.map((t) => getTrait(t.id).name + (t.hidden ? ' (hidden)' : '')).join(', ');
  console.log(`  Traits: ${traits}`);
  const gear = Object.entries(s.equipment)
    .map(([slot, item]) => `${slot}: ${item ? itemName(item) : '-'}`)
    .join(', ');
  console.log(`  Gear: ${gear}`);
  const rels = relationshipsOf(state, s.id)
    .map((r) => `${r.other.firstName} ${r.score > 0 ? '+' : ''}${r.score} (${labelName(r.label)})`)
    .join(', ');
  console.log(`  Feels about: ${rels}`);
}
console.log(`\nStash: ${state.stash.map(itemName).join(', ')}`);
console.log(`Resources: ${Object.entries(state.resources).map(([k, v]) => `${k} ${v}`).join(', ')}\n`);
