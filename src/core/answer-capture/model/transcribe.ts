import { Effect, Option } from 'effect';
import type { AtomRegistry } from 'effect/reactivity';
import type { ActualAudioInput } from '@/core/audio';
import { isTauriRuntime } from '@/core/ipc';
import {
  SpeechRecognition,
  type TranscriptionRecovery,
  transcriptionFailureOutcome,
  transcriptOutcome,
} from '@/core/speech';
import type { Recording } from '../types';
import { discardRecording } from './recording-clip';
import { captureStateAtom, captureTimingAtom } from './state';

export const DESKTOP_ONLY_TRANSCRIPTION: TranscriptionRecovery = {
  kind: 'setup',
  message: 'Open the desktop app with bun run dev to use local transcription.',
};

type Subject = {
  readonly recording: Recording;
  readonly wav: Blob;
  readonly actualInput: ActualAudioInput | undefined;
};

function failTranscription(registry: AtomRegistry.AtomRegistry, subject: Subject, cause: unknown) {
  const { recording, actualInput } = subject;
  const { failure, keepsRecording } = transcriptionFailureOutcome(cause);
  if (!keepsRecording) {
    discardRecording(registry);
    registry.set(captureStateAtom, { tag: 'error', message: '', failure, actualInput });
    return;
  }
  registry.set(captureStateAtom, { ...recording, tag: 'ready', failure, actualInput });
}

function finishTranscription(
  registry: AtomRegistry.AtomRegistry,
  subject: Subject,
  answer: { readonly text: string; readonly sttMs: number },
) {
  const { recording, actualInput } = subject;
  registry.update(captureTimingAtom, (timing) => ({ ...timing, sttMs: answer.sttMs }));
  discardRecording(registry);
  const outcome = transcriptOutcome(answer.text);
  if (outcome.tag === 'no-speech') {
    registry.set(captureStateAtom, {
      tag: 'error',
      message: '',
      failure: outcome.failure,
      actualInput,
    });
    return;
  }
  registry.set(captureStateAtom, {
    tag: 'transcript',
    text: outcome.text,
    durationMs: recording.durationMs,
    speechStoppedAtMs: recording.speechStoppedAtMs,
    actualInput,
  });
}

export function transcribeRecording(registry: AtomRegistry.AtomRegistry, subject: Subject) {
  return Effect.gen(function* () {
    const { recording, actualInput } = subject;
    if (!isTauriRuntime()) {
      registry.set(captureStateAtom, {
        ...recording,
        tag: 'ready',
        actualInput,
        failure: DESKTOP_ONLY_TRANSCRIPTION,
      });
      return;
    }
    registry.set(captureStateAtom, { ...recording, tag: 'transcribing', actualInput });
    const recognition = yield* SpeechRecognition;
    const answer = yield* recognition.transcribe(subject.wav).pipe(
      Effect.map(Option.some),
      Effect.catch((cause) =>
        Effect.sync(() => {
          failTranscription(registry, subject, cause);
          return Option.none();
        }),
      ),
    );
    if (Option.isSome(answer)) finishTranscription(registry, subject, answer.value);
  });
}
