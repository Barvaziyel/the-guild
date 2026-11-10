/**
 * Everything worn or carried: clothes, armor, weapons, tools, trinkets and
 * headgear. Equipped gear is looked up by its content id; anything without a
 * look here simply isn't drawn.
 */
import { CX, d, n, path, type FaceShape } from './face.ts';
import { BLOOD, BONE, INK, LEATHER, STEEL, darken, lighten, type SkinTone } from './palette.ts';

const SLING = '#80603f';
const ink = (width: number): string => `stroke="${INK}" stroke-width="${width}"`;
const line = (width: number, color = INK): string => `fill="none" stroke="${color}" stroke-width="${width}"`;

/** Shoulders and chest. `sw` scales shoulder width (0.9 narrow .. 1.1 broad). */
function torso(sw: number): string {
  return d`M${CX - 104 * sw},272 C${CX - 102 * sw},224 ${CX - 74 * sw},208 ${CX - 32},200 Q${CX},213 ${CX + 32},200 C${CX + 74 * sw},208 ${CX + 102 * sw},224 ${CX + 104 * sw},272 Z`;
}

/** The two front panels of an open jacket. */
function jacketPanels(sw: number, color: string): string {
  let out = '';
  for (const s of [-1, 1]) {
    out += path(
      d`M${CX + s * 104 * sw},272 C${CX + s * 102 * sw},224 ${CX + s * 74 * sw},208 ${CX + s * 32},200 L${CX + s * 13},272 Z`,
      `fill="${color}" ${ink(2.6)}`,
    );
    // Lapel.
    out += path(
      d`M${CX + s * 32},200 L${CX + s * 44},224 L${CX + s * 24},236 L${CX + s * 20},216 Z`,
      `fill="${darken(color, 0.18)}" ${ink(2)}`,
    );
  }
  return out;
}

export interface OutfitLayers {
  /** Drawn behind the neck and head: hoods, weapons on the back. */
  behind: string;
  /** The body layer. */
  body: string;
  /** Drawn over the face and hair: masks, helmets, hoods. */
  headgear: string;
  /** True if the hair on top of the head should be hidden. */
  coversHair: boolean;
  /** True if everything but the face is hidden (a hood). */
  coversAllHair: boolean;
}

export const CLOTHES = ['tee', 'hoodie', 'jacket', 'tank', 'scarf', 'work shirt', 'patched coat'] as const;
export const CLOTHES_COUNT = CLOTHES.length;

export type ArmorLook = 'leather' | 'scrap' | 'riot' | 'hazmat';
export type WeaponLook = 'pipe' | 'blade' | 'sledge' | 'baton' | 'holster' | 'rifle' | 'crossbow' | 'shotgun';
export type ToolLook = 'binoculars' | 'medkit' | 'geiger' | 'crowbar';
export type TrinketLook = 'tags' | 'coin' | 'foot';
export type Accessory = 'none' | 'goggles' | 'bandana' | 'beanie';

/** Content id -> how it looks. Add a line here when adding gear to the game. */
export const ARMOR_LOOKS: Record<string, ArmorLook> = {
  leather_jacket: 'leather',
  scrap_vest: 'scrap',
  riot_gear: 'riot',
  hazmat_suit: 'hazmat',
};

export const WEAPON_LOOKS: Record<string, WeaponLook> = {
  pipe: 'pipe',
  machete: 'blade',
  sledge: 'sledge',
  shock_baton: 'baton',
  pipe_pistol: 'holster',
  hunting_rifle: 'rifle',
  crossbow: 'crossbow',
  scattergun: 'shotgun',
};

export const TOOL_LOOKS: Record<string, ToolLook> = {
  binoculars: 'binoculars',
  medkit: 'medkit',
  geiger_counter: 'geiger',
  crowbar: 'crowbar',
};

export const TRINKET_LOOKS: Record<string, TrinketLook> = {
  dog_tags: 'tags',
  lucky_coin: 'coin',
  rabbits_foot: 'foot',
};

// ---------------------------------------------------------------- clothes

function clothes(variant: number, sw: number, c1: string, c2: string, skin: SkinTone): { behind: string; body: string } {
  const base = (color: string): string => path(torso(sw), `fill="${color}" ${ink(3)}`);
  const fold = line(1.6, darken(c1, 0.35));
  switch (CLOTHES[variant % CLOTHES_COUNT]) {
    case 'hoodie':
      return {
        behind: path(d`M${CX - 42},208 C${CX - 54},164 ${CX + 54},164 ${CX + 42},208 Z`, `fill="${darken(c1, 0.15)}" ${ink(2.6)}`),
        body:
          base(c1) +
          path(d`M${CX - 34},199 Q${CX - 20},223 ${CX},225 Q${CX + 20},223 ${CX + 34},199`, line(2.4)) +
          path(d`M${CX - 8},224 L${CX - 10},246 M${CX + 8},224 L${CX + 10},246`, line(2.4, BONE)) +
          path(d`M${CX - 70 * sw},226 Q${CX - 62 * sw},240 ${CX - 64 * sw},256`, fold),
      };
    case 'jacket':
      return {
        behind: '',
        body: base(lighten(c2, 0.45)) + path(d`M${CX - 30},205 Q${CX},218 ${CX + 30},205`, line(1.8, darken(c2, 0.2))) + jacketPanels(sw, c1),
      };
    case 'tank':
      return {
        behind: '',
        body:
          path(torso(sw), `fill="${skin.base}" ${ink(3)}`) +
          path(
            d`M${CX - 64 * sw},272 C${CX - 62 * sw},238 ${CX - 42},226 ${CX - 31},201 Q${CX},224 ${CX + 31},201 C${CX + 42},226 ${CX + 62 * sw},238 ${CX + 64 * sw},272 Z`,
            `fill="${c1}" ${ink(2.6)}`,
          ),
      };
    case 'scarf':
      return {
        behind: '',
        body:
          base(c1) +
          path(d`M${CX + 12},218 L${CX + 20},252 L${CX + 34},248 L${CX + 28},214 Z`, `fill="${c2}" ${ink(2.2)}`) +
          path(
            d`M${CX - 37},193 Q${CX},224 ${CX + 37},193 Q${CX + 46},208 ${CX + 27},218 Q${CX},229 ${CX - 27},218 Q${CX - 46},208 ${CX - 37},193 Z`,
            `fill="${c2}" ${ink(2.6)}`,
          ) +
          path(d`M${CX - 30},206 Q${CX},224 ${CX + 30},206 M${CX - 18},217 Q${CX},224 ${CX + 18},217`, line(1.5, darken(c2, 0.35))),
      };
    case 'work shirt': {
      let collar = '';
      for (const s of [-1, 1]) {
        collar += path(d`M${CX + s * 32},200 L${CX + s * 6},213 L${CX + s * 22},227 Z`, `fill="${lighten(c1, 0.2)}" ${ink(2.2)}`);
      }
      return {
        behind: '',
        body:
          base(c1) +
          path(d`M${CX},214 L${CX},272`, line(1.8)) +
          `<circle cx="${CX}" cy="228" r="2.2" fill="${BONE}" ${ink(1.2)}/><circle cx="${CX}" cy="244" r="2.2" fill="${BONE}" ${ink(1.2)}/>` +
          `<rect x="${CX + 28}" y="228" width="24" height="20" rx="2" fill="${darken(c1, 0.1)}" ${ink(1.8)}/>` +
          path(d`M${CX + 28},234 L${CX + 52},234`, line(1.4)) +
          collar,
      };
    }
    case 'patched coat':
      return {
        behind: '',
        body:
          base(c1) +
          `<rect x="${n(CX - 78 * sw)}" y="226" width="22" height="17" rx="1" transform="rotate(-8 ${n(CX - 67 * sw)} 234)" fill="${c2}" stroke="${INK}" stroke-width="1.6" stroke-dasharray="3 2.5"/>` +
          `<rect x="${n(CX + 44 * sw)}" y="234" width="18" height="16" rx="1" transform="rotate(6 ${n(CX + 53 * sw)} 242)" fill="${lighten(c2, 0.3)}" stroke="${INK}" stroke-width="1.6" stroke-dasharray="3 2.5"/>` +
          path(d`M${CX},216 L${CX},272`, line(1.6)) +
          path(
            d`M${CX - 35},201 L${CX - 31},185 Q${CX},200 ${CX + 31},185 L${CX + 35},201 Q${CX},216 ${CX - 35},201 Z`,
            `fill="${darken(c1, 0.2)}" ${ink(2.6)}`,
          ),
      };
    default: // tee
      return {
        behind: '',
        body: base(c1) + path(d`M${CX - 29},206 Q${CX},219 ${CX + 29},206`, line(2, darken(c1, 0.35))) + path(d`M${CX + 66 * sw},228 Q${CX + 60 * sw},242 ${CX + 63 * sw},256`, fold),
      };
  }
}

// ---------------------------------------------------------------- armor

function armor(look: ArmorLook, sw: number, c1: string, f: FaceShape): { behind: string; body: string; headgear: string } {
  switch (look) {
    case 'leather': {
      let seams = '';
      for (const s of [-1, 1]) {
        seams += path(d`M${CX + s * 58 * sw},211 Q${CX + s * 66 * sw},232 ${CX + s * 62 * sw},256`, line(1.6, darken(LEATHER, 0.4)));
        seams += path(d`M${CX + s * 13},222 L${CX + s * 13},272`, `fill="none" stroke="${STEEL}" stroke-width="2" stroke-dasharray="2 2"`);
      }
      return {
        behind: '',
        body: path(torso(sw), `fill="${c1}" ${ink(3)}`) + path(d`M${CX - 29},206 Q${CX},219 ${CX + 29},206`, line(1.8, darken(c1, 0.35))) + jacketPanels(sw, LEATHER) + seams,
        headgear: '',
      };
    }
    case 'scrap': {
      const plate = '#8b6b55';
      const sign = '#c9a23f';
      return {
        behind: '',
        body:
          path(torso(sw), `fill="${c1}" ${ink(3)}`) +
          // Straps.
          path(d`M${CX - 30},202 L${CX - 40},272 M${CX + 30},202 L${CX + 40},272`, line(7)) +
          path(d`M${CX - 30},202 L${CX - 40},272 M${CX + 30},202 L${CX + 40},272`, line(4, LEATHER)) +
          // A car-door plate and half a road sign.
          path(d`M${CX - 68},216 L${CX - 12},211 L${CX - 9},272 L${CX - 73},272 Z`, `fill="${plate}" ${ink(2.6)}`) +
          path(d`M${CX - 62},228 L${CX - 18},224 M${CX - 64},242 L${CX - 16},239`, line(1.4, darken(plate, 0.4))) +
          path(d`M${CX + 11},212 L${CX + 66},217 L${CX + 71},272 L${CX + 9},272 Z`, `fill="${sign}" ${ink(2.6)}`) +
          path(d`M${CX + 20},272 L${CX + 46},214 L${CX + 58},216 L${CX + 34},272 Z`, `fill="${INK}" opacity="0.8"`) +
          [-60, -22, 18, 60]
            .map((x) => `<circle cx="${CX + x}" cy="${x < 0 ? 220 : 222}" r="2.4" fill="${STEEL}" ${ink(1.2)}/>`)
            .join('') +
          // A strip of tire over one shoulder.
          path(
            d`M${CX - 100 * sw},232 C${CX - 98 * sw},212 ${CX - 70 * sw},203 ${CX - 46},203 L${CX - 44},217 C${CX - 62 * sw},218 ${CX - 78 * sw},224 ${CX - 84 * sw},240 Z`,
            `fill="#3a3835" ${ink(2.4)}`,
          ) +
          path(
            d`M${CX - 90 * sw},219 l5,10 M${CX - 80 * sw},212 l5,11 M${CX - 69 * sw},208 l4,11 M${CX - 58},205 l3,12`,
            line(1.6, '#6a6661'),
          ),
        headgear: '',
      };
    }
    case 'riot': {
      const dark = '#3d4650';
      const darker = '#2c333b';
      const W = f.w + 4;
      const T = f.top - 7;
      let pads = '';
      for (const s of [-1, 1]) {
        pads += path(
          d`M${CX + s * 104 * sw},240 C${CX + s * 106 * sw},214 ${CX + s * 80 * sw},200 ${CX + s * 50},201 L${CX + s * 46},218 C${CX + s * 64 * sw},220 ${CX + s * 78 * sw},228 ${CX + s * 82 * sw},244 Z`,
          `fill="${darker}" ${ink(2.6)}`,
        );
      }
      return {
        behind: '',
        body:
          path(torso(sw), `fill="${dark}" ${ink(3)}`) +
          `<rect x="${CX - 44}" y="218" width="88" height="44" rx="6" fill="${darker}" ${ink(2.4)}/>` +
          path(d`M${CX - 44},232 L${CX + 44},232 M${CX - 44},246 L${CX + 44},246`, line(1.4, '#596571')) +
          `<rect x="${CX + 10}" y="221" width="26" height="8" rx="1" fill="${BONE}" opacity="0.85"/>` +
          pads +
          path(
            d`M${CX - 37},203 L${CX - 34},184 Q${CX},197 ${CX + 34},184 L${CX + 37},203 Q${CX},218 ${CX - 37},203 Z`,
            `fill="${darker}" ${ink(2.6)}`,
          ),
        headgear:
          path(
            d`M${CX - W - 3},104 C${CX - W - 6},${T - 9} ${CX + W + 6},${T - 9} ${CX + W + 3},104 L${CX + W - 5},104 L${CX + W - 8},91 Q${CX},79 ${CX - W + 8},91 L${CX - W + 5},104 Z`,
            `fill="${dark}" ${ink(2.8)}`,
          ) +
          path(d`M${CX - 30},${T + 9} Q${CX},${T - 3} ${CX + 30},${T + 9} Q${CX},${T + 19} ${CX - 30},${T + 9} Z`, `fill="#a9bcc0" opacity="0.75" ${ink(1.8)}`) +
          path(d`M${CX - W + 2},88 Q${CX},74 ${CX + W - 2},88`, line(1.4, '#596571')),
      };
    }
    case 'hazmat': {
      const suit = '#c9a23f';
      const rubber = '#4b504c';
      const hoodOuter = d`M${CX - f.w - 15},112 C${CX - f.w - 17},${f.top - 30} ${CX + f.w + 17},${f.top - 30} ${CX + f.w + 15},112 C${CX + f.w + 15},160 ${CX + 30},${f.chinY + 22} ${CX},${f.chinY + 22} C${CX - 30},${f.chinY + 22} ${CX - f.w - 15},160 ${CX - f.w - 15},112 Z`;
      const opening = d`M${CX - f.w + 5},110 C${CX - f.w + 5},${f.top + 16} ${CX + f.w - 5},${f.top + 16} ${CX + f.w - 5},110 C${CX + f.w - 5},146 ${CX + 22},${f.chinY + 2} ${CX},${f.chinY + 2} C${CX - 22},${f.chinY + 2} ${CX - f.w + 5},146 ${CX - f.w + 5},110 Z`;
      return {
        behind: path(hoodOuter, `fill="${darken(suit, 0.18)}" ${ink(2.6)}`),
        body:
          path(torso(sw), `fill="${suit}" ${ink(3)}`) +
          path(d`M${CX},212 L${CX},272`, `fill="none" stroke="${INK}" stroke-width="2.2" stroke-dasharray="3 2"`) +
          path(d`M${CX - 72 * sw},224 Q${CX - 62 * sw},238 ${CX - 66 * sw},256 M${CX + 72 * sw},224 Q${CX + 62 * sw},238 ${CX + 66 * sw},256`, line(1.6, darken(suit, 0.35))) +
          `<ellipse cx="${CX}" cy="204" rx="37" ry="9.5" fill="#7c8482" ${ink(2.4)}/>`,
        headgear:
          // The hood, with an opening for the face.
          `<path d="${hoodOuter} ${opening}" fill-rule="evenodd" fill="${suit}" ${ink(2.6)}/>` +
          path(d`M${CX - f.w - 6},84 Q${CX},${f.top - 20} ${CX + f.w + 6},84`, line(1.5, darken(suit, 0.35))) +
          // Gas mask.
          path(d`M${CX - 25},119 Q${CX},110 ${CX + 25},119 L${CX + 27},146 Q${CX},166 ${CX - 27},146 Z`, `fill="${rubber}" ${ink(2.6)}`) +
          `<circle cx="${CX}" cy="148" r="11.5" fill="#6d736c" ${ink(2.2)}/>` +
          path(d`M${CX - 7},144 L${CX + 7},144 M${CX - 8},148 L${CX + 8},148 M${CX - 7},152 L${CX + 7},152`, line(1.4)) +
          `<circle cx="${CX - 28}" cy="143" r="9" fill="#6d736c" ${ink(2.2)}/><circle cx="${CX - 28}" cy="143" r="4" fill="${rubber}"/>` +
          path(d`M${CX - 24},122 L${CX - f.w + 6},112 M${CX + 24},122 L${CX + f.w - 6},112`, line(3)),
      };
    }
  }
}

// ---------------------------------------------------------------- weapons, tools, trinkets

/** A weapon carried on the back, poking up over the right shoulder. */
function weaponBehind(look: WeaponLook): string {
  const x0 = CX + 60;
  const shaft = (x1: number, y1: number, color: string, width: number): string =>
    path(d`M${x0},240 L${x1},${y1}`, line(width + 4)) + path(d`M${x0},240 L${x1},${y1}`, line(width, color));
  switch (look) {
    case 'rifle':
      return (
        shaft(CX + 79, 104, '#5a5f5f', 4.5) +
        path(d`M${x0 + 3},218 L${CX + 71},162`, line(10)) +
        path(d`M${x0 + 3},218 L${CX + 71},162`, line(6, '#7a5a3c')) +
        path(d`M${CX + 76.5},118 l7,1`, line(2.4))
      );
    case 'shotgun':
      return shaft(CX + 76, 132, '#5a5f5f', 9) + path(d`M${CX + 70},170 l12,2`, line(2.4));
    case 'crossbow':
      return (
        shaft(CX + 78, 120, '#7a5a3c', 5) +
        path(d`M${CX + 50},130 Q${CX + 80},100 ${CX + 108},136`, line(4.5)) +
        path(d`M${CX + 50},130 L${CX + 108},136`, line(1.2))
      );
    case 'blade':
      return path(d`M${CX + 58},240 L${CX + 70},136 Q${CX + 83},122 ${CX + 86},142 L${CX + 72},242 Z`, `fill="${STEEL}" ${ink(2.4)}`) + path(d`M${CX + 74},140 L${CX + 64},232`, line(1.2, BONE));
    case 'sledge':
      return shaft(CX + 77, 128, '#7a5a3c', 6) + path(d`M${CX + 58},111 L${CX + 97},117 L${CX + 95},133 L${CX + 56},127 Z`, `fill="#55595a" ${ink(2.6)}`);
    case 'pipe':
      return path(d`M${x0},240 L${CX + 75},132 L${CX + 92},128`, line(10)) + path(d`M${x0},240 L${CX + 75},132 L${CX + 92},128`, line(6, '#80857f'));
    case 'baton':
      return shaft(CX + 76, 132, '#2f3336', 6) + path(d`M${CX + 73.5},152 L${CX + 76},132`, line(6, '#6fb3c9'));
    case 'holster':
      return '';
  }
}

/** Parts of a weapon that sit in front of the body: slings and holsters. */
function weaponFront(look: WeaponLook, sw: number): string {
  if (look === 'holster') {
    return (
      path(d`M${CX - 34},203 Q${CX - 70 * sw},224 ${CX - 60 * sw},272`, line(6)) +
      path(d`M${CX - 34},203 Q${CX - 70 * sw},224 ${CX - 60 * sw},272`, line(3, LEATHER)) +
      path(d`M${CX - 74 * sw},234 l16,-3 l3,16 l-9,2 l-1,8 l-8,1 Z`, `fill="#3a3d3f" ${ink(2)}`)
    );
  }
  if (look === 'rifle' || look === 'shotgun' || look === 'crossbow') {
    return path(d`M${CX + 46},204 L${CX - 50},272`, line(9)) + path(d`M${CX + 46},204 L${CX - 50},272`, line(5.5, SLING));
  }
  return '';
}

function tool(look: ToolLook, sw: number): string {
  switch (look) {
    case 'binoculars':
      return (
        path(d`M${CX - 24},203 L${CX - 6},236 M${CX + 24},203 L${CX + 6},236`, line(1.6)) +
        `<rect x="${CX - 15}" y="232" width="13" height="18" rx="3" fill="#3a3d3f" ${ink(2)}/><rect x="${CX + 2}" y="232" width="13" height="18" rx="3" fill="#3a3d3f" ${ink(2)}/>` +
        `<rect x="${CX - 3}" y="236" width="6" height="6" fill="#3a3d3f" ${ink(1.4)}/>` +
        `<circle cx="${CX - 8.5}" cy="246" r="3.4" fill="#7fa39a"/><circle cx="${CX + 8.5}" cy="246" r="3.4" fill="#7fa39a"/>`
      );
    case 'medkit':
      return (
        `<g transform="rotate(-7 ${n(CX - 62 * sw)} 242)">` +
        `<rect x="${n(CX - 76 * sw)}" y="231" width="28" height="22" rx="3" fill="${BONE}" ${ink(2.2)}/>` +
        path(d`M${CX - 62 * sw},235 v14 M${CX - 69 * sw},242 h14`, line(4.5, BLOOD)) +
        '</g>'
      );
    case 'geiger':
      return (
        `<rect x="${n(CX + 40 * sw)}" y="230" width="24" height="18" rx="2" fill="#c9a23f" ${ink(2)}/>` +
        `<circle cx="${n(CX + 48 * sw)}" cy="239" r="5" fill="${BONE}" ${ink(1.4)}/>` +
        path(d`M${CX + 48 * sw},239 l3,-3`, line(1.4, BLOOD))
      );
    case 'crowbar':
      return (
        path(d`M${CX - 66},240 L${CX - 84},128 Q${CX - 86},116 ${CX - 76},118`, line(8)) +
        path(d`M${CX - 66},240 L${CX - 84},128 Q${CX - 86},116 ${CX - 76},118`, line(4.5, '#a8603f'))
      );
  }
}

function trinket(look: TrinketLook): string {
  const cord = path(d`M${CX - 22},203 L${CX - 2},230 L${CX + 20},203`, line(1.3));
  switch (look) {
    case 'tags':
      return (
        cord +
        `<rect x="${CX - 8}" y="227" width="9" height="14" rx="2.5" transform="rotate(-10 ${CX - 4} 234)" fill="${STEEL}" ${ink(1.5)}/>` +
        `<rect x="${CX - 3}" y="229" width="9" height="14" rx="2.5" transform="rotate(9 ${CX + 1} 236)" fill="${lighten(STEEL, 0.3)}" ${ink(1.5)}/>`
      );
    case 'coin':
      return cord + `<circle cx="${CX - 2}" cy="235" r="6.5" fill="#c9a23f" ${ink(1.6)}/><circle cx="${CX - 2}" cy="235" r="3" fill="none" stroke="${INK}" stroke-width="0.9" opacity="0.6"/>`;
    case 'foot':
      return cord + path(d`M${CX - 5},229 Q${CX - 9},242 ${CX - 2},248 Q${CX + 5},242 ${CX + 1},229 Z`, `fill="#cdb898" ${ink(1.6)}`) + path(d`M${CX - 4},243 l1,3 M${CX - 1},244 l0,3`, line(1));
  }
}

// ---------------------------------------------------------------- accessories

function accessory(kind: Accessory, f: FaceShape, color: string): { headgear: string; coversHair: boolean } {
  const W = f.w + 4;
  const T = f.top - 7;
  switch (kind) {
    case 'goggles': {
      let lenses = '';
      for (const s of [-1, 1]) {
        lenses += `<circle cx="${CX + s * 15}" cy="${T + 22}" r="10" fill="#3a3d3f" ${ink(2.2)}/><circle cx="${CX + s * 15}" cy="${T + 22}" r="6.5" fill="#86aaa3"/>`;
        lenses += path(d`M${CX + s * 15 - 3.5},${T + 19} l3,-2`, line(1.4, BONE));
      }
      return {
        headgear: path(d`M${CX - W},${T + 31} Q${CX},${T + 12} ${CX + W},${T + 31}`, line(6.5)) + path(d`M${CX - W},${T + 31} Q${CX},${T + 12} ${CX + W},${T + 31}`, line(3.5, LEATHER)) + lenses,
        coversHair: false,
      };
    }
    case 'bandana':
      return {
        headgear:
          path(d`M${CX + f.w - 2},88 l16,-7 l-2,10 l10,2 l-17,6 Z`, `fill="${color}" ${ink(2)}`) +
          path(d`M${CX - f.w - 2},90 Q${CX},${T + 13} ${CX + f.w + 2},90 L${CX + f.w + 2},100 Q${CX},${T + 24} ${CX - f.w - 2},100 Z`, `fill="${color}" ${ink(2.4)}`) +
          path(d`M${CX - 20},${T + 22} Q${CX},${T + 19} ${CX + 20},${T + 22}`, line(1.3, darken(color, 0.4))),
        coversHair: false,
      };
    case 'beanie':
      return {
        headgear:
          path(d`M${CX - W - 1},94 C${CX - W - 4},${T - 8} ${CX + W + 4},${T - 8} ${CX + W + 1},94 Q${CX},82 ${CX - W - 1},94 Z`, `fill="${color}" ${ink(2.6)}`) +
          path(d`M${CX - W - 2},95 Q${CX},82 ${CX + W + 2},95 L${CX + W + 2},84 Q${CX},71 ${CX - W - 2},84 Z`, `fill="${darken(color, 0.2)}" ${ink(2.2)}`) +
          path(d`M${CX - 24},${T + 22} l0,9 M${CX - 8},${T + 19} l0,9 M${CX + 8},${T + 19} l0,9 M${CX + 24},${T + 22} l0,9`, line(1.2, darken(color, 0.5))),
        coversHair: true,
      };
    default:
      return { headgear: '', coversHair: false };
  }
}

// ---------------------------------------------------------------- putting it together

export interface OutfitSpec {
  clothes: number;
  /** Shoulder width scale. */
  sw: number;
  color: string;
  accent: string;
  skin: SkinTone;
  face: FaceShape;
  armor?: ArmorLook;
  weapon?: WeaponLook;
  tool?: ToolLook;
  trinket?: TrinketLook;
  accessory: Accessory;
}

export function outfit(spec: OutfitSpec): OutfitLayers {
  const worn = spec.armor ? armor(spec.armor, spec.sw, spec.color, spec.face) : { ...clothes(spec.clothes, spec.sw, spec.color, spec.accent, spec.skin), headgear: '' };
  // Helmets and hoods replace hats and goggles.
  const extra = worn.headgear ? { headgear: '', coversHair: false } : accessory(spec.accessory, spec.face, spec.accent);

  let behind = worn.behind;
  let body = worn.body;
  if (spec.weapon) {
    behind = weaponBehind(spec.weapon) + behind;
    body += weaponFront(spec.weapon, spec.sw);
  }
  if (spec.trinket) body += trinket(spec.trinket);
  if (spec.tool) body += tool(spec.tool, spec.sw);

  return {
    behind,
    body,
    headgear: worn.headgear + extra.headgear,
    coversHair: spec.armor === 'riot' || spec.armor === 'hazmat' || extra.coversHair,
    coversAllHair: spec.armor === 'hazmat',
  };
}
