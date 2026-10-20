// Runs every GS1 test vector in spec/gs1-vectors.json through the real GS1 engine.
// The expectations live in that file, not here (AGENTS.md rule 8).
import { beforeAll, describe, expect, it } from 'vitest';
import spec from '../../../spec/gs1-vectors.json';
import type { ParsedScan } from '../core/models';
import { parseGsTokens, withVisibleSeparators } from '../core/scanText';
import { createGs1Processor, type Gs1Processor } from './processor';

interface Expectation {
  kind?: string;
  valid: boolean;
  elements?: { ai: string; value: string }[];
  bracketed?: string;
  digitalLink?: string;
  errorAi?: string;
  errorMarkup?: string;
  hasInfo?: boolean;
}

/** "[REQ-GS1-002] [REQ-DAT-001]": the requirements a vector helps verify, for test titles. */
const tags = (ids: string[]) => ids.map((id) => `[${id}]`).join(' ');

let gs1: Gs1Processor;
beforeAll(async () => {
  gs1 = await createGs1Processor();
});

function check(result: ParsedScan, expected: Expectation) {
  const errors = result.issues.filter((i) => i.severity === 'error');
  // Show the engine's reason when a vector fails, which makes failures easy to read.
  expect(result.valid, errors.map((e) => e.message).join('; ')).toBe(expected.valid);
  if (expected.kind) expect(result.kind).toBe(expected.kind);
  if (expected.elements) {
    expect(result.elements.map(({ ai, value }) => ({ ai, value }))).toEqual(expected.elements);
  }
  if (expected.bracketed) expect(result.bracketed).toBe(expected.bracketed);
  if (expected.digitalLink) expect(result.digitalLink).toBe(expected.digitalLink);
  if (expected.errorAi) expect(errors[0]?.ai).toBe(expected.errorAi);
  if (expected.errorMarkup) expect(errors[0]?.markup).toBe(expected.errorMarkup);
  if (expected.hasInfo) expect(result.issues.some((i) => i.severity === 'info')).toBe(true);
  // Valid GS1 data always gets a title for each AI from the engine.
  if (expected.valid) for (const element of result.elements) expect(element.title).not.toBe('');
}

describe('[REQ-DAT-003] scan vectors, raw message kept exactly', () => {
  for (const vector of spec.scans) {
    it(`${tags(vector.requirements)} ${vector.id}: ${vector.label}`, () => {
      const bytes = parseGsTokens(vector.message);
      const result = gs1.processScan(vector.symbologyId, bytes);
      check(result, vector.expect);
      // The raw message is kept exactly, separators included.
      expect(withVisibleSeparators(result.bytes)).toBe(vector.message);
    });
  }
});

describe('bracketed input vectors', () => {
  for (const vector of spec.bracketed) {
    it(`${tags(vector.requirements)} ${vector.id}`, () => {
      check(gs1.fromBracketed(vector.input), vector.expect);
    });
  }
});

describe('[REQ-GS1-006] Digital Link round trip', () => {
  it('turns every valid vector with a Digital Link back into the same AIs', () => {
    for (const vector of spec.scans) {
      const link = 'digitalLink' in vector.expect ? vector.expect.digitalLink : undefined;
      if (!link) continue;
      const fromLink = gs1.fromDigitalLink(link);
      expect(fromLink.valid).toBe(true);
      const original = gs1.processScan(vector.symbologyId, parseGsTokens(vector.message));
      expect(gs1.toDigitalLink(fromLink)).toBe(gs1.toDigitalLink(original));
    }
  });
});
