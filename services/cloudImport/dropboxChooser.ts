import { CloudImportError, type CloudPickedFile } from './types';

const APP_KEY = import.meta.env.VITE_DROPBOX_APP_KEY as string | undefined;

interface DropboxChosenFile {
  name: string;
  link: string;
  bytes: number;
}

declare global {
  interface Window {
    Dropbox?: {
      choose: (options: {
        success: (files: DropboxChosenFile[]) => void;
        cancel?: () => void;
        linkType: 'direct' | 'preview';
        multiselect: boolean;
        extensions?: string[];
      }) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

/** Dropbox's Chooser SDK requires the app key as a data-attribute on the script tag, so it can't reuse the generic loadScript helper. */
function ensureDropboxScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('dropboxjs');
    if (existing) { resolve(); return; }
    const s = document.createElement('script');
    s.id = 'dropboxjs';
    s.src = 'https://www.dropbox.com/static/api/2/dropins.js';
    s.setAttribute('data-app-key', APP_KEY ?? '');
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new CloudImportError('Не може да се вчита Dropbox.', 'dropbox'));
    document.head.appendChild(s);
  });
  return scriptPromise;
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

/** Opens the Dropbox Chooser and resolves the picked file's bytes. Resolves null if the user cancels. */
export async function pickFromDropbox(): Promise<CloudPickedFile | null> {
  if (!APP_KEY) {
    throw new CloudImportError('Dropbox не е конфигуриран.', 'dropbox');
  }
  await ensureDropboxScript();
  const chosen = await new Promise<DropboxChosenFile | null>((resolve) => {
    window.Dropbox!.choose({
      success: (files) => resolve(files[0] ?? null),
      cancel: () => resolve(null),
      linkType: 'direct',
      multiselect: false,
      extensions: ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.webp'],
    });
  });
  if (!chosen) return null;
  const res = await fetch(chosen.link);
  if (!res.ok) throw new CloudImportError(`Преземањето од Dropbox не успеа (${res.status}).`, 'dropbox');
  const arrayBuffer = await res.arrayBuffer();
  return { name: chosen.name, arrayBuffer, mimeType: detectMimeType(chosen.name) };
}
