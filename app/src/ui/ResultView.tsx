// Shows a ParsedScan: verdict, AI fields, problems, the raw data with separators visible,
// and buttons to copy or share it in several formats.
import { useState } from 'react';
import { SYMBOLOGY_NAMES } from '../core/classify';
import { shareText, type ResultInfo, type ShareFormat } from '../core/export';
import { splitMarkup } from '../core/markup';
import type { Issue, ParsedScan } from '../core/models';
import { bytesToDisplayText, toHex } from '../core/scanText';
import { verdictOf } from '../core/verdict';

const KIND_NAMES: Record<ParsedScan['kind'], string> = {
  gs1: 'GS1 data',
  gtin: 'Product number (GTIN)',
  'digital-link': 'GS1 Digital Link',
  text: 'Plain content',
};

export function ResultView({ scan, info }: { scan: ParsedScan; info: ResultInfo }) {
  const errors = scan.issues.filter((i) => i.severity === 'error');
  const notes = scan.issues.filter((i) => i.severity === 'info');
  // Barcodes the app has no name for (e.g. Code 39) show the decoder's name.
  const symbology = scan.symbologyId
    ? `${SYMBOLOGY_NAMES[scan.symbologyId] ?? info.format ?? 'Barcode'} (${scan.symbologyId})`
    : 'Typed in';
  const text = (format: ShareFormat) => shareText(scan, format, info) ?? '';

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <Verdict scan={scan} />
        <span className="text-sm text-slate-400">
          {KIND_NAMES[scan.kind]} · {symbology}
        </span>
      </div>

      {verdictOf(scan) === 'Data valid' && (
        <p className="text-sm text-slate-400">
          Checked by the GS1 engine: check digits, lengths, characters, dates, and which AIs belong
          together.
        </p>
      )}

      {errors.map((issue, i) => (
        <IssueBox key={i} issue={issue} />
      ))}
      {notes.map((issue, i) => (
        <p key={i} className="rounded-lg bg-slate-700/60 p-3 text-sm text-slate-300">
          {issue.message}
        </p>
      ))}

      {scan.elements.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="py-1 pr-2 font-medium">AI</th>
              <th className="py-1 font-medium">Field and value</th>
            </tr>
          </thead>
          <tbody>
            {scan.elements.map((element, i) => (
              <tr key={i} className="border-t border-slate-700 align-top">
                <td className="py-2 pr-2 font-mono text-emerald-300">({element.ai})</td>
                <td className="py-2">
                  <div className="text-slate-400">{element.title}</div>
                  <div className="font-mono break-all">{element.value}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <RawData bytes={scan.bytes} copyText={text('raw')} />

      {scan.bracketed && <Field label="AI syntax" value={scan.bracketed} />}
      {scan.digitalLink && <Field label="GS1 Digital Link" value={scan.digitalLink} />}

      <section className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-400">All details as JSON</h3>
        <CopyShare what="JSON" text={text('json')} />
      </section>
    </div>
  );
}

const VERDICT_STYLES = {
  'Errors found': 'bg-red-500/20 text-red-300',
  'Not GS1': 'bg-slate-700 text-slate-200',
  'Not checked': 'bg-amber-500/20 text-amber-200',
  'Data valid': 'bg-emerald-500/20 text-emerald-300',
} as const;

export function Verdict({ scan }: { scan: ParsedScan }) {
  const verdict = verdictOf(scan);
  return (
    <span className={`rounded-full px-3 py-1 font-semibold ${VERDICT_STYLES[verdict]}`}>
      {verdict}
    </span>
  );
}

function IssueBox({ issue }: { issue: Issue }) {
  const marked = issue.markup ? splitMarkup(issue.markup) : null;
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
      <p className="text-red-200">{issue.message}</p>
      {marked && (
        <p className="mt-2 font-mono break-all text-slate-200">
          {marked.before}
          <mark className="rounded bg-red-500 px-0.5 text-white">{marked.bad}</mark>
          {marked.after}
        </p>
      )}
    </div>
  );
}

/** The message exactly as received. Control characters such as GS are shown as labelled boxes. */
function RawData({ bytes, copyText }: { bytes: Uint8Array; copyText: string }) {
  const [hex, setHex] = useState(false);
  return (
    <section>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2">
        <h3 className="text-sm font-medium text-slate-400">Raw data ({bytes.length} bytes)</h3>
        <div className="flex items-center">
          <button type="button" onClick={() => setHex(!hex)} className={LINK_BUTTON}>
            {hex ? 'Show text' : 'Show hex'}
          </button>
          {/* Copies the text form, with {GS} for each separator. */}
          <CopyShare what="raw data with {GS}" text={copyText} />
        </div>
      </div>
      <p className="rounded-lg bg-slate-950 p-3 font-mono text-sm break-all">
        {hex ? toHex(bytes) : <VisibleText bytes={bytes} />}
      </p>
    </section>
  );
}

const CONTROL_NAMES: Record<number, string> = {
  4: 'EOT',
  9: 'TAB',
  10: 'LF',
  13: 'CR',
  28: 'FS',
  29: 'GS',
  30: 'RS',
};

function VisibleText({ bytes }: { bytes: Uint8Array }) {
  const text = bytesToDisplayText(bytes);
  const parts: (string | number)[] = [];
  let run = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) {
      if (run) parts.push(run);
      run = '';
      parts.push(code);
    } else {
      run += char;
    }
  }
  if (run) parts.push(run);
  return (
    <>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          <span key={i}>{part}</span>
        ) : (
          <span
            key={i}
            className="mx-0.5 rounded bg-amber-400 px-1 text-xs font-bold text-slate-950"
            title={`Control character ${part}`}
          >
            {CONTROL_NAMES[part] ?? `x${part.toString(16).toUpperCase().padStart(2, '0')}`}
          </span>
        ),
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-400">{label}</h3>
        <CopyShare what={label} text={value} />
      </div>
      {/* Shown as text, never as a link: web addresses are not opened automatically. */}
      <p className="rounded-lg bg-slate-950 p-3 font-mono text-sm break-all">{value}</p>
    </section>
  );
}

const LINK_BUTTON = 'rounded px-2 py-1 text-sm text-emerald-300 underline underline-offset-2';

/**
 * Copy and Share buttons for one piece of text. Share opens the phone's share sheet
 * (messages, mail, notes...) and is only shown where the browser has one.
 */
function CopyShare({ what, text }: { what: string; text: string }) {
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = () => {
    const done = (result: 'yes' | 'failed') => {
      setCopied(result);
      window.setTimeout(() => setCopied(null), 1500);
    };
    if (typeof navigator.clipboard?.writeText !== 'function') return done('failed');
    navigator.clipboard.writeText(text).then(
      () => done('yes'),
      () => done('failed'),
    );
  };

  const share = () => {
    // Cancelling the share sheet rejects; that is not an error worth showing.
    navigator.share({ text }).catch(() => undefined);
  };

  return (
    <span className="flex items-center">
      <button type="button" onClick={copy} className={LINK_BUTTON} aria-label={`Copy ${what}`}>
        {copied === 'yes' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy'}
      </button>
      {canShare && (
        <button type="button" onClick={share} className={LINK_BUTTON} aria-label={`Share ${what}`}>
          Share
        </button>
      )}
    </span>
  );
}
