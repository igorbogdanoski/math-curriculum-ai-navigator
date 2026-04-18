import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
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
// Skipped in dev mode and localhost preview runs to avoid false failures in local QA/LHCI.
const isLocalHost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

if (typeof window !== 'undefined' && !import.meta.env.DEV && !isLocalHost) {
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
  // forceLongPolling only in E2E to avoid slowing real-time listeners for real users
  experimentalForceLongPolling: isE2E,
  useFetchStreams: !isE2E,
};

// Ensure we only initialize once and with the correct settings
export const db = initializeFirestore(app, firestoreSettings);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Connect to Firebase Emulators when VITE_USE_FIREBASE_EMULATOR=true.
// Used in CI E2E tests (П28) — never active in production.
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' && typeof window !== 'undefined') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}

export default app;

export const getFirebaseMessaging = async () => {
  const supported = await isSupported();
  if (supported) {
    return getMessaging(app);
  }
  return null;
};
