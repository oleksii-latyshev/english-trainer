// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import type { AudioFrame } from './microphoneSession';
import { listenForTurn } from './turnListening';

function fakeSource() {
  let listener: ((frame: AudioFrame) => void) | undefined;
  return {
    source: {
      noiseFloor: () => 0.002,
      subscribeFrames: (next: (frame: AudioFrame) => void) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
    },
    emit(rms: number, durationMs: number) {
      for (let t = 0; t < durationMs; t += 20) {
        listener?.({ samples: new Float32Array(0), rms, durationMs: 20 });
      }
    },
    isSubscribed: () => listener !== undefined,
  };
}

describe('turn listening', () => {
  it('reports speech then the end of the turn, and unsubscribes on dispose', () => {
    const fake = fakeSource();
    const events: string[] = [];
    const listening = listenForTurn(
      fake.source,
      { endPauseMs: 1000 },
      { onSpeechStarted: () => events.push('speech'), onTurnEnded: () => events.push('end') },
    );
    fake.emit(0.08, 600);
    fake.emit(0.002, 1200);
    expect(events).toEqual(['speech', 'end']);
    listening.dispose();
    expect(fake.isSubscribed()).toBe(false);
  });

  it('ignores the settle span so the assistant voice tail is not heard as speech', () => {
    const fake = fakeSource();
    const events: string[] = [];
    listenForTurn(
      fake.source,
      { endPauseMs: 1000, settleMs: 400 },
      { onSpeechStarted: () => events.push('speech'), onTurnEnded: () => events.push('end') },
    );
    fake.emit(0.08, 400);
    expect(events).toEqual([]);
    fake.emit(0.08, 400);
    expect(events).toEqual(['speech']);
  });

  it('holds the turn open until released', () => {
    const fake = fakeSource();
    const events: string[] = [];
    const listening = listenForTurn(
      fake.source,
      { endPauseMs: 1000 },
      { onSpeechStarted: () => {}, onTurnEnded: () => events.push('end') },
    );
    fake.emit(0.08, 600);
    listening.setHold(true);
    fake.emit(0.002, 4000);
    expect(events).toEqual([]);
    listening.setHold(false);
    fake.emit(0.002, 1200);
    expect(events).toEqual(['end']);
  });
});
