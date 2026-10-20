// The app's side of the decoder: sends images to the Web Worker and waits for answers.
import type { DecodeRequest, DecodeResponse } from './decoder.worker';
import type { BarcodeDecoder, DecodeResult } from './types';

/** A read that takes longer than this is given up, so the screen never waits forever. */
const PHOTO_TIME_LIMIT_MS = 60_000;
/** A live camera frame normally takes well under a second; the next frame is a new chance. */
const FRAME_TIME_LIMIT_MS = 5_000;

interface Job {
  resolve: (result: DecodeResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function createDecoder(): BarcodeDecoder {
  let worker: Worker | null = null;
  let nextId = 1;
  const waiting = new Map<number, Job>();

  function start(): Worker {
    if (worker) return worker;
    worker = new Worker(new URL('./decoder.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<DecodeResponse>) => {
      const answer = event.data;
      const job = waiting.get(answer.id);
      if (!job) return;
      waiting.delete(answer.id);
      clearTimeout(job.timer);
      if (answer.ok) job.resolve(answer.result);
      else job.reject(new Error(answer.error));
    };
    worker.onerror = (event) => stop(event.message || 'The barcode reader stopped');
    return worker;
  }

  /**
   * Ends the worker and fails every waiting read. This also frees the memory of a large
   * photo still being read. The next read starts a fresh worker.
   */
  function stop(reason: string) {
    worker?.terminate();
    worker = null;
    for (const job of waiting.values()) {
      clearTimeout(job.timer);
      job.reject(new Error(reason));
    }
    waiting.clear();
  }

  return {
    warmUp() {
      start();
    },

    decode(image: Blob): Promise<DecodeResult> {
      return send(
        { id: nextId++, image },
        [],
        PHOTO_TIME_LIMIT_MS,
        'Reading took too long. Try a smaller or sharper photo.',
      );
    },

    decodeFrame(frame: ImageData): Promise<DecodeResult> {
      // Hand the pixel memory over instead of copying it: about 8 MB per frame.
      return send(
        { id: nextId++, frame },
        [frame.data.buffer],
        FRAME_TIME_LIMIT_MS,
        'Reading a camera picture took too long.',
      );
    },
  };

  function send(
    request: DecodeRequest,
    transfer: Transferable[],
    timeLimitMs: number,
    tooSlow: string,
  ): Promise<DecodeResult> {
    // Only the newest picture matters: cancel a read still running instead of doing both.
    // (The live camera waits for each answer before sending the next frame.)
    if (waiting.size > 0) stop('Cancelled: a newer picture was sent');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => stop(tooSlow), timeLimitMs);
      waiting.set(request.id, { resolve, reject, timer });
      start().postMessage(request, transfer);
    });
  }
}
