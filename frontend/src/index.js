import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';
import { TransactionProvider } from './context/TransactionContext';

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

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <AuthProvider>
    <TransactionProvider>
      <App />
    </TransactionProvider>
  </AuthProvider>
);

reportWebVitals();
