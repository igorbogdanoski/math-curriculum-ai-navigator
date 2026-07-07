import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createStandardPublicClientApplication } = vi.hoisted(() => ({
  createStandardPublicClientApplication: vi.fn().mockResolvedValue({}),
}));

vi.mock('@azure/msal-browser', () => ({
  createStandardPublicClientApplication: (...args: unknown[]) => createStandardPublicClientApplication(...args),
}));

async function importFresh() {
  vi.resetModules();
  return import('./msalClient');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VITE_ONEDRIVE_CLIENT_ID', 'test-client-id');
});

describe('getMsalInstance', () => {
  it('points redirectUri at the dedicated blank page, not the SPA root', async () => {
    const { getMsalInstance } = await importFresh();
    await getMsalInstance();

    const config = createStandardPublicClientApplication.mock.calls[0][0] as { auth: { redirectUri: string } };
    expect(config.auth.redirectUri).toBe(`${window.location.origin}/msal-redirect.html`);
  });

  it('caches the instance across calls', async () => {
    const { getMsalInstance } = await importFresh();
    const a = await getMsalInstance();
    const b = await getMsalInstance();

    expect(a).toBe(b);
    expect(createStandardPublicClientApplication).toHaveBeenCalledTimes(1);
  });
});
