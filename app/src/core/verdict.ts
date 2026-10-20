// The one-line verdict shown for a result. It only summarises what the GS1 engine decided.
import type { ParsedScan } from './models';

export type Verdict = 'Data valid' | 'Errors found' | 'Not GS1' | 'Not checked';

export function verdictOf(scan: ParsedScan): Verdict {
  if (!scan.valid) return 'Errors found';
  if (scan.kind === 'text') return 'Not GS1';
  if (scan.elements.length === 0) return 'Not checked';
  // "Data valid", never "compliant": print quality cannot be judged from the data.
  return 'Data valid';
}
