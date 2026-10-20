// The data shapes the whole app shares. The UI only ever sees these, never the
// barcode engines' own types.

/** A point in an image, in pixels from the top-left corner. */
export interface Point {
  x: number;
  y: number;
}

/** What a barcode reader hands over: which symbology it saw and the raw message. */
export interface RawScan {
  /** The decoder's name for the barcode type, for example "DataMatrix". */
  format: string;
  /** AIM symbology identifier, for example "]d2" for GS1 DataMatrix. */
  symbologyId: string;
  /** The message exactly as decoded. GS (byte 29) separators are kept. */
  bytes: Uint8Array;
  /** Where the barcode is in the image: top-left, top-right, bottom-right, bottom-left. */
  corners: Point[];
}

/**
 * gs1          GS1 Application Identifier data (GS1 DataMatrix, GS1-128, ...)
 * gtin         an EAN/UPC product number
 * digital-link a GS1 Digital Link web address
 * text         anything else, shown as plain text
 */
export type ScanKind = 'gs1' | 'gtin' | 'digital-link' | 'text';

/** One Application Identifier and its value, for example (17) 261231. */
export interface Element {
  /** The AI number, for example "17". */
  ai: string;
  /** The engine's short name for the AI, for example "USE BY or EXPIRY". */
  title: string;
  /** The value exactly as encoded, for example "261231". */
  value: string;
}

export interface Issue {
  /** error: the data breaks a GS1 rule. info: a note, nothing is wrong. */
  severity: 'error' | 'info';
  /** The engine's explanation, in its own words. */
  message: string;
  /** The AI the problem concerns, when the engine names one. */
  ai?: string;
  /**
   * The engine's marked-up copy of the faulty AI, with the offending characters
   * between "|" signs, for example "(01)0950600013435|3|".
   */
  markup?: string;
}

/** The result of reading one barcode (or one typed-in input). */
export interface ParsedScan {
  /** AIM symbology identifier, or "" for typed-in bracketed data or a Digital Link. */
  symbologyId: string;
  kind: ScanKind;
  /** The message exactly as received, GS separators intact. */
  bytes: Uint8Array;
  /** The AIs in order. Empty when the engine rejected the data or it is not GS1. */
  elements: Element[];
  /** The data in (AI) syntax, for example "(01)09506000134352(10)ABC123". */
  bracketed: string | null;
  /** The GS1 Digital Link URI for the data, when it has a product key such as a GTIN. */
  digitalLink: string | null;
  issues: Issue[];
  /** True when there is no error issue. */
  valid: boolean;
}
