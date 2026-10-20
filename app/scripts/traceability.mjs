// Builds the traceability matrix: which tests verify each requirement, and whether they
// passed. Run after `npm test` and `npm run e2e`:   npm run trace
//
// Reads:  ../spec/requirements.json        the requirements and their IDs
//         reports/unit-tests.json           Vitest results (written by npm test)
//         reports/e2e-tests.json            Playwright results (written by npm run e2e)
// Writes: reports/traceability.md          the matrix, also shown on the CI run's page
//
// Fails (exit code 1) when:
//   - a test names a requirement ID that doesn't exist (or is withdrawn),
//   - a requirement checked by automated tests has no test, or
//   - a test linked to a requirement did not pass.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const APP = new URL('../', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, APP), 'utf8'));
const REQUIREMENT_ID = /\[(REQ-[A-Z0-9]+-\d{3})\]/g;
/** Anything that looks like a requirement tag, to catch typos such as [REQ-GS1-2]. */
const ANY_TAG = /\[REQ-[^\]]*\]/g;

// --- Requirements -------------------------------------------------------------------
const { requirements } = read('../spec/requirements.json');
const byId = new Map(requirements.map((r) => [r.id, r]));
const active = requirements.filter((r) => r.status !== 'withdrawn');

// --- Test results -------------------------------------------------------------------
// Every test as { suite, file, title, passed }. A run that didn't finish (e.g. a test
// file that failed to load) is a problem even if every listed test passed.
const problems = [];
const warnings = [];
const tests = [...unitTests(), ...browserTests()];

function unitTests() {
  const file = 'reports/unit-tests.json';
  if (!existsSync(new URL(file, APP))) stop(`${file} is missing: run "npm test" first.`);
  const report = read(file);
  if (report.success === false || report.numFailedTestSuites > 0) {
    problems.push('The unit test run did not succeed.');
  }
  for (const result of report.testResults) {
    if (result.status === 'failed' && result.assertionResults.every((t) => t.status === 'passed')) {
      problems.push(`${result.name.replace(/^.*\/app\//, '')} failed to run: ${result.message}`);
    }
  }
  return report.testResults.flatMap((result) =>
    result.assertionResults.map((test) => ({
      suite: 'unit',
      file: result.name.replace(/^.*\/app\//, ''),
      title: [...test.ancestorTitles, test.title].join(' › '),
      passed: test.status === 'passed',
    })),
  );
}

function browserTests() {
  const file = 'reports/e2e-tests.json';
  if (!existsSync(new URL(file, APP))) stop(`${file} is missing: run "npm run e2e" first.`);
  const found = [];
  const walk = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        found.push({
          suite: 'browser',
          file: `e2e/${spec.file}`,
          title: [...titles, spec.title].join(' › '),
          // "flaky" means it failed once and passed when retried.
          passed: test.status === 'expected' || test.status === 'flaky',
          flaky: test.status === 'flaky',
        });
      }
    }
    for (const child of suite.suites ?? [])
      walk(child, child.title ? [...titles, child.title] : titles);
  };
  const report = read(file);
  for (const suite of report.suites) walk(suite, []);
  for (const error of report.errors ?? []) {
    problems.push(`The browser test run had an error: ${error.message ?? error.value}`);
  }
  if ((report.stats?.unexpected ?? 0) > 0) problems.push('Some browser tests failed.');
  for (const test of found.filter((t) => t.flaky)) {
    warnings.push(`"${test.title}" only passed when retried.`);
  }
  return found;
}

// --- Links --------------------------------------------------------------------------
const linked = new Map(active.map((r) => [r.id, []]));
let unlinked = 0;

for (const test of tests) {
  for (const tag of test.title.match(ANY_TAG) ?? []) {
    if (!/^\[REQ-[A-Z0-9]+-\d{3}\]$/.test(tag)) {
      problems.push(`${test.file}: "${test.title}" has a malformed tag ${tag}.`);
    }
  }
  const ids = [...new Set([...test.title.matchAll(REQUIREMENT_ID)].map((m) => m[1]))];
  if (ids.length === 0) unlinked++;
  for (const id of ids) {
    if (!byId.has(id))
      problems.push(`${test.file}: "${test.title}" names ${id}, which doesn't exist.`);
    else if (!linked.has(id))
      problems.push(`${test.file}: "${test.title}" names ${id}, which is withdrawn.`);
    else linked.get(id).push(test);
  }
}

const rows = active.map((requirement) => {
  const its = linked.get(requirement.id);
  const failed = its.filter((t) => !t.passed);
  let result;
  if (requirement.verification === 'test') {
    if (its.length === 0) {
      result = 'NO TEST';
      problems.push(`${requirement.id} is checked by automated tests, but no test names it.`);
    } else if (failed.length > 0) {
      result = 'FAILED';
      for (const t of failed) problems.push(`${requirement.id}: "${t.title}" did not pass.`);
    } else {
      result = 'passed';
    }
  } else {
    // Manual checks and code review are recorded elsewhere; linked tests still count.
    result = failed.length > 0 ? 'FAILED' : requirement.verification;
    for (const t of failed) problems.push(`${requirement.id}: "${t.title}" did not pass.`);
  }
  return { requirement, tests: its, result };
});

// --- Report -------------------------------------------------------------------------
const { version } = read('package.json');
const count = (suite) => tests.filter((t) => t.suite === suite).length;
const passedRows = rows.filter((r) => r.result === 'passed').length;
const automated = rows.filter((r) => r.requirement.verification === 'test').length;
const commit = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : 'local';

const lines = [
  `# Traceability matrix — Barcode Inspector ${version}`,
  '',
  `Made ${new Date().toISOString()} from commit ${commit}, with test results written ` +
    `${resultTimes()}: ${count('unit')} unit tests and ` +
    `${count('browser')} browser tests. ${unlinked} tests name no requirement: they check supporting code.`,
  '',
  `**${passedRows} of ${automated} automated requirements passed.** ` +
    `${active.length - automated} are checked by hand or by code review.` +
    (problems.length ? ` **${problems.length} problem(s), listed at the end.**` : ''),
  '',
  '| Requirement | Risk | Checked by | Tests | Result |',
  '| --- | --- | --- | --- | --- |',
  ...rows.map(({ requirement: r, tests: its, result }) => {
    const unit = its.filter((t) => t.suite === 'unit').length;
    const browser = its.length - unit;
    const parts = [unit && `${unit} unit`, browser && `${browser} browser`].filter(Boolean);
    return `| ${r.id} ${r.title} | ${r.risk} | ${r.verification} | ${parts.join(', ') || '—'} | ${result} |`;
  }),
  '',
  '## Tests for each requirement',
  '',
];
for (const { requirement: r, tests: its } of rows) {
  lines.push(`### ${r.id} ${r.title}`, '', r.requirement, '');
  if (r.note) lines.push(`_${r.note}_`, '');
  for (const t of its) {
    const mark = t.passed ? (t.flaky ? 'passed after a retry' : 'passed') : 'FAILED';
    lines.push(
      `- ${mark}: ${t.suite}, \`${t.file}\`: ${t.title.replace(REQUIREMENT_ID, '').replace(/\s+/g, ' ').trim()}`,
    );
  }
  if (its.length === 0) lines.push('- no automated test');
  lines.push('');
}
if (warnings.length) lines.push('## Warnings', '', ...warnings.map((w) => `- ${w}`), '');
if (problems.length) lines.push('## Problems', '', ...problems.map((p) => `- ${p}`), '');

mkdirSync(new URL('reports/', APP), { recursive: true });
writeFileSync(new URL('reports/traceability.md', APP), lines.join('\n'));
console.log(
  `Traceability: ${passedRows} of ${automated} automated requirements passed; matrix in app/reports/traceability.md`,
);
if (problems.length) {
  console.error(problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}

/** When each results file was written, so old local results are easy to spot. */
function resultTimes() {
  return ['reports/unit-tests.json', 'reports/e2e-tests.json']
    .map((file) => statSync(new URL(file, APP)).mtime.toISOString())
    .join(' and ');
}

function stop(message) {
  console.error(message);
  process.exit(1);
}
