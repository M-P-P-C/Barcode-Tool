// Scan history: every barcode read with the camera or from a photo, newest first.
// It is saved on this device only. One saved scan opens at #/history/<number>.
import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { MAX_BACKUP_FILE_BYTES } from '../core/backup';
import { SYMBOLOGY_NAMES } from '../core/classify';
import type { ParsedScan } from '../core/models';
import { withVisibleSeparators } from '../core/scanText';
import {
  clearHistory,
  deleteScan,
  exportBackup,
  getScan,
  HISTORY_LIMIT,
  historyKept,
  importBackup,
  keepHistory,
  listScans,
  type KeepStatus,
  type StoredScan,
} from '../storage/history';
import { Card } from './Card';
import { loadGs1 } from './engines';
import { ResultView, Verdict } from './ResultView';
import { LINKS, scanLink } from './router';

export function HistoryPage({ scanId }: { scanId: number | null }) {
  return scanId === null ? <HistoryList /> : <SavedScan key={scanId} id={scanId} />;
}

function HistoryList() {
  const [scans, setScans] = useState<StoredScan[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [kept, setKept] = useState<KeepStatus>('unknown');

  const reload = useCallback(() => {
    listScans().then(setScans, (e: unknown) => setLoadError(messageOf(e)));
  }, []);

  useEffect(() => {
    reload();
    historyKept().then(setKept, () => undefined);
  }, [reload]);

  return (
    <>
      <PageHeader title="History" back={LINKS.home} />

      {loadError && (
        <p className="rounded-lg bg-red-500/10 p-3 text-red-200">
          The history could not be opened: {loadError}. Private windows often block saving.
        </p>
      )}
      {!loadError && scans === null && <p className="text-slate-400">Loading…</p>}

      {scans && (
        <Card title={`Saved scans (${scans.length})`}>
          {scans.length === 0 ? (
            <p className="text-slate-300">
              No scans yet. Codes you read with the camera or from a photo appear here.
            </p>
          ) : (
            <ul className="-my-2 divide-y divide-slate-700">
              {scans.map((scan) => (
                <li key={scan.id}>
                  <ScanRow scan={scan} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-slate-400">
            Keeps your newest {HISTORY_LIMIT.toLocaleString()} scans, on this device only.
          </p>
        </Card>
      )}

      {scans && <BackupCard count={scans.length} onImported={reload} />}
      {scans && <KeepCard kept={kept} onAsk={() => keepHistory().then(setKept)} />}
      {scans && scans.length > 0 && <ClearCard count={scans.length} onCleared={reload} />}
    </>
  );
}

function ScanRow({ scan }: { scan: StoredScan }) {
  return (
    <a href={scanLink(scan.id)} className="block py-3 active:bg-slate-700/50">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-400">{formatTime(scan.scannedAt)}</span>
        <span className="text-sm">
          <Verdict scan={scan.parsed} />
        </span>
      </div>
      <div className="mt-1 text-sm text-slate-300">
        {SYMBOLOGY_NAMES[scan.parsed.symbologyId] ?? scan.format}
      </div>
      {/* Plain text: a scanned web address is never a link. */}
      <div className="truncate font-mono text-sm">{summary(scan.parsed)}</div>
    </a>
  );
}

function BackupCard({ count, onImported }: { count: number; onImported: () => void }) {
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);

  const save = async () => {
    try {
      const text = await exportBackup(__APP_VERSION__);
      download(text, `barcode-history-${new Date().toISOString().slice(0, 10)}.json`);
      setNote({ text: `Backup of ${count} scans saved to your downloads.`, bad: false });
    } catch (e) {
      setNote({ text: `The backup could not be made: ${messageOf(e)}`, bad: true });
    }
  };

  const load = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // so the same file can be picked again
    if (!file) return;
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setNote({ text: 'This file is too large to be a history backup.', bad: true });
      return;
    }
    try {
      const [text, gs1] = await Promise.all([file.text(), loadGs1()]);
      const { added, skipped, removed } = await importBackup(
        text,
        (symbologyId, bytes) => gs1.processScan(symbologyId, bytes),
        { appVersion: __APP_VERSION__, engineVersion: gs1.engineVersion },
      );
      setNote({
        text:
          `Added ${added} ${added === 1 ? 'scan' : 'scans'}` +
          (skipped > 0 ? `; ${skipped} were already in the history.` : '.') +
          ' Each one was checked again by the GS1 engine.' +
          (removed > 0
            ? ` The ${removed} oldest scans were removed, to keep the newest ${HISTORY_LIMIT}.`
            : ''),
        bad: false,
      });
      onImported();
    } catch (e) {
      setNote({ text: messageOf(e), bad: true });
    }
  };

  return (
    <Card title="Backup">
      <p className="mb-3 text-slate-300">
        Save a backup file to keep your history safe, or to move it to another device.
      </p>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={save} disabled={count === 0} className={BUTTON}>
          Save backup file
        </button>
        <label className={`${BUTTON} cursor-pointer text-center`}>
          Load backup file
          <input type="file" accept=".json,application/json" onChange={load} className="sr-only" />
        </label>
      </div>
      {note && (
        <p role="status" className={`mt-3 text-sm ${note.bad ? 'text-red-300' : 'text-slate-300'}`}>
          {note.text}
        </p>
      )}
    </Card>
  );
}

function KeepCard({ kept, onAsk }: { kept: KeepStatus; onAsk: () => void }) {
  if (kept === 'kept') {
    return (
      <p className="text-center text-sm text-slate-400">
        This browser has promised to keep your history.
      </p>
    );
  }
  return (
    <Card title="Keep your history">
      <p className="text-slate-300">
        The browser may delete saved scans when the device runs low on space. Installing the app on
        your home screen helps; on iPhone it also stops Safari from deleting them after 7 days
        without a visit. A backup file is the safest.
      </p>
      {kept === 'not-kept' && (
        <button type="button" onClick={onAsk} className={`${BUTTON} mt-3 w-full`}>
          Ask the browser to keep it
        </button>
      )}
    </Card>
  );
}

function ClearCard({ count, onCleared }: { count: number; onCleared: () => void }) {
  const [sure, setSure] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const clear = async () => {
    try {
      await clearHistory();
      setFailed(null);
    } catch (e) {
      setFailed(messageOf(e));
    }
    setSure(false);
    onCleared();
  };
  return (
    <div className="flex flex-col gap-2">
      {failed && <p className="text-sm text-red-300">The scans could not be deleted: {failed}</p>}
      {sure ? (
        <>
          <button
            type="button"
            onClick={clear}
            className="w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white active:bg-red-500"
          >
            Delete all {count} scans now
          </button>
          <button type="button" onClick={() => setSure(false)} className={BUTTON}>
            Cancel
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setSure(true)} className={BUTTON}>
          Delete all scans…
        </button>
      )}
    </div>
  );
}

function SavedScan({ id }: { id: number }) {
  // undefined: still loading; null: not in the history.
  const [scan, setScan] = useState<StoredScan | null | undefined>(undefined);
  useEffect(() => {
    getScan(id).then(
      (found) => setScan(found ?? null),
      () => setScan(null),
    );
  }, [id]);

  const [failed, setFailed] = useState<string | null>(null);
  const remove = async () => {
    try {
      await deleteScan(id);
      window.location.hash = LINKS.history;
    } catch (e) {
      setFailed(messageOf(e));
    }
  };

  return (
    <>
      <PageHeader title="Saved scan" back={LINKS.history} />
      {scan === undefined && <p className="text-slate-400">Loading…</p>}
      {scan === null && <p className="text-slate-300">This scan is not in the history any more.</p>}
      {scan && (
        <>
          <p className="text-sm text-slate-400">
            {scan.source === 'camera' ? 'Read with the camera' : 'Read from a photo'} on{' '}
            {formatTime(scan.scannedAt)}. Checked by GS1 Syntax Engine {scan.engineVersion}.
          </p>
          <Card title="Barcode">
            <ResultView
              scan={scan.parsed}
              info={{
                format: scan.format,
                scannedAt: scan.scannedAt,
                appVersion: scan.appVersion,
                engineVersion: scan.engineVersion,
              }}
            />
          </Card>
          <button type="button" onClick={remove} className={BUTTON}>
            Delete this scan
          </button>
          {failed && (
            <p className="text-sm text-red-300">This scan could not be deleted: {failed}</p>
          )}
        </>
      )}
    </>
  );
}

function PageHeader({ title, back }: { title: string; back: string }) {
  return (
    <header className="flex items-center gap-3">
      <a href={back} className="rounded-lg px-2 py-1 text-emerald-300" aria-label="Back">
        ← Back
      </a>
      <h1 className="text-xl font-semibold">{title}</h1>
    </header>
  );
}

const BUTTON =
  'rounded-lg bg-slate-700 px-4 py-3 font-semibold text-slate-100 active:bg-slate-600 disabled:opacity-50';

/** One line that identifies the scan: AI syntax for GS1 data, otherwise the text. */
function summary(scan: ParsedScan): string {
  return scan.bracketed ?? withVisibleSeparators(scan.bytes);
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/** Saves text as a file in the browser's downloads. */
function download(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
