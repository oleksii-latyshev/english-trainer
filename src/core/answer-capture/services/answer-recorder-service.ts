import { Context, Deferred, Effect, Layer, type Scope } from 'effect';
import {
  type ActualAudioInput,
  type Capture,
  Microphone,
  type MicrophoneError,
  type MicrophoneSession,
  readPreferredMicrophone,
  WarmMicrophone,
} from '@/core/audio';

export type OpenedAnswer = {
  readonly input: ActualAudioInput;
  readonly capture: Capture;
  readonly lost: MicrophoneSession['lost'];
  readonly turns: MicrophoneSession['turns'] | null;
};

type AnswerRecorderShape = {
  readonly open: (options: {
    readonly preRollMs: number;
  }) => Effect.Effect<OpenedAnswer, MicrophoneError, Scope.Scope>;
};

export class AnswerRecorder extends Context.Service<AnswerRecorder, AnswerRecorderShape>()(
  'core/answer-capture/AnswerRecorder',
) {
  static readonly layer = Layer.effect(
    AnswerRecorder,
    Effect.gen(function* () {
      const warm = yield* WarmMicrophone;
      const microphone = yield* Microphone;
      return {
        open: ({ preRollMs }) =>
          Effect.gen(function* () {
            const slot = yield* warm.ensure;
            if (slot) {
              const session = yield* Deferred.await(slot.session);
              const capture = yield* session.capture({ preRollMs });
              return { input: session.input, capture, lost: session.lost, turns: session.turns };
            }
            const session = yield* microphone.open({ deviceId: readPreferredMicrophone() });
            yield* session.warmed;
            const capture = yield* session.capture({ preRollMs: 0 });
            return { input: session.input, capture, lost: session.lost, turns: null };
          }),
      };
    }),
  );
}
