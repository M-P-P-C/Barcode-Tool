// What to tell the user when the camera can't start, and how to fix it in their browser.
// Kept free of browser globals so it can be tested in Node.
import type { CameraProblem } from '../camera/problems';
import { detectPlatform } from './platform';

export interface CameraHelp {
  title: string;
  text: string;
  /** Steps to fix it, for the browser in use. Empty when there is nothing to fix. */
  steps: string[];
}

type Browser = 'chrome' | 'edge' | 'samsung' | 'firefox' | 'safari' | 'other';

/** The browser, from navigator.userAgent. Only used to pick the right instructions. */
export function detectBrowser(userAgent: string): Browser {
  if (/SamsungBrowser/.test(userAgent)) return 'samsung';
  if (/EdgA|EdgiOS|Edg\//.test(userAgent)) return 'edge';
  if (/Firefox|FxiOS/.test(userAgent)) return 'firefox';
  if (/Chrome|CriOS/.test(userAgent)) return 'chrome';
  if (/Safari/.test(userAgent)) return 'safari';
  return 'other';
}

const NAMES: Record<Browser, string> = {
  chrome: 'Chrome',
  edge: 'Edge',
  samsung: 'Samsung Internet',
  firefox: 'Firefox',
  safari: 'Safari',
  other: 'your browser',
};

export function cameraHelp(
  problem: CameraProblem,
  userAgent: string,
  maxTouchPoints: number,
): CameraHelp {
  const platform = detectPlatform(userAgent, maxTouchPoints);
  const browser = detectBrowser(userAgent);
  switch (problem) {
    case 'blocked':
      return {
        title: 'Camera access is blocked',
        text: 'The browser is not letting this page use the camera. Allow it, then tap Try again.',
        steps: unblockSteps(platform, browser),
      };
    case 'no-camera':
      return {
        title: 'No camera found',
        text: 'This device has no camera the browser can use. You can still scan from a photo or an image file.',
        steps: [],
      };
    case 'busy':
      return {
        title: 'The camera is in use',
        text: 'Another app or browser tab is using the camera.',
        steps: [
          'Close other apps that use the camera, such as video calls.',
          'Close other tabs that show a camera, then tap Try again.',
          'If it still fails, restart the browser.',
        ],
      };
    case 'unsupported':
      return {
        title: 'This browser can’t use the camera here',
        text: 'Live scanning needs a recent browser. Scanning from a photo works in every browser.',
        steps: [
          platform === 'ios'
            ? 'Update your iPhone (Settings → General → Software Update), then open this page in Safari.'
            : 'Open this page in an up-to-date Chrome, Edge, Firefox or Samsung Internet.',
        ],
      };
    case 'other':
      return {
        title: 'The camera could not start',
        text: 'Something went wrong while starting the camera.',
        steps: [
          'Tap Try again.',
          'If it still fails, close the browser completely and open it again.',
        ],
      };
  }
}

function unblockSteps(platform: ReturnType<typeof detectPlatform>, browser: Browser): string[] {
  if (platform === 'ios') {
    // Every iPhone browser uses Safari's engine, but each app has its own camera switch.
    if (browser === 'safari' || browser === 'other') {
      return [
        'Tap the page menu next to the address (“aA” or “…”), then Website Settings.',
        'Set Camera to Allow (or Ask), then tap Try again.',
        'If it is still blocked: open the Settings app → Apps → Safari → Camera, and choose Allow or Ask.',
      ];
    }
    return [
      `Open the Settings app → Apps → ${NAMES[browser]}.`,
      'Turn Camera on, then come back and tap Try again.',
    ];
  }
  if (platform === 'android') {
    const site =
      browser === 'firefox'
        ? 'Tap the lock icon left of the address, then allow Camera.'
        : 'Tap the icon left of the address (a lock or two sliders), then Permissions → Camera → Allow.';
    return [
      site,
      'Tap Try again.',
      `If Camera can’t be changed there: open Android Settings → Apps → ${NAMES[browser]} → Permissions → Camera → Allow.`,
    ];
  }
  return [
    'Click the icon left of the address bar and allow the camera for this site.',
    'Check that your computer’s privacy settings let the browser use the camera.',
    'Click Try again, or reload the page.',
  ];
}
