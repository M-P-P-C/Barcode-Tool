// A tiny router: pages are chosen by the part of the address after "#".
// This works on GitHub Pages, offline, and with the phone's back gesture.
import { useEffect, useState } from 'react';

export type Page = 'home' | 'camera' | 'scan' | 'check' | 'history' | 'about';

export const LINKS: Record<Page, string> = {
  home: '#/',
  camera: '#/camera',
  scan: '#/scan',
  check: '#/check',
  history: '#/history',
  about: '#/about',
};

/** The page to show, and for one saved scan (#/history/12) its number. */
export interface Route {
  page: Page;
  scanId: number | null;
}

/** The address of one saved scan. */
export function scanLink(id: number): string {
  return `${LINKS.history}/${id}`;
}

function currentRoute(): Route {
  const hash = window.location.hash;
  const saved = /^#\/history\/(\d+)$/.exec(hash);
  if (saved) return { page: 'history', scanId: Number(saved[1]) };
  const page = (Object.keys(LINKS) as Page[]).find((p) => LINKS[p] === hash) ?? 'home';
  return { page, scanId: null };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const update = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return route;
}
