import { loadScript } from '../../utils/loadScript';
import { CloudImportError, type CloudPickedFile } from './types';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID as string | undefined;
const API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY as string | undefined;
// Narrow scope: only grants access to files the teacher explicitly picks — avoids Google's slow app-verification review.
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GOOGLE_DOC_EXPORT_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

declare global {
  interface Window {
    google?: any;
    gapi?: any;
  }
}

let tokenClient: any = null;
let cachedToken: string | null = null;

async function ensureScripts(): Promise<void> {
  await Promise.all([
    loadScript('https://accounts.google.com/gsi/client'),
    loadScript('https://apis.google.com/js/api.js'),
  ]);
  await new Promise<void>((resolve) => window.gapi.load('picker', () => resolve()));
}

function requestAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (cachedToken) { resolve(cachedToken); return; }
    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: () => {}, // overridden per-request below
      });
    }
    tokenClient.callback = (resp: { access_token?: string; error?: string }) => {
      if (resp.error || !resp.access_token) {
        reject(new CloudImportError(resp.error || 'Google авторизацијата е откажана.', 'google-drive'));
        return;
      }
      cachedToken = resp.access_token;
      resolve(resp.access_token);
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

function openPicker(token: string): Promise<{ id: string; name: string; mimeType: string } | null> {
  return new Promise((resolve) => {
    const view = new window.google.picker.DocsView()
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false);
    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const doc = data.docs[0];
          resolve({ id: doc.id, name: doc.name, mimeType: doc.mimeType });
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

async function downloadFile(fileId: string, mimeType: string, token: string): Promise<ArrayBuffer> {
  const isGoogleNative = mimeType.startsWith('application/vnd.google-apps');
  const url = isGoogleNative
    ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(GOOGLE_DOC_EXPORT_MIME)}`
    : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new CloudImportError(`Преземањето од Google Drive не успеа (${res.status}).`, 'google-drive');
  return res.arrayBuffer();
}

/** Opens the Google Drive picker and resolves the picked file's bytes. Resolves null if the user cancels. */
export async function pickFromGoogleDrive(): Promise<CloudPickedFile | null> {
  if (!CLIENT_ID || !API_KEY) {
    throw new CloudImportError('Google Drive не е конфигуриран.', 'google-drive');
  }
  await ensureScripts();
  const token = await requestAccessToken();
  const picked = await openPicker(token);
  if (!picked) return null;
  const isGoogleNative = picked.mimeType.startsWith('application/vnd.google-apps');
  const arrayBuffer = await downloadFile(picked.id, picked.mimeType, token);
  const name = isGoogleNative && !picked.name.endsWith('.docx') ? `${picked.name}.docx` : picked.name;
  const mimeType = isGoogleNative ? GOOGLE_DOC_EXPORT_MIME : picked.mimeType;
  return { name, arrayBuffer, mimeType };
}
