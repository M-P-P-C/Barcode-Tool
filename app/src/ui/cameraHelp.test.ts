import { describe, expect, it } from 'vitest';
import { cameraHelp, detectBrowser } from './cameraHelp';

const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 15; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1',
  desktopEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
};

describe('[REQ-CAM-004] detectBrowser', () => {
  it('tells the common phone browsers apart', () => {
    expect(detectBrowser(UA.androidChrome)).toBe('chrome');
    expect(detectBrowser(UA.androidSamsung)).toBe('samsung');
    expect(detectBrowser(UA.androidFirefox)).toBe('firefox');
    expect(detectBrowser(UA.iphoneSafari)).toBe('safari');
    expect(detectBrowser(UA.iphoneChrome)).toBe('chrome');
    expect(detectBrowser(UA.desktopEdge)).toBe('edge');
  });
});

describe('[REQ-CAM-004] cameraHelp', () => {
  it('explains how to unblock the camera in the browser in use', () => {
    expect(cameraHelp('blocked', UA.androidChrome, 5).steps.join(' ')).toContain('Apps → Chrome');
    expect(cameraHelp('blocked', UA.androidSamsung, 5).steps.join(' ')).toContain(
      'Samsung Internet',
    );
    expect(cameraHelp('blocked', UA.androidFirefox, 5).steps[0]).toContain('lock icon');
    expect(cameraHelp('blocked', UA.iphoneSafari, 5).steps.join(' ')).toContain('Website Settings');
    expect(cameraHelp('blocked', UA.iphoneChrome, 5).steps[0]).toContain('Apps → Chrome');
    expect(cameraHelp('blocked', UA.desktopEdge, 0).steps[0]).toContain('address bar');
  });

  it('has a title and text for every problem', () => {
    for (const problem of ['blocked', 'no-camera', 'busy', 'unsupported', 'other'] as const) {
      const help = cameraHelp(problem, UA.androidChrome, 5);
      expect(help.title).not.toBe('');
      expect(help.text).not.toBe('');
    }
  });
});
