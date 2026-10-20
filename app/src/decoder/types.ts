import type { RawScan } from '../core/models';

/** What one decoded image gives back. */
export interface DecodeResult {
  scans: RawScan[];
  /**
   * Size of the picture the corners refer to, after the photo's orientation is
   * applied (and after scaling very large photos down). Null when unknown.
   */
  size: { width: number; height: number } | null;
  /** How long decoding took, in milliseconds. */
  millis: number;
}

export interface BarcodeDecoder {
  /** Starts the reader in the background, so the first photo does not wait for it. */
  warmUp(): void;
  /**
   * Finds every barcode in a photo or image file. A new call cancels one still running,
   * which then rejects; a read that takes longer than a minute also rejects.
   */
  decode(image: Blob): Promise<DecodeResult>;
  /**
   * Finds every barcode in one picture from the live camera. Same rules as decode(), but
   * gives up after 5 seconds. The frame's pixels are handed over to the worker, so the
   * frame can't be used after.
   */
  decodeFrame(frame: ImageData): Promise<DecodeResult>;
}
