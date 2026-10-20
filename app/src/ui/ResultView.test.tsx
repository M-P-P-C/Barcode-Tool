// The result screen, rendered for every GS1 test vector.
// The component is rendered to HTML in Node; expectations come from spec/ (rule 8).
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import spec from '../../../spec/gs1-vectors.json';
import { splitMarkup } from '../core/markup';
import type { ParsedScan } from '../core/models';
import { GS_TOKEN, parseGsTokens } from '../core/scanText';
import { createGs1Processor, type Gs1Processor } from '../gs1/processor';
import { ResultView } from './ResultView';

interface Expectation {
  verdict: string;
  elements?: { ai: string; value: string }[];
  bracketed?: string;
  digitalLink?: string;
  errorMarkup?: string;
}

/** "[REQ-GS1-002] [REQ-DAT-001]": the requirements a vector helps verify, for test titles. */
const tags = (ids: string[]) => ids.map((id) => `[${id}]`).join(' ');

let gs1: Gs1Processor;
beforeAll(async () => {
  gs1 = await createGs1Processor();
});

function render(scan: ParsedScan): string {
  return renderToStaticMarkup(
    <ResultView scan={scan} info={{ appVersion: 'test', engineVersion: gs1.engineVersion }} />,
  );
}

/** Text as React writes it into HTML. */
function html(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

function check(page: string, expected: Expectation, scan: ParsedScan) {
  expect(page).toContain(`>${expected.verdict}</span>`);
  // The engine's own explanation of each error is on the screen.
  for (const issue of scan.issues) expect(page).toContain(html(issue.message));
  for (const { ai, value } of expected.elements ?? []) {
    expect(page).toContain(`(${ai})`);
    expect(page).toContain(`>${html(value)}<`);
  }
  if (expected.bracketed) expect(page).toContain(html(expected.bracketed));
  if (expected.digitalLink) expect(page).toContain(html(expected.digitalLink));
  if (expected.errorMarkup) {
    // The engine's faulty characters are highlighted.
    expect(page).toMatch(
      new RegExp(`<mark[^>]*>${escapeRegExp(html(splitMarkup(expected.errorMarkup).bad))}</mark>`),
    );
  }
  // Rule 5: nothing scanned is ever shown as a link.
  expect(page).not.toContain('<a ');
  // No compliance claims: the app can't judge print quality.
  expect(page.toLowerCase()).not.toContain('complian');
}

describe('[REQ-DAT-002] [REQ-DAT-004] [REQ-GS1-011] result screen for every scan vector', () => {
  for (const vector of spec.scans) {
    it(`${tags(vector.requirements)} ${vector.id}: ${vector.label}`, () => {
      const scan = gs1.processScan(vector.symbologyId, parseGsTokens(vector.message));
      const page = render(scan);
      check(page, vector.expect, scan);
      expect(page).toContain(`(${vector.symbologyId})`);
      // Every separator shows as a GS box in the raw data.
      const separators = vector.message.split(GS_TOKEN).length - 1;
      expect(page.match(/>GS<\/span>/g)?.length ?? 0).toBe(separators);
    });
  }
});

describe('[REQ-GS1-010] [REQ-DAT-004] [REQ-GS1-011] result screen for every typed-in vector', () => {
  for (const vector of spec.bracketed) {
    it(`${tags(vector.requirements)} ${vector.id}`, () => {
      const scan = gs1.fromBracketed(vector.input);
      const page = render(scan);
      check(page, vector.expect, scan);
      expect(page).toContain('Typed in');
    });
  }
});

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
