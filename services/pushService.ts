/**
 * Push Notification Service — FCM (Firebase Cloud Messaging)
 *
 * Full implementation:
 * 1. Request browser notification permission
 * 2. Register Firebase Messaging SW + get FCM device token (VAPID)
 * 3. Persist token to Firestore (`user_tokens` collection)
 * 4. Send Firebase config to SW so background notifications work
 * 5. Foreground message listener
 * 6. Local (browser-native) notifications as fallback
 *
 * Prerequisites in .env:
 *   VITE_FCM_VAPID_KEY = your Web Push certificate public key
 *   (Firebase Console → Project Settings → Cloud Messaging → Web Push certificates)
 */

import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { getFirebaseMessaging, db } from '../firebaseConfig';
import { logger } from '../utils/logger';

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;

// ── Send Firebase config to the SW (needed for background messages) ──────────
function sendConfigToSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((registration) => {
    registration.active?.postMessage({
      type: 'FIREBASE_CONFIG',
      config: {
        apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId:             import.meta.env.VITE_FIREBASE_APP_ID,
      },
    });
  });
}

// ── Persist / remove FCM token in Firestore ──────────────────────────────────
async function saveTokenToFirestore(uid: string, token: string): Promise<void> {
  await setDoc(
    doc(db, 'user_tokens', `${uid}_web`),
    {
      uid,
      token,
      platform: 'web',
      userAgent: navigator.userAgent,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function removeTokenFromFirestore(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'user_tokens', `${uid}_web`));
  } catch {
    // Ignore — token may not exist
  }
}

// ── Main: request permission + register token ─────────────────────────────────
/**
 * Requests notification permission, obtains an FCM device token, and saves it
 * to Firestore so Cloud Functions can send targeted pushes.
 *
 * @param uid  Authenticated Firebase user UID
 * @returns FCM token string on success, null if unsupported or denied
 */
export async function requestNotificationPermission(uid?: string): Promise<string | null> {
  // Check browser support
  if (!('Notification' in window)) {
    logger.info('[Push] Notifications not supported');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    logger.info('[Push] Permission denied');
    return null;
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    logger.info('[Push] Firebase Messaging not supported on this browser');
    // Fallback: local notifications only
    return null;
  }

  if (!VAPID_KEY) {
    logger.warn(
      '[Push] VITE_FCM_VAPID_KEY not set — FCM token skipped. ' +
      'Add your Web Push certificate key from Firebase Console → Cloud Messaging.'
    );
    return null;
  }

  try {
    // Register the messaging SW and get token
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (token) {
      logger.info('[Push] FCM Token registered', { prefix: token.slice(0, 20) });
      // Forward Firebase config to SW so background messages work
      sendConfigToSW();
      // Persist to Firestore if user is logged in
      if (uid) {
        await saveTokenToFirestore(uid, token);
      }
      return token;
    }
    return null;
  } catch (error) {
    logger.error('[Push] Error getting FCM token', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

// ── Silent token refresh (B5-1) ───────────────────────────────────────────────
/**
 * Silently refreshes the FCM token in Firestore if the browser already has
 * notification permission. Does NOT re-ask for permission.
 *
 * Call this once after the user authenticates so stale tokens are replaced
 * automatically without any user interaction.
 *
 * @param uid  Authenticated Firebase user UID
 */
export async function silentRefreshFCMToken(uid: string): Promise<void> {
  if (!uid) return;
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const messaging = await getFirebaseMessaging();
  if (!messaging || !VAPID_KEY) return;

  try {
    const swReg = await navigator.serviceWorker.getRegistration('/');
    if (!swReg) return;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (token) {
      sendConfigToSW();
      await saveTokenToFirestore(uid, token);
      logger.info('[Push] FCM token silently refreshed', { prefix: token.slice(0, 20) });
    }
  } catch (e) {
    // Non-critical: log at info level so it doesn't cause Sentry noise
    logger.info('[Push] Silent token refresh skipped', { reason: String(e) });
  }
}

// ── Foreground message listener ───────────────────────────────────────────────
/**
 * Listen for messages while the app is in the foreground.
 * Call this once after the app mounts (e.g. in App.tsx useEffect).
 *
 * @param callback  Receives the FCM MessagePayload
 */
export async function onForegroundMessage(
  callback: (payload: any) => void,
): Promise<(() => void) | null> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;

  const unsubscribe = onMessage(messaging, callback);
  return unsubscribe;
}

// ── Local (browser-native) notification ──────────────────────────────────────
/**
 * Shows a local OS notification without going through FCM.
 * Useful for in-app events (quota reset, daily brief ready, etc.)
 */
export function sendLocalNotification(
  title: string,
  body: string,
  options?: { icon?: string; tag?: string; url?: string },
): void {
  if (Notification.permission !== 'granted') return;

  const notification = new Notification(title, {
    body,
    icon: options?.icon || '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: options?.tag || 'math-nav-local',
  });

  if (options?.url) {
    notification.onclick = () => {
      window.open(options.url, '_blank');
      notification.close();
    };
  }
}

// ── Legacy alias (backward compat) ───────────────────────────────────────────
/** @deprecated Use sendLocalNotification instead */
export const sendLocalPushNotification = (title: string, body: string, icon?: string) =>
  sendLocalNotification(title, body, { icon });

/** @deprecated Use onForegroundMessage instead */
export const onMessageListener = async () => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;
  return new Promise((resolve) => {
    onMessage(messaging, resolve);
  });
};
