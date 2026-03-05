import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './app.css';
import App from './App';

// Enhanced Service Worker Registration via vite-plugin-pwa
const updateSW = registerSW({
  onNeedRefresh() {
    // We could show a prompt here. Taking the silent auto-update approach for now
    // If you want user to manually confirm, don't call updateSW() directly.
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App is ready to work offline');
  },
});

// Service Worker is now automatically registered by vite-plugin-pwa. 
// No need for window.addEventListener('load', registerServiceWorker);

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