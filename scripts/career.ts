/**
 * Play a guild through many runs and print how its people change.
 * Between runs the guild spends three days at the Depot (eating, healing, working).
 *   npm run career                  # 40 runs, random seed
 *   npm run career -- <seed> <runs> <maxDanger>
 */
import {
  DAY_MS,
  LOCATIONS,
  advanceTime,
  STAT_IDS,
  completeRun,
  dayAt,
  effectiveStat,
  getTrait,
  itemName,
  knownLocations,
  labelName,
  newGame,
  relationshipsOf,
  startRun,
  statName,
  unavailableReason,
  withRng,
  type RunPlan,
} from '../src/engine/index.ts';

const seed = process.argv[2] ?? `career-${Date.now()}`;
const runs = Number(process.argv[3] ?? 40);
const maxDanger = Number(process.argv[4] ?? 3);
let now = 0;
const state = newGame({ seed, now });
state.resources = { scrap: 0, rations: 9999, meds: 9999, ammo: 9999, tech: 0 };

console.log(`\nA guild's first ${runs} runs (seed: ${seed}, danger up to ${maxDanger})\n`);
let deaths = 0;
for (let i = 1; i <= runs; i++) {
  const ready = state.survivors.filter((s) => !unavailableReason(s));
  if (ready.length === 0) {
    console.log('  Nobody is fit to go out. The guild rests.');
  } else {
    const options = knownLocations(state).filter((l) => l.danger <= maxDanger);
    const plan = withRng(state, (rng): RunPlan => ({
      locationId: rng.pick(options).id,
      crew: rng.sample(ready, 3).map((s) => s.id),
      job: rng.pick(['scavenge', 'scavenge', 'scout', 'hunt'] as const),
      meds: 2,
      ammo: 12,
      approach: 'balanced',
      retreat: 'downed',
    }));
    const run = startRun(state, plan, now);
    const report = completeRun(state, run.id, run.returnAt);
    now = run.returnAt;
    const loc = LOCATIONS.find((l) => l.id === plan.locationId)!;
    const crew = plan.crew.map((id) => report.crewNames[id]!.split(' ')[0]).join(', ');
    console.log(`Run ${i} (day ${dayAt(state, now)}): ${crew} -> ${loc.name}, ${plan.job}: ${report.summary.outcome}`);
    for (const h of report.summary.highlights) {
      if (/^First run|rose to/.test(h.text)) continue;
      console.log(`    ${report.crewNames[h.survivorId]!.split(' ')[0]}: ${h.text}`);
    }
    deaths += report.summary.deaths.length;
  }
  // Three days at the Depot: wounds mend, nerves settle, the Garden grows.
  now += 3 * DAY_MS;
  for (const n of advanceTime(state, now).depot.news) {
    if (n.tags?.includes('run') || n.tags?.includes('recruit')) continue;
    console.log(`    Depot, day ${n.day}: ${n.text}`);
  }
}

console.log(`\n${'='.repeat(60)}\nAfter ${runs} runs: ${state.survivors.length} alive, ${deaths} dead. Locations known: ${knownLocations(state).length}/${LOCATIONS.length}\n`);
for (const s of state.survivors) {
  console.log(`${s.firstName} ${s.lastName} - ${s.counters.runs} runs, ${s.counters.kills} kills, downed ${s.counters.timesDowned}x, stress ${s.stress}`);
  console.log('  ' + STAT_IDS.map((st) => `${statName(st)} ${effectiveStat(s, st)}`).join('  '));
  console.log(`  Traits: ${s.traits.map((t) => getTrait(t.id).name + (t.target ? ` (${t.target})` : '') + (t.hidden ? ' (hidden)' : '')).join(', ')}`);
  console.log(`  Gear: ${Object.values(s.equipment).map((it) => itemName(it!) + (it!.cherishedBy ? ' (cherished)' : '')).join(', ')}`);
  console.log(`  Bonds: ${relationshipsOf(state, s.id).map((r) => `${r.other.firstName} ${r.score > 0 ? '+' : ''}${r.score} ${labelName(r.label)}${r.flags.length ? ' [' + r.flags.map((f) => f.kind).join(',') + ']' : ''}`).join(', ')}`);
}
for (const s of state.memorial) console.log(`\nIn memory: ${s.firstName} ${s.lastName}. ${s.causeOfDeath}, day ${s.diedDay}, after ${s.counters.runs} runs.`);
console.log(`\nStash: ${state.stash.map(itemName).join(', ')}`);
console.log(`Loot banked: ${Object.entries(state.resources).filter(([k]) => k === 'scrap' || k === 'tech').map(([k, v]) => `${k} ${v}`).join(', ')}\n`);
