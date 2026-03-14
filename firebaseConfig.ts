import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';
import { getVertexAI } from 'firebase/vertexai';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Иницијализација на апликацијата
export const app = initializeApp(firebaseConfig);

// Иницијализација на App Check (Само на клиентска страна)
if (typeof window !== 'undefined') {
  const reCaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (reCaptchaKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(reCaptchaKey),
      isTokenAutoRefreshEnabled: true
    });
  }
}

// Иницијализација на сервисите
// Овозможуваме ignoreUndefinedProperties за постабилна синхронизација
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// Напомена: localCache и persistentMultipleTabManager горе автоматски се справуваат со офлајн поддршка за повеќе табови

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
export const ai = getVertexAI(app);

export default app;

export const getFirebaseMessaging = async () => {
  const supported = await isSupported();
  if (supported) {
    return getMessaging(app);
  }
  return null;
};
