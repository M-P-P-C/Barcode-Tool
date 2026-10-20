import { describe, expect, it } from 'vitest';
import {
  bytesToLatin1,
  latin1ToBytes,
  parseGsTokens,
  toHex,
  withVisibleSeparators,
} from './scanText';

describe('scan text helpers', () => {
  it('[REQ-DAT-001] turns {GS} into byte 29 and back', () => {
    const bytes = parseGsTokens('10AB{GS}21C');
    expect(Array.from(bytes)).toEqual([0x31, 0x30, 0x41, 0x42, 0x1d, 0x32, 0x31, 0x43]);
    expect(withVisibleSeparators(bytes)).toBe('10AB{GS}21C');
  });

  it('[REQ-DAT-001] keeps every byte value through the Latin-1 round trip', () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(latin1ToBytes(bytesToLatin1(all))).toEqual(all);
  });

  it('[REQ-DAT-003] refuses characters that are not single bytes', () => {
    expect(() => latin1ToBytes('€')).toThrow();
  });

  it('[REQ-DAT-002] shows bytes as hexadecimal pairs', () => {
    expect(toHex(Uint8Array.from([0x30, 0x1d, 0xff]))).toBe('30 1D FF');
  });
});
