import { Effect, Exit } from 'effect';
import { Atom, type AtomRegistry } from 'effect/reactivity';
import {
  LEARNING_MEMORY,
  learningMemoryRuntime,
  type RecallResult,
  ReviewRunService,
} from '@/core/learning-memory';
import { createPlayback, transcriptionFailureOutcome, transcriptOutcome } from '@/core/speech';
import {
  begin,
  fail,
  isTooLong,
  isTryingAgain,
  pendingItem,
  practiced,
  saved,
} from '../helpers/review-session';
import { AnswerCapture } from '../services/answer-capture-service';
import {
  captureOutcomeAtom,
  frozenPromptAtom,
  IDLE_OUTCOME,
  lastTranscriptAtom,
  liveTextAtom,
} from './capture-state';
import { refreshMaterialsAtom } from './materials-atoms';
import { generatedPromptAtom } from './prompt-atoms';
import { captureRuntime } from './runtime';
import { sessionAtom } from './session-atoms';

function afterSave(registry: AtomRegistry.AtomRegistry, exit: Exit.Exit<RecallResult, unknown>) {
  const latest = registry.get(sessionAtom);
  if (latest === null) return;
  const next = Exit.isSuccess(exit) ? saved(latest, exit.value) : null;
  if (next === null) {
    registry.set(sessionAtom, fail(latest, 'save'));
    return;
  }
  registry.set(sessionAtom, next);
  registry.set(lastTranscriptAtom, null);
  registry.set(captureOutcomeAtom, IDLE_OUTCOME);
  registry.set(refreshMaterialsAtom, undefined);
}

function saveAnswer(registry: AtomRegistry.AtomRegistry, text: string) {
  return Effect.gen(function* () {
    const session = registry.get(sessionAtom);
    const item = session === null ? null : pendingItem(session);
    if (session === null || item === null || session.pending !== 'none') return;
    if (isTooLong(text)) {
      registry.set(sessionAtom, fail(session, 'too-long'));
      return;
    }
    registry.set(sessionAtom, begin(session, 'saving'));
    const service = yield* ReviewRunService;
    const exit = yield* Effect.exit(
      service.submit({
        runId: session.run.run_id,
        itemType: item.item_type,
        itemId: item.item_id,
        transcript: text,
      }),
    );
    afterSave(registry, exit);
  });
}

export const submitTranscriptAtom = Atom.keepAlive(
  learningMemoryRuntime.fn(
    Effect.fn('submitTranscript')(function* (text: string, get: Atom.FnContext) {
      const session = get.registry.get(sessionAtom);
      if (session === null) return;
      if (session.step.tag === 'answering') {
        yield* saveAnswer(get.registry, text);
        return;
      }
      if (isTryingAgain(session)) {
        get.set(sessionAtom, practiced(session, text));
        get.set(lastTranscriptAtom, null);
      }
    }),
    { reactivityKeys: LEARNING_MEMORY },
  ),
);

export const saveAgainAtom = Atom.keepAlive(
  learningMemoryRuntime.fn(
    Effect.fn('saveAgain')(function* (_: undefined, get: Atom.FnContext) {
      const text = get.registry.get(lastTranscriptAtom);
      if (text !== null) yield* saveAnswer(get.registry, text);
    }),
    { reactivityKeys: LEARNING_MEMORY },
  ),
);

function transcribeEffect(registry: AtomRegistry.AtomRegistry, wav: Blob) {
  return Effect.gen(function* () {
    const capture = yield* AnswerCapture;
    registry.set(captureOutcomeAtom, { tag: 'transcribing' });
    const text = yield* capture.transcribe(wav).pipe(
      Effect.map((answer) => answer.text),
      Effect.catch((cause) =>
        Effect.sync(() => {
          const { failure, keepsRecording } = transcriptionFailureOutcome(cause);
          registry.set(captureOutcomeAtom, {
            tag: 'transcription-failed',
            recovery: failure,
            wav: keepsRecording ? wav : null,
          });
          return null;
        }),
      ),
    );
    if (text === null) return;
    const outcome = transcriptOutcome(text);
    if (outcome.tag === 'no-speech') {
      registry.set(captureOutcomeAtom, {
        tag: 'transcription-failed',
        recovery: outcome.failure,
        wav: null,
      });
      return;
    }
    registry.set(captureOutcomeAtom, IDLE_OUTCOME);
    registry.set(lastTranscriptAtom, outcome.text);
    registry.set(submitTranscriptAtom, outcome.text);
  });
}

export const answerAtom = Atom.keepAlive(
  captureRuntime.fn(
    Effect.fn('answer')(function* (_: undefined, get: Atom.FnContext) {
      const capture = yield* AnswerCapture;
      const { registry } = get;
      registry.set(captureOutcomeAtom, IDLE_OUTCOME);
      registry.set(liveTextAtom, '');
      registry.set(lastTranscriptAtom, null);
      if (registry.get(frozenPromptAtom) === null) {
        registry.set(frozenPromptAtom, registry.get(generatedPromptAtom));
      }
      createPlayback(registry).stop();
      const wav = yield* capture
        .record((text) => registry.set(liveTextAtom, text))
        .pipe(
          Effect.map((clip) => clip.wav),
          Effect.ensuring(Effect.sync(() => registry.set(liveTextAtom, ''))),
          Effect.catch((error) =>
            Effect.sync(() => {
              registry.set(captureOutcomeAtom, {
                tag: 'microphone-failed',
                message: error.message,
              });
              return null;
            }),
          ),
        );
      if (wav !== null) yield* transcribeEffect(registry, wav);
    }),
  ),
);

export const transcribeAgainAtom = Atom.keepAlive(
  captureRuntime.fn(
    Effect.fn('transcribeAgain')(function* (_: undefined, get: Atom.FnContext) {
      const outcome = get.registry.get(captureOutcomeAtom);
      if (outcome.tag === 'transcription-failed' && outcome.wav !== null) {
        yield* transcribeEffect(get.registry, outcome.wav);
      }
    }),
  ),
);
