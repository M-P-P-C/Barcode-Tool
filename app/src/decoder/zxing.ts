// Reads barcodes from images with zxing-wasm (zxing-cpp compiled to WebAssembly).
// Used inside the Web Worker in the app, and directly in Node by the tests.
// Only this file and the worker know about zxing-wasm; everyone else gets RawScan.

import { prepareZXingModule, readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';
import type { Point, RawScan } from '../core/models';

/**
 * Tells zxing-wasm where its .wasm file is. By default it would download it from a
 * public CDN, which our Content Security Policy forbids: we always pass our own copy.
 */
export function setWasmSource(source: { url: string } | { binary: ArrayBuffer }): void {
  if ('binary' in source) {
    prepareZXingModule({ overrides: { wasmBinary: source.binary } });
  } else {
    // fireImmediately: start downloading and compiling the .wasm now, so the first
    // photo does not wait for it. A failure here shows up again on the first read.
    prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith('.wasm') ? source.url : prefix + path,
      },
      fireImmediately: true,
    }).catch(() => undefined);
  }
}

const OPTIONS: ReaderOptions = {
  formats: [], // all formats the reader knows
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  maxNumberOfSymbols: 255,
  // A 1D barcode (EAN, UPC, Code 128, ...) only counts when 3 scan lines across it agree
  // (the reader's default is 2). With 2, damaged test images produced made-up EAN/UPC
  // numbers with a valid check digit; a missed read is better than wrong data.
  minLineCount: 3,
};

/**
 * Finds every barcode in an image: an encoded image file (PNG, JPEG, ...) or raw pixels.
 * Only fully decoded barcodes are returned; `bytes` is the message exactly as encoded,
 * never the decoder's reformatted text.
 */
export async function decodeImage(image: Blob | Uint8Array | ImageData): Promise<RawScan[]> {
  const results = await readBarcodes(image, OPTIONS);
  const scans: RawScan[] = results
    .filter((r) => r.isValid)
    .map((r) => ({
      format: r.format,
      symbologyId: r.symbologyIdentifier,
      bytes: r.bytes,
      corners: [
        r.position.topLeft,
        r.position.topRight,
        r.position.bottomRight,
        r.position.bottomLeft,
      ].map(({ x, y }) => ({ x, y })),
    }));
  return withoutDuplicates(scans);
}

/**
 * The reader sometimes finds the same barcode twice: for example the top and bottom half
 * of a damaged 1D barcode, side by side. Identical results that touch or nearly touch in
 * the picture are the same barcode; identical results further apart (two identical
 * labels) are kept.
 */
export function withoutDuplicates(scans: RawScan[]): RawScan[] {
  const kept: RawScan[] = [];
  for (const scan of scans) {
    const duplicate = kept.some(
      (other) =>
        other.symbologyId === scan.symbologyId &&
        other.bytes.length === scan.bytes.length &&
        other.bytes.every((byte, i) => byte === scan.bytes[i]) &&
        boxesNearlyTouch(other.corners, scan.corners),
    );
    if (!duplicate) kept.push(scan);
  }
  return kept;
}

function boxesNearlyTouch(a: Point[], b: Point[]): boolean {
  const box = (points: Point[]) => ({
    left: Math.min(...points.map((p) => p.x)),
    right: Math.max(...points.map((p) => p.x)),
    top: Math.min(...points.map((p) => p.y)),
    bottom: Math.max(...points.map((p) => p.y)),
  });
  const p = box(a);
  const q = box(b);
  // Gap allowed: 5% of the larger barcode's longest side, at least 8 pixels.
  const size = Math.max(p.right - p.left, p.bottom - p.top, q.right - q.left, q.bottom - q.top);
  const gap = Math.max(8, size * 0.05);
  return (
    p.left - gap <= q.right &&
    q.left - gap <= p.right &&
    p.top - gap <= q.bottom &&
    q.top - gap <= p.bottom
  );
}
