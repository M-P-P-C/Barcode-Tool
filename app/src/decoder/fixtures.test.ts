// Decodes every generated test image in spec/fixtures/generated/ and checks it gives
// exactly the expected symbology identifier and bytes (GS separators included).
// Clean images must all decode; for damaged ones the decode rate is printed, so
// changes can be compared with this baseline. A wrong result is never acceptable.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import manifest from '../../../spec/fixtures/generated/manifest.json';
import spec from '../../../spec/gs1-vectors.json';
import { parseGsTokens, withVisibleSeparators } from '../core/scanText';
import { createGs1Processor, type Gs1Processor } from '../gs1/processor';
import { decodeImage, setWasmSource } from './zxing';

const FIXTURES = new URL('../../../spec/fixtures/generated/', import.meta.url);
const WASM = new URL(
  '../../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm',
  import.meta.url,
);
const vectors = new Map(spec.scans.map((v) => [v.id, v]));

let gs1: Gs1Processor;
beforeAll(async () => {
  const wasm = readFileSync(WASM);
  setWasmSource({ binary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) });
  gs1 = await createGs1Processor();
});

type Outcome = 'read' | 'missed' | 'misread';

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/**
 * read:    exactly one barcode, with the vector's identifier and exactly its bytes
 * missed:  nothing found
 * misread: anything else, including an extra barcode that is not in the image
 */
async function decodeFixture(file: string, vectorId: string) {
  const vector = vectors.get(vectorId);
  if (!vector) throw new Error(`${file}: unknown vector ${vectorId}`);
  const expectedBytes = parseGsTokens(vector.message);
  const scans = await decodeImage(new Uint8Array(readFileSync(new URL(file, FIXTURES))));
  const only = scans.length === 1 ? scans[0] : undefined;
  const match =
    only && only.symbologyId === vector.symbologyId && sameBytes(only.bytes, expectedBytes)
      ? only
      : undefined;
  const outcome: Outcome = match ? 'read' : scans.length === 0 ? 'missed' : 'misread';
  return { vector, scans, match, outcome };
}

describe('generated test images', () => {
  it('[REQ-SCN-002] has a clean image for every vector with a barcode (re-run tools/make_fixtures.py if not)', () => {
    const drawn = new Set(
      manifest.images.filter((i) => i.variant === 'clean').map((i) => i.vector),
    );
    const missing = spec.scans.filter((v) => 'barcode' in v && !drawn.has(v.id)).map((v) => v.id);
    expect(missing).toEqual([]);
  });

  it('[REQ-SCN-002] [REQ-GS1-001] decodes every clean image exactly, and the GS1 engine agrees with the vector', async () => {
    for (const image of manifest.images.filter((i) => i.variant === 'clean')) {
      const { vector, scans, match } = await decodeFixture(image.file, image.vector);
      const got = scans.map((s) => `${s.symbologyId} ${withVisibleSeparators(s.bytes)}`);
      expect(match, `${image.file} read as ${JSON.stringify(got)}`).toBeDefined();
      if (!match) continue;
      // End to end: decoder bytes straight into the GS1 engine give the vector's result.
      const parsed = gs1.processScan(match.symbologyId, match.bytes);
      expect(parsed.valid, image.file).toBe(vector.expect.valid);
      if ('elements' in vector.expect && vector.expect.elements) {
        expect(
          parsed.elements.map(({ ai, value }) => ({ ai, value })),
          image.file,
        ).toEqual(vector.expect.elements);
      }
    }
  });

  it('[REQ-DAT-001] [REQ-GS1-001] keeps the GS separator between decoder and GS1 engine', async () => {
    const { match } = await decodeFixture(
      'dm-separator-after-batch--clean.png',
      'dm-separator-after-batch',
    );
    expect(match).toBeDefined();
    if (!match) return;
    const vector = vectors.get('dm-separator-after-batch');
    expect(Array.from(match.bytes)).toEqual(Array.from(parseGsTokens(vector?.message ?? '')));
    expect(match.bytes).toContain(0x1d);
  });

  it('[REQ-SCN-003] never returns wrong data from a damaged image, and reports the decode rate', async () => {
    const byCategory = new Map<string, Record<Outcome, number>>();
    const misreads: string[] = [];
    for (const image of manifest.images) {
      const { outcome, scans } = await decodeFixture(image.file, image.vector);
      const counts = byCategory.get(image.category) ?? { read: 0, missed: 0, misread: 0 };
      counts[outcome]++;
      byCategory.set(image.category, counts);
      if (outcome === 'misread') {
        misreads.push(
          `${image.file}: ${scans.map((s) => `${s.symbologyId} ${withVisibleSeparators(s.bytes)}`).join(', ')}`,
        );
      }
    }

    const rows = [...byCategory].map(([category, c]) => {
      const total = c.read + c.missed + c.misread;
      return `  ${category.padEnd(14)} ${String(c.read).padStart(3)}/${String(total).padEnd(3)} ${((100 * c.read) / total).toFixed(0).padStart(3)}%`;
    });
    const all = [...byCategory.values()].reduce((a, c) => a + c.read, 0);
    console.log(
      `\nDecode rate by category (${manifest.images.length} images):\n${rows.join('\n')}\n  ${'all'.padEnd(14)} ${all}/${manifest.images.length}\n`,
    );

    expect(misreads, 'images that decoded to the wrong data').toEqual([]);
    expect(byCategory.get('clean')?.missed).toBe(0);
  });
});
