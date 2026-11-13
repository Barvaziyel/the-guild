/**
 * Projects (§9.6): big works at the Depot, like Civ's wonders. Each comes in
 * three stages; a stage is paid for, then its crew works it off day by day.
 * What a project does when it's finished is read by the code that it changes
 * (see `projectDone` in projects.ts); the text here must say the same.
 */
import type { BuildingId, ProjectId, Resources, StatId } from '../types.ts';

export interface ProjectStage {
  cost: Partial<Resources>;
  /** Work it takes: each crew member at the Depot adds 1 + their work stat / 4 a day. */
  work: number;
  /** The news when this stage is done. */
  news: string;
}

export interface ProjectDef {
  id: ProjectId;
  name: string;
  /** What the work is. */
  description: string;
  /** What it does once finished. */
  effect: string;
  /** What has to be true before it can start. */
  needs: { building?: [BuildingId, number]; memorial?: boolean };
  /** The stat its crew works with and practices. */
  workStat: StatId;
  stages: readonly ProjectStage[];
  /** Written in each crew member's Chronicle when it's finished. */
  chronicle: string;
}

/** The far places the Line reaches. */
export const LINE_STOPS: readonly string[] = ['radio_station', 'checkpoint_bravo', 'blackwater', 'red_hand_camp', 'the_glow'];

export const PROJECTS: readonly ProjectDef[] = [
  {
    id: 'the_line',
    name: 'The Line',
    description: 'Clear the old track out of the Depot, mend the rails and build a handcar to run them.',
    effect: 'Runs to Hilltop, Checkpoint Bravo, Blackwater, Red Hand Camp and the Glow take half the time.',
    needs: { building: ['workshop', 2] },
    workStat: 'brawn',
    stages: [
      { cost: { scrap: 700, tech: 100, rations: 50 }, work: 150, news: 'The first stretch of the old track is clear of scrub and wrecks.' },
      { cost: { scrap: 700, tech: 100, rations: 50 }, work: 150, news: 'The rails are mended as far as the river.' },
      { cost: { scrap: 700, tech: 100, rations: 50 }, work: 150, news: 'The handcar runs. The far places are half the walk they were.' },
    ],
    chronicle: 'Helped rebuild the Line.',
  },
  {
    id: 'the_wall',
    name: 'The Wall',
    description: 'Replace the chain-link with sheet metal and sandbags, all the way round.',
    effect: 'Defenders fight raiders from behind it: raiders need 3 more to hit them.',
    needs: { building: ['watchtower', 3] },
    workStat: 'brawn',
    stages: [
      { cost: { scrap: 650, ammo: 130, rations: 40 }, work: 150, news: 'The first stretch of the wall is up.' },
      { cost: { scrap: 650, ammo: 130, rations: 40 }, work: 150, news: 'The wall reaches the gate.' },
      { cost: { scrap: 650, ammo: 130, rations: 40 }, work: 150, news: 'The wall closes the circle. The Depot feels like a fort.' },
    ],
    chronicle: 'Helped build the Wall.',
  },
  {
    id: 'the_clinic',
    name: 'The Clinic',
    description: 'Turn the Infirmary into a proper clinic: clean water, a surgery table, shelves of medicine.',
    effect: 'Everyone at the Depot heals twice as fast, and wounds close in half the time.',
    needs: { building: ['infirmary', 3] },
    workStat: 'wits',
    stages: [
      { cost: { scrap: 270, meds: 200, tech: 65, rations: 30 }, work: 150, news: 'The Clinic has clean water.' },
      { cost: { scrap: 270, meds: 200, tech: 65, rations: 30 }, work: 150, news: 'The Clinic has a surgery table and a lamp to work by.' },
      { cost: { scrap: 270, meds: 200, tech: 65, rations: 30 }, work: 150, news: 'The Clinic opens. Nobody in the Reach is better cared for.' },
    ],
    chronicle: 'Helped build the Clinic.',
  },
  {
    id: 'the_relay',
    name: 'The Relay',
    description: 'A mast and a dish on the station roof, and a generator to run them, to hear the whole Reach.',
    effect: 'Two more outposts, and word of every place the guild hasn’t found.',
    needs: { building: ['radio_tower', 3] },
    workStat: 'wits',
    stages: [
      { cost: { scrap: 330, tech: 90, gas: 60, rations: 20 }, work: 150, news: 'The mast for the Relay is up on the station roof.' },
      { cost: { scrap: 330, tech: 90, gas: 60, rations: 20 }, work: 150, news: 'The Relay’s dish is turned to the hills.' },
      { cost: { scrap: 330, tech: 90, gas: 60, rations: 20 }, work: 150, news: 'The Relay is on the air. The whole Reach can be heard from the Depot.' },
    ],
    chronicle: 'Helped raise the Relay.',
  },
  {
    id: 'memorial_garden',
    name: 'The Memorial Garden',
    description: 'A quiet patch for the ones who didn’t come back: a tree, a bench, a stone with their names.',
    effect: 'Everyone at the Depot sheds 1 more stress a day, and grief passes in half the time.',
    needs: { memorial: true },
    workStat: 'nerve',
    stages: [
      { cost: { scrap: 170, rations: 50 }, work: 60, news: 'Ground is cleared for the Memorial Garden.' },
      { cost: { scrap: 170, rations: 50 }, work: 60, news: 'A young tree is planted in the Memorial Garden.' },
      { cost: { scrap: 170, rations: 50 }, work: 60, news: 'The stone in the Memorial Garden is carved with every name.' },
    ],
    chronicle: 'Helped make the Memorial Garden.',
  },
];

const byId = new Map<ProjectId, ProjectDef>(PROJECTS.map((p) => [p.id, p]));

export function getProject(id: ProjectId): ProjectDef {
  const def = byId.get(id);
  if (!def) throw new Error(`Unknown project: ${id}`);
  return def;
}
