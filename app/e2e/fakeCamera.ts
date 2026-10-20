// A fake phone camera for the tests. It replaces the browser's camera with a video
// stream drawn on a canvas, where a test can "hold" any fixture image in front of the
// camera. It can also pretend to have zoom, torch and focus, or fail like a real camera.
import type { Page } from '@playwright/test';

export interface FakeCameraOptions {
  /** Camera controls to report, like Chrome on Android. Default: none, like an iPhone. */
  capabilities?: Record<string, unknown>;
  /** How many cameras the phone lists. Default 1. */
  cameras?: number;
  /** Makes opening the camera fail with this browser error, e.g. 'NotAllowedError'... */
  failWith?: string;
  /** ...this many times; after that it works. Default: always. */
  failTimes?: number;
  /** The camera opens but never sends a picture. */
  noPicture?: boolean;
  /** Reports its controls only half a second after opening, like some Android phones. */
  lateControls?: boolean;
}

/** What the tests can read and do in the page, as window.fakeCamera. */
export interface FakeCameraHandle {
  /** Holds one or more images in front of the camera, side by side. */
  show(...imageUrls: string[]): Promise<void>;
  clear(): void;
  /** Every applyConstraints() call the app made, e.g. { advanced: [{ zoom: 2 }] }. */
  applied: unknown[];
  /** The constraints of every getUserMedia() call. */
  opened: unknown[];
  /** The newest camera's current settings, e.g. { zoom: 2, torch: true, ... }. */
  settings(): Record<string, unknown>;
  /** True while the newest camera is on (not stopped). */
  isOn(): boolean;
  /** Stops the camera the way it happens when another app takes it. */
  takenByOtherApp(): void;
}

declare global {
  interface Window {
    fakeCamera: FakeCameraHandle;
  }
}

/** Installs the fake camera. Call before page.goto(). */
export async function installFakeCamera(page: Page, options: FakeCameraOptions = {}) {
  await page.addInitScript(fakeCamera, options);
}

// This function runs inside the page, before the app starts.
function fakeCamera(options: FakeCameraOptions) {
  const width = 1280;
  const height = 720;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  let pictures: HTMLImageElement[] = [];
  let current: { track: MediaStreamTrack; settings: Record<string, unknown> } | null = null;

  // A grey table with the pictures side by side, redrawn all the time like a real camera.
  const paint = () => {
    if (!context) return;
    context.fillStyle = 'rgb(170, 170, 170)';
    context.fillRect(0, 0, width, height);
    const slot = width / Math.max(1, pictures.length);
    pictures.forEach((picture, i) => {
      const scale = Math.min(1, (slot * 0.85) / picture.width, (height * 0.85) / picture.height);
      const w = picture.width * scale;
      const h = picture.height * scale;
      context.drawImage(picture, slot * i + (slot - w) / 2, (height - h) / 2, w, h);
    });
  };
  paint();
  setInterval(paint, 100);

  const handle: FakeCameraHandle = {
    async show(...imageUrls) {
      pictures = await Promise.all(imageUrls.map(loadImage));
      paint();
    },
    clear() {
      pictures = [];
      paint();
    },
    applied: [],
    opened: [],
    settings: () => ({ ...(current?.settings ?? {}) }),
    isOn: () => current?.track.readyState === 'live',
    takenByOtherApp() {
      if (!current) return;
      current.track.stop();
      current.track.dispatchEvent(new Event('ended'));
    },
  };
  window.fakeCamera = handle;

  let failuresLeft = options.failTimes ?? Number.POSITIVE_INFINITY;
  const cameraCount = options.cameras ?? 1;

  function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('fake camera: image did not load'));
      image.src = url;
    });
  }

  navigator.mediaDevices.getUserMedia = async (constraints) => {
    handle.opened.push(constraints);
    if (options.failWith && failuresLeft > 0) {
      failuresLeft--;
      throw new DOMException('Fake camera failure', options.failWith);
    }
    // A frame rate of 0 means no pictures until asked for, which never happens here.
    const stream = options.noPicture
      ? document.createElement('canvas').captureStream(0)
      : canvas.captureStream(10);
    const track = stream.getVideoTracks()[0];
    const video = typeof constraints?.video === 'object' ? constraints.video : {};
    const wanted = video.deviceId;
    const deviceId =
      typeof wanted === 'object' && wanted !== null && 'exact' in wanted
        ? String(wanted.exact)
        : 'fake-0';
    const settings: Record<string, unknown> = {
      deviceId,
      zoom: 1,
      torch: false,
      focusMode: 'single-shot',
      focusDistance: 0.5,
    };
    const realSettings = track.getSettings.bind(track);
    track.getSettings = () => ({ ...realSettings(), ...settings });
    const openedAt = performance.now();
    track.getCapabilities = () =>
      options.lateControls && performance.now() - openedAt < 500
        ? {}
        : { ...(options.capabilities ?? {}) };
    track.applyConstraints = async (wantedSettings) => {
      handle.applied.push(wantedSettings);
      for (const set of wantedSettings?.advanced ?? []) Object.assign(settings, set);
    };
    current = { track, settings };
    return stream;
  };

  navigator.mediaDevices.enumerateDevices = async () =>
    Array.from({ length: cameraCount }, (_, i) => ({
      deviceId: `fake-${i}`,
      groupId: 'fake',
      kind: 'videoinput' as const,
      label: `Fake camera ${i + 1}`,
      toJSON() {
        return this;
      },
    }));
}
