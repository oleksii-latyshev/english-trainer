// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { microphoneError } from './microphoneError';

describe('microphoneError', () => {
  it('handles permission denied errors', () => {
    const err1 = new DOMException('Permission denied', 'NotAllowedError');
    expect(microphoneError(err1)).toContain('Microphone access was denied');

    const err2 = new DOMException('Permission denied', 'PermissionDeniedError');
    expect(microphoneError(err2)).toContain('Microphone access was denied');
  });

  it('handles overconstrained errors when chosen device disappeared without fallback', () => {
    const domErr = new DOMException('Device unavailable', 'OverconstrainedError');
    const msg = microphoneError(domErr);
    expect(msg).toContain('selected microphone is unavailable');
    expect(msg).toContain('Reconnect it or choose another device in Settings');

    const objErr = { name: 'OverconstrainedError' };
    expect(microphoneError(objErr)).toBe(msg);
  });

  it('handles not found errors when no microphone exists', () => {
    const err1 = new DOMException('No devices', 'NotFoundError');
    expect(microphoneError(err1)).toContain('No microphone was found');

    const err2 = new DOMException('No devices', 'DevicesNotFoundError');
    expect(microphoneError(err2)).toContain('No microphone was found');
  });

  it('handles busy / not readable errors', () => {
    const err1 = new DOMException('Device busy', 'NotReadableError');
    expect(microphoneError(err1)).toContain('microphone is busy or unavailable');

    const err2 = new DOMException('Device busy', 'TrackStartError');
    expect(microphoneError(err2)).toContain('microphone is busy or unavailable');
  });

  it('returns custom error message for generic Error instances', () => {
    const customErr = new Error('AudioWorklet failed to initialize');
    expect(microphoneError(customErr)).toBe('AudioWorklet failed to initialize');
  });

  it('returns generic fallback for non-Error and unknown values', () => {
    expect(microphoneError('some string failure')).toBe('Recording failed. Please try again.');
    expect(microphoneError(null)).toBe('Recording failed. Please try again.');
    expect(microphoneError(undefined)).toBe('Recording failed. Please try again.');
    expect(microphoneError({ code: 500 })).toBe('Recording failed. Please try again.');
  });
});
