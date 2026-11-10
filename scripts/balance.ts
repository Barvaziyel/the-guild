/**
 * Monte Carlo balance table: simulate many runs per location and print how
 * dangerous and how rewarding each one is.
 *   npm run balance                 # 400 fresh guilds per location
 *   npm run balance -- 2000 never aggressive 3
 */
import { LOCATIONS, newGame, simulateRun, type Approach, type RetreatOrder, type RunPlan, RESOURCE_IDS } from '../src/engine/index.ts';

const n = Number(process.argv[2] ?? 400);
const retreat = (process.argv[3] ?? 'downed') as RetreatOrder;
const approach = (process.argv[4] ?? 'balanced') as Approach;
const crewSize = Number(process.argv[5] ?? 3);
const medkit = process.argv[6] === 'medkit';

console.log(`\n${n} runs per location, crew of ${crewSize} fresh survivors, scavenge, ${approach}, retreat: ${retreat}${medkit ? ', with a Medkit' : ''}\n`);
console.log('location            dgr  hurt%  down/run  deaths/100  1 death per  done%  routed%  loot  stress  beats');

for (const loc of LOCATIONS) {
  let hurtRuns = 0, downs = 0, deaths = 0, done = 0, routed = 0, loot = 0, stress = 0, beats = 0;
  for (let i = 0; i < n; i++) {
    const state = newGame({ seed: `bal-${i}`, now: 0 });
    const crew = state.survivors.slice(0, crewSize);
    if (medkit) crew[0]!.equipment.tool = state.stash.find((it) => it.defId === 'medkit')!;
    const plan: RunPlan = { locationId: loc.id, crew: crew.map((s) => s.id), job: 'scavenge', meds: 2, ammo: 12, approach, retreat };
    const before = new Map(crew.map((s) => [s.id, s]));
    const { result, beats: b } = simulateRun(state, plan, `r${i}`, 0);
    const downed = result.crew.reduce((sum, s) => sum + (s.counters.timesDowned - before.get(s.id)!.counters.timesDowned), 0);
    downs += downed;
    if (downed > 0) hurtRuns++;
    deaths += result.deaths.length;
    if (result.outcome === 'completed') done++;
    if (result.outcome === 'routed' || result.outcome === 'lost') routed++;
    loot += RESOURCE_IDS.reduce((sum, r) => sum + result.loot[r], 0) + result.items.length;
    stress += result.crew.reduce((sum, s) => sum + (s.stress - before.get(s.id)!.stress), 0) / crew.length;
    beats += b.length;
  }
  const pct = (x: number) => String(Math.round((x / n) * 100)).padStart(4);
  console.log(
    `${loc.name.padEnd(20)}${String(loc.danger).padStart(3)}  ${pct(hurtRuns)}%  ${(downs / n).toFixed(2).padStart(8)}  ${((deaths / n) * 100).toFixed(1).padStart(10)}  ${(deaths ? Math.round(n / deaths) : Infinity).toString().padStart(11)}  ${pct(done)}%  ${pct(routed)}%  ${(loot / n).toFixed(1).padStart(5)}  ${(stress / n).toFixed(0).padStart(6)}  ${(beats / n).toFixed(1).padStart(5)}`,
  );
}
console.log('');
