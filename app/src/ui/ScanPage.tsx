// Scan from a photo: the phone's own camera app takes a full-resolution picture (best
// focus for tiny codes), or an image is picked from the gallery. Every barcode in it is
// decoded in a Web Worker and checked with the GS1 engine.
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { DecodeResult } from '../decoder/types';
import { Card } from './Card';
import { decoder, loadGs1 } from './engines';
import { Preview } from './Preview';
import { ReadResults } from './ReadResults';
import { checkScans, saveRead, type Read } from './reads';
import { LINKS } from './router';

type State =
  | { status: 'idle' }
  | { status: 'reading'; imageUrl: string }
  | { status: 'done'; imageUrl: string; decoded: DecodeResult; read: Read }
  | { status: 'failed'; imageUrl: string; reason: string };

export function ScanPage() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const imageUrl = state.status === 'idle' ? null : state.imageUrl;
  const run = useRef(0); // ignores results from an older photo if a new one was picked

  useEffect(() => {
    decoder.warmUp();
    loadGs1().catch(() => undefined); // a failure is shown when a photo is read
  }, []);

  // Free the photo's memory when it is replaced or the page closes.
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // so picking the same file again still triggers a read
    if (!file) return;
    const thisRun = ++run.current;
    const url = URL.createObjectURL(file);
    setState({ status: 'reading', imageUrl: url });
    try {
      const decoded = await decoder.decode(file);
      const read = await checkScans(decoded.scans, 'photo');
      if (thisRun !== run.current) return; // a newer photo was picked meanwhile
      // Show the result first, then save it, so a slow save never hides a result.
      setState({ status: 'done', imageUrl: url, decoded, read });
      const save = await saveRead(read);
      setState((s) =>
        s.status === 'done' && s.read === read ? { ...s, read: { ...read, save } } : s,
      );
    } catch (e) {
      if (thisRun === run.current) {
        setState({
          status: 'failed',
          imageUrl: url,
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    }
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
        <h1 className="text-xl font-semibold">Scan from a photo</h1>
      </header>

      <Card title="Photo">
        <div className="flex flex-col gap-2">
          <FileButton label="Take a photo" capture onChange={onFile} primary />
          <FileButton label="Choose an image" onChange={onFile} />
        </div>
        {state.status === 'idle' && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-400">
            <li>Fill most of the picture with the barcode, but keep it sharp.</li>
            <li>Avoid reflections; tilt the product slightly if it shines.</li>
            <li>For tiny codes, use your camera&apos;s 2× zoom instead of moving very close.</li>
          </ul>
        )}
      </Card>

      {imageUrl && (
        <Preview
          imageUrl={imageUrl}
          scans={state.status === 'done' ? state.decoded.scans : []}
          size={state.status === 'done' ? state.decoded.size : null}
        />
      )}

      {state.status === 'reading' && <p className="text-slate-400">Reading the barcodes…</p>}

      {state.status === 'failed' && (
        <p className="rounded-lg bg-red-500/10 p-3 text-red-200">
          The photo could not be read: {state.reason}
        </p>
      )}

      {state.status === 'done' && state.read.parsed.length === 0 && (
        <Card title="No barcode found">
          <ul className="list-disc space-y-1 pl-5 text-slate-300">
            <li>Make sure the whole barcode is in the picture, with a little space around it.</li>
            <li>Try again closer, or with your camera&apos;s zoom, keeping it in focus.</li>
            <li>Move away from reflections and shadows.</li>
          </ul>
        </Card>
      )}

      {state.status === 'done' && <ReadResults read={state.read} />}

      {state.status === 'done' && (
        <p className="text-center text-xs text-slate-500">
          Read in {(state.decoded.millis / 1000).toFixed(1)} s
        </p>
      )}
    </>
  );
}

function FileButton({
  label,
  capture = false,
  primary = false,
  onChange,
}: {
  label: string;
  capture?: boolean;
  primary?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const colours = primary
    ? 'bg-emerald-500 text-slate-950 active:bg-emerald-400'
    : 'bg-slate-700 text-slate-100 active:bg-slate-600';
  return (
    <label
      className={`block w-full cursor-pointer rounded-lg px-4 py-3 text-center font-semibold ${colours}`}
    >
      {label}
      {/* capture="environment" opens the phone's rear camera app directly. */}
      <input
        type="file"
        accept="image/*"
        {...(capture ? { capture: 'environment' as const } : {})}
        onChange={onChange}
        className="sr-only"
      />
    </label>
  );
}
