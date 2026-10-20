// The app shell: picks the page from the address and lays it out for a phone screen.
import { lazy, Suspense } from 'react';
import { HomePage } from './HomePage';
import { fixedCopyOf } from './release';
import { useRoute } from './router';

// These pages load the barcode engines, so they are only downloaded when first opened.
const CameraPage = lazy(() => import('./CameraPage').then((m) => ({ default: m.CameraPage })));
const ScanPage = lazy(() => import('./ScanPage').then((m) => ({ default: m.ScanPage })));
const HistoryPage = lazy(() => import('./HistoryPage').then((m) => ({ default: m.HistoryPage })));
const AboutPage = lazy(() => import('./AboutPage').then((m) => ({ default: m.AboutPage })));
const CheckerPage = lazy(() => import('./CheckerPage').then((m) => ({ default: m.CheckerPage })));

export function App() {
  const { page, scanId } = useRoute();
  return (
    <div className="min-h-dvh bg-slate-900 text-slate-100">
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <FixedCopyBanner />
        <Suspense fallback={<p className="text-slate-400">Loading…</p>}>
          {page === 'camera' && <CameraPage />}
          {page === 'scan' && <ScanPage />}
          {page === 'check' && <CheckerPage />}
          {page === 'history' && <HistoryPage scanId={scanId} />}
          {page === 'about' && <AboutPage />}
          {page === 'home' && <HomePage />}
        </Suspense>
      </main>
    </div>
  );
}

/** On a fixed copy of a release, says so on every page. */
function FixedCopyBanner() {
  const fixed = fixedCopyOf(import.meta.env.BASE_URL);
  if (!fixed) return null;
  return (
    <p className="rounded-lg bg-sky-500/15 p-3 text-sm text-sky-200">
      Fixed copy of version {fixed.version}: it never changes.{' '}
      <a href={fixed.liveSite} className="underline underline-offset-2">
        Open the newest version
      </a>
    </p>
  );
}
