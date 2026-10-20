// Small React hooks that read the browser's state for the status screen.
import { useEffect, useState } from 'react';

/** True while the device has a network connection. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

export type OfflineStatus = 'checking' | 'ready' | 'unsupported';

/**
 * 'ready' once the service worker has saved the app on this device,
 * so it opens without a connection.
 */
export function useOfflineStatus(): OfflineStatus {
  const supported = 'serviceWorker' in navigator;
  const [status, setStatus] = useState<OfflineStatus>(supported ? 'checking' : 'unsupported');
  useEffect(() => {
    if (!supported) return;
    let active = true;
    // `ready` resolves once a service worker is active, which happens only
    // after it has finished saving every file the app needs.
    navigator.serviceWorker.ready.then(() => {
      if (active) setStatus('ready');
    });
    return () => {
      active = false;
    };
  }, [supported]);
  return status;
}

/** True when the app was opened from the home screen rather than a browser tab. */
export function useInstalled(): boolean {
  const query = '(display-mode: standalone)';
  const [installed, setInstalled] = useState(() => isStandalone(query));
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setInstalled(isStandalone(query));
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return installed;
}

function isStandalone(query: string): boolean {
  // iPhones use their own flag instead of the display-mode media query.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia(query).matches;
}

// Chrome and Edge fire this event when the app can be installed with one tap.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/** Returns a function that opens the browser's install dialog, or null if not available. */
export function useInstallPrompt(): (() => void) | null {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const capture = (e: Event) => {
      e.preventDefault(); // keep it for our own Install button
      setEvent(e as BeforeInstallPromptEvent);
    };
    const clear = () => setEvent(null);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', clear);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', clear);
    };
  }, []);
  if (!event) return null;
  return () => {
    void event.prompt();
    setEvent(null); // the browser allows each prompt to be used once
  };
}
