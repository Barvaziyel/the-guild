/**
 * The game's pictures (3.3.0, DESIGN §14.3): an icon for a piece of gear, a
 * place's banner, a building up close, and a stamp for a moment in a run.
 * Each is an SVG string from `src/scene`, drawn once per change.
 */
import { useMemo } from 'react';
import type { BeatKind, BuildingId, Quality } from '../../engine/index.ts';
import { beatIconSvg, buildingPictureSvg, enemyPictureSvg, itemIconSvg, placePictureSvg } from '../../scene/index.ts';

export function ItemIcon({ defId, quality, label }: { defId?: string | undefined; quality?: Quality | undefined; label?: string }) {
  const svg = useMemo(() => itemIconSvg(defId, quality, label), [defId, quality, label]);
  return <span className="item-icon-box" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function PlacePicture({ id, name }: { id: string; name: string }) {
  const svg = useMemo(() => placePictureSvg(id, name), [id, name]);
  return <div className="place-picture-box" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function BuildingPicture({ id, level, name }: { id: BuildingId; level: number; name: string }) {
  const svg = useMemo(() => buildingPictureSvg(id, level, name), [id, level, name]);
  return <div className="building-picture-box" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function BeatIcon({ kind }: { kind: BeatKind }) {
  const svg = useMemo(() => beatIconSvg(kind), [kind]);
  return <span className="beat-icon-box" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** One enemy on its own (an elite's card, 3.12.0). */
export function EnemyPicture({ kind, type, label }: { kind: string; type: string; label: string }) {
  const svg = useMemo(() => enemyPictureSvg(kind, type, label), [kind, type, label]);
  return <div className="enemy-picture-box" dangerouslySetInnerHTML={{ __html: svg }} />;
}
