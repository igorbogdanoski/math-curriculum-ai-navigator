import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { acquireTokenSilent, acquireTokenPopup, getActiveAccount, getAllAccounts, setActiveAccount } = vi.hoisted(() => ({
  acquireTokenSilent: vi.fn(),
  acquireTokenPopup: vi.fn(),
  getActiveAccount: vi.fn(),
  getAllAccounts: vi.fn(),
  setActiveAccount: vi.fn(),
}));

vi.mock('./msalClient', () => ({
  getMsalInstance: vi.fn().mockResolvedValue({
    acquireTokenSilent,
    acquireTokenPopup,
    getActiveAccount,
    getAllAccounts,
    setActiveAccount,
  }),
}));

async function importFresh() {
  vi.resetModules();
  return import('./oneDrivePicker');
}

function createFakePort() {
  const listeners: Array<(e: { data: unknown }) => void> = [];
  return {
    addEventListener: vi.fn((type: string, cb: (e: { data: unknown }) => void) => {
      if (type === 'message') listeners.push(cb);
    }),
    start: vi.fn(),
    postMessage: vi.fn(),
    dispatch(data: unknown) { listeners.forEach((l) => l({ data })); },
  };
}

function createFakePopup() {
  const el = () => ({ setAttribute: vi.fn(), appendChild: vi.fn(), submit: vi.fn() });
  return {
    closed: false,
    close: vi.fn(function (this: { closed: boolean }) { this.closed = true; }),
    document: { body: { append: vi.fn() }, createElement: vi.fn(el) },
  };
}

/** Captures 'message' listeners registered on `window` without touching any other event type. */
function captureWindowMessageListeners() {
  const listeners: Array<(e: unknown) => void> = [];
  const original = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type: string, cb: unknown, ...rest: unknown[]) => {
    if (type === 'message') listeners.push(cb as (e: unknown) => void);
    else (original as (...a: unknown[]) => void)(type, cb, ...rest);
  });
  return listeners;
}

describe('pickFromOneDrive', () => {
  let popup: ReturnType<typeof createFakePopup>;
  let windowMessageListeners: Array<(e: unknown) => void>;

  beforeEach(() => {
    vi.stubEnv('VITE_ONEDRIVE_CLIENT_ID', 'test-client-id');
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('crypto', { randomUUID: () => 'fixed-channel-id' });
    popup = createFakePopup();
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    windowMessageListeners = captureWindowMessageListeners();

    getActiveAccount.mockReturnValue(null);
    getAllAccounts.mockReturnValue([]);
    acquireTokenSilent.mockRejectedValue(new Error('no cached account'));
    acquireTokenPopup.mockResolvedValue({ accessToken: 'popup-token', account: { homeAccountId: 'acc1' } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    // NOT vi.restoreAllMocks() — the `./msalClient` mock factory (registered once via vi.mock,
    // not re-created per vi.resetModules()) would get wiped for every subsequent test, since
    // its `getMsalInstance` mock is a single shared instance across the whole file.
  });

  function mockDriveInfo(webUrl: string) {
    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(async (url: string) => {
      expect(url).toBe('https://graph.microsoft.com/v1.0/me/drive');
      return { ok: true, json: async () => ({ webUrl }) };
    });
  }

  /** Drives the initialize → activate handshake and returns the fake port for further commands. */
  async function completeHandshake(): Promise<ReturnType<typeof createFakePort>> {
    // Let the async form-post token acquisition + navigation complete before the handshake fires.
    await new Promise((r) => setTimeout(r, 0));
    const port = createFakePort();
    windowMessageListeners.forEach((l) => l({ source: popup, data: { type: 'initialize', channelId: 'fixed-channel-id' }, ports: [port] }));
    return port;
  }

  it('throws CloudImportError when the client id is not configured', async () => {
    vi.stubEnv('VITE_ONEDRIVE_CLIENT_ID', '');
    const { pickFromOneDrive } = await importFresh();
    await expect(pickFromOneDrive()).rejects.toThrow('OneDrive не е конфигуриран.');
  });

  it('throws CloudImportError when interactive login fails', async () => {
    acquireTokenPopup.mockRejectedValue(new Error('user closed the login popup'));
    const { pickFromOneDrive } = await importFresh();
    await expect(pickFromOneDrive()).rejects.toThrow(/автентикацијата не успеа/);
  });

  it('resolves null when the popup sends a close command', async () => {
    mockDriveInfo('https://onedrive.live.com/drive/personal-id');
    const { pickFromOneDrive } = await importFresh();
    const resultPromise = pickFromOneDrive();

    const port = await completeHandshake();
    port.dispatch({ type: 'command', data: { id: 'cmd1', data: { command: 'close' } } });

    await expect(resultPromise).resolves.toBeNull();
    expect(popup.close).toHaveBeenCalled();
  });

  it('resolves null when the user closes the popup window directly', async () => {
    mockDriveInfo('https://onedrive.live.com/drive/personal-id');
    vi.useFakeTimers();
    const { pickFromOneDrive } = await importFresh();
    const resultPromise = pickFromOneDrive();
    await vi.advanceTimersByTimeAsync(0);
    popup.closed = true;
    await vi.advanceTimersByTimeAsync(500);
    await expect(resultPromise).resolves.toBeNull();
    vi.useRealTimers();
  });

  it('downloads via the picked item\'s downloadUrl for a personal account and infers mimeType', async () => {
    mockDriveInfo('https://onedrive.live.com/drive/personal-id');
    const fakeBuffer = new ArrayBuffer(8);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(fakeBuffer) });

    const { pickFromOneDrive } = await importFresh();
    const resultPromise = pickFromOneDrive();

    const port = await completeHandshake();
    port.dispatch({
      type: 'command',
      data: { id: 'cmd1', data: { command: 'pick', items: [{ id: 'i1', name: 'annual-plan.pdf', '@microsoft.graph.downloadUrl': 'https://download.example/x' }] } },
    });

    const result = await resultPromise;
    expect(result).toEqual({ name: 'annual-plan.pdf', arrayBuffer: fakeBuffer, mimeType: 'application/pdf' });
    expect(fetch).toHaveBeenCalledWith('https://download.example/x');
  });

  it('builds the FilePicker.aspx URL from the business/school account webUrl (schools.mk-shaped)', async () => {
    mockDriveInfo('https://contoso-my.sharepoint.com/personal/user_contoso_com/Documents');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });

    const { pickFromOneDrive } = await importFresh();
    const resultPromise = pickFromOneDrive();
    const port = await completeHandshake();

    const formEl = popup.document.createElement.mock.results[0].value as { setAttribute: ReturnType<typeof vi.fn> };
    const actionCall = formEl.setAttribute.mock.calls.find((c) => c[0] === 'action');
    expect(actionCall?.[1]).toContain('https://contoso-my.sharepoint.com/personal/user_contoso_com/_layouts/15/FilePicker.aspx');

    port.dispatch({
      type: 'command',
      data: { id: 'cmd1', data: { command: 'pick', items: [{ id: 'i1', name: 'test.docx', '@microsoft.graph.downloadUrl': 'https://download.example/y' }] } },
    });
    await resultPromise;
  });

  it('services an authenticate command over the port before pick', async () => {
    mockDriveInfo('https://onedrive.live.com/drive/personal-id');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });

    const { pickFromOneDrive } = await importFresh();
    const resultPromise = pickFromOneDrive();
    const port = await completeHandshake();

    port.dispatch({ type: 'command', data: { id: 'auth1', data: { command: 'authenticate', resource: 'https://contoso.sharepoint.com' } } });
    await new Promise((r) => setTimeout(r, 0));

    expect(port.postMessage).toHaveBeenCalledWith({ type: 'acknowledge', id: 'auth1' });
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'result', id: 'auth1', data: { result: 'token', token: 'popup-token' } });

    port.dispatch({
      type: 'command',
      data: { id: 'cmd1', data: { command: 'pick', items: [{ id: 'i1', name: 'a.pdf', '@microsoft.graph.downloadUrl': 'https://download.example/z' }] } },
    });
    await resultPromise;
  });

  it('throws CloudImportError when the download request fails', async () => {
    mockDriveInfo('https://onedrive.live.com/drive/personal-id');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 500 });

    const { pickFromOneDrive } = await importFresh();
    const resultPromise = pickFromOneDrive();
    const port = await completeHandshake();
    port.dispatch({
      type: 'command',
      data: { id: 'cmd1', data: { command: 'pick', items: [{ id: 'i1', name: 'x.docx', '@microsoft.graph.downloadUrl': 'https://download.example/bad' }] } },
    });

    await expect(resultPromise).rejects.toThrow(/OneDrive не успеа/);
  });

  it('ignores messages from an untrusted source and still resolves via the legitimate popup', async () => {
    mockDriveInfo('https://onedrive.live.com/drive/personal-id');
    const { pickFromOneDrive } = await importFresh();
    const resultPromise = pickFromOneDrive();
    await new Promise((r) => setTimeout(r, 0));

    const impostor = createFakePopup();
    const impostorPort = createFakePort();
    windowMessageListeners.forEach((l) => l({ source: impostor, data: { type: 'initialize', channelId: 'fixed-channel-id' }, ports: [impostorPort] }));
    expect(impostorPort.start).not.toHaveBeenCalled();

    const realPort = createFakePort();
    windowMessageListeners.forEach((l) => l({ source: popup, data: { type: 'initialize', channelId: 'fixed-channel-id' }, ports: [realPort] }));
    realPort.dispatch({ type: 'command', data: { id: 'cmd1', data: { command: 'close' } } });

    await expect(resultPromise).resolves.toBeNull();
  });

  it('rejects with CloudImportError when the popup is blocked', async () => {
    mockDriveInfo('https://onedrive.live.com/drive/personal-id');
    vi.spyOn(window, 'open').mockReturnValue(null);
    const { pickFromOneDrive } = await importFresh();
    await expect(pickFromOneDrive()).rejects.toThrow(/блокиран/);
  });
});
