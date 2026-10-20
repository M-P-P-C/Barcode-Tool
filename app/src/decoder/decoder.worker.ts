// Web Worker: decodes images away from the main thread, so the screen never freezes
// (AGENTS.md rule 7). Receives an image file, answers with RawScans.
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import type { DecodeResult } from './types';
import { decodeImage, setWasmSource } from './zxing';

setWasmSource({ url: wasmUrl });

/** A photo or image file (image), or one picture from the live camera (frame). */
export type DecodeRequest = { id: number; image: Blob } | { id: number; frame: ImageData };

export type DecodeResponse =
  { id: number; ok: true; result: DecodeResult } | { id: number; ok: false; error: string };

/** Phone photos are about 4000 px wide; larger images are scaled down to save memory. */
const MAX_SIDE = 4096;

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = async (event: MessageEvent<DecodeRequest>) => {
  const request = event.data;
  const id = request.id;
  const started = performance.now();
  try {
    // Camera frames are already pixels, the right way up.
    const { pixels, size } =
      'frame' in request
        ? {
            pixels: request.frame,
            size: { width: request.frame.width, height: request.frame.height },
          }
        : await loadPixels(request.image);
    const scans = await decodeImage(pixels);
    const result: DecodeResult = { scans, size, millis: Math.round(performance.now() - started) };
    const response: DecodeResponse = { id, ok: true, result };
    worker.postMessage(response);
  } catch (e) {
    const response: DecodeResponse = {
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
    worker.postMessage(response);
  }
};

/**
 * Turns the file into pixels the way the phone shows it, honouring the photo's
 * rotation flag (EXIF). Falls back to letting the decoder read the file itself.
 */
async function loadPixels(
  image: Blob,
): Promise<{ pixels: ImageData | Blob; size: DecodeResult['size'] }> {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
    return { pixels: image, size: null };
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' });
  } catch {
    // Some older browsers reject the orientation option: let the decoder read the file.
    return { pixels: image, size: null };
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const context = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    return { pixels: image, size: null };
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { pixels: context.getImageData(0, 0, width, height), size: { width, height } };
}
