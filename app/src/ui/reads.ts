// What happens after the camera or a photo reads barcodes: the GS1 engine checks each
// one, the results are shown, and then each is saved to the history on this device.
import type { ParsedScan, RawScan } from '../core/models';
import { saveScan } from '../storage/history';
import { loadGs1 } from './engines';

/** Saving to the history: not done yet, done, or failed with the browser's reason. */
export type SaveState =
  { status: 'saving' } | { status: 'saved' } | { status: 'failed'; saved: number; reason: string };

export interface Read {
  source: 'camera' | 'photo';
  scans: RawScan[];
  /** The GS1 engine's result for each scan, in the same order. */
  parsed: ParsedScan[];
  scannedAt: string;
  engineVersion: string;
  save: SaveState;
}

/** Checks every scan with the GS1 engine. Nothing is saved yet. */
export async function checkScans(scans: RawScan[], source: 'camera' | 'photo'): Promise<Read> {
  const gs1 = await loadGs1();
  return {
    source,
    scans,
    parsed: scans.map((scan) => gs1.processScan(scan.symbologyId, scan.bytes)),
    scannedAt: new Date().toISOString(),
    engineVersion: gs1.engineVersion,
    save: { status: 'saving' },
  };
}

/** Saves every result of a read to the history. Never throws: failures are returned. */
export async function saveRead(read: Read): Promise<SaveState> {
  let saved = 0;
  try {
    for (const [i, result] of read.parsed.entries()) {
      await saveScan({
        scannedAt: read.scannedAt,
        source: read.source,
        format: read.scans[i]?.format ?? '',
        parsed: result,
        appVersion: __APP_VERSION__,
        engineVersion: read.engineVersion,
      });
      saved++;
    }
    return { status: 'saved' };
  } catch (e) {
    return { status: 'failed', saved, reason: e instanceof Error ? e.message : String(e) };
  }
}
