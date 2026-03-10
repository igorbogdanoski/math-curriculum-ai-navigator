// Firebase Cloud Messaging Service Worker
// Handles background push notifications when the app is closed or in background.
// This file MUST be at the root /public so it serves as /firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

// Firebase config is injected at runtime via postMessage from the main app.
// We cache it here so background messages work even if postMessage hasn't arrived yet.
let firebaseApp = null;
let messaging = null;

// Listen for config from main app thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    if (firebaseApp) return; // Already initialized
    try {
      firebaseApp = firebase.initializeApp(event.data.config);
      messaging = firebase.messaging();
      setupBackgroundHandler();
      console.log('[FCM SW] Firebase initialized via postMessage');
    } catch (e) {
      console.error('[FCM SW] Init error:', e);
    }
  }
});

function setupBackgroundHandler() {
  if (!messaging) return;

  messaging.onBackgroundMessage((payload) => {
    console.log('[FCM SW] Background message received:', payload);

    const { title, body, icon, data } = payload.notification || {};

    const notificationTitle = title || 'Math AI Navigator';
    const notificationOptions = {
      body: body || '',
      icon: icon || '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data?.tag || 'math-nav',
      data: data || {},
      actions: data?.actions ? JSON.parse(data.actions) : [],
      requireInteraction: data?.requireInteraction === 'true',
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Handle notification click — open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
