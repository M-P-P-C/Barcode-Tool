// The ways a result can be copied or shared, and the JSON form of a result.
// Everything here comes from the ParsedScan the GS1 engine produced; nothing is re-parsed.
import type { ParsedScan } from './models';
import { toHex, withVisibleSeparators } from './scanText';

export type ShareFormat = 'bracketed' | 'raw' | 'digitalLink' | 'json';

export const SHARE_FORMAT_NAMES: Record<ShareFormat, string> = {
  bracketed: 'AI syntax',
  raw: 'Raw data with {GS}',
  digitalLink: 'GS1 Digital Link',
  json: 'JSON',
};

/** Facts about a result that are not in the ParsedScan itself. */
export interface ResultInfo {
  /** The decoder's name for the barcode type, e.g. "DataMatrix". */
  format?: string;
  /** When it was scanned, as an ISO date and time. */
  scannedAt?: string;
  appVersion: string;
  /** The GS1 Barcode Syntax Engine version that checked the data. */
  engineVersion?: string;
}

/** The formats that make sense for this result, in the order they are offered. */
export function shareFormats(scan: ParsedScan): ShareFormat[] {
  const formats: ShareFormat[] = [];
  if (scan.bracketed) formats.push('bracketed');
  if (scan.digitalLink) formats.push('digitalLink');
  formats.push('raw', 'json');
  return formats;
}

/** The text to copy or share in one format, or null if this result has no such form. */
export function shareText(scan: ParsedScan, format: ShareFormat, info: ResultInfo): string | null {
  switch (format) {
    case 'bracketed':
      return scan.bracketed;
    case 'digitalLink':
      return scan.digitalLink;
    case 'raw':
      return withVisibleSeparators(scan.bytes);
    case 'json':
      return JSON.stringify(resultJson(scan, info), null, 2);
  }
}

/**
 * The result as a plain object for JSON. `message` uses {GS} for each separator, like
 * spec/gs1-vectors.json; `hex` has every byte exactly, for data that is not plain text.
 */
export function resultJson(scan: ParsedScan, info: ResultInfo) {
  return {
    app: { name: 'Barcode Inspector', version: info.appVersion },
    gs1Engine: info.engineVersion ?? null,
    scannedAt: info.scannedAt ?? null,
    format: info.format ?? null,
    symbologyId: scan.symbologyId,
    kind: scan.kind,
    valid: scan.valid,
    message: withVisibleSeparators(scan.bytes),
    hex: toHex(scan.bytes),
    elements: scan.elements.map(({ ai, title, value }) => ({ ai, title, value })),
    bracketed: scan.bracketed,
    digitalLink: scan.digitalLink,
    issues: scan.issues.map(({ severity, message, ai, markup }) => ({
      severity,
      message,
      ai: ai ?? null,
      markup: markup ?? null,
    })),
  };
}
