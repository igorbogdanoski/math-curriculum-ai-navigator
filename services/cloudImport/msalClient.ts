import { createStandardPublicClientApplication, type IPublicClientApplication } from '@azure/msal-browser';

const CLIENT_ID = import.meta.env.VITE_ONEDRIVE_CLIENT_ID as string | undefined;

let instance: IPublicClientApplication | null = null;

/**
 * Lazily creates (and caches) the single MSAL PublicClientApplication used by the OneDrive
 * v8 picker. Kept in its own module so it can be mocked cleanly in tests — @azure/msal-browser
 * itself is a dual ESM/CJS package with subpath exports that don't mock reliably in-place.
 */
export async function getMsalInstance(): Promise<IPublicClientApplication> {
  if (instance) return instance;
  instance = await createStandardPublicClientApplication({
    auth: {
      clientId: CLIENT_ID!,
      // 'common' supports both personal Microsoft accounts and organizational/school tenants.
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: window.location.origin,
    },
  });
  return instance;
}
