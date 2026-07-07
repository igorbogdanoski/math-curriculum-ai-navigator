import type { AccountInfo } from '@azure/msal-browser';
import { getMsalInstance } from './msalClient';
import { CloudImportError, type CloudPickedFile } from './types';

const CLIENT_ID = import.meta.env.VITE_ONEDRIVE_CLIENT_ID as string | undefined;
// Scope for the initial Graph call that discovers the user's own OneDrive/SharePoint host —
// the v8 picker itself later requests its own resource-scoped tokens dynamically (see getToken).
const GRAPH_SCOPES = ['Files.Read'];

interface DriveInfo {
  webUrl: string;
}

interface PickedItem {
  id: string;
  name: string;
  parentReference?: { driveId?: string };
  '@microsoft.graph.downloadUrl'?: string;
}

interface PortCommandMessage {
  type: 'command';
  data: {
    id: string;
    data: {
      command: 'authenticate' | 'close' | 'pick';
      resource?: string;
      items?: PickedItem[];
    };
  };
}

function detectMimeType(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  };
  return map[ext] ?? 'application/octet-stream';
}

/**
 * Acquires a token for an arbitrary resource (Microsoft Graph up front to discover the user's
 * drive, then whatever resource the picker itself asks for via its 'authenticate' port commands —
 * these can differ, e.g. the SharePoint/OneDrive host directly rather than Graph). Tries a
 * silent/cached lookup first, falling back to an interactive popup login — mirrors
 * googleDrivePicker.ts's cached-token pattern, generalized to an arbitrary scope list.
 */
async function getToken(scopes: string[]): Promise<string> {
  const pca = await getMsalInstance();
  const cachedAccount: AccountInfo | null = pca.getActiveAccount() ?? pca.getAllAccounts()[0] ?? null;
  if (cachedAccount) {
    try {
      const silent = await pca.acquireTokenSilent({ scopes, account: cachedAccount });
      return silent.accessToken;
    } catch {
      // Falls through to interactive popup below.
    }
  }
  try {
    const result = await pca.acquireTokenPopup({ scopes });
    pca.setActiveAccount(result.account);
    return result.accessToken;
  } catch (err) {
    throw new CloudImportError(`OneDrive автентикацијата не успеа: ${err instanceof Error ? err.message : String(err)}`, 'onedrive');
  }
}

async function fetchDriveWebUrl(): Promise<string> {
  const token = await getToken(GRAPH_SCOPES);
  const res = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new CloudImportError(`Не можев да ги прочитам податоците за OneDrive (${res.status}).`, 'onedrive');
  const drive = (await res.json()) as DriveInfo;
  return drive.webUrl;
}

/**
 * Opens the v8 hosted file-picker as a popup and drives it via the official protocol (verified
 * against Microsoft's own reference sample at github.com/OneDrive/samples — file-picking/
 * javascript-basic): the popup is navigated via a same-window form POST (carrying an initial
 * resource-scoped access token as a hidden field) to `{driveHost}/_layouts/15/FilePicker.aspx`,
 * which then opens a MessageChannel port and drives the rest of the flow (further token
 * requests, and finally the picked file) as JSON commands over that port.
 *
 * This replaces the legacy OneDrive.js v7.2 SDK, whose window.closed-based popup-completion
 * polling was permanently broken once login.microsoftonline.com started sending its own
 * Cross-Origin-Opener-Policy header — an ecosystem-wide change on Microsoft's side that v7.2
 * (now deprecated) never got patched for.
 */
function openPicker(driveWebUrl: string): Promise<PickedItem | null> {
  const driveOrigin = new URL(driveWebUrl).origin;
  const baseUrl = driveWebUrl.substring(0, driveWebUrl.lastIndexOf('/'));

  return new Promise((resolve, reject) => {
    const popup = window.open('', 'onedrive-picker', 'width=1200,height=800');
    if (!popup) {
      reject(new CloudImportError('OneDrive picker-от е блокиран од browser-от (проверете popup blocker).', 'onedrive'));
      return;
    }

    const channelId = crypto.randomUUID();
    let port: MessagePort | null = null;
    let settled = false;

    const finish = (result: PickedItem | null, error?: CloudImportError) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onWindowMessage);
      window.clearInterval(pollClosed);
      if (!popup.closed) popup.close();
      if (error) reject(error);
      else resolve(result);
    };

    const pollClosed = window.setInterval(() => {
      if (popup.closed) finish(null);
    }, 500);

    async function onPortMessage(event: MessageEvent) {
      const message = event.data as PortCommandMessage;
      if (message.type !== 'command' || !message.data?.data) return;
      const command = message.data.data;

      port!.postMessage({ type: 'acknowledge', id: message.data.id });

      if (command.command === 'authenticate') {
        try {
          const token = await getToken([`${(command.resource ?? '').replace(/\/$/, '')}/.default`]);
          port!.postMessage({ type: 'result', id: message.data.id, data: { result: 'token', token } });
        } catch (err) {
          port!.postMessage({ type: 'result', id: message.data.id, data: { result: 'error', error: String(err) } });
        }
      } else if (command.command === 'close') {
        finish(null);
      } else if (command.command === 'pick') {
        port!.postMessage({ type: 'result', id: message.data.id, data: { result: 'success' } });
        finish(command.items?.[0] ?? null);
      }
    }

    function onWindowMessage(event: MessageEvent) {
      if (event.source !== popup) return;
      const message = event.data as { type?: string; channelId?: string } | undefined;
      if (message?.type === 'initialize' && message.channelId === channelId) {
        port = event.ports[0];
        port.addEventListener('message', onPortMessage);
        port.start();
        port.postMessage({ type: 'activate' });
      }
    }
    window.addEventListener('message', onWindowMessage);

    (async () => {
      try {
        const initialToken = await getToken([`${driveOrigin}/.default`]);
        const params = {
          sdk: '8.0',
          entry: { oneDrive: { files: {} } },
          authentication: {},
          messaging: { origin: window.location.origin, channelId },
          typesAndSources: { mode: 'files' },
          commands: { pick: { select: { urls: { download: true } } } },
        };
        const url = `${baseUrl}/_layouts/15/FilePicker.aspx?${new URLSearchParams({ filePicker: JSON.stringify(params) })}`;
        const form = popup.document.createElement('form');
        form.setAttribute('action', url);
        form.setAttribute('method', 'POST');
        popup.document.body.append(form);
        const input = popup.document.createElement('input');
        input.setAttribute('type', 'hidden');
        input.setAttribute('name', 'access_token');
        input.setAttribute('value', initialToken);
        form.appendChild(input);
        form.submit();
      } catch (err) {
        finish(null, err instanceof CloudImportError ? err : new CloudImportError(String(err), 'onedrive'));
      }
    })();
  });
}

/** Opens the OneDrive file picker and resolves the picked file's bytes. Resolves null if the user cancels. */
export async function pickFromOneDrive(): Promise<CloudPickedFile | null> {
  if (!CLIENT_ID) {
    throw new CloudImportError('OneDrive не е конфигуриран.', 'onedrive');
  }
  const driveWebUrl = await fetchDriveWebUrl();
  const picked = await openPicker(driveWebUrl);
  if (!picked) return null;

  const downloadUrl = picked['@microsoft.graph.downloadUrl'];
  const res = downloadUrl
    ? await fetch(downloadUrl)
    : await fetch(`https://graph.microsoft.com/v1.0/drives/${picked.parentReference?.driveId}/items/${picked.id}/content`, {
      headers: { Authorization: `Bearer ${await getToken(GRAPH_SCOPES)}` },
    });
  if (!res.ok) throw new CloudImportError(`Преземањето од OneDrive не успеа (${res.status}).`, 'onedrive');
  const arrayBuffer = await res.arrayBuffer();
  return { name: picked.name, arrayBuffer, mimeType: detectMimeType(picked.name) };
}
