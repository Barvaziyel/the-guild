/**
 * Keeping the phone's scheduled notices in step with the game (3.7.4). Plain,
 * so Node can test it; `notify.ts` asks the system what it holds and does what
 * this says.
 */
import { noticeNumber, type PlannedNotice } from './runs-view.ts';

/** A notice as the system hands it back: everything it holds, fired ones too. */
export interface HeldNotice {
  id: number;
  schedule?: { at?: unknown };
  extra?: unknown;
}

/** What to tell the system: drop these, schedule those. */
export interface NoticeSync {
  cancel: number[];
  schedule: PlannedNotice[];
}

/**
 * When a held notice is for. Our own copy in `extra.at` first: the system
 * hands its date back as Java writes a date ("Wed Nov 25 09:13:00 GMT+02:00
 * 2026"), which some phones' time zones turn into text no browser can read.
 */
export function heldAt(p: HeldNotice): number | undefined {
  const ours = (p.extra as { at?: unknown } | undefined)?.at;
  if (typeof ours === 'number') return ours;
  const at = p.schedule?.at;
  const t = at instanceof Date ? at.getTime() : typeof at === 'string' || typeof at === 'number' ? new Date(at).getTime() : NaN;
  return Number.isFinite(t) ? t : undefined;
}

/** A notice with no end of its own is old news this long after its time. */
export const LATE_MS = 3_600_000;

/**
 * Whether a notice that just came is old news: Android held it back (a phone
 * left a day, 3.7.4) past the end of what it was about. Read from the `extra`
 * it was scheduled with; one without our time is kept.
 */
export function staleNotice(extra: unknown, now: number): boolean {
  const e = extra as { at?: unknown; until?: unknown } | undefined;
  if (typeof e?.at !== 'number') return false;
  return now > (typeof e.until === 'number' ? e.until : e.at + LATE_MS);
}

/**
 * Make what's held match `wanted`: a held notice the game no longer wants, or
 * wants at another time, is dropped; a wanted one still to come that isn't
 * held as it stands is scheduled. A held notice whose time can't be read is
 * dropped and planned again, rather than trusted.
 */
export function syncNotices(held: readonly HeldNotice[], wanted: readonly PlannedNotice[], now: number): NoticeSync {
  const byNumber = new Map(wanted.map((n) => [noticeNumber(n.id), n]));
  const kept = new Set<number>();
  const cancel: number[] = [];
  for (const p of held) {
    const n = byNumber.get(p.id);
    const at = heldAt(p);
    if (n && at !== undefined && Math.abs(at - n.at) <= 60_000) kept.add(p.id);
    else cancel.push(p.id);
  }
  const schedule = wanted.filter((n) => !kept.has(noticeNumber(n.id)) && n.at > now + 1000);
  return { cancel, schedule };
}
