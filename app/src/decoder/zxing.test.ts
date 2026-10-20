import { describe, expect, it } from 'vitest';
import type { RawScan } from '../core/models';
import { withoutDuplicates } from './zxing';

function scan(text: string, x: number): RawScan {
  return {
    format: 'EAN13',
    symbologyId: ']E0',
    bytes: new TextEncoder().encode(text),
    corners: [
      { x, y: 0 },
      { x: x + 100, y: 0 },
      { x: x + 100, y: 50 },
      { x, y: 50 },
    ],
  };
}

describe('[REQ-SCN-003] withoutDuplicates', () => {
  it('merges the same barcode found twice in the same place', () => {
    expect(withoutDuplicates([scan('9506000134352', 0), scan('9506000134352', 10)])).toHaveLength(
      1,
    );
  });

  it('merges two halves of the same barcode found just next to each other', () => {
    // Found as two strips 1 pixel apart, like a damaged 1D barcode can be.
    const top = scan('9506000134352', 0);
    const bottom = {
      ...scan('9506000134352', 0),
      corners: top.corners.map((p) => ({ x: p.x, y: p.y + 51 })),
    };
    expect(withoutDuplicates([top, bottom])).toHaveLength(1);
  });

  it('keeps two identical labels in different places', () => {
    expect(withoutDuplicates([scan('9506000134352', 0), scan('9506000134352', 500)])).toHaveLength(
      2,
    );
  });

  it('keeps different barcodes in the same place', () => {
    expect(withoutDuplicates([scan('9506000134352', 0), scan('4006381333931', 0)])).toHaveLength(2);
  });
});
