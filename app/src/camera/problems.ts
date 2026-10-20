// Why the camera could not start, from the error the browser gives.
// Kept free of browser globals so it can be tested in Node.

export type CameraProblem =
  /** The user or the browser said no to camera access. */
  | 'blocked'
  /** There is no camera, or none that fits. */
  | 'no-camera'
  /** The camera exists but another app or tab is using it. */
  | 'busy'
  /** This browser can't use the camera on web pages at all. */
  | 'unsupported'
  /** Anything else; the browser's message is shown. */
  | 'other';

export function cameraProblem(error: unknown): CameraProblem {
  const name = error instanceof Error || isNamed(error) ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError': // older Chrome
    case 'SecurityError': // e.g. blocked for this page by the browser's settings
      return 'blocked';
    case 'NotFoundError':
    case 'DevicesNotFoundError': // older Chrome
    case 'OverconstrainedError':
      return 'no-camera';
    case 'NotReadableError':
    case 'TrackStartError': // older Chrome
    case 'AbortError':
      return 'busy';
    case 'NotSupportedError':
      return 'unsupported';
    default:
      return 'other';
  }
}

// DOMException is not always an Error subclass in every browser or in Node.
function isNamed(value: unknown): value is { name: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { name?: unknown }).name === 'string'
  );
}
