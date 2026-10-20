# Barcode Inspector

A free, offline barcode scanner for GS1 codes that runs in your phone's browser. It shows exactly what a barcode contains, including the invisible separators, and checks the data with GS1's own validation engine. No ads, no accounts, and nothing you scan leaves your device.

**Try it:** https://m-p-p-c.github.io/Barcode-Tool/

**Status:** a preview (0.x): features and behaviour may still change. See [CHANGELOG.md](CHANGELOG.md) for what each version contains, and [docs/ROADMAP.md](docs/ROADMAP.md) for what comes next.

## What it does

- Scans with the live camera, or from a photo taken with the phone's own camera app (best for tiny codes, and on iPhone).
- Shows the raw data exactly as read, with every group separator (GS) visible, a hex view and the symbology identifier.
- Checks GS1 data (GS1 DataMatrix, GS1-128, GS1 QR Code, GS1 DataBar, EAN/UPC and GS1 Digital Link) with the GS1 Barcode Syntax Engine: AIs, check digits, lengths, dates and AI combinations.
- Copies or shares results as AI syntax, raw data with `{GS}`, Digital Link or JSON.
- Keeps a history on the device, with backup files.
- Works offline and installs to the home screen.

## How this repository works

Development happens in a separate repository. This one receives each released version as a single commit, with its tag (`v0.5.0` and so on), so it always holds the exact source of what runs on the site. Suggestions and bug reports are welcome as issues.

## Develop

Needs Node 22 or newer.

```sh
cd app
npm install
npm run dev        # local dev server
npm test           # unit tests
npm run e2e        # browser tests with a fake camera (first: npx playwright install chromium)
npm run trace      # traceability matrix from the results of both, in app/reports/
npm run build      # production build in app/dist
```

The rules the code follows are in [AGENTS.md](AGENTS.md). The test images in `spec/fixtures/generated/` are drawn by `tools/make_fixtures.py` from `spec/gs1-vectors.json` (needs `pip install -r tools/requirements.txt`).

## Requirements and traceability

Every requirement has a permanent ID in [`spec/requirements.json`](spec/requirements.json), and every test names the IDs it verifies, for example `[REQ-DAT-001]`. Each CI run builds the traceability matrix from the test results and shows it on the run's summary page.

## Third-party engines

| Engine | Use | License |
| --- | --- | --- |
| [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) (zxing-cpp compiled to WebAssembly) | Reading barcodes | MIT (zxing-cpp: Apache-2.0) |
| [gs1encoder](https://github.com/gs1/gs1-syntax-engine) (GS1 Barcode Syntax Engine) | Checking GS1 data | Apache-2.0 |

The app's About page lists every open-source part it contains, with its license.

Barcode Inspector is a working name. GS1 is a registered trademark of GS1 AISBL; this project is not affiliated with GS1.

## License

[Apache-2.0](LICENSE)
