/**
 * Coming home (3.7.0). Aviel: "When you get back from a run there should be some effects satisfying
 * that clearly show what was brought back including what they took with them (ammo etc)". The
 * report opens on what the crew took, what they used up out there, and what they brought back; the
 * first time it's opened, what came back flies home: supplies to the Depot's tab, gear to the Gear tab. Plain, tested; `components/Homecoming.tsx` plays it.
 */
import { RESOURCE_IDS, type ItemInstance, type ResourceId, type RunReport } from '../engine/index.ts';
import { supplyChips, type Chip } from './glyphs.ts';

type Amounts = Partial<Record<ResourceId, number>>;

export interface Homecoming {
  /** What they set out with: meds, ammo, rations, gas, and goods to trade. */
  took: Chip[];
  /** What of that didn't come back: used up, or traded away. */
  used: Chip[];
  /** What came home: what they found or traded for, and what they didn't use. */
  back: Chip[];
  /** The same, by supply, for the stores to count up by. */
  backBy: Amounts;
  items: { uid: string; defId: string; quality: ItemInstance['quality']; name: string }[];
  /** Nothing went out and nothing came back: nothing to show. */
  empty: boolean;
}

/** What a report says went out and came back. Older reports don't know the rations and gas. */
export function homecoming(report: RunReport, itemName: (item: ItemInstance) => string): Homecoming {
  const { plan, summary: s } = report;
  const took: Amounts = { meds: plan.meds, ammo: plan.ammo };
  if (report.packed) {
    took.rations = report.packed.rations;
    took.gas = report.packed.gas;
  }
  if (plan.trade) took[plan.trade.give] = (took[plan.trade.give] ?? 0) + plan.trade.amount;
  const left: Amounts = { meds: s.medsLeft, ammo: s.ammoLeft };
  const used: Amounts = {};
  const back: Amounts = {};
  for (const r of RESOURCE_IDS) {
    used[r] = Math.max(0, (took[r] ?? 0) - (left[r] ?? 0));
    back[r] = (s.loot[r] ?? 0) + (left[r] ?? 0);
  }
  const items = s.items.map((i) => ({ uid: i.uid, defId: i.defId, quality: i.quality, name: itemName(i) }));
  const backChips = supplyChips(back, { sign: true });
  const tookChips = supplyChips(took);
  return {
    took: tookChips,
    used: supplyChips(used, { tone: 'bad' }),
    back: backChips,
    backBy: Object.fromEntries(RESOURCE_IDS.filter((r) => (back[r] ?? 0) > 0).map((r) => [r, back[r]!])),
    items,
    empty: tookChips.length === 0 && backChips.length === 0 && items.length === 0,
  };
}

// ---------------------------------------------------------------- the timing

/** When each part shows, in ms from opening the report: what they took, then what they used, then each thing back, one by one. */
export const HOME_TOOK_AT = 150;
export const HOME_USED_AT = 650;
export const HOME_BACK_AT = 1150;
/** Between one thing coming back and the next. */
export const HOME_STEP = 160;
/** How long a thing takes to fly into the stores, after it pops up. */
export const HOME_FLY_AFTER = 550;
export const HOME_FLY_MS = 600;

export interface Flight {
  /** A supply, or an item's uid. */
  key: string;
  kind: 'supply' | 'item';
  /** When it pops up in the *Back* row, and when it lands in the stores. */
  showAt: number;
  landAt: number;
}

/** Every thing back, in the order shown: supplies first, then gear. */
export function flights(h: Homecoming): Flight[] {
  const keys: { key: string; kind: Flight['kind'] }[] = [
    ...RESOURCE_IDS.filter((r) => h.backBy[r] !== undefined).map((r) => ({ key: r as string, kind: 'supply' as const })),
    ...h.items.map((i) => ({ key: i.uid, kind: 'item' as const })),
  ];
  return keys.map((k, i) => {
    const showAt = HOME_BACK_AT + i * HOME_STEP;
    return { ...k, showAt, landAt: showAt + HOME_FLY_AFTER + HOME_FLY_MS };
  });
}
