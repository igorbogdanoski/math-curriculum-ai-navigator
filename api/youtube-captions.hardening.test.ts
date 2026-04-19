import { beforeEach, describe, expect, it } from 'vitest';
import { __testables } from './youtube-captions';

describe('youtube-captions hardening helpers', () => {
  beforeEach(() => {
    __testables.resetRateLimitState();
  });

  it('enforces per-user 20/minute rate limit', () => {
    const uid = 'captions-user-1';
    for (let i = 0; i < 20; i++) {
      expect(__testables.isRateLimited(uid)).toBe(false);
    }
    expect(__testables.isRateLimited(uid)).toBe(true);
  });

  it('tracks different users independently', () => {
    const userA = 'captions-user-a';
    const userB = 'captions-user-b';

    for (let i = 0; i < 20; i++) {
      __testables.isRateLimited(userA);
    }

    expect(__testables.isRateLimited(userA)).toBe(true);
    expect(__testables.isRateLimited(userB)).toBe(false);
  });

  it('gcIdleBuckets removes buckets whose timestamps are all expired', () => {
    const uid = 'gc-test-user';
    __testables.isRateLimited(uid);
    // Sweep "in the future" so every timestamp is older than the window.
    const removed = __testables.gcIdleBuckets(Date.now() + 120_000);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(__testables.isRateLimited(uid)).toBe(false);
  });
});

describe('youtube-captions parseJson3Events', () => {
  it('joins UTF-8 segments and computes endMs from duration', () => {
    const out = __testables.parseJson3Events([
      { tStartMs: 1000, dDurationMs: 2500, segs: [{ utf8: 'Hello ' }, { utf8: 'world' }] },
      { tStartMs: 4000, dDurationMs: 1000, segs: [{ utf8: 'Foo' }] },
    ]);
    expect(out.transcript).toBe('Hello world Foo');
    expect(out.segments).toEqual([
      { startMs: 1000, endMs: 3500, text: 'Hello world' },
      { startMs: 4000, endMs: 5000, text: 'Foo' },
    ]);
  });

  it('drops empty segments and collapses whitespace', () => {
    const out = __testables.parseJson3Events([
      { tStartMs: 0, dDurationMs: 100, segs: [{ utf8: '\n\n  ' }] },
      { tStartMs: 200, dDurationMs: 100, segs: [{ utf8: 'A\nB' }] },
    ]);
    expect(out.segments).toHaveLength(1);
    expect(out.segments[0].text).toBe('A B');
  });

  it('falls back to start+2500ms when duration is missing', () => {
    const out = __testables.parseJson3Events([
      { tStartMs: 5000, segs: [{ utf8: 'X' }] },
    ]);
    expect(out.segments[0].endMs).toBe(7500);
  });

  it('handles empty event list', () => {
    const out = __testables.parseJson3Events([]);
    expect(out.transcript).toBe('');
    expect(out.segments).toEqual([]);
  });
});

describe('youtube-captions pickTrack', () => {
  it('returns null when no tracks are available', () => {
    expect(__testables.pickTrack([], 'mk')).toBeNull();
  });

  it('prefers manual over auto for the requested language', () => {
    const tracks = [
      { baseUrl: 'a', languageCode: 'mk', kind: 'asr' },
      { baseUrl: 'b', languageCode: 'mk', kind: '' },
    ];
    expect(__testables.pickTrack(tracks, 'mk')?.baseUrl).toBe('b');
  });

  it('falls back to mk manual when preferred lang is missing', () => {
    const tracks = [
      { baseUrl: 'fr', languageCode: 'fr', kind: '' },
      { baseUrl: 'mk', languageCode: 'mk', kind: '' },
    ];
    expect(__testables.pickTrack(tracks, 'de')?.baseUrl).toBe('mk');
  });

  it('falls back to en when neither preferred nor mk is present', () => {
    const tracks = [
      { baseUrl: 'fr', languageCode: 'fr', kind: '' },
      { baseUrl: 'en', languageCode: 'en', kind: '' },
    ];
    expect(__testables.pickTrack(tracks, 'de')?.baseUrl).toBe('en');
  });

  it('normalises language regions (en-US matches en)', () => {
    const tracks = [{ baseUrl: 'enUS', languageCode: 'en-US', kind: '' }];
    expect(__testables.pickTrack(tracks, 'en')?.baseUrl).toBe('enUS');
  });

  it('falls back to first auto track when no manual fits', () => {
    const tracks = [{ baseUrl: 'asr-fr', languageCode: 'fr', kind: 'asr' }];
    expect(__testables.pickTrack(tracks, 'mk')?.baseUrl).toBe('asr-fr');
  });
});

describe('youtube-captions applyTranscriptLimit', () => {
  it('returns the payload unchanged when under the limit', () => {
    const out = __testables.applyTranscriptLimit({ transcript: 'short', segments: [] }, 100);
    expect(out.truncated).toBe(false);
    expect(out.transcript).toBe('short');
  });

  it('truncates and appends marker when over the limit', () => {
    const longText = 'a'.repeat(300);
    const out = __testables.applyTranscriptLimit({ transcript: longText, segments: [] }, 100);
    expect(out.truncated).toBe(true);
    expect(out.transcript.endsWith('…[truncated]')).toBe(true);
    // segment-less path falls back to slice(maxChars), so transcript = 100 chars + marker
    expect(out.transcript.length).toBe(100 + '…[truncated]'.length);
  });

  it('keeps as many full segments as possible when truncating', () => {
    const segments = [
      { startMs: 0, endMs: 1000, text: 'aaaa' },
      { startMs: 1000, endMs: 2000, text: 'bbbb' },
      { startMs: 2000, endMs: 3000, text: 'cccc' },
    ];
    const transcript = 'aaaa bbbb cccc';
    const out = __testables.applyTranscriptLimit({ transcript, segments }, 10); // fits "aaaa bbbb" = 9
    expect(out.truncated).toBe(true);
    expect(out.segments).toHaveLength(2);
    expect(out.transcript.startsWith('aaaa bbbb')).toBe(true);
  });
});
