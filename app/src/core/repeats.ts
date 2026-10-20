// The live camera reads the same barcode many times a second. This decides which reads
// are new: a barcode seen less than 2 seconds ago is a repeat and is ignored.
import type { RawScan } from './models';
import { toHex } from './scanText';

export const REPEAT_WINDOW_MS = 2000;

/** Identifies a barcode's content: same symbology identifier and same bytes, same key. */
export function scanKey(scan: RawScan): string {
  return `${scan.symbologyId} ${toHex(scan.bytes)}`;
}

export interface RepeatFilter {
  /**
   * True when a frame shows at least one barcode not seen in the last 2 seconds.
   * Every barcode in the frame counts as seen now, so a code that stays in view keeps
   * being ignored until it has been out of view for 2 seconds.
   * @param keys scanKey() of each barcode in the frame
   * @param now  time in milliseconds, e.g. performance.now()
   */
  isNew(keys: string[], now: number): boolean;
  /**
   * Counts the barcodes of the last new frame as seen now. Called when scanning resumes
   * after a read, so the camera, still pointing at the same code, doesn't read it again.
   */
  restart(now: number): void;
}

export function createRepeatFilter(windowMs = REPEAT_WINDOW_MS): RepeatFilter {
  const lastSeen = new Map<string, number>();
  let lastNew: string[] = [];

  return {
    isNew(keys, now) {
      // Forget barcodes not seen for a while, so the list stays short.
      for (const [key, time] of lastSeen) {
        if (now - time >= windowMs) lastSeen.delete(key);
      }
      const isNew = keys.some((key) => !lastSeen.has(key));
      for (const key of keys) lastSeen.set(key, now);
      if (isNew) lastNew = keys;
      return isNew;
    },
    restart(now) {
      for (const key of lastNew) lastSeen.set(key, now);
    },
  };
}
