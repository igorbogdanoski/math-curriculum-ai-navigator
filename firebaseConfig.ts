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

// Иницијализација на App Check - ПРИВРЕМЕНО ОНЕВОЗМОЖЕНО ЗА ДЕБАГИРАЊЕ
/*
if (typeof window !== 'undefined') {
  if (import.meta.env.DEV) {
    (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  
  const reCaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (reCaptchaKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(reCaptchaKey),
      isTokenAutoRefreshEnabled: true
    });
  }
}
*/

// Иницијализација на Firestore со едноставен getFirestore прво
export const db = getFirestore(app);

// Овозможуваме кеширање во позадина за да не ја кочиме почетната иницијализација
if (typeof window !== 'undefined') {
  initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  }, "default"); // Специфицираме име на база за да избегнеме конфликти
}

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
