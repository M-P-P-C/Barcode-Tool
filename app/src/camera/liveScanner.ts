// The live scanning loop. It takes a frame from the camera, sends it to the decoder
// worker, waits for the answer, and only then takes the next frame, so frames that
// arrive while the worker is busy are skipped. A new read pauses the loop (the camera
// stays on) until resume() is called. The same barcode is ignored for 2 seconds.
import { createRepeatFilter, scanKey } from '../core/repeats';
import type { BarcodeDecoder, DecodeResult } from '../decoder/types';
import { listCameras, openCamera, type CameraInfo, type LiveCamera } from './camera';
import { createFrameGrabber, nextFrame } from './frames';

/** At most 10 frames a second, to save battery. Phones are often slower than that anyway. */
const MIN_FRAME_GAP_MS = 100;
/** Some cameras deliver frames slowly; never wait longer than this for a new one. */
const MAX_FRAME_WAIT_MS = 500;
/** After this many failed reads in a row, the reader is reported as broken. */
const MAX_FAILURES = 3;
/** A camera that shows no picture this long after opening is reported as a problem. */
const FIRST_PICTURE_MS = 5000;
/** Some Android phones only report zoom, light and focus a moment after the picture starts. */
const CONTROLS_SETTLE_MS = 1000;

export interface LiveRead {
  decoded: DecodeResult;
  /** The exact picture that was decoded. It changes once scanning resumes. */
  picture: HTMLCanvasElement;
}

export interface LiveScannerEvents {
  /** The camera is on. `cameras` lists every camera, for switching. */
  onStarted(camera: LiveCamera, cameras: CameraInfo[]): void;
  /** The camera's controls may have changed: read camera.controls() again. */
  onControlsChanged(camera: LiveCamera): void;
  /** The camera could not start; cameraProblem() explains the error. */
  onCameraError(error: unknown): void;
  /** A new barcode was read. Scanning pauses until resume(). */
  onRead(read: LiveRead): void;
  /** The barcode reader failed several times in a row. */
  onReaderError(error: unknown): void;
}

export interface LiveScanner {
  /** Turns on a camera (the given one, or the rear camera) and starts scanning. */
  start(deviceId: string | null): Promise<void>;
  /** Scans again after a read. */
  resume(): void;
  /** Turns the camera off, e.g. when the app goes to the background. */
  stop(): void;
  /** Turns the camera back on after stop(), scanning again unless a read is on screen. */
  wake(): void;
}

export function createLiveScanner(
  video: HTMLVideoElement,
  decoder: BarcodeDecoder,
  events: LiveScannerEvents,
): LiveScanner {
  let camera: LiveCamera | null = null;
  let deviceId: string | null = null;
  /** Goes up whenever the camera stops; work from an older camera then ends quietly. */
  let session = 0;
  /** The session whose loop is running, so one camera never runs two loops. */
  let loopSession = -1;
  /** True while a read is on screen. */
  let paused = false;
  const grabber = createFrameGrabber();
  const repeats = createRepeatFilter();

  function stop() {
    session++;
    camera?.stop();
    camera = null;
    video.srcObject = null;
  }

  async function start(id: string | null, scanAfter = true) {
    stop();
    const mine = session;
    deviceId = id;
    let opened: LiveCamera;
    try {
      opened = await openCamera(id);
    } catch (e) {
      if (mine === session) events.onCameraError(e);
      return;
    }
    if (mine !== session) {
      opened.stop(); // stopped or restarted while the camera was opening
      return;
    }
    camera = opened;
    deviceId = opened.deviceId ?? id;
    opened.onStopped(() => {
      if (mine !== session) return;
      stop();
      events.onCameraError(
        new DOMException('The camera stopped, perhaps another app took it', 'NotReadableError'),
      );
    });
    video.srcObject = opened.stream;
    // Allowed without a tap because the video is muted and plays inline. Some browsers
    // never settle play(), so we only wait for the first picture, with a time limit.
    void video.play().catch(() => undefined);
    const hasPicture = await waitForPicture(video, FIRST_PICTURE_MS);
    if (mine !== session) return;
    if (!hasPicture) {
      stop();
      events.onCameraError(
        Object.assign(new Error('The camera started but sent no picture.'), {
          name: 'NoPictureError',
        }),
      );
      return;
    }

    // Keep the picture sharp by itself where the camera allows it. Checked again a moment
    // later, because some phones report their controls late.
    let autoFocusOn = false;
    const turnOnAutoFocus = async () => {
      if (autoFocusOn || !opened.controls().autoFocus) return;
      autoFocusOn = true;
      await opened.setAutoFocus().catch(() => undefined);
    };
    await turnOnAutoFocus();
    const cameras = await listCameras().catch(() => []);
    if (mine !== session) return;
    events.onStarted(opened, cameras);
    setTimeout(async () => {
      if (mine !== session) return;
      await turnOnAutoFocus();
      if (mine === session) events.onControlsChanged(opened);
    }, CONTROLS_SETTLE_MS);

    if (scanAfter) {
      paused = false;
      void loop(mine);
    }
  }

  async function loop(mine: number) {
    if (loopSession === mine) return;
    loopSession = mine;
    let lastFrame = 0;
    let failures = 0;
    try {
      while (mine === session) {
        await Promise.race([nextFrame(video), sleep(MAX_FRAME_WAIT_MS)]);
        const wait = lastFrame + MIN_FRAME_GAP_MS - performance.now();
        if (wait > 0) await sleep(wait);
        if (mine !== session) return;
        lastFrame = performance.now();

        const frame = grabber.grab(video);
        if (!frame) continue; // the video has no picture yet

        let decoded: DecodeResult;
        try {
          decoded = await decoder.decodeFrame(frame);
          failures = 0;
        } catch (e) {
          if (++failures >= MAX_FAILURES) {
            if (mine === session) events.onReaderError(e);
            return;
          }
          continue;
        }
        if (mine !== session) return;
        if (decoded.scans.length === 0) continue;
        if (!repeats.isNew(decoded.scans.map(scanKey), performance.now())) continue;

        paused = true;
        events.onRead({ decoded, picture: grabber.canvas });
        return;
      }
    } finally {
      if (loopSession === mine) loopSession = -1;
    }
  }

  return {
    start: (id) => start(id),
    resume() {
      paused = false;
      // Codes still in view count as just seen, so they don't show again at once.
      repeats.restart(performance.now());
      if (!camera) {
        void start(deviceId);
        return;
      }
      void video.play().catch(() => undefined);
      void loop(session);
    },
    stop,
    wake() {
      if (!camera) void start(deviceId, !paused);
    },
  };
}

/** True once the video shows a picture; false if none arrives within `ms`. */
async function waitForPicture(video: HTMLVideoElement, ms: number): Promise<boolean> {
  const until = performance.now() + ms;
  while (performance.now() < until) {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      return true;
    }
    await sleep(100);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
