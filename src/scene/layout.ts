/**
 * Where everything sits in the yard drawing: a 400 x 600 canvas, seen from
 * the front like a stage. Things lower down are closer and drawn later.
 */
import type { BuildingId, ProjectId } from '../engine/types.ts';

export const W = 400;
export const H = 600;

/** Ground lines, top to bottom. */
export const Y = {
  skyline: 150,
  back: 190,
  rails: 254,
  middle: 312,
  front: 420,
  parking: 488,
  fence: 514,
  road: 522,
} as const;

export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Each building's patch of ground, also its tap target. */
export const BUILDING_AREAS: Record<BuildingId, Area> = {
  radio_tower: { x: 312, y: 66, w: 78, h: 126 },
  watchtower: { x: 246, y: 100, w: 64, h: 92 },
  bunks: { x: 6, y: 200, w: 196, h: 58 },
  workshop: { x: 200, y: 244, w: 100, h: 72 },
  infirmary: { x: 304, y: 246, w: 92, h: 70 },
  garden: { x: 8, y: 350, w: 146, h: 74 },
  firepit: { x: 158, y: 348, w: 108, h: 78 },
  training_yard: { x: 272, y: 350, w: 124, h: 74 },
};

export type Pose = 'stand' | 'sit' | 'lie' | 'kneel';

export interface Spot {
  x: number;
  /** Where the feet are (or the cot, lying down). */
  y: number;
  pose: Pose;
  /** 1 faces right, -1 faces left. */
  facing: 1 | -1;
}

const s = (x: number, y: number, pose: Pose = 'stand', facing: 1 | -1 = 1): Spot => ({ x, y, pose, facing });

/** Where workers stand at each building, slot by slot. */
export const POST_SPOTS: Record<BuildingId, readonly Spot[]> = {
  bunks: [],
  garden: [s(40, 424, 'kneel'), s(118, 424, 'kneel', -1), s(79, 412, 'stand')],
  firepit: [s(230, 414, 'stand', -1), s(190, 416), s(250, 398, 'stand', -1)],
  workshop: [s(226, 322), s(252, 322), s(278, 322, 'stand', -1)],
  infirmary: [s(318, 322), s(356, 324, 'stand', -1), s(388, 322, 'stand', -1)],
  radio_tower: [s(328, 196), s(350, 198), s(372, 196, 'stand', -1)],
  watchtower: [s(264, 140), s(280, 140), s(296, 140, 'stand', -1)],
  training_yard: [s(300, 422), s(340, 424), s(380, 422, 'stand', -1)],
};

/** Where a project's crew works (§9.6). */
export const PROJECT_SPOTS: Record<ProjectId, readonly Spot[]> = {
  the_relay: [s(52, 198), s(96, 200, 'stand', -1), s(118, 198, 'stand', -1)],
  the_clinic: [s(312, 362), s(336, 364, 'stand', -1), s(366, 362, 'stand', -1)],
  memorial_garden: [s(140, 340, 'kneel'), s(198, 340, 'kneel', -1), s(126, 336)],
  the_line: [s(236, 592), s(262, 594, 'kneel'), s(288, 592, 'stand', -1)],
  the_wall: [s(40, 506), s(128, 508, 'stand', -1), s(300, 506)],
};

/** Hanging out: on the logs around the fire first, then about the yard. */
export const IDLE_SPOTS: readonly Spot[] = [
  s(164, 412, 'sit'),
  s(180, 412, 'sit'),
  s(242, 412, 'sit', -1),
  s(258, 412, 'sit', -1),
  s(202, 428, 'sit'),
  s(220, 428, 'sit', -1),
  s(36, 340),
  s(68, 342, 'stand', -1),
  s(104, 340),
  s(136, 342, 'stand', -1),
  s(56, 456),
  s(98, 458, 'stand', -1),
  s(302, 456),
  s(344, 458, 'stand', -1),
];

/** The children, playing in the open ground in front of the fire. */
export const CHILD_SPOTS: readonly Spot[] = [s(196, 450), s(228, 452, 'stand', -1), s(178, 464), s(246, 466, 'stand', -1), s(212, 474), s(270, 448, 'stand', -1)];

/** Cots for the wounded: in front of the Infirmary, or by the Bunks without one. */
export const REST_SPOTS = {
  infirmary: [s(320, 340, 'lie'), s(352, 340, 'lie'), s(384, 340, 'lie', -1), s(320, 356, 'lie'), s(352, 356, 'lie'), s(384, 356, 'lie', -1)],
  bunks: [s(26, 282, 'lie'), s(58, 282, 'lie'), s(90, 282, 'lie'), s(122, 282, 'lie'), s(154, 282, 'lie'), s(186, 282, 'lie', -1)],
} as const;

/** The queue outside the gate, nearest first. */
export const GATE_SPOTS: readonly Spot[] = [s(152, 568), s(130, 570), s(108, 568), s(86, 570)];

/** Parking in the yard, left to right: the middle of each vehicle. */
export const PARKING_X: readonly number[] = [52, 148, 252, 348];

/** The gate, in the middle of the fence. */
export const GATE = { x: 176, w: 48 } as const;
