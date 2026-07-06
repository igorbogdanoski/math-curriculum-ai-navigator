import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/loadScript', () => ({
  loadScript: vi.fn().mockResolvedValue(undefined),
}));

async function importFresh() {
  vi.resetModules();
  return import('./oneDrivePicker');
}

let capturedOpenOptions: { advanced?: { redirectUri: string } } | undefined;

function installOneDriveMock(picked: { name: string; downloadUrl: string } | 'cancel') {
  (window as any).OneDrive = {
    open: (options: {
      advanced?: { redirectUri: string };
      success: (response: { value: unknown[] }) => void;
      cancel: () => void;
    }) => {
      capturedOpenOptions = options;
      if (picked === 'cancel') {
        options.cancel();
      } else {
        options.success({ value: [{ name: picked.name, '@microsoft.graph.downloadUrl': picked.downloadUrl }] });
      }
    },
  };
}

describe('pickFromOneDrive', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ONEDRIVE_CLIENT_ID', 'test-client-id');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete (window as any).OneDrive;
  });

  it('throws CloudImportError when the client id is not configured', async () => {
    vi.stubEnv('VITE_ONEDRIVE_CLIENT_ID', '');
    const { pickFromOneDrive } = await importFresh();
    await expect(pickFromOneDrive()).rejects.toThrow('OneDrive не е конфигуриран.');
  });

  it('resolves null when the user cancels the picker', async () => {
    installOneDriveMock('cancel');
    const { pickFromOneDrive } = await importFresh();
    const result = await pickFromOneDrive();
    expect(result).toBeNull();
  });

  it('points the OAuth redirect at the dedicated onedrive-redirect.html page, not the SPA root', async () => {
    installOneDriveMock('cancel');
    const { pickFromOneDrive } = await importFresh();
    await pickFromOneDrive();
    expect(capturedOpenOptions?.advanced?.redirectUri).toBe(`${window.location.origin}/onedrive-redirect.html`);
  });

  it('downloads via the pre-authenticated Graph downloadUrl and infers mimeType', async () => {
    installOneDriveMock({ name: 'annual-plan.pdf', downloadUrl: 'https://graph.microsoft.com/download/x' });
    const fakeBuffer = new ArrayBuffer(8);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(fakeBuffer) });

    const { pickFromOneDrive } = await importFresh();
    const result = await pickFromOneDrive();

    expect(result).toEqual({ name: 'annual-plan.pdf', arrayBuffer: fakeBuffer, mimeType: 'application/pdf' });
    expect(fetch).toHaveBeenCalledWith('https://graph.microsoft.com/download/x');
  });

  it('throws CloudImportError when the download request fails', async () => {
    installOneDriveMock({ name: 'x.docx', downloadUrl: 'https://graph.microsoft.com/download/y' });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 });

    const { pickFromOneDrive } = await importFresh();
    await expect(pickFromOneDrive()).rejects.toThrow(/OneDrive не успеа/);
  });
});
