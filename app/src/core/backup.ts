// The history backup file. It holds only what the barcode contained (identifier and exact
// bytes) and when it was scanned. Results are not stored in the file: on import, the GS1
// engine checks every scan again, so an edited file can't make bad data look valid.
import { toHex } from './scanText';

export const BACKUP_FORMAT = 'barcode-inspector-history';
export const BACKUP_VERSION = 1;

/** The most scans a backup may hold: the history keeps no more than this. */
export const MAX_BACKUP_SCANS = 1000;
/** Barcodes hold at most about 3,000 bytes (a large QR Code); this leaves room. */
const MAX_SCAN_BYTES = 8192;
/** A full backup is well under 2 MB; larger files are refused before reading. */
export const MAX_BACKUP_FILE_BYTES = 5_000_000;
/** Dates exactly as the app writes them, e.g. 2026-10-20T10:00:00.000Z. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
/** An AIM symbology identifier: "]", a letter, then one more character, e.g. "]d2". */
const SYMBOLOGY_ID = /^\][A-Za-z][0-9A-Za-z]$/;

/** One scan as written to the backup file. */
export interface BackupScan {
  scannedAt: string;
  source: 'camera' | 'photo';
  /** The decoder's name for the barcode type, e.g. "DataMatrix". */
  format: string;
  symbologyId: string;
  /** Every byte, as hex pairs: "30 31 1D". */
  hex: string;
}

export interface ScanForBackup {
  scannedAt: string;
  source: 'camera' | 'photo';
  format: string;
  symbologyId: string;
  bytes: Uint8Array;
}

export function makeBackup(scans: ScanForBackup[], appVersion: string, now: Date) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    appVersion,
    scans: scans.map((scan): BackupScan => ({
      scannedAt: scan.scannedAt,
      source: scan.source,
      format: scan.format,
      symbologyId: scan.symbologyId,
      hex: toHex(scan.bytes),
    })),
  };
}

/**
 * Reads a backup file's text. Throws an Error with a message for the user when the file
 * is not a backup from this app, or is damaged.
 */
export function readBackup(text: string): ScanForBackup[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not a history backup (it is not JSON).');
  }
  if (!isObject(data) || data.format !== BACKUP_FORMAT) {
    throw new Error('This file is not a Barcode Inspector history backup.');
  }
  if (data.version !== BACKUP_VERSION) {
    throw new Error(`This backup has version ${String(data.version)}, which this app can't read.`);
  }
  if (!Array.isArray(data.scans)) throw new Error('This backup has no list of scans.');
  if (data.scans.length > MAX_BACKUP_SCANS) {
    throw new Error(
      `This backup has more than ${MAX_BACKUP_SCANS} scans, which this app can't hold.`,
    );
  }
  return data.scans.map((scan: unknown, i: number) => {
    const where = `Scan ${i + 1} in the backup`;
    if (!isObject(scan)) throw new Error(`${where} is damaged.`);
    const { scannedAt, source, format, symbologyId, hex } = scan;
    if (
      typeof scannedAt !== 'string' ||
      !ISO_DATE.test(scannedAt) ||
      Number.isNaN(Date.parse(scannedAt))
    ) {
      throw new Error(`${where} has no valid date.`);
    }
    if (source !== 'camera' && source !== 'photo') throw new Error(`${where} has no source.`);
    if (
      typeof format !== 'string' ||
      format.length > 64 ||
      typeof symbologyId !== 'string' ||
      !SYMBOLOGY_ID.test(symbologyId)
    ) {
      throw new Error(`${where} has no valid barcode type.`);
    }
    if (typeof hex !== 'string' || hex.length > MAX_SCAN_BYTES * 3) {
      throw new Error(`${where} has no data, or too much.`);
    }
    return { scannedAt, source, format, symbologyId, bytes: hexToBytes(hex, where) };
  });
}

/** "30 31 1D" (spaces optional) to bytes. */
function hexToBytes(hex: string, where: string): Uint8Array {
  const digits = hex.replace(/\s+/g, '');
  if (digits.length % 2 !== 0 || /[^0-9a-f]/i.test(digits)) {
    throw new Error(`${where} has damaged data.`);
  }
  const bytes = new Uint8Array(digits.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(digits.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
