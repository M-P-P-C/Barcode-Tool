/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { thirdPartyLicenses } from './plugins/licenses.ts';

// Where the site lives on the web server. CI sets BASE_PATH, for example
// "/Barcode-Tool/" for the live site or "/Barcode-Tool/pr-preview/pr-3/" for a preview.
// It must start and end with "/". Locally it is just "/".
const base = process.env.BASE_PATH ?? '/';
if (!base.startsWith('/') || !base.endsWith('/')) {
  throw new Error(`BASE_PATH must start and end with "/", got "${base}"`);
}

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as {
  version: string;
};

// A fixed copy of a release lives at ".../v/1.0.0/" and never changes (see release.yml).
// It gets its own app name, so it can be installed next to the live version.
const fixedCopy = /\/v\/[^/]+\/$/.test(base);
const appName = fixedCopy ? `Barcode Inspector ${version}` : 'Barcode Inspector';

// The live site's service worker also covers the preview and release folders below it.
// Tell it to leave page loads in those folders alone, so they show their own version.
const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const otherSitesBelowUs = new RegExp(`^${escapedBase}(pr-preview|v)/`);

// Content Security Policy: the page may only load files from our own site.
// 'wasm-unsafe-eval' lets the barcode engines (WebAssembly) run; it does not allow eval().
// Added only to production builds, because the dev server needs inline scripts.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

// The policy only covers what comes after it, so it replaces a marker placed
// right after <meta charset> in index.html, before any script or stylesheet.
const cspMarker =
  '<!-- content-security-policy: filled in by vite.config.ts in production builds -->';

function addContentSecurityPolicy(): Plugin {
  return {
    name: 'add-content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      if (!html.includes(cspMarker)) {
        throw new Error('index.html is missing the content-security-policy marker');
      }
      return html.replace(
        cspMarker,
        `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}" />`,
      );
    },
  };
}

// Expected build warning: 'Module "module" has been externalized for browser compatibility,
// imported by gs1encoder-wasm.mjs'. That import only runs under Node (tests); in the
// browser the engine never reaches it, so the empty stand-in Vite puts there is fine.

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    tailwindcss(),
    addContentSecurityPolicy(),
    thirdPartyLicenses(version),
    VitePWA({
      registerType: 'autoUpdate',
      // Load the service worker registration from a separate file, not an inline script,
      // so it passes the Content Security Policy.
      injectRegister: 'script-defer',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: appName,
        short_name: fixedCopy ? `Barcodes ${version}` : 'Barcodes',
        description: 'Scan GS1 barcodes and see exactly what they contain. Works offline.',
        lang: 'en',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // A new version takes over as soon as it is downloaded, instead of waiting
        // until every open copy of the app is closed. (These are normally set by
        // registerType 'autoUpdate', but not when the registration is a separate script.)
        skipWaiting: true,
        clientsClaim: true,
        // Workbox's clean-up deletes every offline copy whose name contains this site's
        // address, which would include the fixed release copies and previews below it.
        // Not needed: it only removes leftovers of Workbox versions this app never used.
        cleanupOutdatedCaches: false,
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,webmanifest,json,txt}'],
        navigateFallbackDenylist: [otherSitesBelowUs],
      },
    }),
  ],
  server: {
    // The shared test vectors in ../spec are also used as examples in the app.
    fs: { allow: ['..'] },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // The results also go to a file, for the traceability matrix (npm run trace).
    reporters: ['default', 'json'],
    outputFile: { json: 'reports/unit-tests.json' },
  },
});
