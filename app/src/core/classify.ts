// Decides how to read a scan, from its AIM symbology identifier and content.
// This is about barcode types, not GS1 rules: the GS1 engine does all GS1 checking.

export type Route =
  /** GS1 AI data: GS1 DataMatrix, GS1-128, GS1 QR Code, GS1 DataBar, GS1 DotCode. */
  | 'gs1-ai'
  /** EAN/UPC: the message is a product number (GTIN). */
  | 'ean-upc'
  /** A web address, which may be a GS1 Digital Link. */
  | 'url'
  /** Anything else. */
  | 'text';

/** Symbology identifiers whose message is GS1 AI data (ISO/IEC 15424, GS1 General Specifications). */
const GS1_AI_IDENTIFIERS = new Set([']C1', ']e0', ']d2', ']Q3', ']J1']);

/** EAN-13, UPC-A and UPC-E (]E0), EAN-8 (]E4). */
const EAN_UPC_IDENTIFIERS = new Set([']E0', ']E4']);

export function classify(symbologyId: string, text: string): Route {
  if (GS1_AI_IDENTIFIERS.has(symbologyId)) return 'gs1-ai';
  if (EAN_UPC_IDENTIFIERS.has(symbologyId)) return 'ean-upc';
  if (/^https?:\/\//i.test(text)) return 'url';
  return 'text';
}

/** Names for the symbology identifiers the app knows, for display. */
export const SYMBOLOGY_NAMES: Record<string, string> = {
  ']d2': 'GS1 DataMatrix',
  ']C1': 'GS1-128',
  ']Q3': 'GS1 QR Code',
  ']e0': 'GS1 DataBar',
  ']J1': 'GS1 DotCode',
  ']E0': 'EAN-13 / UPC-A / UPC-E',
  ']E4': 'EAN-8',
  ']d1': 'DataMatrix',
  ']Q1': 'QR Code',
  ']C0': 'Code 128',
};
