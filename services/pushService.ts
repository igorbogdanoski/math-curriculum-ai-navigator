import { getToken, onMessage } from 'firebase/messaging';
import { getFirebaseMessaging } from '../firebaseConfig';

export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        console.log('Firebase Messaging not supported on this browser.');
        return null;
      }

      // We don't have a VAPID key in this demo so we just use the browser's raw notification.
      // But if we did:
      // const currentToken = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' });
      // console.log('FCM Token:', currentToken);
      
      return true;
    } else {
      console.log('Unable to get permission to notify.');
      return false;
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
};

export const onMessageListener = async () => {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
};

export const sendLocalPushNotification = (title: string, body: string, icon?: string) => {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: icon || '/vite.svg',
      badge: '/vite.svg'
    });
  }
};
