import { Effect, Ref, Stream } from 'effect';
import type { AudioFrame, TurnEvent } from '../audio';
import { signalMeterValue } from '../helpers/audio-signal';
import { createInterruptSpeechDetector } from '../helpers/interrupt-speech';
import { createTurnDetector, type TurnFrameResult } from '../helpers/turn-detector';

export type FrameSource = {
  readonly frames: Stream.Stream<AudioFrame>;
  readonly noiseFloor: Effect.Effect<number>;
};

export type TurnOptions = {
  readonly endPauseMs: number;
  readonly settleMs?: number;
  readonly hold?: Ref.Ref<boolean>;
};

const SPEECH_STARTED: TurnEvent = { _tag: 'SpeechStarted' };
const TURN_ENDED: TurnEvent = { _tag: 'TurnEnded' };

function eventsOf(result: TurnFrameResult): readonly TurnEvent[] {
  if (result.speechStarted) return [SPEECH_STARTED];
  if (result.turnEnded) return [TURN_ENDED];
  return [];
}

export function turnEvents(source: FrameSource, options: TurnOptions): Stream.Stream<TurnEvent> {
  return Stream.unwrap(
    Effect.gen(function* () {
      const initialNoiseFloor = yield* source.noiseFloor;
      const detector = createTurnDetector({ endPauseMs: options.endPauseMs, initialNoiseFloor });
      const settleMs = options.settleMs ?? 0;
      let settledMs = 0;

      function isSettling(frame: AudioFrame): boolean {
        if (settledMs >= settleMs) return false;
        settledMs += frame.durationMs;
        return true;
      }

      function detect(frame: AudioFrame) {
        return Effect.gen(function* () {
          if (isSettling(frame)) return [];
          if (options.hold) detector.setHold(yield* Ref.get(options.hold));
          return eventsOf(detector.push(frame.rms, frame.durationMs));
        });
      }

      return source.frames.pipe(Stream.mapEffect(detect), Stream.flattenIterable);
    }),
  );
}

export function speechOnsets(
  source: FrameSource,
  options: { readonly isEnabled: Effect.Effect<boolean> },
): Stream.Stream<void> {
  return Stream.unwrap(
    Effect.gen(function* () {
      const noiseFloor = yield* source.noiseFloor;
      const isEnabled = yield* options.isEnabled;
      let onset = false;
      const detector = createInterruptSpeechDetector({
        isEnabled,
        noiseFloor,
        onSpeechStarted: () => {
          onset = true;
        },
      });
      return source.frames.pipe(
        Stream.filter((frame) => {
          onset = false;
          detector.push(frame);
          return onset;
        }),
        Stream.map(() => undefined),
      );
    }),
  );
}

export function meterLevels(source: FrameSource): Stream.Stream<number> {
  return source.frames.pipe(Stream.map((frame) => signalMeterValue(frame.rms)));
}
