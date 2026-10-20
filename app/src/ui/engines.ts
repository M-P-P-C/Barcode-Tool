// One barcode reader and one GS1 engine for the whole app, shared by the photo and
// camera pages. Both are loaded the first time a scanning page opens.
import { createDecoder } from '../decoder/client';
import { createGs1Processor, type Gs1Processor } from '../gs1/processor';

export const decoder = createDecoder();

let gs1Loading: Promise<Gs1Processor> | null = null;

export function loadGs1(): Promise<Gs1Processor> {
  gs1Loading ??= createGs1Processor().catch((e: unknown) => {
    gs1Loading = null; // try again next time, e.g. after a bad connection
    throw e;
  });
  return gs1Loading;
}
