// GS1 checker: type or paste what a barcode contains and see how the GS1 engine reads it.
// The GS1 checker: type in barcode data and see how the GS1 engine reads it.
import { useEffect, useMemo, useState } from 'react';
import spec from '../../../spec/gs1-vectors.json';
import { SYMBOLOGY_NAMES } from '../core/classify';
import type { ParsedScan } from '../core/models';
import { GS_TOKEN, parseGsTokens } from '../core/scanText';
import { createGs1Processor, type Gs1Processor } from '../gs1/processor';
import { Card } from './Card';
import { ResultView } from './ResultView';
import { LINKS } from './router';

// Examples come from the same file as the tests, so they always match what is tested.
const EXAMPLES = [
  ...spec.scans.map((v) => ({
    id: v.id,
    label: v.label,
    symbologyId: v.symbologyId,
    input: v.message,
  })),
  ...spec.bracketed.map((v) => ({
    id: v.id,
    label: `Typed in AI syntax: ${v.input}`,
    symbologyId: ']d2',
    input: v.input,
  })),
];

type EngineState =
  | { status: 'loading' }
  | { status: 'ready'; gs1: Gs1Processor }
  | { status: 'failed'; reason: string };

export function CheckerPage() {
  const [engine, setEngine] = useState<EngineState>({ status: 'loading' });
  const [symbologyId, setSymbologyId] = useState(']d2');
  const [input, setInput] = useState('');

  useEffect(() => {
    let active = true;
    createGs1Processor()
      .then((gs1) => active && setEngine({ status: 'ready', gs1 }))
      .catch((e: unknown) => active && setEngine({ status: 'failed', reason: String(e) }));
    return () => {
      active = false;
    };
  }, []);

  // Re-checked on every keystroke: the engine takes well under a millisecond.
  const result: ParsedScan | null = useMemo(() => {
    if (engine.status !== 'ready' || input.trim() === '') return null;
    const text = input.trim();
    if (text.startsWith('(')) return engine.gs1.fromBracketed(text);
    return engine.gs1.processScan(symbologyId, parseGsTokens(text));
  }, [engine, symbologyId, input]);

  const loadExample = (id: string) => {
    const example = EXAMPLES.find((e) => e.id === id);
    if (!example) return;
    setSymbologyId(example.symbologyId);
    setInput(example.input);
  };

  return (
    <>
      <header className="flex items-center gap-3">
        <a
          href={LINKS.home}
          className="rounded-lg px-2 py-1 text-emerald-300"
          aria-label="Back to start"
        >
          ← Back
        </a>
        <h1 className="text-xl font-semibold">GS1 checker</h1>
      </header>

      <Card title="What does the barcode contain?">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">Example</span>
            <select
              value=""
              onChange={(e) => loadExample(e.target.value)}
              className="rounded-lg bg-slate-900 p-3"
            >
              <option value="" disabled>
                Pick an example…
              </option>
              {EXAMPLES.map((example) => (
                <option key={example.id} value={example.id}>
                  {example.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">Barcode type</span>
            <select
              value={symbologyId}
              onChange={(e) => setSymbologyId(e.target.value)}
              className="rounded-lg bg-slate-900 p-3"
            >
              {Object.entries(SYMBOLOGY_NAMES).map(([id, name]) => (
                <option key={id} value={id}>
                  {name} ({id})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">Data</span>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              placeholder={`010950600013435210ABC123${GS_TOKEN}21XYZ789`}
              className="rounded-lg bg-slate-900 p-3 font-mono text-sm"
            />
          </label>
          <p className="text-sm text-slate-400">
            Write <code className="text-slate-200">{GS_TOKEN}</code> where the barcode has a group
            separator. Start with <code className="text-slate-200">(</code> to type AI syntax, for
            example <code className="text-slate-200">(01)09506000134352(10)ABC123</code>. For a
            Digital Link, choose QR Code and paste the web address.
          </p>
        </div>
      </Card>

      {engine.status === 'loading' && <p className="text-slate-400">Loading the GS1 engine…</p>}
      {engine.status === 'failed' && (
        <p className="rounded-lg bg-red-500/10 p-3 text-red-200">
          The GS1 engine could not start: {engine.reason}
        </p>
      )}
      {result && engine.status === 'ready' && (
        <Card title="Result">
          <ResultView
            scan={result}
            info={{ appVersion: __APP_VERSION__, engineVersion: engine.gs1.engineVersion }}
          />
        </Card>
      )}
      {engine.status === 'ready' && (
        <p className="text-center text-xs text-slate-500">
          GS1 Syntax Engine, {engine.gs1.engineVersion}
        </p>
      )}
    </>
  );
}
