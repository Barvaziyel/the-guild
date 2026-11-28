import { useMemo } from 'react';
import { getEnemy, nextEliteSight, seenEliteSight, type GameState } from '../../engine/index.ts';
import { eliteSightScene } from '../elite-scene.ts';
import { useAction } from '../hooks.ts';
import { SceneStage } from './SceneStage.tsx';

/**
 * An elite seen for the first time (§7.15, 4c, 3.16.0): once the crew that saw it is home, the screen goes
 * dark and its first sight plays on the stage, over whatever was open. Once; Skip ends it.
 */
export function EliteSight({ state }: { state: GameState }) {
  const { act } = useAction();
  const id = nextEliteSight(state);
  const shots = useMemo(() => (id ? eliteSightScene(id) : []), [id]);
  if (!id || shots.length === 0) return null;
  const name = getEnemy(id).name;
  return (
    <div className="elite-sight" role="dialog" aria-modal="true" aria-label={`First sight of ${name}`} key={id}>
      <div className="elite-sight-inner">
        <p className="dilemma-kicker elite-sight-kicker">First sight</p>
        <SceneStage frames={shots} onDone={() => act((s) => seenEliteSight(s, id))} />
      </div>
    </div>
  );
}
