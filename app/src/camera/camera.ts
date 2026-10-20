// Opens the phone's rear camera and changes its controls. This runs on the main thread;
// the pictures are decoded in the worker (see decoder/).
import {
  NO_CONTROLS,
  readControls,
  type CameraCapabilities,
  type CameraControls,
  type CameraSettings,
} from './controls';
import { cameraProblem } from './problems';

/**
 * We ask for 1920×1080: sharp enough for small codes, and still quick to decode a few
 * times a second on a phone. These are wishes ("ideal"): the browser picks the closest.
 */
const SIZE = { width: { ideal: 1920 }, height: { ideal: 1080 } };

export interface CameraInfo {
  deviceId: string;
  label: string;
}

export interface LiveCamera {
  stream: MediaStream;
  /** The camera in use, matching an entry of listCameras(), or null if unknown. */
  deviceId: string | null;
  /** What the camera can do right now. Read it again after the video starts playing. */
  controls(): CameraControls;
  setZoom(value: number): Promise<void>;
  setTorch(on: boolean): Promise<void>;
  setAutoFocus(): Promise<void>;
  setFocusDistance(value: number): Promise<void>;
  /** Calls `listener` if the camera stops by itself, e.g. because another app took it. */
  onStopped(listener: () => void): void;
  /** Turns the camera (and its light) off. */
  stop(): void;
}

/** False in browsers that can't use a camera on web pages, or on a page without https. */
export function cameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

/**
 * Opens a camera: the one chosen earlier (deviceId), or else the rear camera.
 * Throws the browser's error when it fails; cameraProblem() explains it.
 */
export async function openCamera(deviceId: string | null): Promise<LiveCamera> {
  if (!cameraSupported()) {
    throw new DOMException('This browser cannot use the camera here', 'NotSupportedError');
  }
  const rear = () =>
    navigator.mediaDevices.getUserMedia({
      video: { ...SIZE, facingMode: { ideal: 'environment' } },
      audio: false,
    });

  let stream: MediaStream;
  if (deviceId) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { ...SIZE, deviceId: { exact: deviceId } },
        audio: false,
      });
    } catch (e) {
      if (cameraProblem(e) !== 'no-camera') throw e;
      stream = await rear(); // the camera chosen earlier is gone: use the rear one
    }
  } else {
    stream = await rear();
  }

  return wrap(stream);
}

/** Every camera the browser lists. Their names are only known after access is allowed. */
export async function listCameras(): Promise<CameraInfo[]> {
  if (typeof navigator.mediaDevices?.enumerateDevices !== 'function') return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'videoinput' && device.deviceId !== '')
    .map((device, i) => ({ deviceId: device.deviceId, label: device.label || `Camera ${i + 1}` }));
}

function wrap(stream: MediaStream): LiveCamera {
  const track = stream.getVideoTracks()[0];
  if (!track) throw new DOMException('The camera gave no picture', 'NotReadableError');

  // Each change sends every wish again (size, zoom, light, focus): on some phones a new
  // request replaces the earlier ones, which would turn the light off when zooming.
  // Each wish is its own "advanced" entry, so one the camera can't do doesn't block the rest.
  const wishes: Record<'zoom' | 'torch' | 'focus', Record<string, unknown>> = {
    zoom: {},
    torch: {},
    focus: {},
  };
  const apply = (kind: keyof typeof wishes, wish: Record<string, unknown>) => {
    wishes[kind] = wish;
    const advanced = Object.values(wishes).filter((w) => Object.keys(w).length > 0);
    // Zoom, torch and focus are not in TypeScript's built-in types yet, hence the cast.
    return track.applyConstraints({ ...SIZE, advanced: advanced as MediaTrackConstraintSet[] });
  };

  return {
    stream,
    deviceId: track.getSettings().deviceId ?? null,
    controls() {
      // Not every browser has getCapabilities (older Firefox does not).
      if (typeof track.getCapabilities !== 'function') return NO_CONTROLS;
      return readControls(
        track.getCapabilities() as CameraCapabilities,
        track.getSettings() as CameraSettings,
      );
    },
    setZoom: (value) => apply('zoom', { zoom: value }),
    setTorch: (on) => apply('torch', { torch: on }),
    setAutoFocus: () => apply('focus', { focusMode: 'continuous' }),
    setFocusDistance: (value) => apply('focus', { focusMode: 'manual', focusDistance: value }),
    onStopped(listener) {
      // "ended" only fires when the camera stops by itself, not after stop() below.
      track.addEventListener('ended', listener);
    },
    stop() {
      for (const t of stream.getTracks()) t.stop();
    },
  };
}
