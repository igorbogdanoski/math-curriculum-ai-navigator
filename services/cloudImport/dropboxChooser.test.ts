import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

async function importFresh() {
  vi.resetModules();
  return import('./dropboxChooser');
}

function installDropboxMock(chosen: { name: string; link: string; bytes: number }[] | 'cancel') {
  document.getElementById = vi.fn().mockReturnValue({}); // pretend the script tag already exists
  (window as any).Dropbox = {
    choose: (options: { success: (files: unknown[]) => void; cancel?: () => void }) => {
      if (chosen === 'cancel') {
        options.cancel?.();
      } else {
        options.success(chosen);
      }
    },
  };
}

describe('pickFromDropbox', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_DROPBOX_APP_KEY', 'test-app-key');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete (window as any).Dropbox;
    vi.restoreAllMocks();
  });

  it('throws CloudImportError when the app key is not configured', async () => {
    vi.stubEnv('VITE_DROPBOX_APP_KEY', '');
    const { pickFromDropbox } = await importFresh();
    await expect(pickFromDropbox()).rejects.toThrow('Dropbox не е конфигуриран.');
  });

  it('resolves null when the user cancels the chooser', async () => {
    installDropboxMock('cancel');
    const { pickFromDropbox } = await importFresh();
    const result = await pickFromDropbox();
    expect(result).toBeNull();
  });

  it('downloads the chosen file and infers mimeType from its extension', async () => {
    installDropboxMock([{ name: 'test-plan.docx', link: 'https://dl.dropboxusercontent.com/x', bytes: 1234 }]);
    const fakeBuffer = new ArrayBuffer(8);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(fakeBuffer) });

    const { pickFromDropbox } = await importFresh();
    const result = await pickFromDropbox();

    expect(result).toEqual({
      name: 'test-plan.docx',
      arrayBuffer: fakeBuffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    expect(fetch).toHaveBeenCalledWith('https://dl.dropboxusercontent.com/x');
  });

  it('throws CloudImportError when the download request fails', async () => {
    installDropboxMock([{ name: 'x.pdf', link: 'https://dl.dropboxusercontent.com/y', bytes: 1 }]);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 });

    const { pickFromDropbox } = await importFresh();
    await expect(pickFromDropbox()).rejects.toThrow(/Dropbox не успеа/);
  });
});
