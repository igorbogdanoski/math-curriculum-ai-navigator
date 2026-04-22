import { describe, it, expect } from 'vitest';
import {
  isYouTubeUrl,
  isVimeoUrl,
  isVideoUrl,
  parseTimestamp,
  applyTimeRange,
  toBase64,
} from './extractionHubHelpers';

describe('extractionHubHelpers', () => {
  describe('isYouTubeUrl', () => {
    it('accepts canonical youtube.com', () => {
      expect(isYouTubeUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
      expect(isYouTubeUrl('https://youtube.com/watch?v=abc')).toBe(true);
    });
    it('accepts youtu.be short url', () => {
      expect(isYouTubeUrl('https://youtu.be/abc')).toBe(true);
    });
    it('accepts mobile m.youtube.com', () => {
      expect(isYouTubeUrl('https://m.youtube.com/watch?v=abc')).toBe(true);
    });
    it('rejects vimeo, dailymotion, garbage strings', () => {
      expect(isYouTubeUrl('https://vimeo.com/123')).toBe(false);
      expect(isYouTubeUrl('not-a-url')).toBe(false);
      expect(isYouTubeUrl('')).toBe(false);
    });
  });

  describe('isVimeoUrl', () => {
    it('accepts vimeo.com and player.vimeo.com', () => {
      expect(isVimeoUrl('https://vimeo.com/12345')).toBe(true);
      expect(isVimeoUrl('https://player.vimeo.com/video/12345')).toBe(true);
      expect(isVimeoUrl('https://www.vimeo.com/12345')).toBe(true);
    });
    it('rejects youtube + invalid urls', () => {
      expect(isVimeoUrl('https://youtu.be/abc')).toBe(false);
      expect(isVimeoUrl('garbage')).toBe(false);
    });
  });

  describe('isVideoUrl', () => {
    it('returns true for youtube and vimeo, false otherwise', () => {
      expect(isVideoUrl('https://youtu.be/abc')).toBe(true);
      expect(isVideoUrl('https://vimeo.com/1')).toBe(true);
      expect(isVideoUrl('https://example.com/article')).toBe(false);
    });
  });

  describe('parseTimestamp', () => {
    it('parses MM:SS into ms', () => {
      expect(parseTimestamp('1:30')).toBe(90_000);
      expect(parseTimestamp('0:05')).toBe(5_000);
    });
    it('parses HH:MM:SS into ms', () => {
      expect(parseTimestamp('1:00:00')).toBe(3_600_000);
      expect(parseTimestamp('0:02:30')).toBe(150_000);
    });
    it('returns null for malformed input', () => {
      expect(parseTimestamp('abc')).toBeNull();
      expect(parseTimestamp('1:2:3:4')).toBeNull();
      expect(parseTimestamp('')).toBeNull();
    });
  });

  describe('applyTimeRange', () => {
    const caps = {
      transcript: 'fallback',
      segments: [
        { startMs: 0, endMs: 1000, text: 'one' },
        { startMs: 1000, endMs: 2000, text: 'two' },
        { startMs: 2000, endMs: 3000, text: 'three' },
        { startMs: 3000, endMs: 4000, text: 'four' },
      ],
    } as any;

    it('returns full transcript when timeRange is empty', () => {
      expect(applyTimeRange(caps, '')).toBe('fallback');
    });

    it('filters segments by start-end range', () => {
      expect(applyTimeRange(caps, '0:01-0:03')).toBe('two three');
    });

    it('supports en-dash separator', () => {
      expect(applyTimeRange(caps, '0:01–0:03')).toBe('two three');
    });

    it('falls back to transcript when no segments match', () => {
      expect(applyTimeRange(caps, '0:10-0:20')).toBe('fallback');
    });

    it('returns transcript when caps has no segments', () => {
      expect(applyTimeRange({ transcript: 'X', segments: [] } as any, '0:01-0:02')).toBe('X');
    });
  });

  describe('toBase64', () => {
    it('encodes ArrayBuffer of ASCII bytes correctly', () => {
      const buf = new TextEncoder().encode('hello').buffer;
      expect(toBase64(buf)).toBe('aGVsbG8=');
    });
    it('encodes empty buffer as empty string', () => {
      expect(toBase64(new ArrayBuffer(0))).toBe('');
    });
  });
});
