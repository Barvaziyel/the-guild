/**
 * First-time moments (§9.10, 3.14.0): when the story opens a system in a new guild, a card pops up once,
 * with its picture, one line, and a way to it. Plain TypeScript, tested in Node.
 */
import { nextOpening, type GameState, type SystemId } from '../engine/index.ts';
import type { GlyphName } from './glyphs.ts';
import type { Route } from './route.ts';

export interface OpeningCard {
  id: SystemId;
  title: string;
  line: string;
  glyph: GlyphName;
  /** Where it is, if there's somewhere to look. */
  go?: { label: string; to: Route };
}

const CARDS: Record<SystemId, Omit<OpeningCard, 'id'>> = {
  lead: { title: 'Leading the fights', line: 'When a fight matters, the crew calls home and waits for your orders.', glyph: 'swords' },
  decisions: { title: 'Decisions', line: 'Things come up at the Depot that need your say, and they won’t wait forever.', glyph: 'scales' },
  market: {
    title: 'The market',
    line: 'Traders still meet at the old Drive-In. Swap what you have plenty of for what you need.',
    glyph: 'crate',
    go: { label: 'Find it on the map', to: { screen: 'reach', id: 'drive_in' } },
  },
  vehicles: {
    title: 'Vehicles',
    line: 'Wheels: there and back faster, with room for more on the way home.',
    glyph: 'wheel',
    go: { label: 'See the vehicles', to: { screen: 'vehicles' } },
  },
  rescue: { title: 'Calls for help', line: 'On the air, the guild hears others too. Some of them are calling for help.', glyph: 'radio' },
  raids: {
    title: 'Raids',
    line: 'Full sacks get noticed. Raiders may come for them, and a Watchtower sees them coming.',
    glyph: 'war',
    go: { label: 'See the Watchtower', to: { screen: 'building', id: 'watchtower' } },
  },
  outposts: {
    title: 'Outposts',
    line: 'Map a place’s outskirts, then set up camp there: supplies sent home, and shorter runs nearby.',
    glyph: 'tent',
    go: { label: 'To the Reach', to: { screen: 'reach' } },
  },
  projects: {
    title: 'Projects',
    line: 'Big works that change the Depot for good: rails to the far places, a wall, a clinic.',
    glyph: 'wrench',
    go: { label: 'See the projects', to: { screen: 'depot', tab: 'projects' } },
  },
};

/** The first-time moment to show now, if any. */
export function openingCard(state: GameState): OpeningCard | undefined {
  const id = nextOpening(state);
  return id ? { id, ...CARDS[id] } : undefined;
}

/** Whether a screen is calm enough for it: never over a fight, a raid or a scene. */
export function openingFits(screen: string): boolean {
  return !['fight', 'raid', 'run'].includes(screen);
}
