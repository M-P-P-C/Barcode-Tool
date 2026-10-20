// About: version, privacy, install steps for both phone types, fixed release copies,
// and the open-source software inside the app with its licenses.
import { useEffect, useState } from 'react';
import { Card } from './Card';
import { installSteps } from './platform';
import { GITHUB_PRIVACY_URL, LIVE_SITE_URL, REPOSITORY_URL } from './project';
import { fixedCopyAddress, fixedCopyOf, isPreview } from './release';
import { LINKS } from './router';

/** One entry of licenses.json, which the build writes (see plugins/licenses.ts). */
interface LicenseEntry {
  name: string;
  version: string | null;
  license: string;
  repository: string | null;
  usedFor: string;
}

const BASE = import.meta.env.BASE_URL;

export function AboutPage() {
  const fixed = fixedCopyOf(BASE);
  const preview = isPreview(__APP_VERSION__);
  const [licenses, setLicenses] = useState<LicenseEntry[] | 'missing' | null>(null);
  useEffect(() => {
    fetch(`${BASE}licenses.json`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error())))
      .then(setLicenses, () => setLicenses('missing'));
  }, []);
  const engine = (name: string) =>
    Array.isArray(licenses) ? licenses.find((l) => l.name === name)?.version : undefined;

  return (
    <>
      <header className="flex items-center gap-3">
        <a href={LINKS.home} className="rounded-lg px-2 py-1 text-emerald-300" aria-label="Back">
          ← Back
        </a>
        <h1 className="text-xl font-semibold">About</h1>
      </header>

      <Card title="Barcode Inspector">
        <p className="text-slate-300">
          A free, open-source scanner that shows exactly what a barcode contains, including the
          invisible separators, and checks GS1 data with GS1&apos;s own engine.
        </p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-400">Version</dt>
          <dd>
            {__APP_VERSION__}
            {preview && ' (preview)'}
          </dd>
          <dt className="text-slate-400">GS1 engine</dt>
          <dd>GS1 Barcode Syntax Engine {engine('gs1encoder') ?? ''}</dd>
          <dt className="text-slate-400">Barcode reader</dt>
          <dd>zxing-wasm {engine('zxing-wasm') ?? ''} (zxing-cpp)</dd>
        </dl>
        {preview && (
          <p className="mt-3 text-sm text-amber-200">
            This is a preview: features and behaviour may still change, and it is not yet a stable
            version to rely on for validated work.
          </p>
        )}
        <p className="mt-3 text-sm text-slate-400">
          &quot;Data valid&quot; means the data follows GS1&apos;s rules. The app does not measure
          print quality, so it never says a barcode is compliant.
        </p>
      </Card>

      <Card title="Privacy">
        <ul className="list-disc space-y-2 pl-5 text-slate-300">
          <li>
            Nothing you scan leaves your device, unless you copy or share it yourself. Barcodes are
            read and checked inside your browser; there is no server.
          </li>
          <li>No accounts, no analytics, no ads and no cookies.</li>
          <li>
            Camera pictures are only read, never stored or sent. History keeps the barcode data on
            this device, not the pictures. Your settings (sound, camera) are kept there too.
          </li>
          <li>Web addresses found in barcodes are never opened by themselves.</li>
          <li>
            The app never contacts other websites. A security rule in the page (Content Security
            Policy) also blocks the page from loading anything from them.
          </li>
          <li>
            The app is hosted on GitHub Pages. When your browser downloads it, GitHub receives the
            usual technical data, such as your IP address (
            <a href={GITHUB_PRIVACY_URL} className="text-emerald-300 underline underline-offset-2">
              GitHub&apos;s privacy statement
            </a>
            ). After the first visit the app works offline.
          </li>
        </ul>
      </Card>

      <Card title="Install">
        <p className="mb-3 text-slate-300">
          Installing puts the app on your home screen, opens it full screen, and keeps it working
          offline.
        </p>
        <h3 className="font-medium">Android</h3>
        <ol className="mt-1 mb-3 list-decimal space-y-1 pl-5 text-slate-300">
          {installSteps('android').map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <h3 className="font-medium">iPhone and iPad</h3>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-slate-300">
          {installSteps('ios').map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-slate-400">
          On iPhone, installing is what keeps your History: after 7 days of using Safari without
          opening a website, Safari deletes its data, but not that of apps on the home screen. The
          installed app has its own History, separate from Safari&apos;s: install first, or save a
          backup file in Safari and load it in the app. A backup file is the safest.
        </p>
      </Card>

      {/* Fixed copies are promised from version 1.0.0 on; previews make no such promise. */}
      {(fixed || !preview) && (
        <Card title="Fixed versions">
          {fixed ? (
            <p className="text-slate-300">
              This is the fixed copy of version {fixed.version}. It never changes, for validated
              use. The newest version is at{' '}
              <a href={fixed.liveSite} className="text-emerald-300 underline underline-offset-2">
                the live site
              </a>
              .
            </p>
          ) : (
            <p className="text-slate-300">
              Each release also stays available, unchanged, at its own address, for validated use,
              for example{' '}
              <span className="font-mono text-sm break-all">
                {fixedCopyAddress(LIVE_SITE_URL, '1.0.0')}
              </span>
              . All releases are listed on{' '}
              <a
                href={`${REPOSITORY_URL}/releases`}
                className="text-emerald-300 underline underline-offset-2"
              >
                GitHub
              </a>
              .
            </p>
          )}
        </Card>
      )}

      <Card title="Open-source software">
        <p className="mb-3 text-slate-300">
          Barcode Inspector is open source under the Apache License 2.0 (
          <a href={REPOSITORY_URL} className="text-emerald-300 underline underline-offset-2">
            source code
          </a>
          ). It is built with:
        </p>
        {licenses === null && <p className="text-slate-400">Loading…</p>}
        {licenses === 'missing' && (
          <p className="text-slate-400">The list is made when the app is built.</p>
        )}
        {Array.isArray(licenses) && (
          <ul className="divide-y divide-slate-700 text-sm">
            {licenses.map((entry) => (
              <li key={entry.name} className="py-2">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">
                    {entry.name} {entry.version}
                  </span>
                  <span className="text-slate-400">{entry.license}</span>
                </div>
                <div className="text-slate-400">{entry.usedFor}</div>
              </li>
            ))}
          </ul>
        )}
        <a
          href={`${BASE}licenses.txt`}
          className="mt-3 inline-block text-emerald-300 underline underline-offset-2"
        >
          Full license texts
        </a>
        <p className="mt-3 text-sm text-slate-400">
          GS1 is a registered trademark of GS1 AISBL. This app is not affiliated with GS1.
        </p>
      </Card>
    </>
  );
}
