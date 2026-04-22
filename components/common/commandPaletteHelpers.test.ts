import { describe, it, expect } from 'vitest';
import {
  nextRecent, readRecent, writeRecent, nextCursor, RECENT_KEY, MAX_RECENT,
  type RecentEntry,
} from './commandPaletteHelpers';

class MemStorage {
  private data: Record<string, string> = {};
  getItem(k: string) { return this.data[k] ?? null; }
  setItem(k: string, v: string) { this.data[k] = v; }
}

const E = (label: string, path: string): RecentEntry => ({ label, path, icon: 'home' });

describe('commandPaletteHelpers — nextRecent (LRU)', () => {
  it('prepends new item to empty list', () => {
    expect(nextRecent([], E('A','/a'))).toEqual([E('A','/a')]);
  });

  it('moves repeated path to head (deduplicates)', () => {
    const prev = [E('A','/a'), E('B','/b'), E('C','/c')];
    expect(nextRecent(prev, E('B','/b'))).toEqual([E('B','/b'), E('A','/a'), E('C','/c')]);
  });

  it('caps list at MAX_RECENT', () => {
    const prev = Array.from({ length: MAX_RECENT }, (_, i) => E(`L${i}`, `/p${i}`));
    const out = nextRecent(prev, E('NEW','/new'));
    expect(out).toHaveLength(MAX_RECENT);
    expect(out[0]).toEqual(E('NEW','/new'));
  });
});

describe('commandPaletteHelpers — read/writeRecent', () => {
  it('round-trips entries via storage adapter', () => {
    const s = new MemStorage();
    writeRecent([E('A','/a'), E('B','/b')], s);
    expect(readRecent(s)).toEqual([E('A','/a'), E('B','/b')]);
  });

  it('returns [] when storage is empty', () => {
    expect(readRecent(new MemStorage())).toEqual([]);
  });

  it('returns [] on malformed JSON', () => {
    const s = new MemStorage();
    s.setItem(RECENT_KEY, '{not json');
    expect(readRecent(s)).toEqual([]);
  });

  it('filters out invalid entries', () => {
    const s = new MemStorage();
    s.setItem(RECENT_KEY, JSON.stringify([{ label: 'OK', path: '/x', icon: 'home' }, null, { label: 1 }]));
    expect(readRecent(s)).toEqual([{ label: 'OK', path: '/x', icon: 'home' }]);
  });

  it('writeRecent never throws when storage rejects', () => {
    const failing: Pick<Storage, 'setItem'> = {
      setItem() { throw new Error('quota'); },
    };
    expect(() => writeRecent([E('A','/a')], failing)).not.toThrow();
  });
});

describe('commandPaletteHelpers — nextCursor', () => {
  it('wraps around at top', () => {
    expect(nextCursor(0, -1, 5)).toBe(4);
  });
  it('wraps around at bottom', () => {
    expect(nextCursor(4, 1, 5)).toBe(0);
  });
  it('returns 0 for empty list', () => {
    expect(nextCursor(3, 1, 0)).toBe(0);
  });
  it('moves down within bounds', () => {
    expect(nextCursor(2, 1, 5)).toBe(3);
  });
});
