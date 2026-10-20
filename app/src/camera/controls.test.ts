import { describe, expect, it } from 'vitest';
import { NO_CONTROLS, readControls } from './controls';
import { cameraProblem } from './problems';

describe('[REQ-CAM-003] readControls', () => {
  it('offers nothing when the camera reports nothing (iPhone browsers)', () => {
    expect(readControls({}, {})).toEqual(NO_CONTROLS);
  });

  it('reads zoom, torch and focus from an Android-style camera', () => {
    const controls = readControls(
      {
        zoom: { min: 1, max: 8, step: 0.1 },
        torch: true,
        focusMode: ['manual', 'single-shot', 'continuous'],
        focusDistance: { min: 0.1, max: 2, step: 0.01 },
      },
      { zoom: 2, torch: false, focusMode: 'continuous', focusDistance: 0.5 },
    );
    expect(controls).toEqual({
      zoom: { min: 1, max: 8, step: 0.1, value: 2 },
      torch: true,
      torchOn: false,
      autoFocus: true,
      focusDistance: { min: 0.1, max: 2, step: 0.01, value: 0.5 },
      manualFocus: false,
    });
  });

  it('hides a zoom that cannot change', () => {
    expect(readControls({ zoom: { min: 1, max: 1, step: 0.1 } }, { zoom: 1 }).zoom).toBeNull();
  });

  it('fills in a missing step and keeps the value inside the range', () => {
    expect(readControls({ zoom: { min: 1, max: 5 } }, { zoom: 9 }).zoom).toEqual({
      min: 1,
      max: 5,
      step: 0.04,
      value: 5,
    });
  });

  it('accepts a torch reported as a list', () => {
    expect(readControls({ torch: [false, true] }, {}).torch).toBe(true);
    expect(readControls({ torch: [false] }, {}).torch).toBe(false);
  });

  it('offers manual focus only when the camera has a manual mode', () => {
    const range = { min: 0, max: 1, step: 0.01 };
    expect(
      readControls({ focusMode: ['continuous'], focusDistance: range }, {}).focusDistance,
    ).toBeNull();
    expect(
      readControls({ focusMode: ['manual'], focusDistance: range }, {}).focusDistance,
    ).not.toBeNull();
  });
});

describe('[REQ-CAM-004] cameraProblem', () => {
  const error = (name: string) => Object.assign(new Error('camera'), { name });

  it('sorts browser errors into problems the user can fix', () => {
    expect(cameraProblem(error('NotAllowedError'))).toBe('blocked');
    expect(cameraProblem(error('SecurityError'))).toBe('blocked');
    expect(cameraProblem(error('NotFoundError'))).toBe('no-camera');
    expect(cameraProblem(error('OverconstrainedError'))).toBe('no-camera');
    expect(cameraProblem(error('NotReadableError'))).toBe('busy');
    expect(cameraProblem(error('NotSupportedError'))).toBe('unsupported');
    expect(cameraProblem(error('SomethingElse'))).toBe('other');
    expect(cameraProblem('just text')).toBe('other');
  });

  it('reads the name of a plain object, as some browsers throw', () => {
    expect(cameraProblem({ name: 'NotAllowedError', message: 'denied' })).toBe('blocked');
  });
});
