// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { createInterruptSpeechDetector } from './microphoneActivity';
import { actualEchoCancellationEnabled } from './microphoneInput';

describe('microphone activity', () => {
  it('signals only after at least 300 ms of sustained speech', () => {
    const events: string[] = [];
    const detector = createInterruptSpeechDetector({
      isEnabled: true,
      noiseFloor: 0.002,
      onSpeechStarted: () => events.push('speech'),
    });
    detector.push({ rms: 0.08, durationMs: 200 });
    expect(events).toEqual([]);
    detector.push({ rms: 0.08, durationMs: 100 });
    expect(events).toEqual(['speech']);
    detector.push({ rms: 0.08, durationMs: 100 });
    expect(events).toEqual(['speech']);
  });

  it('does not signal when the caller reports that echo cancellation is unavailable', () => {
    const events: string[] = [];
    const echoCancellationEnabled = actualEchoCancellationEnabled({ echoCancellation: false });
    const detector = createInterruptSpeechDetector({
      isEnabled: echoCancellationEnabled,
      noiseFloor: 0.002,
      onSpeechStarted: () => events.push('speech'),
    });
    for (let frame = 0; frame < 20; frame += 1) {
      detector.push({ rms: 0.08, durationMs: 20 });
    }
    expect(events).toEqual([]);
  });
});
