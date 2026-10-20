// Scan with the live camera. It reads by itself: on a read it beeps, vibrates, freezes
// the picture with the code outlined, and shows the result until "Scan next".
// The scanning loop itself is in camera/liveScanner.ts.
import { useEffect, useRef, useState } from 'react';
import type { CameraInfo, LiveCamera } from '../camera/camera';
import { NO_CONTROLS, type CameraControls } from '../camera/controls';
import { createLiveScanner, type LiveScanner } from '../camera/liveScanner';
import { cameraProblem, type CameraProblem } from '../camera/problems';
import type { DecodeResult } from '../decoder/types';
import { CameraControlsPanel } from './CameraControlsPanel';
import { cameraHelp } from './cameraHelp';
import { Card } from './Card';
import { decoder, loadGs1 } from './engines';
import { allowSound, beep, vibrate } from './feedback';
import { Preview } from './Preview';
import { ReadResults } from './ReadResults';
import { checkScans, saveRead, type Read } from './reads';
import { LINKS } from './router';
import { savedCameraId, saveCameraId, setSoundWanted, soundWanted } from './settings';

type State =
  | { status: 'starting' }
  | { status: 'live' }
  | { status: 'found'; imageUrl: string; decoded: DecodeResult; read: Read }
  | { status: 'problem'; problem: CameraProblem; message: string }
  | { status: 'failed'; reason: string };

export function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanner = useRef<LiveScanner | null>(null);
  const [state, setState] = useState<State>({ status: 'starting' });
  const [camera, setCamera] = useState<LiveCamera | null>(null);
  const [controls, setControls] = useState<CameraControls>(NO_CONTROLS);
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [sound, setSound] = useState(soundWanted);
  const soundOn = useRef(sound); // read by the scanner's callbacks
  useEffect(() => {
    soundOn.current = sound;
  }, [sound]);

  // Turn the camera on when the page opens, and off when it closes or goes to the background.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let closed = false;
    decoder.warmUp();
    loadGs1().catch(() => undefined); // a failure is shown when a code is read

    const showRead = async (decoded: DecodeResult, picture: HTMLCanvasElement) => {
      const imageUrl = await pictureUrl(picture);
      try {
        const read = await checkScans(decoded.scans, 'camera');
        if (closed) {
          URL.revokeObjectURL(imageUrl);
          return;
        }
        // Show the result first, then save it, so a slow save never hides a result.
        setState({ status: 'found', imageUrl, decoded, read });
        const save = await saveRead(read);
        setState((s) =>
          s.status === 'found' && s.read === read ? { ...s, read: { ...read, save } } : s,
        );
      } catch (e) {
        URL.revokeObjectURL(imageUrl);
        if (!closed) setState({ status: 'failed', reason: messageOf(e) });
      }
    };

    const live = createLiveScanner(video, decoder, {
      onStarted(started, list) {
        setCamera(started);
        setCameras(list);
        setControls(started.controls());
        // Coming back from the background with a result on screen keeps the result.
        setState((s) => (s.status === 'found' ? s : { status: 'live' }));
      },
      onControlsChanged(started) {
        setControls(started.controls());
      },
      onCameraError(error) {
        setCamera(null);
        setState({ status: 'problem', problem: cameraProblem(error), message: messageOf(error) });
      },
      onRead({ decoded, picture }) {
        if (soundOn.current) beep();
        vibrate();
        void showRead(decoded, picture);
      },
      onReaderError(error) {
        setState({ status: 'failed', reason: messageOf(error) });
      },
    });
    scanner.current = live;
    void live.start(savedCameraId());

    const onVisibility = () => {
      if (document.hidden) live.stop();
      else live.wake();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      closed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      live.stop();
      scanner.current = null;
    };
  }, []);

  // Free the frozen picture's memory when it is replaced or the page closes.
  const imageUrl = state.status === 'found' ? state.imageUrl : null;
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  /** Changes a camera setting; the screen shows the new value at once. */
  const change = (
    action: (camera: LiveCamera) => Promise<void>,
    update: (controls: CameraControls) => CameraControls,
  ) => {
    if (!camera) return;
    setControls(update);
    action(camera).catch(() => setControls(camera.controls())); // refused: show the real value
  };

  const restart = (deviceId: string | null) => {
    setCamera(null);
    setControls(NO_CONTROLS);
    setState({ status: 'starting' });
    void scanner.current?.start(deviceId);
  };

  const switchCamera = () => {
    const index = cameras.findIndex((c) => c.deviceId === camera?.deviceId);
    const next = cameras[(index + 1) % cameras.length];
    if (!next) return;
    saveCameraId(next.deviceId);
    restart(next.deviceId);
  };

  const toggleSound = () => {
    const on = !sound;
    setSound(on);
    setSoundWanted(on);
    if (on) {
      allowSound();
      beep(); // so the user hears how loud it is
    }
  };

  const scanNext = () => {
    setState({ status: 'live' });
    scanner.current?.resume();
  };

  const showCamera = state.status === 'starting' || state.status === 'live';

  return (
    // Any tap on this page allows the beep (browsers block sound until a tap; on touch
    // screens only the end of a tap counts).
    <div className="flex flex-col gap-4" onPointerUp={allowSound} onClick={allowSound}>
      <header className="flex items-center gap-3">
        <a
          href={LINKS.home}
          className="rounded-lg px-2 py-1 text-emerald-300"
          aria-label="Back to start"
        >
          ← Back
        </a>
        <h1 className="text-xl font-semibold">Scan with camera</h1>
      </header>

      {/* The video stays on the page while a result shows, so scanning resumes at once. */}
      <div
        className={
          showCamera
            ? 'relative aspect-[3/4] max-h-[65dvh] w-full overflow-hidden rounded-xl bg-black'
            : 'hidden'
        }
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          autoPlay
          aria-label="Camera picture"
        />
        {/* Only a guide: the whole picture is searched for codes. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[10%] top-1/2 aspect-[4/3] -translate-y-1/2 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]"
        />
        {state.status === 'starting' && (
          <p className="absolute inset-x-0 bottom-3 text-center text-sm text-white">
            Starting the camera…
          </p>
        )}
      </div>

      <p
        role="status"
        className={state.status === 'live' ? 'text-center text-slate-300' : 'sr-only'}
      >
        {state.status === 'live' && 'Point the camera at a barcode. It reads by itself.'}
        {state.status === 'found' &&
          (state.read.parsed.length === 1
            ? 'Barcode read.'
            : `${state.read.parsed.length} barcodes read.`)}
      </p>

      {showCamera && (
        <CameraControlsPanel
          controls={controls}
          cameras={cameras}
          cameraId={camera?.deviceId ?? null}
          sound={sound}
          onZoom={(value) =>
            change(
              (c) => c.setZoom(value),
              (c) => (c.zoom ? { ...c, zoom: { ...c.zoom, value } } : c),
            )
          }
          onTorch={() => {
            const on = !controls.torchOn;
            change(
              (c) => c.setTorch(on),
              (c) => ({ ...c, torchOn: on }),
            );
          }}
          onAutoFocus={() =>
            change(
              (c) => c.setAutoFocus(),
              (c) => ({ ...c, manualFocus: false }),
            )
          }
          onFocusDistance={(value) =>
            change(
              (c) => c.setFocusDistance(value),
              (c) =>
                c.focusDistance
                  ? { ...c, manualFocus: true, focusDistance: { ...c.focusDistance, value } }
                  : c,
            )
          }
          onSwitchCamera={switchCamera}
          onSound={toggleSound}
        />
      )}

      {state.status === 'found' && (
        <>
          <Preview
            imageUrl={state.imageUrl}
            alt="The camera picture that was read"
            scans={state.decoded.scans}
            size={state.decoded.size}
          />
          <button
            type="button"
            onClick={scanNext}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-slate-950 active:bg-emerald-400"
          >
            Scan next
          </button>
          <ReadResults read={state.read} />
        </>
      )}

      {state.status === 'problem' && (
        <ProblemCard
          problem={state.problem}
          message={state.message}
          onRetry={() => restart(savedCameraId())}
        />
      )}

      {state.status === 'failed' && (
        <div className="rounded-lg bg-red-500/10 p-3 text-red-200">
          <p>The barcode reader stopped: {state.reason}</p>
          <button
            type="button"
            onClick={() => restart(savedCameraId())}
            className="mt-3 rounded-lg bg-slate-700 px-4 py-2 font-semibold text-slate-100"
          >
            Try again
          </button>
        </div>
      )}

      <p className="text-center text-sm text-slate-400">
        Tiny code, or no zoom on this phone?{' '}
        <a href={LINKS.scan} className="text-emerald-300 underline underline-offset-2">
          Scan from a photo
        </a>
      </p>
    </div>
  );
}

function ProblemCard({
  problem,
  message,
  onRetry,
}: {
  problem: CameraProblem;
  message: string;
  onRetry: () => void;
}) {
  const help = cameraHelp(problem, navigator.userAgent, navigator.maxTouchPoints);
  return (
    <Card title={help.title}>
      <p className="text-slate-300">{help.text}</p>
      {help.steps.length > 0 && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-slate-300">
          {help.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      {problem === 'other' && message && (
        <p className="mt-3 text-sm text-slate-400">The browser said: {message}</p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        {problem !== 'unsupported' && problem !== 'no-camera' && (
          <button
            type="button"
            onClick={onRetry}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-slate-950 active:bg-emerald-400"
          >
            Try again
          </button>
        )}
        <a
          href={LINKS.scan}
          className="block w-full rounded-lg bg-slate-700 px-4 py-3 text-center font-semibold text-slate-100 active:bg-slate-600"
        >
          Scan from a photo instead
        </a>
      </div>
      <p className="mt-3 text-sm text-slate-400">
        Scanning from a photo uses the phone&apos;s own camera app and needs no permission.
      </p>
    </Card>
  );
}

/** The frozen picture as an image address. toBlob copies the canvas at once. */
function pictureUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/jpeg')),
      'image/jpeg',
      0.9,
    );
  });
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
