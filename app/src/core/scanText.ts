// Converting barcode messages between bytes and text, without losing anything.

/** The group separator (ASCII 29) that ends a variable-length GS1 field. */
export const GS = '\x1d';

/** How a GS character is typed in test data and shown on screen. */
export const GS_TOKEN = '{GS}';

/**
 * Bytes to text, one character per byte (Latin-1). Never fails and never changes
 * anything, so the GS1 engine sees exactly what was in the barcode.
 */
export function bytesToLatin1(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return text;
}

/** The reverse of bytesToLatin1. Characters above 255 cannot be bytes, so they are refused. */
export function latin1ToBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 255)
      throw new Error(`Character "${text[i]}" at position ${i + 1} is not a single byte`);
    bytes[i] = code;
  }
  return bytes;
}

/** Bytes to text for display, read as UTF-8 (the usual encoding for text in QR codes). */
export function bytesToDisplayText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

/** Typed test data to bytes: every "{GS}" becomes a real GS character (byte 29). */
export function parseGsTokens(typed: string): Uint8Array {
  return new TextEncoder().encode(typed.split(GS_TOKEN).join(GS));
}

/** Bytes to text where every GS character is shown as "{GS}". */
export function withVisibleSeparators(bytes: Uint8Array): string {
  return bytesToDisplayText(bytes).split(GS).join(GS_TOKEN);
}

/** Bytes as hexadecimal pairs, for example "30 31 1D". */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}
