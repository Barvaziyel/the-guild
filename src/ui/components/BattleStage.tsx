import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { FightView, GameState } from "../../engine/index.ts";
import { stageSvg } from "../../scene/index.ts";
import {
  FRAME_MS,
  roundFrames,
  stageModel,
  type StageFrame,
  type StageOrders,
} from "../battle-view.ts";

const NO_ORDERS: StageOrders = { picks: {} };

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * The fight drawn as a side view (§7.13). When the fight moves on from
 * `before`, the round between is played act by act; a tap skips to the end.
 * Between rounds, a tap on someone goes to `onTap` with their key.
 */
export function BattleStage({
  state,
  place,
  seed,
  view,
  before,
  orders = NO_ORDERS,
  onTap,
  onLine,
  caption,
}: {
  state: GameState;
  /** The place's id, for the backdrop ('depot' for a raid), and a seed for the enemies' looks. */
  place: string;
  seed: string;
  view: FightView;
  before?: FightView | undefined;
  orders?: StageOrders;
  onTap?: (key: string) => void;
  /** While a round plays: how many of the view's lines have been told so far; undefined once it's done. */
  onLine?: (lines: number | undefined) => void;
  caption?: string;
}) {
  const [frames, setFrames] = useState<StageFrame[]>([]);
  const [step, setStep] = useState(0);
  const played = useRef<FightView | undefined>(undefined);

  // A new view after an earlier one: play what happened in between.
  useEffect(() => {
    if (played.current === view) return;
    const from = before ?? played.current;
    played.current = view;
    const next = from && !reducedMotion() ? roundFrames(from, view) : [];
    setFrames(next);
    setStep(0);
  }, [view, before]);

  const playing = step < frames.length;
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => setStep((s) => s + 1), FRAME_MS);
    return () => window.clearTimeout(t);
  }, [playing, step]);

  const frame = playing ? frames[step] : undefined;
  useEffect(() => {
    onLine?.(frame ? frame.line + 1 : undefined);
  }, [frame, onLine]);
  const svg = useMemo(
    () =>
      stageSvg(
        stageModel(
          state,
          { place, seed },
          view,
          playing ? NO_ORDERS : orders,
          frame,
        ),
      ),
    [state, place, seed, view, orders, frame, playing],
  );

  const tap = (target: EventTarget | null): void => {
    if (playing) {
      setStep(frames.length);
      return;
    }
    const el = (target as Element | null)?.closest?.("[data-key]");
    const key = el?.getAttribute("data-key");
    if (key && onTap) onTap(key);
  };

  return (
    <figure
      className={`battle-stage${playing ? " is-playing" : ""}${onTap ? " is-live" : ""}`}
    >
      <div
        className="battle-svg"
        onClick={(e: MouseEvent) => tap(e.target)}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            tap(e.target);
          }
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {(playing || caption) && (
        <figcaption className="battle-caption" aria-live="polite">
          {playing ? (
            <>
              <span>Round {frame?.round}</span>
              <button
                type="button"
                className="btn btn-quiet btn-small"
                onClick={() => setStep(frames.length)}
              >
                Skip
              </button>
            </>
          ) : (
            caption && <span>{caption}</span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
