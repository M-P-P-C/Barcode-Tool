// The results of one camera picture or photo: one card per barcode.
import { Card } from './Card';
import type { Read } from './reads';
import { ResultView } from './ResultView';
import { LINKS } from './router';

export function ReadResults({ read }: { read: Read }) {
  const count = read.parsed.length;
  return (
    <>
      {read.parsed.map((scan, i) => (
        <Card key={i} title={count > 1 ? `Barcode ${i + 1} of ${count}` : 'Barcode'}>
          <ResultView
            scan={scan}
            info={{
              format: read.scans[i]?.format,
              scannedAt: read.scannedAt,
              appVersion: __APP_VERSION__,
              engineVersion: read.engineVersion,
            }}
          />
        </Card>
      ))}
      {count > 0 && <SaveNote save={read.save} count={count} />}
    </>
  );
}

function SaveNote({ save, count }: { save: Read['save']; count: number }) {
  if (save.status === 'saving') {
    return <p className="text-center text-sm text-slate-400">Saving in History…</p>;
  }
  if (save.status === 'saved') {
    return (
      <p className="text-center text-sm text-slate-400">
        Saved in{' '}
        <a href={LINKS.history} className="text-emerald-300 underline underline-offset-2">
          History
        </a>
        .
      </p>
    );
  }
  return (
    <p className="text-center text-sm text-amber-200">
      {save.saved > 0 ? `Only ${save.saved} of ${count} saved in History` : 'Not saved in History'}:{' '}
      {save.reason}. Private windows often block saving.
    </p>
  );
}
