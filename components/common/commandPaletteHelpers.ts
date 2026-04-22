/**
 * S37-D1 — Pure, framework-free helpers for CommandPalette 2.0.
 *
 * Extracted to enable unit-testing the recent-items LRU and the
 * keyboard-cursor wrap logic without mounting React + Fuse.js.
 */

export const RECENT_KEY = 'cmd_palette_recent_v1';
export const MAX_RECENT = 5;

export interface RecentEntry {
  label: string;
  path: string;
  icon: string;
}

/** Compute the next recent-list given an incoming item. Pure (no I/O). */
export function nextRecent(prev: readonly RecentEntry[], item: RecentEntry): RecentEntry[] {
  const filtered = prev.filter((r) => r.path !== item.path);
  return [item, ...filtered].slice(0, MAX_RECENT);
}

/** Read recent entries from a storage-like adapter (defaults to localStorage). */
export function readRecent(storage?: Pick<Storage, 'getItem'>): RecentEntry[] {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!s) return [];
    const raw = s.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is RecentEntry =>
      !!e && typeof e === 'object'
      && typeof (e as RecentEntry).label === 'string'
      && typeof (e as RecentEntry).path === 'string',
    );
  } catch {
    return [];
  }
}

/** Persist recent entries through a storage-like adapter. */
export function writeRecent(entries: readonly RecentEntry[], storage?: Pick<Storage, 'setItem'>): void {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!s) return;
    s.setItem(RECENT_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)));
  } catch {
    /* storage full / private mode — silently degrade */
  }
}

/** Wrap-around cursor index (▲▼ in command list). */
export function nextCursor(currentIdx: number, direction: 1 | -1, total: number): number {
  if (total <= 0) return 0;
  return (currentIdx + direction + total) % total;
}
