import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchVideoPreview, normalizeSupportedVideoUrl } from './videoPreview';

describe('normalizeSupportedVideoUrl', () => {
  it('normalizes a YouTube watch URL', () => {
    expect(normalizeSupportedVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      provider: 'youtube',
      videoId: 'dQw4w9WgXcQ',
      normalizedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    });
  });

  it('normalizes a short YouTube URL', () => {
    expect(normalizeSupportedVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      provider: 'youtube',
      videoId: 'dQw4w9WgXcQ',
      normalizedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    });
  });

  it('normalizes a Vimeo URL', () => {
    expect(normalizeSupportedVideoUrl('https://vimeo.com/123456789')).toEqual({
      provider: 'vimeo',
      normalizedUrl: 'https://vimeo.com/123456789',
      embedUrl: 'https://player.vimeo.com/video/123456789',
    });
  });

  it('returns null for unsupported URLs', () => {
    expect(normalizeSupportedVideoUrl('https://example.com/video/abc')).toBeNull();
  });
});

describe('fetchVideoPreview', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and maps YouTube oEmbed data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: '  Demo lesson  ',
        author_name: 'Teacher A',
        thumbnail_url: 'https://img.youtube.com/example.jpg',
      }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await fetchVideoPreview('https://youtu.be/dQw4w9WgXcQ');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('youtube.com/oembed');
    expect(result).toEqual({
      provider: 'youtube',
      videoId: 'dQw4w9WgXcQ',
      title: 'Demo lesson',
      authorName: 'Teacher A',
      thumbnailUrl: 'https://img.youtube.com/example.jpg',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      normalizedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
  });

  it('falls back to default title when oEmbed title is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await fetchVideoPreview('https://vimeo.com/123456789');
    expect(result.title).toBe('Видео лекција');
  });

  it('throws for unsupported URL', async () => {
    await expect(fetchVideoPreview('https://example.com/video/abc')).rejects.toThrow(
      'Поддржани се само YouTube или Vimeo URL линкови.',
    );
  });

  it('throws when oEmbed request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await expect(fetchVideoPreview('https://vimeo.com/123456789')).rejects.toThrow(
      'Не можам да вчитам preview за овој видео URL.',
    );
  });
});