import { describe, expect, it } from 'vitest';
import { detectPlatform, installSteps } from './platform';

// Real user-agent strings, shortened.
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/140.0';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0';

describe('detectPlatform', () => {
  it('recognises an iPhone', () => {
    expect(detectPlatform(IPHONE, 5)).toBe('ios');
  });

  it('recognises an iPad that reports itself as a Mac', () => {
    expect(detectPlatform(IPAD_AS_MAC, 5)).toBe('ios');
  });

  it('treats a real Mac as a desktop', () => {
    expect(detectPlatform(IPAD_AS_MAC, 0)).toBe('desktop');
  });

  it('recognises Android', () => {
    expect(detectPlatform(ANDROID, 5)).toBe('android');
  });

  it('falls back to desktop', () => {
    expect(detectPlatform(WINDOWS, 0)).toBe('desktop');
  });
});

describe('[REQ-INF-002] installSteps', () => {
  it('gives at least one step for every platform', () => {
    for (const platform of ['ios', 'android', 'desktop'] as const) {
      expect(installSteps(platform).length).toBeGreaterThan(0);
    }
  });
});
