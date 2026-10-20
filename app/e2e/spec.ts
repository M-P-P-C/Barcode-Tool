// Test data for the browser tests, read from spec/ (AGENTS.md rule 8: expected results
// live only there). Each vector with a "barcode" field has generated test images.
import { readFileSync } from 'node:fs';

const SPEC = new URL('../../spec/', import.meta.url);

interface Vector {
  id: string;
  symbologyId: string;
  message: string;
  expect: { bracketed?: string };
}

interface ManifestImage {
  file: string;
  vector: string;
  variant: string;
}

const vectors: Vector[] = JSON.parse(readFileSync(new URL('gs1-vectors.json', SPEC), 'utf8')).scans;
const manifest: ManifestImage[] = JSON.parse(
  readFileSync(new URL('fixtures/generated/manifest.json', SPEC), 'utf8'),
).images;

export interface CleanFixture {
  vectorId: string;
  symbologyId: string;
  /** The message in the vector notation, with {GS} for each separator. */
  message: string;
  /** The expected AI syntax, when the vector has one. */
  bracketed: string | null;
  /** The barcode's bytes as the result screen's hex view shows them, e.g. "30 31 1D". */
  hex: string;
  /** The clean test image, as a data: address the page can load. */
  imageUrl: string;
  /** The image file on disk, for file pickers. */
  path: string;
}

/** Every vector's clean test image, with what reading it must give. */
export const cleanFixtures: CleanFixture[] = manifest
  .filter((image) => image.variant === 'clean')
  .map((image) => {
    const vector = vectors.find((v) => v.id === image.vector);
    if (!vector) throw new Error(`manifest.json names an unknown vector: ${image.vector}`);
    const url = new URL(`fixtures/generated/${image.file}`, SPEC);
    return {
      vectorId: vector.id,
      symbologyId: vector.symbologyId,
      message: vector.message,
      bracketed: vector.expect.bracketed ?? null,
      hex: messageHex(vector.message),
      imageUrl: `data:image/png;base64,${readFileSync(url).toString('base64')}`,
      path: url.pathname,
    };
  });

export function fixture(vectorId: string): CleanFixture {
  const found = cleanFixtures.find((f) => f.vectorId === vectorId);
  if (!found) throw new Error(`No clean test image for vector ${vectorId}`);
  return found;
}

/** The vector notation ({GS} for the separator) as the app's hex view: "41 1D 42". */
function messageHex(message: string): string {
  const bytes = Buffer.from(message.replaceAll('{GS}', '\x1d'), 'latin1');
  return Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}
