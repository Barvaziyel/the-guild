/**
 * Composes a survivor's portrait from layered SVG parts. The same survivor
 * always gets the same face; what they wear, carry and have lived through is
 * drawn on top. Returns an SVG string, so it works in the browser and in Node.
 */
import { STRESS_HIGH } from '../engine/constants.ts';
import { Rng } from '../engine/rng.ts';
import type { Survivor } from '../engine/types.ts';
import {
  BROW_COUNT,
  EYE_COUNT,
  FACES,
  MOUTH_COUNT,
  NOSE_COUNT,
  brows,
  ears,
  eyes,
  facePath,
  facialHair,
  head,
  mouth,
  neck,
  nose,
  path,
  wrinkles,
  type FaceShape,
} from './face.ts';
import { HAIR_COUNT, HAIR_STYLES, hair } from './hair.ts';
import {
  ARMOR_LOOKS,
  CLOTHES,
  CLOTHES_COUNT,
  TOOL_LOOKS,
  TRINKET_LOOKS,
  WEAPON_LOOKS,
  outfit,
  type Accessory,
  type ArmorLook,
  type ToolLook,
  type TrinketLook,
  type WeaponLook,
} from './outfit.ts';
import { burns, eyeBags, eyepatch, faceScar, headBandage, plaster, sickTint, sockets, strain } from './overlays.ts';
import { CLOTH, GREY_HAIR, HAIR, IRIS, PAPER, SKIN, WASHES, type HairColor, type SkinTone } from './palette.ts';

/** Facial hair by pronoun. Index with appearance.facialHair. 0 = none. */
const FACIAL_HAIR_HE = [0, 0, 0, 0, 1, 1, 2, 3, 4, 5, 6] as const;

const CLIPPED_FACIAL_HAIR: readonly number[] = [1, 6];

/** Layers from back to front. Each is a <g data-layer="..."> in the output. */
export const LAYERS = [
  'background',
  'hair-back',
  'behind',
  'neck',
  'body',
  'head',
  'skin-marks',
  'features',
  'face-marks',
  'hair',
  'headgear',
  'strain',
] as const;
export type LayerName = (typeof LAYERS)[number];

/** Every choice that goes into a portrait, resolved from the survivor. */
export interface PortraitLook {
  face: FaceShape;
  skin: SkinTone;
  hairColor: HairColor;
  hairStyle: (typeof HAIR_STYLES)[number];
  hairIndex: number;
  eyes: number;
  iris: string;
  brows: number;
  nose: number;
  mouth: number;
  facialHair: number;
  clothes: (typeof CLOTHES)[number];
  clothesIndex: number;
  clothColor: string;
  accentColor: string;
  wash: string;
  shoulders: number;
  neckWidth: number;
  accessory: Accessory;
  /** Which side scars and wounds sit on: -1 or 1. */
  side: number;
  aged: boolean;
  armor?: ArmorLook;
  weapon?: WeaponLook;
  tool?: ToolLook;
  trinket?: TrinketLook;
  marks: {
    lostEye: boolean;
    faceScar: boolean;
    burns: boolean;
    wounded: boolean;
    badlyWounded: boolean;
    sick: boolean;
    haunted: boolean;
    weary: boolean;
    strained: boolean;
  };
}

export function portraitLook(s: Survivor): PortraitLook {
  const a = s.appearance;
  // Details the appearance record doesn't spell out come from its seed.
  const rng = new Rng(`portrait:${a.seed}`);
  const wash = rng.pick(WASHES);
  const clothColor = rng.pick(CLOTH);
  const accentColor = rng.pick(CLOTH.filter((c) => c !== clothColor));
  const clothesIndex = rng.int(0, CLOTHES_COUNT - 1);
  const shoulders = 0.92 + rng.next() * 0.16 + (s.pronouns === 'he' ? 0.03 : 0);
  const neckWidth = 31 + rng.int(0, 5) + (s.pronouns === 'he' ? 3 : 0);
  const accessory = rng.weighted<Accessory>([
    { item: 'none', weight: 62 },
    { item: 'goggles', weight: 13 },
    { item: 'bandana', weight: 14 },
    { item: 'beanie', weight: 11 },
  ]);
  const side = rng.chance(0.5) ? 1 : -1;
  const iris = rng.pick(IRIS);
  const greying = rng.next();

  let hairColor = HAIR[a.hairColor % HAIR.length]!;
  if (s.age >= 60 || (s.age >= 46 && greying < (s.age - 40) / 25)) {
    hairColor = GREY_HAIR[a.hairColor % GREY_HAIR.length]!;
  }

  const facial = s.pronouns === 'he' ? FACIAL_HAIR_HE[a.facialHair % FACIAL_HAIR_HE.length]! : 0;

  // Only what the player can see: hidden traits never show.
  const has = (id: string): boolean => s.traits.some((t) => t.id === id && !t.hidden);
  const strained = s.stress >= STRESS_HIGH;
  const hairIndex = a.hairStyle % HAIR_COUNT;

  const look: PortraitLook = {
    face: FACES[a.faceShape % FACES.length]!,
    skin: SKIN[a.skinTone % SKIN.length]!,
    hairColor,
    hairStyle: HAIR_STYLES[hairIndex]!,
    hairIndex,
    eyes: a.eyes % EYE_COUNT,
    iris,
    brows: a.brows % BROW_COUNT,
    nose: a.nose % NOSE_COUNT,
    mouth: a.mouth % MOUTH_COUNT,
    facialHair: facial,
    clothes: CLOTHES[clothesIndex]!,
    clothesIndex,
    clothColor,
    accentColor,
    wash,
    shoulders,
    neckWidth,
    accessory,
    side,
    aged: s.age >= 50,
    marks: {
      lostEye: has('lost_eye'),
      faceScar: has('scarred_face'),
      burns: has('burn_scars'),
      wounded: has('wounded'),
      badlyWounded: has('badly_wounded'),
      sick: has('rad_sickness') || has('feverish'),
      haunted: has('haunted'),
      weary: has('grieving') || has('exhausted') || strained,
      strained,
    },
  };
  const eq = s.equipment;
  const armor = eq.armor && ARMOR_LOOKS[eq.armor.defId];
  const weapon = eq.weapon && WEAPON_LOOKS[eq.weapon.defId];
  const tool = eq.tool && TOOL_LOOKS[eq.tool.defId];
  const trinket = eq.trinket && TRINKET_LOOKS[eq.trinket.defId];
  if (armor) look.armor = armor;
  if (weapon) look.weapon = weapon;
  if (tool) look.tool = tool;
  if (trinket) look.trinket = trinket;
  return look;
}

export interface PortraitOptions {
  /** Width and height in px. Omit to let CSS size it. */
  size?: number;
  /** Hand-drawn wobble on the lines (an SVG filter). Default true. */
  wobble?: boolean;
  /** Paper and watercolor wash behind the figure. Default true. */
  background?: boolean;
  /** Faded, for the Memorial Wall. */
  memorial?: boolean;
}

/** The portrait's layers as SVG fragments, back to front. */
export function portraitLayers(s: Survivor, look = portraitLook(s)): Record<LayerName, string> {
  const { face: f, skin, marks, side } = look;
  const uid = `p${s.appearance.seed.toString(36)}`;
  const rnd = new Rng(`hair:${s.appearance.seed}`);
  const locks = hair(look.hairIndex, f, look.hairColor, () => rnd.next());
  const spec = {
    clothes: look.clothesIndex,
    sw: look.shoulders,
    color: look.clothColor,
    accent: look.accentColor,
    skin,
    face: f,
    accessory: look.accessory,
    ...(look.armor ? { armor: look.armor } : {}),
    ...(look.weapon ? { weapon: look.weapon } : {}),
    ...(look.tool ? { tool: look.tool } : {}),
    ...(look.trinket ? { trinket: look.trinket } : {}),
  };
  const worn = outfit(spec);
  const lostSide = marks.lostEye ? side : 0;
  const clip = `clip-path="url(#${uid}-face)"`;

  let hairBack = worn.coversAllHair ? '' : locks.back;
  // Under a hat, only the hair below the brim shows.
  if (hairBack && worn.coversHair) hairBack = `<g clip-path="url(#${uid}-brim)">${hairBack}</g>`;

  let skinMarks = '';
  if (marks.burns) skinMarks += burns(f, -side);
  if (marks.sick) skinMarks += sickTint(f);
  if (marks.haunted) skinMarks += sockets(f);

  let faceMarks = '';
  if (look.aged) faceMarks += wrinkles(f);
  if (marks.weary) faceMarks += eyeBags(f, lostSide);
  if (marks.faceScar) faceMarks += faceScar(f, skin, -side);
  // A head bandage can't go over a helmet or hood, so those get plasters instead.
  const bandageFits = marks.badlyWounded && !worn.coversHair;
  if (marks.wounded || (marks.badlyWounded && !bandageFits)) faceMarks += plaster(f, side);

  let headgear = worn.headgear;
  if (bandageFits) headgear += headBandage(f, side);
  if (marks.lostEye) headgear += eyepatch(f, side);

  return {
    background: `<rect width="256" height="256" fill="${PAPER}"/><g filter="url(#${uid}-wash)"><circle cx="128" cy="120" r="94" fill="${look.wash}" opacity="0.62"/><circle cx="112" cy="104" r="62" fill="${look.wash}" opacity="0.3"/></g>`,
    'hair-back': hairBack,
    behind: worn.behind,
    neck: neck(f, skin, look.neckWidth),
    body: worn.body,
    head: ears(f, skin) + head(f, skin),
    'skin-marks': skinMarks ? `<g ${clip}>${skinMarks}</g>` : '',
    features:
      eyes(f, look.eyes, look.iris, lostSide) +
      brows(f, look.brows, look.hairColor, lostSide) +
      nose(look.nose) +
      // Stubble and sideburns stay inside the outline of the face; beards grow past it.
      (CLIPPED_FACIAL_HAIR.includes(look.facialHair)
        ? `<g ${clip}>${facialHair(f, look.facialHair, look.hairColor)}</g>`
        : facialHair(f, look.facialHair, look.hairColor)) +
      mouth(f, look.mouth, skin),
    'face-marks': faceMarks,
    hair: worn.coversAllHair ? '' : (worn.coversHair ? '' : locks.top) + locks.front,
    headgear,
    strain: marks.strained ? strain(f, side) : '',
  };
}

/** A survivor's portrait as a complete SVG document. */
export function portraitSvg(s: Survivor, opts: PortraitOptions = {}): string {
  const look = portraitLook(s);
  const layers = portraitLayers(s, look);
  const uid = `p${s.appearance.seed.toString(36)}`;
  const wobble = opts.wobble !== false;
  const showBackground = opts.background !== false;
  const seed = s.appearance.seed % 997;

  const defs =
    `<clipPath id="${uid}-face">${path(facePath(look.face), '')}</clipPath>` +
    `<clipPath id="${uid}-brim"><rect x="0" y="94" width="256" height="162"/></clipPath>` +
    `<filter id="${uid}-wash" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="30"/></filter>` +
    (wobble
      ? `<filter id="${uid}-ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="2.6"/></filter>`
      : '') +
    (opts.memorial ? `<filter id="${uid}-faded"><feColorMatrix type="saturate" values="0.12"/></filter>` : '');

  let figure = '';
  for (const name of LAYERS) {
    if (name === 'background') continue;
    figure += `<g data-layer="${name}">${layers[name]}</g>`;
  }
  const body =
    (showBackground ? `<g data-layer="background">${layers.background}</g>` : '') +
    `<g stroke-linecap="round" stroke-linejoin="round"${wobble ? ` filter="url(#${uid}-ink)"` : ''}>${figure}</g>`;

  const size = opts.size ? ` width="${opts.size}" height="${opts.size}"` : '';
  const name = `${s.firstName} ${s.lastName}`.replace(/[<>&"]/g, '');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"${size} role="img" aria-label="Portrait of ${name}">` +
    `<defs>${defs}</defs>` +
    (opts.memorial ? `<g filter="url(#${uid}-faded)" opacity="0.8">${body}</g>` : body) +
    '</svg>'
  );
}
