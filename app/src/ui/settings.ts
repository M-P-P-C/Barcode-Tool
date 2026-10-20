// Small choices remembered on this device (in the browser's local storage).
// Storage can be blocked, for example in a private window: then nothing is remembered,
// and the defaults apply.

const SOUND_KEY = 'barcode-inspector.sound';

/** Whether the user wants the beep. Remembered on this device; on by default. */
export function soundWanted(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true; // storage blocked, e.g. in a private window
  }
}

export function setSoundWanted(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // Not remembered; it still applies until the page closes.
  }
}

const CAMERA_KEY = 'barcode-inspector.camera';

/** The camera picked with "Switch camera", remembered on this device. */
export function savedCameraId(): string | null {
  try {
    return localStorage.getItem(CAMERA_KEY);
  } catch {
    return null;
  }
}

export function saveCameraId(deviceId: string | null): void {
  try {
    if (deviceId) localStorage.setItem(CAMERA_KEY, deviceId);
    else localStorage.removeItem(CAMERA_KEY);
  } catch {
    // Not remembered.
  }
}
