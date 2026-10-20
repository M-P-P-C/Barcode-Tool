import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './ui/App';

// When a newer version of the app has been downloaded and takes over, reload once so
// the screen shows it. Skipped on the very first visit, when there is no older version,
// and when the page was run by another copy's service worker: the live site's one also
// covers the fixed release copies and previews below it, until their own takes over.
const ownServiceWorker = new URL(`${import.meta.env.BASE_URL}sw.js`, location.href).href;
if (
  'serviceWorker' in navigator &&
  navigator.serviceWorker.controller?.scriptURL === ownServiceWorker
) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing <div id="root"> in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
