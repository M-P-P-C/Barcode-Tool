// The only place in the app that talks to the GS1 Barcode Syntax Engine (gs1encoder).
// Everything it returns is a core model, so the rest of the app never sees engine types.
//
// The engine owns every GS1 rule: AI lengths, character sets, check digits, dates and
// which AIs must or must not appear together. Nothing here re-implements those rules.

import { GS1encoder, Symbology } from 'gs1encoder';
import { classify } from '../core/classify';
import type { Element, Issue, ParsedScan, ScanKind } from '../core/models';
import { GS, bytesToLatin1 } from '../core/scanText';

export interface Gs1Processor {
  /** Reads a scan: AIM symbology identifier plus the raw message bytes. */
  processScan(symbologyId: string, bytes: Uint8Array): ParsedScan;
  /** Reads typed-in data in (AI) syntax, for example "(01)09506000134352(10)ABC123". */
  fromBracketed(text: string): ParsedScan;
  /** Reads a GS1 Digital Link URI. */
  fromDigitalLink(uri: string): ParsedScan;
  /** The GS1 Digital Link URI for a parsed scan, or null if it has no product key. */
  toDigitalLink(scan: ParsedScan): string | null;
  /** The engine's own version string, for reports and the About page. */
  readonly engineVersion: string;
}

/** Loads the engine (its .wasm file comes from our own site) and returns a processor. */
export async function createGs1Processor(): Promise<Gs1Processor> {
  const encoder = await GS1encoder.create();
  return new EngineProcessor(encoder);
}

class EngineProcessor implements Gs1Processor {
  constructor(private readonly encoder: GS1encoder) {}

  get engineVersion(): string {
    return this.encoder.version;
  }

  processScan(symbologyId: string, bytes: Uint8Array): ParsedScan {
    // One character per byte, so GS separators and every other byte reach the engine unchanged.
    const message = bytesToLatin1(bytes);
    switch (classify(symbologyId, message)) {
      case 'gs1-ai':
        return this.readScanData('gs1', symbologyId, bytes, message);
      case 'ean-upc':
        return this.readEanUpc(symbologyId, bytes, message);
      case 'url':
        return this.readUrl(symbologyId, bytes, message);
      case 'text':
        return result({ symbologyId, kind: 'text', bytes });
    }
  }

  fromBracketed(text: string): ParsedScan {
    try {
      this.encoder.aiDataStr = text;
      return this.successFromEngine('gs1', '', messageBytesFromDataStr(this.encoder.dataStr));
    } catch (e) {
      return this.failure('gs1', '', new TextEncoder().encode(text), e);
    }
  }

  fromDigitalLink(uri: string): ParsedScan {
    const bytes = new TextEncoder().encode(uri);
    try {
      this.encoder.dataStr = uri;
      return this.successFromEngine('digital-link', '', bytes);
    } catch (e) {
      return this.failure('digital-link', '', bytes, e);
    }
  }

  toDigitalLink(scan: ParsedScan): string | null {
    if (!scan.bracketed) return null;
    try {
      this.encoder.aiDataStr = scan.bracketed;
      return this.encoder.getDLuri(null);
    } catch {
      return null;
    }
  }

  /** GS1 AI data: the engine reads symbology identifier + message in one go. */
  private readScanData(kind: ScanKind, symbologyId: string, bytes: Uint8Array, message: string) {
    try {
      this.encoder.scanData = symbologyId + message;
      return this.successFromEngine(kind, symbologyId, bytes);
    } catch (e) {
      return this.failure(kind, symbologyId, bytes, e);
    }
  }

  /** EAN/UPC: the engine checks the check digit; the result is then shown as a GTIN, AI (01). */
  private readEanUpc(symbologyId: string, bytes: Uint8Array, message: string): ParsedScan {
    // The engine does not accept 8-digit UPC-E codes. Our decoder sends UPC-E as 13 digits,
    // so this only happens with typed-in data: show it unchecked rather than falsely invalid.
    if (symbologyId === ']E0' && /^\d{8}$/.test(message)) {
      return result({
        symbologyId,
        kind: 'gtin',
        bytes,
        issues: [{ severity: 'info', message: 'UPC-E codes are shown but not checked yet.' }],
      });
    }
    try {
      this.encoder.scanData = symbologyId + message;
    } catch (e) {
      return this.failure('gtin', symbologyId, bytes, e);
    }
    const sym = this.encoder.sym;
    if (sym !== Symbology.EAN13 && sym !== Symbology.UPCA && sym !== Symbology.EAN8) {
      return result({ symbologyId, kind: 'gtin', bytes });
    }
    // A GTIN-8, -12 or -13 is written as a GTIN-14 by adding leading zeros.
    // The engine then validates it as AI (01) and builds the Digital Link.
    const gtin14 = this.encoder.dataStr.padStart(14, '0');
    try {
      this.encoder.aiDataStr = `(01)${gtin14}`;
      return this.successFromEngine('gtin', symbologyId, bytes);
    } catch (e) {
      return this.failure('gtin', symbologyId, bytes, e);
    }
  }

  /** A web address is a Digital Link only if the engine can read it as one. */
  private readUrl(symbologyId: string, bytes: Uint8Array, message: string): ParsedScan {
    try {
      this.encoder.dataStr = message;
      return this.successFromEngine('digital-link', symbologyId, bytes);
    } catch (e) {
      // The engine found GS1 data in the address but it breaks a rule (it names the AI),
      // for example a GTIN with a wrong check digit: that is a faulty Digital Link.
      const failed = this.failure('digital-link', symbologyId, bytes, e);
      if (failed.issues[0]?.ai) return failed;
      // An ordinary web address: nothing is wrong, it just is not GS1 data.
      return result({
        symbologyId,
        kind: 'text',
        bytes,
        issues: [{ severity: 'info', message: `Not a GS1 Digital Link: ${errorMessage(e)}` }],
      });
    }
  }

  /** Builds the result from the engine's current, successfully parsed data. */
  private successFromEngine(kind: ScanKind, symbologyId: string, bytes: Uint8Array): ParsedScan {
    const elements = this.readElements();
    let digitalLink: string | null = null;
    try {
      digitalLink = this.encoder.getDLuri(null);
    } catch {
      // No product key such as a GTIN, so no Digital Link. Not an error.
    }
    return result({
      symbologyId,
      kind,
      bytes,
      elements,
      bracketed: this.encoder.aiDataStr || null,
      digitalLink,
    });
  }

  /** Builds an invalid result: the raw data is kept, the engine's message explains why. */
  private failure(kind: ScanKind, symbologyId: string, bytes: Uint8Array, e: unknown): ParsedScan {
    const message = errorMessage(e);
    // The engine's markup is only shown when it is plain printable ASCII (all GS1 data is);
    // for other bytes the engine's copy can come out garbled, while the raw view stays exact.
    const rawMarkup = this.encoder.errMarkup;
    const markup = /^[\x20-\x7e]+$/.test(rawMarkup) ? rawMarkup : undefined;
    // The AI the engine blames: from the markup "(01)...", or from the message,
    // which names it as "AI (01): ..." or "...for AI (10) are not satisfied".
    const ai = /^\((\d{2,4})\)/.exec(markup ?? '')?.[1] ?? /\bAI \((\d{2,4})\)/.exec(message)?.[1];
    const issue: Issue = { severity: 'error', message };
    if (ai) issue.ai = ai;
    if (markup) issue.markup = markup;
    return result({ symbologyId, kind, bytes, issues: [issue] });
  }

  /**
   * Lists the AIs of the current data. The engine's human-readable lines come in two
   * forms, "(01) 09506000134352" and "GTIN (01) 09506000134352"; comparing them gives
   * the AI, the value and the title without knowing any GS1 rules.
   */
  private readElements(): Element[] {
    this.encoder.includeDataTitlesInHRI = false;
    const plain = this.encoder.hri;
    this.encoder.includeDataTitlesInHRI = true;
    const titled = this.encoder.hri;
    const elements: Element[] = [];
    plain.forEach((line, i) => {
      const match = /^\((\d{2,4})\) (.*)$/s.exec(line);
      if (!match) return; // e.g. the "--" line between parts of a composite barcode
      const withTitle = titled[i] ?? '';
      const title = withTitle.endsWith(line) ? withTitle.slice(0, -line.length).trim() : '';
      elements.push({ ai: match[1] ?? '', value: match[2] ?? '', title });
    });
    return elements;
  }
}

/**
 * The engine writes the barcode message with "^" for each FNC1. The first one only
 * marks the data as GS1 and is not part of the message; the others become GS separators.
 */
function messageBytesFromDataStr(dataStr: string): Uint8Array {
  const message = dataStr.startsWith('^') ? dataStr.slice(1) : dataStr;
  return new TextEncoder().encode(message.split('^').join(GS));
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function result(parts: Partial<ParsedScan> & Pick<ParsedScan, 'symbologyId' | 'kind' | 'bytes'>) {
  const issues = parts.issues ?? [];
  return {
    elements: [],
    bracketed: null,
    digitalLink: null,
    ...parts,
    issues,
    valid: !issues.some((issue) => issue.severity === 'error'),
  } satisfies ParsedScan;
}
