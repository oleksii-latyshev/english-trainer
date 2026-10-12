import { Effect, Fiber, Stream } from 'effect';
import type { Capture } from '@/core/audio';
import { createSpeechGate, liveTranscript, speechRecognitionRuntime } from '@/core/speech';

export function watchLiveText(
  capture: Capture,
  hasHeardSpeech: () => boolean,
  onText: (text: string) => void,
): () => void {
  const fiber = speechRecognitionRuntime.runFork(
    liveTranscript({
      snapshot: capture.snapshot(),
      hasHeardSpeech: Effect.sync(hasHeardSpeech),
    }).pipe(Stream.runForEach((text) => Effect.sync(() => onText(text)))),
  );
  return () => {
    speechRecognitionRuntime.runFork(Fiber.interrupt(fiber));
  };
}

export function startOneShotLiveText(
  capture: Capture,
  onText: (text: string) => void,
): { sampleLevel: (level: number) => void; dispose: () => void } {
  const gate = createSpeechGate();
  const dispose = watchLiveText(capture, gate.hasHeardSpeech, onText);
  return { sampleLevel: gate.sample, dispose };
}
