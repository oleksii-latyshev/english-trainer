import { Cause, Context, Data, Effect, Exit, Layer, Queue, Stream } from 'effect';

export class SystemVoiceError extends Data.TaggedError('SystemVoiceError')<{
  readonly reason: 'unsupported' | 'playback-failed';
}> {}

export type SystemUtterance = {
  readonly text: string;
  readonly voiceURI: string | null;
  readonly rate: number;
};

export type SystemVoiceShape = {
  readonly isSupported: Effect.Effect<boolean>;
  readonly voices: Stream.Stream<readonly SpeechSynthesisVoice[]>;
  readonly speak: (utterance: SystemUtterance) => Stream.Stream<void, SystemVoiceError>;
  readonly pause: Effect.Effect<void>;
  readonly resume: Effect.Effect<void>;
  readonly cancel: Effect.Effect<void>;
};

function isSupported(): boolean {
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function onSynthesisSync(run: (synthesis: SpeechSynthesis) => void): void {
  if (isSupported()) run(window.speechSynthesis);
}

function onSynthesis(run: (synthesis: SpeechSynthesis) => void): Effect.Effect<void> {
  return Effect.sync(() => onSynthesisSync(run));
}

function discoveredVoices(): readonly SpeechSynthesisVoice[] {
  return isSupported() ? window.speechSynthesis.getVoices() : [];
}

function publishVoices(
  queue: Queue.Queue<readonly SpeechSynthesisVoice[], Cause.Done>,
): () => void {
  return function publish() {
    const voices = discoveredVoices();
    if (voices.length > 0) Queue.offerUnsafe(queue, voices);
  };
}

const voiceLists = Stream.callback<readonly SpeechSynthesisVoice[]>((queue) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const publish = publishVoices(queue);
      onSynthesisSync((synthesis) => synthesis.addEventListener('voiceschanged', publish));
      publish();
      return publish;
    }),
    (publish) =>
      Effect.sync(() =>
        onSynthesisSync((synthesis) => synthesis.removeEventListener('voiceschanged', publish)),
      ),
  ),
);

function speakUtterance(utterance: SystemUtterance): Stream.Stream<void, SystemVoiceError> {
  return Stream.callback<void, SystemVoiceError>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!isSupported()) {
          Queue.failCauseUnsafe(queue, Cause.fail(new SystemVoiceError({ reason: 'unsupported' })));
          return;
        }
        const spoken = new SpeechSynthesisUtterance(utterance.text);
        spoken.voice =
          discoveredVoices().find((voice) => voice.voiceURI === utterance.voiceURI) ?? null;
        spoken.rate = utterance.rate;
        spoken.onstart = () => Queue.offerUnsafe(queue, undefined);
        spoken.onend = () => Queue.endUnsafe(queue);
        spoken.onerror = () =>
          Queue.failCauseUnsafe(
            queue,
            Cause.fail(new SystemVoiceError({ reason: 'playback-failed' })),
          );
        window.speechSynthesis.speak(spoken);
      }),
      (_, exit) =>
        Exit.isSuccess(exit) ? Effect.void : onSynthesis((synthesis) => synthesis.cancel()),
    ),
  );
}

export class SystemVoice extends Context.Service<SystemVoice, SystemVoiceShape>()(
  'core/speech/SystemVoice',
) {
  static readonly layer = Layer.succeed(SystemVoice, {
    isSupported: Effect.sync(isSupported),
    voices: voiceLists,
    speak: speakUtterance,
    pause: onSynthesis((synthesis) => synthesis.pause()),
    resume: onSynthesis((synthesis) => synthesis.resume()),
    cancel: onSynthesis((synthesis) => synthesis.cancel()),
  });
}
