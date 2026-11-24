import { useEffect, useRef, useState } from 'react';
import { tipPlacement } from '../glyphs.ts';

const TIP_MS = 3500;
const TIP_W = 220;

/**
 * Tap a small picture to see what it means (3.7.1): a bubble with its words, over the picture, for a few
 * seconds or until the next tap. The tap is the picture's own: a picture inside a row or a button
 * doesn't also pick the row.
 */
export function TagTips() {
  const [tip, setTip] = useState<{ text: string; left: number; top: number; below: boolean } | null>(null);
  const timer = useRef(0);
  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      const tag = (e.target as Element | null)?.closest?.<HTMLElement>('[data-tip]');
      if (!tag) {
        setTip(null);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const r = tag.getBoundingClientRect();
      const at = tipPlacement({ left: r.left, top: r.top, width: r.width, height: r.height }, { width: window.innerWidth, height: window.innerHeight }, Math.min(TIP_W, window.innerWidth - 16));
      setTip({ text: tag.dataset.tip ?? '', ...at });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setTip(null), TIP_MS);
    };
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.clearTimeout(timer.current);
    };
  }, []);
  if (!tip) return null;
  return (
    <div className={`tag-tip${tip.below ? ' is-below' : ''}`} role="status" style={{ left: tip.left, top: tip.top, maxWidth: TIP_W }}>
      {tip.text}
    </div>
  );
}
