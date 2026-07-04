/** Normalised result every cloud-storage provider adapter resolves to — null means the user cancelled the picker. */
export interface CloudPickedFile {
  name: string;
  arrayBuffer: ArrayBuffer;
  mimeType: string;
}

export type CloudProvider = 'google-drive' | 'dropbox' | 'onedrive';

export class CloudImportError extends Error {
  constructor(message: string, public provider: CloudProvider) {
    super(message);
    this.name = 'CloudImportError';
  }
}
