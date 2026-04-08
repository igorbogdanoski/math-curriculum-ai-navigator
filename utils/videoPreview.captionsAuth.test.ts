import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAuthMock } = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: getAuthMock,
}));

vi.mock('../firebaseConfig', () => ({
  app: { __test: true },
}));

import { fetchYouTubeCaptions } from './videoPreview';

describe('fetchYouTubeCaptions auth header', () => {
  beforeEach(() => {
    getAuthMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches bearer token when current user exists', async () => {
    const getIdToken = vi.fn().mockResolvedValue('token-abc');
    getAuthMock.mockReturnValue({ currentUser: { getIdToken } });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: true, transcript: 'demo' }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await fetchYouTubeCaptions('yt123', 'mk');

    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/youtube-captions?videoId=yt123&lang=mk',
      { headers: { Authorization: 'Bearer token-abc' } },
    );
    expect(result.available).toBe(true);
  });

  it('does not attach auth header when no current user', async () => {
    getAuthMock.mockReturnValue({ currentUser: null });

    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const result = await fetchYouTubeCaptions('yt401', 'en');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/youtube-captions?videoId=yt401&lang=en',
      { headers: {} },
    );
    expect(result).toEqual({ available: false, reason: 'HTTP 401' });
  });
});
