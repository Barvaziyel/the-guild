/**
 * Simulate one run and print its log.
 *   npm run run-sample                         # random seed, first known location
 *   npm run run-sample -- <seed> <location> <job> <approach> <retreat>
 */
import {
  LOCATIONS,
  checkText,
  completeRun,
  estimateRisk,
  getLocation,
  newGame,
  planWarnings,
  startRun,
  type RunJob,
  type Approach,
  type RetreatOrder,
  type RunPlan,
} from '../src/engine/index.ts';

const [seed = `run-${Date.now()}`, locationId = 'maple_street', job = 'scavenge', approach = 'balanced', retreat = 'downed'] =
  process.argv.slice(2);
const now = Date.now();
const state = newGame({ seed, now });
// Everything is discovered for the purposes of this script.
for (const loc of LOCATIONS) state.locations[loc.id]!.discovered = true;

const plan: RunPlan = {
  locationId,
  crew: state.survivors.slice(0, 3).map((s) => s.id),
  job: job as RunJob,
  meds: 2,
  ammo: 10,
  approach: approach as Approach,
  retreat: retreat as RetreatOrder,
};

const loc = getLocation(locationId);
const risk = estimateRisk(state, plan);
console.log(`\n${loc.name} (danger ${loc.danger}, radiation ${loc.radiation}) - ${job}, ${approach}, retreat: ${retreat}`);
console.log(`Crew: ${plan.crew.map((id) => state.survivors.find((s) => s.id === id)!.firstName).join(', ')}`);
console.log(`Risk: ${risk.label} (someone hurt ${Math.round(risk.downed * 100)}%, death ${Math.round(risk.death * 100)}%)`);
for (const w of planWarnings(state, plan)) console.log(`Warning: ${w}`);

const run = startRun(state, plan, now);
const names = new Map(state.survivors.map((s) => [s.id, s.firstName]));
for (const beat of run.beats) {
  console.log(`\n[${String(Math.round(beat.at / 60_000)).padStart(3)} min] ${beat.title.toUpperCase()}`);
  for (const line of beat.lines) {
    const check = line.check ? `  [${names.get(line.check.who)}: ${checkText(line.check)}]` : '';
    console.log(`  ${line.text}${check}`);
  }
}

const report = completeRun(state, run.id, run.returnAt);
const s = report.summary;
console.log(`\nOutcome: ${s.outcome}. Explored +${s.exploredGain}%.`);
if (s.highlights.length > 0) {
  console.log('What changed:');
  for (const h of s.highlights) console.log(`  ${report.crewNames[h.survivorId]}: ${h.text}`);
}
console.log('');
