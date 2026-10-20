import { describe, expect, it } from 'vitest';
import type { RawScan } from './models';
import { createRepeatFilter, scanKey } from './repeats';

describe('[REQ-CAM-002] createRepeatFilter', () => {
  it('ignores the same barcode for 2 seconds', () => {
    const filter = createRepeatFilter();
    expect(filter.isNew(['A'], 0)).toBe(true);
    expect(filter.isNew(['A'], 1999)).toBe(false);
  });

  it('keeps ignoring a barcode while it stays in view', () => {
    const filter = createRepeatFilter();
    expect(filter.isNew(['A'], 0)).toBe(true);
    for (let t = 500; t <= 10_000; t += 500) expect(filter.isNew(['A'], t)).toBe(false);
  });

  it('reads it again after 2 seconds out of view', () => {
    const filter = createRepeatFilter();
    filter.isNew(['A'], 0);
    expect(filter.isNew(['A'], 2000)).toBe(true);
  });

  it('reads a different barcode straight away', () => {
    const filter = createRepeatFilter();
    filter.isNew(['A'], 0);
    expect(filter.isNew(['B'], 100)).toBe(true);
  });

  it('counts a frame as new when one of its barcodes is new', () => {
    const filter = createRepeatFilter();
    filter.isNew(['A'], 0);
    expect(filter.isNew(['A', 'B'], 100)).toBe(true);
    expect(filter.isNew(['B', 'A'], 200)).toBe(false);
    expect(filter.isNew(['A'], 300)).toBe(false);
  });

  it('after a restart, ignores the code the camera is still pointing at', () => {
    const filter = createRepeatFilter();
    filter.isNew(['A'], 0);
    // The result stays on screen for 10 seconds; no frames are read meanwhile.
    filter.restart(10_000);
    expect(filter.isNew(['A'], 10_500)).toBe(false);
    expect(filter.isNew(['B'], 10_600)).toBe(true);
  });
});

describe('[REQ-CAM-002] scanKey', () => {
  const scan = (symbologyId: string, bytes: number[]): RawScan => ({
    format: 'test',
    symbologyId,
    bytes: Uint8Array.from(bytes),
    corners: [],
  });

  it('tells barcodes apart by identifier and every byte, including GS', () => {
    expect(scanKey(scan(']d2', [0x31, 0x1d, 0x32]))).toBe(scanKey(scan(']d2', [0x31, 0x1d, 0x32])));
    expect(scanKey(scan(']d2', [0x31, 0x1d, 0x32]))).not.toBe(scanKey(scan(']d2', [0x31, 0x32])));
    expect(scanKey(scan(']d2', [0x31]))).not.toBe(scanKey(scan(']Q3', [0x31])));
  });
});
