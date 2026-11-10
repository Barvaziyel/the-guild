import { memo, useMemo } from 'react';
import type { Survivor } from '../../engine/index.ts';
import { portraitSvg } from '../../portrait/index.ts';
import { usePrefs } from '../hooks.ts';

interface Props {
  survivor: Survivor;
  /** Width and height in px. */
  size: number;
  memorial?: boolean;
  /** Small portraits next to a name are decoration for screen readers. */
  decorative?: boolean;
  className?: string;
}

function PortraitImpl({ survivor, size, memorial = false, decorative = false, className = '' }: Props) {
  const { wobble } = usePrefs();
  const svg = useMemo(() => portraitSvg(survivor, { wobble, memorial }), [survivor, wobble, memorial]);
  return (
    <div
      className={`portrait ${className}`}
      style={{ width: size, height: size }}
      aria-hidden={decorative || undefined}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export const Portrait = memo(PortraitImpl);
