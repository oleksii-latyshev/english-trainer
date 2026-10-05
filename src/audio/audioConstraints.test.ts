// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { buildAudioConstraints } from './audioConstraints';

describe('buildAudioConstraints', () => {
  it('returns default audio constraints when deviceId is undefined', () => {
    const constraints = buildAudioConstraints(undefined);
    expect(constraints).toEqual({
      audio: {
        channelCount: { ideal: 1 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  });

  it('returns default audio constraints when deviceId is empty or whitespace', () => {
    expect(buildAudioConstraints('')).toEqual({
      audio: {
        channelCount: { ideal: 1 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    expect(buildAudioConstraints('   ')).toEqual({
      audio: {
        channelCount: { ideal: 1 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  });

  it('returns default audio constraints when deviceId is "default"', () => {
    const constraints = buildAudioConstraints('default');
    expect(constraints).toEqual({
      audio: {
        channelCount: { ideal: 1 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  });

  it('returns exact deviceId constraint when an explicit deviceId is provided', () => {
    const constraints = buildAudioConstraints('external-usb-mic-42');
    expect(constraints).toEqual({
      audio: {
        deviceId: { exact: 'external-usb-mic-42' },
        channelCount: { ideal: 1 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  });

  it('trims leading and trailing whitespace from explicit deviceId', () => {
    const constraints = buildAudioConstraints('  external-usb-mic-42  ');
    expect(constraints).toEqual({
      audio: {
        deviceId: { exact: 'external-usb-mic-42' },
        channelCount: { ideal: 1 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  });
});
