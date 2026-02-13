import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';
import { TransactionProvider } from './context/TransactionContext';
import offlineManager from './services/OfflineManager';

// Global Error Suppressor to prevent the "AbortError" overlay from blocking user view
window.addEventListener('error', (e) => {
  if (e.message.includes('signal is aborted') || e.message.includes('AbortError')) {
    e.stopImmediatePropagation();
    e.stopPropagation();
    return false;
  }
});

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.name === 'AbortError' || e.reason?.message?.includes('signal is aborted')) {
    e.stopImmediatePropagation();
    e.stopPropagation();
    return false;
  }
});

// Initialize Offline Manager (Decoupled to find circular dependency)
offlineManager.init().catch(err => console.error('OfflineManager Init Failed:', err));

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <AuthProvider>
    <TransactionProvider>
      <App />
    </TransactionProvider>
  </AuthProvider>
);

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('✅ ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch((error) => {
        console.log('❌ ServiceWorker registration failed: ', error);
      });
  });
}

reportWebVitals();
