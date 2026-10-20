// The history database, tested in Node with an in-memory IndexedDB (fake-indexeddb).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ParsedScan } from '../core/models';
import {
  clearHistory,
  deleteScan,
  exportBackup,
  getScan,
  HISTORY_LIMIT,
  importBackup,
  listScans,
  saveScan,
  type NewScan,
} from './history';

// A stand-in for the GS1 engine: these tests are about storage, not GS1 rules.
const check = (symbologyId: string, bytes: Uint8Array): ParsedScan => ({
  symbologyId,
  kind: 'text',
  bytes,
  elements: [],
  bracketed: null,
  digitalLink: null,
  issues: [],
  valid: true,
});

const INFO = { appVersion: '0.0.1', engineVersion: 'test' };

function scanAt(minute: number, bytes = [0x41, 0x1d, 0x42]): NewScan {
  return {
    scannedAt: new Date(Date.UTC(2026, 9, 20, 10, minute)).toISOString(),
    source: 'camera',
    format: 'DataMatrix',
    parsed: check(']d2', Uint8Array.from(bytes)),
    ...INFO,
  };
}

beforeEach(async () => {
  await clearHistory();
});

describe('scan history', () => {
  it('[REQ-HIS-002] [REQ-DAT-001] lists scans newest first and keeps the bytes exactly', async () => {
    await saveScan(scanAt(1));
    await saveScan(scanAt(3));
    await saveScan(scanAt(2));
    const scans = await listScans();
    expect(scans.map((s) => s.scannedAt.slice(11, 16))).toEqual(['10:03', '10:02', '10:01']);
    expect(Array.from(scans[0]?.parsed.bytes ?? [])).toEqual([0x41, 0x1d, 0x42]);
  });

  it('[REQ-HIS-002] finds and deletes one scan', async () => {
    const id = await saveScan(scanAt(1));
    expect((await getScan(id))?.format).toBe('DataMatrix');
    await deleteScan(id);
    expect(await getScan(id)).toBeUndefined();
  });

  it(`[REQ-HIS-003] keeps only the newest ${HISTORY_LIMIT} scans`, async () => {
    for (let i = 0; i < HISTORY_LIMIT + 2; i++) await saveScan(scanAt(i));
    const scans = await listScans();
    expect(scans).toHaveLength(HISTORY_LIMIT);
    expect(scans.at(-1)?.scannedAt).toBe(scanAt(2).scannedAt); // minutes 0 and 1 removed
  });

  it('[REQ-HIS-004] exports and imports a backup, skipping scans already there', async () => {
    await saveScan(scanAt(1));
    await saveScan(scanAt(2, [0x31, 0x32]));
    const backup = await exportBackup('0.0.1');

    expect(await importBackup(backup, check, INFO)).toMatchObject({ added: 0, skipped: 2 });

    await clearHistory();
    expect(await importBackup(backup, check, INFO)).toMatchObject({ added: 2, skipped: 0 });
    const scans = await listScans();
    expect(scans.map((s) => Array.from(s.parsed.bytes))).toEqual([
      [0x31, 0x32],
      [0x41, 0x1d, 0x42],
    ]);
  });

  it('[REQ-HIS-004] keeps identical scans inside one backup, e.g. two identical labels in one photo', async () => {
    await saveScan(scanAt(1));
    await saveScan(scanAt(1));
    const backup = await exportBackup('0.0.1');
    await clearHistory();
    expect(await importBackup(backup, check, INFO)).toMatchObject({ added: 2, skipped: 0 });
    expect(await importBackup(backup, check, INFO)).toMatchObject({ added: 0, skipped: 2 });
  });

  it('[REQ-HIS-004] adds nothing when a scan fails its check halfway through the file', async () => {
    await saveScan(scanAt(1));
    await saveScan(scanAt(2));
    const backup = await exportBackup('0.0.1');
    await clearHistory();
    let calls = 0;
    const failing = (symbologyId: string, bytes: Uint8Array) => {
      if (++calls === 2) throw new Error('engine failure');
      return check(symbologyId, bytes);
    };
    await expect(importBackup(backup, failing, INFO)).rejects.toThrow('engine failure');
    expect(await listScans()).toHaveLength(0);
  });

  it('[REQ-HIS-004] checks every imported scan again', async () => {
    await saveScan(scanAt(1));
    const backup = await exportBackup('0.0.1');
    await clearHistory();
    const seen: string[] = [];
    await importBackup(
      backup,
      (symbologyId, bytes) => {
        seen.push(symbologyId);
        return check(symbologyId, bytes);
      },
      INFO,
    );
    expect(seen).toEqual([']d2']);
  });
});
