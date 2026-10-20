import { describe, expect, it } from 'vitest';
import { makeBackup, readBackup, type ScanForBackup } from './backup';

const scan: ScanForBackup = {
  scannedAt: '2026-10-20T10:00:00.000Z',
  source: 'camera',
  format: 'DataMatrix',
  symbologyId: ']d2',
  bytes: Uint8Array.from([0x31, 0x30, 0x41, 0x1d, 0x32, 0x31, 0xff]),
};

describe('history backup', () => {
  it('[REQ-HIS-004] [REQ-DAT-001] keeps every byte, the GS separator included, through a round trip', () => {
    const text = JSON.stringify(makeBackup([scan], '0.0.1', new Date('2026-10-21T08:00:00Z')));
    expect(readBackup(text)).toEqual([scan]);
  });

  it('[REQ-HIS-005] refuses files that are not a backup from this app', () => {
    expect(() => readBackup('not json')).toThrow('not JSON');
    expect(() => readBackup('{"format":"something-else"}')).toThrow('not a Barcode Inspector');
    expect(() =>
      readBackup('{"format":"barcode-inspector-history","version":99,"scans":[]}'),
    ).toThrow('version 99');
  });

  it('[REQ-HIS-005] refuses dates, identifiers and sizes this app never writes', () => {
    const bad = (change: Record<string, unknown>) => {
      const backup = makeBackup([scan], '0.0.1', new Date());
      Object.assign(backup.scans[0] ?? {}, change);
      return () => readBackup(JSON.stringify(backup));
    };
    expect(bad({ scannedAt: 'Jan 1 2030' })).toThrow('no valid date');
    expect(bad({ symbologyId: '' })).toThrow('no valid barcode type');
    expect(bad({ symbologyId: 'd2' })).toThrow('no valid barcode type');
    expect(bad({ hex: '00 '.repeat(9000) })).toThrow('too much');
    const many = makeBackup(Array(1001).fill(scan), '0.0.1', new Date());
    expect(() => readBackup(JSON.stringify(many))).toThrow('more than 1000 scans');
  });

  it('[REQ-HIS-005] refuses damaged scans, naming which one', () => {
    const backup = makeBackup([scan, scan], '0.0.1', new Date());
    const second = backup.scans[1];
    if (second) second.hex = '3G';
    expect(() => readBackup(JSON.stringify(backup))).toThrow(
      'Scan 2 in the backup has damaged data',
    );
  });
});
