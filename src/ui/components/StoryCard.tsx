import { claimStory, seenStory, type GameState } from '../../engine/index.ts';
import { navigate, scrollBehavior, useAction, usePrefs } from '../hooks.ts';
import { tourStep } from '../tour.ts';
import { storyCard, storyEnding, type StoryCard as StoryCardView } from '../story-view.ts';

/**
 * The first week (§9.10, 2.8.0), at the top of the Yard, above the drawing so
 * a new player sees it on opening, once the tour is over (2.8.1: the two
 * cards together were too much at the start): the step under way,
 * what it asks and what it gives, and how the last one went.
 */
function go(where: NonNullable<StoryCardView['go']>): void {
  if ('to' in where) navigate(where.to);
  else document.getElementById(where.scrollTo)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
}

export function StoryCard({ state }: { state: GameState }) {
  const { act, error } = useAction();
  const touring = tourStep(usePrefs().tour) !== undefined;
  const ending = storyEnding(state);
  const card = storyCard(state);
  if (touring || (!ending && !card)) return null;

  if (ending) {
    return (
      <section className="story is-done" aria-labelledby="story-title" role="status">
        <p className="story-kicker">{ending.last ? 'The first week is done' : 'Done'}</p>
        <h3 id="story-title" className="story-title">
          {ending.title}
        </h3>
        <p>{ending.text}</p>
        {ending.supplies && <p className="story-gives">{ending.supplies}</p>}
        {ending.gifts && <p className="story-gives">{ending.gifts}</p>}
        <button type="button" className="btn" onClick={() => act((s) => seenStory(s))}>
          {ending.last ? 'Done' : 'Next'}
        </button>
      </section>
    );
  }

  return (
    <section className={`story${card!.met ? ' is-met' : ''}`} aria-labelledby="story-title">
      <p className="story-kicker">{card!.kicker}</p>
      <h3 id="story-title" className="story-title">
        {card!.title}
      </h3>
      <p>{card!.text}</p>
      <p className="story-goal">{card!.goal}</p>
      <div className="story-foot">
        {card!.met ? (
          <button type="button" className="btn btn-primary" onClick={() => act((s) => void claimStory(s, Date.now()))}>
            Collect
          </button>
        ) : card!.go ? (
          <button type="button" className="btn" onClick={() => go(card!.go!)}>
            {card!.go.label}
          </button>
        ) : null}
        <p className="story-reward">{card!.reward}</p>
      </div>
      {error && <p className="field-error">{error}</p>}
    </section>
  );
}
