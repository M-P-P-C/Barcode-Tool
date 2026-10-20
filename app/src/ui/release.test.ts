import { describe, expect, it } from 'vitest';
import { fixedCopyAddress, fixedCopyOf, isPreview } from './release';

describe('fixed release copies', () => {
  it('recognises a fixed copy and finds the live site', () => {
    expect(fixedCopyOf('/Barcode-Tool/v/1.0.0/')).toEqual({
      version: '1.0.0',
      liveSite: '/Barcode-Tool/',
    });
  });

  it('treats the live site and previews as not fixed', () => {
    expect(fixedCopyOf('/Barcode-Tool/')).toBeNull();
    expect(fixedCopyOf('/Barcode-Tool/pr-preview/pr-6/')).toBeNull();
    expect(fixedCopyOf('/')).toBeNull();
  });

  it('[REQ-INF-003] calls versions before 1.0.0 previews', () => {
    expect(isPreview('0.5.0')).toBe(true);
    expect(isPreview('1.0.0')).toBe(false);
    expect(isPreview('10.2.0')).toBe(false);
  });

  it('builds the address of a fixed copy', () => {
    expect(fixedCopyAddress('https://m-p-p-c.github.io/Barcode-Tool/', '1.0.0')).toBe(
      'https://m-p-p-c.github.io/Barcode-Tool/v/1.0.0/',
    );
    expect(fixedCopyAddress('https://example.org', '1.2.3')).toBe('https://example.org/v/1.2.3/');
  });
});
