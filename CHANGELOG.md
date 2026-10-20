# Changelog

Versions before 1.0.0 are previews: features and behaviour may still change, and there
is no promise of stability. From 1.0.0 on, every release also stays available, unchanged,
at its own address: `https://m-p-p-c.github.io/Barcode-Tool/v/<version>/`.

## 0.5.0 — 2026-10-20 (preview)

The first public preview of a free, offline GS1 barcode scanner for phones.

- **Live camera scanning.** Reads by itself, beeps and vibrates, freezes the picture with the code outlined, and ignores the same code for 2 seconds. Zoom, light and focus appear where the browser offers them (Chrome on Android), and camera switching where the phone lists several cameras. Clear help when camera access is blocked.
- **Scan from a photo.** Uses the phone's own camera app at full resolution, which works best for tiny codes and on iPhone. Several codes in one photo are all read.
- **Exact data.** The raw message with every group separator (GS) shown, a hex view, and the symbology identifier. Nothing is changed, corrected or opened by itself.
- **Checked by GS1's own engine.** The GS1 Barcode Syntax Engine checks AIs, check digits, lengths, dates and AI combinations, for GS1 DataMatrix, GS1-128, GS1 QR Code, GS1 DataBar, EAN/UPC and GS1 Digital Link. Errors show the faulty characters. Other barcodes are shown as plain content.
- **Copy and share** as AI syntax, raw data with `{GS}`, Digital Link or JSON.
- **History** on the device, with delete, and backup files that are checked again when loaded.
- **GS1 checker** for typed-in data.
- **Works offline** and installs to the home screen. No server, accounts, analytics, ads or cookies; the app never contacts other websites.
- About page with the privacy statement, install steps for Android and iPhone, and the licenses of the open-source parts it contains, collected by the build.

Engines: GS1 Barcode Syntax Engine (`gs1encoder` 1.4.1), zxing-wasm 3.1.6 (zxing-cpp).
