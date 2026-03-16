import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Иницијализација на апликацијата (Спречување на дупликати)
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firebase App Check — reCAPTCHA Enterprise (Р3-Б)
// Only activates in production with VITE_RECAPTCHA_SITE_KEY set.
// Skipped in dev mode to avoid blocking E2E tests and local development.
if (typeof window !== 'undefined' && !import.meta.env.DEV) {
  const reCaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (reCaptchaKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(reCaptchaKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
}

// Firestore Initialization
const isE2E = typeof window !== 'undefined' && (window.__E2E_TEACHER_MODE__ || window.__E2E_MODE__);

const firestoreSettings = {
  ignoreUndefinedProperties: true,
  experimentalForceLongPolling: true,
  useFetchStreams: false,
};

// Ensure we only initialize once and with the correct settings
export const db = initializeFirestore(app, firestoreSettings);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;

export const getFirebaseMessaging = async () => {
  const supported = await isSupported();
  if (supported) {
    return getMessaging(app);
  }
  return null;
};
