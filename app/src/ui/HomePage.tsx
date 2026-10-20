// Start page: what the app can do so far, its offline/install status, and install steps.
import { Card } from './Card';
import { allowSound } from './feedback';
import { useInstalled, useInstallPrompt, useOfflineStatus, useOnline } from './hooks';
import { detectPlatform, installSteps } from './platform';
import { REPOSITORY_URL } from './project';
import { isPreview } from './release';
import { LINKS } from './router';

export function HomePage() {
  const online = useOnline();
  const offline = useOfflineStatus();
  const installed = useInstalled();
  const promptInstall = useInstallPrompt();
  const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints);

  return (
    <>
      <header className="flex items-center gap-3">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-12 w-12" />
        <div>
          <h1 className="text-xl font-semibold">Barcode Inspector</h1>
          <p className="text-sm text-slate-400">
            Version {__APP_VERSION__}
            {isPreview(__APP_VERSION__) && ' · preview, may still change'}
          </p>
        </div>
      </header>

      <Card title="Scan a barcode">
        <p className="mb-3 text-slate-300">
          Point your camera at a barcode, or take a photo of it, and see exactly what it contains,
          checked with GS1&apos;s own rules.
        </p>
        <a
          href={LINKS.camera}
          onClick={allowSound} // this tap also lets the camera page beep
          className="block w-full rounded-lg bg-emerald-500 px-4 py-3 text-center font-semibold text-slate-950 active:bg-emerald-400"
        >
          Scan with camera
        </a>
        <a
          href={LINKS.scan}
          className="mt-2 block w-full rounded-lg bg-slate-700 px-4 py-3 text-center font-semibold text-slate-100 active:bg-slate-600"
        >
          Scan from a photo
        </a>
        <p className="mt-1 text-sm text-slate-400">Best for tiny codes, and on iPhone.</p>
        <a
          href={LINKS.history}
          className="mt-2 block w-full rounded-lg bg-slate-700 px-4 py-3 text-center font-semibold text-slate-100 active:bg-slate-600"
        >
          History
        </a>
        <a
          href={LINKS.check}
          className="mt-2 block w-full rounded-lg bg-slate-700 px-4 py-3 text-center font-semibold text-slate-100 active:bg-slate-600"
        >
          Type in barcode data
        </a>
      </Card>

      <Card title="Status">
        <ul className="flex flex-col gap-2">
          <StatusRow
            label="Works offline"
            value={
              offline === 'ready' ? 'Yes' : offline === 'checking' ? 'Setting up…' : 'Not supported'
            }
            good={offline === 'ready'}
          />
          <StatusRow label="Connection" value={online ? 'Online' : 'Offline'} good={online} />
          <StatusRow
            label="Opened from home screen"
            value={installed ? 'Yes' : 'No'}
            good={installed}
          />
        </ul>
      </Card>

      {!installed && (
        <Card title="Install on this device">
          {promptInstall && (
            <button
              type="button"
              onClick={promptInstall}
              className="mb-3 w-full rounded-lg bg-slate-100 px-4 py-3 font-semibold text-slate-900 active:bg-white"
            >
              Install app
            </button>
          )}
          <ol className="list-decimal space-y-1 pl-5 text-slate-300">
            {installSteps(platform).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {platform === 'ios' && (
            <p className="mt-3 text-sm text-slate-400">
              Installing also keeps your History: Safari deletes the data of websites you
              haven&apos;t opened for 7 days of use, but not of apps on the home screen. The
              installed app starts with its own, empty History.
            </p>
          )}
          <p className="mt-3 text-sm text-slate-400">
            Steps for other phones are on the{' '}
            <a href={LINKS.about} className="text-emerald-300 underline underline-offset-2">
              About
            </a>{' '}
            page.
          </p>
        </Card>
      )}

      <Card title="Coming next">
        <ul className="list-disc space-y-1 pl-5 text-slate-300">
          <li>Better reading of tiny and damaged codes</li>
          <li>Batch scanning, with export to a spreadsheet</li>
          <li>Expected structures: check that codes contain what they should</li>
          <li>PDF scan reports</li>
        </ul>
      </Card>

      <footer className="pt-2 text-center text-sm text-slate-400">
        <p>Nothing you scan leaves your device. No ads, no tracking.</p>
        <p className="mt-1">
          <a href={LINKS.about} className="underline underline-offset-2">
            About, privacy and licenses
          </a>
          {' · '}
          <a href={REPOSITORY_URL} className="underline underline-offset-2">
            Source code
          </a>
        </p>
      </footer>
    </>
  );
}

function StatusRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <li className="flex items-center justify-between gap-4">
      <span className="text-slate-300">{label}</span>
      <span className={good ? 'font-medium text-emerald-400' : 'font-medium text-amber-300'}>
        {value}
      </span>
    </li>
  );
}
