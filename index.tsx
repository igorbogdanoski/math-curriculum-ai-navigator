import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Enhanced Service Worker Registration
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      // We use a relative path. In production, this file should be at the root.
      // In some dev environments, accessing /service-worker.js might fail or return HTML.
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      if (registration.installing) {
        console.log('Service worker installing');
      } else if (registration.waiting) {
        console.log('Service worker installed');
      } else if (registration.active) {
        console.log('Service worker active');
      }
    } catch (error) {
      // We log this as a warning instead of an error to avoid alarming the user
      // in environments where SWs are not supported or restricted (like some iframes).
      console.warn('ServiceWorker registration failed (this is expected in some dev environments):', error);
    }
  }
};

// Register SW after load to not block initial rendering
window.addEventListener('load', registerServiceWorker);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);