// Scan history, saved on this device in the browser's database (IndexedDB).
// Nothing leaves the device. A backup file can be exported and imported again.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { MAX_BACKUP_SCANS, makeBackup, readBackup } from '../core/backup';
import type { ParsedScan } from '../core/models';

/** The newest scans kept; older ones are removed as new ones arrive. */
export const HISTORY_LIMIT = MAX_BACKUP_SCANS;

export interface NewScan {
  scannedAt: string;
  source: 'camera' | 'photo';
  /** The decoder's name for the barcode type, e.g. "DataMatrix". */
  format: string;
  /** The result the GS1 engine gave at scan time, with the exact bytes. */
  parsed: ParsedScan;
  appVersion: string;
  engineVersion: string;
}

export interface StoredScan extends NewScan {
  id: number;
}

interface HistoryDb extends DBSchema {
  scans: {
    key: number;
    value: StoredScan;
    indexes: { scannedAt: string };
  };
}

let opening: Promise<IDBPDatabase<HistoryDb>> | null = null;

function db(): Promise<IDBPDatabase<HistoryDb>> {
  opening ??= openDB<HistoryDb>('barcode-inspector', 1, {
    upgrade(database) {
      const store = database.createObjectStore('scans', { keyPath: 'id', autoIncrement: true });
      store.createIndex('scannedAt', 'scannedAt');
    },
  }).catch((e: unknown) => {
    opening = null; // e.g. storage blocked in a private window: try again next time
    throw e;
  });
  return opening;
}

/** Saves a scan and returns its number in the history. */
export async function saveScan(scan: NewScan): Promise<number> {
  const database = await db();
  // "id" is filled in by the database.
  const id = await database.add('scans', scan as StoredScan);
  await trimToLimit(database);
  void keepHistoryOnce(); // so the browser doesn't clear it to free space
  return id;
}

/** Every saved scan, newest first. */
export async function listScans(): Promise<StoredScan[]> {
  const scans = await (await db()).getAllFromIndex('scans', 'scannedAt');
  return scans.reverse();
}

export async function getScan(id: number): Promise<StoredScan | undefined> {
  return (await db()).get('scans', id);
}

export async function deleteScan(id: number): Promise<void> {
  await (await db()).delete('scans', id);
}

export async function clearHistory(): Promise<void> {
  await (await db()).clear('scans');
}

/** The whole history as the text of a backup file. */
export async function exportBackup(appVersion: string): Promise<string> {
  const scans = (await listScans()).reverse(); // oldest first, like a log
  const backup = makeBackup(
    scans.map((scan) => ({
      scannedAt: scan.scannedAt,
      source: scan.source,
      format: scan.format,
      symbologyId: scan.parsed.symbologyId,
      bytes: scan.parsed.bytes,
    })),
    appVersion,
    new Date(),
  );
  return JSON.stringify(backup, null, 2);
}

/**
 * Adds the scans of a backup file. The GS1 engine checks each one again (`check`).
 * Scans already in the history (same time, identifier and bytes) are skipped; identical
 * scans inside the file (e.g. two identical labels in one photo) are all added.
 * Either the whole file is added or, if anything fails, nothing is.
 * Throws an Error with a message for the user when the file can't be read.
 */
export async function importBackup(
  text: string,
  check: (symbologyId: string, bytes: Uint8Array) => ParsedScan,
  info: { appVersion: string; engineVersion: string },
): Promise<{ added: number; skipped: number; removed: number }> {
  const incoming = readBackup(text);
  // Check everything first, so a failure leaves the history as it was.
  const entries: NewScan[] = incoming.map((scan) => ({
    scannedAt: scan.scannedAt,
    source: scan.source,
    format: scan.format,
    parsed: check(scan.symbologyId, scan.bytes),
    ...info,
  }));

  const database = await db();
  // How many copies of each scan the history already has.
  const already = new Map<string, number>();
  for (const scan of await database.getAll('scans')) {
    const key = sameScanKey(scan);
    already.set(key, (already.get(key) ?? 0) + 1);
  }
  const transaction = database.transaction('scans', 'readwrite');
  let added = 0;
  let skipped = 0;
  for (const entry of entries) {
    const key = sameScanKey(entry);
    const copies = already.get(key) ?? 0;
    if (copies > 0) {
      already.set(key, copies - 1); // this one is already in the history
      skipped++;
      continue;
    }
    await transaction.store.add(entry as StoredScan);
    added++;
  }
  await transaction.done;
  const removed = await trimToLimit(database);
  return { added, skipped, removed };
}

/** Same time, same identifier, same bytes: the same scan. */
function sameScanKey(scan: NewScan): string {
  return `${scan.scannedAt} ${scan.parsed.symbologyId} ${Array.from(scan.parsed.bytes).join(',')}`;
}

/** Removes the oldest scans beyond HISTORY_LIMIT, and returns how many it removed. */
async function trimToLimit(database: IDBPDatabase<HistoryDb>): Promise<number> {
  let extra = (await database.count('scans')) - HISTORY_LIMIT;
  if (extra <= 0) return 0;
  const removing = extra;
  const transaction = database.transaction('scans', 'readwrite');
  let cursor = await transaction.store.index('scannedAt').openCursor(); // oldest first
  while (cursor && extra > 0) {
    await cursor.delete();
    extra--;
    cursor = await cursor.continue();
  }
  await transaction.done;
  return removing;
}

export type KeepStatus = 'kept' | 'not-kept' | 'unknown';

let askedOnce = false;

/** Asks once per visit, after the first save. */
function keepHistoryOnce(): Promise<KeepStatus> {
  if (askedOnce) return historyKept();
  askedOnce = true;
  return keepHistory();
}

/**
 * Asks the browser to keep the history even when the device runs low on space.
 * Chrome and Safari decide by themselves (installed apps are usually kept); Firefox may
 * ask the user.
 */
export async function keepHistory(): Promise<KeepStatus> {
  if (typeof navigator.storage?.persist !== 'function') return 'unknown';
  try {
    return (await navigator.storage.persist()) ? 'kept' : 'not-kept';
  } catch {
    return 'unknown';
  }
}

/** Whether the browser has promised to keep the history. */
export async function historyKept(): Promise<KeepStatus> {
  if (typeof navigator.storage?.persisted !== 'function') return 'unknown';
  try {
    return (await navigator.storage.persisted()) ? 'kept' : 'not-kept';
  } catch {
    return 'unknown';
  }
}
