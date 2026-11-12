import type { KeyboardEvent } from 'react';
import type { GameState } from '../../engine/index.ts';
import { usePrefs } from '../hooks.ts';
import { DEPOT_SPOT, reachMap, type LabelSide, type MapNode, type MapSpot } from '../reach-map.ts';

/** Marker fill by danger, 1 to 5, on paper. */
const DANGER_FILL = ['#8aa77e', '#c2a654', '#c77d3f', '#a64d27', '#7e2a22'];
const INK = '#2b2420';
const PAPER = '#eadfc8';
const LINE_H = 3.6;

interface Props {
  state: GameState;
  selected?: string;
  onPick: (id: string) => void;
}

/** The Reach, sketched on the journal's map page. */
export function ReachMapSvg({ state, selected, onPick }: Props) {
  const { wobble } = usePrefs();
  const map = reachMap(state);
  return (
    <svg className="reach-map" viewBox="0 0 100 100" role="group" aria-label="Map of the Reach">
      <defs>
        <filter id="map-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="0.7" />
        </filter>
      </defs>
      <g filter={wobble ? 'url(#map-ink)' : undefined}>
        {map.roads.map((r, i) => (
          <line
            key={i}
            x1={r.from.x}
            y1={r.from.y}
            x2={r.to.x}
            y2={r.to.y}
            stroke={INK}
            strokeWidth={r.known ? 0.55 : 0.4}
            strokeDasharray={r.known ? undefined : '1.2 1.4'}
            opacity={r.known ? 0.75 : 0.45}
            strokeLinecap="round"
          />
        ))}
      </g>
      <Depot />
      {map.nodes.map((n) => (
        <Node key={n.id} node={n} selected={n.id === selected} onPick={onPick} />
      ))}
    </svg>
  );
}

function Depot() {
  const { x, y } = DEPOT_SPOT;
  return (
    <g aria-label="The Depot">
      <rect x={x - 3} y={y - 3} width={6} height={6} fill="#efe6d2" stroke={INK} strokeWidth={0.6} />
      <path d={`M${x - 3} ${y - 3}L${x} ${y - 5.4}L${x + 3} ${y - 3}`} fill="none" stroke={INK} strokeWidth={0.6} strokeLinejoin="round" />
      <Label spot={DEPOT_SPOT} lines={['The Depot']} offset={5} bold />
    </g>
  );
}

function Node({ node: n, selected, onPick }: { node: MapNode; selected: boolean; onPick: (id: string) => void }) {
  const { x, y } = n.spot;
  const pick = (): void => onPick(n.id);
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick();
    }
  };

  if (!n.known) {
    return (
      <g className="map-node unknown" role="button" tabIndex={0} aria-label="An unexplored place" onClick={pick} onKeyDown={onKey}>
        <circle cx={x} cy={y} r={7} fill="transparent" />
        <circle cx={x} cy={y} r={2.8} fill="none" stroke={INK} strokeWidth={0.45} strokeDasharray="1 0.9" opacity={0.6} />
        <text x={x} y={y + 1.25} textAnchor="middle" fontSize={3.4} fontWeight={700} fill={INK} opacity={0.6}>
          ?
        </text>
        {selected && <circle cx={x} cy={y} r={5} fill="none" stroke="#a64d27" strokeWidth={0.7} />}
      </g>
    );
  }

  const r = 3.2;
  const ring = 5;
  const circumference = 2 * Math.PI * ring;
  return (
    <g
      className="map-node"
      role="button"
      tabIndex={0}
      aria-label={`${n.label.join(' ')}, danger ${n.danger}, explored ${n.explored}%${n.outpost ? `, the guild has an outpost here${n.outpost === 'damaged' ? ' that needs mending' : ''}` : ''}${n.crewsOut ? `, a crew is there now` : ''}`}
      aria-pressed={selected}
      onClick={pick}
      onKeyDown={onKey}
    >
      <circle cx={x} cy={y} r={7.5} fill="transparent" />
      {selected && <circle cx={x} cy={y} r={ring + 1.6} fill="#a64d27" opacity={0.18} />}
      <circle cx={x} cy={y} r={ring} fill="none" stroke={INK} strokeWidth={0.35} opacity={0.25} />
      {n.explored > 0 && (
        <circle
          cx={x}
          cy={y}
          r={ring}
          fill="none"
          stroke={INK}
          strokeWidth={0.8}
          strokeDasharray={`${(n.explored / 100) * circumference} ${circumference}`}
          transform={`rotate(-90 ${x} ${y})`}
        />
      )}
      <circle cx={x} cy={y} r={r} fill={DANGER_FILL[n.danger - 1] ?? INK} stroke={INK} strokeWidth={0.55} />
      <text x={x} y={y + 1.2} textAnchor="middle" fontSize={3.2} fontWeight={700} fill="#efe6d2">
        {n.danger}
      </text>
      {n.outpost && <Flag x={x - 4.4} y={y - 2.4} damaged={n.outpost === 'damaged'} />}
      {n.crewsOut > 0 && (
        <g>
          <circle cx={x + 4.2} cy={y - 4.2} r={2.1} fill="#a64d27" stroke={INK} strokeWidth={0.4} />
          <text x={x + 4.2} y={y - 3.3} textAnchor="middle" fontSize={2.5} fontWeight={700} fill="#efe6d2">
            {n.crewsOut}
          </text>
        </g>
      )}
      <Label spot={n.spot} lines={n.label} offset={6.6} bold={selected} />
    </g>
  );
}

/** The guild's flag on a pole, planted where it has an outpost. A damaged outpost's flag hangs torn. */
function Flag({ x, y, damaged }: { x: number; y: number; damaged: boolean }) {
  const top = y - 5.4;
  const cloth = damaged ? `M${x} ${top}L${x + 3} ${top + 0.6}L${x + 1.9} ${top + 1.3}L${x + 2.6} ${top + 2.1}L${x} ${top + 2.2}Z` : `M${x} ${top}L${x + 3.4} ${top + 1.1}L${x} ${top + 2.2}Z`;
  return (
    <g aria-hidden="true">
      <path d={cloth} fill={damaged ? '#9aa79f' : '#a64d27'} stroke={INK} strokeWidth={0.35} strokeLinejoin="round" />
      <line x1={x} y1={y} x2={x} y2={top - 0.4} stroke={INK} strokeWidth={0.5} strokeLinecap="round" />
    </g>
  );
}

/** Text next to a marker, on the side the layout asks for. */
function Label({ spot, lines, offset, bold }: { spot: MapSpot; lines: string[]; offset: number; bold?: boolean }) {
  const { x, y, label } = spot;
  const pos: Record<LabelSide, { x: number; y: number; anchor: 'start' | 'middle' | 'end' }> = {
    below: { x, y: y + offset + 2.2, anchor: 'middle' },
    above: { x, y: y - offset - LINE_H * (lines.length - 1), anchor: 'middle' },
    left: { x: x - offset, y: y + 1.2 - (LINE_H * (lines.length - 1)) / 2, anchor: 'end' },
    right: { x: x + offset, y: y + 1.2 - (LINE_H * (lines.length - 1)) / 2, anchor: 'start' },
  };
  const p = pos[label];
  return (
    <text
      className="map-label"
      x={p.x}
      y={p.y}
      textAnchor={p.anchor}
      fontSize={3.2}
      fontWeight={bold ? 700 : 400}
      fill={INK}
      // A paper-coloured halo keeps names readable where a road runs under them.
      stroke={PAPER}
      strokeWidth={1.2}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={p.x} dy={i === 0 ? 0 : LINE_H}>
          {line}
        </tspan>
      ))}
    </text>
  );
}
