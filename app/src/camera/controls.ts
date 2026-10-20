// Which camera controls this phone offers. Browsers differ a lot: Chrome on Android usually
// offers zoom, torch and focus; iPhone browsers offer none of them. Every control is
// optional and only shown when the camera reports it (AGENTS.md rule 6).
// Plain objects in, plain objects out, so this can be tested in Node.

export interface Range {
  min: number;
  max: number;
  step: number;
}

/**
 * The parts of MediaStreamTrack.getCapabilities() we use. They come from the
 * "Image Capture" web standard, which TypeScript's built-in types don't include yet.
 */
export interface CameraCapabilities {
  zoom?: Partial<Range>;
  torch?: boolean | boolean[];
  focusMode?: string[];
  focusDistance?: Partial<Range>;
}

/** The matching parts of MediaStreamTrack.getSettings(): the current values. */
export interface CameraSettings {
  zoom?: number;
  torch?: boolean;
  focusMode?: string;
  focusDistance?: number;
}

export interface CameraControls {
  /** Zoom range and current value, or null when the camera can't zoom. */
  zoom: (Range & { value: number }) | null;
  /** True when the light (torch) can be switched on. */
  torch: boolean;
  torchOn: boolean;
  /** True when the camera can keep focusing by itself (continuous autofocus). */
  autoFocus: boolean;
  /** Manual focus distance range and current value, or null when not offered. */
  focusDistance: (Range & { value: number }) | null;
  /** True while manual focus is in use. */
  manualFocus: boolean;
}

export const NO_CONTROLS: CameraControls = {
  zoom: null,
  torch: false,
  torchOn: false,
  autoFocus: false,
  focusDistance: null,
  manualFocus: false,
};

export function readControls(
  capabilities: CameraCapabilities,
  settings: CameraSettings,
): CameraControls {
  const focusModes = Array.isArray(capabilities.focusMode) ? capabilities.focusMode : [];
  const focusRange = toRange(capabilities.focusDistance);
  return {
    zoom: withValue(toRange(capabilities.zoom), settings.zoom),
    // The standard says a boolean; some browsers have reported a list like [true, false].
    torch:
      capabilities.torch === true ||
      (Array.isArray(capabilities.torch) && capabilities.torch.includes(true)),
    torchOn: settings.torch === true,
    autoFocus: focusModes.includes('continuous'),
    focusDistance: focusModes.includes('manual')
      ? withValue(focusRange, settings.focusDistance)
      : null,
    manualFocus: settings.focusMode === 'manual',
  };
}

/** A usable slider range, or null when the numbers are missing or the range is empty. */
function toRange(range: Partial<Range> | undefined): Range | null {
  if (!range) return null;
  const { min, max } = range;
  if (typeof min !== 'number' || typeof max !== 'number') return null;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
  const step =
    typeof range.step === 'number' && range.step > 0 && range.step <= max - min
      ? range.step
      : (max - min) / 100;
  return { min, max, step };
}

function withValue(range: Range | null, value: number | undefined) {
  if (!range) return null;
  const current = typeof value === 'number' && Number.isFinite(value) ? value : range.min;
  return { ...range, value: Math.min(range.max, Math.max(range.min, current)) };
}
