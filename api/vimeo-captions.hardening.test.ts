import { beforeEach, describe, expect, it } from 'vitest';
import { __testables } from './vimeo-captions';

const { isRateLimited, resetRateLimitState, parseWebVTT, pickBestTrack } = __testables;

describe('vimeo-captions hardening helpers', () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  // ── Rate limiting ──────────────────────────────────────────────────────────

  it('enforces per-user 20/minute rate limit', () => {
    const uid = 'vimeo-user-1';
    for (let i = 0; i < 20; i++) {
      expect(isRateLimited(uid)).toBe(false);
    }
    expect(isRateLimited(uid)).toBe(true);
  });

  it('tracks different users independently', () => {
    const userA = 'vimeo-user-a';
    const userB = 'vimeo-user-b';
    for (let i = 0; i < 20; i++) isRateLimited(userA);
    expect(isRateLimited(userA)).toBe(true);
    expect(isRateLimited(userB)).toBe(false);
  });

  // ── WebVTT parser ──────────────────────────────────────────────────────────

  it('parses standard WebVTT into segments and transcript', () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Добредојде на часот по математика.

2
00:00:05.000 --> 00:00:09.500
Денес ќе учиме за квадратни равенки.
`;
    const result = parseWebVTT(vtt);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].startMs).toBe(1000);
    expect(result.segments[0].endMs).toBe(4000);
    expect(result.segments[0].text).toBe('Добредојде на часот по математика.');
    expect(result.segments[1].startMs).toBe(5000);
    expect(result.transcript).toContain('квадратни равенки');
  });

  it('strips VTT cue tags from text', () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.000
<00:00:01.000><c>Hello</c> world
`;
    const result = parseWebVTT(vtt);
    expect(result.segments[0].text).toBe('Hello world');
  });

  it('handles HH:MM:SS.mmm timestamp format', () => {
    const vtt = `WEBVTT

01:02:03.500 --> 01:02:07.000
Long video cue.
`;
    const result = parseWebVTT(vtt);
    expect(result.segments[0].startMs).toBe((3600 + 120 + 3) * 1000 + 500);
  });

  it('returns empty transcript for empty VTT', () => {
    const result = parseWebVTT('WEBVTT\n\n');
    expect(result.transcript).toBe('');
    expect(result.segments).toHaveLength(0);
  });

  // ── Track picker ───────────────────────────────────────────────────────────

  it('prefers requested language over others', () => {
    const tracks = [
      { uri: '/1', active: true, type: 'captions', language: 'en', link: '/en.vtt' },
      { uri: '/2', active: false, type: 'captions', language: 'mk', link: '/mk.vtt' },
    ];
    const picked = pickBestTrack(tracks, 'mk');
    expect(picked?.language).toBe('mk');
  });

  it('falls back to English when preferred lang is missing', () => {
    const tracks = [
      { uri: '/1', active: true, type: 'captions', language: 'en', link: '/en.vtt' },
      { uri: '/2', active: true, type: 'captions', language: 'fr', link: '/fr.vtt' },
    ];
    const picked = pickBestTrack(tracks, 'mk');
    expect(picked?.language).toBe('en');
  });

  it('excludes non-caption track types (chapters, descriptions)', () => {
    const tracks = [
      { uri: '/1', active: true, type: 'chapters', language: 'en', link: '/ch.vtt' },
      { uri: '/2', active: true, type: 'captions', language: 'en', link: '/cap.vtt' },
    ];
    const picked = pickBestTrack(tracks, 'en');
    expect(picked?.type).toBe('captions');
  });

  it('returns null when no caption/subtitle tracks exist', () => {
    const tracks = [
      { uri: '/1', active: true, type: 'chapters', language: 'en', link: '/ch.vtt' },
    ];
    expect(pickBestTrack(tracks, 'mk')).toBeNull();
  });

  it('returns null for empty track list', () => {
    expect(pickBestTrack([], 'mk')).toBeNull();
  });
});
