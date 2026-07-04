import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../utils/loadScript', () => ({
  loadScript: vi.fn().mockResolvedValue(undefined),
}));

async function importFresh() {
  vi.resetModules();
  return import('./googleDrivePicker');
}

function installGoogleMocks(pickedDoc: { id: string; name: string; mimeType: string } | null) {
  (window as any).gapi = { load: (_name: string, cb: () => void) => cb() };

  class FakeDocsView {
    setIncludeFolders() { return this; }
    setSelectFolderEnabled() { return this; }
  }
  class FakePickerBuilder {
    private callback: ((data: unknown) => void) | null = null;
    addView() { return this; }
    setOAuthToken() { return this; }
    setDeveloperKey() { return this; }
    setCallback(cb: (data: unknown) => void) { this.callback = cb; return this; }
    build() {
      const callback = this.callback!;
      return {
        setVisible: () => {
          if (pickedDoc) {
            callback({ action: 'picked', docs: [pickedDoc] });
          } else {
            callback({ action: 'cancel' });
          }
        },
      };
    }
  }
  (window as any).google = {
    accounts: {
      oauth2: {
        initTokenClient: (opts: { callback: (resp: unknown) => void }) => {
          const client = {
            callback: opts.callback,
            requestAccessToken: () => client.callback({ access_token: 'fake-token' }),
          };
          return client;
        },
      },
    },
    picker: {
      DocsView: FakeDocsView,
      PickerBuilder: FakePickerBuilder,
      Action: { PICKED: 'picked', CANCEL: 'cancel' },
    },
  };
}

describe('pickFromGoogleDrive', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_DRIVE_CLIENT_ID', 'test-client-id');
    vi.stubEnv('VITE_GOOGLE_DRIVE_API_KEY', 'test-api-key');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete (window as any).google;
    delete (window as any).gapi;
  });

  it('throws CloudImportError when env vars are not configured', async () => {
    vi.stubEnv('VITE_GOOGLE_DRIVE_CLIENT_ID', '');
    vi.stubEnv('VITE_GOOGLE_DRIVE_API_KEY', '');
    const { pickFromGoogleDrive } = await importFresh();
    await expect(pickFromGoogleDrive()).rejects.toThrow('Google Drive не е конфигуриран.');
  });

  it('resolves null when the user cancels the picker', async () => {
    installGoogleMocks(null);
    const { pickFromGoogleDrive } = await importFresh();
    const result = await pickFromGoogleDrive();
    expect(result).toBeNull();
  });

  it('downloads a regular file via alt=media and preserves its mimeType', async () => {
    installGoogleMocks({ id: 'file-1', name: 'worksheet.pdf', mimeType: 'application/pdf' });
    const fakeBuffer = new ArrayBuffer(8);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(fakeBuffer) });

    const { pickFromGoogleDrive } = await importFresh();
    const result = await pickFromGoogleDrive();

    expect(result).toEqual({ name: 'worksheet.pdf', arrayBuffer: fakeBuffer, mimeType: 'application/pdf' });
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('alt=media');
  });

  it('exports native Google Docs as .docx via the export endpoint', async () => {
    installGoogleMocks({ id: 'file-2', name: 'Лекција', mimeType: 'application/vnd.google-apps.document' });
    const fakeBuffer = new ArrayBuffer(4);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(fakeBuffer) });

    const { pickFromGoogleDrive } = await importFresh();
    const result = await pickFromGoogleDrive();

    expect(result?.name).toBe('Лекција.docx');
    expect(result?.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/export?mimeType=');
  });

  it('throws CloudImportError when the download request fails', async () => {
    installGoogleMocks({ id: 'file-3', name: 'x.pdf', mimeType: 'application/pdf' });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 403 });

    const { pickFromGoogleDrive } = await importFresh();
    await expect(pickFromGoogleDrive()).rejects.toThrow(/Google Drive не успеа/);
  });
});
