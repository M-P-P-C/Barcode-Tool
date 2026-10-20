// Build step: writes licenses.json (a short list for the About page) and licenses.txt
// (the full license texts) into the site. The packages are found from the app's own
// bundle, so the list can't go out of date. Code that is not in that bundle is added by
// name: the barcode reader (it runs in a Web Worker) and the offline service worker.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Packages whose code ships but that the main JavaScript bundle can't show: the worker's
 * reader, Workbox in the service worker, Tailwind in the stylesheet, Vite's small
 * loading helper and vite-plugin-pwa's registerSW.js.
 */
const ALWAYS = [
  'zxing-wasm',
  'workbox-core',
  'workbox-precaching',
  'workbox-routing',
  'workbox-strategies',
  'tailwindcss',
  'vite',
  'vite-plugin-pwa',
];

/** What is compiled into the WebAssembly files, from those packages' own documentation. */
// License texts that are not in node_modules are kept in plugins/license-texts/.
// (libc++, also compiled in, is Apache-2.0 with the LLVM exception: no notice is needed.)
const COMPILED_IN = [
  {
    name: 'zxing-cpp',
    license: 'Apache-2.0',
    repository: 'https://github.com/zxing-cpp/zxing-cpp',
    usedFor: 'Barcode reading, compiled into zxing-wasm (its ZXingWasm.cpp is Apache-2.0 too)',
    text: 'Licensed under the Apache License 2.0; its text is included above (gs1encoder).',
  },
  {
    name: 'Emscripten runtime',
    license: 'MIT OR NCSA',
    repository: 'https://github.com/emscripten-core/emscripten',
    usedFor: 'Runs the C and C++ code of both engines as WebAssembly',
    text: readText('emscripten.txt'),
  },
  {
    name: 'musl libc',
    license: 'MIT',
    repository: 'https://musl.libc.org',
    usedFor: 'The C library inside both engines (part of Emscripten)',
    text: readText('musl.txt'),
  },
];

const USED_FOR: Record<string, string> = {
  react: 'Screens',
  'react-dom': 'Screens',
  scheduler: 'Screens (part of React)',
  gs1encoder: 'GS1 Barcode Syntax Engine: checking GS1 data',
  'zxing-wasm': 'Barcode reading',
  idb: 'Scan history on the device',
  'workbox-core': 'Offline use',
  'workbox-precaching': 'Offline use',
  'workbox-routing': 'Offline use',
  'workbox-strategies': 'Offline use',
  tailwindcss: 'Page styles',
  vite: 'Loading the parts of the app',
  'vite-plugin-pwa': 'Installing the offline helper',
};

export interface LicenseEntry {
  name: string;
  version: string | null;
  license: string;
  repository: string | null;
  usedFor: string;
}

export function thirdPartyLicenses(appVersion: string): Plugin {
  const root = new URL('../node_modules/', import.meta.url).pathname;
  return {
    name: 'third-party-licenses',
    apply: 'build',
    generateBundle(_options, bundle) {
      const names = new Set(ALWAYS);
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const id of Object.keys(output.modules)) {
          const name = packageOf(id);
          if (name) names.add(name);
        }
      }

      const entries: LicenseEntry[] = [];
      const texts: string[] = [];
      for (const name of [...names].sort()) {
        const dir = join(root, name);
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        const entry: LicenseEntry = {
          name,
          version: pkg.version ?? null,
          license: typeof pkg.license === 'string' ? pkg.license : 'see license text',
          repository: repositoryUrl(pkg.repository),
          usedFor: USED_FOR[name] ?? 'Part of the app',
        };
        entries.push(entry);
        texts.push(section(entry, licenseText(dir) ?? `License: ${entry.license}`));
      }
      for (const { text, ...item } of COMPILED_IN) {
        entries.push({ ...item, version: null });
        texts.push(section({ ...item, version: null }, text));
      }

      this.emitFile({
        type: 'asset',
        fileName: 'licenses.json',
        source: JSON.stringify(entries, null, 2),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'licenses.txt',
        source:
          `Barcode Inspector ${appVersion} is free software under the Apache License 2.0.\n` +
          'It uses the following open-source software. Thank you to their authors.\n\n' +
          texts.join('\n\n'),
      });
    },
  };
}

/** "…/node_modules/@scope/name/dist/x.js" → "@scope/name"; null for the app's own code. */
function packageOf(id: string): string | null {
  const match = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(id.replaceAll('\\', '/'));
  return match?.[1] ?? null;
}

function repositoryUrl(repository: unknown): string | null {
  const url =
    typeof repository === 'string'
      ? repository
      : typeof repository === 'object' && repository !== null && 'url' in repository
        ? String(repository.url)
        : null;
  if (!url) return null;
  return url
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^github:/, 'https://github.com/');
}

function licenseText(dir: string): string | null {
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\..*)?$/i.test(f));
  if (!file || !existsSync(join(dir, file))) return null;
  const text = readFileSync(join(dir, file), 'utf8');
  // Vite's file also lists the tools it bundles for building, which don't ship in the app.
  return text.split('\n# Licenses of bundled dependencies')[0]?.trim() ?? text.trim();
}

function readText(file: string): string {
  return readFileSync(new URL(`./license-texts/${file}`, import.meta.url), 'utf8').trim();
}

function section(entry: LicenseEntry, text: string): string {
  const title = `${entry.name}${entry.version ? ` ${entry.version}` : ''} (${entry.license})`;
  return [
    '='.repeat(72),
    title,
    `Used for: ${entry.usedFor}`,
    entry.repository ?? '',
    '='.repeat(72),
    text,
  ]
    .filter((line) => line !== '')
    .join('\n');
}
