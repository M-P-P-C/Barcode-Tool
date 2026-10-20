// Works out which install instructions to show, from what the browser tells us.
// Kept free of browser globals so it can be tested in Node.

export type Platform = 'ios' | 'android' | 'desktop';

/**
 * @param userAgent      navigator.userAgent
 * @param maxTouchPoints navigator.maxTouchPoints (iPads report themselves as a Mac,
 *                       but a Mac has no touch screen)
 */
export function detectPlatform(userAgent: string, maxTouchPoints: number): Platform {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios';
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return 'desktop';
}

/** Step-by-step instructions for adding the app to the home screen. */
export function installSteps(platform: Platform): string[] {
  switch (platform) {
    case 'ios':
      return [
        'Open this page in Safari.',
        'Tap the Share button.',
        'Choose "Add to Home Screen", then "Add".',
      ];
    case 'android':
      return [
        'Open this page in Chrome.',
        'Tap the menu (three dots, top right).',
        'Choose "Install app" or "Add to Home screen".',
      ];
    case 'desktop':
      return [
        'Open this page in Chrome or Edge.',
        'Click the install icon at the right end of the address bar.',
      ];
  }
}
