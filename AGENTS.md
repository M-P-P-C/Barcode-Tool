# AGENTS.md — Barcode Inspector

The rules the code follows, for people and coding agents working on it.

## What this is
Offline progressive web app that scans GS1 barcodes with the phone camera. It keeps
FNC1/GS separators and validates data with the GS1 Barcode Syntax Engine.

## Repository
- app/     the web app (Vite + React + TypeScript)
- spec/    shared test vectors, fixtures and requirements (requirements.json)
- tools/   fixture generator (Python)
- docs/    the roadmap

## Stack
TypeScript (strict), React, Vite, Tailwind CSS, vite-plugin-pwa.
Decoder: zxing-wasm. GS1: gs1encoder (GS1 Syntax Engine, WebAssembly).
Storage: IndexedDB via idb. Tests: Vitest, Playwright.
Hosting: GitHub Pages from the gh-pages branch.

## Source folders (app/src/)
- camera/    getUserMedia, capability detection, photo mode
- decoder/   BarcodeDecoder interface + zxing-wasm worker
- gs1/       facade over gs1encoder
- core/      models, classifier, formatting (no browser APIs)
- storage/   IndexedDB history, export and import
- ui/        screens and components

## Commands (run in app/)
- Dev server:  npm run dev
- Type check:  npm run typecheck
- Lint:        npm run lint
- Unit tests:  npm test        (Vitest, in Node)
- E2E tests:   npm run e2e     (Playwright, fake camera)
- Traceability: npm run trace  (after npm test and npm run e2e; writes reports/traceability.md)
- Build:       npm run build
- Fixtures (repo root): python tools/make_fixtures.py

## Hard rules
1. Never drop or alter GS (ASCII 29) characters or the symbology identifier.
   GS1 input is always symbology identifier + raw bytes.
2. Never parse GS1 from decoder text. Use bytes.
3. Never hand-code GS1 AI tables, lengths, check digits or date rules. Use the GS1 engine.
4. No backend, analytics, ads or third-party requests. Every file, including .wasm,
   is served from our own site. Keep the Content Security Policy strict.
5. Never auto-correct scanned data. Never open URLs automatically.
6. Feature-detect every camera control. The app must work without zoom, torch or focus.
7. Decoding runs in a Web Worker, never on the main thread.
8. Test expectations come from spec/, never duplicated inside test code.

## Requirements and traceability
- Every behaviour the app promises is a requirement in spec/requirements.json, with a
  permanent ID (REQ-<AREA>-<NNN>), a risk (high or low) and how it is verified
  (test, manual or inspection).
- IDs are never renumbered or reused. A requirement that no longer applies keeps its ID
  and gets "status": "withdrawn".
- Every test that verifies a requirement names its ID in the test title, e.g.
  `it('[REQ-DAT-001] keeps the GS separator ...')`. Tests built from spec/gs1-vectors.json
  take the IDs from the vector's "requirements" field.
- CI fails when a test names an unknown ID, or a requirement verified by "test" has no
  passing test.

## Saved data
- The live site and every fixed release copy (`/v/<version>/`) share one browser storage.
  Never change the history database or the settings keys in a way that older versions
  can't read; use a new database name instead.
- Keep `cleanupOutdatedCaches: false` in app/vite.config.ts: Workbox's clean-up would
  delete the offline files of the fixed copies below the live site.
