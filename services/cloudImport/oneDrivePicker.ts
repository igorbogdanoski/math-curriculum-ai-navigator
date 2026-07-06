import { loadScript } from '../../utils/loadScript';
import { CloudImportError, type CloudPickedFile } from './types';

const CLIENT_ID = import.meta.env.VITE_ONEDRIVE_CLIENT_ID as string | undefined;

interface OneDriveFile {
  name: string;
  '@microsoft.graph.downloadUrl': string;
}

declare global {
  interface Window {
    OneDrive?: {
      open: (options: {
        clientId: string;
        action: 'download';
        multiSelect: boolean;
        advanced: { redirectUri: string; filter?: string };
        success: (response: { value: OneDriveFile[] }) => void;
        cancel: () => void;
        error: (err: unknown) => void;
      }) => void;
    };
  }
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
 * Opens the OneDrive file picker and resolves the picked file's bytes. Resolves null if the user cancels.
 * Uses the hosted OneDrive.js picker (action: 'download'), which handles its own auth popup against the
 * multitenant + personal-account app registration and returns a pre-authenticated, CORS-enabled download URL —
 * no separate MSAL token flow needed for this read-only picking use case.
 *
 * The OAuth popup's redirectUri deliberately points at a dedicated static page (public/onedrive-redirect.html)
 * rather than the SPA root — that page has its own relaxed, narrowly-scoped CSP (vercel.json) so the OneDrive
 * SDK's own popup-close handshake (which relies on an inline handler) isn't blocked by the app's strict
 * site-wide CSP, which has no 'unsafe-inline' in script-src.
 */
export async function pickFromOneDrive(): Promise<CloudPickedFile | null> {
  if (!CLIENT_ID) {
    throw new CloudImportError('OneDrive не е конфигуриран.', 'onedrive');
  }
  await loadScript('https://js.live.net/v7.2/OneDrive.js');
  if (!window.OneDrive) {
    throw new CloudImportError('OneDrive picker-от не се вчита.', 'onedrive');
  }
  const picked = await new Promise<OneDriveFile | null>((resolve, reject) => {
    window.OneDrive!.open({
      clientId: CLIENT_ID,
      action: 'download',
      multiSelect: false,
      advanced: { redirectUri: `${window.location.origin}/onedrive-redirect.html` },
      success: (response) => resolve(response.value[0] ?? null),
      cancel: () => resolve(null),
      error: (err) => reject(new CloudImportError(`OneDrive грешка: ${String(err)}`, 'onedrive')),
    });
  });
  if (!picked) return null;
  const downloadUrl = picked['@microsoft.graph.downloadUrl'];
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new CloudImportError(`Преземањето од OneDrive не успеа (${res.status}).`, 'onedrive');
  const arrayBuffer = await res.arrayBuffer();
  return { name: picked.name, arrayBuffer, mimeType: detectMimeType(picked.name) };
}
