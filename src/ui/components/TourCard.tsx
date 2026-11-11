import { useEffect, useLayoutEffect, useRef } from 'react';
import type { GameState } from '../../engine/index.ts';
import { navigate, useHash, useServices } from '../hooks.ts';
import type { PrefsStore } from '../prefs.ts';
import { TOUR_STEPS, nextPartStepId, nextStepId, tourCard, tourStep } from '../tour.ts';

/** Start the tour from the top, on its first screen. */
export function startTour(prefs: PrefsStore, state: GameState): void {
  const first = TOUR_STEPS[0]!;
  prefs.set({ tour: first.id });
  navigate(first.route(state), { replace: true });
}

/**
 * The tour's card, above the tab bar. Moving to a step opens its screen and
 * outlines the thing it talks about. Whoever starts the tour opens the first
 * screen; opening the game mid-tour stays wherever it opened (a notice, say).
 */
export function TourCard({ state, stepId }: { state: GameState; stepId: string }) {
  const { prefs } = useServices();
  const hash = useHash();
  const card = useRef<HTMLElement>(null);
  const shown = useRef(stepId);
  const step = tourStep(stepId);

  useEffect(() => {
    if (!step || shown.current === step.id) return;
    shown.current = step.id;
    navigate(step.route(state), { replace: true });
  }, [step, state]);

  // Outline the step's target once its screen is up, and bring it into view.
  useEffect(() => {
    const target = step?.target;
    if (!target) return;
    let el: Element | null = null;
    const frame = window.requestAnimationFrame(() => {
      el = document.querySelector(`[data-tour="${target}"]`);
      if (!el) return;
      el.classList.add('tour-target');
      // .tour-target's scroll margin keeps it clear of a screen's sticky back bar.
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      el?.classList.remove('tour-target');
    };
  }, [step, hash]);

  // Screens make room for the card (see .is-touring in styles.css).
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const root = document.documentElement;
    const measure = (): void => root.style.setProperty('--tour-h', `${el.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--tour-h');
    };
  }, []);

  const view = tourCard(state, stepId);
  if (!view) return null;
  const go = (id: string | null): void => prefs.set({ tour: id });

  return (
    <aside ref={card} className="tour-card" aria-label="Tour">
      <p className="tour-where">
        <span>{view.where}</span>
        <span>{view.partOf}</span>
      </p>
      <div aria-live="polite">
        <h2 className="tour-title">{view.title}</h2>
        <p className="tour-text">{view.text}</p>
      </div>
      <div className="tour-actions">
        <button type="button" className="btn btn-primary" onClick={() => go(view.last ? null : nextStepId(stepId))}>
          {view.last ? 'Finish' : 'Next'}
        </button>
        {!view.lastInPart && (
          <button type="button" className="btn" onClick={() => go(nextPartStepId(stepId))}>
            Skip this part
          </button>
        )}
        {!view.last && (
          <button type="button" className="btn btn-quiet" onClick={() => go(null)}>
            Skip tour
          </button>
        )}
      </div>
    </aside>
  );
}
