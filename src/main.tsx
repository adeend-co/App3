import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress known benign Vite websocket errors
const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('WebSocket closed without opened')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Suppress unhandled rejection errors regarding WebSocket
window.addEventListener('unhandledrejection', function(event) {
  if (event.reason && typeof event.reason.message === 'string' && event.reason.message.includes('WebSocket closed without opened')) {
    event.preventDefault(); // Suppresses the error from showing up in the console
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
